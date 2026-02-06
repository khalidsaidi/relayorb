import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, RefreshCw, Info } from "lucide-react"
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

type HistoryResult = {
  sym: string
  data: any
  ok?: boolean
  status?: number
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

function firstResult(data: any): Record<string, unknown> {
  if (!data) return {}
  if (Array.isArray(data?.results) && data.results.length) return data.results[0]
  if (Array.isArray(data) && data.length) return data[0]
  if (typeof data === "object") return data
  return {}
}

function lastResult(data: any): Record<string, unknown> {
  if (!data) return {}
  if (Array.isArray(data?.results) && data.results.length) return data.results[data.results.length - 1]
  if (Array.isArray(data) && data.length) return data[data.length - 1]
  if (typeof data === "object") return data
  return {}
}

function normalizeRows(data: unknown): Record<string, unknown>[] {
  if (!data) return []
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (Array.isArray((data as any)?.results)) return (data as any).results as Record<string, unknown>[]
  return []
}

function renderKeyValueTable(data: Record<string, unknown>) {
  const entries = Object.entries(data || {}).slice(0, 20)
  if (!entries.length) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-t border-border/60">
              <td className="px-3 py-2 text-foreground">{key}</td>
              <td className="px-3 py-2 text-foreground">{renderValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function pickSummaryMetrics(data: any) {
  const row = firstResult(data)
  if (!row || !Object.keys(row).length) return []
  const preferred = [
    "symbol",
    "name",
    "last_price",
    "price",
    "close",
    "change_percent",
    "market_cap",
    "volume",
    "value",
    "date",
  ]
  return preferred.filter((k) => k in row).slice(0, 6).map((k) => ({ key: k, value: (row as any)[k] }))
}

function downloadJson(name: string, data: unknown) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error("download failed", err)
  }
}

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows?.length) return
  const cols = Object.keys(rows[0])
  const csv = [cols.join(",")]
    .concat(
      rows.map((row) =>
        cols
          .map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return ""
            const s = String(v).replace(/"/g, '""')
            return `"${s}"`
          })
          .join(",")
      )
    )
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}


function renderTable(data: unknown) {
  const rows = normalizeRows(data)
  if (!rows.length || typeof rows[0] !== "object") return null
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
          {rows.slice(0, 20).map((row, idx) => (
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

function renderMetricGrid(data: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!data) return null
  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
      {keys.map((k) => (
        <MetricCard key={k} label={k.replace(/_/g, " ")} value={(data as any)[k]} />
      ))}
    </div>
  )
}

function pickChartKeys(rows: Record<string, unknown>[], yKeys: string[]) {
  const sample = rows.slice(0, 20)
  const numericSet = new Set<string>()
  sample.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === "number") numericSet.add(key)
    })
  })
  if (yKeys.length) return yKeys.filter((k) => numericSet.has(k))
  const preferred = ["close", "adj_close", "last_price", "price", "value", "open"]
  const found = preferred.filter((k) => numericSet.has(k))
  if (found.length) return found.slice(0, 2)
  return Array.from(numericSet).filter((k) => k !== "volume").slice(0, 4)
}

function renderLineChart(data: unknown, xKey = "date", yKeys: string[] = []) {
  const rows = normalizeRows(data)
  if (!rows.length || typeof rows[0] !== "object") return null
  const resolvedXKey = xKey in rows[0] ? xKey : ("datetime" in rows[0] ? "datetime" : xKey)
  const numericKeys = pickChartKeys(rows, yKeys)
  if (!numericKeys.length) return null
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey={resolvedXKey} tick={{ fontSize: 10 }} minTickGap={16} />
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

function buildComparisonSeries(history: { sym: string; data: any }[]) {
  const map = new Map<string, Record<string, unknown>>()
  history.forEach((item) => {
    const rows = normalizeRows(item.data)
    rows.forEach((row) => {
      const date = (row as any).date || (row as any).datetime || (row as any).timestamp
      if (!date) return
      const key = String(date)
      const entry = map.get(key) || { date: key }
      const value =
        (row as any).close ??
        (row as any).adj_close ??
        (row as any).last_price ??
        (row as any).price ??
        (row as any).value
      if (typeof value === "number") entry[item.sym] = value
      map.set(key, entry)
    })
  })
  return Array.from(map.values()).sort((a, b) => {
    const da = new Date(String(a.date)).getTime()
    const db = new Date(String(b.date)).getTime()
    return da - db
  })
}

function renderComparisonChart(history: { sym: string; data: any }[]) {
  if (!history.length) return null
  const series = buildComparisonSeries(history)
  if (!series.length) return null
  const symbols = history.map((h) => h.sym)
  return renderLineChart(series, "date", symbols)
}

function ValuationTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length) return null
  const cols = ["symbol", "market_cap", "pe_ratio", "pb_ratio", "dividend_yield"]
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, idx) => (
            <tr key={idx} className="border-t border-border/60">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 text-foreground">
                  {renderValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResponseCard({ title, result }: { title: string; result?: ResponseState }) {
  if (!result) return null
  const chartRows = normalizeRows(result.data)
  const hasDate = chartRows.length && ("date" in chartRows[0] || "datetime" in chartRows[0])
  const summary = pickSummaryMetrics(result.data)
  const keyValue = !chartRows.length && result.data && typeof result.data === "object" ? renderKeyValueTable(result.data as Record<string, unknown>) : null
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
        {summary.length ? (
          <div className="grid gap-2 md:grid-cols-3">
            {summary.map((m) => (
              <MetricCard key={m.key} label={m.key.replace(/_/g, " ")} value={m.value} />
            ))}
          </div>
        ) : null}
        {result.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {result.error}
          </div>
        ) : null}
        {hasDate ? renderLineChart(chartRows, "date") : null}
        {renderTable(result.data) || keyValue}
        <details className="rounded-lg border border-border/60 bg-muted/20 p-2 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">Raw JSON</summary>
          <pre className="max-h-72 overflow-auto p-2 text-[11px] text-muted-foreground">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}

function QuoteCard({ quote }: { quote: Record<string, unknown> }) {
  if (!quote || !Object.keys(quote).length) return null
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{renderValue(quote.symbol || quote.ticker || quote.name)}</span>
        <span className="text-sm font-semibold text-foreground">{renderValue(quote.last_price || quote.price || quote.close)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span>Bid / Ask</span>
        <span className="text-foreground font-medium">
          {renderValue(quote.bid)} / {renderValue(quote.ask)}
        </span>
        <span>High / Low</span>
        <span className="text-foreground font-medium">
          {renderValue(quote.high)} / {renderValue(quote.low)}
        </span>
        <span>Volume</span>
        <span className="text-foreground font-medium">{renderValue(quote.volume || quote.total_volume)}</span>
        <span>Prev close</span>
        <span className="text-foreground font-medium">{renderValue(quote.prev_close || quote.previous_close)}</span>
      </div>
    </div>
  )
}

function FundOverviewCard({ profile }: { profile: Record<string, unknown> }) {
  if (!profile || !Object.keys(profile).length) return null
  const p = firstResult(profile)
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm">Fundamentals snapshot</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
        {renderMetricGrid(p, ["name", "stock_exchange", "sector", "industry", "market_cap", "full_time_employees"])}
      </CardContent>
    </Card>
  )
}

function TechnicalOverviewCard({ technicals }: { technicals: Record<string, unknown> }) {
  if (!technicals || !Object.keys(technicals).length) return null
  const rsiRow = firstResult((technicals as any).rsi)
  const maRow = firstResult((technicals as any).ma)
  const bbRow = firstResult((technicals as any).bb)
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm">Technical signals</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
        {rsiRow && Object.keys(rsiRow).length ? <MetricCard label="RSI" value={rsiRow.value || rsiRow.rsi} /> : null}
        {maRow && Object.keys(maRow).length ? <MetricCard label="Moving avg" value={maRow.ma || maRow.value} /> : null}
        {bbRow && Object.keys(bbRow).length ? <MetricCard label="Upper band" value={bbRow.upper} /> : null}
      </CardContent>
    </Card>
  )
}

export default function OpenbbPage() {
  const { t } = useTranslation()
  const apiUrl = useMemo(() => resolveOpenbbApiUrl(), [])
  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
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
  const [quickNews, setQuickNews] = useState<Record<string, any>[]>([])
  const [quickFund, setQuickFund] = useState<Record<string, any> | null>(null)
  const [quickTech, setQuickTech] = useState<Record<string, any> | null>(null)
  const [quickFundMap, setQuickFundMap] = useState<Record<string, any>>({})
  const [quickTechMap, setQuickTechMap] = useState<Record<string, any>>({})
  const [quickLoading, setQuickLoading] = useState(false)
  const [savedQueries, setSavedQueries] = useState<{ symbols: string; range: string; provider: string }[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [watchlistAlerts, setWatchlistAlerts] = useState<Record<string, string[]>>({})
  const [historyLog, setHistoryLog] = useState<{ symbols: string; range: string; provider: string; ts: number }[]>([])
  const [comparisonSymbols, setComparisonSymbols] = useState("AAPL, MSFT")
  const [comparisonData, setComparisonData] = useState<Record<string, any>[]>([])
  const [comparisonValuation, setComparisonValuation] = useState<Record<string, any>[]>([])
  const [comparisonTech, setComparisonTech] = useState<Record<string, any>[]>([])
  const [comparisonFund, setComparisonFund] = useState<Record<string, any>>({})
  const [comparisonHistory, setComparisonHistory] = useState<HistoryResult[]>([])
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [fundamentals, setFundamentals] = useState<Record<string, any> | null>(null)
  const [technicals, setTechnicals] = useState<Record<string, any> | null>(null)
  const [fundLoading, setFundLoading] = useState(false)
  const [techLoading, setTechLoading] = useState(false)
  const [fundSymbol, setFundSymbol] = useState("AAPL")
  const [techSymbol, setTechSymbol] = useState("AAPL")
  const [fundSelections, setFundSelections] = useState({
    profile: true,
    income: true,
    balance: true,
    cash: true,
    valuation: true,
  })
  const [techSelections, setTechSelections] = useState({
    rsi: true,
    ma: true,
    bb: true,
  })
  const [macroData, setMacroData] = useState<Record<string, any> | null>(null)
  const [macroLoading, setMacroLoading] = useState(false)
  const [cryptoData, setCryptoData] = useState<Record<string, any> | null>(null)
  const [cryptoLoading, setCryptoLoading] = useState(false)
  const [commodityData, setCommodityData] = useState<Record<string, any> | null>(null)
  const [commodityLoading, setCommodityLoading] = useState(false)
  const [macroSelection, setMacroSelection] = useState({
    interest_rate: true,
    unemployment: true,
    gdp: false,
    inflation: false,
  })
  const [cryptoSymbol, setCryptoSymbol] = useState("BTC-USD")
  const [cryptoInterval, setCryptoInterval] = useState("1d")
  const [commoditySelection, setCommoditySelection] = useState("brent")

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
      const newsPromises = symbols.map((sym) =>
        fetch(buildUrl(queryBase, "/api/v1/news", { symbol: sym, provider: quickProvider })).then(async (r) => ({
          sym,
          status: r.status,
          ok: r.ok,
          data: await r.json().catch(() => null),
        }))
      )
      const fundPromises = symbols.map(async (sym) => {
        const [profile, income, balance, cash] = await Promise.all([
          fetch(buildUrl(queryBase, "/api/v1/equity/profile", { symbol: sym, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          ),
          fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/income", { symbol: sym, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          ),
          fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/balance", { symbol: sym, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          ),
          fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/cash_flow", { symbol: sym, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          ),
        ])
        return { profile, income, balance, cash }
      })
      const techPromises = symbols.map(async (sym) => {
        const [rsi, ma, bb] = await Promise.all([
          fetch(buildUrl(queryBase, "/api/v1/technical/relative_strength_index", { symbol: sym, interval: "1d", length: 14, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          ),
          fetch(buildUrl(queryBase, "/api/v1/technical/moving_average", { symbol: sym, interval: "1d", length: 20, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          ),
          fetch(buildUrl(queryBase, "/api/v1/technical/bollinger_bands", { symbol: sym, interval: "1d", length: 20, std: 2, provider: quickProvider })).then(
            (r) => r.json().catch(() => null)
          ),
        ])
        return { rsi, ma, bb }
      })

      const [quotes, history, news, fundArr, techArr] = await Promise.all([
        Promise.all(quotePromises),
        Promise.all(histPromises),
        Promise.all(newsPromises),
        Promise.all(fundPromises),
        Promise.all(techPromises),
      ])
      const okQuotes = quotes.filter((q) => q.ok)
      const okHist = history.filter((h) => h.ok)
      const okNews = news.filter((n) => n.ok)
      setQuickQuotes(okQuotes)
      setQuickHistory(okHist)
      setQuickNews(okNews)
      setQuickFund(fundArr[0]?.profile || null)
      setQuickTech(techArr[0]?.rsi || null)
      const fundMap: Record<string, any> = {}
      fundArr.forEach((f, idx) => {
        const sym = symbols[idx]
        if (sym) fundMap[sym] = f
      })
      const techMap: Record<string, any> = {}
      techArr.forEach((t, idx) => {
        const sym = symbols[idx]
        if (sym) techMap[sym] = t
      })
      setQuickFundMap(fundMap)
      setQuickTechMap(techMap)
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
    setComparisonLoading(true)
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
      // fetch valuation for comparison
      const valuationRes = await Promise.all(
        symbols.map((sym) =>
          fetch(buildUrl(queryBase, "/api/v1/equity/profile", { symbol: sym, provider: quickProvider })).then(async (r) => ({
            sym,
            ok: r.ok,
            status: r.status,
            data: await r.json().catch(() => null),
          }))
        )
      )
      setComparisonValuation(valuationRes.filter((r) => r.ok))
      const techRes = await Promise.all(
        symbols.map(async (sym) => {
          const [rsi, ma, bb] = await Promise.all([
            fetch(
              buildUrl(queryBase, "/api/v1/technical/relative_strength_index", {
                symbol: sym,
                interval: "1d",
                length: 14,
                provider: quickProvider,
              })
            ).then((r) => r.json().catch(() => null)),
            fetch(buildUrl(queryBase, "/api/v1/technical/moving_average", { symbol: sym, interval: "1d", length: 20, provider: quickProvider })).then(
              (r) => r.json().catch(() => null)
            ),
            fetch(
              buildUrl(queryBase, "/api/v1/technical/bollinger_bands", { symbol: sym, interval: "1d", length: 20, std: 2, provider: quickProvider })
            ).then((r) => r.json().catch(() => null)),
          ])
          return { sym, rsi, ma, bb }
        })
      )
      setComparisonTech(techRes)
      const histRes = await Promise.all(
        symbols.map((sym) =>
          fetch(buildUrl(queryBase, "/api/v1/equity/price/historical", { symbol: sym, provider: quickProvider, interval: "1d", start_date: computeStartDate(quickRange) })).then(async (r) => ({
            sym,
            ok: r.ok,
            status: r.status,
            data: await r.json().catch(() => null),
          }))
        )
      )
      setComparisonHistory(histRes.filter((r) => r.ok))
      const fundRes = await Promise.all(
        symbols.map(async (sym) => {
          const [income, balance, cash] = await Promise.all([
            fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/income", { symbol: sym, provider: quickProvider })).then((r) => r.json().catch(() => null)),
            fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/balance", { symbol: sym, provider: quickProvider })).then((r) => r.json().catch(() => null)),
            fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/cash_flow", { symbol: sym, provider: quickProvider })).then((r) => r.json().catch(() => null)),
          ])
          return { sym, income, balance, cash }
        })
      )
      const fundMap: Record<string, any> = {}
      fundRes.forEach((f) => {
        fundMap[f.sym] = f
      })
      setComparisonFund(fundMap)
      res.filter((r) => !r.ok).forEach((r) => toast.error(`${r.sym}: ${r.status}`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed")
    } finally {
      setComparisonLoading(false)
    }
  }

  const fetchFundamentals = async () => {
    if (!queryBase) {
      toast.error(t("openbb.notConfigured"))
      return
    }
    setFundLoading(true)
    try {
      const profilePromise = fundSelections.profile
        ? fetch(buildUrl(queryBase, "/api/v1/equity/profile", { symbol: fundSymbol, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          )
        : Promise.resolve(null)
      const incomePromise = fundSelections.income
        ? fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/income", { symbol: fundSymbol, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          )
        : Promise.resolve(null)
      const balancePromise = fundSelections.balance
        ? fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/balance", { symbol: fundSymbol, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          )
        : Promise.resolve(null)
      const cashPromise = fundSelections.cash
        ? fetch(buildUrl(queryBase, "/api/v1/equity/fundamental/cash_flow", { symbol: fundSymbol, provider: quickProvider })).then((r) =>
            r.json().catch(() => null)
          )
        : Promise.resolve(null)
      const [profile, income, balance, cash] = await Promise.all([profilePromise, incomePromise, balancePromise, cashPromise])
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
      const rsiPromise = techSelections.rsi
        ? fetch(
            buildUrl(queryBase, "/api/v1/technical/relative_strength_index", { symbol: techSymbol, interval: "1d", length: 14, provider: quickProvider })
          ).then((r) => r.json().catch(() => null))
        : Promise.resolve(null)
      const maPromise = techSelections.ma
        ? fetch(buildUrl(queryBase, "/api/v1/technical/moving_average", { symbol: techSymbol, interval: "1d", length: 20, provider: quickProvider })).then(
            (r) => r.json().catch(() => null)
          )
        : Promise.resolve(null)
      const bbPromise = techSelections.bb
        ? fetch(
            buildUrl(queryBase, "/api/v1/technical/bollinger_bands", { symbol: techSymbol, interval: "1d", length: 20, std: 2, provider: quickProvider })
          ).then((r) => r.json().catch(() => null))
        : Promise.resolve(null)
      const [rsi, ma, bb] = await Promise.all([rsiPromise, maPromise, bbPromise])
      setTechnicals({ rsi, ma, bb })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Technical fetch failed")
    } finally {
      setTechLoading(false)
    }
  }

  const fetchMacro = async () => {
    if (!queryBase) return
    setMacroLoading(true)
    try {
      const indicatorMap: Record<string, string> = {
        interest_rate: "interest_rate",
        unemployment: "unemployment",
        gdp: "gdp",
        inflation: "inflation",
      }
      const selected = Object.entries(macroSelection).filter(([, enabled]) => enabled)
      const results = await Promise.all(
        selected.map(async ([key]) => {
          const indicator = indicatorMap[key]
          const data = await fetch(buildUrl(queryBase, "/api/v1/economy/macro", { indicator, provider: "fred" })).then((r) =>
            r.json().catch(() => null)
          )
          return [key, data] as const
        })
      )
      const next: Record<string, any> = {}
      results.forEach(([key, data]) => {
        next[key] = data
      })
      setMacroData(next)
    } catch (err) {
      setMacroData(null)
      toast.error(err instanceof Error ? err.message : "Macro fetch failed")
    } finally {
      setMacroLoading(false)
    }
  }

  const fetchCrypto = async (symbol = cryptoSymbol) => {
    if (!queryBase) return
    setCryptoLoading(true)
    try {
      const res = await fetch(buildUrl(queryBase, "/api/v1/crypto/price/historical", { symbol, interval: cryptoInterval, provider: quickProvider }))
      const data = await res.json().catch(() => null)
      setCryptoData(data)
    } catch (err) {
      setCryptoData(null)
      toast.error(err instanceof Error ? err.message : "Crypto fetch failed")
    } finally {
      setCryptoLoading(false)
    }
  }

  const fetchCommodities = async () => {
    if (!queryBase) return
    setCommodityLoading(true)
    try {
      const res = await fetch(buildUrl(queryBase, "/api/v1/commodity/price/spot", { commodity: commoditySelection, provider: "fred" }))
      const data = await res.json().catch(() => null)
      setCommodityData(data)
    } catch (err) {
      setCommodityData(null)
      toast.error(err instanceof Error ? err.message : "Commodity fetch failed")
    } finally {
      setCommodityLoading(false)
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
      const storedAlerts = localStorage.getItem("openbb_watchlist_alerts")
      if (storedWatch) setWatchlist(JSON.parse(storedWatch))
      if (storedHist) setHistoryLog(JSON.parse(storedHist))
      if (storedSaved) setSavedQueries(JSON.parse(storedSaved))
      if (storedAlerts) setWatchlistAlerts(JSON.parse(storedAlerts))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("openbb_watchlist", JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    localStorage.setItem("openbb_watchlist_alerts", JSON.stringify(watchlistAlerts))
  }, [watchlistAlerts])

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
          <div className="rounded-lg border bg-muted/40 p-3 text-xs break-all">
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
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
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
                <Button size="sm" variant="outline" onClick={() => downloadJson("quick-quotes", { quotes: quickQuotes, history: quickHistory, news: quickNews })}>
                  Export JSON
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
                    sym
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .forEach((s) =>
                        setWatchlistAlerts((prev) => (prev[s] ? prev : { ...prev, [s]: ["news"] }))
                      )
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
              {quickLoading ? <div className="text-xs text-muted-foreground">Loading data…</div> : null}
              {!quickLoading && !quickQuotes.length && !quickHistory.length ? (
                <div className="text-xs text-muted-foreground">No results yet.</div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                {quickQuotes.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Quotes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <div className="grid gap-3 md:grid-cols-2">
                        {quickQuotes.map((q) => {
                          const payload = firstResult(q.data)
                          return <QuoteCard key={q.sym} quote={{ ...payload, symbol: q.sym }} />
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                {Object.keys(quickFundMap).length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Fundamentals (per symbol)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 text-xs text-muted-foreground">
                      {Object.entries(quickFundMap).map(([sym, data]) => {
                        const row = firstResult((data as any).profile)
                        return (
                          <div key={sym} className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                            <div className="text-sm font-semibold text-foreground">{sym}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <MetricCard label="Market cap" value={(row as any).market_cap} />
                              <MetricCard label="Sector" value={(row as any).sector} />
                              <MetricCard label="P/E" value={(row as any).pe_ratio || (row as any).pe} />
                              <MetricCard label="Dividend" value={(row as any).dividend_yield} />
                            </div>
                            <details className="rounded border border-border/40 bg-muted/20 p-2">
                              <summary className="cursor-pointer text-[11px] text-muted-foreground">Statements</summary>
                              {(data as any).income ? <StatementTable title="Income" rows={(data as any).income?.results || (data as any).income} /> : null}
                              {(data as any).balance ? <StatementTable title="Balance" rows={(data as any).balance?.results || (data as any).balance} /> : null}
                              {(data as any).cash ? <StatementTable title="Cash flow" rows={(data as any).cash?.results || (data as any).cash} /> : null}
                            </details>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                ) : null}
                {Object.keys(quickTechMap).length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Technicals (RSI/MA/BB)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 text-xs text-muted-foreground">
                      {Object.entries(quickTechMap).map(([sym, data]) => {
                        const rsiRow = firstResult((data as any).rsi)
                        const maRow = firstResult((data as any).ma)
                        const bbRow = firstResult((data as any).bb)
                        return (
                          <div key={sym} className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                            <div className="text-sm font-semibold text-foreground">{sym}</div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <MetricCard label="RSI" value={(rsiRow as any).value || (rsiRow as any).rsi} />
                              <MetricCard label="MA" value={(maRow as any).ma || (maRow as any).value} />
                              <MetricCard label="BB Upper" value={(bbRow as any).upper} />
                              <MetricCard label="BB Lower" value={(bbRow as any).lower} />
                            </div>
                            <details className="rounded border border-border/40 bg-muted/20 p-2">
                              <summary className="cursor-pointer text-[11px] text-muted-foreground">Technical tables</summary>
                              {(data as any).rsi ? renderTable((data as any).rsi?.results || (data as any).rsi) : null}
                              {(data as any).ma ? renderTable((data as any).ma?.results || (data as any).ma) : null}
                              {(data as any).bb ? renderTable((data as any).bb?.results || (data as any).bb) : null}
                            </details>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                ) : null}
                {quickFund ? <FundOverviewCard profile={quickFund} /> : null}
                {quickTech ? <TechnicalOverviewCard technicals={quickTech} /> : null}
                {quickHistory.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Historical</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {quickHistory.map((h) => (
                    <div key={h.sym} className="rounded-md border border-border/50 bg-muted/40 p-2">
                      <div className="text-sm font-semibold text-foreground">{h.sym}</div>
                      {renderLineChart(h.data, "date", ["close", "adj_close", "last_price", "price"]) || renderTable(h.data)}
                    </div>
                  ))}
                </CardContent>
              </Card>
                ) : null}
                {quickNews.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">News</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground max-h-64 overflow-auto">
                      {quickNews
                        .flatMap((n) => (Array.isArray(n.data?.results) ? n.data.results.map((item: any) => ({ sym: n.sym, ...item })) : []))
                        .slice(0, 10)
                        .map((item, idx) => (
                          <div key={idx} className="rounded-md border border-border/40 bg-muted/20 p-2">
                            <div className="text-foreground font-semibold text-sm">{item.title || item.headline}</div>
                            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                              <span>{item.publisher || item.source}</span>
                              {item.datetime || item.date ? <span>{item.datetime || item.date}</span> : null}
                            </div>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {quickHistory.length ? (
                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle className="text-sm">Quick chart</CardTitle>
                    </CardHeader>
                    <CardContent>{renderLineChart(quickHistory[0]?.data, "date", ["close", "adj_close", "last_price", "price"])}</CardContent>
                  </Card>
                ) : null}
                {fundamentals ? <FundOverviewCard profile={fundamentals.profile} /> : null}
                {technicals ? <TechnicalOverviewCard technicals={technicals} /> : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 text-xs text-muted-foreground">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-sm">Watchlist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadJson("openbb-watchlist", watchlist as any)}>
                    Export JSON
                  </Button>
                </div>
                {!watchlist.length ? <div className="text-xs text-muted-foreground">No symbols saved yet.</div> : null}
                <div className="flex flex-wrap gap-2">
                  {watchlist.map((s) => (
                    <span key={s} className="inline-flex items-center gap-2 rounded-full border px-2 py-1">
                      {s}
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => setWatchlist((prev) => prev.filter((x) => x !== s))}
                      >
                        ×
                      </button>
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setQuickSymbols(s)
                          setTimeout(() => runQuickLookup(), 50)
                        }}
                      >
                        Run
                      </button>
                    </span>
                  ))}
                </div>
                {watchlist.length ? (
                  <div className="mt-2 space-y-2 text-[11px] text-muted-foreground">
                    {watchlist.map((s) => {
                      const selected = new Set(watchlistAlerts[s] || [])
                      const toggle = (key: string) => {
                        const next = new Set(selected)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        setWatchlistAlerts((prev) => ({ ...prev, [s]: Array.from(next) }))
                      }
                      return (
                        <div key={`${s}-alerts`} className="flex flex-wrap items-center gap-2">
                          <span className="text-foreground">{s}</span>
                          {["news", "filings", "sentiment", "price"].map((key) => (
                            <label key={key} className="flex items-center gap-1 rounded border border-border/50 px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selected.has(key)}
                                onChange={() => toggle(key)}
                              />
                              <span className="capitalize">{key}</span>
                            </label>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-sm">History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!historyLog.length ? <div className="text-xs text-muted-foreground">No recent queries yet.</div> : null}
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
          </div>
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
                  <Button size="sm" variant="outline" onClick={() => downloadJson("openbb-explorer", explorerResult?.data)}>
                    Export JSON
                  </Button>
                  <ResponseCard title="Explorer result" result={explorerResult} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card>
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
              <div className="flex gap-2">
                <Button size="sm" onClick={runComparison} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" /> Compare
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadJson("comparison", { quotes: comparisonData, valuation: comparisonValuation, tech: comparisonTech })}>
                  Export JSON
                </Button>
              </div>
              {comparisonLoading ? <div className="text-xs text-muted-foreground">Loading comparison…</div> : null}
              {!comparisonLoading && !comparisonData.length ? (
                <div className="text-xs text-muted-foreground">No comparison data yet.</div>
              ) : null}
              {comparisonData.length ? (
                <div className="space-y-3 text-xs text-muted-foreground">
                  {comparisonHistory.length ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">Price comparison</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderComparisonChart(comparisonHistory) || <div>No chart data</div>}
                      </CardContent>
                    </Card>
                  ) : null}
                  {renderTable(
                    comparisonData.map((c) => {
                      const row = firstResult(c.data)
                      return {
                        symbol: c.sym,
                        last: row.last_price || row.price || row.close,
                        change: row.change_percent || row.change,
                        high: row.high,
                        low: row.low,
                        volume: row.volume,
                        market_cap: row.market_cap,
                        pe: row.pe_ratio || row.pe,
                      }
                    })
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {comparisonData.map((c) => {
                      const row = firstResult(c.data)
                      const val = comparisonValuation.find((v) => v.sym === c.sym)
                      const valRow = firstResult(val?.data)
                      const tech = comparisonTech.find((t) => t.sym === c.sym)
                      const techRow = firstResult(tech?.rsi)
                      return (
                        <div key={c.sym} className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                          <div className="text-sm font-semibold text-foreground">{c.sym}</div>
                          <QuoteCard quote={{ ...row, symbol: c.sym }} />
                          <div className="grid gap-2 md:grid-cols-2">
                            <MetricCard label="Market cap" value={(valRow as any).market_cap} />
                            <MetricCard label="P/E" value={(valRow as any).pe_ratio || (valRow as any).pe} />
                            <MetricCard label="P/B" value={(valRow as any).pb_ratio} />
                            <MetricCard label="Dividend" value={(valRow as any).dividend_yield} />
                            <MetricCard label="RSI" value={(techRow as any).value || (techRow as any).rsi} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {comparisonValuation.length ? (
                    <ValuationTable
                      rows={comparisonValuation.map((c) => {
                        const row = firstResult(c.data)
                        return {
                          symbol: c.sym,
                          market_cap: row.market_cap,
                          pe_ratio: row.pe_ratio || row.pe,
                          pb_ratio: row.pb_ratio,
                          dividend_yield: row.dividend_yield,
                        }
                      })}
                    />
                  ) : null}
                  {comparisonHistory.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {comparisonHistory.map((h) => (
                        <Card key={h.sym} className="border-border/70">
                          <CardHeader>
                            <CardTitle className="text-sm">{h.sym} history</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {renderLineChart(h.data?.results || h.data, "date")}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                  {Object.keys(comparisonFund).length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(comparisonFund).map(([sym, f]) => (
                        <div key={sym} className="space-y-2">
                          <div className="text-sm font-semibold text-foreground">{sym} fundamentals</div>
                          {f.income ? <StatementTable title="Income" rows={f.income?.results || f.income} /> : null}
                          {f.balance ? <StatementTable title="Balance" rows={f.balance?.results || f.balance} /> : null}
                          {f.cash ? <StatementTable title="Cash flow" rows={f.cash?.results || f.cash} /> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {comparisonTech.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {comparisonTech.map((t) => (
                        <div key={t.sym} className="space-y-2">
                          <div className="text-sm font-semibold text-foreground">{t.sym} technicals</div>
                          {renderLineChart(t.rsi?.results || t.rsi, "date", ["value"]) || renderTable(t.rsi?.results || t.rsi) || <div>No RSI data</div>}
                          {renderTable(t.ma?.results || t.ma) || <div>No MA data</div>}
                          {renderTable(t.bb?.results || t.bb) || <div>No BB data</div>}
                        </div>
                      ))}
                    </div>
                  ) : null}
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
              <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                {Object.entries(fundSelections).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1" title={`Include ${key}`}>
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={value}
                      onChange={(e) => setFundSelections((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    <span className="capitalize">{key}</span>
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={fetchFundamentals} disabled={fundLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> {fundLoading ? "Loading" : "Fetch fundamentals"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJson(`fundamentals-${fundSymbol}`, fundamentals)}>
                Export JSON
              </Button>
              {fundamentals ? (
                <div className="space-y-4 text-xs text-muted-foreground">
                  {fundamentals.profile ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">Profile</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-3">
                        {renderMetricGrid(firstResult(fundamentals.profile), ["name", "stock_exchange", "sector", "industry", "market_cap", "full_time_employees"])}
                      </CardContent>
                    </Card>
                  ) : null}
                  {fundamentals.profile ? (
                    <ValuationTable
                      rows={[
                        {
                          symbol: fundSymbol,
                          market_cap: (firstResult(fundamentals.profile) as any).market_cap,
                          pe_ratio: (firstResult(fundamentals.profile) as any).pe_ratio || (firstResult(fundamentals.profile) as any).pe,
                          pb_ratio: (firstResult(fundamentals.profile) as any).pb_ratio,
                          dividend_yield: (firstResult(fundamentals.profile) as any).dividend_yield,
                        },
                      ]}
                    />
                  ) : null}
                  {fundamentals.income ? (
                    <StatementTable title="Income statement" rows={fundamentals.income?.results || fundamentals.income} />
                  ) : null}
                  {fundamentals.balance ? (
                    <StatementTable title="Balance sheet" rows={fundamentals.balance?.results || fundamentals.balance} />
                  ) : null}
                  {fundamentals.cash ? (
                    <StatementTable title="Cash flow" rows={fundamentals.cash?.results || fundamentals.cash} />
                  ) : null}
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
              <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                {Object.entries(techSelections).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1" title={`Include ${key}`}>
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={value}
                      onChange={(e) => setTechSelections((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    <span className="uppercase">{key}</span>
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={fetchTechnicals} disabled={techLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> {techLoading ? "Loading" : "Fetch technicals"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJson(`technicals-${techSymbol}`, technicals)}>
                Export JSON
              </Button>
              {technicals ? (
                <div className="grid gap-4 lg:grid-cols-2 text-xs text-muted-foreground">
                  <div className="grid gap-2 md:grid-cols-3 lg:col-span-2">
                    <MetricCard label="RSI" value={(firstResult(technicals.rsi) as any)?.value || (firstResult(technicals.rsi) as any)?.rsi} />
                    <MetricCard label="MA" value={(firstResult(technicals.ma) as any)?.ma || (firstResult(technicals.ma) as any)?.value} />
                    <MetricCard label="BB Upper" value={(firstResult(technicals.bb) as any)?.upper} />
                  </div>
                  {technicals.rsi ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">RSI (14)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {renderLineChart(technicals.rsi.results || technicals.rsi, "date", ["value"])}
                        {renderTable(technicals.rsi.results || technicals.rsi)}
                      </CardContent>
                    </Card>
                  ) : null}
                  {technicals.ma ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">Moving average</CardTitle>
                      </CardHeader>
                      <CardContent>{renderTable(technicals.ma.results || technicals.ma) || <div>No data</div>}</CardContent>
                    </Card>
                  ) : null}
                  {technicals.bb ? (
                    <Card className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">Bollinger bands</CardTitle>
                      </CardHeader>
                      <CardContent>{renderTable(technicals.bb.results || technicals.bb) || <div>No data</div>}</CardContent>
                    </Card>
                  ) : null}
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
              <CardTitle className="text-sm">Macro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
                {Object.entries(macroSelection).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1" title={`Macro indicator: ${key}`}>
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={value}
                      onChange={(e) => setMacroSelection((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    <span className="capitalize">{key}</span>
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={fetchMacro} disabled={macroLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> {macroLoading ? "Loading" : "Fetch macro"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJson("macro", macroData)}>
                Export JSON
              </Button>
              {macroData ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(macroData).map(([key, data]) => (
                    <Card key={key} className="border-border/70">
                      <CardHeader>
                        <CardTitle className="text-sm">{key.replace(/_/g, " ").toUpperCase()}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs text-muted-foreground">
                        {renderMetricGrid(lastResult(data), ["value", "date"])}
                        {renderLineChart((data as any)?.results || data, "date", ["value"]) || renderTable((data as any)?.results || data)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No data yet.</div>
              )}
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
                  <Input value={cryptoSymbol} onChange={(e) => setCryptoSymbol(e.target.value.toUpperCase())} placeholder="BTC-USD" />
                </div>
                <div className="space-y-1">
                  <Label>Interval</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={cryptoInterval}
                    onChange={(e) => setCryptoInterval(e.target.value)}
                  >
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1d</option>
                    <option value="1w">1w</option>
                  </select>
                </div>
              </div>
              <Button size="sm" onClick={() => fetchCrypto(cryptoSymbol)} disabled={cryptoLoading}>
                {cryptoLoading ? "Loading" : "Fetch"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJson(`crypto-${cryptoSymbol}`, cryptoData)}>
                Export JSON
              </Button>
              {cryptoData ? (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                    {renderMetricGrid(lastResult(cryptoData), ["close", "open", "volume"])}
                  </div>
                  {renderLineChart(cryptoData?.results || cryptoData, "date") || renderTable(cryptoData?.results || cryptoData) || <div className="text-xs text-muted-foreground">No data</div>}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No data yet.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commodities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Commodities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Commodity</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={commoditySelection}
                    onChange={(e) => setCommoditySelection(e.target.value)}
                  >
                    <option value="brent">Brent</option>
                    <option value="wti">WTI</option>
                    <option value="natgas">Nat Gas</option>
                    <option value="gold">Gold</option>
                  </select>
                </div>
              </div>
              <Button size="sm" onClick={fetchCommodities} disabled={commodityLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> {commodityLoading ? "Loading" : "Fetch"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJson(`commodities-${commoditySelection}`, commodityData)}>
                Export JSON
              </Button>
              {commodityData ? (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
                    {renderMetricGrid(lastResult(commodityData), ["value", "date"])}
                  </div>
                  {renderLineChart(commodityData?.results || commodityData, "date") || renderTable(commodityData?.results || commodityData) || <div className="text-xs text-muted-foreground">No rows</div>}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No data yet.</div>
              )}
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
              <Button size="sm" variant="outline" onClick={() => downloadJson("openbb-custom", customResult?.data)}>
                Export JSON
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
function MetricCard({ label, value, hint }: { label: string; value: unknown; hint?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <span>{label}</span>
        {hint ? (
          <span title={hint} className="text-muted-foreground/80">
            <Info className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <div className="text-sm font-semibold text-foreground">{renderValue(value)}</div>
    </div>
  )
}

function StatementTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  if (!rows?.length) return null
  const cols = Object.keys(rows[0]).slice(0, 6)
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{title}</span>
          <button
            className="rounded border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => downloadCsv(title.replace(/\s+/g, "-").toLowerCase(), rows)}
          >
            Export CSV
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto text-xs text-muted-foreground">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 text-left font-medium text-[11px] uppercase text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row, idx) => (
              <tr key={idx} className="border-t border-border/50">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 text-foreground">
                    {renderValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
