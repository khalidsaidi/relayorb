import { useEffect, useState } from "react"
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatAssetPrice, formatCurrency, formatTimestamp } from "@/lib/format"
import {
  getLastExecutionStorageKey,
  LAST_EXECUTION_EVENT,
  loadLastExecutionRequest,
  storeLastExecutionRequest,
  type LastExecutionRequest,
} from "@/lib/ibkr-last-execution"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAuth } from "@/features/auth/auth-context"

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
  const { user } = useAuth()
  const [summary, setSummary] = useState<BrokerAccountSummaryDoc | null>(null)
  const [positionCount, setPositionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [lastExecution, setLastExecution] = useState<LastExecutionRequest | null>(null)
  const [lastRequestDoc, setLastRequestDoc] = useState<ExecutionRequestDoc | null>(null)
  const [lastBrokerOrder, setLastBrokerOrder] = useState<BrokerOrderDoc | null>(null)
  const [statusTrail, setStatusTrail] = useState<string[]>([])
  const [statusOpen, setStatusOpen] = useState(false)
  const [stuckRequests, setStuckRequests] = useState<ExecutionRequestDoc[]>([])
  const [retryOpen, setRetryOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [mfaPromptOpen, setMfaPromptOpen] = useState(false)
  const [mfaPromptDismissedAt, setMfaPromptDismissedAt] = useState<number | null>(null)
  const { t } = useTranslation()
  const executor = useIbkrExecutor(brokerAccountKey)

  const STUCK_ORDER_WINDOW_MS = 3 * 60 * 1000

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
  const liveEnabled = Boolean(brokerAccount?.enabled && brokerAccount?.liveEnabled)

  const hasSummary = Boolean(summary?.values?.netLiquidation || summary?.values?.totalCash)
  const displayBalance = hasSummary ? formatCurrency(summary?.values?.netLiquidation ?? 0) : "—"
  const shortTitle = hasSummary
    ? t("ibkr.sidebar.titleWithBalance", { balance: displayBalance })
    : t("ibkr.sidebar.title")
  const lastSnapshot = lastRequestDoc?.orderSnapshot ?? lastExecution?.orderSnapshot
  const lastStatus = lastRequestDoc?.status ?? lastBrokerOrder?.status
  const lastStatusLabel = lastRequestDoc?.status
    ? t(`ibkr.status.${lastRequestDoc.status}`)
    : lastBrokerOrder?.ibStatus
      ? lastBrokerOrder.ibStatus
      : lastStatus
        ? t(`ibkr.status.${lastStatus}`)
        : t("ibkr.status.pending")
  const lastBrokerStatusLabel = lastBrokerOrder?.ibStatus
    ? lastBrokerOrder.ibStatus
    : lastBrokerOrder?.status
      ? t(`ibkr.status.${lastBrokerOrder.status}`)
      : t("common.na")
  const lastSideLabel = lastSnapshot?.side ? t(`trade.side.${lastSnapshot.side}`) : t("common.na")
  const lastOrderSummary = lastSnapshot
    ? `${lastSnapshot.symbol ?? t("common.na")} · ${lastSideLabel} · ${
        lastSnapshot.quantity ?? t("common.na")
      }`
    : t("common.na")
  const lastMode = lastRequestDoc?.mode ?? lastExecution?.mode
  const liveModeActive = executor?.ibMode === "live" || lastMode === "live"
  const shouldPromptMfa =
    liveEnabled &&
    liveModeActive &&
    !executor?.ibConnected &&
    (isConnectionError || connectAttemptFresh)
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
    if (!db || !brokerAccountKey) {
      setStuckRequests([])
      return
    }

    const reqQuery = query(
      collection(db, "executionRequests"),
      where("brokerAccountKey", "==", brokerAccountKey),
      orderBy("createdAt", "desc"),
      limit(50)
    )

    const unsubRequests = onSnapshot(reqQuery, (snap) => {
      const now = Date.now()
      const docs = snap.docs.map((docSnap) => docSnap.data() as ExecutionRequestDoc)
      const filtered = docs.filter((request) => {
        if (request.mode !== "live") return false
        if (request.status !== "submitted" && request.status !== "working") return false
        const updatedAt = request.updatedAt || request.submittedAt || request.createdAt
        const updatedMs =
          updatedAt && typeof (updatedAt as { toMillis?: () => number }).toMillis === "function"
            ? (updatedAt as { toMillis: () => number }).toMillis()
            : 0
        return updatedMs && now - updatedMs > STUCK_ORDER_WINDOW_MS
      })
      setStuckRequests(filtered)
    })

    return () => {
      unsubRequests()
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

  useEffect(() => {
    if (!shouldPromptMfa) {
      setMfaPromptOpen(false)
      return
    }
    if (mfaPromptDismissedAt && Date.now() - mfaPromptDismissedAt < 5 * 60 * 1000) {
      return
    }
    setMfaPromptOpen(true)
  }, [shouldPromptMfa, mfaPromptDismissedAt])

  if (loading && !summary && !executor) return null

  async function retryStuckOrders() {
    const firestore = db
    if (!firestore || !brokerAccountKey || !user) return
    if (!stuckRequests.length) {
      toast.message(t("ibkr.retry.none"))
      setRetryOpen(false)
      return
    }
    try {
      setRetrying(true)
      const batch = writeBatch(firestore)
      const now = Date.now()
      const expiresAt = Timestamp.fromMillis(now + 2 * 60 * 1000)
      let lastCreatedId: string | null = null
      let lastCreatedMode: ExecutionRequestDoc["mode"] | null = null
      let lastCreatedSnapshot: ExecutionRequestDoc["orderSnapshot"] | null = null

      const sanitizeSnapshot = (snapshot: ExecutionRequestDoc["orderSnapshot"]) => ({
        symbol: snapshot.symbol,
        assetClass: snapshot.assetClass,
        assetKey: snapshot.assetKey,
        side: snapshot.side,
        quantity: snapshot.quantity,
        orderType: snapshot.orderType,
        ...(snapshot.timeInForce ? { timeInForce: snapshot.timeInForce } : {}),
        ...(snapshot.exchange ? { exchange: snapshot.exchange } : {}),
        ...(snapshot.primaryExchange ? { primaryExchange: snapshot.primaryExchange } : {}),
        ...(typeof snapshot.limitPrice === "number" ? { limitPrice: snapshot.limitPrice } : {}),
        ...(typeof snapshot.stopLoss === "number" ? { stopLoss: snapshot.stopLoss } : {}),
        ...(typeof snapshot.takeProfit === "number" ? { takeProfit: snapshot.takeProfit } : {}),
      })

      stuckRequests.forEach((request) => {
        const id = crypto.randomUUID()
        const orderSnapshot = sanitizeSnapshot(request.orderSnapshot)
        const payload: ExecutionRequestDoc = {
          id,
          brokerAccountKey,
          proposalId: `retry:${request.id}:${now}`,
          requestedByUid: user.uid,
          approvedByUid: user.uid,
          ...(brokerAccount?.ibAccountCode
            ? { ibAccountCodeSnapshot: brokerAccount.ibAccountCode }
            : {}),
          approvedAt: serverTimestamp(),
          mode: "live",
          status: "approved",
          orderSnapshot,
          expiresAt,
          note: "Retry: gateway MFA pending",
          meta: {
            retryOf: request.id,
            retryReason: "gateway_mfa",
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        batch.set(doc(firestore, "executionRequests", id), payload)
        lastCreatedId = payload.id
        lastCreatedMode = payload.mode
        lastCreatedSnapshot = payload.orderSnapshot
      })

      await batch.commit()
      if (lastCreatedId && lastCreatedMode && lastCreatedSnapshot) {
        storeLastExecutionRequest({
          id: lastCreatedId,
          brokerAccountKey,
          createdAt: now,
          mode: lastCreatedMode,
          orderSnapshot: lastCreatedSnapshot,
        })
      }
      toast.success(t("ibkr.retry.success", { count: stuckRequests.length }))
    } catch (err) {
      console.error(err)
      toast.error(t("ibkr.retry.failed"))
    } finally {
      setRetrying(false)
      setRetryOpen(false)
    }
  }

  async function cancelStuckOrders() {
    const firestore = db
    if (!firestore || !brokerAccountKey || !user) return
    if (!stuckRequests.length) {
      toast.message(t("ibkr.stuckCancel.none"))
      setCancelOpen(false)
      return
    }
    try {
      setCanceling(true)
      const batch = writeBatch(firestore)
      stuckRequests.forEach((request) => {
        const orderRef = doc(firestore, "brokerOrders", request.id)
        batch.set(
          orderRef,
          {
            cancelRequested: true,
            cancelRequestedAt: serverTimestamp(),
            cancelRequestedBy: user.uid || null,
            lastUpdateAt: serverTimestamp(),
          },
          { merge: true }
        )
        const requestRef = doc(firestore, "executionRequests", request.id)
        batch.set(
          requestRef,
          {
            statusReason: "cancel_requested",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      })
      await batch.commit()
      toast.success(t("ibkr.stuckCancel.success", { count: stuckRequests.length }))
    } catch (err) {
      console.error(err)
      toast.error(t("ibkr.stuckCancel.failed"))
    } finally {
      setCanceling(false)
      setCancelOpen(false)
    }
  }

  const mfaDialog = (
    <Dialog
      open={mfaPromptOpen}
      onOpenChange={(open) => {
        setMfaPromptOpen(open)
        if (!open) {
          setMfaPromptDismissedAt(Date.now())
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ibkr.mfa.title")}</DialogTitle>
          <DialogDescription className="space-y-2 text-sm text-muted-foreground">
            <p>{t("ibkr.mfa.body", { account: brokerAccountKey?.toUpperCase() ?? "—" })}</p>
            <p>{t("ibkr.mfa.bodyAlt")}</p>
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          {t("ibkr.mfa.statusWaiting")}
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={() => setMfaPromptOpen(false)}>
            {t("ibkr.mfa.dismiss")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const retryDialog = (
    <Dialog open={retryOpen} onOpenChange={setRetryOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ibkr.retry.title")}</DialogTitle>
          <DialogDescription>{t("ibkr.retry.body", { count: stuckRequests.length })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setRetryOpen(false)} disabled={retrying}>
            {t("ibkr.retry.cancel")}
          </Button>
          <Button onClick={retryStuckOrders} disabled={retrying}>
            {retrying ? t("common.loading") : t("ibkr.retry.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const cancelDialog = (
    <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ibkr.stuckCancel.title")}</DialogTitle>
          <DialogDescription>
            {t("ibkr.stuckCancel.body", { count: stuckRequests.length })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={canceling}>
            {t("ibkr.stuckCancel.cancel")}
          </Button>
          <Button variant="destructive" onClick={cancelStuckOrders} disabled={canceling}>
            {canceling ? t("common.loading") : t("ibkr.stuckCancel.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (collapsed) {
    return (
      <>
        {mfaDialog}
        {retryDialog}
        {cancelDialog}
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
      </>
    )
  }

  return (
    <>
      {mfaDialog}
      {retryDialog}
      {cancelDialog}
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
        <div className="text-xl font-semibold tracking-tight">{displayBalance}</div>
        <div className="flex items-center gap-2 text-sm">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald-600" />
          ) : (
            <TrendingDown className="h-3 w-3 text-rose-600" />
          )}
          <span
            className={[
              "text-sm font-medium",
              isPositive ? "text-emerald-600" : "text-rose-600",
            ].join(" ")}
          >
            {isPositive ? "+" : "-"}
            {formatCurrency(Math.abs(unrealizedPnl))}
          </span>
          <span className="text-xs text-muted-foreground/70">
            {t("ibkr.sidebar.unrealizedPnl")}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-tight text-muted-foreground/70">
            {t("ibkr.sidebar.openPositions")}
          </span>
          <span className="font-mono text-sm font-semibold">{positionCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-tight text-muted-foreground/70">
            {t("ibkr.sidebar.connection")}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-medium">
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
          <div className="text-xs text-muted-foreground/70">
            {t("ibkr.sidebar.lastHeartbeat", { seconds: heartbeatAgeSec })}
          </div>
        ) : null}
        {isConnectionError ? (
          <div className="text-xs text-rose-600/80">
            {t("ibkr.sidebar.connectionError", { error: connectError })}
          </div>
        ) : null}
        {stuckRequests.length ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800">
            {t("ibkr.retry.notice", { count: stuckRequests.length })}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 pt-1">
          <Button
            size="sm"
            variant={isConnected ? "outline" : "default"}
            disabled={updating || !brokerAccountKey}
            onClick={() => setConnectionEnabled(!isConnected)}
            className="h-8 w-full text-xs"
          >
            {isConnected ? t("ibkr.sidebar.disconnect") : t("ibkr.sidebar.connect")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={updating || !brokerAccountKey}
            onClick={requestOrdersRefresh}
            className="h-8 w-full text-xs"
          >
            {t("ibkr.sidebar.refreshOrders")}
          </Button>
        </div>
        {stuckRequests.length ? (
          <div className="grid grid-cols-1 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRetryOpen(true)}
              className="h-8 w-full text-xs"
              disabled={!user}
            >
              {t("ibkr.retry.action", { count: stuckRequests.length })}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              className="h-8 w-full text-xs"
              disabled={!user}
            >
              {t("ibkr.stuckCancel.action", { count: stuckRequests.length })}
            </Button>
          </div>
        ) : null}
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
    </>
  )
}
