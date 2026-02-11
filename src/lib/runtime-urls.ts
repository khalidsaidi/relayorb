function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}

export function resolveMarketDataProxyUrl() {
  const raw = (import.meta.env.VITE_MARKET_DATA_PROXY_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  return ""
}

export function resolveOrbRunnerUrl() {
  const raw = (import.meta.env.VITE_ORB_RUNNER_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  return ""
}

export function resolveOpenbbApiUrl() {
  const raw = (import.meta.env.VITE_OPENBB_API_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  return ""
}

export function resolveStockpulseUrl() {
  const raw = (import.meta.env.VITE_STOCKPULSE_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  return ""
}

export function resolveFinnewsUrl() {
  const raw = (import.meta.env.VITE_FINNEWS_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  return ""
}

export function resolveTvscreenerUrl() {
  const raw = (import.meta.env.VITE_TVSCREENER_URL || "").trim()
  if (raw) return normalizeUrl(raw)
  return ""
}
