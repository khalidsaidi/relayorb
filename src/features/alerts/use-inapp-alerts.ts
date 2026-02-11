import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { resolveFinnewsUrl, resolveMarketDataProxyUrl, resolveOpenbbApiUrl, resolveStockpulseUrl } from "@/lib/runtime-urls"
import { fetchJsonOrThrow } from "@/lib/http"
import { getOpenbbWatchlistSnapshot } from "@/lib/openbb-watchlist"
import { toast } from "sonner"

export type InAppAlertType = "filing" | "rating" | "rsi"

export type InAppAlert = {
  id: string
  type: InAppAlertType
  ticker: string
  title: string
  body?: string
  url?: string
  createdAt: string
}

type Settings = {
  enabled: boolean
  pollIntervalSec: number

  enableFilings: boolean
  enableRatingChanges: boolean
  enableRsiThresholds: boolean

  rsiOversold: number
  rsiOverbought: number

  toastOnNew: boolean
  maxAlerts: number
}

type PersistedState = {
  bootstrapped?: boolean
  lastViewedAt?: number
  mutedUntilMs?: number
  lastFilingKeyByTicker?: Record<string, string>
  lastRatingByTicker?: Record<string, string>
  lastRsiBucketByTicker?: Record<string, "oversold" | "neutral" | "overbought">
}

const SETTINGS_KEY = "relayorb_inapp_alert_settings_v1"
const STATE_KEY = "relayorb_inapp_alert_state_v1"
const ALERTS_KEY = "relayorb_inapp_alerts_v1"

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  pollIntervalSec: 30,
  enableFilings: true,
  enableRatingChanges: true,
  enableRsiThresholds: true,
  rsiOversold: 30,
  rsiOverbought: 70,
  toastOnNew: true,
  maxAlerts: 100,
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeTicker(s: string) {
  return String(s || "").trim().toUpperCase()
}

function normalizeAlertKey(key: string) {
  const k = String(key || "").trim().toLowerCase()
  // Back-compat:
  // - old OpenBB watchlist toggles used `sentiment` and `price`
  // - cross-module alerts need `rating` and `rsi`
  if (k === "sentiment") return "rating"
  if (k === "price") return "rsi"
  if (k === "filing") return "filings"
  return k
}

function loadOpenbbWatchlistAlertPrefs(): Record<string, string[]> {
  const raw = localStorage.getItem("openbb_watchlist_alerts")
  const obj = safeParseJson<Record<string, unknown>>(raw)
  if (!obj || typeof obj !== "object") return {}
  const out: Record<string, string[]> = {}
  Object.entries(obj).forEach(([tickerRaw, keysRaw]) => {
    const ticker = normalizeTicker(tickerRaw)
    const keys = Array.isArray(keysRaw) ? keysRaw.map((k) => normalizeAlertKey(String(k))) : []
    out[ticker] = Array.from(new Set(keys)).filter(Boolean)
  })
  return out
}

type SecCikMapV1 = { generatedAt?: string; cikToTicker?: Record<string, string> }

function extractCiks(text: string) {
  const hay = String(text || "")
  const matches = hay.match(/\b\d{6,10}\b/g) || []
  const normalized = matches
    .map((m) => m.replace(/\D/g, ""))
    .filter(Boolean)
    .map((m) => m.padStart(10, "0"))
  return Array.from(new Set(normalized))
}

function extractCiksFromUrl(url?: string | null) {
  const out = new Set<string>()
  const raw = String(url || "").trim()
  if (!raw) return []
  try {
    const u = new URL(raw)
    const q = u.searchParams.get("CIK") || u.searchParams.get("cik") || ""
    if (q) extractCiks(q).forEach((c) => out.add(c))
    const m = u.pathname.match(/\/data\/(\d{1,10})\b/i)
    if (m?.[1]) extractCiks(m[1]).forEach((c) => out.add(c))
  } catch {
    extractCiks(raw).forEach((c) => out.add(c))
  }
  return Array.from(out)
}

function extractTickers(text: string) {
  const hay = String(text || "")
  const out = new Set<string>()
  const patterns: RegExp[] = [
    /\$([A-Z]{1,6}(?:\.[A-Z]{1,2})?)/g,
    /\(([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\)/g,
    /\b(?:NASDAQ|NYSE|AMEX)\s*[:]\s*([A-Z]{1,6}(?:\.[A-Z]{1,2})?)\b/g,
  ]
  for (const re of patterns) {
    for (;;) {
      const m = re.exec(hay)
      if (!m) break
      const sym = normalizeTicker(m[1] || "")
      if (!sym) continue
      out.add(sym)
    }
  }
  return Array.from(out)
}

function isSecUrl(url?: string | null) {
  if (!url) return false
  return url.includes("sec.gov") || url.includes("www.sec.gov")
}

type FinnewsItem = {
  id: string | number
  title: string
  content?: string | null
  url?: string | null
  source_url?: string | null
  stock_codes?: string[]
  created_at?: string | null
  publish_time?: string | null
}

function deriveFinnewsTickers(item: FinnewsItem, cikToTicker?: Record<string, string> | null) {
  const derived = new Set<string>()
  if (Array.isArray(item.stock_codes) && item.stock_codes.length) {
    item.stock_codes.forEach((c) => {
      const t = normalizeTicker(c)
      if (t) derived.add(t)
    })
  }
  extractTickers([item.title, item.content].filter(Boolean).join(" ")).forEach((t) => derived.add(t))
  if (cikToTicker) {
    const ciks = new Set<string>()
    extractCiksFromUrl(item.url || item.source_url).forEach((c) => ciks.add(c))
    extractCiks([item.title, item.content].filter(Boolean).join(" ")).forEach((c) => ciks.add(c))
    Array.from(ciks).forEach((cik) => {
      const ticker = cikToTicker[cik]
      if (ticker) derived.add(normalizeTicker(ticker))
    })
  }
  return Array.from(derived)
}

type StockpulseRating = {
  ticker: string
  rating?: string
  rsi?: number | null
  score?: number
}

function computeRsiBucket(rsi: number, oversold: number, overbought: number): "oversold" | "neutral" | "overbought" {
  if (rsi <= oversold) return "oversold"
  if (rsi >= overbought) return "overbought"
  return "neutral"
}

function newestFirst(a: InAppAlert, b: InAppAlert) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

export function useInAppAlerts() {
  const [settings, setSettings] = useState<Settings>(() => {
    const persisted = safeParseJson<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY))
    if (!persisted) return DEFAULT_SETTINGS
    return {
      ...DEFAULT_SETTINGS,
      ...persisted,
      pollIntervalSec: clampNumber(persisted.pollIntervalSec, 10, 600, DEFAULT_SETTINGS.pollIntervalSec),
      rsiOversold: clampNumber(persisted.rsiOversold, 1, 60, DEFAULT_SETTINGS.rsiOversold),
      rsiOverbought: clampNumber(persisted.rsiOverbought, 40, 99, DEFAULT_SETTINGS.rsiOverbought),
      maxAlerts: clampNumber(persisted.maxAlerts, 10, 500, DEFAULT_SETTINGS.maxAlerts),
    }
  })

  const [state, setState] = useState<PersistedState>(() => safeParseJson<PersistedState>(localStorage.getItem(STATE_KEY)) || {})
  const [alerts, setAlerts] = useState<InAppAlert[]>(() => {
    const list = safeParseJson<InAppAlert[]>(localStorage.getItem(ALERTS_KEY)) || []
    return Array.isArray(list) ? list : []
  })

  const secCikMapRef = useRef<Record<string, string> | null>(null)
  const secCikMapLoadRef = useRef<Promise<Record<string, string> | null> | null>(null)

  const proxyBase = useMemo(() => resolveMarketDataProxyUrl(), [])
  const openbbBase = useMemo(() => (proxyBase ? `${proxyBase}/v1/openbb` : resolveOpenbbApiUrl()), [proxyBase])
  const finnewsBase = useMemo(() => (proxyBase ? `${proxyBase}/v1/finnews` : resolveFinnewsUrl()), [proxyBase])
  const stockpulseBase = useMemo(() => (proxyBase ? `${proxyBase}/v1/stockpulse` : resolveStockpulseUrl()), [proxyBase])

  // Persist settings/state/alerts.
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, settings.maxAlerts)))
  }, [alerts, settings.maxAlerts])

  const loadSecCikMap = useCallback(async () => {
    if (secCikMapRef.current) return secCikMapRef.current
    if (secCikMapLoadRef.current) return secCikMapLoadRef.current

    secCikMapLoadRef.current = (async () => {
      const cached = safeParseJson<SecCikMapV1>(localStorage.getItem("sec_cik_map_v1"))
      const cachedMap = cached?.cikToTicker || null
      if (cachedMap && Object.keys(cachedMap).length) {
        secCikMapRef.current = cachedMap
        return cachedMap
      }

      try {
        const res = await fetchJsonOrThrow<SecCikMapV1>("SEC map", "/sec-cik-map.v1.json", undefined, 25000)
        const map = res?.cikToTicker || null
        if (map && Object.keys(map).length) {
          secCikMapRef.current = map
          try {
            localStorage.setItem("sec_cik_map_v1", JSON.stringify({ generatedAt: res?.generatedAt, cikToTicker: map }))
          } catch {
            // ignore
          }
          return map
        }
      } catch (err) {
        console.warn("SEC CIK map load failed", err)
      }
      return null
    })()

    return secCikMapLoadRef.current
  }, [])

  const unreadCount = useMemo(() => {
    const lastViewed = Number(state.lastViewedAt || 0)
    if (!Number.isFinite(lastViewed) || lastViewed <= 0) return alerts.length
    return alerts.filter((a) => new Date(a.createdAt).getTime() > lastViewed).length
  }, [alerts, state.lastViewedAt])

  const mutedUntilMs = useMemo(() => {
    const raw = Number(state.mutedUntilMs || 0)
    return Number.isFinite(raw) && raw > 0 ? raw : 0
  }, [state.mutedUntilMs])

  useEffect(() => {
    if (!mutedUntilMs) return
    const remaining = mutedUntilMs - Date.now()
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (!prev.mutedUntilMs) return prev
        return { ...prev, mutedUntilMs: 0 }
      })
    }, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [mutedUntilMs])

  const isMuted = mutedUntilMs > 0

  const muteForMs = useCallback((ms: number) => {
    const dur = Math.max(0, Number(ms) || 0)
    if (!dur) {
      setState((prev) => ({ ...prev, mutedUntilMs: 0 }))
      return
    }
    setState((prev) => ({ ...prev, mutedUntilMs: Date.now() + dur }))
  }, [])

  const muteUntilEndOfDay = useCallback(() => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    setState((prev) => ({ ...prev, mutedUntilMs: end.getTime() }))
  }, [])

  const unmute = useCallback(() => {
    setState((prev) => ({ ...prev, mutedUntilMs: 0 }))
  }, [])

  const markAllRead = useCallback(() => {
    setState((prev) => ({ ...prev, lastViewedAt: Date.now() }))
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
    setState((prev) => ({ ...prev, lastViewedAt: Date.now() }))
  }, [])

  const emptyWatchlistToastShownRef = useRef(false)
  const emptyWatchlistToastIdRef = useRef<string | number | null>(null)

  const pollNow = useCallback(async () => {
    if (!settings.enabled) return
    if (!finnewsBase && !stockpulseBase) return

    const watchlist = getOpenbbWatchlistSnapshot()
    const prefs = loadOpenbbWatchlistAlertPrefs()

    // If nothing is configured, don’t spam the user; show a single guidance toast.
    if (!watchlist.length) {
      if (!emptyWatchlistToastShownRef.current) {
        const id = toast.message(
          "No watchlist symbols yet. Run a Trader lookup or add symbols in OpenBB → Watchlist to enable alerts."
        )
        emptyWatchlistToastIdRef.current = id
        emptyWatchlistToastShownRef.current = true
      }
      return
    }
    if (emptyWatchlistToastIdRef.current !== null) {
      toast.dismiss(emptyWatchlistToastIdRef.current)
      emptyWatchlistToastIdRef.current = null
    }
    emptyWatchlistToastShownRef.current = false

    const wantsByTicker = new Map<
      string,
      { filings: boolean; rating: boolean; rsi: boolean }
    >()
    watchlist.forEach((t) => {
      const keys = new Set((prefs[t] || []).map(normalizeAlertKey))
      const hasExplicit = keys.size > 0
      wantsByTicker.set(t, {
        filings: hasExplicit ? keys.has("filings") : settings.enableFilings,
        rating: hasExplicit ? keys.has("rating") : settings.enableRatingChanges,
        rsi: hasExplicit ? keys.has("rsi") : settings.enableRsiThresholds,
      })
    })

    const needsFilings = settings.enableFilings && Array.from(wantsByTicker.values()).some((w) => w.filings)
    const needsRatings = (settings.enableRatingChanges || settings.enableRsiThresholds) && Array.from(wantsByTicker.values()).some((w) => w.rating || w.rsi)

    const [cikToTicker, finnewsItems, ratings] = await (async () => {
      const cik = needsFilings ? await loadSecCikMap() : null
      const items = needsFilings && finnewsBase
        ? await fetchJsonOrThrow<any>("Finnews", `${finnewsBase}/api/v1/news/latest?limit=200`, undefined, 30000)
        : []
      const r = needsRatings && stockpulseBase
        ? await fetchJsonOrThrow<any>("StockPulse", `${stockpulseBase}/api/ai/ratings`, undefined, 30000)
        : []
      return [cik, Array.isArray(items) ? (items as FinnewsItem[]) : [], Array.isArray(r) ? (r as StockpulseRating[]) : []] as const
    })()

    const nowIso = new Date().toISOString()
    const nextAlerts: InAppAlert[] = []

    const lastFilingKey = { ...(state.lastFilingKeyByTicker || {}) }
    const lastRating = { ...(state.lastRatingByTicker || {}) }
    const lastRsiBucket = { ...(state.lastRsiBucketByTicker || {}) }

    const bootstrapped = Boolean(state.bootstrapped)

    // Filings
    if (needsFilings && finnewsItems.length) {
      for (const [ticker, wants] of wantsByTicker.entries()) {
        if (!wants.filings) continue
        const match = finnewsItems.find((it) => {
          const url = it.url || it.source_url || ""
          if (!isSecUrl(url)) return false
          const derived = deriveFinnewsTickers(it, cikToTicker)
          return derived.includes(ticker)
        })
        if (!match) continue
        const key = String(match.id || match.url || match.source_url || "")
        if (!key) continue

        const prev = lastFilingKey[ticker]
        lastFilingKey[ticker] = key
        if (!bootstrapped || !prev) continue
        if (prev === key) continue

        nextAlerts.push({
          id: `filing:${ticker}:${key}`,
          type: "filing",
          ticker,
          title: `New SEC filing for ${ticker}`,
          body: match.title,
          url: match.url || match.source_url || undefined,
          createdAt: nowIso,
        })
      }
    }

    // Ratings + RSI
    if (needsRatings && ratings.length) {
      const byTicker = new Map<string, StockpulseRating>()
      ratings.forEach((r) => {
        const t = normalizeTicker(r.ticker)
        if (t) byTicker.set(t, r)
      })

      for (const [ticker, wants] of wantsByTicker.entries()) {
        const r = byTicker.get(ticker)
        if (!r) continue

        if (wants.rating) {
          const cur = String(r.rating || "").trim()
          if (cur) {
            const prev = lastRating[ticker]
            lastRating[ticker] = cur
            if (bootstrapped && prev && prev !== cur) {
              nextAlerts.push({
                id: `rating:${ticker}:${prev}->${cur}:${nowIso}`,
                type: "rating",
                ticker,
                title: `Rating changed: ${ticker}`,
                body: `${prev} → ${cur} (score ${typeof r.score === "number" ? r.score.toFixed(1) : "—"})`,
                createdAt: nowIso,
              })
            }
          }
        }

        if (wants.rsi && typeof r.rsi === "number" && Number.isFinite(r.rsi)) {
          const oversold = clampNumber(settings.rsiOversold, 1, 60, DEFAULT_SETTINGS.rsiOversold)
          const overbought = clampNumber(settings.rsiOverbought, 40, 99, DEFAULT_SETTINGS.rsiOverbought)
          const bucket = computeRsiBucket(r.rsi, oversold, overbought)
          const prevBucket = lastRsiBucket[ticker]
          lastRsiBucket[ticker] = bucket
          if (bootstrapped && prevBucket && prevBucket !== bucket && bucket !== "neutral") {
            nextAlerts.push({
              id: `rsi:${ticker}:${prevBucket}->${bucket}:${nowIso}`,
              type: "rsi",
              ticker,
              title: `RSI ${bucket}: ${ticker}`,
              body: `RSI ${r.rsi.toFixed(1)} (thresholds ${oversold}/${overbought})`,
              createdAt: nowIso,
            })
          }
        }
      }
    }

    if (!bootstrapped) {
      // First successful poll should initialize last-seen state without spamming alerts.
      setState((prev) => ({
        ...prev,
        bootstrapped: true,
        lastFilingKeyByTicker: lastFilingKey,
        lastRatingByTicker: lastRating,
        lastRsiBucketByTicker: lastRsiBucket,
      }))
      return
    }

    if (nextAlerts.length) {
      const merged = [...nextAlerts, ...alerts].reduce<InAppAlert[]>((acc, a) => {
        if (acc.some((x) => x.id === a.id)) return acc
        acc.push(a)
        return acc
      }, [])

      merged.sort(newestFirst)
      const truncated = merged.slice(0, settings.maxAlerts)
      setAlerts(truncated)

      setState((prev) => ({
        ...prev,
        lastFilingKeyByTicker: lastFilingKey,
        lastRatingByTicker: lastRating,
        lastRsiBucketByTicker: lastRsiBucket,
      }))

      if (settings.toastOnNew && !isMuted) {
        nextAlerts.slice(0, 3).forEach((a) => toast.message(a.title))
      }
    } else {
      setState((prev) => ({
        ...prev,
        lastFilingKeyByTicker: lastFilingKey,
        lastRatingByTicker: lastRating,
        lastRsiBucketByTicker: lastRsiBucket,
      }))
    }
  }, [
    alerts,
    finnewsBase,
    isMuted,
    loadSecCikMap,
    settings,
    state.bootstrapped,
    state.lastFilingKeyByTicker,
    state.lastRatingByTicker,
    state.lastRsiBucketByTicker,
    stockpulseBase,
  ])

  // Poll loop
  useEffect(() => {
    if (!settings.enabled) return
    const id = window.setInterval(() => {
      void pollNow().catch((err) => console.warn("alert poll failed", err))
    }, settings.pollIntervalSec * 1000)
    return () => window.clearInterval(id)
  }, [pollNow, settings.enabled, settings.pollIntervalSec])

  return {
    settings,
    setSettings,
    alerts,
    unreadCount,
    isMuted,
    mutedUntilMs,
    muteForMs,
    muteUntilEndOfDay,
    unmute,
    openbbBase,
    finnewsBase,
    stockpulseBase,
    pollNow,
    clearAlerts,
    markAllRead,
  }
}
