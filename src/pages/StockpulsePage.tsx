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
      const [statusData, statsData, alertsData, newsData, stocksData] = await Promise.all([
        fetchJson("/api/status"),
        fetchJson("/api/stats"),
        fetchJson("/api/alerts"),
        fetchJson("/api/news"),
        fetchJson("/api/stocks"),
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
  }, [fetchJson, queryBase])

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
    const id = setInterval(refreshCore, 30000)
    return () => clearInterval(id)
  }, [queryBase, refreshCore, refreshRatings])

  const activeStocks = stocks.filter((stock) => stock.active !== 0)
  const topSentiment = stats?.stocks
    ? [...stats.stocks].sort((a, b) => b.avg_sentiment - a.avg_sentiment).slice(0, 6)
    : []

  const ratingsSorted = ratings.length
    ? [...ratings].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12)
    : []

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
                    <TableRow key={rating.ticker}>
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
          <CardHeader>
            <CardTitle className="text-base">{t("stockpulse.newsTitle")}</CardTitle>
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
