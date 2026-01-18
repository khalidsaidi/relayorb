const admin = require("firebase-admin")
const crypto = require("crypto")
const { createClient } = require("redis")

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  hotTradesLimit: parseInt(process.env.HOT_TRADES_LIMIT || "12", 10),
  signalLookbackMinutes: parseInt(process.env.BOT_SIGNAL_LOOKBACK_MINUTES || "360", 10),
  signalDecayHalfLifeMinutes: parseInt(process.env.SIGNAL_DECAY_HALF_LIFE_MINUTES || "60", 10),
  signalRecentMinutes: parseInt(process.env.SIGNAL_RECENT_MINUTES || "30", 10),
  signalMinRecent: parseInt(process.env.SIGNAL_MIN_RECENT || "2", 10),
  cryptoLimit: parseInt(process.env.CRYPTO_LIMIT || "40", 10),
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  llmIntervalMinutes: parseInt(process.env.LLM_INTERVAL_MINUTES || "30", 10),
  newsLimit: parseInt(process.env.MARKETAUX_LIMIT || "40", 10),
  newsSymbolLimit: parseInt(process.env.MARKETAUX_SYMBOL_LIMIT || "35", 10),
  newsIntervalMinutes: parseInt(process.env.NEWS_INTERVAL_MINUTES || "60", 10),
  marketDataGatewayUrl: process.env.MARKET_DATA_GATEWAY_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  redisLatestMaxAgeMs: parseInt(process.env.REDIS_LATEST_MAX_AGE_MS || "120000", 10),
  redisEventChannel: process.env.REDIS_EVENT_CHANNEL || "",
  pipelineEventsEnabled: process.env.PIPELINE_EVENTS_ENABLED !== "false",
  pipelineEventsStream: process.env.PIPELINE_EVENTS_STREAM || "",
  pipelineEventsMaxlen: parseInt(process.env.PIPELINE_EVENTS_MAXLEN || "20000", 10),
  pipelineEventsSampleRate: parseFloat(process.env.PIPELINE_EVENTS_SAMPLE_RATE || "0.15"),
  pipelineEventsRunEnv: process.env.PIPELINE_EVENTS_RUN_ENV || "prod",
  replayAllowed: process.env.REPLAY_ALLOWED !== "false",
  replayControlsCacheMs: parseInt(process.env.REPLAY_CONTROLS_CACHE_MS || "1500", 10),
  replayAckIntervalMs: parseInt(process.env.REPLAY_ACK_INTERVAL_MS || "15000", 10),
  candidatePublishLimit: parseInt(process.env.CANDIDATE_PUBLISH_LIMIT || "150", 10),
  batchCollection: process.env.BATCH_COLLECTION || "batches",
  runId: process.env.RUN_ID || "",
  firestoreRunField: process.env.FIRESTORE_RUN_FIELD || "runId",
  moverWindowMinutes: parseInt(process.env.MOVER_WINDOW_MINUTES || "15", 10),
  snapshotChunkSize: parseInt(process.env.SNAPSHOT_CHUNK_SIZE || "250", 10),
  snapshotKeep: parseInt(process.env.SNAPSHOT_KEEP || "6", 10),
  moverTopLimit: parseInt(process.env.MOVER_TOP_LIMIT || "200", 10),
  moverEnrichLimit: parseInt(process.env.MOVER_ENRICH_LIMIT || "50", 10),
  moverMinPrice: parseFloat(process.env.MOVER_MIN_PRICE || "1"),
  moverMinVolume: parseFloat(process.env.MOVER_MIN_VOLUME || "50000"),
  watchlistScoreBoost: parseFloat(process.env.WATCHLIST_SCORE_BOOST || "4"),
  primaryScoreBoost: parseFloat(process.env.PRIMARY_SCORE_BOOST || "3"),
  momentumRatioMax: parseFloat(process.env.MOMENTUM_RATIO_MAX || "2"),
  momentumVolFloor: parseFloat(process.env.MOMENTUM_VOL_FLOOR || "0.05"),
  momentumVolCeil: parseFloat(process.env.MOMENTUM_VOL_CEIL || "15"),
  recommendationLimit: parseInt(process.env.RECOMMENDATION_LIMIT || "50", 10),
  minAccuracySignals: parseInt(process.env.MIN_ACCURACY_SIGNALS || "12", 10),
  autoTuneEnabled: process.env.AUTO_TUNE_ENABLED !== "false",
  autoTuneIntervalHours: parseInt(process.env.AUTO_TUNE_INTERVAL_HOURS || "6", 10),
  autoTuneMaxDelta: parseInt(process.env.AUTO_TUNE_MAX_DELTA || "12", 10),
  stockWatchlistLimit: parseInt(process.env.STOCK_WATCHLIST_LIMIT || "5", 10),
  symbolCacheDays: parseInt(process.env.SYMBOL_CACHE_DAYS || "7", 10),
  symbolCacheMax: parseInt(process.env.SYMBOL_CACHE_MAX || "12000", 10),
  popularPerClass: parseInt(process.env.POPULAR_PER_CLASS || "12", 10),
  trendLimit: parseInt(process.env.TREND_LIMIT || "8", 10),
  emitSignals: process.env.EMIT_MARKET_SIGNALS !== "false",
  actionBoardLimit: parseInt(process.env.ACTION_BOARD_LIMIT || "10", 10),
  signalRequestIntervalMinutes: parseInt(
    process.env.SIGNAL_REQUEST_INTERVAL_MINUTES || "5",
    10
  ),
  signalLimit: parseInt(process.env.MARKET_SIGNAL_LIMIT || "3", 10),
  signalBackfillMinutes: parseInt(
    process.env.MARKET_SIGNAL_BACKFILL_MINUTES || "0",
    10
  ),
  fxPairs: parseList(
    process.env.FX_PAIRS,
    ["USD/JPY", "USD/EUR", "USD/GBP", "USD/CHF", "USD/CAD"]
  ),
}

const VALID_HORIZONS = new Set(["1h", "24h", "7d"])
const TREND_HORIZONS = ["15m", "1h", "24h", "7d"]
const VALID_TREND_HORIZONS = new Set(TREND_HORIZONS)
const VALID_RISK = new Set(["conservative", "balanced", "aggressive"])
const VALID_ASSET_FOCUS = new Set(["crypto", "stock", "forex"])
const UNIVERSE_MODES = new Set([
  "movers_only",
  "universe_only",
  "movers_plus_universe",
  "movers_filtered_by_universe",
  "weighted_union",
])
const DEFAULT_UNIVERSE_MODE = "movers_plus_universe"
const MARKET_SIGNAL_BOT_ID = "market-intel"
// Score weights: increased consensus (bot signals) from 20% to 28% for stronger bot influence
// Reduced momentum slightly to 45% to make room, keeping liquidity at 18% and news at 9%
const BASE_SCORE_WEIGHTS = {
  dip: { momentum: 45, consensus: 28, liquidity: 18, news: 9 },
  scalp: { momentum: 45, consensus: 28, liquidity: 18, news: 9 },
}
// Asset-specific weight tuning for optimal signal quality
const SCORE_WEIGHTS_BY_ASSET = {
  stock: {
    // Stocks: slightly higher liquidity weight due to market hours constraints
    dip: { momentum: 42, consensus: 28, liquidity: 21, news: 9 },
    scalp: { momentum: 42, consensus: 28, liquidity: 21, news: 9 },
  },
  crypto: {
    // Crypto: higher momentum weight due to 24/7 volatility, lower liquidity
    dip: { momentum: 48, consensus: 28, liquidity: 15, news: 9 },
    scalp: { momentum: 48, consensus: 28, liquidity: 15, news: 9 },
  },
  forex: {
    // Forex: balanced approach with slightly higher news weight for macro events
    dip: { momentum: 44, consensus: 27, liquidity: 18, news: 11 },
    scalp: { momentum: 44, consensus: 27, liquidity: 18, news: 11 },
  },
}
// Risk profiles adjust score component weights
// Conservative: trust bots more, less momentum chasing
// Aggressive: momentum focus, less reliance on consensus
const RISK_WEIGHT_MULTIPLIERS = {
  conservative: { momentum: 0.80, consensus: 1.25, liquidity: 1.15, news: 1.10 },
  balanced: { momentum: 1, consensus: 1, liquidity: 1, news: 1 },
  aggressive: { momentum: 1.20, consensus: 0.85, liquidity: 0.80, news: 0.90 },
}

let redis = null
let redisReady = false
let activeRunId = ""
const replayControlsCache = { value: null, expiresAt: 0 }
let replayState = {
  mode: "live",
  runId: null,
  sessionId: null,
  version: null,
  phase: null,
  datasetId: null,
  asOfMs: null,
  lastAckAt: 0,
  lastAckSessionId: null,
  lastAckVersion: null,
}
const SPREAD_PCT_LIMITS = {
  stock: 0.5,
  forex: 0.08,
  crypto: 0.3,
}

function resolvePipelineStream() {
  if (isReplayMode() && replayState.runId) {
    return resolveRedisKey("pipeline_events")
  }
  if (config.pipelineEventsStream) return config.pipelineEventsStream
  return resolveRedisKey("pipeline_events")
}

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function shouldSample(rate) {
  if (typeof rate !== "number" || rate >= 1) return true
  if (rate <= 0) return false
  return Math.random() <= rate
}

function isReplayMode() {
  return replayState?.mode === "replay"
}

function getEffectiveNowMs() {
  if (isReplayMode() && Number.isFinite(replayState.asOfMs)) {
    return replayState.asOfMs
  }
  return Date.now()
}

function getPipelineRunEnv() {
  return isReplayMode() ? "replay" : config.pipelineEventsRunEnv
}

function buildPipelineEvent(payload) {
  const runId = replayState?.runId || config.runId || undefined
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv: getPipelineRunEnv(),
    runId,
    sessionId: replayState?.sessionId || undefined,
    service: "market-intel",
    severity: "info",
    ...payload,
  }
}

async function publishPipelineEvent(event) {
  if (!config.pipelineEventsEnabled || !redis || !redisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(config.pipelineEventsMaxlen)
    ? Math.max(config.pipelineEventsMaxlen, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ["XADD", stream, "MAXLEN", "~", String(maxlen), "*", "payload", payload]
  try {
    await Promise.race([
      redis.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    console.error("Pipeline event publish failed:", err.message)
  }
}
const PAIR_QUOTES = new Set([
  "USDT",
  "USDC",
  "USD",
  "BTC",
  "ETH",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "AUD",
  "CAD",
  "NZD",
])
const FX_CODES = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"])
const TSX_SUFFIXES = [".TO", ".TSX", ".TSXV", ".V"]
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
const DEFAULT_TREND_WEIGHTS = {
  momentum: 50,
  volume: 20,
  signals: 20,
  news: 10,
}

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
const SWING_RULES = {
  entryWindowMinutes: 60,
  exitWindowMinutes: 120,
  rangePositionMax: 0.3,
  distributionLookback: 10,
  distributionMax: 1,
  volumeLookbackSessions: 20,
  volumeWindowMinutes: 60,
  maShort: 20,
  maLong: 50,
  maSlopeLookback: 5,
  notExtendedAtrMult: 1.5,
  stopAtrMult: 0.5,
  profitTriggerPct: 0.5,
}
const PREBREAKOUT_RULES = {
  entryWindowMinutes: 5,
  exitWindowMinutes: 120,
  minMarketCap: 5_000_000,
  maxMarketCap: 80_000_000,
  maxFloatShares: 5_000_000,
  turnoverMinPct: 300,
  turnoverMaxPct: 800,
  rvolMin: 3,
  rvolMax: 8,
  closeNearHighMin: 0.85,
  runUpLookback: 10,
  maxRunUpPct: 70,
  volumeLookbackSessions: 3,
  maShort: 20,
  maLong: 50,
  maSlopeLookback: 5,
  maAlignmentMin: 0.9,
  maAlignmentMax: 1.1,
  atrPctMax: 0.2,
  newsMaxCount: 8,
  profitTriggerPct: 1.0,
  stopAtrMult: 1.0,
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

function parseList(value, fallback = []) {
  if (!value) return fallback
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePercent(value) {
  if (value === undefined || value === null) return undefined
  const cleaned = String(value)
    .replace(/[()%]/g, "")
    .replace(/^\+/, "")
    .trim()
  if (!cleaned) return undefined
  return parseNumber(cleaned)
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

function resolveRedisKey(suffix, replay = replayState) {
  if (replay?.mode === "replay" && replay.runId) {
    return `replay:${replay.runId}:${suffix}`
  }
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}${suffix}`
}

function resolveEventChannel() {
  if (isReplayMode()) return resolveRedisKey("events")
  if (config.redisEventChannel) return config.redisEventChannel
  return resolveRedisKey("events")
}

function resolveSnapshotCollectionName(baseName) {
  if (isReplayMode() && replayState.runId) {
    return `replay/controls/runs/${replayState.runId}/snapshots_${baseName}`
  }
  return baseName
}

function resolveMarketDocPath(docId) {
  if (isReplayMode() && replayState.runId) {
    return `replay/controls/runs/${replayState.runId}/market/${docId}`
  }
  return `market/${docId}`
}

function resolveMarketCollectionPath(collectionName) {
  if (isReplayMode() && replayState.runId) {
    return `replay/controls/runs/${replayState.runId}/${collectionName}`
  }
  return collectionName
}

function resolvePipelineDocPath(docId) {
  if (isReplayMode() && replayState.runId) {
    return `replay/controls/runs/${replayState.runId}/pipeline/${docId}`
  }
  return `pipeline/${docId}`
}

function resolveBatchCollectionName() {
  if (isReplayMode() && replayState.runId) {
    return `replay/controls/runs/${replayState.runId}/${config.batchCollection}`
  }
  return config.batchCollection
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
    redisReady = true
    console.log("Redis connected")
    return client
  } catch (err) {
    console.error("Redis connection failed:", err.message)
    redisReady = false
    return null
  }
}

async function readRedisJson(key) {
  if (!redis || !redisReady) return null
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.error("Redis read failed:", err.message)
    return null
  }
}

async function readRedisLatestPrices() {
  const key = resolveRedisKey("prices:latest")
  const payload = await readRedisJson(key)
  if (config.pipelineEventsEnabled) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "redis_hot",
        eventType: "redis_read",
        edgeKey: "redis->market_intel",
        nodeIds: ["redis", "market_intel"],
        status: "end",
        batchId: activeRunId || undefined,
        meta: {
          key,
          hit: Boolean(payload),
        },
        inputs: {
          redisKeys: [key],
        },
      })
    )
  }
  if (!payload || !Array.isArray(payload.items)) return null
  const updatedAt = parseNumber(payload.updatedAt)
  if (updatedAt && getEffectiveNowMs() - updatedAt > config.redisLatestMaxAgeMs) {
    return null
  }
  return {
    items: payload.items,
    updatedAt: updatedAt ? new Date(updatedAt) : null,
    meta: payload.meta || null,
    source: "redis",
  }
}

async function readRedisSnapshotBefore(cutoff) {
  if (!redis || !redisReady) return null
  const cutoffMs = cutoff instanceof Date ? cutoff.getTime() : Number(cutoff)
  if (!Number.isFinite(cutoffMs)) return null
  const indexKey = resolveRedisKey("prices:snapshots")
  try {
    const keys = await redis.zRangeByScore(indexKey, 0, cutoffMs, {
      REV: true,
      LIMIT: { offset: 0, count: 1 },
    })
    if (!keys || keys.length === 0) return null
    if (config.pipelineEventsEnabled) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "redis_hot",
          eventType: "redis_read",
          edgeKey: "redis->market_intel",
          nodeIds: ["redis", "market_intel"],
          status: "end",
          batchId: activeRunId || undefined,
          meta: {
            key: indexKey,
            hit: true,
          },
          inputs: {
            redisKeys: [indexKey],
          },
        })
      )
    }
    const payload = await readRedisJson(keys[0])
    if (!payload || !Array.isArray(payload.items)) return null
    const updatedAt = parseNumber(payload.updatedAt)
    return {
      createdAt: updatedAt ? new Date(updatedAt) : cutoff,
      items: payload.items,
    }
  } catch (err) {
    console.error("Redis snapshot lookup failed:", err.message)
    return null
  }
}

async function publishRedisEvent(payload) {
  if (!redis || !redisReady) return
  try {
    const channel = resolveEventChannel()
    await redis.publish(channel, JSON.stringify(payload))
  } catch (err) {
    console.error("Redis publish failed:", err.message)
  }
}

function resolveUniverseMode(value) {
  if (!value) return DEFAULT_UNIVERSE_MODE
  const normalized = String(value).trim().toLowerCase()
  return UNIVERSE_MODES.has(normalized) ? normalized : DEFAULT_UNIVERSE_MODE
}

function resolveUniverseModeForAsset(assetConfig, fallback) {
  if (assetConfig?.mode) return resolveUniverseMode(assetConfig.mode)
  if (fallback) return resolveUniverseMode(fallback)
  return DEFAULT_UNIVERSE_MODE
}

function resolveUniverseBoost(mode, watchlisted) {
  if (mode !== "weighted_union") return 0
  if (!watchlisted) return 0
  return config.watchlistScoreBoost
}

function normalizeOrigins(origins) {
  if (!Array.isArray(origins)) return []
  const cleaned = origins
    .map((origin) => String(origin || "").trim())
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

function normalizeOriginsForEvent(origins) {
  const normalized = normalizeOrigins(origins)
  return normalized.length > 0 ? normalized : ["unknown"]
}

function mergeOrigins(existing, next) {
  const merged = new Set([...(existing || []), ...(next || [])])
  return Array.from(merged)
}

function summarizeOrigins(items) {
  const counts = {}
  items.forEach((item) => {
    const origins = normalizeOrigins(item.origins)
    if (origins.length === 0) {
      counts.unknown = (counts.unknown || 0) + 1
      return
    }
    origins.forEach((origin) => {
      counts[origin] = (counts[origin] || 0) + 1
    })
  })
  return counts
}

function parseBotWeights(raw) {
  if (!raw || typeof raw !== "object") return {}
  const parsed = {}
  Object.entries(raw).forEach(([key, value]) => {
    if (!key) return
    const weight = parseNumber(value)
    if (typeof weight !== "number") return
    parsed[String(key)] = clamp(weight, 0, 5)
  })
  return parsed
}

async function readRunConfig(db, runId) {
  if (!runId) return null
  try {
    const snap = await db.doc(`e2e_runs/${runId}`).get()
    if (!snap.exists) return null
    return snap.data() || null
  } catch (err) {
    console.error("Run config fetch failed", err.message)
    return null
  }
}

function normalizeMarketTag(value) {
  if (!value) return null
  const normalized = String(value).trim().toLowerCase()
  if (normalized === "stock" || normalized === "stocks" || normalized === "us" || normalized === "tsx") {
    return "stock"
  }
  if (normalized === "forex" || normalized === "fx") return "forex"
  if (normalized === "crypto" || normalized === "cryptos") return "crypto"
  return null
}

function inferAssetClassFromSymbol(symbol) {
  const normalized = normalizeSymbol(symbol)
  if (!normalized) return null
  if (normalized.includes("/")) {
    const [base, quote] = normalized.split("/")
    if (FX_CODES.has(base) && FX_CODES.has(quote)) return "forex"
    return "crypto"
  }
  return "stock"
}

function normalizeTestSymbol(symbol, assetClass) {
  if (!symbol) return null
  if (assetClass === "stock") return normalizeTicker(symbol)
  return normalizeSymbol(symbol)
}

function buildTestFilter(runConfig) {
  if (!runConfig || runConfig.testMode !== true) return null
  const marketSet = new Set(
    (Array.isArray(runConfig.restrictMarkets) ? runConfig.restrictMarkets : [])
      .map(normalizeMarketTag)
      .filter(Boolean)
  )

  const symbolMap = new Map()
  const symbols = Array.isArray(runConfig.restrictSymbols) ? runConfig.restrictSymbols : []
  symbols.forEach((entry) => {
    let assetClass = null
    let symbol = null
    if (typeof entry === "string") {
      const parts = entry.split(":").map((part) => part.trim())
      if (parts.length === 2) {
        const maybeClass = normalizeMarketTag(parts[0])
        if (maybeClass) {
          assetClass = maybeClass
          symbol = parts[1]
        }
      }
      if (!symbol) symbol = entry
    } else if (entry && typeof entry === "object") {
      assetClass = normalizeMarketTag(entry.assetClass || entry.market || "")
      symbol = entry.symbol || entry.ticker || null
    }

    if (!symbol) return
    if (!assetClass) assetClass = inferAssetClassFromSymbol(symbol)
    const normalized = normalizeTestSymbol(symbol, assetClass)
    if (!normalized || !assetClass) return
    if (!symbolMap.has(assetClass)) {
      symbolMap.set(assetClass, new Set())
    }
    symbolMap.get(assetClass).add(normalized)
  })

  return {
    marketSet,
    symbolMap,
    allow(candidate) {
      if (!candidate) return false
      if (marketSet.size > 0 && !marketSet.has(candidate.assetClass)) return false
      if (symbolMap.size > 0) {
        const allowed = symbolMap.get(candidate.assetClass)
        if (!allowed) return false
        const normalized = normalizeTestSymbol(candidate.symbol, candidate.assetClass)
        if (!normalized || !allowed.has(normalized)) return false
      }
      return true
    },
  }
}

function chunkItems(items, size) {
  if (!Array.isArray(items) || items.length === 0) return []
  const chunkSize = Number.isFinite(size) && size > 0 ? size : 250
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function normalizeSnapshotStock(item, exchangeHint = null) {
  if (!item || typeof item !== "object") return null
  const symbol = normalizeTicker(item.symbol || item.ticker || item.code || "")
  if (!symbol) return null
  const bid = parseNumber(item.bid)
  const ask = parseNumber(item.ask)
  const price =
    parseNumber(item.price) ??
    parseNumber(item.lastSale) ??
    parseNumber(item.lastSalePrice) ??
    parseNumber(item.last) ??
    parseNumber(item.close) ??
    (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask)
  if (typeof price !== "number") return null
  const volume =
    parseNumber(item.volume) ??
    parseNumber(item.avgVolume) ??
    parseNumber(item.volumeAvg)
  const change24h = parsePercent(
    item.change24h ?? item.changesPercentage ?? item.changePercentage ?? item.changePercent ?? item.change
  )
  const change1m = parseNumber(item.change1m)
  const change5m = parseNumber(item.change5m)
  const change15m = parseNumber(item.change15m)
  const volatility1m = parseNumber(item.volatility1m)
  const volatility5m = parseNumber(item.volatility5m)
  const spreadPct =
    parseNumber(item.spreadPct) ??
    (bid !== undefined && ask !== undefined && price
      ? ((ask - bid) / price) * 100
      : undefined)
  return compactObject({
    symbol,
    name: item.name || item.companyName || symbol,
    exchange: exchangeHint || item.exchange || item.exchangeShortName || undefined,
    price,
    volume,
    change24h,
    change1m,
    change5m,
    change15m,
    volatility1m,
    volatility5m,
    bid,
    ask,
    spreadPct,
  })
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
  const volume = parseNumber(item.volume)
  const change24h = parsePercent(
    item.change24h ?? item.changesPercentage ?? item.changePercentage ?? item.changePercent ?? item.change
  )
  const change1m = parseNumber(item.change1m)
  const change5m = parseNumber(item.change5m)
  const change15m = parseNumber(item.change15m)
  const volatility1m = parseNumber(item.volatility1m)
  const volatility5m = parseNumber(item.volatility5m)
  const spreadPct =
    parseNumber(item.spreadPct) ??
    (bid !== undefined && ask !== undefined && price
      ? ((ask - bid) / price) * 100
      : undefined)
  return compactObject({
    symbol,
    name: symbol,
    price,
    volume,
    change24h,
    change1m,
    change5m,
    change15m,
    volatility1m,
    volatility5m,
    bid,
    ask,
    spreadPct,
  })
}

async function writeSnapshot(db, collectionName, items, createdAt, meta = {}) {
  const snapshotId = String(createdAt.getTime())
  const chunks = chunkItems(items, config.snapshotChunkSize)
  const createdAtValue = admin.firestore.Timestamp.fromDate(createdAt)
  const { source, ...metaFields } = meta || {}
  const snapshotSource = source || "stream"

  const writer = db.bulkWriter()
  const snapshotRef = db.collection(collectionName).doc(snapshotId)
  writer.set(
    snapshotRef,
    compactObject({
      createdAt: createdAtValue,
      count: items.length,
      chunkCount: chunks.length,
      source: snapshotSource,
      ...metaFields,
    }),
    { merge: true }
  )

  chunks.forEach((chunk, index) => {
    const chunkRef = snapshotRef.collection("chunks").doc(String(index))
    writer.set(
      chunkRef,
      compactObject({
        index,
        count: chunk.length,
        items: chunk,
      })
    )
  })

  await writer.close()
  return { id: snapshotId, createdAt: createdAtValue, count: items.length }
}

async function readSnapshotItems(snapshotRef) {
  const chunkSnap = await snapshotRef.collection("chunks").get()
  if (chunkSnap.empty) return []
  const items = []
  chunkSnap.docs.forEach((doc) => {
    const data = doc.data() || {}
    if (Array.isArray(data.items)) {
      items.push(...data.items)
    }
  })
  return items
}

async function findSnapshotBefore(db, collectionName, cutoff) {
  const snap = await db
    .collection(collectionName)
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(cutoff))
    .orderBy("createdAt", "desc")
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  const data = doc.data() || {}
  const items = await readSnapshotItems(doc.ref)
  return {
    id: doc.id,
    createdAt: data.createdAt?.toDate?.() || cutoff,
    items,
  }
}

async function pruneSnapshots(db, collectionName, keep) {
  const limit = Number.isFinite(keep) && keep > 0 ? keep : 6
  const snap = await db
    .collection(collectionName)
    .orderBy("createdAt", "desc")
    .offset(limit)
    .limit(50)
    .get()
  if (snap.empty) return
  const writer = db.bulkWriter()
  for (const doc of snap.docs) {
    const chunkSnap = await doc.ref.collection("chunks").get()
    chunkSnap.docs.forEach((chunk) => writer.delete(chunk.ref))
    writer.delete(doc.ref)
  }
  await writer.close()
}

function computeSnapshotMovers(currentItems, previousItems, options = {}) {
  const prevMap = new Map()
  previousItems.forEach((item) => {
    if (!item?.symbol || typeof item.price !== "number") return
    prevMap.set(item.symbol, item)
  })

  const minPrice =
    typeof options.minPrice === "number" && options.minPrice >= 0
      ? options.minPrice
      : 0
  const minVolume =
    typeof options.minVolume === "number" && options.minVolume >= 0
      ? options.minVolume
      : 0
  const enableVolumeFilter = minVolume > 0

  const candidates = []
  currentItems.forEach((item) => {
    if (!item?.symbol || typeof item.price !== "number") return
    const prev = prevMap.get(item.symbol)
    if (!prev || typeof prev.price !== "number" || prev.price === 0) return
    const change15m = ((item.price - prev.price) / prev.price) * 100
    if (item.price < minPrice) return
    if (enableVolumeFilter && typeof item.volume === "number" && item.volume < minVolume) {
      return
    }
    candidates.push({
      ...item,
      change15m,
    })
  })

  const gainers = [...candidates].sort((a, b) => (b.change15m || 0) - (a.change15m || 0))
  const losers = [...candidates].sort((a, b) => (a.change15m || 0) - (b.change15m || 0))
  const actives = [...currentItems]
    .filter((item) => typeof item?.volume === "number")
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))

  return { candidates, gainers, losers, actives }
}

function looksLikePair(left, right) {
  if (!left || !right) return false
  const base = String(left).toUpperCase()
  const quote = String(right).toUpperCase()
  if (PAIR_QUOTES.has(quote)) return true
  if (PAIR_QUOTES.has(base) && PAIR_QUOTES.has(quote)) return true
  return false
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  const compact = upper.replace(/\s+/g, "")
  if (compact.includes("/") || compact.includes("-")) {
    const separator = compact.includes("/") ? "/" : "-"
    const parts = compact.split(separator).filter(Boolean)
    if (parts.length === 2 && looksLikePair(parts[0], parts[1])) {
      return `${parts[0]}/${parts[1]}`
    }
    return compact
  }

  const quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR"]
  for (const quote of quotes) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      return `${compact.slice(0, -quote.length)}/${quote}`
    }
  }

  return compact
}

function normalizeCryptoSymbolForCharting(symbol) {
  const normalized = normalizeSymbol(symbol)
  if (!normalized) return symbol
  if (normalized.includes("/")) {
    const [base, quoteRaw] = normalized.split("/")
    const quote = quoteRaw === "USDT" ? "USD" : quoteRaw
    return `${base}/${quote}`
  }
  return normalized
}

/**
 * Normalizes symbol for charting.
 * @param {string} symbol - The symbol to normalize
 * @param {string} assetClass - The asset class: 'crypto', 'stock', or 'forex'
 * @returns {string} - Normalized symbol for charting
 */
function normalizeSymbolForCharting(symbol, assetClass) {
  if (!symbol || typeof symbol !== 'string') {
    return symbol
  }
  
  const trimmed = symbol.trim().toUpperCase()
  if (!trimmed) {
    return symbol
  }
  
  if (assetClass === 'crypto') {
    return normalizeCryptoSymbolForCharting(symbol)
  } else if (assetClass === 'forex') {
    // For forex, keep slash format (EUR/USD, USD/JPY)
    if (!trimmed.includes('/')) {
      // If no slash, try to infer (e.g., EURUSD -> EUR/USD)
      if (trimmed.length >= 6) {
        const base = trimmed.slice(0, 3)
        const quote = trimmed.slice(3)
        return `${base}/${quote}`
      }
      return symbol
    }
    // Already has slash, keep as is
    return trimmed
  } else if (assetClass === 'stock') {
    // For stocks, remove any slashes and keep uppercase
    return trimmed.replace(/\//g, '').replace(/-/g, '')
  }
  
  return symbol
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function isTsxSymbol(symbol) {
  if (!symbol) return false
  const upper = String(symbol).toUpperCase()
  return TSX_SUFFIXES.some((suffix) => upper.endsWith(suffix))
}

function normalizeSignalKey(raw) {
  if (!raw) return null
  let normalized = normalizeSymbol(raw)
  if (normalized && normalized.includes("/")) {
    // Normalize stablecoin quotes to USD for consistent matching
    // USDT, USDC, BUSD etc. should match USD candidates
    const [base, quote] = normalized.split("/")
    if (quote === "USDT" || quote === "USDC" || quote === "BUSD" || quote === "DAI") {
      normalized = `${base}/USD`
    }
    return normalized
  }
  const ticker = normalizeTicker(raw)
  return ticker || normalized
}

function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function extractSymbolFromSignal(signal) {
  const data = signal.data || {}
  const candidate =
    data.symbol ||
    data.pair ||
    data.market ||
    data.trading_pair ||
    data.tradingPair ||
    data.instrument ||
    signal.symbol

  if (candidate) return normalizeSignalKey(candidate)

  const text = `${signal.message || ""} ${signal.type || ""}`.toUpperCase()
  const match = text.match(/[A-Z0-9]{2,10}[/-][A-Z0-9]{2,10}/)
  return match ? normalizeSignalKey(match[0]) : null
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
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

async function fetchGatewayJson(path, params) {
  const url = buildGatewayUrl(path, params)
  const shouldEmit = config.pipelineEventsEnabled && shouldSample(config.pipelineEventsSampleRate)
  const startedAt = Date.now()
  const endpointName = String(path || "").replace(/^\/+/, "")
  const paramsHash = hashParams(params)
  if (shouldEmit) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "mdg",
        eventType: "gateway_call",
        edgeKey: "market_intel->market_data_gateway",
        nodeIds: ["market_intel", "market_data_gateway"],
        status: "start",
        batchId: activeRunId || undefined,
        meta: {
          endpointName,
          paramsHash,
        },
      })
    )
  }
  try {
    const data = await fetchJson(url)
    if (shouldEmit) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "mdg",
          eventType: "gateway_call",
          edgeKey: "market_intel->market_data_gateway",
          nodeIds: ["market_intel", "market_data_gateway"],
          status: "end",
          durationMs: Date.now() - startedAt,
          batchId: activeRunId || undefined,
          meta: {
            endpointName,
            paramsHash,
            httpStatus: 200,
          },
          inputs: {
            providerCalls: [
              {
                providerId: "mdg",
                endpointName,
                paramsHash,
              },
            ],
          },
        })
      )
    }
    return data
  } catch (err) {
    if (shouldEmit) {
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "mdg",
          eventType: "gateway_call",
          edgeKey: "market_intel->market_data_gateway",
          nodeIds: ["market_intel", "market_data_gateway"],
          status: "error",
          durationMs: Date.now() - startedAt,
          batchId: activeRunId || undefined,
          severity: "error",
          meta: {
            endpointName,
            paramsHash,
          },
          error: { message: err?.message ? String(err.message) : "Gateway error" },
        })
      )
    }
    throw err
  }
}

function resolveCryptoInterval(interval) {
  const normalized = String(interval || "").trim().toLowerCase()
  if (normalized === "15m" || normalized === "15min" || normalized === "15") return "15min"
  if (normalized === "1h" || normalized === "60m" || normalized === "1hour") return "1h"
  if (normalized === "1d" || normalized === "24h" || normalized === "1day") return "1day"
  return "15min"
}

async function fetchFmpChange(pair, interval) {
  const normalized = normalizeSymbol(pair)
  if (!normalized) return null
  const fmpInterval = resolveCryptoInterval(interval)
  const data = await fetchGatewayJson("/v1/fmp/candles", {
    symbol: normalized,
    assetClass: "crypto",
    interval: fmpInterval,
    limit: "2",
  })
  const candles = Array.isArray(data?.candles) ? data.candles : []
  if (candles.length < 2) return null
  const prevClose = parseNumber(candles[candles.length - 2]?.close)
  const lastClose = parseNumber(candles[candles.length - 1]?.close)
  if (!prevClose || !lastClose) return null
  return ((lastClose - prevClose) / prevClose) * 100
}

async function fetchCryptoIntradayChanges(pairs, interval) {
  const results = new Map()
  for (const pair of pairs) {
    try {
      const change = await fetchFmpChange(pair, interval)
      if (change !== null && change !== undefined) {
        results.set(normalizeSymbol(pair), change)
      }
    } catch (err) {
      continue
    }
  }
  return results
}

async function fetchCryptoWatchlist(pairs) {
  const results = []
  for (const pair of pairs) {
    const normalized = normalizeSymbol(pair)
    if (!normalized) continue
    try {
      const data = await fetchFmpQuote(normalized, "crypto")
      if (!data) continue
      results.push({
        assetClass: "crypto",
        symbol: normalized,
        name: normalized,
        exchange: "COINBASE",
        price: data.price,
        change24h: data.change24h,
        volume: data.volume,
        watchlisted: true,
        origins: ["user_universe"],
        source: "fmp",
      })
    } catch (err) {
      continue
    }
  }
  return results
}

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: config.projectId })
  }
  return admin.firestore()
}

async function loadReplayControls(db) {
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
    console.error("Replay controls read failed", err.message)
    return null
  }
}

function parseReplayTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === "function") return value.toDate()
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function applyReplayControls(controls) {
  const desired =
    controls?.desiredMode === "replay" && config.replayAllowed ? "replay" : "live"
  const next = {
    mode: desired,
    runId: controls?.activeRunId || null,
    sessionId: controls?.sessionId || null,
    version: typeof controls?.version === "number" ? controls.version : null,
    phase: controls?.phase || null,
    datasetId: controls?.datasetId || null,
    asOfMs: parseReplayTimestamp(controls?.asOf)?.getTime?.() ?? null,
    lastAckAt: replayState.lastAckAt || 0,
    lastAckSessionId: replayState.lastAckSessionId || null,
    lastAckVersion: replayState.lastAckVersion || null,
  }

  if (next.mode === "replay" && (!next.runId || !next.sessionId || next.version === null)) {
    throw new Error("Replay mode missing activeRunId/sessionId/version")
  }
  replayState = next
}

async function ackReplayControls(db, note) {
  if (!replayState.sessionId || replayState.version === null) return
  const now = Date.now()
  if (
    now - replayState.lastAckAt < config.replayAckIntervalMs &&
    replayState.lastAckSessionId === replayState.sessionId &&
    replayState.lastAckVersion === replayState.version
  ) {
    return
  }
  await db
    .doc("replay/controls/consumers/market-intel")
    .set(
      compactObject({
        service: "market-intel",
        effectiveMode: replayState.mode,
        sessionId: replayState.sessionId,
        seenControlsVersion: replayState.version,
        activeRunId: replayState.runId,
        phase: replayState.phase || undefined,
        datasetId: replayState.datasetId || undefined,
        note: note || undefined,
        heartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      { merge: true }
    )
  replayState.lastAckAt = now
  replayState.lastAckSessionId = replayState.sessionId
  replayState.lastAckVersion = replayState.version
}

async function readUniverse(db) {
  const snap = await db.doc("market/universe").get()
  const data = snap.exists ? snap.data() : {}
  if (config.pipelineEventsEnabled) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "market_intel",
        eventType: "fs_read",
        edgeKey: "firestore->market_intel",
        nodeIds: ["market_intel", "firestore"],
        status: "end",
        batchId: activeRunId || undefined,
        inputs: { firestoreDocs: ["market/universe"] },
      })
    )
  }

  const crypto = data?.crypto || {}
  const stocks = data?.stocks || {}
  const forex = data?.forex || {}
  const globalMode = resolveUniverseMode(data?.mode)
  const cryptoMode = resolveUniverseModeForAsset(crypto, globalMode)
  const stockMode = resolveUniverseModeForAsset(stocks, globalMode)
  const forexMode = resolveUniverseModeForAsset(forex, globalMode)

  return {
    crypto: {
      mode: cryptoMode,
      symbols: uniqueList(
        Array.isArray(crypto.symbols)
          ? crypto.symbols.map(normalizeSymbol).filter(Boolean)
          : []
      ),
    },
    stocks: {
      mode: stockMode,
      symbols: uniqueList(
        Array.isArray(stocks.symbols)
          ? stocks.symbols.map(normalizeTicker).filter(Boolean)
          : []
      ),
    },
    forex: {
      mode: forexMode,
      pairs: uniqueList(
        Array.isArray(forex.pairs)
          ? forex.pairs.map(normalizeSymbol).filter(Boolean)
          : []
      ),
    },
  }
}

async function readControls(db) {
  const snap = await db.doc("market/controls").get()
  const data = snap.exists ? snap.data() : {}
  if (config.pipelineEventsEnabled) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "market_intel",
        eventType: "fs_read",
        edgeKey: "firestore->market_intel",
        nodeIds: ["market_intel", "firestore"],
        status: "end",
        batchId: activeRunId || undefined,
        inputs: { firestoreDocs: ["market/controls"] },
      })
    )
  }
  const parsedInterval = Number(data?.llmIntervalMinutes)
  const llmIntervalMinutes =
    Number.isFinite(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : config.llmIntervalMinutes
  const parsedNewsInterval = Number(data?.newsIntervalMinutes)
  const newsIntervalMinutes =
    Number.isFinite(parsedNewsInterval) && parsedNewsInterval > 0
      ? parsedNewsInterval
      : config.newsIntervalMinutes
  const horizonCandidate = typeof data?.dipHorizon === "string" ? data.dipHorizon : ""
  const dipHorizon = VALID_HORIZONS.has(horizonCandidate) ? horizonCandidate : "24h"
  const trendCandidate =
    typeof data?.trendHorizon === "string" ? data.trendHorizon : ""
  const trendHorizon = VALID_TREND_HORIZONS.has(trendCandidate)
    ? trendCandidate
    : "15m"
  const riskCandidate = typeof data?.riskProfile === "string" ? data.riskProfile : ""
  const riskProfile = VALID_RISK.has(riskCandidate) ? riskCandidate : "balanced"
  const focusList = Array.isArray(data?.assetFocus)
    ? data.assetFocus.map((item) => String(item).toLowerCase())
    : []
  const assetFocus =
    uniqueList(focusList.filter((item) => VALID_ASSET_FOCUS.has(item))) ||
    []
  const normalizedFocus =
    assetFocus.length > 0 ? assetFocus : ["crypto", "stock", "forex"]
  const primaryRaw = (data?.primaryAssets || {}) ?? {}
  const primaryAssets = {
    crypto: uniqueList(
      Array.isArray(primaryRaw.crypto)
        ? primaryRaw.crypto.map(normalizeSymbol).filter(Boolean)
        : []
    ),
    stocks: uniqueList(
      Array.isArray(primaryRaw.stocks)
        ? primaryRaw.stocks.map(normalizeTicker).filter(Boolean)
        : []
    ),
    forex: uniqueList(
      Array.isArray(primaryRaw.forex)
        ? primaryRaw.forex.map(normalizeSymbol).filter(Boolean)
        : []
    ),
  }

  const rawWeights = data?.trendWeights || {}
  const trendWeights = {
    momentum: clamp(
      parseNumber(rawWeights.momentum) ?? DEFAULT_TREND_WEIGHTS.momentum,
      0,
      100
    ),
    volume: clamp(
      parseNumber(rawWeights.liquidity ?? rawWeights.volume) ?? DEFAULT_TREND_WEIGHTS.volume,
      0,
      100
    ),
    signals: clamp(
      parseNumber(rawWeights.consensus ?? rawWeights.signals) ?? DEFAULT_TREND_WEIGHTS.signals,
      0,
      100
    ),
    news: clamp(parseNumber(rawWeights.news) ?? DEFAULT_TREND_WEIGHTS.news, 0, 100),
  }
  const botWeights = parseBotWeights(data?.botWeights)

  return {
    enableLLM: data?.enableLLM !== false,
    llmIntervalMinutes,
    enableNews: data?.enableNews !== false,
    newsIntervalMinutes,
    swingOvernightEnabled: data?.swingOvernightEnabled === true,
    swingOvernightAutoPaperEnabled: data?.swingOvernightAutoPaperEnabled === true,
    prebreakoutEnabled: data?.prebreakoutEnabled === true,
    prebreakoutAutoPaperEnabled: data?.prebreakoutAutoPaperEnabled === true,
    dipHorizon,
    trendHorizon,
    trendWeights,
    riskProfile,
    assetFocus: normalizedFocus,
    primaryAssets,
    botWeights,
    autoTuneEnabled:
      data?.autoTuneEnabled === undefined ? config.autoTuneEnabled : Boolean(data.autoTuneEnabled),
    autoTuneWithAI: data?.autoTuneWithAI !== false,
    autoTuneIntervalHours: Number.isFinite(Number(data?.autoTuneIntervalHours))
      ? Math.max(1, Number(data.autoTuneIntervalHours))
      : config.autoTuneIntervalHours,
    autoTuneLastAt: data?.autoTuneLastAt || null,
    autoTuneNotes: typeof data?.autoTuneNotes === "string" ? data.autoTuneNotes : "",
  }
}

async function readReplayConfigSnapshot(db, runId) {
  if (!runId) return null
  const snap = await db
    .doc(`replay/controls/runs/${runId}/configSnapshot`)
    .get()
    .catch(() => null)
  if (!snap?.exists) return null
  return snap.data() || null
}

async function writeReplayConfigSnapshot(db, runId, payload) {
  if (!runId) return
  try {
    await db.doc(`replay/controls/runs/${runId}/configSnapshot`).set(
      compactObject({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...payload,
      }),
      { merge: true }
    )
  } catch (err) {
    console.error("Replay config snapshot write failed", err.message)
  }
}

async function refreshStockSymbolCache(db) {
  if (isReplayMode()) {
    console.log("Stock symbol cache skipped (replay mode)")
    return
  }
  if (!config.marketDataGatewayUrl) {
    console.log("Stock symbol cache skipped (no market data gateway)")
    return
  }

  const cacheRef = db.doc("market/symbolCache")
  const cacheSnap = await cacheRef.get()
  const lastUpdated = cacheSnap.data()?.stocksUpdatedAt?.toDate?.()
  const maxAgeMs = Math.max(config.symbolCacheDays, 0) * 24 * 60 * 60 * 1000

  if (lastUpdated && maxAgeMs > 0) {
    const ageMs = Date.now() - lastUpdated.getTime()
    if (ageMs < maxAgeMs) {
      return
    }
  }

  console.log("Refreshing stock symbol cache")
  let data = null
  try {
    data = await fetchGatewayJson("/v1/fmp/stock-list")
  } catch (error) {
    console.error("Stock symbol cache refresh failed:", error.message)
    return
  }
  const listings = Array.isArray(data?.items) ? data.items : []
  const limited =
    config.symbolCacheMax > 0 ? listings.slice(0, config.symbolCacheMax) : listings

  if (limited.length === 0) {
    console.log("Stock symbol cache empty after parsing")
    return
  }

  const writer = db.bulkWriter()
  const updatedAt = admin.firestore.FieldValue.serverTimestamp()

  limited.forEach((entry) => {
    const docId = String(entry.symbol).replace(/\//g, "-")
    writer.set(
      db.collection("market_symbols_stocks").doc(docId),
      compactObject({
        symbol: entry.symbol,
        name: entry.name || entry.symbol,
        exchange: entry.exchange || undefined,
        assetType: entry.assetType || undefined,
        ipoDate: entry.ipoDate || undefined,
        status: entry.status || undefined,
        updatedAt,
      }),
      { merge: true }
    )
  })

  await writer.close()
  await cacheRef.set(
    {
      stocksUpdatedAt: updatedAt,
      stocksCount: limited.length,
      stocksSource: data?.source || "fmp",
    },
    { merge: true }
  )

  console.log("Stock symbol cache refreshed", { count: limited.length })
}

async function fetchCrypto(db, preferences = {}) {
  const mode = resolveUniverseMode(preferences.mode)
  const includeTrending = mode !== "universe_only"
  const includeWatchlist = mode !== "movers_only"
  const filterToWatchlist = mode === "movers_filtered_by_universe"
  const watchlist = Array.isArray(preferences.symbols) ? preferences.symbols : []
  const watchlistSet = new Set(watchlist.map(normalizeSymbol).filter(Boolean))

  if (!includeTrending && watchlistSet.size === 0) {
    return { items: [], source: null }
  }
  if (filterToWatchlist && watchlistSet.size === 0) {
    return { items: [], source: null }
  }
  if (!config.marketDataGatewayUrl) {
    console.log("Crypto fetch skipped (no market data gateway)")
    return { items: [], source: null }
  }

  let livePrices = null
  try {
    livePrices = await readLivePrices(db)
  } catch (error) {
    console.error("Live price snapshot read failed:", error.message)
  }
  const liveMap = new Map()
  const liveItems = Array.isArray(livePrices?.items) ? livePrices.items : []
  liveItems
    .filter((item) => item?.assetClass === "crypto")
    .forEach((item) => {
      const key = normalizeSymbol(item.symbol)
      if (key) liveMap.set(key, item)
    })

  const payload = await fetchGatewayJson("/v1/fmp/crypto", {
    limit: String(config.cryptoLimit),
  })
  const data = Array.isArray(payload?.data) ? payload.data : []
  const baseSource = payload?.source || "gateway"

  const baseItems = data
    .map((item, index) => {
      // FMP crypto symbols are like "BTCUSD", normalize to "BTC/USD"
      const rawSymbol = String(item.symbol || "")
      let symbol = rawSymbol
      if (!rawSymbol.includes("/") && rawSymbol.endsWith("USD") && rawSymbol.length > 3) {
        const base = rawSymbol.slice(0, -3)
        symbol = `${base}/USD`
      }
      const normalized = normalizeSymbol(symbol)
      const watchlisted = normalized ? watchlistSet.has(normalized) : false
      const live = normalized ? liveMap.get(normalized) : null
      const origins = ["trending"]
      if (watchlisted) origins.push("user_universe")
      return {
        assetClass: "crypto",
        symbol,
        name: item.name || symbol,
        exchange: item.exchange || "CRYPTO",
        price: typeof live?.price === "number" ? live.price : parseNumber(item.price),
        change24h: parseNumber(item.changePercentage ?? item.changePercent ?? item.changesPercentage),
        change1m: parseNumber(live?.change1m),
        change5m: parseNumber(live?.change5m),
        volatility1m: parseNumber(live?.volatility1m),
        volatility5m: parseNumber(live?.volatility5m),
        spreadPct: parseNumber(live?.spreadPct),
        volume: parseNumber(item.volume),
        liquidityRank: index + 1,
        watchlisted,
        origins,
        source: "fmp",
      }
    })
    .filter((item) => {
      if (filterToWatchlist) return item.watchlisted
      return includeTrending || item.watchlisted
    })

  const itemsMap = new Map()
  baseItems.forEach((item) => {
    const key = normalizeSymbol(item.symbol)
    if (!key) return
    itemsMap.set(key, item)
  })

  if (includeWatchlist && !filterToWatchlist) {
    const missingWatchlist = Array.from(watchlistSet).filter(
      (symbol) => !itemsMap.has(normalizeSymbol(symbol))
    )
    if (missingWatchlist.length > 0) {
      const extra = await fetchCryptoWatchlist(missingWatchlist)
      extra.forEach((item) => {
        const key = normalizeSymbol(item.symbol)
        if (!key) return
        itemsMap.set(key, item)
      })
    }
  }

  const items = Array.from(itemsMap.values())
  if (items.length === 0) return { items: [], source: baseSource }

  if (liveMap.size > 0) {
    items.forEach((item) => {
      const key = normalizeSymbol(item.symbol)
      if (!key) return
      const live = liveMap.get(key)
      if (!live) return
      if (typeof live.price === "number") item.price = live.price
      if (typeof live.change1m === "number") item.change1m = live.change1m
      if (typeof live.change5m === "number") item.change5m = live.change5m
      if (typeof live.volatility1m === "number") item.volatility1m = live.volatility1m
      if (typeof live.volatility5m === "number") item.volatility5m = live.volatility5m
      if (typeof live.spreadPct === "number") item.spreadPct = live.spreadPct
    })
  }

  const change15mMap = await fetchCryptoIntradayChanges(
    items.map((item) => item.symbol),
    "15m"
  )
  const change1hMap = await fetchCryptoIntradayChanges(
    items.map((item) => item.symbol),
    "1h"
  )

  const enriched = items.map((item) => {
    const key = normalizeSymbol(item.symbol)
    const change15m = key ? change15mMap.get(key) : undefined
    const change1h = key ? change1hMap.get(key) : undefined
    return {
      ...item,
      change15m: change15m === undefined ? undefined : change15m,
      change1h: item.change1h ?? (change1h === undefined ? undefined : change1h),
    }
  })
  if (mode === "weighted_union") {
    enriched.forEach((item) => {
      const boost = resolveUniverseBoost(mode, item.watchlisted)
      if (boost) item.universeBoost = boost
    })
  }
  return { items: enriched, source: baseSource }
}

// Staleness thresholds for data sources
const STALENESS_THRESHOLDS = {
  prices: 180000,    // 3 minutes - price data should be fresh
  signals: 3600000,  // 1 hour - bot signals can be slightly older
  pipeline: 600000,  // 10 minutes - overall pipeline health
}

/**
 * Check if price data is stale and log warning
 */
function checkPriceStaleness(updatedAt, source) {
  if (!updatedAt) return { isStale: true, ageMs: null }
  const ageMs = getEffectiveNowMs() - updatedAt.getTime()
  const isStale = ageMs > STALENESS_THRESHOLDS.prices
  if (isStale) {
    console.warn("mi_stale_prices", {
      source,
      ageMs,
      thresholdMs: STALENESS_THRESHOLDS.prices,
      lastUpdatedAt: updatedAt.toISOString(),
    })
  }
  return { isStale, ageMs }
}

async function readLivePrices(db) {
  if (redisReady) {
    const redisSnapshot = await readRedisLatestPrices()
    if (redisSnapshot) {
      const staleness = checkPriceStaleness(
        redisSnapshot.updatedAt ? new Date(redisSnapshot.updatedAt) : null,
        "redis"
      )
      return { ...redisSnapshot, staleness }
    }
  }
  if (!db) return { items: [], updatedAt: null, staleness: { isStale: true, ageMs: null } }
  const pricesPath = resolveMarketDocPath("prices")
  const snap = await db.doc(pricesPath).get()
  if (!snap.exists) return { items: [], updatedAt: null, staleness: { isStale: true, ageMs: null } }
  const data = snap.data() || {}
  if (config.pipelineEventsEnabled) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "market_intel",
        eventType: "fs_read",
        edgeKey: "firestore->market_intel",
        nodeIds: ["market_intel", "firestore"],
        status: "end",
        batchId: activeRunId || undefined,
        inputs: { firestoreDocs: [pricesPath] },
      })
    )
  }
  const items = Array.isArray(data.items) ? data.items : []
  const updatedAt =
    typeof data.updatedAt?.toDate === "function" ? data.updatedAt.toDate() : null
  const staleness = checkPriceStaleness(updatedAt, "firestore")
  return { items, updatedAt, source: "firestore", staleness }
}

async function fetchLiveSnapshotMovers(db, options) {
  if (!db) {
    return { items: [], movers: null, snapshot: null }
  }

  const {
    collectionName,
    assetClass,
    normalizeItem,
    watchlistSet,
    mode,
    exchangeHint,
    market,
    filterItem,
    livePrices,
    source,
  } = options
  const resolvedMode = resolveUniverseMode(mode)
  const allowTrending = resolvedMode !== "universe_only"
  const allowWatchlist = resolvedMode !== "movers_only"
  const filterToWatchlist = resolvedMode === "movers_filtered_by_universe"
  const watchlist = watchlistSet || new Set()
  const priceSnapshot =
    livePrices && Array.isArray(livePrices.items) ? livePrices : await readLivePrices(db)
  const snapshotSource = priceSnapshot?.source || source || "stream"
  const rawItems = Array.isArray(priceSnapshot?.items) ? priceSnapshot.items : []
  const currentItems = rawItems
    .filter((item) => item?.assetClass === assetClass)
    .filter((item) => (typeof filterItem === "function" ? filterItem(item) : true))
    .map((item) => normalizeItem(item, exchangeHint))
    .filter(Boolean)

  if (currentItems.length === 0) {
    return { items: [], movers: null, snapshot: null }
  }

  const createdAt = priceSnapshot?.updatedAt || new Date(getEffectiveNowMs())
  const cutoff = new Date(createdAt.getTime() - config.moverWindowMinutes * 60 * 1000)
  let snapshot = null
  let previous = null

  if (redisReady) {
    previous = await readRedisSnapshotBefore(cutoff)
    if (previous && Array.isArray(previous.items)) {
      previous = {
        ...previous,
        items: previous.items.filter((item) => item?.assetClass === assetClass),
      }
    }
  } else {
    snapshot = await writeSnapshot(db, collectionName, currentItems, createdAt, {
      market,
      assetClass,
      source: snapshotSource,
    })
    await pruneSnapshots(db, collectionName, config.snapshotKeep)
    previous = await findSnapshotBefore(db, collectionName, cutoff)
  }

  let candidates = []
  let gainers = []
  let losers = []
  let actives = []
  if (previous) {
    const snapshotMoves = computeSnapshotMovers(currentItems, previous.items, {
      minPrice: assetClass === "stock" ? config.moverMinPrice : 0,
      minVolume: assetClass === "stock" ? config.moverMinVolume : 0,
    })
    candidates = snapshotMoves.candidates
    gainers = snapshotMoves.gainers
    losers = snapshotMoves.losers
    actives = snapshotMoves.actives
  }

  const volumeRankMap = new Map()
  const volumeList = [...currentItems]
    .filter((item) => typeof item.volume === "number")
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
  volumeList.forEach((item, index) => {
    volumeRankMap.set(item.symbol, index + 1)
  })
  if (!previous && actives.length === 0 && volumeList.length > 0) {
    actives = volumeList
  }

  const changeMap = new Map()
  candidates.forEach((item) => {
    if (item.symbol) changeMap.set(item.symbol, item.change15m)
  })

  const candidateMap = new Map()
  const addCandidate = (item, sideHint = null, options = {}) => {
    if (!item?.symbol || typeof item.price !== "number") return
    if (filterToWatchlist && !watchlist.has(item.symbol)) return
    const originTags = normalizeOrigins(options.origins)
    const existing = candidateMap.get(item.symbol)
    if (existing) {
      const nextOrigins = mergeOrigins(existing.origins, originTags)
      const watchlisted = existing.watchlisted || watchlist.has(item.symbol)
      const universeBoost = resolveUniverseBoost(resolvedMode, watchlisted)
      candidateMap.set(item.symbol, {
        ...existing,
        watchlisted,
        universeBoost: universeBoost || existing.universeBoost,
        origins: nextOrigins.length > 0 ? nextOrigins : existing.origins,
        sideHint: existing.sideHint || sideHint || undefined,
      })
      return
    }
    const change15m = changeMap.has(item.symbol) ? changeMap.get(item.symbol) : item.change15m
    if (options.requireMomentum) {
      const hasMomentum =
        typeof change15m === "number" ||
        typeof item.change5m === "number" ||
        typeof item.change1m === "number"
      if (!hasMomentum) return
    }
    const volumeRank = volumeRankMap.get(item.symbol)
    const volumeScore =
      volumeRank && volumeList.length > 1
        ? clamp(1 - (volumeRank - 1) / (volumeList.length - 1), 0, 1)
        : undefined
    const watchlisted = watchlist.has(item.symbol)
    const universeBoost = resolveUniverseBoost(resolvedMode, watchlisted)
    candidateMap.set(
      item.symbol,
      compactObject({
        assetClass,
        symbol: item.symbol,
        name: item.name || item.symbol,
        exchange: item.exchange || exchangeHint || undefined,
        price: item.price,
        volume: item.volume,
        change1m: item.change1m,
        change5m: item.change5m,
        change15m,
        change24h: item.change24h,
        volatility1m: item.volatility1m,
        volatility5m: item.volatility5m,
        bid: item.bid,
        ask: item.ask,
        spreadPct: item.spreadPct,
        liquidityRank: volumeRank,
        volumeScore,
        sideHint: sideHint || undefined,
        watchlisted,
        universeBoost: universeBoost || undefined,
        origins: originTags.length > 0 ? originTags : undefined,
        source: snapshotSource,
      })
    )
  }

  if (allowTrending) {
    gainers
      .slice(0, config.moverEnrichLimit)
      .forEach((item) =>
        addCandidate(item, "buy", { requireMomentum: true, origins: ["mover15m"] })
      )
    losers
      .slice(0, config.moverEnrichLimit)
      .forEach((item) =>
        addCandidate(item, "sell", { requireMomentum: true, origins: ["mover15m"] })
      )
    if (actives.length > 0) {
      actives
        .slice(0, config.moverEnrichLimit)
        .forEach((item) =>
          addCandidate(item, null, { requireMomentum: true, origins: ["mover15m"] })
        )
    } else if (candidates.length > 0) {
      candidates
        .slice(0, config.moverEnrichLimit)
        .forEach((item) =>
          addCandidate(item, null, { requireMomentum: true, origins: ["mover15m"] })
        )
    }
  }

  if (allowWatchlist && !filterToWatchlist && watchlist.size > 0) {
    const currentMap = new Map(currentItems.map((item) => [item.symbol, item]))
    const prevMap = previous
      ? new Map(previous.items.map((item) => [item.symbol, item]))
      : new Map()
    watchlist.forEach((symbol) => {
      const current = currentMap.get(symbol)
      if (!current) return
      let change15m = changeMap.get(symbol)
      if (change15m === undefined) {
        const prev = prevMap.get(symbol)
        if (prev?.price) {
          change15m = ((current.price - prev.price) / prev.price) * 100
        }
      }
      addCandidate({ ...current, change15m }, null, { origins: ["user_universe"] })
    })
  }

  const trimList = (list) =>
    list.slice(0, config.moverTopLimit).map((item) =>
      compactObject({
        symbol: item.symbol,
        name: item.name || item.symbol,
        price: item.price,
        change15m: changeMap.get(item.symbol),
        volume: item.volume,
      })
    )

  const movers = allowTrending
    ? compactObject({
      market,
      assetClass,
      windowMinutes: config.moverWindowMinutes,
      asOf: admin.firestore.Timestamp.fromDate(createdAt),
      gainers: trimList(gainers),
      losers: trimList(losers),
      actives: trimList(actives.length > 0 ? actives : candidates),
      source: snapshotSource,
    })
    : null

  return {
    items: Array.from(candidateMap.values()),
    movers,
    snapshot,
  }
}

async function fetchFmpQuote(symbol, assetClass = "stock") {
  if (!config.marketDataGatewayUrl) return null
  try {
    const data = await fetchGatewayJson("/v1/fmp/quote", {
      symbol,
      assetClass,
    })
    return {
      assetClass,
      symbol,
      name: data?.name || symbol,
      price: parseNumber(data?.price),
      change24h: parseNumber(data?.changePercent),
      volume: parseNumber(data?.volume),
      watchlisted: true,
      source: data?.source || "fmp",
    }
  } catch (error) {
    console.error(`Failed to fetch FMP quote for ${symbol}:`, error.message)
    return null
  }
}

async function fetchFmpProfile(symbol) {
  if (!config.marketDataGatewayUrl) return null
  if (!symbol) return null
  try {
    const data = await fetchGatewayJson("/v1/fmp/profile", { symbol })
    return data?.profile || null
  } catch (error) {
    console.error(`Failed to fetch FMP profile for ${symbol}:`, error.message)
    return null
  }
}

async function fetchStockQuote(symbol) {
  return fetchFmpQuote(symbol, "stock")
}

async function fetchStocks(db, preferences = {}) {
  if (!db) return { items: [] }

  const mode = resolveUniverseMode(preferences.mode)
  const includeTrending = mode !== "universe_only"
  const includeWatchlist = mode !== "movers_only"
  const filterToWatchlist = mode === "movers_filtered_by_universe"
  const watchlist = Array.isArray(preferences.symbols) ? preferences.symbols : []
  const watchlistSet = new Set(watchlist.map(normalizeTicker).filter(Boolean))
  if (!includeTrending && watchlistSet.size === 0) {
    return { items: [] }
  }
  if (filterToWatchlist && watchlistSet.size === 0) {
    return { items: [] }
  }

  let livePrices = null
  try {
    livePrices = await readLivePrices(db)
  } catch (error) {
    console.error("Live price snapshot read failed:", error.message)
  }

  const [usResult, tsxResult] = await Promise.all([
    fetchLiveSnapshotMovers(db, {
      collectionName: resolveSnapshotCollectionName("market_snapshots_us"),
      assetClass: "stock",
      normalizeItem: normalizeSnapshotStock,
      watchlistSet,
      mode,
      exchangeHint: null,
      market: "us",
      livePrices,
      filterItem: (item) => !isTsxSymbol(item?.symbol),
      source: "stream",
    }),
    fetchLiveSnapshotMovers(db, {
      collectionName: resolveSnapshotCollectionName("market_snapshots_tsx"),
      assetClass: "stock",
      normalizeItem: normalizeSnapshotStock,
      watchlistSet,
      mode,
      exchangeHint: "TSX",
      market: "tsx",
      livePrices,
      filterItem: (item) => isTsxSymbol(item?.symbol),
      source: "stream",
    }),
  ])

  const items = [...usResult.items, ...tsxResult.items]
  const movers = compactObject({
    us: usResult.movers || undefined,
    tsx: tsxResult.movers || undefined,
  })

  if (items.length > 0 || movers.us || movers.tsx) {
    return { items, movers, source: "stream" }
  }

  const results = new Map()
  let source = null

  if (includeTrending) {
    console.log("Stock movers fallback disabled (stream-only)")
  }

  const hasTrendingData = includeTrending && results.size > 0
  if (!hasTrendingData && includeWatchlist && !filterToWatchlist) {
    const limited = Array.from(watchlistSet).slice(0, Math.min(3, config.stockWatchlistLimit))
    for (let i = 0; i < limited.length; i++) {
      const symbol = limited[i]
      if (results.has(symbol)) continue
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 12000))
      }
      const quote = await fetchStockQuote(symbol)
      if (quote) {
        results.set(symbol, quote)
        source = source || quote.source || "fmp"
      }
    }
  }

  return { items: Array.from(results.values()), source }
}

async function fetchForex(db, preferences = {}) {
  const mode = resolveUniverseMode(preferences.mode)
  const includeTrending = mode !== "universe_only"
  const includeWatchlist = mode !== "movers_only"
  const filterToWatchlist = mode === "movers_filtered_by_universe"
  const pairsInput = Array.isArray(preferences.pairs) ? preferences.pairs : []
  const pairs =
    pairsInput.length > 0
      ? uniqueList(pairsInput.map(normalizeSymbol).filter(Boolean))
      : uniqueList(config.fxPairs.map(normalizeSymbol).filter(Boolean))

  if (!includeTrending && pairsInput.length === 0) return { items: [] }
  if (filterToWatchlist && pairsInput.length === 0) return { items: [] }
  if (pairs.length === 0) return { items: [] }

  if (db) {
    let livePrices = null
    try {
      livePrices = await readLivePrices(db)
    } catch (error) {
      console.error("Live price snapshot read failed:", error.message)
    }
    const result = await fetchLiveSnapshotMovers(db, {
      collectionName: resolveSnapshotCollectionName("market_snapshots_fx"),
      assetClass: "forex",
      normalizeItem: normalizeSnapshotForex,
      watchlistSet: new Set(pairs),
      mode,
      exchangeHint: null,
      market: "forex",
      livePrices,
      source: "stream",
    })
    if (result.items.length > 0 || result.movers) {
      return { items: result.items, movers: result.movers, source: "stream" }
    }
  }
  if (!config.marketDataGatewayUrl) return { items: [] }

  const results = []
  for (const pair of pairs) {
    const normalized = normalizeSymbol(pair)
    if (!normalized) continue
    try {
      const quote = await fetchFmpQuote(normalized, "forex")
      if (!quote || typeof quote.price !== "number") continue
      results.push({
        assetClass: "forex",
        symbol: normalized,
        name: normalized,
        price: quote.price,
        change24h: quote.change24h,
        liquidityRank: results.length + 1,
        watchlisted: pairsInput.length > 0,
        source: quote.source || "gateway",
      })
    } catch (err) {
      continue
    }
  }

  return { items: results, source: results.length > 0 ? "gateway" : null }
}

function getAssetKey(assetClass, symbol) {
  if (!symbol) return null
  if (assetClass === "stock") return normalizeTicker(symbol)
  let normalized = normalizeSymbol(symbol)
  // Normalize stablecoin quotes to USD for consistent matching
  if (normalized && normalized.includes("/")) {
    const [base, quote] = normalized.split("/")
    if (quote === "USDT" || quote === "USDC" || quote === "BUSD" || quote === "DAI") {
      normalized = `${base}/USD`
    }
  }
  return normalized
}

function getCandidateKey(candidate) {
  if (!candidate?.symbol) return null
  return getAssetKey(candidate.assetClass, candidate.symbol)
}

const HORIZON_MINUTES = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "24h": 1440,
  "7d": 10080,
}

function getHorizonMinutes(horizon) {
  if (!horizon) return HORIZON_MINUTES["15m"]
  return HORIZON_MINUTES[horizon] || HORIZON_MINUTES["15m"]
}

function resolveHorizonChange(candidate, horizon) {
  const change15m = parseNumber(candidate.change15m)
  const change1h = parseNumber(candidate.change1h)
  const change24h = parseNumber(candidate.change24h)
  const change7d = parseNumber(candidate.change7d)
  const lookup = {
    "15m": change15m,
    "1h": change1h,
    "24h": change24h,
    "7d": change7d,
  }
  const order =
    horizon === "7d"
      ? ["7d", "24h", "1h", "15m"]
      : horizon === "24h"
        ? ["24h", "7d", "1h", "15m"]
        : horizon === "1h"
          ? ["1h", "15m", "24h", "7d"]
          : ["15m", "1h", "24h", "7d"]
  for (const key of order) {
    if (lookup[key] !== undefined) {
      return { change: lookup[key], window: key, fallback: key !== horizon }
    }
  }
  return { change: undefined, window: horizon, fallback: true }
}

function resolveMomentum(candidate, horizon) {
  const resolved = resolveHorizonChange(candidate, horizon)
  return { change: resolved.change, window: resolved.window }
}

function buildVolumeScores(candidates) {
  const scoreMap = new Map()
  const rankMap = new Map()
  const grouped = { crypto: [], stock: [], forex: [] }

  candidates.forEach((candidate) => {
    if (grouped[candidate.assetClass]) {
      grouped[candidate.assetClass].push(candidate)
    }
  })

  Object.entries(grouped).forEach(([, list]) => {
    const withMetric = list
      .map((candidate) => {
        const volume = parseNumber(candidate.volume)
        const metric =
          volume !== undefined
            ? volume
            : candidate.liquidityRank
              ? 1 / candidate.liquidityRank
              : 0
        return { candidate, metric }
      })
      .sort((a, b) => b.metric - a.metric)

    const total = withMetric.length
    withMetric.forEach((entry, index) => {
      const key = getCandidateKey(entry.candidate)
      if (!key) return
      const rank = index + 1
      const score = total > 1 ? clamp(100 - (index / (total - 1)) * 100, 0, 100) : 50
      scoreMap.set(key, score)
      rankMap.set(key, rank)
    })
  })

  return { scoreMap, rankMap }
}

function applyVolumeScores(candidates) {
  const { scoreMap, rankMap } = buildVolumeScores(candidates)
  return candidates.map((candidate) => {
    const key = getCandidateKey(candidate)
    if (!key) return candidate
    if (typeof candidate.volumeScore === "number") return candidate
    const volumeScore = scoreMap.get(key)
    if (typeof volumeScore !== "number") return candidate
    const liquidityRank = candidate.liquidityRank ?? rankMap.get(key)
    return compactObject({
      ...candidate,
      volumeScore: volumeScore / 100,
      liquidityRank: liquidityRank ?? candidate.liquidityRank,
    })
  })
}

function computeSignalScore(signalData) {
  if (!signalData) return 0
  const total = signalData.weightedTotal ?? signalData.total ?? 0
  if (!total) return 0
  return clamp((total / 5) * 100, 0, 100)
}

function computeSignalWeightMultiplier(summary) {
  if (!summary) return 1
  const count = parseNumber(summary.count)
  if (typeof count === "number" && count < config.minAccuracySignals) return 1
  const hitRate = parseNumber(summary.hitRate)
  if (typeof hitRate !== "number") return 1
  const normalized = hitRate / 50
  return clamp(normalized, 0.8, 1.25)
}

function computeBotWeight(summary) {
  if (!summary) return 1
  const count = parseNumber(summary.count)
  if (typeof count === "number" && count < config.minAccuracySignals) return 1
  const hitRate = parseNumber(summary.hitRate)
  if (typeof hitRate !== "number") return 1
  const normalized = hitRate / 50
  return clamp(normalized, 0.5, 1.5)
}

async function loadSignalPerformanceSummary(db, horizon) {
  try {
    const snap = await db.doc("analytics/signalPerformance").get()
    if (!snap.exists) return null
    const data = snap.data() || {}
    const summary = data?.overall?.[horizon] || null
    if (!summary) return null
    return {
      count: parseNumber(summary.count),
      hitRate: parseNumber(summary.hitRate),
      avgReturn: parseNumber(summary.avgReturn),
    }
  } catch (err) {
    console.error("Signal performance summary fetch failed", err.message)
    return null
  }
}

function normalizeEngine(value) {
  if (!value) return null
  const cleaned = String(value).trim().toLowerCase()
  return cleaned || null
}

async function loadBotRegistry(db) {
  const registry = new Map()
  try {
    const snap = await db.collection("bots").get()
    if (snap.empty) return { registry, docs: [] }
    snap.docs.forEach((doc) => {
      const data = doc.data() || {}
      const engine = normalizeEngine(data.engine)
      registry.set(doc.id, { engine })
    })
    return { registry, docs: snap.docs }
  } catch (err) {
    console.error("Bot registry fetch failed", err.message)
    return { registry, docs: [] }
  }
}

async function loadBotAccuracyWeights(db, horizon, botDocs = null) {
  const weights = new Map()
  try {
    const docs =
      Array.isArray(botDocs) && botDocs.length > 0
        ? botDocs
        : (await db.collection("bots").get()).docs
    if (!docs || docs.length === 0) return weights
    const refs = docs.map((doc) =>
      doc.ref.collection("analytics").doc("signalPerformance")
    )
    const snaps = await db.getAll(...refs)
    snaps.forEach((snap, index) => {
      if (!snap.exists) return
      const botId = docs[index]?.id
      if (!botId) return
      const summary = snap.data()?.overall?.[horizon]
      const weight = computeBotWeight(summary)
      if (weight !== 1) {
        weights.set(botId, Number(weight.toFixed(2)))
      }
    })
  } catch (err) {
    console.error("Bot accuracy weights fetch failed", err.message)
  }
  return weights
}

function buildEngineWeightMap(configured = {}, botRegistry = new Map()) {
  const engineWeights = new Map()
  const engineSet = new Set()
  if (botRegistry && botRegistry.size > 0) {
    botRegistry.forEach((meta) => {
      if (meta?.engine) engineSet.add(meta.engine)
    })
  }

  Object.entries(configured || {}).forEach(([key, value]) => {
    const weight = parseNumber(value)
    if (typeof weight !== "number") return
    if (String(key).startsWith("engine:")) {
      const engine = normalizeEngine(String(key).slice("engine:".length))
      if (engine) engineWeights.set(engine, clamp(weight, 0, 5))
    } else {
      const engine = normalizeEngine(key)
      if (engine && engineSet.has(engine)) {
        engineWeights.set(engine, clamp(weight, 0, 5))
      }
    }
  })

  return engineWeights
}

function isEngineKey(key, engineWeights) {
  if (!key) return false
  if (String(key).startsWith("engine:")) return true
  const engine = normalizeEngine(key)
  return engine ? engineWeights.has(engine) : false
}

function mergeBotWeights(configured = {}, accuracyWeights = new Map(), botRegistry = new Map()) {
  const merged = new Map()
  const engineWeights = buildEngineWeightMap(configured, botRegistry)
  const configuredEntries = Object.entries(configured || {})
  const idSet = new Set([
    ...configuredEntries
      .map(([id]) => id)
      .filter((id) => !isEngineKey(id, engineWeights)),
    ...accuracyWeights.keys(),
    ...(botRegistry ? botRegistry.keys() : []),
  ])

  idSet.forEach((botId) => {
    const engine = normalizeEngine(botRegistry?.get?.(botId)?.engine)
    const baseWeight =
      parseNumber(configured?.[botId]) ??
      (engine ? engineWeights.get(engine) : undefined) ??
      1
    const accuracyWeight = accuracyWeights.get(botId) ?? 1
    const combined = clamp(baseWeight * accuracyWeight, 0, 5)
    if (combined !== 1) {
      merged.set(botId, Number(combined.toFixed(2)))
    }
  })

  return merged
}

function resolveTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === "function") return value.toDate()
  return null
}

function applySignalDelta(weights, delta) {
  const base = {
    ...DEFAULT_TREND_WEIGHTS,
    ...(weights || {}),
  }
  if (!delta) {
    return { weights: base, delta: 0 }
  }
  const nextSignals = clamp(base.signals + delta, 0, 100)
  const actualDelta = nextSignals - base.signals
  let nextMomentum = base.momentum
  let nextVolume = base.volume
  const pool = nextMomentum + nextVolume
  const remainder = -actualDelta
  if (pool > 0) {
    nextMomentum = clamp(nextMomentum + (remainder * nextMomentum) / pool, 0, 100)
    nextVolume = clamp(nextVolume + (remainder * nextVolume) / pool, 0, 100)
  }
  return {
    weights: {
      momentum: Math.round(nextMomentum),
      volume: Math.round(nextVolume),
      signals: Math.round(nextSignals),
      news: Math.round(base.news),
    },
    delta: Math.round(actualDelta),
  }
}

function extractJsonObject(text) {
  if (!text) return null
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

async function requestAiSignalDelta(context) {
  if (!config.openaiKey) return null
  const maxDelta = Math.min(6, Math.max(1, Math.round(config.autoTuneMaxDelta / 2)))
  const body = {
    model: config.openaiModel,
    temperature: 0.2,
    max_tokens: 120,
    messages: [
      {
        role: "system",
        content:
          "You tune trend weights for a trading dashboard. Return JSON only.",
      },
      {
        role: "user",
        content: [
          "Suggest a small integer delta for the bot-signals weight.",
          `Constraints: delta between -${maxDelta} and ${maxDelta}.`,
          "If unsure, return 0.",
          "Return JSON: {\"signalDelta\": <int>, \"reason\": \"short reason\"}.",
          "",
          `Current weights: momentum ${context.weights.momentum}, volume ${context.weights.volume}, signals ${context.weights.signals}, news ${context.weights.news}.`,
          `Accuracy horizon: ${context.horizon}.`,
          `Hit rate: ${formatNumber(context.hitRate, 1)}% from ${context.count} signals.`,
          `Signal weight multiplier: ${formatNumber(context.signalWeight, 2)}.`,
        ].join("\n"),
      },
    ],
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI weight call failed: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ""
  const jsonText = extractJsonObject(content)
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText)
    const delta = parseNumber(parsed.signalDelta)
    if (!Number.isFinite(delta)) return null
    return {
      delta: clamp(Math.round(delta), -maxDelta, maxDelta),
      reason:
        typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 160) : "",
    }
  } catch {
    return null
  }
}

function maybeAutoTuneTrendWeights(controls, accuracySummary, accuracyHorizon) {
  if (!controls?.autoTuneEnabled) {
    return { tuned: false, weights: controls?.trendWeights }
  }
  const intervalHours = Number(controls.autoTuneIntervalHours || config.autoTuneIntervalHours)
  const lastAt = resolveTimestamp(controls.autoTuneLastAt)
  if (lastAt && intervalHours > 0) {
    const elapsedMs = Date.now() - lastAt.getTime()
    if (elapsedMs < intervalHours * 60 * 60 * 1000) {
      return { tuned: false, weights: controls.trendWeights }
    }
  }

  if (!accuracySummary || accuracySummary.count < config.minAccuracySignals) {
    return { tuned: false, weights: controls.trendWeights }
  }

  const hitRate = typeof accuracySummary.hitRate === "number" ? accuracySummary.hitRate : 50
  const baseWeights = {
    ...DEFAULT_TREND_WEIGHTS,
    ...(controls.trendWeights || {}),
  }
  const maxDelta = config.autoTuneMaxDelta || 0
  const normalized = clamp((hitRate - 50) / 50, -1, 1)
  const delta = clamp(normalized * maxDelta, -maxDelta, maxDelta)
  if (Math.abs(delta) < 0.5) {
    return { tuned: false, weights: baseWeights }
  }
  const applied = applySignalDelta(baseWeights, delta)

  const direction = applied.delta > 0 ? "increased" : "reduced"
  const note = `Auto-tune ${direction} bot signal weight by ${Math.round(
    Math.abs(applied.delta)
  )} using ${accuracyHorizon} accuracy (${formatNumber(hitRate, 1)}% hit rate from ${accuracySummary.count
    } signals).`

  return {
    tuned: true,
    weights: applied.weights,
    note,
    hitRate,
    count: accuracySummary.count,
    delta: Math.round(applied.delta),
  }
}

function buildTrending(candidates, signalMap, scoreOptions, newsScoreMap) {
  const byHorizon = {}
  TREND_HORIZONS.forEach((horizon) => {
    byHorizon[horizon] = { crypto: [], stock: [], forex: [] }
  })

  const { scoreMap, rankMap } = buildVolumeScores(candidates)

  candidates.forEach((candidate) => {
    const key = getCandidateKey(candidate)
    if (!key) return
    const signalData = signalMap.get(key) || null
    const rankedVolume = scoreMap.get(key)
    const volumeScore =
      typeof candidate.volumeScore === "number"
        ? candidate.volumeScore
        : typeof rankedVolume === "number"
          ? rankedVolume / 100
          : undefined
    const volumeRank = candidate.liquidityRank ?? rankMap.get(key)
    const newsData = newsScoreMap?.get(key) || null
    const candidateWithVolume =
      typeof volumeScore === "number" ? { ...candidate, volumeScore } : candidate
    const side = resolveTradeSide(candidateWithVolume, signalData)

    TREND_HORIZONS.forEach((horizon) => {
      const { change, window } = resolveMomentum(candidateWithVolume, horizon)
      const scoreDetail = scoreTrade(candidateWithVolume, signalData, side, {
        weights: scoreOptions?.weights,
        signalWeight: scoreOptions?.signalWeight,
        horizon,
        newsScore: newsData?.sentiment ?? null,
      })
      const scoreComponents = formatScoreComponents(scoreDetail.components)

      const signals = signalData
        ? compactObject({
          total: signalData.total,
          buy: signalData.buy,
          sell: signalData.sell,
          strengthAvg: signalData.total
            ? Number((signalData.strengthSum / signalData.total).toFixed(2))
            : undefined,
          bots: Array.from(signalData.bots),
        })
        : undefined

      const momentum = compactObject({
        change15m: candidateWithVolume.change15m,
        change1h: candidateWithVolume.change1h,
        change24h: candidateWithVolume.change24h,
        change7d: candidateWithVolume.change7d,
        window,
      })

      const item = compactObject({
        assetClass: candidateWithVolume.assetClass,
        symbol: candidateWithVolume.symbol,
        name: candidateWithVolume.name || candidateWithVolume.symbol,
        price: candidateWithVolume.price,
        horizon,
        score: Number(scoreDetail.score.toFixed(2)),
        confidence: Number(scoreDetail.confidence.toFixed(2)),
        scoreComponents: scoreComponents || undefined,
        components: scoreComponents || undefined,
        news: newsData
          ? {
            count: newsData.count,
            sentiment: newsData.sentiment,
            score: newsData.score,
          }
          : undefined,
        momentum,
        signals,
        volumeRank,
        source: candidateWithVolume.source,
      })

      if (byHorizon[horizon]?.[candidateWithVolume.assetClass]) {
        byHorizon[horizon][candidateWithVolume.assetClass].push(item)
      }
    })
  })

  Object.entries(byHorizon).forEach(([, buckets]) => {
    Object.keys(buckets).forEach((assetClass) => {
      buckets[assetClass] = buckets[assetClass]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, config.trendLimit)
    })
  })

  return byHorizon
}

function pickTopCandidates(list, limit) {
  if (!Array.isArray(list) || list.length === 0) return []
  return [...list]
    .sort((a, b) => {
      const scoreA =
        typeof a.volume === "number"
          ? a.volume
          : a.liquidityRank
            ? 1 / a.liquidityRank
            : 0
      const scoreB =
        typeof b.volume === "number"
          ? b.volume
          : b.liquidityRank
            ? 1 / b.liquidityRank
            : 0
      return scoreB - scoreA
    })
    .slice(0, Math.max(limit, 0))
}

function normalizeMarketauxCryptoSymbol(symbol) {
  if (!symbol) return null
  let raw = String(symbol).toUpperCase().trim()
  if (raw.includes(":")) {
    raw = raw.split(":").pop()
  }
  raw = raw.replace(/[^A-Z0-9]/g, "")
  if (!raw) return null
  if (raw.endsWith("USDT") && raw.length > 4) {
    return raw.slice(0, -4)
  }
  if (raw.endsWith("USD") && raw.length > 3) {
    return raw.slice(0, -3)
  }
  return raw
}

function buildNewsSymbolLists(candidates, universe) {
  const cryptoCandidates = pickTopCandidates(
    candidates.filter((candidate) => candidate.assetClass === "crypto"),
    config.newsSymbolLimit
  )
  const stockCandidates = pickTopCandidates(
    candidates.filter((candidate) => candidate.assetClass === "stock"),
    config.newsSymbolLimit
  )

  const universeCrypto = uniqueList(
    Array.isArray(universe?.crypto?.symbols)
      ? universe.crypto.symbols.map(normalizeSymbol).filter(Boolean)
      : []
  )
  const universeStocks = uniqueList(
    Array.isArray(universe?.stocks?.symbols)
      ? universe.stocks.symbols.map(normalizeTicker).filter(Boolean)
      : []
  )

  const cryptoBaseMap = new Map()
  const addCryptoPair = (pair) => {
    const normalized = normalizeSymbol(pair)
    if (!normalized || !normalized.includes("/")) return
    const base = normalized.split("/")[0]
    if (!base || cryptoBaseMap.has(base)) return
    cryptoBaseMap.set(base, normalized)
  }

  universeCrypto.forEach(addCryptoPair)
  cryptoCandidates.forEach((candidate) => addCryptoPair(candidate.symbol))

  const cryptoSymbolList = Array.from(cryptoBaseMap.keys())
    .map((base) => `${base}USD`)
    .filter(Boolean)
  const cryptoLimit =
    config.newsSymbolLimit > 0
      ? Math.max(config.newsSymbolLimit, universeCrypto.length)
      : cryptoSymbolList.length
  const cryptoSymbols = cryptoSymbolList.slice(0, cryptoLimit)

  const stockSymbolList = uniqueList([
    ...universeStocks,
    ...stockCandidates.map((candidate) => normalizeTicker(candidate.symbol)).filter(Boolean),
  ])
  const stockLimit =
    config.newsSymbolLimit > 0
      ? Math.max(config.newsSymbolLimit, universeStocks.length)
      : stockSymbolList.length
  const stockSymbols = stockSymbolList.slice(0, stockLimit)

  return { cryptoSymbols, stockSymbols, cryptoBaseMap }
}

async function fetchMarketauxNews(symbols, entityTypes) {
  if (!config.marketDataGatewayUrl || !symbols || symbols.length === 0) return []
  try {
    const data = await fetchGatewayJson("/v1/marketaux/news", {
      symbols: symbols.join(","),
      entity_types: entityTypes,
      limit: String(config.newsLimit),
    })
    return Array.isArray(data?.data) ? data.data : []
  } catch (err) {
    console.error("Marketaux fetch failed", err.message)
    return []
  }
}

async function fetchAnalystConsensus(symbol) {
  if (!config.marketDataGatewayUrl || !symbol) return null
  try {
    const data = await fetchGatewayJson("/v1/fmp/grades-consensus", { symbol })
    return data?.consensus || null
  } catch (err) {
    console.error(`Analyst consensus fetch failed for ${symbol}:`, err.message)
    return null
  }
}

async function loadAnalystConsensusData(stockSymbols) {
  if (!config.marketDataGatewayUrl || !stockSymbols || stockSymbols.length === 0) {
    return new Map()
  }

  // Fetch analyst consensus for top stock symbols (limit to avoid too many calls)
  const limit = Math.min(stockSymbols.length, 30)
  const symbolsToFetch = stockSymbols.slice(0, limit)

  console.log(`Fetching analyst consensus for ${symbolsToFetch.length} stocks`)

  const results = await Promise.all(
    symbolsToFetch.map(async (symbol) => {
      const consensus = await fetchAnalystConsensus(symbol)
      return { symbol, consensus }
    })
  )

  const consensusMap = new Map()
  results.forEach(({ symbol, consensus }) => {
    if (consensus) {
      consensusMap.set(symbol.toUpperCase(), consensus)
    }
  })

  console.log(`Loaded analyst consensus for ${consensusMap.size} stocks`)
  return consensusMap
}

function calcAnalystBoost(symbol, side, consensusMap) {
  if (!consensusMap || !symbol) return 0
  const consensus = consensusMap.get(symbol.toUpperCase())
  if (!consensus) return 0

  // Map consensus to boost: align with trade direction
  // strongBuy/buy -> boost buy signals, penalize sell signals
  // strongSell/sell -> boost sell signals, penalize buy signals
  const consensusLower = String(consensus.consensus || consensus).toLowerCase()

  if (side === "buy") {
    if (consensusLower === "strong buy") return 4
    if (consensusLower === "buy") return 2
    if (consensusLower === "hold") return 0
    if (consensusLower === "sell") return -2
    if (consensusLower === "strong sell") return -4
  } else if (side === "sell") {
    if (consensusLower === "strong sell") return 4
    if (consensusLower === "sell") return 2
    if (consensusLower === "hold") return 0
    if (consensusLower === "buy") return -2
    if (consensusLower === "strong buy") return -4
  }

  return 0
}

function buildNewsSummary(articles, stockSymbols, cryptoBaseMap) {
  const stockSet = new Set(stockSymbols.map((symbol) => normalizeTicker(symbol)))
  const buckets = new Map()

  articles.forEach((article) => {
    const entities = Array.isArray(article.entities) ? article.entities : []
    entities.forEach((entity) => {
      const type = String(entity?.type || "").toLowerCase()
      const rawSymbol = String(entity?.symbol || "")
      const sentiment = parseNumber(entity?.sentiment_score)
      let assetClass = null
      let symbol = null

      if (type === "equity" || type === "etf") {
        const ticker = normalizeTicker(rawSymbol)
        if (!ticker || !stockSet.has(ticker)) return
        assetClass = "stock"
        symbol = ticker
      } else if (type === "cryptocurrency") {
        const base = normalizeMarketauxCryptoSymbol(rawSymbol)
        if (!base) return
        const matched = cryptoBaseMap.get(base)
        if (!matched) return
        assetClass = "crypto"
        symbol = matched
      } else {
        return
      }

      const key = `${assetClass}:${symbol}`
      if (!buckets.has(key)) {
        buckets.set(key, {
          assetClass,
          symbol,
          count: 0,
          sentimentSum: 0,
          sentimentCount: 0,
          headlines: [],
        })
      }
      const bucket = buckets.get(key)
      bucket.count += 1
      if (sentiment !== null && sentiment !== undefined) {
        bucket.sentimentSum += sentiment
        bucket.sentimentCount += 1
      }
      if (bucket.headlines.length < 3 && article.title && article.url) {
        bucket.headlines.push({
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.published_at,
        })
      }
    })
  })

  const items = Array.from(buckets.values())
  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0)
  const scoreMap = new Map()

  items.forEach((item) => {
    const sentimentAvg =
      item.sentimentCount > 0 ? item.sentimentSum / item.sentimentCount : 0
    const volumeScore = maxCount > 0 ? (item.count / maxCount) * 100 : 0
    const sentimentScore = clamp(Math.abs(sentimentAvg) * 100, 0, 100)
    const score = clamp(volumeScore * 0.7 + sentimentScore * 0.3, 0, 100)
    const summary = {
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: Number(sentimentAvg.toFixed(2)),
      score: Number(score.toFixed(1)),
      headlines: item.headlines,
    }
    const key = getAssetKey(item.assetClass, item.symbol)
    if (key) scoreMap.set(key, summary)
    Object.assign(item, summary)
  })

  return {
    items: items.map((item) => ({
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: item.sentiment,
      score: item.score,
      headlines: item.headlines,
    })),
    scoreMap,
  }
}

function mapNewsItems(items) {
  const map = new Map()
  if (!Array.isArray(items)) return map
  items.forEach((item) => {
    const key = getAssetKey(item.assetClass, item.symbol)
    if (!key) return
    map.set(key, {
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: item.sentiment,
      score: item.score,
    })
  })
  return map
}

function buildOverrideNews(overrides) {
  if (!overrides || typeof overrides !== "object") return { items: [], scoreMap: new Map() }
  const entries = Object.entries(overrides)
    .map(([key, value]) => ({ key, value }))
    .filter(({ value }) => value && typeof value === "object")

  const items = []
  entries.forEach(({ key, value }) => {
    let assetClass = normalizeMarketTag(value.assetClass || value.market || "")
    let symbol = value.symbol || value.ticker || value.pair || null
    if (!symbol && typeof key === "string") {
      const parts = key.split(":").map((part) => part.trim())
      if (parts.length === 2) {
        assetClass = assetClass || normalizeMarketTag(parts[0])
        symbol = parts[1]
      } else if (parts.length === 1) {
        symbol = parts[0]
      }
    }
    if (!symbol) return
    if (!assetClass) assetClass = inferAssetClassFromSymbol(symbol)
    if (!assetClass) return
    const normalized = normalizeTestSymbol(symbol, assetClass)
    if (!normalized) return
    const sentimentRaw = parseNumber(value.sentimentScore ?? value.sentiment)
    const sentiment =
      typeof sentimentRaw === "number" ? clamp(sentimentRaw, -1, 1) : 0
    const count = Math.max(0, parseNumber(value.headlineCount ?? value.count) || 0)
    items.push({
      assetClass,
      symbol: normalized,
      count,
      sentiment,
      headlines: Array.isArray(value.headlines) ? value.headlines.slice(0, 3) : [],
    })
  })

  const maxCount = items.reduce((max, item) => Math.max(max, item.count || 0), 0)
  const scoreMap = new Map()
  items.forEach((item) => {
    const volumeScore = maxCount > 0 ? (item.count / maxCount) * 100 : 0
    const sentimentScore = clamp(Math.abs(item.sentiment) * 100, 0, 100)
    const score = clamp(volumeScore * 0.7 + sentimentScore * 0.3, 0, 100)
    const summary = {
      assetClass: item.assetClass,
      symbol: item.symbol,
      count: item.count,
      sentiment: Number(item.sentiment.toFixed(2)),
      score: Number(score.toFixed(1)),
      headlines: item.headlines,
      override: true,
    }
    const key = getAssetKey(item.assetClass, item.symbol)
    if (key) scoreMap.set(key, summary)
  })

  return { items, scoreMap }
}

async function loadNewsData(db, candidates, controls, universe, runId, runConfig = null) {
  if (!controls.enableNews) {
    console.log("News disabled in controls")
    return { scoreMap: new Map(), updatedAt: null }
  }
  if (!config.marketDataGatewayUrl) {
    console.log("News sentiment skipped (no market data gateway)")
    return { scoreMap: new Map(), updatedAt: null }
  }

  const isTestRun = runConfig?.testMode === true
  const overrides = isTestRun ? runConfig?.overrides?.marketaux : null

  const ref = db.doc(resolveMarketDocPath("news"))
  const snap = await ref.get()
  const cached = snap.exists ? snap.data() : null
  const lastUpdated = cached?.updatedAt?.toDate?.() || null
  const intervalMs = (controls.newsIntervalMinutes || config.newsIntervalMinutes) * 60 * 1000
  const nowMs = getEffectiveNowMs()
  const shouldFetch = !lastUpdated || nowMs - lastUpdated.getTime() >= intervalMs

  if (!shouldFetch && cached?.items && !isTestRun) {
    console.log(
      `Using cached news data (${cached.items?.length || 0} items, updated ${Math.round((nowMs - lastUpdated.getTime()) / 60000)} minutes ago)`
    )
    return { scoreMap: mapNewsItems(cached.items), updatedAt: cached.updatedAt }
  }

  const { cryptoSymbols, stockSymbols, cryptoBaseMap } = buildNewsSymbolLists(
    candidates,
    universe
  )

  const items = []
  const sources = []

  if (config.marketDataGatewayUrl && cryptoSymbols.length > 0) {
    console.log(`Fetching Marketaux news for ${cryptoSymbols.length} crypto symbols`)
    let cryptoNews = []
    
    // Fetch in smaller batches for better coverage (Marketaux returns limited results for large symbol lists)
    const batchSize = 5
    const symbolBatches = []
    for (let i = 0; i < cryptoSymbols.length; i += batchSize) {
      symbolBatches.push(cryptoSymbols.slice(i, i + batchSize))
    }
    
    // Fetch up to 3 batches (15 symbols) to reduce API calls while maintaining coverage
    const maxBatches = 3
    const batchesToFetch = symbolBatches.slice(0, maxBatches)
    console.log(`Fetching ${batchesToFetch.length} batches of crypto news (${batchesToFetch.flat().length} symbols)`)
    
    const batchPromises = batchesToFetch.map(batch => 
      fetchMarketauxNews(batch, "cryptocurrency").catch(err => {
        console.error(`Crypto news batch fetch failed:`, err.message)
        return []
      })
    )
    
    try {
      const batchResults = await Promise.all(batchPromises)
      cryptoNews = batchResults.flat()
    } catch (err) {
      console.error("Crypto news fetch failed:", err.message)
    }
    
    const { items: cryptoItems } = buildNewsSummary(
      cryptoNews,
      [],
      cryptoBaseMap
    )
    items.push(...cryptoItems)
    sources.push("marketaux")
  }

  if (config.marketDataGatewayUrl && stockSymbols.length > 0) {
    console.log(`Fetching Marketaux news for ${stockSymbols.length} stocks`)
    let stockNews = []
    try {
      stockNews = await fetchMarketauxNews(stockSymbols, "equity")
    } catch (err) {
      console.error("Stock news fetch failed:", err.message)
    }
    const { items: stockItems } = buildNewsSummary(
      stockNews,
      stockSymbols,
      cryptoBaseMap
    )
    items.push(...stockItems)
    sources.push("marketaux")
  }

  const scoreMap = mapNewsItems(items)
  if (overrides) {
    const overrideResult = buildOverrideNews(overrides)
    overrideResult.scoreMap.forEach((value, key) => scoreMap.set(key, value))
    if (overrideResult.items.length > 0) {
      console.log(`Applied ${overrideResult.items.length} Marketaux overrides for test run`)
    }
  }
  console.log(`Fetched sentiment for ${items.length} assets (sources: ${sources.join("+") || "none"})`)

  if (isTestRun) {
    return { scoreMap, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
  }

  await ref.set(
    {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      items,
      meta: {
        runId,
        symbols: items.length,
        intervalMinutes: controls.newsIntervalMinutes || config.newsIntervalMinutes,
        source: sources.join("+") || "none",
      },
    },
    { merge: true }
  )

  return { scoreMap, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
}

function resolveTrendMomentum(item, horizon) {
  const momentum = item?.momentum || {}
  if (horizon === "15m" && typeof momentum.change15m === "number") {
    return { change: momentum.change15m, window: "15m" }
  }
  if (horizon === "1h" && typeof momentum.change1h === "number") {
    return { change: momentum.change1h, window: "1h" }
  }
  if (horizon === "24h" && typeof momentum.change24h === "number") {
    return { change: momentum.change24h, window: "24h" }
  }
  if (horizon === "7d" && typeof momentum.change7d === "number") {
    return { change: momentum.change7d, window: "7d" }
  }
  if (typeof momentum.change24h === "number") {
    return { change: momentum.change24h, window: "24h" }
  }
  if (typeof momentum.change1h === "number") {
    return { change: momentum.change1h, window: "1h" }
  }
  if (typeof momentum.change7d === "number") {
    return { change: momentum.change7d, window: "7d" }
  }
  if (typeof momentum.change15m === "number") {
    return { change: momentum.change15m, window: "15m" }
  }
  return { change: null, window: horizon }
}

function formatChangeLabel(change) {
  if (typeof change !== "number") return "flat"
  const sign = change >= 0 ? "+" : ""
  return `${sign}${change.toFixed(2)}%`
}

function getSignalCreatedAt() {
  if (!config.signalBackfillMinutes || config.signalBackfillMinutes <= 0) {
    return { createdAt: admin.firestore.FieldValue.serverTimestamp(), backfillMinutes: 0 }
  }
  const createdAt = admin.firestore.Timestamp.fromDate(
    new Date(getEffectiveNowMs() - config.signalBackfillMinutes * 60 * 1000)
  )
  return { createdAt, backfillMinutes: config.signalBackfillMinutes }
}

async function ensureMarketIntelBot(db) {
  const ref = db.doc(`bots/${MARKET_SIGNAL_BOT_ID}`)
  await ref.set(
    {
      name: "Market Intel",
      engine: "market-intel",
      status: "online",
      lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      capabilities: { modes: ["signal"] },
    },
    { merge: true }
  )
}

async function emitMarketSignals(db, trendingByHorizon, controls) {
  if (!config.emitSignals) return
  const signalLimit = Number.isFinite(config.signalLimit)
    ? Math.max(0, Math.min(config.signalLimit, 10))
    : 0
  if (!signalLimit) return

  const horizon = VALID_TREND_HORIZONS.has(controls.trendHorizon)
    ? controls.trendHorizon
    : "15m"
  const buckets = trendingByHorizon?.[horizon] || {}
  const picks = []

    ;["crypto", "stock", "forex"].forEach((assetClass) => {
      const list = Array.isArray(buckets[assetClass]) ? buckets[assetClass] : []
      list.slice(0, signalLimit).forEach((item) => {
        if (!item?.symbol) return
        picks.push({ assetClass, item })
      })
    })

  if (picks.length === 0) return

  await ensureMarketIntelBot(db)
  const { createdAt, backfillMinutes } = getSignalCreatedAt()
  const batch = db.batch()

  picks.forEach(({ assetClass, item }) => {
    const momentum = resolveTrendMomentum(item, horizon)
    const side =
      typeof momentum.change === "number" ? (momentum.change >= 0 ? "buy" : "sell") : "hold"
    const strength =
      typeof item.score === "number"
        ? Number(clamp(item.score / 100, 0, 1).toFixed(2))
        : undefined
    const message = `${item.symbol} ${assetClass} trend ${momentum.window} ${formatChangeLabel(
      momentum.change
    )}`

    const referenceCapturedAt =
      typeof item.price === "number" ? admin.firestore.FieldValue.serverTimestamp() : undefined
    const data = compactObject({
      assetClass,
      horizon,
      trendWindow: momentum.window,
      score: item.score,
      components: item.components,
      momentum: item.momentum,
      referencePrice: typeof item.price === "number" ? item.price : undefined,
      referenceSource: item.source,
      referenceCapturedAt,
      source: "market-intel",
      backfillMinutes: backfillMinutes > 0 ? backfillMinutes : undefined,
    })

    const ref = db
      .collection("bots")
      .doc(MARKET_SIGNAL_BOT_ID)
      .collection("signals")
      .doc()

    batch.set(
      ref,
      compactObject({
        symbol: item.symbol,
        side,
        strength,
        message,
        data,
        createdAt,
      })
    )
  })

  await batch.commit()
}

async function fetchBotSignals(db, botWeights = new Map()) {
  const lookbackMs = config.signalLookbackMinutes * 60 * 1000
  const now = getEffectiveNowMs()
  const cutoff = admin.firestore.Timestamp.fromDate(new Date(now - lookbackMs))
  const halfLifeMs = Math.max(config.signalDecayHalfLifeMinutes, 1) * 60 * 1000
  const recentMs = Math.max(config.signalRecentMinutes, 1) * 60 * 1000

  const snap = await db
    .collectionGroup("signals")
    .where("createdAt", ">=", cutoff)
    .orderBy("createdAt", "desc")
    .limit(800) // Increased from 200 to capture more bot signals across all bots
    .get()

  const map = new Map()

  snap.docs.forEach((doc) => {
    const data = doc.data() || {}
    const botId = doc.ref.parent.parent?.id || "unknown"
    const symbol = extractSymbolFromSignal(data)
    if (!symbol) return

    const entry = map.get(symbol) || {
      symbol,
      total: 0,
      buy: 0,
      sell: 0,
      strengthSum: 0,
      weightedTotal: 0,
      weightedBuy: 0,
      weightedSell: 0,
      weightedStrengthSum: 0,
      recentCount: 0,
      recentWeight: 0,
      latestAt: null,
      bots: new Set(),
    }

    let ageMs = lookbackMs
    if (data.createdAt) {
      const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : null
      if (createdAt) {
        ageMs = Math.max(now - createdAt.getTime(), 0)
      }
    }
    const decay = halfLifeMs > 0 ? Math.exp((-Math.log(2) * ageMs) / halfLifeMs) : 1
    const decayWeight = clamp(decay, 0.15, 1)
    const weight = (botWeights.get(botId) ?? 1) * decayWeight
    entry.total += 1
    if (data.side === "buy") entry.buy += 1
    if (data.side === "sell") entry.sell += 1
    if (typeof data.strength === "number") entry.strengthSum += data.strength

    entry.weightedTotal += weight
    if (data.side === "buy") entry.weightedBuy += weight
    if (data.side === "sell") entry.weightedSell += weight
    if (typeof data.strength === "number") {
      entry.weightedStrengthSum += data.strength * weight
    }
    if (data.createdAt) {
      const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : null
      if (createdAt && (!entry.latestAt || createdAt > entry.latestAt)) {
        entry.latestAt = createdAt
      }
      if (createdAt && now - createdAt.getTime() <= recentMs) {
        entry.recentCount += 1
        entry.recentWeight += weight
      }
    }
    entry.bots.add(botId)

    map.set(symbol, entry)
  })

  return map
}

function resolveTradeSide(candidate, signalData) {
  if (signalData && (signalData.total > 0 || signalData.weightedTotal > 0)) {
    const buy = signalData.weightedBuy ?? signalData.buy ?? 0
    const sell = signalData.weightedSell ?? signalData.sell ?? 0
    return buy >= sell ? "buy" : "sell"
  }
  if (candidate.sideHint) return candidate.sideHint
  const change =
    parseNumber(candidate.change5m) ??
    parseNumber(candidate.change1m) ??
    parseNumber(candidate.change15m) ??
    parseNumber(candidate.change1h) ??
    parseNumber(candidate.change24h) ??
    parseNumber(candidate.change7d)
  if (change === undefined || change === null) return "buy"
  return change >= 0 ? "buy" : "sell"
}

function normalizeScoreWeightOverrides(overrides) {
  if (!overrides || typeof overrides !== "object") return null
  const momentum = parseNumber(overrides.momentum)
  const liquidity = parseNumber(
    overrides.liquidity ?? overrides.volume
  )
  const consensus = parseNumber(
    overrides.consensus ?? overrides.signals
  )
  const news = parseNumber(overrides.news)
  const normalized = {}
  if (typeof momentum === "number") normalized.momentum = momentum
  if (typeof liquidity === "number") normalized.liquidity = liquidity
  if (typeof consensus === "number") normalized.consensus = consensus
  if (typeof news === "number") normalized.news = news
  return Object.keys(normalized).length > 0 ? normalized : null
}

function normalizeScoreWeights(weights) {
  if (!weights || typeof weights !== "object") return weights
  const entries = Object.entries(weights).filter(([, value]) => typeof value === "number")
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  if (!total) return weights
  const normalized = {}
  entries.forEach(([key, value]) => {
    normalized[key] = (value / total) * 100
  })
  return normalized
}

function applyRiskProfile(weights, riskProfile) {
  if (!weights || typeof weights !== "object") return weights
  const multipliers =
    RISK_WEIGHT_MULTIPLIERS[riskProfile] || RISK_WEIGHT_MULTIPLIERS.balanced
  return {
    momentum: (weights.momentum ?? 0) * (multipliers.momentum ?? 1),
    consensus: (weights.consensus ?? 0) * (multipliers.consensus ?? 1),
    liquidity: (weights.liquidity ?? 0) * (multipliers.liquidity ?? 1),
    news: (weights.news ?? 0) * (multipliers.news ?? 1),
  }
}

function resolveScoreWeights(assetClass, profile, overrides = null, riskProfile = "balanced") {
  const bucket = SCORE_WEIGHTS_BY_ASSET[assetClass] || SCORE_WEIGHTS_BY_ASSET.stock
  const base = bucket[profile] || bucket.scalp
  const overrideMap = normalizeScoreWeightOverrides(overrides)
  const merged = overrideMap ? { ...base, ...overrideMap } : { ...base }
  const riskAdjusted = applyRiskProfile(merged, riskProfile)
  return normalizeScoreWeights(riskAdjusted)
}

function cleanTrendWeightsForDoc(weights) {
  const momentum = parseNumber(weights?.momentum)
  const liquidity = parseNumber(weights?.liquidity ?? weights?.volume)
  const consensus = parseNumber(weights?.consensus ?? weights?.signals)
  const news = parseNumber(weights?.news)
  const cleaned = {
    momentum:
      typeof momentum === "number" ? momentum : DEFAULT_TREND_WEIGHTS.momentum,
    liquidity:
      typeof liquidity === "number" ? liquidity : DEFAULT_TREND_WEIGHTS.volume,
    consensus:
      typeof consensus === "number" ? consensus : DEFAULT_TREND_WEIGHTS.signals,
    news: typeof news === "number" ? news : DEFAULT_TREND_WEIGHTS.news,
  }
  return {
    ...cleaned,
    volume: admin.firestore.FieldValue.delete(),
    signals: admin.firestore.FieldValue.delete(),
  }
}

function blendWeighted(values) {
  const entries = values.filter((entry) => typeof entry.value === "number")
  if (entries.length === 0) return null
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (!totalWeight) return null
  return entries.reduce((sum, entry) => sum + entry.value * (entry.weight / totalWeight), 0)
}

function resolveVolatilityScale(candidate, horizonMinutes, fallbackSeed = null) {
  const volatility5m = parseNumber(candidate.volatility5m)
  const volatility1m = parseNumber(candidate.volatility1m)
  let base = volatility5m ?? volatility1m
  let baseMinutes = volatility5m ? 5 : volatility1m ? 1 : null
  let fallback = false

  if (!(typeof base === "number") || base <= 0 || !baseMinutes) {
    const seed =
      typeof fallbackSeed === "number" && fallbackSeed > 0
        ? fallbackSeed
        : config.momentumVolFloor
    base = seed
    baseMinutes = horizonMinutes
    fallback = true
  }

  const scaled = baseMinutes ? base * Math.sqrt(horizonMinutes / baseMinutes) : base
  const value = clamp(scaled, config.momentumVolFloor, config.momentumVolCeil)
  return { value, fallback }
}

function formatScoreComponents(components) {
  if (!components || typeof components !== "object") return undefined
  const penalties = components.penalties || {}
  const round = (value) =>
    typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(2)) : undefined
  return compactObject({
    momentum: round(components.momentum),
    consensus: round(components.consensus),
    liquidity: round(components.liquidity),
    news: round(components.news),
    universe: round(components.universe),
    analyst: round(components.analyst),
    penalties: compactObject({
      spread: round(penalties.spread),
      liquidity: round(penalties.liquidity),
      price: round(penalties.price),
      volume: round(penalties.volume),
      sentiment: round(penalties.sentiment),
    }),
  })
}

function scoreTrade(candidate, signalData, side, options = {}) {
  const weightsOverride = options.weights || null
  const signalWeight =
    typeof options.signalWeight === "number" ? options.signalWeight : 1
  const newsScore = options.newsScore
  const horizon = options.horizon || "15m"
  const riskProfile = VALID_RISK.has(options.riskProfile)
    ? options.riskProfile
    : "balanced"

  const rawChange1m = parseNumber(candidate.change1m)
  const rawChange5m = parseNumber(candidate.change5m)
  const shortBlend = blendWeighted([
    { value: rawChange5m, weight: 0.6 },
    { value: rawChange1m, weight: 0.4 },
  ])
  const longResolved = resolveHorizonChange(candidate, horizon)
  const longChange =
    typeof longResolved.change === "number" ? longResolved.change : null
  const changeBase =
    shortBlend !== null
      ? (longChange !== null ? longChange * 0.6 + shortBlend * 0.4 : shortBlend)
      : longChange ?? 0
  const horizonMinutes = getHorizonMinutes(longResolved.window || horizon)
  const fallbackSeed = Math.max(
    typeof shortBlend === "number" ? Math.abs(shortBlend) : 0,
    typeof longChange === "number" ? Math.abs(longChange) / 3 : 0,
    config.momentumVolFloor
  )
  const volatility = resolveVolatilityScale(candidate, horizonMinutes, fallbackSeed)
  const volatilityScale = volatility.value

  let consensusRatio = 0
  let consensusRatioRaw = 0
  let confidence = 0

  if (signalData && (signalData.total > 0 || signalData.weightedTotal > 0)) {
    const totalWeight = signalData.weightedTotal ?? signalData.total ?? 0
    const buyWeight = signalData.weightedBuy ?? signalData.buy ?? 0
    const sellWeight = signalData.weightedSell ?? signalData.sell ?? 0
    const bias = totalWeight ? (buyWeight - sellWeight) / totalWeight : 0
    consensusRatioRaw = clamp(Math.abs(bias) * signalWeight, 0, 1)
    const recentCount = signalData.recentCount ?? 0
    const recencyFactor =
      config.signalMinRecent > 0
        ? clamp(recentCount / config.signalMinRecent, 0, 1)
        : 1
    consensusRatio = consensusRatioRaw * recencyFactor
    const confidenceBase = signalData.recentWeight ?? totalWeight
    confidence = clamp(confidenceBase / 5, 0, 1)
  }
  let volumeRatio = 0
  if (typeof candidate.volumeScore === "number") {
    const normalized = candidate.volumeScore > 1 ? candidate.volumeScore / 100 : candidate.volumeScore
    volumeRatio = clamp(normalized, 0, 1)
  } else if (candidate.liquidityRank) {
    const denom = Math.max(config.moverTopLimit - 1, 1)
    volumeRatio = clamp(1 - (candidate.liquidityRank - 1) / denom, 0, 1)
  }
  const sentimentRatio =
    typeof newsScore === "number" ? clamp((newsScore + 1) / 2, 0, 1) : 0

  // Profile: "dip" = buying a falling asset, "scalp" = riding momentum
  const profile = side === "buy" && changeBase < 0 ? "dip" : "scalp"
  const weightSet = resolveScoreWeights(
    candidate.assetClass,
    profile,
    weightsOverride,
    riskProfile
  )
  
  // FIXED: Momentum should measure MAGNITUDE of price movement, not direction
  // The side (buy/sell) already captures direction - momentum is about strength
  // A 10% move is high momentum regardless of whether it's up or down
  let momentumBase = 0
  if (profile === "dip") {
    // Dip buying: reward bigger drops (more discount = better entry)
    momentumBase = changeBase < 0 ? Math.abs(changeBase) : 0
  } else {
    // Scalp (trend following): reward magnitude of move in the signal direction
    // For buy signals on rising assets: changeBase > 0 is good
    // For sell signals on rising assets: changeBase > 0 is ALSO good (profit taking)
    // For sell signals on falling assets: changeBase < 0 is good (shorting)
    if (side === "sell") {
      // Sell signal: magnitude of movement matters - big moves = opportunity
      momentumBase = Math.abs(changeBase)
    } else {
      // Buy signal (not dip): only reward upward momentum
      momentumBase = changeBase > 0 ? changeBase : 0
    }
  }
  // IMPROVED: Use sigmoid-based momentum scoring for better differentiation
  // Instead of volatility-scaling (which normalizes out the signal), use:
  // - Logarithmic scaling for large moves (so 30% move scores higher than 3%)
  // - Asset-class specific thresholds
  const momentumThresholds = {
    crypto: { low: 1, mid: 5, high: 15 },   // Crypto is more volatile
    stock: { low: 0.5, mid: 2, high: 5 },   // Stocks move less
    forex: { low: 0.1, mid: 0.5, high: 1.5 }, // Forex even less
  }
  const thresholds = momentumThresholds[candidate.assetClass] || momentumThresholds.stock
  
  // Convert momentum to 0-1 range using smooth sigmoid-like curve
  // This ensures: 0% -> 0, threshold.mid -> 0.5, threshold.high -> 0.85
  let momentumStrength = 0
  if (momentumBase > 0) {
    const normalized = momentumBase / thresholds.mid
    // Sigmoid: tanh gives smooth 0-1 curve, multiply by 1.2 to reach ~0.9 at high
    momentumStrength = clamp(Math.tanh(normalized * 0.8), 0, 1)
  }
  
  const momentumScore = momentumStrength * (weightSet.momentum ?? 0)
  const consensusScore = consensusRatio * (weightSet.consensus ?? 0)
  const liquidityScore = volumeRatio * (weightSet.liquidity ?? 0)
  const newsSentimentScore = sentimentRatio * (weightSet.news ?? 0)
  const universeBoost =
    typeof candidate.universeBoost === "number" ? candidate.universeBoost : 0
  const primaryBoost = candidate.primary ? config.primaryScoreBoost : 0
  const universeScore = universeBoost + primaryBoost
  // Analyst consensus boost for stocks (from FMP grades-consensus)
  const analystBoost = candidate.assetClass === "stock" && options.analystConsensusMap
    ? calcAnalystBoost(candidate.symbol, side, options.analystConsensusMap)
    : 0
  let score =
    momentumScore +
    consensusScore +
    liquidityScore +
    newsSentimentScore +
    universeScore +
    analystBoost
  const sentimentPenalty = profile === "dip" && sentimentRatio < 0.35 ? 5 : 0

  let liquidityPenalty = 0
  if (volumeRatio > 0 && volumeRatio < 0.1) liquidityPenalty += 6
  if (volumeRatio > 0 && volumeRatio < 0.05) liquidityPenalty += 8
  let spreadPenalty = 0
  if (typeof candidate.spreadPct === "number") {
    const limit = SPREAD_PCT_LIMITS[candidate.assetClass] ?? SPREAD_PCT_LIMITS.stock
    if (candidate.spreadPct > limit) {
      spreadPenalty = clamp((candidate.spreadPct - limit) * 20, 0, 15)
    }
  }
  score -= liquidityPenalty + spreadPenalty + sentimentPenalty

  let pricePenalty = 0
  if (
    candidate.assetClass === "stock" &&
    typeof candidate.price === "number" &&
    candidate.price < config.moverMinPrice
  ) {
    pricePenalty = 10
  }
  score -= pricePenalty
  let volumePenalty = 0
  if (
    candidate.assetClass === "stock" &&
    typeof candidate.volume === "number" &&
    config.moverMinVolume > 0 &&
    candidate.volume < config.moverMinVolume
  ) {
    volumePenalty = 10
  }
  score -= volumePenalty

  score = clamp(score, 0, 100)

  // Confidence scoring: measures how reliable the score is, not how good the trade is
  // Higher confidence = more data points confirming the score
  const confidenceParts = [
    // Data availability (up to 0.3)
    shortBlend !== null ? 0.1 : 0,
    longChange !== null ? 0.1 : 0,
    !volatility.fallback ? 0.1 : 0,
    
    // Signal strength (up to 0.35)
    signalData && signalData.total >= 10 ? 0.2 : 
      signalData && signalData.total >= 5 ? 0.15 :
      signalData && signalData.total >= 2 ? 0.1 :
      signalData && signalData.total >= 1 ? 0.05 : 0,
    // Consensus: bots agreeing on direction
    consensusRatio >= 0.7 ? 0.15 : consensusRatio >= 0.4 ? 0.1 : consensusRatio >= 0.2 ? 0.05 : 0,
    
    // Volume/liquidity confirmation (up to 0.15)
    volumeRatio >= 0.7 ? 0.15 : volumeRatio >= 0.3 ? 0.1 : volumeRatio > 0 ? 0.05 : 0,
    
    // News sentiment (up to 0.1)
    typeof newsScore === "number" && Math.abs(newsScore) >= 0.5 ? 0.1 : 
      typeof newsScore === "number" && Math.abs(newsScore) >= 0.2 ? 0.05 : 0,
    
    // Momentum strength (up to 0.1)
    momentumStrength >= 0.7 ? 0.1 : momentumStrength >= 0.3 ? 0.05 : 0,
  ]
  let confidenceScore = confidenceParts.reduce((sum, value) => sum + value, 0)
  if (longResolved.fallback) confidenceScore *= 0.9
  if (volatility.fallback) confidenceScore *= 0.95
  confidenceScore = clamp(confidenceScore, 0, 1)

  return {
    profile,
    score,
    confidence: confidenceScore,
    components: {
      momentum: momentumScore,
      consensus: consensusScore,
      liquidity: liquidityScore,
      news: newsSentimentScore,
      universe: universeScore,
      analyst: analystBoost,
      penalties: {
        spread: spreadPenalty ? -spreadPenalty : 0,
        liquidity: liquidityPenalty ? -liquidityPenalty : 0,
        price: pricePenalty ? -pricePenalty : 0,
        volume: volumePenalty ? -volumePenalty : 0,
        sentiment: sentimentPenalty ? -sentimentPenalty : 0,
      },
    },
    momentum: {
      changeBase,
      shortBlend,
      longChange,
      longWindow: longResolved.window || horizon,
    },
  }
}

async function fetchFmpCandles(symbol, assetClass, interval = "15min", limit = 120) {
  if (!config.marketDataGatewayUrl) return []
  if (!symbol) return []
  if (assetClass !== "stock" && assetClass !== "forex" && assetClass !== "crypto") {
    return []
  }
  try {
    const data = await fetchGatewayJson("/v1/fmp/candles", {
      symbol,
      assetClass,
      interval,
      limit: String(limit),
    })
    const candles = Array.isArray(data?.candles) ? data.candles : []
    if (candles.length === 0) return []
    return candles.slice(-limit)
  } catch (error) {
    console.error(`Failed to fetch FMP candles for ${symbol}:`, error.message)
    return []
  }
}

function computeAtrPercent(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null
  const recent = candles.slice(-(period + 1))
  const ranges = []
  for (let i = 1; i < recent.length; i += 1) {
    const prev = recent[i - 1]
    const curr = recent[i]
    if (!prev || !curr) continue
    const highLow = curr.high - curr.low
    const highClose = Math.abs(curr.high - prev.close)
    const lowClose = Math.abs(curr.low - prev.close)
    const tr = Math.max(highLow, highClose, lowClose)
    if (Number.isFinite(tr)) ranges.push(tr)
  }
  if (ranges.length === 0) return null
  const atr = ranges.reduce((sum, value) => sum + value, 0) / ranges.length
  const lastClose = recent[recent.length - 1]?.close
  if (!lastClose) return null
  return (atr / lastClose) * 100
}

function computeAtr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null
  const recent = candles.slice(-(period + 1))
  const ranges = []
  for (let i = 1; i < recent.length; i += 1) {
    const prev = recent[i - 1]
    const curr = recent[i]
    if (!prev || !curr) continue
    const highLow = curr.high - curr.low
    const highClose = Math.abs(curr.high - prev.close)
    const lowClose = Math.abs(curr.low - prev.close)
    const tr = Math.max(highLow, highClose, lowClose)
    if (Number.isFinite(tr)) ranges.push(tr)
  }
  if (ranges.length === 0) return null
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length
}

function computeSma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null
  const slice = values.slice(-period)
  const sum = slice.reduce((acc, value) => acc + value, 0)
  return sum / period
}

function formatCompactNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return `${Math.round(value)}`
}

function computeHoldMinutes(assetClass, absChange, netSignals, profile, atrPct) {
  const isDip = profile === "dip"
  let hold = 120
  if (assetClass === "forex") {
    hold = isDip ? 90 : 45
  } else if (assetClass === "crypto") {
    hold = isDip ? 150 : 90
  } else {
    hold = isDip ? 150 : 90
  }

  if (assetClass === "stock" && absChange >= 5) hold *= 0.6
  if (assetClass === "forex" && absChange >= 0.3) hold *= 0.6
  if (assetClass === "crypto" && absChange >= 2) hold *= 0.65

  if (typeof atrPct === "number") {
    if (assetClass === "forex" && atrPct >= 0.4) hold *= 0.75
    if (assetClass === "stock" && atrPct >= 2) hold *= 0.75
    if (assetClass === "crypto" && atrPct >= 4) hold *= 0.75
  }

  if (Math.abs(netSignals) >= 2 && absChange < 0.8) hold *= 1.1

  if (assetClass === "forex") return clamp(Math.round(hold), isDip ? 30 : 15, isDip ? 180 : 90)
  if (assetClass === "crypto") return clamp(Math.round(hold), isDip ? 60 : 30, isDip ? 360 : 180)
  return clamp(Math.round(hold), isDip ? 60 : 30, isDip ? 240 : 150)
}

function computeRecommendation(trade, atrPct) {
  const buySignals = trade.signals?.buy ?? 0
  const sellSignals = trade.signals?.sell ?? 0
  const netSignals = buySignals - sellSignals
  const score = typeof trade.score === "number" ? trade.score : 0
  const profile = trade.profile || "scalp"

  let action = "hold"
  if (score >= 75 && netSignals > 0) action = "buy"
  if (score <= 25 && netSignals < 0) action = "sell"

  const change =
    typeof trade.momentum?.change15m === "number"
      ? trade.momentum.change15m
      : typeof trade.momentum?.change1h === "number"
        ? trade.momentum.change1h
        : typeof trade.momentum?.change24h === "number"
          ? trade.momentum.change24h
          : 0
  const absChange = Math.abs(change)
  const holdMinutes = computeHoldMinutes(
    trade.assetClass,
    absChange,
    netSignals,
    profile,
    atrPct
  )

  let stopLossPct = null
  let takeProfitPct = null
  if (typeof atrPct === "number") {
    stopLossPct = clamp(atrPct * 1.2, 0.5, 8)
    takeProfitPct = clamp(stopLossPct * 1.8, 1, 15)
  } else {
    const fallbackStop =
      trade.assetClass === "forex" ? 0.5 : trade.assetClass === "crypto" ? 3 : 2
    stopLossPct = clamp(fallbackStop, 0.5, 8)
    takeProfitPct = clamp(stopLossPct * 1.8, 1, 15)
  }

  if (action === "hold") {
    return {
      action,
      holdMinutes,
      stopLossPct: Number(stopLossPct.toFixed(2)),
      takeProfitPct: Number(takeProfitPct.toFixed(2)),
    }
  }

  return {
    action,
    holdMinutes,
    stopLossPct: Number(stopLossPct.toFixed(2)),
    takeProfitPct: Number(takeProfitPct.toFixed(2)),
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let index = 0
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await mapper(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}

async function buildRecommendations(trades, limit = 50) {
  if (!Array.isArray(trades) || trades.length === 0) return new Map()
  const capped = trades.slice(0, Math.max(0, limit))
  const recommendations = new Map()

  await mapWithConcurrency(capped, 5, async (trade) => {
    const candles = await fetchFmpCandles(trade.symbol, trade.assetClass, "15min")
    const atrPct = computeAtrPercent(candles)
    const recommendation = computeRecommendation(trade, atrPct)
    const key = getAssetKey(trade.assetClass, trade.symbol)
    if (key) {
      recommendations.set(key, recommendation)
    }
  })

  return recommendations
}

function buildRationale(candidate, signalData, scoreDetail) {
  const parts = []

  if (signalData && signalData.total > 0) {
    parts.push(`${signalData.buy}/${signalData.total} bots signal buy`)
  }

  const shortMoves = []
  if (typeof candidate.change1m === "number") {
    shortMoves.push(`1m ${candidate.change1m.toFixed(2)}%`)
  }
  if (typeof candidate.change5m === "number") {
    shortMoves.push(`5m ${candidate.change5m.toFixed(2)}%`)
  }
  if (typeof candidate.change15m === "number") {
    shortMoves.push(`15m ${candidate.change15m.toFixed(2)}%`)
  }
  if (shortMoves.length > 0) {
    parts.push(`momentum ${shortMoves.join("/")}`)
  } else if (typeof candidate.change1h === "number") {
    parts.push(`1h move ${candidate.change1h.toFixed(2)}%`)
  } else if (typeof candidate.change24h === "number") {
    parts.push(`24h move ${candidate.change24h.toFixed(2)}%`)
  }

  if (scoreDetail.profile === "dip") {
    parts.push("dip setup")
  } else if (scoreDetail.profile === "scalp") {
    parts.push("scalp momentum")
  }

  if (candidate.volume) {
    parts.push("liquidity strong")
  }

  if (candidate.watchlisted) {
    parts.push("in your universe")
  }

  if (candidate.primary) {
    parts.push("primary focus")
  }

  if (scoreDetail.score > 70) {
    parts.push("high momentum")
  }

  return parts.join(" • ")
}

async function enrichWithOpenAI(items) {
  if (!config.openaiKey || items.length === 0) return null

  const payload = items.map((item) => ({
    symbol: item.symbol,
    assetClass: item.assetClass,
    side: item.side,
    score: item.score,
    change24h: item.momentum?.change24h,
    signals: item.signals?.total || 0,
  }))

  const prompt = [
    "Summarize why each trade is hot in 1 short sentence.",
    "Avoid financial advice language.",
    "Return a JSON object with an 'items' array of { symbol, rationale }.",
    `Items: ${JSON.stringify(payload)}`,
  ].join("\n")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a trading ops assistant." },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) return null

  try {
    const parsed = JSON.parse(content)
    const list = Array.isArray(parsed) ? parsed : parsed.items || parsed.rationales
    if (!Array.isArray(list)) return null
    const map = new Map()
    list.forEach((item) => {
      if (item?.symbol && item?.rationale) {
        map.set(String(item.symbol).toUpperCase(), String(item.rationale))
      }
    })
    return map
  } catch (err) {
    return null
  }
}

function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

async function monitorPaperTrading(db, prices) {
  const priceMap = new Map()
  prices.forEach((p) => {
    if (p.symbol && p.price) {
      priceMap.set(p.symbol.toUpperCase(), p.price)
    }
  })

  // Scan all positions across all users
  try {
    const snapshot = await db.collectionGroup("positions").get()
    const trades = []

    snapshot.docs.forEach((doc) => {
      const position = doc.data()
      if (!position.symbol) return

      const currentPrice = priceMap.get(position.symbol.toUpperCase())
      if (!currentPrice) return

      let trigger = null
      if (position.stopLoss && currentPrice <= position.stopLoss) {
        trigger = "Stop Loss"
      } else if (position.takeProfit && currentPrice >= position.takeProfit) {
        trigger = "Take Profit"
      }

      if (trigger) {
        const parts = doc.ref.path.split("/")
        const userId = parts[1]
        trades.push({
          userId,
          symbol: position.symbol,
          assetClass: position.assetClass,
          quantity: position.quantity,
          price: currentPrice,
          reason: trigger,
          positionRef: doc.ref,
        })
      }
    })

    if (trades.length > 0) {
      console.log(`Paper monitor: Found ${trades.length} automation triggers`)
      for (const trade of trades) {
        try {
          await executePaperTradeBackend(db, trade)
          console.log(`Paper execution: ${trade.reason} triggered for ${trade.symbol} (User: ${trade.userId})`)
        } catch (err) {
          console.error(`Paper execution failed for ${trade.userId}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error("Paper collectionGroup scan failed:", err.message)
  }
}

async function executePaperTradeBackend(db, trade) {
  const { userId, symbol, quantity, price, assetClass, positionRef, reason } = trade
  const walletRef = db.doc(`users/${userId}/paper/wallet`)
  const cost = quantity * price

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef)
    if (!walletSnap.exists) return

    const walletData = walletSnap.data()
    const newBalance = (walletData.balance || 0) + cost

    tx.update(walletRef, {
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const txRef = walletRef.collection("transactions").doc()
    tx.set(txRef, {
      userId,
      symbol,
      side: "sell",
      amount: quantity,
      price,
      cost,
      assetClass,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: "close",
      automated: true,
      reason,
    })

    tx.delete(positionRef)
  })
}

function markPrimary(candidates, primarySets) {
  return candidates.map((candidate) => {
    let primary = false
    if (candidate.assetClass === "stock") {
      const key = normalizeTicker(candidate.symbol)
      primary = key ? primarySets.stocks.has(key) : false
    } else if (candidate.assetClass === "forex") {
      const key = normalizeSymbol(candidate.symbol)
      primary = key ? primarySets.forex.has(key) : false
    } else {
      const key = normalizeSymbol(candidate.symbol)
      primary = key ? primarySets.crypto.has(key) : false
    }

    return { ...candidate, primary }
  })
}

function buildHotTrades(candidates, signalMap, scoreOptions, newsScoreMap = null) {
  const scored = candidates.map((candidate) => {
    const symbolKey = getCandidateKey(candidate)
    const signalData = symbolKey ? signalMap.get(symbolKey) : null
    const side = resolveTradeSide(candidate, signalData)
    const assetKey = getAssetKey(candidate.assetClass, candidate.symbol)
    const newsData = newsScoreMap && assetKey ? newsScoreMap.get(assetKey) : null
    const newsSentiment = newsData?.sentiment ?? null // -1 to 1 range
    const scoreDetail = scoreTrade(candidate, signalData, side, {
      weights: scoreOptions?.weights,
      signalWeight: scoreOptions?.signalWeight,
      horizon: scoreOptions?.horizon || "15m",
      newsScore: newsSentiment,
      analystConsensusMap: scoreOptions?.analystConsensusMap,
    })
    const scoreComponents = formatScoreComponents(scoreDetail.components)

    const signals = signalData
      ? compactObject({
        total: signalData.total,
        buy: signalData.buy,
        sell: signalData.sell,
        strengthAvg: signalData.total
          ? Number((signalData.strengthSum / signalData.total).toFixed(2))
          : undefined,
        recent: signalData.recentCount,
        bots: Array.from(signalData.bots),
      })
      : undefined

    const momentum = compactObject({
      change1m: candidate.change1m,
      change5m: candidate.change5m,
      change15m: candidate.change15m,
      change1h: candidate.change1h,
      change24h: candidate.change24h,
      change7d: candidate.change7d,
    })

    // Normalize symbol for charting compatibility (Twelve Data API format)
    const chartSymbol = normalizeSymbolForCharting(candidate.symbol, candidate.assetClass)
    
    return compactObject({
      assetClass: candidate.assetClass,
      symbol: chartSymbol, // Use normalized symbol for charting
      name: candidate.name || candidate.symbol,
      exchange: candidate.exchange,
      price: typeof candidate.price === "number" ? Number(candidate.price) : undefined,
      timeframe: candidate.assetClass === "crypto" ? "1h" : "15m",
      side,
      profile: scoreDetail.profile,
      score: Number(scoreDetail.score.toFixed(2)),
      confidence: Number(scoreDetail.confidence.toFixed(2)),
      scoreComponents: scoreComponents || undefined,
      primary: candidate.primary ? true : undefined,
      origins: candidate.origins,
      momentum: Object.keys(momentum).length ? momentum : undefined,
      signals,
      source: candidate.source,
      rationale: buildRationale(candidate, signalData, scoreDetail),
    })
  })

  return scored.sort((a, b) => (b.score || 0) - (a.score || 0))
}

function resolveSwingEntryWindow(asOf) {
  const now = asOf instanceof Date ? asOf : new Date(asOf)
  const dateKey = getEtDateKey(now)
  const openMinutes = 9 * 60 + 30
  const closeMinutes = resolveStockSessionCloseMinutes(dateKey)
  const entryStartMinutes = closeMinutes - SWING_RULES.entryWindowMinutes
  const entryEndMinutes = closeMinutes
  const entryWindow = {
    start: formatEtMinutes(entryStartMinutes),
    end: formatEtMinutes(entryEndMinutes),
    close: formatEtMinutes(closeMinutes),
    timezone: "America/New_York",
  }
  if (isEtWeekend(dateKey)) {
    return { active: false, status: "weekend", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  if (isUsStockHoliday(dateKey)) {
    return { active: false, status: "holiday", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  const nowMinutes = getEtTimeMinutes(now)
  if (nowMinutes < openMinutes) {
    return { active: false, status: "pre_open", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  if (nowMinutes > closeMinutes) {
    return { active: false, status: "after_close", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  if (nowMinutes < entryStartMinutes) {
    return { active: false, status: "outside_window", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  return {
    active: true,
    status: "active",
    dateKey,
    entryWindow,
    openMinutes,
    closeMinutes,
  }
}

function resolvePrebreakoutEntryWindow(asOf) {
  const now = asOf instanceof Date ? asOf : new Date(asOf)
  const dateKey = getEtDateKey(now)
  const openMinutes = 9 * 60 + 30
  const closeMinutes = resolveStockSessionCloseMinutes(dateKey)
  const entryStartMinutes = closeMinutes - PREBREAKOUT_RULES.entryWindowMinutes
  const entryEndMinutes = closeMinutes
  const entryWindow = {
    start: formatEtMinutes(entryStartMinutes),
    end: formatEtMinutes(entryEndMinutes),
    close: formatEtMinutes(closeMinutes),
    timezone: "America/New_York",
  }
  if (isEtWeekend(dateKey)) {
    return { active: false, status: "weekend", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  if (isUsStockHoliday(dateKey)) {
    return { active: false, status: "holiday", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  const nowMinutes = getEtTimeMinutes(now)
  if (nowMinutes < openMinutes) {
    return { active: false, status: "pre_open", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  if (nowMinutes > closeMinutes) {
    return { active: false, status: "after_close", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  if (nowMinutes < entryStartMinutes) {
    return { active: false, status: "outside_window", dateKey, entryWindow, openMinutes, closeMinutes }
  }
  return {
    active: true,
    status: "active",
    dateKey,
    entryWindow,
    openMinutes,
    closeMinutes,
  }
}

function groupStockIntradaySessions(candles) {
  const sessions = new Map()
  if (!Array.isArray(candles)) return sessions
  candles.forEach((candle) => {
    if (!candle || typeof candle.time !== "number") return
    const date = new Date(candle.time)
    const dateKey = getEtDateKey(date)
    if (isEtWeekend(dateKey) || isUsStockHoliday(dateKey)) return
    const minutes = getEtTimeMinutes(date)
    const openMinutes = 9 * 60 + 30
    const closeMinutes = resolveStockSessionCloseMinutes(dateKey)
    if (minutes < openMinutes || minutes > closeMinutes) return
    const entry = { ...candle, minutes }
    if (!sessions.has(dateKey)) sessions.set(dateKey, [])
    sessions.get(dateKey).push(entry)
  })
  sessions.forEach((list) => {
    list.sort((a, b) => a.time - b.time)
  })
  return sessions
}

function computeSessionVolume(sessionCandles) {
  if (!Array.isArray(sessionCandles) || sessionCandles.length === 0) return null
  const volumes = sessionCandles
    .map((candle) => parseNumber(candle.volume))
    .filter((value) => Number.isFinite(value))
  if (volumes.length === 0) return null
  return volumes.reduce((sum, value) => sum + value, 0)
}

function computeLastWindowVolume(sessionCandles, closeMinutes, windowMinutes) {
  if (!Array.isArray(sessionCandles) || sessionCandles.length === 0) return null
  const start = closeMinutes - windowMinutes
  const windowCandles = sessionCandles.filter((candle) => candle.minutes >= start)
  if (windowCandles.length < 2) return null
  const volumes = windowCandles
    .map((candle) => parseNumber(candle.volume))
    .filter((value) => Number.isFinite(value))
  if (volumes.length < 2) return null
  return volumes.reduce((sum, value) => sum + value, 0)
}

function resolveProfileMarketCap(profile) {
  if (!profile || typeof profile !== "object") return null
  return (
    parseNumber(profile.mktCap) ??
    parseNumber(profile.marketCap) ??
    parseNumber(profile.marketCapitalization) ??
    parseNumber(profile.marketCapUsd) ??
    null
  )
}

function resolveProfileFloatShares(profile) {
  if (!profile || typeof profile !== "object") return null
  return (
    parseNumber(profile.sharesFloat) ??
    parseNumber(profile.float) ??
    parseNumber(profile.floatShares) ??
    parseNumber(profile.freeFloat) ??
    null
  )
}

function resolveProfileSharesOutstanding(profile) {
  if (!profile || typeof profile !== "object") return null
  return (
    parseNumber(profile.sharesOutstanding) ??
    parseNumber(profile.sharesOut) ??
    parseNumber(profile.shares) ??
    null
  )
}

function buildSwingAnalysis(metrics) {
  if (!metrics) return null
  const rangePct = Number((metrics.rangePosition * 100).toFixed(1))
  const maxRangePct = Math.round(SWING_RULES.rangePositionMax * 100)
  const details = [
    `Swing trend: price above MA${SWING_RULES.maShort}/MA${SWING_RULES.maLong} and MA${SWING_RULES.maShort} rising.`,
    `Entry window: last ${SWING_RULES.entryWindowMinutes}m before close.`,
    `Pullback window: range position ${rangePct}% (<= ${maxRangePct}%).`,
    `Late volume: last ${SWING_RULES.volumeWindowMinutes}m ${formatCompactNumber(
      metrics.last60mVolume
    )} vs ${SWING_RULES.volumeLookbackSessions}d avg ${formatCompactNumber(
      metrics.avgLast60mVolume
    )}.`,
    `Distribution days (${SWING_RULES.distributionLookback}d): ${metrics.distributionDays} (max ${SWING_RULES.distributionMax}).`,
    `Exit plan: +${SWING_RULES.profitTriggerPct}% pop by ${SWING_RULES.exitWindowMinutes}m, else exit by 12:00 ET or MA${SWING_RULES.maShort} - ${SWING_RULES.stopAtrMult} ATR.`,
  ]
  return {
    summary: "BUY signal · swing overnight.",
    details,
  }
}

function buildPrebreakoutAnalysis(metrics) {
  if (!metrics) return null
  const rangePct = Number((metrics.rangePosition * 100).toFixed(1))
  const turnoverPct = Number(metrics.turnoverPct.toFixed(1))
  const rvol = Number(metrics.rvol.toFixed(2))
  const atrPct = Number(metrics.atrPct.toFixed(2))
  const runUpPct = Number(metrics.runUpPct.toFixed(1))
  const details = [
    `Microcap gate: market cap $${formatCompactNumber(metrics.marketCap)} and float ${formatCompactNumber(metrics.floatShares)}.`,
    `Turnover: ${turnoverPct}% (target ${PREBREAKOUT_RULES.turnoverMinPct}-${PREBREAKOUT_RULES.turnoverMaxPct}%).`,
    `RVOL: ${rvol}x (avg ${formatCompactNumber(metrics.avgVolume)}).`,
    `Close near high: ${rangePct}% of range (min ${Math.round(PREBREAKOUT_RULES.closeNearHighMin * 100)}%).`,
    `Run-up check: ${formatSignedPercent(runUpPct)} over ${PREBREAKOUT_RULES.runUpLookback}d (max +${PREBREAKOUT_RULES.maxRunUpPct}%).`,
    `Base + lift: MA${PREBREAKOUT_RULES.maShort} slope ${metrics.ma20Slope.toFixed(4)}, ATR% ${atrPct} (<= ${Math.round(PREBREAKOUT_RULES.atrPctMax * 100)}%).`,
    `Narrative saturation: ${metrics.newsCount} headlines (max ${PREBREAKOUT_RULES.newsMaxCount}).`,
    `Entry timing: 15:55 ET (last 5m close).`,
    `Exit plan: +${PREBREAKOUT_RULES.profitTriggerPct}% pop by ${PREBREAKOUT_RULES.exitWindowMinutes}m, else exit by 11:30 ET, stop ${PREBREAKOUT_RULES.stopAtrMult} ATR.`,
  ]
  return {
    summary: "BUY signal · pre-breakout watch.",
    details,
  }
}

async function buildSwingOvernight({
  candidates,
  universe,
  trendingByHorizon,
  asOf,
}) {
  const entryWindow = resolveSwingEntryWindow(asOf)
  const baseMeta = {
    runId: activeRunId || null,
    asOf: asOf.toISOString(),
    status: entryWindow.status,
    entryWindow: entryWindow.entryWindow,
    sessionClose: entryWindow.entryWindow?.close,
  }

  const symbolSet = new Set()
  const originMap = new Map()
  const addOrigin = (symbol, origin) => {
    if (!symbol || !origin) return
    const existing = originMap.get(symbol) || []
    originMap.set(symbol, mergeOrigins(existing, [origin]))
  }
  const watchlist = Array.isArray(universe?.stocks?.symbols) ? universe.stocks.symbols : []
  watchlist.forEach((symbol) => {
    const normalized = normalizeTicker(symbol)
    if (!normalized || isTsxSymbol(normalized)) return
    symbolSet.add(normalized)
    addOrigin(normalized, "user_universe")
  })
  const trendingStocks = trendingByHorizon?.["24h"]?.stock || []
  trendingStocks.forEach((item) => {
    const normalized = normalizeTicker(item?.symbol)
    if (!normalized || isTsxSymbol(normalized)) return
    symbolSet.add(normalized)
    addOrigin(normalized, "trending")
  })
  const symbols = Array.from(symbolSet)

  const candidateMap = new Map()
  if (Array.isArray(candidates)) {
    candidates
      .filter((candidate) => candidate?.assetClass === "stock")
      .forEach((candidate) => {
        const key = normalizeTicker(candidate.symbol)
        if (key) candidateMap.set(key, candidate)
      })
  }

  if (!entryWindow.active) {
    return {
      items: [],
      meta: { ...baseMeta, totalSymbols: symbols.length },
    }
  }

  const items = await mapWithConcurrency(symbols, 4, async (symbol) => {
    const dailyCandles = await fetchFmpCandles(symbol, "stock", "1day", 80)
    const intradayCandles = await fetchFmpCandles(symbol, "stock", "30min", 500)
    if (dailyCandles.length === 0 || intradayCandles.length === 0) return null

    const todayKey = entryWindow.dateKey
    const daily = dailyCandles
      .map((candle) => ({
        ...candle,
        dateKey: getEtDateKey(new Date(candle.time)),
      }))
      .sort((a, b) => a.time - b.time)
    const cleanedDaily =
      daily.length > 0 && daily[daily.length - 1].dateKey === todayKey
        ? daily.slice(0, -1)
        : daily
    if (cleanedDaily.length < SWING_RULES.maLong + SWING_RULES.maSlopeLookback) {
      return null
    }
    const closes = cleanedDaily.map((candle) => candle.close).filter(Number.isFinite)
    const volumes = cleanedDaily.map((candle) => candle.volume).filter(Number.isFinite)
    if (closes.length < SWING_RULES.maLong || volumes.length < SWING_RULES.maShort) {
      return null
    }
    const ma20 = computeSma(closes, SWING_RULES.maShort)
    const ma50 = computeSma(closes, SWING_RULES.maLong)
    const ma20Prev = computeSma(
      closes.slice(0, closes.length - SWING_RULES.maSlopeLookback),
      SWING_RULES.maShort
    )
    if (!ma20 || !ma50 || !ma20Prev) return null

    const atr14 = computeAtr(cleanedDaily, 14)
    if (!atr14) return null

    const avgVolume20 = computeSma(volumes, SWING_RULES.maShort)
    if (!avgVolume20) return null

    const distributionStart = cleanedDaily.length - (SWING_RULES.distributionLookback + 1)
    if (distributionStart < 0) return null
    let distributionDays = 0
    for (let i = distributionStart + 1; i < cleanedDaily.length; i += 1) {
      const prev = cleanedDaily[i - 1]
      const day = cleanedDaily[i]
      if (!prev || !day) continue
      if (!Number.isFinite(day.volume) || !Number.isFinite(prev.close)) continue
      if (day.close < prev.close && day.volume >= avgVolume20 * 1.5) {
        distributionDays += 1
      }
    }

    const sessions = groupStockIntradaySessions(intradayCandles)
    const todaySession = sessions.get(todayKey)
    if (!todaySession || todaySession.length === 0) return null

    const todayHigh = Math.max(...todaySession.map((candle) => candle.high || 0))
    const todayLow = Math.min(...todaySession.map((candle) => candle.low || Infinity))
    if (!Number.isFinite(todayHigh) || !Number.isFinite(todayLow) || todayHigh <= todayLow) {
      return null
    }

    const lastCandle = todaySession[todaySession.length - 1]
    const lastPrice = parseNumber(lastCandle?.close)
    if (!Number.isFinite(lastPrice)) return null

    const last60mVolume = computeLastWindowVolume(
      todaySession,
      entryWindow.closeMinutes,
      SWING_RULES.volumeWindowMinutes
    )
    if (!last60mVolume) return null

    const priorSessionKeys = Array.from(sessions.keys())
      .filter((key) => key < todayKey)
      .sort()
      .slice(-SWING_RULES.volumeLookbackSessions)
    if (priorSessionKeys.length < SWING_RULES.volumeLookbackSessions) return null

    const priorVolumes = []
    for (const key of priorSessionKeys) {
      const session = sessions.get(key)
      const closeMinutes = resolveStockSessionCloseMinutes(key)
      const volume = computeLastWindowVolume(session, closeMinutes, SWING_RULES.volumeWindowMinutes)
      if (!volume) return null
      priorVolumes.push(volume)
    }
    const avgLast60mVolume =
      priorVolumes.length > 0
        ? priorVolumes.reduce((sum, value) => sum + value, 0) / priorVolumes.length
        : null
    if (!avgLast60mVolume) return null

    const rangePosition = (lastPrice - todayLow) / (todayHigh - todayLow)
    if (!Number.isFinite(rangePosition)) return null

    const notExtended =
      lastPrice <= ma20 + SWING_RULES.notExtendedAtrMult * atr14
    if (
      lastPrice <= ma20 ||
      lastPrice <= ma50 ||
      ma20 <= ma20Prev ||
      distributionDays > SWING_RULES.distributionMax ||
      rangePosition > SWING_RULES.rangePositionMax ||
      last60mVolume >= avgLast60mVolume ||
      !notExtended
    ) {
      return null
    }

    const pullbackScore = clamp(
      1 - rangePosition / SWING_RULES.rangePositionMax,
      0,
      1
    )
    const volumeScore = clamp(1 - last60mVolume / avgLast60mVolume, 0, 1)
    const distributionScore = clamp(
      1 - distributionDays / Math.max(1, SWING_RULES.distributionMax),
      0,
      1
    )
    const trendScore = clamp((ma20 - ma50) / ma50, 0, 0.05) / 0.05
    const score =
      (pullbackScore * 0.45 +
        volumeScore * 0.2 +
        distributionScore * 0.15 +
        trendScore * 0.2) *
      100

    const candidate = candidateMap.get(symbol)
    const change24h =
      typeof candidate?.change24h === "number" && Number.isFinite(candidate.change24h)
        ? candidate.change24h
        : cleanedDaily.length > 1 && cleanedDaily[cleanedDaily.length - 1]?.close
          ? ((lastPrice - cleanedDaily[cleanedDaily.length - 1].close) /
              cleanedDaily[cleanedDaily.length - 1].close) *
            100
          : undefined

    const swingInputs = {
      ma20: Number(ma20.toFixed(4)),
      ma50: Number(ma50.toFixed(4)),
      ma20Slope: Number((ma20 - ma20Prev).toFixed(4)),
      atr14: Number(atr14.toFixed(4)),
      distributionDays10: distributionDays,
      rangePosition: Number(rangePosition.toFixed(4)),
      todayHigh: Number(todayHigh.toFixed(4)),
      todayLow: Number(todayLow.toFixed(4)),
      lastPrice: Number(lastPrice.toFixed(4)),
      last60mVolume: Math.round(last60mVolume),
      avgLast60mVolume: Math.round(avgLast60mVolume),
    }

    const reasons = [
      "trend_above_ma",
      "ma20_slope_up",
      "pullback_near_lows",
      "late_volume_below_avg",
      "distribution_ok",
      "not_extended",
    ]

    const analysis = buildSwingAnalysis({
      ...swingInputs,
      last60mVolume,
      avgLast60mVolume,
      distributionDays,
      rangePosition,
    })

    const mergedOrigins = mergeOrigins(candidate?.origins, originMap.get(symbol))
    const resolvedOrigins = normalizeOrigins(mergedOrigins)
    const chartSymbol = normalizeSymbolForCharting(symbol, "stock")
    return compactObject({
      assetClass: "stock",
      symbol: chartSymbol || symbol,
      name: candidate?.name || symbol,
      exchange: candidate?.exchange,
      price: Number(lastPrice.toFixed(4)),
      timeframe: "1d",
      side: "buy",
      profile: "swing_overnight",
      score: Number(score.toFixed(2)),
      confidence: Number((score / 100).toFixed(2)),
      momentum:
        typeof change24h === "number"
          ? { change24h: Number(change24h.toFixed(2)) }
          : undefined,
      primary: candidate?.primary ? true : undefined,
      origins: resolvedOrigins.length > 0 ? resolvedOrigins : undefined,
      source: candidate?.source || "swing_overnight",
      analysis,
      swing: {
        asOfTs: asOf.toISOString(),
        inputs: swingInputs,
        reasons,
        entryWindow: entryWindow.entryWindow,
        exitPlan: {
          profitTriggerPct: SWING_RULES.profitTriggerPct,
          morningWindowMinutes: SWING_RULES.exitWindowMinutes,
          timeExit: "12:00 ET",
          stopAtrMult: SWING_RULES.stopAtrMult,
          stopType: "ma20_atr",
        },
      },
    })
  })

  const filtered = items.filter(Boolean)
  filtered.sort((a, b) => (b.score || 0) - (a.score || 0))
  const limited = filtered.slice(0, Math.max(1, config.hotTradesLimit))
  const originBreakdown = summarizeOrigins(limited)

  return {
    items: limited,
    meta: {
      ...baseMeta,
      totalSymbols: symbols.length,
      count: limited.length,
      origins: originBreakdown,
    },
  }
}

async function buildPrebreakout({
  candidates,
  universe,
  trendingByHorizon,
  newsScoreMap,
  botSignals,
  asOf,
}) {
  const entryWindow = resolvePrebreakoutEntryWindow(asOf)
  const baseMeta = {
    runId: activeRunId || null,
    asOf: asOf.toISOString(),
    status: entryWindow.status,
    entryWindow: entryWindow.entryWindow,
    sessionClose: entryWindow.entryWindow?.close,
  }

  const symbolSet = new Set()
  const originMap = new Map()
  const addOrigin = (symbol, origin) => {
    if (!symbol || !origin) return
    const existing = originMap.get(symbol) || []
    originMap.set(symbol, mergeOrigins(existing, [origin]))
  }
  const watchlist = Array.isArray(universe?.stocks?.symbols) ? universe.stocks.symbols : []
  watchlist.forEach((symbol) => {
    const normalized = normalizeTicker(symbol)
    if (!normalized || isTsxSymbol(normalized)) return
    symbolSet.add(normalized)
    addOrigin(normalized, "user_universe")
  })
  const trendingStocks = trendingByHorizon?.["24h"]?.stock || []
  trendingStocks.forEach((item) => {
    const normalized = normalizeTicker(item?.symbol)
    if (!normalized || isTsxSymbol(normalized)) return
    symbolSet.add(normalized)
    addOrigin(normalized, "trending")
  })
  const symbols = Array.from(symbolSet)

  const candidateMap = new Map()
  if (Array.isArray(candidates)) {
    candidates
      .filter((candidate) => candidate?.assetClass === "stock")
      .forEach((candidate) => {
        const key = normalizeTicker(candidate.symbol)
        if (key) candidateMap.set(key, candidate)
      })
  }

  if (!entryWindow.active) {
    return {
      items: [],
      meta: { ...baseMeta, totalSymbols: symbols.length },
    }
  }

  const items = await mapWithConcurrency(symbols, 4, async (symbol) => {
    const profile = await fetchFmpProfile(symbol)
    const marketCap = resolveProfileMarketCap(profile)
    const floatShares = resolveProfileFloatShares(profile)
    if (
      !Number.isFinite(marketCap) ||
      marketCap < PREBREAKOUT_RULES.minMarketCap ||
      marketCap > PREBREAKOUT_RULES.maxMarketCap
    ) {
      return null
    }
    if (
      !Number.isFinite(floatShares) ||
      floatShares <= 0 ||
      floatShares > PREBREAKOUT_RULES.maxFloatShares
    ) {
      return null
    }

    const dailyCandles = await fetchFmpCandles(symbol, "stock", "1day", 90)
    const intradayCandles = await fetchFmpCandles(symbol, "stock", "5min", 200)
    if (dailyCandles.length === 0 || intradayCandles.length === 0) return null

    const todayKey = entryWindow.dateKey
    const daily = dailyCandles
      .map((candle) => ({
        ...candle,
        dateKey: getEtDateKey(new Date(candle.time)),
      }))
      .sort((a, b) => a.time - b.time)
    const cleanedDaily =
      daily.length > 0 && daily[daily.length - 1].dateKey === todayKey
        ? daily.slice(0, -1)
        : daily
    if (cleanedDaily.length < PREBREAKOUT_RULES.maLong + PREBREAKOUT_RULES.maSlopeLookback) {
      return null
    }

    const closes = cleanedDaily.map((candle) => candle.close).filter(Number.isFinite)
    const volumes = cleanedDaily.map((candle) => candle.volume).filter(Number.isFinite)
    if (closes.length < PREBREAKOUT_RULES.maLong || volumes.length < PREBREAKOUT_RULES.volumeLookbackSessions) {
      return null
    }

    const ma20 = computeSma(closes, PREBREAKOUT_RULES.maShort)
    const ma50 = computeSma(closes, PREBREAKOUT_RULES.maLong)
    const ma20Prev = computeSma(
      closes.slice(0, closes.length - PREBREAKOUT_RULES.maSlopeLookback),
      PREBREAKOUT_RULES.maShort
    )
    if (!ma20 || !ma50 || !ma20Prev) return null

    const atr14 = computeAtr(cleanedDaily, 14)
    if (!atr14) return null
    const atrPct = (atr14 / closes[closes.length - 1]) * 100

    const sessions = groupStockIntradaySessions(intradayCandles)
    const todaySession = sessions.get(todayKey)
    if (!todaySession || todaySession.length === 0) return null

    const todayHigh = Math.max(...todaySession.map((candle) => candle.high || 0))
    const todayLow = Math.min(...todaySession.map((candle) => candle.low || Infinity))
    if (!Number.isFinite(todayHigh) || !Number.isFinite(todayLow) || todayHigh <= todayLow) {
      return null
    }

    const lastCandle = todaySession[todaySession.length - 1]
    const lastPrice = parseNumber(lastCandle?.close)
    if (!Number.isFinite(lastPrice)) return null

    const todayVolume = computeSessionVolume(todaySession)
    if (!todayVolume) return null

    const recentVolumes = volumes.slice(-PREBREAKOUT_RULES.volumeLookbackSessions)
    const avgVolume =
      recentVolumes.length > 0
        ? recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length
        : null
    if (!avgVolume) return null

    const rvol = todayVolume / avgVolume
    const turnoverPct = (todayVolume / floatShares) * 100
    const rangePosition = (lastPrice - todayLow) / (todayHigh - todayLow)
    if (!Number.isFinite(rangePosition)) return null

    const lookbackIndex = cleanedDaily.length - PREBREAKOUT_RULES.runUpLookback - 1
    if (lookbackIndex < 0) return null
    const baseClose = cleanedDaily[lookbackIndex]?.close
    if (!baseClose) return null
    const runUpPct = ((lastPrice - baseClose) / baseClose) * 100

    const newsKey = getAssetKey("stock", symbol)
    const newsItem = newsKey ? newsScoreMap?.get(newsKey) : null
    const newsCount = Math.max(0, parseNumber(newsItem?.count) || 0)

    const ma20Slope = ma20 - ma20Prev
    const maAlignment = ma20 / ma50
    const closeNearHigh = rangePosition >= PREBREAKOUT_RULES.closeNearHighMin

    if (
      rvol < PREBREAKOUT_RULES.rvolMin ||
      rvol > PREBREAKOUT_RULES.rvolMax ||
      turnoverPct < PREBREAKOUT_RULES.turnoverMinPct ||
      turnoverPct > PREBREAKOUT_RULES.turnoverMaxPct ||
      !closeNearHigh ||
      runUpPct > PREBREAKOUT_RULES.maxRunUpPct ||
      newsCount > PREBREAKOUT_RULES.newsMaxCount ||
      ma20Slope <= 0 ||
      maAlignment < PREBREAKOUT_RULES.maAlignmentMin ||
      maAlignment > PREBREAKOUT_RULES.maAlignmentMax ||
      atrPct > PREBREAKOUT_RULES.atrPctMax * 100
    ) {
      return null
    }

    const rvolScore = clamp(
      (rvol - PREBREAKOUT_RULES.rvolMin) /
        (PREBREAKOUT_RULES.rvolMax - PREBREAKOUT_RULES.rvolMin),
      0,
      1
    )
    const closeScore = clamp(
      (rangePosition - PREBREAKOUT_RULES.closeNearHighMin) /
        (1 - PREBREAKOUT_RULES.closeNearHighMin),
      0,
      1
    )
    const turnoverScore = clamp(
      (turnoverPct - PREBREAKOUT_RULES.turnoverMinPct) /
        (PREBREAKOUT_RULES.turnoverMaxPct - PREBREAKOUT_RULES.turnoverMinPct),
      0,
      1
    )
    const maScore = clamp((ma20 - ma50) / ma50, 0, 0.05) / 0.05
    const atrScore = clamp(1 - atrPct / (PREBREAKOUT_RULES.atrPctMax * 100), 0, 1)
    const runUpScore = clamp(1 - runUpPct / PREBREAKOUT_RULES.maxRunUpPct, 0, 1)
    const newsScore = clamp(1 - newsCount / PREBREAKOUT_RULES.newsMaxCount, 0, 1)

    const signalData = newsKey ? botSignals?.get(newsKey) : null
    const botScore =
      signalData && signalData.weightedTotal
        ? clamp(
          (signalData.weightedBuy - signalData.weightedSell) /
            Math.max(1, signalData.weightedTotal),
          0,
          1
        )
        : 0

    const score =
      (rvolScore * 0.22 +
        closeScore * 0.2 +
        turnoverScore * 0.16 +
        maScore * 0.12 +
        atrScore * 0.1 +
        runUpScore * 0.1 +
        newsScore * 0.05 +
        botScore * 0.05) *
      100

    const candidate = candidateMap.get(symbol)
    const change24h =
      typeof candidate?.change24h === "number" && Number.isFinite(candidate.change24h)
        ? candidate.change24h
        : cleanedDaily.length > 1 && cleanedDaily[cleanedDaily.length - 1]?.close
          ? ((lastPrice - cleanedDaily[cleanedDaily.length - 1].close) /
              cleanedDaily[cleanedDaily.length - 1].close) *
            100
          : undefined

    const prebreakoutInputs = {
      marketCap: Math.round(marketCap),
      floatShares: Math.round(floatShares),
      turnoverPct: Number(turnoverPct.toFixed(2)),
      rvol: Number(rvol.toFixed(2)),
      rangePosition: Number(rangePosition.toFixed(4)),
      runUpPct: Number(runUpPct.toFixed(2)),
      ma20: Number(ma20.toFixed(4)),
      ma50: Number(ma50.toFixed(4)),
      ma20Slope: Number(ma20Slope.toFixed(4)),
      atr14: Number(atr14.toFixed(4)),
      atrPct: Number(atrPct.toFixed(2)),
      todayVolume: Math.round(todayVolume),
      avgVolume: Math.round(avgVolume),
      newsCount,
      lastPrice: Number(lastPrice.toFixed(4)),
      todayHigh: Number(todayHigh.toFixed(4)),
      todayLow: Number(todayLow.toFixed(4)),
    }

    const reasons = [
      "microcap_float",
      "rvol_in_range",
      "turnover_ok",
      "close_near_high",
      "runup_ok",
      "base_and_lift",
      "atr_contracted",
      "news_light",
    ]

    const analysis = buildPrebreakoutAnalysis({
      marketCap,
      floatShares,
      turnoverPct,
      rvol,
      avgVolume,
      rangePosition,
      runUpPct,
      ma20Slope,
      atrPct,
      newsCount,
    })

    const mergedOrigins = mergeOrigins(candidate?.origins, originMap.get(symbol))
    const resolvedOrigins = normalizeOrigins(mergedOrigins)
    const chartSymbol = normalizeSymbolForCharting(symbol, "stock")
    return compactObject({
      assetClass: "stock",
      symbol: chartSymbol || symbol,
      name: candidate?.name || symbol,
      exchange: candidate?.exchange,
      price: Number(lastPrice.toFixed(4)),
      timeframe: "1d",
      side: "buy",
      profile: "prebreakout",
      score: Number(score.toFixed(2)),
      confidence: Number((score / 100).toFixed(2)),
      momentum:
        typeof change24h === "number"
          ? { change24h: Number(change24h.toFixed(2)) }
          : undefined,
      signals:
        signalData && (signalData.total || signalData.weightedTotal)
          ? {
              total: signalData.total,
              buy: signalData.buy,
              sell: signalData.sell,
              strengthAvg:
                signalData.weightedTotal > 0
                  ? Number((signalData.weightedStrengthSum / signalData.weightedTotal).toFixed(2))
                  : undefined,
              bots: Array.from(signalData.bots || []),
            }
          : undefined,
      primary: candidate?.primary ? true : undefined,
      origins: resolvedOrigins.length > 0 ? resolvedOrigins : undefined,
      source: candidate?.source || "prebreakout",
      analysis,
      prebreakout: {
        asOfTs: asOf.toISOString(),
        inputs: prebreakoutInputs,
        reasons,
        entryWindow: entryWindow.entryWindow,
        exitPlan: {
          profitTriggerPct: PREBREAKOUT_RULES.profitTriggerPct,
          morningWindowMinutes: PREBREAKOUT_RULES.exitWindowMinutes,
          timeExit: "11:30 ET",
          stopAtrMult: PREBREAKOUT_RULES.stopAtrMult,
          stopType: "atr",
        },
      },
    })
  })

  const filtered = items.filter(Boolean)
  filtered.sort((a, b) => (b.score || 0) - (a.score || 0))
  const limited = filtered.slice(0, Math.max(1, config.hotTradesLimit))
  const originBreakdown = summarizeOrigins(limited)

  return {
    items: limited,
    meta: {
      ...baseMeta,
      totalSymbols: symbols.length,
      count: limited.length,
      origins: originBreakdown,
    },
  }
}

function buildActionBoard(hotTrades, newsScoreMap, limit) {
  const cap = Number.isFinite(limit) ? Math.max(1, limit) : 10
  const newsWeight = 0

  const scoreTradeForAction = (trade) => {
    return typeof trade.score === "number" ? trade.score : 0
  }

  const rankList = (list) =>
    [...list].sort((a, b) => scoreTradeForAction(b) - scoreTradeForAction(a))

  const buildPerClass = (list) => {
    const buckets = { crypto: [], stock: [], forex: [] }
    list.forEach((item) => {
      if (buckets[item.assetClass]) buckets[item.assetClass].push(item)
    })

    return {
      crypto: rankList(buckets.crypto).slice(0, cap),
      stock: rankList(buckets.stock).slice(0, cap),
      forex: rankList(buckets.forex).slice(0, cap),
    }
  }

  const buyList = hotTrades.filter((trade) => trade.side === "buy")
  const sellList = hotTrades.filter((trade) => trade.side === "sell")

  const buys = rankList(buyList).slice(0, cap)
  const sells = rankList(sellList).slice(0, cap)
  const byAsset = {
    buys: buildPerClass(buyList),
    sells: buildPerClass(sellList),
  }

  const allPicks = [
    ...byAsset.buys.crypto,
    ...byAsset.buys.stock,
    ...byAsset.buys.forex,
    ...byAsset.sells.crypto,
    ...byAsset.sells.stock,
    ...byAsset.sells.forex,
  ]

  return { buys, sells, byAsset, allPicks, newsWeight, classLimit: cap }
}

function buildTrendLookup(byHorizon, horizon) {
  const resolved = TREND_HORIZONS.includes(horizon) ? horizon : TREND_HORIZONS[0]
  const buckets = byHorizon?.[resolved] || {}
  const lookup = new Map()
  Object.values(buckets).forEach((list) => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      const key = getAssetKey(item.assetClass, item.symbol)
      if (key) lookup.set(key, item)
    })
  })
  return { lookup, horizon: resolved }
}

function formatNumber(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  return value.toFixed(digits)
}

function formatSignedPercent(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}%`
}

function formatAiSnippet(text, max = 90) {
  if (!text) return "note unavailable"
  const cleaned = String(text).replace(/\s+/g, " ").trim()
  if (!cleaned) return "note unavailable"
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 3)}...`
}

function joinList(items) {
  const list = items.filter(Boolean)
  if (list.length === 0) return ""
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`
}

function describeComponentStrength(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a"
  if (value >= 70) return "strong"
  if (value >= 40) return "moderate"
  if (value >= 15) return "light"
  if (value > 0) return "weak"
  return "none"
}

function buildScoreDriversLine(components) {
  if (!components) return null
  const entries = [
    { key: "momentum", label: "momentum", value: components.momentum },
    { key: "consensus", label: "bot consensus", value: components.consensus },
    { key: "liquidity", label: "liquidity", value: components.liquidity },
    { key: "news", label: "news sentiment", value: components.news },
    { key: "universe", label: "universe boost", value: components.universe },
  ]
  const penalties = components.penalties || {}
  const penaltyEntries = [
    { key: "spread", label: "spread", value: penalties.spread },
    { key: "liquidity", label: "liquidity", value: penalties.liquidity },
    { key: "price", label: "price", value: penalties.price },
    { key: "volume", label: "volume", value: penalties.volume },
    { key: "sentiment", label: "sentiment", value: penalties.sentiment },
  ]
    .filter((entry) => typeof entry.value === "number" && entry.value < 0)
    .sort((a, b) => a.value - b.value)
  const drivers = entries
    .filter((entry) => typeof entry.value === "number" && entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((entry) => entry.label)
  const penaltiesLabel = penaltyEntries.slice(0, 2).map((entry) => entry.label)
  if (drivers.length === 0 && penaltiesLabel.length === 0) {
    return "Score is driven mostly by limited data."
  }
  if (drivers.length === 0) {
    return `Score is muted by penalties: ${joinList(penaltiesLabel)}.`
  }
  const penaltiesLine =
    penaltiesLabel.length > 0 ? ` Penalties: ${joinList(penaltiesLabel)}.` : ""
  return `Top drivers: ${joinList(drivers)}.${penaltiesLine}`
}

function describeConfidence(confidence, totalSignals) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return null
  const pct = Math.round(confidence * 100)
  const label = pct >= 70 ? "high" : pct >= 40 ? "medium" : "low"
  const basis =
    typeof totalSignals === "number" && totalSignals > 0
      ? ` based on ${totalSignals} recent signals`
      : ""
  return `Confidence: ${label} (${pct}%)${basis}.`
}

function buildScoreBreakdown(components, totalScore) {
  if (!components || typeof totalScore !== "number") return null
  const parts = []
  if (typeof components.momentum === "number") {
    parts.push(`momentum ${formatNumber(components.momentum, 1)}`)
  }
  if (typeof components.consensus === "number") {
    parts.push(`consensus ${formatNumber(components.consensus, 1)}`)
  }
  if (typeof components.liquidity === "number") {
    parts.push(`liquidity ${formatNumber(components.liquidity, 1)}`)
  }
  if (typeof components.news === "number") {
    parts.push(`news ${formatNumber(components.news, 1)}`)
  }
  if (typeof components.universe === "number") {
    parts.push(`universe ${formatNumber(components.universe, 1)}`)
  }
  if (typeof components.analyst === "number" && components.analyst !== 0) {
    parts.push(`analyst ${formatNumber(components.analyst, 1)}`)
  }
  const penalties = components.penalties || {}
  if (typeof penalties.spread === "number" && penalties.spread !== 0) {
    parts.push(`spread penalty ${formatNumber(penalties.spread, 1)}`)
  }
  if (typeof penalties.liquidity === "number" && penalties.liquidity !== 0) {
    parts.push(`liquidity penalty ${formatNumber(penalties.liquidity, 1)}`)
  }
  if (typeof penalties.price === "number" && penalties.price !== 0) {
    parts.push(`price penalty ${formatNumber(penalties.price, 1)}`)
  }
  if (typeof penalties.volume === "number" && penalties.volume !== 0) {
    parts.push(`volume penalty ${formatNumber(penalties.volume, 1)}`)
  }
  if (typeof penalties.sentiment === "number" && penalties.sentiment !== 0) {
    parts.push(`sentiment penalty ${formatNumber(penalties.sentiment, 1)}`)
  }
  if (!parts.length) return null
  return `Score model: ${parts.join(" + ")} = ${formatNumber(totalScore, 1)}.`
}

function buildTradeAnalysis(trade, trendItem, newsItem, options) {
  const details = []
  const summaryBits = []
  const sideLabel = trade.side ? trade.side.toUpperCase() : "TRADE"
  const momentum = trade.momentum || {}

  const summaryMoves = []
  if (typeof momentum.change1m === "number") {
    summaryMoves.push(`1m ${formatSignedPercent(momentum.change1m)}`)
  }
  if (typeof momentum.change5m === "number") {
    summaryMoves.push(`5m ${formatSignedPercent(momentum.change5m)}`)
  }
  if (typeof momentum.change15m === "number") {
    summaryMoves.push(`15m ${formatSignedPercent(momentum.change15m)}`)
  }
  if (summaryMoves.length > 0) {
    summaryBits.push(summaryMoves.join(" · "))
  } else if (typeof momentum.change24h === "number") {
    summaryBits.push(`24h ${formatSignedPercent(momentum.change24h)}`)
  }
  if (trade.signals?.total) {
    const buy = trade.signals.buy ?? 0
    const sell = trade.signals.sell ?? 0
    summaryBits.push(`bots ${buy}/${sell}`)
  }
  if (typeof trade.score === "number") {
    summaryBits.push(`score ${formatNumber(trade.score, 0)}`)
  }

  const summary =
    summaryBits.length > 0
      ? `${sideLabel} signal · ${summaryBits.join(" · ")}.`
      : `${sideLabel} signal.`

  if (typeof trade.score === "number") {
    const profileLabel = trade.profile ? ` (${trade.profile})` : ""
    details.push(`Score: ${formatNumber(trade.score, 1)}/100${profileLabel}.`)
  }

  const momentumParts = []
  if (typeof momentum.change1m === "number") {
    momentumParts.push(`1m ${formatSignedPercent(momentum.change1m)}`)
  }
  if (typeof momentum.change5m === "number") {
    momentumParts.push(`5m ${formatSignedPercent(momentum.change5m)}`)
  }
  if (typeof momentum.change15m === "number") {
    momentumParts.push(`15m ${formatSignedPercent(momentum.change15m)}`)
  }
  if (typeof momentum.change1h === "number") {
    momentumParts.push(`1h ${formatSignedPercent(momentum.change1h)}`)
  }
  if (typeof momentum.change24h === "number") {
    momentumParts.push(`24h ${formatSignedPercent(momentum.change24h)}`)
  }
  if (typeof momentum.change7d === "number") {
    momentumParts.push(`7d ${formatSignedPercent(momentum.change7d)}`)
  }
  if (momentumParts.length) {
    details.push(`Momentum: ${momentumParts.join(", ")}.`)
  } else {
    details.push("Momentum: not available.")
  }

  if (trade.signals?.total) {
    const totalSignals = trade.signals.total
    const buy = trade.signals.buy ?? 0
    const sell = trade.signals.sell ?? 0
    const bias =
      buy === sell ? "mixed" : buy > sell ? "leaning buy" : "leaning sell"
    const strength =
      typeof trade.signals.strengthAvg === "number"
        ? ` Avg strength ${formatNumber(trade.signals.strengthAvg, 2)}.`
        : ""
    const recent =
      typeof trade.signals.recent === "number" &&
      Number.isFinite(options.signalRecentMinutes) &&
      Number.isFinite(options.signalMinRecent)
        ? ` Recent ${trade.signals.recent} in ${options.signalRecentMinutes}m (min ${options.signalMinRecent}).`
        : ""
    details.push(
      `Bots: ${totalSignals} signals (${buy} buy, ${sell} sell), ${bias}.${strength}${recent}`
    )
  } else {
    details.push(`Bots: no signals in the last ${options.signalLookbackMinutes} minutes.`)
  }

  const driversLine = buildScoreDriversLine(trade.scoreComponents)
  if (driversLine) details.push(driversLine)

  if (
    options.accuracySummary?.hitRate !== undefined &&
    options.accuracySummary?.count >= options.minAccuracySignals
  ) {
    details.push(
      `Bot consensus is weighted by recent ${options.accuracyHorizon} accuracy (${formatNumber(
        options.accuracySummary.hitRate,
        1
      )}% hit rate).`
    )
  }

  const confidenceLine = describeConfidence(trade.confidence, trade.signals?.total)
  if (confidenceLine) details.push(confidenceLine)

  if (trendItem) {
    const components = trendItem.scoreComponents || trendItem.components || {}
    details.push(
      `Trend check (${options.trendHorizon}): ${formatNumber(trendItem.score, 1)}/100.`
    )
    details.push(
      `Trend drivers: momentum ${describeComponentStrength(
        components.momentum
      )}, consensus ${describeComponentStrength(
        components.consensus
      )}, liquidity ${describeComponentStrength(
        components.liquidity
      )}, and news ${describeComponentStrength(components.news)}.`
    )
    const penalties = components.penalties || {}
    const penaltyBits = []
    if (penalties.spread) penaltyBits.push("spread")
    if (penalties.liquidity) penaltyBits.push("liquidity")
    if (penalties.price) penaltyBits.push("price")
    if (penalties.volume) penaltyBits.push("volume")
    if (penalties.sentiment) penaltyBits.push("sentiment")
    if (penaltyBits.length > 0) {
      details.push(`Trend penalties: ${joinList(penaltyBits)}.`)
    }
  } else {
    details.push(`Trend check (${options.trendHorizon}): no data yet.`)
  }

  if (newsItem) {
    details.push(
      `News sentiment: ${formatNumber(newsItem.sentiment, 2)} from ${newsItem.count ?? 0} headlines.`
    )
  } else {
    details.push("News sentiment: no recent headlines, so no sentiment boost.")
  }

  const scoreBreakdown = buildScoreBreakdown(trade.scoreComponents, trade.score)
  if (scoreBreakdown) details.push(scoreBreakdown)

  if (trade.recommendation) {
    const rec = trade.recommendation
    const hold = typeof rec.holdMinutes === "number" ? `${rec.holdMinutes}m` : "n/a"
    const stop =
      typeof rec.stopLossPct === "number" ? `${rec.stopLossPct}%` : "n/a"
    const take =
      typeof rec.takeProfitPct === "number" ? `${rec.takeProfitPct}%` : "n/a"
    details.push(
      `Recommendation: ${String(rec.action || "hold").toUpperCase()} · hold ${hold} · SL ${stop} · TP ${take}.`
    )
  }

  if (options.aiSummary) {
    const label = options.aiSummarySource === "llm" ? "AI note" : "Note"
    details.push(`${label}: ${formatAiSnippet(options.aiSummary, 140)}`)
  }

  return { summary, details }
}

function attachTradeAnalysis(trade, context) {
  if (!trade) return trade
  const key = getAssetKey(trade.assetClass, trade.symbol)
  const trendItem = key ? context.trendLookup.get(key) : null
  const newsItem = key ? context.newsScoreMap.get(key) : null
  const symbolKey = trade.symbol ? String(trade.symbol).toUpperCase() : null
  const llmSummary = symbolKey ? context.llmMap?.get(symbolKey) : null
  const rationale = trade.rationale ? String(trade.rationale) : null
  const aiSummary = llmSummary || rationale || null
  const aiSummarySource = llmSummary ? "llm" : rationale ? "rationale" : null
  const analysis = buildTradeAnalysis(trade, trendItem, newsItem, {
    trendHorizon: context.trendHorizon,
    trendWeights: context.trendWeights,
    newsWeight: context.newsWeight,
    signalLookbackMinutes: context.signalLookbackMinutes,
    signalRecentMinutes: context.signalRecentMinutes,
    signalMinRecent: context.signalMinRecent,
    aiSummary,
    aiSummarySource,
  })
  const trend = trendItem
    ? {
      horizon: trendItem.horizon || context.trendHorizon,
      score: trendItem.score,
      components: trendItem.scoreComponents || trendItem.components,
      momentum: trendItem.momentum,
    }
    : undefined
  const news = newsItem
    ? {
      count: newsItem.count,
      sentiment: newsItem.sentiment,
      score: newsItem.score,
    }
    : undefined
  const enriched = { ...trade, analysis }
  if (trend) enriched.trend = compactObject(trend)
  if (news) enriched.news = compactObject(news)
  return enriched
}

function annotateTrades(list, context) {
  if (!Array.isArray(list)) return []
  return list.map((trade) => attachTradeAnalysis(trade, context))
}

function annotateBuckets(buckets, context) {
  if (!buckets) return {}
  return {
    crypto: annotateTrades(buckets.crypto, context),
    stock: annotateTrades(buckets.stock, context),
    forex: annotateTrades(buckets.forex, context),
  }
}

function buildPopularList(scored, perClass) {
  const buckets = {
    crypto: [],
    stock: [],
    forex: [],
  }

  scored.forEach((item) => {
    if (buckets[item.assetClass]) {
      buckets[item.assetClass].push(item)
    }
  })

  const items = []

  Object.entries(buckets).forEach(([assetClass, list]) => {
    list
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, perClass)
      .forEach((item) => {
        items.push({
          assetClass,
          symbol: item.symbol,
          name: item.name,
          score: item.score,
          source: item.source,
          rationale: item.rationale,
        })
      })
  })

  return items
}

function buildPriceSnapshot(candidates) {
  const map = new Map()
  candidates.forEach((candidate) => {
    if (!candidate?.symbol || typeof candidate.price !== "number") return
    const symbol = normalizeSymbolForCharting(candidate.symbol, candidate.assetClass)
    if (!symbol) return
    const key = `${candidate.assetClass}:${symbol}`
    if (map.has(key)) return
    map.set(key, {
      assetClass: candidate.assetClass,
      symbol,
      price: Number(candidate.price),
      source: candidate.source,
    })
  })
  return Array.from(map.values())
}

function candidateMagnitude(candidate) {
  const values = [
    candidate?.change15m,
    candidate?.change5m,
    candidate?.change1m,
    candidate?.change24h,
  ].filter((value) => typeof value === "number")
  if (values.length === 0) return 0
  return Math.max(...values.map((value) => Math.abs(value)))
}

function buildCandidateBatch(candidates, limit) {
  if (!Array.isArray(candidates)) return []
  const trimmed = candidates
    .map((candidate) =>
      compactObject({
        assetClass: candidate.assetClass,
        symbol: candidate.symbol,
        name: candidate.name,
        market: candidate.assetClass,
        reason: candidate.reason || candidate.sideHint || null,
        price: candidate.price,
        change1m: candidate.change1m,
        change5m: candidate.change5m,
        change15m: candidate.change15m,
        change1h: candidate.change1h,  // Added for momentum scoring
        change24h: candidate.change24h,
        change7d: candidate.change7d,  // Added for momentum scoring
        volume: candidate.volume,
        volatility1m: candidate.volatility1m,
        volatility5m: candidate.volatility5m,
        spreadPct: candidate.spreadPct,
        sideHint: candidate.sideHint,
        watchlisted: candidate.watchlisted,
        primary: candidate.primary,
        source: candidate.source,
      })
    )
    .sort((a, b) => candidateMagnitude(b) - candidateMagnitude(a))
  const max = Number.isFinite(limit) && limit > 0 ? limit : trimmed.length
  return trimmed.slice(0, max).map((item, index) => ({
    ...item,
    rank: index + 1,
  }))
}

function countCandidates(items) {
  return items.reduce(
    (acc, item) => {
      const key = item?.assetClass
      if (!key || !acc[key]) return acc
      acc[key] += 1
      return acc
    },
    { crypto: 0, stock: 0, forex: 0 }
  )
}

/**
 * Dispatch scan requests to bots with priority-based symbol selection.
 * Prioritizes symbols with high momentum but low signal coverage.
 */
async function dispatchSignalRequests(db, picks, controls) {
  const intervalMs = Math.max(config.signalRequestIntervalMinutes, 0) * 60 * 1000
  const metaRef = db.doc("market/orchestrator")
  const metaSnap = await metaRef.get()
  const lastDispatch = metaSnap.data()?.lastDispatchAt?.toDate?.()

  if (intervalMs > 0 && lastDispatch) {
    const elapsed = Date.now() - lastDispatch.getTime()
    if (elapsed < intervalMs) return
  }

  // Build symbol buckets with priority scores
  const symbolBuckets = {
    crypto: new Map(), // symbol -> priority score
    stock: new Map(),
    forex: new Map(),
  }

  // Calculate priority based on momentum and existing signal coverage
  picks.forEach((item) => {
    const assetClass = item?.assetClass
    if (!assetClass || !symbolBuckets[assetClass]) return
    const normalized =
      assetClass === "stock" ? normalizeTicker(item.symbol) : normalizeSymbol(item.symbol)
    if (!normalized) return
    
    // Priority factors:
    // - High absolute momentum = high priority (market is moving)
    // - Low signal count = high priority (need more data)
    // - High score = high priority (promising opportunity)
    const momentum = Math.abs(
      parseNumber(item.momentum?.change5m) ?? 
      parseNumber(item.momentum?.change15m) ?? 
      parseNumber(item.momentum?.change1h) ?? 0
    )
    const signalCount = item.signals?.total ?? 0
    const score = parseNumber(item.score) ?? 50
    
    // Lower signal count = higher priority (inverse)
    const signalPriority = Math.max(0, 10 - signalCount)
    const priority = (momentum * 2) + signalPriority + (score / 20)
    
    const existing = symbolBuckets[assetClass].get(normalized)
    if (!existing || priority > existing) {
      symbolBuckets[assetClass].set(normalized, priority)
    }
  })

  // Sort symbols by priority and take top N for each asset class
  const maxSymbolsPerAsset = 30
  const sortedBuckets = {
    crypto: new Set(),
    stock: new Set(),
    forex: new Set(),
  }
  
  Object.entries(symbolBuckets).forEach(([assetClass, symbolMap]) => {
    const sorted = Array.from(symbolMap.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by priority descending
      .slice(0, maxSymbolsPerAsset)
      .map(([symbol]) => symbol)
    sorted.forEach(s => sortedBuckets[assetClass].add(s))
  })

  const symbols = uniqueList([
    ...sortedBuckets.crypto,
    ...sortedBuckets.stock,
    ...sortedBuckets.forex,
  ])
  if (symbols.length === 0) return

  const botsSnap = await db.collection("bots").get()
  const batch = db.batch()
  let botCommandCount = 0

  const resolveBotAssetClasses = (botData = {}) => {
    const preferred = typeof botData?.desiredConfig?.assetClass === "string"
      ? [botData.desiredConfig.assetClass]
      : []
    const capabilities = Array.isArray(botData?.capabilities?.assetClasses)
      ? botData.capabilities.assetClasses
      : []
    const engine = String(botData?.engine || "").toLowerCase()
    const defaults =
      engine === "backtrader" ? ["stock", "forex", "crypto"] : 
      engine === "oanda" ? ["forex"] :
      engine === "alpaca" ? ["stock"] : []
    const combined = preferred.length > 0 ? preferred : capabilities.length > 0 ? capabilities : defaults
    return uniqueList(
      combined
        .map((asset) => String(asset || "").toLowerCase())
        .filter((asset) => asset && sortedBuckets[asset])
    )
  }

  botsSnap.docs.forEach((doc) => {
    const botId = doc.id
    if (botId === MARKET_SIGNAL_BOT_ID) return
    const botData = doc.data() || {}
    
    // Skip offline bots
    const status = String(botData?.status || "").toLowerCase()
    if (status === "offline" || status === "error") return
    
    const assetClasses = resolveBotAssetClasses(botData)
    const payloadSymbols = uniqueList(
      assetClasses.flatMap((assetClass) => Array.from(sortedBuckets[assetClass] || []))
    )
    if (payloadSymbols.length === 0) return
    
    // Limit symbols per bot to avoid overwhelming
    const maxSymbolsPerBot = 25
    const limitedSymbols = payloadSymbols.slice(0, maxSymbolsPerBot)
    
    const commandRef = db.collection("bots").doc(botId).collection("commands").doc()
    batch.set(commandRef, {
      type: "scan",
      status: "queued",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      requestedBy: "market-intel",
      payload: {
        symbols: limitedSymbols,
        horizon: controls?.trendHorizon || "15m",
        assetClass: assetClasses.length === 1 ? assetClasses[0] : undefined,
        priority: "normal",
      },
    })
    botCommandCount++
  })

  batch.set(
    metaRef,
    {
      lastDispatchAt: admin.firestore.FieldValue.serverTimestamp(),
      symbolCount: symbols.length,
      botCommandCount,
      symbols,
    },
    { merge: true }
  )

  await batch.commit()
  console.log(`Dispatched scan commands to ${botCommandCount} bots for ${symbols.length} symbols`)
}

/**
 * Auto paper trading: when bots are in "paper" mode, automatically
 * execute high-confidence trades based on actionBoard signals.
 * 
 * For crypto: dispatches to Backtrader (paper trading enforced upstream)
 * For stocks/forex: uses Firestore-based paper wallet
 */
async function dispatchAutoPaperTrades(db, actionBoard) {
  // Build price map from actionBoard items (they have prices embedded)
  const priceMap = new Map()
  const allItems = [
    ...(actionBoard.buys || []),
    ...(actionBoard.sells || []),
  ]
  allItems.forEach((item) => {
    if (item.symbol && item.price) {
      priceMap.set(item.symbol.toUpperCase(), item.price)
    }
  })

  // Get bots in paper mode
  const botsSnap = await db.collection("bots").get()
  const paperBots = []
  
  botsSnap.docs.forEach((doc) => {
    const botData = doc.data()
    const mode = String(botData?.desiredConfig?.mode || "signal").toLowerCase()
    if (mode === "paper") {
      paperBots.push({
        id: doc.id,
        engine: botData.engine,
        assetClass: botData.desiredConfig?.assetClass,
        maxDailyLoss: botData.desiredConfig?.risk?.maxDailyLoss || 100,
        maxPositionSize: botData.desiredConfig?.risk?.maxPositionSize || 0.25,
      })
    }
  })

  if (paperBots.length === 0) {
    return // No bots in paper mode
  }

  // Get today's paper trade count to enforce limits
  const today = new Date().toISOString().split("T")[0]
  const paperMetaRef = db.doc("market/paper_trading_meta")
  const paperMeta = (await paperMetaRef.get()).data() || {}
  const todayStats = paperMeta[today] || { tradeCount: 0, totalValue: 0 }

  // Limit: max 10 auto paper trades per day
  const MAX_DAILY_AUTO_TRADES = 10
  if (todayStats.tradeCount >= MAX_DAILY_AUTO_TRADES) {
    console.log(`Auto paper trading limit reached for today (${todayStats.tradeCount}/${MAX_DAILY_AUTO_TRADES})`)
    return
  }

  // Select high-confidence trades from actionBoard
  // Only pick trades with score >= 70 and strong consensus
  const highConfidenceTrades = []
  
  const buys = actionBoard.buys || []
  const sells = actionBoard.sells || []
  
  for (const trade of [...buys, ...sells]) {
    const score = parseNumber(trade.score) ?? 0
    const signalConfidence = parseNumber(trade.signals?.avgConfidence) ?? 0
    const signalCount = trade.signals?.total ?? 0
    
    // High confidence: score >= 70, multiple signals agreeing
    if (score >= 70 && signalCount >= 2 && signalConfidence >= 0.6) {
      const symbol = trade.symbol
      const price = priceMap.get(symbol?.toUpperCase())
      if (price && price > 0) {
        highConfidenceTrades.push({
          symbol,
          assetClass: trade.assetClass,
          side: trade.side || (buys.includes(trade) ? "buy" : "sell"),
          score,
          price,
          signalCount,
          signalConfidence,
        })
      }
    }
  }

  if (highConfidenceTrades.length === 0) {
    return // No high-confidence trades
  }

  // Sort by score and take top trades
  highConfidenceTrades.sort((a, b) => b.score - a.score)
  const tradesToExecute = highConfidenceTrades.slice(0, MAX_DAILY_AUTO_TRADES - todayStats.tradeCount)

  console.log(`Auto paper trading: ${tradesToExecute.length} high-confidence trades to execute`)

  const batch = db.batch()
  let executedCount = 0

  for (const trade of tradesToExecute) {
    // Find appropriate bot for this asset class
    const bot = paperBots.find((b) => {
      return b.assetClass === trade.assetClass
    })

    if (!bot) {
      continue // No bot available for this asset class
    }

    // Use Firestore paper wallet (all asset classes)
    // This will be handled by the paper trading monitor
    const paperTradeRef = db.collection("paper_trade_queue").doc()
    batch.set(paperTradeRef, {
      symbol: trade.symbol,
      assetClass: trade.assetClass,
      side: trade.side,
      price: trade.price,
      score: trade.score,
      signalCount: trade.signalCount,
      botId: bot.id,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      reason: `Auto paper: score=${trade.score}, signals=${trade.signalCount}`,
    })
    executedCount++
  }

  // Update daily stats
  batch.set(paperMetaRef, {
    [today]: {
      tradeCount: todayStats.tradeCount + executedCount,
      totalValue: todayStats.totalValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  }, { merge: true })

  if (executedCount > 0) {
    await batch.commit()
    console.log(`Auto paper trading: dispatched ${executedCount} trades`)
  }
}

async function dispatchAutoPaperSwingOvernight(db, swingResult, controls) {
  if (!controls?.swingOvernightAutoPaperEnabled) return
  const items = Array.isArray(swingResult?.items) ? swingResult.items : []
  if (items.length === 0) return

  const botsSnap = await db.collection("bots").get()
  const paperBots = []
  botsSnap.docs.forEach((doc) => {
    const botData = doc.data()
    const mode = String(botData?.desiredConfig?.mode || "signal").toLowerCase()
    if (mode === "paper") {
      paperBots.push({
        id: doc.id,
        engine: botData.engine,
        assetClass: botData.desiredConfig?.assetClass,
      })
    }
  })

  if (paperBots.length === 0) return

  const today = new Date().toISOString().split("T")[0]
  const paperMetaRef = db.doc("market/swing_paper_trading_meta")
  const paperMeta = (await paperMetaRef.get()).data() || {}
  const todayStats = paperMeta[today] || { tradeCount: 0 }

  const MAX_DAILY_SWING_AUTO_TRADES = 6
  if (todayStats.tradeCount >= MAX_DAILY_SWING_AUTO_TRADES) {
    console.log(
      `Swing auto paper limit reached (${todayStats.tradeCount}/${MAX_DAILY_SWING_AUTO_TRADES})`
    )
    return
  }

  const sorted = [...items].sort((a, b) => (b.score || 0) - (a.score || 0))
  const tradesToExecute = sorted.slice(
    0,
    MAX_DAILY_SWING_AUTO_TRADES - todayStats.tradeCount
  )

  const batch = db.batch()
  let executedCount = 0

  for (const trade of tradesToExecute) {
    const symbol = trade.symbol
    if (!symbol || !trade.price || trade.price <= 0) continue
    const bot = paperBots.find((b) => b.assetClass === "stock")
    if (!bot) continue

    const paperTradeRef = db.collection("paper_trade_queue").doc()
    batch.set(paperTradeRef, {
      symbol,
      assetClass: "stock",
      side: "buy",
      price: trade.price,
      score: trade.score,
      botId: bot.id,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      profile: "swing_overnight",
      reason: `Auto paper swing: score=${trade.score}`,
      swing: trade.swing || null,
    })
    executedCount++
  }

  batch.set(
    paperMetaRef,
    {
      [today]: {
        tradeCount: todayStats.tradeCount + executedCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  )

  if (executedCount > 0) {
    await batch.commit()
    console.log(`Swing auto paper: dispatched ${executedCount} trades`)
  }
}

async function dispatchAutoPaperPrebreakout(db, prebreakoutResult, controls) {
  if (!controls?.prebreakoutAutoPaperEnabled) return
  const items = Array.isArray(prebreakoutResult?.items) ? prebreakoutResult.items : []
  if (items.length === 0) return

  const botsSnap = await db.collection("bots").get()
  const paperBots = []
  botsSnap.docs.forEach((doc) => {
    const botData = doc.data()
    const mode = String(botData?.desiredConfig?.mode || "signal").toLowerCase()
    if (mode === "paper") {
      paperBots.push({
        id: doc.id,
        engine: botData.engine,
        assetClass: botData.desiredConfig?.assetClass,
      })
    }
  })

  if (paperBots.length === 0) return

  const today = new Date().toISOString().split("T")[0]
  const paperMetaRef = db.doc("market/prebreakout_paper_trading_meta")
  const paperMeta = (await paperMetaRef.get()).data() || {}
  const todayStats = paperMeta[today] || { tradeCount: 0 }

  const MAX_DAILY_PREBREAKOUT_AUTO_TRADES = 6
  if (todayStats.tradeCount >= MAX_DAILY_PREBREAKOUT_AUTO_TRADES) {
    console.log(
      `Pre-breakout auto paper limit reached (${todayStats.tradeCount}/${MAX_DAILY_PREBREAKOUT_AUTO_TRADES})`
    )
    return
  }

  const sorted = [...items].sort((a, b) => (b.score || 0) - (a.score || 0))
  const tradesToExecute = sorted.slice(
    0,
    MAX_DAILY_PREBREAKOUT_AUTO_TRADES - todayStats.tradeCount
  )

  const batch = db.batch()
  let executedCount = 0

  for (const trade of tradesToExecute) {
    const symbol = trade.symbol
    if (!symbol || !trade.price || trade.price <= 0) continue
    const bot = paperBots.find((b) => b.assetClass === "stock")
    if (!bot) continue

    const atr = trade.prebreakout?.inputs?.atr14
    const stopLoss =
      typeof atr === "number" ? trade.price - PREBREAKOUT_RULES.stopAtrMult * atr : undefined
    const takeProfit =
      typeof trade.price === "number"
        ? trade.price * (1 + PREBREAKOUT_RULES.profitTriggerPct / 100)
        : undefined

    const paperTradeRef = db.collection("paper_trade_queue").doc()
    batch.set(paperTradeRef, {
      symbol,
      assetClass: "stock",
      side: "buy",
      price: trade.price,
      score: trade.score,
      botId: bot.id,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      profile: "prebreakout",
      reason: `Auto paper pre-breakout: score=${trade.score}`,
      stopLoss: Number.isFinite(stopLoss) ? Number(stopLoss.toFixed(4)) : undefined,
      takeProfit: Number.isFinite(takeProfit) ? Number(takeProfit.toFixed(4)) : undefined,
      prebreakout: trade.prebreakout || null,
    })
    executedCount++
  }

  batch.set(
    paperMetaRef,
    {
      [today]: {
        tradeCount: todayStats.tradeCount + executedCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  )

  if (executedCount > 0) {
    await batch.commit()
    console.log(`Pre-breakout auto paper: dispatched ${executedCount} trades`)
  }
}

async function safeFetch(fetcher) {
  try {
    const result = await fetcher()
    if (Array.isArray(result)) {
      return { items: result, error: null }
    }
    if (result && Array.isArray(result.items)) {
      return { ...result, items: result.items, error: null }
    }
    return { items: [], error: null }
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : String(err || "fetch failed"),
    }
  }
}

function formatFetchError(error) {
  if (!error) return null
  const message = String(error).trim()
  if (!message) return null
  return message.length > 180 ? `${message.slice(0, 177)}...` : message
}

function buildFetchStatus({ items, error, preferences, listKey, source }) {
  const mode = resolveUniverseMode(preferences?.mode)
  const includeTrending = mode !== "universe_only"
  const includeWatchlist = mode !== "movers_only"
  const filterToWatchlist = mode === "movers_filtered_by_universe"
  const list = Array.isArray(preferences?.[listKey]) ? preferences[listKey] : []
  const count = Array.isArray(items) ? items.length : 0
  if (error) {
    return {
      status: "error",
      count,
      error: formatFetchError(error),
      source,
    }
  }
  if (filterToWatchlist && list.length === 0) {
    return {
      status: "disabled",
      count,
      source,
      error: null,
    }
  }
  if (!includeTrending && (!includeWatchlist || list.length === 0)) {
    return {
      status: "disabled",
      count,
      source,
      error: null,
    }
  }
  if (count === 0) {
    return {
      status: "empty",
      count,
      source,
      error: null,
    }
  }
  return {
    status: "ok",
    count,
    source,
    error: null,
  }
}

/**
 * Aggregate health status from all pipeline services into a unified document
 * This provides a single source of truth for pipeline health monitoring
 */
async function aggregatePipelineHealth(db, marketIntelHealth) {
  const now = Date.now()
  
  // Read health status from other services
  const [priceStreamerSnap, agentSnap] = await Promise.all([
    db.doc("pipeline/price_streamer").get().catch(() => null),
    db.doc("pipeline/relayorb_agent").get().catch(() => null),
  ])
  
  const priceStreamer = priceStreamerSnap?.exists ? priceStreamerSnap.data() : null
  const agent = agentSnap?.exists ? agentSnap.data() : null
  
  // Check staleness of each service
  const checkServiceHealth = (data, serviceName) => {
    if (!data) return { status: "unknown", isStale: true, lastSeen: null }
    
    const heartbeatAt = data.heartbeatAt?.toDate?.() || data.heartbeatAt
    const lastSeen = heartbeatAt ? new Date(heartbeatAt).getTime() : null
    const ageMs = lastSeen ? now - lastSeen : null
    const isStale = ageMs === null || ageMs > STALENESS_THRESHOLDS.pipeline
    
    return {
      status: isStale ? "stale" : data.status || "unknown",
      isStale,
      lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
      ageMs,
      details: data,
    }
  }
  
  const services = {
    market_intel: {
      status: marketIntelHealth.status,
      isStale: false,
      lastSeen: new Date().toISOString(),
      ageMs: 0,
    },
    price_streamer: checkServiceHealth(priceStreamer, "price_streamer"),
    relayorb_agent: checkServiceHealth(agent, "relayorb_agent"),
  }
  
  // Determine overall pipeline status
  const statuses = Object.values(services).map(s => s.status)
  const hasError = statuses.includes("error")
  const hasStale = statuses.includes("stale") || statuses.includes("unknown")
  const hasDegraded = statuses.includes("degraded")
  
  const overallStatus = hasError ? "error" 
    : hasStale ? "stale"
    : hasDegraded ? "degraded"
    : "ok"
  
  const pipelineStatus = {
    status: overallStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    services,
    summary: {
      ok: statuses.filter(s => s === "ok").length,
      degraded: statuses.filter(s => s === "degraded").length,
      stale: statuses.filter(s => s === "stale" || s === "unknown").length,
      error: statuses.filter(s => s === "error").length,
    },
    thresholds: {
      priceStaleMs: STALENESS_THRESHOLDS.prices,
      signalStaleMs: STALENESS_THRESHOLDS.signals,
      pipelineStaleMs: STALENESS_THRESHOLDS.pipeline,
    },
  }
  
  await db.doc("pipeline/status").set(pipelineStatus, { merge: true })
  
  console.log("mi_pipeline_health", {
    status: overallStatus,
    services: Object.fromEntries(
      Object.entries(services).map(([k, v]) => [k, v.status])
    ),
  })
}

async function run() {
  const db = initAdmin()
  const replayControls = await loadReplayControls(db)
  applyReplayControls(replayControls)
  await ackReplayControls(db, "run_start")
  redis = await initRedis()
  if (isReplayMode() && !replayState.asOfMs) {
    throw new Error("Replay mode missing asOf timestamp")
  }
  const startedAt = isReplayMode()
    ? new Date(replayState.asOfMs)
    : new Date()
  const runId = isReplayMode()
    ? replayState.runId
    : config.runId || `${startedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  activeRunId = runId
  const replayMode = isReplayMode()
  const marketDocPaths = {
    hotTrades: resolveMarketDocPath("hotTrades"),
    swingOvernight: resolveMarketDocPath("swingOvernight"),
    prebreakout: resolveMarketDocPath("prebreakout"),
    trending: resolveMarketDocPath("trending"),
    popular: resolveMarketDocPath("popular"),
    actionBoard: resolveMarketDocPath("actionBoard"),
    candidates: resolveMarketDocPath("candidates"),
    pricesSnapshot: resolveMarketDocPath("prices_snapshot"),
    movers: resolveMarketDocPath("movers"),
  }
  const swingRunCollection = resolveMarketCollectionPath("market_swing_overnight_runs")
  const prebreakoutRunCollection = resolveMarketCollectionPath("market_prebreakout_runs")
  const batchCollectionName = resolveBatchCollectionName()

  console.log("mi_run_start", { startedAt: startedAt.toISOString(), runId })

  await refreshStockSymbolCache(db).catch((err) => {
    console.error("Stock symbol cache refresh failed", err.message)
  })

  let universe = null
  let controls = null
  let runConfig = null

  if (isReplayMode()) {
    const snapshot = await readReplayConfigSnapshot(db, runId)
    if (snapshot?.universe && snapshot?.controls) {
      universe = snapshot.universe
      controls = snapshot.controls
      runConfig = snapshot.runConfig || null
    } else {
      ;[universe, controls, runConfig] = await Promise.all([
        readUniverse(db).catch((err) => {
          console.error("Universe fetch failed", err.message)
          return {
            crypto: { mode: DEFAULT_UNIVERSE_MODE, symbols: [] },
            stocks: { mode: DEFAULT_UNIVERSE_MODE, symbols: [] },
            forex: { mode: DEFAULT_UNIVERSE_MODE, pairs: [] },
          }
        }),
        readControls(db).catch((err) => {
          console.error("Controls fetch failed", err.message)
          return {
            enableLLM: true,
            llmIntervalMinutes: config.llmIntervalMinutes,
            enableNews: true,
            newsIntervalMinutes: config.newsIntervalMinutes,
            swingOvernightEnabled: false,
            swingOvernightAutoPaperEnabled: false,
            prebreakoutEnabled: false,
            prebreakoutAutoPaperEnabled: false,
            dipHorizon: "24h",
            trendHorizon: "15m",
            trendWeights: { ...DEFAULT_TREND_WEIGHTS },
            riskProfile: "balanced",
            assetFocus: ["crypto", "stock", "forex"],
            primaryAssets: { crypto: [], stocks: [], forex: [] },
            autoTuneEnabled: config.autoTuneEnabled,
            autoTuneWithAI: true,
            autoTuneIntervalHours: config.autoTuneIntervalHours,
            autoTuneLastAt: null,
            autoTuneNotes: "",
          }
        }),
        readRunConfig(db, runId),
      ])
      await writeReplayConfigSnapshot(db, runId, {
        universe,
        controls,
        runConfig,
      })
    }
  } else {
    ;[universe, controls, runConfig] = await Promise.all([
      readUniverse(db).catch((err) => {
        console.error("Universe fetch failed", err.message)
        return {
          crypto: { mode: DEFAULT_UNIVERSE_MODE, symbols: [] },
          stocks: { mode: DEFAULT_UNIVERSE_MODE, symbols: [] },
          forex: { mode: DEFAULT_UNIVERSE_MODE, pairs: [] },
        }
      }),
      readControls(db).catch((err) => {
        console.error("Controls fetch failed", err.message)
        return {
          enableLLM: true,
          llmIntervalMinutes: config.llmIntervalMinutes,
          enableNews: true,
          newsIntervalMinutes: config.newsIntervalMinutes,
          swingOvernightEnabled: false,
          swingOvernightAutoPaperEnabled: false,
          prebreakoutEnabled: false,
          prebreakoutAutoPaperEnabled: false,
          dipHorizon: "24h",
          trendHorizon: "15m",
          trendWeights: { ...DEFAULT_TREND_WEIGHTS },
          riskProfile: "balanced",
          assetFocus: ["crypto", "stock", "forex"],
          primaryAssets: { crypto: [], stocks: [], forex: [] },
          autoTuneEnabled: config.autoTuneEnabled,
          autoTuneWithAI: true,
          autoTuneIntervalHours: config.autoTuneIntervalHours,
          autoTuneLastAt: null,
          autoTuneNotes: "",
        }
      }),
      readRunConfig(db, runId),
    ])
  }

  const testFilter = buildTestFilter(runConfig)
  if (testFilter) {
    console.log("mi_test_mode", {
      runId,
      restrictMarkets: Array.from(testFilter.marketSet),
      restrictSymbols: Array.from(testFilter.symbolMap.entries()).map(([key, set]) => ({
        assetClass: key,
        count: set.size,
      })),
    })
  }

  const llmIntervalMinutes = controls.llmIntervalMinutes
  const llmEnabled = !replayMode && controls.enableLLM && Boolean(config.openaiKey)
  const primarySets = {
    crypto: new Set(controls.primaryAssets?.crypto ?? []),
    stocks: new Set(controls.primaryAssets?.stocks ?? []),
    forex: new Set(controls.primaryAssets?.forex ?? []),
  }

  const accuracyHorizon = VALID_HORIZONS.has(controls.dipHorizon)
    ? controls.dipHorizon
    : "24h"
  const shouldWeightSignals = !replayMode && controls.autoTuneEnabled !== false
  const shouldLoadBotRegistry =
    !replayMode &&
    (shouldWeightSignals ||
      (controls.botWeights && Object.keys(controls.botWeights).length > 0))
  const [cryptoResult, stockResult, forexResult, accuracySummary, botRegistryResult] =
    await Promise.all([
      safeFetch(() => fetchCrypto(db, universe.crypto)),
      safeFetch(() => fetchStocks(db, universe.stocks)),
      safeFetch(() => fetchForex(db, universe.forex)),
      shouldWeightSignals ? loadSignalPerformanceSummary(db, accuracyHorizon) : null,
      shouldLoadBotRegistry
        ? loadBotRegistry(db)
        : Promise.resolve({ registry: new Map(), docs: [] }),
    ])
  const accuracyWeights = shouldWeightSignals
    ? await loadBotAccuracyWeights(db, accuracyHorizon, botRegistryResult?.docs)
    : new Map()
  const resolvedBotWeights = mergeBotWeights(
    controls.botWeights,
    accuracyWeights,
    botRegistryResult?.registry
  )
  const signalWeight = shouldWeightSignals
    ? computeSignalWeightMultiplier(accuracySummary)
    : 1
  const botSignals = replayMode
    ? new Map()
    : await fetchBotSignals(db, resolvedBotWeights).catch((err) => {
        console.error("Bot signals fetch failed", err.message)
        return new Map()
      })
  const autoTuneResult = replayMode
    ? null
    : maybeAutoTuneTrendWeights(controls, accuracySummary, accuracyHorizon)
  let tunedWeights =
    autoTuneResult?.weights || controls.trendWeights || DEFAULT_TREND_WEIGHTS
  let autoTuneNotes = autoTuneResult?.note || ""
  let aiDelta = 0
  const aiEnabled =
    !replayMode && Boolean(config.openaiKey) && controls.autoTuneWithAI !== false
  if (
    controls.autoTuneEnabled &&
    aiEnabled &&
    accuracySummary &&
    accuracySummary.count >= config.minAccuracySignals
  ) {
    try {
      const aiResult = await requestAiSignalDelta({
        weights: tunedWeights,
        horizon: accuracyHorizon,
        hitRate: accuracySummary.hitRate ?? 0,
        count: accuracySummary.count ?? 0,
        signalWeight,
      })
      if (aiResult && aiResult.delta) {
        const applied = applySignalDelta(tunedWeights, aiResult.delta)
        tunedWeights = applied.weights
        aiDelta = applied.delta
        const reason = aiResult.reason ? ` (${aiResult.reason})` : ""
        autoTuneNotes = [
          autoTuneNotes,
          `AI nudged bot signal weight by ${aiDelta}.${reason}`,
        ]
          .filter(Boolean)
          .join(" ")
      }
    } catch (err) {
      console.error("AI weight tuning failed", err.message)
    }
  }
  const autoTuneTriggered = Boolean(autoTuneResult?.tuned || aiDelta)
  controls.trendWeights = tunedWeights
  const crypto = cryptoResult.items
  const stocks = stockResult.items
  const forex = forexResult.items
  if (cryptoResult.error) console.error("Crypto fetch failed", cryptoResult.error)
  if (stockResult.error) console.error("Stock fetch failed", stockResult.error)
  if (forexResult.error) console.error("Forex fetch failed", forexResult.error)

  const focusSet = new Set(Array.isArray(controls.assetFocus) ? controls.assetFocus : [])
  const rawCandidates = [...crypto, ...stocks, ...forex]
  const focusedCandidates =
    focusSet.size > 0 && focusSet.size < 3
      ? rawCandidates.filter((candidate) => focusSet.has(candidate.assetClass))
      : rawCandidates
  let candidates = applyVolumeScores(markPrimary(focusedCandidates, primarySets))
  if (testFilter) {
    candidates = candidates.filter((candidate) => testFilter.allow(candidate))
  }
  const candidateBatch = buildCandidateBatch(candidates, config.candidatePublishLimit)
  const candidateBatchCounts = countCandidates(candidateBatch)
  const originBreakdown = summarizeOrigins(candidateBatch)
  const sampleOrigins = (list) =>
    list
      .slice(0, 6)
      .map((item) => item.symbol)
      .filter(Boolean)
      .slice(0, 6)
  const moversSample = sampleOrigins(candidateBatch.filter((c) => (c.origins || []).includes("mover15m")))
  const universeSample = sampleOrigins(candidateBatch.filter((c) => (c.origins || []).includes("user_universe")))
  const manualSample = sampleOrigins(candidateBatch.filter((c) => (c.origins || []).includes("manual")))
  const trendingSample = sampleOrigins(candidateBatch.filter((c) => (c.origins || []).includes("trending")))
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "mi_candidates",
      eventType: "candidates_merge",
      edgeKey: "movers_15m->candidates_merge",
      nodeIds: ["market_intel", "candidates_merge"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        count: candidateBatch.length,
        counts: candidateBatchCounts,
        origins: originBreakdown,
        assetFocus: controls.assetFocus,
        riskProfile: controls.riskProfile,
        originsBreakdown: {
          mover15m: originBreakdown.mover15m || 0,
          user_universe: originBreakdown.user_universe || 0,
          manual: originBreakdown.manual || 0,
          trending: originBreakdown.trending || 0,
          other: originBreakdown.other || 0,
        },
        originSamples: {
          mover15m: moversSample,
          user_universe: universeSample,
          manual: manualSample,
          trending: trendingSample,
        },
      },
      outputs: {
        firestoreDocs: [marketDocPaths.candidates],
      },
    })
  )
  if (config.pipelineEventsEnabled && shouldSample(config.pipelineEventsSampleRate)) {
    const sampled = candidateBatch.slice(0, 25)
    await Promise.all(
      sampled.map((candidate) =>
        publishPipelineEvent(
          buildPipelineEvent({
            stationId: "mi_candidates",
            eventType: "candidates_merge",
            edgeKey: "movers_15m->candidates_merge",
            nodeIds: ["market_intel", "candidates_merge"],
            status: "end",
            batchId: runId,
            symbolKey: candidate.assetClass && candidate.symbol
              ? `${candidate.assetClass}:${candidate.symbol}`
              : undefined,
            meta: {
              origins: normalizeOriginsForEvent(candidate.origins),
              watchlisted: candidate.watchlisted || false,
              sideHint: candidate.sideHint || null,
              source: candidate.source || null,
            },
          })
        )
      )
    )
  }
  const batchDocRef = db.collection(batchCollectionName).doc(runId)
  const batchDoc = compactObject({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    batchId: runId,
    runId,
    docPath: marketDocPaths.candidates,
    count: candidateBatch.length,
    counts: candidateBatchCounts,
    sources: {
      crypto: cryptoResult.source || "gateway",
      stocks: stockResult.source || "stream",
      forex: forexResult.source || "stream",
    },
    items: candidateBatch,
  })
  const newsData = await loadNewsData(db, candidates, controls, universe, runId, runConfig)
  // Load analyst consensus for stock candidates (uses FMP grades-consensus)
  const stockSymbols = candidates
    .filter(c => c.assetClass === "stock")
    .map(c => c.symbol)
  const analystConsensusMap = await loadAnalystConsensusData(stockSymbols)
  const scoreOptions = {
    weights: controls.trendWeights,
    signalWeight,
    horizon: "15m",
    riskProfile: controls.riskProfile,
    analystConsensusMap,
  }
  const hotTrades = buildHotTrades(candidates, botSignals, scoreOptions, newsData.scoreMap)
  const scoreSummary = hotTrades.reduce(
    (acc, trade) => {
      if (trade.side === "buy") acc.buy += 1
      else if (trade.side === "sell") acc.sell += 1
      else acc.hold += 1
      return acc
    },
    { buy: 0, sell: 0, hold: 0 }
  )
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "scoring",
      eventType: "score_compute",
      edgeKey: "candidates_merge->score_compute",
      nodeIds: ["market_intel", "score_compute", "firestore"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        scored: hotTrades.length,
        buy: scoreSummary.buy,
        sell: scoreSummary.sell,
        hold: scoreSummary.hold,
        riskProfile: controls.riskProfile,
        weights: scoreOptions.weights,
      },
    })
  )
  const recommendationMap = await buildRecommendations(hotTrades, config.recommendationLimit)
  const hotTradesWithRecommendations = hotTrades.map((trade) => {
    const key = getAssetKey(trade.assetClass, trade.symbol)
    const recommendation = key ? recommendationMap.get(key) : null
    return recommendation ? { ...trade, recommendation } : trade
  })
  const trendingByHorizon = buildTrending(
    candidates,
    botSignals,
    scoreOptions,
    newsData.scoreMap
  )
  const swingEntryWindow = resolveSwingEntryWindow(startedAt)
  const swingResult = controls.swingOvernightEnabled
    ? await buildSwingOvernight({
        candidates,
        universe,
        trendingByHorizon,
        asOf: startedAt,
      })
    : {
        items: [],
        meta: {
          runId,
          asOf: startedAt.toISOString(),
          status: "disabled",
          entryWindow: swingEntryWindow.entryWindow,
          sessionClose: swingEntryWindow.entryWindow?.close,
        },
      }
  if (config.pipelineEventsEnabled) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "swing_overnight",
        eventType: "compute_swing",
        edgeKey: "market_intel->swing_overnight",
        nodeIds: ["market_intel", "swing_overnight"],
        status: "end",
        batchId: runId,
        meta: {
          runId,
          status: swingResult?.meta?.status,
          count: swingResult?.items?.length ?? 0,
        },
      })
    )
  }
  const prebreakoutEntryWindow = resolvePrebreakoutEntryWindow(startedAt)
  const prebreakoutResult = controls.prebreakoutEnabled
    ? await buildPrebreakout({
        candidates,
        universe,
        trendingByHorizon,
        newsScoreMap: newsData.scoreMap,
        botSignals,
        asOf: startedAt,
      })
    : {
        items: [],
        meta: {
          runId,
          asOf: startedAt.toISOString(),
          status: "disabled",
          entryWindow: prebreakoutEntryWindow.entryWindow,
          sessionClose: prebreakoutEntryWindow.entryWindow?.close,
        },
      }
  if (config.pipelineEventsEnabled) {
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "prebreakout",
        eventType: "compute_prebreakout",
        edgeKey: "market_intel->prebreakout",
        nodeIds: ["market_intel", "prebreakout"],
        status: "end",
        batchId: runId,
        meta: {
          runId,
          status: prebreakoutResult?.meta?.status,
          count: prebreakoutResult?.items?.length ?? 0,
        },
      })
    )
  }
  const actionBoard = buildActionBoard(
    hotTradesWithRecommendations,
    newsData.scoreMap,
    config.actionBoardLimit
  )
  const trendLookup = buildTrendLookup(trendingByHorizon, controls.trendHorizon)
  const scoreWeightDisplay = resolveScoreWeights(
    "stock",
    "scalp",
    controls.trendWeights,
    controls.riskProfile
  )
  const trendWeightsDoc = cleanTrendWeightsForDoc(scoreWeightDisplay)
  const popularItems = buildPopularList(hotTradesWithRecommendations, config.popularPerClass)
  const priceSnapshot = buildPriceSnapshot(candidates)
  if (!replayMode) {
    await monitorPaperTrading(db, priceSnapshot).catch((err) => {
      console.error("Paper trading automation failed", err.message)
    })
  }

  const trimmed = hotTradesWithRecommendations.slice(0, config.hotTradesLimit)
  if (config.pipelineEventsEnabled && shouldSample(config.pipelineEventsSampleRate)) {
    const sampled = trimmed.slice(0, 20)
    await Promise.all(
      sampled.map((trade) =>
        publishPipelineEvent(
          buildPipelineEvent({
            stationId: "scoring",
            eventType: "score_compute",
            edgeKey: "candidates_merge->score_compute",
            nodeIds: ["market_intel", "score_compute", "firestore"],
            status: "end",
            batchId: runId,
            symbolKey: trade.assetClass && trade.symbol
              ? `${trade.assetClass}:${trade.symbol}`
              : undefined,
            meta: {
              score: trade.score,
              action: trade.side,
              profile: trade.profile,
              origins: normalizeOriginsForEvent(trade.origins),
              confidence: trade.confidence,
              holdMinutes: trade?.recommendation?.holdMinutes ?? null,
              stopLossPct: trade?.recommendation?.stopLossPct ?? null,
              takeProfitPct: trade?.recommendation?.takeProfitPct ?? null,
              reasonsShort:
                typeof trade?.rationale === "string"
                  ? trade.rationale.slice(0, 140)
                  : undefined,
            },
          })
        )
      )
    )
  }
  const fetchStatus = {
    crypto: buildFetchStatus({
      items: crypto,
      error: cryptoResult.error,
      preferences: universe.crypto,
      listKey: "symbols",
      source: cryptoResult.source || "gateway",
    }),
    stock: buildFetchStatus({
      items: stocks,
      error: stockResult.error,
      preferences: universe.stocks,
      listKey: "symbols",
      source: stockResult.source || "stream",
    }),
    forex: buildFetchStatus({
      items: forex,
      error: forexResult.error,
      preferences: universe.forex,
      listKey: "pairs",
      source: forexResult.source || "stream",
    }),
  }
  const candidateCounts = {
    crypto: crypto.length,
    stock: stocks.length,
    forex: forex.length,
  }
  const moversMarkets = {}
  if (stockResult.movers?.us) moversMarkets.us = stockResult.movers.us
  if (stockResult.movers?.tsx) moversMarkets.tsx = stockResult.movers.tsx
  if (forexResult.movers) moversMarkets.forex = forexResult.movers
  const moversDoc =
    moversMarkets && Object.keys(moversMarkets).length > 0
      ? {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        windowMinutes: config.moverWindowMinutes,
        markets: moversMarkets,
        meta: {
          runId,
          sources: {
            stocks: stockResult.source || "stream",
            forex: forexResult.source || "stream",
          },
        },
      }
      : null

  console.log("mi_compute_movers", {
    runId,
    markets: Object.keys(moversMarkets),
    candidates: candidateCounts,
  })
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "mi_movers",
      eventType: "compute_movers",
      edgeKey: "market_intel->movers_15m",
      nodeIds: ["market_intel", "movers_15m", "redis"],
      status: "end",
      batchId: runId,
      durationMs: Date.now() - startedAt.getTime(),
      meta: {
        runId,
        markets: Object.keys(moversMarkets),
        candidateCounts,
        sources: {
          crypto: cryptoResult.source || "gateway",
          stocks: stockResult.source || "stream",
          forex: forexResult.source || "stream",
        },
        windowMinutes: config.moverWindowMinutes,
      },
      outputs: {
        firestoreDocs: moversDoc ? [marketDocPaths.movers] : undefined,
      },
    })
  )

  const existing = await db.doc(marketDocPaths.hotTrades).get()

  let llmMap = null
  let llmUpdatedAt = null
  if (llmEnabled) {
    const lastLlmAt = existing.data()?.meta?.llmUpdatedAt?.toDate?.()
    const intervalMs = llmIntervalMinutes * 60 * 1000
    const shouldRun = !lastLlmAt || Date.now() - lastLlmAt.getTime() >= intervalMs

    if (shouldRun) {
      try {
        // Generate AI explanations for top 10 hot trades
        llmMap = await enrichWithOpenAI(trimmed.slice(0, 10))
        // Only update timestamp if we got results from OpenAI
        if (llmMap && llmMap.size > 0) {
          llmUpdatedAt = admin.firestore.FieldValue.serverTimestamp()
          console.log(`OpenAI generated ${llmMap.size} rationales`)
        } else {
          console.log("OpenAI returned no rationales, keeping previous")
        }
      } catch (err) {
        console.error("OpenAI summary failed", err.message)
        // Don't update timestamp on failure - will retry next time
      }
    } else {
      console.log(`Skipping OpenAI (last update: ${lastLlmAt ? Math.round((Date.now() - lastLlmAt.getTime()) / 60000) : 'never'} minutes ago)`)
    }
  }

  const items = trimmed.map((item) => {
    const key = item.symbol.toUpperCase()
    const rationale = llmMap?.get(key) || item.rationale
    return {
      ...item,
      rationale,
    }
  })
  const analysisContext = {
    trendLookup: trendLookup.lookup,
    trendHorizon: trendLookup.horizon,
    trendWeights: scoreWeightDisplay,
    newsScoreMap: newsData.scoreMap,
    newsWeight: actionBoard.newsWeight,
    signalLookbackMinutes: config.signalLookbackMinutes,
    signalRecentMinutes: config.signalRecentMinutes,
    signalMinRecent: config.signalMinRecent,
    accuracyHorizon,
    accuracySummary,
    minAccuracySignals: config.minAccuracySignals,
    signalWeight,
    llmMap,
  }
  const analyzedItems = annotateTrades(items, analysisContext)
  const analyzedActionBoard = {
    ...actionBoard,
    buys: annotateTrades(actionBoard.buys, analysisContext),
    sells: annotateTrades(actionBoard.sells, analysisContext),
    byAsset: {
      buys: annotateBuckets(actionBoard.byAsset?.buys, analysisContext),
      sells: annotateBuckets(actionBoard.byAsset?.sells, analysisContext),
    },
  }

  const autoTuneWrite =
    autoTuneTriggered && !replayMode
      ? db.doc("market/controls").set(
      {
        trendWeights: tunedWeights,
        autoTuneEnabled: controls.autoTuneEnabled,
        autoTuneWithAI: controls.autoTuneWithAI,
        autoTuneIntervalHours: controls.autoTuneIntervalHours,
        autoTuneLastAt: admin.firestore.FieldValue.serverTimestamp(),
        autoTuneNotes: autoTuneNotes,
        autoTuneHorizon: accuracyHorizon,
        autoTuneHitRate: accuracySummary?.hitRate ?? null,
        autoTuneSignals: accuracySummary?.count ?? null,
      },
      { merge: true }
    )
      : Promise.resolve()

  await Promise.all([
    db.doc(marketDocPaths.hotTrades).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: analyzedItems,
        sources: {
          crypto: cryptoResult.source || "gateway",
          stocks: stockResult.source || "stream",
          forex: forexResult.source || "stream",
        },
        meta: compactObject({
          runId,
          signalLookbackMinutes: config.signalLookbackMinutes,
          runDurationMs: Date.now() - startedAt.getTime(),
          llmIntervalMinutes,
          llmEnabled,
          llmUpdatedAt: llmUpdatedAt || undefined, // Only include if set, don't overwrite with null
          accuracyHorizon,
          accuracyHitRate: accuracySummary?.hitRate ?? null,
          accuracySignals: accuracySummary?.count ?? null,
          signalWeight,
          botWeightCount: resolvedBotWeights.size,
          fetchStatus,
          candidateCounts,
        }),
      },
      { merge: true }
    ),
    db.doc(marketDocPaths.swingOvernight).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: swingResult?.items ?? [],
        meta: swingResult?.meta ?? {},
      },
      { merge: true }
    ),
    db.doc(marketDocPaths.prebreakout).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: prebreakoutResult?.items ?? [],
        meta: prebreakoutResult?.meta ?? {},
      },
      { merge: true }
    ),
    db.collection(resolveMarketCollectionPath("market_swing_overnight_runs")).doc(runId).set(
      {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        runId,
        items: swingResult?.items ?? [],
        meta: swingResult?.meta ?? {},
      },
      { merge: true }
    ),
    db.collection(resolveMarketCollectionPath("market_prebreakout_runs")).doc(runId).set(
      {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        runId,
        items: prebreakoutResult?.items ?? [],
        meta: prebreakoutResult?.meta ?? {},
      },
      { merge: true }
    ),
    db.doc(marketDocPaths.trending).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        horizons: TREND_HORIZONS,
        byHorizon: trendingByHorizon,
        weights: trendWeightsDoc,
        meta: {
          runId,
          defaultHorizon: controls.trendHorizon,
          signalLookbackMinutes: config.signalLookbackMinutes,
          trendLimit: config.trendLimit,
          newsEnabled: controls.enableNews,
          newsIntervalMinutes: controls.newsIntervalMinutes,
          newsUpdatedAt: newsData.updatedAt || null,
        },
      },
      { merge: true }
    ),
    db.doc(marketDocPaths.popular).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: popularItems,
        meta: {
          runId,
          perClass: config.popularPerClass,
        },
      },
      { merge: true }
    ),
    db.doc(marketDocPaths.actionBoard).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        buys: analyzedActionBoard.buys,
        sells: analyzedActionBoard.sells,
        byAsset: analyzedActionBoard.byAsset,
        meta: {
          runId,
          limit: config.actionBoardLimit,
          classLimit: actionBoard.classLimit,
          newsWeight: actionBoard.newsWeight,
          signalLookbackMinutes: config.signalLookbackMinutes,
          accuracyHorizon,
          accuracyHitRate: accuracySummary?.hitRate ?? null,
          accuracySignals: accuracySummary?.count ?? null,
          signalWeight,
          botWeightCount: resolvedBotWeights.size,
          horizon: controls.trendHorizon || "15m",
          fetchStatus,
          candidateCounts,
          sources: {
            crypto: cryptoResult.source || "gateway",
            stocks: stockResult.source || "stream",
            forex: forexResult.source || "stream",
          },
        },
      },
      { merge: true }
    ),
    db.doc(marketDocPaths.candidates).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        batchId: runId,
        runId,
        items: candidateBatch,
        meta: compactObject({
          runId,
          limit: config.candidatePublishLimit,
          count: candidateBatch.length,
          counts: candidateBatchCounts,
          sources: {
            crypto: cryptoResult.source || "gateway",
            stocks: stockResult.source || "stream",
            forex: forexResult.source || "stream",
          },
        }),
      },
      { merge: true }
    ),
    batchDocRef.set(batchDoc, { merge: true }),
    db.doc(marketDocPaths.pricesSnapshot).set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        items: priceSnapshot,
        meta: {
          runId,
          count: priceSnapshot.length,
        },
      },
      { merge: true }
    ),
    moversDoc
      ? db.doc(marketDocPaths.movers).set(moversDoc, { merge: true })
      : Promise.resolve(),
    autoTuneWrite,
  ])

  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "swing_overnight",
      eventType: "fs_write",
      edgeKey: "swing_overnight->firestore",
      nodeIds: ["swing_overnight", "firestore"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        status: swingResult?.meta?.status,
        count: swingResult?.items?.length ?? 0,
      },
      outputs: {
        firestoreDocs: [marketDocPaths.swingOvernight, `${swingRunCollection}/${runId}`],
      },
    })
  )

  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "prebreakout",
      eventType: "fs_write",
      edgeKey: "prebreakout->firestore",
      nodeIds: ["prebreakout", "firestore"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        status: prebreakoutResult?.meta?.status,
        count: prebreakoutResult?.items?.length ?? 0,
      },
      outputs: {
        firestoreDocs: [marketDocPaths.prebreakout, `${prebreakoutRunCollection}/${runId}`],
      },
    })
  )

  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "analysis_written",
      eventType: "analysis_write",
      edgeKey: "score_compute->firestore",
      nodeIds: ["score_compute", "firestore", "ui"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        hotTrades: analyzedItems.length,
        trendingHorizon: controls.trendHorizon,
        popularCount: popularItems.length,
      },
      outputs: {
        firestoreDocs: [marketDocPaths.hotTrades, marketDocPaths.trending, marketDocPaths.popular],
      },
    })
  )

  console.log("mi_write_batch", {
    runId,
    batchId: runId,
    count: candidateBatch.length,
  })
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "mi_batch_written",
      eventType: "fs_write",
      edgeKey: "candidates_merge->firestore",
      nodeIds: ["candidates_merge", "firestore"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        count: candidateBatch.length,
        counts: candidateBatchCounts,
      },
      outputs: {
        firestoreDocs: [marketDocPaths.candidates, `${batchCollectionName}/${runId}`],
      },
    })
  )

  await publishRedisEvent(
    compactObject({
      type: "new_batch",
      batchId: runId,
      runId,
      docPath: marketDocPaths.candidates,
      batchPath: `${batchCollectionName}/${runId}`,
      count: candidateBatch.length,
      counts: candidateBatchCounts,
      publishedAt: getEffectiveNowMs(),
    })
  )

  console.log("mi_publish_new_batch", { runId, batchId: runId })
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "mi_new_batch",
      eventType: "batch_publish",
      edgeKey: "market_intel->new_batch",
      nodeIds: ["market_intel", "new_batch", "redis"],
      status: "end",
      batchId: runId,
      meta: {
        runId,
        count: candidateBatch.length,
        counts: candidateBatchCounts,
        channel: resolveEventChannel(),
      },
      outputs: {
        redisKeys: [resolveEventChannel()],
      },
    })
  )

  const dispatchList =
    analyzedActionBoard.allPicks && analyzedActionBoard.allPicks.length > 0
      ? analyzedActionBoard.allPicks
      : [...analyzedActionBoard.buys, ...analyzedActionBoard.sells]
  if (!replayMode) {
    await dispatchSignalRequests(db, dispatchList, controls).catch((err) => {
      console.error("Signal request dispatch failed", err.message)
    })
    await emitMarketSignals(db, trendingByHorizon, controls)
  }

  // Write pipeline health status for UI visibility
  const endedAt = new Date()
  const durationMs = endedAt.getTime() - startedAt.getTime()
  const pipelineHealth = {
    service: "market_intel",
    status: fetchStatus.crypto.status === "ok" && fetchStatus.stock.status === "ok" && fetchStatus.forex.status === "ok"
      ? "ok"
      : "degraded",
    runId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs,
    heartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
    dataSources: {
      crypto: {
        status: fetchStatus.crypto.status,
        count: fetchStatus.crypto.count,
        source: fetchStatus.crypto.source,
        error: fetchStatus.crypto.error || null,
      },
      stock: {
        status: fetchStatus.stock.status,
        count: fetchStatus.stock.count,
        source: fetchStatus.stock.source,
        error: fetchStatus.stock.error || null,
      },
      forex: {
        status: fetchStatus.forex.status,
        count: fetchStatus.forex.count,
        source: fetchStatus.forex.source,
        error: fetchStatus.forex.error || null,
      },
    },
    signals: {
      count: botSignals.size,
      lookbackMinutes: config.signalLookbackMinutes,
    },
    output: {
      hotTrades: analyzedItems.length,
      trending: Object.keys(trendingByHorizon).length,
      popular: popularItems.length,
    },
  }
  
  if (!replayMode) {
    await db.doc("pipeline/market_intel").set(pipelineHealth, { merge: true }).catch((err) => {
      console.error("Pipeline health write failed", err.message)
    })

    // Aggregate all service health into unified pipeline status
    await aggregatePipelineHealth(db, pipelineHealth).catch((err) => {
      console.error("Pipeline aggregation failed", err.message)
    })

    // Auto paper trading: dispatch high-confidence signals to execution bots
    await dispatchAutoPaperTrades(db, analyzedActionBoard).catch((err) => {
      console.error("Auto paper trade dispatch failed", err.message)
    })
    await dispatchAutoPaperSwingOvernight(db, swingResult, controls).catch((err) => {
      console.error("Swing auto paper dispatch failed", err.message)
    })
    await dispatchAutoPaperPrebreakout(db, prebreakoutResult, controls).catch((err) => {
      console.error("Pre-breakout auto paper dispatch failed", err.message)
    })
  }

  console.log("mi_run_complete", { runId, count: items.length, durationMs })

  if (redis) {
    await redis.quit().catch(() => {})
  }
}

run().catch((err) => {
  console.error("Market intel failed", err)
  process.exit(1)
})
