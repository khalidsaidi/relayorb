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
  alphaVantageKey: process.env.ALPHAVANTAGE_API_KEY || "",
  stockWatchlistLimit: parseInt(process.env.STOCK_WATCHLIST_LIMIT || "5", 10),
  popularPerClass: parseInt(process.env.POPULAR_PER_CLASS || "12", 10),
  fxPairs: parseList(
    process.env.FX_PAIRS,
    ["USD/JPY", "USD/EUR", "USD/GBP", "USD/CHF", "USD/CAD"]
  ),
}

const VALID_HORIZONS = new Set(["1h", "24h", "7d"])
const VALID_RISK = new Set(["conservative", "balanced", "aggressive"])
const VALID_ASSET_FOCUS = new Set(["crypto", "stock", "forex"])

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

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  if (upper.includes("/")) return upper.replace(/\s+/g, "")
  if (upper.includes("-")) return upper.replace(/\s+/g, "").replace(/-/g, "/")

  const quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR"]
  for (const quote of quotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return `${upper.slice(0, -quote.length)}/${quote}`
    }
  }

  return upper
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  return cleaned || null
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

  if (candidate) return normalizeSymbol(candidate)

  const text = `${signal.message || ""} ${signal.type || ""}`.toUpperCase()
  const match = text.match(/[A-Z0-9]{2,10}[/-][A-Z0-9]{2,10}/)
  return match ? normalizeSymbol(match[0]) : null
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
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
  const horizonCandidate = typeof data?.dipHorizon === "string" ? data.dipHorizon : ""
  const dipHorizon = VALID_HORIZONS.has(horizonCandidate) ? horizonCandidate : "24h"
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

  return {
    enableLLM: data?.enableLLM !== false,
    llmIntervalMinutes,
    dipHorizon,
    riskProfile,
    assetFocus: normalizedFocus,
    primaryAssets,
  }
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

  return data
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
}

async function fetchStockQuote(symbol) {
  if (!config.alphaVantageKey) return null
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
    symbol
  )}&apikey=${config.alphaVantageKey}`
  const data = await fetchJson(url)
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
    const gainers = Array.isArray(data?.mostGainerStock) ? data.mostGainerStock : []
    const losers = Array.isArray(data?.mostLoserStock) ? data.mostLoserStock : []

    gainers.slice(0, 10).forEach((stock, index) => {
      const symbol = normalizeTicker(stock.ticker || "")
      if (!symbol) return
      results.set(symbol, {
        assetClass: "stock",
        symbol,
        name: stock.ticker,
        price: parseNumber(stock.price),
        change24h: parseNumber(String(stock.change_percentage || "").replace(/%/g, "")),
        volume: parseNumber(stock.volume),
        sideHint: "buy",
        liquidityRank: index + 1,
        watchlisted: watchlistSet.has(symbol),
        source: "alphavantage",
      })
    })

    losers.slice(0, 6).forEach((stock, index) => {
      const symbol = normalizeTicker(stock.ticker || "")
      if (!symbol) return
      results.set(symbol, {
        assetClass: "stock",
        symbol,
        name: stock.ticker,
        price: parseNumber(stock.price),
        change24h: parseNumber(String(stock.change_percentage || "").replace(/%/g, "")),
        volume: parseNumber(stock.volume),
        sideHint: "sell",
        liquidityRank: index + 1,
        watchlisted: watchlistSet.has(symbol),
        source: "alphavantage",
      })
    })
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
  const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const results = []

  for (const [base, quotesSet] of grouped.entries()) {
    const quotes = Array.from(quotesSet)
    const url = new URL("https://api.exchangerate.host/timeseries")
    url.search = new URLSearchParams({
      start_date: formatDate(start),
      end_date: formatDate(end),
      base,
      symbols: quotes.join(","),
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
        source: "exchangerate.host",
      })
    })
  }

  return results
}

async function fetchBotSignals(db) {
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
      latestAt: null,
      bots: new Set(),
    }

    entry.total += 1
    if (data.side === "buy") entry.buy += 1
    if (data.side === "sell") entry.sell += 1
    if (typeof data.strength === "number") entry.strengthSum += data.strength
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

function scoreTrade(candidate, signalData) {
  const change24h = parseNumber(candidate.change24h) || 0
  const change1h = parseNumber(candidate.change1h) || 0
  const momentumScore = clamp(Math.abs(change24h) * 1.5, 0, 40)
  const shortMomentum = clamp(Math.abs(change1h) * 2, 0, 10)

  let consensusScore = 0
  let strengthScore = 0
  let recencyScore = 0
  let confidence = 0

  if (signalData && signalData.total > 0) {
    const bias = (signalData.buy - signalData.sell) / signalData.total
    consensusScore = clamp(bias * 30, -30, 30)
    const avgStrength = signalData.strengthSum / signalData.total || 0
    strengthScore = clamp(avgStrength * 20, 0, 20)

    if (signalData.latestAt) {
      const ageMinutes = (Date.now() - signalData.latestAt.getTime()) / 60000
      recencyScore = clamp(
        ((config.signalLookbackMinutes - ageMinutes) / config.signalLookbackMinutes) * 10,
        0,
        10
      )
    }

    confidence = clamp(signalData.total / 5, 0, 1)
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
      shortMomentum +
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

function buildHotTrades(candidates, signalMap) {
  const scored = candidates.map((candidate) => {
    const symbolKey = normalizeSymbol(candidate.symbol)
    const signalData = symbolKey ? signalMap.get(symbolKey) : null
    const scoreDetail = scoreTrade(candidate, signalData)

    const side = signalData
      ? signalData.buy >= signalData.sell
        ? "buy"
        : "sell"
      : candidate.sideHint || (candidate.change24h >= 0 ? "buy" : "sell")

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
      timeframe: candidate.assetClass === "crypto" ? "1h" : "1d",
      side,
      score: Number(scoreDetail.score.toFixed(2)),
      confidence: Number(scoreDetail.confidence.toFixed(2)),
      primary: candidate.primary ? true : undefined,
      momentum: Object.keys(momentum).length ? momentum : undefined,
      signals,
      source: candidate.source,
      rationale: buildRationale(candidate, signalData, scoreDetail),
    })
  })

  return scored.sort((a, b) => (b.score || 0) - (a.score || 0))
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

async function run() {
  const db = initAdmin()
  const startedAt = new Date()

  console.log("Market intel run started", { startedAt: startedAt.toISOString() })

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

  const [crypto, stocks, forex, botSignals] = await Promise.all([
    fetchCrypto(universe.crypto).catch((err) => {
      console.error("Crypto fetch failed", err.message)
      return []
    }),
    fetchStocks(universe.stocks).catch((err) => {
      console.error("Stock fetch failed", err.message)
      return []
    }),
    fetchForex(universe.forex).catch((err) => {
      console.error("Forex fetch failed", err.message)
      return []
    }),
    fetchBotSignals(db).catch((err) => {
      console.error("Bot signals fetch failed", err.message)
      return new Map()
    }),
  ])

  const candidates = markPrimary([...crypto, ...stocks, ...forex], primarySets)
  const hotTrades = buildHotTrades(candidates, botSignals)
  const popularItems = buildPopularList(hotTrades, config.popularPerClass)
  const trimmed = hotTrades.slice(0, config.hotTradesLimit)

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

  await Promise.all([
    db.doc("market/hotTrades").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items,
        sources: {
          crypto: "coingecko",
          stocks: config.alphaVantageKey ? "alphavantage" : "disabled",
          forex: "exchangerate.host",
        },
        meta: {
          signalLookbackMinutes: config.signalLookbackMinutes,
          runDurationMs: Date.now() - startedAt.getTime(),
          llmIntervalMinutes,
          llmEnabled,
          llmUpdatedAt,
        },
      },
      { merge: true }
    ),
    db.doc("market/popular").set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: popularItems,
        meta: {
          perClass: config.popularPerClass,
        },
      },
      { merge: true }
    ),
  ])

  console.log("Market intel run completed", { count: items.length })
}

run().catch((err) => {
  console.error("Market intel failed", err)
  process.exit(1)
})
