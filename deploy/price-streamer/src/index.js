const admin = require("firebase-admin")
const http = require("http")
const crypto = require("crypto")
const { createClient } = require("redis")
const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  fmpKey: process.env.FMP_API_KEY || "",
  marketDataGatewayUrl: process.env.MARKET_DATA_GATEWAY_URL || "",
  watchlistRefreshMs: parseInt(process.env.WATCHLIST_REFRESH_MS || "60000", 10),
  cryptoPollMs: parseInt(process.env.CRYPTO_POLL_MS || "30000", 10),
  stockPollMs: parseInt(process.env.STOCK_POLL_MS || "30000", 10),
  forexPollMs: parseInt(process.env.FOREX_POLL_MS || "30000", 10),
  writeMs: parseInt(process.env.PRICE_WRITE_MS || "2000", 10),
  maxSymbols: parseInt(process.env.PRICE_STREAM_MAX_SYMBOLS || "120", 10),
  historyMinutes: parseInt(process.env.PRICE_HISTORY_MINUTES || "10", 10),
  quoteBatchSize: parseInt(process.env.PRICE_STREAM_BATCH_SIZE || "50", 10),
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  redisLatestTtlSeconds: parseInt(process.env.REDIS_LATEST_TTL_SECONDS || "120", 10),
  redisSnapshotTtlSeconds: parseInt(process.env.REDIS_SNAPSHOT_TTL_SECONDS || "1800", 10),
  redisSnapshotMs: parseInt(process.env.REDIS_SNAPSHOT_MS || "60000", 10),
  port: parseInt(process.env.PORT || "8080", 10),
  runId: process.env.RUN_ID || "",
  firestoreRunField: process.env.FIRESTORE_RUN_FIELD || "runId",
  pipelineEventsEnabled: process.env.PIPELINE_EVENTS_ENABLED !== "false",
  pipelineEventsStream: process.env.PIPELINE_EVENTS_STREAM || "",
  pipelineEventsMaxlen: parseInt(process.env.PIPELINE_EVENTS_MAXLEN || "20000", 10),
  pipelineEventsSampleRate: parseFloat(process.env.PIPELINE_EVENTS_SAMPLE_RATE || "0.2"),
  pipelineEventsRunEnv: process.env.PIPELINE_EVENTS_RUN_ENV || "prod",
}

const FMP_STABLE_BASE_URL = "https://financialmodelingprep.com/stable"
const DEFAULT_UNIVERSE_MODE = "movers_plus_universe"
const UNIVERSE_MODES = new Set([
  "movers_only",
  "universe_only",
  "movers_plus_universe",
  "movers_filtered_by_universe",
  "weighted_union",
])
const FX_CODES = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"])
const STREAM_SYMBOL_TTL_MS = 30 * 60 * 1000

if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId })
}

const db = admin.firestore()
const runId =
  config.runId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function resolvePipelineStream() {
  if (config.pipelineEventsStream) return config.pipelineEventsStream
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}pipeline_events`
}

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function shouldSample(rate) {
  if (!Number.isFinite(rate)) return false
  if (rate >= 1) return true
  if (rate <= 0) return false
  return Math.random() < rate
}

function hashParams(value) {
  if (!value) return null
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value)
    return crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 12)
  } catch (_) {
    return null
  }
}

async function publishPipelineEvent(event) {
  if (!config.pipelineEventsEnabled || !state.redis || !state.redisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(config.pipelineEventsMaxlen)
    ? Math.max(config.pipelineEventsMaxlen, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ["XADD", stream, "MAXLEN", "~", String(maxlen), "*", "payload", payload]
  try {
    await Promise.race([
      state.redis.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    console.error("Pipeline event publish failed:", err.message)
  }
}

function buildPipelineEvent(payload) {
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv: config.pipelineEventsRunEnv,
    service: "price-streamer",
    severity: "info",
    ...payload,
  }
}

const state = {
  watchlist: {
    crypto: new Set(),
    stock: new Set(),
    forex: new Set(),
  },
  priceCache: new Map(),
  priceHistory: new Map(),
  dirty: false,
  lastWatchHash: "",
  lastFlushAt: null,
  lastFlushError: null,
  fmpBackoffUntil: 0,
  redis: null,
  redisReady: false,
  lastRedisSnapshotAt: 0,
}

let server = null

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
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
    state.redisReady = true
    console.log("Redis connected")
    return client
  } catch (err) {
    console.error("Redis connection failed:", err.message)
    state.redisReady = false
    return null
  }
}

function isFmpRateLimited() {
  return state.fmpBackoffUntil && Date.now() < state.fmpBackoffUntil
}

function markFmpRateLimited() {
  const now = Date.now()
  const backoffMs = 60 * 1000
  if (!state.fmpBackoffUntil || now >= state.fmpBackoffUntil) {
    console.warn(`FMP rate limit hit; backing off for ${backoffMs / 1000}s`)
  }
  state.fmpBackoffUntil = now + backoffMs
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  const compact = upper.replace(/\s+/g, "")
  if (compact.includes("/") || compact.includes("-")) {
    const separator = compact.includes("/") ? "/" : "-"
    const parts = compact.split(separator).filter(Boolean)
    if (parts.length === 2) {
      return `${parts[0]}/${parts[1]}`
    }
    return compact
  }

  const quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR", "GBP", "JPY"]
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

function normalizeForexSymbol(raw) {
  if (!raw) return null
  const normalized = normalizeSymbol(raw)
  if (normalized && normalized.includes("/")) return normalized
  const compact = String(raw).trim().toUpperCase().replace(/[^A-Z]/g, "")
  if (compact.length >= 6) {
    return `${compact.slice(0, 3)}/${compact.slice(3, 6)}`
  }
  return normalized
}

function inferAssetClassFromSymbol(raw) {
  if (!raw) return null
  const symbol = String(raw).trim().toUpperCase()
  if (!symbol) return null
  if (!symbol.includes("/")) return "stock"
  const parts = symbol.replace(/-/g, "/").split("/")
  if (parts.length === 2 && FX_CODES.has(parts[0]) && FX_CODES.has(parts[1])) {
    return "forex"
  }
  return "crypto"
}

function normalizeSymbolForKey(raw, assetClass) {
  if (!raw) return null
  if (assetClass === "stock") {
    const normalized = normalizeTicker(raw)
    return normalized ? normalized.replace(/\//g, "").replace(/-/g, "") : null
  }
  if (assetClass === "forex") return normalizeForexSymbol(raw)
  const normalized = normalizeSymbol(raw)
  if (!normalized) return null
  if (normalized.includes("/")) {
    const [base, quote] = normalized.split("/")
    if (!base || !quote) return null
    return `${base}/${quote}`
  }
  return normalized
}

function normalizeFmpQuoteSymbol(raw, assetClass) {
  if (!raw) return null
  if (assetClass === "stock") return normalizeTicker(raw)
  if (assetClass === "forex") {
    const symbol = normalizeForexSymbol(raw)
    return symbol ? symbol.replace("/", "") : null
  }
  const symbol = normalizeSymbol(raw)
  if (!symbol) return null
  if (symbol.includes("/")) {
    const [base, quote] = symbol.split("/")
    if (!base || !quote) return null
    const normalizedQuote = quote === "USDT" ? "USD" : quote
    return `${base}${normalizedQuote}`
  }
  return symbol
}

function chunkList(items, size) {
  const chunkSize = Math.max(1, size || 1)
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function resolveUniverseMode(value) {
  if (!value) return DEFAULT_UNIVERSE_MODE
  const normalized = String(value).trim().toLowerCase()
  return UNIVERSE_MODES.has(normalized) ? normalized : DEFAULT_UNIVERSE_MODE
}

function shouldIncludeUniverse(mode) {
  return mode === "movers_plus_universe" || mode === "universe_only" || mode === "weighted_union"
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
  if (!config.marketDataGatewayUrl) return null
  return config.marketDataGatewayUrl.endsWith("/")
    ? config.marketDataGatewayUrl
    : `${config.marketDataGatewayUrl}/`
}

function buildGatewayUrl(path, params) {
  const base = resolveGatewayBase()
  if (!base) return null
  const normalizedPath = String(path || "").replace(/^\/+/, "")
  const url = new URL(normalizedPath, base)
  if (params) {
    url.search = new URLSearchParams(params).toString()
  }
  return url.toString()
}

async function fetchGatewayJson(path, params) {
  const url = buildGatewayUrl(path, params)
  if (!url) return null
  const shouldEmit = config.pipelineEventsEnabled && shouldSample(config.pipelineEventsSampleRate)
  const startedAt = Date.now()
  const endpointName = String(path || "").replace(/^\/+/, "")
  const paramsHash = hashParams(params)
  if (shouldEmit) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "price_streamer",
        eventType: "gateway_call",
        edgeKey: "price_streamer->market_data_gateway",
        nodeIds: ["price_streamer", "market_data_gateway"],
        status: "start",
        meta: {
          endpointName,
          paramsHash,
        },
      })
    )
  }
  try {
    const data = await fetchJson(url)
    if (shouldEmit) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "price_streamer",
          eventType: "gateway_call",
          edgeKey: "price_streamer->market_data_gateway",
          nodeIds: ["price_streamer", "market_data_gateway"],
          status: "end",
          durationMs: Date.now() - startedAt,
          meta: {
            endpointName,
            paramsHash,
            httpStatus: 200,
          },
        })
      )
    }
    return data
  } catch (err) {
    if (shouldEmit) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "price_streamer",
          eventType: "gateway_call",
          edgeKey: "price_streamer->market_data_gateway",
          nodeIds: ["price_streamer", "market_data_gateway"],
          status: "error",
          durationMs: Date.now() - startedAt,
          severity: "error",
          meta: {
            endpointName,
            paramsHash,
          },
          error: { message: err?.message ? String(err.message) : "Gateway error" },
        })
      )
    }
    throw err
  }
}

async function fetchFmpQuote(symbol, assetClass = "stock") {
  if (!symbol) return null
  if (config.marketDataGatewayUrl) {
    try {
      const data = await fetchGatewayJson("/v1/fmp/quote", {
        symbol,
        assetClass,
      })
      if (!data || typeof data?.price !== "number") return null
      return {
        symbol,
        price: data.price,
        bid: parseNumber(data.bid),
        ask: parseNumber(data.ask),
        volume: parseNumber(data.volume),
      }
    } catch (err) {
      console.error(`Gateway quote failed for ${symbol}:`, err.message)
    }
  }
  if (!config.fmpKey) return null
  if (isFmpRateLimited()) return null
  const normalized = normalizeFmpQuoteSymbol(symbol, assetClass)
  if (!normalized) return null
  try {
    const url = new URL(`${FMP_STABLE_BASE_URL}/quote`)
    url.searchParams.set("symbol", normalized)
    url.searchParams.set("apikey", config.fmpKey)
    const data = await fetchJson(url.toString())
    const entry = Array.isArray(data) ? data[0] : data
    if (!entry) return null
    const bid = parseNumber(entry.bid)
    const ask = parseNumber(entry.ask)
    const volume = parseNumber(entry.volume) ?? parseNumber(entry.avgVolume) ?? parseNumber(entry.volumeAvg)
    const price =
      parseNumber(entry.price) ??
      parseNumber(entry.lastSale) ??
      parseNumber(entry.last) ??
      parseNumber(entry.close) ??
      (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask)
    if (typeof price !== "number") return null
    return { symbol, price, bid, ask, volume }
  } catch (err) {
    const message = err?.message ? String(err.message) : "Unknown error"
    if (message.includes("429") || message.includes("Limit Reach")) {
      markFmpRateLimited()
    }
    console.error(`FMP quote failed for ${normalized}:`, message)
    return null
  }
}

async function fetchFmpQuotesBatch(symbols, assetClass = "stock") {
  if (!Array.isArray(symbols) || symbols.length === 0) return []
  if (config.marketDataGatewayUrl) {
    try {
      const data = await fetchGatewayJson("/v1/fmp/quotes", {
        symbols: symbols.join(","),
        assetClass,
      })
      return Array.isArray(data?.items) ? data.items : []
    } catch (err) {
      console.error(`Gateway batch quote failed for ${assetClass}:`, err.message)
    }
  }
  if (!config.fmpKey) return []
  if (isFmpRateLimited()) return []

  const normalized = symbols
    .map((symbol) => normalizeFmpQuoteSymbol(symbol, assetClass))
    .filter(Boolean)
  if (normalized.length === 0) return []

  const results = []
  const batches = chunkList(Array.from(new Set(normalized)), 100)
  for (const batch of batches) {
    try {
      const url = new URL(`${FMP_STABLE_BASE_URL}/quote`)
      url.searchParams.set("symbol", batch.join(","))
      url.searchParams.set("apikey", config.fmpKey)
      const data = await fetchJson(url.toString())
      const entries = Array.isArray(data) ? data : []
      entries.forEach((entry) => {
        if (!entry || typeof entry.price !== "number") return
        results.push({
          symbol: entry.symbol || "",
          price: parseNumber(entry.price),
          bid: parseNumber(entry.bid),
          ask: parseNumber(entry.ask),
          volume:
            parseNumber(entry.volume) ??
            parseNumber(entry.avgVolume) ??
            parseNumber(entry.volumeAvg),
        })
      })
    } catch (err) {
      const message = err?.message ? String(err.message) : "Unknown error"
      if (message.includes("429") || message.includes("Limit Reach")) {
        markFmpRateLimited()
      }
      console.error(`Batch quote failed for ${assetClass}:`, message)
    }
  }
  return results
}

function normalizeSnapshotForex(item) {
  if (!item || typeof item !== "object") return null
  const rawSymbol = item.symbol || item.ticker || item.pair || item.code || ""
  const cleanedRaw = String(rawSymbol).trim().toUpperCase().replace(/_/g, "/").replace(/-/g, "/")
  let symbol = normalizeSymbol(cleanedRaw)
  if (!symbol || !symbol.includes("/")) {
    const stripped = cleanedRaw.replace(/[^A-Z]/g, "")
    if (stripped.length === 6) {
      symbol = `${stripped.slice(0, 3)}/${stripped.slice(3)}`
    }
  }
  if (!symbol) return null
  const bid = parseNumber(item.bid)
  const ask = parseNumber(item.ask)
  const price =
    parseNumber(item.price) ??
    (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask) ??
    parseNumber(item.rate)
  if (typeof price !== "number") return null
  return { symbol, price }
}

function buildWatchHash(sets) {
  const payload = {
    crypto: Array.from(sets.crypto).sort(),
    stock: Array.from(sets.stock).sort(),
    forex: Array.from(sets.forex).sort(),
  }
  return JSON.stringify(payload)
}

function recordPriceHistory(key, price) {
  const history = state.priceHistory.get(key) || []
  const now = Date.now()
  const last = history[history.length - 1]
  const shouldAppend = !last || last.price !== price || now - last.t > 15000
  if (shouldAppend) {
    history.push({ t: now, price })
  }
  const cutoff = now - config.historyMinutes * 60 * 1000
  let dropIndex = 0
  while (dropIndex < history.length && history[dropIndex].t < cutoff) {
    dropIndex += 1
  }
  if (dropIndex > 0) history.splice(0, dropIndex)
  state.priceHistory.set(key, history)
  return shouldAppend
}

function findPriceBefore(history, targetTime) {
  if (!Array.isArray(history) || history.length === 0) return null
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].t <= targetTime) return history[i].price
  }
  return null
}

function computeChangePct(history, windowMs, now, priceNow) {
  if (!Array.isArray(history) || history.length === 0 || typeof priceNow !== "number") {
    return null
  }
  const target = now - windowMs
  const prevPrice = findPriceBefore(history, target)
  if (!prevPrice || prevPrice === 0) return null
  return ((priceNow - prevPrice) / prevPrice) * 100
}

function computeRangePct(history, windowMs, now, priceNow) {
  if (!Array.isArray(history) || history.length === 0 || typeof priceNow !== "number") {
    return null
  }
  const cutoff = now - windowMs
  let min = Infinity
  let max = -Infinity
  let hasSample = false
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i]
    if (entry.t < cutoff) break
    if (entry.price < min) min = entry.price
    if (entry.price > max) max = entry.price
    hasSample = true
  }
  if (!hasSample || !Number.isFinite(min) || !Number.isFinite(max) || priceNow === 0) {
    return null
  }
  return ((max - min) / priceNow) * 100
}

function updatePrice(assetClass, symbol, price, source, extra = {}) {
  if (!assetClass || !symbol || typeof price !== "number") return
  const key = `${assetClass}:${symbol}`
  const existing = state.priceCache.get(key) || {}
  const next = {
    ...existing,
    assetClass,
    symbol,
    price: Number(price),
    source,
    updatedAt: Date.now(),
  }
  if (typeof extra.bid === "number") next.bid = extra.bid
  if (typeof extra.ask === "number") next.ask = extra.ask
  if (typeof extra.volume === "number") next.volume = extra.volume

  const historyUpdated = recordPriceHistory(key, next.price)
  const changed =
    !existing ||
    existing.price !== next.price ||
    existing.bid !== next.bid ||
    existing.ask !== next.ask ||
    existing.volume !== next.volume
  if (changed || historyUpdated) {
    state.priceCache.set(key, next)
    state.dirty = true
  }
}

function prunePriceCache(allowedKeys) {
  state.priceCache.forEach((_, key) => {
    if (!allowedKeys.has(key)) {
      state.priceCache.delete(key)
      state.priceHistory.delete(key)
      state.dirty = true
    }
  })
}

function buildHealthPayload() {
  return {
    status: "ok",
    runId,
    updatedAt: state.lastFlushAt ? new Date(state.lastFlushAt).toISOString() : null,
    lastFlushError: state.lastFlushError || null,
    priceCount: state.priceCache.size,
    watchlist: {
      crypto: state.watchlist.crypto.size,
      stock: state.watchlist.stock.size,
      forex: state.watchlist.forex.size,
    },
    redis: {
      enabled: Boolean(config.redisUrl),
      connected: Boolean(state.redisReady),
    },
  }
}

function shouldWriteRedisSnapshot(now) {
  if (!config.redisSnapshotMs || config.redisSnapshotMs <= 0) return false
  return now - state.lastRedisSnapshotAt >= config.redisSnapshotMs
}

async function writeRedisPrices(items, meta) {
  if (!state.redis || !state.redisReady) return
  const now = Date.now()
  const latestKey = resolveRedisKey("prices:latest")
  const payload = JSON.stringify({
    updatedAt: now,
    items,
    meta,
  })
  const multi = state.redis.multi()
  multi.set(latestKey, payload, { EX: Math.max(config.redisLatestTtlSeconds, 10) })

  if (shouldWriteRedisSnapshot(now)) {
    const snapshotKey = resolveRedisKey(`prices:snapshot:${now}`)
    const indexKey = resolveRedisKey("prices:snapshots")
    const ttlSeconds = Math.max(config.redisSnapshotTtlSeconds, 300)
    const cutoff = now - ttlSeconds * 1000
    multi.set(snapshotKey, payload, { EX: ttlSeconds })
    multi.zAdd(indexKey, [{ score: now, value: snapshotKey }])
    multi.zRemRangeByScore(indexKey, 0, cutoff)
    state.lastRedisSnapshotAt = now
  }

  try {
    await multi.exec()
  } catch (err) {
    console.error("Redis price write failed:", err.message)
  }
}

function startServer() {
  const serverInstance = http.createServer((req, res) => {
    const path = (req.url || "/").split("?")[0]
    if (path === "/" || path === "/healthz" || path === "/readyz") {
      const payload = buildHealthPayload()
      const body = JSON.stringify(payload)
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      })
      res.end(body)
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("Not found")
  })

  serverInstance.listen(config.port, () => {
    console.log("Health server listening", { port: config.port })
  })

  return serverInstance
}

async function refreshWatchlist() {
  try {
    const [universeSnap, hotTradesSnap, actionBoardSnap, positionsSnap, streamSnap] =
      await Promise.all([
      db.doc("market/universe").get(),
      db.doc("market/hotTrades").get(),
      db.doc("market/actionBoard").get(),
      db.collectionGroup("positions").get(),
      db.doc("market/streamSymbols").get(),
    ])
    const universe = universeSnap.exists ? universeSnap.data() : {}
    const hotTrades = hotTradesSnap.exists ? hotTradesSnap.data()?.items || [] : []
    const actionBoard = actionBoardSnap.exists ? actionBoardSnap.data() : {}
    const actionBoardItems = [
      ...(actionBoard?.buys || []),
      ...(actionBoard?.sells || []),
    ]
    const positionItems = positionsSnap.empty
      ? []
      : positionsSnap.docs
          .map((doc) => doc.data() || {})
          .map((position) => {
            const assetClassRaw =
              typeof position.assetClass === "string"
                ? position.assetClass.toLowerCase()
                : inferAssetClassFromSymbol(position.symbol)
            if (!assetClassRaw || !["crypto", "stock", "forex"].includes(assetClassRaw)) {
              return null
            }
            return {
              assetClass: assetClassRaw,
              symbol: position.symbol,
            }
          })
          .filter(Boolean)

    const globalMode = resolveUniverseMode(universe.mode)
    const cryptoMode = resolveUniverseMode(universe?.crypto?.mode || globalMode)
    const stockMode = resolveUniverseMode(universe?.stocks?.mode || globalMode)
    const forexMode = resolveUniverseMode(universe?.forex?.mode || globalMode)

    const next = {
      crypto: new Set(),
      stock: new Set(),
      forex: new Set(),
    }
    const universeSets = {
      crypto: new Set(),
      stock: new Set(),
      forex: new Set(),
    }

    const universeCrypto = Array.isArray(universe?.crypto?.symbols)
      ? universe.crypto.symbols
      : []
    universeCrypto.forEach((symbol) => {
      const normalized = normalizeSymbolForKey(symbol, "crypto")
      if (normalized) universeSets.crypto.add(normalized)
    })
    const universeStocks = Array.isArray(universe?.stocks?.symbols)
      ? universe.stocks.symbols
      : []
    universeStocks.forEach((symbol) => {
      const normalized = normalizeSymbolForKey(symbol, "stock")
      if (normalized) universeSets.stock.add(normalized)
    })
    const universeForex = Array.isArray(universe?.forex?.pairs)
      ? universe.forex.pairs
      : []
    universeForex.forEach((symbol) => {
      const normalized = normalizeSymbolForKey(symbol, "forex")
      if (normalized) universeSets.forex.add(normalized)
    })

    const addItems = (items, { respectUniverse = true } = {}) => {
      items.forEach((item) => {
        const assetClass = item?.assetClass
        if (!assetClass || !next[assetClass]) return
        const normalized = normalizeSymbolForKey(item.symbol, assetClass)
        if (!normalized) return
        if (respectUniverse) {
          const mode =
            assetClass === "crypto"
              ? cryptoMode
              : assetClass === "forex"
                ? forexMode
                : stockMode
          if (mode === "universe_only" || mode === "movers_filtered_by_universe") {
            const universeSet = universeSets[assetClass]
            if (!universeSet || !universeSet.has(normalized)) return
          }
        }
        if (next[assetClass].size < config.maxSymbols) {
          next[assetClass].add(normalized)
        }
      })
    }

    const addSymbols = (symbols, assetClass) => {
      if (!Array.isArray(symbols) || !next[assetClass]) return
      symbols.forEach((symbol) => {
        const normalized = normalizeSymbolForKey(symbol, assetClass)
        if (!normalized) return
        if (next[assetClass].size < config.maxSymbols) {
          next[assetClass].add(normalized)
        }
      })
    }

    addItems(positionItems, { respectUniverse: false })
    addItems(actionBoardItems, { respectUniverse: false })
    addItems(hotTrades, { respectUniverse: true })

    if (shouldIncludeUniverse(cryptoMode)) {
      universeSets.crypto.forEach((symbol) => {
        if (next.crypto.size < config.maxSymbols) next.crypto.add(symbol)
      })
    }
    if (shouldIncludeUniverse(stockMode)) {
      universeSets.stock.forEach((symbol) => {
        if (next.stock.size < config.maxSymbols) next.stock.add(symbol)
      })
    }
    if (shouldIncludeUniverse(forexMode)) {
      universeSets.forex.forEach((symbol) => {
        if (next.forex.size < config.maxSymbols) next.forex.add(symbol)
      })
    }

    if (streamSnap.exists) {
      const streamData = streamSnap.data() || {}
      const sources = streamData.sources || {}
      const topSymbols = streamData.symbols || {}
      const now = Date.now()
      const appendSource = (source) => {
        if (!source || typeof source !== "object") return
        const updatedAt = source.updatedAt?.toDate?.()
        if (updatedAt && now - updatedAt.getTime() > STREAM_SYMBOL_TTL_MS) return
        const symbols = source.symbols || {}
        addSymbols(symbols.crypto, "crypto")
        addSymbols(symbols.stock, "stock")
        addSymbols(symbols.forex, "forex")
      }
      Object.values(sources).forEach((source) => appendSource(source))
      addSymbols(topSymbols.crypto, "crypto")
      addSymbols(topSymbols.stock, "stock")
      addSymbols(topSymbols.forex, "forex")
    }

    const nextHash = buildWatchHash(next)
    if (nextHash === state.lastWatchHash) return

    state.watchlist = next
    state.lastWatchHash = nextHash

    const allowedKeys = new Set()
    next.crypto.forEach((symbol) => allowedKeys.add(`crypto:${symbol}`))
    next.stock.forEach((symbol) => allowedKeys.add(`stock:${symbol}`))
    next.forex.forEach((symbol) => allowedKeys.add(`forex:${symbol}`))
    prunePriceCache(allowedKeys)

    console.log("Watchlist refreshed", {
      crypto: next.crypto.size,
      stock: next.stock.size,
      forex: next.forex.size,
    })
  } catch (err) {
    console.error("Watchlist refresh failed:", err.message)
  }
}


async function pollCryptoPrices() {
  const symbols = Array.from(state.watchlist.crypto)
  if ((!config.fmpKey && !config.marketDataGatewayUrl) || symbols.length === 0) return
  console.log("ps_ingest", { runId, assetClass: "crypto", count: symbols.length })
  const batches = chunkList(symbols, config.quoteBatchSize)
  for (const batch of batches) {
    const results = await fetchFmpQuotesBatch(batch, "crypto")
    results.forEach((entry) => {
      if (!entry) return
      const symbol = normalizeSymbolForKey(entry.symbol, "crypto")
      if (!symbol || typeof entry.price !== "number") return
      updatePrice("crypto", symbol, entry.price, "fmp", {
        bid: entry.bid,
        ask: entry.ask,
        volume: entry.volume,
      })
    })
  }
}

async function pollStockPrices() {
  const symbols = Array.from(state.watchlist.stock)
  if ((!config.fmpKey && !config.marketDataGatewayUrl) || symbols.length === 0) return
  console.log("ps_ingest", { runId, assetClass: "stock", count: symbols.length })
  const batches = chunkList(symbols, config.quoteBatchSize)
  for (const batch of batches) {
    const results = await fetchFmpQuotesBatch(batch, "stock")
    results.forEach((entry) => {
      if (!entry) return
      const symbol = normalizeSymbolForKey(entry.symbol, "stock")
      if (!symbol || typeof entry.price !== "number") return
      updatePrice("stock", symbol, entry.price, "fmp", {
        bid: entry.bid,
        ask: entry.ask,
        volume: entry.volume,
      })
    })
  }
}

async function pollForexPrices() {
  const symbols = Array.from(state.watchlist.forex)
  if ((!config.fmpKey && !config.marketDataGatewayUrl) || symbols.length === 0) return
  console.log("ps_ingest", { runId, assetClass: "forex", count: symbols.length })
  const batches = chunkList(symbols, config.quoteBatchSize)
  for (const batch of batches) {
    const results = await fetchFmpQuotesBatch(batch, "forex")
    results.forEach((entry) => {
      if (!entry) return
      const symbol = normalizeSymbolForKey(entry.symbol, "forex")
      if (!symbol || typeof entry.price !== "number") return
      updatePrice("forex", symbol, entry.price, "fmp", {
        bid: entry.bid,
        ask: entry.ask,
        volume: entry.volume,
      })
    })
  }
}

async function flushPrices() {
  if (!state.dirty) return
  state.dirty = false

  const now = Date.now()
  const startedAt = Date.now()
  const items = Array.from(state.priceCache.values()).map((item) => {
    const key = `${item.assetClass}:${item.symbol}`
    const history = state.priceHistory.get(key) || []
    const change1m = computeChangePct(history, 60 * 1000, now, item.price)
    const change5m = computeChangePct(history, 5 * 60 * 1000, now, item.price)
    const volatility1m = computeRangePct(history, 60 * 1000, now, item.price)
    const volatility5m = computeRangePct(history, 5 * 60 * 1000, now, item.price)
    const spreadPct =
      typeof item.bid === "number" && typeof item.ask === "number" && item.price
        ? ((item.ask - item.bid) / item.price) * 100
        : undefined
    const enriched = {
      ...item,
      change1m: Number.isFinite(change1m) ? change1m : undefined,
      change5m: Number.isFinite(change5m) ? change5m : undefined,
      volatility1m: Number.isFinite(volatility1m) ? volatility1m : undefined,
      volatility5m: Number.isFinite(volatility5m) ? volatility5m : undefined,
      spreadPct: Number.isFinite(spreadPct) ? spreadPct : undefined,
    }
    return Object.fromEntries(
      Object.entries(enriched).filter(([, value]) => value !== undefined)
    )
  })
  try {
    const stockSource = config.marketDataGatewayUrl
      ? "gateway"
      : config.fmpKey
        ? "fmp"
        : "disabled"
    const forexSource = config.marketDataGatewayUrl
      ? "gateway"
      : config.fmpKey
        ? "fmp"
        : "disabled"
    const cryptoSource = config.marketDataGatewayUrl
      ? "gateway"
      : config.fmpKey
        ? "fmp"
        : "disabled"

    const meta = {
      runId,
      count: items.length,
      sources: {
        crypto: cryptoSource,
        stock: stockSource,
        forex: forexSource,
      },
      watchlist: {
        crypto: state.watchlist.crypto.size,
        stock: state.watchlist.stock.size,
        forex: state.watchlist.forex.size,
      },
    }
    await writeRedisPrices(items, meta)
    console.log("ps_write_redis", {
      runId,
      count: items.length,
      updatedAt: new Date().toISOString(),
    })
    await db.doc("market/prices").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items,
        meta,
      },
      { merge: true }
    )
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "price_streamer",
        eventType: "fs_write",
        edgeKey: "price_streamer->firestore",
        nodeIds: ["price_streamer", "firestore"],
        status: "end",
        durationMs: Date.now() - startedAt,
        meta: {
          runId,
          count: items.length,
        },
        outputs: {
          firestoreDocs: ["market/prices"],
        },
      })
    )
    state.lastFlushAt = Date.now()
    state.lastFlushError = null
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "redis_hot",
        eventType: "redis_write",
        edgeKey: "price_streamer->redis",
        nodeIds: ["price_streamer", "redis"],
        status: "end",
        durationMs: Date.now() - startedAt,
        meta: {
          symbolsUpdated: items.length,
          markets: Object.keys(meta.sources || {}),
          sources: meta.sources,
          watchlist: meta.watchlist,
        },
        outputs: {
          redisKeys: [
            `${config.redisPrefix ? `${config.redisPrefix}:` : ""}prices:latest`,
            `${config.redisPrefix ? `${config.redisPrefix}:` : ""}prices:snapshot:*`,
          ],
          firestoreDocs: ["market/prices"],
        },
      })
    )
  } catch (err) {
    console.error("Failed to write market/prices:", err.message)
    state.lastFlushError = err.message
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "redis_hot",
        eventType: "redis_write",
        edgeKey: "price_streamer->redis",
        nodeIds: ["price_streamer", "redis"],
        status: "error",
        durationMs: Date.now() - startedAt,
        severity: "error",
        error: { message: err?.message ? String(err.message) : "write failed" },
      })
    )
  }
}

async function run() {
  state.redis = await initRedis()
  await refreshWatchlist()

  setInterval(refreshWatchlist, Math.max(config.watchlistRefreshMs, 15000))
  setInterval(() => {
    pollCryptoPrices().catch((err) => console.error("Crypto poll error:", err.message))
  }, Math.max(config.cryptoPollMs, 5000))
  setInterval(() => {
    pollStockPrices().catch((err) => console.error("Stock poll error:", err.message))
  }, Math.max(config.stockPollMs, 5000))
  setInterval(() => {
    pollForexPrices().catch((err) => console.error("Forex poll error:", err.message))
  }, Math.max(config.forexPollMs, 5000))
  setInterval(flushPrices, Math.max(config.writeMs, 1000))

  console.log("ps_run_start", { runId })
}

server = startServer()
run().catch((err) => {
  console.error("Price streamer failed", err)
  process.exit(1)
})

function shutdown() {
  if (state.redis) {
    state.redis.quit().catch(() => {})
  }
  if (server) {
    server.close(() => process.exit(0))
    return
  }
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
