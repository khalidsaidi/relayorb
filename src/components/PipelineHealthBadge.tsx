import { Activity, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getStatusLabel, getStatusBgColor, formatAge, type PipelineHealthStatus } from "@/features/ops/use-pipeline-health"
import { usePipelineHealthContext } from "@/features/ops/pipeline-health-context"
import { useTranslation } from "react-i18next"

function StatusIcon({ status }: { status: PipelineHealthStatus["status"] }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    case "degraded":
      return <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
    case "stale":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-rose-600" />
    default:
      return <Activity className="h-3.5 w-3.5 text-slate-500" />
  }
}

type PipelineHealthBadgeProps = {
  showLabel?: boolean
  size?: "sm" | "md"
}

export function PipelineHealthBadge({ showLabel = false, size = "sm" }: PipelineHealthBadgeProps) {
  const { health, loading, error, documentExists } = usePipelineHealthContext()
  const { t } = useTranslation()
  const statusLabels = {
    ok: t("pipeline.status.ok"),
    degraded: t("pipeline.status.degraded"),
    stale: t("pipeline.status.stale"),
    error: t("pipeline.status.error"),
    unknown: t("pipeline.status.unknown"),
  }
  const ageLabels = {
    never: t("common.never"),
    justNow: t("common.justNow"),
    secondsAgo: t("common.secondsAgo"),
    minutesAgo: t("common.minutesAgo"),
    hoursAgo: t("common.hoursAgo"),
  }

  if (loading) {
    return (
      <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
        <Activity className="h-3 w-3 animate-pulse" />
        {showLabel && <span className="ml-1.5">{t("common.loading")}</span>}
      </Badge>
    )
  }

  // Show clear error when pipeline/status doesn't exist
  const needsDeployment = !documentExists && error?.includes("redeployment")

  const tooltipContent = needsDeployment ? (
    <div className="space-y-2 text-xs max-w-[250px]">
      <div className="font-medium text-amber-600">{t("pipeline.healthNotDeployed")}</div>
      <div className="text-muted-foreground">{t("pipeline.healthNotDeployedBody")}</div>
      <div className="pt-1 border-t border-border/50 text-muted-foreground">
        {t("pipeline.healthNotDeployedAction")}
      </div>
    </div>
  ) : (
    <div className="space-y-2 text-xs">
      <div className="font-medium">{getStatusLabel(health.status, statusLabels)}</div>
      <div className="space-y-1 text-muted-foreground">
        {Object.entries(health.services).map(([name, service]) => {
          const serviceLabel = t(`pipeline.service.${name}`)
          const statusLabel = statusLabels[service.status] ?? service.status
          return (
            <div key={name} className="flex items-center justify-between gap-4">
              <span className="capitalize">{serviceLabel}</span>
              <span className={getStatusBgColor(service.status).split(" ")[1]}>
                {statusLabel}{" "}
                {service.ageMs !== null && `(${formatAge(service.ageMs, ageLabels)})`}
              </span>
            </div>
          )
        })}
      </div>
      {health.updatedAt && (
        <div className="pt-1 border-t border-border/50 text-muted-foreground">
          {t("pipeline.lastUpdate", { time: health.updatedAt.toLocaleTimeString() })}
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
            className={`cursor-default ${getStatusBgColor(health.status)} ${
              size === "sm" ? "px-2 py-0.5" : "px-3 py-1"
            }`}
          >
            <StatusIcon status={health.status} />
            {showLabel && (
              <span className="ml-1.5">
                {health.status === "ok" ? t("pipeline.healthy") : getStatusLabel(health.status, statusLabels)}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
