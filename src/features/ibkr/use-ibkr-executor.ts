import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BrokerAccountKey, ExecutorConsumerDoc } from "@/lib/types"

export function useIbkrExecutor(brokerAccountKey?: BrokerAccountKey | null) {
  const [executor, setExecutor] = useState<ExecutorConsumerDoc | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !db || !brokerAccountKey) return
    const ref = doc(db, "executor_consumers", brokerAccountKey)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setExecutor(snap.exists() ? ({ brokerAccountKey, ...snap.data() } as ExecutorConsumerDoc) : null)
      },
      (error) => {
        console.error("useIbkrExecutor onSnapshot error:", error.code, error.message)
        setExecutor(null)
      }
    )
    return () => {
      unsub()
    }
  }, [brokerAccountKey])

  return executor
}
