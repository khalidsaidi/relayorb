import {
    collection,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    updateDoc,
    addDoc,
    increment,
} from "firebase/firestore"
import type { FieldValue, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { PaperPosition, PaperTransaction, PaperWallet } from "@/lib/types"
import { getE2eDisableFirestoreWrites } from "@/lib/e2e-overrides"

const DEFAULT_STARTING_BALANCE = 100000

type FirestoreTimestamp = Timestamp | FieldValue
type PaperWalletWrite = Omit<PaperWallet, "createdAt" | "updatedAt"> & {
    createdAt: FirestoreTimestamp
    updatedAt: FirestoreTimestamp
}
type PaperTransactionWrite = Omit<PaperTransaction, "id" | "timestamp"> & {
    timestamp: FirestoreTimestamp
}

/**
 * Ensure a user has a paper wallet. If not, create one with default balance.
 */
export async function ensurePaperWallet(userId: string): Promise<PaperWallet | null> {
    if (!db) return null
    const walletRef = doc(db, "users", userId, "paper", "wallet")
    const snap = await getDoc(walletRef)

    if (snap.exists()) {
        return snap.data() as PaperWallet
    }

    // Create new wallet
    const newWallet: PaperWalletWrite = {
        userId,
        balance: DEFAULT_STARTING_BALANCE,
        currency: "USD",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }

    await setDoc(walletRef, newWallet)
    return newWallet as PaperWallet
}

/**
 * Execute a simulated trade on the paper wallet.
 */
export async function executePaperTrade(
    userId: string,
    trade: {
        symbol: string
        assetClass: "crypto" | "stock" | "forex"
        side: "buy" | "sell"
        price: number
        quantity: number
        botId?: string
        stopLoss?: number
        takeProfit?: number
    }
) {
    if (getE2eDisableFirestoreWrites()) {
        return
    }
    if (!db) throw new Error("Database not initialized")

    const walletRef = doc(db, "users", userId, "paper", "wallet")
    const walletSnap = await getDoc(walletRef)

    if (!walletSnap.exists()) {
        await ensurePaperWallet(userId)
    }

    const cost = trade.price * trade.quantity

    const isBuy = trade.side === "buy"

    // Simple validation
    const currentBalance = walletSnap.data()?.balance || 0
    if (isBuy && currentBalance < cost) {
        throw new Error("Insufficient funds for paper trade")
    }

    // Record transaction
    const txRef = collection(db, "users", userId, "paper", "wallet", "transactions")
    const newTx: PaperTransactionWrite = {
        userId,
        symbol: trade.symbol,
        assetClass: trade.assetClass,
        side: trade.side,
        amount: trade.quantity,
        price: trade.price,
        cost: cost,
        type: "open", // Simplified: assuming all are "open" for now or we track positions separately
        timestamp: serverTimestamp(),
    }
    if (trade.botId) newTx.botId = trade.botId
    if (trade.stopLoss) newTx.stopLoss = trade.stopLoss
    if (trade.takeProfit) newTx.takeProfit = trade.takeProfit

    await addDoc(txRef, newTx)

    // Update wallet balance
    await updateDoc(walletRef, {
        balance: increment(isBuy ? -cost : cost),
        updatedAt: serverTimestamp(),
    })

    // Update Position
    const safeSymbolId = trade.symbol.replace(/\//g, "_")
    const positionRef = doc(db, "users", userId, "paper", "wallet", "positions", safeSymbolId)
    const positionSnap = await getDoc(positionRef)

    if (positionSnap.exists()) {
            const currentPos = positionSnap.data() as PaperPosition
            const newQuantity = isBuy
                ? currentPos.quantity + trade.quantity
                : currentPos.quantity - trade.quantity

        if (newQuantity <= 0) {
            // Close position if sold out
            // Note: In a real system we might archive this. For now just set to 0 or delete.
            // Let's delete to keep the list clean.
            const { deleteDoc } = await import("firebase/firestore") // Dynamic import to avoid top-level clutter if possible, or just add to top
            await deleteDoc(positionRef)
        } else {
            // Update
            const updates: Partial<PaperPosition> & { updatedAt: FirestoreTimestamp } = {
                quantity: newQuantity,
                updatedAt: serverTimestamp(),
            }
            // If buying, update average entry price
            if (isBuy) {
                const totalValue = (currentPos.avgEntryPrice * currentPos.quantity) + cost
                updates.avgEntryPrice = totalValue / newQuantity
            }
            // Update SL/TP if provided (override)
            if (trade.stopLoss) updates.stopLoss = trade.stopLoss
            if (trade.takeProfit) updates.takeProfit = trade.takeProfit

            await updateDoc(positionRef, updates)
        }
    } else if (isBuy) {
        // Create new position
        await setDoc(positionRef, {
            symbol: trade.symbol,
            assetClass: trade.assetClass,
            quantity: trade.quantity,
            avgEntryPrice: trade.price,
            stopLoss: trade.stopLoss || null,
            takeProfit: trade.takeProfit || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        })
    }
}

/**
 * Get current paper wallet
 */
export async function getPaperWallet(userId: string) {
    if (!db) return null
    const snap = await getDoc(doc(db, "users", userId, "paper", "wallet"))
    return snap.exists() ? (snap.data() as PaperWallet) : null
}
