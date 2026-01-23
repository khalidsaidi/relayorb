import { useEffect, useState } from "react"
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatAssetPrice, formatCurrency, formatTimestamp } from "@/lib/format"
import {
  getLastExecutionStorageKey,
  LAST_EXECUTION_EVENT,
  loadLastExecutionRequest,
  type LastExecutionRequest,
} from "@/lib/ibkr-last-execution"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wallet, TrendingUp, TrendingDown } from "lucide-react"
import type {
  BrokerAccountDoc,
  BrokerAccountKey,
  BrokerAccountSummaryDoc,
  BrokerOrderDoc,
  BrokerPositionDoc,
  ExecutionRequestDoc,
  TradingControlsDoc,
} from "@/lib/types"
import { useTranslation } from "react-i18next"
import { useIbkrExecutor } from "@/features/ibkr/use-ibkr-executor"
import { toast } from "sonner"

export function SidebarBrokerProfile({
  brokerAccountKey,
  brokerAccount,
  tradingControls,
  collapsed,
}: {
  brokerAccountKey: BrokerAccountKey | null
  brokerAccount?: BrokerAccountDoc | null
  tradingControls?: TradingControlsDoc | null
  collapsed?: boolean
}) {
  const [summary, setSummary] = useState<BrokerAccountSummaryDoc | null>(null)
  const [positionCount, setPositionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [lastExecution, setLastExecution] = useState<LastExecutionRequest | null>(null)
  const [lastRequestDoc, setLastRequestDoc] = useState<ExecutionRequestDoc | null>(null)
  const [lastBrokerOrder, setLastBrokerOrder] = useState<BrokerOrderDoc | null>(null)
  const [statusTrail, setStatusTrail] = useState<string[]>([])
  const [statusOpen, setStatusOpen] = useState(false)
  const { t } = useTranslation()
  const executor = useIbkrExecutor(brokerAccountKey)

  // Debug: log executor state
  useEffect(() => {
    if (executor) {
      const hb = executor.lastHeartbeat
      const hasToMillis = hb && typeof (hb as { toMillis?: () => number }).toMillis === "function"
      console.log("executor_debug", {
        ibConnected: executor.ibConnected,
        lastHeartbeat: hb,
        hasToMillis,
        heartbeatType: hb ? Object.prototype.toString.call(hb) : null,
      })
    }
  }, [executor])

  const netLiq = summary?.values?.netLiquidation ?? 0
  const unrealizedPnl = summary?.values?.unrealizedPnl ?? 0
  const pnlPercent = netLiq ? (unrealizedPnl / netLiq) * 100 : 0
  const isPositive = unrealizedPnl >= 0
  const heartbeatMs =
    executor?.lastHeartbeat &&
    typeof (executor.lastHeartbeat as { toMillis?: () => number }).toMillis === "function"
      ? (executor.lastHeartbeat as { toMillis: () => number }).toMillis()
      : 0
  const lastConnectAttemptMs =
    executor?.lastConnectAttemptAt &&
    typeof (executor.lastConnectAttemptAt as { toMillis?: () => number }).toMillis === "function"
      ? (executor.lastConnectAttemptAt as { toMillis: () => number }).toMillis()
      : 0
  const heartbeatAgeSec = heartbeatMs ? Math.max(0, Math.floor((Date.now() - heartbeatMs) / 1000)) : null
  const heartbeatFresh = heartbeatAgeSec !== null && heartbeatAgeSec < 90
  const isConnected = Boolean(executor?.ibConnected && heartbeatFresh)
  const wantsConnection = Boolean(brokerAccount?.enabled)
  const connectAttemptFresh = Boolean(lastConnectAttemptMs && Date.now() - lastConnectAttemptMs < 60_000)
  const connectError = executor?.lastConnectError ? String(executor.lastConnectError) : ""
  const isConnecting = wantsConnection && !isConnected && connectAttemptFresh && !connectError
  const isConnectionError = wantsConnection && !isConnected && Boolean(connectError)

  const hasSummary = Boolean(summary?.values?.netLiquidation || summary?.values?.totalCash)
  const displayBalance = hasSummary ? formatCurrency(summary?.values?.netLiquidation ?? 0) : "—"
  const shortTitle = hasSummary
    ? t("ibkr.sidebar.titleWithBalance", { balance: displayBalance })
    : t("ibkr.sidebar.title")
  const lastSnapshot = lastRequestDoc?.orderSnapshot ?? lastExecution?.orderSnapshot
  const lastStatus = lastRequestDoc?.status ?? lastBrokerOrder?.status
  const lastStatusLabel = lastStatus ? t(`ibkr.status.${lastStatus}`) : t("ibkr.status.pending")
  const lastBrokerStatusLabel = lastBrokerOrder?.status
    ? t(`ibkr.status.${lastBrokerOrder.status}`)
    : t("common.na")
  const lastSideLabel = lastSnapshot?.side ? t(`trade.side.${lastSnapshot.side}`) : t("common.na")
  const lastOrderSummary = lastSnapshot
    ? `${lastSnapshot.symbol ?? t("common.na")} · ${lastSideLabel} · ${
        lastSnapshot.quantity ?? t("common.na")
      }`
    : t("common.na")
  const lastMode = lastRequestDoc?.mode ?? lastExecution?.mode
  const lastModeLabel = lastMode ? t(`ibkr.mode.${lastMode}`) : t("common.na")
  const lastUpdate = lastBrokerOrder?.lastUpdateAt ?? lastRequestDoc?.updatedAt ?? lastRequestDoc?.createdAt
  const lastUpdateLabel = lastUpdate
    ? formatTimestamp(lastUpdate)
    : lastExecution
      ? new Date(lastExecution.createdAt).toLocaleString()
      : "—"
  const statusTrailLabel = statusTrail.length
    ? statusTrail.map((item) => t(`ibkr.status.${item}`)).join(" -> ")
    : t("common.na")
  const requestPending = Boolean(lastExecution?.id) && !lastRequestDoc && !lastBrokerOrder
  const errorText = lastBrokerOrder?.lastError || lastRequestDoc?.statusReason
  const limitLabel = formatAssetPrice(lastSnapshot?.limitPrice, lastSnapshot?.assetClass)
  const stopLossLabel = formatAssetPrice(lastSnapshot?.stopLoss, lastSnapshot?.assetClass)
  const takeProfitLabel = formatAssetPrice(lastSnapshot?.takeProfit, lastSnapshot?.assetClass)

  async function setConnectionEnabled(nextEnabled: boolean) {
    if (!db || !brokerAccountKey) return
    if (nextEnabled) {
      if (tradingControls?.ibkrEnabled === false) {
        toast.error(t("ibkr.errors.ibkrDisabled"))
        return
      }
      if (tradingControls?.killSwitch) {
        toast.error(t("ibkr.errors.killSwitchActive"))
        return
      }
    }
    try {
      setUpdating(true)
      const ref = doc(db, "brokerAccounts", brokerAccountKey)
      await updateDoc(ref, {
        enabled: nextEnabled,
        paperEnabled: true,
        updatedAt: serverTimestamp(),
      })
      toast.success(nextEnabled ? t("ibkr.sidebar.connecting") : t("ibkr.sidebar.disconnecting"))
    } catch {
      toast.error(t("ibkr.sidebar.updateFailed"))
    } finally {
      setUpdating(false)
    }
  }

  async function requestOrdersRefresh() {
    if (!db || !brokerAccountKey) return
    try {
      setUpdating(true)
      const ref = doc(db, "brokerAccounts", brokerAccountKey)
      await updateDoc(ref, {
        ordersRefreshRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success(t("ibkr.sidebar.refreshingOrders"))
    } catch {
      toast.error(t("ibkr.sidebar.updateFailed"))
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    if (!db || !brokerAccountKey) return

    const summaryRef = doc(db, "brokerAccountSummaries", brokerAccountKey)
    const unsubSummary = onSnapshot(summaryRef, (snap) => {
      setLoading(false)
      setSummary(snap.exists() ? ({ id: snap.id, ...snap.data() } as BrokerAccountSummaryDoc) : null)
    })

    const positionsQuery = query(
      collection(db, "brokerPositions"),
      where("brokerAccountKey", "==", brokerAccountKey)
    )
    const unsubPositions = onSnapshot(positionsQuery, (snap) => {
      const openPositions = snap.docs.filter((docSnap) => {
        const data = docSnap.data() as BrokerPositionDoc
        return data.isOpen !== false && data.position !== 0
      })
      setPositionCount(openPositions.length)
    })

    return () => {
      unsubSummary()
      unsubPositions()
    }
  }, [brokerAccountKey])

  useEffect(() => {
    if (!brokerAccountKey) {
      setLastExecution(null)
      setStatusOpen(false)
      return
    }
    setStatusOpen(false)
    setLastExecution(loadLastExecutionRequest(brokerAccountKey))
  }, [brokerAccountKey])

  useEffect(() => {
    if (!brokerAccountKey || typeof window === "undefined") return
    const storageKey = getLastExecutionStorageKey(brokerAccountKey)

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ brokerAccountKey?: string }>).detail
      if (detail?.brokerAccountKey && detail.brokerAccountKey !== brokerAccountKey) return
      setLastExecution(loadLastExecutionRequest(brokerAccountKey))
      setStatusOpen(true)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      setLastExecution(loadLastExecutionRequest(brokerAccountKey))
    }

    window.addEventListener(LAST_EXECUTION_EVENT, handleCustomEvent as EventListener)
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener(LAST_EXECUTION_EVENT, handleCustomEvent as EventListener)
      window.removeEventListener("storage", handleStorage)
    }
  }, [brokerAccountKey])

  useEffect(() => {
    if (!db || !lastExecution?.id) {
      setLastRequestDoc(null)
      setLastBrokerOrder(null)
      return
    }

    const requestRef = doc(db, "executionRequests", lastExecution.id)
    const orderRef = doc(db, "brokerOrders", lastExecution.id)
    const unsubRequest = onSnapshot(requestRef, (snap) => {
      setLastRequestDoc(snap.exists() ? (snap.data() as ExecutionRequestDoc) : null)
    })
    const unsubOrder = onSnapshot(orderRef, (snap) => {
      setLastBrokerOrder(snap.exists() ? (snap.data() as BrokerOrderDoc) : null)
    })
    return () => {
      unsubRequest()
      unsubOrder()
    }
  }, [lastExecution?.id])

  useEffect(() => {
    setStatusTrail([])
  }, [lastExecution?.id])

  useEffect(() => {
    const status = lastRequestDoc?.status ?? lastBrokerOrder?.status
    if (!status) return
    setStatusTrail((prev) => (prev.includes(status) ? prev : [...prev, status]))
  }, [lastRequestDoc?.status, lastBrokerOrder?.status])

  useEffect(() => {
    if (lastBrokerOrder?.lastError || lastRequestDoc?.statusReason) {
      setStatusOpen(true)
    }
  }, [lastBrokerOrder?.lastError, lastRequestDoc?.statusReason])

  if (loading && !summary && !executor) return null

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2" title={shortTitle}>
        <div className="rounded-full bg-blue-500/10 p-2 text-blue-600 shadow-sm ring-1 ring-blue-500/20">
          <Wallet className="h-4 w-4" />
        </div>
        <div
          className={[
            "mt-1 text-[10px] font-bold",
            isPositive ? "text-emerald-600" : "text-rose-600",
          ].join(" ")}
        >
          {isPositive ? "+" : ""}
          {Math.abs(pnlPercent).toFixed(1)}%
        </div>
      </div>
    )
  }

  return (
    <div className="mx-2 mt-4 rounded-2xl bg-muted/40 p-4 ring-1 ring-border/40 backdrop-blur-sm shadow-sm transition-all hover:bg-muted/60">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t("ibkr.sidebar.title")}
          </span>
        </div>
        <Badge
          variant="outline"
          className="h-5 px-1.5 text-[10px] bg-blue-500/5 text-blue-700 border-blue-500/20"
        >
          {t("ibkr.sidebar.liveBadge")}
        </Badge>
      </div>

      <div className="mb-3 space-y-1">
        <div className="text-lg font-bold tracking-tight">{displayBalance}</div>
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald-600" />
          ) : (
            <TrendingDown className="h-3 w-3 text-rose-600" />
          )}
          <span
            className={[
              "text-xs font-medium",
              isPositive ? "text-emerald-600" : "text-rose-600",
            ].join(" ")}
          >
            {isPositive ? "+" : "-"}
            {formatCurrency(Math.abs(unrealizedPnl))}
          </span>
          <span className="text-[10px] text-muted-foreground/60">{t("ibkr.sidebar.unrealizedPnl")}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground/70">
            {t("ibkr.sidebar.openPositions")}
          </span>
          <span className="font-mono text-xs font-bold">{positionCount}</span>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-tighter text-muted-foreground/70">
            {t("ibkr.sidebar.connection")}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-medium">
            <span
              className={[
                "h-2 w-2 rounded-full",
                isConnected
                  ? "bg-emerald-500"
                  : isConnecting
                    ? "bg-amber-500"
                    : "bg-rose-500",
              ].join(" ")}
            />
            <span
              className={
                isConnected
                  ? "text-emerald-600"
                  : isConnecting
                    ? "text-amber-600"
                    : "text-rose-600"
              }
            >
              {isConnected
                ? t("ibkr.sidebar.connected")
                : isConnecting
                  ? t("ibkr.sidebar.connecting")
                  : isConnectionError
                    ? t("ibkr.sidebar.connectionFailed")
                    : t("ibkr.sidebar.disconnected")}
            </span>
          </div>
        </div>
        {heartbeatAgeSec !== null ? (
          <div className="text-[10px] text-muted-foreground/60">
            {t("ibkr.sidebar.lastHeartbeat", { seconds: heartbeatAgeSec })}
          </div>
        ) : null}
        {isConnectionError ? (
          <div className="text-[10px] text-rose-600/80">
            {t("ibkr.sidebar.connectionError", { error: connectError })}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={isConnected ? "outline" : "default"}
            disabled={updating || !brokerAccountKey}
            onClick={() => setConnectionEnabled(!isConnected)}
            className="h-6 px-2 text-[10px]"
          >
            {isConnected ? t("ibkr.sidebar.disconnect") : t("ibkr.sidebar.connect")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={updating || !brokerAccountKey}
            onClick={requestOrdersRefresh}
            className="h-6 px-2 text-[10px]"
          >
            {t("ibkr.sidebar.refreshOrders")}
          </Button>
        </div>
      </div>

      <div className="mt-3 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground/70">
            {t("ibkr.portfolio.recentOrders")}
          </span>
          {lastExecution ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatusOpen((prev) => !prev)}
              className="h-6 px-2 text-[10px]"
            >
              {statusOpen ? t("ibkr.sidebar.hideStatus") : t("ibkr.sidebar.viewStatus")}
            </Button>
          ) : null}
        </div>
        {!lastExecution ? (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {t("ibkr.portfolio.noOrders")}
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{lastOrderSummary}</span>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {lastStatusLabel}
              </Badge>
            </div>
            {!statusOpen && errorText ? <div className="text-rose-600">{errorText}</div> : null}
            {!statusOpen && requestPending ? (
              <div className="text-[11px] text-muted-foreground">{t("ibkr.requestPending")}</div>
            ) : null}
            {statusOpen ? (
              <div className="space-y-1 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.requestIdLabel")}</span>
                  <span className="font-mono">{lastExecution?.id ?? t("common.na")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.requestAccountLabel")}</span>
                  <span>
                    {brokerAccountKey?.toUpperCase() ?? t("common.na")} · {lastModeLabel}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.labels.status")}</span>
                  <span>{lastStatusLabel}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.requestBrokerStatusLabel")}</span>
                  <span>{lastBrokerStatusLabel}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.requestOrderLabel")}</span>
                  <span>{lastOrderSummary}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.labels.limitPrice")}</span>
                  <span>{limitLabel}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.labels.stopLoss")}</span>
                  <span>{stopLossLabel}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.labels.takeProfit")}</span>
                  <span>{takeProfitLabel}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.requestProgressLabel")}</span>
                  <span>{statusTrailLabel}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("ibkr.requestUpdatedLabel")}</span>
                  <span>{lastUpdateLabel}</span>
                </div>
                {errorText ? (
                  <div className="text-rose-600">
                    {t("ibkr.requestErrorLabel")}: {errorText}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
