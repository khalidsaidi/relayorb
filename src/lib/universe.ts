export const DEFAULT_EXCHANGES = [
  "binance",
  "kraken",
  "coinbase",
  "kucoin",
  "bybit",
  "okx",
  "bitfinex",
  "bitget",
  "gateio",
  "bitstamp",
]

export const DEFAULT_TIMEFRAMES = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
]

export const DEFAULT_MODES = ["signal", "paper", "live"] as const

export function uniqueList(values: string[]) {
  return Array.from(new Set(values))
}

export function parsePairs(input: string) {
  return input
    .split(/[,\n]/)
    .map((pair) => pair.trim())
    .filter(Boolean)
}
