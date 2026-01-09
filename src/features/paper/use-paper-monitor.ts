import { useEffect, useState } from "react"
import { collection, onSnapshot, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { executePaperTrade } from "./paper-service"
import type { PaperPosition, MarketHotTrade } from "@/lib/types"
import { toast } from "sonner"

const processingSymbols = new Set<string>()

export function usePaperAutomation(userId: string | undefined, marketData: MarketHotTrade[]) {
    const [positions, setPositions] = useState<PaperPosition[]>([])

    useEffect(() => {
        if (!userId || !db) return

        const q = query(collection(db, "users", userId, "paper", "wallet", "positions"))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPositions(snapshot.docs.map(doc => doc.data() as PaperPosition))
        })

        return () => unsubscribe()
    }, [userId])

    useEffect(() => {
        if (!userId) return
        positions.forEach(position => {
            if (processingSymbols.has(position.symbol)) return
            checkPosition(position, marketData, userId)
        })
    }, [userId, marketData, positions])
}

async function checkPosition(position: PaperPosition, marketData: MarketHotTrade[], userId: string) {
    // Try to find matching symbol (handle different formats)
    const quote = marketData.find(m => {
        const marketSymbol = m.symbol?.toUpperCase().replace(/\//g, '_')
        const positionSymbol = position.symbol?.toUpperCase().replace(/\//g, '_')
        return marketSymbol === positionSymbol || m.symbol === position.symbol
    })
    if (!quote || !quote.price) {
        console.log(`[Paper Monitor] No market data for ${position.symbol}`)
        return
    }

    const currentPrice = quote.price
    let action = null
    let reason = ""

    if (position.stopLoss && currentPrice <= position.stopLoss) {
        action = "sell"
        reason = "Stop Loss"
    } else if (position.takeProfit && currentPrice >= position.takeProfit) {
        action = "sell"
        reason = "Take Profit"
    }

    if (action === "sell") {
        processingSymbols.add(position.symbol)
        try {
            await executePaperTrade(userId, {
                symbol: position.symbol,
                assetClass: position.assetClass,
                side: "sell",
                price: currentPrice,
                quantity: position.quantity,
            })
            toast.info(`${reason} triggered for ${position.symbol}. sold at $${currentPrice}`)
        } catch (e) {
            console.error("Auto-trade failed", e)
        } finally {
            processingSymbols.delete(position.symbol)
        }
    }
}
