import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { MarketActionBoardDoc, MarketHotTrade, MarketHotTradesDoc } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTimestamp } from "@/lib/format"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/auth-context"

function scoreTone(score?: number) {
  if (score === undefined || score === null) return "bg-muted text-muted-foreground"
  if (score >= 75) return "bg-emerald-500/15 text-emerald-800"
  if (score >= 60) return "bg-sky-500/15 text-sky-700"
  if (score >= 45) return "bg-amber-500/15 text-amber-700"
  return "bg-slate-500/10 text-slate-600"
}

function formatChange(value?: number) {
  if (value === undefined || value === null) return "—"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

type AiAdvice = {
  action: "buy" | "sell" | "hold"
  holdMinutes: number
  stopLossPct?: number | null
  takeProfitPct?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  summary?: string
  reasoning?: string
}

function buildAdviceKey(item: MarketHotTrade) {
  return `${item.assetClass}:${item.symbol}:${item.side ?? "hold"}`
}

function formatPrice(value: number, assetClass: MarketHotTrade["assetClass"]) {
  if (!Number.isFinite(value)) return "—"
  const decimals = assetClass === "forex" ? 5 : assetClass === "crypto" ? 4 : 2
  return value.toFixed(decimals)
}

function computePriceLevels(
  action: AiAdvice["action"],
  price: number | undefined,
  stopLossPct?: number | null,
  takeProfitPct?: number | null
) {
  if (!price || !Number.isFinite(price) || action === "hold") {
    return { stopLossPrice: null, takeProfitPrice: null }
  }
  const stopPct = stopLossPct ?? 2
  const takePct = takeProfitPct ?? 4
  const stop =
    action === "sell"
      ? price * (1 + stopPct / 100)
      : price * (1 - stopPct / 100)
  const target =
    action === "sell"
      ? price * (1 - takePct / 100)
      : price * (1 + takePct / 100)
  return { stopLossPrice: stop, takeProfitPrice: target }
}

function buildAiPrompt(item: MarketHotTrade) {
  const momentum = item.momentum || {}
  const signals = item.signals || {}
  const trend = item.trend || {}
  const news = item.news || {}

  return [
    "You are my trading assistant. Use the data below to answer:",
    "Give a simple action (buy/hold/sell), suggested hold time (minutes), stop-loss price, and take-profit price.",
    "",
    `Symbol: ${item.symbol}`,
    `Asset class: ${item.assetClass}`,
    `Current price: ${item.price ?? "n/a"}`,
    `Score: ${item.score ?? "n/a"} / 100`,
    `Trend score: ${trend.score ?? "n/a"} (${trend.horizon ?? "n/a"})`,
    `Momentum: 1h ${momentum.change1h ?? "n/a"}%, 24h ${momentum.change24h ?? "n/a"}%, 7d ${momentum.change7d ?? "n/a"}%`,
    `Bot signals: ${signals.buy ?? 0} buy / ${signals.sell ?? 0} sell (${signals.total ?? 0} total)`,
    `Sentiment: ${news.sentiment ?? "n/a"} (${news.count ?? 0} headlines)`,
    `AI summary: ${item.analysis?.summary || item.rationale || "n/a"}`,
  ].join("\n")
}

function TradeList({
  items,
  title,
  empty,
  aiAdvice,
  aiLoading,
  adviceEnabled,
  onAskAi,
  onCopyPrompt,
}: {
  items: MarketHotTrade[]
  title: string
  empty: string
  aiAdvice: Record<string, AiAdvice>
  aiLoading: Record<string, boolean>
  adviceEnabled: boolean
  onAskAi: (item: MarketHotTrade) => void
  onCopyPrompt: (item: MarketHotTrade) => void
}) {
  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="text-xs text-muted-foreground">{items.length} picks</div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{empty}</div>
        ) : (
          items.map((item) => {
            const adviceKey = buildAdviceKey(item)
            const advice = aiAdvice[adviceKey]
            const loading = aiLoading[adviceKey]
            return (
              <div
                key={`${title}-${item.assetClass}-${item.symbol}`}
                className="rounded-xl border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold tracking-tight truncate">
                        {item.symbol}
                      </div>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {item.assetClass}
                      </Badge>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      24h {formatChange(item.momentum?.change24h)} · 1h{" "}
                      {formatChange(item.momentum?.change1h)}
                    </div>
                  </div>
                  <Badge variant="outline" className={scoreTone(item.score)}>
                    {item.score?.toFixed(1) ?? "--"}
                  </Badge>
                </div>
                {item.signals?.total ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {item.signals.total} bot signals · {item.signals.buy ?? 0} buy /{" "}
                    {item.signals.sell ?? 0} sell
                  </div>
                ) : null}
                {item.analysis?.summary ? (
                  <div className="mt-1 text-xs text-muted-foreground break-words">
                    {item.analysis.summary}
                  </div>
                ) : item.rationale ? (
                  <div className="mt-1 text-xs text-muted-foreground break-words">
                    {item.rationale}
                  </div>
                ) : null}
                {item.analysis?.details?.length ? (
                  <details className="mt-2 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer text-[11px]">
                      Why this pick
                    </summary>
                    <div className="mt-1 space-y-1 break-words">
                      {item.analysis.details.map((line, index) => (
                        <div key={`${item.symbol}-detail-${index}`}>{line}</div>
                      ))}
                    </div>
                  </details>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAskAi(item)}
                    disabled={!adviceEnabled || loading}
                  >
                    {loading ? "Asking..." : "Ask AI"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopyPrompt(item)}
                  >
                    Copy AI prompt
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Get a simple buy/hold/sell plan.
                  </span>
                </div>
                {advice ? (
                  <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-[11px]">
                    <div className="font-medium">
                      AI:{" "}
                      {advice.summary ||
                        `${advice.action} · hold ${advice.holdMinutes}m`}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {(() => {
                        if (advice.action === "hold") {
                          return <>Recheck in {advice.holdMinutes}m.</>
                        }
                        const computed = computePriceLevels(
                          advice.action,
                          item.price,
                          advice.stopLossPct,
                          advice.takeProfitPct
                        )
                        const stop =
                          advice.stopLossPrice ?? computed.stopLossPrice
                        const target =
                          advice.takeProfitPrice ?? computed.takeProfitPrice
                        return (
                          <>
                            Hold {advice.holdMinutes}m · Stop{" "}
                            {stop ? formatPrice(stop, item.assetClass) : "—"} ·
                            Target {target ? formatPrice(target, item.assetClass) : "—"}
                          </>
                        )
                      })()}
                    </div>
                    {advice.reasoning ? (
                      <div className="mt-1 text-muted-foreground">{advice.reasoning}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export default function TradeNowPage() {
  const { user } = useAuth()
  const [actionBoard, setActionBoard] = useState<MarketActionBoardDoc | null>(null)
  const [hotTrades, setHotTrades] = useState<MarketHotTrade[]>([])
  const [hotTradesUpdatedAt, setHotTradesUpdatedAt] = useState<MarketHotTradesDoc["updatedAt"]>()
  const [hotTradesMeta, setHotTradesMeta] = useState<MarketHotTradesDoc["meta"]>()
  const [loading, setLoading] = useState(true)
  const [assetFilter, setAssetFilter] = useState<"all" | "crypto" | "stock" | "forex">(
    "all"
  )
  const [refreshingJobs, setRefreshingJobs] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<Record<string, AiAdvice>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})

  const refreshEndpoint = useMemo(() => {
    const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/refresh`
  }, [])
  const adviceEndpoint = useMemo(() => {
    const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/advice`
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoading(false)
      return
    }

    const unsubAction = onSnapshot(doc(db, "market", "actionBoard"), (snap) => {
      if (!snap.exists()) {
        setActionBoard(null)
        return
      }
      setActionBoard(snap.data() as MarketActionBoardDoc)
    })

    const unsubHotTrades = onSnapshot(doc(db, "market", "hotTrades"), (snap) => {
      if (!snap.exists()) {
        setHotTrades([])
        setHotTradesUpdatedAt(undefined)
        setLoading(false)
        return
      }
      const data = snap.data() as MarketHotTradesDoc
      setHotTrades(data.items ?? [])
      setHotTradesUpdatedAt(data.updatedAt)
      setHotTradesMeta(data.meta ?? {})
      setLoading(false)
    })

    return () => {
      unsubAction()
      unsubHotTrades()
    }
  }, [])

  const hasActionBoard = Boolean(
    actionBoard && (actionBoard.buys?.length || actionBoard.sells?.length)
  )

  const buys = useMemo(() => {
    const baseBuys = hasActionBoard
      ? actionBoard?.buys ?? []
      : hotTrades.filter((item) => item.side === "buy")
    const limit = Number(actionBoard?.meta?.classLimit ?? 10)

    if (assetFilter === "all") return baseBuys.slice(0, limit)

    const byAsset = hasActionBoard ? actionBoard?.byAsset?.buys?.[assetFilter] : null
    if (byAsset && byAsset.length > 0) return byAsset

    return baseBuys.filter((item) => item.assetClass === assetFilter).slice(0, limit)
  }, [actionBoard, assetFilter, hasActionBoard, hotTrades])

  const sells = useMemo(() => {
    const baseSells = hasActionBoard
      ? actionBoard?.sells ?? []
      : hotTrades.filter((item) => item.side === "sell")
    const limit = Number(actionBoard?.meta?.classLimit ?? 10)

    if (assetFilter === "all") return baseSells.slice(0, limit)

    const byAsset = hasActionBoard ? actionBoard?.byAsset?.sells?.[assetFilter] : null
    if (byAsset && byAsset.length > 0) return byAsset

    return baseSells.filter((item) => item.assetClass === assetFilter).slice(0, limit)
  }, [actionBoard, assetFilter, hasActionBoard, hotTrades])

  const updatedAt = hasActionBoard ? actionBoard?.updatedAt : hotTradesUpdatedAt
  const assetLabel =
    assetFilter === "all"
      ? "All assets"
      : assetFilter === "stock"
        ? "Stocks"
        : assetFilter === "forex"
          ? "FX"
      : "Crypto"
  const fetchStatus = useMemo(() => {
    const meta = hasActionBoard ? actionBoard?.meta : hotTradesMeta
    const status = meta && typeof meta === "object" ? (meta as Record<string, unknown>).fetchStatus : null
    return status && typeof status === "object" ? (status as Record<string, any>) : null
  }, [actionBoard?.meta, hasActionBoard, hotTradesMeta])
  const adviceEnabled = Boolean(adviceEndpoint)

  function resolveEmptyMessage(sideLabel: "buy" | "sell") {
    if (assetFilter === "all") return `No ${sideLabel} signals yet.`
    const status = fetchStatus?.[assetFilter]
    const source = status?.source ? String(status.source) : "data source"
    const error = status?.error ? String(status.error) : null
    if (status?.status === "disabled") {
      return `${assetLabel} data is disabled in your universe.`
    }
    if (status?.status === "error") {
      return `${assetLabel} data unavailable (${source}). ${error ?? "Try again shortly."}`
    }
    if (status?.status === "empty") {
      return `${assetLabel} data returned no candidates this run. Refresh to try again.`
    }
    return `No ${sideLabel} signals yet.`
  }

  async function triggerRefresh() {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }
    if (!refreshEndpoint) {
      toast.error("Refresh service not configured")
      return
    }
    if (!user) {
      toast.error("You must be signed in")
      return
    }

    setRefreshingJobs(true)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch(refreshEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || `Refresh failed (${response.status})`)
      }
      const jobNames = Array.isArray(payload?.jobs)
        ? payload.jobs.map((job: { job?: string }) => job.job).filter(Boolean)
        : []
      toast.success(
        jobNames.length > 0
          ? `Refresh started: ${jobNames.join(", ")}`
          : "Refresh started"
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed")
    } finally {
      setRefreshingJobs(false)
    }
  }

  async function requestAdvice(item: MarketHotTrade) {
    if (!adviceEndpoint) {
      toast.error("AI advice endpoint not configured.")
      return
    }
    if (!firebaseEnabled || !user) {
      toast.error("Sign in to use AI advice.")
      return
    }
    if (!item.symbol) return

    const key = buildAdviceKey(item)
    setAiLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const token = await user.getIdToken()
      const payload = {
        trade: {
          symbol: item.symbol,
          assetClass: item.assetClass,
          side: item.side,
          price: item.price,
          score: item.score,
          confidence: item.confidence,
          momentum: item.momentum,
          signals: item.signals,
          trend: item.trend,
          news: item.news,
          analysis: item.analysis
            ? { summary: item.analysis.summary, details: item.analysis.details?.slice(0, 3) }
            : undefined,
          rationale: item.rationale,
        },
      }

      const res = await fetch(adviceEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "AI advice failed.")
      }
      setAiAdvice((prev) => ({ ...prev, [key]: data.advice }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI advice failed."
      toast.error(message)
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function copyPrompt(item: MarketHotTrade) {
    try {
      const prompt = buildAiPrompt(item)
      await navigator.clipboard.writeText(prompt)
      toast.success("AI prompt copied")
    } catch {
      toast.error("Failed to copy prompt")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Trade Now
          </div>
          <div className="text-2xl font-semibold">What to buy vs sell</div>
          <div className="text-sm text-muted-foreground">
            Market movers blended with live bot signals and news sentiment across crypto, stocks, and FX.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={triggerRefresh}
            disabled={!firebaseEnabled || refreshingJobs || !refreshEndpoint}
            title={refreshEndpoint ? "Run market jobs now" : "Set VITE_REFRESH_URL to enable"}
          >
            {refreshingJobs ? "Refreshing..." : "Refresh now"}
          </Button>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1">
            {[
              { value: "all", label: "All" },
              { value: "crypto", label: "Crypto" },
              { value: "stock", label: "Stocks" },
              { value: "forex", label: "FX" },
            ].map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={assetFilter === filter.value ? "secondary" : "ghost"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() =>
                  setAssetFilter(filter.value as "all" | "crypto" | "stock" | "forex")
                }
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <Badge variant="outline">Updated {formatRelativeTimestamp(updatedAt)}</Badge>
        </div>
      </div>

      {!firebaseEnabled ? (
        <div className="text-sm text-muted-foreground">Connect Firebase to load signals.</div>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Loading live picks...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TradeList
            items={buys}
            title={`Buy Now · ${assetLabel}`}
            empty={resolveEmptyMessage("buy")}
            aiAdvice={aiAdvice}
            aiLoading={aiLoading}
            adviceEnabled={adviceEnabled}
            onAskAi={requestAdvice}
            onCopyPrompt={copyPrompt}
          />
          <TradeList
            items={sells}
            title={`Sell Now · ${assetLabel}`}
            empty={resolveEmptyMessage("sell")}
            aiAdvice={aiAdvice}
            aiLoading={aiLoading}
            adviceEnabled={adviceEnabled}
            onAskAi={requestAdvice}
            onCopyPrompt={copyPrompt}
          />
        </div>
      )}
    </div>
  )
}
