import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot, type DocumentData } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import { getE2eReplayControlsOverride } from "@/lib/e2e-overrides"

export type ReplayControls = {
  desiredMode?: "live" | "replay"
  phase?: string
  activeRunId?: string
  datasetId?: string
  sessionId?: string
  version?: number
  asOf?: unknown
  requiredServices?: string[]
  botsReplayEnabled?: boolean
  speedScript?: Array<Record<string, unknown>>
}

let replayOverrideCache: ReplayControls | null = null
const replayOverrideListeners = new Set<(value: ReplayControls | null) => void>()

function setReplayOverrideCache(value: ReplayControls | null) {
  replayOverrideCache = value
  replayOverrideListeners.forEach((listener) => listener(value))
}

function normalizeControls(data?: DocumentData | null): ReplayControls | null {
  if (!data) return null
  const asOfValue =
    typeof data.asOf === "number"
      ? { toMillis: () => data.asOf as number }
      : typeof data.asOfMs === "number"
        ? { toMillis: () => data.asOfMs as number }
        : data.asOf
  return {
    desiredMode: data.desiredMode,
    phase: data.phase,
    activeRunId: data.activeRunId,
    datasetId: data.datasetId,
    sessionId: data.sessionId,
    version: typeof data.version === "number" ? data.version : undefined,
    asOf: asOfValue,
    requiredServices: Array.isArray(data.requiredServices) ? data.requiredServices : undefined,
    botsReplayEnabled: data.botsReplayEnabled === true,
    speedScript: Array.isArray(data.speedScript) ? data.speedScript : undefined,
  }
}

export function useReplayControls() {
  const [override, setOverride] = useState<ReplayControls | null>(() =>
    replayOverrideCache ??
      normalizeControls((getE2eReplayControlsOverride() || null) as DocumentData)
  )
  const [controls, setControls] = useState<ReplayControls | null>(() => override)
  const [loading, setLoading] = useState<boolean>(() =>
    Boolean(firebaseEnabled && db && !override)
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (override) {
      setControls(override)
      setLoading(false)
      return
    }
    if (!firebaseEnabled || !db) return
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
  }, [override])

  useEffect(() => {
    const onOverride = (value: ReplayControls | null) => {
      setOverride(value)
    }
    replayOverrideListeners.add(onOverride)
    const readOverride = () => {
      const next = normalizeControls(
        (getE2eReplayControlsOverride() || null) as DocumentData
      )
      setReplayOverrideCache(next)
    }
    readOverride()
    window.addEventListener("relayorb:e2e-replay-update", readOverride)
    const enableWindowSetter = import.meta.env.DEV || import.meta.env.VITE_E2E === "true"
    if (enableWindowSetter) {
      ;(window as Window & { __E2E_SET_REPLAY_CONTROLS__?: (value: unknown) => void })
        .__E2E_SET_REPLAY_CONTROLS__ = (value: unknown) => {
          setReplayOverrideCache(normalizeControls(value as DocumentData))
        }
    }
    return () => {
      window.removeEventListener("relayorb:e2e-replay-update", readOverride)
      replayOverrideListeners.delete(onOverride)
      if (enableWindowSetter) {
        delete (window as Window & { __E2E_SET_REPLAY_CONTROLS__?: unknown })
          .__E2E_SET_REPLAY_CONTROLS__
      }
    }
  }, [])

  const effectiveOverride = override
  const effectiveControls = effectiveOverride ?? controls
  const effectiveLoading = effectiveOverride ? false : loading
  const replayActive = useMemo(
    () => effectiveControls?.desiredMode === "replay",
    [effectiveControls?.desiredMode]
  )

  return { controls: effectiveControls, loading: effectiveLoading, error, replayActive }
}
