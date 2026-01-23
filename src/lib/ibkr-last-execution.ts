import type { BrokerAccountKey, ExecutionMode, OrderSnapshot } from "@/lib/types"

export type LastExecutionRequest = {
  id: string
  brokerAccountKey: BrokerAccountKey
  createdAt: number
  mode: ExecutionMode
  orderSnapshot: OrderSnapshot
}

export const LAST_EXECUTION_EVENT = "relayorb:lastExecutionRequest"
const STORAGE_PREFIX = "relayorb.lastExecutionRequest."

export function getLastExecutionStorageKey(brokerAccountKey: BrokerAccountKey) {
  return `${STORAGE_PREFIX}${brokerAccountKey}`
}

export function storeLastExecutionRequest(entry: LastExecutionRequest) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(getLastExecutionStorageKey(entry.brokerAccountKey), JSON.stringify(entry))
    window.dispatchEvent(
      new CustomEvent(LAST_EXECUTION_EVENT, { detail: { brokerAccountKey: entry.brokerAccountKey } })
    )
  } catch {
    // Ignore storage errors.
  }
}

export function loadLastExecutionRequest(brokerAccountKey?: BrokerAccountKey | null) {
  if (typeof window === "undefined" || !brokerAccountKey) return null
  try {
    const raw = window.localStorage.getItem(getLastExecutionStorageKey(brokerAccountKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LastExecutionRequest
    if (!parsed?.id || parsed.brokerAccountKey !== brokerAccountKey) return null
    return parsed
  } catch {
    return null
  }
}
