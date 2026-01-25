import { useEffect, useState } from "react"
import { doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { onSnapshotWithRetry } from "@/lib/firestore-retry"

export type ServiceHealth = {
  status: "ok" | "degraded" | "stale" | "error" | "unknown"
  isStale: boolean
  lastSeen: string | null
  ageMs: number | null
  details?: Record<string, unknown>
}

export type PipelineHealthStatus = {
  status: "ok" | "degraded" | "stale" | "error" | "unknown"
  updatedAt: Date | null
  services: {
    market_intel: ServiceHealth
    price_streamer: ServiceHealth
    relayorb_agent: ServiceHealth
    backtrader: ServiceHealth
  }
  summary: {
    ok: number
    degraded: number
    stale: number
    error: number
  }
  thresholds?: {
    priceStaleMs: number
    signalStaleMs: number
    pipelineStaleMs: number
  }
}

const DEFAULT_HEALTH: PipelineHealthStatus = {
  status: "unknown",
  updatedAt: null,
  services: {
    market_intel: { status: "unknown", isStale: true, lastSeen: null, ageMs: null },
    price_streamer: { status: "unknown", isStale: true, lastSeen: null, ageMs: null },
    relayorb_agent: { status: "unknown", isStale: true, lastSeen: null, ageMs: null },
    backtrader: { status: "unknown", isStale: true, lastSeen: null, ageMs: null },
  },
  summary: { ok: 0, degraded: 0, stale: 0, error: 0 },
}

export function usePipelineHealth() {
  const hasDb = Boolean(db)
  const [health, setHealth] = useState<PipelineHealthStatus>(DEFAULT_HEALTH)
  const [loading, setLoading] = useState(hasDb)
  const [error, setError] = useState<string | null>(
    hasDb ? null : "Firebase not available"
  )
  const [documentExists, setDocumentExists] = useState(false)

  useEffect(() => {
    if (!db) return

    const unsub = onSnapshotWithRetry(
      doc(db, "pipeline", "status"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          const updatedAt = data.updatedAt?.toDate?.() || null

          setHealth({
            status: data.status || "unknown",
            updatedAt,
            services: {
              market_intel: parseServiceHealth(data.services?.market_intel),
              price_streamer: parseServiceHealth(data.services?.price_streamer),
              relayorb_agent: parseServiceHealth(data.services?.relayorb_agent),
              backtrader: parseServiceHealth(data.services?.backtrader),
            },
            summary: data.summary || { ok: 0, degraded: 0, stale: 0, error: 0 },
            thresholds: data.thresholds,
          })
          setDocumentExists(true)
          setError(null)
        } else {
          // Document doesn't exist - services need to be redeployed with health monitoring
          setHealth(DEFAULT_HEALTH)
          setDocumentExists(false)
          setError("Pipeline health not configured - services need redeployment")
        }
        setLoading(false)
      },
      (err) => {
        console.error("Pipeline health subscription failed after retries:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [])

  return { health, loading, error, documentExists }
}

function parseServiceHealth(data: unknown): ServiceHealth {
  if (!data || typeof data !== "object") {
    return { status: "unknown", isStale: true, lastSeen: null, ageMs: null }
  }
  const d = data as Record<string, unknown>
  return {
    status: (d.status as ServiceHealth["status"]) || "unknown",
    isStale: Boolean(d.isStale),
    lastSeen: typeof d.lastSeen === "string" ? d.lastSeen : null,
    ageMs: typeof d.ageMs === "number" ? d.ageMs : null,
    details: typeof d.details === "object" ? (d.details as Record<string, unknown>) : undefined,
  }
}

/**
 * Get a human-readable label for the pipeline status
 */
export function getStatusLabel(
  status: PipelineHealthStatus["status"],
  labels?: Partial<Record<PipelineHealthStatus["status"], string>>
): string {
  switch (status) {
    case "ok":
      return labels?.ok ?? "All Systems Operational"
    case "degraded":
      return labels?.degraded ?? "Degraded Performance"
    case "stale":
      return labels?.stale ?? "Data May Be Stale"
    case "error":
      return labels?.error ?? "Service Error"
    default:
      return labels?.unknown ?? "Status Unknown"
  }
}

/**
 * Get the appropriate color class for a status
 */
export function getStatusColor(status: PipelineHealthStatus["status"]): string {
  switch (status) {
    case "ok":
      return "text-emerald-600"
    case "degraded":
      return "text-amber-600"
    case "stale":
      return "text-amber-500"
    case "error":
      return "text-rose-600"
    default:
      return "text-slate-500"
  }
}

/**
 * Get the background color class for a status badge
 */
export function getStatusBgColor(status: PipelineHealthStatus["status"]): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    case "degraded":
      return "bg-amber-500/15 text-amber-700 border-amber-500/30"
    case "stale":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20"
    case "error":
      return "bg-rose-500/15 text-rose-700 border-rose-500/30"
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-500/20"
  }
}

/**
 * Format age in human-readable form
 */
export function formatAge(
  ageMs: number | null,
  labels: {
    never: string
    justNow: string
    secondsAgo: string
    minutesAgo: string
    hoursAgo: string
  } = {
    never: "never",
    justNow: "just now",
    secondsAgo: "s ago",
    minutesAgo: "m ago",
    hoursAgo: "h ago",
  }
): string {
  if (ageMs === null) return labels.never
  if (ageMs < 1000) return labels.justNow
  if (ageMs < 60000) return `${Math.round(ageMs / 1000)}${labels.secondsAgo}`
  if (ageMs < 3600000) return `${Math.round(ageMs / 60000)}${labels.minutesAgo}`
  return `${Math.round(ageMs / 3600000)}${labels.hoursAgo}`
}
