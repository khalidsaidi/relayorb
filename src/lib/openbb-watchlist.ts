type Listener = () => void

export const OPENBB_WATCHLIST_KEY = "openbb_watchlist"

const CHANNEL_NAME = "relayorb_openbb_watchlist_v1"

let cachedRaw: string | null = null
let cachedList: string[] = []

const listeners = new Set<Listener>()
let bc: BroadcastChannel | null = null
let storageListenerAttached = false

function normalize(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list
    .map((x) => String(x || "").trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 500)
}

function safeReadRaw(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(OPENBB_WATCHLIST_KEY)
  } catch {
    return null
  }
}

function safeWriteRaw(raw: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(OPENBB_WATCHLIST_KEY, raw)
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

function refreshCacheIfNeeded() {
  const raw = safeReadRaw()
  if (raw === cachedRaw) return
  cachedRaw = raw
  try {
    cachedList = normalize(raw ? JSON.parse(raw) : [])
  } catch {
    cachedList = []
  }
}

function notify() {
  for (const fn of Array.from(listeners)) fn()
}

function ensureGlobalListeners() {
  if (typeof window === "undefined") return
  if (!storageListenerAttached) {
    window.addEventListener("storage", (e) => {
      if (e.key !== OPENBB_WATCHLIST_KEY) return
      refreshCacheIfNeeded()
      notify()
    })
    storageListenerAttached = true
  }

  // BroadcastChannel is the only way to push updates across tabs/windows on the same origin
  // without polling (storage events do not fire in the same document that wrote localStorage).
  if (!bc && typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bc.onmessage = () => {
        refreshCacheIfNeeded()
        notify()
      }
    } catch {
      bc = null
    }
  }
}

export function getOpenbbWatchlistSnapshot(): string[] {
  refreshCacheIfNeeded()
  return cachedList
}

export function setOpenbbWatchlist(next: string[]) {
  const normalized = normalize(next)
  const raw = JSON.stringify(normalized)
  cachedRaw = raw
  cachedList = normalized
  safeWriteRaw(raw)

  // Notify subscribers in this tab immediately.
  notify()

  // Notify other tabs/windows.
  try {
    bc?.postMessage({ type: "changed" })
  } catch {
    // ignore
  }
}

export function subscribeOpenbbWatchlist(listener: Listener): () => void {
  ensureGlobalListeners()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

