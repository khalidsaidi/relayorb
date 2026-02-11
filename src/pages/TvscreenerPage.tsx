import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, RefreshCw, Download, SlidersHorizontal } from "lucide-react"
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

type AssetType = "stock" | "crypto" | "forex" | "bond" | "futures" | "coin"
type DiscoveryKind = "gainers" | "losers" | "active"
type SortMode = "change" | "volume" | "market_cap" | "price"

type ScreenerFilters = {
  assetType: AssetType
  market: string
  maxRows: string
  searchText: string
  minPrice: string
  maxPrice: string
  minMarketCap: string
  maxMarketCap: string
  minVolume: string
  minChangePct: string
  maxChangePct: string
  minRsi: string
  maxRsi: string
  sector: string
  industry: string
  moversOnly: boolean
  sortMode: SortMode
}

const DEFAULT_FILTERS: ScreenerFilters = {
  assetType: "stock",
  market: "AMERICA",
  maxRows: "100",
  searchText: "",
  minPrice: "2",
  maxPrice: "80",
  minMarketCap: "300000000",
  maxMarketCap: "20000000000",
  minVolume: "200000",
  minChangePct: "",
  maxChangePct: "",
  minRsi: "",
  maxRsi: "",
  sector: "",
  industry: "",
  moversOnly: false,
  sortMode: "volume",
}

const TABLE_PREFERRED_COLUMNS = [
  "NAME",
  "SYMBOL",
  "TICKER",
  "EXCHANGE",
  "PRICE",
  "CHANGE_PERCENT",
  "CHANGE",
  "VOLUME",
  "MARKET_CAPITALIZATION",
  "RSI",
  "SECTOR",
  "INDUSTRY",
] as const

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

function parseNum(raw: string) {
  const val = String(raw || "").trim()
  if (!val) return null
  const n = Number(val)
  if (!Number.isFinite(n)) return null
  return n
}

function normalizeRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (Array.isArray((data as any)?.rows)) return (data as any).rows as Record<string, unknown>[]
  if (Array.isArray((data as any)?.results)) return (data as any).results as Record<string, unknown>[]
  return []
}

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function formatMetric(value: unknown, mode: "price" | "percent" | "number" | "mcap" = "number") {
  if (value === null || value === undefined || value === "") return "—"
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  if (mode === "price") return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (mode === "percent") return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
  if (mode === "mcap") {
    const abs = Math.abs(n)
    if (abs >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
    return n.toLocaleString()
  }
  return n.toLocaleString()
}

function pickTableColumns(rows: Record<string, unknown>[]) {
  if (!rows.length) return []
  const keys = Object.keys(rows[0] || {})
  const byLower = new Map(keys.map((k) => [k.toLowerCase(), k]))
  const picked: string[] = []
  TABLE_PREFERRED_COLUMNS.forEach((name) => {
    const key = byLower.get(name.toLowerCase())
    if (key) picked.push(key)
  })
  if (picked.length >= 3) return picked
  return keys.slice(0, 12)
}

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

function downloadJson(name: string, data: unknown) {
  try {
    downloadBlob(`${name}.json`, JSON.stringify(data, null, 2), "application/json")
  } catch (err) {
    console.error("json export failed", err)
    toast.error("JSON export failed.")
  }
}

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.message("No rows to export.")
    return
  }
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const lines = [columns.join(",")]
  rows.forEach((row) => {
    lines.push(columns.map((col) => csvEscape((row as any)[col])).join(","))
  })
  try {
    downloadBlob(`${name}.csv`, lines.join("\n"), "text/csv;charset=utf-8")
  } catch (err) {
    console.error("csv export failed", err)
    toast.error("CSV export failed.")
  }
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
    if ((lower === "market" || lower === "country") && !defaults[p.name]) defaults[p.name] = "AMERICA"
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

  const [tab, setTab] = useState("screener")
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS)
  const [screenerResult, setScreenerResult] = useState<ResponseState>()
  const [screenerLoading, setScreenerLoading] = useState(false)
  const [lastRunSource, setLastRunSource] = useState<string>("")

  const [healthResult, setHealthResult] = useState<ResponseState>()
  const [healthLoading, setHealthLoading] = useState(false)

  const [fieldQuery, setFieldQuery] = useState("rsi")
  const [fieldResult, setFieldResult] = useState<ResponseState>()
  const [fieldLoading, setFieldLoading] = useState(false)
  const [categoriesResult, setCategoriesResult] = useState<ResponseState>()
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [presetList, setPresetList] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState("")
  const [presetLoading, setPresetLoading] = useState(false)
  const [presetDetail, setPresetDetail] = useState<ResponseState>()

  const [specOps, setSpecOps] = useState<ApiOperation[]>([])
  const [specError, setSpecError] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState("")
  const [selectedOpId, setSelectedOpId] = useState("")
  const [endpointSearch, setEndpointSearch] = useState("")
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [explorerBody, setExplorerBody] = useState('{"asset_type":"stock","market":"AMERICA","limit":50}')
  const [explorerResult, setExplorerResult] = useState<ResponseState>()
  const [explorerLoading, setExplorerLoading] = useState(false)

  const [customPath, setCustomPath] = useState("/api/v1/discovery/gainers")
  const [customMethod, setCustomMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("GET")
  const [customQuery, setCustomQuery] = useState('{"asset_type":"stock","market":"AMERICA","limit":50}')
  const [customBody, setCustomBody] = useState("{}")
  const [customResult, setCustomResult] = useState<ResponseState>()
  const [customLoading, setCustomLoading] = useState(false)

  const runRequest = async (
    path: string,
    query: Record<string, string | number | undefined>,
    setTarget: (value: ResponseState) => void,
    setLoading: (value: boolean) => void,
    init?: RequestInit
  ) => {
    if (!queryBase) {
      toast.error("TVScreener API URL not configured.")
      return
    }
    const url = buildUrl(queryBase, path, query)
    setLoading(true)
    try {
      const res = await fetchJsonWithMeta("TVScreener", url, init, 45000)
      setTarget({ url, status: res.status, ok: true, data: res.data })
      return res.data
    } catch (err) {
      if (err instanceof HttpRequestError) {
        const message = err.bodyText || err.message
        setTarget({ url, status: err.status, ok: false, data: null, error: message })
        toast.error(message)
        return null
      }
      const message = err instanceof Error ? err.message : String(err)
      setTarget({ url, status: 0, ok: false, data: null, error: message })
      toast.error(message)
      return null
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
    const loadOpenApiAndPresets = async () => {
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
          break
        } catch (err) {
          setSpecError(err instanceof Error ? err.message : "Failed loading OpenAPI spec")
        }
      }

      try {
        const presetsData = await fetchJsonWithMeta<any>("TVScreener", buildUrl(queryBase, "/api/v1/presets"), undefined, 20000)
        const names = Array.isArray(presetsData.data?.presets) ? presetsData.data.presets.map((v: unknown) => String(v)) : []
        setPresetList(names)
        setSelectedPreset((prev) => prev || names[0] || "")
      } catch {
        setPresetList([])
      }
    }
    loadOpenApiAndPresets()
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

  const screenerRows = useMemo(() => normalizeRows(screenerResult?.data), [screenerResult])
  const screenerColumns = useMemo(() => pickTableColumns(screenerRows), [screenerRows])
  const screenerWarnings = useMemo(() => {
    const warnings = (screenerResult?.data as any)?.warnings
    return Array.isArray(warnings) ? warnings.map((w) => String(w)) : []
  }, [screenerResult])

  const fieldRows = useMemo(() => normalizeRows(fieldResult?.data), [fieldResult])
  const fieldColumns = useMemo(() => pickTableColumns(fieldRows), [fieldRows])

  const customRows = useMemo(() => normalizeRows(customResult?.data), [customResult])
  const customColumns = useMemo(() => pickTableColumns(customRows), [customRows])
  const explorerRows = useMemo(() => normalizeRows(explorerResult?.data), [explorerResult])
  const explorerColumns = useMemo(() => pickTableColumns(explorerRows), [explorerRows])

  const updateFilter = <K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const validateScreenerFilters = () => {
    const errors: string[] = []
    const maxRows = parseNum(filters.maxRows)
    if (!maxRows || maxRows < 1 || maxRows > 500) errors.push("Max rows must be between 1 and 500.")

    const ranges: Array<[string, string, string]> = [
      [filters.minPrice, filters.maxPrice, "Price"],
      [filters.minMarketCap, filters.maxMarketCap, "Market cap"],
      [filters.minChangePct, filters.maxChangePct, "Change %"],
      [filters.minRsi, filters.maxRsi, "RSI"],
    ]

    ranges.forEach(([rawMin, rawMax, label]) => {
      const min = parseNum(rawMin)
      const max = parseNum(rawMax)
      if (rawMin && min === null) errors.push(`${label} min must be a plain number.`)
      if (rawMax && max === null) errors.push(`${label} max must be a plain number.`)
      if (min !== null && max !== null && min > max) errors.push(`${label}: min must be <= max.`)
      if (min !== null && min < 0 && label !== "Change %" && label !== "RSI") errors.push(`${label} min cannot be negative.`)
      if (max !== null && max < 0 && label !== "Change %" && label !== "RSI") errors.push(`${label} max cannot be negative.`)
    })

    const minVolume = parseNum(filters.minVolume)
    if (filters.minVolume && minVolume === null) errors.push("Min volume must be a plain number.")
    if (minVolume !== null && minVolume < 0) errors.push("Min volume cannot be negative.")

    return errors
  }

  const buildSortByField = (mode: SortMode) => {
    if (mode === "change") return "CHANGE_PERCENT"
    if (mode === "volume") return "VOLUME"
    if (mode === "price") return "PRICE"
    return "MARKET_CAPITALIZATION"
  }

  const runScreener = async () => {
    if (!queryBase) {
      toast.error("TVScreener API URL not configured.")
      return
    }
    const errors = validateScreenerFilters()
    if (errors.length) {
      toast.error(`Fix ${errors.length} input issue(s) before running.`)
      setScreenerResult({
        url: buildUrl(queryBase, "/api/v1/query"),
        status: 0,
        ok: false,
        data: null,
        error: errors.join(" "),
      })
      return
    }

    const body: any = {
      asset_type: filters.assetType,
      market: filters.market || undefined,
      search: filters.searchText.trim() || undefined,
      limit: parseNum(filters.maxRows) || 100,
      sort_by: buildSortByField(filters.sortMode),
      ascending: false,
      fields: [
        "NAME",
        "SYMBOL",
        "EXCHANGE",
        "PRICE",
        "CHANGE_PERCENT",
        "VOLUME",
        "MARKET_CAPITALIZATION",
        "RSI",
        "SECTOR",
        "INDUSTRY",
      ],
      filters: [] as Array<{ field: string; op: string; value: unknown }>,
    }

    const pushRange = (field: string, minRaw: string, maxRaw: string) => {
      const min = parseNum(minRaw)
      const max = parseNum(maxRaw)
      if (min !== null) body.filters.push({ field, op: ">=", value: min })
      if (max !== null) body.filters.push({ field, op: "<=", value: max })
    }

    pushRange("PRICE", filters.minPrice, filters.maxPrice)
    pushRange("MARKET_CAPITALIZATION", filters.minMarketCap, filters.maxMarketCap)
    pushRange("CHANGE_PERCENT", filters.minChangePct, filters.maxChangePct)
    pushRange("RSI", filters.minRsi, filters.maxRsi)

    const minVolume = parseNum(filters.minVolume)
    if (minVolume !== null) body.filters.push({ field: "VOLUME", op: ">=", value: minVolume })
    if (filters.sector.trim()) body.filters.push({ field: "SECTOR", op: "match", value: filters.sector.trim() })
    if (filters.industry.trim()) body.filters.push({ field: "INDUSTRY", op: "match", value: filters.industry.trim() })

    if (filters.moversOnly && parseNum(filters.minChangePct) === null) {
      body.filters.push({ field: "CHANGE_PERCENT", op: ">=", value: 2 })
    }

    const result = await runRequest(
      "/api/v1/query",
      {},
      setScreenerResult,
      setScreenerLoading,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )

    const rows = normalizeRows(result)
    setLastRunSource("custom_screener")
    if (!rows.length) {
      toast.message("No rows matched these filters. Widen ranges or use Top Gainers/Losers.")
    } else {
      toast.success(`Loaded ${rows.length} rows.`)
    }
  }

  const runDiscovery = async (kind: DiscoveryKind) => {
    const rowsLimit = parseNum(filters.maxRows) || 100
    const result = await runRequest(
      `/api/v1/discovery/${kind}`,
      {
        asset_type: filters.assetType,
        market: filters.market || undefined,
        limit: rowsLimit,
      },
      setScreenerResult,
      setScreenerLoading
    )
    const rows = normalizeRows(result)
    setLastRunSource(`discovery:${kind}`)
    if (!rows.length) toast.message(`No rows from ${kind}. Try another market or broader settings.`)
    else toast.success(`Loaded ${rows.length} ${kind} rows.`)
  }

  const loadFields = async () => {
    if (!fieldQuery.trim()) {
      toast.error("Enter a field keyword (for example: rsi, volume, market_cap).")
      return
    }
    await runRequest(
      "/api/v1/fields/search",
      { q: fieldQuery.trim(), asset_type: filters.assetType, limit: 120 },
      setFieldResult,
      setFieldLoading
    )
  }

  const loadCategories = async () => {
    await runRequest(
      "/api/v1/fields/categories",
      { asset_type: filters.assetType },
      setCategoriesResult,
      setCategoriesLoading
    )
  }

  const loadPresetDetail = async () => {
    if (!selectedPreset) {
      toast.error("Choose a preset first.")
      return
    }
    await runRequest(`/api/v1/presets/${encodeURIComponent(selectedPreset)}`, {}, setPresetDetail, setPresetLoading)
  }

  const runPreset = async () => {
    if (!selectedPreset || !queryBase) {
      toast.error("Choose a preset first.")
      return
    }
    setPresetLoading(true)
    try {
      const presetRes = await fetchJsonWithMeta<any>("TVScreener", buildUrl(queryBase, `/api/v1/presets/${encodeURIComponent(selectedPreset)}`))
      const names = Array.isArray(presetRes.data?.fields) ? presetRes.data.fields.map((f: any) => String(f?.name || "")).filter(Boolean) : []
      if (!names.length) {
        toast.error("Preset has no fields.")
        return
      }
      const body = {
        asset_type: filters.assetType,
        market: filters.market || undefined,
        limit: parseNum(filters.maxRows) || 100,
        fields: names,
      }
      const result = await runRequest(
        "/api/v1/query",
        {},
        setScreenerResult,
        setScreenerLoading,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      )
      const rows = normalizeRows(result)
      setLastRunSource(`preset:${selectedPreset}`)
      if (!rows.length) toast.message(`Preset "${selectedPreset}" returned no rows.`)
      else toast.success(`Preset "${selectedPreset}" loaded ${rows.length} rows.`)
      setTab("screener")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setPresetLoading(false)
    }
  }

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

    if (selectedOp.method === "GET" || selectedOp.method === "DELETE") {
      await runRequest(path, queryParams, setExplorerResult, setExplorerLoading, selectedOp.method === "DELETE" ? { method: "DELETE" } : undefined)
      return
    }

    let parsedBody: unknown = {}
    if (explorerBody.trim()) {
      try {
        parsedBody = JSON.parse(explorerBody)
      } catch {
        toast.error("Explorer body JSON is invalid.")
        return
      }
    }
    await runRequest(
      path,
      queryParams,
      setExplorerResult,
      setExplorerLoading,
      { method: selectedOp.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsedBody) }
    )
  }

  const runCustom = async () => {
    let query: Record<string, string | number | undefined> = {}
    if (customQuery.trim()) {
      try {
        query = JSON.parse(customQuery)
      } catch {
        toast.error("Custom query JSON is invalid.")
        return
      }
    }

    if (customMethod === "GET" || customMethod === "DELETE") {
      await runRequest(customPath || "/", query, setCustomResult, setCustomLoading, customMethod === "DELETE" ? { method: "DELETE" } : undefined)
      return
    }

    let body: unknown = {}
    if (customBody.trim()) {
      try {
        body = JSON.parse(customBody)
      } catch {
        toast.error("Custom body JSON is invalid.")
        return
      }
    }
    await runRequest(
      customPath || "/",
      query,
      setCustomResult,
      setCustomLoading,
      { method: customMethod, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    )
  }

  const renderRowsTable = (rows: Record<string, unknown>[], columns: string[]) => {
    if (!rows.length) return <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">No rows loaded yet.</div>
    return (
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((row, idx) => (
              <tr key={idx} className="border-t border-border/60">
                {columns.map((col) => {
                  const raw = (row as any)[col]
                  const lower = col.toLowerCase()
                  const value =
                    lower.includes("price")
                      ? formatMetric(raw, "price")
                      : lower.includes("change_percent")
                        ? formatMetric(raw, "percent")
                        : lower.includes("market_cap")
                          ? formatMetric(raw, "mcap")
                          : renderValue(raw)
                  return (
                    <td key={col} className="px-3 py-2 text-foreground whitespace-nowrap">
                      {value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const categories = useMemo(() => {
    const raw = (categoriesResult?.data as any)?.categories
    if (!raw || typeof raw !== "object") return []
    return Object.entries(raw as Record<string, any[]>)
  }, [categoriesResult])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>TVScreener</CardTitle>
          <CardDescription>
            Trader-focused screener for movers, filtered scans, and field discovery. Advanced endpoint tools are still available under Advanced.
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
              API docs
            </Button>
          ) : null}
          {openapiUrl ? (
            <Button size="sm" variant="outline" onClick={() => window.open(openapiUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              OpenAPI
            </Button>
          ) : null}
          {specOps.length ? <Badge variant="secondary">{specOps.length} endpoints</Badge> : null}
          {lastRunSource ? <Badge variant="outline">Last source: {lastRunSource}</Badge> : null}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="screener">Screener</TabsTrigger>
          <TabsTrigger value="discover">Fields & Presets</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="screener" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run screen</CardTitle>
              <CardDescription>
                Use presets for quick market scans, or run custom filters for your strategy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => runDiscovery("gainers")} disabled={screenerLoading}>
                  Top gainers
                </Button>
                <Button size="sm" variant="outline" onClick={() => runDiscovery("losers")} disabled={screenerLoading}>
                  Top losers
                </Button>
                <Button size="sm" variant="outline" onClick={() => runDiscovery("active")} disabled={screenerLoading}>
                  Most active
                </Button>
                <Button size="sm" onClick={runScreener} disabled={screenerLoading}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {screenerLoading ? "Running…" : "Run filtered screener"}
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="tvs-asset">Asset</Label>
                  <select
                    id="tvs-asset"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.assetType}
                    onChange={(e) => updateFilter("assetType", e.target.value as AssetType)}
                  >
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                    <option value="forex">Forex</option>
                    <option value="futures">Futures</option>
                    <option value="bond">Bond</option>
                    <option value="coin">Coin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-market">Market</Label>
                  <Input id="tvs-market" value={filters.market} onChange={(e) => updateFilter("market", e.target.value)} placeholder="AMERICA" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-max-rows">Max rows</Label>
                  <Input id="tvs-max-rows" value={filters.maxRows} onChange={(e) => updateFilter("maxRows", e.target.value)} placeholder="100" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-sort">Sort by</Label>
                  <select
                    id="tvs-sort"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={filters.sortMode}
                    onChange={(e) => updateFilter("sortMode", e.target.value as SortMode)}
                  >
                    <option value="volume">Volume</option>
                    <option value="change">Change %</option>
                    <option value="market_cap">Market cap</option>
                    <option value="price">Price</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="tvs-search">Ticker/name contains</Label>
                  <Input id="tvs-search" value={filters.searchText} onChange={(e) => updateFilter("searchText", e.target.value)} placeholder="AAPL, AI, semiconductors" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-min-price">Min price</Label>
                  <Input id="tvs-min-price" value={filters.minPrice} onChange={(e) => updateFilter("minPrice", e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-max-price">Max price</Label>
                  <Input id="tvs-max-price" value={filters.maxPrice} onChange={(e) => updateFilter("maxPrice", e.target.value)} placeholder="80" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-min-volume">Min volume</Label>
                  <Input id="tvs-min-volume" value={filters.minVolume} onChange={(e) => updateFilter("minVolume", e.target.value)} placeholder="200000" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="tvs-min-cap">Min market cap</Label>
                  <Input id="tvs-min-cap" value={filters.minMarketCap} onChange={(e) => updateFilter("minMarketCap", e.target.value)} placeholder="300000000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-max-cap">Max market cap</Label>
                  <Input id="tvs-max-cap" value={filters.maxMarketCap} onChange={(e) => updateFilter("maxMarketCap", e.target.value)} placeholder="20000000000" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-min-change">Min change %</Label>
                  <Input id="tvs-min-change" value={filters.minChangePct} onChange={(e) => updateFilter("minChangePct", e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-max-change">Max change %</Label>
                  <Input id="tvs-max-change" value={filters.maxChangePct} onChange={(e) => updateFilter("maxChangePct", e.target.value)} placeholder="(optional)" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="tvs-min-rsi">Min RSI</Label>
                  <Input id="tvs-min-rsi" value={filters.minRsi} onChange={(e) => updateFilter("minRsi", e.target.value)} placeholder="(optional)" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-max-rsi">Max RSI</Label>
                  <Input id="tvs-max-rsi" value={filters.maxRsi} onChange={(e) => updateFilter("maxRsi", e.target.value)} placeholder="(optional)" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-sector">Sector contains</Label>
                  <Input id="tvs-sector" value={filters.sector} onChange={(e) => updateFilter("sector", e.target.value)} placeholder="Technology" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-industry">Industry contains</Label>
                  <Input id="tvs-industry" value={filters.industry} onChange={(e) => updateFilter("industry", e.target.value)} placeholder="Software" />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filters.moversOnly}
                  onChange={(e) => updateFilter("moversOnly", e.target.checked)}
                />
                Movers only (adds min change % = 2 if empty)
              </label>

              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                Tip: all number fields must be plain numbers. For stocks, market usually = AMERICA. Use quick presets for broad scans, then tighten filters.
              </div>

              {screenerResult ? (
                <div className="space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>
                      Status: <span className="text-foreground font-medium">{screenerResult.status || "—"}</span>
                    </span>
                    <span>Rows: {screenerRows.length}</span>
                    <Button size="sm" variant="outline" onClick={() => downloadCsv("tvscreener-rows", screenerRows)} disabled={!screenerRows.length}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadJson("tvscreener-result", screenerResult.data)} disabled={!screenerResult.data}>
                      <Download className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                  </div>
                  {screenerWarnings.length ? (
                    <div className="rounded-md border border-amber-400/50 bg-amber-100/20 p-2 text-amber-700">
                      {screenerWarnings.map((w, i) => (
                        <div key={i}>Warning: {w}</div>
                      ))}
                    </div>
                  ) : null}
                  {screenerResult.error ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{screenerResult.error}</div>
                  ) : null}
                  {renderRowsTable(screenerRows, screenerColumns)}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field search</CardTitle>
              <CardDescription>Find available TVScreener fields before building custom scans.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="tvs-field-q">Field keyword</Label>
                  <Input id="tvs-field-q" value={fieldQuery} onChange={(e) => setFieldQuery(e.target.value)} placeholder="rsi, volume, market_cap, recommendation" />
                </div>
                <Button size="sm" onClick={loadFields} disabled={fieldLoading}>
                  {fieldLoading ? "Searching…" : "Search fields"}
                </Button>
                <Button size="sm" variant="outline" onClick={loadCategories} disabled={categoriesLoading}>
                  {categoriesLoading ? "Loading…" : "Load field categories"}
                </Button>
              </div>
              {fieldResult ? (
                <div className="space-y-2 text-xs">
                  <div className="text-muted-foreground">Rows: {fieldRows.length}</div>
                  {fieldResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{fieldResult.error}</div> : null}
                  {renderRowsTable(fieldRows, fieldColumns)}
                </div>
              ) : null}
              {categories.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {categories.map(([name, items]) => (
                    <Card key={name}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{name.replace(/_/g, " ")}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {(items as any[]).slice(0, 8).map((item, idx) => (
                          <div key={idx} className="rounded border border-border/60 px-2 py-1">
                            <div className="font-medium">{String(item?.label || item?.name || "Field")}</div>
                            <div className="text-muted-foreground">{String(item?.api_field || item?.name || "—")}</div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Presets</CardTitle>
              <CardDescription>Run built-in presets quickly, then refine in Screener tab.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="tvs-preset">Preset</Label>
                  <select
                    id="tvs-preset"
                    className="w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                  >
                    {!presetList.length ? <option value="">(no presets loaded)</option> : null}
                    {presetList.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={loadPresetDetail} disabled={presetLoading || !selectedPreset}>
                  {presetLoading ? "Loading…" : "View preset fields"}
                </Button>
                <Button size="sm" onClick={runPreset} disabled={screenerLoading || presetLoading || !selectedPreset}>
                  Run preset
                </Button>
              </div>
              {presetDetail ? (
                <div className="space-y-2 text-xs">
                  {presetDetail.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{presetDetail.error}</div> : null}
                  {!presetDetail.error ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                      Fields: {Array.isArray((presetDetail.data as any)?.fields) ? (presetDetail.data as any).fields.length : 0}
                    </div>
                  ) : null}
                  {!presetDetail.error ? (
                    <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify((presetDetail.data as any)?.fields || [], null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoint explorer</CardTitle>
              <CardDescription>Power-user mode for direct endpoint execution.</CardDescription>
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
                  <Label htmlFor="tvs-search-endpoint">Search endpoint</Label>
                  <Input
                    id="tvs-search-endpoint"
                    value={endpointSearch}
                    onChange={(e) => setEndpointSearch(e.target.value)}
                    placeholder="screener, discovery, fields, presets"
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
                  <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">{selectedOp.summary}</div>
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
                    <div className="text-xs text-muted-foreground">This endpoint has no explicit parameters.</div>
                  )}
                  {selectedOp.method !== "GET" ? (
                    <div className="space-y-1">
                      <Label htmlFor="tvs-explorer-body">Request body JSON ({selectedOp.method})</Label>
                      <textarea
                        id="tvs-explorer-body"
                        className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        value={explorerBody}
                        onChange={(e) => setExplorerBody(e.target.value)}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
              <Button size="sm" onClick={runExplorer} disabled={explorerLoading || !selectedOp}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {explorerLoading ? "Running…" : "Run endpoint"}
              </Button>
              {explorerResult ? (
                <div className="space-y-2 text-xs">
                  <div className="text-muted-foreground">
                    Status: <span className="text-foreground font-medium">{explorerResult.status || "—"}</span> · Rows: {explorerRows.length}
                  </div>
                  {explorerResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{explorerResult.error}</div> : null}
                  {renderRowsTable(explorerRows, explorerColumns)}
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">Raw response</summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(explorerResult.data, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom request</CardTitle>
              <CardDescription>Manual requests for troubleshooting and one-off tests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="tvs-custom-path">Path</Label>
                  <Input
                    id="tvs-custom-path"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="/api/v1/..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tvs-custom-method">Method</Label>
                  <select
                    id="tvs-custom-method"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={customMethod}
                    onChange={(e) => setCustomMethod(e.target.value as any)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tvs-custom-query">Query params JSON</Label>
                <textarea
                  id="tvs-custom-query"
                  className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
              </div>
              {customMethod !== "GET" && customMethod !== "DELETE" ? (
                <div className="space-y-1">
                  <Label htmlFor="tvs-custom-body">Body JSON</Label>
                  <textarea
                    id="tvs-custom-body"
                    className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                  />
                </div>
              ) : null}
              <Button size="sm" onClick={runCustom} disabled={customLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {customLoading ? "Running…" : "Run custom request"}
              </Button>
              {customResult ? (
                <div className="space-y-2 text-xs">
                  <div className="text-muted-foreground">
                    Status: <span className="text-foreground font-medium">{customResult.status || "—"}</span> · Rows: {customRows.length}
                  </div>
                  {customResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{customResult.error}</div> : null}
                  {renderRowsTable(customRows, customColumns)}
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">Raw response</summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(customResult.data, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {healthResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="text-muted-foreground">
              Status: <span className="text-foreground font-medium">{healthResult.status || "—"}</span> · {healthResult.ok ? "OK" : "Error"}
            </div>
            {healthResult.error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">{healthResult.error}</div> : null}
            <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
              {JSON.stringify(healthResult.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
