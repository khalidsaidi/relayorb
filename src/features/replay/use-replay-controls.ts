import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot, type DocumentData } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"

export type ReplayControls = {
  desiredMode?: "live" | "replay"
  phase?: string
  activeRunId?: string
  datasetId?: string
  sessionId?: string
  version?: number
  asOf?: unknown
}

function normalizeControls(data?: DocumentData | null): ReplayControls | null {
  if (!data) return null
  return {
    desiredMode: data.desiredMode,
    phase: data.phase,
    activeRunId: data.activeRunId,
    datasetId: data.datasetId,
    sessionId: data.sessionId,
    version: typeof data.version === "number" ? data.version : undefined,
    asOf: data.asOf,
  }
}

export function useReplayControls() {
  const [controls, setControls] = useState<ReplayControls | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(firebaseEnabled && db))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }
    const ref = doc(db, "replay", "controls")
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setControls(normalizeControls(snapshot.data() || null))
        setLoading(false)
      },
      (err) => {
        setError(err?.message ? String(err.message) : "Replay controls failed")
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  const replayActive = useMemo(
    () => controls?.desiredMode === "replay",
    [controls?.desiredMode]
  )

  return { controls, loading, error, replayActive }
}
