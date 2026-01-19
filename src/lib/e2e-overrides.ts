import type { MarketPrebreakoutDoc, MarketSwingOvernightDoc } from "@/lib/types"

type E2EMarketPricesOverride = {
  prices?: Record<string, number>
  livePrices?: Record<string, number>
}

export type E2EReplayControlsOverride = {
  desiredMode?: "live" | "replay"
  phase?: string
  activeRunId?: string
  datasetId?: string
  sessionId?: string
  version?: number
  asOf?: unknown
  requiredServices?: string[]
  botsReplayEnabled?: boolean
  speedScript?: Array<Record<string, unknown>>
}

type E2EWindow = Window & {
  __E2E_SWING_OVERNIGHT__?: MarketSwingOvernightDoc
  __E2E_PREBREAKOUT__?: MarketPrebreakoutDoc
  __E2E_REFRESH_URL__?: string
  __E2E_DISABLE_FIRESTORE_WRITES__?: boolean
  __E2E_MARKET_PRICES__?: E2EMarketPricesOverride
  __E2E_REPLAY_CONTROLS__?: E2EReplayControlsOverride
}

export function getE2eSwingOvernightOverride(): MarketSwingOvernightDoc | null {
  if (import.meta.env.VITE_E2E !== "true") return null
  if (typeof window === "undefined") return null
  const win = window as E2EWindow
  return win.__E2E_SWING_OVERNIGHT__ ?? null
}

export function getE2ePrebreakoutOverride(): MarketPrebreakoutDoc | null {
  if (import.meta.env.VITE_E2E !== "true") return null
  if (typeof window === "undefined") return null
  const win = window as E2EWindow
  return win.__E2E_PREBREAKOUT__ ?? null
}

export function getE2eRefreshUrlOverride(): string | null {
  if (import.meta.env.VITE_E2E !== "true") return null
  if (typeof window === "undefined") return null
  const win = window as E2EWindow
  return typeof win.__E2E_REFRESH_URL__ === "string" ? win.__E2E_REFRESH_URL__ : null
}

export function getE2eDisableFirestoreWrites(): boolean {
  if (import.meta.env.VITE_E2E !== "true") return false
  if (typeof window === "undefined") return false
  const win = window as E2EWindow
  return Boolean(win.__E2E_DISABLE_FIRESTORE_WRITES__)
}

export function getE2eMarketPricesOverride(): E2EMarketPricesOverride | null {
  if (import.meta.env.VITE_E2E !== "true") return null
  if (typeof window === "undefined") return null
  const win = window as E2EWindow
  return win.__E2E_MARKET_PRICES__ ?? null
}

export function getE2eReplayControlsOverride(): E2EReplayControlsOverride | null {
  if (typeof window === "undefined") return null
  const win = window as E2EWindow
  if (win.__E2E_REPLAY_CONTROLS__) {
    const parsed = win.__E2E_REPLAY_CONTROLS__ as E2EReplayControlsOverride & {
      asOfMs?: number
    }
    const asOfMs =
      typeof parsed.asOfMs === "number"
        ? parsed.asOfMs
        : typeof parsed.asOf === "number"
          ? parsed.asOf
          : null
    if (asOfMs === null) return parsed
    return {
      ...parsed,
      asOf: { toMillis: () => asOfMs },
    }
  }
  const stored = window.localStorage.getItem("relayorb.e2eReplayControls")
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as E2EReplayControlsOverride & {
      asOfMs?: number
    }
    const asOfMs =
      typeof parsed.asOfMs === "number"
        ? parsed.asOfMs
        : typeof parsed.asOf === "number"
          ? parsed.asOf
          : null
    if (asOfMs === null) return parsed
    return {
      ...parsed,
      asOf: { toMillis: () => asOfMs },
    }
  } catch {
    return null
  }
}
