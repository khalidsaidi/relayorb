import { useEffect, useMemo, useState } from "react"
import { doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { onSnapshotWithRetry } from "@/lib/firestore-retry"
import { useReplayControls } from "@/features/replay/use-replay-controls"

export type MarketPrice = {
    symbol: string
    price: number
    assetClass: string
}

export function useMarketPrices() {
    const { replayActive, controls } = useReplayControls()
    const replayRunId = replayActive ? controls?.activeRunId : null
    const [livePrices, setLivePrices] = useState<Record<string, number>>({})
    const [snapshotPrices, setSnapshotPrices] = useState<Record<string, number>>({})
    const [liveLoaded, setLiveLoaded] = useState(false)
    const [snapshotLoaded, setSnapshotLoaded] = useState(false)

    const prices = useMemo(
        () => ({ ...snapshotPrices, ...livePrices }),
        [snapshotPrices, livePrices]
    )
    const replayBlocked = replayActive && !replayRunId
    const effectiveLiveLoaded = replayBlocked ? true : liveLoaded
    const effectiveSnapshotLoaded = replayBlocked ? true : snapshotLoaded
    const loading = !effectiveLiveLoaded && !effectiveSnapshotLoaded

    useEffect(() => {
        if (!db) return
        if (replayBlocked) return

        const pricesRef = replayRunId
            ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prices")
            : doc(db, "market", "prices")

        const unsub = onSnapshotWithRetry(
            pricesRef,
            (snap) => {
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
            },
            (err) => {
                console.error("Market prices subscription failed after retries:", err)
                setLiveLoaded(true)
            }
        )

        return () => unsub()
    }, [replayActive, replayRunId, replayBlocked])

    useEffect(() => {
        if (!db) return
        if (replayBlocked) return

        const snapshotRef = replayRunId
            ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prices_snapshot")
            : doc(db, "market", "prices_snapshot")

        const unsub = onSnapshotWithRetry(
            snapshotRef,
            (snap) => {
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
            },
            (err) => {
                console.error("Market price snapshot subscription failed after retries:", err)
                setSnapshotLoaded(true)
            }
        )

        return () => unsub()
    }, [replayActive, replayRunId, replayBlocked])

    return { prices, livePrices, loading }
}
