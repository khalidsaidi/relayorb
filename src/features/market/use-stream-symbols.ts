import { useEffect, useMemo, useRef } from "react"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import { useReplayControls } from "@/features/replay/use-replay-controls"

const FX_CODES = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"])
const DEFAULT_LIMIT = 120

type AssetClass = "crypto" | "stock" | "forex"

export type StreamSymbolEntry = {
  symbol?: string | null
  assetClass?: string | null
}

type StreamSymbolBuckets = Partial<Record<AssetClass, string[]>>

type StreamSymbolsOptions = {
  items?: StreamSymbolEntry[]
  buckets?: StreamSymbolBuckets
  enabled?: boolean
  limitPerClass?: number
}

function normalizeSymbol(value: string) {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return ""
  const cleaned = trimmed.includes("-")
    ? trimmed.replace(/\s+/g, "").replace(/-/g, "/")
    : trimmed.replace(/\s+/g, "")
  if (!cleaned) return ""
  if (!/[A-Z]/.test(cleaned)) return ""
  return cleaned
}

function normalizeTicker(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return ""
  if (!/[A-Z]/.test(cleaned)) return ""
  return cleaned
}

function inferAssetClass(symbol: string) {
  const upper = symbol.trim().toUpperCase()
  if (!upper) return null
  if (upper.includes("/")) {
    const [base, quote] = upper.replace(/-/g, "/").split("/")
    if (base && quote && FX_CODES.has(base) && FX_CODES.has(quote)) return "forex"
    return "crypto"
  }
  if (upper.length === 6) {
    const base = upper.slice(0, 3)
    const quote = upper.slice(3)
    if (FX_CODES.has(base) && FX_CODES.has(quote)) return "forex"
  }
  return "stock"
}

function normalizeForAsset(symbol: string, assetClass: AssetClass) {
  return assetClass === "stock" ? normalizeTicker(symbol) : normalizeSymbol(symbol)
}

function buildBuckets(items: StreamSymbolEntry[], buckets: StreamSymbolBuckets, limit: number) {
  const sets = {
    crypto: new Set<string>(),
    stock: new Set<string>(),
    forex: new Set<string>(),
  }

  const addSymbol = (assetClass: AssetClass, symbol?: string | null) => {
    if (!symbol) return
    const normalized = normalizeForAsset(symbol, assetClass)
    if (!normalized) return
    sets[assetClass].add(normalized)
  }

  items.forEach((entry) => {
    const symbol = entry?.symbol ? String(entry.symbol) : ""
    if (!symbol) return
    const assetClassRaw = entry?.assetClass ? String(entry.assetClass) : ""
    const inferred = inferAssetClass(symbol)
    const assetClass =
      assetClassRaw === "crypto" || assetClassRaw === "stock" || assetClassRaw === "forex"
        ? assetClassRaw
        : inferred
    if (!assetClass) return
    addSymbol(assetClass, symbol)
  })

  Object.entries(buckets || {}).forEach(([assetClass, symbols]) => {
    if (!Array.isArray(symbols)) return
    if (assetClass !== "crypto" && assetClass !== "stock" && assetClass !== "forex") return
    symbols.forEach((symbol) => addSymbol(assetClass, symbol))
  })

  const toList = (set: Set<string>) => Array.from(set).sort().slice(0, limit)
  return {
    crypto: toList(sets.crypto),
    stock: toList(sets.stock),
    forex: toList(sets.forex),
  }
}

export function useStreamSymbols(sourceKey: string, options: StreamSymbolsOptions) {
  const {
    items = [],
    buckets = {},
    enabled = true,
    limitPerClass = DEFAULT_LIMIT,
  } = options
  const { replayActive, controls } = useReplayControls()
  const replayRunId = replayActive ? controls?.activeRunId : null

  const payload = useMemo(
    () => buildBuckets(items, buckets, limitPerClass),
    [items, buckets, limitPerClass]
  )

  const signature = useMemo(() => JSON.stringify(payload), [payload])
  const lastSignature = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled || !firebaseEnabled || !db) return
    if (!sourceKey) return
    if (signature === lastSignature.current) return
    if (replayActive && !replayRunId) return

    const activeDb = db
    const targetDoc = replayRunId
      ? doc(activeDb, "replay", "controls", "runs", replayRunId, "market", "streamSymbols")
      : doc(activeDb, "market", "streamSymbols")

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      lastSignature.current = signature
      setDoc(
        targetDoc,
        {
          updatedAt: serverTimestamp(),
          sources: {
            [sourceKey]: {
              updatedAt: serverTimestamp(),
              symbols: payload,
            },
          },
        },
        { merge: true }
      ).catch((error) => {
        console.error("streamSymbols update failed:", error)
      })
    }, 1000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, payload, signature, sourceKey, replayActive, replayRunId])
}
