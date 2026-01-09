import { Clock } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { BotSignalDoc } from "@/lib/types"

type SignalMarketIndicatorProps = {
  signal: BotSignalDoc
}

export function SignalMarketIndicator({ signal }: SignalMarketIndicatorProps) {
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

  const assetLabel = assetClass === "stock" ? "Stock" : "Forex"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5">
            <Clock className="h-3 w-3 text-amber-700" />
            <span className="text-xs text-amber-700">Closed</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Signal created when {assetLabel.toLowerCase()} market was closed
            <br />
            Evaluation adjusted to next market open
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
