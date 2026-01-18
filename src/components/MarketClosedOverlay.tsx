import { Clock, Moon, Sun } from "lucide-react"
import {
  useMarketStatus,
  formatTimeUntil,
} from "@/features/market/use-market-status"
import { useTranslation } from "react-i18next"

type MarketClosedOverlayProps = {
  assetClass?: "stock" | "forex"
  children: React.ReactNode
  className?: string
}

/**
 * Overlay that grays out content when market is closed
 * and shows an informative message about market status.
 * 
 * Note: Crypto is always open, so this component is not needed for crypto.
 */
export function MarketClosedOverlay({
  assetClass = "stock",
  children,
  className = "",
}: MarketClosedOverlayProps) {
  const marketStatus = useMarketStatus()
  const status = marketStatus[assetClass]
  const { t } = useTranslation()
  const assetLabel = t(`market.asset.${assetClass}`)
  const timeLabels = {
    now: t("common.now"),
    hourShort: t("common.hourShort"),
    minuteShort: t("common.minuteShort"),
  }
  
  // If market is open, just render children normally
  if (status.isOpen) {
    return <div className={className}>{children}</div>
  }
  
  const StatusIcon = status.status === "after" ? Moon : status.status === "pre" ? Sun : Clock

  return (
    <div className={`relative ${className}`}>
      {/* Grayed out content */}
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>
      
      {/* Overlay message */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
        <div className="text-center p-4 rounded-lg bg-card/90 border shadow-sm max-w-xs">
          <StatusIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium text-foreground">
            {assetLabel} {t("market.market")} {status.label}
          </div>
          {status.timeUntilChange && (
            <div className="text-sm text-muted-foreground mt-1">
              {status.status === "pre" && t("market.regularOpensIn")}
              {status.status === "after" && t("market.afterHoursEndsIn")}
              {status.status === "closed" && t("market.opensIn")}
              {formatTimeUntil(status.timeUntilChange, timeLabels)}
            </div>
          )}
          {(status.status === "pre" || status.status === "after") && (
            <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
              {t("market.extendedHoursNote")}
            </div>
          )}
          {status.status === "closed" && (
            <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
              {t("market.lastAvailablePrices")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A simple banner that shows when the market is closed
 * without overlaying any content
 */
export function MarketStatusBanner({
  assetClass = "stock",
}: {
  assetClass?: "stock" | "forex"
}) {
  const marketStatus = useMarketStatus()
  const status = marketStatus[assetClass]
  const { t } = useTranslation()
  const assetLabel = t(`market.asset.${assetClass}`)
  const timeLabels = {
    now: t("common.now"),
    hourShort: t("common.hourShort"),
    minuteShort: t("common.minuteShort"),
  }
  
  // Don't show anything if market is open
  if (status.isOpen) {
    return null
  }
  
  const bgColor = status.status === "pre" || status.status === "after"
    ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
    : "bg-slate-500/10 border-slate-500/20 text-slate-600"

  const StatusIcon = status.status === "after" ? Moon : status.status === "pre" ? Sun : Clock

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${bgColor}`}>
      <StatusIcon className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-medium">
          {assetLabel} {t("market.market")} {status.label}
        </span>
        {status.timeUntilChange && (
          <span className="text-muted-foreground ml-2">
            ({formatTimeUntil(status.timeUntilChange, timeLabels)})
          </span>
        )}
        {(status.status === "pre" || status.status === "after") && (
          <span className="text-muted-foreground ml-2">
            · {t("market.extendedHoursDataShown")}
          </span>
        )}
      </div>
    </div>
  )
}
