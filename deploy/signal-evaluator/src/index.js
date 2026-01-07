const admin = require("firebase-admin")

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
  alphaVantageKey: process.env.ALPHAVANTAGE_API_KEY || "",
  alphaThrottleMs: parseInt(process.env.ALPHAVANTAGE_THROTTLE_MS || "12000", 10),
  evalLookbackHours: parseInt(process.env.EVAL_LOOKBACK_HOURS || "168", 10),
  evalMaxSignals: parseInt(process.env.EVAL_MAX_SIGNALS || "120", 10),
  aggLookbackDays: parseInt(process.env.EVAL_AGG_LOOKBACK_DAYS || "30", 10),
  aggMaxSignals: parseInt(process.env.EVAL_AGG_MAX_SIGNALS || "600", 10),
  minBotSignals: parseInt(process.env.EVAL_MIN_BOT_SIGNALS || "3", 10),
  minSymbolSignals: parseInt(process.env.EVAL_MIN_SYMBOL_SIGNALS || "5", 10),
  maxSymbolResults: parseInt(process.env.EVAL_SYMBOL_RESULT_LIMIT || "8", 10),
  maxStockSymbols: parseInt(process.env.EVAL_MAX_STOCK_SYMBOLS || "8", 10),
  maxFxPairs: parseInt(process.env.EVAL_MAX_FX_PAIRS || "8", 10),
}

const caches = {
  binance: new Map(),
  stocks: new Map(),
  stocksIntraday: new Map(),
  forex: new Map(),
  forexIntraday: new Map(),
}

let alphaLastRequestAt = 0
let marketPriceCache = null
let marketPriceCacheAt = 0
const MARKET_PRICE_CACHE_MS = 60 * 1000
const REFERENCE_TOLERANCE_MS = 5 * 60 * 1000

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function fetchAlphaJson(url) {
  if (!config.alphaVantageKey) return null
  const throttleMs = Math.max(config.alphaThrottleMs, 0)
  if (throttleMs > 0) {
    const waitMs = alphaLastRequestAt + throttleMs - Date.now()
    if (waitMs > 0) {
      await sleep(waitMs)
    }
  }
  alphaLastRequestAt = Date.now()
  const data = await fetchJson(url)
  if (
    data &&
    typeof data === "object" &&
    (data.Note || data["Error Message"] || data.Information)
  ) {
    throw new Error(
      `Alpha Vantage throttled: ${data.Note || data["Error Message"] || data.Information}`
    )
  }
  return data
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10)
}

async function fetchBinanceClose(symbol, interval, bucketStart) {
  const key = `${symbol}|${interval}|${bucketStart}`
  if (caches.binance.has(key)) return caches.binance.get(key)

  const intervalMs = interval === "1h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const url = new URL("https://api.binance.com/api/v3/klines")
  url.search = new URLSearchParams({
    symbol,
    interval,
    startTime: String(bucketStart),
    endTime: String(bucketStart + intervalMs),
    limit: "1",
  }).toString()

  try {
    const data = await fetchJson(url.toString())
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

async function fetchAlphaDailySeries(symbol) {
  if (caches.stocks.has(symbol)) return caches.stocks.get(symbol)
  if (!config.alphaVantageKey) return null

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
    symbol
  )}&apikey=${config.alphaVantageKey}`
  try {
    const data = await fetchAlphaJson(url)
    const series = data?.["Time Series (Daily)"]
    if (!series || typeof series !== "object") {
      caches.stocks.set(symbol, null)
      return null
    }
    const entries = Object.entries(series).map(([date, values]) => ({
      date,
      close: parseNumber(values["4. close"]),
    }))
    caches.stocks.set(symbol, entries)
    return entries
  } catch (err) {
    caches.stocks.set(symbol, null)
    return null
  }
}

async function fetchAlphaIntradaySeries(symbol, interval = "60min") {
  const key = `${symbol}|${interval}`
  if (caches.stocksIntraday.has(key)) return caches.stocksIntraday.get(key)
  if (!config.alphaVantageKey) return null

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(
    symbol
  )}&interval=${interval}&apikey=${config.alphaVantageKey}`
  try {
    const data = await fetchAlphaJson(url)
    const series = data?.[`Time Series (${interval})`]
    if (!series || typeof series !== "object") {
      caches.stocksIntraday.set(key, null)
      return null
    }
    const entries = Object.entries(series).map(([time, values]) => ({
      time: new Date(time).getTime(),
      close: parseNumber(values["4. close"]),
    }))
    caches.stocksIntraday.set(key, entries)
    return entries
  } catch (err) {
    caches.stocksIntraday.set(key, null)
    return null
  }
}

function findDailyClose(entries, targetDate) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  const target = new Date(targetDate).getTime()
  let best = null
  let bestTime = -Infinity
  for (const entry of entries) {
    const time = new Date(entry.date).getTime()
    if (time <= target && time > bestTime && entry.close) {
      bestTime = time
      best = entry.close
    }
  }
  return best
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
  const series = await fetchAlphaDailySeries(symbol)
  if (!series) return null
  const dateKey = toDateKey(new Date(timestampMs))
  const close = findDailyClose(series, dateKey)
  if (!close) return null
  return { price: close, source: "alphavantage" }
}

async function getStockIntradayPrice(symbol, timestampMs) {
  const series = await fetchAlphaIntradaySeries(symbol, "60min")
  if (!series) return null
  const close = findIntradayClose(series, timestampMs)
  if (!close) return null
  return { price: close, source: "alphavantage" }
}

async function fetchForexSeries(base, quote, startDate, endDate) {
  const key = `${base}/${quote}|${startDate}|${endDate}`
  if (caches.forex.has(key)) return caches.forex.get(key)

  const url = new URL(`${startDate}..${endDate}`, "https://api.frankfurter.app")
  url.search = new URLSearchParams({
    from: base,
    to: quote,
  }).toString()

  try {
    const data = await fetchJson(url.toString())
    const rates = data?.rates || {}
    caches.forex.set(key, rates)
    return rates
  } catch (err) {
    caches.forex.set(key, null)
    return null
  }
}

async function getForexRates(pair, startDateKey, endDateKey) {
  const [base, quote] = pair.split("/")
  if (!base || !quote) return null
  const rates = await fetchForexSeries(base, quote, startDateKey, endDateKey)
  if (!rates) return null
  return { rates, quote }
}

async function fetchFxIntradaySeries(base, quote, interval = "60min") {
  const key = `${base}/${quote}|${interval}`
  if (caches.forexIntraday.has(key)) return caches.forexIntraday.get(key)
  if (!config.alphaVantageKey) return null

  const url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${encodeURIComponent(
    base
  )}&to_symbol=${encodeURIComponent(quote)}&interval=${interval}&apikey=${config.alphaVantageKey}`
  try {
    const data = await fetchAlphaJson(url)
    const series = data?.[`Time Series FX (${interval})`]
    if (!series || typeof series !== "object") {
      caches.forexIntraday.set(key, null)
      return null
    }
    const entries = Object.entries(series).map(([time, values]) => ({
      time: new Date(time).getTime(),
      close: parseNumber(values["4. close"]),
    }))
    caches.forexIntraday.set(key, entries)
    return entries
  } catch (err) {
    caches.forexIntraday.set(key, null)
    return null
  }
}

async function getFxIntradayPrice(pair, timestampMs) {
  const [base, quote] = pair.split("/")
  if (!base || !quote) return null
  const series = await fetchFxIntradaySeries(base, quote, "60min")
  if (!series) return null
  const close = findIntradayClose(series, timestampMs)
  if (!close) return null
  return { price: close, source: "alphavantage" }
}

function findForexClose(rates, targetDateKey, quote) {
  if (!rates || !quote) return null
  const target = new Date(targetDateKey).getTime()
  const dates = Object.keys(rates)
    .map((date) => ({ date, time: new Date(date).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time)
  let best = null
  for (const entry of dates) {
    if (entry.time <= target) {
      const rate = rates[entry.date]?.[quote]
      if (rate) best = Number(rate)
    }
  }
  return best
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

async function getMarketPriceSnapshot(db) {
  if (marketPriceCache && Date.now() - marketPriceCacheAt < MARKET_PRICE_CACHE_MS) {
    return marketPriceCache
  }

  try {
    const snap = await db.doc("market/prices").get()
    if (!snap.exists) {
      marketPriceCache = null
      marketPriceCacheAt = Date.now()
      return null
    }
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

    marketPriceCache = { map, updatedAt }
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
      const horizonTime = startMs + horizonMs
      if (nowMs < horizonTime) continue
      let priceAtSignal = null
      let priceAtHorizon = null
      let source = null
      let usedReferencePrice = false
      let usedSnapshotPrice = false

      if (classification.assetClass === "crypto") {
        const first = await getCryptoPrice(classification.symbol, startMs, horizonKey)
        const second = await getCryptoPrice(
          classification.symbol,
          startMs + horizonMs,
          horizonKey
        )
        priceAtSignal = first?.price ?? null
        priceAtHorizon = second?.price ?? null
        source = first?.source || second?.source || null
      } else if (classification.assetClass === "stock") {
        const useIntraday = horizonKey === "1h"
        const first = useIntraday
          ? await getStockIntradayPrice(classification.symbol, startMs)
          : await getStockPrice(classification.symbol, startMs)
        const second = useIntraday
          ? await getStockIntradayPrice(classification.symbol, startMs + horizonMs)
          : await getStockPrice(classification.symbol, startMs + horizonMs)
        priceAtSignal = first?.price ?? null
        priceAtHorizon = second?.price ?? null
        source = first?.source || second?.source || null
      } else if (classification.assetClass === "forex") {
        if (horizonKey === "1h") {
          const first = await getFxIntradayPrice(classification.symbol, startMs)
          const second = await getFxIntradayPrice(
            classification.symbol,
            startMs + horizonMs
          )
          priceAtSignal = first?.price ?? null
          priceAtHorizon = second?.price ?? null
          source = first?.source || second?.source || null
        } else {
          const startDateKey = toDateKey(new Date(startMs))
          const endDateKey = toDateKey(new Date(startMs + horizonMs))
          const forexData = await getForexRates(
            classification.symbol,
            startDateKey,
            endDateKey
          )
          priceAtSignal = findForexClose(
            forexData?.rates,
            startDateKey,
            forexData?.quote
          )
          priceAtHorizon = findForexClose(
            forexData?.rates,
            endDateKey,
            forexData?.quote
          )
          source = forexData ? "frankfurter" : null
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
          snapshotUpdatedAtMs >= horizonTime
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
      newHorizons[horizonKey] = {
        returnPct: Number(returnPct.toFixed(4)),
        hit: returnPct > 0,
        priceAtSignal,
        priceAtHorizon,
        source,
      }
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
  console.log("Signal evaluator run started")

  const evaluation = await evaluateSignals(db)
  console.log("Signal evaluator updated", evaluation)

  await buildPerformanceReport(db)
  console.log("Signal performance report updated")
}

run().catch((err) => {
  console.error("Signal evaluator failed", err)
  process.exit(1)
})
