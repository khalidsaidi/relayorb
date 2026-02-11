import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { HttpRequestError, fetchJsonWithMeta } from "@/lib/http"
import { resolveMarketDataProxyUrl, resolveTvscreenerUrl } from "@/lib/runtime-urls"

type ApiParam = {
  name: string
  in: "query" | "path" | string
  required?: boolean
  schema?: { type?: string; enum?: string[]; default?: unknown }
  description?: string
}

type ApiOperation = {
  id: string
  method: string
  path: string
  tag: string
  summary: string
  params: ApiParam[]
}

type ResponseState = {
  url: string
  status: number
  ok: boolean
  data: unknown
  error?: string
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | undefined>) {
  const cleanBase = baseUrl.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  const url = new URL(`${cleanBase}${cleanPath}`)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

function renderValue(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "—"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string") return value || "—"
  return JSON.stringify(value)
}

function normalizeRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (Array.isArray((data as any)?.results)) return (data as any).results as Record<string, unknown>[]
  return []
}

function renderTable(data: unknown) {
  const rows = normalizeRows(data)
  if (!rows.length || typeof rows[0] !== "object") return null
  const columns = Object.keys(rows[0]).slice(0, 12)
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, idx) => (
            <tr key={idx} className="border-t border-border/60">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-foreground whitespace-nowrap">
                  {renderValue((row as any)[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function defaultsForOp(op: ApiOperation) {
  const defaults: Record<string, string> = {}
  op.params.forEach((p) => {
    if (p.schema?.default !== undefined && p.schema?.default !== null) {
      defaults[p.name] = String(p.schema.default)
      return
    }
    const lower = p.name.toLowerCase()
    if ((lower === "symbol" || lower === "ticker") && !defaults[p.name]) defaults[p.name] = "AAPL"
    if ((lower === "market" || lower === "country") && !defaults[p.name]) defaults[p.name] = "US"
    if ((lower === "limit" || lower === "top") && !defaults[p.name]) defaults[p.name] = "50"
  })
  return defaults
}

export default function TvscreenerPage() {
  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const rawBase = useMemo(() => resolveTvscreenerUrl(), [])
  const queryBase = useMemo(() => (proxyBase ? `${proxyBase}/v1/tvscreener` : rawBase), [proxyBase, rawBase])
  const docsUrl = queryBase ? `${queryBase}/docs` : ""
  const openapiUrl = queryBase ? `${queryBase}/openapi.json` : ""

  const [healthResult, setHealthResult] = useState<ResponseState>()
  const [healthLoading, setHealthLoading] = useState(false)

  const [specOps, setSpecOps] = useState<ApiOperation[]>([])
  const [specError, setSpecError] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState("")
  const [selectedOpId, setSelectedOpId] = useState("")
  const [endpointSearch, setEndpointSearch] = useState("")
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [explorerResult, setExplorerResult] = useState<ResponseState>()
  const [explorerLoading, setExplorerLoading] = useState(false)

  const [customPath, setCustomPath] = useState("/health")
  const [customQuery, setCustomQuery] = useState("{}")
  const [customResult, setCustomResult] = useState<ResponseState>()
  const [customLoading, setCustomLoading] = useState(false)

  const runRequest = async (
    path: string,
    query: Record<string, string | number | undefined>,
    setTarget: (value: ResponseState) => void,
    setLoading: (value: boolean) => void
  ) => {
    if (!queryBase) {
      toast.error("TVScreener API URL not configured.")
      return
    }
    const url = buildUrl(queryBase, path, query)
    setLoading(true)
    try {
      const res = await fetchJsonWithMeta("TVScreener", url, undefined, 30000)
      setTarget({ url, status: res.status, ok: true, data: res.data })
    } catch (err) {
      if (err instanceof HttpRequestError) {
        const message = err.bodyText || err.message
        setTarget({ url, status: err.status, ok: false, data: null, error: message })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      setTarget({ url, status: 0, ok: false, data: null, error: message })
    } finally {
      setLoading(false)
    }
  }

  const checkHealth = async () => {
    if (!queryBase) {
      toast.error("TVScreener API URL not configured.")
      return
    }
    const candidates = ["/health", "/api/health", "/"]
    setHealthLoading(true)
    let lastErr: unknown = null
    for (const path of candidates) {
      try {
        const url = buildUrl(queryBase, path)
        const res = await fetchJsonWithMeta("TVScreener", url, undefined, 15000)
        setHealthResult({ url, status: res.status, ok: true, data: res.data })
        toast.success(`[TVScreener] healthy (${res.status})`)
        setHealthLoading(false)
        return
      } catch (err) {
        lastErr = err
      }
    }
    const message = lastErr instanceof Error ? lastErr.message : "Health check failed"
    setHealthResult({
      url: buildUrl(queryBase, "/health"),
      status: 0,
      ok: false,
      data: null,
      error: message,
    })
    toast.error(message)
    setHealthLoading(false)
  }

  useEffect(() => {
    const loadSpec = async () => {
      if (!queryBase) return
      setSpecError(null)
      const candidates = ["/openapi.json", "/docs/openapi.json", "/api/openapi.json"]
      for (const path of candidates) {
        try {
          const res = await fetchJsonWithMeta<any>("TVScreener", buildUrl(queryBase, path), undefined, 20000)
          const paths = res.data?.paths || {}
          const ops: ApiOperation[] = []
          Object.entries(paths).forEach(([p, methods]) => {
            Object.entries(methods as Record<string, any>).forEach(([method, def]) => {
              if (!def || typeof def !== "object") return
              const params: ApiParam[] = Array.isArray(def.parameters) ? def.parameters : []
              const tag = Array.isArray(def.tags) && def.tags.length ? String(def.tags[0]) : "other"
              ops.push({
                id: `${method.toUpperCase()} ${p}`,
                method: method.toUpperCase(),
                path: p,
                tag,
                summary: String(def.summary || def.description || p),
                params,
              })
            })
          })
          setSpecOps(ops)
          const firstTag = ops[0]?.tag || ""
          setSelectedTag(firstTag)
          const firstOp = ops.find((op) => op.tag === firstTag) || ops[0]
          setSelectedOpId(firstOp?.id || "")
          setParamValues(firstOp ? defaultsForOp(firstOp) : {})
          return
        } catch (err) {
          setSpecError(err instanceof Error ? err.message : "Failed loading OpenAPI spec")
        }
      }
    }
    loadSpec()
  }, [queryBase])

  const availableTags = useMemo(() => Array.from(new Set(specOps.map((op) => op.tag))), [specOps])
  const filteredOps = useMemo(() => {
    const byTag = specOps.filter((op) => (selectedTag ? op.tag === selectedTag : true))
    const q = endpointSearch.trim().toLowerCase()
    if (!q) return byTag
    return byTag.filter((op) => `${op.method} ${op.path} ${op.summary}`.toLowerCase().includes(q))
  }, [endpointSearch, selectedTag, specOps])
  const selectedOp = useMemo(
    () => filteredOps.find((op) => op.id === selectedOpId) || filteredOps[0],
    [filteredOps, selectedOpId]
  )

  useEffect(() => {
    if (!selectedOp) return
    setParamValues((prev) => ({ ...defaultsForOp(selectedOp), ...prev }))
  }, [selectedOp])

  const runExplorer = async () => {
    if (!selectedOp) {
      toast.error("No endpoint selected.")
      return
    }
    const pathParams: Record<string, string> = {}
    const queryParams: Record<string, string | number | undefined> = {}
    selectedOp.params.forEach((p) => {
      const value = String(paramValues[p.name] || "").trim()
      if (!value) return
      if (p.in === "path") pathParams[p.name] = value
      else if (p.in === "query") queryParams[p.name] = value
    })
    let path = selectedOp.path
    Object.entries(pathParams).forEach(([k, v]) => {
      path = path.replace(`{${k}}`, encodeURIComponent(v))
    })
    await runRequest(path, queryParams, setExplorerResult, setExplorerLoading)
  }

  const runCustom = async () => {
    let query: Record<string, string | number | undefined> = {}
    try {
      query = customQuery.trim() ? JSON.parse(customQuery) : {}
    } catch {
      toast.error("Custom query JSON is invalid.")
      return
    }
    await runRequest(customPath || "/", query, setCustomResult, setCustomLoading)
  }

  const customRows = normalizeRows(customResult?.data)
  const explorerRows = normalizeRows(explorerResult?.data)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>TVScreener Console</CardTitle>
          <CardDescription>
            TradingView-style screener and endpoint workbench. Exposes every endpoint available in the running TVScreener backend.
          </CardDescription>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {queryBase || "TVScreener URL not configured (`VITE_TVSCREENER_URL`)."}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={checkHealth} disabled={healthLoading || !queryBase}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {healthLoading ? "Checking…" : "Check health"}
          </Button>
          {docsUrl ? (
            <Button size="sm" variant="outline" onClick={() => window.open(docsUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open docs
            </Button>
          ) : null}
          {openapiUrl ? (
            <Button size="sm" variant="outline" onClick={() => window.open(openapiUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              OpenAPI
            </Button>
          ) : null}
          {specOps.length ? <Badge variant="secondary">{specOps.length} endpoints discovered</Badge> : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="explorer">Explorer</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Health response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {healthResult ? (
                <>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2 font-mono break-all">{healthResult.url}</div>
                  <div className="text-muted-foreground">
                    Status: <span className="text-foreground font-medium">{healthResult.status || "—"}</span>{" "}
                    · {healthResult.ok ? "OK" : "Error"}
                  </div>
                  {healthResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{healthResult.error}</div> : null}
                  {renderTable(healthResult.data) || (
                    <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(healthResult.data, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">Run a health check to validate connectivity.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explorer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoint explorer</CardTitle>
              <CardDescription>Select a discovered endpoint and run it with query/path parameters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {specError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  OpenAPI load warning: {specError}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="tvs-tag">Category</Label>
                  <select
                    id="tvs-tag"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                  >
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="tvs-search">Search endpoint</Label>
                  <Input
                    id="tvs-search"
                    value={endpointSearch}
                    onChange={(e) => setEndpointSearch(e.target.value)}
                    placeholder="e.g. screener, market, filter, scan"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tvs-op">Endpoint</Label>
                <select
                  id="tvs-op"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedOpId}
                  onChange={(e) => setSelectedOpId(e.target.value)}
                >
                  {filteredOps.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.method} {op.path}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOp ? (
                <>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
                    {selectedOp.summary}
                  </div>
                  {selectedOp.params.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedOp.params.map((param) => {
                        const enumValues = Array.isArray(param.schema?.enum) ? param.schema?.enum : []
                        return (
                          <div key={`${selectedOp.id}:${param.name}`} className="space-y-1">
                            <Label htmlFor={`tvs-param-${param.name}`}>
                              {param.name} {param.required ? "(required)" : "(optional)"} · {param.in}
                            </Label>
                            {enumValues.length ? (
                              <select
                                id={`tvs-param-${param.name}`}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={paramValues[param.name] || ""}
                                onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                              >
                                <option value="">(not set)</option>
                                {enumValues.map((value) => (
                                  <option key={String(value)} value={String(value)}>
                                    {String(value)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                id={`tvs-param-${param.name}`}
                                value={paramValues[param.name] || ""}
                                onChange={(e) => setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                                placeholder={param.description || param.schema?.type || param.name}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">This endpoint has no parameters.</div>
                  )}
                </>
              ) : null}
              <Button size="sm" onClick={runExplorer} disabled={explorerLoading || !selectedOp}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {explorerLoading ? "Running…" : "Run endpoint"}
              </Button>
              {explorerResult ? (
                <div className="space-y-2 text-xs">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2 font-mono break-all">{explorerResult.url}</div>
                  <div className="text-muted-foreground">
                    Status: <span className="text-foreground font-medium">{explorerResult.status || "—"}</span>{" "}
                    · {explorerResult.ok ? "OK" : "Error"} · Rows: {explorerRows.length}
                  </div>
                  {explorerResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{explorerResult.error}</div> : null}
                  {renderTable(explorerResult.data) || (
                    <pre className="max-h-96 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(explorerResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom request</CardTitle>
              <CardDescription>Run any TVScreener path with JSON query params.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="tvs-custom-path">Path</Label>
                <Input
                  id="tvs-custom-path"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/api/v1/..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tvs-custom-query">Query JSON</Label>
                <textarea
                  id="tvs-custom-query"
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={runCustom} disabled={customLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {customLoading ? "Running…" : "Run custom request"}
              </Button>
              {customResult ? (
                <div className="space-y-2 text-xs">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2 font-mono break-all">{customResult.url}</div>
                  <div className="text-muted-foreground">
                    Status: <span className="text-foreground font-medium">{customResult.status || "—"}</span> · {customResult.ok ? "OK" : "Error"} · Rows:{" "}
                    {customRows.length}
                  </div>
                  {customResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{customResult.error}</div> : null}
                  {renderTable(customResult.data) || (
                    <pre className="max-h-96 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(customResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
