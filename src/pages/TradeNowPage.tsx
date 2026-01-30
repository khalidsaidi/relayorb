import { useEffect, useMemo, useState } from "react"
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type {
  MarketActionBoardDoc,
  MarketHotTrade,
  MarketHotTradesDoc,
  MarketSwingOvernightDoc,
  MarketPrebreakoutDoc,
  BrokerAccountDoc,
  BrokerAccountKey,
} from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatAssetPrice, formatRelativeTimestamp } from "@/lib/format"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/auth-context"
import { useMarketPrices } from "@/features/market/use-market-prices"
import { useStreamSymbols } from "@/features/market/use-stream-symbols"
import { useMarketControls } from "@/features/market/use-market-controls"
import { MarketStatusBadge } from "@/components/MarketStatusBadge"
import { MarketStatusBanner } from "@/components/MarketClosedOverlay"
import { AssetChartModal } from "@/components/charts/AssetChartModal"
import { ScoreBreakdownDialog } from "@/components/score/ScoreBreakdownDialog"
import { BarChart3, InfoIcon } from "lucide-react"
import { buildAiPrompt } from "@/features/ai/ai-prompt"
import { findAnalysisNoteKind, getAnalysisNoteKind, localizeAnalysis } from "@/lib/analysis-localize"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { ExecuteTradeButton } from "@/components/ibkr/ExecuteTradeButton"
import { useIbkrAccount } from "@/features/ibkr/use-ibkr-account"
import { useTranslation } from "react-i18next"

function scoreTone(score?: number) {
  if (score === undefined || score === null) return "bg-muted text-muted-foreground"
  if (score >= 75) return "bg-emerald-500/15 text-emerald-800"
  if (score >= 60) return "bg-sky-500/15 text-sky-700"
  if (score >= 45) return "bg-amber-500/15 text-amber-700"
  return "bg-slate-500/10 text-slate-600"
}

function formatChange(value: number | undefined, naLabel: string) {
  if (value === undefined || value === null) return naLabel
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

type FetchStatusEntry = { status?: string; source?: string; error?: string }
type FetchStatus = Record<string, FetchStatusEntry>
type AssetClass = MarketHotTrade["assetClass"]

function buildAdviceKey(item: MarketHotTrade) {
  return `${item.assetClass}:${item.symbol}:${item.side ?? "hold"}:${item.profile ?? "default"}`
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

/**
 * Format hold time in a human-readable way
 */
function formatHoldTime(
  minutes: number,
  labels: { day: string; days: string; hourShort: string; minuteShort: string }
): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440)
    return `${days} ${days > 1 ? labels.days : labels.day}`
  } else if (minutes >= 60) {
    const hours = Math.round(minutes / 60)
    return `${hours}${labels.hourShort}`
  } else {
    return `${minutes}${labels.minuteShort}`
  }
}

function TradeList({
  items,
  title,
  meta,
  metaBadges,
  empty,
  aiAdvice,
  aiLoading,
  adviceEnabled,
  onAskAi,
  onCopyPrompt,
  onShowChart,
  onShowBreakdown,
  onApplyAiSuggestion,
  actionsDisabled = false,
  actionsDisabledReason,
  prices,
  livePrices,
  brokerAccountKey,
  brokerAccount,
  requestedByUid,
  ibkrDisabledReason,
}: {
  items: MarketHotTrade[]
  title: string
  meta?: string
  metaBadges?: string[]
  empty: string
  aiAdvice: Record<string, AiAdvice>
  aiLoading: Record<string, boolean>
  adviceEnabled: boolean
  onAskAi: (item: MarketHotTrade) => void
  onCopyPrompt: (item: MarketHotTrade) => void
  onShowChart: (item: MarketHotTrade) => void
  onShowBreakdown: (item: MarketHotTrade) => void
  onApplyAiSuggestion: (item: MarketHotTrade, advice: AiAdvice) => void
  actionsDisabled?: boolean
  actionsDisabledReason?: string
  prices: Record<string, number>
  livePrices: Record<string, number>
  brokerAccountKey: BrokerAccountKey | null
  brokerAccount: BrokerAccountDoc | null
  requestedByUid?: string | null
  ibkrDisabledReason?: string
}) {
  const { t, i18n } = useTranslation()
  const naLabel = t("common.na")
  const assetLabelMap: Record<AssetClass, string> = {
    stock: t("assets.stock"),
    crypto: t("assets.crypto"),
    forex: t("assets.fx"),
  }
  const getAssetLabel = (assetClass?: string | null) =>
    assetClass ? assetLabelMap[assetClass as AssetClass] ?? assetClass : t("common.unknown")
  const holdLabels = {
    day: t("time.day"),
    days: t("time.days"),
    hourShort: t("common.hourShort"),
    minuteShort: t("common.minuteShort"),
  }
  const badgeLabels = [meta, ...(metaBadges ?? [])].filter(Boolean)

  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {badgeLabels.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {badgeLabels.map((label) => (
                <Badge key={label} variant="outline" className="text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("tradeNow.picks", { count: items.length })}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{empty}</div>
        ) : (
          items.map((item) => {
            const adviceKey = buildAdviceKey(item)
            const advice = aiAdvice[adviceKey]
            const loading = aiLoading[adviceKey]
            const localizedAnalysis = localizeAnalysis(item.analysis, t, i18n.language)
            const noteKind = findAnalysisNoteKind(item.analysis?.details)
            const confidenceLabel =
              typeof item.confidence === "number"
                ? `${Math.round(item.confidence * 100)}%`
                : "--"
            return (
              <div
                key={`${title}-${item.assetClass}-${item.symbol}`}
                className="rounded-xl border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold tracking-tight truncate">
                        {item.symbol}
                      </div>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {getAssetLabel(item.assetClass)}
                      </Badge>
                      {item.profile === "swing_overnight" && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("tradeNow.swingOvernightBadge")}
                        </Badge>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onShowBreakdown(item)}
                          title={t("tradeNow.scoreBreakdown")}
                        >
                          <InfoIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onShowChart(item)}
                          title={t("tradeNow.viewChart")}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {(() => {
                          const current = prices[item.symbol] ?? item.price
                          return formatAssetPrice(current, item.assetClass)
                        })()}
                      </span>
                      {livePrices[item.symbol] && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                          title={t("tradeNow.livePrice")}
                        ></span>
                      )}
                      <span>·</span>
                      {t("tradeNow.twentyFourHour")} {formatChange(item.momentum?.change24h, naLabel)} ·{" "}
                      {t("tradeNow.oneHour")} {formatChange(item.momentum?.change1h, naLabel)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={scoreTone(item.score)}>
                      {item.score?.toFixed(1) ?? "--"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Conf {confidenceLabel}
                    </Badge>
                  </div>
                </div>
                {item.signals?.total ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {t("tradeNow.botSignals", {
                      total: item.signals.total,
                      buy: item.signals.buy ?? 0,
                      sell: item.signals.sell ?? 0,
                    })}
                  </div>
                ) : null}
                {localizedAnalysis.summary ? (
                  <div className="mt-1 text-xs text-muted-foreground break-words flex items-center gap-1.5">
                    {noteKind ? (
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                      >
                        {t(`analysis.badges.${noteKind}`)}
                      </Badge>
                    ) : null}
                    <span>{localizedAnalysis.summary}</span>
                  </div>
                ) : item.rationale ? (
                  <div className="mt-1 text-xs text-muted-foreground break-words flex items-center gap-1.5">
                    {noteKind ? (
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                      >
                        {t(`analysis.badges.${noteKind}`)}
                      </Badge>
                    ) : null}
                    <span>{item.rationale}</span>
                  </div>
                ) : null}
                {localizedAnalysis.details?.length ? (
                  <details className="mt-2 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer text-[11px]">
                      {t("tradeNow.whyThisPick")}
                    </summary>
                    <ul className="mt-1 space-y-1 break-words list-disc pl-4">
                      {localizedAnalysis.details.map((line, index) => {
                        const noteKind = getAnalysisNoteKind(item.analysis?.details?.[index])
                        return (
                          <li key={`${item.symbol}-detail-${index}`}>
                            <span className="inline-flex items-center gap-1">
                              {noteKind ? (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                                >
                                  {t(`analysis.badges.${noteKind}`)}
                                </Badge>
                              ) : null}
                              <span>{line}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                ) : null}



                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {requestedByUid && brokerAccountKey && item.assetClass === "stock" ? (
                    <ExecuteTradeButton
                      trade={item}
                      brokerAccountKey={brokerAccountKey}
                      brokerAccount={brokerAccount}
                      requestedByUid={requestedByUid}
                      disabledReason={ibkrDisabledReason}
                      variant="default"
                    />
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAskAi(item)}
                    disabled={!adviceEnabled || loading}
                  >
                    {loading ? t("tradeNow.asking") : t("tradeNow.askAi")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopyPrompt(item)}
                  >
                    {t("tradeNow.copyAiPrompt")}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    {t("tradeNow.aiHint")}
                  </span>
                </div>
                {advice ? (
                  <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-[11px]">
                    <div className="font-medium">
                      {t("tradeNow.aiLabel")}{" "}
                      {advice.summary ||
                        t("tradeNow.aiSignal", {
                          action: t(`trade.side.${advice.action}`),
                          symbol: item.symbol,
                        })}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {(() => {
                        if (advice.action === "hold") {
                          return (
                            <>
                              {t("tradeNow.recheckIn", {
                                time: formatHoldTime(advice.holdMinutes, holdLabels),
                              })}
                            </>
                          )
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
                        const holdTimeText = formatHoldTime(advice.holdMinutes, holdLabels)
                        return (
                          <>
                            {t("tradeNow.holdFor", { time: holdTimeText })} · {t("tradeNow.stop")}{" "}
                            {stop ? formatAssetPrice(stop, item.assetClass) : naLabel} · {t("tradeNow.target")}{" "}
                            {target ? formatAssetPrice(target, item.assetClass) : naLabel}
                          </>
                        )
                      })()}
                    </div>
                    {advice.reasoning ? (
                      <div className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
                        {advice.reasoning}
                      </div>
                    ) : null}
                    {advice.action !== "hold" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="mt-2 w-full"
                        onClick={() => onApplyAiSuggestion(item, advice)}
                        disabled={actionsDisabled}
                        title={actionsDisabled ? actionsDisabledReason : undefined}
                      >
                        {t("tradeNow.applyAiSuggestion")}
                      </Button>
                    )}
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
  const { t } = useTranslation()
  const { replayActive, controls: replayControls } = useReplayControls()
  const replayRunId = replayActive ? replayControls?.activeRunId : null
  const { brokerAccountKey, brokerAccount, tradingControls } = useIbkrAccount(user?.uid)
  const { prices, livePrices } = useMarketPrices()
  const { cryptoEnabled, forexEnabled } = useMarketControls()
  const [actionBoard, setActionBoard] = useState<MarketActionBoardDoc | null>(null)
  const [hotTrades, setHotTrades] = useState<MarketHotTrade[]>([])
  const [hotTradesUpdatedAt, setHotTradesUpdatedAt] = useState<MarketHotTradesDoc["updatedAt"]>()
  const [hotTradesMeta, setHotTradesMeta] = useState<MarketHotTradesDoc["meta"]>()
  const [swingOvernight, setSwingOvernight] = useState<MarketHotTrade[]>([])
  const [swingOvernightUpdatedAt, setSwingOvernightUpdatedAt] =
    useState<MarketSwingOvernightDoc["updatedAt"]>()
  const [prebreakout, setPrebreakout] = useState<MarketHotTrade[]>([])
  const [prebreakoutUpdatedAt, setPrebreakoutUpdatedAt] =
    useState<MarketPrebreakoutDoc["updatedAt"]>()
  const [loading, setLoading] = useState(true)
  const [assetFilter, setAssetFilter] = useState<"all" | "crypto" | "stock" | "forex">(
    "all"
  )
  const [refreshingJobs, setRefreshingJobs] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<Record<string, AiAdvice>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [chartAsset, setChartAsset] = useState<MarketHotTrade | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [breakdownAsset, setBreakdownAsset] = useState<MarketHotTrade | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const replayActionDisabledReason = t("replay.actionsDisabled")
  const ibkrDisabledReason = replayActive
    ? replayActionDisabledReason
    : tradingControls?.ibkrEnabled === false
    ? t("ibkr.errors.ibkrDisabled")
    : undefined

  useEffect(() => {
    if (assetFilter === "crypto" && !cryptoEnabled) {
      setAssetFilter(forexEnabled ? "forex" : "stock")
    }
    if (assetFilter === "forex" && !forexEnabled) {
      setAssetFilter(cryptoEnabled ? "crypto" : "stock")
    }
  }, [assetFilter, cryptoEnabled, forexEnabled])

  const activeFilter = useMemo(() => {
    if (assetFilter === "crypto" && !cryptoEnabled) {
      return forexEnabled ? "forex" : "stock"
    }
    if (assetFilter === "forex" && !forexEnabled) {
      return cryptoEnabled ? "crypto" : "stock"
    }
    return assetFilter
  }, [assetFilter, cryptoEnabled, forexEnabled])

  const streamItems = useMemo(() => {
    const items: MarketHotTrade[] = []
    if (actionBoard?.buys?.length) items.push(...actionBoard.buys)
    if (actionBoard?.sells?.length) items.push(...actionBoard.sells)
    if (hotTrades.length) items.push(...hotTrades)
    if (swingOvernight.length) items.push(...swingOvernight)
    if (prebreakout.length) items.push(...prebreakout)
    return items.filter((item) => {
      if (item.assetClass === "crypto") return cryptoEnabled
      if (item.assetClass === "forex") return forexEnabled
      return true
    })
  }, [actionBoard, hotTrades, swingOvernight, prebreakout, cryptoEnabled, forexEnabled])

  useStreamSymbols("trade-now", {
    items: streamItems,
    enabled: !loading,
  })

  const adviceEndpoint = useMemo(
    () => (import.meta.env.VITE_AI_ADVICE_URL || "").trim(),
    []
  )

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoading(false)
      return
    }
    if (replayActive && !replayRunId) {
      setActionBoard(null)
      setHotTrades([])
      setHotTradesUpdatedAt(undefined)
      setSwingOvernight([])
      setSwingOvernightUpdatedAt(undefined)
      setPrebreakout([])
      setPrebreakoutUpdatedAt(undefined)
      setLoading(false)
      return
    }

    const actionRef = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "actionBoard")
      : doc(db, "market", "actionBoard")
    const hotTradesRef = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "hotTrades")
      : doc(db, "market", "hotTrades")
    const swingRef = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "swingOvernight")
      : doc(db, "market", "swingOvernight")
    const prebreakoutRef = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prebreakout")
      : doc(db, "market", "prebreakout")

    let active = true
    const unsubAction = onSnapshot(actionRef, (snap) => {
      if (!active) return
      if (!snap.exists()) {
        setActionBoard(null)
        return
      }
      setActionBoard(snap.data() as MarketActionBoardDoc)
    })

    const unsubHotTrades = onSnapshot(hotTradesRef, (snap) => {
      if (!active) return
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

    const unsubSwing = onSnapshot(swingRef, (snap) => {
      if (!active) return
      if (!snap.exists()) {
        setSwingOvernight([])
        setSwingOvernightUpdatedAt(undefined)
        return
      }
      const data = snap.data() as MarketSwingOvernightDoc
      setSwingOvernight(data.items ?? [])
      setSwingOvernightUpdatedAt(data.updatedAt)
    })
    const unsubPrebreakout = onSnapshot(prebreakoutRef, (snap) => {
      if (!active) return
      if (!snap.exists()) {
        setPrebreakout([])
        setPrebreakoutUpdatedAt(undefined)
        return
      }
      const data = snap.data() as MarketPrebreakoutDoc
      setPrebreakout(data.items ?? [])
      setPrebreakoutUpdatedAt(data.updatedAt)
    })

    return () => {
      active = false
      unsubAction()
      unsubHotTrades()
      unsubSwing()
      unsubPrebreakout()
    }
  }, [replayActive, replayRunId])

  const hasActionBoard = Boolean(
    actionBoard && (actionBoard.buys?.length || actionBoard.sells?.length)
  )

  const buys = useMemo(() => {
    const baseBuys = hasActionBoard
      ? actionBoard?.buys ?? []
      : hotTrades.filter((item) => item.side === "buy")
    const limit = Number(actionBoard?.meta?.classLimit ?? 10)

    if (activeFilter === "all") {
      return baseBuys
        .filter((item) => {
          if (item.assetClass === "crypto") return cryptoEnabled
          if (item.assetClass === "forex") return forexEnabled
          return true
        })
        .slice(0, limit)
    }
    if (activeFilter === "crypto" && !cryptoEnabled) return []
    if (activeFilter === "forex" && !forexEnabled) return []

    const byAsset = hasActionBoard ? actionBoard?.byAsset?.buys?.[activeFilter] : null
    if (byAsset && byAsset.length > 0) return byAsset

    return baseBuys.filter((item) => item.assetClass === activeFilter).slice(0, limit)
  }, [actionBoard, activeFilter, hasActionBoard, hotTrades, cryptoEnabled, forexEnabled])

  const sells = useMemo(() => {
    const baseSells = hasActionBoard
      ? actionBoard?.sells ?? []
      : hotTrades.filter((item) => item.side === "sell")
    const limit = Number(actionBoard?.meta?.classLimit ?? 10)

    if (activeFilter === "all") {
      return baseSells
        .filter((item) => {
          if (item.assetClass === "crypto") return cryptoEnabled
          if (item.assetClass === "forex") return forexEnabled
          return true
        })
        .slice(0, limit)
    }
    if (activeFilter === "crypto" && !cryptoEnabled) return []
    if (activeFilter === "forex" && !forexEnabled) return []

    const byAsset = hasActionBoard ? actionBoard?.byAsset?.sells?.[activeFilter] : null
    if (byAsset && byAsset.length > 0) return byAsset

    return baseSells.filter((item) => item.assetClass === activeFilter).slice(0, limit)
  }, [actionBoard, activeFilter, hasActionBoard, hotTrades, cryptoEnabled, forexEnabled])

  const updatedAt = hasActionBoard ? actionBoard?.updatedAt : hotTradesUpdatedAt
  const swingUpdatedAtLabel = swingOvernightUpdatedAt
    ? t("tradeNow.updatedAt", { time: formatRelativeTimestamp(swingOvernightUpdatedAt) })
    : undefined
  const prebreakoutUpdatedAtLabel = prebreakoutUpdatedAt
    ? t("tradeNow.updatedAt", { time: formatRelativeTimestamp(prebreakoutUpdatedAt) })
    : undefined
  const assetLabel =
    activeFilter === "all"
      ? t("assets.all")
      : activeFilter === "stock"
        ? t("assets.stocks")
        : activeFilter === "forex"
          ? t("assets.fx")
          : t("assets.crypto")
  const fetchStatus = useMemo(() => {
    const meta = hasActionBoard ? actionBoard?.meta : hotTradesMeta
    const status = meta && typeof meta === "object" ? (meta as Record<string, unknown>).fetchStatus : null
    return status && typeof status === "object" ? (status as FetchStatus) : null
  }, [actionBoard?.meta, hasActionBoard, hotTradesMeta])
  const adviceEnabled = Boolean(adviceEndpoint)
  const refreshDisabledReason = useMemo(() => {
    if (replayActive) return replayActionDisabledReason
    if (!firebaseEnabled || !db) return t("tradeNow.firebaseNotConfigured")
    if (!user) return t("tradeNow.mustBeSignedIn")
    return ""
  }, [replayActive, replayActionDisabledReason, firebaseEnabled, db, user, t])

  const assetFilters = useMemo(() => {
    const items = [
      { value: "all", label: t("assets.allShort") },
      { value: "stock", label: t("assets.stocks") },
    ] as Array<{ value: "all" | "crypto" | "stock" | "forex"; label: string }>
    if (cryptoEnabled) items.splice(1, 0, { value: "crypto", label: t("assets.crypto") })
    if (forexEnabled) items.push({ value: "forex", label: t("assets.fx") })
    return items
  }, [t, cryptoEnabled, forexEnabled])

  function resolveEmptyMessage(sideLabel: "buy" | "sell") {
    if (activeFilter === "all") {
      return t("tradeNow.noSignalsYet", { side: t(`trade.side.${sideLabel}`) })
    }
    const status = fetchStatus?.[activeFilter]
    const source = status?.source ? String(status.source) : t("tradeNow.dataSource")
    const error = status?.error ? String(status.error) : null
    if (status?.status === "disabled") {
      return t("tradeNow.dataDisabled", { asset: assetLabel })
    }
    if (status?.status === "error") {
      return t("tradeNow.dataUnavailable", {
        asset: assetLabel,
        source,
        error: error ?? t("tradeNow.tryAgainSoon"),
      })
    }
    if (status?.status === "empty") {
      return t("tradeNow.noCandidates", { asset: assetLabel })
    }
    return t("tradeNow.noSignalsYet", { side: t(`trade.side.${sideLabel}`) })
  }

  async function triggerRefreshViaBatch() {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return false
    }
    if (!user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return false
    }
    const runId = `ui-refresh-${Date.now()}`
    await addDoc(collection(db, "batches"), {
      runId,
      type: "refresh",
      source: "ui",
      requestedByUid: user.uid,
      requestedByEmail: user.email || null,
      createdAt: serverTimestamp(),
    })
    return true
  }

  async function triggerRefresh() {
    if (replayActive) {
      toast.info(replayActionDisabledReason)
      return
    }

    setRefreshingJobs(true)
    try {
      const ok = await triggerRefreshViaBatch()
      if (ok) {
        toast.success(t("tradeNow.refreshStarted"))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tradeNow.refreshFailedGeneric"))
    } finally {
      setRefreshingJobs(false)
    }
  }

  async function requestAdvice(item: MarketHotTrade) {
    if (!adviceEndpoint) {
      toast.error(t("tradeNow.aiEndpointNotConfigured"))
      return
    }
    if (!firebaseEnabled || !user) {
      toast.error(t("tradeNow.signInForAi"))
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
        const errorMsg = data?.error || t("tradeNow.aiAdviceFailed")
        console.error("Advice API error:", errorMsg, data)
        throw new Error(errorMsg)
      }
      setAiAdvice((prev) => ({ ...prev, [key]: data.advice }))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("tradeNow.aiAdviceFailed")
      toast.error(message)
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function copyPrompt(item: MarketHotTrade) {
    try {
      const prompt = buildAiPrompt(item)
      await navigator.clipboard.writeText(prompt)
      toast.success(t("tradeNow.aiPromptCopied"))
    } catch {
      toast.error(t("tradeNow.aiPromptCopyFailed"))
    }
  }

  async function applyAiSuggestion(item: MarketHotTrade, advice: AiAdvice) {
    if (replayActive) {
      toast.info(replayActionDisabledReason)
      return
    }
    void item
    if (advice.action === "hold") {
      toast.info(t("tradeNow.aiHoldNoTrade"))
      return
    }
    toast.info(t("tradeNow.aiApplyDisabled"))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            {t("tradeNow.title")}
          </div>
          <div className="text-2xl font-semibold">{t("tradeNow.subtitle")}</div>
          <div className="text-sm text-muted-foreground">
            {t("tradeNow.description")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={triggerRefresh}
            disabled={
              refreshingJobs || Boolean(refreshDisabledReason)
            }
            title={
              refreshingJobs
                ? t("tradeNow.refreshing")
                : refreshDisabledReason || t("tradeNow.refreshTitle")
            }
          >
            {refreshingJobs ? t("tradeNow.refreshing") : t("tradeNow.refreshNow")}
          </Button>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1">
            {assetFilters.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={activeFilter === filter.value ? "secondary" : "ghost"}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() =>
                  setAssetFilter(filter.value as "all" | "crypto" | "stock" | "forex")
                }
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <Badge variant="outline">
            {t("tradeNow.updatedAt", { time: formatRelativeTimestamp(updatedAt) })}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {(activeFilter === "all" || activeFilter === "stock") && (
          <MarketStatusBadge assetClass="stock" />
        )}
        {(activeFilter === "all" || activeFilter === "forex") && forexEnabled && (
          <MarketStatusBadge assetClass="forex" />
        )}
        {(activeFilter === "all" || activeFilter === "crypto") && cryptoEnabled && (
          <MarketStatusBadge assetClass="crypto" />
        )}
      </div>

      {/* Show prominent banner when stock market is closed */}
      {(activeFilter === "all" || activeFilter === "stock") && (
        <MarketStatusBanner assetClass="stock" />
      )}
      {(activeFilter === "forex") && forexEnabled && (
        <MarketStatusBanner assetClass="forex" />
      )}

      {!firebaseEnabled ? (
        <div className="text-sm text-muted-foreground">{t("tradeNow.connectFirebase")}</div>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">{t("tradeNow.loadingPicks")}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <TradeList
              items={buys}
              title={t("tradeNow.buyNow", { asset: assetLabel })}
              empty={resolveEmptyMessage("buy")}
              aiAdvice={aiAdvice}
              aiLoading={aiLoading}
              adviceEnabled={adviceEnabled}
              onAskAi={requestAdvice}
              onCopyPrompt={copyPrompt}
              onShowChart={(item) => {
                setChartAsset(item)
                setChartOpen(true)
              }}
              onShowBreakdown={(item) => {
                setBreakdownAsset(item)
                setBreakdownOpen(true)
              }}
              onApplyAiSuggestion={applyAiSuggestion}
              actionsDisabled={replayActive}
              actionsDisabledReason={replayActionDisabledReason}
              prices={prices}
              livePrices={livePrices}
              brokerAccountKey={brokerAccountKey}
              brokerAccount={brokerAccount}
              requestedByUid={user?.uid ?? null}
              ibkrDisabledReason={ibkrDisabledReason}
            />
            <TradeList
              items={sells}
              title={t("tradeNow.sellNow", { asset: assetLabel })}
              empty={resolveEmptyMessage("sell")}
              aiAdvice={aiAdvice}
              aiLoading={aiLoading}
              adviceEnabled={adviceEnabled}
              onAskAi={requestAdvice}
              onCopyPrompt={copyPrompt}
              onShowChart={(item) => {
                setChartAsset(item)
                setChartOpen(true)
              }}
              onShowBreakdown={(item) => {
                setBreakdownAsset(item)
                setBreakdownOpen(true)
              }}
              onApplyAiSuggestion={applyAiSuggestion}
              actionsDisabled={replayActive}
              actionsDisabledReason={replayActionDisabledReason}
              prices={prices}
              livePrices={livePrices}
              brokerAccountKey={brokerAccountKey}
              brokerAccount={brokerAccount}
              requestedByUid={user?.uid ?? null}
              ibkrDisabledReason={ibkrDisabledReason}
            />
          </div>
          {(activeFilter === "all" || activeFilter === "stock") && (
            <TradeList
              items={swingOvernight}
              title={t("tradeNow.swingOvernightTitle")}
              meta={swingUpdatedAtLabel}
              empty={t("tradeNow.swingOvernightEmpty")}
              aiAdvice={aiAdvice}
              aiLoading={aiLoading}
              adviceEnabled={adviceEnabled}
              onAskAi={requestAdvice}
              onCopyPrompt={copyPrompt}
              onShowChart={(item) => {
                setChartAsset(item)
                setChartOpen(true)
              }}
              onShowBreakdown={(item) => {
                setBreakdownAsset(item)
                setBreakdownOpen(true)
              }}
              onApplyAiSuggestion={applyAiSuggestion}
              actionsDisabled={replayActive}
              actionsDisabledReason={replayActionDisabledReason}
              prices={prices}
              livePrices={livePrices}
              brokerAccountKey={brokerAccountKey}
              brokerAccount={brokerAccount}
              requestedByUid={user?.uid ?? null}
              ibkrDisabledReason={ibkrDisabledReason}
            />
          )}
          {(activeFilter === "all" || activeFilter === "stock") && (
            <TradeList
              items={prebreakout}
              title={t("tradeNow.prebreakoutTitle")}
              meta={prebreakoutUpdatedAtLabel}
              empty={t("tradeNow.prebreakoutEmpty")}
              aiAdvice={aiAdvice}
              aiLoading={aiLoading}
              adviceEnabled={adviceEnabled}
              onAskAi={requestAdvice}
              onCopyPrompt={copyPrompt}
              onShowChart={(item) => {
                setChartAsset(item)
                setChartOpen(true)
              }}
              onShowBreakdown={(item) => {
                setBreakdownAsset(item)
                setBreakdownOpen(true)
              }}
              onApplyAiSuggestion={applyAiSuggestion}
              actionsDisabled={replayActive}
              actionsDisabledReason={replayActionDisabledReason}
              prices={prices}
              livePrices={livePrices}
              brokerAccountKey={brokerAccountKey}
              brokerAccount={brokerAccount}
              requestedByUid={user?.uid ?? null}
              ibkrDisabledReason={ibkrDisabledReason}
            />
          )}
        </div>
      )}

      <AssetChartModal
        open={chartOpen}
        onOpenChange={setChartOpen}
        asset={chartAsset}
      />
      <ScoreBreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        asset={breakdownAsset}
      />
    </div>
  )
}
