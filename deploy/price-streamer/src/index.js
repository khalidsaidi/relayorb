const admin = require("firebase-admin")
const http = require("http")
const crypto = require("crypto")
const fs = require("fs")
const { GoogleAuth } = require("google-auth-library")
const { createClient } = require("redis")
const WebSocket = require("ws")
const { createCircuitBreaker } = require("../../shared/circuit-breaker")
const { generateRequestId, withRequestId, attachRequestId, createRequestLogger } = require("../../shared/request-id")
const STREAM_URLS = (process.env.PRICE_STREAM_URLS || process.env.PRICE_STREAM_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean)
const STREAM_PROVIDERS = (process.env.PRICE_STREAM_PROVIDERS || process.env.PRICE_STREAM_PROVIDER || "")
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean)
const STREAM_SYMBOL_LIMITS = {
  finnhub: parseInt(process.env.PRICE_STREAM_MAX_SYMBOLS_FINNHUB || "10", 10),
  twelvedata: parseInt(process.env.PRICE_STREAM_MAX_SYMBOLS_TWELVEDATA || "120", 10),
  alpaca: parseInt(process.env.PRICE_STREAM_MAX_SYMBOLS_ALPACA || "120", 10),
}
const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  alpacaKey: process.env.ALPACA_API_KEY || process.env.ALPACA_KEY || "",
  alpacaSecret:
    process.env.ALPACA_API_SECRET ||
    process.env.ALPACA_API_SECRET_KEY ||
    process.env.ALPACA_SECRET ||
    "",
  marketDataGatewayUrl: process.env.MARKET_DATA_GATEWAY_URL || "",
  marketDataGatewayAuth: process.env.MARKET_DATA_GATEWAY_AUTH !== "false",
  marketDataGatewayAudience: process.env.MARKET_DATA_GATEWAY_AUDIENCE || "",
  watchlistRefreshMs: parseInt(process.env.WATCHLIST_REFRESH_MS || "60000", 10),
  cryptoPollMs: parseInt(process.env.CRYPTO_POLL_MS || "30000", 10),
  stockPollMs: parseInt(process.env.STOCK_POLL_MS || "30000", 10),
  stockExtendedPollMs: parseInt(process.env.STOCK_EXTENDED_POLL_MS || "300000", 10),
  stockClosedPollMs: parseInt(process.env.STOCK_CLOSED_POLL_MS || "300000", 10),
  forexPollMs: parseInt(process.env.FOREX_POLL_MS || "30000", 10),
  forexClosedPollMs: parseInt(process.env.FOREX_CLOSED_POLL_MS || "1800000", 10),
  writeMs: parseInt(process.env.PRICE_WRITE_MS || "2000", 10),
  maxSymbols: parseInt(process.env.PRICE_STREAM_MAX_SYMBOLS || "120", 10),
  stockStreamTarget: parseInt(process.env.PRICE_STREAM_STOCK_TARGET || "3000", 10),
  stockPollTarget: parseInt(process.env.PRICE_STREAM_STOCK_POLL_TARGET || "600", 10),
  stockUniverseLimit: parseInt(process.env.PRICE_STREAM_STOCK_UNIVERSE_LIMIT || "10000", 10),
  stockUniverseRefreshMs: parseInt(
    process.env.PRICE_STREAM_STOCK_UNIVERSE_REFRESH_MS || "21600000",
    10
  ),
  historyMinutes: parseInt(process.env.PRICE_HISTORY_MINUTES || "120", 10),
  quoteConcurrency: parseInt(process.env.PRICE_STREAM_CONCURRENCY || "5", 10),
  quoteBatchDelayMs: parseInt(process.env.PRICE_STREAM_BATCH_DELAY_MS || "200", 10),
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  redisLatestTtlSeconds: parseInt(process.env.REDIS_LATEST_TTL_SECONDS || "120", 10),
  redisSnapshotTtlSeconds: parseInt(process.env.REDIS_SNAPSHOT_TTL_SECONDS || "1800", 10),
  redisSnapshotMs: parseInt(process.env.REDIS_SNAPSHOT_MS || "60000", 10),
  port: parseInt(process.env.PORT || "8080", 10),
  runId: process.env.RUN_ID || "",
  firestoreRunField: process.env.FIRESTORE_RUN_FIELD || "runId",
  pipelineEventsEnabled: process.env.PIPELINE_EVENTS_ENABLED !== "false",
  pipelineEventsStream: process.env.PIPELINE_EVENTS_STREAM || "",
  pipelineEventsMaxlen: parseInt(process.env.PIPELINE_EVENTS_MAXLEN || "20000", 10),
  pipelineEventsSampleRate: parseFloat(process.env.PIPELINE_EVENTS_SAMPLE_RATE || "0.15"),
  pipelineEventsRunEnv: process.env.PIPELINE_EVENTS_RUN_ENV || "prod",
  replayAllowed: process.env.REPLAY_ALLOWED !== "false",
  replayControlsCacheMs: parseInt(process.env.REPLAY_CONTROLS_CACHE_MS || "1500", 10),
  replayAckIntervalMs: parseInt(process.env.REPLAY_ACK_INTERVAL_MS || "15000", 10),
  replayTickMs: parseInt(process.env.REPLAY_TICK_MS || "1000", 10),
  // Rate limiting for provider-backed quote polling.
  rateLimitPerMinute: parseInt(process.env.PRICE_STREAM_RATE_LIMIT_PER_MINUTE || "300", 10),
  rateLimitWarningPct: parseFloat(process.env.PRICE_STREAM_RATE_LIMIT_WARNING_PCT || "0.83"),
  rateLimitCriticalPct: parseFloat(process.env.PRICE_STREAM_RATE_LIMIT_CRITICAL_PCT || "0.93"),
  stalenessPriceMs: parseInt(process.env.PRICE_STALE_MS || "180000", 10),
  stalenessPollMs: parseInt(
    process.env.PRICE_POLL_STALE_MS || process.env.PRICE_STALE_MS || "180000",
    10
  ),
  stalenessHeartbeatMs: parseInt(process.env.PRICE_HEARTBEAT_STALE_MS || "300000", 10),
  streamEnabled: process.env.PRICE_STREAM_ENABLED === "true",
  streamUrl: process.env.PRICE_STREAM_URL || "",
  streamUrls: STREAM_URLS,
  streamProvider: process.env.PRICE_STREAM_PROVIDER || "",
  streamProviders: STREAM_PROVIDERS,
  streamNames: (process.env.PRICE_STREAMS || "")
    .split(",")
    .map((stream) => stream.trim())
    .filter(Boolean),
  streamFilterEnabled: process.env.PRICE_STREAM_FILTER_ENABLED !== "false",
  streamReconnectMs: parseInt(process.env.PRICE_STREAM_RECONNECT_MS || "1500", 10),
  streamMaxReconnectMs: parseInt(process.env.PRICE_STREAM_MAX_RECONNECT_MS || "30000", 10),
  streamHeartbeatTimeoutMs: parseInt(
    process.env.PRICE_STREAM_HEARTBEAT_TIMEOUT_MS || "30000",
    10
  ),
  streamFailoverCooldownMs: parseInt(
    process.env.PRICE_STREAM_FAILOVER_COOLDOWN_MS || "60000",
    10
  ),
  streamRotateEnabled: process.env.PRICE_STREAM_ROTATE_ENABLED !== "false",
  streamRotateMs: parseInt(process.env.PRICE_STREAM_ROTATE_MS || "60000", 10),
  streamRotateStridePct: parseFloat(process.env.PRICE_STREAM_ROTATE_STRIDE_PCT || "1"),
  streamBlockTtlMs: parseInt(process.env.STREAM_BLOCK_TTL_MS || "3600000", 10),
  streamMaxSymbolsByProvider: STREAM_SYMBOL_LIMITS,
}

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

assertRemoteOnly("price-streamer")
assertUsWest1("price-streamer")

const DEFAULT_UNIVERSE_MODE = "movers_plus_universe"
const UNIVERSE_MODES = new Set([
  "movers_only",
  "universe_only",
  "movers_plus_universe",
  "movers_filtered_by_universe",
  "weighted_union",
])
const FX_CODES = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"])
const STREAM_SYMBOL_TTL_MS = 30 * 60 * 1000

// ============================================================================
// MARKET HOURS SERVICE
// ============================================================================

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

/**
 * Get market status for a given asset class
 * @param {string} assetClass - 'stock', 'crypto', or 'forex'
 * @returns {{ status: string, isOpen: boolean, nextChange: Date | null }}
 */
function getMarketStatus(assetClass) {
  if (assetClass === "crypto") {
    // Crypto markets are always open
    return { status: "open", isOpen: true, nextChange: null }
  }

  const now = new Date()
  const dateKey = getEtDateKey(now)
  const minute = getEtTimeMinutes(now)
  const dayOfWeek = getEtWeekday(now)
  
  if (assetClass === "forex") {
    // Forex: Sunday 5pm ET - Friday 5pm ET
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isFridayAfter5pm = dayOfWeek === 5 && minute >= 17 * 60
    const isSundayBefore5pm = dayOfWeek === 0 && minute < 17 * 60
    
    if (isWeekend && !isSundayBefore5pm && dayOfWeek !== 0) {
      return { status: "closed", isOpen: false, nextChange: null }
    }
    if (isFridayAfter5pm || isSundayBefore5pm) {
      return { status: "closed", isOpen: false, nextChange: null }
    }
    return { status: "open", isOpen: true, nextChange: null }
  }

  // US Stock market
  const isWeekend = isEtWeekend(dateKey)
  const isHoliday = isUsStockHoliday(dateKey)
  
  if (isWeekend || isHoliday) {
    return { status: "closed", isOpen: false, nextChange: null }
  }

  const preMarketStart = 4 * 60
  const regularStart = 9 * 60 + 30
  const regularEnd = resolveStockSessionCloseMinutes(dateKey)
  const afterHoursEnd = 20 * 60

  if (minute < preMarketStart) {
    return { status: "closed", isOpen: false, nextChange: null }
  }
  if (minute < regularStart) {
    return { status: "pre", isOpen: false, nextChange: null }
  }
  if (minute <= regularEnd) {
    return { status: "open", isOpen: true, nextChange: null }
  }
  if (minute < afterHoursEnd) {
    return { status: "after", isOpen: false, nextChange: null }
  }
  return { status: "closed", isOpen: false, nextChange: null }
}

function isMarketOpenForAsset(assetClass, status) {
  if (!status) return false
  if (assetClass === "stock") return status === "open"
  return status === "open"
}

// ============================================================================
// RATE LIMIT TRACKING
// ============================================================================

const rateLimit = {
  callsThisMinute: 0,
  minuteStartedAt: Date.now(),
  callsToday: 0,
  dayStartedAt: Date.now(),
  status: "ok", // 'ok' | 'warning' | 'throttled' | 'exhausted'
}

function resetRateLimitIfNeeded() {
  const now = Date.now()
  // Reset minute counter
  if (now - rateLimit.minuteStartedAt >= 60000) {
    rateLimit.callsThisMinute = 0
    rateLimit.minuteStartedAt = now
    // Reset throttle status
    if (rateLimit.status === "throttled" || rateLimit.status === "exhausted") {
      rateLimit.status = "ok"
    }
  }
  // Reset daily counter
  if (now - rateLimit.dayStartedAt >= 24 * 60 * 60 * 1000) {
    rateLimit.callsToday = 0
    rateLimit.dayStartedAt = now
  }
}

function trackApiCall() {
  resetRateLimitIfNeeded()
  rateLimit.callsThisMinute++
  rateLimit.callsToday++
  
  const utilizationPct = rateLimit.callsThisMinute / config.rateLimitPerMinute
  if (utilizationPct >= config.rateLimitCriticalPct) {
    rateLimit.status = "exhausted"
  } else if (utilizationPct >= config.rateLimitWarningPct) {
    rateLimit.status = "warning"
  } else {
    rateLimit.status = "ok"
  }
}

function canMakeApiCall() {
  if (isReplayMode()) return true
  resetRateLimitIfNeeded()
  return rateLimit.callsThisMinute < config.rateLimitPerMinute
}

function getRateLimitStatus() {
  resetRateLimitIfNeeded()
  return {
    status: rateLimit.status,
    callsThisMinute: rateLimit.callsThisMinute,
    limitPerMinute: config.rateLimitPerMinute,
    utilizationPct: Math.round((rateLimit.callsThisMinute / config.rateLimitPerMinute) * 100),
    callsToday: rateLimit.callsToday,
    throttled: rateLimit.status === "throttled" || rateLimit.status === "exhausted",
  }
}

function getRateLimitRemaining() {
  if (!Number.isFinite(config.rateLimitPerMinute) || config.rateLimitPerMinute <= 0) {
    return 0
  }
  resetRateLimitIfNeeded()
  return Math.max(0, config.rateLimitPerMinute - rateLimit.callsThisMinute)
}

function isPollerActive(assetClass) {
  const watchlist = state?.watchlist?.[assetClass]
  if (!watchlist || watchlist.size === 0) return false
  if (shouldUseStreamFor(assetClass)) return false
  if (assetClass === "stock" || assetClass === "forex") {
    const marketStatus = getMarketStatus(assetClass).status
    if (shouldThrottlePolling(assetClass, marketStatus)) return false
  }
  return true
}

function getActivePollerCount() {
  let count = 0
  for (const assetClass of ["crypto", "stock", "forex"]) {
    if (isPollerActive(assetClass)) count += 1
  }
  return count || 1
}

function getPollBudget(assetClass, pollMs) {
  if (isReplayMode()) return Number.MAX_SAFE_INTEGER
  const limitPerMinute = config.rateLimitPerMinute
  if (!Number.isFinite(limitPerMinute) || limitPerMinute <= 0) return 0
  const pollerCount = getActivePollerCount()
  const perMinute = Math.max(1, Math.floor(limitPerMinute / pollerCount))
  const intervalMs = Math.max(1000, pollMs || 0)
  const pollsPerMinute = Math.max(1, Math.floor(60000 / intervalMs))
  const perPoll = Math.max(1, Math.floor(perMinute / pollsPerMinute))
  return Math.min(perPoll, getRateLimitRemaining())
}

function getPollSlice(assetClass, allSymbols, pollMs) {
  const total = Array.isArray(allSymbols) ? allSymbols.length : 0
  const cursor = state.pollCursor?.[assetClass] || 0
  if (total === 0) return { symbols: [], total, budget: 0, cursor }
  if (isReplayMode()) {
    return { symbols: allSymbols, total, budget: total, cursor }
  }
  const budget = getPollBudget(assetClass, pollMs)
  if (budget <= 0) return { symbols: [], total, budget: 0, cursor }
  if (budget >= total) return { symbols: allSymbols, total, budget, cursor }
  const symbols = []
  for (let i = 0; i < budget; i += 1) {
    symbols.push(allSymbols[(cursor + i) % total])
  }
  return { symbols, total, budget, cursor }
}

function advancePollCursor(assetClass, total, advancedBy) {
  if (!total || total <= 0) return
  if (!Number.isFinite(advancedBy) || advancedBy <= 0) return
  const current = state.pollCursor?.[assetClass] || 0
  state.pollCursor[assetClass] = (current + advancedBy) % total
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId })
}

const db = admin.firestore()
const runId =
  config.runId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const replayControlsCache = { value: null, expiresAt: 0 }
const gatewayAuth = new GoogleAuth()
let gatewayAuthClient = null

// Circuit breaker for market-data-gateway calls
const gatewayCircuitBreaker = createCircuitBreaker("market-data-gateway", {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  onStateChange: (oldState, newState) => {
    console.log(`Gateway circuit breaker: ${oldState} -> ${newState}`)
  },
})

function resolvePipelineStream() {
  if (state?.replay?.mode === "replay" && state.replay.runId) {
    return resolveRedisKey("pipeline_events", state.replay)
  }
  if (config.pipelineEventsStream) return config.pipelineEventsStream
  return resolveRedisKey("pipeline_events", state.replay)
}

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function shouldSample(rate) {
  if (!Number.isFinite(rate)) return false
  if (rate >= 1) return true
  if (rate <= 0) return false
  return Math.random() < rate
}

function hashParams(value) {
  if (!value) return null
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value)
    return crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 12)
  } catch (_) {
    return null
  }
}

async function publishPipelineEvent(event) {
  if (!config.pipelineEventsEnabled || !state.redis || !state.redisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(config.pipelineEventsMaxlen)
    ? Math.max(config.pipelineEventsMaxlen, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ["XADD", stream, "MAXLEN", "~", String(maxlen), "*", "payload", payload]
  try {
    await Promise.race([
      state.redis.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    console.error("Pipeline event publish failed:", err.message)
  }
}

function buildPipelineEvent(payload) {
  const runEnv = state?.replay?.mode === "replay" ? "replay" : config.pipelineEventsRunEnv
  const runId = isReplayMode() ? state?.replay?.runId || undefined : config.runId || undefined
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv,
    runId,
    sessionId: state?.replay?.sessionId || undefined,
    service: "price-streamer",
    severity: "info",
    ...payload,
  }
}

function isReplayMode() {
  return state?.replay?.mode === "replay"
}

function getEffectiveNow() {
  if (isReplayMode() && Number.isFinite(state.replay.asOfMs)) {
    return state.replay.asOfMs
  }
  return Date.now()
}

function parseReplayAsOf(value) {
  if (!value) return null
  if (typeof value.toDate === "function") return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function readReplayControls() {
  if (!config.replayAllowed) return null
  if (replayControlsCache.expiresAt > Date.now() && replayControlsCache.value) {
    return replayControlsCache.value
  }
  try {
    const snap = await db.doc("replay/controls").get()
    const data = snap.exists ? snap.data() : null
    replayControlsCache.value = data
    replayControlsCache.expiresAt = Date.now() + config.replayControlsCacheMs
    return data
  } catch (err) {
    console.error("Replay controls read failed:", err.message)
    return null
  }
}

async function clearReplayRedis(runId) {
  if (!state.redis || !state.redisReady || !runId) return
  try {
    const pattern = `replay:${runId}:prices:snapshot:*`
    const keys = []
    for await (const key of state.redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key)
    }
    if (keys.length) {
      const multi = state.redis.multi()
      keys.forEach((key) => multi.del(key))
      await multi.exec()
    }
    await state.redis.del(`replay:${runId}:prices:latest`)
    await state.redis.del(`replay:${runId}:prices:snapshots`)
  } catch (err) {
    console.error("Replay redis clear failed:", err.message)
  }
}

async function refreshReplayState() {
  const controls = await readReplayControls()
  const desiredMode =
    controls?.desiredMode === "replay" && config.replayAllowed ? "replay" : "live"
  const next = {
    mode: desiredMode,
    desiredMode,
    runId: controls?.activeRunId || null,
    datasetId: controls?.datasetId || null,
    sessionId: controls?.sessionId || null,
    version: controls?.version ?? null,
    phase: controls?.phase || null,
    speedScript: Array.isArray(controls?.speedScript) ? controls.speedScript : [],
    asOfMs: null,
    lastControlsAt: Date.now(),
    lastAckAt: state.replay.lastAckAt,
    lastAckSessionId: state.replay.lastAckSessionId,
    lastAckVersion: state.replay.lastAckVersion,
    lastTickAt: state.replay.lastTickAt,
  }

  const asOf = parseReplayAsOf(controls?.asOf)
  if (asOf) {
    next.asOfMs = asOf.getTime()
  }

  const versionChanged =
    desiredMode === "replay" &&
    state.replay.version !== null &&
    next.version !== null &&
    state.replay.version !== next.version

  const modeChanged = state.replay.mode !== desiredMode
  state.replay = next

  if (modeChanged) {
    state.priceCache.clear()
    state.priceHistory.clear()
    state.dirty = false
    state.replay.lastTickAt = null
  }

  if ((modeChanged || versionChanged) && state.replay.mode === "replay" && state.replay.runId) {
    await clearReplayRedis(state.replay.runId)
  }

  if (modeChanged) {
    if (state.replay.mode === "replay") {
      stopStream("replay_mode")
    } else if (config.streamEnabled) {
      startStream()
    }
  }
}

async function maybeAckReplayState() {
  if (!state.replay || !state.replay.sessionId || !state.replay.version) return
  const now = Date.now()
  if (
    now - state.replay.lastAckAt < config.replayAckIntervalMs &&
    state.replay.lastAckSessionId === state.replay.sessionId &&
    state.replay.lastAckVersion === state.replay.version
  ) {
    return
  }
  try {
    await db.doc("replay/controls/consumers/price-streamer").set(
      {
        serviceName: "price-streamer",
        effectiveMode: state.replay.mode,
        sessionId: state.replay.sessionId,
        seenControlsVersion: state.replay.version,
        activeRunId: state.replay.runId,
        datasetId: state.replay.datasetId,
        phase: state.replay.phase,
        lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    state.replay.lastAckAt = now
    state.replay.lastAckSessionId = state.replay.sessionId
    state.replay.lastAckVersion = state.replay.version
  } catch (err) {
    console.error("Replay ACK failed:", err.message)
  }
}

function resolveReplaySegment(speedScript, asOfMs) {
  if (!Array.isArray(speedScript) || speedScript.length === 0) {
    return { speed: 1 }
  }
  for (const segment of speedScript) {
    if (!segment || typeof segment !== "object") continue
    if (segment.type === "jump" && Number.isFinite(segment.toTs)) {
      if (asOfMs < segment.toTs) {
        return { jumpTo: segment.toTs }
      }
      continue
    }
    const startTs = Number(segment.startTs)
    const endTs = Number(segment.endTs)
    const speed = Number(segment.speed)
    if (Number.isFinite(startTs) && asOfMs < startTs) {
      return { jumpTo: startTs }
    }
    if (
      Number.isFinite(startTs) &&
      Number.isFinite(endTs) &&
      asOfMs >= startTs &&
      asOfMs <= endTs
    ) {
      return { speed: Number.isFinite(speed) ? speed : 1, endTs }
    }
    if (!Number.isFinite(startTs) && !Number.isFinite(endTs) && Number.isFinite(speed)) {
      return { speed }
    }
  }
  return { speed: 1 }
}

async function tickReplayClock() {
  if (!isReplayMode()) return
  if (state.replay.phase !== "running") return
  if (!state.replay.runId || !state.replay.sessionId || !state.replay.version) return
  if (!Number.isFinite(state.replay.asOfMs)) return

  const now = Date.now()
  if (!state.replay.lastTickAt) {
    state.replay.lastTickAt = now
    return
  }
  const deltaReal = now - state.replay.lastTickAt
  const segment = resolveReplaySegment(state.replay.speedScript, state.replay.asOfMs)
  let nextAsOf = state.replay.asOfMs
  if (segment.jumpTo && Number.isFinite(segment.jumpTo)) {
    nextAsOf = segment.jumpTo
  } else {
    const speed = Number.isFinite(segment.speed) ? segment.speed : 1
    nextAsOf = state.replay.asOfMs + deltaReal * speed
    if (segment.endTs && nextAsOf > segment.endTs) {
      nextAsOf = segment.endTs
    }
  }

  state.replay.lastTickAt = now
  if (nextAsOf === state.replay.asOfMs) return

  try {
    const nextDate = new Date(nextAsOf)
    await db.doc("replay/controls").set(
      { asOf: admin.firestore.Timestamp.fromDate(nextDate) },
      { merge: true }
    )
    state.replay.asOfMs = nextAsOf
    if (replayControlsCache.value) {
      replayControlsCache.value = {
        ...replayControlsCache.value,
        asOf: admin.firestore.Timestamp.fromDate(nextDate),
      }
      replayControlsCache.expiresAt = Date.now()
    }
  } catch (err) {
    console.error("Replay asOf update failed:", err.message)
  }
}

const state = {
  watchlist: {
    crypto: new Set(),
    stock: new Set(),
    forex: new Set(),
  },
  priceCache: new Map(),
  priceHistory: new Map(),
  dirty: false,
  lastWatchHash: "",
  lastFlushAt: null,
  lastFlushError: null,
  streamBackoffUntil: 0,
  redis: null,
  redisReady: false,
  lastRedisSnapshotAt: 0,
  // Health tracking
  startedAt: Date.now(),
  lastHeartbeatAt: null,
  consecutiveErrors: 0,
  lastPollAt: {
    crypto: null,
    stock: null,
    forex: null,
  },
  pollInFlight: {
    crypto: false,
    stock: false,
    forex: false,
  },
  pollCursor: {
    crypto: 0,
    stock: 0,
    forex: 0,
  },
  pollErrors: {
    crypto: 0,
    stock: 0,
    forex: 0,
  },
  dataProfile: "normal",
  stockQuoteMode: "auto",
  lastDiscoveryAt: 0,
  stockUniverse: {
    symbols: [],
    updatedAt: 0,
    cursor: 0,
  },
  stream: {
    enabled: config.streamEnabled,
    provider: null,
    providerUrl: null,
    providers: [],
    providerCursor: 0,
    providerMaxSymbols: {},
    providerLimitErrors: {},
    ws: null,
    connecting: false,
    connected: false,
    shouldReconnect: false,
    streams: [],
    streamAssetClass: {},
    authenticated: false,
    lastLoginAt: null,
    lastLoginStatus: null,
    pendingSubscriptions: [],
    subscribedSymbols: new Set(),
    filter: {
      crypto: new Set(),
      stock: new Set(),
      forex: new Set(),
    },
    filterUpdatedAt: 0,
    lastMessageAt: null,
    lastHeartbeatAt: null,
    lastRawMessageAt: null,
    lastAssetMessageAt: {
      crypto: null,
      stock: null,
      forex: null,
    },
    lastQuoteAt: null,
    lastRawSymbol: null,
    lastFilteredAt: null,
    lastFilteredSymbol: null,
    rawMessageCount: 0,
    quoteCount: 0,
    filteredCount: 0,
    parseErrorCount: 0,
    lastParseErrorAt: null,
    lastParseErrorSample: null,
    reconnectDelayMs: config.streamReconnectMs,
    reconnectTimer: null,
    errors: 0,
    lastError: null,
    failoverCount: 0,
    rotationCursor: {},
    rotationTimer: null,
    blockedSymbols: {},
  },
  replay: {
    mode: "live",
    desiredMode: "live",
    runId: null,
    datasetId: null,
    sessionId: null,
    version: null,
    phase: null,
    asOfMs: null,
    speedScript: [],
    lastControlsAt: 0,
    lastAckAt: 0,
    lastAckSessionId: null,
    lastAckVersion: null,
    lastTickAt: null,
  },
}

// Staleness thresholds (in ms)
const STALENESS_THRESHOLDS = {
  price: config.stalenessPriceMs,
  poll: config.stalenessPollMs,
  heartbeat: config.stalenessHeartbeatMs,
}

const DATA_PROFILES = ["normal", "balanced", "survival"]

let server = null

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function resolveTurnoverFilter(controls) {
  const minRaw = parseNumber(controls?.moverTurnoverMinPct)
  const maxRaw = parseNumber(controls?.moverTurnoverMaxPct)
  const minPct = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : null
  const maxPct = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : null
  const scope = controls?.moverTurnoverScope || {}
  const apply = scope.movers !== false && (minPct !== null || maxPct !== null)
  return { minPct, maxPct, apply }
}

function resolveMoverPriceFilter(controls) {
  const minRaw = parseNumber(controls?.moverPriceMin)
  const maxRaw = parseNumber(controls?.moverPriceMax)
  const minPrice = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : null
  const maxPrice = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : null
  const apply = minPrice !== null || maxPrice !== null
  return { minPrice, maxPrice, apply }
}

function resolveDataProfile(controls) {
  const raw = typeof controls?.dataProfile === "string" ? controls.dataProfile.toLowerCase() : ""
  return DATA_PROFILES.includes(raw) ? raw : "normal"
}

function resolveStockQuoteMode(controls) {
  const raw = typeof controls?.stockQuoteMode === "string"
    ? controls.stockQuoteMode.toLowerCase()
    : ""
  if (raw === "stream_only" || raw === "poll_only") return raw
  return "auto"
}

function resolveProfileConfig(profile) {
  switch (profile) {
    case "balanced":
      return {
        discoveryIntervalMs: 5 * 60 * 1000,
        stockListMinMs: Math.max(config.stockUniverseRefreshMs, 24 * 60 * 60 * 1000),
        stockPollMinMs: Math.max(config.stockPollMs, 60 * 1000),
        cryptoPollMinMs: Math.max(config.cryptoPollMs, 60 * 1000),
        forexPollMinMs: Math.max(config.forexPollMs, 60 * 1000),
      }
    case "survival":
      return {
        discoveryIntervalMs: Infinity,
        stockListMinMs: Infinity,
        stockPollMinMs: Math.max(config.stockPollMs, 120 * 1000),
        cryptoPollMinMs: Math.max(config.cryptoPollMs, 120 * 1000),
        forexPollMinMs: Math.max(config.forexPollMs, 120 * 1000),
      }
    default:
      return {
        discoveryIntervalMs: 60 * 1000,
        stockListMinMs: config.stockUniverseRefreshMs,
        stockPollMinMs: config.stockPollMs,
        cryptoPollMinMs: config.cryptoPollMs,
        forexPollMinMs: config.forexPollMs,
      }
  }
}

function resolveRedisKey(suffix, replayState = state.replay) {
  if (replayState?.mode === "replay" && replayState.runId) {
    return `replay:${replayState.runId}:${suffix}`
  }
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}${suffix}`
}

function resolveStreamUrlList() {
  if (Array.isArray(config.streamUrls) && config.streamUrls.length) return config.streamUrls
  if (config.streamUrl) return [config.streamUrl]
  return []
}

function resolveStreamProviderForUrl(url, index) {
  const explicitList = Array.isArray(config.streamProviders) ? config.streamProviders : []
  const explicitAtIndex = explicitList[index]
  const explicit = String(explicitAtIndex || config.streamProvider || "").trim().toLowerCase()
  if (explicit) return explicit
  const lower = String(url || "").toLowerCase()
  if (lower.includes("finnhub.io")) return "finnhub"
  return "generic"
}

function ensureStreamProviders() {
  if (!state.stream) return []
  const urls = resolveStreamUrlList()
  const next = urls.map((url, index) => {
    const provider = resolveStreamProviderForUrl(url, index)
    const existing = state.stream.providers.find(
      (entry) => entry.url === url && entry.provider === provider
    )
    return {
      url,
      provider,
      cooldownUntil: existing?.cooldownUntil || 0,
      failures: existing?.failures || 0,
      lastFailureAt: existing?.lastFailureAt || null,
    }
  })
  state.stream.providers = next
  if (state.stream.providerCursor >= next.length) {
    state.stream.providerCursor = 0
  }
  return next
}

function pickStreamProvider() {
  if (!state.stream) return null
  const providers = ensureStreamProviders()
  if (!providers.length) return null
  const now = Date.now()
  for (let i = 0; i < providers.length; i += 1) {
    const idx = (state.stream.providerCursor + i) % providers.length
    const candidate = providers[idx]
    if (!candidate.cooldownUntil || now >= candidate.cooldownUntil) {
      state.stream.providerCursor = (idx + 1) % providers.length
      return { ...candidate, index: idx }
    }
  }
  const idx = state.stream.providerCursor % providers.length
  state.stream.providerCursor = (idx + 1) % providers.length
  return { ...providers[idx], index: idx }
}

function markStreamProviderFailure(reason, err) {
  if (!state.stream) return
  const activeUrl = state.stream.providerUrl
  const activeProvider = state.stream.provider
  if (!activeUrl || !activeProvider) return
  const entry = state.stream.providers.find(
    (provider) => provider.url === activeUrl && provider.provider === activeProvider
  )
  if (!entry) return
  const now = Date.now()
  entry.failures = (entry.failures || 0) + 1
  entry.lastFailureAt = now
  entry.cooldownUntil = now + config.streamFailoverCooldownMs
  state.stream.failoverCount += 1
  console.warn("ps_stream_failover", {
    reason,
    provider: activeProvider,
    url: activeUrl,
    cooldownMs: config.streamFailoverCooldownMs,
    error: err?.message ? String(err.message) : undefined,
  })
}

function resolveStreamAssetClass(streamName, exchangeHint) {
  const name = String(streamName || "").toLowerCase()
  if (name.includes("crypto")) return "crypto"
  if (name.includes("currency") || name.includes("forex") || name.includes("fx")) return "forex"
  if (name.includes("commodit")) return "stock"

  const exchange = String(exchangeHint || "").toUpperCase()
  if (exchange.includes("CRYPTO")) return "crypto"
  if (exchange === "FX" || exchange === "FOREX") return "forex"
  return "stock"
}

const STREAM_ALIASES = {
  "us-equities-stream": ["US Equities Stream"],
  "us-otc-stream": ["US OTC Stream"],
  "crypto-stream": ["Crypto Stream"],
  "fx-stream": ["FX Stream"],
  "index-stream": ["Index Stream"],
  "commodity-stream": ["Commodity Stream"],
  "nasdaq-basic-w-nls-plus": ["Nasdaq Basic with NLS Plus"],
  "iex-tops": ["IEX TOPS"],
  "cboe-index-main": ["Cboe Index Main"],
}

function resolveStreamAliases(streamName) {
  const cleaned = String(streamName || "").trim()
  if (!cleaned) return []
  const key = cleaned.toLowerCase()
  const aliases = new Set([cleaned])
  const mapped = STREAM_ALIASES[key]
  if (mapped) {
    mapped.forEach((alias) => aliases.add(alias))
  }
  return Array.from(aliases)
}

function resolveStreamSymbolsForProvider(provider) {
  const symbols = Array.from(state.watchlist.stock)
  if (symbols.length === 0) return []
  const providerCap =
    (state.stream?.providerMaxSymbols || {})[provider] ||
    (config.streamMaxSymbolsByProvider || {})[provider]
  const resolvedCap = Number.isFinite(providerCap) ? providerCap : config.maxSymbols
  const cap = Math.max(1, Math.min(config.maxSymbols, resolvedCap))
  if (!state.stream) return symbols.slice(0, cap)
  const blocked = state.stream.blockedSymbols?.[provider]
  let eligible = symbols
  if (blocked instanceof Map && blocked.size > 0) {
    const now = Date.now()
    blocked.forEach((until, symbol) => {
      if (!until || until <= now) blocked.delete(symbol)
    })
    if (blocked.size > 0) {
      eligible = symbols.filter((symbol) => !blocked.has(symbol))
    }
  }
  if (eligible.length <= cap) return eligible
  const cursor = state.stream.rotationCursor?.[provider] || 0
  const start = cursor % eligible.length
  const end = start + cap
  if (end <= eligible.length) return eligible.slice(start, end)
  return eligible.slice(start).concat(eligible.slice(0, end - eligible.length))
}

function resolveStreamSymbols() {
  const provider = state.stream?.provider || ""
  return resolveStreamSymbolsForProvider(provider)
}

function refreshStreamFilterFromWatchlist() {
  if (!state.stream) return
  state.stream.filter = {
    crypto: new Set(state.watchlist.crypto),
    stock: new Set(state.watchlist.stock),
    forex: new Set(state.watchlist.forex),
  }
  state.stream.filterUpdatedAt = Date.now()
  if (
    ["finnhub", "alpaca", "twelvedata"].includes(state.stream.provider || "") &&
    state.stream.connected
  ) {
    state.stream.pendingSubscriptions = resolveStreamSymbols()
    sendStreamSubscriptions("watchlist")
  }
}

function shouldRotateStream(provider, cap, total) {
  if (!config.streamRotateEnabled) return false
  if (!provider || !state.stream?.connected) return false
  if (!["finnhub", "alpaca", "twelvedata"].includes(provider)) return false
  if (!Number.isFinite(config.streamRotateMs) || config.streamRotateMs <= 0) return false
  if (!Number.isFinite(cap) || cap <= 0) return false
  if (!Number.isFinite(total) || total <= cap) return false
  return true
}

function rotateStreamSubscriptions(reason = "rotate") {
  if (!state.stream) return
  const provider = state.stream.provider || ""
  if (!provider || !state.stream.connected) return
  const allSymbols = Array.from(state.watchlist.stock)
  if (allSymbols.length === 0) return
  const providerCap =
    state.stream.providerMaxSymbols?.[provider] ||
    (config.streamMaxSymbolsByProvider || {})[provider] ||
    config.maxSymbols
  const cap = Math.max(1, Math.min(config.maxSymbols, providerCap))
  if (!shouldRotateStream(provider, cap, allSymbols.length)) return
  const stridePct = Number.isFinite(config.streamRotateStridePct)
    ? Math.max(0.1, Math.min(1, config.streamRotateStridePct))
    : 1
  const stride = Math.max(1, Math.floor(cap * stridePct))
  const current = state.stream.rotationCursor?.[provider] || 0
  state.stream.rotationCursor[provider] = (current + stride) % allSymbols.length
  state.stream.pendingSubscriptions = resolveStreamSymbolsForProvider(provider)
  sendStreamSubscriptions(reason)
}

function streamAllowsSymbol(assetClass, symbol) {
  if (!config.streamFilterEnabled) return true
  const filterSet = state.stream?.filter?.[assetClass]
  if (!filterSet || filterSet.size === 0) return false
  return filterSet.has(symbol)
}

function isStreamHealthyFor(assetClass) {
  if (!state.stream?.connected) return false
  if (!state.stream.streamAssetClass) return false
  const hasCoverage = Object.values(state.stream.streamAssetClass).some(
    (klass) => klass === assetClass
  )
  if (!hasCoverage) return false
  const lastMessage = state.stream.lastAssetMessageAt?.[assetClass]
  if (!lastMessage) return false
  return Date.now() - lastMessage <= config.streamHeartbeatTimeoutMs
}

function shouldUseStreamFor(assetClass) {
  if (assetClass === "stock") {
    if (state.stockQuoteMode === "poll_only") return false
    if (state.stockQuoteMode === "stream_only") {
      if (!config.streamEnabled) return false
      if (isReplayMode()) return false
      return isStreamHealthyFor(assetClass)
    }
  }
  if (!config.streamEnabled) return false
  if (isReplayMode()) return false
  return isStreamHealthyFor(assetClass)
}

function getSymbolCap(assetClass) {
  if (assetClass === "stock") {
    if (state.stream?.enabled && isStreamHealthyFor("stock")) {
      return Math.max(1, config.stockStreamTarget || config.maxSymbols)
    }
    return Math.max(1, config.stockPollTarget || config.maxSymbols)
  }
  return Math.max(1, config.maxSymbols)
}

async function refreshStockUniverseCache() {
  if (isReplayMode()) return
  if (!config.marketDataGatewayUrl || config.stockUniverseLimit <= 0) return
  const now = Date.now()
  const profileConfig = resolveProfileConfig(state.dataProfile || "normal")
  if (!Number.isFinite(profileConfig.stockListMinMs)) {
    console.log("ps_stock_universe_skip", { reason: "profile", profile: state.dataProfile })
    return
  }
  if (
    state.stockUniverse.updatedAt &&
    now - state.stockUniverse.updatedAt < profileConfig.stockListMinMs
  ) {
    return
  }
  try {
    const data = await fetchGatewayJsonSoft("/v1/market/stock-list")
    const items = Array.isArray(data?.items) ? data.items : []
    const symbols = items
      .map((item) => normalizeSymbolForKey(item?.symbol, "stock"))
      .filter(Boolean)
      .slice(0, Math.max(1, config.stockUniverseLimit))
    if (symbols.length === 0) return
    state.stockUniverse.symbols = symbols
    state.stockUniverse.updatedAt = now
    state.stockUniverse.cursor = 0
    console.log("ps_stock_universe_refreshed", { count: symbols.length })
  } catch (err) {
    console.error("Stock universe refresh failed:", err.message)
  }
}

function fillFromStockUniverse(targetSet, cap) {
  if (!targetSet || targetSet.size >= cap) return
  const symbols = state.stockUniverse.symbols
  if (!Array.isArray(symbols) || symbols.length === 0) return
  let cursor = state.stockUniverse.cursor || 0
  let added = 0
  const maxAdds = Math.max(0, cap - targetSet.size)
  for (let i = 0; i < symbols.length && added < maxAdds; i += 1) {
    const index = (cursor + i) % symbols.length
    const symbol = symbols[index]
    if (!symbol) continue
    if (!targetSet.has(symbol)) {
      targetSet.add(symbol)
      added += 1
    }
  }
  state.stockUniverse.cursor = (cursor + added) % symbols.length
}

function handleStreamQuote(quote, streamName) {
  if (!quote || typeof quote !== "object") return
  const rawSymbol = quote.symbol || quote.s || quote.ticker || quote.sym
  if (!rawSymbol) return
  const now = Date.now()
  if (state.stream) {
    state.stream.quoteCount += 1
    state.stream.lastQuoteAt = now
    state.stream.lastRawSymbol = String(rawSymbol)
  }

  const streamHint = quote.stream || quote.streamId || streamName
  const assetClass = resolveStreamAssetClass(streamHint, quote.exchange)
  if (assetClass === "stock" && state.stockQuoteMode === "poll_only") return
  const normalizedSymbol = normalizeSymbolForKey(rawSymbol, assetClass)
  if (!normalizedSymbol) return
  if (!streamAllowsSymbol(assetClass, normalizedSymbol)) {
    if (state.stream) {
      state.stream.filteredCount += 1
      state.stream.lastFilteredAt = now
      state.stream.lastFilteredSymbol = normalizedSymbol
    }
    return
  }

  const price = parseNumber(
    quote.price ?? quote.last ?? quote.close ?? quote.p ?? quote.c ?? quote.lastPrice
  )
  if (!Number.isFinite(price)) return

  const bid = parseNumber(quote.bid ?? quote.bidPrice ?? quote.b)
  const ask = parseNumber(quote.ask ?? quote.askPrice ?? quote.a)
  const volume = parseNumber(quote.volume ?? quote.v ?? quote.vol)
  const changePct = parseNumber(
    quote.changePercentage ?? quote.changesPercentage ?? quote.changePercent ?? quote.changePct
  )

  const extra = {}
  if (Number.isFinite(bid)) extra.bid = bid
  if (Number.isFinite(ask)) extra.ask = ask
  if (Number.isFinite(volume)) extra.volume = volume
  if (Number.isFinite(changePct)) extra.change24h = changePct
  if (typeof quote.exchange === "string") extra.exchange = quote.exchange

  updatePrice(assetClass, normalizedSymbol, Number(price), "stream", extra)

  if (state.stream) {
    state.stream.lastMessageAt = now
    state.stream.lastAssetMessageAt[assetClass] = now
  }
}

function handleStreamPayload(payload, streamHint) {
  if (!payload) return
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload)
      handleStreamPayload(parsed, streamHint)
    } catch (_) {
      // ignore malformed string payloads
    }
    return
  }
  if (Array.isArray(payload)) {
    payload.forEach((entry) => handleStreamQuote(entry, streamHint))
    return
  }
  if (typeof payload === "object") {
    handleStreamQuote(payload, streamHint)
  }
}

function handleStreamTooManySymbols(message, provider) {
  const activeProvider = provider || state.stream?.provider
  if (!activeProvider || !state.stream) return
  const currentCap =
    state.stream.providerMaxSymbols[activeProvider] ||
    (config.streamMaxSymbolsByProvider || {})[activeProvider] ||
    config.maxSymbols
  const nextCap = Math.max(10, Math.floor(currentCap * 0.5))
  const errorCount = (state.stream.providerLimitErrors[activeProvider] || 0) + 1
  state.stream.providerLimitErrors[activeProvider] = errorCount
  if (nextCap >= currentCap) {
    if (errorCount >= 3) {
      console.warn("ps_stream_limit_failover", { provider: activeProvider, errorCount })
      markStreamProviderFailure("limit", new Error(message || "too_many_symbols"))
      state.stream.ws?.close()
    }
    return
  }
  state.stream.providerMaxSymbols[activeProvider] = nextCap
  state.stream.pendingSubscriptions = resolveStreamSymbols()
  console.warn("ps_stream_symbol_cap_reduced", {
    provider: activeProvider,
    prevCap: currentCap,
    nextCap,
    errorCount,
    message,
  })
  sendStreamSubscriptions("cap_adjust")
}

function handleAlpacaStream(parsed) {
  if (!parsed) return
  const entries = Array.isArray(parsed) ? parsed : [parsed]
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return
    const type = entry.T
    if (type === "success") {
      const msg = String(entry.msg || "").toLowerCase()
      if (msg.includes("authenticated")) {
        if (state.stream) {
          state.stream.authenticated = true
          state.stream.lastLoginAt = Date.now()
          state.stream.lastLoginStatus = "authenticated"
        }
        sendStreamSubscriptions("login")
      }
      return
    }
    if (type === "error") {
      const message = entry.msg || entry
      console.warn("ps_stream_error", { message })
      if (String(message || "").toLowerCase().includes("too many")) {
        handleStreamTooManySymbols(message, "alpaca")
        return
      }
      markStreamProviderFailure("error", new Error(entry.msg || "alpaca_error"))
      return
    }
    const symbol = entry.S || entry.symbol
    if (!symbol) return
    if (type === "q") {
      const bid = parseNumber(entry.bp)
      const ask = parseNumber(entry.ap)
      const mid =
        Number.isFinite(bid) && Number.isFinite(ask)
          ? (Number(bid) + Number(ask)) / 2
          : Number.isFinite(bid)
            ? bid
            : Number.isFinite(ask)
              ? ask
              : undefined
      if (!Number.isFinite(mid)) return
      handleStreamQuote(
        { symbol, price: mid, bid, ask, exchange: entry.x },
        "alpaca"
      )
      return
    }
    if (type === "t") {
      handleStreamQuote(
        { symbol, price: entry.p, volume: entry.s, exchange: entry.x },
        "alpaca"
      )
      return
    }
    if (type === "b") {
      handleStreamQuote(
        {
          symbol,
          price: entry.c,
          open: entry.o,
          high: entry.h,
          low: entry.l,
          close: entry.c,
          volume: entry.v,
          exchange: entry.x,
        },
        "alpaca"
      )
    }
  })
}

function handleTwelveDataStream(parsed) {
  if (!parsed) return
  if (parsed.event === "heartbeat" || parsed.event === "ping") {
    if (state.stream) {
      const now = Date.now()
      state.stream.lastHeartbeatAt = now
      state.stream.lastMessageAt = now
    }
    return
  }
  if (parsed.event === "price" || parsed.event === "quote") {
    handleStreamQuote(parsed, "twelvedata")
    return
  }
  if (Array.isArray(parsed.data)) {
    handleStreamPayload(parsed.data, "twelvedata")
    return
  }
  if (parsed.status === "error" || parsed.event === "error") {
    const message = parsed?.message || parsed
    const fails = Array.isArray(parsed?.fails) ? parsed.fails : []
    const failSymbols = new Set()
    const failMessages = []
    fails.forEach((entry) => {
      if (entry && typeof entry === "object") {
        const symbol = entry.symbol || entry.s || entry.ticker
        if (symbol) failSymbols.add(String(symbol))
        const errMsg = entry.message || entry.error || entry.reason
        if (errMsg) failMessages.push(String(errMsg))
      } else if (typeof entry === "string") {
        failMessages.push(entry)
      }
    })
    const errText = [String(message || ""), ...failMessages].join(" ").toLowerCase()
    console.warn("ps_stream_error", {
      message,
      failCount: fails.length,
      sampleFail: fails.slice(0, 3),
    })
    if (errText.includes("too many") || errText.includes("limit") || errText.includes("exceed")) {
      handleStreamTooManySymbols(message, "twelvedata")
      return
    }
    if (failSymbols.size > 0 && state.stream) {
      if (!state.stream.blockedSymbols.twelvedata) {
        state.stream.blockedSymbols.twelvedata = new Map()
      }
      const blockUntil = Date.now() + Math.max(60000, config.streamBlockTtlMs || 0)
      failSymbols.forEach((symbol) => {
        state.stream.blockedSymbols.twelvedata.set(symbol, blockUntil)
      })
      const requested = Array.isArray(state.stream.pendingSubscriptions)
        ? state.stream.pendingSubscriptions
        : []
      if (requested.length > 0 && failSymbols.size >= requested.length * 0.8) {
        handleStreamTooManySymbols(message, "twelvedata")
        return
      }
      if (requested.length > 0) {
        const allowed = requested.filter((symbol) => !failSymbols.has(symbol))
        if (allowed.length > 0 && allowed.length < requested.length) {
          state.stream.pendingSubscriptions = allowed
          state.stream.subscribedSymbols = new Set(allowed)
          state.stream.providerMaxSymbols.twelvedata = Math.min(
            state.stream.providerMaxSymbols.twelvedata || allowed.length,
            allowed.length
          )
          console.warn("ps_stream_twelvedata_filtered", {
            requested: requested.length,
            allowed: allowed.length,
            filtered: requested.length - allowed.length,
          })
          sendStreamSubscriptions("filter_failures")
          return
        }
      }
    }
    markStreamProviderFailure("error", new Error(parsed?.message || "twelvedata_error"))
    return
  }
  handleStreamPayload(parsed, "twelvedata")
}

function handleStreamMessage(raw) {
  if (!raw) return
  let parsed = null
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(raw.toString())
  } catch (err) {
    if (state.stream) {
      state.stream.parseErrorCount += 1
      state.stream.lastParseErrorAt = Date.now()
      const sample = typeof raw === "string" ? raw.slice(0, 300) : raw.toString().slice(0, 300)
      state.stream.lastParseErrorSample = sample
    }
    return
  }

  const now = Date.now()
  if (state.stream) {
    state.stream.rawMessageCount += 1
    state.stream.lastRawMessageAt = now
  }
  if (parsed?.event === "heartbeat") {
    if (state.stream) {
      state.stream.lastHeartbeatAt = now
      state.stream.lastMessageAt = now
    }
    return
  }
  const activeProvider = state.stream?.provider
  if (activeProvider === "alpaca") {
    handleAlpacaStream(parsed)
    return
  }
  if (activeProvider === "twelvedata") {
    handleTwelveDataStream(parsed)
    return
  }
  if (parsed?.type === "trade" && Array.isArray(parsed.data)) {
    handleStreamPayload(parsed.data, "finnhub")
    return
  }
  if (parsed?.type === "ping") {
    if (state.stream) {
      state.stream.lastHeartbeatAt = now
      state.stream.lastMessageAt = now
    }
    return
  }
  if (parsed?.type === "error") {
    const message = parsed?.message || parsed?.msg || parsed
    console.warn("ps_stream_error", { message })
    if (String(message || "").toLowerCase().includes("too many")) {
      handleStreamTooManySymbols(message, "finnhub")
      return
    }
    return
  }
  if (parsed?.event === "login") {
    if (state.stream) {
      state.stream.lastLoginAt = now
      state.stream.lastLoginStatus = parsed?.data?.status ?? null
      if (parsed?.data?.status === 200) {
        state.stream.authenticated = true
        sendStreamSubscriptions("login")
      }
    }
    return
  }
  if (parsed?.event && parsed?.data) {
    handleStreamPayload(parsed.data, parsed?.data?.stream || parsed?.stream)
    return
  }
  handleStreamPayload(parsed, parsed?.stream)
}

function sendStreamSubscriptions(reason) {
  if (!state.stream?.ws) return
  const provider = state.stream.provider || "generic"
  const subscriptions = state.stream.pendingSubscriptions || []
  if (!subscriptions.length) return
  if (provider === "finnhub") {
    const next = new Set(subscriptions)
    const prev = state.stream.subscribedSymbols || new Set()
    const toSubscribe = []
    const toUnsubscribe = []
    next.forEach((symbol) => {
      if (!prev.has(symbol)) toSubscribe.push(symbol)
    })
    prev.forEach((symbol) => {
      if (!next.has(symbol)) toUnsubscribe.push(symbol)
    })
    toSubscribe.forEach((symbol) => {
      state.stream.ws.send(JSON.stringify({ type: "subscribe", symbol }))
    })
    toUnsubscribe.forEach((symbol) => {
      state.stream.ws.send(JSON.stringify({ type: "unsubscribe", symbol }))
    })
    state.stream.subscribedSymbols = next
    console.log("ps_stream_subscribed", {
      reason,
      provider,
      subscribe: toSubscribe.length,
      unsubscribe: toUnsubscribe.length,
    })
    return
  }
  if (provider === "alpaca") {
    if (!state.stream.authenticated) {
      console.warn("ps_stream_subscribe_skipped", { reason: "not_authenticated", provider })
      return
    }
    const unique = Array.from(new Set(subscriptions))
    const payload = {
      action: "subscribe",
      trades: unique,
      quotes: unique,
    }
    state.stream.ws.send(JSON.stringify(payload))
    state.stream.subscribedSymbols = new Set(unique)
    console.log("ps_stream_subscribed", { reason, provider, symbols: unique.length })
    return
  }
  if (provider === "twelvedata") {
    const unique = Array.from(new Set(subscriptions))
    state.stream.ws.send(
      JSON.stringify({ action: "subscribe", params: { symbols: unique.join(",") } })
    )
    state.stream.subscribedSymbols = new Set(unique)
    console.log("ps_stream_subscribed", { reason, provider, symbols: unique.length })
    return
  }
  subscriptions.forEach((stream) => {
    state.stream.ws.send(JSON.stringify({ event: "subscribe", data: { stream } }))
  })
  console.log("ps_stream_subscribed", { reason, provider: "generic", streams: subscriptions })
}

function scheduleStreamReconnect(reason) {
  if (!state.stream || !state.stream.shouldReconnect) return
  if (state.stream.reconnectTimer) return
  const delay = Math.min(state.stream.reconnectDelayMs, config.streamMaxReconnectMs)
  state.stream.reconnectTimer = setTimeout(() => {
    state.stream.reconnectTimer = null
    state.stream.reconnectDelayMs = Math.min(
      state.stream.reconnectDelayMs * 1.8,
      config.streamMaxReconnectMs
    )
    startStream()
  }, delay)
  console.warn("ps_stream_reconnect_scheduled", { reason, delayMs: delay })
}

function stopStream(reason = "stop") {
  if (!state.stream) return
  state.stream.shouldReconnect = false
  if (state.stream.reconnectTimer) {
    clearTimeout(state.stream.reconnectTimer)
    state.stream.reconnectTimer = null
  }
  if (state.stream.ws) {
    try {
      state.stream.ws.close()
    } catch (_) {
      // ignore
    }
  }
  state.stream.ws = null
  state.stream.connected = false
  state.stream.connecting = false
  state.stream.pendingSubscriptions = []
  state.stream.subscribedSymbols = new Set()
  state.stream.provider = null
  state.stream.providerUrl = null
  console.log("ps_stream_stopped", { reason })
}

function startStream() {
  if (!config.streamEnabled) return
  if (isReplayMode()) return
  if (!state.stream) return
  if (state.stream.connected || state.stream.connecting) return
  refreshStreamFilterFromWatchlist()

  const candidate = pickStreamProvider()
  const url = candidate?.url
  const provider = candidate?.provider
  if (!url || !provider) {
    console.warn("ps_stream_disabled", { reason: "missing_url_or_key" })
    return
  }
  let streams = []
  let subscriptions = []
  if (["finnhub", "alpaca", "twelvedata"].includes(provider)) {
    subscriptions = resolveStreamSymbolsForProvider(provider)
    if (!subscriptions.length) {
      console.warn("ps_stream_disabled", { reason: "no_symbols_configured", provider })
      return
    }
    streams = [provider]
  } else {
    streams = config.streamNames.length ? config.streamNames : []
    if (!streams.length) {
      console.warn("ps_stream_disabled", { reason: "no_streams_configured", provider: "generic" })
      return
    }
    subscriptions = streams.flatMap((stream) => resolveStreamAliases(stream))
    if (!subscriptions.length) {
      console.warn("ps_stream_disabled", { reason: "no_streams_resolved", provider: "generic" })
      return
    }
  }

  state.stream.shouldReconnect = true
  state.stream.connecting = true
  state.stream.streams = streams
  state.stream.provider = provider
  state.stream.providerUrl = url
  state.stream.streamAssetClass =
    provider === "finnhub"
      ? { finnhub: "stock" }
      : Object.fromEntries(streams.map((stream) => [stream, resolveStreamAssetClass(stream)]))
  state.stream.pendingSubscriptions = subscriptions
  state.stream.subscribedSymbols = new Set()
  state.stream.authenticated = false
  state.stream.lastLoginAt = null
  state.stream.lastLoginStatus = null
  state.stream.reconnectDelayMs = config.streamReconnectMs

  const ws = new WebSocket(url)
  state.stream.ws = ws

  ws.on("open", () => {
    if (!state.stream) return
    state.stream.connected = true
    state.stream.connecting = false
    state.stream.errors = 0
    state.stream.lastMessageAt = Date.now()
    state.stream.lastHeartbeatAt = Date.now()
    if (provider === "alpaca") {
      if (!config.alpacaKey || !config.alpacaSecret) {
        console.warn("ps_stream_disabled", { reason: "missing_alpaca_keys" })
        markStreamProviderFailure("missing_alpaca_keys")
        state.stream.ws?.close()
        return
      }
      state.stream.authenticated = false
      state.stream.ws.send(
        JSON.stringify({ action: "auth", key: config.alpacaKey, secret: config.alpacaSecret })
      )
      return
    }
    sendStreamSubscriptions("open")
    console.log("ps_stream_connected", { streams })
  })

  ws.on("message", (data) => {
    handleStreamMessage(data)
  })

  ws.on("close", () => {
    if (!state.stream) return
    state.stream.connected = false
    state.stream.connecting = false
    state.stream.ws = null
    if (state.stream.shouldReconnect) {
      markStreamProviderFailure("close")
      scheduleStreamReconnect("close")
    }
  })

  ws.on("error", (err) => {
    if (!state.stream) return
    state.stream.errors += 1
    state.stream.lastError = err?.message ? String(err.message) : "stream_error"
    markStreamProviderFailure("error", err)
    if (state.stream.connected || state.stream.connecting) {
      scheduleStreamReconnect("error")
    }
  })
}

function checkStreamHealth() {
  if (!state.stream || !state.stream.shouldReconnect) return
  if (!state.stream.connected) return
  const now = Date.now()
  const lastMessage = state.stream.lastMessageAt
  if (lastMessage && now - lastMessage > config.streamHeartbeatTimeoutMs) {
    console.warn("ps_stream_stale", { ageMs: now - lastMessage })
    try {
      state.stream.ws?.close()
    } catch (_) {
      // ignore
    }
  }
}

async function initRedis() {
  if (!config.redisUrl) return null
  const client = createClient({ url: config.redisUrl })
  client.on("error", (err) => {
    const message = err?.message ? String(err.message) : "Unknown error"
    console.error("Redis error:", message)
  })
  try {
    await client.connect()
    state.redisReady = true
    console.log("Redis connected")
    return client
  } catch (err) {
    console.error("Redis connection failed:", err.message)
    state.redisReady = false
    return null
  }
}

async function hydratePriceHistoryFromRedis() {
  if (!state.redis || !state.redisReady) return
  if (isReplayMode()) return
  const now = Date.now()
  const cutoff = now - config.historyMinutes * 60 * 1000
  const indexKey = resolveRedisKey("prices:snapshots", state.replay)
  let snapshotKeys = []
  try {
    snapshotKeys = await state.redis.zRangeByScore(indexKey, cutoff, now)
  } catch (err) {
    console.error("Redis history scan failed:", err?.message || err)
    return
  }
  if (!snapshotKeys.length) return
  const multi = state.redis.multi()
  snapshotKeys.forEach((key) => multi.get(key))
  let results = []
  try {
    results = await multi.exec()
  } catch (err) {
    console.error("Redis history read failed:", err?.message || err)
    return
  }
  let snapshotsLoaded = 0
  let pointsLoaded = 0
  results.forEach((entry) => {
    const value = Array.isArray(entry) ? entry[1] : entry
    if (!value) return
    try {
      const payload = JSON.parse(value)
      const updatedAt = Number(payload?.updatedAt) || now
      const items = Array.isArray(payload?.items) ? payload.items : []
      items.forEach((item) => {
        const assetClass = item?.assetClass
        const symbol = item?.symbol
        const price = parseNumber(item?.price)
        if (!assetClass || !symbol || typeof price !== "number") return
        recordPriceHistory(`${assetClass}:${symbol}`, price, updatedAt)
        pointsLoaded += 1
      })
      snapshotsLoaded += 1
    } catch (err) {
      return
    }
  })
  console.log("ps_history_hydrated", {
    snapshotsLoaded,
    pointsLoaded,
    symbols: state.priceHistory.size,
  })
}

function isRateLimited() {
  return state.streamBackoffUntil && Date.now() < state.streamBackoffUntil
}

function markRateLimited() {
  const now = Date.now()
  const backoffMs = 60 * 1000
  if (!state.streamBackoffUntil || now >= state.streamBackoffUntil) {
    console.warn(`Quote rate limit hit; backing off for ${backoffMs / 1000}s`)
  }
  state.streamBackoffUntil = now + backoffMs
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  const compact = upper.replace(/\s+/g, "")
  if (compact.includes("/") || compact.includes("-")) {
    const separator = compact.includes("/") ? "/" : "-"
    const parts = compact.split(separator).filter(Boolean)
    if (parts.length === 2) {
      return `${parts[0]}/${parts[1]}`
    }
    return compact
  }

  const quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR", "GBP", "JPY"]
  for (const quote of quotes) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      return `${compact.slice(0, -quote.length)}/${quote}`
    }
  }

  return compact
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function normalizeForexSymbol(raw) {
  if (!raw) return null
  const normalized = normalizeSymbol(raw)
  if (normalized && normalized.includes("/")) return normalized
  const compact = String(raw).trim().toUpperCase().replace(/[^A-Z]/g, "")
  if (compact.length >= 6) {
    return `${compact.slice(0, 3)}/${compact.slice(3, 6)}`
  }
  return normalized
}

function inferAssetClassFromSymbol(raw) {
  if (!raw) return null
  const symbol = String(raw).trim().toUpperCase()
  if (!symbol) return null
  if (!symbol.includes("/")) return "stock"
  const parts = symbol.replace(/-/g, "/").split("/")
  if (parts.length === 2 && FX_CODES.has(parts[0]) && FX_CODES.has(parts[1])) {
    return "forex"
  }
  return "crypto"
}

function normalizeSymbolForKey(raw, assetClass) {
  if (!raw) return null
  if (assetClass === "stock") {
    const normalized = normalizeTicker(raw)
    return normalized ? normalized.replace(/\//g, "").replace(/-/g, "") : null
  }
  if (assetClass === "forex") return normalizeForexSymbol(raw)
  const normalized = normalizeSymbol(raw)
  if (!normalized) return null
  if (normalized.includes("/")) {
    const [base, quote] = normalized.split("/")
    if (!base || !quote) return null
    return `${base}/${quote}`
  }
  return normalized
}

function normalizeQuoteSymbol(raw, assetClass) {
  if (!raw) return null
  if (assetClass === "stock") return normalizeTicker(raw)
  if (assetClass === "forex") {
    const symbol = normalizeForexSymbol(raw)
    return symbol ? symbol.replace("/", "") : null
  }
  const symbol = normalizeSymbol(raw)
  if (!symbol) return null
  if (symbol.includes("/")) {
    const [base, quote] = symbol.split("/")
    if (!base || !quote) return null
    const normalizedQuote = quote === "USDT" ? "USD" : quote
    return `${base}${normalizedQuote}`
  }
  return symbol
}

function chunkList(items, size) {
  const chunkSize = Math.max(1, size || 1)
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function resolveUniverseMode(value) {
  if (!value) return DEFAULT_UNIVERSE_MODE
  const normalized = String(value).trim().toLowerCase()
  return UNIVERSE_MODES.has(normalized) ? normalized : DEFAULT_UNIVERSE_MODE
}

function shouldIncludeUniverse(mode) {
  return mode === "movers_plus_universe" || mode === "universe_only" || mode === "weighted_union"
}

async function fetchJson(url, options = {}, timeoutMs = 15000, retries = 2) {
  let lastError = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
      }
      return res.json()
    } catch (err) {
      clearTimeout(timeoutId)
      lastError = err
      
      // Don't retry on 4xx errors or if we've exhausted retries
      if (err.message?.includes('Request failed 4') || attempt === retries) {
        break
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  if (lastError?.name === 'AbortError') {
    throw new Error(`Request timed out after ${timeoutMs}ms`)
  }
  throw lastError
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
  if (!config.marketDataGatewayUrl) return null
  return config.marketDataGatewayUrl.endsWith("/")
    ? config.marketDataGatewayUrl
    : `${config.marketDataGatewayUrl}/`
}

function buildGatewayUrl(path, params) {
  const base = resolveGatewayBase()
  if (!base) return null
  const normalizedPath = String(path || "").replace(/^\/+/, "")
  const url = new URL(normalizedPath, base)
  if (params) {
    url.search = new URLSearchParams(params).toString()
  }
  return url.toString()
}

async function fetchGatewayJson(path, params) {
  const url = buildGatewayUrl(path, params)
  if (!url) return null
  const shouldEmit = config.pipelineEventsEnabled && shouldSample(config.pipelineEventsSampleRate)
  const startedAt = Date.now()
  const endpointName = String(path || "").replace(/^\/+/, "")
  const paramsHash = hashParams(params)
  if (shouldEmit) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "price_streamer",
        eventType: "gateway_call",
        edgeKey: "price_streamer->market_data_gateway",
        nodeIds: ["price_streamer", "market_data_gateway"],
        status: "start",
        meta: {
          endpointName,
          paramsHash,
        },
      })
    )
  }
  try {
    const data = await gatewayCircuitBreaker.execute(async () => {
      const authHeaders = await getGatewayAuthHeaders()
      return fetchJson(url, authHeaders ? { headers: authHeaders } : undefined)
    })
    if (shouldEmit) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "price_streamer",
          eventType: "gateway_call",
          edgeKey: "price_streamer->market_data_gateway",
          nodeIds: ["price_streamer", "market_data_gateway"],
          status: "end",
          durationMs: Date.now() - startedAt,
          meta: {
            endpointName,
            paramsHash,
            httpStatus: 200,
          },
        })
      )
    }
    return data
  } catch (err) {
    if (shouldEmit) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "price_streamer",
          eventType: "gateway_call",
          edgeKey: "price_streamer->market_data_gateway",
          nodeIds: ["price_streamer", "market_data_gateway"],
          status: "error",
          durationMs: Date.now() - startedAt,
          severity: "error",
          meta: {
            endpointName,
            paramsHash,
            circuitBreakerOpen: err?.message?.includes("Circuit breaker"),
          },
          error: { message: err?.message ? String(err.message) : "Gateway error" },
        })
      )
    }
    throw err
  }
}

async function fetchGatewayJsonUnsafe(path, params) {
  const url = buildGatewayUrl(path, params)
  if (!url) return null
  const authHeaders = await getGatewayAuthHeaders()
  return fetchJson(url, authHeaders ? { headers: authHeaders } : undefined)
}

async function fetchGatewayJsonSoft(path, params) {
  const url = buildGatewayUrl(path, params)
  if (!url) return null
  const authHeaders = await getGatewayAuthHeaders()
  try {
    return await fetchJson(url, authHeaders ? { headers: authHeaders } : undefined)
  } catch (err) {
    return null
  }
}

async function fetchMarketQuote(symbol, assetClass = "stock") {
  if (!symbol) return null

  if (isReplayMode()) {
    if (!config.marketDataGatewayUrl) return null
    try {
      const data = await fetchGatewayJsonUnsafe("/v1/market/quote", {
        symbol,
        assetClass,
      })
      if (!data || typeof data?.price !== "number") return null
      return {
        symbol,
        price: data.price,
        bid: parseNumber(data.bid),
        ask: parseNumber(data.ask),
        volume: parseNumber(data.volume),
        change24h: parseNumber(data.changePercent),
        source: data.source || "replay",
      }
    } catch (err) {
      console.error(`Replay quote failed for ${symbol}:`, err.message)
      return null
    }
  }
  
  // Check rate limit before making call
  if (!canMakeApiCall()) {
    console.warn(`Rate limit reached, skipping quote for ${symbol}`)
    return null
  }
  
  if (!config.marketDataGatewayUrl) {
    console.warn(`No gateway URL configured, cannot fetch quote for ${symbol}`)
    return null
  }

  try {
    trackApiCall()
    const data = await fetchGatewayJsonUnsafe("/v1/market/quote", {
      symbol,
      assetClass,
    })
    if (!data || typeof data?.price !== "number") return null
    return {
      symbol,
      price: data.price,
      bid: parseNumber(data.bid),
      ask: parseNumber(data.ask),
      volume: parseNumber(data.volume),
      change24h: parseNumber(data.changePercent),
      exchange: data.exchange || data.exchangeShortName,
      source: "gateway",
    }
  } catch (err) {
    console.error(`Gateway quote failed for ${symbol}:`, err.message)
    return null
  }
}

/**
 * Fetch quotes for multiple symbols using parallel single-quote requests.
 * This replaces batch quotes when providers don't support multi-symbol requests.
 * 
 * @param {string[]} symbols - Symbols to fetch
 * @param {string} assetClass - 'stock', 'crypto', or 'forex'
 * @returns {Promise<Array<{symbol: string, quote: object|null, error: string|null}>>}
 */
async function fetchQuotesParallel(symbols, assetClass) {
  if (!Array.isArray(symbols) || symbols.length === 0) return []
  
  const concurrency = config.quoteConcurrency
  const delayMs = config.quoteBatchDelayMs
  const results = []
  
  // Process in chunks with concurrency control
  for (let i = 0; i < symbols.length; i += concurrency) {
    const chunk = symbols.slice(i, i + concurrency)
    
    // Check rate limit before each chunk
    if (!canMakeApiCall()) {
      console.warn(`Rate limit reached, stopping at ${i}/${symbols.length} symbols for ${assetClass}`)
      break
    }
    
    const promises = chunk.map(async (symbol) => {
      try {
        const quote = await fetchMarketQuote(symbol, assetClass)
        return { symbol, quote, error: null }
      } catch (err) {
        return { symbol, quote: null, error: err.message }
      }
    })
    
    const chunkResults = await Promise.all(promises)
    results.push(...chunkResults)
    
    // Small delay between chunks to avoid rate limiting
    if (i + concurrency < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  
  return results
}

// ============================================================================
// STOCK DISCOVERY (Gainers/Losers/Actives during market hours)
// ============================================================================

/**
 * Fetch extended hours (pre-market / after-hours) quote for a stock symbol
 * Uses market-data-gateway's /v1/market/aftermarket-quote endpoint
 *
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{symbol: string, price: number, bid: number, ask: number, source: string}|null>}
 */
async function fetchExtendedHoursQuote(symbol) {
  if (isReplayMode()) return null
  if (!symbol || !config.marketDataGatewayUrl) return null
  if (!canMakeApiCall()) return null

  try {
    trackApiCall()
    const data = await fetchGatewayJsonUnsafe("/v1/market/aftermarket-quote", { symbol })

    if (!data) return null

    const price = parseNumber(data.price)
    if (typeof price !== "number") return null

    return {
      symbol,
      price,
      bid: parseNumber(data.bid),
      ask: parseNumber(data.ask),
      volume: parseNumber(data.volume),
      change24h: parseNumber(data.change24h),
      exchange: data.exchange,
      source: data.source || "gateway_extended",
    }
  } catch (err) {
    console.error(`Extended hours quote failed for ${symbol}:`, err.message)
    return null
  }
}

/**
 * Fetch quotes with extended hours fallback for stocks during pre/after market
 * 
 * @param {string[]} symbols - Stock symbols to fetch
 * @returns {Promise<Array<{symbol: string, quote: object|null, error: string|null}>>}
 */
async function fetchStockQuotesWithExtendedHours(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return []
  
  const marketStatus = getMarketStatus("stock")
  const useExtendedHours =
    !isReplayMode() && (marketStatus.status === "pre" || marketStatus.status === "after")
  
  const concurrency = config.quoteConcurrency
  const delayMs = config.quoteBatchDelayMs
  const results = []
  
  for (let i = 0; i < symbols.length; i += concurrency) {
    const chunk = symbols.slice(i, i + concurrency)
    
    if (!canMakeApiCall()) {
      console.warn(`Rate limit reached, stopping at ${i}/${symbols.length} stock symbols`)
      break
    }
    
    const promises = chunk.map(async (symbol) => {
      try {
        // Try regular quote first
        let quote = await fetchMarketQuote(symbol, "stock")
        
        // If no regular quote and we're in extended hours, try extended hours endpoint
        if (!quote && useExtendedHours) {
          quote = await fetchExtendedHoursQuote(symbol)
        }
        
        return { symbol, quote, error: null }
      } catch (err) {
        return { symbol, quote: null, error: err.message }
      }
    })
    
    const chunkResults = await Promise.all(promises)
    results.push(...chunkResults)
    
    if (i + concurrency < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  
  return results
}

/**
 * Fetch movers (biggest-gainers/losers/most-actives) during market hours.
 * Returns top 10 from each category for a total of up to 30 discovery symbols
 * @param {Object} priceFilter - Optional price filter { minPrice, maxPrice, apply }
 */
async function fetchStockMovers(priceFilter = {}) {
  if (isReplayMode()) return []
  const marketStatus = getMarketStatus("stock")

  // Only fetch during regular market hours - these endpoints return empty otherwise
  if (marketStatus.status !== "open") {
    console.log("ps_discovery_skip", {
      reason: "market_closed",
      marketStatus: marketStatus.status
    })
    return []
  }

  if (!canMakeApiCall()) {
    console.log("ps_discovery_skip", { reason: "rate_limit" })
    return []
  }

  const { minPrice, maxPrice, apply: applyPriceFilter } = priceFilter

  const discoveredSymbols = new Set()
  const endpoints = [
    { path: "/v1/market/biggest-gainers", name: "gainers" },
    { path: "/v1/market/biggest-losers", name: "losers" },
    { path: "/v1/market/most-actives", name: "actives" },
  ]

  for (const { path, name } of endpoints) {
    try {
      trackApiCall()
      const response = await fetchGatewayJsonSoft(path)
      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : []

      if (!Array.isArray(data)) continue

      // Take top 10 from each category, filtered by price if configured
      let filtered = data.slice(0, 10)
      let priceFilteredCount = 0

      if (applyPriceFilter) {
        const beforeCount = filtered.length
        filtered = filtered.filter((item) => {
          const price = item?.price
          if (typeof price !== "number") return true // keep items without price data
          if (minPrice !== null && price < minPrice) return false
          if (maxPrice !== null && price > maxPrice) return false
          return true
        })
        priceFilteredCount = beforeCount - filtered.length
      }

      const symbols = filtered.map((item) => item?.symbol).filter(Boolean)
      symbols.forEach((s) => discoveredSymbols.add(s))

      console.log("ps_discovery", {
        endpoint: name,
        found: symbols.length,
        priceFiltered: priceFilteredCount,
        symbols: symbols.slice(0, 5).join(",") + (symbols.length > 5 ? "..." : "")
      })
    } catch (err) {
      console.error(`Discovery ${name} failed:`, err.message)
    }
  }
  
  console.log("ps_discovery_complete", { 
    totalDiscovered: discoveredSymbols.size,
    rateLimit: getRateLimitStatus().utilizationPct + "%"
  })
  
  return Array.from(discoveredSymbols)
}

async function fetchMarketIntelMovers(turnoverConfig, priceConfig) {
  try {
    const moversSnap = await db.doc("market/movers").get()
    if (!moversSnap.exists) {
      console.log("ps_intel_movers_skip", { reason: "document_not_found" })
      return []
    }

    const moversData = moversSnap.data()
    const usMarket = moversData.markets?.us

    if (!usMarket) {
      console.log("ps_intel_movers_skip", { reason: "no_us_market_data" })
      return []
    }

    const applyTurnoverFilter =
      turnoverConfig?.apply &&
      (Number.isFinite(turnoverConfig.minPct) || Number.isFinite(turnoverConfig.maxPct))
    const applyPriceFilter = priceConfig?.apply
    const { minPrice, maxPrice } = priceConfig || {}

    const filterItems = (items) => {
      if (!Array.isArray(items)) return []
      let filtered = items

      // Apply turnover filter
      if (applyTurnoverFilter) {
        filtered = filtered.filter((item) => {
          const turnoverPct = parseNumber(item?.turnoverPct)
          if (!Number.isFinite(turnoverPct)) return false
          if (Number.isFinite(turnoverConfig.minPct) && turnoverPct < turnoverConfig.minPct) {
            return false
          }
          if (Number.isFinite(turnoverConfig.maxPct) && turnoverPct > turnoverConfig.maxPct) {
            return false
          }
          return true
        })
      }

      // Apply price filter
      if (applyPriceFilter) {
        filtered = filtered.filter((item) => {
          const price = parseNumber(item?.price)
          if (!Number.isFinite(price)) return true // keep items without price
          if (minPrice !== null && price < minPrice) return false
          if (maxPrice !== null && price > maxPrice) return false
          return true
        })
      }

      return filtered
    }

    // Combine gainers, losers, and actives - use Set to deduplicate
    const symbolSet = new Set()
    let priceFilteredCount = 0

    // Top 10 gainers
    const gainersRaw = usMarket.gainers || []
    const gainers = filterItems(gainersRaw)
    priceFilteredCount += gainersRaw.slice(0, 10).length - gainers.slice(0, 10).length
    gainers.slice(0, 10).forEach((item) => {
      if (item?.symbol) symbolSet.add(item.symbol)
    })

    // Top 10 losers
    const losersRaw = usMarket.losers || []
    const losers = filterItems(losersRaw)
    priceFilteredCount += losersRaw.slice(0, 10).length - losers.slice(0, 10).length
    losers.slice(0, 10).forEach((item) => {
      if (item?.symbol) symbolSet.add(item.symbol)
    })

    // Top 10 actives (by volume)
    const activesRaw = usMarket.actives || []
    const actives = filterItems(activesRaw)
    priceFilteredCount += activesRaw.slice(0, 10).length - actives.slice(0, 10).length
    actives.slice(0, 10).forEach((item) => {
      if (item?.symbol) symbolSet.add(item.symbol)
    })

    const symbols = Array.from(symbolSet)

    if (symbols.length === 0) {
      console.log("ps_intel_movers_skip", { reason: "no_stock_movers", priceFiltered: priceFilteredCount })
      return []
    }

    console.log("ps_intel_movers", {
      found: symbols.length,
      priceFiltered: priceFilteredCount,
      symbols: symbols.slice(0, 5).join(",") + (symbols.length > 5 ? "..." : "")
    })

    return symbols
  } catch (err) {
    console.error("Failed to fetch market-intel movers:", err.message)
    return []
  }
}

function normalizeSnapshotForex(item) {
  if (!item || typeof item !== "object") return null
  const rawSymbol = item.symbol || item.ticker || item.pair || item.code || ""
  const cleanedRaw = String(rawSymbol).trim().toUpperCase().replace(/_/g, "/").replace(/-/g, "/")
  let symbol = normalizeSymbol(cleanedRaw)
  if (!symbol || !symbol.includes("/")) {
    const stripped = cleanedRaw.replace(/[^A-Z]/g, "")
    if (stripped.length === 6) {
      symbol = `${stripped.slice(0, 3)}/${stripped.slice(3)}`
    }
  }
  if (!symbol) return null
  const bid = parseNumber(item.bid)
  const ask = parseNumber(item.ask)
  const price =
    parseNumber(item.price) ??
    (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask) ??
    parseNumber(item.rate)
  if (typeof price !== "number") return null
  return { symbol, price }
}

function buildWatchHash(sets) {
  const payload = {
    crypto: Array.from(sets.crypto).sort(),
    stock: Array.from(sets.stock).sort(),
    forex: Array.from(sets.forex).sort(),
  }
  return JSON.stringify(payload)
}

function recordPriceHistory(key, price, now) {
  const history = state.priceHistory.get(key) || []
  const timestamp = Number.isFinite(now) ? now : Date.now()
  const last = history[history.length - 1]
  const shouldAppend = !last || last.price !== price || timestamp - last.t > 15000
  if (shouldAppend) {
    history.push({ t: timestamp, price })
  }
  const cutoff = timestamp - config.historyMinutes * 60 * 1000
  let dropIndex = 0
  while (dropIndex < history.length && history[dropIndex].t < cutoff) {
    dropIndex += 1
  }
  if (dropIndex > 0) history.splice(0, dropIndex)
  state.priceHistory.set(key, history)
  return shouldAppend
}

function findPriceBefore(history, targetTime) {
  if (!Array.isArray(history) || history.length === 0) return null
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].t <= targetTime) return history[i].price
  }
  return null
}

function computeChangePct(history, windowMs, now, priceNow) {
  if (!Array.isArray(history) || history.length === 0 || typeof priceNow !== "number") {
    return null
  }
  const target = now - windowMs
  const prevPrice = findPriceBefore(history, target)
  if (!prevPrice || prevPrice === 0) return null
  return ((priceNow - prevPrice) / prevPrice) * 100
}

function computeRangePct(history, windowMs, now, priceNow) {
  if (!Array.isArray(history) || history.length === 0 || typeof priceNow !== "number") {
    return null
  }
  const cutoff = now - windowMs
  let min = Infinity
  let max = -Infinity
  let hasSample = false
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i]
    if (entry.t < cutoff) break
    if (entry.price < min) min = entry.price
    if (entry.price > max) max = entry.price
    hasSample = true
  }
  if (!hasSample || !Number.isFinite(min) || !Number.isFinite(max) || priceNow === 0) {
    return null
  }
  return ((max - min) / priceNow) * 100
}

function updatePrice(assetClass, symbol, price, source, extra = {}) {
  if (!assetClass || !symbol || typeof price !== "number") return
  const now = getEffectiveNow()
  const key = `${assetClass}:${symbol}`
  const existing = state.priceCache.get(key) || {}
  const next = {
    ...existing,
    assetClass,
    symbol,
    price: Number(price),
    source,
    updatedAt: now,
  }
  if (typeof extra.bid === "number") next.bid = extra.bid
  if (typeof extra.ask === "number") next.ask = extra.ask
  if (typeof extra.volume === "number") next.volume = extra.volume
  if (typeof extra.change24h === "number") next.change24h = extra.change24h
  if (typeof extra.exchange === "string") next.exchange = extra.exchange

  const historyUpdated = recordPriceHistory(key, next.price, now)
  const changed =
    !existing ||
    existing.price !== next.price ||
    existing.bid !== next.bid ||
    existing.ask !== next.ask ||
    existing.volume !== next.volume
  if (changed || historyUpdated) {
    state.priceCache.set(key, next)
    state.dirty = true
  }
}

function prunePriceCache(allowedKeys) {
  state.priceCache.forEach((_, key) => {
    if (!allowedKeys.has(key)) {
      state.priceCache.delete(key)
      state.priceHistory.delete(key)
      state.dirty = true
    }
  })
}

function buildHealthPayload() {
  const now = Date.now()
  const priceAge = state.lastFlushAt ? now - state.lastFlushAt : null
  
  // Get market status for each asset class
  const marketStatus = {
    crypto: getMarketStatus("crypto").status,
    stock: getMarketStatus("stock").status,
    forex: getMarketStatus("forex").status,
  }

  const activeAssets = {
    crypto: state.watchlist.crypto.size > 0,
    stock: state.watchlist.stock.size > 0,
    forex: state.watchlist.forex.size > 0,
  }

  const activeOpenAssets = ["crypto", "stock", "forex"].filter(
    (asset) => activeAssets[asset] && isMarketOpenForAsset(asset, marketStatus[asset])
  )
  const isPriceStale =
    activeOpenAssets.length > 0 &&
    priceAge !== null &&
    priceAge > STALENESS_THRESHOLDS.price
  
  // Check poll staleness per asset class
  const pollHealth = {}
  for (const asset of ["crypto", "stock", "forex"]) {
    const lastPoll = state.lastPollAt[asset]
    const pollAge = lastPoll ? now - lastPoll : null
    const isActive = activeAssets[asset]
    const isOpen = isMarketOpenForAsset(asset, marketStatus[asset])
    const shouldCheck = isActive && isOpen
    const isStale = shouldCheck && pollAge !== null && pollAge > STALENESS_THRESHOLDS.poll
    pollHealth[asset] = {
      lastPollAt: lastPoll ? new Date(lastPoll).toISOString() : null,
      ageMs: pollAge,
      isStale,
      active: isActive,
      errors: state.pollErrors[asset] || 0,
      marketStatus: marketStatus[asset],
    }
  }

  const streamHealth = state.stream
      ? {
        enabled: config.streamEnabled,
        connected: state.stream.connected,
        streams: state.stream.streams,
        provider: state.stream.provider,
        providerUrl: state.stream.providerUrl,
        failoverCount: state.stream.failoverCount,
        lastMessageAt: state.stream.lastMessageAt
          ? new Date(state.stream.lastMessageAt).toISOString()
          : null,
        lastHeartbeatAt: state.stream.lastHeartbeatAt
          ? new Date(state.stream.lastHeartbeatAt).toISOString()
          : null,
        lastRawMessageAt: state.stream.lastRawMessageAt
          ? new Date(state.stream.lastRawMessageAt).toISOString()
          : null,
        lastAssetMessageAt: {
          crypto: state.stream.lastAssetMessageAt.crypto
            ? new Date(state.stream.lastAssetMessageAt.crypto).toISOString()
            : null,
          stock: state.stream.lastAssetMessageAt.stock
            ? new Date(state.stream.lastAssetMessageAt.stock).toISOString()
            : null,
          forex: state.stream.lastAssetMessageAt.forex
            ? new Date(state.stream.lastAssetMessageAt.forex).toISOString()
            : null,
        },
        lastQuoteAt: state.stream.lastQuoteAt
          ? new Date(state.stream.lastQuoteAt).toISOString()
          : null,
        lastRawSymbol: state.stream.lastRawSymbol || null,
        lastFilteredAt: state.stream.lastFilteredAt
          ? new Date(state.stream.lastFilteredAt).toISOString()
          : null,
        lastFilteredSymbol: state.stream.lastFilteredSymbol || null,
        rawMessageCount: state.stream.rawMessageCount,
        quoteCount: state.stream.quoteCount,
        filteredCount: state.stream.filteredCount,
        parseErrorCount: state.stream.parseErrorCount,
        lastParseErrorAt: state.stream.lastParseErrorAt
          ? new Date(state.stream.lastParseErrorAt).toISOString()
          : null,
        lastParseErrorSample: state.stream.lastParseErrorSample || null,
        authenticated: state.stream.authenticated,
        lastLoginAt: state.stream.lastLoginAt
          ? new Date(state.stream.lastLoginAt).toISOString()
          : null,
        lastLoginStatus: state.stream.lastLoginStatus,
        filterCounts: {
          crypto: state.stream.filter.crypto.size,
          stock: state.stream.filter.stock.size,
          forex: state.stream.filter.forex.size,
        },
        errors: state.stream.errors,
        lastError: state.stream.lastError,
      }
    : { enabled: config.streamEnabled }
  
  // Determine overall health status
  const hasStaleData = isPriceStale || Object.values(pollHealth).some(p => p.isStale)
  const hasErrors = state.consecutiveErrors > 3 || Object.values(state.pollErrors).some(e => e > 5)
  const status = hasErrors ? "degraded" : hasStaleData ? "stale" : "ok"
  
  return {
    service: "price_streamer",
    status,
    runId,
    startedAt: new Date(state.startedAt).toISOString(),
    uptimeMs: now - state.startedAt,
    updatedAt: state.lastFlushAt ? new Date(state.lastFlushAt).toISOString() : null,
    priceAgeMs: priceAge,
    isPriceStale,
    lastFlushError: state.lastFlushError || null,
    consecutiveErrors: state.consecutiveErrors,
    priceCount: state.priceCache.size,
    watchlist: {
      crypto: state.watchlist.crypto.size,
      stock: state.watchlist.stock.size,
      forex: state.watchlist.forex.size,
    },
    marketStatus,
    pollHealth,
    stream: streamHealth,
    rateLimit: getRateLimitStatus(),
    redis: {
      enabled: Boolean(config.redisUrl),
      connected: Boolean(state.redisReady),
    },
    replay: {
      mode: state.replay.mode,
      runId: state.replay.runId,
      sessionId: state.replay.sessionId,
      phase: state.replay.phase,
      asOf: Number.isFinite(state.replay.asOfMs)
        ? new Date(state.replay.asOfMs).toISOString()
        : null,
    },
  }
}

function shouldWriteRedisSnapshot(now) {
  if (!config.redisSnapshotMs || config.redisSnapshotMs <= 0) return false
  return now - state.lastRedisSnapshotAt >= config.redisSnapshotMs
}

async function writeRedisPrices(items, meta, replayState = state.replay) {
  if (!state.redis || !state.redisReady) return
  const now = getEffectiveNow()
  const latestKey = resolveRedisKey("prices:latest", replayState)
  const payload = JSON.stringify({
    updatedAt: now,
    items,
    meta,
  })
  const multi = state.redis.multi()
  multi.set(latestKey, payload, { EX: Math.max(config.redisLatestTtlSeconds, 10) })

  if (shouldWriteRedisSnapshot(now)) {
    const snapshotKey = resolveRedisKey(`prices:snapshot:${now}`, replayState)
    const indexKey = resolveRedisKey("prices:snapshots", replayState)
    const ttlSeconds = Math.max(config.redisSnapshotTtlSeconds, 300)
    const cutoff = now - ttlSeconds * 1000
    multi.set(snapshotKey, payload, { EX: ttlSeconds })
    multi.zAdd(indexKey, [{ score: now, value: snapshotKey }])
    multi.zRemRangeByScore(indexKey, 0, cutoff)
    state.lastRedisSnapshotAt = now
  }

  try {
    await multi.exec()
  } catch (err) {
    console.error("Redis price write failed:", err.message)
  }
}

function startServer() {
  const serverInstance = http.createServer((req, res) => {
    const path = (req.url || "/").split("?")[0]
    if (path === "/" || path === "/healthz" || path === "/readyz") {
      const payload = buildHealthPayload()
      const body = JSON.stringify(payload)
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      })
      res.end(body)
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("Not found")
  })

  serverInstance.listen(config.port, () => {
    console.log("Health server listening", { port: config.port })
  })

  return serverInstance
}

async function refreshWatchlist() {
  try {
    const isReplay = isReplayMode() && state.replay.runId
    const hotTradesPath = isReplay
      ? `replay/controls/runs/${state.replay.runId}/market/hotTrades`
      : "market/hotTrades"
    const actionBoardPath = isReplay
      ? `replay/controls/runs/${state.replay.runId}/market/actionBoard`
      : "market/actionBoard"
    const streamSymbolsPath = isReplay
      ? `replay/controls/runs/${state.replay.runId}/market/streamSymbols`
      : "market/streamSymbols"
    const [
      universeSnap,
      controlsSnap,
      hotTradesSnap,
      actionBoardSnap,
      positionsSnap,
      streamSnap,
    ] = await Promise.all([
      db.doc("market/universe").get(),
      db.doc("market/controls").get(),
      db.doc(hotTradesPath).get(),
      db.doc(actionBoardPath).get(),
      isReplay ? Promise.resolve({ empty: true, docs: [] }) : db.collectionGroup("positions").get(),
      db.doc(streamSymbolsPath).get(),
    ])
    const universe = universeSnap.exists ? universeSnap.data() : {}
    const controls = controlsSnap.exists ? controlsSnap.data() : {}
    const dataProfile = resolveDataProfile(controls)
    if (state.dataProfile !== dataProfile) {
      state.dataProfile = dataProfile
      console.log("ps_data_profile", { profile: dataProfile })
    }
    const stockQuoteMode = resolveStockQuoteMode(controls)
    if (state.stockQuoteMode !== stockQuoteMode) {
      state.stockQuoteMode = stockQuoteMode
      console.log("ps_stock_quote_mode", { mode: stockQuoteMode })
    }
    if (stockQuoteMode === "stream_only" && !config.streamEnabled) {
      console.warn("ps_stream_only_disabled", { reason: "stream_disabled" })
    }
    const hotTrades = hotTradesSnap.exists ? hotTradesSnap.data()?.items || [] : []
    const actionBoard = actionBoardSnap.exists ? actionBoardSnap.data() : {}
    const actionBoardItems = [
      ...(actionBoard?.buys || []),
      ...(actionBoard?.sells || []),
    ]
    const positionItems = positionsSnap.empty
      ? []
      : positionsSnap.docs
          .map((doc) => doc.data() || {})
          .map((position) => {
            const assetClassRaw =
              typeof position.assetClass === "string"
                ? position.assetClass.toLowerCase()
                : null
            if (!assetClassRaw || !["crypto", "stock", "forex"].includes(assetClassRaw)) {
              if (position?.symbol) {
                console.warn("ps_position_missing_asset_class", { symbol: position.symbol })
              }
              return null
            }
            return {
              assetClass: assetClassRaw,
              symbol: position.symbol,
            }
          })
          .filter(Boolean)

    const globalMode = resolveUniverseMode(universe.mode)
    const cryptoMode = resolveUniverseMode(universe?.crypto?.mode || globalMode)
    const stockMode = resolveUniverseMode(universe?.stocks?.mode || globalMode)
    const forexMode = resolveUniverseMode(universe?.forex?.mode || globalMode)
    const cryptoEnabled = controls?.cryptoEnabled !== false
    const forexEnabled = controls?.forexEnabled !== false

    await refreshStockUniverseCache()
    const next = {
      crypto: new Set(),
      stock: new Set(),
      forex: new Set(),
    }
    const universeSets = {
      crypto: new Set(),
      stock: new Set(),
      forex: new Set(),
    }

    const universeCrypto = Array.isArray(universe?.crypto?.symbols)
      ? universe.crypto.symbols
      : []
    universeCrypto.forEach((symbol) => {
      const normalized = normalizeSymbolForKey(symbol, "crypto")
      if (normalized) universeSets.crypto.add(normalized)
    })
    const universeStocks = Array.isArray(universe?.stocks?.symbols)
      ? universe.stocks.symbols
      : []
    universeStocks.forEach((symbol) => {
      const normalized = normalizeSymbolForKey(symbol, "stock")
      if (normalized) universeSets.stock.add(normalized)
    })
    const universeForex = Array.isArray(universe?.forex?.pairs)
      ? universe.forex.pairs
      : []
    universeForex.forEach((symbol) => {
      const normalized = normalizeSymbolForKey(symbol, "forex")
      if (normalized) universeSets.forex.add(normalized)
    })

    const addItems = (items, { respectUniverse = true } = {}) => {
      items.forEach((item) => {
        const assetClass = item?.assetClass
        if (!assetClass || !next[assetClass]) return
        const normalized = normalizeSymbolForKey(item.symbol, assetClass)
        if (!normalized) return
        if (respectUniverse) {
          const mode =
            assetClass === "crypto"
              ? cryptoMode
              : assetClass === "forex"
                ? forexMode
                : stockMode
          if (mode === "universe_only" || mode === "movers_filtered_by_universe") {
            const universeSet = universeSets[assetClass]
            if (!universeSet || !universeSet.has(normalized)) return
          }
        }
        const cap = getSymbolCap(assetClass)
        if (next[assetClass].size < cap) {
          next[assetClass].add(normalized)
        }
      })
    }

    const addSymbols = (symbols, assetClass) => {
      if (!Array.isArray(symbols) || !next[assetClass]) return
      symbols.forEach((symbol) => {
        const normalized = normalizeSymbolForKey(symbol, assetClass)
        if (!normalized) return
        const cap = getSymbolCap(assetClass)
        if (next[assetClass].size < cap) {
          next[assetClass].add(normalized)
        }
      })
    }

    addItems(positionItems, { respectUniverse: false })
    addItems(actionBoardItems, { respectUniverse: false })
    addItems(hotTrades, { respectUniverse: true })

    if (shouldIncludeUniverse(cryptoMode)) {
      universeSets.crypto.forEach((symbol) => {
        if (next.crypto.size < getSymbolCap("crypto")) next.crypto.add(symbol)
      })
    }
    if (shouldIncludeUniverse(stockMode)) {
      universeSets.stock.forEach((symbol) => {
        if (next.stock.size < getSymbolCap("stock")) next.stock.add(symbol)
      })
    }
    if (shouldIncludeUniverse(forexMode)) {
      universeSets.forex.forEach((symbol) => {
        if (next.forex.size < getSymbolCap("forex")) next.forex.add(symbol)
      })
    }

    if (streamSnap.exists) {
      const streamData = streamSnap.data() || {}
      const sources = streamData.sources || {}
      const topSymbols = streamData.symbols || {}
      const now = Date.now()
      const appendSource = (source) => {
        if (!source || typeof source !== "object") return
        const updatedAt = source.updatedAt?.toDate?.()
        if (updatedAt && now - updatedAt.getTime() > STREAM_SYMBOL_TTL_MS) return
        const symbols = source.symbols || {}
        addSymbols(symbols.crypto, "crypto")
        addSymbols(symbols.stock, "stock")
        addSymbols(symbols.forex, "forex")
      }
      Object.values(sources).forEach((source) => appendSource(source))
      addSymbols(topSymbols.crypto, "crypto")
      addSymbols(topSymbols.stock, "stock")
      addSymbols(topSymbols.forex, "forex")
    }

    if (!cryptoEnabled) {
      next.crypto.clear()
      universeSets.crypto.clear()
    }
    if (!forexEnabled) {
      next.forex.clear()
      universeSets.forex.clear()
    }

    // Stock Discovery: Add gainers/losers/actives during market hours
    // This runs only when US stock market is open
    if (config.marketDataGatewayUrl && !isReplayMode()) {
      const priceFilter = resolveMoverPriceFilter(controls)
      if (priceFilter.apply) {
        console.log("ps_discovery_price_filter", {
          minPrice: priceFilter.minPrice,
          maxPrice: priceFilter.maxPrice
        })
      }
      const profileConfig = resolveProfileConfig(dataProfile)
      const now = Date.now()
      if (!Number.isFinite(profileConfig.discoveryIntervalMs)) {
        console.log("ps_discovery_skip", { reason: "profile", profile: dataProfile })
      } else if (
        state.lastDiscoveryAt &&
        now - state.lastDiscoveryAt < profileConfig.discoveryIntervalMs
      ) {
        console.log("ps_discovery_skip", {
          reason: "interval",
          profile: dataProfile,
          waitMs: profileConfig.discoveryIntervalMs - (now - state.lastDiscoveryAt),
        })
      } else {
        const discoveredStocks = await fetchStockMovers(priceFilter)
        state.lastDiscoveryAt = Date.now()
        if (discoveredStocks.length > 0) {
          addSymbols(discoveredStocks, "stock")
          console.log("ps_discovery_added", {
            count: discoveredStocks.length,
            stocksTotal: next.stock.size
          })
        }
      }
    }

    // Also add movers from market-intel pipeline
    const turnoverFilter = resolveTurnoverFilter(controls)
    const intelPriceFilter = resolveMoverPriceFilter(controls)
    const intelMovers = await fetchMarketIntelMovers(turnoverFilter, intelPriceFilter)
    if (intelMovers.length > 0) {
      addSymbols(intelMovers, "stock")
      console.log("ps_intel_movers_added", {
        count: intelMovers.length,
        priceFilterActive: intelPriceFilter.apply,
        stocksTotal: next.stock.size
      })
    }

    const allowStockDiscovery =
      stockMode !== "universe_only" && stockMode !== "movers_filtered_by_universe"
    if (allowStockDiscovery) {
      fillFromStockUniverse(next.stock, getSymbolCap("stock"))
    }

    const nextHash = buildWatchHash(next)
    if (nextHash === state.lastWatchHash) return

    state.watchlist = next
    state.lastWatchHash = nextHash
    refreshStreamFilterFromWatchlist()

    const allowedKeys = new Set()
    next.crypto.forEach((symbol) => allowedKeys.add(`crypto:${symbol}`))
    next.stock.forEach((symbol) => allowedKeys.add(`stock:${symbol}`))
    next.forex.forEach((symbol) => allowedKeys.add(`forex:${symbol}`))
    prunePriceCache(allowedKeys)

    console.log("Watchlist refreshed", {
      crypto: next.crypto.size,
      stock: next.stock.size,
      forex: next.forex.size,
    })
  } catch (err) {
    console.error("Watchlist refresh failed:", err.message)
  }
}

function shouldThrottlePolling(assetClass, marketStatus) {
  if (isReplayMode()) return false
  let minIntervalMs = null

  if (assetClass === "stock") {
    if (marketStatus === "pre" || marketStatus === "after") {
      minIntervalMs = config.stockExtendedPollMs
    } else if (marketStatus === "closed") {
      minIntervalMs = config.stockClosedPollMs
    }
  } else if (assetClass === "forex") {
    if (marketStatus === "closed") {
      minIntervalMs = config.forexClosedPollMs
    }
  }

  if (!Number.isFinite(minIntervalMs)) return false
  if (minIntervalMs <= 0) return true
  const lastPollAt = state.lastPollAt[assetClass]
  if (!lastPollAt) return false
  return Date.now() - lastPollAt < minIntervalMs
}


async function pollCryptoPrices() {
  if (isReplayMode()) return
  if (state.pollInFlight.crypto) {
    console.log("ps_poll_skip", { assetClass: "crypto", reason: "in_flight" })
    return
  }
  const profileConfig = resolveProfileConfig(state.dataProfile || "normal")
  if (
    state.lastPollAt.crypto &&
    Date.now() - state.lastPollAt.crypto < profileConfig.cryptoPollMinMs
  ) {
    return
  }
  if (shouldUseStreamFor("crypto")) return
  const allSymbols = Array.from(state.watchlist.crypto)
  if (!config.marketDataGatewayUrl || allSymbols.length === 0) return

  const slice = getPollSlice("crypto", allSymbols, config.cryptoPollMs)
  if (slice.symbols.length === 0) {
    if (slice.total > 0) {
      console.warn("ps_poll_skip", {
        assetClass: "crypto",
        reason: "rate_limit",
        total: slice.total,
        rateLimit: getRateLimitStatus().utilizationPct + "%",
      })
    }
    return
  }
  
  state.pollInFlight.crypto = true
  const marketStatus = getMarketStatus("crypto")
  console.log("ps_ingest", { 
    runId, 
    assetClass: "crypto", 
    count: slice.symbols.length,
    total: slice.total,
    budget: slice.budget,
    marketStatus: marketStatus.status,
    rateLimit: getRateLimitStatus().utilizationPct + "%"
  })
  
  let processed = 0
  try {
    // Use parallel single quotes instead of batch
    const results = await fetchQuotesParallel(slice.symbols, "crypto")
    processed = results.length
    let successCount = 0
    let errorCount = 0
    
    results.forEach(({ symbol, quote, error }) => {
      if (error) {
        errorCount++
        return
      }
      if (!quote) return
      
      const normalizedSymbol = normalizeSymbolForKey(quote.symbol || symbol, "crypto")
      if (!normalizedSymbol || typeof quote.price !== "number") return
      
      successCount++
      updatePrice("crypto", normalizedSymbol, quote.price, quote.source || "gateway", {
        bid: quote.bid,
        ask: quote.ask,
        volume: quote.volume,
        change24h: quote.change24h,
      })
    })
    
    console.log("ps_ingest_complete", { 
      runId, 
      assetClass: "crypto", 
      requested: slice.symbols.length,
      processed,
      success: successCount,
      errors: errorCount,
    })
    
    if (processed > 0) {
      advancePollCursor("crypto", slice.total, processed)
      state.lastPollAt.crypto = getEffectiveNow()
    }
    state.pollErrors.crypto = errorCount > 0 ? errorCount : 0
  } catch (err) {
    state.pollErrors.crypto = (state.pollErrors.crypto || 0) + 1
    console.error("ps_poll_error", { assetClass: "crypto", error: err.message, consecutiveErrors: state.pollErrors.crypto })
  } finally {
    state.pollInFlight.crypto = false
  }
}

async function pollStockPrices() {
  if (isReplayMode() && state.replay.phase !== "running") return
  if (isReplayMode() && !Number.isFinite(state.replay.asOfMs)) return
  if (state.pollInFlight.stock) {
    console.log("ps_poll_skip", { assetClass: "stock", reason: "in_flight" })
    return
  }
  const profileConfig = resolveProfileConfig(state.dataProfile || "normal")
  if (
    state.lastPollAt.stock &&
    Date.now() - state.lastPollAt.stock < profileConfig.stockPollMinMs
  ) {
    return
  }
  const allSymbols = Array.from(state.watchlist.stock)
  const streamSymbols = shouldUseStreamFor("stock") ? new Set(resolveStreamSymbols()) : new Set()
  const pollUniverse =
    streamSymbols.size > 0 ? allSymbols.filter((symbol) => !streamSymbols.has(symbol)) : allSymbols
  if (!isReplayMode() && shouldUseStreamFor("stock") && pollUniverse.length === 0) return
  if (!config.marketDataGatewayUrl || pollUniverse.length === 0) return
  if (isReplayMode() && !config.marketDataGatewayUrl) {
    console.error("Replay mode requires MARKET_DATA_GATEWAY_URL for price polling")
    return
  }
  
  const marketStatus = getMarketStatus("stock")
  if (!isReplayMode() && shouldThrottlePolling("stock", marketStatus.status)) return
  const slice = getPollSlice("stock", pollUniverse, config.stockPollMs)
  if (slice.symbols.length === 0) {
    if (slice.total > 0) {
      console.warn("ps_poll_skip", {
        assetClass: "stock",
        reason: "rate_limit",
        total: slice.total,
        marketStatus: marketStatus.status,
        rateLimit: getRateLimitStatus().utilizationPct + "%",
      })
    }
    return
  }

  state.pollInFlight.stock = true
  const useExtendedHours = marketStatus.status === "pre" || marketStatus.status === "after"
  
  console.log("ps_ingest", { 
    runId, 
    assetClass: "stock", 
    count: slice.symbols.length,
    total: slice.total,
    budget: slice.budget,
    marketStatus: marketStatus.status,
    extendedHours: useExtendedHours,
    rateLimit: getRateLimitStatus().utilizationPct + "%"
  })
  
  let processed = 0
  try {
    // Use extended hours fetching which tries regular quotes first,
    // then falls back to aftermarket-quote during pre/after market hours
    const results = await fetchStockQuotesWithExtendedHours(slice.symbols)
    processed = results.length
    let successCount = 0
    let errorCount = 0
    let extendedCount = 0
    
    results.forEach(({ symbol, quote, error }) => {
      if (error) {
        errorCount++
        return
      }
      if (!quote) return
      
      const normalizedSymbol = normalizeSymbolForKey(quote.symbol || symbol, "stock")
      if (!normalizedSymbol || typeof quote.price !== "number") return
      
      successCount++
      if (quote.source === "gateway_extended") extendedCount++
      
      updatePrice("stock", normalizedSymbol, quote.price, quote.source || "gateway", {
        bid: quote.bid,
        ask: quote.ask,
        volume: quote.volume,
        change24h: quote.change24h,
        exchange: quote.exchange || quote.exchangeShortName,
      })
    })
    
    console.log("ps_ingest_complete", { 
      runId, 
      assetClass: "stock", 
      requested: slice.symbols.length,
      processed,
      success: successCount,
      extendedHours: extendedCount,
      errors: errorCount,
      marketStatus: marketStatus.status,
    })
    
    if (processed > 0) {
      advancePollCursor("stock", slice.total, processed)
      state.lastPollAt.stock = getEffectiveNow()
    }
    state.pollErrors.stock = errorCount > 0 ? errorCount : 0
  } catch (err) {
    state.pollErrors.stock = (state.pollErrors.stock || 0) + 1
    console.error("ps_poll_error", { assetClass: "stock", error: err.message, consecutiveErrors: state.pollErrors.stock })
  } finally {
    state.pollInFlight.stock = false
  }
}

async function pollForexPrices() {
  if (isReplayMode()) return
  if (state.pollInFlight.forex) {
    console.log("ps_poll_skip", { assetClass: "forex", reason: "in_flight" })
    return
  }
  const profileConfig = resolveProfileConfig(state.dataProfile || "normal")
  if (
    state.lastPollAt.forex &&
    Date.now() - state.lastPollAt.forex < profileConfig.forexPollMinMs
  ) {
    return
  }
  if (shouldUseStreamFor("forex")) return
  const allSymbols = Array.from(state.watchlist.forex)
  if (!config.marketDataGatewayUrl || allSymbols.length === 0) return
  
  const marketStatus = getMarketStatus("forex")
  if (shouldThrottlePolling("forex", marketStatus.status)) return
  const slice = getPollSlice("forex", allSymbols, config.forexPollMs)
  if (slice.symbols.length === 0) {
    if (slice.total > 0) {
      console.warn("ps_poll_skip", {
        assetClass: "forex",
        reason: "rate_limit",
        total: slice.total,
        marketStatus: marketStatus.status,
        rateLimit: getRateLimitStatus().utilizationPct + "%",
      })
    }
    return
  }

  state.pollInFlight.forex = true
  console.log("ps_ingest", { 
    runId, 
    assetClass: "forex", 
    count: slice.symbols.length,
    total: slice.total,
    budget: slice.budget,
    marketStatus: marketStatus.status,
    rateLimit: getRateLimitStatus().utilizationPct + "%"
  })
  
  let processed = 0
  try {
    // Use parallel single quotes instead of batch
    const results = await fetchQuotesParallel(slice.symbols, "forex")
    processed = results.length
    let successCount = 0
    let errorCount = 0
    
    results.forEach(({ symbol, quote, error }) => {
      if (error) {
        errorCount++
        return
      }
      if (!quote) return
      
      const normalizedSymbol = normalizeSymbolForKey(quote.symbol || symbol, "forex")
      if (!normalizedSymbol || typeof quote.price !== "number") return
      
      successCount++
      updatePrice("forex", normalizedSymbol, quote.price, quote.source || "gateway", {
        bid: quote.bid,
        ask: quote.ask,
        volume: quote.volume,
        change24h: quote.change24h,
      })
    })
    
    console.log("ps_ingest_complete", { 
      runId, 
      assetClass: "forex", 
      requested: slice.symbols.length,
      processed,
      success: successCount,
      errors: errorCount,
    })
    
    if (processed > 0) {
      advancePollCursor("forex", slice.total, processed)
      state.lastPollAt.forex = getEffectiveNow()
    }
    state.pollErrors.forex = errorCount > 0 ? errorCount : 0
  } catch (err) {
    state.pollErrors.forex = (state.pollErrors.forex || 0) + 1
    console.error("ps_poll_error", { assetClass: "forex", error: err.message, consecutiveErrors: state.pollErrors.forex })
  } finally {
    state.pollInFlight.forex = false
  }
}

/**
 * Write pipeline health status to Firestore for UI visibility
 * Called periodically to track service health across the pipeline
 */
async function writeHeartbeat() {
  const now = Date.now()
  if (state.lastHeartbeatAt && now - state.lastHeartbeatAt < STALENESS_THRESHOLDS.heartbeat) {
    return // Don't write too frequently
  }
  
  const health = buildHealthPayload()
  const heartbeatPath =
    isReplayMode() && state.replay.runId
      ? `replay/controls/runs/${state.replay.runId}/pipeline/price_streamer`
      : "pipeline/price_streamer"
  try {
    await db.doc(heartbeatPath).set({
      ...health,
      service: "price_streamer",
      heartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    state.lastHeartbeatAt = now
    state.consecutiveErrors = 0
  } catch (err) {
    state.consecutiveErrors = (state.consecutiveErrors || 0) + 1
    console.error("ps_heartbeat_error", { error: err.message, consecutiveErrors: state.consecutiveErrors })
  }
}

async function flushPrices() {
  if (!state.dirty) return
  state.dirty = false

  const now = getEffectiveNow()
  const startedAt = Date.now()
  const items = Array.from(state.priceCache.values()).map((item) => {
    const key = `${item.assetClass}:${item.symbol}`
    const history = state.priceHistory.get(key) || []
    const change1m = computeChangePct(history, 60 * 1000, now, item.price)
    const change5m = computeChangePct(history, 5 * 60 * 1000, now, item.price)
    const change15m = computeChangePct(history, 15 * 60 * 1000, now, item.price)
    const change1h = computeChangePct(history, 60 * 60 * 1000, now, item.price)
    const volatility1m = computeRangePct(history, 60 * 1000, now, item.price)
    const volatility5m = computeRangePct(history, 5 * 60 * 1000, now, item.price)
    const spreadPct =
      typeof item.bid === "number" && typeof item.ask === "number" && item.price
        ? ((item.ask - item.bid) / item.price) * 100
        : undefined
    const enriched = {
      ...item,
      change1m: Number.isFinite(change1m) ? change1m : undefined,
      change5m: Number.isFinite(change5m) ? change5m : undefined,
      change15m: Number.isFinite(change15m) ? change15m : undefined,
      change1h: Number.isFinite(change1h) ? change1h : undefined,
      volatility1m: Number.isFinite(volatility1m) ? volatility1m : undefined,
      volatility5m: Number.isFinite(volatility5m) ? volatility5m : undefined,
      spreadPct: Number.isFinite(spreadPct) ? spreadPct : undefined,
    }
    return Object.fromEntries(
      Object.entries(enriched).filter(([, value]) => value !== undefined)
    )
  })
  try {
    const replayDesired = isReplayMode()
    const isReplay = replayDesired && Boolean(state.replay.runId)
    if (replayDesired && !state.replay.runId) {
      console.error("Replay mode active without runId; skipping writes")
      return
    }
    const stockSource = config.marketDataGatewayUrl ? "gateway" : "disabled"
    const forexSource = config.marketDataGatewayUrl ? "gateway" : "disabled"
    const cryptoSource = config.marketDataGatewayUrl ? "gateway" : "disabled"

    const meta = {
      runId: isReplay ? state.replay.runId : runId,
      mode: isReplay ? "replay" : "live",
      count: items.length,
      sources: {
        crypto: cryptoSource,
        stock: stockSource,
        forex: forexSource,
      },
      watchlist: {
        crypto: state.watchlist.crypto.size,
        stock: state.watchlist.stock.size,
        forex: state.watchlist.forex.size,
      },
    }
    if (isReplay) {
      meta.asOf = new Date(now).toISOString()
    }
    await writeRedisPrices(items, meta, state.replay)
    console.log("ps_write_redis", {
      runId,
      count: items.length,
      updatedAt: new Date().toISOString(),
    })
    const firestorePath = isReplay
      ? `replay/controls/runs/${state.replay.runId}/market/prices`
      : "market/prices"
    const firestorePayload = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      items,
      meta,
    }
    if (isReplay) {
      firestorePayload.asOf = admin.firestore.Timestamp.fromDate(new Date(now))
    }
    await db.doc(firestorePath).set(firestorePayload, { merge: true })
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "price_streamer",
        eventType: "fs_write",
        edgeKey: "price_streamer->firestore",
        nodeIds: ["price_streamer", "firestore"],
        status: "end",
        durationMs: Date.now() - startedAt,
        meta: {
          runId: isReplay ? state.replay.runId : runId,
          count: items.length,
          mode: isReplay ? "replay" : "live",
        },
        outputs: {
          firestoreDocs: [firestorePath],
        },
      })
    )
    state.lastFlushAt = Date.now()
    state.lastFlushError = null
    const redisLatestKey = resolveRedisKey("prices:latest", state.replay)
    const redisSnapshotKey = resolveRedisKey("prices:snapshot:*", state.replay)
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "redis_hot",
        eventType: "redis_write",
        edgeKey: "price_streamer->redis",
        nodeIds: ["price_streamer", "redis"],
        status: "end",
        durationMs: Date.now() - startedAt,
        meta: {
          symbolsUpdated: items.length,
          markets: Object.keys(meta.sources || {}),
          sources: meta.sources,
          watchlist: meta.watchlist,
          mode: isReplay ? "replay" : "live",
        },
        outputs: {
          redisKeys: [
            redisLatestKey,
            redisSnapshotKey,
          ],
          firestoreDocs: [firestorePath],
        },
      })
    )
  } catch (err) {
    console.error("Failed to write market/prices:", err.message)
    state.lastFlushError = err.message
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "redis_hot",
        eventType: "redis_write",
        edgeKey: "price_streamer->redis",
        nodeIds: ["price_streamer", "redis"],
        status: "error",
        durationMs: Date.now() - startedAt,
        severity: "error",
        error: { message: err?.message ? String(err.message) : "write failed" },
      })
    )
  }
}

async function run() {
  state.redis = await initRedis()
  await hydratePriceHistoryFromRedis()
  await refreshReplayState()
  await maybeAckReplayState()
  await refreshWatchlist()

  if (config.streamEnabled && !isReplayMode()) {
    startStream()
    setInterval(checkStreamHealth, 5000)
    if (config.streamRotateEnabled) {
      state.stream.rotationTimer = setInterval(
        () => rotateStreamSubscriptions("timer"),
        Math.max(10000, config.streamRotateMs)
      )
    }
  }

  setInterval(refreshWatchlist, Math.max(config.watchlistRefreshMs, 15000))
  setInterval(() => {
    refreshReplayState()
      .then(() => maybeAckReplayState())
      .catch((err) => console.error("Replay control refresh error:", err.message))
  }, Math.max(config.replayControlsCacheMs, 1000))
  setInterval(() => {
    tickReplayClock().catch((err) => console.error("Replay tick error:", err.message))
  }, Math.max(config.replayTickMs, 250))
  setInterval(() => {
    pollCryptoPrices().catch((err) => console.error("Crypto poll error:", err.message))
  }, Math.max(config.cryptoPollMs, 5000))
  setInterval(() => {
    pollStockPrices().catch((err) => console.error("Stock poll error:", err.message))
  }, Math.max(config.stockPollMs, 5000))
  setInterval(() => {
    pollForexPrices().catch((err) => console.error("Forex poll error:", err.message))
  }, Math.max(config.forexPollMs, 5000))
  setInterval(flushPrices, Math.max(config.writeMs, 1000))
  
  // Heartbeat: write health status to Firestore every 5 minutes
  setInterval(() => {
    writeHeartbeat().catch((err) => console.error("Heartbeat error:", err.message))
  }, STALENESS_THRESHOLDS.heartbeat)
  
  // Initial heartbeat
  writeHeartbeat().catch((err) => console.error("Initial heartbeat error:", err.message))

  console.log("ps_run_start", { runId })
}

server = startServer()
run().catch((err) => {
  console.error("Price streamer failed", err)
  process.exit(1)
})

function shutdown() {
  stopStream("shutdown")
  if (state.stream?.rotationTimer) {
    clearInterval(state.stream.rotationTimer)
    state.stream.rotationTimer = null
  }
  if (state.redis) {
    state.redis.quit().catch(() => {})
  }
  if (server) {
    server.close(() => process.exit(0))
    return
  }
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
