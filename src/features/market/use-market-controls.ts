import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { MarketControlsDoc } from "@/lib/types"

type MarketControlState = {
  controls: MarketControlsDoc | null
  loading: boolean
  cryptoEnabled: boolean
  forexEnabled: boolean
}

export function useMarketControls(): MarketControlState {
  const [controls, setControls] = useState<MarketControlsDoc | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(firebaseEnabled && db))

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoading(false)
      return
    }

    const ref = doc(db, "market", "controls")
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setControls(null)
          setLoading(false)
          return
        }
        setControls(snap.data() as MarketControlsDoc)
        setLoading(false)
      },
      () => {
        setControls(null)
        setLoading(false)
      }
    )
  }, [])

  const cryptoEnabled = controls?.cryptoEnabled !== false
  const forexEnabled = controls?.forexEnabled !== false

  return { controls, loading, cryptoEnabled, forexEnabled }
}
