import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { resolveOpenbbApiUrl, resolveMarketDataProxyUrl } from "@/lib/runtime-urls"
import { toast } from "sonner"

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
const AVAILABLE_HISTORY_PROVIDERS = resolveProviders()
// News: keep to sources we can back; extend once verified (e.g., benzinga/fmp) with keys.
const AVAILABLE_NEWS_PROVIDERS = resolveProviders().filter((p: string) => p !== "intrinio")

const DEFAULT_QUOTE_PROVIDER = AVAILABLE_QUOTE_PROVIDERS[0]
const DEFAULT_NEWS_PROVIDER = AVAILABLE_NEWS_PROVIDERS[0]

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

  const [quoteSymbol, setQuoteSymbol] = useState("AAPL")
  const [quoteProvider, setQuoteProvider] = useState(DEFAULT_QUOTE_PROVIDER)
  const [quoteResult, setQuoteResult] = useState<ResponseState>()
  const [quoteLoading, setQuoteLoading] = useState(false)

  const [histSymbol, setHistSymbol] = useState("AAPL")
  const [histProvider, setHistProvider] = useState(DEFAULT_QUOTE_PROVIDER)
  const [histInterval, setHistInterval] = useState("1d")
  const [histStart, setHistStart] = useState("")
  const [histEnd, setHistEnd] = useState("")
  const [histResult, setHistResult] = useState<ResponseState>()
  const [histLoading, setHistLoading] = useState(false)

  const [newsSymbol, setNewsSymbol] = useState("AAPL")
  const [newsProvider, setNewsProvider] = useState(DEFAULT_NEWS_PROVIDER)
  const [newsLimit, setNewsLimit] = useState("5")
  const [newsResult, setNewsResult] = useState<ResponseState>()
  const [newsLoading, setNewsLoading] = useState(false)

  const [customPath, setCustomPath] = useState("/api/v1/equity/price/quote")
  const [customQuery, setCustomQuery] = useState(
    JSON.stringify({ symbol: "AAPL", provider: DEFAULT_QUOTE_PROVIDER }, null, 2)
  )
  const [customResult, setCustomResult] = useState<ResponseState>()
  const [customLoading, setCustomLoading] = useState(false)

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("openbb.quoteTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quote-symbol">{t("openbb.symbolLabel")}</Label>
                <Input
                  id="quote-symbol"
                  value={quoteSymbol}
                  onChange={(e) => setQuoteSymbol(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-provider">{t("openbb.providerLabel")}</Label>
                <select
                  id="quote-provider"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={quoteProvider}
                  onChange={(event) => setQuoteProvider(event.target.value)}
                >
                  {AVAILABLE_QUOTE_PROVIDERS.map((p: string) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                runRequest(
                  "/api/v1/equity/price/quote",
                  { symbol: quoteSymbol, provider: quoteProvider },
                  setQuoteResult,
                  setQuoteLoading
                )
              }
              disabled={quoteLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {quoteLoading ? t("openbb.loading") : t("openbb.fetchQuote")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("openbb.historyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hist-symbol">{t("openbb.symbolLabel")}</Label>
                <Input
                  id="hist-symbol"
                  value={histSymbol}
                  onChange={(e) => setHistSymbol(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hist-provider">{t("openbb.providerLabel")}</Label>
                <select
                  id="hist-provider"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={histProvider}
                  onChange={(event) => setHistProvider(event.target.value)}
                >
                  {AVAILABLE_HISTORY_PROVIDERS.map((p: string) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hist-interval">{t("openbb.intervalLabel")}</Label>
                <select
                  id="hist-interval"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={histInterval}
                  onChange={(event) => setHistInterval(event.target.value)}
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="1d">1d</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hist-start">{t("openbb.startDateLabel")}</Label>
                <Input id="hist-start" value={histStart} onChange={(e) => setHistStart(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hist-end">{t("openbb.endDateLabel")}</Label>
                <Input id="hist-end" value={histEnd} onChange={(e) => setHistEnd(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                runRequest(
                  "/api/v1/equity/price/historical",
                  {
                    symbol: histSymbol,
                    provider: histProvider,
                    interval: histInterval,
                    start_date: histStart || undefined,
                    end_date: histEnd || undefined,
                  },
                  setHistResult,
                  setHistLoading
                )
              }
              disabled={histLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {histLoading ? t("openbb.loading") : t("openbb.fetchHistory")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("openbb.newsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="news-symbol">{t("openbb.symbolLabel")}</Label>
                <Input
                  id="news-symbol"
                  value={newsSymbol}
                  onChange={(e) => setNewsSymbol(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="news-provider">{t("openbb.providerLabel")}</Label>
                <select
                  id="news-provider"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newsProvider}
                  onChange={(event) => setNewsProvider(event.target.value)}
                >
                  {AVAILABLE_NEWS_PROVIDERS.map((p: string) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="news-limit">{t("openbb.limitLabel")}</Label>
                <Input id="news-limit" value={newsLimit} onChange={(e) => setNewsLimit(e.target.value)} />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                runRequest(
                  "/api/v1/news/company",
                  { symbol: newsSymbol, provider: newsProvider, limit: newsLimit },
                  setNewsResult,
                  setNewsLoading
                )
              }
              disabled={newsLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {newsLoading ? t("openbb.loading") : t("openbb.fetchNews")}
            </Button>
          </CardContent>
        </Card>

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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ResponseCard title={t("openbb.quoteResult")} result={quoteResult} />
        <ResponseCard title={t("openbb.historyResult")} result={histResult} />
        <ResponseCard title={t("openbb.newsResult")} result={newsResult} />
        <ResponseCard title={t("openbb.customResult")} result={customResult} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">OpenBB Explorer (all endpoints)</CardTitle>
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
                {filteredOps.map((op) => (
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
    </div>
  )
}
