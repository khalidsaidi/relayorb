import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BrokerAccountDoc, BrokerAccountKey, TradingControlsDoc } from "@/lib/types"
import { getBrokerAccountKeyForUid } from "@/lib/broker-accounts"

export function useIbkrAccount(uid?: string | null) {
  const brokerAccountKey = useMemo<BrokerAccountKey | null>(
    () => getBrokerAccountKeyForUid(uid),
    [uid]
  )
  const [brokerAccountState, setBrokerAccountState] = useState<BrokerAccountDoc | null>(null)
  const [tradingControls, setTradingControls] = useState<TradingControlsDoc | null>(null)
  const brokerAccount = brokerAccountKey ? brokerAccountState : null

  useEffect(() => {
    if (!firebaseEnabled || !db) return
    const unsubs: Array<() => void> = []
    let active = true

    if (brokerAccountKey) {
      const brokerRef = doc(db, "brokerAccounts", brokerAccountKey)
      unsubs.push(
        onSnapshot(brokerRef, (snap) => {
          if (!active) return
          setBrokerAccountState(snap.exists() ? (snap.data() as BrokerAccountDoc) : null)
        })
      )
    }

    const controlsRef = doc(db, "trading", "controls")
    unsubs.push(
      onSnapshot(controlsRef, (snap) => {
        if (!active) return
        setTradingControls(snap.exists() ? (snap.data() as TradingControlsDoc) : null)
      })
    )

    return () => {
      active = false
      unsubs.forEach((unsub) => unsub())
    }
  }, [brokerAccountKey])

  return { brokerAccountKey, brokerAccount, tradingControls }
}
