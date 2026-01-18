import { Clock } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { BotSignalDoc } from "@/lib/types"
import { useTranslation } from "react-i18next"

type SignalMarketIndicatorProps = {
  signal: BotSignalDoc
}

export function SignalMarketIndicator({ signal }: SignalMarketIndicatorProps) {
  const { t } = useTranslation()
  const assetClass = signal.evaluation?.assetClass
  const marketOpenAtSignal = signal.evaluation?.horizons?.["1h"]?.marketOpenAtSignal

  // Only show indicator for stocks and forex (crypto is always open)
  if (assetClass === "crypto") {
    return null
  }

  // Only show if we have evaluation data and market was closed
  if (marketOpenAtSignal === undefined || marketOpenAtSignal === true) {
    return null
  }

  const assetLabel = assetClass === "stock" ? t("market.asset.stock") : t("market.asset.forex")

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5">
            <Clock className="h-3 w-3 text-amber-700" />
            <span className="text-xs text-amber-700">{t("market.status.closed")}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {t("signals.closedMarketNotice", { asset: assetLabel.toLowerCase() })}
            <br />
            {t("signals.closedMarketAdjusted")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
