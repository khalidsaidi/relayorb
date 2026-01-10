const http = require("http")

const config = {
  fmpKey: process.env.FMP_API_KEY || "",
  marketauxKey: process.env.MARKETAUX_API_KEY || "",
  port: parseInt(process.env.PORT || "8080", 10),
  fmpBaseUrl: process.env.FMP_BASE_URL || "https://financialmodelingprep.com",
  fmpStableBaseUrl:
    process.env.FMP_STABLE_BASE_URL || "https://financialmodelingprep.com/stable",
  binanceBaseUrl: process.env.BINANCE_BASE_URL || "https://api.binance.com",
  coingeckoBaseUrl: process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3",
  marketauxBaseUrl: process.env.MARKETAUX_BASE_URL || "https://api.marketaux.com/v1/news/all",
  cacheDefaultMs: parseInt(process.env.MDG_CACHE_TTL_MS || "15000", 10),
  cacheCandlesMs: parseInt(process.env.MDG_CANDLES_TTL_MS || "60000", 10),
  cacheMarketsMs: parseInt(process.env.MDG_MARKETS_TTL_MS || "60000", 10),
  cacheNewsMs: parseInt(process.env.MDG_NEWS_TTL_MS || "120000", 10),
  cacheStockListMs: parseInt(process.env.MDG_STOCK_LIST_TTL_MS || "21600000", 10),
}

const cache = new Map()

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

async function fetchJson(url, options) {
  logEvent("mdg_request", { url })
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429) {
      logEvent("mdg_rate_limited", { url, status: res.status })
    }
    throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function fetchText(url, options) {
  logEvent("mdg_request", { url })
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429) {
      logEvent("mdg_rate_limited", { url, status: res.status })
    }
    throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
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
    return
  }

  const url = new URL(`${config.fmpStableBaseUrl}/quote`)
  url.searchParams.set("symbol", normalized)
  url.searchParams.set("apikey", config.fmpKey)
  const data = await fetchJson(url.toString())
  const entry = Array.isArray(data) ? data[0] : data
  if (!entry) {
    respondJson(res, 404, { error: "Quote not found" })
    return
  }

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

  if (typeof price !== "number") {
    respondJson(res, 502, { error: "Invalid price response" })
    return
  }

  const payload = {
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
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
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
    return
  }

  const url = new URL(`${config.fmpStableBaseUrl}/historical-chart/${fmpInterval}`)
  url.searchParams.set("symbol", normalized)
  url.searchParams.set("apikey", config.fmpKey)
  const data = await fetchJson(url.toString())
  if (!Array.isArray(data)) {
    respondJson(res, 502, { error: "Invalid candles response" })
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
    return
  }

  const url = new URL(`${config.fmpBaseUrl}/api/v3/stock/list`)
  url.searchParams.set("apikey", config.fmpKey)
  const raw = await fetchText(url.toString())
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
}

async function handleBinanceTicker(req, res, params) {
  const symbol = params.get("symbol") || ""
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const cacheKey = `binance:ticker:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const url = new URL(`${config.binanceBaseUrl}/api/v3/ticker/24hr`)
  url.searchParams.set("symbol", symbol)
  const data = await fetchJson(url.toString())
  const payload = {
    symbol,
    price: parseNumber(data.lastPrice),
    change24h: parseNumber(data.priceChangePercent),
    volume: parseNumber(data.quoteVolume ?? data.volume),
    source: "binance",
  }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
}

async function handleBinanceKlines(req, res, params) {
  const symbol = params.get("symbol") || ""
  const interval = params.get("interval") || "1m"
  const limit = clamp(parseInt(params.get("limit") || "2", 10), 1, 1000)
  const startTime = params.get("startTime")
  const endTime = params.get("endTime")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `binance:klines:${symbol}:${interval}:${limit}:${startTime || ""}:${endTime || ""}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const url = new URL(`${config.binanceBaseUrl}/api/v3/klines`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("interval", interval)
  url.searchParams.set("limit", String(limit))
  if (startTime) url.searchParams.set("startTime", startTime)
  if (endTime) url.searchParams.set("endTime", endTime)
  const data = await fetchJson(url.toString())
  const payload = { symbol, interval, data, source: "binance" }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
}

async function handleCoingeckoMarkets(req, res, params) {
  const vsCurrency = params.get("vs_currency") || "usd"
  const order = params.get("order") || "volume_desc"
  const perPage = clamp(parseInt(params.get("per_page") || "50", 10), 1, 250)
  const page = clamp(parseInt(params.get("page") || "1", 10), 1, 100)
  const priceChange = params.get("price_change_percentage") || "1h,24h,7d"

  const cacheKey = `coingecko:markets:${vsCurrency}:${order}:${perPage}:${page}:${priceChange}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const url = new URL(`${config.coingeckoBaseUrl}/coins/markets`)
  url.searchParams.set("vs_currency", vsCurrency)
  url.searchParams.set("order", order)
  url.searchParams.set("per_page", String(perPage))
  url.searchParams.set("page", String(page))
  url.searchParams.set("price_change_percentage", priceChange)
  const data = await fetchJson(url.toString())
  const payload = { data, source: "coingecko" }
  setCached(cacheKey, payload, config.cacheMarketsMs)
  respondJson(res, 200, payload)
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
    return
  }

  const url = new URL(config.marketauxBaseUrl)
  url.searchParams.set("api_token", config.marketauxKey)
  url.searchParams.set("symbols", symbols)
  url.searchParams.set("filter_entities", "true")
  url.searchParams.set("language", "en")
  url.searchParams.set("limit", String(limit))
  if (entityTypes) {
    url.searchParams.set("entity_types", entityTypes)
  }

  const data = await fetchJson(url.toString())
  const payload = { data: Array.isArray(data?.data) ? data.data : [], source: "marketaux" }
  setCached(cacheKey, payload, config.cacheNewsMs)
  respondJson(res, 200, payload)
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
    if (path === "/ping/binance") {
      const pingUrl = new URL(`${config.binanceBaseUrl}/api/v3/ping`)
      try {
        await fetchText(pingUrl.toString())
        respondJson(res, 200, { ok: true, source: "binance" })
      } catch (err) {
        respondJson(res, 200, {
          ok: false,
          source: "binance",
          error: err instanceof Error ? err.message : String(err),
        })
      }
      return
    }
    if (path === "/ping/coingecko") {
      const pingUrl = new URL(`${config.coingeckoBaseUrl}/ping`)
      const data = await fetchJson(pingUrl.toString())
      respondJson(res, 200, { ok: true, source: "coingecko", status: data?.gecko_says || null })
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
    if (path === "/v1/fmp/candles") {
      await handleFmpCandles(req, res, params)
      return
    }
    if (path === "/v1/fmp/stock-list") {
      await handleFmpStockList(req, res)
      return
    }
    if (path === "/v1/binance/ticker") {
      await handleBinanceTicker(req, res, params)
      return
    }
    if (path === "/v1/binance/klines") {
      await handleBinanceKlines(req, res, params)
      return
    }
    if (path === "/v1/coingecko/markets") {
      await handleCoingeckoMarkets(req, res, params)
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

function shutdown() {
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
