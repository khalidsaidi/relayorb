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
    default:
      return <Server className="h-4 w-4 text-slate-500" />
  }
}

function ServiceCard({ name, health }: { name: string; health: ServiceHealth }) {
  const displayName = name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

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
            <span className="ml-1 capitalize">{health.status}</span>
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {health.lastSeen ? (
            <>Last seen: {formatAge(health.ageMs)}</>
          ) : (
            <>No heartbeat received</>
          )}
        </div>
        {health.isStale && health.status !== "unknown" && (
          <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Data may be stale
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

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse" />
              Pipeline Health
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            Loading health status...
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
              Pipeline Health - Deployment Required
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            <div className="text-amber-700 text-sm">
              Health monitoring code has been added but services need redeployment.
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>The following services need to be rebuilt and deployed:</div>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><code className="text-xs bg-muted px-1 rounded">deploy/market-intel</code> → Cloud Run Job</li>
                <li><code className="text-xs bg-muted px-1 rounded">deploy/price-streamer</code> → Cloud Run Service</li>
                <li><code className="text-xs bg-muted px-1 rounded">agent</code> → GCP VM (docker compose)</li>
              </ul>
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t border-amber-500/20">
              See <code className="bg-muted px-1 rounded">deploy/market-intel/README.md</code> for deployment commands.
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
              Pipeline Health
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
              {showTitle ? "Pipeline Health" : getStatusLabel(health.status)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={getStatusBgColor(health.status)}
              >
                {getStatusLabel(health.status)}
              </Badge>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={isOpen ? "Collapse" : "Expand"}>
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
              {health.summary.ok} healthy, {health.summary.degraded + health.summary.stale + health.summary.error} issues
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
                  <div className="text-muted-foreground">Healthy</div>
                </div>
                <div className="rounded-md bg-amber-500/10 p-2">
                  <div className="font-semibold text-amber-700">{health.summary.degraded}</div>
                  <div className="text-muted-foreground">Degraded</div>
                </div>
                <div className="rounded-md bg-amber-500/10 p-2">
                  <div className="font-semibold text-amber-600">{health.summary.stale}</div>
                  <div className="text-muted-foreground">Stale</div>
                </div>
                <div className="rounded-md bg-rose-500/10 p-2">
                  <div className="font-semibold text-rose-700">{health.summary.error}</div>
                  <div className="text-muted-foreground">Error</div>
                </div>
              </div>

              {/* Service Cards */}
              <div className="space-y-2">
                <ServiceCard name="market_intel" health={health.services.market_intel} />
                <ServiceCard name="price_streamer" health={health.services.price_streamer} />
                <ServiceCard name="relayorb_agent" health={health.services.relayorb_agent} />
              </div>

              {/* Last Update */}
              {health.updatedAt && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Last aggregated: {health.updatedAt.toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
