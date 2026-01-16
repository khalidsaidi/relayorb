import { useEffect, useMemo, useState } from "react"
import { parse } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

const FMP_BASE = "https://financialmodelingprep.com/stable"
const FMP_API_KEY = import.meta.env.VITE_FMP_API_KEY || ""

type FmpInterval = "5min" | "15min" | "30min" | "1hour" | "eod"

export type FmpBar = {
  time: number // ms since epoch
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

type FmpQuote = {
  symbol: string
  price: number
  change?: number
  changePercentage?: number
  volume?: number
  dayHigh?: number
  dayLow?: number
  previousClose?: number
  open?: number
  timestamp?: number
}

function normalizeFmpSymbol(symbol: string) {
  const trimmed = symbol.trim().toUpperCase()
  return trimmed.replace(/[/-]/g, "")
}

function buildUrl(path: string) {
  const apiKeyParam = FMP_API_KEY ? `apikey=${FMP_API_KEY}` : ""
  return `${FMP_BASE}/${path}${path.includes("?") ? "&" : "?"}${apiKeyParam}`
}

type RawBar = {
  date?: unknown
  datetime?: unknown
  timestamp?: unknown
  open?: unknown
  high?: unknown
  low?: unknown
  close?: unknown
  price?: unknown
  volume?: unknown
}

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function resolveTime(value: unknown, timeZone?: string) {
  if (typeof value === "number") {
    if (value > 1_000_000_000_000) return value
    if (value > 1_000_000_000) return value * 1000
    return value
  }
  if (typeof value === "string") {
    if (timeZone && (DATE_TIME_RE.test(value) || DATE_ONLY_RE.test(value))) {
      const format = DATE_TIME_RE.test(value) ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd"
      const parsed = parse(value, format, new Date())
      const zoned = fromZonedTime(parsed, timeZone)
      if (Number.isFinite(zoned.getTime())) return zoned.getTime()
    }
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      if (numeric > 1_000_000_000_000) return numeric
      if (numeric > 1_000_000_000) return numeric * 1000
      return numeric
    }
  }
  return Date.now()
}

function getNumber(entry: RawBar, fields: (keyof RawBar)[]) {
  for (const field of fields) {
    const value = entry[field]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) return numeric
    }
  }
  return undefined
}

function mapBars(raw: unknown[], timeZone?: string): FmpBar[] {
  const bars: FmpBar[] = []
  for (const item of raw) {
    const entry = item as RawBar
    const close = getNumber(entry, ["close", "price"])
    if (close === undefined) continue

    const time = resolveTime(entry.date ?? entry.datetime ?? entry.timestamp, timeZone)
    const open = getNumber(entry, ["open", "price", "close"]) ?? close
    const high = getNumber(entry, ["high", "close"]) ?? close
    const low = getNumber(entry, ["low", "close"]) ?? close
    const volume = getNumber(entry, ["volume"])

    bars.push({ time, open, high, low, close, volume })
  }
  return bars.sort((a, b) => a.time - b.time)
}

export function useFmpQuote(symbol?: string) {
  const [quote, setQuote] = useState<FmpQuote | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing (set VITE_FMP_API_KEY)")
      return
    }
    const resolvedSymbol = symbol
    let cancelled = false

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(resolvedSymbol)
        const url = buildUrl(`quote?symbol=${encodeURIComponent(normalized)}`)
        const resp = await fetch(url)
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`Quote fetch failed (${resp.status}): ${text || resp.statusText}`)
        }
        const data = await resp.json()
        const payload = Array.isArray(data) ? data[0] : null
        if (!payload) throw new Error("No quote data")
        if (cancelled) return
        setQuote({
          symbol: payload.symbol || normalized,
          price: payload.price,
          change: payload.change,
          changePercentage: payload.changePercentage ?? payload.changePercent,
          volume: payload.volume,
          dayHigh: payload.dayHigh,
          dayLow: payload.dayLow,
          previousClose: payload.previousClose,
          open: payload.open,
          timestamp: payload.timestamp ? payload.timestamp * 1000 : undefined,
        })
        setError(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Quote fetch failed"
        setError(message)
      }
    }

    load()
    const id = setInterval(load, 8000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol])

  return { quote, error }
}

export function useFmpChart(
  symbol?: string,
  interval: FmpInterval = "5min",
  limit = 120,
  assetClass?: string
) {
  const [bars, setBars] = useState<FmpBar[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing (set VITE_FMP_API_KEY)")
      return
    }
    const resolvedSymbol = symbol
    const timeZone =
      assetClass === "stock" ? "America/New_York" : assetClass === "forex" ? "UTC" : assetClass === "crypto" ? "UTC" : undefined
    let cancelled = false

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(resolvedSymbol)
        const path =
          interval === "eod"
            ? `historical-price-eod/full?symbol=${encodeURIComponent(normalized)}&limit=${limit}`
            : `historical-chart/${interval}?symbol=${encodeURIComponent(normalized)}&limit=${limit}`
        const url = buildUrl(path)
        const resp = await fetch(url)
        if (!resp.ok) {
          const text = await resp.text()
          throw new Error(`Chart fetch failed (${resp.status}): ${text || resp.statusText}`)
        }
        const data = await resp.json()
        if (!Array.isArray(data)) {
          throw new Error(typeof data?.error === "string" ? data.error : "Chart fetch failed")
        }
        if (cancelled) return
        setBars(mapBars(data, timeZone))
        setError(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Chart fetch failed"
        setError(message)
      }
    }

    load()
    const id = setInterval(load, interval === "eod" ? 60000 : 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol, interval, limit, assetClass])

  const latest = useMemo(() => (bars.length ? bars[bars.length - 1] : null), [bars])

  return { bars, latest, error }
}

export type FmpSearchResult = {
  symbol: string
  name?: string
  exchange?: string
  currency?: string
}

type RawSearchRow = Record<string, unknown>

function normalizeSearchQuery(query: string) {
  return query.trim().toUpperCase()
}

function normalizeSymbolQuery(query: string) {
  return normalizeSearchQuery(query).replace(/[/-]/g, "")
}

function mapSearchRow(row: RawSearchRow): FmpSearchResult | null {
  const symbol = typeof row.symbol === "string" ? row.symbol : ""
  if (!symbol) return null
  const name = typeof row.name === "string" ? row.name : undefined
  const exchange =
    typeof row.stockExchange === "string"
      ? row.stockExchange
      : typeof row.exchangeShortName === "string"
        ? row.exchangeShortName
        : typeof row.exchange === "string"
          ? row.exchange
          : undefined
  const currency = typeof row.currency === "string" ? row.currency : undefined
  return { symbol, name, exchange, currency }
}

function rankSearchResult(result: FmpSearchResult, symbolNeedle: string, nameNeedle: string) {
  const symbol = result.symbol.toUpperCase()
  const name = (result.name || "").toUpperCase()
  let score = 0
  if (symbol === symbolNeedle) score += 100
  if (symbol.startsWith(symbolNeedle)) score += 60
  if (symbol.includes(symbolNeedle)) score += 30
  if (name.startsWith(nameNeedle)) score += 20
  if (name.includes(nameNeedle)) score += 10
  if (result.exchange) score += 1
  return score
}

function filterByAssetClass(result: FmpSearchResult, assetClass?: string) {
  if (!assetClass) return true
  if (assetClass === "forex") {
    return /^[A-Z]{6}$/.test(result.symbol)
  }
  if (assetClass === "crypto") {
    return /^[A-Z0-9]{2,12}$/.test(result.symbol)
  }
  // default stock
  return true
}

export function useFmpSymbolSearch(query: string, assetClass?: string) {
  const [results, setResults] = useState<FmpSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    if (!FMP_API_KEY) {
      setError("FMP API key missing (set VITE_FMP_API_KEY)")
      setLoading(false)
      return
    }
    let cancelled = false
    const id = setTimeout(async () => {
      setLoading(true)
      try {
        const symbolNeedle = normalizeSymbolQuery(trimmed)
        const nameNeedle = normalizeSearchQuery(trimmed)
        const [symbolRowsResult, nameRowsResult] = await Promise.allSettled([
          (async () => {
            const url = buildUrl(`search-symbol?query=${encodeURIComponent(symbolNeedle)}`)
            const resp = await fetch(url)
            if (!resp.ok) {
              const text = await resp.text()
              throw new Error(`Symbol search failed (${resp.status}): ${text || resp.statusText}`)
            }
            const data = (await resp.json()) as unknown
            if (!Array.isArray(data)) throw new Error("Unexpected symbol search payload")
            return data as RawSearchRow[]
          })(),
          (async () => {
            const url = buildUrl(`search-name?query=${encodeURIComponent(trimmed)}`)
            const resp = await fetch(url)
            if (!resp.ok) {
              const text = await resp.text()
              throw new Error(`Name search failed (${resp.status}): ${text || resp.statusText}`)
            }
            const data = (await resp.json()) as unknown
            if (!Array.isArray(data)) throw new Error("Unexpected name search payload")
            return data as RawSearchRow[]
          })(),
        ])
        const mergedRows: RawSearchRow[] = []
        const errors: Error[] = []
        if (symbolRowsResult.status === "fulfilled") {
          mergedRows.push(...symbolRowsResult.value)
        } else {
          errors.push(symbolRowsResult.reason as Error)
        }
        if (nameRowsResult.status === "fulfilled") {
          mergedRows.push(...nameRowsResult.value)
        } else {
          errors.push(nameRowsResult.reason as Error)
        }
        if (!mergedRows.length && errors.length) {
          throw errors[0]
        }
        if (cancelled) return
        const deduped = new Map<string, FmpSearchResult>()
        for (const row of mergedRows) {
          const mapped = mapSearchRow(row)
          if (!mapped) continue
          if (!filterByAssetClass(mapped, assetClass)) continue
          const key = `${mapped.symbol}-${mapped.exchange || ""}`
          const current = deduped.get(key)
          if (!current || (!current.name && mapped.name) || (!current.exchange && mapped.exchange)) {
            deduped.set(key, mapped)
          }
        }
        const ranked = Array.from(deduped.values()).sort((a, b) => {
          const scoreA = rankSearchResult(a, symbolNeedle, nameNeedle)
          const scoreB = rankSearchResult(b, symbolNeedle, nameNeedle)
          if (scoreA !== scoreB) return scoreB - scoreA
          return a.symbol.localeCompare(b.symbol)
        })
        setResults(ranked.slice(0, 20))
        setError(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Search failed"
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query, assetClass])

  return { results, loading, error }
}

// ============================================================
// Technical Indicators
// ============================================================

type IndicatorType = "sma" | "ema" | "rsi" | "adx" | "williams"

export type IndicatorDataPoint = {
  date: string
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  sma?: number
  ema?: number
  rsi?: number
  adx?: number
  williams?: number
}

export function useFmpIndicator(
  symbol?: string,
  indicator: IndicatorType = "sma",
  period = 20,
  timeframe: "5min" | "15min" | "30min" | "1hour" | "1day" = "5min",
  limit = 100
) {
  const [data, setData] = useState<IndicatorDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing")
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(symbol!)
        const url = buildUrl(
          `technical-indicators/${indicator}?symbol=${encodeURIComponent(normalized)}&periodLength=${period}&timeframe=${timeframe}`
        )
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`Indicator fetch failed: ${resp.status}`)
        const json = await resp.json()
        if (cancelled) return
        const items = Array.isArray(json) ? json.slice(0, limit) : []
        setData(items)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Indicator fetch failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [symbol, indicator, period, timeframe, limit])

  return { data, loading, error }
}

// ============================================================
// Company Profile
// ============================================================

export type CompanyProfile = {
  symbol: string
  companyName?: string
  exchange?: string
  industry?: string
  sector?: string
  mktCap?: number
  price?: number
  beta?: number
  volAvg?: number
  lastDiv?: number
  range?: string // "52w low - 52w high"
  changes?: number
  currency?: string
  cik?: string
  isin?: string
  cusip?: string
  description?: string
  ceo?: string
  website?: string
  image?: string
  ipoDate?: string
  dcfDiff?: number
  dcf?: number
  isEtf?: boolean
  isActivelyTrading?: boolean
  isFund?: boolean
  isAdr?: boolean
}

export function useFmpProfile(symbol?: string) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing")
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(symbol!)
        const url = buildUrl(`profile?symbol=${encodeURIComponent(normalized)}`)
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`Profile fetch failed: ${resp.status}`)
        const json = await resp.json()
        if (cancelled) return
        const data = Array.isArray(json) ? json[0] : null
        setProfile(data)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Profile fetch failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [symbol])

  return { profile, loading, error }
}

// ============================================================
// Stock News
// ============================================================

export type StockNewsItem = {
  symbol?: string
  publishedDate?: string
  title?: string
  image?: string
  site?: string
  text?: string
  url?: string
}

export function useFmpNews(symbol?: string, limit = 10) {
  const [news, setNews] = useState<StockNewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing")
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(symbol!)
        // FMP stable API uses /news/stock path (not /stock-news)
        const url = buildUrl(`news/stock?symbols=${encodeURIComponent(normalized)}&limit=${limit}`)
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`News fetch failed: ${resp.status}`)
        const json = await resp.json()
        if (cancelled) return
        setNews(Array.isArray(json) ? json : [])
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "News fetch failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [symbol, limit])

  return { news, loading, error }
}

// ============================================================
// Price Target
// ============================================================

export type PriceTarget = {
  symbol?: string
  targetHigh?: number
  targetLow?: number
  targetConsensus?: number
  targetMedian?: number
}

export function useFmpPriceTarget(symbol?: string) {
  const [priceTarget, setPriceTarget] = useState<PriceTarget | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing")
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(symbol!)
        const url = buildUrl(`price-target-consensus?symbol=${encodeURIComponent(normalized)}`)
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`Price target fetch failed: ${resp.status}`)
        const json = await resp.json()
        if (cancelled) return
        const data = Array.isArray(json) ? json[0] : null
        setPriceTarget(data)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Price target fetch failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [symbol])

  return { priceTarget, loading, error }
}

// ============================================================
// Analyst Ratings
// ============================================================

export type AnalystRating = {
  symbol?: string
  date?: string
  rating?: string
  ratingScore?: number
  ratingRecommendation?: string
  ratingDetailsDCFScore?: number
  ratingDetailsDCFRecommendation?: string
  ratingDetailsROEScore?: number
  ratingDetailsROERecommendation?: string
  ratingDetailsROAScore?: number
  ratingDetailsROARecommendation?: string
  ratingDetailsDEScore?: number
  ratingDetailsDERecommendation?: string
  ratingDetailsPEScore?: number
  ratingDetailsPERecommendation?: string
  ratingDetailsPBScore?: number
  ratingDetailsPBRecommendation?: string
}

export function useFmpRating(symbol?: string) {
  const [rating, setRating] = useState<AnalystRating | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    if (!FMP_API_KEY) {
      setError("FMP API key missing")
      return
    }
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const normalized = normalizeFmpSymbol(symbol!)
        const url = buildUrl(`rating?symbol=${encodeURIComponent(normalized)}`)
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`Rating fetch failed: ${resp.status}`)
        const json = await resp.json()
        if (cancelled) return
        const data = Array.isArray(json) ? json[0] : null
        setRating(data)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Rating fetch failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [symbol])

  return { rating, loading, error }
}
