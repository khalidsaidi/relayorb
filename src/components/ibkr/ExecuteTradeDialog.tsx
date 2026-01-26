import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { db, firebaseEnabled } from "@/lib/firebase"
import type {
  BrokerAccountDoc,
  BrokerAccountKey,
  BrokerOrderDoc,
  ExecutionMode,
  ExecutionRequestDoc,
  OrderSnapshot,
  TradeProposalDoc,
} from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { formatAssetPrice, formatTimestamp } from "@/lib/format"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { buildAssetKey } from "@/lib/broker-accounts"
import { storeLastExecutionRequest } from "@/lib/ibkr-last-execution"
import { useTranslation } from "react-i18next"

const REQUEST_TTL_MS = 2 * 60 * 1000
const TERMINAL_STATUSES = new Set(["error", "rejected", "expired", "cancelled"])
const AUTO_CLOSE_STATUSES = new Set(["claimed", "submitted", "working", "filled", "partial"])

function parseNumberInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Normalize common non-ASCII digit sets before parsing.
  let cleaned = trimmed.normalize("NFKC")
  cleaned = cleaned.replace(/[\u0660-\u0669]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x0660)
  )
  cleaned = cleaned.replace(/[\u06f0-\u06f9]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x06f0)
  )
  cleaned = cleaned.replace(/[\s_'\u2019]/g, "")
  const hasComma = cleaned.includes(",")
  const hasDot = cleaned.includes(".")

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",")
    const lastDot = cleaned.lastIndexOf(".")
    const decimalSeparator = lastComma > lastDot ? "," : "."
    const groupingSeparator = decimalSeparator === "," ? "." : ","
    cleaned = cleaned.replace(new RegExp(`\\${groupingSeparator}`, "g"), "")
    cleaned = cleaned.replace(decimalSeparator, ".")
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, "")
    } else {
      cleaned = cleaned.replace(/,/g, ".")
    }
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, "")
    }
  }

  if (!/^[+-]?\d*(\.\d*)?$/.test(cleaned)) return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function buildOrderSnapshotFromProposal(proposal: TradeProposalDoc): OrderSnapshot {
  if (proposal.orderDraft) return proposal.orderDraft
  const assetKey = proposal.assetKey || buildAssetKey(proposal.assetClass, proposal.symbol)
  return {
    symbol: proposal.symbol,
    assetClass: proposal.assetClass,
    assetKey,
    exchange: proposal.exchange,
    primaryExchange: proposal.primaryExchange,
    side: proposal.side,
    quantity: proposal.quantity,
    orderType: "limit",
    limitPrice: proposal.price,
    stopLoss: proposal.stopLoss,
    takeProfit: proposal.takeProfit,
    timeInForce: "DAY",
  }
}

type ExecuteTradeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposal: TradeProposalDoc
  brokerAccountKey: BrokerAccountKey
  brokerAccount: BrokerAccountDoc | null
  requestedByUid: string
}

export function ExecuteTradeDialog({
  open,
  onOpenChange,
  proposal,
  brokerAccountKey,
  brokerAccount,
  requestedByUid,
}: ExecuteTradeDialogProps) {
  const { t } = useTranslation()
  const { replayActive } = useReplayControls()
  const [mode, setMode] = useState<ExecutionMode>("paper")
  const [confirmLiveOpen, setConfirmLiveOpen] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [requestDoc, setRequestDoc] = useState<ExecutionRequestDoc | null>(null)
  const [brokerOrder, setBrokerOrder] = useState<BrokerOrderDoc | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [terminalHandled, setTerminalHandled] = useState(false)
  const [successHandled, setSuccessHandled] = useState(false)
  const [statusToastDismissed, setStatusToastDismissed] = useState(false)
  const [statusSnapshot, setStatusSnapshot] = useState<OrderSnapshot | null>(null)
  const [statusTrail, setStatusTrail] = useState<string[]>([])

  const [draft, setDraft] = useState<OrderSnapshot>(() => buildOrderSnapshotFromProposal(proposal))
  const [draftInputs, setDraftInputs] = useState(() => {
    const next = buildOrderSnapshotFromProposal(proposal)
    return {
      limitPrice: typeof next.limitPrice === "number" ? String(next.limitPrice) : "",
      quantity: typeof next.quantity === "number" ? String(next.quantity) : "",
      stopLoss: typeof next.stopLoss === "number" ? String(next.stopLoss) : "",
      takeProfit: typeof next.takeProfit === "number" ? String(next.takeProfit) : "",
    }
  })

  useEffect(() => {
    if (open) {
      const next = buildOrderSnapshotFromProposal(proposal)
      setDraft(next)
      setDraftInputs({
        limitPrice: typeof next.limitPrice === "number" ? String(next.limitPrice) : "",
        quantity: typeof next.quantity === "number" ? String(next.quantity) : "",
        stopLoss: typeof next.stopLoss === "number" ? String(next.stopLoss) : "",
        takeProfit: typeof next.takeProfit === "number" ? String(next.takeProfit) : "",
      })
    }
  }, [open, proposal])

  useEffect(() => {
    if (!open && confirmLiveOpen) {
      setConfirmLiveOpen(false)
    }
  }, [open, confirmLiveOpen])

  function requestModeChange(nextMode: ExecutionMode) {
    if (nextMode === mode) return
    if (nextMode === "live") {
      setConfirmLiveOpen(true)
      return
    }
    setMode(nextMode)
  }

  function confirmLiveMode() {
    setMode("live")
    setConfirmLiveOpen(false)
  }

  function cancelLiveMode() {
    setConfirmLiveOpen(false)
  }

  const paperEnabled = brokerAccount?.enabled && brokerAccount?.paperEnabled
  const liveEnabled = brokerAccount?.enabled && brokerAccount?.liveEnabled

  useEffect(() => {
    if (open) {
      setRequestId(null)
      setRequestDoc(null)
      setBrokerOrder(null)
      setSubmitting(false)
      setTerminalHandled(false)
      setSuccessHandled(false)
      setStatusToastDismissed(false)
      setStatusSnapshot(null)
      setStatusTrail([])
      setMode("paper")
    }
  }, [open])

  useEffect(() => {
    if (!firebaseEnabled || !db || !requestId) return
    const requestRef = doc(db, "executionRequests", requestId)
    const orderRef = doc(db, "brokerOrders", requestId)
    const unsubRequest = onSnapshot(requestRef, (snap) => {
      setRequestDoc(snap.exists() ? (snap.data() as ExecutionRequestDoc) : null)
    })
    const unsubOrder = onSnapshot(orderRef, (snap) => {
      setBrokerOrder(snap.exists() ? (snap.data() as BrokerOrderDoc) : null)
    })
    return () => {
      unsubRequest()
      unsubOrder()
    }
  }, [requestId])

  useEffect(() => {
    if (!open || terminalHandled) return
    if (!requestDoc && !brokerOrder) return

    const status = requestDoc?.status
    const lastError = brokerOrder?.lastError
    const isTerminal = status ? TERMINAL_STATUSES.has(status) : false

    if (lastError || (status && isTerminal)) {
      setTerminalHandled(true)
      onOpenChange(false)
    }
  }, [open, terminalHandled, requestDoc, brokerOrder, onOpenChange, t])

  useEffect(() => {
    if (!open || successHandled) return
    const status = requestDoc?.status
    if (!status || !AUTO_CLOSE_STATUSES.has(status)) return

    setSuccessHandled(true)
    onOpenChange(false)
  }, [open, successHandled, requestDoc, onOpenChange, t])

  useEffect(() => {
    const status = requestDoc?.status
    if (!status) return
    setStatusTrail((prev) => (prev.includes(status) ? prev : [...prev, status]))
  }, [requestDoc?.status])

  const expiresAtMs =
    proposal.expiresAt instanceof Timestamp ? proposal.expiresAt.toMillis() : 0
  const expired = expiresAtMs > 0 && expiresAtMs <= Date.now()
  const parsedInputs = useMemo(
    () => ({
      quantity: parseNumberInput(draftInputs.quantity),
      limitPrice: parseNumberInput(draftInputs.limitPrice),
      stopLoss: parseNumberInput(draftInputs.stopLoss),
      takeProfit: parseNumberInput(draftInputs.takeProfit),
    }),
    [
      draftInputs.quantity,
      draftInputs.limitPrice,
      draftInputs.stopLoss,
      draftInputs.takeProfit,
    ]
  )
  const resolvedInputs = useMemo(
    () => ({
      quantity: parsedInputs.quantity ?? proposal.quantity,
      limitPrice: parsedInputs.limitPrice ?? proposal.price,
      stopLoss: parsedInputs.stopLoss ?? proposal.stopLoss,
      takeProfit: parsedInputs.takeProfit ?? proposal.takeProfit,
    }),
    [
      parsedInputs.quantity,
      parsedInputs.limitPrice,
      parsedInputs.stopLoss,
      parsedInputs.takeProfit,
      proposal.quantity,
      proposal.price,
      proposal.stopLoss,
      proposal.takeProfit,
    ]
  )
  const quantityInvalid =
    (draftInputs.quantity.trim() && parsedInputs.quantity === null) ||
    resolvedInputs.quantity <= 0
  const limitPriceInvalid =
    draft.orderType === "limit" &&
    ((draftInputs.limitPrice.trim() && parsedInputs.limitPrice === null) ||
      resolvedInputs.limitPrice <= 0)
  const stopLossInvalid =
    draftInputs.stopLoss.trim() &&
    (parsedInputs.stopLoss === null || parsedInputs.stopLoss <= 0)
  const takeProfitInvalid =
    draftInputs.takeProfit.trim() &&
    (parsedInputs.takeProfit === null || parsedInputs.takeProfit <= 0)
  const stopLossTakeProfitRelationInvalid =
    !stopLossInvalid &&
    !takeProfitInvalid &&
    draftInputs.stopLoss.trim() &&
    draftInputs.takeProfit.trim() &&
    ((proposal.side === "buy" &&
      (resolvedInputs.stopLoss ?? 0) >= (resolvedInputs.takeProfit ?? 0)) ||
      (proposal.side === "sell" &&
        (resolvedInputs.stopLoss ?? 0) <= (resolvedInputs.takeProfit ?? 0)))
  const hasInvalidInputs =
    quantityInvalid ||
    limitPriceInvalid ||
    stopLossInvalid ||
    takeProfitInvalid ||
    stopLossTakeProfitRelationInvalid
  const requestPending = Boolean(requestId) && !requestDoc
  const formLocked = Boolean(requestId) || submitting
  const lastUpdate =
    brokerOrder?.lastUpdateAt ?? requestDoc?.updatedAt ?? requestDoc?.createdAt

  useEffect(() => {
    if (!requestId) return
    if (statusToastDismissed) return

    const status = requestDoc?.status
    const statusLabel = status ? t(`ibkr.status.${status}`) : t("ibkr.status.pending")
    const brokerStatusLabel = brokerOrder?.ibStatus
      ? brokerOrder.ibStatus
      : brokerOrder?.status
        ? t(`ibkr.status.${brokerOrder.status}`)
        : t("common.na")
    const snapshot =
      requestDoc?.orderSnapshot ??
      statusSnapshot ?? {
        ...draft,
        quantity: resolvedInputs.quantity,
        limitPrice: resolvedInputs.limitPrice,
        stopLoss: resolvedInputs.stopLoss,
        takeProfit: resolvedInputs.takeProfit,
      }
    const sideLabel = snapshot.side ? t(`trade.side.${snapshot.side}`) : t("common.na")
    const orderSummary = `${snapshot.symbol ?? proposal.symbol} · ${sideLabel} · ${
      snapshot.quantity ?? t("common.na")
    }`
    const limitLabel = formatAssetPrice(snapshot.limitPrice, proposal.assetClass)
    const stopLossLabel = formatAssetPrice(snapshot.stopLoss, proposal.assetClass)
    const takeProfitLabel = formatAssetPrice(snapshot.takeProfit, proposal.assetClass)
    const statusTrailLabel = statusTrail.length
      ? statusTrail.map((item) => t(`ibkr.status.${item}`)).join(" -> ")
      : t("common.na")
    const errorText = brokerOrder?.lastError || requestDoc?.statusReason
    const isError = Boolean(errorText) || (status ? TERMINAL_STATUSES.has(status) : false)
    const isSuccess = status === "filled"
    const modeLabel = t(`ibkr.mode.${requestDoc?.mode ?? mode}`)

    const description = (
      <div className="space-y-1 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("ibkr.requestIdLabel")}</span>
          <span className="font-mono">{requestId}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("ibkr.requestAccountLabel")}</span>
          <span>
            {brokerAccountKey.toUpperCase()} · {modeLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("ibkr.labels.status")}</span>
          <span>{statusLabel}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("ibkr.requestBrokerStatusLabel")}</span>
          <span>{brokerStatusLabel}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("ibkr.requestOrderLabel")}</span>
          <span>{orderSummary}</span>
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
          <span>{formatTimestamp(lastUpdate)}</span>
        </div>
        {errorText ? (
          <div className="text-rose-600">
            {t("ibkr.requestErrorLabel")}: {errorText}
          </div>
        ) : null}
      </div>
    )

    const toastFn = isError ? toast.error : isSuccess ? toast.success : toast.info
    toastFn(t("ibkr.requestDetailsTitle"), {
      id: requestId,
      description,
      duration: Infinity,
      closeButton: true,
      onDismiss: () => setStatusToastDismissed(true),
    })
  }, [
    requestId,
    requestDoc,
    brokerOrder,
    statusSnapshot,
    statusTrail,
    statusToastDismissed,
    resolvedInputs,
    draft,
    proposal,
    brokerAccountKey,
    mode,
    lastUpdate,
    t,
  ])

  async function handleConfirm() {
    if (!firebaseEnabled || !db) {
      toast.error(t("ibkr.errors.firebase"))
      return
    }
    if (replayActive) {
      toast.error(t("replay.actionsDisabled"))
      return
    }
    if (expired) {
      toast.error(t("ibkr.errors.proposalExpired"))
      return
    }
    if (mode === "paper" && !paperEnabled) {
      toast.error(t("ibkr.errors.paperDisabled"))
      return
    }
    if (mode === "live" && !liveEnabled) {
      toast.error(t("ibkr.errors.liveDisabled"))
      return
    }

    setSubmitting(true)
    try {
      if (quantityInvalid) {
        toast.error(t("ibkr.errors.invalidQuantity"))
        return
      }
      if (limitPriceInvalid) {
        toast.error(t("ibkr.errors.invalidLimitPrice"))
        return
      }
      if (stopLossInvalid) {
        toast.error(t("ibkr.errors.invalidStopLoss"))
        return
      }
      if (takeProfitInvalid) {
        toast.error(t("ibkr.errors.invalidTakeProfit"))
        return
      }
      if (stopLossTakeProfitRelationInvalid) {
        toast.error(t("ibkr.errors.stopLossTakeProfitRelation"))
        return
      }

      const id = crypto.randomUUID()
      const now = Date.now()
      const expiresAt = Timestamp.fromMillis(now + REQUEST_TTL_MS)
      const requestRef = doc(db, "executionRequests", id)
      const sanitizedSnapshot: OrderSnapshot = {
        ...draft,
        quantity: resolvedInputs.quantity,
        limitPrice: resolvedInputs.limitPrice,
        stopLoss: resolvedInputs.stopLoss,
        takeProfit: resolvedInputs.takeProfit,
      }

      const payload: ExecutionRequestDoc = {
        id,
        brokerAccountKey,
        proposalId: proposal.id,
        requestedByUid,
        approvedByUid: requestedByUid,
        ibAccountCodeSnapshot: brokerAccount?.ibAccountCode || undefined,
        approvedAt: serverTimestamp(),
        mode,
        status: "approved",
        orderSnapshot: sanitizedSnapshot,
        expiresAt,
        source: "manual",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await setDoc(requestRef, payload)
      storeLastExecutionRequest({
        id,
        brokerAccountKey,
        createdAt: now,
        mode,
        orderSnapshot: sanitizedSnapshot,
      })
      setStatusSnapshot(sanitizedSnapshot)
      setStatusTrail(["approved"])
      setRequestId(id)
    } catch (err) {
      console.error(err)
      toast.error(t("ibkr.errors.requestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = requestDoc?.status ? t(`ibkr.status.${requestDoc.status}`) : null

  const updateDraftInput = (field: keyof typeof draftInputs, value: string) => {
    setDraftInputs((prev) => ({
      ...prev,
      [field]: value,
    }))
  }
  const draftLimitPrice = parsedInputs.limitPrice ?? proposal.price

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ibkr.dialog.title", { symbol: proposal.symbol })}</DialogTitle>
          <DialogDescription>
            {t("ibkr.dialog.subtitle", { account: brokerAccountKey })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{proposal.assetClass.toUpperCase()}</Badge>
            <Badge variant={proposal.side === "buy" ? "secondary" : "destructive"}>
              {t(`trade.side.${proposal.side}`)}
            </Badge>
            {proposal.profile ? (
              <Badge variant="outline" className="text-[10px]">
                {proposal.profile}
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("ibkr.labels.limitPrice")}</span>
                <Input
                  value={draftInputs.limitPrice}
                  onChange={(event) => updateDraftInput("limitPrice", event.target.value)}
                  inputMode="decimal"
                  disabled={formLocked}
                  aria-invalid={limitPriceInvalid || undefined}
                  aria-describedby={
                    limitPriceInvalid ? "execute-trade-limit-price-error" : undefined
                  }
                />
                {limitPriceInvalid ? (
                  <div
                    id="execute-trade-limit-price-error"
                    className="text-xs text-destructive"
                  >
                    {t("ibkr.errors.invalidLimitPrice")}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    {formatAssetPrice(draftLimitPrice, proposal.assetClass)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("ibkr.labels.quantity")}</span>
                <Input
                  value={draftInputs.quantity}
                  onChange={(event) => updateDraftInput("quantity", event.target.value)}
                  inputMode="decimal"
                  disabled={formLocked}
                  aria-invalid={quantityInvalid || undefined}
                  aria-describedby={
                    quantityInvalid ? "execute-trade-quantity-error" : undefined
                  }
                />
                {quantityInvalid ? (
                  <div id="execute-trade-quantity-error" className="text-xs text-destructive">
                    {t("ibkr.errors.invalidQuantity")}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("ibkr.labels.stopLoss")}</span>
                <Input
                  value={draftInputs.stopLoss}
                  onChange={(event) => updateDraftInput("stopLoss", event.target.value)}
                  inputMode="decimal"
                  disabled={formLocked}
                  aria-invalid={stopLossInvalid || stopLossTakeProfitRelationInvalid || undefined}
                  aria-describedby={
                    stopLossInvalid || stopLossTakeProfitRelationInvalid
                      ? "execute-trade-stop-loss-error"
                      : undefined
                  }
                />
                {stopLossInvalid || stopLossTakeProfitRelationInvalid ? (
                  <div id="execute-trade-stop-loss-error" className="text-xs text-destructive">
                    {t(
                      stopLossInvalid
                        ? "ibkr.errors.invalidStopLoss"
                        : "ibkr.errors.stopLossTakeProfitRelation"
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("ibkr.labels.takeProfit")}</span>
                <Input
                  value={draftInputs.takeProfit}
                  onChange={(event) => updateDraftInput("takeProfit", event.target.value)}
                  inputMode="decimal"
                  disabled={formLocked}
                  aria-invalid={takeProfitInvalid || stopLossTakeProfitRelationInvalid || undefined}
                  aria-describedby={
                    takeProfitInvalid || stopLossTakeProfitRelationInvalid
                      ? "execute-trade-take-profit-error"
                      : undefined
                  }
                />
                {takeProfitInvalid || stopLossTakeProfitRelationInvalid ? (
                  <div id="execute-trade-take-profit-error" className="text-xs text-destructive">
                    {t(
                      takeProfitInvalid
                        ? "ibkr.errors.invalidTakeProfit"
                        : "ibkr.errors.stopLossTakeProfitRelation"
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("ibkr.labels.mode")}</div>
            <Tabs value={mode} onValueChange={(value) => requestModeChange(value as ExecutionMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paper" disabled={!paperEnabled}>
                  {t("ibkr.mode.paper")}
                </TabsTrigger>
                <TabsTrigger value="live" disabled={!liveEnabled}>
                  {t("ibkr.mode.live")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "live" ? (
              <div className="rounded-md border border-rose-200/60 bg-rose-500/10 p-2 text-xs text-rose-700">
                <div className="font-semibold">{t("ibkr.mode.liveCautionTitle")}</div>
                <div className="mt-1">{t("ibkr.mode.liveCautionBody")}</div>
              </div>
            ) : null}
          </div>

          {requestDoc ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("ibkr.labels.status")}</span>
                <span className="font-semibold">{statusLabel}</span>
              </div>
              {requestDoc.statusReason ? (
                <div className="mt-2 text-rose-600">{requestDoc.statusReason}</div>
              ) : null}
              {brokerOrder?.lastError ? (
                <div className="mt-2 text-rose-600">{brokerOrder.lastError}</div>
              ) : null}
            </div>
          ) : requestPending ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              {t("ibkr.requestPending")}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {requestId ? t("common.close") : t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={formLocked || replayActive || expired || hasInvalidInputs || (!paperEnabled && !liveEnabled)}
          >
            {submitting ? t("common.loading") : t("ibkr.confirm")}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmLiveOpen} onOpenChange={(next) => (!next ? cancelLiveMode() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ibkr.mode.liveConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("ibkr.mode.liveConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelLiveMode}>
              {t("ibkr.mode.liveCancel")}
            </Button>
            <Button variant="destructive" onClick={confirmLiveMode}>
              {t("ibkr.mode.liveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
