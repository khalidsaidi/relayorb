import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getE2eMarketPricesOverride } from "@/lib/e2e-overrides"

export type MarketPrice = {
    symbol: string
    price: number
    assetClass: string
}

export function useMarketPrices() {
    const e2eOverride = getE2eMarketPricesOverride()
    const initialLive = e2eOverride?.livePrices ?? {}
    const initialSnapshot = e2eOverride?.prices ?? {}
    const [livePrices, setLivePrices] = useState<Record<string, number>>(() => initialLive)
    const [snapshotPrices, setSnapshotPrices] = useState<Record<string, number>>(() => initialSnapshot)
    const [liveLoaded, setLiveLoaded] = useState(() => Boolean(e2eOverride))
    const [snapshotLoaded, setSnapshotLoaded] = useState(() => Boolean(e2eOverride))

    const prices = useMemo(
        () => ({ ...snapshotPrices, ...livePrices }),
        [snapshotPrices, livePrices]
    )
    const loading = !liveLoaded && !snapshotLoaded

    useEffect(() => {
        if (e2eOverride) return
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
    }, [e2eOverride])

    useEffect(() => {
        if (e2eOverride) return
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
    }, [e2eOverride])

    return { prices, livePrices, loading }
}
