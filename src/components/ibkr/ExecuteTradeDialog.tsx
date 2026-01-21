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
import { formatAssetPrice } from "@/lib/format"
import { getE2eDisableFirestoreWrites } from "@/lib/e2e-overrides"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { buildAssetKey } from "@/lib/broker-accounts"
import { useTranslation } from "react-i18next"

const REQUEST_TTL_MS = 2 * 60 * 1000

function buildOrderSnapshotFromProposal(proposal: TradeProposalDoc): OrderSnapshot {
  if (proposal.orderDraft) return proposal.orderDraft
  const assetKey = proposal.assetKey || buildAssetKey(proposal.assetClass, proposal.symbol)
  return {
    symbol: proposal.symbol,
    assetClass: proposal.assetClass,
    assetKey,
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
  const [requestId, setRequestId] = useState<string | null>(null)
  const [requestDoc, setRequestDoc] = useState<ExecutionRequestDoc | null>(null)
  const [brokerOrder, setBrokerOrder] = useState<BrokerOrderDoc | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const orderSnapshot = useMemo(() => buildOrderSnapshotFromProposal(proposal), [proposal])

  const paperEnabled = brokerAccount?.enabled && brokerAccount?.paperEnabled
  const liveEnabled = brokerAccount?.enabled && brokerAccount?.liveEnabled

  useEffect(() => {
    if (!open) {
      setRequestId(null)
      setRequestDoc(null)
      setBrokerOrder(null)
      setSubmitting(false)
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

  const expiresAtMs =
    proposal.expiresAt instanceof Timestamp ? proposal.expiresAt.toMillis() : 0
  const expired = expiresAtMs > 0 && expiresAtMs <= Date.now()

  async function handleConfirm() {
    if (!firebaseEnabled || !db) {
      toast.error(t("ibkr.errors.firebase"))
      return
    }
    if (getE2eDisableFirestoreWrites()) {
      toast.message(t("ibkr.errors.e2eDisabled"))
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
      const id = crypto.randomUUID()
      const now = Date.now()
      const expiresAt = Timestamp.fromMillis(now + REQUEST_TTL_MS)
      const requestRef = doc(db, "executionRequests", id)

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
        orderSnapshot,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await setDoc(requestRef, payload)
      setRequestId(id)
      toast.success(t("ibkr.requestCreated"))
    } catch (err) {
      console.error(err)
      toast.error(t("ibkr.errors.requestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = requestDoc?.status ? t(`ibkr.status.${requestDoc.status}`) : null

  return (
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

          <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ibkr.labels.limitPrice")}</span>
              <span className="font-medium">
                {formatAssetPrice(orderSnapshot.limitPrice ?? proposal.price, proposal.assetClass)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ibkr.labels.quantity")}</span>
              <span className="font-medium">{orderSnapshot.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ibkr.labels.stopLoss")}</span>
              <span className="font-medium">
                {orderSnapshot.stopLoss
                  ? formatAssetPrice(orderSnapshot.stopLoss, proposal.assetClass)
                  : t("common.na")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ibkr.labels.takeProfit")}</span>
              <span className="font-medium">
                {orderSnapshot.takeProfit
                  ? formatAssetPrice(orderSnapshot.takeProfit, proposal.assetClass)
                  : t("common.na")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("ibkr.labels.mode")}</div>
            <Tabs value={mode} onValueChange={(value) => setMode(value as ExecutionMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paper" disabled={!paperEnabled}>
                  {t("ibkr.mode.paper")}
                </TabsTrigger>
                <TabsTrigger value="live" disabled={!liveEnabled}>
                  {t("ibkr.mode.live")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {requestDoc ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("ibkr.labels.status")}</span>
                <span className="font-semibold">{statusLabel}</span>
              </div>
              {brokerOrder?.lastError ? (
                <div className="mt-2 text-rose-600">{brokerOrder.lastError}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || replayActive || expired || (!paperEnabled && !liveEnabled)}
          >
            {submitting ? t("common.loading") : t("ibkr.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
