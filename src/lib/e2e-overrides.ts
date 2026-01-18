import type { MarketPrebreakoutDoc, MarketSwingOvernightDoc } from "@/lib/types"

type E2EMarketPricesOverride = {
  prices?: Record<string, number>
  livePrices?: Record<string, number>
}

type E2EWindow = Window & {
  __E2E_SWING_OVERNIGHT__?: MarketSwingOvernightDoc
  __E2E_PREBREAKOUT__?: MarketPrebreakoutDoc
  __E2E_REFRESH_URL__?: string
  __E2E_DISABLE_FIRESTORE_WRITES__?: boolean
  __E2E_MARKET_PRICES__?: E2EMarketPricesOverride
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
