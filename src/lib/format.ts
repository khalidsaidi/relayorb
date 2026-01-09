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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

// Re-export market-related formatting functions for convenience
export { formatCountdown, getMarketHoursText } from "./marketHours"
