const admin = require("firebase-admin")
const { adjustEvaluationTime, isMarketOpen } = require("./marketHours")
const { createClient } = require("redis")

const HORIZONS = {
  "1h": 60,
  "24h": 1440,
  "7d": 10080,
}

const FX_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "SEK",
  "NOK",
  "MXN",
  "CNH",
])
const PAIR_QUOTES = new Set([
  "USDT",
  "USDC",
  "USD",
  "BTC",
  "ETH",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "AUD",
  "CAD",
  "NZD",
])

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  marketDataGatewayUrl: process.env.MARKET_DATA_GATEWAY_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  redisLatestMaxAgeMs: parseInt(process.env.REDIS_LATEST_MAX_AGE_MS || "120000", 10),
  evalLookbackHours: parseInt(process.env.EVAL_LOOKBACK_HOURS || "168", 10),
  evalMaxSignals: parseInt(process.env.EVAL_MAX_SIGNALS || "120", 10),
  aggLookbackDays: parseInt(process.env.EVAL_AGG_LOOKBACK_DAYS || "30", 10),
  aggMaxSignals: parseInt(process.env.EVAL_AGG_MAX_SIGNALS || "600", 10),
  minBotSignals: parseInt(process.env.EVAL_MIN_BOT_SIGNALS || "3", 10),
  minSymbolSignals: parseInt(process.env.EVAL_MIN_SYMBOL_SIGNALS || "5", 10),
  maxSymbolResults: parseInt(process.env.EVAL_SYMBOL_RESULT_LIMIT || "8", 10),
  maxStockSymbols: parseInt(process.env.EVAL_MAX_STOCK_SYMBOLS || "8", 10),
  maxFxPairs: parseInt(process.env.EVAL_MAX_FX_PAIRS || "8", 10),
  runId: process.env.RUN_ID || "",
  firestoreRunField: process.env.FIRESTORE_RUN_FIELD || "runId",
}

const caches = {
  binance: new Map(),
  fmpStocksDaily: new Map(),
  fmpStocksIntraday: new Map(),
  fmpForexDaily: new Map(),
  fmpForexIntraday: new Map(),
}

let marketPriceCache = null
let marketPriceCacheAt = 0
const MARKET_PRICE_CACHE_MS = 60 * 1000
const REFERENCE_TOLERANCE_MS = 5 * 60 * 1000

let redis = null
let redisReady = false

function parseNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === "function") return value.toDate()
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function resolveRedisKey(suffix) {
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}${suffix}`
}

async function initRedis() {
  if (!config.redisUrl) return null
  const client = createClient({ url: config.redisUrl })
  client.on("error", (err) => {
    const message = err?.message ? String(err.message) : "Unknown error"
    console.error("Redis error:", message)
  })
  try {
    await client.connect()
    redisReady = true
    console.log("Redis connected")
    return client
  } catch (err) {
    console.error("Redis connection failed:", err.message)
    redisReady = false
    return null
  }
}

async function readRedisJson(key) {
  if (!redis || !redisReady) return null
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.error("Redis read failed:", err.message)
    return null
  }
}

async function loadRedisPriceSnapshot() {
  const payload = await readRedisJson(resolveRedisKey("prices:latest"))
  if (!payload || !Array.isArray(payload.items)) return null
  const updatedAt = parseTimestamp(payload.updatedAt)
  if (updatedAt && Date.now() - updatedAt.getTime() > config.redisLatestMaxAgeMs) {
    return null
  }
  const map = new Map()
  payload.items.forEach((item) => {
    const key = getSnapshotKey(item.assetClass, item.symbol)
    const price = parseNumber(item.price)
    if (!key || price === null) return
    map.set(key, { price, source: item.source || payload?.meta?.source || "redis" })
  })
  return { map, updatedAt: updatedAt || null }
}

function looksLikePair(left, right) {
  if (!left || !right) return false
  const base = String(left).toUpperCase()
  const quote = String(right).toUpperCase()
  if (PAIR_QUOTES.has(quote)) return true
  if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) return true
  return false
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  const compact = upper.replace(/\s+/g, "")
  if (compact.includes("/") || compact.includes("-")) {
    const separator = compact.includes("/") ? "/" : "-"
    const parts = compact.split(separator).filter(Boolean)
    if (parts.length === 2 && looksLikePair(parts[0], parts[1])) {
      return `${parts[0]}/${parts[1]}`
    }
    return compact
  }
  if (compact.length === 6) {
    const base = compact.slice(0, 3)
    const quote = compact.slice(3)
    if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
      return `${base}/${quote}`
    }
  }
  const quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR"]
  for (const quote of quotes) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      return `${compact.slice(0, -quote.length)}/${quote}`
    }
  }
  return compact
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function extractSymbolFromSignal(signal) {
  const data = signal.data || {}
  const candidate =
    signal.symbol ||
    signal.pair ||
    signal.market ||
    signal.trading_pair ||
    signal.tradingPair ||
    data.symbol ||
    data.pair ||
    data.market ||
    data.trading_pair ||
    data.tradingPair ||
    data.instrument ||
    signal.symbol

  if (candidate) return normalizeSymbol(candidate)

  const text = `${signal.message || ""}`.toUpperCase()
  const match = text.match(/[A-Z0-9]{2,10}[/-][A-Z0-9]{2,10}/)
  return match ? normalizeSymbol(match[0]) : null
}

function classifySymbol(raw) {
  const pair = normalizeSymbol(raw)
  if (pair && pair.includes("/")) {
    const [base, quote] = pair.split("/")
    if (FX_CURRENCIES.has(base) && FX_CURRENCIES.has(quote)) {
      return { assetClass: "forex", symbol: `${base}/${quote}` }
    }
    return { assetClass: "crypto", symbol: `${base}/${quote}` }
  }
  const ticker = normalizeTicker(raw)
  if (ticker) return { assetClass: "stock", symbol: ticker }
  return null
}

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: config.projectId })
  }
  return admin.firestore()
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

function resolveGatewayBase() {
  if (!config.marketDataGatewayUrl) {
    throw new Error("MARKET_DATA_GATEWAY_URL is not configured")
  }
  return config.marketDataGatewayUrl.endsWith("/")
    ? config.marketDataGatewayUrl
    : `${config.marketDataGatewayUrl}/`
}

function buildGatewayUrl(path, params) {
  const base = resolveGatewayBase()
  const normalizedPath = String(path || "").replace(/^\/+/, "")
  const url = new URL(normalizedPath, base)
  if (params) {
    url.search = new URLSearchParams(params).toString()
  }
  return url.toString()
}

async function fetchGatewayJson(path, params) {
  const url = buildGatewayUrl(path, params)
  return fetchJson(url)
}

function normalizeFmpSymbol(symbol, assetClass) {
  if (!symbol) return null
  const cleaned = String(symbol).trim().toUpperCase()
  if (!cleaned) return null
  if (assetClass === "forex") {
    return cleaned.replace(/[\\/-]/g, "")
  }
  return cleaned.replace(/\s+/g, "")
}

function parseFmpSeries(data) {
  if (!Array.isArray(data)) return null
  const entries = data
    .map((entry) => {
      const time = entry.date || entry.time || entry.timestamp
      const parsed = time ? new Date(time).getTime() : null
      const close = parseNumber(entry.close)
      if (!parsed || close === null) return null
      return { time: parsed, close }
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time)
  return entries.length > 0 ? entries : null
}

function getFmpCache(assetClass, interval) {
  if (assetClass === "forex") {
    return interval === "15min" ? caches.fmpForexIntraday : caches.fmpForexDaily
  }
  return interval === "15min" ? caches.fmpStocksIntraday : caches.fmpStocksDaily
}

async function fetchFmpSeries(symbol, assetClass, interval) {
  if (!config.marketDataGatewayUrl) return null
  const normalized = normalizeFmpSymbol(symbol, assetClass)
  if (!normalized) return null
  const cache = getFmpCache(assetClass, interval)
  const key = `${normalized}|${interval}`
  if (cache.has(key)) return cache.get(key)

  try {
    const data = await fetchGatewayJson("/v1/fmp/candles", {
      symbol,
      assetClass,
      interval,
      limit: "500",
    })
    const series = parseFmpSeries(data?.candles)
    cache.set(key, series)
    return series
  } catch (err) {
    cache.set(key, null)
    return null
  }
}

async function getFmpPrice(symbol, assetClass, interval, timestampMs) {
  const series = await fetchFmpSeries(symbol, assetClass, interval)
  if (!series) return null
  const close = findIntradayClose(series, timestampMs)
  if (!close) return null
  return { price: close, source: "fmp" }
}

async function fetchBinanceClose(symbol, interval, bucketStart) {
  const key = `${symbol}|${interval}|${bucketStart}`
  if (caches.binance.has(key)) return caches.binance.get(key)
  if (!config.marketDataGatewayUrl) {
    caches.binance.set(key, null)
    return null
  }

  const intervalMs = interval === "1h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000

  try {
    const payload = await fetchGatewayJson("/v1/binance/klines", {
      symbol,
      interval,
      startTime: String(bucketStart),
      endTime: String(bucketStart + intervalMs),
      limit: "1",
    })
    const data = Array.isArray(payload?.data) ? payload.data : []
    if (!Array.isArray(data) || data.length === 0) {
      caches.binance.set(key, null)
      return null
    }
    const close = parseNumber(data[0][4])
    caches.binance.set(key, close)
    return close
  } catch (err) {
    caches.binance.set(key, null)
    return null
  }
}

async function getCryptoPrice(pair, timestampMs, horizonKey) {
  const [base, quoteRaw] = pair.split("/")
  if (!base || !quoteRaw) return null
  const quote = quoteRaw === "USD" ? "USDT" : quoteRaw

  const interval = horizonKey === "1h" ? "1h" : "1d"
  const intervalMs = interval === "1h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const bucketStart = Math.floor(timestampMs / intervalMs) * intervalMs

  const candidates = quote === quoteRaw
    ? [`${base}${quote}`]
    : [`${base}${quote}`, `${base}${quoteRaw}`]

  for (const symbol of candidates) {
    const price = await fetchBinanceClose(symbol, interval, bucketStart)
    if (price) {
      return { price, source: "binance" }
    }
  }

  return null
}

function findIntradayClose(entries, targetTime) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  const target = typeof targetTime === "number" ? targetTime : new Date(targetTime).getTime()
  let best = null
  let bestTime = -Infinity
  for (const entry of entries) {
    if (!entry?.time || !entry?.close) continue
    if (entry.time <= target && entry.time > bestTime) {
      bestTime = entry.time
      best = entry.close
    }
  }
  return best
}

async function getStockPrice(symbol, timestampMs) {
  return getFmpPrice(symbol, "stock", "1day", timestampMs)
}

async function getStockIntradayPrice(symbol, timestampMs) {
  return getFmpPrice(symbol, "stock", "15min", timestampMs)
}

async function getFxIntradayPrice(pair, timestampMs) {
  return getFmpPrice(pair, "forex", "15min", timestampMs)
}

function getSnapshotKey(assetClass, symbol) {
  if (!assetClass || !symbol) return null
  if (assetClass === "stock") {
    const ticker = normalizeTicker(symbol)
    return ticker ? `stock:${ticker}` : null
  }
  if (assetClass === "forex") {
    const pair = normalizeSymbol(symbol)
    return pair ? `forex:${pair}` : null
  }
  const pair = normalizeSymbol(symbol)
  return pair ? `crypto:${pair}` : null
}

async function loadPriceDocument(db, docPath) {
  const snap = await db.doc(docPath).get()
  if (!snap.exists) return null
  const data = snap.data() || {}
  const items = Array.isArray(data.items) ? data.items : []
  const map = new Map()
  const updatedAt = parseTimestamp(data.updatedAt) || null

  items.forEach((item) => {
    const key = getSnapshotKey(item.assetClass, item.symbol)
    const price = parseNumber(item.price)
    if (!key || price === null) return
    map.set(key, { price, source: item.source || data.source || null })
  })

  return { map, updatedAt }
}

async function getMarketPriceSnapshot(db) {
  if (marketPriceCache && Date.now() - marketPriceCacheAt < MARKET_PRICE_CACHE_MS) {
    return marketPriceCache
  }

  try {
    const redisSnapshot = await loadRedisPriceSnapshot()
    const live = redisSnapshot || (await loadPriceDocument(db, "market/prices"))
    const snapshot =
      live && live.map && live.map.size > 0
        ? live
        : await loadPriceDocument(db, "market/prices_snapshot")

    marketPriceCache = snapshot || null
    marketPriceCacheAt = Date.now()
    return marketPriceCache
  } catch (err) {
    marketPriceCache = null
    marketPriceCacheAt = Date.now()
    return null
  }
}

function lookupSnapshotPrice(snapshot, assetClass, symbol) {
  if (!snapshot?.map) return null
  const key = getSnapshotKey(assetClass, symbol)
  if (!key) return null
  return snapshot.map.get(key) || null
}

async function evaluateSignals(db) {
  const nowMs = Date.now()
  const cutoff = new Date(nowMs - config.evalLookbackHours * 60 * 60 * 1000)
  const minHorizonMinutes = Math.min(...Object.values(HORIZONS))
  const eligibleBefore = new Date(nowMs - minHorizonMinutes * 60 * 1000)
  const priceSnapshot = await getMarketPriceSnapshot(db)
  const snap = await db
    .collectionGroup("signals")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(cutoff))
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(eligibleBefore))
    .orderBy("createdAt", "desc")
    .limit(config.evalMaxSignals)
    .get()

  const processed = { updated: 0, skipped: 0 }
  const seenStockSymbols = new Set()
  const seenFxPairs = new Set()

  for (const doc of snap.docs) {
    const data = doc.data() || {}
    const side = typeof data.side === "string" ? data.side.toLowerCase() : null
    if (!side || !["buy", "sell"].includes(side)) {
      processed.skipped += 1
      continue
    }
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null
    if (!createdAt) {
      processed.skipped += 1
      continue
    }
    const referenceCapturedAt = parseTimestamp(data?.data?.referenceCapturedAt)
    const referenceFresh =
      referenceCapturedAt &&
      Math.abs(referenceCapturedAt.getTime() - createdAt.getTime()) <= REFERENCE_TOLERANCE_MS

    const extracted = extractSymbolFromSignal(data)
    const classification = classifySymbol(extracted || "")
    if (!classification) {
      processed.skipped += 1
      continue
    }

    if (classification.assetClass === "stock") {
      seenStockSymbols.add(classification.symbol)
      if (seenStockSymbols.size > config.maxStockSymbols) {
        processed.skipped += 1
        continue
      }
    }
    if (classification.assetClass === "forex") {
      seenFxPairs.add(classification.symbol)
      if (seenFxPairs.size > config.maxFxPairs) {
        processed.skipped += 1
        continue
      }
    }

    const existingEval = data.evaluation || {}
    const existingHorizons = existingEval.horizons || {}
    const newHorizons = {}

    for (const [horizonKey, minutes] of Object.entries(HORIZONS)) {
      if (existingHorizons[horizonKey]?.returnPct !== undefined) continue

      const horizonMs = minutes * 60 * 1000
      const startMs = createdAt.getTime()

      // Adjust evaluation times for market hours
      const adjustment = adjustEvaluationTime(
        classification.assetClass,
        startMs,
        minutes
      )
      const adjustedStartMs = adjustment.adjustedSignalTime.getTime()
      const adjustedHorizonMs = adjustment.adjustedHorizonTime.getTime()
      const marketWasOpen = isMarketOpen(classification.assetClass, startMs)

      // Check if enough time has passed for the adjusted horizon
      if (nowMs < adjustedHorizonMs) continue

      let priceAtSignal = null
      let priceAtHorizon = null
      let source = null
      let usedReferencePrice = false
      let usedSnapshotPrice = false

      if (classification.assetClass === "crypto") {
        const first = await getCryptoPrice(classification.symbol, adjustedStartMs, horizonKey)
        const second = await getCryptoPrice(
          classification.symbol,
          adjustedHorizonMs,
          horizonKey
        )
        priceAtSignal = first?.price ?? null
        priceAtHorizon = second?.price ?? null
        source = first?.source || second?.source || null
      } else if (classification.assetClass === "stock") {
        const useIntraday = horizonKey === "1h"
        const first = useIntraday
          ? await getStockIntradayPrice(classification.symbol, adjustedStartMs)
          : await getStockPrice(classification.symbol, adjustedStartMs)
        const second = useIntraday
          ? await getStockIntradayPrice(classification.symbol, adjustedHorizonMs)
          : await getStockPrice(classification.symbol, adjustedHorizonMs)
        priceAtSignal = first?.price ?? null
        priceAtHorizon = second?.price ?? null
        source = first?.source || second?.source || null
  } else if (classification.assetClass === "forex") {
        if (horizonKey === "1h") {
          const first = await getFxIntradayPrice(classification.symbol, adjustedStartMs)
          const second = await getFxIntradayPrice(
            classification.symbol,
            adjustedHorizonMs
          )
          priceAtSignal = first?.price ?? null
          priceAtHorizon = second?.price ?? null
          source = first?.source || second?.source || null
        } else {
          const fmpStart = await getFmpPrice(
            classification.symbol,
            "forex",
            "1day",
            adjustedStartMs
          )
          const fmpEnd = await getFmpPrice(
            classification.symbol,
            "forex",
            "1day",
            adjustedHorizonMs
          )
          if (fmpStart && fmpEnd) {
            priceAtSignal = fmpStart.price ?? null
            priceAtHorizon = fmpEnd.price ?? null
            source = fmpStart.source || fmpEnd.source || null
          }
        }
      }

      if (!priceAtSignal) {
        const referencePrice = parseNumber(
          data?.data?.referencePrice ?? data?.data?.price
        )
        if (referencePrice !== null && referenceFresh) {
          priceAtSignal = referencePrice
          usedReferencePrice = true
          source =
            source ||
            data?.data?.referenceSource ||
            data?.data?.priceSource ||
            "market-intel"
        }
      }

      if (!priceAtHorizon) {
        const snapshot = lookupSnapshotPrice(
          priceSnapshot,
          classification.assetClass,
          classification.symbol
        )
        const snapshotUpdatedAtMs = priceSnapshot?.updatedAt?.getTime?.() ?? null
        if (
          snapshot?.price !== undefined &&
          snapshotUpdatedAtMs &&
          snapshotUpdatedAtMs >= adjustedHorizonMs
        ) {
          priceAtHorizon = snapshot.price
          usedSnapshotPrice = true
          source = source || snapshot.source || "market-intel"
        }
      }

      if (!priceAtSignal || !priceAtHorizon) continue
      if (usedReferencePrice && usedSnapshotPrice && priceAtSignal === priceAtHorizon) {
        continue
      }

      const delta = priceAtHorizon - priceAtSignal
      const returnPct = side === "buy"
        ? (delta / priceAtSignal) * 100
        : (-delta / priceAtSignal) * 100

      // Build horizon evaluation result
      const horizonResult = {
        returnPct: Number(returnPct.toFixed(4)),
        hit: returnPct > 0,
        priceAtSignal,
        priceAtHorizon,
        source,
        marketOpenAtSignal: marketWasOpen,
      }

      // Add adjusted times if market hours adjustment was needed
      if (adjustment.wasAdjusted) {
        horizonResult.adjustedSignalTime = admin.firestore.Timestamp.fromDate(
          adjustment.adjustedSignalTime
        )
        horizonResult.adjustedHorizonTime = admin.firestore.Timestamp.fromDate(
          adjustment.adjustedHorizonTime
        )
      }

      newHorizons[horizonKey] = horizonResult
    }

    const resolvedSymbol = classification.symbol
    const needsSymbolUpdate = resolvedSymbol && data.symbol !== resolvedSymbol

    if (Object.keys(newHorizons).length === 0 && !needsSymbolUpdate) {
      processed.skipped += 1
      continue
    }

    await doc.ref.set(
      {
        symbol: resolvedSymbol || data.symbol || null,
        evaluation: {
          assetClass: classification.assetClass,
          symbol: resolvedSymbol,
          evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
          horizons: {
            ...existingHorizons,
            ...newHorizons,
          },
        },
      },
      { merge: true }
    )

    processed.updated += 1
  }

  return processed
}

function ensureBucket(stats, horizonKey) {
  if (!stats[horizonKey]) {
    stats[horizonKey] = { count: 0, hits: 0, returnSum: 0 }
  }
  return stats[horizonKey]
}

function ensureNestedBucket(container, key, horizonKey) {
  if (!container[key]) container[key] = {}
  return ensureBucket(container[key], horizonKey)
}

async function buildPerformanceReport(db) {
  const cutoff = new Date(Date.now() - config.aggLookbackDays * 24 * 60 * 60 * 1000)
  const snap = await db
    .collectionGroup("signals")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(cutoff))
    .orderBy("createdAt", "desc")
    .limit(config.aggMaxSignals)
    .get()

  const overall = {}
  const bots = {}
  const assets = {}
  const symbols = {}
  const botSymbols = {}
  const botAssets = {}

  snap.docs.forEach((doc) => {
    const data = doc.data() || {}
    const botId = doc.ref.parent.parent?.id || data.botId || "unknown"
    const horizons = data.evaluation?.horizons || {}
    const assetClass = data.evaluation?.assetClass || null
    const symbol = data.evaluation?.symbol || data.symbol || null

    Object.entries(HORIZONS).forEach(([horizonKey]) => {
      const entry = horizons[horizonKey]
      if (!entry || typeof entry.returnPct !== "number") return
      const bucket = ensureBucket(overall, horizonKey)
      bucket.count += 1
      if (entry.hit) bucket.hits += 1
      bucket.returnSum += entry.returnPct

      if (!bots[botId]) bots[botId] = {}
      const botBucket = ensureBucket(bots[botId], horizonKey)
      botBucket.count += 1
      if (entry.hit) botBucket.hits += 1
      botBucket.returnSum += entry.returnPct

      if (assetClass) {
        if (!assets[assetClass]) assets[assetClass] = {}
        const assetBucket = ensureBucket(assets[assetClass], horizonKey)
        assetBucket.count += 1
        if (entry.hit) assetBucket.hits += 1
        assetBucket.returnSum += entry.returnPct
      }

      if (symbol) {
        if (!symbols[symbol]) symbols[symbol] = { assetClass: assetClass || null }
        const symbolBucket = ensureBucket(symbols[symbol], horizonKey)
        symbolBucket.count += 1
        if (entry.hit) symbolBucket.hits += 1
        symbolBucket.returnSum += entry.returnPct
      }

      if (assetClass) {
        if (!botAssets[botId]) botAssets[botId] = {}
        const botAssetBucket = ensureNestedBucket(botAssets[botId], assetClass, horizonKey)
        botAssetBucket.count += 1
        if (entry.hit) botAssetBucket.hits += 1
        botAssetBucket.returnSum += entry.returnPct
      }

      if (symbol) {
        if (!botSymbols[botId]) botSymbols[botId] = {}
        if (!botSymbols[botId][symbol]) {
          botSymbols[botId][symbol] = { assetClass: assetClass || null }
        }
        const botSymbolBucket = ensureBucket(botSymbols[botId][symbol], horizonKey)
        botSymbolBucket.count += 1
        if (entry.hit) botSymbolBucket.hits += 1
        botSymbolBucket.returnSum += entry.returnPct
      }
    })
  })

  const summarize = (bucket) => {
    if (!bucket || bucket.count === 0) return null
    return {
      count: bucket.count,
      hits: bucket.hits,
      hitRate: Number(((bucket.hits / bucket.count) * 100).toFixed(1)),
      avgReturn: Number((bucket.returnSum / bucket.count).toFixed(3)),
    }
  }

  const overallSummary = {}
  Object.keys(HORIZONS).forEach((horizonKey) => {
    const summary = summarize(overall[horizonKey])
    if (summary) overallSummary[horizonKey] = summary
  })

  const topBots = {}
  Object.keys(HORIZONS).forEach((horizonKey) => {
    const entries = Object.entries(bots)
      .map(([botId, stats]) => {
        const summary = summarize(stats[horizonKey])
        if (!summary || summary.count < config.minBotSignals) return null
        return {
          botId,
          count: summary.count,
          hitRate: summary.hitRate,
          avgReturn: summary.avgReturn,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate
        if (b.avgReturn !== a.avgReturn) return b.avgReturn - a.avgReturn
        return b.count - a.count
      })

    topBots[horizonKey] = entries.slice(0, 5)
  })

  const byAsset = {}
  Object.keys(HORIZONS).forEach((horizonKey) => {
    const entries = Object.entries(assets)
      .map(([assetKey, stats]) => {
        const summary = summarize(stats[horizonKey])
        if (!summary) return null
        return {
          assetClass: assetKey,
          count: summary.count,
          hitRate: summary.hitRate,
          avgReturn: summary.avgReturn,
        }
      })
      .filter(Boolean)

    byAsset[horizonKey] = entries
  })

  const topSymbols = {}
  const bottomSymbols = {}
  Object.keys(HORIZONS).forEach((horizonKey) => {
    const entries = Object.entries(symbols)
      .map(([symbolKey, stats]) => {
        const summary = summarize(stats[horizonKey])
        if (!summary || summary.count < config.minSymbolSignals) return null
        return {
          symbol: symbolKey,
          assetClass: stats.assetClass || null,
          count: summary.count,
          hitRate: summary.hitRate,
          avgReturn: summary.avgReturn,
        }
      })
      .filter(Boolean)

    const best = [...entries].sort((a, b) => {
      if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate
      if (b.avgReturn !== a.avgReturn) return b.avgReturn - a.avgReturn
      return b.count - a.count
    })
    const worst = [...entries].sort((a, b) => {
      if (a.hitRate !== b.hitRate) return a.hitRate - b.hitRate
      if (a.avgReturn !== b.avgReturn) return a.avgReturn - b.avgReturn
      return a.count - b.count
    })

    topSymbols[horizonKey] = best.slice(0, config.maxSymbolResults)
    bottomSymbols[horizonKey] = worst.slice(0, config.maxSymbolResults)
  })

  const botDocuments = Object.entries(bots).map(([botId, botStats]) => {
    const botOverall = {}
    Object.keys(HORIZONS).forEach((horizonKey) => {
      const summary = summarize(botStats[horizonKey])
      if (summary) botOverall[horizonKey] = summary
    })

    const botAssetStats = botAssets[botId] || {}
    const botByAsset = {}
    Object.keys(HORIZONS).forEach((horizonKey) => {
      const entries = Object.entries(botAssetStats)
        .map(([assetKey, stats]) => {
          const summary = summarize(stats[horizonKey])
          if (!summary) return null
          return {
            assetClass: assetKey,
            count: summary.count,
            hitRate: summary.hitRate,
            avgReturn: summary.avgReturn,
          }
        })
        .filter(Boolean)

      botByAsset[horizonKey] = entries
    })

    const botSymbolStats = botSymbols[botId] || {}
    const botTopSymbols = {}
    const botBottomSymbols = {}
    Object.keys(HORIZONS).forEach((horizonKey) => {
      const entries = Object.entries(botSymbolStats)
        .map(([symbolKey, stats]) => {
          const summary = summarize(stats[horizonKey])
          if (!summary || summary.count < config.minSymbolSignals) return null
          return {
            symbol: symbolKey,
            assetClass: stats.assetClass || null,
            count: summary.count,
            hitRate: summary.hitRate,
            avgReturn: summary.avgReturn,
          }
        })
        .filter(Boolean)

      const best = [...entries].sort((a, b) => {
        if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate
        if (b.avgReturn !== a.avgReturn) return b.avgReturn - a.avgReturn
        return b.count - a.count
      })
      const worst = [...entries].sort((a, b) => {
        if (a.hitRate !== b.hitRate) return a.hitRate - b.hitRate
        if (a.avgReturn !== b.avgReturn) return a.avgReturn - b.avgReturn
        return a.count - b.count
      })

      botTopSymbols[horizonKey] = best.slice(0, config.maxSymbolResults)
      botBottomSymbols[horizonKey] = worst.slice(0, config.maxSymbolResults)
    })

    return {
      botId,
      data: {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        horizons: Object.keys(HORIZONS),
        overall: botOverall,
        byAsset: botByAsset,
        topSymbols: botTopSymbols,
        bottomSymbols: botBottomSymbols,
        meta: {
          lookbackDays: config.aggLookbackDays,
          minSymbolSignals: config.minSymbolSignals,
          runId: config.runId || null,
        },
      },
    }
  })

  await db.doc("analytics/signalPerformance").set(
    {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      horizons: Object.keys(HORIZONS),
      overall: overallSummary,
      topBots,
      byAsset,
      topSymbols,
      bottomSymbols,
      meta: {
        lookbackDays: config.aggLookbackDays,
        signalsScanned: snap.size,
        minBotSignals: config.minBotSignals,
        minSymbolSignals: config.minSymbolSignals,
        runId: config.runId || null,
      },
    },
    { merge: true }
  )

  await Promise.all(
    botDocuments.map(({ botId, data }) =>
      db.collection("bots").doc(botId).collection("analytics").doc("signalPerformance").set(
        data,
        { merge: true }
      )
    )
  )
}

async function run() {
  const db = initAdmin()
  redis = await initRedis()
  console.log("se_run_start", { runId: config.runId || null })

  const evaluation = await evaluateSignals(db)
  console.log("se_eval_updated", { runId: config.runId || null, ...evaluation })

  await buildPerformanceReport(db)
  console.log("se_performance_updated", { runId: config.runId || null })

  if (redis) {
    await redis.quit().catch(() => {})
  }
}

run().catch((err) => {
  console.error("Signal evaluator failed", err)
  process.exit(1)
})
