import { useEffect, useState } from "react"
import { collectionGroup, query, where, orderBy, limit, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getDocsWithRetry } from "@/lib/firestore-retry"

export type SymbolSignal = {
  id: string
  symbol: string
  side: "buy" | "sell" | "hold"
  strength: number
  botId: string
  createdAt: Date
  message?: string
  assetClass?: string
}

/**
 * Fetch recent signals for a specific symbol from Firestore
 */
export function useSymbolSignals(symbol?: string, maxSignals = 20) {
  const [signals, setSignals] = useState<SymbolSignal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol || !db) {
      setSignals([])
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setLoading(true)

    async function loadSignals() {
      try {
        if (!db) return
        const normalizedSymbol = symbol!.toUpperCase().replace(/[/-]/g, "")
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // last 7 days

        const signalsRef = collectionGroup(db, "signals")
        const q = query(
          signalsRef,
          where("symbol", "==", normalizedSymbol),
          where("createdAt", ">=", Timestamp.fromDate(cutoff)),
          orderBy("createdAt", "desc"),
          limit(maxSignals)
        )

        const snapshot = await getDocsWithRetry(q)
        if (controller.signal.aborted) return
        if (cancelled) return

        const results: SymbolSignal[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          const botId = doc.ref.parent.parent?.id || "unknown"
          return {
            id: doc.id,
            symbol: data.symbol || normalizedSymbol,
            side: data.side || "hold",
            strength: typeof data.strength === "number" ? data.strength : 0.5,
            botId,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            message: data.message,
            assetClass: data.assetClass,
          }
        })

        setSignals(results)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (controller.signal.aborted) return
        console.error("Failed to load signals:", err)
        setError(err instanceof Error ? err.message : "Failed to load signals")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSignals()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [symbol, maxSignals])

  return { signals, loading, error }
}
