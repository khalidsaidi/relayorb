import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ExternalLink, RefreshCw } from "lucide-react"
import { resolveFinnewsUrl, resolveOpenbbApiUrl, resolveStockpulseUrl } from "@/lib/runtime-urls"
import { fetchJsonWithMeta } from "@/lib/http"
import { toast } from "sonner"

type QuoteResult = {
  symbol?: string
  name?: string
  exchange?: string
  last_price?: number
  open?: number
  high?: number
  low?: number
  prev_close?: number
  volume?: number
  bid?: number
  ask?: number
  market_cap?: number
  pe_ratio?: number
  pb_ratio?: number
  dividend_yield?: number
  ma_50d?: number
  ma_200d?: number
}

type StockpulseRating = {
  ticker: string
  rating?: string
  score?: number
  confidence?: number
  current_price?: number | null
  currency_symbol?: string | null
  rsi?: number | null
  analysis_summary?: string | null
  message?: string | null
}

type FinnewsItem = {
  id: string | number
  title: string
  url?: string | null
  source?: string
  publish_time?: string | null
  created_at?: string | null
  content?: string | null
  stock_codes?: string[]
}

function parseSymbols(raw: string) {
  return raw
    .split(/[,\n\r\t ]+/g)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50)
}

function pickFirstResult(data: any): QuoteResult {
  if (!data) return {}
  if (Array.isArray(data?.results) && data.results.length) return data.results[0] as QuoteResult
  if (Array.isArray(data) && data.length) return data[0] as QuoteResult
  if (typeof data === "object") return data as QuoteResult
  return {}
}

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

function extractTickers(text: string) {
  const hay = String(text || "")
  const out = new Set<string>()
  const patterns: RegExp[] = [
    /\$([A-Z]{1,6}(?:\.[A-Z]{1,2})?)/g,
    /\(([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\)/g,
    /\b(?:NASDAQ|NYSE|AMEX)\s*[:]\s*([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\b/g,
  ]
  for (const re of patterns) {
    for (;;) {
      const m = re.exec(hay)
      if (!m) break
      const sym = (m[1] || "").trim().toUpperCase()
      if (!sym) continue
      out.add(sym)
    }
  }
  return Array.from(out)
}

function deriveFinnewsSymbols(item: FinnewsItem) {
  if (Array.isArray(item.stock_codes) && item.stock_codes.length) {
    return item.stock_codes.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
  }
  return extractTickers([item.title, item.content].filter(Boolean).join(" "))
}

export default function TraderDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const openbbUrl = useMemo(() => resolveOpenbbApiUrl(), [])
  const finnewsUrl = useMemo(() => resolveFinnewsUrl(), [])
  const stockpulseUrl = useMemo(() => resolveStockpulseUrl(), [])

  const [symbolsRaw, setSymbolsRaw] = useState("AAPL MSFT NVDA TSLA AMZN META GOOGL")
  const [provider, setProvider] = useState<"yfinance" | "intrinio">("yfinance")
  const [loading, setLoading] = useState(false)

  const [quotesBySymbol, setQuotesBySymbol] = useState<Record<string, QuoteResult>>({})
  const [ratingsBySymbol, setRatingsBySymbol] = useState<Record<string, StockpulseRating>>({})
  const [finnewsLatest, setFinnewsLatest] = useState<FinnewsItem[]>([])

  const symbols = useMemo(() => parseSymbols(symbolsRaw), [symbolsRaw])

  const run = useCallback(async () => {
    if (!openbbUrl || !finnewsUrl || !stockpulseUrl) {
      toast.error("Configure VITE_OPENBB_API_URL, VITE_FINNEWS_URL and VITE_STOCKPULSE_URL first.")
      return
    }
    if (!symbols.length) {
      toast.error("Enter at least one symbol.")
      return
    }

    setLoading(true)
    try {
      // 1) OpenBB quotes (fast and trader-essential)
      const quoteReqs = symbols.map((sym) => {
        const url = `${openbbUrl}/api/v1/equity/price/quote?symbol=${encodeURIComponent(sym)}&provider=${encodeURIComponent(provider)}`
        return fetchJsonWithMeta("OpenBB", url, undefined, 25000).then((r) => ({ sym, ...r }))
      })

      // 2) StockPulse ratings (on-demand per ticker)
      const ratingReqs = symbols.map((sym) => {
        const url = `${stockpulseUrl}/api/ai/rating/${encodeURIComponent(sym)}`
        return fetchJsonWithMeta("StockPulse", url, undefined, 30000).then((r) => ({ sym, ...r }))
      })

      // 3) Finnews: fetch latest once and filter client-side for the requested set
      const finnewsUrlLatest = `${finnewsUrl}/api/v1/news/latest?limit=200`

      const [quotesRes, ratingsRes, finnewsRes] = await Promise.all([
        Promise.allSettled(quoteReqs),
        Promise.allSettled(ratingReqs),
        fetchJsonWithMeta("Finnews", finnewsUrlLatest, undefined, 30000),
      ])

      const nextQuotes: Record<string, QuoteResult> = {}
      quotesRes.forEach((res) => {
        if (res.status !== "fulfilled") return
        if (!res.value.ok) return
        nextQuotes[res.value.sym] = pickFirstResult(res.value.data)
      })
      setQuotesBySymbol(nextQuotes)

      const nextRatings: Record<string, StockpulseRating> = {}
      ratingsRes.forEach((res) => {
        if (res.status !== "fulfilled") return
        if (!res.value.ok) return
        nextRatings[res.value.sym] = res.value.data as StockpulseRating
      })
      setRatingsBySymbol(nextRatings)

      const items = Array.isArray(finnewsRes.data) ? (finnewsRes.data as FinnewsItem[]) : []
      setFinnewsLatest(items)

      const quoteRejected = quotesRes.filter((r) => r.status === "rejected")
      if (quoteRejected.length) toast.message(`OpenBB: ${quoteRejected.length} quote(s) failed (see console).`)

      const ratingRejected = ratingsRes.filter((r) => r.status === "rejected")
      if (ratingRejected.length) toast.message(`StockPulse: ${ratingRejected.length} rating(s) failed (see console).`)

      quotesRes.forEach((r) => {
        if (r.status !== "rejected") return
        console.warn("OpenBB quote failed", r.reason)
      })
      ratingsRes.forEach((r) => {
        if (r.status !== "rejected") return
        console.warn("StockPulse rating failed", r.reason)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [finnewsUrl, openbbUrl, provider, stockpulseUrl, symbols])

  const newsBySymbol = useMemo(() => {
    const out: Record<string, FinnewsItem[]> = {}
    if (!finnewsLatest.length || !symbols.length) return out
    const wanted = new Set(symbols)
    finnewsLatest.forEach((item) => {
      const symbolsInItem = deriveFinnewsSymbols(item)
      symbolsInItem.forEach((sym) => {
        if (!wanted.has(sym)) return
        out[sym] = out[sym] || []
        out[sym].push(item)
      })
    })
    Object.keys(out).forEach((k) => {
      out[k] = out[k].slice(0, 5)
    })
    return out
  }, [finnewsLatest, symbols])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold text-foreground">{t("trader.title")}</div>
        <div className="text-sm text-muted-foreground">{t("trader.subtitle")}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <Label>Symbols</Label>
              <Input
                value={symbolsRaw}
                onChange={(e) => setSymbolsRaw(e.target.value)}
                placeholder="AAPL MSFT NVDA"
              />
              <div className="text-[11px] text-muted-foreground">
                Tip: spaces, commas, and new lines all work. Max 50 symbols.
              </div>
            </div>
            <div className="space-y-1">
              <Label>OpenBB provider</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
              >
                <option value="yfinance">yfinance</option>
                <option value="intrinio">intrinio</option>
              </select>
              <div className="text-[11px] text-muted-foreground">
                yfinance is usually best for breadth; intrinio can be sparse depending on account.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {loading ? "Running…" : "Run lookup"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const qs = new URLSearchParams({ symbols: symbols.join(",") }).toString()
                navigate(`/openbb?${qs}`)
              }}
              disabled={!symbols.length}
            >
              Open OpenBB
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const q = symbols[0] || ""
                const qs = q ? new URLSearchParams({ q }).toString() : ""
                navigate(`/finnews${qs ? `?${qs}` : ""}`)
              }}
              disabled={!symbols.length}
            >
              Open Finnews
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const ticker = symbols[0] || ""
                const qs = ticker ? new URLSearchParams({ ticker }).toString() : ""
                navigate(`/stockpulse${qs ? `?${qs}` : ""}`)
              }}
              disabled={!symbols.length}
            >
              Open StockPulse
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {symbols.map((sym) => {
          const quote = quotesBySymbol[sym]
          const rating = ratingsBySymbol[sym]
          const items = newsBySymbol[sym] || []
          return (
            <Card key={sym} className="border-border/70">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="truncate">{sym}</span>
                    {rating?.rating ? (
                      <Badge variant="secondary">{rating.rating}</Badge>
                    ) : null}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {quote?.name ? quote.name : "—"} {quote?.exchange ? `· ${quote.exchange}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold text-foreground">
                    {typeof quote?.last_price === "number" ? quote.last_price.toFixed(2) : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Vol {typeof quote?.volume === "number" ? quote.volume.toLocaleString() : "—"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide">OpenBB</div>
                    <div className="mt-1 text-foreground">
                      Bid/Ask:{" "}
                      {typeof quote?.bid === "number" ? quote.bid.toFixed(2) : "—"} /{" "}
                      {typeof quote?.ask === "number" ? quote.ask.toFixed(2) : "—"}
                    </div>
                    <div className="mt-1 text-foreground">
                      High/Low:{" "}
                      {typeof quote?.high === "number" ? quote.high.toFixed(2) : "—"} /{" "}
                      {typeof quote?.low === "number" ? quote.low.toFixed(2) : "—"}
                    </div>
                    <div className="mt-1 text-foreground">
                      MA50/MA200:{" "}
                      {typeof quote?.ma_50d === "number" ? quote.ma_50d.toFixed(2) : "—"} /{" "}
                      {typeof quote?.ma_200d === "number" ? quote.ma_200d.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide">StockPulse</div>
                    <div className="mt-1 text-foreground">
                      Score: {typeof rating?.score === "number" ? rating.score.toFixed(1) : "—"}{" "}
                      (conf {typeof rating?.confidence === "number" ? rating.confidence.toFixed(1) : "—"})
                    </div>
                    <div className="mt-1 text-foreground">
                      RSI: {typeof rating?.rsi === "number" ? rating.rsi.toFixed(2) : "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                      {rating?.analysis_summary || rating?.message || "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide">Quick actions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/openbb?${new URLSearchParams({ symbols: sym }).toString()}`)}
                      >
                        Open OpenBB
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/stockpulse?${new URLSearchParams({ ticker: sym }).toString()}`)}
                      >
                        Open StockPulse
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/finnews?${new URLSearchParams({ q: sym }).toString()}`)}
                      >
                        Search Finnews
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest filings/news</div>
                  {items.length ? (
                    <div className="mt-2 space-y-2">
                      {items.slice(0, 4).map((n) => (
                        <div key={String(n.id)} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-foreground text-xs font-medium truncate">{n.title}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {n.source || "Finnews"} · {formatRelative(n.publish_time || n.created_at)}
                            </div>
                          </div>
                          {n.url ? (
                            <button
                              type="button"
                              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(n.url || "", "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">
                      No matched items in the latest saved feed yet. Try running a Finnews crawl or using Search.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
