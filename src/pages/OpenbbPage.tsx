import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { resolveOpenbbApiUrl, resolveMarketDataProxyUrl } from "@/lib/runtime-urls"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts"

type ResponseState = {
  url: string
  status: number
  ok: boolean
  data: unknown
  error?: string
}

type ApiParam = {
  name: string
  in: "query" | "path" | string
  required?: boolean
  schema?: { enum?: string[]; type?: string; format?: string; default?: unknown }
  description?: string
}

type ApiOperation = {
  id: string
  path: string
  method: string
  tag: string
  summary?: string
  params: ApiParam[]
}

// Only expose providers that are marked enabled in env (comma‑separated).
function resolveProviders() {
  const allowed = new Set(["yfinance", "intrinio"]) // FMP deliberately hidden until credentials validate (401 currently)
  const raw = (import.meta.env.VITE_OPENBB_PROVIDERS || "").trim()
  if (!raw) return ["yfinance"]
  const parsed = raw
    .split(",")
    .map((p: string) => p.trim())
    .filter((p: string) => allowed.has(p))
  return parsed.length ? parsed : ["yfinance"]
}

const AVAILABLE_QUOTE_PROVIDERS = resolveProviders()
const DEFAULT_QUOTE_PROVIDER = AVAILABLE_QUOTE_PROVIDERS[0]

function buildUrl(base: string, path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(path, base)
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

function renderValue(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number" && Number.isFinite(value)) return value.toString()
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function renderTable(data: unknown) {
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object") return null
  const rows = data.slice(0, 20) as Record<string, unknown>[]
  const columns = Object.keys(rows[0]).slice(0, 8)
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${idx}`} className="border-t border-border/60">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-foreground">
                  {renderValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderLineChart(data: unknown, xKey = "date", yKeys: string[] = []) {
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object") return null
  const rows = data as Record<string, unknown>[]
  const numericKeys = yKeys.length
    ? yKeys
    : Object.keys(rows[0]).filter((k) => typeof rows[0][k] === "number")
  if (!numericKeys.length) return null
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} minTickGap={16} />
          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ fontSize: "11px" }} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          {numericKeys.slice(0, 4).map((k, idx) => (
            <Line key={k} type="monotone" dataKey={k} stroke={['#2563eb', '#16a34a', '#f97316', '#a855f7'][idx % 4]} dot={false} strokeWidth={1.6} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ResponseCard({ title, result }: { title: string; result?: ResponseState }) {
  if (!result) return null
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px]">
          {result.url}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Status: {result.status}</span>
          <span>{result.ok ? "OK" : "Error"}</span>
        </div>
        {result.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {result.error}
          </div>
        ) : null}
        {renderTable(result.data)}
        <pre className="max-h-72 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

export default function OpenbbPage() {
  const { t } = useTranslation()
  const apiUrl = useMemo(() => resolveOpenbbApiUrl(), [])
  const proxyBase = useMemo(() => {
    const proxy = resolveMarketDataProxyUrl()
    if (proxy) return proxy
    const gateway = (import.meta.env.VITE_MARKET_DATA_GATEWAY_URL || "").trim()
    return gateway.replace(/\/+$/, "")
  }, [])
  const queryBase = proxyBase ? `${proxyBase}/v1/openbb` : apiUrl

  // Custom request (kept for advanced users)
  const [customPath, setCustomPath] = useState("/api/v1/equity/price/quote")
  const [customQuery, setCustomQuery] = useState(
    JSON.stringify({ symbol: "AAPL", provider: DEFAULT_QUOTE_PROVIDER }, null, 2)
  )
  const [customResult, setCustomResult] = useState<ResponseState>()
  const [customLoading, setCustomLoading] = useState(false)

  // Quick lookup and favorites
  const [quickSymbols, setQuickSymbols] = useState("AAPL, MSFT")
  const [quickProvider, setQuickProvider] = useState(DEFAULT_QUOTE_PROVIDER)
  const [quickRange, setQuickRange] = useState("1M")
  const [quickQuotes, setQuickQuotes] = useState<Record<string, any>[]>([])
  const [quickHistory, setQuickHistory] = useState<Record<string, any>[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [savedQueries, setSavedQueries] = useState<{ symbols: string; range: string; provider: string }[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [historyLog, setHistoryLog] = useState<{ symbols: string; range: string; provider: string; ts: number }[]>([])
  const [comparisonSymbols, setComparisonSymbols] = useState("AAPL, MSFT")
  const [comparisonData, setComparisonData] = useState<Record<string, any>[]>([])
  const [fundamentals, setFundamentals] = useState<Record<string, any> | null>(null)
  const [technicals, setTechnicals] = useState<Record<string, any> | null>(null)
  const [fundLoading, setFundLoading] = useState(false)
  const [techLoading, setTechLoading] = useState(false)
  const [fundSymbol, setFundSymbol] = useState("AAPL")
  const [techSymbol, setTechSymbol] = useState("AAPL")
  const [macroData, setMacroData] = useState<Record<string, any> | null>(null)
  const [cryptoData, setCryptoData] = useState<Record<string, any> | null>(null)
  const [commodityData, setCommodityData] = useState<Record<string, any> | null>(null)

  const [specOps, setSpecOps] = useState<ApiOperation[]>([])
  const [specError, setSpecError] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [selectedOpId, setSelectedOpId] = useState<string>("")
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [explorerResult, setExplorerResult] = useState<ResponseState>()
  const [explorerLoading, setExplorerLoading] = useState(false)

  const runRequest = async (
    path: string,
    params: Record<string, string | number | undefined>,
    setter: (state: ResponseState) => void,
    setLoading: (value: boolean) => void
  ) => {
    if (!queryBase) {
      setter({ url: "", status: 0, ok: false, data: null, error: t("openbb.notConfigured") })
      return
    }
    const url = buildUrl(queryBase, path, params)
    setLoading(true)
    try {
      const res = await fetch(url)
      const text = await res.text()
      let data: unknown = null
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
      const status = res.status
      const asString = typeof data === "string" ? data : ""
      const noData = res.ok && ((Array.isArray(data) && data.length === 0) || data === null)
      const errorMsg = (() => {
        if (noData) return "Provider returned no data. Try another provider."
        if (!res.ok) {
          if (status === 401) return "Authentication failed (401). Check provider credentials."
          if (status === 403) return "Access denied (403). Provider limit reached."
          return asString || `Provider error (${status})`
        }
        return undefined
      })()
      if (errorMsg) toast.error(errorMsg)
      if (!res.ok) console.error("OpenBB error", { status, data })
      setter({
        url,
        status: res.status,
        ok: res.ok,
        data,
        error: errorMsg,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
      setter({
        url,
        status: 0,
        ok: false,
        data: null,
        error: message,
      })
    } finally {
      setLoading(false)
    }
  }

  // Load OpenAPI spec to expose every OpenBB endpoint
  useEffect(() => {
    const loadSpec = async () => {
      if (!queryBase) return
      try {
        setSpecError(null)
        const res = await fetch(`${queryBase}/openapi.json`)
        if (!res.ok) throw new Error(`openapi fetch failed (${res.status})`)
        const json = await res.json()
        const paths: Record<string, Record<string, any>> = json.paths || {}
        const ops: ApiOperation[] = []
        Object.entries(paths).forEach(([path, methods]) => {
          Object.entries(methods || {}).forEach(([method, def]) => {
            if (!def || typeof def !== "object") return
            const params: ApiParam[] = Array.isArray(def.parameters) ? def.parameters : []
            const tag = Array.isArray(def.tags) && def.tags.length ? def.tags[0] : "other"
            const id = `${method.toUpperCase()} ${path}`
            ops.push({
              id,
              path,
              method: method.toUpperCase(),
              tag,
              summary: def.summary || def.description || path,
              params,
            })
          })
        })
        setSpecOps(ops)
        const firstTag = ops[0]?.tag || ""
        setSelectedTag(firstTag)
        const firstOp = ops.find((op) => op.tag === firstTag) || ops[0]
        setSelectedOpId(firstOp?.id || "")
        setParamValues({})
      } catch (err) {
        setSpecError(err instanceof Error ? err.message : "Failed to load OpenBB spec")
      }
    }
    loadSpec()
  }, [queryBase])

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    specOps.forEach((op) => tags.add(op.tag || "other"))
    return Array.from(tags)
  }, [specOps])

  const filteredOps = useMemo(() => {
    return specOps.filter((op) => (selectedTag ? op.tag === selectedTag : true))
  }, [specOps, selectedTag])

  const selectedOp = useMemo(() => filteredOps.find((op) => op.id === selectedOpId) || filteredOps[0], [filteredOps, selectedOpId])

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }))
  }

  const runExplorer = async () => {
    if (!selectedOp || !queryBase) return
    const pathParams: Record<string, string> = {}
    const queryParams: Record<string, string | number | undefined> = {}
    selectedOp.params.forEach((p) => {
      const val = paramValues[p.name]
      if (!val) return
      if (p.in === "path") pathParams[p.name] = val
      else if (p.in === "query") queryParams[p.name] = val
    })
    let finalPath = selectedOp.path
    Object.entries(pathParams).forEach(([key, val]) => {
      finalPath = finalPath.replace(`{${key}}`, encodeURIComponent(val))
    })
    await runRequest(finalPath, queryParams, setExplorerResult, setExplorerLoading)
  }

  const computeStartDate = (range: string) => {
    const now = new Date()
    const copy = new Date(now)
    const lower = range.toUpperCase()
    if (lower === "1D" || lower === "1DAY") return undefined
    if (lower === "5D") copy.setDate(now.getDate() - 5)
    else if (lower === "1M") copy.setMonth(now.getMonth() - 1)
    else if (lower === "3M") copy.setMonth(now.getMonth() - 3)
    else if (lower === "6M") copy.setMonth(now.getMonth() - 6)
    else if (lower === "1Y") copy.setFullYear(now.getFullYear() - 1)
    else if (lower === "5Y") copy.setFullYear(now.getFullYear() - 5)
    else return undefined
    return copy.toISOString().slice(0, 10)
  }

  const runQuickLookup = async () => {
    if (!queryBase) {
      toast.error(t("openbb.notConfigured"))
      return
    }
    const symbols = quickSymbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    if (!symbols.length) {
      toast.error("Enter at least one symbol")
      return
    }
    setQuickLoading(true)
    setQuickQuotes([])
    setQuickHistory([])
    try {
      const startDate = computeStartDate(quickRange)
      const histPromises = symbols.map((sym) =>
        fetch(buildUrl(queryBase, "/api/v1/equity/price/historical", { symbol: sym, provider: quickProvider, interval: "1d", start_date: startDate })).then(async (r) => ({
          sym,
          status: r.status,
          ok: r.ok,
          data: await r.json().catch(() => null),
        }))
      )
      const quotePromises = symbols.map((sym) =>
        fetch(buildUrl(queryBase, "/api/v1/equity/price/quote", { symbol: sym, provider: quickProvider })).then(async (r) => ({
          sym,
          status: r.status,
          ok: r.ok,
          data: await r.json().catch(() => null),
        }))
      )
      const [quotes, history] = await Promise.all([Promise.all(quotePromises), Promise.all(histPromises)])
      const okQuotes = quotes.filter((q) => q.ok)
      const okHist = history.filter((h) => h.ok)
      setQuickQuotes(okQuotes)
      setQuickHistory(okHist)
      setHistoryLog((prev) => [{ symbols: quickSymbols, range: quickRange, provider: quickProvider, ts: Date.now() }, ...prev].slice(0, 20))
      // Fetch fundamentals/technicals for the first symbol to enrich cards
      const primary = symbols[0]
      if (primary) {
        fetch(buildUrl(queryBase, "/api/v1/equity/profile", { symbol: primary, provider: quickProvider }))
          .then((r) => r.json().catch(() => null))
          .then((data) => setFundamentals(data))
          .catch(() => setFundamentals(null))
        fetch(buildUrl(queryBase, "/api/v1/technical/relative_strength_index", { symbol: primary, interval: "1d", length: 14, provider: quickProvider }))
          .then((r) => r.json().catch(() => null))
          .then((data) => setTechnicals(data))
          .catch(() => setTechnicals(null))
      }
      quotes.filter((q) => !q.ok).forEach((q) => toast.error(`${q.sym}: ${q.status}`))
      history.filter((h) => !h.ok).forEach((h) => toast.error(`${h.sym}: ${h.status}`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quick lookup failed")
    } finally {
      setQuickLoading(false)
    }
  }

  const runComparison = async () => {
    if (!queryBase) {
      toast.error(t("openbb.notConfigured"))
      return
    }
    const symbols = comparisonSymbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    if (!symbols.length) {
      toast.error("Enter symbols to compare")
      return
    }
    setComparisonData([])
    try {
      const res = await Promise.all(
        symbols.map((sym) =>
          fetch(buildUrl(queryBase, "/api/v1/equity/price/quote", { symbol: sym, provider: quickProvider })).then(async (r) => ({
            sym,
            ok: r.ok,
            status: r.status,
            data: await r.json().catch(() => null),
          }))
        )
      )
      const ok = res.filter((r) => r.ok)
      setComparisonData(ok)
      res.filter((r) => !r.ok).forEach((r) => toast.error(`${r.sym}: ${r.status}`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed")
    }
  }

  const fetchFundamentals = async () => {
    if (!queryBase) {
      toast.error(t("openbb.notConfigured"))
      return
    }
    setFundLoading(true)
    try {
      const profile = await fetch(buildUrl(queryBase, "/api/v1/equity/profile", { symbol: fundSymbol, provider: quickProvider })).then((r) => r.json().catch(() => null))
      const income = await fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/income", { symbol: fundSymbol, provider: quickProvider })).then((r) => r.json().catch(() => null))
      const balance = await fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/balance", { symbol: fundSymbol, provider: quickProvider })).then((r) => r.json().catch(() => null))
      const cash = await fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/cash_flow", { symbol: fundSymbol, provider: quickProvider })).then((r) => r.json().catch(() => null))
      setFundamentals({ profile, income, balance, cash })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fundamentals failed")
    } finally {
      setFundLoading(false)
    }
  }

  const fetchTechnicals = async () => {
    if (!queryBase) {
      toast.error(t("openbb.notConfigured"))
      return
    }
    setTechLoading(true)
    try {
      const rsi = await fetch(buildUrl(queryBase, "/api/v1/technical/relative_strength_index", { symbol: techSymbol, interval: "1d", length: 14, provider: quickProvider })).then((r) => r.json().catch(() => null))
      const ma = await fetch(buildUrl(queryBase, "/api/v1/technical/moving_average", { symbol: techSymbol, interval: "1d", length: 20, provider: quickProvider })).then((r) => r.json().catch(() => null))
      const bb = await fetch(buildUrl(queryBase, "/api/v1/technical/bollinger_bands", { symbol: techSymbol, interval: "1d", length: 20, std: 2, provider: quickProvider })).then((r) => r.json().catch(() => null))
      setTechnicals({ rsi, ma, bb })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Technical fetch failed")
    } finally {
      setTechLoading(false)
    }
  }

  const fetchMacro = async () => {
    if (!queryBase) return
    try {
      const res = await fetch(buildUrl(queryBase, "/api/v1/commodity/price/spot", { commodity: "wti", provider: "fred" }))
      const data = await res.json().catch(() => null)
      setMacroData(data)
    } catch {
      setMacroData(null)
    }
  }

  const fetchCrypto = async (symbol = "BTC-USD") => {
    if (!queryBase) return
    try {
      const res = await fetch(buildUrl(queryBase, "/api/v1/crypto/price/historical", { symbol, interval: "1d", provider: quickProvider }))
      const data = await res.json().catch(() => null)
      setCryptoData(data)
    } catch {
      setCryptoData(null)
    }
  }

  const fetchCommodities = async () => {
    if (!queryBase) return
    try {
      const res = await fetch(buildUrl(queryBase, "/api/v1/commodity/price/spot", { commodity: "brent", provider: "fred" }))
      const data = await res.json().catch(() => null)
      setCommodityData(data)
    } catch {
      setCommodityData(null)
    }
  }

  const saveCurrentQuick = () => {
    const exists = savedQueries.some((q) => q.symbols === quickSymbols && q.range === quickRange && q.provider === quickProvider)
    if (exists) return
    setSavedQueries((prev) => [{ symbols: quickSymbols, range: quickRange, provider: quickProvider }, ...prev].slice(0, 10))
  }

  // Persistence for watchlist/history/saved queries
  useEffect(() => {
    try {
      const storedWatch = localStorage.getItem("openbb_watchlist")
      const storedHist = localStorage.getItem("openbb_history")
      const storedSaved = localStorage.getItem("openbb_saved")
      if (storedWatch) setWatchlist(JSON.parse(storedWatch))
      if (storedHist) setHistoryLog(JSON.parse(storedHist))
      if (storedSaved) setSavedQueries(JSON.parse(storedSaved))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("openbb_watchlist", JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    localStorage.setItem("openbb_history", JSON.stringify(historyLog))
  }, [historyLog])

  useEffect(() => {
    localStorage.setItem("openbb_saved", JSON.stringify(savedQueries))
  }, [savedQueries])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("openbb.consoleTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>{t("openbb.consoleSubtitle")}</div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            {apiUrl ? apiUrl : t("openbb.notConfigured")}
          </div>
          {apiUrl ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`${apiUrl}/docs`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("openbb.openDocs")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(apiUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("openbb.openApi")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="quick" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="quick">Quick lookup</TabsTrigger>
          <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
          <TabsTrigger value="technicals">Technicals</TabsTrigger>
          <TabsTrigger value="macro">Macro</TabsTrigger>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
          <TabsTrigger value="commodities">Commodities</TabsTrigger>
          <TabsTrigger value="explorer">Explorer</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Command bar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2">
                  <Label>Symbols (comma separated)</Label>
                  <Input value={quickSymbols} onChange={(e) => setQuickSymbols(e.target.value)} placeholder="AAPL, MSFT, NVDA" />
                </div>
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={quickProvider}
                    onChange={(e) => setQuickProvider(e.target.value)}
                  >
                    {AVAILABLE_QUOTE_PROVIDERS.map((p: string) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Range</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={quickRange}
                    onChange={(e) => setQuickRange(e.target.value)}
                  >
                    <option value="1D">1D</option>
                    <option value="5D">5D</option>
                    <option value="1M">1M</option>
                    <option value="3M">3M</option>
                    <option value="6M">6M</option>
                    <option value="1Y">1Y</option>
                    <option value="5Y">5Y</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={runQuickLookup} disabled={quickLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {quickLoading ? "Fetching…" : "Run lookup"}
                </Button>
                <Button size="sm" variant="outline" onClick={saveCurrentQuick}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const sym = quickSymbols.trim().toUpperCase()
                    if (!sym) return
                    setWatchlist((prev) => {
                      const merged = new Set(prev)
                      sym
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .forEach((s) => merged.add(s))
                      return Array.from(merged).slice(0, 50)
                    })
                    toast.success("Added to watchlist")
                  }}
                >
                  Add to watchlist
                </Button>
                {savedQueries.length ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {savedQueries.map((q, idx) => (
                      <button
                        key={`${q.symbols}-${idx}`}
                        className="rounded-full border px-3 py-1 hover:bg-muted"
                        onClick={() => {
                          setQuickSymbols(q.symbols)
                          setQuickRange(q.range)
                          setQuickProvider(q.provider)
                        }}
                      >
                        {q.symbols} · {q.range} · {q.provider}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {quickQuotes.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Quotes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <div className="grid gap-3 md:grid-cols-2">
                        {quickQuotes.map((q) => {
                          const payload = Array.isArray(q.data?.results) ? q.data.results[0] : q.data?.results?.[0] || q.data || {}
                          return (
                            <div key={q.sym} className="rounded-md border border-border/50 bg-muted/40 p-3 space-y-2">
                              <div className="text-sm font-semibold text-foreground">{q.sym}</div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                <span>Last</span>
                                <span className="text-foreground font-medium">{renderValue(payload.last_price)}</span>
                                <span>Bid / Ask</span>
                                <span className="text-foreground font-medium">
                                  {renderValue(payload.bid)} / {renderValue(payload.ask)}
                                </span>
                                <span>Change</span>
                                <span className="text-foreground font-medium">{renderValue(payload.change_percent || payload.change)}</span>
                                <span>Volume</span>
                                <span className="text-foreground font-medium">{renderValue(payload.volume)}</span>
                                <span>High / Low</span>
                                <span className="text-foreground font-medium">
                                  {renderValue(payload.high)} / {renderValue(payload.low)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                {quickHistory.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Historical</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      {quickHistory.map((h) => (
                        <div key={h.sym} className="rounded-md border border-border/50 bg-muted/40 p-2">
                          <div className="text-sm font-semibold text-foreground">{h.sym}</div>
                          {renderLineChart(h.data, "date") || renderTable(h.data)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="text-sm">Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="md:col-span-2 space-y-1">
                        <Label>Compare symbols</Label>
                        <Input value={comparisonSymbols} onChange={(e) => setComparisonSymbols(e.target.value)} placeholder="AAPL, MSFT, GOOGL" />
                      </div>
                      <div className="space-y-1">
                        <Label>Provider</Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={quickProvider}
                          onChange={(e) => setQuickProvider(e.target.value)}
                        >
                          {AVAILABLE_QUOTE_PROVIDERS.map((p: string) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button size="sm" onClick={runComparison} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" /> Compare
                    </Button>
                    {comparisonData.length ? (
                      <div className="space-y-3 text-xs text-muted-foreground">
                        {renderTable(comparisonData.map((c) => ({ symbol: c.sym, ...(Array.isArray(c.data) ? c.data[0] || {} : c.data || {}) })))}\n"
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                {quickHistory.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Quick chart</CardTitle>
                    </CardHeader>
                    <CardContent>{renderLineChart(quickHistory[0]?.data, "date")}</CardContent>
                  </Card>
                ) : null}
              </div>
              {historyLog.length || watchlist.length ? (
                <div className="grid gap-4 lg:grid-cols-2 text-xs text-muted-foreground">
                  {watchlist.length ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">Watchlist</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {watchlist.map((s) => (
                            <span key={s} className="rounded-full border px-2 py-1">
                              {s}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                  {historyLog.length ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">History</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="space-y-2">
                          {historyLog.slice(0, 10).map((h) => (
                            <div key={`${h.ts}-${h.symbols}`} className="rounded-md border border-border/40 bg-muted/30 p-2">
                              <div className="text-foreground">{h.symbols}</div>
                              <div className="text-[11px] text-muted-foreground">{h.range} · {h.provider}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explorer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Explorer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {specError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  {specError}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tag</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedTag}
                    onChange={(e) => {
                      const tag = e.target.value
                      setSelectedTag(tag)
                      const first = specOps.find((op) => op.tag === tag)
                      setSelectedOpId(first?.id || "")
                      setParamValues({})
                      setExplorerResult(undefined)
                    }}
                  >
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Endpoint</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedOpId}
                    onChange={(e) => {
                      setSelectedOpId(e.target.value)
                      setParamValues({})
                      setExplorerResult(undefined)
                    }}
                  >
                {filteredOps.map((op: ApiOperation) => (
                  <option key={op.id} value={op.id}>
                    {op.method} {op.path} · {op.summary || op.tag}
                  </option>
                ))}
                  </select>
                </div>
              </div>
              {selectedOp ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {selectedOp.method} {selectedOp.path} · {selectedOp.summary || ""}
                  </div>
                  {selectedOp.params.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedOp.params.map((p) => {
                        const enumValues = p.schema?.enum
                        const type = p.schema?.type || ""
                        const format = p.schema?.format || ""
                        const val = paramValues[p.name] || ""
                        const label = `${p.name}${p.required ? " *" : ""}`
                        if (enumValues && enumValues.length) {
                          return (
                            <div key={p.name} className="space-y-1">
                              <Label>{label}</Label>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={val}
                                onChange={(e) => handleParamChange(p.name, e.target.value)}
                              >
                                <option value="">(unset)</option>
                                {enumValues.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                              {p.description ? <div className="text-[11px] text-muted-foreground">{p.description}</div> : null}
                            </div>
                          )
                        }
                        if (type === "boolean") {
                          return (
                            <div key={p.name} className="space-y-1">
                              <Label>{label}</Label>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={val}
                                onChange={(e) => handleParamChange(p.name, e.target.value)}
                              >
                                <option value="">(unset)</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                              {p.description ? <div className="text-[11px] text-muted-foreground">{p.description}</div> : null}
                            </div>
                          )
                        }
                        const inputType =
                          format === "date"
                            ? "date"
                            : format === "date-time"
                              ? "datetime-local"
                              : type === "integer" || type === "number"
                                ? "number"
                                : "text"
                        return (
                          <div key={p.name} className="space-y-1">
                            <Label>{label}</Label>
                            <Input
                              value={val}
                              type={inputType}
                              onChange={(e) => handleParamChange(p.name, e.target.value)}
                              placeholder={p.description || ""}
                            />
                            {p.description ? <div className="text-[11px] text-muted-foreground">{p.description}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No parameters</div>
                  )}
                  <Button size="sm" onClick={runExplorer} disabled={explorerLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {explorerLoading ? "Loading" : "Run"}
                  </Button>
                  <ResponseCard title="Explorer result" result={explorerResult} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fundamentals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fundamentals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Symbol</Label>
                  <Input value={fundSymbol} onChange={(e) => setFundSymbol(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={quickProvider}
                    onChange={(e) => setQuickProvider(e.target.value)}
                  >
                    {AVAILABLE_QUOTE_PROVIDERS.map((p: string) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button size="sm" onClick={fetchFundamentals} disabled={fundLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> {fundLoading ? "Loading" : "Fetch fundamentals"}
              </Button>
              {fundamentals ? (
                <div className="grid gap-4 lg:grid-cols-2 text-xs text-muted-foreground">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <pre className="max-h-64 overflow-auto rounded bg-background/60 p-2">{JSON.stringify(fundamentals.profile, null, 2)}</pre>
                    </CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Income (sample)</CardTitle>
                    </CardHeader>
                    <CardContent>{renderTable(fundamentals.income?.results || fundamentals.income) || <div>No data</div>}</CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Balance (sample)</CardTitle>
                    </CardHeader>
                    <CardContent>{renderTable(fundamentals.balance?.results || fundamentals.balance) || <div>No data</div>}</CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Cash flow (sample)</CardTitle>
                    </CardHeader>
                    <CardContent>{renderTable(fundamentals.cash?.results || fundamentals.cash) || <div>No data</div>}</CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No data yet.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Technicals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Symbol</Label>
                  <Input value={techSymbol} onChange={(e) => setTechSymbol(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={quickProvider}
                    onChange={(e) => setQuickProvider(e.target.value)}
                  >
                    {AVAILABLE_QUOTE_PROVIDERS.map((p: string) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button size="sm" onClick={fetchTechnicals} disabled={techLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> {techLoading ? "Loading" : "Fetch technicals"}
              </Button>
              {technicals ? (
                <div className="grid gap-4 lg:grid-cols-2 text-xs text-muted-foreground">
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">RSI</CardTitle>
                    </CardHeader>
                    <CardContent>{renderTable(technicals.rsi?.results || technicals.rsi) || <div>No data</div>}</CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Moving average</CardTitle>
                    </CardHeader>
                    <CardContent>{renderTable(technicals.ma?.results || technicals.ma) || <div>No data</div>}</CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Bollinger bands</CardTitle>
                    </CardHeader>
                    <CardContent>{renderTable(technicals.bb?.results || technicals.bb) || <div>No data</div>}</CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No data yet.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="macro" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Macro / Commodities (sample)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Button size="sm" onClick={fetchMacro}>
                <RefreshCw className="mr-2 h-4 w-4" /> Fetch WTI spot (EIA/FRED)
              </Button>
              {macroData ? renderTable(macroData?.results || macroData) || <div className="text-xs text-muted-foreground">No rows</div> : <div className="text-xs text-muted-foreground">No data yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crypto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Crypto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 space-y-1">
                  <Label>Symbol</Label>
                  <Input
                    defaultValue="BTC-USD"
                    onBlur={(e) => fetchCrypto(e.target.value || "BTC-USD")}
                    placeholder="BTC-USD"
                  />
                </div>
              </div>
              <Button size="sm" onClick={() => fetchCrypto("BTC-USD")}>Fetch BTC-USD</Button>
              {cryptoData ? renderLineChart(cryptoData?.results || cryptoData, "date") || renderTable(cryptoData?.results || cryptoData) : <div className="text-xs text-muted-foreground">No data yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commodities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Commodities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Button size="sm" onClick={fetchCommodities}>
                <RefreshCw className="mr-2 h-4 w-4" /> Fetch Brent spot
              </Button>
              {commodityData ? renderTable(commodityData?.results || commodityData) || <div className="text-xs text-muted-foreground">No rows</div> : <div className="text-xs text-muted-foreground">No data yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("openbb.customTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-path">{t("openbb.pathLabel")}</Label>
                <Input id="custom-path" value={customPath} onChange={(e) => setCustomPath(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-query">{t("openbb.queryLabel")}</Label>
                <textarea
                  id="custom-query"
                  className="min-h-[120px] w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  let parsed: Record<string, string | number> = {}
                  try {
                    parsed = JSON.parse(customQuery || "{}")
                  } catch {
                    setCustomResult({
                      url: "",
                      status: 0,
                      ok: false,
                      data: null,
                      error: "Invalid JSON in query payload.",
                    })
                    return
                  }
                  runRequest(customPath, parsed, setCustomResult, setCustomLoading)
                }}
                disabled={customLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {customLoading ? t("openbb.loading") : t("openbb.runQuery")}
              </Button>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <ResponseCard title={t("openbb.customResult")} result={customResult} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
