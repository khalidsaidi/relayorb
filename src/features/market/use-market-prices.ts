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

const LIVE_STALE_MS = 60 * 1000
const SNAPSHOT_STALE_MS = 5 * 60 * 1000

function loadCachedPrices() {
    if (typeof window === "undefined") return { prices: {}, updatedAtMs: null }
    try {
        const raw = window.localStorage.getItem("relayorb.market.prices")
        if (!raw) return { prices: {}, updatedAtMs: null }
        const payload = JSON.parse(raw)
        if (!payload || typeof payload !== "object") return { prices: {}, updatedAtMs: null }
        const prices =
            payload.prices && typeof payload.prices === "object" ? payload.prices : {}
        const updatedAtMs = Number.isFinite(payload.updatedAtMs) ? payload.updatedAtMs : null
        return { prices, updatedAtMs }
    } catch {
        return { prices: {}, updatedAtMs: null }
    }
}

export function useMarketPrices() {
    const { replayActive, controls } = useReplayControls()
    const replayRunId = replayActive ? controls?.activeRunId : null
    const cached = loadCachedPrices()
    const [livePrices, setLivePrices] = useState<Record<string, number>>(cached.prices)
    const [snapshotPrices, setSnapshotPrices] = useState<Record<string, number>>({})
    const [liveLoaded, setLiveLoaded] = useState(false)
    const [snapshotLoaded, setSnapshotLoaded] = useState(false)
    const [liveUpdatedAtMs, setLiveUpdatedAtMs] = useState<number | null>(cached.updatedAtMs)
    const [snapshotUpdatedAtMs, setSnapshotUpdatedAtMs] = useState<number | null>(null)
    const [nowMs, setNowMs] = useState(() => Date.now())

    const prices = useMemo(
        () => ({ ...snapshotPrices, ...livePrices }),
        [snapshotPrices, livePrices]
    )
    const replayBlocked = replayActive && !replayRunId
    const effectiveLiveLoaded = replayBlocked ? true : liveLoaded
    const effectiveSnapshotLoaded = replayBlocked ? true : snapshotLoaded
    const loading = !effectiveLiveLoaded && !effectiveSnapshotLoaded
    const liveAgeMs = liveUpdatedAtMs !== null ? nowMs - liveUpdatedAtMs : null
    const snapshotAgeMs = snapshotUpdatedAtMs !== null ? nowMs - snapshotUpdatedAtMs : null
    const liveStale = liveAgeMs !== null && liveAgeMs > LIVE_STALE_MS
    const snapshotStale = snapshotAgeMs !== null && snapshotAgeMs > SNAPSHOT_STALE_MS
    const stale = liveUpdatedAtMs !== null ? liveStale : snapshotStale

    useEffect(() => {
        if (!db) return
        if (replayBlocked) return

        let active = true
        const pricesRef = replayRunId
            ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prices")
            : doc(db, "market", "prices")

        const unsub = onSnapshotWithRetry(
            pricesRef,
            (snap) => {
                if (!active) return
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
                    const updatedAt =
                        data.updatedAt?.toDate?.() ||
                        data.asOf?.toDate?.() ||
                        null
                    if (updatedAt) {
                        setLiveUpdatedAtMs(updatedAt.getTime())
                    }
                }
                setLiveLoaded(true)
            },
            (err) => {
                if (!active) return
                console.error("Market prices subscription failed after retries:", err)
                setLiveLoaded(true)
            }
        )

        return () => {
            active = false
            unsub()
        }
    }, [replayActive, replayRunId, replayBlocked])

    useEffect(() => {
        if (!db) return
        if (replayBlocked) return

        let active = true
        const snapshotRef = replayRunId
            ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prices_snapshot")
            : doc(db, "market", "prices_snapshot")

        const unsub = onSnapshotWithRetry(
            snapshotRef,
            (snap) => {
                if (!active) return
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
                    const updatedAt =
                        data.updatedAt?.toDate?.() ||
                        data.asOf?.toDate?.() ||
                        null
                    if (updatedAt) {
                        setSnapshotUpdatedAtMs(updatedAt.getTime())
                    }
                }
                setSnapshotLoaded(true)
            },
            (err) => {
                if (!active) return
                console.error("Market price snapshot subscription failed after retries:", err)
                setSnapshotLoaded(true)
            }
        )

        return () => {
            active = false
            unsub()
        }
    }, [replayActive, replayRunId, replayBlocked])

    useEffect(() => {
        const timer = setInterval(() => {
            setNowMs(Date.now())
        }, 15000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            if (Object.keys(livePrices).length === 0) return
            window.localStorage.setItem(
                "relayorb.market.prices",
                JSON.stringify({
                    prices: livePrices,
                    updatedAtMs: liveUpdatedAtMs ?? null,
                    savedAtMs: Date.now(),
                })
            )
        } catch {
            // ignore storage failures
        }
    }, [livePrices, liveUpdatedAtMs])

    return {
        prices,
        livePrices,
        loading,
        liveUpdatedAtMs,
        snapshotUpdatedAtMs,
        liveAgeMs,
        snapshotAgeMs,
        liveStale,
        snapshotStale,
        stale,
    }
}
