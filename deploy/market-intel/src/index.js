const admin = require("firebase-admin")

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  hotTradesLimit: parseInt(process.env.HOT_TRADES_LIMIT || "12", 10),
  signalLookbackMinutes: parseInt(process.env.BOT_SIGNAL_LOOKBACK_MINUTES || "360", 10),
  cryptoLimit: parseInt(process.env.CRYPTO_LIMIT || "40", 10),
  cryptoExchange: process.env.CRYPTO_EXCHANGE || "binance",
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  llmIntervalMinutes: parseInt(process.env.LLM_INTERVAL_MINUTES || "30", 10),
  marketauxKey: process.env.MARKETAUX_API_KEY || "",
  newsLimit: parseInt(process.env.MARKETAUX_LIMIT || "40", 10),
  newsSymbolLimit: parseInt(process.env.MARKETAUX_SYMBOL_LIMIT || "25", 10),
  newsIntervalMinutes: parseInt(process.env.NEWS_INTERVAL_MINUTES || "30", 10),
  alphaVantageKey: process.env.ALPHAVANTAGE_API_KEY || "",
  minAccuracySignals: parseInt(process.env.MIN_ACCURACY_SIGNALS || "12", 10),
  autoTuneEnabled: process.env.AUTO_TUNE_ENABLED !== "false",
  autoTuneIntervalHours: parseInt(process.env.AUTO_TUNE_INTERVAL_HOURS || "6", 10),
  autoTuneMaxDelta: parseInt(process.env.AUTO_TUNE_MAX_DELTA || "12", 10),
  stockWatchlistLimit: parseInt(process.env.STOCK_WATCHLIST_LIMIT || "5", 10),
  symbolCacheDays: parseInt(process.env.SYMBOL_CACHE_DAYS || "7", 10),
  symbolCacheMax: parseInt(process.env.SYMBOL_CACHE_MAX || "12000", 10),
  popularPerClass: parseInt(process.env.POPULAR_PER_CLASS || "12", 10),
  trendLimit: parseInt(process.env.TREND_LIMIT || "8", 10),
  emitSignals: process.env.EMIT_MARKET_SIGNALS !== "false",
  actionBoardLimit: parseInt(process.env.ACTION_BOARD_LIMIT || "10", 10),
  signalRequestIntervalMinutes: parseInt(
    process.env.SIGNAL_REQUEST_INTERVAL_MINUTES || "5",
    10
  ),
  signalLimit: parseInt(process.env.MARKET_SIGNAL_LIMIT || "3", 10),
  signalBackfillMinutes: parseInt(
    process.env.MARKET_SIGNAL_BACKFILL_MINUTES || "0",
    10
  ),
  fxPairs: parseList(
    process.env.FX_PAIRS,
    ["USD/JPY", "USD/EUR", "USD/GBP", "USD/CHF", "USD/CAD"]
  ),
}

const VALID_HORIZONS = new Set(["1h", "24h", "7d"])
const TREND_HORIZONS = ["15m", "1h", "24h", "7d"]
const VALID_TREND_HORIZONS = new Set(TREND_HORIZONS)
const VALID_RISK = new Set(["conservative", "balanced", "aggressive"])
const VALID_ASSET_FOCUS = new Set(["crypto", "stock", "forex"])
const MARKET_SIGNAL_BOT_ID = "market-intel"
const MARKETAUX_BASE_URL = "https://api.marketaux.com/v1/news/all"
const TREND_MOMENTUM_SCALES = {
  "15m": 12,
  "1h": 6,
  "24h": 1.5,
  "7d": 0.5,
}
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
const DEFAULT_TREND_WEIGHTS = {
  momentum: 40,
  volume: 25,
  signals: 20,
  news: 15,
}

function parseList(value, fallback = []) {
  if (!value) return fallback
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function extractAlphaError(data) {
  if (!data || typeof data !== "object") return null
  const message = data.Note || data["Error Message"] || data.Information || null
  if (typeof message !== "string") return null
  const trimmed = message.trim()
  return trimmed.length ? trimmed : null
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function looksLikePair(left, right) {
  if (!left || !right) return false
  const base = String(left).toUpperCase()
  const quote = String(right).toUpperCase()
  if (PAIR_QUOTES.has(quote)) return true
  if (PAIR_QUOTES.has(base) && PAIR_QUOTES.has(quote)) return true
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

function normalizeSignalKey(raw) {
  if (!raw) return null
  const normalized = normalizeSymbol(raw)
  if (normalized && normalized.includes("/")) return normalized
  const ticker = normalizeTicker(raw)
  return ticker || normalized
}

function toBinanceSymbol(pair) {
  const normalized = normalizeSymbol(pair)
  if (!normalized || !normalized.includes("/")) return null
  const [base, quoteRaw] = normalized.split("/")
  if (!base || !quoteRaw) return null
  const quote = quoteRaw === "USD" ? "USDT" : quoteRaw
  return `${base}${quote}`
}

function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function extractSymbolFromSignal(signal) {
  const data = signal.data || {}
  const candidate =
    data.symbol ||
    data.pair ||
    data.market ||
    data.trading_pair ||
    data.tradingPair ||
    data.instrument ||
    signal.symbol

  if (candidate) return normalizeSignalKey(candidate)

  const text = `${signal.message || ""} ${signal.type || ""}`.toUpperCase()
  const match = text.match(/[A-Z0-9]{2,10}[/-][A-Z0-9]{2,10}/)
  return match ? normalizeSignalKey(match[0]) : null
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function fetchBinanceChange(symbol, interval) {
  const url = new URL("https://api.binance.com/api/v3/klines")
  url.search = new URLSearchParams({
    symbol,
    interval,
    limit: "2",
  }).toString()
  const data = await fetchJson(url.toString())
  if (!Array.isArray(data) || data.length < 2) return null
  const prevClose = parseNumber(data[data.length - 2]?.[4])
  const lastClose = parseNumber(data[data.length - 1]?.[4])
  if (!prevClose || !lastClose) return null
  return ((lastClose - prevClose) / prevClose) * 100
}

async function fetchBinanceTicker(symbol) {
  const url = new URL("https://api.binance.com/api/v3/ticker/24hr")
  url.search = new URLSearchParams({ symbol }).toString()
  const data = await fetchJson(url.toString())
  return {
    price: parseNumber(data.lastPrice),
    change24h: parseNumber(data.priceChangePercent),
    volume: parseNumber(data.quoteVolume ?? data.volume),
  }
}

async function fetchCryptoIntradayChanges(pairs, interval) {
  const results = new Map()
  for (const pair of pairs) {
    const symbol = toBinanceSymbol(pair)
    if (!symbol) continue
    try {
      const change = await fetchBinanceChange(symbol, interval)
      if (change !== null && change !== undefined) {
        results.set(normalizeSymbol(pair), change)
      }
    } catch (err) {
      continue
    }
  }
  return results
}

async function fetchCryptoWatchlist(pairs) {
  const results = []
  for (const pair of pairs) {
    const normalized = normalizeSymbol(pair)
    if (!normalized) continue
    const symbol = toBinanceSymbol(normalized)
    if (!symbol) continue
    try {
      const data = await fetchBinanceTicker(symbol)
      if (!data) continue
      results.push({
        assetClass: "crypto",
        symbol: normalized,
        name: normalized,
        exchange: config.cryptoExchange,
        price: data.price,
        change24h: data.change24h,
        volume: data.volume,
        watchlisted: true,
        source: "binance",
      })
    } catch (err) {
      continue
    }
  }
  return results
}

async function fetchText(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text()
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

  if (value.length > 0 || row.length > 0) {
    row.push(value)
    if (row.length > 1 || row[0]) {
      rows.push(row)
    }
  }

  return rows
}

function parseListingStatus(text) {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith("{")) {
    throw new Error(`Alpha Vantage listing status error: ${trimmed.slice(0, 200)}`)
  }

  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const headers = rows[0].map((header) => String(header || "").trim().toLowerCase())
  const getIndex = (name) => headers.indexOf(name)
  const symbolIndex = getIndex("symbol")

  if (symbolIndex === -1) return []

  const nameIndex = getIndex("name")
  const exchangeIndex = getIndex("exchange")
  const assetTypeIndex = getIndex("assettype")
  const ipoDateIndex = getIndex("ipodate")
  const statusIndex = getIndex("status")

  return rows
    .slice(1)
    .map((row) => {
      const symbol = normalizeTicker(row[symbolIndex] || "")
      if (!symbol) return null
      return {
        symbol,
        name: String(row[nameIndex] || "").trim() || symbol,
        exchange: String(row[exchangeIndex] || "").trim(),
        assetType: String(row[assetTypeIndex] || "").trim(),
        ipoDate: String(row[ipoDateIndex] || "").trim(),
        status: String(row[statusIndex] || "").trim(),
      }
    })
    .filter(Boolean)
}

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: config.projectId })
  }
  return admin.firestore()
}

async function readUniverse(db) {
  const snap = await db.doc("market/universe").get()
  const data = snap.exists ? snap.data() : {}

  const crypto = data?.crypto || {}
  const stocks = data?.stocks || {}
  const forex = data?.forex || {}

  return {
    crypto: {
      includeTrending: crypto.includeTrending !== false,
      symbols: uniqueList(
        Array.isArray(crypto.symbols)
          ? crypto.symbols.map(normalizeSymbol).filter(Boolean)
          : []
      ),
    },
    stocks: {
      includeTrending: stocks.includeTrending !== false,
      symbols: uniqueList(
        Array.isArray(stocks.symbols)
          ? stocks.symbols.map(normalizeTicker).filter(Boolean)
          : []
      ),
    },
    forex: {
      includeTrending: forex.includeTrending !== false,
      pairs: uniqueList(
        Array.isArray(forex.pairs)
          ? forex.pairs.map(normalizeSymbol).filter(Boolean)
          : []
      ),
    },
  }
}

async function readControls(db) {
  const snap = await db.doc("market/controls").get()
  const data = snap.exists ? snap.data() : {}
  const parsedInterval = Number(data?.llmIntervalMinutes)
  const llmIntervalMinutes =
    Number.isFinite(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : config.llmIntervalMinutes
  const parsedNewsInterval = Number(data?.newsIntervalMinutes)
  const newsIntervalMinutes =
    Number.isFinite(parsedNewsInterval) && parsedNewsInterval > 0
      ? parsedNewsInterval
      : config.newsIntervalMinutes
  const horizonCandidate = typeof data?.dipHorizon === "string" ? data.dipHorizon : ""
  const dipHorizon = VALID_HORIZONS.has(horizonCandidate) ? horizonCandidate : "24h"
  const trendCandidate =
    typeof data?.trendHorizon === "string" ? data.trendHorizon : ""
  const trendHorizon = VALID_TREND_HORIZONS.has(trendCandidate)
    ? trendCandidate
    : "15m"
  const riskCandidate = typeof data?.riskProfile === "string" ? data.riskProfile : ""
  const riskProfile = VALID_RISK.has(riskCandidate) ? riskCandidate : "balanced"
  const focusList = Array.isArray(data?.assetFocus)
    ? data.assetFocus.map((item) => String(item).toLowerCase())
    : []
  const assetFocus =
    uniqueList(focusList.filter((item) => VALID_ASSET_FOCUS.has(item))) ||
    []
  const normalizedFocus =
    assetFocus.length > 0 ? assetFocus : ["crypto", "stock", "forex"]
  const primaryRaw = (data?.primaryAssets || {}) ?? {}
  const primaryAssets = {
    crypto: uniqueList(
      Array.isArray(primaryRaw.crypto)
        ? primaryRaw.crypto.map(normalizeSymbol).filter(Boolean)
        : []
    ),
    stocks: uniqueList(
      Array.isArray(primaryRaw.stocks)
        ? primaryRaw.stocks.map(normalizeTicker).filter(Boolean)
        : []
    ),
    forex: uniqueList(
      Array.isArray(primaryRaw.forex)
        ? primaryRaw.forex.map(normalizeSymbol).filter(Boolean)
        : []
    ),
  }

  const rawWeights = data?.trendWeights || {}
  const trendWeights = {
    momentum: clamp(
      parseNumber(rawWeights.momentum) ?? DEFAULT_TREND_WEIGHTS.momentum,
      0,
      100
    ),
    volume: clamp(
      parseNumber(rawWeights.volume) ?? DEFAULT_TREND_WEIGHTS.volume,
      0,
      100
    ),
    signals: clamp(
      parseNumber(rawWeights.signals) ?? DEFAULT_TREND_WEIGHTS.signals,
      0,
      100
    ),
    news: clamp(parseNumber(rawWeights.news) ?? DEFAULT_TREND_WEIGHTS.news, 0, 100),
  }

  return {
    enableLLM: data?.enableLLM !== false,
    llmIntervalMinutes,
    enableNews: data?.enableNews !== false,
    newsIntervalMinutes,
    dipHorizon,
    trendHorizon,
    trendWeights,
    riskProfile,
    assetFocus: normalizedFocus,
    primaryAssets,
    autoTuneEnabled:
      data?.autoTuneEnabled === undefined ? config.autoTuneEnabled : Boolean(data.autoTuneEnabled),
    autoTuneWithAI: data?.autoTuneWithAI !== false,
    autoTuneIntervalHours: Number.isFinite(Number(data?.autoTuneIntervalHours))
      ? Math.max(1, Number(data.autoTuneIntervalHours))
      : config.autoTuneIntervalHours,
    autoTuneLastAt: data?.autoTuneLastAt || null,
    autoTuneNotes: typeof data?.autoTuneNotes === "string" ? data.autoTuneNotes : "",
  }
}

async function refreshStockSymbolCache(db) {
  if (!config.alphaVantageKey) {
    console.log("Stock symbol cache skipped (no Alpha Vantage key)")
    return
  }

  const cacheRef = db.doc("market/symbolCache")
  const cacheSnap = await cacheRef.get()
  const lastUpdated = cacheSnap.data()?.stocksUpdatedAt?.toDate?.()
  const maxAgeMs = Math.max(config.symbolCacheDays, 0) * 24 * 60 * 60 * 1000

  if (lastUpdated && maxAgeMs > 0) {
    const ageMs = Date.now() - lastUpdated.getTime()
    if (ageMs < maxAgeMs) {
      return
    }
  }

  console.log("Refreshing stock symbol cache")
  const url = `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${config.alphaVantageKey}`
  const csv = await fetchText(url)
  const listings = parseListingStatus(csv)
  const active = listings.filter(
    (entry) => String(entry.status || "").toLowerCase() === "active"
  )
  const limited =
    config.symbolCacheMax > 0 ? active.slice(0, config.symbolCacheMax) : active

  if (limited.length === 0) {
    console.log("Stock symbol cache empty after parsing")
    return
  }

  const writer = db.bulkWriter()
  const updatedAt = admin.firestore.FieldValue.serverTimestamp()

  limited.forEach((entry) => {
    const docId = String(entry.symbol).replace(/\//g, "-")
    writer.set(
      db.collection("market_symbols_stocks").doc(docId),
      compactObject({
        symbol: entry.symbol,
        name: entry.name || entry.symbol,
        exchange: entry.exchange || undefined,
        assetType: entry.assetType || undefined,
        ipoDate: entry.ipoDate || undefined,
        status: entry.status || undefined,
        updatedAt,
      }),
      { merge: true }
    )
  })

  await writer.close()
  await cacheRef.set(
    {
      stocksUpdatedAt: updatedAt,
      stocksCount: limited.length,
      stocksSource: "alphavantage",
    },
    { merge: true }
  )

  console.log("Stock symbol cache refreshed", { count: limited.length })
}

async function fetchCrypto(preferences = {}) {
  const includeTrending = preferences.includeTrending !== false
  const watchlist = Array.isArray(preferences.symbols) ? preferences.symbols : []
  const watchlistSet = new Set(watchlist.map(normalizeSymbol).filter(Boolean))

  if (!includeTrending && watchlistSet.size === 0) {
    return []
  }

  const url = new URL("https://api.coingecko.com/api/v3/coins/markets")
  url.search = new URLSearchParams({
    vs_currency: "usd",
    order: "volume_desc",
    per_page: String(config.cryptoLimit),
    page: "1",
    price_change_percentage: "1h,24h,7d",
  }).toString()

  const data = await fetchJson(url.toString())

  const baseItems = data
    .map((item, index) => {
      const symbol = `${String(item.symbol || "").toUpperCase()}/USDT`
      const normalized = normalizeSymbol(symbol)
      const watchlisted = normalized ? watchlistSet.has(normalized) : false
      return {
        assetClass: "crypto",
        symbol,
        name: item.name || symbol,
        exchange: config.cryptoExchange,
        price: parseNumber(item.current_price),
        change1h: parseNumber(item.price_change_percentage_1h_in_currency),
        change24h: parseNumber(item.price_change_percentage_24h_in_currency),
        change7d: parseNumber(item.price_change_percentage_7d_in_currency),
        volume: parseNumber(item.total_volume),
        liquidityRank: index + 1,
        watchlisted,
        source: "coingecko",
      }
    })
    .filter((item) => includeTrending || item.watchlisted)

  const itemsMap = new Map()
  baseItems.forEach((item) => {
    const key = normalizeSymbol(item.symbol)
    if (!key) return
    itemsMap.set(key, item)
  })

  const missingWatchlist = Array.from(watchlistSet).filter(
    (symbol) => !itemsMap.has(normalizeSymbol(symbol))
  )
  if (missingWatchlist.length > 0) {
    const extra = await fetchCryptoWatchlist(missingWatchlist)
    extra.forEach((item) => {
      const key = normalizeSymbol(item.symbol)
      if (!key) return
      itemsMap.set(key, item)
    })
  }

  const items = Array.from(itemsMap.values())
  if (items.length === 0) return []

  const change15mMap = await fetchCryptoIntradayChanges(
    items.map((item) => item.symbol),
    "15m"
  )
  const change1hMap = await fetchCryptoIntradayChanges(
    items.map((item) => item.symbol),
    "1h"
  )

  return items.map((item) => {
    const key = normalizeSymbol(item.symbol)
    const change15m = key ? change15mMap.get(key) : undefined
    const change1h = key ? change1hMap.get(key) : undefined
    return {
      ...item,
      change15m: change15m === undefined ? undefined : change15m,
      change1h: item.change1h ?? (change1h === undefined ? undefined : change1h),
    }
  })
}

async function fetchStockQuote(symbol) {
  if (!config.alphaVantageKey) return null
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
    symbol
  )}&apikey=${config.alphaVantageKey}`
  const data = await fetchJson(url)
  const alphaError = extractAlphaError(data)
  if (alphaError) return null
  const quote = data?.["Global Quote"]
  if (!quote) return null
  const price = parseNumber(quote["05. price"])
  const changePercent = parseNumber(
    String(quote["10. change percent"] || "").replace(/%/g, "")
  )
  return {
    assetClass: "stock",
    symbol,
    name: symbol,
    price,
    change24h: changePercent,
    volume: parseNumber(quote["06. volume"]),
    watchlisted: true,
    source: "alphavantage",
  }
}

function getAlphaVantageList(data, keys) {
  if (!data) return []
  for (const key of keys) {
    const list = data[key]
    if (Array.isArray(list) && list.length > 0) return list
  }
  return []
}

async function fetchStocks(preferences = {}) {
  if (!config.alphaVantageKey) {
    return []
  }

  const includeTrending = preferences.includeTrending !== false
  const watchlist = Array.isArray(preferences.symbols) ? preferences.symbols : []
  const watchlistSet = new Set(watchlist.map(normalizeTicker).filter(Boolean))
  const results = new Map()

  if (includeTrending) {
    const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${config.alphaVantageKey}`
    const data = await fetchJson(url)
    const alphaError = extractAlphaError(data)
    if (alphaError) {
      throw new Error(alphaError)
    }
    const gainers = getAlphaVantageList(data, ["top_gainers", "mostGainerStock"])
    const losers = getAlphaVantageList(data, ["top_losers", "mostLoserStock"])
    const actives = getAlphaVantageList(data, ["most_actively_traded", "mostActiveStock"])

    const addStock = (stock, index, sideHint) => {
      const symbol = normalizeTicker(stock.ticker || stock.symbol || "")
      if (!symbol) return
      results.set(symbol, {
        assetClass: "stock",
        symbol,
        name: stock.ticker || stock.symbol || symbol,
        price: parseNumber(stock.price),
        change24h: parseNumber(String(stock.change_percentage || "").replace(/%/g, "")),
        volume: parseNumber(stock.volume),
        sideHint,
        liquidityRank: index + 1,
        watchlisted: watchlistSet.has(symbol),
        source: "alphavantage",
      })
    }

    gainers.slice(0, 10).forEach((stock, index) => addStock(stock, index, "buy"))
    losers.slice(0, 6).forEach((stock, index) => addStock(stock, index, "sell"))
    actives.slice(0, 6).forEach((stock, index) => addStock(stock, index))
  }

  const limited = Array.from(watchlistSet).slice(0, config.stockWatchlistLimit)
  for (const symbol of limited) {
    const quote = await fetchStockQuote(symbol)
    if (quote) {
      results.set(symbol, quote)
    }
  }

  if (!includeTrending && watchlistSet.size === 0) {
    return []
  }

  return Array.from(results.values())
}

async function fetchForex(preferences = {}) {
  const includeTrending = preferences.includeTrending !== false
  const pairsInput = Array.isArray(preferences.pairs) ? preferences.pairs : []
  const pairs =
    pairsInput.length > 0
      ? uniqueList(pairsInput.map(normalizeSymbol).filter(Boolean))
      : uniqueList(config.fxPairs.map(normalizeSymbol).filter(Boolean))

  if (!includeTrending && pairsInput.length === 0) return []
  if (pairs.length === 0) return []

  const grouped = new Map()
  pairs.forEach((pair) => {
    const [base, quote] = pair.split("/")
    if (!base || !quote) return
    if (!grouped.has(base)) grouped.set(base, new Set())
    grouped.get(base).add(quote)
  })

  const end = new Date()
  const start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  const results = []

  for (const [base, quotesSet] of grouped.entries()) {
    const quotes = Array.from(quotesSet)
    const url = new URL(`${formatDate(start)}..${formatDate(end)}`, "https://api.frankfurter.app")
    url.search = new URLSearchParams({
      from: base,
      to: quotes.join(","),
    }).toString()

    const data = await fetchJson(url.toString())
    const rates = data?.rates || {}
    const dates = Object.keys(rates).sort()
    if (dates.length < 2) continue

    const lastDate = dates[dates.length - 1]
    const prevDate = dates[dates.length - 2]
    const lastRates = rates[lastDate] || {}
    const prevRates = rates[prevDate] || {}

    quotes.forEach((quote, index) => {
      const rateNow = parseNumber(lastRates[quote])
      const ratePrev = parseNumber(prevRates[quote])
      if (!rateNow || !ratePrev) return

      const change24h = ((rateNow - ratePrev) / ratePrev) * 100
      const symbol = `${base}/${quote}`
      results.push({
        assetClass: "forex",
        symbol,
        name: symbol,
        price: rateNow,
        change24h,
        liquidityRank: index + 1,
        watchlisted: pairsInput.length > 0,
        source: "frankfurter",
      })
    })
  }

  return results
}

function getAssetKey(assetClass, symbol) {
  if (!symbol) return null
  if (assetClass === "stock") return normalizeTicker(symbol)
  return normalizeSymbol(symbol)
}

function getCandidateKey(candidate) {
  if (!candidate?.symbol) return null
  return getAssetKey(candidate.assetClass, candidate.symbol)
}

function resolveMomentum(candidate, horizon) {
  const change15m = parseNumber(candidate.change15m)
  const change1h = parseNumber(candidate.change1h)
  const change24h = parseNumber(candidate.change24h)
  const change7d = parseNumber(candidate.change7d)

  if (horizon === "15m" && change15m !== undefined) {
    return { change: change15m, window: "15m" }
  }
  if (horizon === "1h" && change1h !== undefined) {
    return { change: change1h, window: "1h" }
  }
  if (horizon === "24h" && change24h !== undefined) {
    return { change: change24h, window: "24h" }
  }
  if (horizon === "7d" && change7d !== undefined) {
    return { change: change7d, window: "7d" }
  }

  if (change24h !== undefined) return { change: change24h, window: "24h" }
  if (change1h !== undefined) return { change: change1h, window: "1h" }
  if (change7d !== undefined) return { change: change7d, window: "7d" }
  if (change15m !== undefined) return { change: change15m, window: "15m" }
  return { change: undefined, window: horizon }
}

function buildVolumeScores(candidates) {
  const scoreMap = new Map()
  const rankMap = new Map()
  const grouped = { crypto: [], stock: [], forex: [] }

  candidates.forEach((candidate) => {
    if (grouped[candidate.assetClass]) {
      grouped[candidate.assetClass].push(candidate)
    }
  })

  Object.entries(grouped).forEach(([, list]) => {
    const withMetric = list
      .map((candidate) => {
        const volume = parseNumber(candidate.volume)
        const metric =
          volume !== undefined
            ? volume
            : candidate.liquidityRank
              ? 1 / candidate.liquidityRank
              : 0
        return { candidate, metric }
      })
      .sort((a, b) => b.metric - a.metric)

    const total = withMetric.length
    withMetric.forEach((entry, index) => {
      const key = getCandidateKey(entry.candidate)
      if (!key) return
      const rank = index + 1
      const score = total > 1 ? clamp(100 - (index / (total - 1)) * 100, 0, 100) : 50
      scoreMap.set(key, score)
      rankMap.set(key, rank)
    })
  })

  return { scoreMap, rankMap }
}

function computeSignalScore(signalData) {
  if (!signalData) return 0
  const total = signalData.weightedTotal ?? signalData.total ?? 0
  if (!total) return 0
  return clamp((total / 5) * 100, 0, 100)
}

function computeSignalWeightMultiplier(summary) {
  if (!summary) return 1
  const count = parseNumber(summary.count)
  if (typeof count === "number" && count < config.minAccuracySignals) return 1
  const hitRate = parseNumber(summary.hitRate)
  if (typeof hitRate !== "number") return 1
  const normalized = hitRate / 50
  return clamp(normalized, 0.8, 1.25)
}

function computeBotWeight(summary) {
  if (!summary) return 1
  const count = parseNumber(summary.count)
  if (typeof count === "number" && count < config.minAccuracySignals) return 1
  const hitRate = parseNumber(summary.hitRate)
  if (typeof hitRate !== "number") return 1
  const normalized = hitRate / 50
  return clamp(normalized, 0.5, 1.5)
}

async function loadSignalPerformanceSummary(db, horizon) {
  try {
    const snap = await db.doc("analytics/signalPerformance").get()
    if (!snap.exists) return null
    const data = snap.data() || {}
    const summary = data?.overall?.[horizon] || null
    if (!summary) return null
    return {
      count: parseNumber(summary.count),
      hitRate: parseNumber(summary.hitRate),
      avgReturn: parseNumber(summary.avgReturn),
    }
  } catch (err) {
    console.error("Signal performance summary fetch failed", err.message)
    return null
  }
}

async function loadBotAccuracyWeights(db, horizon) {
  const weights = new Map()
  try {
    const botsSnap = await db.collection("bots").get()
    if (botsSnap.empty) return weights
    const refs = botsSnap.docs.map((doc) =>
      doc.ref.collection("analytics").doc("signalPerformance")
    )
    const snaps = await db.getAll(...refs)
    snaps.forEach((snap, index) => {
      if (!snap.exists) return
      const botId = botsSnap.docs[index]?.id
      if (!botId) return
      const summary = snap.data()?.overall?.[horizon]
      const weight = computeBotWeight(summary)
      if (weight !== 1) {
        weights.set(botId, Number(weight.toFixed(2)))
      }
    })
  } catch (err) {
    console.error("Bot accuracy weights fetch failed", err.message)
  }
  return weights
}

function resolveTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === "function") return value.toDate()
  return null
}

function applySignalDelta(weights, delta) {
  const base = {
    ...DEFAULT_TREND_WEIGHTS,
    ...(weights || {}),
  }
  if (!delta) {
    return { weights: base, delta: 0 }
  }
  const nextSignals = clamp(base.signals + delta, 0, 100)
  const actualDelta = nextSignals - base.signals
  let nextMomentum = base.momentum
  let nextVolume = base.volume
  const pool = nextMomentum + nextVolume
  const remainder = -actualDelta
  if (pool > 0) {
    nextMomentum = clamp(nextMomentum + (remainder * nextMomentum) / pool, 0, 100)
    nextVolume = clamp(nextVolume + (remainder * nextVolume) / pool, 0, 100)
  }
  return {
    weights: {
      momentum: Math.round(nextMomentum),
      volume: Math.round(nextVolume),
      signals: Math.round(nextSignals),
      news: Math.round(base.news),
    },
    delta: Math.round(actualDelta),
  }
}

function extractJsonObject(text) {
  if (!text) return null
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

async function requestAiSignalDelta(context) {
  if (!config.openaiKey) return null
  const maxDelta = Math.min(6, Math.max(1, Math.round(config.autoTuneMaxDelta / 2)))
  const body = {
    model: config.openaiModel,
    temperature: 0.2,
    max_tokens: 120,
    messages: [
      {
        role: "system",
        content:
          "You tune trend weights for a trading dashboard. Return JSON only.",
      },
      {
        role: "user",
        content: [
          "Suggest a small integer delta for the bot-signals weight.",
          `Constraints: delta between -${maxDelta} and ${maxDelta}.`,
          "If unsure, return 0.",
          "Return JSON: {\"signalDelta\": <int>, \"reason\": \"short reason\"}.",
          "",
          `Current weights: momentum ${context.weights.momentum}, volume ${context.weights.volume}, signals ${context.weights.signals}, news ${context.weights.news}.`,
          `Accuracy horizon: ${context.horizon}.`,
          `Hit rate: ${formatNumber(context.hitRate, 1)}% from ${context.count} signals.`,
          `Signal weight multiplier: ${formatNumber(context.signalWeight, 2)}.`,
        ].join("\n"),
      },
    ],
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI weight call failed: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ""
  const jsonText = extractJsonObject(content)
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText)
    const delta = parseNumber(parsed.signalDelta)
    if (!Number.isFinite(delta)) return null
    return {
      delta: clamp(Math.round(delta), -maxDelta, maxDelta),
      reason:
        typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 160) : "",
    }
  } catch {
    return null
  }
}

function maybeAutoTuneTrendWeights(controls, accuracySummary, accuracyHorizon) {
  if (!controls?.autoTuneEnabled) {
    return { tuned: false, weights: controls?.trendWeights }
  }
  const intervalHours = Number(controls.autoTuneIntervalHours || config.autoTuneIntervalHours)
  const lastAt = resolveTimestamp(controls.autoTuneLastAt)
  if (lastAt && intervalHours > 0) {
    const elapsedMs = Date.now() - lastAt.getTime()
    if (elapsedMs < intervalHours * 60 * 60 * 1000) {
      return { tuned: false, weights: controls.trendWeights }
    }
  }

  if (!accuracySummary || accuracySummary.count < config.minAccuracySignals) {
    return { tuned: false, weights: controls.trendWeights }
  }

  const hitRate = typeof accuracySummary.hitRate === "number" ? accuracySummary.hitRate : 50
  const baseWeights = {
    ...DEFAULT_TREND_WEIGHTS,
    ...(controls.trendWeights || {}),
  }
  const maxDelta = config.autoTuneMaxDelta || 0
  const normalized = clamp((hitRate - 50) / 50, -1, 1)
  const delta = clamp(normalized * maxDelta, -maxDelta, maxDelta)
  if (Math.abs(delta) < 0.5) {
    return { tuned: false, weights: baseWeights }
  }
  const applied = applySignalDelta(baseWeights, delta)

  const direction = applied.delta > 0 ? "increased" : "reduced"
  const note = `Auto-tune ${direction} bot signal weight by ${Math.round(
    Math.abs(applied.delta)
  )} using ${accuracyHorizon} accuracy (${formatNumber(hitRate, 1)}% hit rate from ${
    accuracySummary.count
  } signals).`

  return {
    tuned: true,
    weights: applied.weights,
    note,
    hitRate,
    count: accuracySummary.count,
    delta: Math.round(applied.delta),
  }
}

function computeTrendScore(weights, components) {
  const momentum = weights.momentum ?? 0
  const volume = weights.volume ?? 0
  const signals = weights.signals ?? 0
  const news = weights.news ?? 0
  const total = momentum + volume + signals + news
  if (total <= 0) return 0
  return (
    (components.momentum * momentum +
      components.volume * volume +
      components.signals * signals +
      (components.news || 0) * news) /
    total
  )
}

function buildTrending(candidates, signalMap, weights, newsScoreMap) {
  const byHorizon = {}
  TREND_HORIZONS.forEach((horizon) => {
    byHorizon[horizon] = { crypto: [], stock: [], forex: [] }
  })

  const effectiveWeights =
    newsScoreMap && newsScoreMap.size > 0
      ? weights
      : { ...weights, news: 0 }
  const { scoreMap, rankMap } = buildVolumeScores(candidates)

  candidates.forEach((candidate) => {
    const key = getCandidateKey(candidate)
    if (!key) return
    const signalData = signalMap.get(key) || null
    const signalScore = computeSignalScore(signalData)
    const volumeScore = scoreMap.get(key) ?? 0
    const volumeRank = rankMap.get(key)
    const newsData = newsScoreMap?.get(key) || null

    TREND_HORIZONS.forEach((horizon) => {
      const { change, window } = resolveMomentum(candidate, horizon)
      const scale = TREND_MOMENTUM_SCALES[horizon] || 1
      const momentumScore =
        change === undefined ? 0 : clamp(Math.abs(change) * scale, 0, 100)
      const components = {
        momentum: Number(momentumScore.toFixed(1)),
        volume: Number(volumeScore.toFixed(1)),
        signals: Number(signalScore.toFixed(1)),
        news: Number((newsData?.score ?? 0).toFixed(1)),
      }
      const score = computeTrendScore(effectiveWeights, components)

      const signals = signalData
        ? compactObject({
            total: signalData.total,
            buy: signalData.buy,
            sell: signalData.sell,
            strengthAvg: signalData.total
              ? Number((signalData.strengthSum / signalData.total).toFixed(2))
              : undefined,
            bots: Array.from(signalData.bots),
          })
        : undefined

      const momentum = compactObject({
        change15m: candidate.change15m,
        change1h: candidate.change1h,
        change24h: candidate.change24h,
        change7d: candidate.change7d,
        window,
      })

      const item = compactObject({
        assetClass: candidate.assetClass,
        symbol: candidate.symbol,
        name: candidate.name || candidate.symbol,
        price: candidate.price,
        horizon,
        score: Number(score.toFixed(2)),
        components,
        news: newsData
          ? {
              count: newsData.count,
              sentiment: newsData.sentiment,
              score: newsData.score,
            }
          : undefined,
        momentum,
        signals,
        volumeRank,
        source: candidate.source,
      })

      if (byHorizon[horizon]?.[candidate.assetClass]) {
        byHorizon[horizon][candidate.assetClass].push(item)
      }
    })
  })

  Object.entries(byHorizon).forEach(([, buckets]) => {
    Object.keys(buckets).forEach((assetClass) => {
      buckets[assetClass] = buckets[assetClass]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, config.trendLimit)
    })
  })

  return byHorizon
}

function pickTopCandidates(list, limit) {
  if (!Array.isArray(list) || list.length === 0) return []
  return [...list]
    .sort((a, b) => {
      const scoreA =
        typeof a.volume === "number"
          ? a.volume
          : a.liquidityRank
            ? 1 / a.liquidityRank
            : 0
      const scoreB =
        typeof b.volume === "number"
          ? b.volume
          : b.liquidityRank
            ? 1 / b.liquidityRank
            : 0
      return scoreB - scoreA
    })
    .slice(0, Math.max(limit, 0))
}

function normalizeMarketauxCryptoSymbol(symbol) {
  if (!symbol) return null
  let raw = String(symbol).toUpperCase().trim()
  if (raw.includes(":")) {
    raw = raw.split(":").pop()
  }
  raw = raw.replace(/[^A-Z0-9]/g, "")
  if (!raw) return null
  if (raw.endsWith("USDT") && raw.length > 4) {
    return raw.slice(0, -4)
  }
  if (raw.endsWith("USD") && raw.length > 3) {
    return raw.slice(0, -3)
  }
  return raw
}

function buildNewsSymbolLists(candidates, universe) {
  const cryptoCandidates = pickTopCandidates(
    candidates.filter((candidate) => candidate.assetClass === "crypto"),
    config.newsSymbolLimit
  )
  const stockCandidates = pickTopCandidates(
    candidates.filter((candidate) => candidate.assetClass === "stock"),
    config.newsSymbolLimit
  )

  const universeCrypto = uniqueList(
    Array.isArray(universe?.crypto?.symbols)
      ? universe.crypto.symbols.map(normalizeSymbol).filter(Boolean)
      : []
  )
  const universeStocks = uniqueList(
    Array.isArray(universe?.stocks?.symbols)
      ? universe.stocks.symbols.map(normalizeTicker).filter(Boolean)
      : []
  )

  const cryptoBaseMap = new Map()
  const addCryptoPair = (pair) => {
    const normalized = normalizeSymbol(pair)
    if (!normalized || !normalized.includes("/")) return
    const base = normalized.split("/")[0]
    if (!base || cryptoBaseMap.has(base)) return
    cryptoBaseMap.set(base, normalized)
  }

  universeCrypto.forEach(addCryptoPair)
  cryptoCandidates.forEach((candidate) => addCryptoPair(candidate.symbol))

  const cryptoSymbolList = Array.from(cryptoBaseMap.keys())
    .map((base) => `${base}USD`)
    .filter(Boolean)
  const cryptoLimit =
    config.newsSymbolLimit > 0
      ? Math.max(config.newsSymbolLimit, universeCrypto.length)
      : cryptoSymbolList.length
  const cryptoSymbols = cryptoSymbolList.slice(0, cryptoLimit)

  const stockSymbolList = uniqueList([
    ...universeStocks,
    ...stockCandidates.map((candidate) => normalizeTicker(candidate.symbol)).filter(Boolean),
  ])
  const stockLimit =
    config.newsSymbolLimit > 0
      ? Math.max(config.newsSymbolLimit, universeStocks.length)
      : stockSymbolList.length
  const stockSymbols = stockSymbolList.slice(0, stockLimit)

  return { cryptoSymbols, stockSymbols, cryptoBaseMap }
}

async function fetchMarketauxNews(symbols, entityTypes) {
  if (!config.marketauxKey || !symbols || symbols.length === 0) return []
  const url = new URL(MARKETAUX_BASE_URL)
  url.search = new URLSearchParams({
    api_token: config.marketauxKey,
    symbols: symbols.join(","),
    filter_entities: "true",
    language: "en",
    limit: String(config.newsLimit),
    entity_types: entityTypes,
  }).toString()

  try {
    const data = await fetchJson(url.toString())
    return Array.isArray(data?.data) ? data.data : []
  } catch (err) {
    console.error("Marketaux fetch failed", err.message)
    return []
  }
}

function buildNewsSummary(articles, stockSymbols, cryptoBaseMap) {
  const stockSet = new Set(stockSymbols.map((symbol) => normalizeTicker(symbol)))
  const buckets = new Map()

  articles.forEach((article) => {
    const entities = Array.isArray(article.entities) ? article.entities : []
    entities.forEach((entity) => {
      const type = String(entity?.type || "").toLowerCase()
      const rawSymbol = String(entity?.symbol || "")
      const sentiment = parseNumber(entity?.sentiment_score)
      let assetClass = null
      let symbol = null

      if (type === "equity" || type === "etf") {
        const ticker = normalizeTicker(rawSymbol)
        if (!ticker || !stockSet.has(ticker)) return
        assetClass = "stock"
        symbol = ticker
      } else if (type === "cryptocurrency") {
        const base = normalizeMarketauxCryptoSymbol(rawSymbol)
        if (!base) return
        const matched = cryptoBaseMap.get(base)
        if (!matched) return
        assetClass = "crypto"
        symbol = matched
      } else {
        return
      }

      const key = `${assetClass}:${symbol}`
      if (!buckets.has(key)) {
        buckets.set(key, {
          assetClass,
          symbol,
          count: 0,
          sentimentSum: 0,
          sentimentCount: 0,
          headlines: [],
        })
      }
      const bucket = buckets.get(key)
      bucket.count += 1
      if (sentiment !== null && sentiment !== undefined) {
        bucket.sentimentSum += sentiment
        bucket.sentimentCount += 1
      }
      if (bucket.headlines.length < 3 && article.title && article.url) {
        bucket.headlines.push({
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.published_at,
        })
      }
    })
  })

  const items = Array.from(buckets.values())
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0)
  const scoreMap = new Map()

  items.forEach((item) => {
    const sentimentAvg =
      item.sentimentCount > 0 ? item.sentimentSum / item.sentimentCount : 0
    const volumeScore = maxCount > 0 ? (item.count / maxCount) * 100 : 0
    const sentimentScore = clamp(Math.abs(sentimentAvg) * 100, 0, 100)
    const score = clamp(volumeScore * 0.7 + sentimentScore * 0.3, 0, 100)
    const summary = {
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: Number(sentimentAvg.toFixed(2)),
      score: Number(score.toFixed(1)),
      headlines: item.headlines,
    }
    const key = getAssetKey(item.assetClass, item.symbol)
    if (key) scoreMap.set(key, summary)
    Object.assign(item, summary)
  })

  return {
    items: items.map((item) => ({
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: item.sentiment,
      score: item.score,
      headlines: item.headlines,
    })),
    scoreMap,
  }
}

function mapNewsItems(items) {
  const map = new Map()
  if (!Array.isArray(items)) return map
  items.forEach((item) => {
    const key = getAssetKey(item.assetClass, item.symbol)
    if (!key) return
    map.set(key, {
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: item.sentiment,
      score: item.score,
    })
  })
  return map
}

async function loadNewsData(db, candidates, controls, universe, runId) {
  if (!controls.enableNews || !config.marketauxKey) {
    return { scoreMap: new Map(), updatedAt: null }
  }

  const ref = db.doc("market/news")
  const snap = await ref.get()
  const cached = snap.exists ? snap.data() : null
  const lastUpdated = cached?.updatedAt?.toDate?.() || null
  const intervalMs = (controls.newsIntervalMinutes || config.newsIntervalMinutes) * 60 * 1000
  const shouldFetch = !lastUpdated || Date.now() - lastUpdated.getTime() >= intervalMs

  if (!shouldFetch && cached?.items) {
    return { scoreMap: mapNewsItems(cached.items), updatedAt: cached.updatedAt }
  }

  const { cryptoSymbols, stockSymbols, cryptoBaseMap } = buildNewsSymbolLists(
    candidates,
    universe
  )
  const [stockNews, cryptoNews] = await Promise.all([
    fetchMarketauxNews(stockSymbols, "equity"),
    fetchMarketauxNews(cryptoSymbols, "cryptocurrency"),
  ])

  const { items, scoreMap } = buildNewsSummary(
    [...stockNews, ...cryptoNews],
    stockSymbols,
    cryptoBaseMap
  )

  await ref.set(
    {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      items,
      meta: {
        runId,
        symbols: items.length,
        intervalMinutes: controls.newsIntervalMinutes || config.newsIntervalMinutes,
        source: "marketaux",
      },
    },
    { merge: true }
  )

  return { scoreMap, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
}

function resolveTrendMomentum(item, horizon) {
  const momentum = item?.momentum || {}
  if (horizon === "15m" && typeof momentum.change15m === "number") {
    return { change: momentum.change15m, window: "15m" }
  }
  if (horizon === "1h" && typeof momentum.change1h === "number") {
    return { change: momentum.change1h, window: "1h" }
  }
  if (horizon === "24h" && typeof momentum.change24h === "number") {
    return { change: momentum.change24h, window: "24h" }
  }
  if (horizon === "7d" && typeof momentum.change7d === "number") {
    return { change: momentum.change7d, window: "7d" }
  }
  if (typeof momentum.change24h === "number") {
    return { change: momentum.change24h, window: "24h" }
  }
  if (typeof momentum.change1h === "number") {
    return { change: momentum.change1h, window: "1h" }
  }
  if (typeof momentum.change7d === "number") {
    return { change: momentum.change7d, window: "7d" }
  }
  if (typeof momentum.change15m === "number") {
    return { change: momentum.change15m, window: "15m" }
  }
  return { change: null, window: horizon }
}

function formatChangeLabel(change) {
  if (typeof change !== "number") return "flat"
  const sign = change >= 0 ? "+" : ""
  return `${sign}${change.toFixed(2)}%`
}

function getSignalCreatedAt() {
  if (!config.signalBackfillMinutes || config.signalBackfillMinutes <= 0) {
    return { createdAt: admin.firestore.FieldValue.serverTimestamp(), backfillMinutes: 0 }
  }
  const createdAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - config.signalBackfillMinutes * 60 * 1000)
  )
  return { createdAt, backfillMinutes: config.signalBackfillMinutes }
}

async function ensureMarketIntelBot(db) {
  const ref = db.doc(`bots/${MARKET_SIGNAL_BOT_ID}`)
  await ref.set(
    {
      name: "Market Intel",
      engine: "market-intel",
      status: "online",
      lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      capabilities: { modes: ["signal"] },
    },
    { merge: true }
  )
}

async function emitMarketSignals(db, trendingByHorizon, controls) {
  if (!config.emitSignals) return
  const signalLimit = Number.isFinite(config.signalLimit)
    ? Math.max(0, Math.min(config.signalLimit, 10))
    : 0
  if (!signalLimit) return

  const horizon = VALID_TREND_HORIZONS.has(controls.trendHorizon)
    ? controls.trendHorizon
    : "15m"
  const buckets = trendingByHorizon?.[horizon] || {}
  const picks = []

  ;["crypto", "stock", "forex"].forEach((assetClass) => {
    const list = Array.isArray(buckets[assetClass]) ? buckets[assetClass] : []
    list.slice(0, signalLimit).forEach((item) => {
      if (!item?.symbol) return
      picks.push({ assetClass, item })
    })
  })

  if (picks.length === 0) return

  await ensureMarketIntelBot(db)
  const { createdAt, backfillMinutes } = getSignalCreatedAt()
  const batch = db.batch()

  picks.forEach(({ assetClass, item }) => {
    const momentum = resolveTrendMomentum(item, horizon)
    const side =
      typeof momentum.change === "number" ? (momentum.change >= 0 ? "buy" : "sell") : "hold"
    const strength =
      typeof item.score === "number"
        ? Number(clamp(item.score / 100, 0, 1).toFixed(2))
        : undefined
    const message = `${item.symbol} ${assetClass} trend ${momentum.window} ${formatChangeLabel(
      momentum.change
    )}`

    const referenceCapturedAt =
      typeof item.price === "number" ? admin.firestore.FieldValue.serverTimestamp() : undefined
    const data = compactObject({
      assetClass,
      horizon,
      trendWindow: momentum.window,
      score: item.score,
      components: item.components,
      momentum: item.momentum,
      referencePrice: typeof item.price === "number" ? item.price : undefined,
      referenceSource: item.source,
      referenceCapturedAt,
      source: "market-intel",
      backfillMinutes: backfillMinutes > 0 ? backfillMinutes : undefined,
    })

    const ref = db
      .collection("bots")
      .doc(MARKET_SIGNAL_BOT_ID)
      .collection("signals")
      .doc()

    batch.set(
      ref,
      compactObject({
        symbol: item.symbol,
        side,
        strength,
        message,
        data,
        createdAt,
      })
    )
  })

  await batch.commit()
}

async function fetchBotSignals(db, botWeights = new Map()) {
  const lookbackMs = config.signalLookbackMinutes * 60 * 1000
  const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - lookbackMs))

  const snap = await db
    .collectionGroup("signals")
    .where("createdAt", ">=", cutoff)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get()

  const map = new Map()

  snap.docs.forEach((doc) => {
    const data = doc.data() || {}
    const botId = doc.ref.parent.parent?.id || "unknown"
    const symbol = extractSymbolFromSignal(data)
    if (!symbol) return

    const entry = map.get(symbol) || {
      symbol,
      total: 0,
      buy: 0,
      sell: 0,
      strengthSum: 0,
      weightedTotal: 0,
      weightedBuy: 0,
      weightedSell: 0,
      weightedStrengthSum: 0,
      latestAt: null,
      bots: new Set(),
    }

    const weight = botWeights.get(botId) ?? 1
    entry.total += 1
    if (data.side === "buy") entry.buy += 1
    if (data.side === "sell") entry.sell += 1
    if (typeof data.strength === "number") entry.strengthSum += data.strength

    entry.weightedTotal += weight
    if (data.side === "buy") entry.weightedBuy += weight
    if (data.side === "sell") entry.weightedSell += weight
    if (typeof data.strength === "number") {
      entry.weightedStrengthSum += data.strength * weight
    }
    if (data.createdAt) {
      const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : null
      if (createdAt && (!entry.latestAt || createdAt > entry.latestAt)) {
        entry.latestAt = createdAt
      }
    }
    entry.bots.add(botId)

    map.set(symbol, entry)
  })

  return map
}

function resolveTradeSide(candidate, signalData) {
  if (signalData && (signalData.total > 0 || signalData.weightedTotal > 0)) {
    const buy = signalData.weightedBuy ?? signalData.buy ?? 0
    const sell = signalData.weightedSell ?? signalData.sell ?? 0
    return buy >= sell ? "buy" : "sell"
  }
  if (candidate.sideHint) return candidate.sideHint
  const change =
    parseNumber(candidate.change24h) ??
    parseNumber(candidate.change1h) ??
    parseNumber(candidate.change7d)
  if (change === undefined || change === null) return "buy"
  return change >= 0 ? "buy" : "sell"
}

function scoreTrade(candidate, signalData, side, weights = {}) {
  const rawChange24h = parseNumber(candidate.change24h) || 0
  const rawChange1h = parseNumber(candidate.change1h) || 0
  const direction = side === "sell" ? -1 : 1
  const change24h = rawChange24h * direction
  const change1h = rawChange1h * direction
  const momentumScore = clamp(Math.max(0, change24h) * 1.5, 0, 40)
  const shortMomentumScore = clamp(Math.max(0, change1h) * 2, 0, 10)

  let consensusScore = 0
  let strengthScore = 0
  let recencyScore = 0
  let confidence = 0
  const signalWeight = typeof weights.signalWeight === "number" ? weights.signalWeight : 1

  if (signalData && (signalData.total > 0 || signalData.weightedTotal > 0)) {
    const totalWeight = signalData.weightedTotal ?? signalData.total ?? 0
    const buyWeight = signalData.weightedBuy ?? signalData.buy ?? 0
    const sellWeight = signalData.weightedSell ?? signalData.sell ?? 0
    const bias = totalWeight ? (buyWeight - sellWeight) / totalWeight : 0
    const consensusCap = 30 * signalWeight
    consensusScore = clamp(bias * 30 * signalWeight, -consensusCap, consensusCap)

    const strengthSum =
      signalData.weightedStrengthSum ?? signalData.strengthSum ?? 0
    const avgStrength = totalWeight ? strengthSum / totalWeight : 0
    const strengthCap = 20 * signalWeight
    strengthScore = clamp(avgStrength * 20 * signalWeight, 0, strengthCap)

    if (signalData.latestAt) {
      const ageMinutes = (Date.now() - signalData.latestAt.getTime()) / 60000
      const recencyCap = 10 * signalWeight
      recencyScore = clamp(
        ((config.signalLookbackMinutes - ageMinutes) / config.signalLookbackMinutes) *
          10 *
          signalWeight,
        0,
        recencyCap
      )
    }

    confidence = clamp(totalWeight / 5, 0, 1)
  }

  const liquidityScore = candidate.liquidityRank
    ? clamp(10 - candidate.liquidityRank / 5, 0, 10)
    : 0
  const watchlistScore = candidate.watchlisted ? 8 : 0
  const primaryScore = candidate.primary ? 12 : 0

  const base = 20
  const score = clamp(
    base +
      momentumScore +
      shortMomentumScore +
      consensusScore +
      strengthScore +
      recencyScore +
      liquidityScore +
      watchlistScore +
      primaryScore,
    0,
    100
  )

  return {
    score,
    confidence,
    momentumScore,
    shortMomentumScore,
    consensusScore,
    strengthScore,
    recencyScore,
    liquidityScore,
    watchlistScore,
    primaryScore,
  }
}

function buildRationale(candidate, signalData, scoreDetail) {
  const parts = []

  if (signalData && signalData.total > 0) {
    parts.push(`${signalData.buy}/${signalData.total} bots signal buy`)
  }

  if (typeof candidate.change24h === "number") {
    const direction = candidate.change24h >= 0 ? "+" : ""
    parts.push(`24h move ${direction}${candidate.change24h.toFixed(2)}%`)
  }

  if (candidate.volume) {
    parts.push("liquidity strong")
  }

  if (candidate.watchlisted) {
    parts.push("in your universe")
  }

  if (candidate.primary) {
    parts.push("primary focus")
  }

  if (scoreDetail.score > 70) {
    parts.push("high momentum")
  }

  return parts.join(" • ")
}

async function enrichWithOpenAI(items) {
  if (!config.openaiKey || items.length === 0) return null

  const payload = items.map((item) => ({
    symbol: item.symbol,
    assetClass: item.assetClass,
    side: item.side,
    score: item.score,
    change24h: item.momentum?.change24h,
    signals: item.signals?.total || 0,
  }))

  const prompt = [
    "Summarize why each trade is hot in 1 short sentence.",
    "Avoid financial advice language.",
    "Return a JSON object with an 'items' array of { symbol, rationale }.",
    `Items: ${JSON.stringify(payload)}`,
  ].join("\n")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a trading ops assistant." },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) return null

  try {
    const parsed = JSON.parse(content)
    const list = Array.isArray(parsed) ? parsed : parsed.items || parsed.rationales
    if (!Array.isArray(list)) return null
    const map = new Map()
    list.forEach((item) => {
      if (item?.symbol && item?.rationale) {
        map.set(String(item.symbol).toUpperCase(), String(item.rationale))
      }
    })
    return map
  } catch (err) {
    return null
  }
}

function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

function markPrimary(candidates, primarySets) {
  return candidates.map((candidate) => {
    let primary = false
    if (candidate.assetClass === "stock") {
      const key = normalizeTicker(candidate.symbol)
      primary = key ? primarySets.stocks.has(key) : false
    } else if (candidate.assetClass === "forex") {
      const key = normalizeSymbol(candidate.symbol)
      primary = key ? primarySets.forex.has(key) : false
    } else {
      const key = normalizeSymbol(candidate.symbol)
      primary = key ? primarySets.crypto.has(key) : false
    }

    return { ...candidate, primary }
  })
}

function buildHotTrades(candidates, signalMap, scoreWeights) {
  const scored = candidates.map((candidate) => {
    const symbolKey = getCandidateKey(candidate)
    const signalData = symbolKey ? signalMap.get(symbolKey) : null
    const side = resolveTradeSide(candidate, signalData)
    const scoreDetail = scoreTrade(candidate, signalData, side, scoreWeights)
    const scoreComponents = {
      base: 20,
      momentum: Number(scoreDetail.momentumScore.toFixed(2)),
      shortMomentum: Number(scoreDetail.shortMomentumScore.toFixed(2)),
      consensus: Number(scoreDetail.consensusScore.toFixed(2)),
      strength: Number(scoreDetail.strengthScore.toFixed(2)),
      recency: Number(scoreDetail.recencyScore.toFixed(2)),
      liquidity: Number(scoreDetail.liquidityScore.toFixed(2)),
      watchlist: Number(scoreDetail.watchlistScore.toFixed(2)),
      primary: Number(scoreDetail.primaryScore.toFixed(2)),
    }

    const signals = signalData
      ? compactObject({
          total: signalData.total,
          buy: signalData.buy,
          sell: signalData.sell,
          strengthAvg: signalData.total
            ? Number((signalData.strengthSum / signalData.total).toFixed(2))
            : undefined,
          bots: Array.from(signalData.bots),
        })
      : undefined

    const momentum = compactObject({
      change1h: candidate.change1h,
      change24h: candidate.change24h,
      change7d: candidate.change7d,
    })

    return compactObject({
      assetClass: candidate.assetClass,
      symbol: candidate.symbol,
      name: candidate.name || candidate.symbol,
      exchange: candidate.exchange,
      price: typeof candidate.price === "number" ? Number(candidate.price) : undefined,
      timeframe: candidate.assetClass === "crypto" ? "1h" : "1d",
      side,
      score: Number(scoreDetail.score.toFixed(2)),
      confidence: Number(scoreDetail.confidence.toFixed(2)),
      scoreComponents,
      primary: candidate.primary ? true : undefined,
      momentum: Object.keys(momentum).length ? momentum : undefined,
      signals,
      source: candidate.source,
      rationale: buildRationale(candidate, signalData, scoreDetail),
    })
  })

  return scored.sort((a, b) => (b.score || 0) - (a.score || 0))
}

function buildActionBoard(hotTrades, newsScoreMap, limit) {
  const cap = Number.isFinite(limit) ? Math.max(1, limit) : 10
  const newsWeight = 0.15

  const scoreTradeForAction = (trade) => {
    const base = typeof trade.score === "number" ? trade.score : 0
    const key = getAssetKey(trade.assetClass, trade.symbol)
    const newsScore = key ? newsScoreMap?.get(key)?.score : null
    const boost = typeof newsScore === "number" ? newsScore * newsWeight : 0
    return base + boost
  }

  const rankList = (list) =>
    [...list].sort((a, b) => scoreTradeForAction(b) - scoreTradeForAction(a))

  const buildPerClass = (list) => {
    const buckets = { crypto: [], stock: [], forex: [] }
    list.forEach((item) => {
      if (buckets[item.assetClass]) buckets[item.assetClass].push(item)
    })

    return {
      crypto: rankList(buckets.crypto).slice(0, cap),
      stock: rankList(buckets.stock).slice(0, cap),
      forex: rankList(buckets.forex).slice(0, cap),
    }
  }

  const buyList = hotTrades.filter((trade) => trade.side === "buy")
  const sellList = hotTrades.filter((trade) => trade.side === "sell")

  const buys = rankList(buyList).slice(0, cap)
  const sells = rankList(sellList).slice(0, cap)
  const byAsset = {
    buys: buildPerClass(buyList),
    sells: buildPerClass(sellList),
  }

  const allPicks = [
    ...byAsset.buys.crypto,
    ...byAsset.buys.stock,
    ...byAsset.buys.forex,
    ...byAsset.sells.crypto,
    ...byAsset.sells.stock,
    ...byAsset.sells.forex,
  ]

  return { buys, sells, byAsset, allPicks, newsWeight, classLimit: cap }
}

function buildTrendLookup(byHorizon, horizon) {
  const resolved = TREND_HORIZONS.includes(horizon) ? horizon : TREND_HORIZONS[0]
  const buckets = byHorizon?.[resolved] || {}
  const lookup = new Map()
  Object.values(buckets).forEach((list) => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      const key = getAssetKey(item.assetClass, item.symbol)
      if (key) lookup.set(key, item)
    })
  })
  return { lookup, horizon: resolved }
}

function formatNumber(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  return value.toFixed(digits)
}

function formatSignedPercent(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}%`
}

function formatAiSnippet(text, max = 90) {
  if (!text) return "note unavailable"
  const cleaned = String(text).replace(/\s+/g, " ").trim()
  if (!cleaned) return "note unavailable"
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 3)}...`
}

function joinList(items) {
  const list = items.filter(Boolean)
  if (list.length === 0) return ""
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`
}

function describeComponentStrength(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  if (value >= 70) return "strong"
  if (value >= 40) return "moderate"
  if (value >= 15) return "light"
  if (value > 0) return "weak"
  return "none"
}

function buildScoreDriversLine(components) {
  if (!components) return null
  const entries = [
    { key: "momentum", label: "momentum", value: components.momentum },
    { key: "shortMomentum", label: "short-term momentum", value: components.shortMomentum },
    { key: "consensus", label: "bot consensus", value: components.consensus },
    { key: "strength", label: "signal strength", value: components.strength },
    { key: "recency", label: "signal recency", value: components.recency },
    { key: "liquidity", label: "liquidity", value: components.liquidity },
    { key: "watchlist", label: "watchlist boost", value: components.watchlist },
    { key: "primary", label: "primary focus", value: components.primary },
  ]
  const drivers = entries
    .filter((entry) => typeof entry.value === "number" && entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((entry) => entry.label)
  if (drivers.length === 0) return "Score is mostly baseline."
  return `Top drivers: ${joinList(drivers)}.`
}

function describeConfidence(confidence, totalSignals) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return null
  const pct = Math.round(confidence * 100)
  const label = pct >= 70 ? "high" : pct >= 40 ? "medium" : "low"
  const basis =
    typeof totalSignals === "number" && totalSignals > 0
      ? ` based on ${totalSignals} recent signals`
      : ""
  return `Confidence: ${label} (${pct}%)${basis}.`
}

function buildScoreBreakdown(components, totalScore) {
  if (!components || typeof totalScore !== "number") return null
  const parts = []
  if (typeof components.base === "number") {
    parts.push(`base ${formatNumber(components.base, 0)}`)
  }
  if (typeof components.momentum === "number") {
    parts.push(`momentum ${formatNumber(components.momentum, 1)}`)
  }
  if (typeof components.shortMomentum === "number") {
    parts.push(`1h momentum ${formatNumber(components.shortMomentum, 1)}`)
  }
  if (typeof components.consensus === "number") {
    parts.push(`consensus ${formatNumber(components.consensus, 1)}`)
  }
  if (typeof components.strength === "number") {
    parts.push(`strength ${formatNumber(components.strength, 1)}`)
  }
  if (typeof components.recency === "number") {
    parts.push(`recency ${formatNumber(components.recency, 1)}`)
  }
  if (typeof components.liquidity === "number") {
    parts.push(`liquidity ${formatNumber(components.liquidity, 1)}`)
  }
  if (typeof components.watchlist === "number") {
    parts.push(`watchlist ${formatNumber(components.watchlist, 1)}`)
  }
  if (typeof components.primary === "number") {
    parts.push(`primary ${formatNumber(components.primary, 1)}`)
  }
  if (!parts.length) return null
  return `Score model: ${parts.join(" + ")} = ${formatNumber(totalScore, 1)}.`
}

function buildTradeAnalysis(trade, trendItem, newsItem, options) {
  const details = []
  const summaryBits = []
  const sideLabel = trade.side ? trade.side.toUpperCase() : "TRADE"

  if (typeof trade.momentum?.change24h === "number") {
    summaryBits.push(`24h move ${formatSignedPercent(trade.momentum.change24h)}`)
  }
  if (trade.signals?.total) {
    const buy = trade.signals.buy ?? 0
    const sell = trade.signals.sell ?? 0
    summaryBits.push(`bots ${buy} buy / ${sell} sell`)
  }
  if (typeof trendItem?.score === "number") {
    summaryBits.push(`trend ${formatNumber(trendItem.score, 0)}/100`)
  }
  if (typeof newsItem?.sentiment === "number") {
    summaryBits.push(`news sentiment ${formatNumber(newsItem.sentiment, 2)}`)
  }

  const summary =
    summaryBits.length > 0
      ? `${sideLabel} signal · ${summaryBits.join(" · ")}.`
      : `${sideLabel} signal.`

  if (typeof trade.score === "number") {
    details.push(`Overall score: ${formatNumber(trade.score, 1)}/100.`)
    const trendSummary = trendItem
      ? `${formatNumber(trendItem.score, 0)}/100 (${options.trendHorizon})`
      : "n/a"
    const botsSummary = trade.signals?.total
      ? `${trade.signals.buy ?? 0} buy / ${trade.signals.sell ?? 0} sell`
      : "no recent signals"
    const sentimentSummary =
      typeof newsItem?.sentiment === "number"
        ? formatNumber(newsItem.sentiment, 2)
        : "n/a"
    const aiSummary = formatAiSnippet(options.aiSummary)
    details.push(
      `Score summary: trend ${trendSummary}, bots ${botsSummary}, sentiment ${sentimentSummary}, AI ${aiSummary}.`
    )
  }
  const driversLine = buildScoreDriversLine(trade.scoreComponents)
  if (driversLine) details.push(driversLine)

  const momentumParts = []
  if (typeof trade.momentum?.change24h === "number") {
    momentumParts.push(`24h ${formatSignedPercent(trade.momentum.change24h)}`)
  }
  if (typeof trade.momentum?.change1h === "number") {
    momentumParts.push(`1h ${formatSignedPercent(trade.momentum.change1h)}`)
  }
  if (typeof trade.momentum?.change7d === "number") {
    momentumParts.push(`7d ${formatSignedPercent(trade.momentum.change7d)}`)
  }
  if (momentumParts.length) {
    details.push(`Market move: ${momentumParts.join(", ")}.`)
  } else {
    details.push("Market move: not available.")
  }

  if (trade.signals?.total) {
    const totalSignals = trade.signals.total
    const buy = trade.signals.buy ?? 0
    const sell = trade.signals.sell ?? 0
    const bias =
      buy === sell ? "mixed" : buy > sell ? "leaning buy" : "leaning sell"
    const strength =
      typeof trade.signals.strengthAvg === "number"
        ? ` Avg strength ${formatNumber(trade.signals.strengthAvg, 2)}.`
        : ""
    details.push(
      `Bots: ${totalSignals} recent signals (${buy} buy, ${sell} sell), ${bias}.${strength}`
    )
  } else {
    details.push(`Bots: no signals in the last ${options.signalLookbackMinutes} minutes.`)
  }

  if (
    options.accuracySummary?.hitRate !== undefined &&
    options.accuracySummary?.count >= options.minAccuracySignals
  ) {
    details.push(
      `Bot consensus is weighted by recent ${options.accuracyHorizon} accuracy (${formatNumber(
        options.accuracySummary.hitRate,
        1
      )}% hit rate).`
    )
  }

  const confidenceLine = describeConfidence(trade.confidence, trade.signals?.total)
  if (confidenceLine) details.push(confidenceLine)

  if (trendItem) {
    const components = trendItem.components || {}
    details.push(
      `Trend check (${options.trendHorizon}): ${formatNumber(trendItem.score, 1)}/100.`
    )
    details.push(
      `Trend drivers: momentum ${describeComponentStrength(
        components.momentum
      )}, volume ${describeComponentStrength(
        components.volume
      )}, bot signals ${describeComponentStrength(
        components.signals
      )}, and news ${describeComponentStrength(components.news)}.`
    )
  } else {
    details.push(`Trend check (${options.trendHorizon}): no data yet.`)
  }

  if (newsItem) {
    details.push(
      `News sentiment: ${formatNumber(newsItem.sentiment, 2)} from ${newsItem.count ?? 0} headlines.`
    )
  } else {
    details.push("News sentiment: no recent headlines, so no sentiment boost.")
  }

  if (options.aiSummary) {
    details.push(`AI note: ${formatAiSnippet(options.aiSummary, 140)}`)
  }

  return { summary, details }
}

function attachTradeAnalysis(trade, context) {
  if (!trade) return trade
  const key = getAssetKey(trade.assetClass, trade.symbol)
  const trendItem = key ? context.trendLookup.get(key) : null
  const newsItem = key ? context.newsScoreMap.get(key) : null
  const symbolKey = trade.symbol ? String(trade.symbol).toUpperCase() : null
  const aiSummary =
    (symbolKey && context.llmMap?.get(symbolKey)) ||
    (symbolKey && context.fallbackMap?.get(symbolKey)) ||
    trade.rationale ||
    null
  const analysis = buildTradeAnalysis(trade, trendItem, newsItem, {
    trendHorizon: context.trendHorizon,
    trendWeights: context.trendWeights,
    newsWeight: context.newsWeight,
    signalLookbackMinutes: context.signalLookbackMinutes,
    aiSummary,
  })
  const trend = trendItem
    ? {
        horizon: trendItem.horizon || context.trendHorizon,
        score: trendItem.score,
        components: trendItem.components,
        momentum: trendItem.momentum,
      }
    : undefined
  const news = newsItem
    ? {
        count: newsItem.count,
        sentiment: newsItem.sentiment,
        score: newsItem.score,
      }
    : undefined
  const enriched = { ...trade, analysis }
  if (trend) enriched.trend = compactObject(trend)
  if (news) enriched.news = compactObject(news)
  return enriched
}

function annotateTrades(list, context) {
  if (!Array.isArray(list)) return []
  return list.map((trade) => attachTradeAnalysis(trade, context))
}

function annotateBuckets(buckets, context) {
  if (!buckets) return {}
  return {
    crypto: annotateTrades(buckets.crypto, context),
    stock: annotateTrades(buckets.stock, context),
    forex: annotateTrades(buckets.forex, context),
  }
}

function buildPopularList(scored, perClass) {
  const buckets = {
    crypto: [],
    stock: [],
    forex: [],
  }

  scored.forEach((item) => {
    if (buckets[item.assetClass]) {
      buckets[item.assetClass].push(item)
    }
  })

  const items = []

  Object.entries(buckets).forEach(([assetClass, list]) => {
    list
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, perClass)
      .forEach((item) => {
        items.push({
          assetClass,
          symbol: item.symbol,
          name: item.name,
          score: item.score,
          source: item.source,
          rationale: item.rationale,
        })
      })
  })

  return items
}

function buildPriceSnapshot(candidates) {
  const map = new Map()
  candidates.forEach((candidate) => {
    if (!candidate?.symbol || typeof candidate.price !== "number") return
    const key = `${candidate.assetClass}:${candidate.symbol}`
    if (map.has(key)) return
    map.set(key, {
      assetClass: candidate.assetClass,
      symbol: candidate.symbol,
      price: Number(candidate.price),
      source: candidate.source,
    })
  })
  return Array.from(map.values())
}

async function dispatchSignalRequests(db, picks, controls) {
  const intervalMs = Math.max(config.signalRequestIntervalMinutes, 0) * 60 * 1000
  const metaRef = db.doc("market/orchestrator")
  const metaSnap = await metaRef.get()
  const lastDispatch = metaSnap.data()?.lastDispatchAt?.toDate?.()

  if (intervalMs > 0 && lastDispatch) {
    const elapsed = Date.now() - lastDispatch.getTime()
    if (elapsed < intervalMs) return
  }

  const symbols = uniqueList(
    picks
      .map((item) => normalizeSymbol(item.symbol))
      .filter(Boolean)
  )
  if (symbols.length === 0) return

  const botsSnap = await db.collection("bots").get()
  const batch = db.batch()

  botsSnap.docs.forEach((doc) => {
    const botId = doc.id
    if (botId === MARKET_SIGNAL_BOT_ID) return
    const commandRef = db.collection("bots").doc(botId).collection("commands").doc()
    batch.set(commandRef, {
      type: "scan",
      status: "queued",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      requestedBy: "market-intel",
      payload: {
        symbols,
        horizon: controls?.trendHorizon || "15m",
      },
    })
  })

  batch.set(
    metaRef,
    {
      lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      symbolCount: symbols.length,
      symbols,
    },
    { merge: true }
  )

  await batch.commit()
}

async function safeFetch(fetcher) {
  try {
    const items = await fetcher()
    return { items, error: null }
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : String(err || "fetch failed"),
    }
  }
}

function formatFetchError(error) {
  if (!error) return null
  const message = String(error).trim()
  if (!message) return null
  return message.length > 180 ? `${message.slice(0, 177)}...` : message
}

function buildFetchStatus({ items, error, preferences, listKey, source }) {
  const includeTrending = preferences?.includeTrending !== false
  const list = Array.isArray(preferences?.[listKey]) ? preferences[listKey] : []
  const count = Array.isArray(items) ? items.length : 0
  if (error) {
    return {
      status: "error",
      count,
      error: formatFetchError(error),
      source,
    }
  }
  if (!includeTrending && list.length === 0) {
    return {
      status: "disabled",
      count,
      source,
      error: null,
    }
  }
  if (count === 0) {
    return {
      status: "empty",
      count,
      source,
      error: null,
    }
  }
  return {
    status: "ok",
    count,
    source,
    error: null,
  }
}

async function run() {
  const db = initAdmin()
  const startedAt = new Date()
  const runId = `${startedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`

  console.log("Market intel run started", { startedAt: startedAt.toISOString(), runId })

  await refreshStockSymbolCache(db).catch((err) => {
    console.error("Stock symbol cache refresh failed", err.message)
  })

  const [universe, controls] = await Promise.all([
    readUniverse(db).catch((err) => {
      console.error("Universe fetch failed", err.message)
      return {
        crypto: { includeTrending: true, symbols: [] },
        stocks: { includeTrending: true, symbols: [] },
        forex: { includeTrending: true, pairs: [] },
      }
    }),
    readControls(db).catch((err) => {
      console.error("Controls fetch failed", err.message)
      return {
        enableLLM: true,
        llmIntervalMinutes: config.llmIntervalMinutes,
        enableNews: true,
        newsIntervalMinutes: config.newsIntervalMinutes,
        dipHorizon: "24h",
        trendHorizon: "15m",
        trendWeights: { ...DEFAULT_TREND_WEIGHTS },
        riskProfile: "balanced",
        assetFocus: ["crypto", "stock", "forex"],
        primaryAssets: { crypto: [], stocks: [], forex: [] },
        autoTuneEnabled: config.autoTuneEnabled,
        autoTuneWithAI: true,
        autoTuneIntervalHours: config.autoTuneIntervalHours,
        autoTuneLastAt: null,
        autoTuneNotes: "",
      }
    }),
  ])

  const llmIntervalMinutes = controls.llmIntervalMinutes
  const llmEnabled = controls.enableLLM && Boolean(config.openaiKey)
  const primarySets = {
    crypto: new Set(controls.primaryAssets?.crypto ?? []),
    stocks: new Set(controls.primaryAssets?.stocks ?? []),
    forex: new Set(controls.primaryAssets?.forex ?? []),
  }

  const accuracyHorizon = VALID_HORIZONS.has(controls.dipHorizon)
    ? controls.dipHorizon
    : "24h"
  const shouldWeightSignals = controls.autoTuneEnabled !== false
  const [cryptoResult, stockResult, forexResult, accuracySummary, botWeights] = await Promise.all(
    [
      safeFetch(() => fetchCrypto(universe.crypto)),
      safeFetch(() => fetchStocks(universe.stocks)),
      safeFetch(() => fetchForex(universe.forex)),
      shouldWeightSignals ? loadSignalPerformanceSummary(db, accuracyHorizon) : null,
      shouldWeightSignals ? loadBotAccuracyWeights(db, accuracyHorizon) : new Map(),
    ]
  )
  const signalWeight = shouldWeightSignals
    ? computeSignalWeightMultiplier(accuracySummary)
    : 1
  const botSignals = await fetchBotSignals(db, botWeights).catch((err) => {
    console.error("Bot signals fetch failed", err.message)
    return new Map()
  })
  const autoTuneResult = maybeAutoTuneTrendWeights(
    controls,
    accuracySummary,
    accuracyHorizon
  )
  let tunedWeights =
    autoTuneResult?.weights || controls.trendWeights || DEFAULT_TREND_WEIGHTS
  let autoTuneNotes = autoTuneResult?.note || ""
  let aiDelta = 0
  const aiEnabled = Boolean(config.openaiKey) && controls.autoTuneWithAI !== false
  if (
    controls.autoTuneEnabled &&
    aiEnabled &&
    accuracySummary &&
    accuracySummary.count >= config.minAccuracySignals
  ) {
    try {
      const aiResult = await requestAiSignalDelta({
        weights: tunedWeights,
        horizon: accuracyHorizon,
        hitRate: accuracySummary.hitRate ?? 0,
        count: accuracySummary.count ?? 0,
        signalWeight,
      })
      if (aiResult && aiResult.delta) {
        const applied = applySignalDelta(tunedWeights, aiResult.delta)
        tunedWeights = applied.weights
        aiDelta = applied.delta
        const reason = aiResult.reason ? ` (${aiResult.reason})` : ""
        autoTuneNotes = [
          autoTuneNotes,
          `AI nudged bot signal weight by ${aiDelta}.${reason}`,
        ]
          .filter(Boolean)
          .join(" ")
      }
    } catch (err) {
      console.error("AI weight tuning failed", err.message)
    }
  }
  const autoTuneTriggered = Boolean(autoTuneResult?.tuned || aiDelta)
  controls.trendWeights = tunedWeights
  const crypto = cryptoResult.items
  const stocks = stockResult.items
  const forex = forexResult.items
  if (cryptoResult.error) console.error("Crypto fetch failed", cryptoResult.error)
  if (stockResult.error) console.error("Stock fetch failed", stockResult.error)
  if (forexResult.error) console.error("Forex fetch failed", forexResult.error)

  const candidates = markPrimary([...crypto, ...stocks, ...forex], primarySets)
  const hotTrades = buildHotTrades(candidates, botSignals, { signalWeight })
  const newsData = await loadNewsData(db, candidates, controls, universe, runId)
  const trendingByHorizon = buildTrending(
    candidates,
    botSignals,
    controls.trendWeights,
    newsData.scoreMap
  )
  const actionBoard = buildActionBoard(hotTrades, newsData.scoreMap, config.actionBoardLimit)
  const trendLookup = buildTrendLookup(trendingByHorizon, controls.trendHorizon)
  const effectiveTrendWeights =
    newsData.scoreMap && newsData.scoreMap.size > 0
      ? controls.trendWeights
      : { ...controls.trendWeights, news: 0 }
  const popularItems = buildPopularList(hotTrades, config.popularPerClass)
  const priceSnapshot = buildPriceSnapshot(candidates)
  const trimmed = hotTrades.slice(0, config.hotTradesLimit)
  const fetchStatus = {
    crypto: buildFetchStatus({
      items: crypto,
      error: cryptoResult.error,
      preferences: universe.crypto,
      listKey: "symbols",
      source: "coingecko",
    }),
    stock: buildFetchStatus({
      items: stocks,
      error: stockResult.error,
      preferences: universe.stocks,
      listKey: "symbols",
      source: config.alphaVantageKey ? "alphavantage" : "disabled",
    }),
    forex: buildFetchStatus({
      items: forex,
      error: forexResult.error,
      preferences: universe.forex,
      listKey: "pairs",
      source: "frankfurter",
    }),
  }
  const candidateCounts = {
    crypto: crypto.length,
    stock: stocks.length,
    forex: forex.length,
  }

  const existing = await db.doc("market/hotTrades").get()
  const previousItems = existing.exists ? existing.data()?.items : []
  const previousMap = new Map()
  if (Array.isArray(previousItems)) {
    previousItems.forEach((item) => {
      if (item?.symbol && item?.rationale) {
        previousMap.set(String(item.symbol).toUpperCase(), String(item.rationale))
      }
    })
  }

  let llmMap = null
  let llmUpdatedAt = null
  if (llmEnabled) {
    const lastLlmAt = existing.data()?.meta?.llmUpdatedAt?.toDate?.()
    const intervalMs = llmIntervalMinutes * 60 * 1000
    const shouldRun = !lastLlmAt || Date.now() - lastLlmAt.getTime() >= intervalMs

    if (shouldRun) {
      try {
        llmMap = await enrichWithOpenAI(trimmed.slice(0, 4))
        llmUpdatedAt = admin.firestore.FieldValue.serverTimestamp()
      } catch (err) {
        console.error("OpenAI summary failed", err.message)
      }
    }
  }

  const items = trimmed.map((item) => {
    const key = item.symbol.toUpperCase()
    const rationale =
      llmMap?.get(key) || previousMap.get(key) || item.rationale
    return {
      ...item,
      rationale,
    }
  })
  const analysisContext = {
    trendLookup: trendLookup.lookup,
    trendHorizon: trendLookup.horizon,
    trendWeights: effectiveTrendWeights,
    newsScoreMap: newsData.scoreMap,
    newsWeight: actionBoard.newsWeight,
    signalLookbackMinutes: config.signalLookbackMinutes,
    accuracyHorizon,
    accuracySummary,
    minAccuracySignals: config.minAccuracySignals,
    signalWeight,
    llmMap,
    fallbackMap: previousMap,
  }
  const analyzedItems = annotateTrades(items, analysisContext)
  const analyzedActionBoard = {
    ...actionBoard,
    buys: annotateTrades(actionBoard.buys, analysisContext),
    sells: annotateTrades(actionBoard.sells, analysisContext),
    byAsset: {
      buys: annotateBuckets(actionBoard.byAsset?.buys, analysisContext),
      sells: annotateBuckets(actionBoard.byAsset?.sells, analysisContext),
    },
  }

  const autoTuneWrite = autoTuneTriggered
    ? db.doc("market/controls").set(
        {
          trendWeights: tunedWeights,
          autoTuneEnabled: controls.autoTuneEnabled,
          autoTuneWithAI: controls.autoTuneWithAI,
          autoTuneIntervalHours: controls.autoTuneIntervalHours,
          autoTuneLastAt: admin.firestore.FieldValue.serverTimestamp(),
          autoTuneNotes: autoTuneNotes,
          autoTuneHorizon: accuracyHorizon,
          autoTuneHitRate: accuracySummary?.hitRate ?? null,
          autoTuneSignals: accuracySummary?.count ?? null,
        },
        { merge: true }
      )
    : Promise.resolve()

  await Promise.all([
    db.doc("market/hotTrades").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: analyzedItems,
        sources: {
          crypto: "coingecko",
          stocks: config.alphaVantageKey ? "alphavantage" : "disabled",
          forex: "frankfurter",
        },
        meta: {
          runId,
          signalLookbackMinutes: config.signalLookbackMinutes,
          runDurationMs: Date.now() - startedAt.getTime(),
          llmIntervalMinutes,
          llmEnabled,
          llmUpdatedAt,
          accuracyHorizon,
          accuracyHitRate: accuracySummary?.hitRate ?? null,
          accuracySignals: accuracySummary?.count ?? null,
          signalWeight,
          botWeightCount: botWeights.size,
          fetchStatus,
          candidateCounts,
        },
      },
      { merge: true }
    ),
    db.doc("market/trending").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        horizons: TREND_HORIZONS,
        byHorizon: trendingByHorizon,
        weights: controls.trendWeights,
        meta: {
          runId,
          defaultHorizon: controls.trendHorizon,
          signalLookbackMinutes: config.signalLookbackMinutes,
          trendLimit: config.trendLimit,
          newsEnabled: controls.enableNews,
          newsIntervalMinutes: controls.newsIntervalMinutes,
          newsUpdatedAt: newsData.updatedAt || null,
        },
      },
      { merge: true }
    ),
    db.doc("market/popular").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: popularItems,
        meta: {
          runId,
          perClass: config.popularPerClass,
        },
      },
      { merge: true }
    ),
    db.doc("market/actionBoard").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        buys: analyzedActionBoard.buys,
        sells: analyzedActionBoard.sells,
        byAsset: analyzedActionBoard.byAsset,
        meta: {
          runId,
          limit: config.actionBoardLimit,
          classLimit: actionBoard.classLimit,
          newsWeight: actionBoard.newsWeight,
          signalLookbackMinutes: config.signalLookbackMinutes,
          accuracyHorizon,
          accuracyHitRate: accuracySummary?.hitRate ?? null,
          accuracySignals: accuracySummary?.count ?? null,
          signalWeight,
          botWeightCount: botWeights.size,
          horizon: controls.trendHorizon || "15m",
          fetchStatus,
          candidateCounts,
          sources: {
            crypto: "coingecko",
            stocks: config.alphaVantageKey ? "alphavantage" : "disabled",
            forex: "frankfurter",
          },
        },
      },
      { merge: true }
    ),
    db.doc("market/prices").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: priceSnapshot,
        meta: {
          runId,
          count: priceSnapshot.length,
        },
      },
      { merge: true }
    ),
    autoTuneWrite,
  ])

  const dispatchList =
    analyzedActionBoard.allPicks && analyzedActionBoard.allPicks.length > 0
      ? analyzedActionBoard.allPicks
      : [...analyzedActionBoard.buys, ...analyzedActionBoard.sells]
  await dispatchSignalRequests(db, dispatchList, controls).catch((err) => {
    console.error("Signal request dispatch failed", err.message)
  })

  await emitMarketSignals(db, trendingByHorizon, controls)

  console.log("Market intel run completed", { count: items.length })
}

run().catch((err) => {
  console.error("Market intel failed", err)
  process.exit(1)
})
