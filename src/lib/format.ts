import type { FieldValue, Timestamp } from "firebase/firestore"

type FirestoreTimestamp = Timestamp | FieldValue

export function formatTimestamp(ts?: FirestoreTimestamp) {
  if (!ts) return "—"
  const timestamp = ts as Timestamp
  if (typeof timestamp.toMillis !== "function") return "—"
  return new Date(timestamp.toMillis()).toLocaleString()
}

export function formatRelativeTimestamp(ts?: FirestoreTimestamp) {
  if (!ts) return "—"
  const timestamp = ts as Timestamp
  if (typeof timestamp.toMillis !== "function") return "—"
  const diffMs = Date.now() - timestamp.toMillis()
  if (diffMs <= 0) return "just now"
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 45) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp.toMillis()).toLocaleDateString()
}

export function formatCurrency(value: number) {
  const abs = Math.abs(value)

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: abs < 0.01 ? 6 : abs < 1 ? 4 : 2,
  }).format(value)
}

type AssetClass = "crypto" | "stock" | "forex" | string | undefined

function getPriceDecimals(value: number, assetClass?: AssetClass) {
  if (assetClass === "forex") {
    // Forex pairs typically quote to 5 decimals; keep 6 for tiny edge cases
    return value < 0.01 ? 6 : 5
  }

  if (value < 0.01) return 6
  if (assetClass === "crypto") return value < 1 ? 5 : 4
  return value < 1 ? 4 : 2
}

export function formatAssetPrice(value?: number | null, assetClass?: AssetClass) {
  if (value === null || value === undefined) return "—"
  if (!Number.isFinite(value)) return "—"
  const decimals = getPriceDecimals(value, assetClass)
  return value.toFixed(decimals)
}

export function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "—"
  if (!Number.isFinite(value)) return "—"

  const abs = Math.abs(value)
  if (abs >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`
  }
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toLocaleString()
}

// Re-export market-related formatting functions for convenience
export { formatCountdown, getMarketHoursText } from "./marketHours"
