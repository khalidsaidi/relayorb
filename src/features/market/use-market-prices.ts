import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type MarketPrice = {
    symbol: string
    price: number
    assetClass: string
}

export function useMarketPrices() {
    const [livePrices, setLivePrices] = useState<Record<string, number>>({})
    const [snapshotPrices, setSnapshotPrices] = useState<Record<string, number>>({})
    const [liveLoaded, setLiveLoaded] = useState(false)
    const [snapshotLoaded, setSnapshotLoaded] = useState(false)

    const prices = useMemo(
        () => ({ ...snapshotPrices, ...livePrices }),
        [snapshotPrices, livePrices]
    )
    const loading = !liveLoaded && !snapshotLoaded

    useEffect(() => {
        if (!db) return

        const unsub = onSnapshot(doc(db, "market", "prices"), (snap) => {
            if (snap.exists()) {
                const data = snap.data()
                const items = data.items || []
                const priceMap: Record<string, number> = {}

                items.forEach((item: MarketPrice) => {
                    if (item.symbol && typeof item.price === "number") {
                        priceMap[item.symbol] = item.price
                    }
                })

                setLivePrices(priceMap)
            }
            setLiveLoaded(true)
        }, (err) => {
            console.error("Market prices subscription failed:", err)
            setLiveLoaded(true)
        })

        return () => unsub()
    }, [])

    useEffect(() => {
        if (!db) return

        const unsub = onSnapshot(doc(db, "market", "prices_snapshot"), (snap) => {
            if (snap.exists()) {
                const data = snap.data()
                const items = data.items || []
                const priceMap: Record<string, number> = {}

                items.forEach((item: MarketPrice) => {
                    if (item.symbol && typeof item.price === "number") {
                        priceMap[item.symbol] = item.price
                    }
                })

                setSnapshotPrices(priceMap)
            }
            setSnapshotLoaded(true)
        }, (err) => {
            console.error("Market price snapshot subscription failed:", err)
            setSnapshotLoaded(true)
        })

        return () => unsub()
    }, [])

    return { prices, livePrices, loading }
}
