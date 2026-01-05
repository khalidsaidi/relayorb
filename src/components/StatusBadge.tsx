import { Badge } from "@/components/ui/badge"
import type { BotStatus } from "@/lib/types"

const statusStyles: Record<string, string> = {
  online: "bg-emerald-500/15 text-emerald-800",
  offline: "bg-slate-500/10 text-slate-700",
  error: "bg-rose-500/15 text-rose-700",
  starting: "bg-amber-500/15 text-amber-700",
  stopping: "bg-amber-500/15 text-amber-700",
  idle: "bg-sky-500/15 text-sky-700",
  unknown: "bg-slate-500/10 text-slate-600",
}

export function StatusBadge({ status }: { status?: BotStatus }) {
  const key = status ?? "unknown"
  const label = status ?? "unknown"

  return (
    <Badge variant="outline" className={statusStyles[key] || statusStyles.unknown}>
      {label}
    </Badge>
  )
}
