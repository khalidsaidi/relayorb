import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Copy, ExternalLink, RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { resolveFinnewsUrl, resolveMarketDataProxyUrl, resolveOpenbbApiUrl, resolveStockpulseUrl } from "@/lib/runtime-urls"
import { fetchJsonWithMeta } from "@/lib/http"
import { getOpenbbWatchlistSnapshot, setOpenbbWatchlist } from "@/lib/openbb-watchlist"
import { toast } from "sonner"

type QuoteResult = {
  symbol?: string
  name?: string
  exchange?: string
  last_price?: number
  open?: number
  high?: number
  low?: number
  prev_close?: number
  volume?: number
  bid?: number
  ask?: number
  market_cap?: number
  pe_ratio?: number
  pb_ratio?: number
  dividend_yield?: number
  ma_50d?: number
  ma_200d?: number
}

type StockpulseRating = {
  ticker: string
  rating?: string
  score?: number
  confidence?: number
  current_price?: number | null
  currency_symbol?: string | null
  rsi?: number | null
  analysis_summary?: string | null
  message?: string | null
}

type FinnewsItem = {
  id: string | number
  title: string
  url?: string | null
  source?: string
  publish_time?: string | null
  created_at?: string | null
  content?: string | null
  stock_codes?: string[]
}

type FinnewsStockNewsItem = {
  id: number
  title: string
  content: string
  url: string
  source: string
  publish_time?: string | null
  sentiment_score?: number | null
  has_analysis?: boolean
}

type FinnewsTargetedCrawlStatus = {
  status?: string
  progress?: { current?: number; total?: number; message?: string } | null
  crawled_count?: number | null
  saved_count?: number | null
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
}

type TraderNewsItem = {
  id: string
  title: string
  url?: string | null
  source?: string
  publishedAt?: string | null
}

function parseSymbols(raw: string) {
  return raw
    .split(/[,\n\r\t ]+/g)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50)
}

function fmtNumber(value: unknown, digits = 2) {
  const n = typeof value === "number" ? value : null
  if (n === null || !Number.isFinite(n)) return "—"
  return n.toFixed(digits)
}

function fmtInteger(value: unknown) {
  const n = typeof value === "number" ? value : null
  if (n === null || !Number.isFinite(n)) return "—"
  return Math.round(n).toLocaleString()
}

async function copyTextToClipboard(text: string) {
  // Prefer the async Clipboard API, but fall back to a temporary textarea for
  // non-secure contexts (e.g. WSL IPs) or older browsers.
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // ignore
  }

  try {
    const el = document.createElement("textarea")
    el.value = text
    el.setAttribute("readonly", "true")
    el.style.position = "fixed"
    el.style.top = "0"
    el.style.left = "0"
    el.style.opacity = "0"
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

function buildAiPrompt(params: {
  symbol: string
  provider: string
  generatedAtIso: string
  quote?: QuoteResult | null
  rating?: StockpulseRating | null
  finnewsItems?: FinnewsStockNewsItem[]
  finnewsLatest?: TraderNewsItem[]
  finnewsStatus?: string | null
}) {
  const {
    symbol,
    provider,
    generatedAtIso,
    quote,
    rating,
    finnewsItems = [],
    finnewsLatest = [],
    finnewsStatus,
  } = params

  const q = quote || null
  const r = rating || null

  const lines: string[] = []

  lines.push(
    [
      "You are a trading analysis assistant for US equities.",
      "Use ONLY the data provided below. Do not hallucinate missing fundamentals/technicals/news; call out gaps explicitly.",
      "",
      "Return your answer with these sections:",
      "1) One-sentence thesis (bullish / neutral / bearish).",
      "2) Key catalysts from filings/news (with dates, what matters, and what to watch next).",
      "3) Sentiment + narrative (from StockPulse and headlines).",
      "4) Technical setup (trend vs MA50/MA200, RSI, key levels, invalidation).",
      "5) Two scenarios: base case vs. risk case (what would flip the thesis).",
      "6) Questions: what additional data would you want before a trade.",
      "",
      `Ticker: ${symbol}`,
      `As-of: ${generatedAtIso}`,
      "",
    ].join("\n")
  )

  lines.push("DATA: OpenBB (market/price/fundamentals snapshot)")
  lines.push(`- Provider: ${provider}`)
  if (!q) {
    lines.push("- Quote: MISSING (not loaded)")
  } else {
    lines.push(`- Name: ${q.name || "—"}`)
    lines.push(`- Exchange: ${q.exchange || "—"}`)
    lines.push(`- Last: ${fmtNumber(q.last_price)}`)
    lines.push(`- Open: ${fmtNumber(q.open)}`)
    lines.push(`- High/Low: ${fmtNumber(q.high)} / ${fmtNumber(q.low)}`)
    lines.push(`- Prev close: ${fmtNumber(q.prev_close)}`)
    lines.push(`- Volume: ${fmtInteger(q.volume)}`)
    lines.push(`- Bid/Ask: ${fmtNumber(q.bid)} / ${fmtNumber(q.ask)}`)
    lines.push(`- Market cap: ${fmtInteger(q.market_cap)}`)
    lines.push(`- P/E: ${fmtNumber(q.pe_ratio, 2)}`)
    lines.push(`- P/B: ${fmtNumber(q.pb_ratio, 2)}`)
    lines.push(`- Dividend yield: ${fmtNumber(q.dividend_yield, 4)}`)
    lines.push(`- MA50/MA200: ${fmtNumber(q.ma_50d)} / ${fmtNumber(q.ma_200d)}`)
  }
  lines.push("")

  lines.push("DATA: StockPulse (sentiment + AI rating)")
  if (!r) {
    lines.push("- Rating: MISSING (not loaded)")
  } else {
    lines.push(`- Rating: ${r.rating || "—"}`)
    lines.push(`- Score: ${typeof r.score === "number" ? r.score.toFixed(1) : "—"} / 100`)
    lines.push(`- Confidence: ${typeof r.confidence === "number" ? r.confidence.toFixed(1) : "—"} / 100`)
    lines.push(`- RSI: ${typeof r.rsi === "number" ? r.rsi.toFixed(2) : "—"}`)
    if (r.analysis_summary || r.message) {
      lines.push("- Summary:")
      lines.push(String(r.analysis_summary || r.message || "").trim())
    }
  }
  lines.push("")

  lines.push("DATA: FinnewsHunter (filings/news)")
  if (finnewsStatus) lines.push(`- Targeted crawl status: ${finnewsStatus}`)
  if (finnewsItems.length) {
    lines.push("- Per-ticker items (most recent first):")
    finnewsItems.slice(0, 10).forEach((it) => {
      const when = it.publish_time || "—"
      const sent = typeof it.sentiment_score === "number" ? it.sentiment_score.toFixed(2) : "—"
      const url = it.url || "—"
      lines.push(`  - [${when}] ${it.source || "Finnews"} (sentiment_score ${sent}) ${it.title} (${url})`)
    })
  } else if (finnewsLatest.length) {
    lines.push("- Matched from latest feed (fallback):")
    finnewsLatest.slice(0, 10).forEach((it) => {
      const when = it.publishedAt || "—"
      const url = it.url || "—"
      lines.push(`  - [${when}] ${it.source || "Finnews"} ${it.title} (${url})`)
    })
  } else {
    lines.push("- Items: NONE yet (crawl may still be running).")
  }

  lines.push("")
  lines.push("Constraints:")
  lines.push("- Long-only bias is OK to mention, but do not invent position sizing or portfolio context unless explicitly asked.")
  lines.push("- If the data looks inconsistent (e.g. missing RSI but MA present), explain what that likely means and what to verify.")
  lines.push("")
  lines.push("Now produce the analysis.")

  return lines.join("\n")
}

type SyncSummary = {
  at: string
  count: number
  openbb: { ok: number; added: number; already: number; total: number }
  stockpulse: { ok: number; already: number; failed: number }
  finnews: { queued: number; already: number; failed: number }
}

async function postJson(
  service: string,
  url: string,
  body: unknown,
  timeoutMs = 20000
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text().catch(() => "")
    return { ok: res.ok, status: res.status, text }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, text: `[${service}] ${msg}` }
  } finally {
    clearTimeout(timeout)
  }
}

function pickFirstResult(data: any): QuoteResult {
  if (!data) return {}
  if (Array.isArray(data?.results) && data.results.length) return data.results[0] as QuoteResult
  if (Array.isArray(data) && data.length) return data[0] as QuoteResult
  if (typeof data === "object") return data as QuoteResult
  return {}
}

function formatRelative(value?: string | null) {
  if (!value) return "-"
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return value
  const diffMs = Date.now() - parsed.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function extractTickers(text: string) {
  const hay = String(text || "")
  const out = new Set<string>()
  const patterns: RegExp[] = [
    /\$([A-Z]{1,6}(?:\.[A-Z]{1,2})?)/g,
    /\(([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\)/g,
    /\b(?:NASDAQ|NYSE|AMEX)\s*[:]\s*([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\b/g,
  ]
  for (const re of patterns) {
    for (;;) {
      const m = re.exec(hay)
      if (!m) break
      const sym = (m[1] || "").trim().toUpperCase()
      if (!sym) continue
      out.add(sym)
    }
  }
  return Array.from(out)
}

function deriveFinnewsSymbols(item: FinnewsItem) {
  if (Array.isArray(item.stock_codes) && item.stock_codes.length) {
    return item.stock_codes.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
  }
  return extractTickers([item.title, item.content].filter(Boolean).join(" "))
}

export default function TraderDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const openbbUrl = useMemo(() => (proxyBase ? `${proxyBase}/v1/openbb` : resolveOpenbbApiUrl()), [proxyBase])
  const finnewsUrl = useMemo(() => (proxyBase ? `${proxyBase}/v1/finnews` : resolveFinnewsUrl()), [proxyBase])
  const stockpulseUrl = useMemo(() => (proxyBase ? `${proxyBase}/v1/stockpulse` : resolveStockpulseUrl()), [proxyBase])

  const TRADER_SYMBOLS_KEY = "relayorb_trader_symbols_v1"
  const [symbolsRaw, setSymbolsRaw] = useState("")
  const [savedSymbolsRaw, setSavedSymbolsRaw] = useState("")
  const [provider, setProvider] = useState<"yfinance" | "intrinio">("yfinance")
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
  const [detailsSymbol, setDetailsSymbol] = useState<string | null>(null)

  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, QuoteResult>>({})
  const [ratingsBySymbol, setRatingsBySymbol] = useState<Record<string, StockpulseRating>>({})
  const [finnewsLatest, setFinnewsLatest] = useState<FinnewsItem[]>([])
  const [finnewsBySymbol, setFinnewsBySymbol] = useState<Record<string, FinnewsStockNewsItem[]>>({})
  const [finnewsErrorsBySymbol, setFinnewsErrorsBySymbol] = useState<Record<string, string>>({})
  const [finnewsStatusBySymbol, setFinnewsStatusBySymbol] = useState<Record<string, FinnewsTargetedCrawlStatus>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRADER_SYMBOLS_KEY)
      if (raw && raw.trim()) setSavedSymbolsRaw(raw)
    } catch {
      // ignore
    }
  }, [])

  const persistSymbols = useCallback(
    (raw: string) => {
      try {
        localStorage.setItem(TRADER_SYMBOLS_KEY, raw)
        setSavedSymbolsRaw(raw)
      } catch {
        // ignore
      }
    },
    [setSavedSymbolsRaw]
  )

  const symbols = useMemo(() => parseSymbols(symbolsRaw), [symbolsRaw])

  const syncWatchlist = useCallback(
    async (symbolsToSync: string[]) => {
      if (!finnewsUrl || !stockpulseUrl) return null
      if (!symbolsToSync.length) return null

      setSyncing(true)
      try {
        const unique = Array.from(new Set(symbolsToSync))

        // Canonical local watchlist for the console:
        // - OpenBB uses it directly.
        // - In-app alerts use it.
        // - StockPulse can import it and we also push into StockPulse directly here.
        const before = getOpenbbWatchlistSnapshot()
        const beforeSet = new Set(before)
        let openbbAdded = 0
        let openbbAlready = 0
        for (const sym of unique) {
          if (beforeSet.has(sym)) openbbAlready += 1
          else openbbAdded += 1
        }
        const merged = Array.from(new Set([...before, ...unique])).slice(0, 500)
        setOpenbbWatchlist(merged)
        const openbbOk = openbbAdded + openbbAlready

        // StockPulse: ensure tickers are actively monitored so sentiment/ratings fill in.
        let spOk = 0
        let spAlready = 0
        let spFailed = 0
        const spQueue = [...unique]
        const spConcurrency = Math.min(4, spQueue.length || 1)
        await Promise.all(
          Array.from({ length: spConcurrency }).map(async () => {
            for (;;) {
              const sym = spQueue.shift()
              if (!sym) return
              const res = await postJson(
                "StockPulse",
                `${stockpulseUrl}/api/stocks`,
                { ticker: sym, name: sym, market: "US" },
                20000
              )
              if (res.ok) {
                spOk += 1
                continue
              }
              const msg = res.text.toLowerCase()
              if (res.status === 409 || msg.includes("already") || msg.includes("exists")) {
                spAlready += 1
                continue
              }
              spFailed += 1
              console.warn("StockPulse add failed", sym, res.status, res.text)
            }
          })
        )

        // Finnews: queue targeted crawls so the stock actually shows up in Finnews stock/news endpoints.
        // Without this, small-cap tickers often won't appear in the global headline crawl.
        let fnQueued = 0
        let fnAlready = 0
        let fnFailed = 0
        const fnQueue = [...unique]
        const fnConcurrency = Math.min(2, fnQueue.length || 1)
        await Promise.all(
          Array.from({ length: fnConcurrency }).map(async () => {
            for (;;) {
              const sym = fnQueue.shift()
              if (!sym) return
              const res = await postJson(
                "Finnews",
                `${finnewsUrl}/api/v1/stocks/${encodeURIComponent(sym)}/targeted-crawl`,
                { stock_name: sym, days: 30 },
                30000
              )
              if (res.ok) {
                fnQueued += 1
              } else {
                const msg = res.text.toLowerCase()
                if (res.status === 409 || msg.includes("already") || msg.includes("running")) {
                  fnAlready += 1
                  continue
                }
                fnFailed += 1
                console.warn("Finnews stock warm failed", sym, res.status, res.text)
              }
            }
          })
        )

        const next: SyncSummary = {
          at: new Date().toISOString(),
          count: unique.length,
          openbb: { ok: openbbOk, added: openbbAdded, already: openbbAlready, total: merged.length },
          stockpulse: { ok: spOk, already: spAlready, failed: spFailed },
          finnews: { queued: fnQueued, already: fnAlready, failed: fnFailed },
        }
        setSyncSummary(next)

        if (openbbAdded || spOk || spAlready || fnQueued || fnAlready) {
          toast.success(
            `Watchlist synced: OpenBB ${openbbOk}/${unique.length} (+${openbbAdded}), StockPulse ${spOk + spAlready}/${unique.length}, Finnews ${fnQueued + fnAlready}/${unique.length}`
          )
        }
        if (spFailed || fnFailed) {
          toast.message(`Some sync steps failed (StockPulse ${spFailed}, Finnews ${fnFailed}). See console.`)
        }
        return next
      } finally {
        setSyncing(false)
      }
    },
    [finnewsUrl, stockpulseUrl]
  )

  const run = useCallback(async () => {
    if (!openbbUrl || !finnewsUrl || !stockpulseUrl) {
      toast.error("Configure VITE_MARKET_DATA_PROXY_URL (recommended) or VITE_OPENBB_API_URL/VITE_FINNEWS_URL/VITE_STOCKPULSE_URL.")
      return
    }
    if (!symbols.length) {
      toast.error("Enter at least one symbol.")
      return
    }

    persistSymbols(symbolsRaw)
    setLoading(true)
    try {
      // Ensure the symbols are also monitored by the upstream tools (esp. StockPulse) so the dashboard doesn't go stale.
      await syncWatchlist(symbols)

      // 1) OpenBB quotes (fast and trader-essential)
      const quoteReqs = symbols.map((sym) => {
        const url = `${openbbUrl}/api/v1/equity/price/quote?symbol=${encodeURIComponent(sym)}&provider=${encodeURIComponent(provider)}`
        return fetchJsonWithMeta("OpenBB", url, undefined, 25000).then((r) => ({ sym, ...r }))
      })

      // 2) StockPulse ratings (on-demand per ticker)
      const ratingReqs = symbols.map((sym) => {
        const url = `${stockpulseUrl}/api/ai/rating/${encodeURIComponent(sym)}`
        return fetchJsonWithMeta("StockPulse", url, undefined, 30000).then((r) => ({ sym, ...r }))
      })

      // 3) Finnews: fetch latest once and filter client-side for the requested set
      const finnewsUrlLatest = `${finnewsUrl}/api/v1/news/latest?limit=200`

      const [quotesRes, ratingsRes, finnewsRes] = await Promise.all([
        Promise.allSettled(quoteReqs),
        Promise.allSettled(ratingReqs),
        fetchJsonWithMeta("Finnews", finnewsUrlLatest, undefined, 30000),
      ])

      const nextQuotes: Record<string, QuoteResult> = {}
      quotesRes.forEach((res) => {
        if (res.status !== "fulfilled") return
        if (!res.value.ok) return
        nextQuotes[res.value.sym] = pickFirstResult(res.value.data)
      })
      setQuotesBySymbol(nextQuotes)

      const nextRatings: Record<string, StockpulseRating> = {}
      ratingsRes.forEach((res) => {
        if (res.status !== "fulfilled") return
        if (!res.value.ok) return
        nextRatings[res.value.sym] = res.value.data as StockpulseRating
      })
      setRatingsBySymbol(nextRatings)

      const items = Array.isArray(finnewsRes.data) ? (finnewsRes.data as FinnewsItem[]) : []
      setFinnewsLatest(items)

      const finnewsStockRes = await Promise.all(
        symbols.map(async (sym) => {
          const url = `${finnewsUrl}/api/v1/stocks/${encodeURIComponent(sym)}/news?limit=10`
          try {
            const res = await fetchJsonWithMeta<FinnewsStockNewsItem[]>("Finnews", url, undefined, 30000)
            const list = Array.isArray(res.data) ? res.data : []
            return { sym, list, err: null as string | null }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            return { sym, list: [] as FinnewsStockNewsItem[], err: msg }
          }
        })
      )
      const nextFinnewsBySymbol: Record<string, FinnewsStockNewsItem[]> = {}
      const nextFinnewsErrors: Record<string, string> = {}
      finnewsStockRes.forEach((r) => {
        nextFinnewsBySymbol[r.sym] = r.list
        if (r.err) {
          nextFinnewsErrors[r.sym] = r.err
          console.warn("Finnews stock news failed", r.sym, r.err)
        }
      })
      setFinnewsBySymbol(nextFinnewsBySymbol)
      setFinnewsErrorsBySymbol(nextFinnewsErrors)

      // Finnews freshness/rate-limit hints: fetch targeted crawl status per ticker (best-effort).
      const statusRes = await Promise.allSettled(
        symbols.map(async (sym) => {
          const url = `${finnewsUrl}/api/v1/stocks/${encodeURIComponent(sym)}/targeted-crawl/status`
          const res = await fetchJsonWithMeta<FinnewsTargetedCrawlStatus>("Finnews", url, undefined, 15000)
          return { sym, status: res.data }
        })
      )
      const nextStatus: Record<string, FinnewsTargetedCrawlStatus> = {}
      statusRes.forEach((r) => {
        if (r.status !== "fulfilled") return
        nextStatus[r.value.sym] = r.value.status || {}
      })
      setFinnewsStatusBySymbol(nextStatus)

      const quoteRejected = quotesRes.filter((r) => r.status === "rejected")
      if (quoteRejected.length) toast.message(`OpenBB: ${quoteRejected.length} quote(s) failed (see console).`)

      const ratingRejected = ratingsRes.filter((r) => r.status === "rejected")
      if (ratingRejected.length) toast.message(`StockPulse: ${ratingRejected.length} rating(s) failed (see console).`)

      const finnewsStockRejected = finnewsStockRes.filter((r) => Boolean(r.err))
      if (finnewsStockRejected.length) toast.message(`Finnews: ${finnewsStockRejected.length} stock news fetch(es) failed (see console).`)

      quotesRes.forEach((r) => {
        if (r.status !== "rejected") return
        console.warn("OpenBB quote failed", r.reason)
      })
      ratingsRes.forEach((r) => {
        if (r.status !== "rejected") return
        console.warn("StockPulse rating failed", r.reason)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [finnewsUrl, openbbUrl, persistSymbols, provider, stockpulseUrl, symbols, symbolsRaw, syncWatchlist])

  const newsBySymbol = useMemo(() => {
    const out: Record<string, FinnewsItem[]> = {}
    if (!finnewsLatest.length || !symbols.length) return out
    const wanted = new Set(symbols)
    finnewsLatest.forEach((item) => {
      const symbolsInItem = deriveFinnewsSymbols(item)
      symbolsInItem.forEach((sym) => {
        if (!wanted.has(sym)) return
        out[sym] = out[sym] || []
        out[sym].push(item)
      })
    })
    Object.keys(out).forEach((k) => {
      out[k] = out[k].slice(0, 5)
    })
    return out
  }, [finnewsLatest, symbols])

  const formatFinnewsStatus = useCallback((sym: string) => {
    const s = finnewsStatusBySymbol[sym]
    if (!s) return null
    const status = (s.status || "").toLowerCase()
    const at = s.completed_at || s.started_at || null
    const rel = at ? formatRelative(at) : null
    const crawled = typeof s.crawled_count === "number" ? s.crawled_count : null
    const saved = typeof s.saved_count === "number" ? s.saved_count : null
    if (status === "failed") {
      const err = s.error_message ? String(s.error_message).slice(0, 140) : "Unknown error"
      return `Crawl failed${rel ? ` (${rel})` : ""}: ${err}`
    }
    if (status === "running") {
      const cur = s.progress?.current
      const total = s.progress?.total
      const pct = typeof cur === "number" && typeof total === "number" && total > 0 ? Math.round((cur / total) * 100) : null
      const msg = s.progress?.message ? String(s.progress.message) : ""
      return `Crawl running${pct !== null ? ` (${pct}%)` : ""}${msg ? ` · ${msg}` : ""}`
    }
    if (status === "completed") {
      const parts: string[] = []
      if (rel) parts.push(`completed ${rel}`)
      if (crawled !== null) parts.push(`${crawled} found`)
      if (saved !== null) parts.push(`+${saved} new`)
      return parts.length ? `Crawl ${parts.join(" · ")}` : "Crawl completed"
    }
    return status ? `Crawl: ${status}` : null
  }, [finnewsStatusBySymbol])

  const copyAiPrompt = useCallback(
    async (sym: string) => {
      const nowIso = new Date().toISOString()
      const quote = quotesBySymbol[sym] || null
      const rating = ratingsBySymbol[sym] || null
      const finnewsItems = finnewsBySymbol[sym] || []
      const finnewsStatus = formatFinnewsStatus(sym)
      const finnewsLatest = (newsBySymbol[sym] || []).slice(0, 12).map((n) => ({
        id: `latest:${String(n.id)}`,
        title: n.title,
        url: n.url || null,
        source: n.source,
        publishedAt: n.publish_time || n.created_at || null,
      }))

      const text = buildAiPrompt({
        symbol: sym,
        provider,
        generatedAtIso: nowIso,
        quote,
        rating,
        finnewsItems,
        finnewsLatest,
        finnewsStatus,
      })

      const ok = await copyTextToClipboard(text)
      if (ok) toast.success(`Copied AI prompt for ${sym}`)
      else toast.error("Copy failed. Try using the deployed site (https) instead of an IP-based dev URL.")
    },
    [finnewsBySymbol, formatFinnewsStatus, newsBySymbol, provider, quotesBySymbol, ratingsBySymbol]
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-foreground">{t("trader.title")}</div>
        <div className="text-sm text-muted-foreground">{t("trader.subtitle")}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <Label>Symbols</Label>
              <Input
                value={symbolsRaw}
                onChange={(e) => setSymbolsRaw(e.target.value)}
                placeholder="AAPL MSFT NVDA"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>Tip: spaces, commas, and new lines all work. Max 50 symbols.</span>
                <div className="flex items-center gap-2">
                  {savedSymbolsRaw.trim() && !symbolsRaw.trim() ? (
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-foreground"
                      onClick={() => setSymbolsRaw(savedSymbolsRaw)}
                    >
                      Load last run
                    </button>
                  ) : null}
                  {symbolsRaw.trim() ? (
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-foreground"
                      onClick={() => setSymbolsRaw("")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>OpenBB provider</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
              >
                <option value="yfinance">yfinance</option>
                <option value="intrinio">intrinio</option>
              </select>
              <div className="text-[11px] text-muted-foreground">
                yfinance is usually best for breadth; intrinio can be sparse depending on account.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {loading ? "Running…" : "Run lookup"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const qs = new URLSearchParams({ symbols: symbols.join(",") }).toString()
                navigate(`/openbb?${qs}`)
              }}
              disabled={!symbols.length}
            >
              Open OpenBB
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const q = symbols[0] || ""
                const qs = q ? new URLSearchParams({ q }).toString() : ""
                navigate(`/finnews${qs ? `?${qs}` : ""}`)
              }}
              disabled={!symbols.length}
            >
              Open Finnews
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const ticker = symbols[0] || ""
                const qs = ticker ? new URLSearchParams({ ticker }).toString() : ""
                navigate(`/stockpulse${qs ? `?${qs}` : ""}`)
              }}
              disabled={!symbols.length}
            >
              Open StockPulse
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {syncing ? (
              <span>Syncing watchlist to StockPulse/Finnews…</span>
            ) : syncSummary ? (
              <span>
                Watchlist synced {formatRelative(syncSummary.at)} · OpenBB {syncSummary.openbb.ok}/{syncSummary.count} (+{syncSummary.openbb.added})
                {" · "}StockPulse {syncSummary.stockpulse.ok + syncSummary.stockpulse.already}/{syncSummary.count}
                {" · "}Finnews {syncSummary.finnews.queued + syncSummary.finnews.already}/{syncSummary.count}
              </span>
            ) : (
              <span>
                Tip: Run lookup also syncs these symbols into your OpenBB watchlist, StockPulse monitoring list, and queues Finnews targeted crawls.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {symbols.map((sym) => {
          const quote = quotesBySymbol[sym]
          const rating = ratingsBySymbol[sym]
          const stockNews = finnewsBySymbol[sym] || []
          const finnewsErr = finnewsErrorsBySymbol[sym]
          const finnewsStatus = formatFinnewsStatus(sym)
          const stockItems: TraderNewsItem[] = stockNews.map((n) => ({
            id: `stock:${n.id}`,
            title: n.title,
            url: n.url,
            source: n.source,
            publishedAt: n.publish_time,
          }))
          const latestItems: TraderNewsItem[] = (newsBySymbol[sym] || []).map((n) => ({
            id: `latest:${String(n.id)}`,
            title: n.title,
            url: n.url || null,
            source: n.source,
            publishedAt: n.publish_time || n.created_at || null,
          }))
          const items = stockItems.length ? stockItems : latestItems
          const stockpulseSummary = rating?.analysis_summary || rating?.message || ""
          return (
            <Card key={sym} className="border-border/70">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="truncate">{sym}</span>
                    {rating?.rating ? (
                      <Badge variant="secondary">{rating.rating}</Badge>
                    ) : null}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {quote?.name ? quote.name : "—"} {quote?.exchange ? `· ${quote.exchange}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold text-foreground">
                    {typeof quote?.last_price === "number" ? quote.last_price.toFixed(2) : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Vol {typeof quote?.volume === "number" ? quote.volume.toLocaleString() : "—"}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setDetailsSymbol(sym)}>
                      Details
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide">OpenBB</div>
                    <div className="mt-1 text-foreground">
                      Bid/Ask:{" "}
                      {typeof quote?.bid === "number" ? quote.bid.toFixed(2) : "—"} /{" "}
                      {typeof quote?.ask === "number" ? quote.ask.toFixed(2) : "—"}
                    </div>
                    <div className="mt-1 text-foreground">
                      High/Low:{" "}
                      {typeof quote?.high === "number" ? quote.high.toFixed(2) : "—"} /{" "}
                      {typeof quote?.low === "number" ? quote.low.toFixed(2) : "—"}
                    </div>
                    <div className="mt-1 text-foreground">
                      MA50/MA200:{" "}
                      {typeof quote?.ma_50d === "number" ? quote.ma_50d.toFixed(2) : "—"} /{" "}
                      {typeof quote?.ma_200d === "number" ? quote.ma_200d.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide">StockPulse</div>
                    <div className="mt-1 text-foreground">
                      Score: {typeof rating?.score === "number" ? rating.score.toFixed(1) : "—"}{" "}
                      (conf {typeof rating?.confidence === "number" ? rating.confidence.toFixed(1) : "—"})
                    </div>
                    <div className="mt-1 text-foreground">
                      RSI: {typeof rating?.rsi === "number" ? rating.rsi.toFixed(2) : "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                      {stockpulseSummary || "—"}
                    </div>
                    {stockpulseSummary && stockpulseSummary.length > 140 ? (
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        onClick={() => setDetailsSymbol(sym)}
                      >
                        Read full analysis
                      </button>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide">Quick actions</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyAiPrompt(sym)} title="Copy a prompt you can paste into ChatGPT/Claude/etc.">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy AI prompt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/openbb?${new URLSearchParams({ symbols: sym }).toString()}`)}
                      >
                        Open OpenBB
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/stockpulse?${new URLSearchParams({ ticker: sym }).toString()}`)}
                      >
                        Open StockPulse
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/finnews?${new URLSearchParams({ q: sym }).toString()}`)}
                      >
                        Search Finnews
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest filings/news</div>
                  {finnewsStatus ? <div className="mt-1 text-[11px] text-muted-foreground">{finnewsStatus}</div> : null}
                  {items.length ? (
                    <div className="mt-2 space-y-2">
                      {items.slice(0, 4).map((n) => (
                        <div key={n.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-foreground text-xs font-medium truncate">{n.title}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {n.source || "Finnews"} · {formatRelative(n.publishedAt || null)}
                            </div>
                          </div>
                          {n.url ? (
                            <button
                              type="button"
                              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(n.url || "", "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {finnewsErr
                        ? `Finnews fetch failed: ${finnewsErr}`
                        : "No items yet. Finnews targeted crawl is queued on run; refresh in 30-60s or open Finnews for details."}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={Boolean(detailsSymbol)} onOpenChange={(open) => (!open ? setDetailsSymbol(null) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailsSymbol || ""} {detailsSymbol && quotesBySymbol[detailsSymbol]?.name ? `· ${quotesBySymbol[detailsSymbol]?.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detailsSymbol ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copyAiPrompt(detailsSymbol)} title="Copy a prompt you can paste into ChatGPT/Claude/etc.">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy AI prompt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/openbb?${new URLSearchParams({ symbols: detailsSymbol }).toString()}`)}
                >
                  Open OpenBB
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/stockpulse?${new URLSearchParams({ ticker: detailsSymbol }).toString()}`)}
                >
                  Open StockPulse
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/finnews?${new URLSearchParams({ q: detailsSymbol }).toString()}`)}
                >
                  Search Finnews
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="text-[11px] uppercase tracking-wide">OpenBB</div>
                  {(() => {
                    const q = quotesBySymbol[detailsSymbol]
                    if (!q) return <div className="mt-1">No quote loaded yet. Run lookup.</div>
                    return (
                      <div className="mt-2 space-y-1 text-foreground">
                        <div>Last: {typeof q.last_price === "number" ? q.last_price.toFixed(2) : "—"}</div>
                        <div>
                          Bid/Ask: {typeof q.bid === "number" ? q.bid.toFixed(2) : "—"} / {typeof q.ask === "number" ? q.ask.toFixed(2) : "—"}
                        </div>
                        <div>
                          High/Low: {typeof q.high === "number" ? q.high.toFixed(2) : "—"} / {typeof q.low === "number" ? q.low.toFixed(2) : "—"}
                        </div>
                        <div>
                          MA50/MA200: {typeof q.ma_50d === "number" ? q.ma_50d.toFixed(2) : "—"} / {typeof q.ma_200d === "number" ? q.ma_200d.toFixed(2) : "—"}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="text-[11px] uppercase tracking-wide">StockPulse</div>
                  {(() => {
                    const r = ratingsBySymbol[detailsSymbol]
                    if (!r) return <div className="mt-1">No rating loaded yet. Run lookup.</div>
                    return (
                      <div className="mt-2 space-y-2">
                        <div className="text-foreground">
                          {r.rating ? <Badge variant="secondary">{r.rating}</Badge> : null}{" "}
                          <span className="ml-2">
                            Score {typeof r.score === "number" ? r.score.toFixed(1) : "—"} (conf{" "}
                            {typeof r.confidence === "number" ? r.confidence.toFixed(1) : "—"})
                          </span>
                        </div>
                        <div className="text-foreground">RSI: {typeof r.rsi === "number" ? r.rsi.toFixed(2) : "—"}</div>
                        <div className="whitespace-pre-wrap text-[12px] text-foreground">
                          {r.analysis_summary || r.message || "—"}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="text-[11px] uppercase tracking-wide">Latest filings/news</div>
                {(() => {
                  const stockNews = finnewsBySymbol[detailsSymbol] || []
                  const finnewsErr = finnewsErrorsBySymbol[detailsSymbol]
                  const stockItems: TraderNewsItem[] = stockNews.map((n) => ({
                    id: `stock:${n.id}`,
                    title: n.title,
                    url: n.url,
                    source: n.source,
                    publishedAt: n.publish_time,
                  }))
                  const latestItems: TraderNewsItem[] = (newsBySymbol[detailsSymbol] || []).map((n) => ({
                    id: `latest:${String(n.id)}`,
                    title: n.title,
                    url: n.url || null,
                    source: n.source,
                    publishedAt: n.publish_time || n.created_at || null,
                  }))
                  const items = (stockItems.length ? stockItems : latestItems).slice(0, 20)
                  if (finnewsErr) return <div className="mt-2 text-xs text-foreground">Finnews fetch failed: {finnewsErr}</div>
                  if (!items.length) return <div className="mt-2 text-xs text-foreground">No items yet (targeted crawl runs on lookup).</div>
                  return (
                    <div className="mt-2 space-y-2">
                      {items.map((n) => (
                        <div key={n.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-foreground text-xs font-medium">{n.title}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {n.source || "Finnews"} · {formatRelative(n.publishedAt || null)}
                            </div>
                          </div>
                          {n.url ? (
                            <button
                              type="button"
                              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(n.url || "", "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
