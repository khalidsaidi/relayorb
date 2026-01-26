import { useEffect, useMemo, useState } from "react"
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore"

import { db, firebaseEnabled } from "@/lib/firebase"

type SymbolSource = "auto" | "default" | "custom"

type AutoDiscoverConfig = {
  includeUniverse?: boolean
  smallCapMinMarketCap?: number
  smallCapMaxMarketCap?: number
  smallCapMinVolume?: number
  midCapMinMarketCap?: number
  midCapMaxMarketCap?: number
  midCapMinVolume?: number
}

export type ReplayRun = {
  runId: string
  label?: string
  datasetId?: string
  tapeDate?: string
  symbolCount?: number
  manifestPath?: string
  notes?: string
  tags?: string[]
  symbolSource?: SymbolSource
  autoDiscoverConfig?: AutoDiscoverConfig
  maxSymbols?: number
  createdAt?: unknown
  updatedAt?: unknown
}

function normalizeSymbolSource(value: unknown): SymbolSource | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === "auto" || normalized === "default" || normalized === "custom") {
    return normalized
  }
  return undefined
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeAutoDiscoverConfig(value: DocumentData | null | undefined): AutoDiscoverConfig | undefined {
  if (!value || typeof value !== "object") return undefined
  const config: AutoDiscoverConfig = {}
  if (typeof value.includeUniverse === "boolean") {
    config.includeUniverse = value.includeUniverse
  }
  const smallCapMinMarketCap = parseOptionalNumber(value.smallCapMinMarketCap)
  if (smallCapMinMarketCap !== undefined) config.smallCapMinMarketCap = smallCapMinMarketCap
  const smallCapMaxMarketCap = parseOptionalNumber(value.smallCapMaxMarketCap)
  if (smallCapMaxMarketCap !== undefined) config.smallCapMaxMarketCap = smallCapMaxMarketCap
  const smallCapMinVolume = parseOptionalNumber(value.smallCapMinVolume)
  if (smallCapMinVolume !== undefined) config.smallCapMinVolume = smallCapMinVolume
  const midCapMinMarketCap = parseOptionalNumber(value.midCapMinMarketCap)
  if (midCapMinMarketCap !== undefined) config.midCapMinMarketCap = midCapMinMarketCap
  const midCapMaxMarketCap = parseOptionalNumber(value.midCapMaxMarketCap)
  if (midCapMaxMarketCap !== undefined) config.midCapMaxMarketCap = midCapMaxMarketCap
  const midCapMinVolume = parseOptionalNumber(value.midCapMinVolume)
  if (midCapMinVolume !== undefined) config.midCapMinVolume = midCapMinVolume
  return Object.keys(config).length ? config : undefined
}

function normalizeReplayRun(id: string, data?: DocumentData | null): ReplayRun | null {
  if (!id || !data) return null
  const run: ReplayRun = {
    runId: id,
    label: typeof data.label === "string" ? data.label : undefined,
    datasetId: typeof data.datasetId === "string" ? data.datasetId : undefined,
    tapeDate: typeof data.tapeDate === "string" ? data.tapeDate : undefined,
    symbolCount: typeof data.symbolCount === "number" ? data.symbolCount : undefined,
    manifestPath: typeof data.manifestPath === "string" ? data.manifestPath : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    symbolSource: normalizeSymbolSource(data.symbolSource),
    autoDiscoverConfig: normalizeAutoDiscoverConfig(data.autoDiscoverConfig),
    maxSymbols: parseOptionalNumber(data.maxSymbols),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
  if (!run.datasetId || !run.symbolSource || typeof run.symbolCount !== "number") {
    return null
  }
  if (run.symbolSource === "auto") {
    if (!run.autoDiscoverConfig || typeof run.maxSymbols !== "number") {
      return null
    }
  }
  return run
}

export function useReplayRuns(maxCount = 50) {
  const [runs, setRuns] = useState<ReplayRun[]>([])
  const [loading, setLoading] = useState<boolean>(() => Boolean(firebaseEnabled && db))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !db) return
    const ref = query(
      collection(db, "replay", "controls", "runs"),
      orderBy("createdAt", "desc"),
      limit(Math.max(1, Math.min(maxCount, 200)))
    )
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const next: ReplayRun[] = []
        snapshot.forEach((doc) => {
          const run = normalizeReplayRun(doc.id, doc.data())
          if (run) next.push(run)
        })
        setRuns(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err?.message ? String(err.message) : "Replay runs failed")
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [maxCount])

  const runMap = useMemo(() => {
    const map = new Map<string, ReplayRun>()
    runs.forEach((run) => map.set(run.runId, run))
    return map
  }, [runs])

  return { runs, runMap, loading, error }
}
