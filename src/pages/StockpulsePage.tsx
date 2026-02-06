import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { ExternalLink, RefreshCw, Search, Trash2, Plus } from "lucide-react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"

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
  currency_symbol?: string | null
  rsi?: number | null
  sentiment_score?: number | null
  technical_score?: number | null
  analysis_summary?: string | null
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
    if (value === null || value === undefined) return "-"
    if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : "-"
    if (typeof value === "string") return value
    return JSON.stringify(value)
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
  const baseUrl = useMemo(() => resolveStockpulseUrl(), [])
  const proxyBase = useMemo(() => {
    const proxy = resolveMarketDataProxyUrl()
    if (proxy) return proxy
    const gateway = (import.meta.env.VITE_MARKET_DATA_GATEWAY_URL || "").trim()
    return gateway.replace(/\/+$/, "")
  }, [])
  const queryBase = proxyBase ? `${proxyBase}/v1/stockpulse` : baseUrl

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

  const [marketFilter, setMarketFilter] = useState("All")
  const [newsTicker, setNewsTicker] = useState("")
  const [selectedTicker, setSelectedTicker] = useState<string>("")
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

  const fetchJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!queryBase) {
        throw new Error(t("stockpulse.notConfigured"))
      }
      const res = await fetch(`${queryBase}${path}`, {
        headers: {
          "Content-Type": "application/json",
        },
        ...init,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
      }
      return res.json()
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
      setStocks(stocksData)
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
      const data = await fetchJson("/api/ai/ratings")
      setRatings(data)
      setRatingsUpdated(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRatingsLoading(false)
    }
  }, [fetchJson, queryBase])

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
      setChatAnswer(data?.answer || data?.error || "No response.")
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
        await fetchJson("/api/stocks", {
          method: "POST",
          body: JSON.stringify({
            ticker: result.ticker,
            name: result.name || result.ticker,
            market: "US",
          }),
        })
        await refreshCore()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    },
    [fetchJson, refreshCore]
  )

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

  const ratingsSorted = ratings.length
    ? [...ratings].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12)
    : []

  useEffect(() => {
    if (!ratingsSorted.length || selectedTicker) return
    const first = ratingsSorted[0].ticker
    setSelectedTicker(first)
    setChartSymbol(first)
    loadRatingDetail(first)
    fetchChart(first, chartPeriod)
  }, [ratingsSorted, selectedTicker, loadRatingDetail, fetchChart, chartPeriod])

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
              <span className="font-medium">{activeStocks.length}</span>
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
            {ratingsSorted.length ? (
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
                  {ratingsSorted.map((rating) => (
                    <TableRow
                      key={rating.ticker}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTicker(rating.ticker)
                        loadRatingDetail(rating.ticker)
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
                          ? `${rating.currency_symbol}${rating.current_price.toFixed(2)}`
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
                  <MetricCard label="Current" value={chartData.stats?.current_price} />
                  <MetricCard label="High" value={chartData.stats?.high_price} />
                  <MetricCard label="Low" value={chartData.stats?.low_price} />
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer>
                    <LineChart data={chartData.data}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={16} />
                      <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ fontSize: "11px" }} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Line type="monotone" dataKey="close" stroke="#2563eb" dot={false} strokeWidth={1.6} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
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
      </div>
    </div>
  )
}
