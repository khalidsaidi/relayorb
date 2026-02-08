import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExternalLink, RefreshCw, Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { resolveOpenbbApiUrl, resolveMarketDataProxyUrl } from "@/lib/runtime-urls"
import { fetchJsonOrThrow, fetchJsonWithMeta, HttpRequestError } from "@/lib/http"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartFrame } from "@/components/charts/ChartFrame"
import { CandlesChart, type Candle } from "@/components/charts/CandlesChart"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts"

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

type ExplorerTemplate = {
  id: string
  label: string
  description: string
  method: string
  path: string
  // Optional template param overrides. We allow `undefined` so template objects can omit keys
  // without fighting TS's union inference.
  params?: Record<string, string | undefined>
}

// Only expose providers that are marked enabled in env (comma‑separated).
function resolveProviders() {
  const allowed = new Set(["yfinance", "intrinio"]) // FMP deliberately hidden until credentials validate (401 currently)
  const raw = (import.meta.env.VITE_OPENBB_PROVIDERS || "").trim()
  if (!raw) return ["yfinance", "intrinio"]
  const parsed = raw
    .split(",")
    .map((p: string) => p.trim())
    .filter((p: string) => allowed.has(p))
  return parsed.length ? parsed : ["yfinance"]
}

const AVAILABLE_QUOTE_PROVIDERS = resolveProviders()
const DEFAULT_QUOTE_PROVIDER = AVAILABLE_QUOTE_PROVIDERS[0]

function buildUrl(base: string, path: string, params: Record<string, string | number | undefined>) {
  // `new URL("/x", "https://host/base")` will drop `/base` and resolve to `https://host/x`.
  // Our OpenBB API is mounted under a base path (e.g. `/openbb`), so we must treat `path`
  // as relative when it begins with `/`.
  const normalizedBase = base.endsWith("/") ? base : `${base}/`
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path
  const url = new URL(normalizedPath, normalizedBase)
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

function renderValue(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number" && Number.isFinite(value)) {
    const abs = Math.abs(value)
    // Compact for large magnitudes, fixed for typical prices/ratios.
    if (abs >= 1000) {
      try {
        return new Intl.NumberFormat(undefined, {
          notation: "compact",
          maximumFractionDigits: 2,
        }).format(value)
      } catch {
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      }
    }
    if (abs >= 1) {
      const fixed = value.toFixed(2)
      return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed
    }
    // Very small values: keep a few sig figs.
    return value.toPrecision(3)
  }
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
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

function normalizeAsOf(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    // Heuristic: seconds vs millis.
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null
  if (/^\\d{10,13}$/.test(raw)) {
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    const ms = raw.length <= 10 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return raw
}

function firstResult(data: any): Record<string, unknown> {
  if (!data) return {}
  if (Array.isArray(data?.results) && data.results.length) return data.results[0]
  if (Array.isArray(data?.results) && data.results.length === 0) return {}
  if (Array.isArray(data) && data.length) return data[0]
  if (typeof data === "object") return data
  return {}
}

function lastResult(data: any): Record<string, unknown> {
  if (!data) return {}
  if (Array.isArray(data?.results) && data.results.length) return data.results[data.results.length - 1]
  if (Array.isArray(data?.results) && data.results.length === 0) return {}
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

function normalizeWatchlistAlertKeys(keys: string[]) {
  const out = new Set<string>()
  ;(keys || []).forEach((k) => {
    const key = String(k || "").trim().toLowerCase()
    if (!key) return
    // Back-compat with earlier labels.
    if (key === "sentiment") out.add("rating")
    else if (key === "price") out.add("rsi")
    else if (key === "filing") out.add("filings")
    else out.add(key)
  })
  return out
}

function toCandles(data: unknown): Candle[] {
  const rows = normalizeRows(data)
  if (!rows.length) return []
  const out: Candle[] = []
  rows.forEach((row) => {
    const dateRaw = (row as any).date || (row as any).datetime || (row as any).timestamp
    const date = typeof dateRaw === "string" ? dateRaw : dateRaw ? String(dateRaw) : ""
    if (!date) return
    const close = Number((row as any).close ?? (row as any).adj_close ?? (row as any).last_price ?? (row as any).price)
    if (!Number.isFinite(close)) return

    // Some providers return close-only rows. We still want technicals (and a best-effort candle chart),
    // so fill missing OHLC fields from close.
    const openRaw = Number((row as any).open)
    const highRaw = Number((row as any).high)
    const lowRaw = Number((row as any).low)
    const open = Number.isFinite(openRaw) ? openRaw : close
    let high = Number.isFinite(highRaw) ? highRaw : close
    let low = Number.isFinite(lowRaw) ? lowRaw : close
    // Ensure a sane candle even if inputs are weird.
    high = Math.max(high, open, close)
    low = Math.min(low, open, close)
    const volumeRaw = (row as any).volume ?? (row as any).total_volume
    const volume = volumeRaw === null || volumeRaw === undefined ? null : Number(volumeRaw)
    out.push({ time: date, open, high, low, close, volume })
  })
  return out
}

function sortCandlesAsc(candles: Candle[]) {
  return [...candles].sort((a, b) => {
    const ta = new Date(String(a.time)).getTime()
    const tb = new Date(String(b.time)).getTime()
    return ta - tb
  })
}

function filterCandlesSince(candles: Candle[], startDateIso?: string) {
  if (!startDateIso) return candles
  const start = new Date(startDateIso).getTime()
  if (!Number.isFinite(start)) return candles
  return candles.filter((c) => {
    const t = new Date(String(c.time)).getTime()
    return Number.isFinite(t) ? t >= start : true
  })
}

function minIsoDate(a?: string, b?: string) {
  if (!a) return b
  if (!b) return a
  // Both are YYYY-MM-DD, so lexicographic order matches chronological order.
  return a < b ? a : b
}

function computeDisplayStartDate(range: string) {
  const now = new Date()
  const copy = new Date(now)
  const lower = range.toUpperCase()
  if (lower === "1D" || lower === "1DAY") copy.setDate(now.getDate() - 1)
  else if (lower === "5D") copy.setDate(now.getDate() - 5)
  else if (lower === "1M") copy.setMonth(now.getMonth() - 1)
  else if (lower === "3M") copy.setMonth(now.getMonth() - 3)
  else if (lower === "6M") copy.setMonth(now.getMonth() - 6)
  else if (lower === "1Y") copy.setFullYear(now.getFullYear() - 1)
  else if (lower === "5Y") copy.setFullYear(now.getFullYear() - 5)
  else return undefined
  return copy.toISOString().slice(0, 10)
}

function computeSmaSeries(values: number[], length: number): Array<number | null> {
  if (!values.length || length <= 1) return values.map((v) => (Number.isFinite(v) ? v : null))
  const out: Array<number | null> = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    sum += v
    if (i >= length) sum -= values[i - length]
    if (i >= length - 1) out[i] = sum / length
  }
  return out
}

function computeRsiSeries(values: number[], length: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length <= length) return out

  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= length; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gainSum += diff
    else lossSum += -diff
  }
  let avgGain = gainSum / length
  let avgLoss = lossSum / length
  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss
  out[length] = 100 - 100 / (1 + rs0)

  for (let i = length + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (length - 1) + gain) / length
    avgLoss = (avgLoss * (length - 1) + loss) / length
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
    out[i] = 100 - 100 / (1 + rs)
  }
  return out
}

function computeBollingerSeries(values: number[], length: number, stdMult: number) {
  const middle: Array<number | null> = new Array(values.length).fill(null)
  const upper: Array<number | null> = new Array(values.length).fill(null)
  const lower: Array<number | null> = new Array(values.length).fill(null)
  if (!values.length || length <= 1) return { middle, upper, lower }

  let sum = 0
  let sumsq = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    sum += v
    sumsq += v * v
    if (i >= length) {
      const old = values[i - length]
      sum -= old
      sumsq -= old * old
    }
    if (i < length - 1) continue
    const mean = sum / length
    const variance = sumsq / length - mean * mean
    const stdev = Math.sqrt(Math.max(variance, 0))
    middle[i] = mean
    upper[i] = mean + stdev * stdMult
    lower[i] = mean - stdev * stdMult
  }
  return { middle, upper, lower }
}

function computeTechnicalsFromCandles(candlesIn: Candle[], opts?: { rsiLen?: number; maLen?: number; bbLen?: number; bbStd?: number }) {
  const rsiLen = opts?.rsiLen ?? 14
  const maLen = opts?.maLen ?? 20
  const bbLen = opts?.bbLen ?? 20
  const bbStd = opts?.bbStd ?? 2

  const candles = sortCandlesAsc(candlesIn).filter((c) => Number.isFinite(c.close))
  const closes = candles.map((c) => c.close)
  const rsi = computeRsiSeries(closes, rsiLen)
  const ma = computeSmaSeries(closes, maLen)
  const bb = computeBollingerSeries(closes, bbLen, bbStd)

  const rsiResults = candles
    .map((c, idx) => (rsi[idx] === null ? null : { date: String(c.time), value: Number((rsi[idx] as number).toFixed(2)) }))
    .filter(Boolean) as Record<string, unknown>[]
  const maResults = candles
    .map((c, idx) => (ma[idx] === null ? null : { date: String(c.time), ma: Number((ma[idx] as number).toFixed(2)) }))
    .filter(Boolean) as Record<string, unknown>[]
  const bbResults = candles
    .map((c, idx) =>
      bb.middle[idx] === null || bb.upper[idx] === null || bb.lower[idx] === null
        ? null
        : {
            date: String(c.time),
            middle: Number((bb.middle[idx] as number).toFixed(2)),
            upper: Number((bb.upper[idx] as number).toFixed(2)),
            lower: Number((bb.lower[idx] as number).toFixed(2)),
          }
    )
    .filter(Boolean) as Record<string, unknown>[]

  return {
    computed: true,
    meta: {
      candleCount: candles.length,
      rsiLen,
      maLen,
      bbLen,
      bbStd,
    },
    rsi: { results: rsiResults },
    ma: { results: maResults },
    bb: { results: bbResults },
  }
}

function mergeTechnicalsRows(technicals: any) {
  const map = new Map<string, Record<string, unknown>>()
  const put = (date: string, patch: Record<string, unknown>) => {
    if (!date) return
    const prev = map.get(date) || { date }
    map.set(date, { ...prev, ...patch })
  }

  const rsiRows = normalizeRows(technicals?.rsi?.results || technicals?.rsi)
  rsiRows.forEach((r) => {
    const date = String((r as any).date || (r as any).datetime || (r as any).timestamp || "")
    const value = (r as any).value ?? (r as any).rsi
    if (typeof value === "number") put(date, { rsi: value })
  })
  const maRows = normalizeRows(technicals?.ma?.results || technicals?.ma)
  maRows.forEach((r) => {
    const date = String((r as any).date || (r as any).datetime || (r as any).timestamp || "")
    const value = (r as any).ma ?? (r as any).value
    if (typeof value === "number") put(date, { ma: value })
  })
  const bbRows = normalizeRows(technicals?.bb?.results || technicals?.bb)
  bbRows.forEach((r) => {
    const date = String((r as any).date || (r as any).datetime || (r as any).timestamp || "")
    const upper = (r as any).upper
    const lower = (r as any).lower
    const middle = (r as any).middle
    const patch: Record<string, unknown> = {}
    if (typeof upper === "number") patch.bb_upper = upper
    if (typeof middle === "number") patch.bb_middle = middle
    if (typeof lower === "number") patch.bb_lower = lower
    if (Object.keys(patch).length) put(date, patch)
  })

  return Array.from(map.values()).sort((a, b) => {
    const da = new Date(String(a.date)).getTime()
    const db = new Date(String(b.date)).getTime()
    return da - db
  })
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
    <ChartFrame height={240} className="min-h-[240px]">
      {({ width, height }) => (
        <LineChart width={width} height={height} data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
          <XAxis dataKey={resolvedXKey} tick={{ fontSize: 10 }} minTickGap={16} />
          <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ fontSize: "11px" }} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          {numericKeys.slice(0, 4).map((k, idx) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={["#2563eb", "#16a34a", "#f97316", "#a855f7"][idx % 4]}
              dot={false}
              strokeWidth={1.6}
            />
          ))}
        </LineChart>
      )}
    </ChartFrame>
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

function normalizeComparisonSeries(series: Record<string, unknown>[], symbols: string[]) {
  const bases = new Map<string, number>()
  symbols.forEach((sym) => {
    for (const row of series) {
      const v = (row as any)[sym]
      if (typeof v === "number" && Number.isFinite(v)) {
        bases.set(sym, v)
        break
      }
    }
  })

  return series.map((row) => {
    const out: Record<string, unknown> = { date: (row as any).date }
    symbols.forEach((sym) => {
      const base = bases.get(sym)
      const v = (row as any)[sym]
      if (typeof v === "number" && Number.isFinite(v) && base && Number.isFinite(base)) {
        out[sym] = ((v / base) - 1) * 100
      }
    })
    return out
  })
}

function renderComparisonChart(history: { sym: string; data: any }[], mode: "price" | "pct" = "price") {
  if (!history.length) return null
  const symbols = history.map((h) => h.sym)
  let series = buildComparisonSeries(history)
  if (!series.length) return null
  if (mode === "pct") {
    series = normalizeComparisonSeries(series, symbols)
  }
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

function ResponseCard({ title, result, showRawJson }: { title: string; result?: ResponseState; showRawJson?: boolean }) {
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
        {showRawJson ? (
          <details className="rounded-lg border border-border/60 bg-muted/20 p-2 text-[11px]">
            <summary className="cursor-pointer text-muted-foreground">Raw JSON</summary>
            <pre className="max-h-72 overflow-auto p-2 text-[11px] text-muted-foreground">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  )
}

function QuoteCard({ quote, provider }: { quote: Record<string, unknown>; provider?: string }) {
  if (!quote || !Object.keys(quote).length) return null
  const asOf = normalizeAsOf(
    (quote as any).updated_at ??
      (quote as any).timestamp ??
      (quote as any).datetime ??
      (quote as any).date ??
      (quote as any).as_of ??
      (quote as any).last_timestamp ??
      (quote as any).last_trade_time
  )
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{renderValue(quote.symbol || quote.ticker || quote.name)}</span>
        <span className="text-sm font-semibold text-foreground">{renderValue(quote.last_price || quote.price || quote.close)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {provider ? <span>Provider: {provider}</span> : null}
        {asOf ? <span title={asOf}>As of: {formatRelativeTime(asOf)}</span> : null}
        {provider === "yfinance" ? <span className="text-muted-foreground/80">Delayed feed (typical)</span> : null}
        {provider === "intrinio" ? <span className="text-muted-foreground/80">May be sparse</span> : null}
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
  const rsiRow = lastResult((technicals as any).rsi)
  const maRow = lastResult((technicals as any).ma)
  const bbRow = lastResult((technicals as any).bb)
  const hasAny = (rsiRow && Object.keys(rsiRow).length) || (maRow && Object.keys(maRow).length) || (bbRow && Object.keys(bbRow).length)
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-sm">Technical signals</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
        {rsiRow && Object.keys(rsiRow).length ? <MetricCard label="RSI" value={rsiRow.value || rsiRow.rsi} /> : null}
        {maRow && Object.keys(maRow).length ? <MetricCard label="Moving avg" value={maRow.ma || maRow.value} /> : null}
        {bbRow && Object.keys(bbRow).length ? <MetricCard label="Upper band" value={bbRow.upper} /> : null}
        {!hasAny ? (
          <div className="md:col-span-3 rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
            Not enough history to compute technicals yet. Try a wider range (e.g. 6M) or another provider.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function OpenbbPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const apiUrl = useMemo(() => resolveOpenbbApiUrl(), [])
  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const queryBase = proxyBase ? `${proxyBase}/v1/openbb` : apiUrl

  const explorerTemplates = useMemo<ExplorerTemplate[]>(
    () => [
      {
        id: "quote",
        label: "Quote",
        description: "Latest quote (bid/ask/last/volume).",
        method: "GET",
        path: "/api/v1/equity/price/quote",
      },
      {
        id: "history_1d",
        label: "History (1d)",
        description: "Daily candles for a date range.",
        method: "GET",
        path: "/api/v1/equity/price/historical",
        params: { interval: "1d" },
      },
      {
        id: "profile",
        label: "Profile",
        description: "Company profile (sector/industry/description).",
        method: "GET",
        path: "/api/v1/equity/profile",
      },
      {
        id: "income",
        label: "Income statement",
        description: "Fundamentals: income statement.",
        method: "GET",
        path: "/api/v1/equity/fundamental/income",
      },
      {
        id: "balance",
        label: "Balance sheet",
        description: "Fundamentals: balance sheet.",
        method: "GET",
        path: "/api/v1/equity/fundamental/balance",
      },
      {
        id: "cash",
        label: "Cash flow",
        description: "Fundamentals: cash flow statement.",
        method: "GET",
        path: "/api/v1/equity/fundamental/cash",
      },
      {
        id: "news",
        label: "Company news",
        description: "Latest headlines for a symbol.",
        method: "GET",
        path: "/api/v1/news/company",
        params: { provider: DEFAULT_QUOTE_PROVIDER, symbol: "AAPL", limit: "10" },
      },
    ],
    []
  )

  const openbbFetch = async (
    path: string,
    params: Record<string, string | number | undefined>,
    timeoutMs = 30000
  ) => {
    if (!queryBase) {
      throw new Error(t("openbb.notConfigured"))
    }
    const url = buildUrl(queryBase, path, params)
    return fetchJsonWithMeta("OpenBB", url, undefined, timeoutMs)
  }

  const safeOpenbb = async (
    sym: string,
    path: string,
    params: Record<string, string | number | undefined>,
    timeoutMs = 30000
  ) => {
    try {
      const meta = await openbbFetch(path, params, timeoutMs)
      const data = meta.data
      const emptyResults =
        meta.ok &&
        data &&
        typeof data === "object" &&
        Array.isArray((data as any).results) &&
        (data as any).results.length === 0
      const noData = meta.ok && ((Array.isArray(data) && data.length === 0) || data === null || emptyResults)
      return {
        sym,
        status: meta.status,
        ok: meta.ok,
        data,
        warning: noData ? `[OpenBB] no data: ${sym} ${path} (try another provider)` : undefined,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        sym,
        status: err instanceof HttpRequestError ? err.status : 0,
        ok: false,
        data: null,
        error: message,
      }
    }
  }

  const checkHealth = async () => {
    if (!queryBase) {
      toast.error(t("openbb.notConfigured"))
      return
    }
    const url = `${queryBase}/openapi.json`
    try {
      const res = await fetchJsonWithMeta("OpenBB", url, undefined, 15000)
      toast.success(`[OpenBB] healthy (${res.status})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }

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
  const [watchlistSnapshot, setWatchlistSnapshot] = useState<Record<string, any>>({})
  const [watchlistSnapshotErrors, setWatchlistSnapshotErrors] = useState<Record<string, string>>({})
  const [watchlistSnapshotLoading, setWatchlistSnapshotLoading] = useState(false)
  const [watchlistSnapshotUpdatedAt, setWatchlistSnapshotUpdatedAt] = useState<string | null>(null)
  const [historyLog, setHistoryLog] = useState<{ symbols: string; range: string; provider: string; ts: number }[]>([])
  const [comparisonSymbols, setComparisonSymbols] = useState("AAPL, MSFT")
  const [comparisonChartMode, setComparisonChartMode] = useState<"price" | "pct">("pct")
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

  const [showRawJson, setShowRawJson] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("quick")

  useEffect(() => {
    try {
      const raw = localStorage.getItem("openbb_show_raw_json")
      if (raw === "1") setShowRawJson(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("openbb_show_raw_json", showRawJson ? "1" : "0")
    } catch {
      // ignore
    }
  }, [showRawJson])

  // Deep-link support:
  // - `/openbb?symbols=AAPL,MSFT` pre-fills symbol inputs across tabs.
  // - `/openbb?symbols=AAPL&provider=intrinio` also pre-selects the provider (if enabled).
  // - `/openbb?tab=technicals&symbols=AAPL` opens a specific tab.
  useEffect(() => {
    const rawSymbols =
      (searchParams.get("symbols") || searchParams.get("symbol") || searchParams.get("ticker") || "").trim()
    if (rawSymbols) {
      const parsed = rawSymbols
        .split(/[,\n\r\t ]+/g)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 50)
      if (parsed.length) {
        const joined = parsed.join(", ")
        setQuickSymbols(joined)
        setComparisonSymbols(joined)
        setFundSymbol(parsed[0])
        setTechSymbol(parsed[0])
      }
    }

    const provider = (searchParams.get("provider") || "").trim().toLowerCase()
    if (provider && AVAILABLE_QUOTE_PROVIDERS.includes(provider)) {
      setQuickProvider(provider)
      setCustomQuery((prev) => {
        try {
          const obj = JSON.parse(prev)
          if (obj && typeof obj === "object") {
            return JSON.stringify({ ...obj, provider }, null, 2)
          }
        } catch {
          // ignore
        }
        return prev
      })
    }

    const tabRaw = (searchParams.get("tab") || "").trim().toLowerCase()
    if (tabRaw) {
      const map: Record<string, string> = {
        quick: "quick",
        compare: "compare",
        watchlist: "watchlist",
        fundamentals: "fundamentals",
        fundamental: "fundamentals",
        technicals: "technicals",
        technical: "technicals",
        macro: "macro",
        crypto: "crypto",
        commodities: "commodities",
        commodity: "commodities",
        explorer: "explorer",
        custom: "custom",
      }
      const next = map[tabRaw]
      if (next) setActiveTab(next)
    }
  }, [searchParams])

  const [specOps, setSpecOps] = useState<ApiOperation[]>([])
  const [specTagDescriptions, setSpecTagDescriptions] = useState<Record<string, string>>({})
  const [specError, setSpecError] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [selectedOpId, setSelectedOpId] = useState<string>("")
  const [endpointSearch, setEndpointSearch] = useState<string>("")
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [explorerTemplateId, setExplorerTemplateId] = useState<string>("")
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
      const meta = await fetchJsonWithMeta("OpenBB", url, undefined, 30000)
      const data = meta.data
      const emptyResults =
        meta.ok &&
        data &&
        typeof data === "object" &&
        Array.isArray((data as any).results) &&
        (data as any).results.length === 0
      const noData = meta.ok && ((Array.isArray(data) && data.length === 0) || data === null || emptyResults)
      const errorMsg = (() => {
        if (noData) return `[OpenBB] no data: ${url} (try another provider)`
        return undefined
      })()
      if (errorMsg) toast.error(errorMsg)
      setter({
        url,
        status: meta.status,
        ok: meta.ok,
        data,
        error: errorMsg,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
      setter({
        url,
        status: error instanceof HttpRequestError ? error.status : 0,
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
        const url = `${queryBase}/openapi.json`
        const json = await fetchJsonOrThrow("OpenBB", url, undefined, 15000)
        const paths: Record<string, Record<string, any>> = json.paths || {}
        const tagDescriptions: Record<string, string> = {}
        if (Array.isArray(json.tags)) {
          json.tags.forEach((t: any) => {
            if (!t || typeof t !== "object") return
            const name = String(t.name || "").trim()
            if (!name) return
            const desc = typeof t.description === "string" ? t.description.trim() : ""
            if (desc) tagDescriptions[name] = desc
          })
        }
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
        setSpecTagDescriptions(tagDescriptions)
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

  const selectedTagDescription = useMemo(() => {
    if (!selectedTag) return ""
    return specTagDescriptions[selectedTag] || ""
  }, [specTagDescriptions, selectedTag])

  const filteredOps = useMemo(() => {
    const byTag = specOps.filter((op) => (selectedTag ? op.tag === selectedTag : true))
    const q = endpointSearch.trim().toLowerCase()
    if (!q) return byTag
    return byTag.filter((op) => {
      const hay = `${op.method} ${op.path} ${op.summary || ""} ${op.tag}`.toLowerCase()
      return hay.includes(q)
    })
  }, [specOps, selectedTag, endpointSearch])

  const selectedOp = useMemo(() => filteredOps.find((op) => op.id === selectedOpId) || filteredOps[0], [filteredOps, selectedOpId])

  // If the user filters endpoints, keep the selected endpoint valid.
  useEffect(() => {
    if (!filteredOps.length) return
    if (selectedOpId && filteredOps.some((op) => op.id === selectedOpId)) return
    setSelectedOpId(filteredOps[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredOps])

  const defaultExplorerSymbol = useMemo(() => {
    const first = quickSymbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .find(Boolean)
    return first || "AAPL"
  }, [quickSymbols])

  const availableExplorerTemplates = useMemo(() => {
    if (!specOps.length) return []
    const byKey = new Map(specOps.map((op) => [`${op.method} ${op.path}`, op]))
    return explorerTemplates
      .map((tpl) => ({ tpl, op: byKey.get(`${tpl.method} ${tpl.path}`) }))
      .filter((x) => Boolean(x.op))
      .map((x) => ({ ...x.tpl, op: x.op as ApiOperation }))
  }, [explorerTemplates, specOps])

  const defaultsForOp = useMemo(() => {
    return (op: ApiOperation | undefined) => {
      const next: Record<string, string> = {}
      if (!op) return next

      // OpenAPI defaults
      op.params.forEach((p) => {
        const def = p.schema?.default
        if (def === undefined || def === null) return
        next[p.name] = String(def)
      })

      // Sensible trading defaults
      if (op.params.some((p) => p.name === "symbol") && !next.symbol) next.symbol = defaultExplorerSymbol
      if (op.params.some((p) => p.name === "provider") && !next.provider) next.provider = quickProvider
      if (op.params.some((p) => p.name === "interval") && !next.interval) next.interval = "1d"
      return next
    }
  }, [defaultExplorerSymbol, quickProvider])

  const opDefaults = useMemo(() => {
    return selectedOp ? defaultsForOp(selectedOp) : {}
  }, [selectedOp, defaultsForOp])

  // When switching endpoints, prefill parameters with defaults so the user doesn't start from a blank form.
  useEffect(() => {
    if (!selectedOp) return
    if (Object.keys(paramValues).length) return
    const next = defaultsForOp(selectedOp)
    if (!Object.keys(next).length) return
    setParamValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOp?.id])

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
      const displayStartDate = computeDisplayStartDate(quickRange)
      const minLookbackStartDate = computeDisplayStartDate("6M")
      const fetchStartDate = minIsoDate(displayStartDate, minLookbackStartDate)

      const histPromises = symbols.map((sym) =>
        safeOpenbb(sym, "/api/v1/equity/price/historical", {
          symbol: sym,
          provider: quickProvider,
          interval: "1d",
          start_date: fetchStartDate,
        })
      )
      const quotePromises = symbols.map((sym) =>
        safeOpenbb(sym, "/api/v1/equity/price/quote", { symbol: sym, provider: quickProvider })
      )
      const newsPromises = symbols.map((sym) =>
        safeOpenbb(sym, "/api/v1/news/company", { symbol: sym, provider: quickProvider, limit: 10, sort: "created", order: "desc" })
      )
      const fundPromises = symbols.map(async (sym) => {
        const [profile, income, balance, cash, metrics] = await Promise.all([
          safeOpenbb(sym, "/api/v1/equity/profile", { symbol: sym, provider: quickProvider }).then((r) => r.data),
          safeOpenbb(sym, "/api/v1/equity/fundamental/income", { symbol: sym, provider: quickProvider }).then((r) => r.data),
          safeOpenbb(sym, "/api/v1/equity/fundamental/balance", { symbol: sym, provider: quickProvider }).then((r) => r.data),
          safeOpenbb(sym, "/api/v1/equity/fundamental/cash", { symbol: sym, provider: quickProvider }).then((r) => r.data),
          safeOpenbb(sym, "/api/v1/equity/fundamental/metrics", { symbol: sym, provider: quickProvider }).then((r) => r.data),
        ])
        return { profile, income, balance, cash, metrics }
      })

      const [quotes, history, news, fundArr] = await Promise.all([
        Promise.all(quotePromises),
        Promise.all(histPromises),
        Promise.all(newsPromises),
        Promise.all(fundPromises),
      ])
      const okQuotes = quotes.filter((q) => q.ok)
      const okHist = history.filter((h) => h.ok)
      const okNews = news.filter((n) => n.ok)
      setQuickQuotes(okQuotes)
      setQuickHistory(okHist)
      setQuickNews(okNews)
      setQuickFund(fundArr[0]?.profile || null)
      const fundMap: Record<string, any> = {}
      fundArr.forEach((f, idx) => {
        const sym = symbols[idx]
        if (sym) fundMap[sym] = f
      })
      const techMap: Record<string, any> = {}
      okHist.forEach((h) => {
        const candles = toCandles(h.data)
        techMap[h.sym] = computeTechnicalsFromCandles(candles)
      })
      setQuickFundMap(fundMap)
      setQuickTechMap(techMap)
      setQuickTech(techMap[symbols[0]] || null)
      setHistoryLog((prev) => [{ symbols: quickSymbols, range: quickRange, provider: quickProvider, ts: Date.now() }, ...prev].slice(0, 20))
      quotes.filter((q: any) => !q.ok).forEach((q: any) => toast.error(q.error || `${q.sym}: ${q.status}`))
      history.filter((h: any) => !h.ok).forEach((h: any) => toast.error(h.error || `${h.sym}: ${h.status}`))
      quotes.filter((q: any) => q.warning).forEach((q: any) => toast.error(q.warning))
      history.filter((h: any) => h.warning).forEach((h: any) => toast.error(h.warning))
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
      const displayStartDate = computeDisplayStartDate(quickRange)
      const minLookbackStartDate = computeDisplayStartDate("6M")
      const fetchStartDate = minIsoDate(displayStartDate, minLookbackStartDate)

      const res = await Promise.all(
        symbols.map((sym) =>
          safeOpenbb(sym, "/api/v1/equity/price/quote", { symbol: sym, provider: quickProvider })
        )
      )
      const ok = res.filter((r) => r.ok)
      setComparisonData(ok)
      res.filter((r) => !r.ok).forEach((r) => toast.error(r.error || `${r.sym}: ${r.status}`))
      res.filter((r) => r.warning).forEach((r) => toast.error(r.warning))

      const valuationRes = await Promise.all(
        symbols.map((sym) =>
          safeOpenbb(sym, "/api/v1/equity/fundamental/metrics", { symbol: sym, provider: quickProvider })
        )
      )
      setComparisonValuation(valuationRes.filter((r) => r.ok))
      const histRes = await Promise.all(
        symbols.map((sym) =>
          safeOpenbb(sym, "/api/v1/equity/price/historical", {
            symbol: sym,
            provider: quickProvider,
            interval: "1d",
            start_date: fetchStartDate,
          })
        )
      )
      const okHist = histRes.filter((r) => r.ok)
      setComparisonHistory(okHist)
      setComparisonTech(
        okHist.map((h) => ({
          sym: h.sym,
          ...computeTechnicalsFromCandles(toCandles(h.data)),
        }))
      )
      const fundRes = await Promise.all(
        symbols.map(async (sym) => {
          const [income, balance, cash] = await Promise.all([
            safeOpenbb(sym, "/api/v1/equity/fundamental/income", { symbol: sym, provider: quickProvider }).then((r) => r.data),
            safeOpenbb(sym, "/api/v1/equity/fundamental/balance", { symbol: sym, provider: quickProvider }).then((r) => r.data),
            safeOpenbb(sym, "/api/v1/equity/fundamental/cash", { symbol: sym, provider: quickProvider }).then((r) => r.data),
          ])
          return { sym, income, balance, cash }
        })
      )
      const fundMap: Record<string, any> = {}
      fundRes.forEach((f) => {
        fundMap[f.sym] = f
      })
      setComparisonFund(fundMap)
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
      const [profileRes, incomeRes, balanceRes, cashRes, metricsRes] = await Promise.all([
        fundSelections.profile
          ? safeOpenbb(fundSymbol, "/api/v1/equity/profile", { symbol: fundSymbol, provider: quickProvider })
          : Promise.resolve(null),
        fundSelections.income
          ? safeOpenbb(fundSymbol, "/api/v1/equity/fundamental/income", { symbol: fundSymbol, provider: quickProvider })
          : Promise.resolve(null),
        fundSelections.balance
          ? safeOpenbb(fundSymbol, "/api/v1/equity/fundamental/balance", { symbol: fundSymbol, provider: quickProvider })
          : Promise.resolve(null),
        fundSelections.cash
          ? safeOpenbb(fundSymbol, "/api/v1/equity/fundamental/cash", { symbol: fundSymbol, provider: quickProvider })
          : Promise.resolve(null),
        fundSelections.valuation
          ? safeOpenbb(fundSymbol, "/api/v1/equity/fundamental/metrics", { symbol: fundSymbol, provider: quickProvider })
          : Promise.resolve(null),
      ])

      ;[profileRes, incomeRes, balanceRes, cashRes, metricsRes]
        .filter(Boolean)
        .forEach((r: any) => {
          if (!r.ok) toast.error(r.error || `${r.sym}: ${r.status}`)
          if (r.warning) toast.error(r.warning)
        })

      setFundamentals({
        profile: (profileRes as any)?.data ?? null,
        income: (incomeRes as any)?.data ?? null,
        balance: (balanceRes as any)?.data ?? null,
        cash: (cashRes as any)?.data ?? null,
        metrics: (metricsRes as any)?.data ?? null,
      })
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
      const minLookbackStartDate = computeDisplayStartDate("6M")
      const histRes = await safeOpenbb(techSymbol, "/api/v1/equity/price/historical", {
        symbol: techSymbol,
        provider: quickProvider,
        interval: "1d",
        start_date: minLookbackStartDate,
      })
      if (!histRes.ok) {
        toast.error(histRes.error || `${histRes.sym}: ${histRes.status}`)
        setTechnicals(null)
        return
      }

      const computed = computeTechnicalsFromCandles(toCandles(histRes.data))
      const rsiOut = techSelections.rsi ? computed.rsi : null
      const maOut = techSelections.ma ? computed.ma : null
      const bbOut = techSelections.bb ? computed.bb : null

      if (techSelections.rsi && !(rsiOut as any)?.results?.length) toast.error(`[OpenBB] RSI needs more candles`)
      if (techSelections.ma && !(maOut as any)?.results?.length) toast.error(`[OpenBB] MA needs more candles`)
      if (techSelections.bb && !(bbOut as any)?.results?.length) toast.error(`[OpenBB] BB needs more candles`)

      setTechnicals({
        computed: true,
        rsi: rsiOut,
        ma: maOut,
        bb: bbOut,
      })
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
          const res = await safeOpenbb(key, "/api/v1/economy/macro", { indicator, provider: "fred" })
          if (!res.ok) toast.error(res.error || `${res.sym}: ${res.status}`)
          if (res.warning) toast.error(res.warning)
          return [key, res.data] as const
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
      const res = await safeOpenbb(symbol, "/api/v1/crypto/price/historical", {
        symbol,
        interval: cryptoInterval,
        provider: quickProvider,
      })
      if (!res.ok) toast.error(res.error || `${res.sym}: ${res.status}`)
      if (res.warning) toast.error(res.warning)
      setCryptoData(res.data as any)
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
      const res = await safeOpenbb(commoditySelection, "/api/v1/commodity/price/spot", {
        commodity: commoditySelection,
        provider: "fred",
      })
      if (!res.ok) toast.error(res.error || `${res.sym}: ${res.status}`)
      if (res.warning) toast.error(res.warning)
      setCommodityData(res.data as any)
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

  const refreshWatchlistSnapshot = async () => {
    if (!queryBase) return
    if (!watchlist.length) {
      toast.message("Watchlist is empty.")
      return
    }

    setWatchlistSnapshotLoading(true)
    setWatchlistSnapshotErrors({})
    try {
      const symbols = watchlist.slice(0, 50)
      const nextQuotes: Record<string, any> = {}
      const nextErrors: Record<string, string> = {}

      let cursor = 0
      const worker = async () => {
        for (;;) {
          const idx = cursor
          cursor += 1
          const sym = symbols[idx]
          if (!sym) return
          const res = await safeOpenbb(sym, "/api/v1/equity/price/quote", { symbol: sym, provider: quickProvider }, 20000)
          if (res.ok) nextQuotes[sym] = firstResult(res.data)
          else nextErrors[sym] = res.error || `HTTP ${res.status}`
        }
      }

      const workers = Array.from({ length: Math.min(6, symbols.length) }, () => worker())
      await Promise.all(workers)

      setWatchlistSnapshot(nextQuotes)
      setWatchlistSnapshotErrors(nextErrors)
      setWatchlistSnapshotUpdatedAt(new Date().toISOString())
      if (Object.keys(nextErrors).length) {
        toast.message(`[OpenBB] Snapshot: ${Object.keys(nextErrors).length} fetch(es) failed.`)
      } else {
        toast.success("[OpenBB] Watchlist snapshot refreshed")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Watchlist snapshot failed")
    } finally {
      setWatchlistSnapshotLoading(false)
    }
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
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
              >
                <Info className="mr-2 h-4 w-4" />
                Health
              </Button>
              <label className="ml-auto flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={showRawJson} onChange={(e) => setShowRawJson(e.target.checked)} />
                Show raw JSON (debug)
              </label>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                          return <QuoteCard key={q.sym} quote={{ ...payload, symbol: q.sym }} provider={quickProvider} />
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
                        const profileRow = firstResult((data as any).profile)
                        const metricsRow = firstResult((data as any).metrics)
                        return (
                          <div key={sym} className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                            <div className="text-sm font-semibold text-foreground">{sym}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <MetricCard label="Market cap" value={(metricsRow as any).market_cap ?? (profileRow as any).market_cap} />
                              <MetricCard label="Sector" value={(profileRow as any).sector} />
                              <MetricCard label="P/E" value={(metricsRow as any).pe_ratio} />
                              <MetricCard label="P/B" value={(metricsRow as any).pb_ratio} />
                              <MetricCard label="Dividend" value={(metricsRow as any).dividend_yield ?? (profileRow as any).dividend_yield} />
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
                        const rsiRow = lastResult((data as any).rsi)
                        const maRow = lastResult((data as any).ma)
                        const bbRow = lastResult((data as any).bb)
                        const candleCount = Number((data as any)?.meta?.candleCount || 0)
                        const needsMore =
                          candleCount > 0 &&
                          (!((data as any).rsi?.results || []).length || !((data as any).ma?.results || []).length || !((data as any).bb?.results || []).length)
                        return (
                          <div key={sym} className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-foreground">{sym}</div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const rows = mergeTechnicalsRows(data)
                                  if (!rows.length) {
                                    toast.error("No technical rows to export.")
                                    return
                                  }
                                  downloadCsv(`${sym}-technicals`, rows)
                                }}
                              >
                                Export CSV
                              </Button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <MetricCard label="RSI" value={(rsiRow as any).value || (rsiRow as any).rsi} />
                              <MetricCard label="MA" value={(maRow as any).ma || (maRow as any).value} />
                              <MetricCard label="BB Upper" value={(bbRow as any).upper} />
                              <MetricCard label="BB Lower" value={(bbRow as any).lower} />
                            </div>
                            {needsMore ? (
                              <div className="rounded border border-border/40 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                                Technicals are computed from history. We have {candleCount} daily candles; if any indicator is blank, try a wider range or another provider.
                              </div>
                            ) : null}
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-foreground">{h.sym}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const rows = normalizeRows(h.data)
                            if (!rows.length) {
                              toast.error("No candles to export.")
                              return
                            }
                            downloadCsv(`${h.sym}-candles`, rows)
                          }}
                        >
                          Export CSV
                        </Button>
                      </div>
                      {(() => {
                        const allCandles = toCandles(h.data)
                        const displayStartDate = computeDisplayStartDate(quickRange)
                        const filtered = filterCandlesSince(allCandles, displayStartDate)
                        const candles = filtered.length ? filtered : allCandles
                        if (candles.length) {
                          return <CandlesChart candles={candles} height={260} />
                        }
                        return (
                          renderLineChart(h.data, "date", ["close", "adj_close", "last_price", "price"]) ||
                          renderTable(h.data)
                        )
                      })()}
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
                  <CardContent>
                    {(() => {
                        const allCandles = toCandles(quickHistory[0]?.data)
                        const displayStartDate = computeDisplayStartDate(quickRange)
                        const filtered = filterCandlesSince(allCandles, displayStartDate)
                        const candles = filtered.length ? filtered : allCandles
                        if (candles.length) return <CandlesChart candles={candles} height={280} />
                        return renderLineChart(quickHistory[0]?.data, "date", ["close", "adj_close", "last_price", "price"])
                      })()}
                    </CardContent>
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
                  <Button size="sm" variant="outline" onClick={refreshWatchlistSnapshot} disabled={watchlistSnapshotLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {watchlistSnapshotLoading ? "Refreshing…" : "Refresh snapshot"}
                  </Button>
                  {watchlistSnapshotUpdatedAt ? (
                    <span className="inline-flex items-center rounded-md border border-border/50 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                      Updated {new Date(watchlistSnapshotUpdatedAt).toLocaleTimeString()}
                    </span>
                  ) : null}
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
                          setActiveTab("quick")
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
                      const selected = normalizeWatchlistAlertKeys(watchlistAlerts[s] || [])
                      const toggle = (key: string) => {
                        const next = new Set(selected)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        setWatchlistAlerts((prev) => ({ ...prev, [s]: Array.from(next) }))
                      }
                      return (
                        <div key={`${s}-alerts`} className="flex flex-wrap items-center gap-2">
                          <span className="text-foreground">{s}</span>
                          {[
                            { key: "news", label: "news" },
                            { key: "filings", label: "filings" },
                            { key: "rating", label: "rating" },
                            { key: "rsi", label: "rsi" },
                          ].map((item) => (
                            <label key={item.key} className="flex items-center gap-1 rounded border border-border/50 px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selected.has(item.key)}
                                onChange={() => toggle(item.key)}
                              />
                              <span className="capitalize">{item.label}</span>
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

          <Card className="border-border/70">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-sm">Snapshot</CardTitle>
              <div className="text-[11px] text-muted-foreground">
                {watchlistSnapshotUpdatedAt ? `Updated ${formatRelativeTime(watchlistSnapshotUpdatedAt)}` : "Not loaded yet"}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {!watchlist.length ? (
                <div>No symbols saved yet.</div>
              ) : Object.keys(watchlistSnapshot).length === 0 && Object.keys(watchlistSnapshotErrors).length === 0 ? (
                <div className="rounded-md border border-border/50 bg-muted/20 p-3">
                  Click <span className="font-semibold text-foreground">Refresh snapshot</span> to pull the latest quotes for your watchlist.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border/60 bg-background">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Symbol</th>
                        <th className="px-3 py-2 font-medium">Last</th>
                        <th className="px-3 py-2 font-medium">Change</th>
                        <th className="px-3 py-2 font-medium">Volume</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watchlist.map((sym) => {
                        const q = watchlistSnapshot[sym]
                        const last = q?.last_price ?? q?.price ?? q?.close
                        const change = q?.change_percent ?? q?.change
                        const volume = q?.volume
                        const err = watchlistSnapshotErrors[sym]
                        return (
                          <tr key={sym} className="border-t border-border/60">
                            <td className="px-3 py-2 text-foreground font-medium">{sym}</td>
                            <td className="px-3 py-2 text-foreground">{renderValue(last)}</td>
                            <td className="px-3 py-2 text-foreground">{renderValue(change)}</td>
                            <td className="px-3 py-2 text-foreground">{renderValue(volume)}</td>
                            <td className="px-3 py-2">
                              {err ? (
                                <span className="text-destructive" title={err}>
                                  error
                                </span>
                              ) : q ? (
                                <span className="text-muted-foreground">ok</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setActiveTab("quick")
                                    setQuickSymbols(sym)
                                    setTimeout(() => runQuickLookup(), 50)
                                  }}
                                >
                                  Quick
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setFundSymbol(sym)
                                    setActiveTab("fundamentals")
                                  }}
                                >
                                  Fundamentals
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTechSymbol(sym)
                                    setActiveTab("technicals")
                                  }}
                                >
                                  Technicals
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
              {availableExplorerTemplates.length ? (
                <div className="space-y-2">
                  <Label>Template</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={explorerTemplateId}
                    onChange={(e) => {
                      const nextId = e.target.value
                      setExplorerTemplateId(nextId)
                      if (!nextId) return
                      const tpl = availableExplorerTemplates.find((x) => x.id === nextId)
                      if (!tpl) return
                      setSelectedTag(tpl.op.tag)
                      setSelectedOpId(tpl.op.id)
                      const overrides = Object.fromEntries(
                        Object.entries(tpl.params || {}).filter(([, v]) => typeof v === "string" && v.length)
                      ) as Record<string, string>
                      const merged: Record<string, string> = { ...defaultsForOp(tpl.op), ...overrides }
                      setParamValues(merged)
                      setExplorerResult(undefined)
                    }}
                  >
                    <option value="">(custom)</option>
                    {availableExplorerTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.label} · {tpl.description}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-muted-foreground">
                    Templates prefill parameters so you can run common trader queries quickly.
                  </div>
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
                      setExplorerTemplateId("")
                      setExplorerResult(undefined)
                    }}
                  >
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  {selectedTagDescription ? (
                    <div className="text-[11px] text-muted-foreground">{selectedTagDescription}</div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      {filteredOps.length} endpoint{filteredOps.length === 1 ? "" : "s"} in this tag
                    </div>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpointSearch}
                    onChange={(e) => setEndpointSearch(e.target.value)}
                    placeholder="Filter endpoints (e.g. rsi, income, /api/v1/equity)..."
                    className="mb-2"
                  />
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedOpId}
                    onChange={(e) => {
                      setSelectedOpId(e.target.value)
                      setParamValues({})
                      setExplorerTemplateId("")
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
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">{selectedOp.tag}</span>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">
                      {selectedOp.params.length} param{selectedOp.params.length === 1 ? "" : "s"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setParamValues(opDefaults)
                        setExplorerResult(undefined)
                        setExplorerTemplateId("")
                      }}
                      disabled={!Object.keys(opDefaults).length}
                    >
                      Reset params
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setParamValues({})
                        setExplorerResult(undefined)
                        setExplorerTemplateId("")
                      }}
                      disabled={!selectedOp.params.length}
                    >
                      Clear
                    </Button>
                  </div>
                  {selectedOp.params.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedOp.params.map((p) => {
                        const enumValues = p.schema?.enum
                        const type = p.schema?.type || ""
                        const format = p.schema?.format || ""
                        const val = paramValues[p.name] || ""
                        const def = opDefaults[p.name]
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
                              {def ? <div className="text-[11px] text-muted-foreground">Default: {def}</div> : null}
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
                              {def ? <div className="text-[11px] text-muted-foreground">Default: {def}</div> : null}
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
                            {def ? <div className="text-[11px] text-muted-foreground">Default: {def}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No parameters</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={runExplorer} disabled={explorerLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {explorerLoading ? "Loading" : "Run"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadJson("openbb-explorer", explorerResult?.data)}
                      disabled={!explorerResult?.data}
                    >
                      Export JSON
                    </Button>
                  </div>
                  <ResponseCard title="Explorer result" result={explorerResult} showRawJson={showRawJson} />
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
                      <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <CardTitle className="text-sm">Comparison chart</CardTitle>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={comparisonChartMode}
                          onChange={(e) => setComparisonChartMode(e.target.value as any)}
                        >
                          <option value="pct">% from start</option>
                          <option value="price">Price</option>
                        </select>
                      </CardHeader>
                      <CardContent>
                        {renderComparisonChart(comparisonHistory, comparisonChartMode) || <div>No chart data</div>}
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
                      const techRow = lastResult(tech?.rsi)
                      return (
                        <div key={c.sym} className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                          <div className="text-sm font-semibold text-foreground">{c.sym}</div>
                          <QuoteCard quote={{ ...row, symbol: c.sym }} provider={quickProvider} />
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
                  {fundamentals.metrics ? (
                    <ValuationTable
                      rows={[
                        {
                          symbol: fundSymbol,
                          ...(firstResult(fundamentals.metrics) as any),
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
              <Button
                size="sm"
                variant="outline"
                disabled={!technicals}
                onClick={() => {
                  const rows = mergeTechnicalsRows(technicals)
                  if (!rows.length) {
                    toast.error("No technical rows to export.")
                    return
                  }
                  downloadCsv(`technicals-${techSymbol}`, rows)
                }}
              >
                Export CSV
              </Button>
	              {technicals ? (
	                <div className="grid gap-4 lg:grid-cols-2 text-xs text-muted-foreground">
	                  <div className="lg:col-span-2 space-y-3">
	                    <TechnicalOverviewCard technicals={technicals} />
	                    <div className="grid gap-2 md:grid-cols-3">
	                    <MetricCard label="RSI" value={(lastResult(technicals.rsi) as any)?.value || (lastResult(technicals.rsi) as any)?.rsi} />
	                    <MetricCard label="MA" value={(lastResult(technicals.ma) as any)?.ma || (lastResult(technicals.ma) as any)?.value} />
	                    <MetricCard label="BB Upper" value={(lastResult(technicals.bb) as any)?.upper} />
	                    </div>
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
            <ResponseCard title={t("openbb.customResult")} result={customResult} showRawJson={showRawJson} />
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
  const first = rows[0] || {}
  const keys = new Set(Object.keys(first))
  const lower = title.toLowerCase()
  const kind = lower.includes("income") ? "income" : lower.includes("balance") ? "balance" : lower.includes("cash") ? "cash" : "other"

  const preferredByKind: Record<string, string[]> = {
    income: [
      "period_ending",
      "total_revenue",
      "gross_profit",
      "operating_income",
      "ebitda",
      "net_income",
      "basic_earnings_per_share",
      "diluted_earnings_per_share",
    ],
    balance: [
      "period_ending",
      "cash_and_cash_equivalents",
      "cash_cash_equivalents_and_short_term_investments",
      "total_assets",
      "total_liabilities_net_minority_interest",
      "common_stock_equity",
      "long_term_debt",
      "net_debt",
      "current_liabilities",
    ],
    cash: [
      "period_ending",
      "operating_cash_flow",
      "cash_flow_from_continuing_operating_activities",
      "capital_expenditure",
      "free_cash_flow",
      "investing_cash_flow",
      "financing_cash_flow",
      "net_change_in_cash_and_equivalents",
      "end_cash_position",
    ],
    other: ["period_ending", "date"],
  }

  const preferred = preferredByKind[kind] || preferredByKind.other
  const cols = preferred.filter((k) => keys.has(k)).concat(Object.keys(first).filter((k) => !preferred.includes(k))).slice(0, 8)
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
