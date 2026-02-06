import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { ExternalLink, RefreshCw, PlayCircle, Search, FlaskConical, Info, Activity, ListChecks, Newspaper, AlertTriangle } from "lucide-react"

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

type FinnewsHealth = {
  status?: string
  app?: string
  version?: string
}

type NewsItem = {
  id: string | number
  title: string
  content?: string | null
  url: string
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

export default function FinnewsPage() {
  const { t } = useTranslation()
  const baseUrl = useMemo(() => resolveFinnewsUrl(), [])
  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const queryBase = proxyBase ? `${proxyBase}/v1/finnews` : baseUrl

  const [health, setHealth] = useState<FinnewsHealth | null>(null)
  const [latest, setLatest] = useState<NewsItem[]>([])
  const [tasks, setTasks] = useState<FinnewsTask[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [providerTest, setProviderTest] = useState<ProviderTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [crawlLoading, setCrawlLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchSource, setSearchSource] = useState<string | undefined>(undefined)
  const [searchLimit, setSearchLimit] = useState(defaultLimit)
  const [searchResults, setSearchResults] = useState<NewsItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

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

  const fetchJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!queryBase) {
        throw new Error(t("finnews.notConfigured"))
      }
      const res = await fetch(`${queryBase}${path}`.replace(/\s+/g, "%20"), {
        headers: {
          "Content-Type": "application/json",
        },
        ...init,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
      }
      if (res.status === 204) return null
      return res.json()
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
      const items: NewsItem[] = Array.isArray(data?.data) ? data.data : []
      setSearchResults(items)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSearchLoading(false)
    }
  }, [fetchJson, searchQuery, searchSource, searchLimit])

  const loadDetail = useCallback(
    async (id: string | number) => {
      setDetailError(null)
      setNewsDetail(null)
      try {
        const data = await fetchJson(`/api/v1/news/${id}`)
        setNewsDetail(data)
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Unknown error")
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

      <Tabs defaultValue="overview" className="space-y-4">
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
                      <TableHead>{t("finnews.source")}</TableHead>
                      <TableHead>{t("finnews.published")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latest.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[520px]">
                          <button
                            className="text-left text-sm font-medium text-foreground hover:underline"
                            onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                          >
                            {item.title}
                          </button>
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
                  <option value="us_rss">US news RSS</option>
                  <option value="sec_edgar">SEC EDGAR</option>
                  <option value="yahoo_finance">Yahoo Finance</option>
                  <option value="seeking_alpha">Seeking Alpha</option>
                  <option value="marketwatch">MarketWatch</option>
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
              {detailError ? <div className="text-xs text-destructive">{detailError}</div> : null}
              <div className="h-80 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Headline</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => {
                          loadDetail(item.id)
                        }}
                      >
                        <TableCell className="max-w-[520px] text-sm font-medium text-foreground">
                          {item.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.source}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatRelative(item.publish_time || item.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {newsDetail ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
                  <div className="font-semibold">{newsDetail.title}</div>
                  <div className="text-muted-foreground">{newsDetail.source}</div>
                  <div className="text-muted-foreground">{formatRelative(newsDetail.publish_time || newsDetail.created_at)}</div>
                  <Separator />
                  <div className="whitespace-pre-wrap text-sm">{newsDetail.content || "(no content)"}</div>
                  <div>
                    <Button variant="link" size="sm" onClick={() => window.open(newsDetail.url, "_blank", "noopener,noreferrer")}>
                      Open source
                    </Button>
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
