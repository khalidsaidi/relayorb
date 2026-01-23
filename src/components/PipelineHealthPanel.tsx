import { useState } from "react"
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Server,
  XCircle,
  Zap,
  Database,
  Bot,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  usePipelineHealth,
  getStatusLabel,
  getStatusBgColor,
  formatAge,
  type ServiceHealth,
  type PipelineHealthStatus,
} from "@/features/ops/use-pipeline-health"
import { useTranslation } from "react-i18next"

function StatusIcon({ status, size = "md" }: { status: PipelineHealthStatus["status"]; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4"
  
  switch (status) {
    case "ok":
      return <CheckCircle2 className={`${sizeClass} text-emerald-600`} />
    case "degraded":
      return <AlertCircle className={`${sizeClass} text-amber-600`} />
    case "stale":
      return <Clock className={`${sizeClass} text-amber-500`} />
    case "error":
      return <XCircle className={`${sizeClass} text-rose-600`} />
    default:
      return <Activity className={`${sizeClass} text-slate-500`} />
  }
}

function ServiceIcon({ name }: { name: string }) {
  switch (name) {
    case "market_intel":
      return <Zap className="h-4 w-4 text-violet-500" />
    case "price_streamer":
      return <Database className="h-4 w-4 text-blue-500" />
    case "relayorb_agent":
      return <Bot className="h-4 w-4 text-amber-500" />
    case "backtrader":
      return <Server className="h-4 w-4 text-emerald-600" />
    default:
      return <Server className="h-4 w-4 text-slate-500" />
  }
}

function ServiceCard({ name, health }: { name: string; health: ServiceHealth }) {
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
  const displayName = t(`pipeline.service.${name}`)
  const statusLabel = statusLabels[health.status] ?? health.status

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3">
      <div className="mt-0.5">
        <ServiceIcon name={name} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{displayName}</span>
          <Badge
            variant="outline"
            className={`text-xs ${getStatusBgColor(health.status)}`}
          >
            <StatusIcon status={health.status} size="sm" />
            <span className="ml-1 capitalize">{statusLabel}</span>
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {health.lastSeen ? (
            <>{t("pipeline.lastSeen", { age: formatAge(health.ageMs, ageLabels) })}</>
          ) : (
            <>{t("pipeline.noHeartbeat")}</>
          )}
        </div>
        {health.isStale && health.status !== "unknown" && (
          <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {t("pipeline.status.stale")}
          </div>
        )}
      </div>
    </div>
  )
}

type PipelineHealthPanelProps = {
  defaultExpanded?: boolean
  showTitle?: boolean
}

export function PipelineHealthPanel({ defaultExpanded = true, showTitle = true }: PipelineHealthPanelProps) {
  const { health, loading, error, documentExists } = usePipelineHealth()
  const [isOpen, setIsOpen] = useState(defaultExpanded)
  const { t } = useTranslation()
  const statusLabels = {
    ok: t("pipeline.status.ok"),
    degraded: t("pipeline.status.degraded"),
    stale: t("pipeline.status.stale"),
    error: t("pipeline.status.error"),
    unknown: t("pipeline.status.unknown"),
  }

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse" />
              {t("pipeline.title")}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            {t("pipeline.loading")}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show deployment required message when document doesn't exist
  if (!documentExists) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {t("pipeline.deploymentRequiredTitle")}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            <div className="text-amber-700 text-sm">
              {t("pipeline.deploymentRequiredBody")}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>{t("pipeline.deploymentRequiredListTitle")}</div>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>
                  <code className="text-xs bg-muted px-1 rounded">deploy/market-intel</code>{" "}
                  {t("pipeline.deploymentTargetJob")}
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 rounded">deploy/price-streamer</code>{" "}
                  {t("pipeline.deploymentTargetService")}
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 rounded">agent</code>{" "}
                  {t("pipeline.deploymentTargetVm")}
                </li>
              </ul>
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t border-amber-500/20">
              {t("pipeline.deploymentDocsPrefix")}{" "}
              <code className="bg-muted px-1 rounded">deploy/market-intel/README.md</code>{" "}
              {t("pipeline.deploymentDocsSuffix")}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && documentExists) {
    return (
      <Card>
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              {t("pipeline.title")}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-rose-600 text-sm">{error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <StatusIcon status={health.status} size="md" />
              {showTitle ? t("pipeline.title") : getStatusLabel(health.status, statusLabels)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={getStatusBgColor(health.status)}
              >
                {getStatusLabel(health.status, statusLabels)}
              </Badge>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={isOpen ? t("common.collapse") : t("common.expand")}
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          {!isOpen && (
            <div className="text-xs text-muted-foreground mt-1">
              {t("pipeline.summaryCollapsed", {
                healthy: health.summary.ok,
                issues: health.summary.degraded + health.summary.stale + health.summary.error,
              })}
            </div>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-md bg-emerald-500/10 p-2">
                  <div className="font-semibold text-emerald-700">{health.summary.ok}</div>
                  <div className="text-muted-foreground">{t("pipeline.status.ok")}</div>
                </div>
                <div className="rounded-md bg-amber-500/10 p-2">
                  <div className="font-semibold text-amber-700">{health.summary.degraded}</div>
                  <div className="text-muted-foreground">{t("pipeline.status.degraded")}</div>
                </div>
                <div className="rounded-md bg-amber-500/10 p-2">
                  <div className="font-semibold text-amber-600">{health.summary.stale}</div>
                  <div className="text-muted-foreground">{t("pipeline.status.stale")}</div>
                </div>
                <div className="rounded-md bg-rose-500/10 p-2">
                  <div className="font-semibold text-rose-700">{health.summary.error}</div>
                  <div className="text-muted-foreground">{t("pipeline.status.error")}</div>
                </div>
              </div>

              {/* Service Cards */}
              <div className="space-y-2">
                <ServiceCard name="market_intel" health={health.services.market_intel} />
                <ServiceCard name="price_streamer" health={health.services.price_streamer} />
                <ServiceCard name="relayorb_agent" health={health.services.relayorb_agent} />
                <ServiceCard name="backtrader" health={health.services.backtrader} />
              </div>

              {/* Last Update */}
              {health.updatedAt && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  {t("pipeline.lastAggregated", { time: health.updatedAt.toLocaleString() })}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
