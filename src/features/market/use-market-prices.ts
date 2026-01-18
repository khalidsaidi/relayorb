import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getE2eMarketPricesOverride } from "@/lib/e2e-overrides"
import { useReplayControls } from "@/features/replay/use-replay-controls"

export type MarketPrice = {
    symbol: string
    price: number
    assetClass: string
}

export function useMarketPrices() {
    const e2eOverride = getE2eMarketPricesOverride()
    const { replayActive, controls } = useReplayControls()
    const replayRunId = replayActive ? controls?.activeRunId : null
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
    const replayBlocked = replayActive && !replayRunId
    const effectiveLiveLoaded = replayBlocked ? true : liveLoaded
    const effectiveSnapshotLoaded = replayBlocked ? true : snapshotLoaded
    const loading = !effectiveLiveLoaded && !effectiveSnapshotLoaded

    useEffect(() => {
        if (e2eOverride) return
        if (!db) return
        if (replayBlocked) return

        const pricesRef = replayRunId
            ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prices")
            : doc(db, "market", "prices")

        const unsub = onSnapshot(pricesRef, (snap) => {
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
    }, [e2eOverride, replayActive, replayRunId, replayBlocked])

    useEffect(() => {
        if (e2eOverride) return
        if (!db) return
        if (replayBlocked) return

        const snapshotRef = replayRunId
            ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prices_snapshot")
            : doc(db, "market", "prices_snapshot")

        const unsub = onSnapshot(snapshotRef, (snap) => {
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
    }, [e2eOverride, replayActive, replayRunId, replayBlocked])

    return { prices, livePrices, loading }
}
