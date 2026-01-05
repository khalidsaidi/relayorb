import type { Timestamp } from "firebase/firestore"

export function formatTimestamp(ts?: Timestamp) {
  if (!ts) return "—"
  return new Date(ts.toMillis()).toLocaleString()
}
