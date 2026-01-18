import { Clock, TrendingUp, Moon, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTranslation } from "react-i18next"
import {
  useMarketStatus,
  formatTimeUntil,
  getMarketStatusColor,
  type MarketSessionStatus,
} from "@/features/market/use-market-status"

function StatusIcon({ status }: { status: MarketSessionStatus }) {
  switch (status) {
    case "open":
      return <TrendingUp className="h-3.5 w-3.5" />
    case "pre":
      return <Sun className="h-3.5 w-3.5" />
    case "after":
      return <Moon className="h-3.5 w-3.5" />
    case "closed":
    default:
      return <Clock className="h-3.5 w-3.5" />
  }
}

type MarketStatusBadgeProps = {
  assetClass?: "stock" | "crypto" | "forex"
  showLabel?: boolean
  size?: "sm" | "md"
}

export function MarketStatusBadge({
  assetClass = "stock",
  showLabel = true,
  size = "sm",
}: MarketStatusBadgeProps) {
  const marketStatus = useMarketStatus()
  const status = marketStatus[assetClass]
  const colorClass = getMarketStatusColor(status.status)
  const { t } = useTranslation()
  const assetLabel = t(`market.asset.${assetClass}`)
  const timeLabels = {
    now: t("common.now"),
    hourShort: t("common.hourShort"),
    minuteShort: t("common.minuteShort"),
  }

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-medium capitalize">
        {assetLabel} {t("market.market")}
      </div>
      <div className="text-muted-foreground">{status.label}</div>
      {status.timeUntilChange && (
        <div className="text-muted-foreground">
          {status.status === "open" ? t("market.closesIn") : t("market.opensIn")}
          {formatTimeUntil(status.timeUntilChange, timeLabels)}
        </div>
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`cursor-default ${colorClass} ${
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1"
            }`}
          >
            <StatusIcon status={status.status} />
            {showLabel && <span className="ml-1.5">{status.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * A compact inline indicator for market status
 */
export function MarketStatusIndicator({
  assetClass = "stock",
}: {
  assetClass?: "stock" | "crypto" | "forex"
}) {
  const { t } = useTranslation()
  const marketStatus = useMarketStatus()
  const status = marketStatus[assetClass]
  const assetLabel = t(`market.asset.${assetClass}`)
  const timeLabels = {
    now: t("common.now"),
    hourShort: t("common.hourShort"),
    minuteShort: t("common.minuteShort"),
  }

  const dotColor =
    status.status === "open"
      ? "bg-emerald-500"
      : status.status === "pre" || status.status === "after"
        ? "bg-amber-500"
        : "bg-slate-400"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 cursor-default">
            <span
              className={`h-2 w-2 rounded-full ${dotColor} ${
                status.status === "open" ? "animate-pulse" : ""
              }`}
            />
            <span className="text-xs text-muted-foreground">{status.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span className="capitalize">{assetLabel}</span>: {status.label}
          {status.timeUntilChange && (
            <span className="text-muted-foreground">
              {" "}
              ({formatTimeUntil(status.timeUntilChange, timeLabels)})
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
