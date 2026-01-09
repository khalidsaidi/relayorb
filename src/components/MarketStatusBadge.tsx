import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getMarketStatus } from "@/lib/marketHours"
import type { MarketStatus } from "@/lib/types"

type AssetClass = "crypto" | "stock" | "forex"

type MarketStatusBadgeProps = {
  assetClass: AssetClass
  showCountdown?: boolean
}

const assetLabels: Record<AssetClass, string> = {
  crypto: "Crypto",
  stock: "Stocks",
  forex: "Forex",
}

export function MarketStatusBadge({ assetClass, showCountdown = true }: MarketStatusBadgeProps) {
  const [status, setStatus] = useState<MarketStatus | null>(null)

  useEffect(() => {
    // Initial status
    setStatus(getMarketStatus(assetClass))

    // Update every second for countdown
    const interval = setInterval(() => {
      setStatus(getMarketStatus(assetClass))
    }, 1000)

    return () => clearInterval(interval)
  }, [assetClass])

  if (!status) return null

  const badgeClass = status.isOpen
    ? "bg-emerald-500/15 text-emerald-800"
    : "bg-slate-500/10 text-slate-700"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {assetLabels[assetClass]}
              </span>
              <Badge variant="outline" className={badgeClass}>
                {status.isOpen ? "OPEN" : "CLOSED"}
              </Badge>
            </div>
            {showCountdown && status.assetClass !== "crypto" && (
              <span className="text-xs text-muted-foreground">
                {status.nextChangeLabel} {status.countdown}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{status.hoursText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
