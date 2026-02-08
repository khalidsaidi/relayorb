import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resolveMarketDataProxyUrl, resolveStockpulseUrl } from "@/lib/runtime-urls"
import { fetchJsonOrThrow } from "@/lib/http"
import { ExternalLink, RefreshCw, Search, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import { ChartFrame } from "@/components/charts/ChartFrame"
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"

type StockpulseStatus = {
  last_check?: string | null
  status?: string | null
  message?: string | null
}

type StockpulseStats = {
  stocks: Array<{
    ticker: string
    total_articles: number
    positive_count: number
    negative_count: number
    neutral_count: number
    avg_sentiment: number
  }>
  total_alerts_24h: number
}

type StockpulseAlert = {
  id: number
  ticker: string
  alert_type: string
  message: string
  created_at: string
  title?: string | null
  url?: string | null
  source?: string | null
  sentiment_score?: number | null
}

type StockpulseNews = {
  id: number
  ticker: string
  title: string
  description?: string | null
  url?: string | null
  source?: string | null
  published_date?: string | null
  sentiment_score?: number | null
  sentiment_label?: string | null
  created_at?: string | null
}

type StockpulseStock = {
  ticker: string
  name: string
  market: string
  active: number
  added_at?: string | null
}

type StockpulseRating = {
  ticker: string
  rating: string
  score: number
  confidence: number
  current_price?: number | null
  currency?: string | null
  currency_symbol?: string | null
  rsi?: number | null
  sentiment_score?: number | null
  technical_score?: number | null
  analysis_summary?: string | null
  moving_averages?: Record<string, { value?: number | null; signal?: string | null }>
  sentiment?: {
    total_articles?: number | null
    avg_sentiment?: number | null
    positive_count?: number | null
    neutral_count?: number | null
    negative_count?: number | null
    sentiment_trend?: string | null
    sources?: Record<string, { count?: number | null; avg_sentiment?: number | null }>
  }
  message?: string | null
}

type StockpulseSearch = {
  ticker: string
  name: string
  exchange?: string
  type?: string
}

type StockpulseChart = {
  ticker: string
  period: string
  currency_symbol?: string | null
  data: Array<{
    date: string
    open?: number | null
    high?: number | null
    low?: number | null
    close?: number | null
    volume?: number | null
  }>
  stats?: {
    current_price?: number | null
    open_price?: number | null
    high_price?: number | null
    low_price?: number | null
    price_change?: number | null
    price_change_percent?: number | null
    total_volume?: number | null
  }
}

type StockpulseProvider = {
  id: number
  provider_name: string
  model?: string | null
  is_active: number
  created_at?: string | null
  updated_at?: string | null
}

type StockpulseProviderTest = {
  success?: boolean
  message?: string
  error?: string
}

type StockpulseRatingHistoryPoint = {
  ts: string
  ticker: string
  rating?: string | null
  score?: number | null
  confidence?: number | null
  current_price?: number | null
  currency?: string | null
  rsi?: number | null
  sentiment_score?: number | null
  technical_score?: number | null
}

type ExplorerRoute = {
  id: string
  label: string
  method: "GET" | "POST" | "DELETE"
  path: string
  description: string
  query?: Array<{ name: string; placeholder?: string }>
  pathParams?: Array<{ name: string; placeholder?: string }>
  bodyExample?: unknown
}

type ExplorerResult = {
  url: string
  ok: boolean
  status: number
  data?: unknown
  error?: string
}

function parseTimestamp(value?: string | null) {
  if (!value) return null
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatRelative(value?: string | null) {
  const parsed = parseTimestamp(value)
  if (!parsed) return "-"
  const diffMs = Date.now() - parsed.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function ratingTone(rating?: string) {
  switch (rating) {
    case "STRONG_BUY":
      return "bg-emerald-100 text-emerald-700"
    case "BUY":
      return "bg-green-100 text-green-700"
    case "HOLD":
      return "bg-amber-100 text-amber-700"
    case "SELL":
      return "bg-rose-100 text-rose-700"
    case "STRONG_SELL":
      return "bg-red-100 text-red-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function renderAny(value: unknown) {
  if (value === null || value === undefined) return "-"
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : "-"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

const AI_PROVIDER_OPTIONS = [
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
  },
  {
    id: "google",
    name: "Google (Gemini)",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"],
  },
  {
    id: "grok",
    name: "xAI (Grok)",
    models: ["grok-4", "grok-4-vision", "grok-4-latest", "grok-2", "grok-2-vision-1212", "grok-latest"],
  },
]

function MetricCard({ label, value }: { label: string; value: unknown }) {
  const display = (() => {
    return renderAny(value)
  })()
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{display}</div>
    </div>
  )
}

export default function StockpulsePage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const baseUrl = useMemo(() => resolveStockpulseUrl(), [])
  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const queryBase = proxyBase ? `${proxyBase}/v1/stockpulse` : baseUrl

  const explorerRoutes: ExplorerRoute[] = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        method: "GET",
        path: "/api/status",
        description: "Service heartbeat and last check time.",
      },
      {
        id: "stats",
        label: "Stats",
        method: "GET",
        path: "/api/stats",
        description: "Aggregated stats (alerts + per-ticker sentiment counts).",
        query: [{ name: "market", placeholder: "US | India | All" }],
      },
      {
        id: "alerts",
        label: "Alerts",
        method: "GET",
        path: "/api/alerts",
        description: "Recent alerts emitted by the pipeline.",
      },
      {
        id: "news",
        label: "News",
        method: "GET",
        path: "/api/news",
        description: "Recent news items. Optional ticker filter.",
        query: [{ name: "ticker", placeholder: "AAPL" }],
      },
      {
        id: "stocks",
        label: "Stocks (list)",
        method: "GET",
        path: "/api/stocks",
        description: "Monitored stocks list. Optional market filter.",
        query: [{ name: "market", placeholder: "US | India | All" }],
      },
      {
        id: "stocks_search",
        label: "Stocks (search)",
        method: "GET",
        path: "/api/stocks/search",
        description: "Search tickers to add to monitoring list.",
        query: [{ name: "q", placeholder: "TSLA" }],
      },
      {
        id: "stocks_add",
        label: "Stocks (add)",
        method: "POST",
        path: "/api/stocks",
        description: "Add a stock to monitoring list.",
        bodyExample: { ticker: "TSLA", name: "Tesla, Inc.", market: "US" },
      },
      {
        id: "stocks_delete",
        label: "Stocks (remove)",
        method: "DELETE",
        path: "/api/stocks/{ticker}",
        description: "Remove a stock from monitoring list.",
        pathParams: [{ name: "ticker", placeholder: "TSLA" }],
      },
      {
        id: "ratings",
        label: "AI ratings (bulk)",
        method: "GET",
        path: "/api/ai/ratings",
        description: "Bulk ratings snapshot (may omit tickers; see coverage card).",
      },
      {
        id: "rating",
        label: "AI rating (one ticker)",
        method: "GET",
        path: "/api/ai/rating/{ticker}",
        description: "Compute or fetch rating for a single ticker.",
        pathParams: [{ name: "ticker", placeholder: "AAPL" }],
      },
      {
        id: "chart",
        label: "Chart",
        method: "GET",
        path: "/api/chart/{ticker}",
        description: "OHLCV chart series for a ticker.",
        pathParams: [{ name: "ticker", placeholder: "AAPL" }],
        query: [{ name: "period", placeholder: "1mo | 3mo | 1y" }],
      },
      {
        id: "ai_providers",
        label: "AI providers (list)",
        method: "GET",
        path: "/api/settings/ai-providers",
        description: "Configured AI providers (OpenAI/Anthropic/etc) for chat.",
      },
      {
        id: "ai_add_provider",
        label: "AI provider (add)",
        method: "POST",
        path: "/api/settings/ai-provider",
        description: "Add an AI provider and optionally activate it.",
        bodyExample: { provider_name: "openai", api_key: "sk-...", model: "gpt-4o" },
      },
      {
        id: "ai_activate",
        label: "AI provider (activate)",
        method: "POST",
        path: "/api/settings/ai-provider/{id}/activate",
        description: "Activate a configured AI provider.",
        pathParams: [{ name: "id", placeholder: "1" }],
      },
      {
        id: "ai_delete",
        label: "AI provider (delete)",
        method: "DELETE",
        path: "/api/settings/ai-provider/{id}",
        description: "Delete a configured AI provider.",
        pathParams: [{ name: "id", placeholder: "1" }],
      },
      {
        id: "ai_test",
        label: "AI provider (test)",
        method: "POST",
        path: "/api/settings/test-ai",
        description: "Test if a provider/model/key can run a minimal request.",
        bodyExample: { provider_name: "openai", api_key: "sk-...", model: "gpt-4o" },
      },
      {
        id: "chat",
        label: "Chat ask",
        method: "POST",
        path: "/api/chat/ask",
        description: "Ask the AI assistant about a ticker.",
        bodyExample: { ticker: "AAPL", question: "Any risks today?", thinking_level: "balanced" },
      },
    ],
    []
  )

  const checkHealth = useCallback(async () => {
    if (!queryBase) {
      toast.error(t("stockpulse.notConfigured"))
      return
    }
    const url = `${queryBase}/api/status`
    try {
      await fetchJsonOrThrow("StockPulse", url, undefined, 15000)
      toast.success(`[StockPulse] healthy`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }, [queryBase, t])

  const [status, setStatus] = useState<StockpulseStatus | null>(null)
  const [stats, setStats] = useState<StockpulseStats | null>(null)
  const [alerts, setAlerts] = useState<StockpulseAlert[]>([])
  const [news, setNews] = useState<StockpulseNews[]>([])
  const [stocks, setStocks] = useState<StockpulseStock[]>([])
  const [ratings, setRatings] = useState<StockpulseRating[]>([])
  const [coreLoading, setCoreLoading] = useState(false)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [ratingsUpdated, setRatingsUpdated] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<StockpulseSearch[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [bulkTickers, setBulkTickers] = useState("")
  const [bulkMarket, setBulkMarket] = useState("US")
  const [bulkLoading, setBulkLoading] = useState(false)

  const [marketFilter, setMarketFilter] = useState("All")
  const [newsTicker, setNewsTicker] = useState("")
  const [selectedTicker, setSelectedTicker] = useState<string>("")
  const [deepLinkTicker, setDeepLinkTicker] = useState<string | null>(null)
  const [ratingDetail, setRatingDetail] = useState<StockpulseRating | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [chartSymbol, setChartSymbol] = useState("AAPL")
  const [chartPeriod, setChartPeriod] = useState("1mo")
  const [chartData, setChartData] = useState<StockpulseChart | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const [chatTicker, setChatTicker] = useState("AAPL")
  const [chatQuestion, setChatQuestion] = useState("")
  const [chatThinking, setChatThinking] = useState("balanced")
  const [chatAnswer, setChatAnswer] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  const [aiProviders, setAiProviders] = useState<StockpulseProvider[]>([])
  const [aiProviderForm, setAiProviderForm] = useState({
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
  })
  const [aiProviderTest, setAiProviderTest] = useState<StockpulseProviderTest | null>(null)
  const [aiProviderLoading, setAiProviderLoading] = useState(false)

  // Deep-link support:
  // - `/stockpulse?ticker=AAPL` selects the ticker and auto-loads its detail + chart + rating history.
  useEffect(() => {
    const raw = (searchParams.get("ticker") || searchParams.get("symbol") || "").trim()
    if (!raw) return
    const ticker = raw.toUpperCase()
    setSelectedTicker(ticker)
    setDeepLinkTicker(ticker)
  }, [searchParams])

  const fetchJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!queryBase) {
        throw new Error(t("stockpulse.notConfigured"))
      }
      const url = `${queryBase}${path}`
      const method = (init?.method || "GET").toUpperCase()
      const headers = new Headers(init?.headers || {})
      headers.set("Accept", "application/json")
      if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
      }
      return fetchJsonOrThrow("StockPulse", url, { ...init, headers }, 30000)
    },
    [queryBase, t]
  )

  const refreshCore = useCallback(async () => {
    if (!queryBase) return
    setCoreLoading(true)
    setError(null)
    try {
      const statsPath = marketFilter !== "All" ? `/api/stats?market=${encodeURIComponent(marketFilter)}` : "/api/stats"
      const stocksPath = marketFilter !== "All" ? `/api/stocks?market=${encodeURIComponent(marketFilter)}` : "/api/stocks"
      const newsPath = newsTicker.trim()
        ? `/api/news?ticker=${encodeURIComponent(newsTicker.trim().toUpperCase())}`
        : "/api/news"
      const [statusData, statsData, alertsData, newsData, stocksData] = await Promise.all([
        fetchJson("/api/status"),
        fetchJson(statsPath),
        fetchJson("/api/alerts"),
        fetchJson(newsPath),
        fetchJson(stocksPath),
      ])
      setStatus(statusData)
      setStats(statsData)
      setAlerts(alertsData)
      setNews(newsData)
      const stocksArray: StockpulseStock[] = Array.isArray(stocksData) ? stocksData : []
      const marketNorm = marketFilter === "All" ? null : marketFilter.toLowerCase()
      const filtered =
        marketNorm === null
          ? stocksArray
          : stocksArray.filter((s) => String(s.market || "").toLowerCase() === marketNorm)
      setStocks(filtered)
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setCoreLoading(false)
    }
  }, [fetchJson, queryBase, marketFilter, newsTicker])

  const refreshRatings = useCallback(async () => {
    if (!queryBase) return
    setRatingsLoading(true)
    setError(null)
    try {
      const ratingsPath =
        marketFilter !== "All"
          ? `/api/ai/ratings?market=${encodeURIComponent(marketFilter)}`
          : "/api/ai/ratings"
      const data = await fetchJson(ratingsPath)
      setRatings(data)
      setRatingsUpdated(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRatingsLoading(false)
    }
  }, [fetchJson, queryBase, marketFilter])

  const loadRatingDetail = useCallback(
    async (ticker: string) => {
      if (!queryBase || !ticker) return
      setDetailLoading(true)
      setError(null)
      try {
        const data = await fetchJson(`/api/ai/rating/${encodeURIComponent(ticker)}`)
        setRatingDetail(data)
        setSelectedTicker(ticker)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setDetailLoading(false)
      }
    },
    [fetchJson, queryBase]
  )

  const [ratingHistory, setRatingHistory] = useState<StockpulseRatingHistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadRatingHistory = useCallback(
    async (ticker: string, limit = 240) => {
      if (!queryBase || !ticker) return
      setHistoryLoading(true)
      setError(null)
      try {
        const data = await fetchJson(
          `/api/ai/rating-history/${encodeURIComponent(ticker)}?limit=${encodeURIComponent(String(limit))}`
        )
        // Backend shape can be either:
        // - history array (legacy)
        // - { ticker, history: [...] } (current patched stockpulse-ai)
        const resolved = Array.isArray(data)
          ? (data as StockpulseRatingHistoryPoint[])
          : data && typeof data === "object" && Array.isArray((data as any).history)
            ? ((data as any).history as StockpulseRatingHistoryPoint[])
            : []
        setRatingHistory(resolved)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        setRatingHistory([])
      } finally {
        setHistoryLoading(false)
      }
    },
    [fetchJson, queryBase]
  )

  const fetchChart = useCallback(
    async (ticker: string, period: string) => {
      if (!queryBase || !ticker) return
      setChartLoading(true)
      setError(null)
      try {
        const data = await fetchJson(`/api/chart/${encodeURIComponent(ticker)}?period=${encodeURIComponent(period)}`)
        setChartData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setChartLoading(false)
      }
    },
    [fetchJson, queryBase]
  )

  // Run the deep-link auto-load once (avoid firing on every keystroke in the ticker input).
  useEffect(() => {
    if (!deepLinkTicker) return
    setDeepLinkTicker(null)

    setChartSymbol(deepLinkTicker)
    setChatTicker(deepLinkTicker)
    void loadRatingDetail(deepLinkTicker)
    void loadRatingHistory(deepLinkTicker)
    void fetchChart(deepLinkTicker, chartPeriod)
  }, [chartPeriod, deepLinkTicker, fetchChart, loadRatingDetail, loadRatingHistory])

  const refreshProviders = useCallback(async () => {
    if (!queryBase) return
    setAiProviderLoading(true)
    setError(null)
    try {
      const data = await fetchJson("/api/settings/ai-providers")
      setAiProviders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setAiProviderLoading(false)
    }
  }, [fetchJson, queryBase])

  const addProvider = useCallback(async () => {
    if (!queryBase) return
    if (!aiProviderForm.provider || !aiProviderForm.apiKey) {
      setError("Provider and API key are required.")
      return
    }
    setAiProviderLoading(true)
    setError(null)
    try {
      await fetchJson("/api/settings/ai-provider", {
        method: "POST",
        body: JSON.stringify({
          provider: aiProviderForm.provider,
          api_key: aiProviderForm.apiKey,
          model: aiProviderForm.model || undefined,
        }),
      })
      await refreshProviders()
      setAiProviderForm((prev) => ({ ...prev, apiKey: "" }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setAiProviderLoading(false)
    }
  }, [fetchJson, queryBase, aiProviderForm, refreshProviders])

  const activateProvider = useCallback(
    async (id: number) => {
      if (!queryBase) return
      setAiProviderLoading(true)
      setError(null)
      try {
        await fetchJson(`/api/settings/ai-provider/${id}/activate`, { method: "POST" })
        await refreshProviders()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setAiProviderLoading(false)
      }
    },
    [fetchJson, queryBase, refreshProviders]
  )

  const deleteProvider = useCallback(
    async (id: number) => {
      if (!queryBase) return
      setAiProviderLoading(true)
      setError(null)
      try {
        await fetchJson(`/api/settings/ai-provider/${id}`, { method: "DELETE" })
        await refreshProviders()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setAiProviderLoading(false)
      }
    },
    [fetchJson, queryBase, refreshProviders]
  )

  const testProvider = useCallback(async () => {
    if (!queryBase) return
    setAiProviderLoading(true)
    setError(null)
    setAiProviderTest(null)
    try {
      const data = await fetchJson("/api/settings/test-ai", {
        method: "POST",
        body: JSON.stringify({
          provider: aiProviderForm.provider,
          api_key: aiProviderForm.apiKey,
          model: aiProviderForm.model || undefined,
        }),
      })
      setAiProviderTest(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setAiProviderLoading(false)
    }
  }, [fetchJson, queryBase, aiProviderForm])

  const askChat = useCallback(async () => {
    if (!queryBase) return
    if (!chatTicker || !chatQuestion.trim()) {
      setError("Ticker and question are required.")
      return
    }
    setChatLoading(true)
    setError(null)
    setChatAnswer(null)
    try {
      const data = await fetchJson("/api/chat/ask", {
        method: "POST",
        body: JSON.stringify({
          ticker: chatTicker.trim().toUpperCase(),
          question: chatQuestion.trim(),
          thinking_level: chatThinking,
        }),
      })
      const answer = data?.answer || data?.error || "No response."
      setChatAnswer(answer)
      const errText = String(data?.error || "")
      if (errText.toLowerCase().includes("no ai provider configured")) {
        toast.error(
          "StockPulse AI is not configured. Add a provider below, or set OPENAI_API_KEY on the StockPulse service."
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setChatLoading(false)
    }
  }, [fetchJson, queryBase, chatTicker, chatQuestion, chatThinking])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setError(null)
    try {
      const data = await fetchJson(`/api/stocks/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSearchLoading(false)
    }
  }, [fetchJson, searchQuery])

  const handleAddStock = useCallback(
    async (result: StockpulseSearch) => {
      setError(null)
      try {
        const market = marketFilter === "All" ? "US" : marketFilter
        await fetchJson("/api/stocks", {
          method: "POST",
          body: JSON.stringify({
            ticker: result.ticker,
            name: result.name || result.ticker,
            market,
          }),
        })
        await refreshCore()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    },
    [fetchJson, refreshCore, marketFilter]
  )

  const handleBulkAdd = useCallback(async () => {
    if (!queryBase) return
    const raw = bulkTickers
      .split(/[\s,;]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
    const unique = Array.from(new Set(raw))
    if (!unique.length) return

    setBulkLoading(true)
    setError(null)
    const market = (bulkMarket || "US").trim() || "US"

    const concurrency = 3
    let idx = 0

    async function addOne(ticker: string) {
      // Try to resolve a friendly name via search, but don't block on it.
      let name = ticker
      try {
        const results: StockpulseSearch[] = await fetchJson(
          `/api/stocks/search?q=${encodeURIComponent(ticker)}`
        )
        const exact = (results || []).find((r) => r.ticker?.toUpperCase() === ticker)
        if (exact?.name) name = exact.name
      } catch {
        // ignore
      }
      await fetchJson("/api/stocks", {
        method: "POST",
        body: JSON.stringify({ ticker, name, market }),
      })
    }

    async function worker() {
      while (idx < unique.length) {
        const next = unique[idx]
        idx += 1
        try {
          await addOne(next)
        } catch (err) {
          console.warn("bulk add failed", next, err)
        }
      }
    }

    try {
      toast.message(`Adding ${unique.length} tickers to ${market}…`)
      await Promise.all(Array.from({ length: concurrency }).map(() => worker()))
      toast.success("Bulk add complete")
      setBulkTickers("")
      await refreshCore()
    } finally {
      setBulkLoading(false)
    }
  }, [bulkTickers, bulkMarket, fetchJson, queryBase, refreshCore])

  const handleRemoveStock = useCallback(
    async (ticker: string) => {
      setError(null)
      try {
        await fetchJson(`/api/stocks/${encodeURIComponent(ticker)}`, { method: "DELETE" })
        await refreshCore()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    },
    [fetchJson, refreshCore]
  )

  useEffect(() => {
    if (!queryBase) return
    refreshCore()
    refreshRatings()
    refreshProviders()
    const id = setInterval(refreshCore, 30000)
    return () => clearInterval(id)
  }, [queryBase, refreshCore, refreshRatings, refreshProviders])

  const activeStocks = stocks.filter((stock) => stock.active !== 0)
  const topSentiment = stats?.stocks
    ? [...stats.stocks].sort((a, b) => b.avg_sentiment - a.avg_sentiment).slice(0, 6)
    : []

  const stockTickers = useMemo(() => new Set(stocks.map((s) => s.ticker.toUpperCase())), [stocks])

  const ratingsByTicker = useMemo(() => {
    const map = new Map<string, StockpulseRating>()
    ratings.forEach((r) => map.set(r.ticker.toUpperCase(), r))
    return map
  }, [ratings])

  // `/api/ai/ratings` is global and may omit tickers. Make missing ratings explicit for the
  // currently loaded stock list (which already respects `/api/stocks?market=...`).
  const ratingsTable = useMemo(() => {
    if (!stockTickers.size) return []
    const rows: StockpulseRating[] = []
    stocks.forEach((s) => {
      const r = ratingsByTicker.get(s.ticker.toUpperCase())
      if (r) {
        rows.push(r)
      } else {
        rows.push({
          ticker: s.ticker,
          rating: "MISSING",
          score: 0,
          confidence: 0,
          message: "No rating returned yet (still computing or provider unavailable).",
        })
      }
    })
    rows.sort((a, b) => (b.score || 0) - (a.score || 0))
    return rows
  }, [stocks, stockTickers, ratingsByTicker])

  const missingRatings = useMemo(() => {
    return ratingsTable.filter((r) => r.rating === "MISSING").map((r) => r.ticker)
  }, [ratingsTable])

  const computeMissingRatings = useCallback(async () => {
    if (!queryBase) return
    if (!missingRatings.length) {
      toast.success("No missing tickers.")
      return
    }
    const tickers = missingRatings.slice(0, 30) // safety cap
    toast.message(`Computing ${tickers.length} missing ratings...`)

    // Low-concurrency to avoid slamming the backend/LLM.
    const concurrency = 3
    let idx = 0
    async function worker() {
      while (idx < tickers.length) {
        const next = tickers[idx]
        idx += 1
        try {
          await fetchJson(`/api/ai/rating/${encodeURIComponent(next)}`)
        } catch (err) {
          console.warn("compute rating failed", next, err)
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }).map(() => worker()))
    await refreshRatings()
  }, [fetchJson, queryBase, missingRatings, refreshRatings])

  const [explorerRouteId, setExplorerRouteId] = useState<string>(explorerRoutes[0]?.id || "status")
  const [explorerQuery, setExplorerQuery] = useState<Record<string, string>>({})
  const [explorerPathParams, setExplorerPathParams] = useState<Record<string, string>>({})
  const [explorerBody, setExplorerBody] = useState<string>("")
  const [explorerLoading, setExplorerLoading] = useState(false)
  const [explorerResult, setExplorerResult] = useState<ExplorerResult | null>(null)

  const selectedRoute = useMemo(
    () => explorerRoutes.find((r) => r.id === explorerRouteId) || explorerRoutes[0],
    [explorerRoutes, explorerRouteId]
  )

  useEffect(() => {
    if (!selectedRoute) return
    const nextQuery: Record<string, string> = {}
    selectedRoute.query?.forEach((p) => {
      nextQuery[p.name] = ""
    })
    const nextPath: Record<string, string> = {}
    selectedRoute.pathParams?.forEach((p) => {
      nextPath[p.name] = ""
    })
    setExplorerQuery(nextQuery)
    setExplorerPathParams(nextPath)
    setExplorerBody(selectedRoute.bodyExample ? JSON.stringify(selectedRoute.bodyExample, null, 2) : "")
    setExplorerResult(null)
  }, [selectedRoute])

  const runExplorer = useCallback(async () => {
    if (!queryBase || !selectedRoute) return
    setExplorerLoading(true)
    setExplorerResult(null)
    try {
      let path = selectedRoute.path
      Object.entries(explorerPathParams).forEach(([k, v]) => {
        path = path.replace(`{${k}}`, encodeURIComponent((v || "").trim()))
      })
      const qs = new URLSearchParams()
      Object.entries(explorerQuery).forEach(([k, v]) => {
        if (!v || !String(v).trim()) return
        qs.set(k, String(v).trim())
      })
      const url = `${queryBase}${path}${qs.toString() ? `?${qs.toString()}` : ""}`

      const init: RequestInit = { method: selectedRoute.method }
      if (selectedRoute.method === "POST") {
        if (explorerBody.trim()) {
          init.body = explorerBody
          init.headers = { "Content-Type": "application/json" }
        } else {
          init.body = "{}"
          init.headers = { "Content-Type": "application/json" }
        }
      }

      // Use the same helper to get consistent error messages.
      const data = await fetchJson(path + (qs.toString() ? `?${qs.toString()}` : ""), init)
      setExplorerResult({ url, ok: true, status: 200, data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExplorerResult({ url: `${queryBase}${selectedRoute.path}`, ok: false, status: 0, error: msg })
    } finally {
      setExplorerLoading(false)
    }
  }, [fetchJson, queryBase, selectedRoute, explorerBody, explorerQuery, explorerPathParams])

  useEffect(() => {
    if (!ratingsTable.length || selectedTicker) return
    const first = ratingsTable[0].ticker
    setSelectedTicker(first)
    setChartSymbol(first)
    loadRatingDetail(first)
    fetchChart(first, chartPeriod)
  }, [ratingsTable, selectedTicker, loadRatingDetail, fetchChart, chartPeriod])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("stockpulse.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>{t("stockpulse.subtitle")}</div>
          <div className="text-xs text-muted-foreground">{t("stockpulse.attribution")}</div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            {queryBase ? queryBase : t("stockpulse.notConfigured")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!queryBase}
              onClick={refreshCore}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {coreLoading ? t("stockpulse.refreshing") : t("stockpulse.refresh")}
            </Button>
            <Button variant="outline" size="sm" disabled={!queryBase} onClick={checkHealth}>
              Health
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!baseUrl}
              onClick={() => window.open(baseUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("stockpulse.openLegacy")}
            </Button>
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stockpulse.statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={ratingTone(status?.status || "")}>{status?.status || "unknown"}</Badge>
              <span className="text-xs text-muted-foreground">
                {t("stockpulse.updatedAt", { time: formatRelative(status?.last_check || lastUpdated) })}
              </span>
            </div>
            <div className="text-sm">{status?.message || t("stockpulse.statusEmpty")}</div>
            <div className="text-xs text-muted-foreground">
              {t("stockpulse.lastCoreUpdate", { time: formatRelative(lastUpdated) })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stockpulse.statsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Market filter</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="US">US</option>
                <option value="India">India</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("stockpulse.totalAlerts")}</span>
              <span className="font-medium">{stats?.total_alerts_24h ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("stockpulse.activeStocks")}</span>
              <span className="font-medium">
                {activeStocks.length}/{stocks.length}
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground">{t("stockpulse.topSentiment")}</div>
              {topSentiment.length ? (
                <div className="space-y-1">
                  {topSentiment.map((item) => (
                    <div key={item.ticker} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{item.ticker}</span>
                      <span className="text-muted-foreground">
                        {item.avg_sentiment.toFixed(2)} ({item.total_articles})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">{t("stockpulse.empty")}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("stockpulse.ratingsTitle")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={!queryBase || ratingsLoading}
              onClick={refreshRatings}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {ratingsLoading ? t("stockpulse.refreshing") : t("stockpulse.refreshRatings")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {t("stockpulse.ratingsUpdated", { time: formatRelative(ratingsUpdated) })}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-muted-foreground">
                  Coverage: {ratingsTable.length} rows, {missingRatings.length} missing
                </div>
                <Button size="sm" variant="outline" disabled={!missingRatings.length || !queryBase} onClick={computeMissingRatings}>
                  Compute missing now
                </Button>
              </div>
              {missingRatings.length ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  Missing: {missingRatings.slice(0, 20).join(", ")}
                  {missingRatings.length > 20 ? " ..." : ""}
                </div>
              ) : null}
            </div>
            {ratingsTable.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stockpulse.ticker")}</TableHead>
                    <TableHead>{t("stockpulse.rating")}</TableHead>
                    <TableHead>{t("stockpulse.score")}</TableHead>
                    <TableHead>{t("stockpulse.confidence")}</TableHead>
                    <TableHead>{t("stockpulse.price")}</TableHead>
                    <TableHead>{t("stockpulse.rsi")}</TableHead>
                    <TableHead>{t("stockpulse.summary")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ratingsTable.map((rating) => (
                    <TableRow
                      key={rating.ticker}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTicker(rating.ticker)
                        loadRatingDetail(rating.ticker)
                        loadRatingHistory(rating.ticker)
                        setChartSymbol(rating.ticker)
                        fetchChart(rating.ticker, chartPeriod)
                      }}
                    >
                      <TableCell className="font-medium">{rating.ticker}</TableCell>
                      <TableCell>
                        <Badge className={ratingTone(rating.rating)}>{rating.rating}</Badge>
                      </TableCell>
                      <TableCell>{rating.score?.toFixed(1)}</TableCell>
                      <TableCell>{rating.confidence?.toFixed(1)}</TableCell>
                      <TableCell>
                        {rating.current_price && rating.currency_symbol
                          ? `${rating.currency_symbol}${rating.current_price.toFixed(2)}${rating.currency ? ` ${rating.currency}` : ""}`
                          : "-"}
                      </TableCell>
                      <TableCell>{rating.rsi ?? "-"}</TableCell>
                      <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                        {rating.analysis_summary || rating.message || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">{t("stockpulse.noRatings")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Rating detail</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={selectedTicker}
                onChange={(event) => setSelectedTicker(event.target.value.toUpperCase())}
                placeholder="Ticker"
                className="h-8 w-28 text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => loadRatingDetail(selectedTicker)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Load
              </Button>
              <Button size="sm" variant="outline" onClick={() => loadRatingHistory(selectedTicker)} disabled={historyLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                History
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            {detailLoading ? <div>Loading…</div> : null}
            {ratingDetail ? (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-border/50 bg-muted/30 p-3">
                    <div className="text-sm font-semibold text-foreground">{ratingDetail.ticker}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{ratingDetail.analysis_summary || ratingDetail.message}</div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <MetricCard label="Rating" value={ratingDetail.rating} />
                    <MetricCard label="Score" value={ratingDetail.score?.toFixed(1)} />
                    <MetricCard label="Confidence" value={ratingDetail.confidence?.toFixed(1)} />
                    <MetricCard label="RSI" value={ratingDetail.rsi ?? "-"} />
                    <MetricCard label="Sentiment" value={ratingDetail.sentiment_score ?? "-"} />
                    <MetricCard label="Technical" value={ratingDetail.technical_score ?? "-"} />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-xs font-semibold text-foreground">Why (quick)</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <MetricCard label="Articles" value={ratingDetail.sentiment?.total_articles ?? "-"} />
                      <MetricCard label="Avg sentiment" value={ratingDetail.sentiment?.avg_sentiment ?? "-"} />
                      <MetricCard label="RSI signal" value={typeof ratingDetail.rsi === "number" ? (ratingDetail.rsi >= 70 ? "overbought" : ratingDetail.rsi <= 30 ? "oversold" : "neutral") : "-"} />
                      <MetricCard
                        label="MA20"
                        value={
                          ratingDetail.moving_averages?.ma_20
                            ? `${ratingDetail.moving_averages.ma_20.signal || "-"} @ ${ratingDetail.moving_averages.ma_20.value ?? "-"}`
                            : "-"
                        }
                      />
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-xs font-semibold text-foreground">Sentiment mix</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <MetricCard label="Positive" value={ratingDetail.sentiment?.positive_count ?? "-"} />
                      <MetricCard label="Neutral" value={ratingDetail.sentiment?.neutral_count ?? "-"} />
                      <MetricCard label="Negative" value={ratingDetail.sentiment?.negative_count ?? "-"} />
                    </div>
                    {ratingDetail.sentiment?.sources ? (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Sources:{" "}
                        {Object.entries(ratingDetail.sentiment.sources)
                          .slice(0, 6)
                          .map(([name, s]) => `${name}(${s.count ?? 0})`)
                          .join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-foreground">Rating history</div>
                    <div className="text-[11px] text-muted-foreground">{historyLoading ? "Loading…" : `${ratingHistory.length} points`}</div>
                  </div>
                  {ratingHistory.length ? (
                    <div className="mt-3">
                      <ChartFrame height={220} className="min-h-[220px]">
                        {({ width, height }) => (
                          <LineChart width={width} height={height} data={ratingHistory}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                            <XAxis dataKey="ts" tick={{ fontSize: 10 }} minTickGap={22} />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip contentStyle={{ fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Line type="monotone" dataKey="score" stroke="#2563eb" dot={false} strokeWidth={1.6} />
                            <Line type="monotone" dataKey="rsi" stroke="#f97316" dot={false} strokeWidth={1.6} />
                          </LineChart>
                        )}
                      </ChartFrame>
                      <div className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Time (UTC)</TableHead>
                              <TableHead>Rating</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>RSI</TableHead>
                              <TableHead>Price</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ratingHistory.slice(-10).reverse().map((p) => (
                              <TableRow key={`${p.ts}-${p.ticker}`}>
                                <TableCell className="text-xs text-muted-foreground">{p.ts}</TableCell>
                                <TableCell className="text-xs">{p.rating || "-"}</TableCell>
                                <TableCell className="text-xs">{typeof p.score === "number" ? p.score.toFixed(1) : "-"}</TableCell>
                                <TableCell className="text-xs">{p.rsi ?? "-"}</TableCell>
                                <TableCell className="text-xs">
                                  {typeof p.current_price === "number"
                                    ? `${p.current_price.toFixed(2)}${p.currency ? ` ${p.currency}` : ""}`
                                    : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No history yet. It will fill as the service runs.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Select a ticker to view details.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Chart</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={chartSymbol}
                onChange={(event) => setChartSymbol(event.target.value.toUpperCase())}
                placeholder="Ticker"
                className="h-8 w-28 text-xs"
              />
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={chartPeriod}
                onChange={(event) => setChartPeriod(event.target.value)}
              >
                <option value="1mo">1M</option>
                <option value="3mo">3M</option>
                <option value="6mo">6M</option>
                <option value="1y">1Y</option>
                <option value="2y">2Y</option>
                <option value="5y">5Y</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => fetchChart(chartSymbol, chartPeriod)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Load
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            {chartLoading ? <div>Loading…</div> : null}
            {chartData ? (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <MetricCard
                    label="Current"
                    value={
                      typeof chartData.stats?.current_price === "number"
                        ? `${chartData.currency_symbol || ""}${chartData.stats.current_price.toFixed(2)}`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="High"
                    value={
                      typeof chartData.stats?.high_price === "number"
                        ? `${chartData.currency_symbol || ""}${chartData.stats.high_price.toFixed(2)}`
                        : "-"
                    }
                  />
                  <MetricCard
                    label="Low"
                    value={
                      typeof chartData.stats?.low_price === "number"
                        ? `${chartData.currency_symbol || ""}${chartData.stats.low_price.toFixed(2)}`
                        : "-"
                    }
                  />
                </div>
                <ChartFrame height={240} className="min-h-[240px]">
                  {({ width, height }) => (
                    <LineChart width={width} height={height} data={chartData.data}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={16} />
                      <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ fontSize: "11px" }} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Line type="monotone" dataKey="close" stroke="#2563eb" dot={false} strokeWidth={1.6} />
                    </LineChart>
                  )}
                </ChartFrame>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No chart data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">AI chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Ticker</Label>
                <Input value={chatTicker} onChange={(event) => setChatTicker(event.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Question</Label>
                <Input value={chatQuestion} onChange={(event) => setChatQuestion(event.target.value)} placeholder="What is the current setup?" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Thinking level</Label>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={chatThinking}
                onChange={(event) => setChatThinking(event.target.value)}
              >
                <option value="quick">Quick</option>
                <option value="balanced">Balanced</option>
                <option value="deep">Deep</option>
              </select>
              <Button size="sm" variant="outline" onClick={askChat} disabled={chatLoading}>
                {chatLoading ? "Thinking…" : "Ask"}
              </Button>
            </div>
            {chatAnswer ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {chatAnswer}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Ask a question to get AI insight.</div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">AI providers</CardTitle>
            <Button size="sm" variant="outline" onClick={refreshProviders} disabled={aiProviderLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Provider</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={aiProviderForm.provider}
                  onChange={(event) => {
                    const provider = event.target.value
                    const found = AI_PROVIDER_OPTIONS.find((p) => p.id === provider)
                    setAiProviderForm((prev) => ({
                      ...prev,
                      provider,
                      model: found?.models?.[0] || prev.model,
                    }))
                  }}
                >
                  {AI_PROVIDER_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={aiProviderForm.model}
                  onChange={(event) => setAiProviderForm((prev) => ({ ...prev, model: event.target.value }))}
                >
                  {AI_PROVIDER_OPTIONS.find((p) => p.id === aiProviderForm.provider)?.models?.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={aiProviderForm.apiKey}
                  onChange={(event) => setAiProviderForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                  placeholder="Paste API key"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={testProvider} disabled={aiProviderLoading}>
                Test provider
              </Button>
              <Button size="sm" onClick={addProvider} disabled={aiProviderLoading}>
                Save & activate
              </Button>
            </div>
            {aiProviderTest ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                {aiProviderTest.success ? "Test successful" : "Test failed"} {aiProviderTest.message || aiProviderTest.error || ""}
              </div>
            ) : null}
            <div className="rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiProviders.length ? (
                    aiProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.provider_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{provider.model || "-"}</TableCell>
                        <TableCell>
                          <Badge className={provider.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                            {provider.is_active ? "active" : "inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(provider.updated_at)}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => activateProvider(provider.id)}>
                            Activate
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteProvider(provider.id)}>
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        No providers configured yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stockpulse.alertsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length ? (
              alerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{alert.ticker}</span>
                    <span className="text-muted-foreground">{formatRelative(alert.created_at)}</span>
                  </div>
                  <div className="mt-1 text-sm">{alert.message}</div>
                  {alert.title ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {alert.title} {alert.source ? `· ${alert.source}` : ""}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{t("stockpulse.empty")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">{t("stockpulse.newsTitle")}</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={newsTicker}
                onChange={(event) => setNewsTicker(event.target.value)}
                placeholder="Ticker (optional)"
                className="h-8 w-36 text-xs"
              />
              <Button size="sm" variant="outline" onClick={refreshCore}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {news.length ? (
              news.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.ticker}</span>
                    <span className="text-muted-foreground">{formatRelative(item.created_at)}</span>
                  </div>
                  <div className="mt-1 text-sm">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.source ? item.source : ""}{item.sentiment_label ? ` · ${item.sentiment_label}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{t("stockpulse.empty")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("stockpulse.manageTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-foreground">Bulk import</div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={bulkMarket}
                    onChange={(e) => setBulkMarket(e.target.value)}
                  >
                    <option value="US">US</option>
                    <option value="India">India</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!bulkTickers.trim() || !queryBase || bulkLoading}
                    onClick={handleBulkAdd}
                  >
                    {bulkLoading ? "Adding…" : "Bulk add"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={bulkLoading}
                    onClick={() => {
                      try {
                        const raw = localStorage.getItem("openbb_watchlist")
                        const list = raw ? (JSON.parse(raw) as unknown) : []
                        const symbols = Array.isArray(list)
                          ? list.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
                          : []
                        if (!symbols.length) {
                          toast.error("OpenBB watchlist is empty.")
                          return
                        }
                        setBulkMarket("US")
                        setBulkTickers(symbols.join("\n"))
                        toast.success(`Loaded ${symbols.length} tickers from OpenBB watchlist.`)
                      } catch (err) {
                        console.warn("import watchlist failed", err)
                        toast.error("Failed to import OpenBB watchlist.")
                      }
                    }}
                  >
                    Import OpenBB
                  </Button>
                </div>
              </div>
              <textarea
                className="mt-2 min-h-[86px] w-full rounded-md border border-input bg-background p-3 font-mono text-[12px]"
                value={bulkTickers}
                onChange={(e) => setBulkTickers(e.target.value)}
                placeholder={"AAPL MSFT NVDA\nTSLA AMZN\n(whitespace, commas, and new lines all work)"}
              />
              <div className="mt-2 text-[11px] text-muted-foreground">
                Paste tickers (any separators). This is how you scale beyond the default 20 monitored names.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="stock-search">{t("stockpulse.searchLabel")}</Label>
                <Input
                  id="stock-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("stockpulse.searchPlaceholder")}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!searchQuery.trim() || searchLoading}
                  onClick={handleSearch}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {searchLoading ? t("stockpulse.searching") : t("stockpulse.search")}
                </Button>
              </div>
            </div>

            {searchResults.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("stockpulse.ticker")}</TableHead>
                      <TableHead>{t("stockpulse.name")}</TableHead>
                      <TableHead>{t("stockpulse.exchange")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((result) => (
                      <TableRow key={result.ticker}>
                        <TableCell className="font-medium">{result.ticker}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{result.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{result.exchange || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddStock(result)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t("stockpulse.add")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stockpulse.ticker")}</TableHead>
                    <TableHead>{t("stockpulse.name")}</TableHead>
                    <TableHead>{t("stockpulse.market")}</TableHead>
                    <TableHead>{t("stockpulse.added")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeStocks.length ? (
                    activeStocks.map((stock) => (
                      <TableRow key={stock.ticker}>
                        <TableCell className="font-medium">{stock.ticker}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{stock.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{stock.market}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelative(stock.added_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveStock(stock.ticker)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("stockpulse.remove")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        {t("stockpulse.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Explorer</CardTitle>
            <Button size="sm" variant="outline" disabled={!queryBase || explorerLoading} onClick={runExplorer}>
              {explorerLoading ? "Running..." : "Run"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Explore every StockPulse backend route with parameters and inspect results (tables first, raw JSON optional).
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Route</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={explorerRouteId}
                  onChange={(e) => setExplorerRouteId(e.target.value)}
                >
                  {explorerRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.method} {r.path})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground">{selectedRoute?.description}</div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                <div className="font-medium">Endpoint</div>
                <div className="mt-1 break-all text-muted-foreground">{queryBase ? `${queryBase}${selectedRoute?.path}` : "-"}</div>
              </div>
            </div>

            {selectedRoute?.pathParams?.length ? (
              <div className="grid gap-2 md:grid-cols-3">
                {selectedRoute.pathParams.map((p) => (
                  <div key={p.name} className="space-y-1">
                    <Label className="text-xs">{p.name}</Label>
                    <Input
                      value={explorerPathParams[p.name] || ""}
                      onChange={(e) => setExplorerPathParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                      placeholder={p.placeholder || ""}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {selectedRoute?.query?.length ? (
              <div className="grid gap-2 md:grid-cols-3">
                {selectedRoute.query.map((p) => (
                  <div key={p.name} className="space-y-1">
                    <Label className="text-xs">{p.name}</Label>
                    <Input
                      value={explorerQuery[p.name] || ""}
                      onChange={(e) => setExplorerQuery((prev) => ({ ...prev, [p.name]: e.target.value }))}
                      placeholder={p.placeholder || ""}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {selectedRoute?.method === "POST" ? (
              <div className="space-y-1">
                <Label>JSON body</Label>
                <textarea
                  className="min-h-[140px] w-full rounded-md border border-input bg-background p-3 font-mono text-[12px]"
                  value={explorerBody}
                  onChange={(e) => setExplorerBody(e.target.value)}
                  placeholder='{"ticker":"AAPL"}'
                />
              </div>
            ) : null}

            {explorerResult ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Result from: {explorerResult.url}</div>
                {explorerResult.ok ? null : (
                  <div className="mt-2 text-xs text-destructive">{explorerResult.error || "Request failed."}</div>
                )}
	                {Array.isArray(explorerResult.data) ? (
	                  <div className="mt-3 overflow-x-auto rounded-md border border-border/60 bg-background">
	                    <Table>
	                      <TableHeader>
	                        <TableRow>
	                          {Object.keys((((explorerResult.data as any[])[0] || {}) as any))
	                            .slice(0, 8)
	                            .map((k) => (
	                              <TableHead key={k}>{k}</TableHead>
	                            ))}
	                        </TableRow>
	                      </TableHeader>
	                      <TableBody>
	                        {(explorerResult.data as any[]).slice(0, 20).map((row, idx) => (
	                          <TableRow key={idx}>
	                            {Object.keys((((explorerResult.data as any[])[0] || {}) as any))
	                              .slice(0, 8)
	                              .map((k) => (
	                                <TableCell key={k} className="text-xs text-muted-foreground">
	                                  {renderAny((row as any)[k])}
	                                </TableCell>
	                              ))}
	                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : explorerResult.data && typeof explorerResult.data === "object" ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {Object.entries(explorerResult.data as any)
                      .slice(0, 12)
                      .map(([k, v]) => (
                        <MetricCard key={k} label={k} value={v} />
                      ))}
                  </div>
                ) : null}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Raw JSON</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-background p-3 text-[12px] text-foreground">
                    {JSON.stringify(explorerResult.data, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
