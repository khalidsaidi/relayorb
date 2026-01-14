import { Activity, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  usePipelineHealth,
  getStatusLabel,
  getStatusBgColor,
  formatAge,
  type PipelineHealthStatus,
} from "@/features/ops/use-pipeline-health"

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
  const { health, loading, error, documentExists } = usePipelineHealth()

  if (loading) {
    return (
      <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
        <Activity className="h-3 w-3 animate-pulse" />
        {showLabel && <span className="ml-1.5">Loading...</span>}
      </Badge>
    )
  }

  // Show clear error when pipeline/status doesn't exist
  const needsDeployment = !documentExists && error?.includes("redeployment")

  const tooltipContent = needsDeployment ? (
    <div className="space-y-2 text-xs max-w-[250px]">
      <div className="font-medium text-amber-600">Health Monitoring Not Deployed</div>
      <div className="text-muted-foreground">
        The pipeline health monitoring code has been added locally but the services 
        (market-intel, price-streamer, agent) need to be redeployed to Cloud Run/GCP 
        to start writing health status.
      </div>
      <div className="pt-1 border-t border-border/50 text-muted-foreground">
        Run deployment commands from deploy/market-intel/README.md
      </div>
    </div>
  ) : (
    <div className="space-y-2 text-xs">
      <div className="font-medium">{getStatusLabel(health.status)}</div>
      <div className="space-y-1 text-muted-foreground">
        {Object.entries(health.services).map(([name, service]) => (
          <div key={name} className="flex items-center justify-between gap-4">
            <span className="capitalize">{name.replace(/_/g, " ")}</span>
            <span className={getStatusBgColor(service.status).split(" ")[1]}>
              {service.status} {service.ageMs !== null && `(${formatAge(service.ageMs)})`}
            </span>
          </div>
        ))}
      </div>
      {health.updatedAt && (
        <div className="pt-1 border-t border-border/50 text-muted-foreground">
          Last update: {health.updatedAt.toLocaleTimeString()}
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
                {health.status === "ok" ? "Healthy" : getStatusLabel(health.status)}
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
