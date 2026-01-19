import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, type DocumentData } from "firebase/firestore"

import { db, firebaseEnabled } from "@/lib/firebase"

export type ReplayConsumer = {
  serviceName: string
  effectiveMode?: string
  sessionId?: string
  seenControlsVersion?: number
  activeRunId?: string
  datasetId?: string
  phase?: string
  lastHeartbeat?: unknown
  updatedAt?: unknown
}

function normalizeConsumer(doc: DocumentData): ReplayConsumer | null {
  if (!doc) return null
  const name = typeof doc.serviceName === "string" ? doc.serviceName : null
  if (!name) return null
  return {
    serviceName: name,
    effectiveMode: typeof doc.effectiveMode === "string" ? doc.effectiveMode : undefined,
    sessionId: typeof doc.sessionId === "string" ? doc.sessionId : undefined,
    seenControlsVersion:
      typeof doc.seenControlsVersion === "number" ? doc.seenControlsVersion : undefined,
    activeRunId: typeof doc.activeRunId === "string" ? doc.activeRunId : undefined,
    datasetId: typeof doc.datasetId === "string" ? doc.datasetId : undefined,
    phase: typeof doc.phase === "string" ? doc.phase : undefined,
    lastHeartbeat: doc.lastHeartbeat,
    updatedAt: doc.updatedAt,
  }
}

export function useReplayConsumers() {
  const [consumers, setConsumers] = useState<ReplayConsumer[]>([])
  const [loading, setLoading] = useState<boolean>(() => Boolean(firebaseEnabled && db))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !db) return
    const ref = collection(db, "replay", "controls", "consumers")
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const next: ReplayConsumer[] = []
        snapshot.forEach((doc) => {
          const consumer = normalizeConsumer(doc.data())
          if (consumer) next.push(consumer)
        })
        setConsumers(next)
        setLoading(false)
      },
      (err) => {
        setError(err?.message ? String(err.message) : "Replay consumers failed")
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  const consumerMap = useMemo(() => {
    const map = new Map<string, ReplayConsumer>()
    consumers.forEach((consumer) => map.set(consumer.serviceName, consumer))
    return map
  }, [consumers])

  return { consumers, consumerMap, loading, error }
}
