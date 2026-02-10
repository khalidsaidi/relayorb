import { useCallback, useSyncExternalStore } from "react"
import { getOpenbbWatchlistSnapshot, setOpenbbWatchlist, subscribeOpenbbWatchlist } from "@/lib/openbb-watchlist"

export function useOpenbbWatchlist() {
  const list = useSyncExternalStore(subscribeOpenbbWatchlist, getOpenbbWatchlistSnapshot, () => [])

  const setList = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    const prev = getOpenbbWatchlistSnapshot()
    const resolved = typeof next === "function" ? (next as (p: string[]) => string[])(prev) : next
    setOpenbbWatchlist(resolved)
  }, [])

  return [list, setList] as const
}

