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

export type ReplayRun = {
  runId: string
  label?: string
  datasetId?: string
  tapeDate?: string
  symbolCount?: number
  manifestPath?: string
  notes?: string
  tags?: string[]
  createdAt?: unknown
  updatedAt?: unknown
}

function normalizeReplayRun(id: string, data?: DocumentData | null): ReplayRun | null {
  if (!id || !data) return null
  return {
    runId: id,
    label: typeof data.label === "string" ? data.label : undefined,
    datasetId: typeof data.datasetId === "string" ? data.datasetId : undefined,
    tapeDate: typeof data.tapeDate === "string" ? data.tapeDate : undefined,
    symbolCount: typeof data.symbolCount === "number" ? data.symbolCount : undefined,
    manifestPath: typeof data.manifestPath === "string" ? data.manifestPath : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    tags: Array.isArray(data.tags) ? data.tags : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
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
