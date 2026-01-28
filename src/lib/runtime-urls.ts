function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}

export function resolveMarketDataProxyUrl() {
  const raw = (import.meta.env.VITE_MARKET_DATA_PROXY_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  if (typeof window !== "undefined") {
    return normalizeUrl("/proxy")
  }
  return ""
}

export function resolveOrbRunnerUrl() {
  const raw = (import.meta.env.VITE_ORB_RUNNER_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  if (typeof window !== "undefined") {
    return normalizeUrl("/proxy/orb")
  }
  return ""
}
