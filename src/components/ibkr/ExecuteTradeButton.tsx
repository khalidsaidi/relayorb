import { useState } from "react"
import { Timestamp, doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BrokerAccountDoc, BrokerAccountKey, TradeProposalDoc, MarketHotTrade } from "@/lib/types"
import { buildTradeProposalId } from "@/lib/broker-accounts"
import { ExecuteTradeDialog } from "@/components/ibkr/ExecuteTradeDialog"

interface ExecuteTradeButtonProps {
  trade: MarketHotTrade
  brokerAccountKey: BrokerAccountKey | null
  brokerAccount: BrokerAccountDoc | null
  requestedByUid: string
  disabledReason?: string
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}

export function ExecuteTradeButton({
  trade,
  brokerAccountKey,
  brokerAccount,
  requestedByUid,
  disabledReason,
  className,
  size = "sm",
  variant = "outline",
}: ExecuteTradeButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [proposal, setProposal] = useState<TradeProposalDoc | null>(null)
  const [loading, setLoading] = useState(false)

  const disabled = Boolean(disabledReason)

  async function handleOpen() {
    if (!brokerAccountKey) {
      toast.error(t("ibkr.errors.noAccount"))
      return
    }
    if (!firebaseEnabled || !db) {
      toast.error(t("ibkr.errors.firebase"))
      return
    }
    if (disabledReason) {
      toast.error(disabledReason)
      return
    }
    setLoading(true)
    try {
      const proposalId = buildTradeProposalId(
        brokerAccountKey,
        trade.assetClass,
        trade.symbol
      )
      const proposalRef = doc(db, "tradeProposals", proposalId)
      const snap = await getDoc(proposalRef)
      if (!snap.exists()) {
        toast.error(t("ibkr.errors.proposalMissing"))
        return
      }
      const docData = snap.data() as TradeProposalDoc
      const expiresAtMs =
        docData.expiresAt instanceof Timestamp ? docData.expiresAt.toMillis() : 0
      if (expiresAtMs > 0 && expiresAtMs <= Date.now()) {
        toast.error(t("ibkr.errors.proposalExpired"))
        return
      }
      setProposal(docData)
      setOpen(true)
    } catch (err) {
      console.error(err)
      toast.error(t("ibkr.errors.proposalFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        disabled={disabled || loading}
        title={disabledReason}
      >
        {t("ibkr.execute")}
      </Button>
      {proposal && brokerAccountKey ? (
        <ExecuteTradeDialog
          open={open}
          onOpenChange={setOpen}
          proposal={proposal}
          brokerAccountKey={brokerAccountKey}
          brokerAccount={brokerAccount}
          requestedByUid={requestedByUid}
        />
      ) : null}
    </>
  )
}
