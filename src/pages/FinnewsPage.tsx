import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { resolveMarketDataProxyUrl, resolveFinnewsUrl } from "@/lib/runtime-urls"
import { fetchJsonOrThrow } from "@/lib/http"
import { ExternalLink, RefreshCw, PlayCircle, Search, FlaskConical, Info, Activity, ListChecks, Newspaper, AlertTriangle, Copy } from "lucide-react"
import { toast } from "sonner"

const defaultLimit = 50

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

function parseTimeMs(value?: string | null) {
  if (!value) return null
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const parsed = new Date(normalized)
  const ms = parsed.getTime()
  return Number.isFinite(ms) ? ms : null
}

type FinnewsHealth = {
  status?: string
  app?: string
  version?: string
}

type NewsItem = {
  id: string | number
  title: string
  content?: string | null
  url?: string | null
  source_url?: string | null
  source: string
  publish_time?: string | null
  sentiment_score?: number | null
  stock_codes?: string[]
  created_at?: string | null
}

type FinnewsTask = {
  id: number
  mode: string
  status: string
  source: string
  crawled_count: number
  saved_count: number
  error_message?: string | null
  created_at: string
  completed_at?: string | null
}

type ProviderInfo = {
  name: string
  display_name?: string
  description?: string
  supported_types?: string[]
  priority?: number
}

type TaskStats = Record<string, unknown>

type ProviderTestResult = {
  success?: boolean
  data?: unknown
  error?: string | null
}

type StockOverview = {
  code: string
  name?: string | null
  total_news: number
  analyzed_news: number
  avg_sentiment?: number | null
  recent_sentiment?: number | null
  sentiment_trend?: string
  last_news_time?: string | null
}

function normalizeNewsItem(raw: any): NewsItem {
  const url = raw?.url ?? raw?.source_url ?? null
  return {
    id: raw?.id ?? "",
    title: raw?.title ?? "",
    content: raw?.content ?? raw?.summary ?? null,
    url,
    source_url: raw?.source_url ?? (raw?.url ?? null),
    source: raw?.source ?? "",
    publish_time: raw?.publish_time ?? null,
    sentiment_score: raw?.sentiment_score ?? null,
    stock_codes: Array.isArray(raw?.stock_codes) ? raw.stock_codes : raw?.stock_codes ?? undefined,
    created_at: raw?.created_at ?? null,
  }
}

function extractCiks(text: string) {
  // CIKs are up to 10 digits (often shown without left-padding).
  const hay = String(text || "")
  const matches = hay.match(/\b\d{6,10}\b/g) || []
  const normalized = matches
    .map((m) => m.replace(/\D/g, ""))
    .filter(Boolean)
    .map((m) => m.padStart(10, "0"))
  return Array.from(new Set(normalized))
}

function extractCiksFromUrl(url?: string | null) {
  const out = new Set<string>()
  const raw = String(url || "").trim()
  if (!raw) return []
  try {
    const u = new URL(raw)
    const q = u.searchParams.get("CIK") || u.searchParams.get("cik") || ""
    if (q) extractCiks(q).forEach((c) => out.add(c))
    // Common SEC paths: /Archives/edgar/data/{cik}/...
    const m = u.pathname.match(/\/data\/(\d{1,10})\b/i)
    if (m?.[1]) extractCiks(m[1]).forEach((c) => out.add(c))
  } catch {
    // Not a valid URL; fall back to regex.
    extractCiks(raw).forEach((c) => out.add(c))
  }
  return Array.from(out)
}

function extractCiksFromItem(item: NewsItem) {
  const out = new Set<string>()
  extractCiksFromUrl(item.url).forEach((c) => out.add(c))
  extractCiksFromUrl(item.source_url).forEach((c) => out.add(c))
  extractCiks([item.title, item.content].filter(Boolean).join(" ")).forEach((c) => out.add(c))
  return Array.from(out)
}

function extractTickers(text: string) {
  const hay = String(text || "")
  const out = new Set<string>()

  // Common patterns in trader-facing text.
  // - $AAPL
  // - (AAPL) or (BRK.B)
  // - NASDAQ:TSLA / NYSE:BRK.B
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

function deriveSymbols(item: NewsItem, cikToTicker?: Record<string, string> | null) {
  if (Array.isArray(item.stock_codes) && item.stock_codes.length) {
    return item.stock_codes.map((s) => String(s).trim()).filter(Boolean)
  }
  // Best-effort extraction for cases where the backend didn't enrich tickers yet.
  const derived = new Set(extractTickers([item.title, item.content].filter(Boolean).join(" ")))
  if (cikToTicker) {
    const ciks = extractCiksFromItem(item)
    ciks.forEach((cik) => {
      const ticker = cikToTicker[cik]
      if (ticker) derived.add(String(ticker).trim().toUpperCase())
    })
  }
  return Array.from(derived)
}

function isSecUrl(url?: string | null) {
  if (!url) return false
  return url.includes("sec.gov") || url.includes("www.sec.gov")
}

function isRateLimitMessage(msg?: string | null) {
  const hay = String(msg || "")
  return /(?:\b429\b|too many requests|rate limit|bandwidth limit)/i.test(hay)
}

function sentimentMeta(score?: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null
  const s = Math.max(-1, Math.min(1, score))
  const abs = Math.abs(s)
  const confidence = Math.round(abs * 100)
  const label = s >= 0.2 ? "positive" : s <= -0.2 ? "negative" : "neutral"
  const tone =
    label === "positive" ? "bg-emerald-100 text-emerald-700" : label === "negative" ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground"
  return { score: s, confidence, label, tone }
}

function deriveSentimentScore(item: NewsItem): number {
  // FinnewsHunter does not always populate `sentiment_score`. Provide a deterministic baseline
  // so traders aren't staring at blanks. This is intentionally simple (keyword-weighted).
  const text = [item.title, item.content].filter(Boolean).join(" ").toLowerCase()
  if (!text) return 0

  const hit = (re: RegExp) => re.test(text)

  // Critical negatives.
  if (
    hit(/\b(bankruptcy|chapter\s*11|delist(?:ing)?|going\s+concern|fraud|investigation|restatement|sec\s+charge|criminal|halt(?:ed)?|insolvency)\b/i)
  )
    return -0.9

  // Strong negatives.
  if (hit(/\b(downgrade|cuts?\s+guidance|miss(?:es|ed)\s+estimates|plung(?:e|ed)|selloff|lawsuit|class\s+action)\b/i)) return -0.6

  // Strong positives.
  if (hit(/\b(upgrade|raises?\s+guidance|beat(?:s|en)?\s+estimates|buyback|dividend\s+(?:increase|hike)|record\s+(?:revenue|profit)|surge(?:s|d)?|soar(?:s|ed)?)\b/i))
    return 0.6

  // Mild directional cues.
  if (hit(/\b(bullish|breakout|rally|outperform)\b/i)) return 0.3
  if (hit(/\b(bearish|breakdown|slump|underperform)\b/i)) return -0.3

  // Default: neutral baseline.
  return 0
}

function resolveSentimentScore(item: NewsItem): number {
  if (typeof item.sentiment_score === "number" && Number.isFinite(item.sentiment_score)) return item.sentiment_score
  return deriveSentimentScore(item)
}

type ParsedSearch = {
  hasQuery: boolean
  tickers: string[]
  keywords: string[]
}

function parseSearchQuery(raw: string): ParsedSearch {
  const q = String(raw || "").trim()
  if (!q) return { hasQuery: false, tickers: [], keywords: [] }

  const tickerSet = new Set<string>()
  extractTickers(q).forEach((t) => tickerSet.add(t))
  for (const token of q.split(/[\s,]+/g)) {
    const cleaned = token.replace(/[^A-Za-z.]/g, "").trim()
    if (!cleaned) continue
    if (/^[A-Za-z]{1,6}(?:\.[A-Za-z]{1,2})?$/.test(cleaned)) {
      tickerSet.add(cleaned.toUpperCase())
    }
  }

  const keywords = q
    .toLowerCase()
    .split(/[\s,]+/g)
    .map((s) => s.replace(/[^a-z0-9.]/g, "").trim())
    .filter(Boolean)
    .filter((s) => s.length >= 2)
    .filter((s) => !tickerSet.has(s.toUpperCase()))

  return {
    hasQuery: true,
    tickers: Array.from(tickerSet),
    keywords,
  }
}

type MatchReason = { kind: "ticker" | "keyword" | "cik"; label: string }

function computeRelevance(args: {
  item: NewsItem
  symbols: string[]
  query: ParsedSearch
  cikToTicker?: Record<string, string> | null
}) {
  const { item, symbols, query, cikToTicker } = args
  const reasons: MatchReason[] = []
  let score = 0

  const symbolSet = new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))
  if (query.tickers.length) {
    const matched = query.tickers.filter((t) => symbolSet.has(t.toUpperCase()))
    if (matched.length) {
      score += 80 + matched.length * 10
      for (const t of matched.slice(0, 2)) {
        reasons.push({ kind: "ticker", label: t.toUpperCase() })
      }
    }
  }

  if (query.keywords.length) {
    const hay = [item.title, item.content].filter(Boolean).join(" ").toLowerCase()
    const matched = query.keywords.filter((k) => hay.includes(k))
    if (matched.length) {
      score += Math.min(40, matched.length * 8)
      for (const k of matched.slice(0, 2)) {
        reasons.push({ kind: "keyword", label: k })
      }
    }
  }

  if (cikToTicker) {
    const ciks = extractCiksFromItem(item)
    const mappedTickers = ciks
      .map((cik) => cikToTicker[cik])
      .filter(Boolean)
      .map((t) => String(t).trim().toUpperCase())
    const mappedMatch = mappedTickers.find((t) => symbolSet.has(t))
    if (mappedMatch && isSecUrl(item.url)) {
      score += 20
      reasons.push({ kind: "cik", label: mappedMatch })
    }
  }

  // If nothing matched explicitly, keep stable ordering but still mark SEC items as mildly relevant.
  if (score === 0 && isSecUrl(item.url)) score = 1

  return { score, reasons }
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`Copied ${label}`)
  } catch (err) {
    console.warn("copy failed", err)
    toast.error(`Copy failed (${label})`)
  }
}

export default function FinnewsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const baseUrl = useMemo(() => resolveFinnewsUrl(), [])
  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const queryBase = proxyBase ? `${proxyBase}/v1/finnews` : baseUrl
  const [secCikMap, setSecCikMap] = useState<Record<string, string> | null>(null)
  const [secCikMapInfo, setSecCikMapInfo] = useState<{ generatedAt?: string; count: number } | null>(null)

  const checkHealth = useCallback(async () => {
    if (!queryBase) {
      toast.error(t("finnews.notConfigured"))
      return
    }
    const url = `${queryBase}/health`
    try {
      await fetchJsonOrThrow("Finnews", url, undefined, 15000)
      toast.success("[Finnews] healthy")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }, [queryBase, t])

  const [health, setHealth] = useState<FinnewsHealth | null>(null)
  const [latest, setLatest] = useState<NewsItem[]>([])
  const [tasks, setTasks] = useState<FinnewsTask[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [providerTest, setProviderTest] = useState<ProviderTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("overview")

  const [searchQuery, setSearchQuery] = useState("")
  const [searchSource, setSearchSource] = useState<string | undefined>(undefined)
  const [searchLimit, setSearchLimit] = useState(defaultLimit)
  const [searchResults, setSearchResults] = useState<NewsItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [autoSearch, setAutoSearch] = useState(false)

  const parsedSearch = useMemo(() => parseSearchQuery(searchQuery), [searchQuery])

  const [newsDetail, setNewsDetail] = useState<NewsItem | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [taskMode, setTaskMode] = useState<string | undefined>(undefined)
  const [taskStatus, setTaskStatus] = useState<string | undefined>(undefined)
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null)

  const [analysisNewsId, setAnalysisNewsId] = useState("")
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)

  const [stockQuery, setStockQuery] = useState("")
  const [stockResults, setStockResults] = useState<{ code: string; name: string; full_code: string; market?: string | null }[]>([])
  const [stockOverview, setStockOverview] = useState<StockOverview | null>(null)

  const crawlHints = useMemo(() => {
    if (!tasks.length) {
      return {
        hasTasks: false,
        stale: false,
        rateLimited: false,
        lastTask: null as FinnewsTask | null,
        cadenceMinutes: null as number | null,
        rateLimitTask: null as FinnewsTask | null,
      }
    }

    const sorted = [...tasks].sort((a, b) => (parseTimeMs(b.created_at) || 0) - (parseTimeMs(a.created_at) || 0))
    const lastTask = sorted[0] || null
    const lastMs = parseTimeMs(lastTask?.created_at || null)
    const ageMin = lastMs ? (Date.now() - lastMs) / 60000 : null
    const stale = typeof ageMin === "number" && Number.isFinite(ageMin) ? ageMin > 15 : false

    const recent = sorted.slice(0, 10)
    const rateLimitTask = recent.find((t) => isRateLimitMessage(t.error_message || null)) || null

    // Estimate cadence from recent tasks (median interval).
    const deltas: number[] = []
    for (let i = 0; i < Math.min(6, sorted.length - 1); i++) {
      const a = parseTimeMs(sorted[i]?.created_at || null)
      const b = parseTimeMs(sorted[i + 1]?.created_at || null)
      if (!a || !b) continue
      const d = Math.abs(a - b) / 60000
      if (Number.isFinite(d) && d > 0) deltas.push(d)
    }
    deltas.sort((a, b) => a - b)
    const cadenceMinutes = deltas.length ? deltas[Math.floor(deltas.length / 2)] : null

    return {
      hasTasks: true,
      stale,
      rateLimited: Boolean(rateLimitTask),
      lastTask,
      cadenceMinutes,
      rateLimitTask,
    }
  }, [tasks])

  const searchRows = useMemo(() => {
    const rows = searchResults.map((item) => {
      const symbols = deriveSymbols(item, secCikMap)
      const relevance = computeRelevance({ item, symbols, query: parsedSearch, cikToTicker: secCikMap })
      return { item, symbols, relevance }
    })

    if (!parsedSearch.hasQuery) return rows
    return rows.sort((a, b) => {
      if (b.relevance.score !== a.relevance.score) return b.relevance.score - a.relevance.score
      const bt = parseTimeMs(b.item.publish_time || b.item.created_at || null) || 0
      const at = parseTimeMs(a.item.publish_time || a.item.created_at || null) || 0
      return bt - at
    })
  }, [parsedSearch, searchResults, secCikMap])

  // Load SEC CIK -> ticker map (static asset) for SEC filing enrichment.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const cachedRaw = localStorage.getItem("sec_cik_map_v1")
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw)
          const map = (parsed?.cikToTicker || {}) as Record<string, string>
          const generatedAt = typeof parsed?.generatedAt === "string" ? parsed.generatedAt : undefined
          if (!cancelled && map && Object.keys(map).length) {
            setSecCikMap(map)
            setSecCikMapInfo({ generatedAt, count: Object.keys(map).length })
            return
          }
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch("/sec-cik-map.v1.json", { headers: { Accept: "application/json" } })
        if (!res.ok) throw new Error(`Failed to load SEC CIK map (${res.status})`)
        const json = await res.json()
        const map = (json?.cikToTicker || {}) as Record<string, string>
        const generatedAt = typeof json?.generatedAt === "string" ? json.generatedAt : undefined
        if (cancelled) return
        if (map && Object.keys(map).length) {
          setSecCikMap(map)
          setSecCikMapInfo({ generatedAt, count: Object.keys(map).length })
          try {
            localStorage.setItem("sec_cik_map_v1", JSON.stringify({ generatedAt, cikToTicker: map }))
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn("SEC CIK map load failed", err)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Deep-link support:
  // - `/finnews?q=AAPL` pre-fills search and switches to Search tab.
  useEffect(() => {
    const q = (searchParams.get("q") || searchParams.get("query") || searchParams.get("ticker") || "").trim()
    if (!q) return
    setSearchQuery(q)
    setActiveTab("search")
    setAutoSearch(true)
  }, [searchParams])

  const fetchJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!queryBase) {
        throw new Error(t("finnews.notConfigured"))
      }
      const url = `${queryBase}${path}`.replace(/\s+/g, "%20")
      const method = (init?.method || "GET").toUpperCase()
      const headers = new Headers(init?.headers || {})
      headers.set("Accept", "application/json")
      if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
      }
      const data = await fetchJsonOrThrow("Finnews", url, { ...init, headers }, 30000)
      return data
    },
    [queryBase, t]
  )

  const refresh = useCallback(async () => {
    if (!queryBase) return
    setLoading(true)
    setError(null)
    try {
      const [healthData, newsData, tasksData, providersData, statsData] = await Promise.all([
        fetchJson("/health"),
        fetchJson(`/api/v1/news/latest?limit=${defaultLimit}`),
        fetchJson(`/api/v1/tasks/?limit=${defaultLimit}`),
        fetchJson("/api/v1/news/v2/providers"),
        fetchJson("/api/v1/tasks/stats/summary"),
      ])
      setHealth(healthData)
      setLatest(Array.isArray(newsData) ? newsData : [])
      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setProviders(Array.isArray(providersData) ? providersData : [])
      setTaskStats(statsData || null)
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [fetchJson, queryBase])

  // Trader default: US sources. If the backend exposes `us_rss`, pick it by default.
  useEffect(() => {
    if (searchSource) return
    if (!providers.length) return
    const hasUs = providers.some((p) => p.name === "us_rss")
    if (hasUs) setSearchSource("us_rss")
  }, [providers, searchSource])

  const runRealtimeCrawl = useCallback(async () => {
    setCrawlLoading(true)
    setError(null)
    try {
      await fetchJson("/api/v1/tasks/realtime", {
        method: "POST",
        body: JSON.stringify({ source: "us_rss", force_refresh: true }),
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setCrawlLoading(false)
    }
  }, [fetchJson, refresh])

  const searchNews = useCallback(async () => {
    if (!searchQuery && !searchSource) return
    setSearchLoading(true)
    setDetailError(null)
    try {
      // Prefer v2 realtime fetch for keyword search; fallback to list
      const params = new URLSearchParams()
      if (searchQuery) params.set("keywords", searchQuery)
      if (searchSource) params.set("provider", searchSource)
      params.set("limit", String(searchLimit || defaultLimit))
      const data = await fetchJson(`/api/v1/news/v2/fetch?${params.toString()}`)
      const items: NewsItem[] = Array.isArray(data?.data) ? data.data.map(normalizeNewsItem) : []
      setSearchResults(items)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSearchLoading(false)
    }
  }, [fetchJson, searchQuery, searchSource, searchLimit])

  // If the page was opened with a `?q=` deep-link, auto-run the first search once we have enough context.
  useEffect(() => {
    if (!autoSearch) return
    if (!searchQuery && !searchSource) return
    setAutoSearch(false)
    void searchNews()
  }, [autoSearch, searchNews, searchQuery, searchSource])

  const showDetail = useCallback(
    async (item: NewsItem) => {
      setDetailError(null)
      setNewsDetail(item)

      // For legacy (DB) news items, fetch full detail by numeric ID.
      if (typeof item.id === "number") {
        try {
          const data = await fetchJson(`/api/v1/news/${item.id}`)
          setNewsDetail(normalizeNewsItem({ ...item, ...data }))
        } catch (err) {
          setDetailError(err instanceof Error ? err.message : "Unknown error")
        }
      }
    },
    [fetchJson]
  )

  const testProvider = useCallback(
    async (name: string) => {
      setProviderTest(null)
      try {
        const data = await fetchJson(`/api/v1/news/v2/providers/${name}/test?limit=5`)
        setProviderTest({ success: true, data })
      } catch (err) {
        setProviderTest({ success: false, error: err instanceof Error ? err.message : "Unknown error" })
      }
    },
    [fetchJson]
  )

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set("limit", "50")
      if (taskMode) params.set("mode", taskMode)
      if (taskStatus) params.set("status", taskStatus)
      const data = await fetchJson(`/api/v1/tasks/?${params.toString()}`)
      setTasks(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [fetchJson, taskMode, taskStatus])

  const triggerAnalysis = useCallback(async () => {
    if (!analysisNewsId) return
    try {
      await fetchJson(`/api/v1/analysis/news/${analysisNewsId}`, { method: "POST", body: JSON.stringify({}) })
      setAnalysisStatus("queued")
    } catch (err) {
      setAnalysisStatus(err instanceof Error ? err.message : "error")
    }
  }, [analysisNewsId, fetchJson])

  const searchStocks = useCallback(async () => {
    if (!stockQuery.trim()) return
    try {
      const data = await fetchJson(`/api/v1/stocks/search/realtime?q=${encodeURIComponent(stockQuery.trim())}`)
      setStockResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [fetchJson, stockQuery])

  const loadStockOverview = useCallback(
    async (code: string) => {
      try {
        const data = await fetchJson(`/api/v1/stocks/${encodeURIComponent(code)}`)
        setStockOverview(data)
      } catch (err) {
        setStockOverview(null)
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    },
    [fetchJson]
  )

  useEffect(() => {
    if (!queryBase) return
    refresh()
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [queryBase, refresh])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("finnews.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>{t("finnews.subtitle")}</div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            {queryBase ? queryBase : t("finnews.notConfigured")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!queryBase || loading}
              onClick={refresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {loading ? t("finnews.refreshing") : t("finnews.refresh")}
            </Button>
            <Button variant="outline" size="sm" disabled={!queryBase} onClick={checkHealth}>
              Health
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!queryBase || crawlLoading}
              onClick={runRealtimeCrawl}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {crawlLoading ? t("finnews.crawling") : t("finnews.crawlNow")}
            </Button>
            {baseUrl ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`${baseUrl}/docs`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("finnews.openDocs")}
              </Button>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Info className="h-4 w-4" /> {t("finnews.statusTitle")}
          </TabsTrigger>
          <TabsTrigger value="news" className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" /> {t("finnews.latestNews")}
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" /> {t("common.search")}
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> Providers
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Tasks
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="stocks" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Stocks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("finnews.statusTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{health?.status || "unknown"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("finnews.updatedAt", { time: formatRelative(lastUpdated) })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("finnews.appLabel", { app: health?.app || "FinnewsHunter" })}
                  {health?.version ? ` · v${health.version}` : ""}
                </div>
                {taskStats ? (
                  <div className="text-xs text-muted-foreground">
                    {JSON.stringify(taskStats)}
                  </div>
                ) : null}
                <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Freshness</Badge>
                    {crawlHints.hasTasks ? (
                      crawlHints.stale ? <Badge variant="destructive">Data may be stale</Badge> : <Badge variant="secondary">Fresh</Badge>
                    ) : (
                      <Badge variant="outline">No crawl yet</Badge>
                    )}
                    {crawlHints.rateLimited ? <Badge variant="destructive">Rate limit</Badge> : null}
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Last crawl:</span>{" "}
                    {crawlHints.lastTask?.created_at ? formatRelative(crawlHints.lastTask.created_at) : "-"}
                    {" · "}
                    <span className="font-medium text-foreground">Cadence:</span>{" "}
                    {typeof crawlHints.cadenceMinutes === "number" ? `~${Math.round(crawlHints.cadenceMinutes)}m` : "-"}
                    {" · "}
                    <span className="font-medium text-foreground">Saved:</span>{" "}
                    {typeof crawlHints.lastTask?.saved_count === "number" ? crawlHints.lastTask.saved_count : "-"}
                  </div>
                  {crawlHints.rateLimitTask?.error_message ? (
                    <div className="mt-2 text-destructive">
                      Rate limit detected in recent task. Tip: reduce crawl frequency, increase provider quota, or retry later.
                      <div className="mt-1 text-[11px] opacity-90">{crawlHints.rateLimitTask.error_message}</div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("finnews.tasksTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {tasks.length ? (
                  <div className="space-y-2">
                    {tasks.slice(0, 4).map((task) => (
                      <div key={task.id} className="rounded-md border bg-muted/30 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{task.source}</span>
                          <span className="text-muted-foreground">{formatRelative(task.created_at)}</span>
                        </div>
                        <div className="mt-1">
                          {task.status} · {t("finnews.crawled", { count: task.crawled_count })} · {t("finnews.saved", { count: task.saved_count })}
                        </div>
                        {task.error_message ? (
                          <div className="mt-1 text-red-500">{task.error_message}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t("finnews.empty")}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("finnews.latestNews")}</CardTitle>
            </CardHeader>
            <CardContent>
              {latest.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finnews.headline")}</TableHead>
                      <TableHead className="w-[90px]">Type</TableHead>
                      <TableHead className="w-[160px]">Tickers</TableHead>
                      <TableHead className="min-w-[180px] whitespace-nowrap">Sentiment</TableHead>
                      <TableHead>{t("finnews.source")}</TableHead>
                      <TableHead>{t("finnews.published")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latest.map((item) => (
                      <TableRow key={`${item.id}-${item.url || item.source_url || ""}`}>
                        <TableCell className="max-w-[520px]">
                          <button
                            className="text-left text-sm font-medium text-foreground hover:underline"
                            onClick={() => {
                              if (!item.url) return
                              window.open(item.url, "_blank", "noopener,noreferrer")
                            }}
                          >
                            {item.title}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isSecUrl(item.url) ? <Badge variant="outline">SEC</Badge> : <Badge variant="outline">News</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(() => {
                            const symbols = deriveSymbols(item, secCikMap)
                            if (!symbols.length) return "-"
                            return (
                              <div className="flex flex-wrap gap-1">
                                {symbols.slice(0, 6).map((code) => (
                                  <Badge key={code} variant="secondary">
                                    {code}
                                  </Badge>
                                ))}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(() => {
                            const resolvedScore = resolveSentimentScore(item)
                            const derived = !(typeof item.sentiment_score === "number" && Number.isFinite(item.sentiment_score))
                            const meta = sentimentMeta(resolvedScore)
                            if (!meta) return "-"
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${meta.tone}`}
                                title={`${derived ? "baseline" : "provider"} score ${meta.score.toFixed(2)} · confidence ${meta.confidence}%`}
                              >
                                {meta.label} {meta.confidence}%
                              </span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(item.publish_time || item.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-sm text-muted-foreground">{t("finnews.empty")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search news</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-64"
                  placeholder="keywords (comma separated)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="w-52 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={searchSource || ""}
                  onChange={(e) => setSearchSource(e.target.value || undefined)}
                >
                  <option value="">Any provider</option>
                  {providers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.display_name || p.name}
                    </option>
                  ))}
                </select>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  max={200}
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(Number(e.target.value) || defaultLimit)}
                />
                <Button onClick={searchNews} disabled={searchLoading}>
                  <Search className="mr-2 h-4 w-4" />
                  {searchLoading ? "Searching" : "Search"}
                </Button>
              </div>
              {crawlHints.rateLimited ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  <div className="font-semibold">Provider rate-limited recently</div>
                  <div className="mt-1 text-destructive/90">
                    FinnewsHunter hit a rate limit while crawling. Results may be incomplete until the next successful crawl.
                  </div>
                </div>
              ) : crawlHints.stale ? (
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground">Data may be stale</div>
                  <div className="mt-1">
                    Last crawl was {crawlHints.lastTask?.created_at ? formatRelative(crawlHints.lastTask.created_at) : "-"}.
                    Run a crawl to refresh news/filings before relying on results.
                  </div>
                </div>
              ) : null}
              {detailError ? <div className="text-xs text-destructive">{detailError}</div> : null}
              <div className="h-80 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Headline</TableHead>
                      <TableHead className="w-[90px]">Type</TableHead>
                      <TableHead className="w-[160px]">Tickers</TableHead>
                      <TableHead className="w-[170px]">Why matched</TableHead>
                      <TableHead className="min-w-[180px] whitespace-nowrap">Sentiment</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchRows.map(({ item, symbols, relevance }) => (
                      <TableRow
                        key={`${item.id}-${item.url || item.source_url || ""}`}
                        className="cursor-pointer"
                        onClick={() => {
                          showDetail(item)
                        }}
                      >
                        <TableCell className="max-w-[520px] text-sm font-medium text-foreground">
                          {item.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isSecUrl(item.url) ? <Badge variant="outline">SEC</Badge> : <Badge variant="outline">News</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {!symbols.length ? (
                            "-"
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {symbols.slice(0, 6).map((code) => (
                                <Badge key={code} variant="secondary">
                                  {code}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground" title="Relevance score (higher is a better match)">
                              Score {relevance.score.toFixed(1)}
                            </div>
                            {relevance.reasons.length ? (
                              <div className="flex flex-wrap gap-1">
                                {relevance.reasons.map((r) => (
                                  <Badge
                                    key={`${r.kind}-${r.label}`}
                                    variant="outline"
                                    title={
                                      r.kind === "ticker"
                                        ? "Ticker match"
                                        : r.kind === "keyword"
                                          ? "Keyword match"
                                          : "SEC CIK mapped ticker"
                                    }
                                  >
                                    {r.kind}:{r.label}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px]" title="No strong match features detected; shown for recency/context.">
                                -
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(() => {
                            const resolvedScore = resolveSentimentScore(item)
                            const derived = !(typeof item.sentiment_score === "number" && Number.isFinite(item.sentiment_score))
                            const meta = sentimentMeta(resolvedScore)
                            if (!meta) return "-"
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${meta.tone}`}
                                title={`${derived ? "baseline" : "provider"} score ${meta.score.toFixed(2)} · confidence ${meta.confidence}%`}
                              >
                                {meta.label} {meta.confidence}%
                              </span>
                            )
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(item.publish_time || item.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!searchLoading && (searchQuery.trim() || searchSource) && searchResults.length === 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground">No results yet</div>
                  <div className="mt-1">
                    Search only covers items that were crawled and saved. If you just started the service, run a crawl and try again.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={runRealtimeCrawl} disabled={crawlLoading}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Run US crawl now
                    </Button>
                    {tasks?.[0]?.created_at ? (
                      <span className="rounded-md border border-border/50 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                        Last task: {formatRelative(tasks[0].created_at)}
                      </span>
                    ) : null}
                    {secCikMapInfo ? (
                      <span className="rounded-md border border-border/50 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                        CIK map: {secCikMapInfo.count.toLocaleString()} tickers
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[11px]">
                    Tips: try `TSLA`, `$TSLA`, or `NASDAQ:TSLA`. Increase the limit if you expect older matches.
                  </div>
                </div>
              ) : null}
              {newsDetail ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
                  {crawlHints.rateLimited ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
                      Provider rate-limited recently. Detail may be incomplete until the next successful crawl.
                    </div>
                  ) : crawlHints.stale ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      Data may be stale. Last crawl was{" "}
                      {crawlHints.lastTask?.created_at ? formatRelative(crawlHints.lastTask.created_at) : "-"}.
                    </div>
                  ) : null}
                  <div className="font-semibold">{newsDetail.title}</div>
                      <div className="text-muted-foreground">{newsDetail.source}</div>
                      <div className="text-muted-foreground">{formatRelative(newsDetail.publish_time || newsDetail.created_at)}</div>
                      {newsDetail.url ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {isSecUrl(newsDetail.url) ? <Badge variant="outline">SEC</Badge> : <Badge variant="outline">News</Badge>}
                          {extractCiksFromItem(newsDetail).map((cik) => (
                            <Badge key={cik} variant="secondary">
                              CIK {cik}
                            </Badge>
                          ))}
                          {(() => {
                            const symbols = deriveSymbols(newsDetail, secCikMap)
                            if (!symbols.length) return null
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                {symbols.slice(0, 12).map((code) => (
                                  <Badge key={code} variant="secondary">
                                    {code}
                                  </Badge>
                                ))}
                              </div>
                            )
                          })()}
                          {(() => {
                            const resolvedScore = resolveSentimentScore(newsDetail)
                            const derived = !(typeof newsDetail.sentiment_score === "number" && Number.isFinite(newsDetail.sentiment_score))
                            const meta = sentimentMeta(resolvedScore)
                            if (!meta) return null
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${meta.tone}`}
                                title={`${derived ? "baseline" : "provider"} score ${meta.score.toFixed(2)} · confidence ${meta.confidence}%`}
                              >
                                {meta.label} {meta.confidence}%
                              </span>
                            )
                          })()}
                        </div>
                      ) : null}
                      {(() => {
                        const symbols = deriveSymbols(newsDetail, secCikMap)
                        const relevance = computeRelevance({ item: newsDetail, symbols, query: parsedSearch, cikToTicker: secCikMap })
                        const hasQuery = Boolean(searchQuery.trim() || searchSource)
                        if (!hasQuery && relevance.score <= 1 && !relevance.reasons.length) return null
                        return (
                          <div className="rounded-md border border-border/60 bg-background p-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">Why matched</span>
                              <span title="Relevance score (higher is a better match)">Score {relevance.score.toFixed(1)}</span>
                            </div>
                            {relevance.reasons.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {relevance.reasons.map((r) => (
                                  <Badge
                                    key={`${r.kind}-${r.label}`}
                                    variant="outline"
                                    title={
                                      r.kind === "ticker"
                                        ? "Ticker match"
                                        : r.kind === "keyword"
                                          ? "Keyword match"
                                          : "SEC CIK mapped ticker"
                                    }
                                  >
                                    {r.kind}:{r.label}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1">No strong match features detected; shown for recency/context.</div>
                            )}
                          </div>
                        )
                      })()}
                      <Separator />
                      <div className="whitespace-pre-wrap text-sm">{newsDetail.content || "(no content)"}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        {newsDetail.url ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(newsDetail.url || "", "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {isSecUrl(newsDetail.url) ? "Open SEC filing" : "Open source"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyText("URL", newsDetail.url || "")}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy URL
                            </Button>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">No source URL.</div>
                        )}

                        {(() => {
                          const symbols = deriveSymbols(newsDetail, secCikMap)
                          if (!symbols.length) return null
                          return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyText("tickers", symbols.join(", "))}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy tickers
                          </Button>
                          )
                        })()}

                        {(() => {
                          const ciks = extractCiksFromItem(newsDetail)
                          if (!ciks.length) return null
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyText("CIK", ciks.join(", "))}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy CIK
                            </Button>
                          )
                        })()}
                      </div>
                    </div>
                  ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {providers.length === 0 ? (
                <div className="text-muted-foreground">No providers</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {providers.map((p) => (
                    <div key={p.name} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{p.display_name || p.name}</div>
                        <Badge variant="outline">{p.supported_types?.join(", ") || ""}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                      <Button size="sm" variant="outline" onClick={() => testProvider(p.name)}>
                        <FlaskConical className="mr-2 h-4 w-4" /> Test
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {providerTest ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-semibold">Test result</div>
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(providerTest, null, 2)}</pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <select
                  className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={taskMode || ""}
                  onChange={(e) => setTaskMode(e.target.value || undefined)}
                >
                  <option value="">Any</option>
                  <option value="cold_start">cold_start</option>
                  <option value="realtime">realtime</option>
                  <option value="targeted">targeted</option>
                </select>
                <select
                  className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={taskStatus || ""}
                  onChange={(e) => setTaskStatus(e.target.value || undefined)}
                >
                  <option value="">Any</option>
                  <option value="pending">pending</option>
                  <option value="running">running</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                </select>
                <Button variant="outline" size="sm" onClick={loadTasks}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
              <div className="h-80 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Counts</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>{task.id}</TableCell>
                        <TableCell>{task.source}</TableCell>
                        <TableCell>{task.status}</TableCell>
                        <TableCell>{task.mode}</TableCell>
                        <TableCell>
                          {t("finnews.crawled", { count: task.crawled_count })} / {t("finnews.saved", { count: task.saved_count })}
                        </TableCell>
                        <TableCell>{formatRelative(task.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analyze news</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <Input className="w-48" placeholder="news id" value={analysisNewsId} onChange={(e) => setAnalysisNewsId(e.target.value)} />
                <Button size="sm" onClick={triggerAnalysis}>
                  <Activity className="mr-2 h-4 w-4" /> Trigger analysis
                </Button>
                {analysisStatus ? <span className="text-muted-foreground text-xs">{analysisStatus}</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">Use an ID from Latest or Search results.</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stocks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Input className="w-64" placeholder="ticker or name" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} />
                <Button size="sm" onClick={searchStocks}>
                  <Search className="mr-2 h-4 w-4" /> Search
                </Button>
              </div>
              <div className="h-48 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Market</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockResults.map((s) => (
                      <TableRow key={s.code} className="cursor-pointer" onClick={() => loadStockOverview(s.code)}>
                        <TableCell>{s.code}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.market}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {stockOverview ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="font-semibold">{stockOverview.code} {stockOverview.name || ""}</div>
                  <div className="text-muted-foreground">Total news: {stockOverview.total_news} · Analyzed: {stockOverview.analyzed_news}</div>
                  <div className="text-muted-foreground">Avg sentiment: {stockOverview.avg_sentiment ?? "-"} · Recent: {stockOverview.recent_sentiment ?? "-"}</div>
                  <div className="text-muted-foreground">Trend: {stockOverview.sentiment_trend || "-"} · Last: {formatRelative(stockOverview.last_news_time)}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
