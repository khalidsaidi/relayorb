const http = require("http")
const crypto = require("crypto")
const { createClient } = require("redis")

const config = {
  fmpKey: process.env.FMP_API_KEY || "",
  marketauxKey: process.env.MARKETAUX_API_KEY || "",
  port: parseInt(process.env.PORT || "8080", 10),
  fmpBaseUrl: process.env.FMP_BASE_URL || "https://financialmodelingprep.com",
  fmpStableBaseUrl:
    process.env.FMP_STABLE_BASE_URL || "https://financialmodelingprep.com/stable",
  marketauxBaseUrl: process.env.MARKETAUX_BASE_URL || "https://api.marketaux.com/v1/news/all",
  cacheDefaultMs: parseInt(process.env.MDG_CACHE_TTL_MS || "15000", 10),
  cacheCandlesMs: parseInt(process.env.MDG_CANDLES_TTL_MS || "60000", 10),
  cacheMarketsMs: parseInt(process.env.MDG_MARKETS_TTL_MS || "60000", 10),
  cacheNewsMs: parseInt(process.env.MDG_NEWS_TTL_MS || "120000", 10),
  cacheStockListMs: parseInt(process.env.MDG_STOCK_LIST_TTL_MS || "21600000", 10),
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  pipelineEventsEnabled: process.env.PIPELINE_EVENTS_ENABLED !== "false",
  pipelineEventsStream: process.env.PIPELINE_EVENTS_STREAM || "",
  pipelineEventsMaxlen: parseInt(process.env.PIPELINE_EVENTS_MAXLEN || "20000", 10),
  pipelineEventsRunEnv: process.env.PIPELINE_EVENTS_RUN_ENV || "prod",
}

const cache = new Map()
let pipelineRedis = null
let pipelineRedisReady = false

function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, ...data }))
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  logEvent("mdg_cache_hit", { key })
  return entry.value
}

function setCached(key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(ttlMs, 0),
  })
}

function resolvePipelineStream() {
  if (config.pipelineEventsStream) return config.pipelineEventsStream
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}pipeline_events`
}

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

function sanitizeUrl(rawUrl) {
  if (!rawUrl) return ""
  try {
    const parsed = new URL(rawUrl)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch (_) {
    return String(rawUrl).split("?")[0]
  }
}

function buildPipelineEvent(payload) {
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv: config.pipelineEventsRunEnv,
    service: "market-data-gateway",
    severity: "info",
    ...payload,
  }
}

async function publishPipelineEvent(event) {
  if (!config.pipelineEventsEnabled || !pipelineRedis || !pipelineRedisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(config.pipelineEventsMaxlen)
    ? Math.max(config.pipelineEventsMaxlen, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ["XADD", stream, "MAXLEN", "~", String(maxlen), "*", "payload", payload]
  try {
    await Promise.race([
      pipelineRedis.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    console.error("Pipeline event publish failed:", err.message)
  }
}

async function emitProviderEvent({ stationId, status, startMs, meta, error }) {
  const durationMs = startMs ? Date.now() - startMs : undefined
  const providerStation = stationId || "provider:unknown"
  const edgeKey = `market_data_gateway->${providerStation}`
  const nodeIds = ["market_data_gateway", providerStation]
  const providerMeta = meta || {}
  const endpointName = providerMeta.endpointName
  const paramsHash = providerMeta.paramsHash
  const providerId = providerMeta.providerId
  const base = {
    status,
    durationMs,
    severity: status === "error" ? "error" : "info",
    meta: {
      ...providerMeta,
      latencyMs: durationMs,
    },
    inputs: providerId || endpointName
      ? {
        providerCalls: [
          {
            providerId,
            endpointName,
            paramsHash,
            cacheHit: providerMeta.cacheHit,
          },
        ],
      }
      : undefined,
    error: error || undefined,
  }
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "mdg",
      eventType: "provider_call",
      edgeKey,
      nodeIds,
      ...base,
    })
  )
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: providerStation,
      eventType: "provider_call",
      edgeKey,
      nodeIds,
      ...base,
    })
  )
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePercent(value) {
  if (value === undefined || value === null) return undefined
  const cleaned = String(value).replace(/[()%]/g, "").trim()
  if (!cleaned) return undefined
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function mapIntervalToFmp(interval) {
  const mapping = {
    "1min": "1min",
    "5min": "5min",
    "15min": "15min",
    "30min": "30min",
    "1h": "1hour",
    "4h": "4hour",
    "1day": "1day",
    "1week": "1week",
  }
  return mapping[interval] || "15min"
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  const compact = upper.replace(/\s+/g, "")
  if (compact.includes("/") || compact.includes("-")) {
    const separator = compact.includes("/") ? "/" : "-"
    const parts = compact.split(separator).filter(Boolean)
    if (parts.length === 2) return `${parts[0]}/${parts[1]}`
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

function normalizeFmpSymbol(symbol, assetClass) {
  if (!symbol) return ""
  const upper = String(symbol).trim().toUpperCase()
  if (!upper) return ""
  if (assetClass === "forex" || assetClass === "crypto") {
    return upper.replace(/[\/-]/g, "")
  }
  return upper.replace(/\s+/g, "")
}

function normalizeFmpQuoteSymbol(symbol, assetClass) {
  if (!symbol) return null
  if (assetClass === "stock") return normalizeTicker(symbol)
  if (assetClass === "forex") {
    const normalized = normalizeSymbol(symbol)
    return normalized ? normalized.replace("/", "") : null
  }
  const normalized = normalizeSymbol(symbol)
  if (!normalized) return null
  if (normalized.includes("/")) {
    const [base, quoteRaw] = normalized.split("/")
    if (!base || !quoteRaw) return null
    const quote = quoteRaw === "USDT" ? "USD" : quoteRaw
    return `${base}${quote}`
  }
  return normalized
}

function chunkList(items, size) {
  const chunkSize = Math.max(1, size || 1)
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

async function fetchJson(url, options = {}) {
  logEvent("mdg_request", { url: sanitizeUrl(url) })

  // Add 15s timeout to prevent hanging requests
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 429) {
        logEvent("mdg_rate_limited", { url: sanitizeUrl(url), status: res.status })
        console.error(`Rate limit exceeded (429): ${sanitizeUrl(url)}`)
      }
      throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after 15s: ${sanitizeUrl(url)}`)
    }
    throw err
  }
}

async function fetchText(url, options = {}) {
  logEvent("mdg_request", { url: sanitizeUrl(url) })

  // Add 15s timeout to prevent hanging requests
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 429) {
        logEvent("mdg_rate_limited", { url: sanitizeUrl(url), status: res.status })
        console.error(`Rate limit exceeded (429): ${sanitizeUrl(url)}`)
      }
      throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.text()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after 15s: ${sanitizeUrl(url)}`)
    }
    throw err
  }
}

async function initPipelineRedis() {
  if (!config.redisUrl || !config.pipelineEventsEnabled) return
  pipelineRedis = createClient({ url: config.redisUrl })
  pipelineRedis.on("error", (err) => {
    const message = err?.message ? String(err.message) : "Unknown error"
    console.error("Pipeline redis error:", message)
    pipelineRedisReady = false
  })
  try {
    await pipelineRedis.connect()
    pipelineRedisReady = true
  } catch (err) {
    console.error("Pipeline redis connect failed:", err.message)
    pipelineRedis = null
    pipelineRedisReady = false
  }
}

function parseCsvRows(text) {
  const rows = []
  let row = []
  let value = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(value)
      value = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1
      }
      row.push(value)
      if (row.length > 1 || row[0]) {
        rows.push(row)
      }
      row = []
      value = ""
      continue
    }

    value += char
  }

  if (row.length > 0 || value) {
    row.push(value)
    rows.push(row)
  }

  return rows
}

function parseStockList(csvText) {
  if (!csvText) return []
  const rows = parseCsvRows(csvText)
  if (rows.length === 0) return []
  const header = rows[0].map((col) => String(col || "").trim().toLowerCase())
  const symbolIndex = header.indexOf("symbol")
  const nameIndex = header.indexOf("name")
  const exchangeIndex = header.indexOf("exchange")
  const typeIndex = header.indexOf("type")

  return rows.slice(1).map((row) => {
    const symbol = normalizeTicker(row[symbolIndex] || "")
    if (!symbol) return null
    return {
      symbol,
      name: row[nameIndex] || symbol,
      exchange: row[exchangeIndex] || undefined,
      assetType: row[typeIndex] || undefined,
    }
  }).filter(Boolean)
}

function respondJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  })
  res.end(JSON.stringify(payload))
}

function buildFmpQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const bid = parseNumber(entry.bid)
  const ask = parseNumber(entry.ask)
  const volume = parseNumber(entry.volume) ?? parseNumber(entry.avgVolume)
  const changePercent = parsePercent(
    entry.changesPercentage ?? entry.changePercentage ?? entry.changePercent ?? entry.change
  )
  const price =
    parseNumber(entry.price) ??
    parseNumber(entry.lastSale) ??
    parseNumber(entry.last) ??
    parseNumber(entry.close) ??
    (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask)

  if (typeof price !== "number") return null

  return {
    symbol,
    assetClass,
    price,
    bid,
    ask,
    volume,
    changePercent,
    name: entry.name || entry.companyName || symbol,
    source: "fmp",
  }
}

async function handleFmpQuote(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const normalized = normalizeFmpQuoteSymbol(symbol, assetClass)
  if (!normalized) {
    respondJson(res, 400, { error: "Invalid symbol" })
    return
  }
  const cacheKey = `fmp:quote:${assetClass}:${normalized}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        cacheHit: true,
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/quote`)
  url.searchParams.set("symbol", normalized)
  url.searchParams.set("apikey", config.fmpKey)
  let entry = null
  try {
    const data = await fetchJson(url.toString())
    entry = Array.isArray(data) ? data[0] : data
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  if (!entry) {
    respondJson(res, 404, { error: "Quote not found" })
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
        httpStatus: 404,
      },
    })
    return
  }

  const payload = buildFmpQuotePayload(entry, symbol, assetClass)
  if (!payload) {
    respondJson(res, 502, { error: "Invalid price response" })
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
        httpStatus: 502,
      },
      error: { message: "Invalid price response" },
    })
    return
  }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "quote",
      assetClass,
      paramsHash: hashParams({ symbol: normalized, assetClass }),
      httpStatus: 200,
    },
  })
}

async function handleFmpQuotes(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }
  const symbolsRaw = params.get("symbols") || ""
  const assetClass = params.get("assetClass") || "stock"
  const rawSymbols = symbolsRaw
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
  if (rawSymbols.length === 0) {
    respondJson(res, 400, { error: "Symbols are required" })
    return
  }

  const normalized = []
  rawSymbols.forEach((symbol) => {
    const normalizedSymbol = normalizeFmpQuoteSymbol(symbol, assetClass)
    if (normalizedSymbol) normalized.push(normalizedSymbol)
  })
  const uniqueSymbols = Array.from(new Set(normalized))
  if (uniqueSymbols.length === 0) {
    respondJson(res, 400, { error: "No valid symbols provided" })
    return
  }

  const items = []
  const pending = []
  const startedAt = Date.now()
  uniqueSymbols.forEach((symbol) => {
    const cacheKey = `fmp:quote:${assetClass}:${symbol}`
    const cached = getCached(cacheKey)
    if (cached) {
      items.push(cached)
    } else {
      pending.push(symbol)
    }
  })

  if (pending.length > 0) {
    const batches = chunkList(pending, 100)
    for (const batch of batches) {
      const url = new URL(`${config.fmpStableBaseUrl}/quote`)
      url.searchParams.set("symbol", batch.join(","))
      url.searchParams.set("apikey", config.fmpKey)
      let entries = []
      try {
        const data = await fetchJson(url.toString())
        entries = Array.isArray(data) ? data : []
      } catch (err) {
        await emitProviderEvent({
          stationId: "provider:fmp",
          status: "error",
          startMs: startedAt,
          meta: {
            providerId: "fmp",
            endpointName: "quotes",
            assetClass,
            paramsHash: hashParams({ count: pending.length, assetClass }),
          },
          error: { message: err?.message ? String(err.message) : "Request failed" },
        })
        throw err
      }
      entries.forEach((entry) => {
        const entrySymbol = String(entry?.symbol || "").toUpperCase().trim()
        if (!entrySymbol) return
        const payload = buildFmpQuotePayload(entry, entrySymbol, assetClass)
        if (!payload) return
        const cacheKey = `fmp:quote:${assetClass}:${entrySymbol}`
        setCached(cacheKey, payload, config.cacheDefaultMs)
        items.push(payload)
      })
    }
  }

  respondJson(res, 200, { items, assetClass, source: "fmp" })
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "quotes",
      assetClass,
      cacheHit: items.length > 0 && pending.length === 0,
      paramsHash: hashParams({ count: uniqueSymbols.length, assetClass }),
      symbolsRequested: uniqueSymbols.length,
      symbolsReturned: items.length,
      httpStatus: 200,
    },
  })
}

async function handleFmpCandles(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const interval = params.get("interval") || "15min"
  const limit = clamp(parseInt(params.get("limit") || "120", 10), 1, 500)

  const normalized = normalizeFmpSymbol(symbol, assetClass)
  if (!normalized) {
    respondJson(res, 400, { error: "Invalid symbol" })
    return
  }

  const fmpInterval = mapIntervalToFmp(interval)
  const cacheKey = `fmp:candles:${assetClass}:${normalized}:${fmpInterval}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "candles",
        cacheHit: true,
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpBaseUrl}/stable/historical-chart/${fmpInterval}`)
  url.searchParams.set("symbol", normalized)
  url.searchParams.set("apikey", config.fmpKey)
  let data = []
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "candles",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  if (!Array.isArray(data)) {
    respondJson(res, 502, { error: "Invalid candles response" })
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "candles",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
        httpStatus: 502,
      },
      error: { message: "Invalid candles response" },
    })
    return
  }
  const candles = data
    .map((entry) => {
      const time = entry.date || entry.time || entry.timestamp
      const parsedTime = time ? new Date(time).getTime() : null
      const open = parseNumber(entry.open)
      const high = parseNumber(entry.high)
      const low = parseNumber(entry.low)
      const close = parseNumber(entry.close)
      if (!parsedTime || open === undefined || high === undefined || low === undefined || close === undefined) {
        return null
      }
      return {
        time: parsedTime,
        open,
        high,
        low,
        close,
        volume: parseNumber(entry.volume),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time)

  const payload = {
    symbol,
    assetClass,
    interval: fmpInterval,
    candles: candles.slice(-limit),
    source: "fmp",
  }
  setCached(cacheKey, payload, config.cacheCandlesMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "candles",
      assetClass,
      paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
      httpStatus: 200,
      candles: payload.candles.length,
    },
  })
}

async function handleFmpStockList(req, res) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }

  const cacheKey = "fmp:stock-list"
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "stock-list",
        cacheHit: true,
        paramsHash: hashParams("stock-list"),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  // Use stable API endpoint instead of deprecated v3 endpoint
  const url = new URL(`${config.fmpStableBaseUrl}/stock-list`)
  url.searchParams.set("apikey", config.fmpKey)
  let raw = ""
  try {
    raw = await fetchText(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "stock-list",
        paramsHash: hashParams("stock-list"),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  const trimmed = raw.trim()
  let items = []

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed)
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : []
    items = list
      .map((entry) => {
        const symbol = normalizeTicker(entry.symbol || entry.ticker || entry.Symbol || "")
        if (!symbol) return null
        return {
          symbol,
          name: entry.name || entry.companyName || entry.Name || symbol,
          exchange: entry.exchange || entry.Exchange || undefined,
          assetType: entry.type || entry.assetType || entry.Type || undefined,
        }
      })
      .filter(Boolean)
  } else {
    items = parseStockList(raw)
  }
  const payload = { items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheStockListMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "stock-list",
      paramsHash: hashParams("stock-list"),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpCrypto(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }

  const limit = clamp(parseInt(params.get("limit") || "50", 10), 1, 250)

  const cacheKey = `fmp:crypto:markets:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "crypto_markets",
        cacheHit: true,
        paramsHash: hashParams({ limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()

  // Top crypto symbols to fetch (batch endpoint requires paid tier)
  // Using individual /stable/quote endpoint for each symbol
  const topCryptoSymbols = [
    "BTCUSD", "ETHUSD", "USDTUSD", "BNBUSD", "SOLUSD",
    "XRPUSD", "USDCUSD", "ADAUSD", "DOGUSD", "TRXUSD",
    "AVAXUSD", "TONUSD", "LINKUSD", "SHIBUSD", "WBTCUSD",
    "DOTUSD", "BCHUSD", "NEARCUSD", "MATICUSD", "LTCUSD",
    "DAITUSD", "UNIUSD", "ICPUSD", "APTUSD", "ETCUSD",
    "FILUSD", "RENDERUSD", "STXUSD", "ATOMUSD", "ARBUSD",
    "XLMUSD", "ALGOUSD", "GRTUSD", "SANDUSD", "MANAUSD",
    "AAVEUSD", "FTMUSD", "MKRUSD", "SNXUSD", "COMPUSD",
    "SUSHIUSD", "ZECUSD", "YFIUSD", "ENJUSD", "CHZUSD",
    "BATCUSD", "1INCHUSD", "ZRXUSD", "RVNUSD", "QTUMUSD"
  ].slice(0, limit)

  const data = []
  const errors = []

  // Fetch quotes for each symbol
  for (const symbol of topCryptoSymbols) {
    try {
      const url = new URL(`${config.fmpStableBaseUrl}/quote`)
      url.searchParams.set("symbol", symbol)
      url.searchParams.set("apikey", config.fmpKey)

      const result = await fetchJson(url.toString())
      if (Array.isArray(result) && result.length > 0) {
        data.push(result[0])
      }
    } catch (err) {
      errors.push({ symbol, error: err.message })
      // Continue fetching other symbols
      continue
    }
  }

  if (data.length === 0) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "crypto_markets",
        paramsHash: hashParams({ limit }),
      },
      error: { message: "No crypto data fetched", errors },
    })
    respondJson(res, 502, { error: "Failed to fetch crypto data", errors })
    return
  }

  // Sort by volume descending
  const sorted = data
    .filter(item => item && item.symbol && item.volume > 0)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))

  const payload = { data: sorted, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "crypto_markets",
      paramsHash: hashParams({ limit }),
      httpStatus: 200,
      count: sorted.length,
      errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
    },
  })
}

async function handleFmpIndicators(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  const indicator = (params.get("indicator") || "sma").toLowerCase()
  const period = clamp(parseInt(params.get("period") || "20", 10), 2, 200)
  const timeframe = params.get("timeframe") || "5min"
  const limit = clamp(parseInt(params.get("limit") || "100", 10), 1, 500)

  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const validIndicators = ["sma", "ema", "wma", "dema", "tema", "rsi", "adx", "williams", "standarddeviation"]
  if (!validIndicators.includes(indicator)) {
    respondJson(res, 400, { error: `Invalid indicator. Valid: ${validIndicators.join(", ")}` })
    return
  }

  const cacheKey = `fmp:indicator:${indicator}:${symbol}:${period}:${timeframe}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: `indicator_${indicator}`,
        cacheHit: true,
        paramsHash: hashParams({ symbol, indicator, period, timeframe }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/technical-indicators/${indicator}`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("periodLength", String(period))
  url.searchParams.set("timeframe", timeframe)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: `indicator_${indicator}`,
        paramsHash: hashParams({ symbol, indicator, period, timeframe }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data.slice(0, limit) : []
  const payload = { symbol, indicator, period, timeframe, data: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheCandlesMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: `indicator_${indicator}`,
      paramsHash: hashParams({ symbol, indicator, period, timeframe }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpProfile(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:profile:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/profile`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "profile", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const profile = Array.isArray(data) ? data[0] : null
  const payload = { symbol, profile, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 10) // cache profile longer
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "profile",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
}

async function handleFmpNews(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase()
  const limit = clamp(parseInt(params.get("limit") || "20", 10), 1, 100)

  const cacheKey = `fmp:news:${symbol}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/stock-news`)
  if (symbol) url.searchParams.set("symbols", symbol)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "stock_news", paramsHash: hashParams({ symbol, limit }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data : []
  const payload = { symbol: symbol || "all", data: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheNewsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "stock_news",
      paramsHash: hashParams({ symbol, limit }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpPriceTarget(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:pricetarget:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/price-target-consensus`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "price_target", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const target = Array.isArray(data) ? data[0] : null
  const payload = { symbol, priceTarget: target, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 5)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "price_target",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
}

async function handleFmpAnalystRatings(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:ratings:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/rating`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "rating", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const rating = Array.isArray(data) ? data[0] : null
  const payload = { symbol, rating, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 5)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "rating",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
}

async function handleMarketauxNews(req, res, params) {
  if (!config.marketauxKey) {
    respondJson(res, 500, { error: "MARKETAUX_API_KEY is not configured" })
    return
  }

  const symbols = params.get("symbols") || ""
  const entityTypes = params.get("entity_types") || params.get("entityTypes") || ""
  const limit = clamp(parseInt(params.get("limit") || "20", 10), 1, 100)
  if (!symbols) {
    respondJson(res, 400, { error: "Missing symbols" })
    return
  }

  const cacheKey = `marketaux:news:${symbols}:${entityTypes}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:marketaux",
      status: "end",
      meta: {
        providerId: "marketaux",
        endpointName: "news",
        cacheHit: true,
        paramsHash: hashParams({ symbols, entityTypes, limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(config.marketauxBaseUrl)
  url.searchParams.set("api_token", config.marketauxKey)
  url.searchParams.set("symbols", symbols)
  url.searchParams.set("filter_entities", "true")
  url.searchParams.set("language", "en")
  url.searchParams.set("limit", String(limit))
  if (entityTypes) {
    url.searchParams.set("entity_types", entityTypes)
  }

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:marketaux",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "marketaux",
        endpointName: "news",
        paramsHash: hashParams({ symbols, entityTypes, limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  const payload = { data: Array.isArray(data?.data) ? data.data : [], source: "marketaux" }
  setCached(cacheKey, payload, config.cacheNewsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:marketaux",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "marketaux",
      endpointName: "news",
      paramsHash: hashParams({ symbols, entityTypes, limit }),
      httpStatus: 200,
      count: Array.isArray(payload.data) ? payload.data.length : undefined,
    },
  })
}

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost")
    const path = url.pathname
    if (path === "/" || path === "/healthz" || path === "/readyz") {
      respondJson(res, 200, { status: "ok" })
      return
    }

    if (req.method !== "GET") {
      respondJson(res, 405, { error: "Method not allowed" })
      return
    }

    const params = url.searchParams

    if (path === "/ping/fmp") {
      if (!config.fmpKey) {
        respondJson(res, 503, { ok: false, error: "FMP key not configured." })
        return
      }
      const pingUrl = new URL(`${config.fmpStableBaseUrl}/quote`)
      pingUrl.searchParams.set("symbol", "AAPL")
      pingUrl.searchParams.set("apikey", config.fmpKey)
      const data = await fetchJson(pingUrl.toString())
      respondJson(res, 200, {
        ok: true,
        source: "fmp",
        sample: Array.isArray(data) ? data?.[0]?.symbol || null : null,
      })
      return
    }
    if (path === "/ping/marketaux") {
      if (!config.marketauxKey) {
        respondJson(res, 503, { ok: false, error: "Marketaux key not configured." })
        return
      }
      const pingUrl = new URL(config.marketauxBaseUrl)
      pingUrl.searchParams.set("api_token", config.marketauxKey)
      pingUrl.searchParams.set("symbols", "AAPL")
      pingUrl.searchParams.set("limit", "1")
      pingUrl.searchParams.set("language", "en")
      await fetchJson(pingUrl.toString())
      respondJson(res, 200, { ok: true, source: "marketaux" })
      return
    }

    if (path === "/v1/fmp/quote") {
      await handleFmpQuote(req, res, params)
      return
    }
    if (path === "/v1/fmp/quotes") {
      await handleFmpQuotes(req, res, params)
      return
    }
    if (path === "/v1/fmp/candles") {
      await handleFmpCandles(req, res, params)
      return
    }
    if (path === "/v1/fmp/stock-list") {
      await handleFmpStockList(req, res)
      return
    }
    if (path === "/v1/fmp/crypto") {
      await handleFmpCrypto(req, res, params)
      return
    }
    if (path === "/v1/fmp/indicators") {
      await handleFmpIndicators(req, res, params)
      return
    }
    if (path === "/v1/fmp/profile") {
      await handleFmpProfile(req, res, params)
      return
    }
    if (path === "/v1/fmp/news") {
      await handleFmpNews(req, res, params)
      return
    }
    if (path === "/v1/fmp/price-target") {
      await handleFmpPriceTarget(req, res, params)
      return
    }
    if (path === "/v1/fmp/ratings") {
      await handleFmpAnalystRatings(req, res, params)
      return
    }
    if (path === "/v1/marketaux/news") {
      await handleMarketauxNews(req, res, params)
      return
    }

    respondJson(res, 404, { error: "Not found" })
  } catch (error) {
    console.error("Gateway error:", error.message)
    respondJson(res, 500, { error: "Gateway error", detail: error.message })
  }
}

const server = http.createServer((req, res) => {
  requestHandler(req, res)
})

server.listen(config.port, () => {
  console.log("Market data gateway listening", { port: config.port })
})

initPipelineRedis().catch((err) => {
  console.error("Pipeline redis init failed:", err.message)
})

function shutdown() {
  if (pipelineRedis) {
    pipelineRedis.quit().catch(() => {})
  }
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
