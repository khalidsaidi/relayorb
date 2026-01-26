const admin = require("firebase-admin")
const http = require("http")
const crypto = require("crypto")
const fs = require("fs")
const { GoogleAuth } = require("google-auth-library")
const { createCircuitBreaker } = require("../../shared/circuit-breaker")
const { generateRequestId, withRequestId, createRequestLogger } = require("../../shared/request-id")
const { buildTradeContext } = require("./context")
const { resolveEntryBehavior } = require("./behaviors/entry")
const { resolveExitBehavior } = require("./behaviors/exit")
const { resolveSessionBehavior } = require("./behaviors/session")

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  port: parseInt(process.env.PORT || "8080", 10),
  marketDataGatewayUrl: process.env.MARKET_DATA_GATEWAY_URL || "",
  marketDataGatewayAuth: process.env.MARKET_DATA_GATEWAY_AUTH !== "false",
  marketDataGatewayAudience: process.env.MARKET_DATA_GATEWAY_AUDIENCE || "",
  tickMs: parseInt(process.env.ORB_TICK_MS || "15000", 10),
  clockCacheMs: parseInt(process.env.ORB_CLOCK_CACHE_MS || "5000", 10),
  requestTtlMs: parseInt(process.env.ORB_REQUEST_TTL_MS || "120000", 10),
  atrPeriod: parseInt(process.env.ORB_ATR_PERIOD || "14", 10),
  candleLookbackLimit: parseInt(process.env.ORB_CANDLE_LOOKBACK_LIMIT || "600", 10),
  universeScanLimit: parseInt(process.env.ORB_UNIVERSE_SCAN_LIMIT || "200", 10),
  requestedByUid: process.env.ORB_REQUESTED_BY_UID || "system-orb",
  bracketStopLossPct: parseFloat(process.env.ORB_STOP_LOSS_PCT || "2"),
  bracketTakeProfitPct: parseFloat(process.env.ORB_TAKE_PROFIT_PCT || "4"),
}

const DEFAULT_DAILY_PROFILE = {
  mode: "daily_universe",
  universe: {
    price_min: 10,
    price_max: 80,
    min_dollar_volume: 50_000_000,
    max_symbols: 10,
  },
  symbols: {
    include: ["AMD"],
    exclude: [],
  },
  session: {
    type: "RTH",
    include_premarket: false,
    include_afterhours: false,
  },
  orb: {
    range_minutes: 1,
    entry_delay_minutes: 15,
    breakout_check_interval_minutes: null,
  },
  entry: {
    type: "ORB_RAW",
    atr_buffer_pct: 0.0,
    confirmation_bars: 1,
  },
  exit: {
    type: "FIXED_STOP",
    stop_pct: 2,
    time_stop_minutes: null,
    force_flat_minutes_before_close: 5,
  },
  risk: {
    max_trades_per_day: 10,
    max_trades_per_symbol_per_day: 1,
    reentry_cooldown_minutes: 0,
    position_pct: 0.1,
    max_daily_loss_pct: 2.0,
  },
}

const DEFAULT_SINGLE_PROFILE = {
  mode: "single_symbol",
  universe: DEFAULT_DAILY_PROFILE.universe,
  symbols: {
    include: ["AMD"],
    exclude: [],
  },
  session: DEFAULT_DAILY_PROFILE.session,
  orb: {
    range_minutes: 15,
    entry_delay_minutes: 1,
    breakout_check_interval_minutes: null,
  },
  entry: {
    type: "ORB_VWAP",
    atr_buffer_pct: 0.0,
    confirmation_bars: 1,
  },
  exit: {
    type: "TRAILING_STOP",
    stop_pct: 0.8,
    time_stop_minutes: null,
    force_flat_minutes_before_close: 5,
  },
  risk: {
    max_trades_per_day: 1,
    max_trades_per_symbol_per_day: 1,
    reentry_cooldown_minutes: 0,
    position_pct: 0.1,
    max_daily_loss_pct: 2.0,
  },
}

const ORB_CONTROLS_COLLECTION = "orbControls"
const ORB_STATE_COLLECTION = "orbStates"

const REQUEST_SOURCE = "orb"
const REQUEST_STRATEGY = "orb_profile"

const EXPECTED_REGION = "us-west1"
const DMI_PRODUCT_PATHS = [
  "/sys/class/dmi/id/product_name",
  "/sys/devices/virtual/dmi/id/product_name",
]
const DMI_VENDOR_PATHS = [
  "/sys/class/dmi/id/sys_vendor",
  "/sys/devices/virtual/dmi/id/sys_vendor",
]

function assertRemoteOnly(serviceName) {
  const isCloudRun = Boolean(
    process.env.K_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.CLOUD_RUN_TASK_INDEX ||
      process.env.CLOUD_RUN_TASK_ATTEMPT
  )
  const isGce = isGceVm()
  if (!isCloudRun && !isGce) {
    console.error(`Refusing to start ${serviceName} locally.`)
    process.exit(1)
  }
}

function readDmiValue(paths) {
  for (const path of paths) {
    try {
      if (fs.existsSync(path)) {
        return String(fs.readFileSync(path, "utf8")).trim()
      }
    } catch (_) {
      continue
    }
  }
  return ""
}

function isGceVm() {
  const product = readDmiValue(DMI_PRODUCT_PATHS).toLowerCase()
  const vendor = readDmiValue(DMI_VENDOR_PATHS).toLowerCase()
  return product.includes("google") || vendor.includes("google")
}

function extractRegionFromResource(value) {
  if (!value) return ""
  const match = value.match(/\/locations\/([^/]+)/)
  return match ? match[1] : ""
}

function resolveRuntimeRegion() {
  return (
    process.env.RUN_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    process.env.CLOUD_RUN_REGION ||
    process.env.GCP_REGION ||
    process.env.FUNCTION_REGION ||
    process.env.FUNCTIONS_REGION ||
    process.env.LOCATION ||
    process.env.REGION ||
    extractRegionFromResource(process.env.EVENTARC_CLOUD_EVENT_SOURCE) ||
    extractRegionFromResource(process.env.EVENTARC_EVENT_SOURCE) ||
    ""
  )
}

function assertUsWest1(serviceName) {
  const region = resolveRuntimeRegion()
  if (region !== EXPECTED_REGION) {
    console.error(
      `Refusing to start ${serviceName} outside ${EXPECTED_REGION} (got: ${
        region || "unknown"
      }).`
    )
    process.exit(1)
  }
}

assertRemoteOnly("orb-runner")
assertUsWest1("orb-runner")

if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId })
}

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue
const gatewayAuth = new GoogleAuth()
let gatewayAuthClient = null

// Circuit breaker for market-data-gateway calls
const gatewayCircuitBreaker = createCircuitBreaker("market-data-gateway", {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds before attempting recovery
  onStateChange: (oldState, newState, status) => {
    console.log(`Gateway circuit breaker: ${oldState} -> ${newState}`, status)
  },
  onFailure: (error) => {
    console.error("Gateway circuit breaker recorded failure:", error.message)
  },
})

const ET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const ET_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
})
const ET_WEEKDAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}
const US_STOCK_HOLIDAYS_2026_2027 = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
])
const US_STOCK_EARLY_CLOSES_2026_2027 = new Set([
  "2026-07-02",
  "2026-11-27",
  "2026-12-24",
  "2027-07-02",
  "2027-11-26",
])

function getEtParts(date) {
  const parts = ET_FORMATTER.formatToParts(date)
  const map = {}
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value
    }
  })
  const year = Number(map.year)
  const month = Number(map.month)
  const day = Number(map.day)
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  return { year, month, day, hour, minute }
}

function getEtDateKey(date) {
  const { year, month, day } = getEtParts(date)
  const yyyy = String(year).padStart(4, "0")
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getEtTimeMinutes(date) {
  const { hour, minute } = getEtParts(date)
  return hour * 60 + minute
}

function getEtWeekday(date) {
  const key = ET_WEEKDAY_FORMATTER.format(date)
  return ET_WEEKDAY_MAP[key] ?? 0
}

function isEtWeekend(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  const day = getEtWeekday(date)
  return day === 0 || day === 6
}

function isUsStockHoliday(dateKey) {
  return US_STOCK_HOLIDAYS_2026_2027.has(dateKey)
}

function resolveStockSessionCloseMinutes(dateKey) {
  return US_STOCK_EARLY_CLOSES_2026_2027.has(dateKey) ? 13 * 60 : 16 * 60
}

function formatEtMinutes(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

function resolveStockMarketStatus(asOf = new Date()) {
  const dateKey = getEtDateKey(asOf)
  const openMinutes = 9 * 60 + 30
  const closeMinutes = resolveStockSessionCloseMinutes(dateKey)
  const minutes = getEtTimeMinutes(asOf)
  if (isEtWeekend(dateKey)) {
    return { isOpen: false, status: "weekend", dateKey, openMinutes, closeMinutes, minutes }
  }
  if (isUsStockHoliday(dateKey)) {
    return { isOpen: false, status: "holiday", dateKey, openMinutes, closeMinutes, minutes }
  }
  const isOpen = minutes >= openMinutes && minutes <= closeMinutes
  return {
    isOpen,
    status: isOpen ? "open" : "closed",
    dateKey,
    openMinutes,
    closeMinutes,
    minutes,
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const clockCache = { value: null, expiresAt: 0 }

function normalizeClockPayload(payload) {
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error ? String(payload.error) : "Clock unavailable")
  }
  const mode = payload?.mode === "replay" ? "replay" : "live"
  const nowMs = parseNumber(payload?.nowMs) ?? parseNumber(payload?.asOfMs)
  if (!Number.isFinite(nowMs)) {
    throw new Error("Clock payload missing nowMs")
  }
  return {
    mode,
    now: new Date(nowMs),
    nowMs,
    replay: payload?.replay && typeof payload.replay === "object" ? payload.replay : null,
    source: "gateway",
  }
}

async function resolveClock() {
  const nowMs = Date.now()
  if (clockCache.value && clockCache.expiresAt > nowMs) {
    return clockCache.value
  }
  let clock = null
  let error = null
  if (config.marketDataGatewayUrl) {
    try {
      const payload = await fetchGatewayJson("/clock")
      clock = normalizeClockPayload(payload)
    } catch (err) {
      error = err
    }
  }
  if (!clock) {
    clock = {
      mode: "live",
      now: new Date(),
      nowMs: Date.now(),
      replay: null,
      source: "system",
    }
  }
  if (error) {
    clock.error = error?.message ? String(error.message) : String(error)
  }
  clockCache.value = clock
  const cacheMs = Number.isFinite(config.clockCacheMs) ? config.clockCacheMs : 5000
  clockCache.expiresAt = Date.now() + Math.max(cacheMs, 1000)
  return clock
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function resolveGatewayAudience() {
  if (config.marketDataGatewayAudience) return config.marketDataGatewayAudience
  if (!config.marketDataGatewayUrl) return ""
  return config.marketDataGatewayUrl.replace(/\/+$/, "")
}

async function getGatewayAuthHeaders() {
  if (!config.marketDataGatewayUrl || !config.marketDataGatewayAuth) return null
  const audience = resolveGatewayAudience()
  if (!audience) return null
  try {
    if (!gatewayAuthClient) {
      gatewayAuthClient = await gatewayAuth.getIdTokenClient(audience)
    }
    return await gatewayAuthClient.getRequestHeaders()
  } catch (err) {
    console.error("Gateway auth header fetch failed:", err?.message || err)
    return null
  }
}

function resolveGatewayBase() {
  if (!config.marketDataGatewayUrl) {
    throw new Error("MARKET_DATA_GATEWAY_URL is not configured")
  }
  return config.marketDataGatewayUrl.endsWith("/")
    ? config.marketDataGatewayUrl
    : `${config.marketDataGatewayUrl}/`
}

function buildGatewayUrl(path, params) {
  const base = resolveGatewayBase()
  const normalizedPath = String(path || "").replace(/^\/+/, "")
  const url = new URL(normalizedPath, base)
  if (params) {
    url.search = new URLSearchParams(params).toString()
  }
  return url.toString()
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

function normalizeAuthHeaders(headers) {
  if (!headers) return {}
  if (typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries())
  }
  return { ...headers }
}

async function fetchGatewayJson(path, params, requestId) {
  return gatewayCircuitBreaker.execute(async () => {
    const url = buildGatewayUrl(path, params)
    const authHeaders = await getGatewayAuthHeaders()
    const reqId = requestId || generateRequestId()
    const headers = withRequestId(reqId, {
      headers: normalizeAuthHeaders(authHeaders),
    }).headers
    return fetchJson(url, { headers })
  })
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeSymbolList(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : []
  const seen = new Set()
  list.forEach((item) => {
    const symbol = normalizeTicker(item)
    if (symbol) seen.add(symbol)
  })
  return Array.from(seen)
}

function resolveStrategyProfile(rawControls) {
  const rawProfile = rawControls?.strategyProfile || {}
  const legacySymbol = normalizeTicker(rawControls?.singleSymbol)
  const legacySingleMode = rawControls?.singleSymbolMode === true && Boolean(legacySymbol)
  const requestedMode =
    rawProfile.mode === "single_symbol" || legacySingleMode ? "single_symbol" : "daily_universe"
  const base = deepClone(
    requestedMode === "single_symbol" ? DEFAULT_SINGLE_PROFILE : DEFAULT_DAILY_PROFILE
  )

  const rawUniverse = rawProfile.universe || {}
  const priceMin = parseNumber(rawUniverse.price_min) ?? parseNumber(rawControls?.priceMin)
  const priceMax = parseNumber(rawUniverse.price_max) ?? parseNumber(rawControls?.priceMax)
  const minDollarVolume =
    parseNumber(rawUniverse.min_dollar_volume) ?? parseNumber(rawControls?.minDollarVolume)
  const maxSymbols =
    parseNumber(rawUniverse.max_symbols) ?? parseNumber(rawControls?.maxSymbols)

  const rawSymbols = rawProfile.symbols || {}
  let include = normalizeSymbolList(rawSymbols.include)
  const exclude = normalizeSymbolList(rawSymbols.exclude)

  if (!include.length && legacySymbol) {
    include = [legacySymbol]
  }
  if (!include.length && base.symbols.include.length) {
    include = base.symbols.include.slice()
  }

  const filteredInclude = include.filter((symbol) => !exclude.includes(symbol))

  const session = rawProfile.session || {}
  const sessionType = String(session.type || base.session.type).toUpperCase()

  const orbRangeMinutes = clamp(
    Math.round(
      parseNumber(rawProfile.orb?.range_minutes) ??
        parseNumber(rawControls?.openingRangeMinutes) ??
        base.orb.range_minutes
    ),
    1,
    60
  )
  const entryDelayMinutes = clamp(
    Math.round(
      parseNumber(rawProfile.orb?.entry_delay_minutes) ??
        parseNumber(rawControls?.breakoutDelayMinutes) ??
        base.orb.entry_delay_minutes
    ),
    0,
    60
  )
  const breakoutCheckIntervalRaw = parseNumber(rawProfile.orb?.breakout_check_interval_minutes)
  const breakoutCheckIntervalMinutes =
    typeof breakoutCheckIntervalRaw === "number" && breakoutCheckIntervalRaw > 0
      ? clamp(Math.round(breakoutCheckIntervalRaw), 1, 60)
      : null

  const entryType = String(rawProfile.entry?.type || base.entry.type).toUpperCase()
  const atrBufferPctRaw =
    parseNumber(rawProfile.entry?.atr_buffer_pct) ?? base.entry.atr_buffer_pct
  const atrBufferPct = Math.max(0, atrBufferPctRaw)
  const confirmationBars = clamp(
    Math.round(
      parseNumber(rawProfile.entry?.confirmation_bars) ?? base.entry.confirmation_bars
    ),
    1,
    10
  )

  const exitType = String(rawProfile.exit?.type || base.exit.type).toUpperCase()
  const stopPctRaw =
    parseNumber(rawProfile.exit?.stop_pct) ??
    parseNumber(rawControls?.stopLossPct) ??
    base.exit.stop_pct
  const stopPct = typeof stopPctRaw === "number" && stopPctRaw > 0 ? stopPctRaw : base.exit.stop_pct
  const timeStopMinutesRaw = parseNumber(rawProfile.exit?.time_stop_minutes)
  const timeStopMinutes =
    typeof timeStopMinutesRaw === "number" && timeStopMinutesRaw > 0
      ? Math.round(timeStopMinutesRaw)
      : null
  const forceFlatMinutes = clamp(
    Math.round(
      parseNumber(rawProfile.exit?.force_flat_minutes_before_close) ??
        parseNumber(rawControls?.liquidateMinutesBeforeClose) ??
        base.exit.force_flat_minutes_before_close
    ),
    1,
    60
  )

  const maxTradesFallback =
    requestedMode === "daily_universe"
      ? clamp(Math.round(maxSymbols ?? base.universe.max_symbols), 1, 200)
      : base.risk.max_trades_per_day
  const maxTradesRaw =
    parseNumber(rawProfile.risk?.max_trades_per_day) ??
    parseNumber(rawControls?.maxBreakouts) ??
    maxTradesFallback
  const maxTradesPerDay = clamp(Math.round(maxTradesRaw), 1, 200)
  const maxTradesPerSymbolRaw = parseNumber(rawProfile.risk?.max_trades_per_symbol_per_day)
  const maxTradesPerSymbol =
    typeof maxTradesPerSymbolRaw === "number"
      ? clamp(Math.round(maxTradesPerSymbolRaw), 1, 50)
      : clamp(Math.round(base.risk.max_trades_per_symbol_per_day ?? 1), 1, 50)
  const reentryCooldownRaw = parseNumber(rawProfile.risk?.reentry_cooldown_minutes)
  const reentryCooldownMinutes =
    typeof reentryCooldownRaw === "number"
      ? clamp(Math.round(reentryCooldownRaw), 0, 240)
      : clamp(Math.round(base.risk.reentry_cooldown_minutes ?? 0), 0, 240)
  const positionPct = clamp(
    parseNumber(rawProfile.risk?.position_pct) ??
      parseNumber(rawControls?.positionSizePct) ??
      base.risk.position_pct,
    0.01,
    1
  )
  const maxDailyLossPct = clamp(
    parseNumber(rawProfile.risk?.max_daily_loss_pct) ?? base.risk.max_daily_loss_pct,
    0,
    100
  )

  return {
    mode: requestedMode,
    universe: {
      price_min:
        typeof priceMin === "number" ? Math.max(priceMin, 0) : base.universe.price_min,
      price_max:
        typeof priceMax === "number" ? Math.max(priceMax, 0) : base.universe.price_max,
      min_dollar_volume:
        typeof minDollarVolume === "number"
          ? Math.max(minDollarVolume, 0)
          : base.universe.min_dollar_volume,
      max_symbols:
        typeof maxSymbols === "number"
          ? clamp(Math.round(maxSymbols), 1, 50)
          : base.universe.max_symbols,
    },
    symbols: {
      include: filteredInclude,
      exclude,
    },
    session: {
      type: sessionType === "RTH" ? "RTH" : base.session.type,
      include_premarket: session.include_premarket === true,
      include_afterhours: session.include_afterhours === true,
    },
    orb: {
      range_minutes: orbRangeMinutes,
      entry_delay_minutes: entryDelayMinutes,
      breakout_check_interval_minutes: breakoutCheckIntervalMinutes,
    },
    entry: {
      type: entryType,
      atr_buffer_pct: atrBufferPct,
      confirmation_bars: confirmationBars,
    },
    exit: {
      type: exitType,
      stop_pct: stopPct,
      time_stop_minutes: timeStopMinutes,
      force_flat_minutes_before_close: forceFlatMinutes,
    },
    risk: {
      max_trades_per_day: maxTradesPerDay,
      max_trades_per_symbol_per_day: maxTradesPerSymbol,
      reentry_cooldown_minutes: reentryCooldownMinutes,
      position_pct: positionPct,
      max_daily_loss_pct: maxDailyLossPct,
    },
  }
}

function resolveControls(raw, brokerAccountKey) {
  const parsed = raw || {}
  const resolvedAccountKey = brokerAccountKey || parsed.brokerAccountKey || ""
  return {
    enabled: parsed.enabled === true,
    brokerAccountKey: resolvedAccountKey,
    mode: parsed.mode === "live" ? "live" : "paper",
    strategyProfile: resolveStrategyProfile(parsed),
    orderType: parsed.orderType === "market" ? "market" : "limit",
    updatedByUid: parsed.updatedByUid || null,
  }
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function resolvePrimarySymbol(profile) {
  const include = Array.isArray(profile?.symbols?.include) ? profile.symbols.include : []
  return include.length ? include[0] : null
}

function buildScheduleLabels(dateKey, openMinutes, closeMinutes, profile) {
  const openRangeMinute = openMinutes + profile.orb.range_minutes
  const breakoutMinute = openMinutes + profile.orb.entry_delay_minutes
  const entryMinute = openRangeMinute + profile.orb.entry_delay_minutes
  const liquidationMinute = closeMinutes - profile.exit.force_flat_minutes_before_close
  return {
    nextOpenRangeLabel: `${dateKey} ${formatEtMinutes(openRangeMinute)} ET`,
    nextBreakoutLabel: `${dateKey} ${formatEtMinutes(breakoutMinute)} ET`,
    nextEntryLabel: `${dateKey} ${formatEtMinutes(entryMinute)} ET`,
    nextLiquidationLabel: `${dateKey} ${formatEtMinutes(liquidationMinute)} ET`,
  }
}

function labelsChanged(state, labels) {
  if (!state) return true
  return Object.entries(labels).some(([key, value]) => state?.[key] !== value)
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await mapper(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}

function resolveCandleLimit(market) {
  const sessionMinutes = Math.max(market.closeMinutes - market.openMinutes, 60)
  const limit = clamp(sessionMinutes + 30, 60, config.candleLookbackLimit)
  return clamp(limit, 1, 500)
}

async function fetchCandles(symbol, limit) {
  const payload = await fetchGatewayJson("/v1/fmp/candles", {
    symbol,
    assetClass: "stock",
    interval: "1min",
    limit: String(limit),
  })
  const candles = Array.isArray(payload?.candles) ? payload.candles : []
  return candles
    .map((entry) => {
      const time = parseNumber(entry?.time)
      const open = parseNumber(entry?.open)
      const high = parseNumber(entry?.high)
      const low = parseNumber(entry?.low)
      const close = parseNumber(entry?.close)
      if (!time || open === undefined || high === undefined || low === undefined || close === undefined) {
        return null
      }
      return {
        time,
        open,
        high,
        low,
        close,
        volume: parseNumber(entry?.volume) ?? 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time)
}

async function fetchQuoteDetails(symbols) {
  if (!symbols.length) return new Map()
  const uniqueSymbols = Array.from(
    new Set(symbols.map((symbol) => normalizeTicker(symbol)).filter(Boolean))
  )
  const results = await mapWithConcurrency(uniqueSymbols, 6, async (symbol) => {
    try {
      const payload = await fetchGatewayJson("/v1/fmp/quote", {
        symbol,
        assetClass: "stock",
      })
      const normalized = normalizeTicker(payload?.symbol || symbol)
      const price = parseNumber(payload?.price)
      const volume = parseNumber(payload?.volume) ?? parseNumber(payload?.avgVolume)
      if (!normalized || typeof price !== "number") return null
      return { symbol: normalized, price, volume }
    } catch {
      return null
    }
  })
  const map = new Map()
  results.forEach((entry) => {
    if (entry?.symbol) {
      map.set(entry.symbol, entry)
    }
  })
  return map
}

async function fetchQuoteMap(symbols) {
  const details = await fetchQuoteDetails(symbols)
  const map = new Map()
  details.forEach((entry, symbol) => {
    if (typeof entry?.price === "number") {
      map.set(symbol, entry.price)
    }
  })
  return map
}

async function fetchReplayTapeSymbols(datasetId) {
  if (!datasetId) return []
  const payload = await fetchGatewayJson("/replay/tapeSymbols", { datasetId })
  const symbols = Array.isArray(payload?.symbols) ? payload.symbols : []
  return symbols.map((symbol) => normalizeTicker(symbol)).filter(Boolean)
}

async function fetchUniverse(profile, clock) {
  const universe = profile?.universe || DEFAULT_DAILY_PROFILE.universe
  const maxSymbols = clamp(Math.round(universe.max_symbols || 1), 1, 50)
  const limit = clamp(Math.max(maxSymbols * 20, 60), 50, Math.max(config.universeScanLimit, 100))
  const isReplayMode = clock?.mode === "replay"
  const replayDatasetId =
    isReplayMode && clock?.replay?.datasetId ? clock.replay.datasetId : null
  let candidates = []
  let quoteDetails = new Map()

  if (isReplayMode && !replayDatasetId) {
    throw new Error("Replay datasetId missing; cannot build universe")
  }

  if (replayDatasetId) {
    const symbols = await fetchReplayTapeSymbols(replayDatasetId)
    const limitedSymbols = symbols.slice(0, limit)
    quoteDetails = await fetchQuoteDetails(limitedSymbols)
    candidates = limitedSymbols
      .map((symbol) => {
        const quote = quoteDetails.get(symbol)
        const price = parseNumber(quote?.price)
        const volume = parseNumber(quote?.volume)
        if (!symbol || !price || !volume) return null
        return {
          symbol,
          price,
          volume,
          exchange: null,
          name: null,
        }
      })
      .filter(Boolean)
  } else {
    const payload = await fetchGatewayJson("/v1/fmp/most-actives", {
      limit: String(limit),
    })
    const items = Array.isArray(payload?.data) ? payload.data : []
    candidates = items
      .map((item) => {
        const symbol = normalizeTicker(item.symbol)
        const price = parseNumber(item.price)
        const volume = parseNumber(item.volume)
        if (!symbol || !price) return null
        return {
          symbol,
          price,
          volume,
          exchange: item.exchange || item.exchangeShortName || null,
          name: item.name || item.companyName || null,
        }
      })
      .filter(Boolean)
    if (candidates.length) {
      quoteDetails = await fetchQuoteDetails(candidates.map((item) => item.symbol))
    }
  }

  if (!candidates.length) return []

  const minPrice = Math.min(universe.price_min, universe.price_max)
  const maxPrice = Math.max(universe.price_min, universe.price_max)
  const minDollarVolume = isReplayMode ? 0 : universe.min_dollar_volume
  const filtered = candidates
    .map((item) => {
      const quote = quoteDetails.get(item.symbol)
      const price = parseNumber(quote?.price) ?? item.price
      const volume = parseNumber(quote?.volume) ?? item.volume
      if (!price || !volume) return null
      const dollarVolume = price * volume
      return { ...item, price, volume, dollarVolume }
    })
    .filter(Boolean)
    .filter((item) => {
      if (!item) return false
      if (item.price < minPrice || item.price > maxPrice) return false
      return item.dollarVolume >= minDollarVolume
    })
    .sort((a, b) => b.dollarVolume - a.dollarVolume)

  return filtered.slice(0, maxSymbols)
}

function filterSessionCandles(candles, market, asOf) {
  if (!Array.isArray(candles)) return []
  const cutoff = asOf ? asOf.getTime() : Date.now()
  return candles.filter((candle) => {
    if (!candle?.time || candle.time > cutoff) return false
    const date = new Date(candle.time)
    if (getEtDateKey(date) !== market.dateKey) return false
    const minutes = getEtTimeMinutes(date)
    if (minutes < market.openMinutes || minutes > market.closeMinutes) return false
    return true
  })
}

function computeOrbRange(candles, market, rangeMinutes) {
  const start = market.openMinutes
  const end = market.openMinutes + rangeMinutes
  const ranged = candles.filter((candle) => {
    const minutes = getEtTimeMinutes(new Date(candle.time))
    return minutes >= start && minutes < end
  })
  if (!ranged.length) return null
  let high = -Infinity
  let low = Infinity
  ranged.forEach((candle) => {
    if (typeof candle.high === "number") high = Math.max(high, candle.high)
    if (typeof candle.low === "number") low = Math.min(low, candle.low)
  })
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null
  return { high, low, startMinute: start, endMinute: end }
}

function computeVwap(candles) {
  let totalVolume = 0
  let totalPriceVolume = 0
  candles.forEach((candle) => {
    const volume = parseNumber(candle?.volume) ?? 0
    if (!Number.isFinite(volume) || volume <= 0) return
    const price = (candle.high + candle.low + candle.close) / 3
    totalPriceVolume += price * volume
    totalVolume += volume
  })
  if (!totalVolume) return null
  return totalPriceVolume / totalVolume
}

function computeAtr(candles, period) {
  if (!Array.isArray(candles) || candles.length < 2) return null
  const length = Math.min(period, candles.length - 1)
  const start = candles.length - length
  let total = 0
  let counted = 0
  for (let index = start; index < candles.length; index += 1) {
    const current = candles[index]
    const previous = candles[index - 1]
    if (!current || !previous) continue
    const highLow = current.high - current.low
    const highClose = Math.abs(current.high - previous.close)
    const lowClose = Math.abs(current.low - previous.close)
    const range = Math.max(highLow, highClose, lowClose)
    if (!Number.isFinite(range)) continue
    total += range
    counted += 1
  }
  if (!counted) return null
  return total / counted
}

function computeBarsSinceBreakout(candles, orbRange, market, rangeMinutes) {
  if (!orbRange || typeof orbRange.high !== "number") return 0
  const startMinute = market.openMinutes + rangeMinutes
  let count = 0
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    const candle = candles[index]
    if (!candle) continue
    const minutes = getEtTimeMinutes(new Date(candle.time))
    if (minutes < startMinute) break
    if (candle.close > orbRange.high) {
      count += 1
    } else {
      break
    }
  }
  return count
}

async function fetchQuote(symbol) {
  const payload = await fetchGatewayJson("/v1/fmp/quote", {
    symbol,
    assetClass: "stock",
  })
  return {
    price: parseNumber(payload?.price),
    volume: parseNumber(payload?.volume) ?? parseNumber(payload?.avgVolume),
  }
}

function resolveCurrentPrice(quote, candles) {
  const price = parseNumber(quote?.price)
  if (typeof price === "number") return price
  const last = candles.length ? candles[candles.length - 1] : null
  return typeof last?.close === "number" ? last.close : null
}

async function loadTradingControls() {
  const ref = db.doc("trading/controls")
  const snap = await ref.get()
  return snap.exists ? snap.data() : null
}

async function loadBrokerAccount(brokerAccountKey) {
  const ref = db.doc(`brokerAccounts/${brokerAccountKey}`)
  const snap = await ref.get()
  return snap.exists ? snap.data() : null
}

async function loadAccountSummary(brokerAccountKey) {
  const ref = db.doc(`brokerAccountSummaries/${brokerAccountKey}`)
  const snap = await ref.get()
  return snap.exists ? snap.data() : null
}

async function loadOpenPositions(brokerAccountKey, symbols) {
  if (!symbols.length) return []
  const symbolSet = new Set(symbols)
  const snapshot = await db
    .collection("brokerPositions")
    .where("brokerAccountKey", "==", brokerAccountKey)
    .where("isOpen", "==", true)
    .get()
  const rows = snapshot.docs.map((doc) => doc.data())
  return rows.filter((row) => symbolSet.has(row.symbol))
}

function resolveOrderQuantity(price, positionPct, accountSummary) {
  const netLiq = accountSummary?.values?.netLiquidation
  const buyingPower = accountSummary?.values?.buyingPower
  const baseValue = parseNumber(netLiq) ?? parseNumber(buyingPower) ?? 0
  const notional = baseValue * positionPct
  if (!Number.isFinite(notional) || notional <= 0) return 1
  const qty = Math.floor(notional / price)
  return qty > 0 ? qty : 1
}

function resolveOrderType(tradingControls, controls) {
  if (tradingControls?.limitOnly) return "limit"
  return controls?.orderType === "market" ? "market" : "limit"
}

function resolveBracket(price, initialStop, tradingControls) {
  if (!tradingControls?.requireBracket) {
    return { stopLoss: undefined, takeProfit: undefined }
  }
  const stopLoss =
    typeof initialStop === "number"
      ? initialStop
      : price * (1 - config.bracketStopLossPct / 100)
  const takeProfit = price * (1 + config.bracketTakeProfitPct / 100)
  return { stopLoss, takeProfit }
}

function resolveRequesterUid(controls, brokerAccount) {
  const candidates = [controls?.updatedByUid, config.requestedByUid].filter(Boolean)
  const allowedUids = Array.isArray(brokerAccount?.allowedUids) ? brokerAccount.allowedUids : []
  if (allowedUids.length) {
    const match = candidates.find((uid) => allowedUids.includes(uid))
    return match || allowedUids[0] || candidates[0] || config.requestedByUid
  }
  return candidates[0] || config.requestedByUid
}

function applyCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization")
  res.setHeader("Access-Control-Max-Age", "86400")
}

const controlsByAccount = new Map()
const stateByAccount = new Map()
let runInProgress = false

async function updateOrbState(brokerAccountKey, patch) {
  const current = stateByAccount.get(brokerAccountKey) || {}
  stateByAccount.set(brokerAccountKey, { ...current, ...(patch || {}) })
  await db.doc(`${ORB_STATE_COLLECTION}/${brokerAccountKey}`).set(
    {
      ...patch,
      brokerAccountKey,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

async function recordRunRequested() {
  const targets = Array.from(controlsByAccount.entries())
    .filter(([, controls]) => controls?.enabled === true)
    .map(([accountKey]) => accountKey)
  if (!targets.length) return
  await Promise.all(
    targets.map((accountKey) =>
      updateOrbState(accountKey, {
        lastRunRequestedAt: FieldValue.serverTimestamp(),
        lastRunRequestedSource: "manual",
      })
    )
  )
}

async function ensureStateDoc(brokerAccountKey) {
  const ref = db.doc(`${ORB_STATE_COLLECTION}/${brokerAccountKey}`)
  const snap = await ref.get()
  if (snap.exists) return
  await ref.set(
    {
      brokerAccountKey,
      status: "idle",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

async function createExecutionRequest({
  brokerAccountKey,
  mode,
  symbol,
  side,
  quantity,
  orderType,
  limitPrice,
  stopLoss,
  takeProfit,
  accountCode,
  sessionKey,
  requestedByUid,
  strategy,
}) {
  const id = createId()
  const now = Date.now()
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + config.requestTtlMs)
  const resolvedRequestedBy = requestedByUid || config.requestedByUid
  const assetKey = `stock:${symbol}`
  const orderSnapshot = {
    symbol,
    assetClass: "stock",
    assetKey,
    side,
    quantity,
    orderType,
    limitPrice: orderType === "limit" ? limitPrice : undefined,
    stopLoss,
    takeProfit,
    timeInForce: "DAY",
  }
  const payload = {
    id,
    brokerAccountKey,
    proposalId: `orb:${brokerAccountKey}:${sessionKey}:${symbol}:${now}`,
    requestedByUid: resolvedRequestedBy,
    approvedByUid: resolvedRequestedBy,
    ibAccountCodeSnapshot: accountCode || undefined,
    approvedAt: FieldValue.serverTimestamp(),
    mode: mode || "paper",
    status: "approved",
    orderSnapshot,
    expiresAt,
    source: REQUEST_SOURCE,
    strategy: strategy || REQUEST_STRATEGY,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await db.doc(`executionRequests/${id}`).set(payload)
  return id
}

async function requestOrderCancel(orderId, requestedByUid) {
  if (!orderId) return
  await db.doc(`brokerOrders/${orderId}`).set(
    {
      cancelRequested: true,
      cancelRequestedAt: FieldValue.serverTimestamp(),
      cancelRequestedBy: requestedByUid || null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

async function runDailyUniverseCycle({
  accountKey,
  resolvedControls,
  profile,
  market,
  now,
  clock,
  labels,
  getState,
  setState,
}) {
  let state = getState()
  const needsReset = state?.sessionKey !== market.dateKey || state?.mode !== "daily_universe"
  if (needsReset) {
    state = {
      sessionKey: market.dateKey,
      mode: "daily_universe",
      status: "running",
      universe: [],
      universeDateKey: null,
      lastUniverseAt: null,
      orbHighs: {},
      orbLows: {},
      lastOpenRangeAt: null,
      lastBreakoutAt: null,
      lastLiquidationAt: null,
      tradePlaced: [],
      tradeCounts: {},
      lastTradeMinutes: {},
      tradesToday: 0,
      lastBreakoutCheckMinute: null,
      lastError: null,
    }
    await setState({
      status: "running",
      sessionKey: market.dateKey,
      mode: "daily_universe",
      universe: [],
      universeDateKey: null,
      lastUniverseAt: null,
      orbHighs: {},
      orbLows: {},
      lastOpenRangeAt: null,
      lastBreakoutAt: null,
      lastLiquidationAt: null,
      tradePlaced: [],
      tradeCounts: {},
      lastTradeMinutes: {},
      tradesToday: 0,
      lastBreakoutCheckMinute: null,
      lastError: null,
      ...labels,
    })
  } else if (state?.status !== "running" || labelsChanged(state, labels)) {
    await setState({ status: "running", mode: "daily_universe", ...labels })
  }

  state = getState()
  const premarket = market.minutes < market.openMinutes
  const needsUniverse = state?.universeDateKey !== market.dateKey
  const allowLateUniverse = clock?.mode === "replay" && !premarket && needsUniverse
  if (premarket || allowLateUniverse) {
    if (needsUniverse) {
      try {
        const universe = await fetchUniverse(profile, clock)
        await setState({
          universe,
          universeDateKey: market.dateKey,
          lastUniverseAt: FieldValue.serverTimestamp(),
          lastError: universe.length ? null : "Universe empty after filter",
        })
      } catch (error) {
        await setState({ lastError: `Universe fetch failed: ${error.message}` })
      }
    }
    if (premarket) {
      return
    }
    if (allowLateUniverse) {
      return
    }
  }

  const universe = Array.isArray(state?.universe) ? state.universe : []
  if (!universe.length) {
    await setState({ lastError: "Universe not set before open" })
    return
  }

  const inSession = market.minutes >= market.openMinutes && market.minutes <= market.closeMinutes
  const openRangeMinute = market.openMinutes + profile.orb.range_minutes
  const hasOrbHighs = Object.keys(state?.orbHighs || {}).length > 0
  const inRangeWindow = market.minutes >= market.openMinutes && market.minutes < openRangeMinute
  const shouldFinalizeRange =
    inSession && market.minutes >= openRangeMinute && (!state?.lastOpenRangeAt || !hasOrbHighs)
  const shouldUpdateRange = inSession && (inRangeWindow || shouldFinalizeRange)
  if (shouldUpdateRange) {
    try {
      const limit = resolveCandleLimit(market)
      const results = await mapWithConcurrency(universe, 5, async (item) => {
        const candles = await fetchCandles(item.symbol, limit)
        const sessionCandles = filterSessionCandles(candles, market, now)
        const orbRange = computeOrbRange(sessionCandles, market, profile.orb.range_minutes)
        if (!orbRange) return null
        return { symbol: item.symbol, high: orbRange.high, low: orbRange.low }
      })
      const orbHighs = {}
      const orbLows = {}
      results.forEach((entry) => {
        if (entry?.symbol && typeof entry.high === "number") {
          orbHighs[entry.symbol] = entry.high
          orbLows[entry.symbol] = entry.low ?? null
        }
      })
      const hasRanges = Object.keys(orbHighs).length > 0
      const nextOrbHighs = hasRanges ? orbHighs : (state?.orbHighs || {})
      const nextOrbLows = hasRanges ? orbLows : (state?.orbLows || {})
      const payload = {
        orbHighs: nextOrbHighs,
        orbLows: nextOrbLows,
      }
      if (shouldFinalizeRange) {
        payload.lastOpenRangeAt = hasRanges ? FieldValue.serverTimestamp() : null
        payload.lastError = hasRanges ? null : "ORB range empty"
      } else if (hasRanges) {
        payload.lastError = null
      }
      await setState(payload)
    } catch (error) {
      await setState({ lastError: `ORB range failed: ${error.message}` })
    }
  }

  state = getState()
  const breakoutStartMinute = market.openMinutes + profile.orb.entry_delay_minutes
  const breakoutInterval = Number.isFinite(profile.orb.breakout_check_interval_minutes)
    ? profile.orb.breakout_check_interval_minutes
    : 0
  const rangeComplete = Boolean(state?.lastOpenRangeAt)
  const shouldCheckBreakout =
    rangeComplete &&
    inSession &&
    market.minutes >= breakoutStartMinute &&
    (breakoutInterval > 0
      ? typeof state?.lastBreakoutCheckMinute !== "number" ||
        market.minutes - state.lastBreakoutCheckMinute >= breakoutInterval
      : !state?.lastBreakoutAt)

  if (shouldCheckBreakout) {
    const orbHighs = state?.orbHighs || {}
    if (!Object.keys(orbHighs).length) {
      await setState({
        lastBreakoutAt: FieldValue.serverTimestamp(),
        lastBreakoutCheckMinute: market.minutes,
        lastError: "Breakout skipped: ORB highs missing",
      })
    } else {
      const tradingControls = await loadTradingControls()
      if (tradingControls?.ibkrEnabled === false || tradingControls?.killSwitch) {
        await setState({
          lastBreakoutAt: FieldValue.serverTimestamp(),
          lastBreakoutCheckMinute: market.minutes,
          lastError: "Breakout skipped: IBKR disabled or kill switch",
        })
      } else {
        try {
          const symbols = universe.map((item) => item.symbol)
          const priceMap = await fetchQuoteMap(symbols)
          const tradePlaced = new Set(state?.tradePlaced || [])
          const tradeCounts =
            state?.tradeCounts && typeof state.tradeCounts === "object"
              ? { ...state.tradeCounts }
              : {}
          if (!Object.keys(tradeCounts).length && tradePlaced.size) {
            tradePlaced.forEach((symbol) => {
              tradeCounts[symbol] = 1
            })
          }
          const lastTradeMinutes =
            state?.lastTradeMinutes && typeof state.lastTradeMinutes === "object"
              ? { ...state.lastTradeMinutes }
              : {}
          let tradesToday =
            typeof state?.tradesToday === "number"
              ? state.tradesToday
              : Object.values(tradeCounts).reduce(
                  (total, count) => total + (Number.isFinite(count) ? count : 0),
                  0
                )

          const maxTradesPerDay = clamp(
            Math.round(profile.risk.max_trades_per_day ?? 1),
            1,
            200
          )
          const maxTradesPerSymbol = clamp(
            Math.round(profile.risk.max_trades_per_symbol_per_day ?? 1),
            1,
            50
          )
          const cooldownMinutes = clamp(
            Math.round(profile.risk.reentry_cooldown_minutes ?? 0),
            0,
            240
          )

          if (tradesToday >= maxTradesPerDay) {
            await setState({
              lastBreakoutAt: FieldValue.serverTimestamp(),
              lastBreakoutCheckMinute: market.minutes,
              lastError: "Breakout skipped: max trades reached",
            })
            return
          }

          let openSymbols = new Set()
          try {
            const positions = await loadOpenPositions(accountKey, symbols)
            openSymbols = new Set(positions.map((pos) => pos.symbol))
          } catch (error) {
            await setState({ lastError: `Position load failed: ${error.message}` })
          }

          const accountSummary = await loadAccountSummary(accountKey)
          const brokerAccount = await loadBrokerAccount(accountKey)
          const requestedByUid = resolveRequesterUid(resolvedControls, brokerAccount)
          const orderType = resolveOrderType(tradingControls, resolvedControls)

          for (const symbol of symbols) {
            if (tradesToday >= maxTradesPerDay) break
            if (openSymbols.has(symbol)) continue
            const count = Number.isFinite(tradeCounts[symbol]) ? tradeCounts[symbol] : 0
            if (count >= maxTradesPerSymbol) continue
            const lastTradeMinute = lastTradeMinutes[symbol]
            if (
              cooldownMinutes > 0 &&
              Number.isFinite(lastTradeMinute) &&
              market.minutes - lastTradeMinute < cooldownMinutes
            ) {
              continue
            }
            const price = priceMap.get(symbol)
            const high = orbHighs[symbol]
            if (!price || !high) continue
            if (price <= high) continue

            const quantity = resolveOrderQuantity(price, profile.risk.position_pct, accountSummary)
            if (!quantity) continue
            const bracket = resolveBracket(price, null, tradingControls)
            await createExecutionRequest({
              brokerAccountKey: accountKey,
              mode: resolvedControls.mode,
              symbol,
              side: "buy",
              quantity,
              orderType,
              limitPrice: price,
              stopLoss: bracket.stopLoss,
              takeProfit: bracket.takeProfit,
              accountCode: brokerAccount?.ibAccountCode,
              sessionKey: market.dateKey,
              requestedByUid,
              strategy: "orb_universe",
            })

            tradeCounts[symbol] = count + 1
            tradesToday += 1
            lastTradeMinutes[symbol] = market.minutes
            tradePlaced.add(symbol)
          }

          Object.keys(tradeCounts).forEach((symbol) => tradePlaced.add(symbol))

          await setState({
            tradePlaced: Array.from(tradePlaced),
            tradeCounts,
            tradesToday,
            lastTradeMinutes,
            lastBreakoutAt: FieldValue.serverTimestamp(),
            lastBreakoutCheckMinute: market.minutes,
            lastError: null,
          })
        } catch (error) {
          await setState({ lastError: `Breakout failed: ${error.message}` })
        }
      }
    }
  }

  state = getState()
  const liquidationMinute = market.closeMinutes - profile.exit.force_flat_minutes_before_close
  if (inSession && !state?.lastLiquidationAt && market.minutes >= liquidationMinute) {
    const tradedSymbols = Array.isArray(state?.tradePlaced) ? state.tradePlaced : []
    if (!tradedSymbols.length) {
      await setState({
        lastLiquidationAt: FieldValue.serverTimestamp(),
        lastError: null,
      })
      return
    }

    const tradingControls = await loadTradingControls()
    if (tradingControls?.ibkrEnabled === false || tradingControls?.killSwitch) {
      await setState({ lastError: "Liquidation skipped: IBKR disabled or kill switch" })
      return
    }

    try {
      const positions = await loadOpenPositions(accountKey, tradedSymbols)
      if (!positions.length) {
        await setState({
          lastLiquidationAt: FieldValue.serverTimestamp(),
          lastError: null,
        })
        return
      }
      const brokerAccount = await loadBrokerAccount(accountKey)
      const requestedByUid = resolveRequesterUid(resolvedControls, brokerAccount)
      const symbols = positions.map((pos) => pos.symbol)
      const priceMap = await fetchQuoteMap(symbols)
      const orderType = resolveOrderType(tradingControls, resolvedControls)

      for (const pos of positions) {
        const quantity = Math.abs(parseNumber(pos.position) || 0)
        if (!quantity) continue
        const price = priceMap.get(pos.symbol)
        if (!price) continue
        await createExecutionRequest({
          brokerAccountKey: accountKey,
          mode: resolvedControls.mode,
          symbol: pos.symbol,
          side: "sell",
          quantity,
          orderType,
          limitPrice: price,
          stopLoss: undefined,
          takeProfit: undefined,
          accountCode: brokerAccount?.ibAccountCode,
          sessionKey: market.dateKey,
          requestedByUid,
          strategy: "orb_universe",
        })
      }

      await setState({
        lastLiquidationAt: FieldValue.serverTimestamp(),
        lastError: null,
      })
    } catch (error) {
      await setState({ lastError: `Liquidation failed: ${error.message}` })
    }
  }
}

async function runOrbCycleForAccount(brokerAccountKey, controls, clock) {
  const resolvedControls = controls || resolveControls({}, brokerAccountKey)
  const accountKey = resolvedControls.brokerAccountKey || brokerAccountKey
  if (!accountKey) return

  let state = stateByAccount.get(accountKey) || {}
  const setState = async (patch) => {
    state = { ...state, ...(patch || {}) }
    await updateOrbState(accountKey, patch)
  }
  const getState = () => state

  const now =
    clock?.now instanceof Date && Number.isFinite(clock?.now?.getTime?.())
      ? clock.now
      : new Date()
  const nowMs = now.getTime()
  const market = resolveStockMarketStatus(now)
  const profile = resolvedControls.strategyProfile
  const mode = profile.mode === "single_symbol" ? "single_symbol" : "daily_universe"
  const labels = buildScheduleLabels(
    market.dateKey,
    market.openMinutes,
    market.closeMinutes,
    profile
  )

  const symbol = mode === "single_symbol" ? resolvePrimarySymbol(profile) : null

  if (!resolvedControls.enabled) {
    if (
      state?.status !== "idle" ||
      state?.sessionKey !== market.dateKey ||
      labelsChanged(state, labels)
    ) {
      await setState({
        status: "idle",
        sessionKey: market.dateKey,
        symbol: symbol || null,
        mode,
        ...labels,
      })
    }
    return
  }

  if (market.status === "weekend" || market.status === "holiday") {
    if (
      state?.status !== "idle" ||
      state?.sessionKey !== market.dateKey ||
      labelsChanged(state, labels)
    ) {
      await setState({
        status: "idle",
        sessionKey: market.dateKey,
        symbol: symbol || null,
        mode,
        ...labels,
      })
    }
    return
  }

  if (mode === "daily_universe") {
    await runDailyUniverseCycle({
      accountKey,
      resolvedControls,
      profile,
      market,
      now,
      clock,
      labels,
      getState,
      setState,
    })
    return
  }

  if (!symbol) {
    await setState({
      status: "error",
      sessionKey: market.dateKey,
      symbol: null,
      mode,
      lastError: "No symbol configured",
      ...labels,
    })
    return
  }

  const needsReset = state?.sessionKey !== market.dateKey || state?.symbol !== symbol
  if (needsReset) {
    state = {
      sessionKey: market.dateKey,
      symbol,
      status: "running",
      tradesToday: 0,
      entryPending: false,
      exitPending: false,
      inPosition: false,
      entryPrice: null,
      entryTimeMs: null,
      entryRequestId: null,
      exitRequestId: null,
      activeStop: null,
      orbRange: null,
      barsSinceBreakout: 0,
      sessionStartNetLiq: null,
      lastOpenRangeAt: null,
      lastEntryCheckAt: null,
      lastEntryAt: null,
      lastExitAt: null,
      lastForceFlatAt: null,
      lastLiquidationAt: null,
      lastError: null,
    }
    await setState({
      status: "running",
      sessionKey: market.dateKey,
      symbol,
      mode,
      tradesToday: 0,
      entryPending: false,
      exitPending: false,
      inPosition: false,
      entryPrice: null,
      entryTimeMs: null,
      entryRequestId: null,
      exitRequestId: null,
      activeStop: null,
      orbRange: null,
      barsSinceBreakout: 0,
      sessionStartNetLiq: null,
      lastOpenRangeAt: null,
      lastEntryCheckAt: null,
      lastEntryAt: null,
      lastExitAt: null,
      lastForceFlatAt: null,
      lastLiquidationAt: null,
      lastError: null,
      ...labels,
    })
  } else if (state?.status !== "running" || labelsChanged(state, labels)) {
    await setState({ status: "running", symbol, mode, ...labels })
  }

  const sessionBehavior = resolveSessionBehavior(profile.session)
  const sessionActive = sessionBehavior.isActive(now, market)
  const rangeEndMinute = market.openMinutes + profile.orb.range_minutes
  const entryStartMinute = rangeEndMinute + profile.orb.entry_delay_minutes
  const forceFlatMinute = market.closeMinutes - profile.exit.force_flat_minutes_before_close

  if (market.minutes < market.openMinutes) {
    return
  }

  let positions = []
  try {
    positions = await loadOpenPositions(accountKey, [symbol])
  } catch (error) {
    await setState({ lastError: `Position load failed: ${error.message}` })
  }

  const activePosition = positions.find((pos) => pos.symbol === symbol)
  const positionQty = parseNumber(activePosition?.position) || 0
  const inPosition = positionQty > 0

  if (activePosition && positionQty < 0) {
    await setState({ lastError: "Short position detected; ORB is long-only." })
    return
  }

  if (inPosition !== state?.inPosition) {
    await setState({ inPosition })
  }

  if (!inPosition && state?.inPosition) {
    await setState({
      entryPending: false,
      exitPending: false,
      entryPrice: null,
      entryTimeMs: null,
      entryRequestId: null,
      exitRequestId: null,
      activeStop: null,
    })
  }

  if (inPosition && state?.entryPending) {
    await setState({ entryPending: false })
  }

  if (inPosition && !state?.entryPrice) {
    const inferredEntry =
      parseNumber(activePosition?.avgCost) ??
      parseNumber(activePosition?.marketPrice) ??
      null
    if (inferredEntry) {
      await setState({ entryPrice: inferredEntry })
    }
  }

  if (inPosition && !state?.entryTimeMs) {
    await setState({ entryTimeMs: nowMs })
  }

  let accountSummary = null
  if (!state?.sessionStartNetLiq && market.minutes >= market.openMinutes) {
    try {
      accountSummary = await loadAccountSummary(accountKey)
      const netLiq = parseNumber(accountSummary?.values?.netLiquidation)
      if (typeof netLiq === "number" && netLiq > 0) {
        await setState({ sessionStartNetLiq: netLiq })
      }
    } catch (error) {
      await setState({ lastError: `Account summary load failed: ${error.message}` })
    }
  }

  let cachedCandles = null
  let cachedQuote = null
  let cachedSnapshot = null

  async function loadSessionCandles() {
    if (cachedCandles) return cachedCandles
    const limit = resolveCandleLimit(market)
    const candles = await fetchCandles(symbol, limit)
    cachedCandles = filterSessionCandles(candles, market, now)
    return cachedCandles
  }

  async function loadQuote() {
    if (cachedQuote) return cachedQuote
    cachedQuote = await fetchQuote(symbol)
    return cachedQuote
  }

  async function getMarketSnapshot() {
    if (cachedSnapshot) return cachedSnapshot
    const candles = await loadSessionCandles()
    const quote = await loadQuote()
    const price = resolveCurrentPrice(quote, candles)
    const vwap = computeVwap(candles)
    const atr = computeAtr(candles, config.atrPeriod)
    const barsSinceBreakout = state?.orbRange
      ? computeBarsSinceBreakout(candles, state.orbRange, market, profile.orb.range_minutes)
      : 0
    cachedSnapshot = {
      candles,
      price,
      vwap,
      atr,
      barsSinceBreakout,
    }
    return cachedSnapshot
  }

  const shouldCaptureRange =
    !state?.orbRange && market.minutes >= rangeEndMinute && market.minutes <= market.closeMinutes

  if (shouldCaptureRange) {
    try {
      const candles = await loadSessionCandles()
      const orbRange = computeOrbRange(candles, market, profile.orb.range_minutes)
      if (orbRange) {
        await setState({
          orbRange,
          lastOpenRangeAt: FieldValue.serverTimestamp(),
          lastError: null,
        })
      } else {
        await setState({ lastError: "ORB range unavailable." })
      }
    } catch (error) {
      await setState({ lastError: `ORB range failed: ${error.message}` })
    }
  }

  const forceFlatWindow = market.minutes >= forceFlatMinute && market.minutes <= market.closeMinutes

  if (forceFlatWindow) {
    if (inPosition && !state?.exitPending) {
      const tradingControls = await loadTradingControls()
      if (tradingControls?.ibkrEnabled === false) {
        await setState({ lastError: "Force-flat skipped: IBKR disabled" })
        return
      }
      try {
        const snapshot = await getMarketSnapshot()
        if (!snapshot.price) {
          await setState({ lastError: "Force-flat skipped: price unavailable" })
          return
        }
        const brokerAccount = await loadBrokerAccount(accountKey)
        const requestedByUid = resolveRequesterUid(resolvedControls, brokerAccount)
        const orderType = resolveOrderType(tradingControls, resolvedControls)

        const exitRequestId = await createExecutionRequest({
          brokerAccountKey: accountKey,
          mode: resolvedControls.mode,
          symbol,
          side: "sell",
          quantity: Math.abs(positionQty),
          orderType,
          limitPrice: snapshot.price,
          stopLoss: undefined,
          takeProfit: undefined,
          accountCode: brokerAccount?.ibAccountCode,
          sessionKey: market.dateKey,
          requestedByUid,
          strategy: "orb_single_symbol",
        })

        if (state?.entryRequestId) {
          await requestOrderCancel(state.entryRequestId, requestedByUid)
        }

        await setState({
          exitPending: true,
          exitRequestId,
          lastExitAt: FieldValue.serverTimestamp(),
          lastForceFlatAt: FieldValue.serverTimestamp(),
          lastError: null,
        })
      } catch (error) {
        await setState({ lastError: `Force-flat failed: ${error.message}` })
      }
    }

    if (state?.entryPending && !inPosition && state?.entryRequestId) {
      try {
        const brokerAccount = await loadBrokerAccount(accountKey)
        const requestedByUid = resolveRequesterUid(resolvedControls, brokerAccount)
        await requestOrderCancel(state.entryRequestId, requestedByUid)
        await setState({
          entryPending: false,
          entryRequestId: null,
          lastError: "Entry cancelled before close",
        })
      } catch (error) {
        await setState({ lastError: `Entry cancel failed: ${error.message}` })
      }
    }

    return
  }

  if (sessionActive && market.minutes >= entryStartMinute && market.minutes < forceFlatMinute) {
    await setState({ lastEntryCheckAt: FieldValue.serverTimestamp() })

    if (!state?.orbRange) {
      await setState({ lastError: "Entry skipped: ORB range not ready" })
    } else if (state?.tradesToday >= profile.risk.max_trades_per_day) {
      await setState({ lastError: "Entry skipped: max trades reached" })
    } else if (state?.entryPending) {
      await setState({ lastError: "Entry skipped: entry pending" })
    } else if (inPosition) {
      await setState({ lastError: "Entry skipped: already in position" })
    } else {
      try {
        if (!accountSummary) {
          accountSummary = await loadAccountSummary(accountKey)
        }
        const netLiq = parseNumber(accountSummary?.values?.netLiquidation)
        const startNetLiq = parseNumber(state?.sessionStartNetLiq)
        if (
          typeof startNetLiq === "number" &&
          startNetLiq > 0 &&
          typeof netLiq === "number" &&
          netLiq > 0
        ) {
          const drawdownPct = ((startNetLiq - netLiq) / startNetLiq) * 100
          if (drawdownPct >= profile.risk.max_daily_loss_pct) {
            await setState({ lastError: "Entry skipped: daily loss limit hit" })
            return
          }
        }

        const snapshot = await getMarketSnapshot()
        if (!snapshot.price) {
          await setState({ lastError: "Entry skipped: price unavailable" })
          return
        }

        const entryBehavior = resolveEntryBehavior(profile.entry.type, {
          atrBufferPct: profile.entry.atr_buffer_pct,
          confirmationBars: profile.entry.confirmation_bars,
        })
        const exitBehavior = resolveExitBehavior(profile.exit.type, {
          stopPct: profile.exit.stop_pct,
          timeStopMinutes: profile.exit.time_stop_minutes,
        })

        const context = buildTradeContext({
          symbol,
          price: snapshot.price,
          orbRange: state.orbRange,
          vwap: snapshot.vwap,
          atr: snapshot.atr,
          time: now,
          entryPrice: snapshot.price,
          entryTime: null,
          barsSinceBreakout: snapshot.barsSinceBreakout,
        })

        await setState({
          lastPrice: snapshot.price,
          vwap: snapshot.vwap,
          atr: snapshot.atr,
          barsSinceBreakout: snapshot.barsSinceBreakout,
        })

        if (!entryBehavior.shouldEnter(context)) {
          return
        }

        const tradingControls = await loadTradingControls()
        if (tradingControls?.ibkrEnabled === false || tradingControls?.killSwitch) {
          await setState({ lastError: "Entry skipped: IBKR disabled or kill switch" })
          return
        }

        const brokerAccount = await loadBrokerAccount(accountKey)
        const requestedByUid = resolveRequesterUid(resolvedControls, brokerAccount)
        const orderType = resolveOrderType(tradingControls, resolvedControls)
        const quantity = resolveOrderQuantity(
          snapshot.price,
          profile.risk.position_pct,
          accountSummary
        )
        const initialStop = exitBehavior.initialStop(context)
        const bracket = resolveBracket(snapshot.price, initialStop, tradingControls)

        const entryRequestId = await createExecutionRequest({
          brokerAccountKey: accountKey,
          mode: resolvedControls.mode,
          symbol,
          side: "buy",
          quantity,
          orderType,
          limitPrice: snapshot.price,
          stopLoss: bracket.stopLoss,
          takeProfit: bracket.takeProfit,
          accountCode: brokerAccount?.ibAccountCode,
          sessionKey: market.dateKey,
          requestedByUid,
          strategy: "orb_single_symbol",
        })

        await setState({
          entryPending: true,
          entryRequestId,
          tradesToday: (state?.tradesToday || 0) + 1,
          entryPrice: snapshot.price,
          entryTimeMs: nowMs,
          activeStop: typeof initialStop === "number" ? initialStop : null,
          lastEntryAt: FieldValue.serverTimestamp(),
          lastError: null,
        })
      } catch (error) {
        await setState({ lastError: `Entry failed: ${error.message}` })
      }
    }
  }

  if (inPosition && !state?.exitPending) {
    try {
      const snapshot = await getMarketSnapshot()
      if (!snapshot.price) {
        await setState({ lastError: "Exit skipped: price unavailable" })
        return
      }

      const entryTime = state?.entryTimeMs ? new Date(state.entryTimeMs) : null
      const entryPrice = state?.entryPrice ?? snapshot.price
      const exitBehavior = resolveExitBehavior(profile.exit.type, {
        stopPct: profile.exit.stop_pct,
        timeStopMinutes: profile.exit.time_stop_minutes,
      })

      const context = buildTradeContext({
        symbol,
        price: snapshot.price,
        orbRange: state.orbRange,
        vwap: snapshot.vwap,
        atr: snapshot.atr,
        time: now,
        entryPrice,
        entryTime,
        barsSinceBreakout: snapshot.barsSinceBreakout,
      })

      const nextStop = exitBehavior.updateStop(context, state?.activeStop)
      const shouldExit = exitBehavior.shouldExit(context, nextStop)

      const stopChanged =
        typeof nextStop === "number"
          ? nextStop !== state?.activeStop
          : state?.activeStop !== null

      if (stopChanged) {
        await setState({ activeStop: typeof nextStop === "number" ? nextStop : null })
      }

      await setState({
        lastPrice: snapshot.price,
        vwap: snapshot.vwap,
        atr: snapshot.atr,
        barsSinceBreakout: snapshot.barsSinceBreakout,
      })

      if (!shouldExit) {
        return
      }

      const tradingControls = await loadTradingControls()
      if (tradingControls?.ibkrEnabled === false) {
        await setState({ lastError: "Exit skipped: IBKR disabled" })
        return
      }

      const brokerAccount = await loadBrokerAccount(accountKey)
      const requestedByUid = resolveRequesterUid(resolvedControls, brokerAccount)
      const orderType = resolveOrderType(tradingControls, resolvedControls)

      const exitRequestId = await createExecutionRequest({
        brokerAccountKey: accountKey,
        mode: resolvedControls.mode,
        symbol,
        side: "sell",
        quantity: Math.abs(positionQty),
        orderType,
        limitPrice: snapshot.price,
        stopLoss: undefined,
        takeProfit: undefined,
        accountCode: brokerAccount?.ibAccountCode,
        sessionKey: market.dateKey,
        requestedByUid,
        strategy: "orb_single_symbol",
      })

      if (state?.entryRequestId) {
        await requestOrderCancel(state.entryRequestId, requestedByUid)
      }

      await setState({
        exitPending: true,
        exitRequestId,
        lastExitAt: FieldValue.serverTimestamp(),
        lastError: null,
      })
    } catch (error) {
      await setState({ lastError: `Exit failed: ${error.message}` })
    }
  }
}

async function runOrbCycle() {
  if (runInProgress) return
  runInProgress = true
  try {
    const entries = Array.from(controlsByAccount.entries())
    if (!entries.length) return
    const clock = await resolveClock()
    for (const [accountKey, controls] of entries) {
      try {
        await runOrbCycleForAccount(accountKey, controls, clock)
      } catch (error) {
        console.error(`ORB cycle failed for ${accountKey}:`, error.message)
        await updateOrbState(accountKey, { status: "error", lastError: error.message })
      }
    }
  } finally {
    runInProgress = false
  }
}

async function migrateLegacyDocs() {
  const legacyControlsRef = db.doc("orb/controls")
  const legacyStateRef = db.doc("orb/state")
  const legacyControlsSnap = await legacyControlsRef.get()
  if (!legacyControlsSnap.exists) return

  const legacyControls = legacyControlsSnap.data() || {}
  const brokerAccountKey = legacyControls.brokerAccountKey || "acct1"
  if (!brokerAccountKey) return

  const newControlsRef = db.doc(`${ORB_CONTROLS_COLLECTION}/${brokerAccountKey}`)
  const newControlsSnap = await newControlsRef.get()
  if (!newControlsSnap.exists) {
    await newControlsRef.set(
      {
        enabled: false,
        mode: "paper",
        brokerAccountKey,
        strategyProfile: resolveStrategyProfile(legacyControls),
        migratedFrom: "orb/controls",
        migratedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }

  const legacyStateSnap = await legacyStateRef.get()
  if (!legacyStateSnap.exists) return

  const newStateRef = db.doc(`${ORB_STATE_COLLECTION}/${brokerAccountKey}`)
  const newStateSnap = await newStateRef.get()
  if (!newStateSnap.exists) {
    await newStateRef.set(
      {
        ...legacyStateSnap.data(),
        brokerAccountKey,
        migratedFrom: "orb/state",
        migratedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }
}

async function start() {
  await migrateLegacyDocs()

  db.collection(ORB_CONTROLS_COLLECTION).onSnapshot((snap) => {
    snap.docChanges().forEach((change) => {
      const accountKey = change.doc.id
      if (change.type === "removed") {
        controlsByAccount.delete(accountKey)
        return
      }
      const controls = resolveControls(change.doc.data(), accountKey)
      controlsByAccount.set(accountKey, controls)
      ensureStateDoc(accountKey).catch((error) => {
        console.error(`Failed to ensure state doc for ${accountKey}:`, error.message)
      })
    })
  })

  db.collection(ORB_STATE_COLLECTION).onSnapshot((snap) => {
    snap.docChanges().forEach((change) => {
      const accountKey = change.doc.id
      if (change.type === "removed") {
        stateByAccount.delete(accountKey)
        return
      }
      stateByAccount.set(accountKey, change.doc.data() || {})
    })
  })

  setInterval(() => {
    runOrbCycle().catch((err) => console.error("ORB tick error:", err.message))
  }, config.tickMs)

  runOrbCycle().catch((err) => console.error("ORB boot error:", err.message))

  const server = http.createServer(async (req, res) => {
    applyCorsHeaders(res)
    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.url === "/health") {
      const accounts = Array.from(controlsByAccount.entries())
        .map(([accountKey, controls]) => {
          const state = stateByAccount.get(accountKey) || {}
          return {
            brokerAccountKey: accountKey,
            enabled: controls?.enabled === true,
            sessionKey: state?.sessionKey || null,
            status: state?.status || "unknown",
          }
        })
        .sort((a, b) => a.brokerAccountKey.localeCompare(b.brokerAccountKey))
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          ok: true,
          service: "orb-runner",
          accountCount: accounts.length,
          enabled: accounts.some((entry) => entry.enabled),
          accounts,
        })
      )
      return
    }

    if (req.url === "/run" && req.method === "POST") {
      recordRunRequested().catch((err) => {
        console.error("ORB run record failed:", err.message)
      })
      runOrbCycle()
        .then(() => {
          res.writeHead(202, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: true }))
        })
        .catch((err) => {
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ ok: false, error: err.message }))
        })
      return
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
  })

  server.listen(config.port, () => {
    console.log("ORB runner listening", { port: config.port })
  })
}

start().catch((err) => {
  console.error("ORB runner failed to start:", err.message)
  process.exit(1)
})
