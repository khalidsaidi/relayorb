/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useMarketControls } from "@/features/market/use-market-controls"
import { useMarketPrices } from "@/features/market/use-market-prices"
import { useMarketStatus } from "@/features/market/use-market-status"

type MarketDataContextValue = {
  controls: ReturnType<typeof useMarketControls>
  prices: ReturnType<typeof useMarketPrices>
  status: ReturnType<typeof useMarketStatus>
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null)

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const controls = useMarketControls()
  const prices = useMarketPrices()
  const status = useMarketStatus()
  const value = useMemo(() => ({ controls, prices, status }), [controls, prices, status])
  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>
}

export function useMarketDataContext() {
  const ctx = useContext(MarketDataContext)
  if (!ctx) {
    throw new Error("useMarketDataContext must be used within MarketDataProvider")
  }
  return ctx
}
