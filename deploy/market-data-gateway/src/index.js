const http = require("http")
const crypto = require("crypto")
const admin = require("firebase-admin")
const fs = require("fs")
const { Storage } = require("@google-cloud/storage")
const { createClient } = require("redis")
const zlib = require("zlib")
const { fromZonedTime } = require("date-fns-tz")
const { attachRequestId, createRequestLogger } = require("../../shared/request-id")

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  finnhubKey: process.env.FINNHUB_API_KEY || "",
  alpacaKey: process.env.ALPACA_API_KEY || process.env.ALPACA_KEY || "",
  alpacaSecret:
    process.env.ALPACA_API_SECRET ||
    process.env.ALPACA_API_SECRET_KEY ||
    process.env.ALPACA_SECRET ||
    "",
  polygonKey: process.env.POLYGON_API_KEY || "",
  tiingoKey: process.env.TIINGO_API_KEY || "",
  intrinioKey: process.env.INTRINIO_API_KEY || "",
  stockdataKey: process.env.STOCKDATA_API_KEY || process.env.STOCKDATA_TOKEN || "",
  twelvedataKey: process.env.TWELVEDATA_API_KEY || "",
  alphavantageKey: process.env.ALPHAVANTAGE_API_KEY || "",
  marketauxKey: process.env.MARKETAUX_API_KEY || "",
  port: parseInt(process.env.PORT || "8080", 10),
  finnhubBaseUrl: process.env.FINNHUB_BASE_URL || "https://finnhub.io/api/v1",
  alpacaBaseUrl: process.env.ALPACA_DATA_BASE_URL || "https://data.alpaca.markets/v2",
  polygonBaseUrl: process.env.POLYGON_BASE_URL || "https://api.polygon.io",
  tiingoBaseUrl: process.env.TIINGO_BASE_URL || "https://api.tiingo.com",
  intrinioBaseUrl: process.env.INTRINIO_BASE_URL || "https://api-v2.intrinio.com",
  stockdataBaseUrl: process.env.STOCKDATA_BASE_URL || "https://api.stockdata.org/v1",
  twelvedataBaseUrl: process.env.TWELVEDATA_BASE_URL || "https://api.twelvedata.com",
  alphavantageBaseUrl: process.env.ALPHAVANTAGE_BASE_URL || "https://www.alphavantage.co",
  marketauxBaseUrl: process.env.MARKETAUX_BASE_URL || "https://api.marketaux.com/v1/news/all",
  nasdaqListedUrl:
    process.env.NASDAQ_LISTED_URL ||
    "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
  nasdaqOtherListedUrl:
    process.env.NASDAQ_OTHER_LISTED_URL ||
    "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
  nasdaqUserAgent: process.env.NASDAQ_USER_AGENT || "relayorb/1.0",
  cacheDefaultMs: parseInt(process.env.MDG_CACHE_TTL_MS || "15000", 10),
  cacheCandlesMs: parseInt(process.env.MDG_CANDLES_TTL_MS || "60000", 10),
  cacheMarketsMs: parseInt(process.env.MDG_MARKETS_TTL_MS || "60000", 10),
  cacheNewsMs: parseInt(process.env.MDG_NEWS_TTL_MS || "120000", 10),
  cacheStockListMs: parseInt(process.env.MDG_STOCK_LIST_TTL_MS || "21600000", 10),
  cryptoQuoteConcurrency: parseInt(process.env.MDG_CRYPTO_QUOTE_CONCURRENCY || "6", 10),
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  pipelineEventsEnabled: process.env.PIPELINE_EVENTS_ENABLED !== "false",
  pipelineEventsStream: process.env.PIPELINE_EVENTS_STREAM || "",
  pipelineEventsMaxlen: parseInt(process.env.PIPELINE_EVENTS_MAXLEN || "20000", 10),
  pipelineEventsRunEnv: process.env.PIPELINE_EVENTS_RUN_ENV || "prod",
  corsOrigins:
    process.env.MDG_CORS_ORIGINS ||
    process.env.CORS_ORIGINS ||
    process.env.MDG_CORS_ORIGIN ||
    "*",
  corsAllowHeaders: process.env.MDG_CORS_HEADERS || "Content-Type, Authorization",
  replayAllowed: process.env.REPLAY_ALLOWED !== "false",
  replayBucket: process.env.REPLAY_GCS_BUCKET || process.env.REPLAY_BUCKET || "",
  replayPrefix: process.env.REPLAY_GCS_PREFIX || "replay",
  replayControlsCacheMs: parseInt(process.env.REPLAY_CONTROLS_CACHE_MS || "1500", 10),
  replayRunCacheMs: parseInt(process.env.REPLAY_RUN_CACHE_MS || "10000", 10),
  replayManifestCacheMs: parseInt(process.env.REPLAY_MANIFEST_CACHE_MS || "10000", 10),
  replayArtifactCacheMs: parseInt(process.env.REPLAY_ARTIFACT_CACHE_MS || "60000", 10),
  replayAckIntervalMs: parseInt(process.env.REPLAY_ACK_INTERVAL_MS || "15000", 10),
  replayBuildEnabled: process.env.REPLAY_BUILD_ENABLED === "true",
  replayBuildMaxSymbols: parseInt(process.env.REPLAY_BUILD_MAX_SYMBOLS || "150", 10),
  replayBuildConcurrency: parseInt(process.env.REPLAY_BUILD_CONCURRENCY || "3", 10),
  replayBuildLookbackDays: parseInt(process.env.REPLAY_BUILD_LOOKBACK_DAYS || "120", 10),
  healthWriteMs: parseInt(process.env.MDG_HEALTH_WRITE_MS || "30000", 10),
}

const providerRotationStrategy = (process.env.MDG_PROVIDER_ROTATION || "round_robin").toLowerCase()
const providerRotationEnabled = !["off", "disabled", "false"].includes(providerRotationStrategy)
const providerCooldownMs = parseInt(process.env.MDG_PROVIDER_COOLDOWN_MS || "60000", 10)
const providerRateLimitCooldownMs = parseInt(process.env.MDG_RATE_LIMIT_COOLDOWN_MS || "300000", 10)
const providerRotationState = {
  counters: new Map(),
  cooldowns: new Map(),
  lastSuccess: new Map(),
  globalCooldowns: new Map(),
}

const rateLimitConfig = {
  enabled: process.env.MDG_RATE_LIMIT_ENABLED !== "false",
  windowMs: parseInt(process.env.MDG_RATE_LIMIT_WINDOW_MS || "60000", 10),
  max: parseInt(process.env.MDG_RATE_LIMIT_MAX || "240", 10),
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

assertRemoteOnly("market-data-gateway")
assertUsWest1("market-data-gateway")

const cache = new Map()
let pipelineRedis = null
let pipelineRedisReady = false
let firestore = null
let storage = null
const replayControlsCache = { value: null, expiresAt: 0 }
const replayRunCache = new Map()
const replayManifestCache = { value: null, expiresAt: 0, key: "" }
const replayArtifactCache = new Map()
const replayAckState = { lastSentAt: 0, lastSessionId: null, lastVersion: null, lastMode: null }
let lastReplayState = { mode: "live", runId: null, sessionId: null }
const MDG_HEALTH_DOC = "pipeline/market_data_gateway"
let lastHealthWriteAt = 0

function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, ...data }))
}

function applyCorsHeaders(res, req) {
  const origin = resolveCorsOrigin(req)
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", config.corsAllowHeaders)
  res.setHeader("Access-Control-Max-Age", "86400")
  return { origin, allowed: isCorsAllowed(req) }
}

const rateLimitState = new Map()

function resolveClientIp(req) {
  const header =
    req?.headers?.["x-forwarded-for"] ||
    req?.headers?.["x-real-ip"] ||
    req?.socket?.remoteAddress ||
    ""
  if (Array.isArray(header)) return header[0]
  if (typeof header === "string" && header.includes(",")) {
    return header.split(",")[0].trim()
  }
  return String(header || "")
}

function checkRateLimit(req) {
  if (!rateLimitConfig.enabled) return { allowed: true, remaining: null }
  if (req?.headers?.authorization) {
    return { allowed: true, remaining: null, resetAt: null }
  }
  const key = resolveClientIp(req) || "unknown"
  const now = Date.now()
  const windowMs = Math.max(rateLimitConfig.windowMs || 0, 1000)
  const max = Math.max(rateLimitConfig.max || 0, 1)
  const entry = rateLimitState.get(key) || { count: 0, resetAt: now + windowMs }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }
  entry.count += 1
  rateLimitState.set(key, entry)
  const allowed = entry.count <= max
  return { allowed, remaining: Math.max(max - entry.count, 0), resetAt: entry.resetAt }
}

function getCachedEntry(key, allowStale = false) {
  const entry = cache.get(key)
  if (!entry) return null
  const now = Date.now()
  const expired = entry.expiresAt <= now
  if (expired && !allowStale) {
    cache.delete(key)
    return null
  }
  if (!expired) {
    logEvent("mdg_cache_hit", { key })
  }
  return {
    value: entry.value,
    expiresAt: entry.expiresAt,
    storedAt: entry.storedAt || entry.expiresAt,
    stale: expired,
  }
}

function getCached(key) {
  const entry = getCachedEntry(key, false)
  return entry ? entry.value : null
}

function getCachedStale(key) {
  return getCachedEntry(key, true)
}

function setCached(key, value, ttlMs) {
  const now = Date.now()
  cache.set(key, {
    value,
    storedAt: now,
    expiresAt: now + Math.max(ttlMs, 0),
  })
}

function resolvePipelineStream() {
  if (lastReplayState?.mode === "replay" && lastReplayState.runId) {
    return `replay:${lastReplayState.runId}:pipeline_events`
  }
  if (config.pipelineEventsStream) return config.pipelineEventsStream
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}pipeline_events`
}

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

function sanitizeUrl(rawUrl) {
  if (!rawUrl) return ""
  try {
    const parsed = new URL(rawUrl)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch (_) {
    return String(rawUrl).split("?")[0]
  }
}

function parseCorsOrigins(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

const resolvedCorsOrigins = parseCorsOrigins(config.corsOrigins)
const corsAllowAll = resolvedCorsOrigins.length === 0 || resolvedCorsOrigins.includes("*")

function resolveCorsOrigin(req) {
  const origin = req?.headers?.origin ? String(req.headers.origin) : ""
  if (!origin) return corsAllowAll ? "*" : ""
  if (corsAllowAll) return "*"
  return resolvedCorsOrigins.includes(origin) ? origin : ""
}

function isCorsAllowed(req) {
  const origin = req?.headers?.origin ? String(req.headers.origin) : ""
  if (!origin) return true
  if (corsAllowAll) return true
  return resolvedCorsOrigins.includes(origin)
}

function buildPipelineEvent(payload) {
  const runEnv = lastReplayState?.mode === "replay" ? "replay" : config.pipelineEventsRunEnv
  const runId = lastReplayState?.mode === "replay" ? lastReplayState?.runId || undefined : undefined
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv,
    runId,
    sessionId: lastReplayState?.sessionId || undefined,
    service: "market-data-gateway",
    severity: "info",
    ...payload,
  }
}

async function publishPipelineEvent(event) {
  if (!config.pipelineEventsEnabled || !pipelineRedis || !pipelineRedisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(config.pipelineEventsMaxlen)
    ? Math.max(config.pipelineEventsMaxlen, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ["XADD", stream, "MAXLEN", "~", String(maxlen), "*", "payload", payload]
  try {
    await Promise.race([
      pipelineRedis.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    console.error("Pipeline event publish failed:", err.message)
  }
}

async function emitProviderEvent({ stationId, status, startMs, meta, error }) {
  const durationMs = startMs ? Date.now() - startMs : undefined
  const providerStation = stationId || "provider:unknown"
  const edgeKey = `market_data_gateway->${providerStation}`
  const nodeIds = ["market_data_gateway", providerStation]
  const providerMeta = meta || {}
  const endpointName = providerMeta.endpointName
  const paramsHash = providerMeta.paramsHash
  const providerId = providerMeta.providerId
  const base = {
    status,
    durationMs,
    severity: status === "error" ? "error" : "info",
    meta: {
      ...providerMeta,
      latencyMs: durationMs,
    },
    inputs: providerId || endpointName
      ? {
        providerCalls: [
          {
            providerId,
            endpointName,
            paramsHash,
            cacheHit: providerMeta.cacheHit,
          },
        ],
      }
      : undefined,
    error: error || undefined,
  }
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "mdg",
      eventType: "provider_call",
      edgeKey,
      nodeIds,
      ...base,
    })
  )
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: providerStation,
      eventType: "provider_call",
      edgeKey,
      nodeIds,
      ...base,
    })
  )
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePercent(value) {
  if (value === undefined || value === null) return undefined
  const cleaned = String(value).replace(/[()%]/g, "").trim()
  if (!cleaned) return undefined
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function mapIntervalToSeries(interval) {
  const mapping = {
    "1min": "1min",
    "5min": "5min",
    "15min": "15min",
    "30min": "30min",
    "1hour": "1hour",
    "1h": "1hour",
    "4h": "4hour",
    "1day": "1day",
    "1week": "1week",
    "eod": "1day",
  }
  return mapping[interval] || "15min"
}

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function normalizeSymbol(raw) {
  if (!raw) return null
  const upper = String(raw).toUpperCase().trim()
  if (!upper) return null
  const compact = upper.replace(/\s+/g, "")
  if (compact.includes("/") || compact.includes("-")) {
    const separator = compact.includes("/") ? "/" : "-"
    const parts = compact.split(separator).filter(Boolean)
    if (parts.length === 2) return `${parts[0]}/${parts[1]}`
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

function normalizeMarketSymbol(symbol, assetClass) {
  if (!symbol) return ""
  const upper = String(symbol).trim().toUpperCase()
  if (!upper) return ""
  if (assetClass === "forex" || assetClass === "crypto") {
    return upper.replace(/[\/-]/g, "")
  }
  return upper.replace(/\s+/g, "")
}

function normalizeQuoteSymbol(symbol, assetClass) {
  if (!symbol) return null
  if (assetClass === "stock") return normalizeTicker(symbol)
  if (assetClass === "forex") {
    const normalized = normalizeSymbol(symbol)
    return normalized ? normalized.replace("/", "") : null
  }
  const normalized = normalizeSymbol(symbol)
  if (!normalized) return null
  if (normalized.includes("/")) {
    const [base, quoteRaw] = normalized.split("/")
    if (!base || !quoteRaw) return null
    const quote = quoteRaw === "USDT" ? "USD" : quoteRaw
    return `${base}${quote}`
  }
  return normalized
}

function chunkList(items, size) {
  const chunkSize = Math.max(1, size || 1)
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function isRateLimitError(err) {
  const message = String(err?.message || "")
  return (
    message.includes("429") ||
    /rate limit/i.test(message) ||
    /limit reach/i.test(message) ||
    /quota/i.test(message) ||
    /bandwidth/i.test(message) ||
    /credits/i.test(message)
  )
}

function getRotationKey(endpointName, assetClass) {
  return `${endpointName || "market"}:${assetClass || "all"}`
}

function nextRotationIndex(key, size) {
  if (!providerRotationEnabled || size <= 1) return 0
  const current = providerRotationState.counters.get(key) || 0
  const next = (current + 1) % size
  providerRotationState.counters.set(key, next)
  return current % size
}

function rotateProviders(list, start) {
  if (!start) return list
  return list.slice(start).concat(list.slice(0, start))
}

function isProviderCoolingDown(endpointName, providerId) {
  const globalEntry = providerRotationState.globalCooldowns.get(providerId)
  if (globalEntry) {
    if (Date.now() >= globalEntry.until) {
      providerRotationState.globalCooldowns.delete(providerId)
    } else {
      return true
    }
  }
  const key = `${endpointName}:${providerId}`
  const entry = providerRotationState.cooldowns.get(key)
  if (!entry) return false
  if (Date.now() >= entry.until) {
    providerRotationState.cooldowns.delete(key)
    return false
  }
  return true
}

function markProviderCooldown(endpointName, providerId, err) {
  if (!providerRotationEnabled) return
  const key = `${endpointName}:${providerId}`
  const cooldownMs = isRateLimitError(err) ? providerRateLimitCooldownMs : providerCooldownMs
  providerRotationState.cooldowns.set(key, {
    until: Date.now() + cooldownMs,
    reason: err?.message ? String(err.message).slice(0, 200) : "provider error",
  })
  providerRotationState.globalCooldowns.set(providerId, {
    until: Date.now() + cooldownMs,
    reason: err?.message ? String(err.message).slice(0, 200) : "provider error",
  })
}

function markProviderSuccess(endpointName, rotationKey, providerId) {
  if (!providerRotationEnabled || !providerId) return
  const key = `${endpointName}:${rotationKey}`
  providerRotationState.lastSuccess.set(key, providerId)
  providerRotationState.cooldowns.delete(`${endpointName}:${providerId}`)
  providerRotationState.globalCooldowns.delete(providerId)
}

function orderProviders(providers, rotationKey, endpointName) {
  const enabled = providers.filter((provider) => provider.enabled)
  if (!providerRotationEnabled || enabled.length <= 1) return enabled
  const start = nextRotationIndex(rotationKey, enabled.length)
  const rotated = rotateProviders(enabled, start)
  const available = rotated.filter((provider) => !isProviderCoolingDown(endpointName, provider.id))
  const ordered = available.length ? available : rotated
  const successKey = `${endpointName}:${rotationKey}`
  const lastSuccess = providerRotationState.lastSuccess.get(successKey)
  if (lastSuccess) {
    const idx = ordered.findIndex((provider) => provider.id === lastSuccess)
    if (idx > 0) {
      const [preferred] = ordered.splice(idx, 1)
      ordered.unshift(preferred)
    }
  }
  return ordered
}

async function fetchJson(url, options = {}) {
  logEvent("mdg_request", { url: sanitizeUrl(url) })

  const { timeoutMs = 15000, ...fetchOptions } = options
  // Add timeout to prevent hanging requests
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 429) {
        logEvent("mdg_rate_limited", { url: sanitizeUrl(url), status: res.status })
        console.error(`Rate limit exceeded (429): ${sanitizeUrl(url)}`)
      }
      throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${sanitizeUrl(url)}`)
    }
    throw err
  }
}

async function fetchJsonWithRetry(url, options = {}, attempts = 2, backoffMs = 500) {
  let lastErr
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchJson(url, options)
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        const baseDelay = backoffMs * Math.pow(2, i)
        const jitter = Math.floor(Math.random() * 200)
        const delay = Math.min(baseDelay + jitter, 8000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastErr
}

async function fetchText(url, options = {}) {
  logEvent("mdg_request", { url: sanitizeUrl(url) })

  // Add 15s timeout to prevent hanging requests
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 429) {
        logEvent("mdg_rate_limited", { url: sanitizeUrl(url), status: res.status })
        console.error(`Rate limit exceeded (429): ${sanitizeUrl(url)}`)
      }
      throw new Error(`Request failed ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.text()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after 15s: ${sanitizeUrl(url)}`)
    }
    throw err
  }
}

async function initPipelineRedis() {
  if (!config.redisUrl || !config.pipelineEventsEnabled) return
  pipelineRedis = createClient({ url: config.redisUrl })
  pipelineRedis.on("error", (err) => {
    const message = err?.message ? String(err.message) : "Unknown error"
    console.error("Pipeline redis error:", message)
    pipelineRedisReady = false
  })
  try {
    await pipelineRedis.connect()
    pipelineRedisReady = true
  } catch (err) {
    console.error("Pipeline redis connect failed:", err.message)
    pipelineRedis = null
    pipelineRedisReady = false
  }
}

function parseCsvRows(text) {
  const rows = []
  let row = []
  let value = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(value)
      value = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1
      }
      row.push(value)
      if (row.length > 1 || row[0]) {
        rows.push(row)
      }
      row = []
      value = ""
      continue
    }

    value += char
  }

  if (row.length > 0 || value) {
    row.push(value)
    rows.push(row)
  }

  return rows
}

function parseStockList(csvText) {
  if (!csvText) return []
  const rows = parseCsvRows(csvText)
  if (rows.length === 0) return []
  const header = rows[0].map((col) => String(col || "").trim().toLowerCase())
  const symbolIndex = header.indexOf("symbol")
  const nameIndex = header.indexOf("name")
  const exchangeIndex = header.indexOf("exchange")
  const typeIndex = header.indexOf("type")

  return rows.slice(1).map((row) => {
    const symbol = normalizeTicker(row[symbolIndex] || "")
    if (!symbol) return null
    return {
      symbol,
      name: row[nameIndex] || symbol,
      exchange: row[exchangeIndex] || undefined,
      assetType: row[typeIndex] || undefined,
    }
  }).filter(Boolean)
}

const OTHER_LISTED_EXCHANGE_MAP = {
  N: "NYSE",
  A: "AMEX",
  P: "ARCA",
  Z: "BATS",
  V: "IEX",
}

function parseNasdaqListing(text, isOtherListed = false) {
  if (!text) return []
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split("|")
  const rows = lines.slice(1).filter((line) => !line.startsWith("File Creation Time"))
  const items = []

  const lookup = (field) => header.findIndex((col) => col === field)
  const symbolIndex = lookup(isOtherListed ? "ACT Symbol" : "Symbol")
  const nameIndex = lookup("Security Name")
  const exchangeIndex = lookup("Exchange")
  const testIndex = lookup("Test Issue")
  const etfIndex = lookup("ETF")

  for (const row of rows) {
    const parts = row.split("|")
    const symbol = normalizeTicker(parts[symbolIndex] || "")
    if (!symbol) continue
    const testIssue = parts[testIndex] || ""
    if (testIssue === "Y") continue
    const exchangeCode = parts[exchangeIndex] || ""
    const exchange = isOtherListed
      ? OTHER_LISTED_EXCHANGE_MAP[exchangeCode] || exchangeCode || undefined
      : "NASDAQ"
    const isEtf = (parts[etfIndex] || "").trim() === "Y"
    const name = parts[nameIndex] || symbol
    items.push({
      symbol,
      name,
      exchange,
      assetType: isEtf ? "etf" : "stock",
    })
  }
  return items
}

async function loadSymbolMaster() {
  const cacheKey = "market:symbol-master"
  const cached = getCached(cacheKey)
  if (cached) return cached

  const headers = config.nasdaqUserAgent
    ? { headers: { "User-Agent": config.nasdaqUserAgent } }
    : undefined
  const [nasdaqText, otherText] = await Promise.all([
    fetchText(config.nasdaqListedUrl, headers),
    fetchText(config.nasdaqOtherListedUrl, headers),
  ])
  const nasdaqItems = parseNasdaqListing(nasdaqText, false)
  const otherItems = parseNasdaqListing(otherText, true)
  const merged = new Map()
  nasdaqItems.forEach((item) => merged.set(item.symbol, item))
  otherItems.forEach((item) => {
    if (!merged.has(item.symbol)) merged.set(item.symbol, item)
  })
  const items = Array.from(merged.values())
  const payload = { items, source: "nasdaq" }
  setCached(cacheKey, payload, config.cacheStockListMs)
  return payload
}

function respondJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function respondError(res, status, code, message, detail) {
  const payload = { error: message, code }
  if (detail) payload.detail = detail
  respondJson(res, status, payload)
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (!chunks.length) return null
  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error("Invalid JSON body")
  }
}

function parseSymbolsInput(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    return raw.split(",")
  }
  return []
}

function normalizeSymbolList(raw) {
  const list = parseSymbolsInput(raw)
    .map((value) => String(value || "").trim())
    .filter(Boolean)
  return Array.from(new Set(list))
}

function mapExchangeHintToVenue(exchangeHint) {
  if (!exchangeHint) return { venue: "US", exchangeMeta: null }
  const upper = String(exchangeHint).trim().toUpperCase()
  if (upper.includes("NASDAQ")) return { venue: "US", exchangeMeta: "NASDAQ" }
  if (upper.includes("NYSE")) return { venue: "US", exchangeMeta: "NYSE" }
  if (upper.includes("AMEX")) return { venue: "US", exchangeMeta: "AMEX" }
  return { venue: "US", exchangeMeta: upper }
}

function resolveVenueInfo(rawSymbol, exchangeHint) {
  const mapped = mapExchangeHintToVenue(exchangeHint)
  return { ...mapped, suffixMatch: false }
}

function normalizeSymbolKeyV2(rawSymbol, venue) {
  if (!rawSymbol) return null
  let normalized = normalizeTicker(rawSymbol) || normalizeSymbol(rawSymbol)
  if (!normalized) return null
  return normalized
}

function initFirestore() {
  if (!firestore) {
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: config.projectId })
    }
    firestore = admin.firestore()
  }
  return firestore
}

function initStorage() {
  if (!storage) {
    storage = new Storage({ projectId: config.projectId })
  }
  return storage
}

async function writeHealthStatus() {
  const now = Date.now()
  if (now - lastHealthWriteAt < Math.max(config.healthWriteMs, 5000)) return
  lastHealthWriteAt = now
  try {
    const db = initFirestore()
    await db.doc(MDG_HEALTH_DOC).set(
      {
        status: "ok",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          cacheSize: cache.size,
          replayMode: lastReplayState?.mode || "live",
          providerRotation: providerRotationEnabled ? providerRotationStrategy : "off",
        },
      },
      { merge: true }
    )
  } catch (err) {
    console.error("MDG health write failed:", err?.message || err)
  }
}

function parseReplayAsOf(value) {
  if (!value) return null
  if (typeof value.toDate === "function") return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseTimeToMinutes(raw) {
  if (!raw) return null
  const parts = String(raw).split(":").map((value) => parseInt(value, 10))
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null
  return parts[0] * 60 + parts[1]
}

function formatDateKeyFromParts(parts) {
  const pad = (value) => String(value).padStart(2, "0")
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function getLocalDateParts(timestampMs, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date(timestampMs))
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const year = parseInt(lookup.year, 10)
  const month = parseInt(lookup.month, 10)
  const day = parseInt(lookup.day, 10)
  let hour = parseInt(lookup.hour, 10)
  const minute = parseInt(lookup.minute, 10)
  const second = parseInt(lookup.second, 10)
  if (hour === 24) {
    // Some locales report 24:xx for midnight; normalize to 00:xx for tapeDate math.
    hour = 0
  }
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateKey: formatDateKeyFromParts({ year, month, day }),
    minutesOfDay: hour * 60 + minute,
  }
}

function buildClockPayload(replayState) {
  const serverNow = new Date()
  const mode = replayState?.mode === "replay" ? "replay" : "live"
  let now = serverNow
  let replay = null

  if (mode === "replay") {
    if (!replayState?.asOf) {
      return {
        ok: false,
        mode,
        error: "Replay asOf missing",
        runId: replayState?.runId || null,
        sessionId: replayState?.sessionId || null,
      }
    }
    now = replayState.asOf
    replay = {
      runId: replayState.runId || null,
      sessionId: replayState.sessionId || null,
      phase: replayState.phase || null,
      datasetId: replayState.datasetId || null,
      asOf: now.toISOString(),
      asOfMs: now.getTime(),
    }
  }

  const nowMs = now.getTime()
  const timezone = "America/New_York"
  const local = getLocalDateParts(nowMs, timezone)
  return {
    ok: true,
    mode,
    now: now.toISOString(),
    nowMs,
    serverTime: serverNow.toISOString(),
    timezone,
    dateKey: local.dateKey,
    minutesOfDay: local.minutesOfDay,
    replay,
  }
}

function shiftDateKey(dateKey, deltaDays) {
  if (!dateKey) return null
  const [year, month, day] = dateKey.split("-").map((value) => parseInt(value, 10))
  if (!year || !month || !day) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  const nextYear = date.getUTCFullYear()
  const nextMonth = date.getUTCMonth() + 1
  const nextDay = date.getUTCDate()
  return formatDateKeyFromParts({ year: nextYear, month: nextMonth, day: nextDay })
}

function buildCacheKey(baseKey, replayState, options = {}) {
  if (!replayState || replayState.mode !== "replay") return `live:${baseKey}`
  const bucketMs = options.bucketMs || 60000
  const asOfBucket =
    typeof options.asOfMs === "number" && Number.isFinite(options.asOfMs)
      ? `:asof:${Math.floor(options.asOfMs / bucketMs)}`
      : ""
  const runId = replayState.runId || "unknown"
  const sessionId = replayState.sessionId || "unknown"
  return `replay:${runId}:${sessionId}:${baseKey}${asOfBucket}`
}

function buildReplayMissingPayload({
  legacyKey,
  symbolKeyV2,
  artifact,
  tapeDate,
  runId,
}) {
  return {
    code: "REPLAY_TAPE_MISSING",
    legacyKey,
    symbolKeyV2,
    artifact,
    tapeDate,
    runId,
  }
}

function buildReplayOutOfCoveragePayload({
  legacyKey,
  symbolKeyV2,
  tapeDate,
  runId,
  asOf,
  coverageWindow,
}) {
  return {
    code: "REPLAY_OUT_OF_COVERAGE",
    legacyKey,
    symbolKeyV2,
    tapeDate,
    runId,
    asOf,
    coverageWindow,
  }
}

function respondReplayError(res, status, payload) {
  respondJson(res, status, payload)
}

function respondReplayUnsupported(res, detail) {
  respondReplayError(res, 409, { code: "REPLAY_UNSUPPORTED", detail })
}

function normalizeLegacySymbol(symbol, assetClass) {
  if (assetClass === "stock") return normalizeTicker(symbol)
  if (assetClass === "crypto" || assetClass === "forex") return normalizeSymbol(symbol)
  return normalizeSymbol(symbol) || normalizeTicker(symbol)
}

function normalizeRunId(value) {
  if (!value) return null
  const cleaned = String(value).trim()
  if (!cleaned) return null
  const normalized = cleaned.replace(/[\\/]/g, "-").replace(/\s+/g, "-")
  return normalized.slice(0, 120)
}

function normalizeRunLabel(value, fallback) {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 160)
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim().slice(0, 160)
  return "Replay run"
}

function normalizeTapeDate(value) {
  if (!value) return null
  const trimmed = String(value).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function normalizeTagList(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12)
  }
  return []
}

function normalizeSymbolSource(value) {
  if (!value) return null
  const cleaned = String(value).trim().toLowerCase()
  if (cleaned === "auto" || cleaned === "auto-discover" || cleaned === "autodiscover") {
    return "auto"
  }
  if (cleaned === "default" || cleaned === "default-list") return "default"
  if (cleaned === "custom" || cleaned === "custom-list") return "custom"
  return null
}

function parseOptionalIntValue(value) {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeAutoDiscoverConfig(value) {
  if (!value || typeof value !== "object") return null
  const config = {}
  if (typeof value.includeUniverse === "boolean") {
    config.includeUniverse = value.includeUniverse
  }
  const smallCapMinMarketCap = parseOptionalIntValue(value.smallCapMinMarketCap)
  if (smallCapMinMarketCap !== undefined) {
    config.smallCapMinMarketCap = smallCapMinMarketCap
  }
  const smallCapMaxMarketCap = parseOptionalIntValue(value.smallCapMaxMarketCap)
  if (smallCapMaxMarketCap !== undefined) {
    config.smallCapMaxMarketCap = smallCapMaxMarketCap
  }
  const smallCapMinVolume = parseOptionalIntValue(value.smallCapMinVolume)
  if (smallCapMinVolume !== undefined) {
    config.smallCapMinVolume = smallCapMinVolume
  }
  const midCapMinMarketCap = parseOptionalIntValue(value.midCapMinMarketCap)
  if (midCapMinMarketCap !== undefined) {
    config.midCapMinMarketCap = midCapMinMarketCap
  }
  const midCapMaxMarketCap = parseOptionalIntValue(value.midCapMaxMarketCap)
  if (midCapMaxMarketCap !== undefined) {
    config.midCapMaxMarketCap = midCapMaxMarketCap
  }
  const midCapMinVolume = parseOptionalIntValue(value.midCapMinVolume)
  if (midCapMinVolume !== undefined) {
    config.midCapMinVolume = midCapMinVolume
  }
  return Object.keys(config).length ? config : null
}

function buildReplayRunId(tapeDate) {
  const dateKey = normalizeTapeDate(tapeDate) || new Date().toISOString().slice(0, 10)
  const suffix = crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `replay-${dateKey}-${suffix}`
}

function buildLegacyKey(symbol, assetClass) {
  const normalized = normalizeLegacySymbol(symbol, assetClass)
  if (!normalized) return null
  return `${assetClass}:${normalized}`
}

async function readReplayControls() {
  if (!config.replayAllowed) return null
  if (replayControlsCache.expiresAt > Date.now() && replayControlsCache.value) {
    return replayControlsCache.value
  }
  try {
    const db = initFirestore()
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

function formatReplayRun(runId, data) {
  const createdAt = typeof data?.createdAt?.toDate === "function"
    ? data.createdAt.toDate().toISOString()
    : null
  const updatedAt = typeof data?.updatedAt?.toDate === "function"
    ? data.updatedAt.toDate().toISOString()
    : null
  return {
    runId,
    label: typeof data?.label === "string" ? data.label : undefined,
    datasetId: typeof data?.datasetId === "string" ? data.datasetId : undefined,
    tapeDate: typeof data?.tapeDate === "string" ? data.tapeDate : undefined,
    symbolCount: typeof data?.symbolCount === "number" ? data.symbolCount : undefined,
    manifestPath: typeof data?.manifestPath === "string" ? data.manifestPath : undefined,
    notes: typeof data?.notes === "string" ? data.notes : undefined,
    tags: Array.isArray(data?.tags) ? data.tags : undefined,
    symbolSource: normalizeSymbolSource(data?.symbolSource) || undefined,
    autoDiscoverConfig: normalizeAutoDiscoverConfig(data?.autoDiscoverConfig) || undefined,
    maxSymbols: parseOptionalIntValue(data?.maxSymbols),
    createdAt,
    updatedAt,
  }
}

function isReplayRunComplete(run) {
  if (!run || !run.datasetId || !run.symbolSource) return false
  if (typeof run.symbolCount !== "number" || !Number.isFinite(run.symbolCount)) return false
  if (run.symbolSource === "auto") {
    if (!run.autoDiscoverConfig || typeof run.maxSymbols !== "number") return false
  }
  return true
}

async function loadReplayRunInfo(runId) {
  if (!runId) return null
  const cached = replayRunCache.get(runId)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  try {
    const db = initFirestore()
    const snap = await db.doc(`replay/controls/runs/${runId}`).get()
    const data = snap.exists ? snap.data() : null
    replayRunCache.set(runId, {
      value: data,
      expiresAt: Date.now() + config.replayRunCacheMs,
    })
    return data
  } catch (err) {
    console.error("Replay run read failed:", err.message)
    return null
  }
}

async function registerReplayRun(payload) {
  const datasetId = typeof payload?.datasetId === "string" ? payload.datasetId.trim() : ""
  if (!datasetId) {
    throw new Error("Missing datasetId")
  }
  const tapeDate = normalizeTapeDate(payload?.tapeDate) || normalizeTapeDate(datasetId)
  const runId = normalizeRunId(payload?.runId) || buildReplayRunId(tapeDate)
  const label = normalizeRunLabel(payload?.label, datasetId)
  const symbolCount = Number.isFinite(Number(payload?.symbolCount))
    ? Math.max(0, Math.round(Number(payload.symbolCount)))
    : undefined
  const manifestPath = typeof payload?.manifestPath === "string" ? payload.manifestPath.trim() : ""
  const notes = typeof payload?.notes === "string" ? payload.notes.trim() : ""
  const tags = normalizeTagList(payload?.tags)
  const source = typeof payload?.source === "string" ? payload.source.trim() : "ui"
  const symbolSource = normalizeSymbolSource(payload?.symbolSource)
  const maxSymbols = parseOptionalIntValue(payload?.maxSymbols)
  const autoDiscoverConfig = normalizeAutoDiscoverConfig(payload?.autoDiscoverConfig)

  if (!symbolSource) {
    throw new Error("Missing symbolSource")
  }
  if (typeof symbolCount !== "number" || symbolCount <= 0) {
    throw new Error("Missing symbolCount")
  }
  if (symbolSource === "auto") {
    if (!autoDiscoverConfig) {
      throw new Error("Missing autoDiscoverConfig")
    }
    if (typeof maxSymbols !== "number" || maxSymbols <= 0) {
      throw new Error("Missing maxSymbols")
    }
  }

  const db = initFirestore()
  const ref = db.doc(`replay/controls/runs/${runId}`)
  const existing = await ref.get().catch(() => null)
  const response = {
    runId,
    label,
    datasetId,
    source,
  }
  if (tapeDate) response.tapeDate = tapeDate
  if (typeof symbolCount === "number") response.symbolCount = symbolCount
  if (manifestPath) response.manifestPath = manifestPath
  if (notes) response.notes = notes
  if (tags.length) response.tags = tags
  if (symbolSource) response.symbolSource = symbolSource
  if (typeof maxSymbols === "number") response.maxSymbols = maxSymbols
  if (autoDiscoverConfig) response.autoDiscoverConfig = autoDiscoverConfig
  const patch = {
    ...response,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (!existing?.exists) {
    patch.createdAt = admin.firestore.FieldValue.serverTimestamp()
  }
  await ref.set(patch, { merge: true })
  replayRunCache.delete(runId)
  const now = new Date().toISOString()
  return {
    ...response,
    createdAt: existing?.exists ? undefined : now,
    updatedAt: now,
  }
}

async function listReplayRuns(limit) {
  const safeLimit = clamp(Number(limit) || 50, 1, 200)
  try {
    const db = initFirestore()
    const snap = await db
      .collection("replay/controls/runs")
      .orderBy("createdAt", "desc")
      .limit(safeLimit)
      .get()
    return snap.docs
      .map((doc) => formatReplayRun(doc.id, doc.data()))
      .filter((run) => isReplayRunComplete(run))
  } catch (err) {
    console.error("Replay run list failed:", err.message)
    return []
  }
}

async function resolveReplayState() {
  const controls = await readReplayControls()
  const desiredMode = controls?.desiredMode === "replay" ? "replay" : "live"
  if (!config.replayAllowed || desiredMode !== "replay") {
    lastReplayState = { mode: "live", runId: null, sessionId: null }
    return { mode: "live", controls }
  }
  const runId = controls?.activeRunId || null
  let datasetId = controls?.datasetId || null
  let runInfo = null
  if (runId) {
    runInfo = await loadReplayRunInfo(runId)
    if (!datasetId && runInfo?.datasetId) {
      datasetId = runInfo.datasetId
    }
  }
  const state = {
    mode: "replay",
    controls,
    runId,
    datasetId,
    runInfo,
    sessionId: controls?.sessionId || null,
    version: controls?.version ?? null,
    phase: controls?.phase || null,
    asOf: parseReplayAsOf(controls?.asOf),
  }
  lastReplayState = {
    mode: "replay",
    runId: state.runId || null,
    sessionId: state.sessionId || null,
  }
  return state
}

async function maybeAckReplayState(state) {
  if (!state || !state.controls) return
  const now = Date.now()
  if (
    replayAckState.lastMode === state.mode &&
    replayAckState.lastSessionId === state.sessionId &&
    replayAckState.lastVersion === state.version &&
    now - replayAckState.lastSentAt < config.replayAckIntervalMs
  ) {
    return
  }
  try {
    const db = initFirestore()
    await db.doc("replay/controls/consumers/mdg").set(
      {
        serviceName: "mdg",
        effectiveMode: state.mode,
        sessionId: state.sessionId || null,
        seenControlsVersion: state.version ?? null,
        activeRunId: state.runId || null,
        datasetId: state.datasetId || null,
        phase: state.phase || null,
        lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    replayAckState.lastSentAt = now
    replayAckState.lastMode = state.mode
    replayAckState.lastSessionId = state.sessionId
    replayAckState.lastVersion = state.version
  } catch (err) {
    console.error("Replay ACK failed:", err.message)
  }
}

function getManifestCacheKey(state, runInfo) {
  const runId = state?.runId || "unknown"
  const datasetId = runInfo?.datasetId || state?.datasetId || "unknown"
  const manifestPath = runInfo?.manifestPath || ""
  return `manifest:${runId}:${datasetId}:${manifestPath}`
}

async function loadReplayManifest(state) {
  if (!state || state.mode !== "replay") return null
  if (!config.replayBucket) return null

  const db = initFirestore()
  let runInfo = state.runInfo || null
  if (!runInfo && state.runId) {
    try {
      const snap = await db.doc(`replay/controls/runs/${state.runId}`).get()
      runInfo = snap.exists ? snap.data() : null
    } catch (err) {
      console.error("Replay run read failed:", err.message)
    }
  }

  const datasetId = runInfo?.datasetId || state.datasetId
  const manifestPath =
    runInfo?.manifestPath ||
    (datasetId ? `${config.replayPrefix}/tapes/stocks/${datasetId}/manifest.json` : null)

  if (!manifestPath) return null

  const cacheKey = getManifestCacheKey(state, { datasetId, manifestPath })
  if (replayManifestCache.key === cacheKey && replayManifestCache.expiresAt > Date.now()) {
    return replayManifestCache.value
  }

  try {
    const bucket = initStorage().bucket(config.replayBucket)
    const file = bucket.file(manifestPath)
    const [contents] = await file.download()
    const manifest = JSON.parse(contents.toString("utf8"))
    replayManifestCache.value = manifest
    replayManifestCache.key = cacheKey
    replayManifestCache.expiresAt = Date.now() + config.replayManifestCacheMs
    return manifest
  } catch (err) {
    console.error("Replay manifest load failed:", err.message)
    return null
  }
}

function deriveTapeDate(asOfMs, manifest) {
  const timezone = manifest?.timezone || "America/New_York"
  const openMinutes = parseTimeToMinutes(manifest?.openTime)
  const local = getLocalDateParts(asOfMs, timezone)
  if (openMinutes !== null && local.minutesOfDay < openMinutes) {
    return shiftDateKey(local.dateKey, -1)
  }
  return local.dateKey
}

function getCoverageWindow(manifest) {
  return {
    coverage: manifest?.coverage || "RTH",
    timezone: manifest?.timezone || "America/New_York",
    openTime: manifest?.openTime || null,
    closeTime: manifest?.closeTime || null,
    extOpenTime: manifest?.extOpenTime || null,
    extCloseTime: manifest?.extCloseTime || null,
  }
}

function isOutOfCoverage(asOfMs, manifest) {
  const coverageWindow = getCoverageWindow(manifest)
  if (coverageWindow.coverage === "FULL") {
    return { outOfCoverage: false, coverageWindow }
  }
  const timezone = coverageWindow.timezone
  const local = getLocalDateParts(asOfMs, timezone)
  const openMinutes = parseTimeToMinutes(
    coverageWindow.coverage === "RTH+EXT" && coverageWindow.extOpenTime
      ? coverageWindow.extOpenTime
      : coverageWindow.openTime
  )
  const closeMinutes = parseTimeToMinutes(
    coverageWindow.coverage === "RTH+EXT" && coverageWindow.extCloseTime
      ? coverageWindow.extCloseTime
      : coverageWindow.closeTime
  )
  if (openMinutes === null || closeMinutes === null) {
    return { outOfCoverage: false, coverageWindow }
  }
  const outOfCoverage = local.minutesOfDay < openMinutes || local.minutesOfDay > closeMinutes
  return { outOfCoverage, coverageWindow }
}

function normalizeReplayCandle(entry) {
  if (!entry) return null
  const rawTime =
    entry.time ??
    entry.t ??
    entry.timestamp ??
    entry.date ??
    entry.datetime ??
    entry.start ??
    null
  const timeMs = parseTimestamp(rawTime)
  const open = parseNumber(entry.open ?? entry.o)
  const high = parseNumber(entry.high ?? entry.h)
  const low = parseNumber(entry.low ?? entry.l)
  const close = parseNumber(entry.close ?? entry.c)
  if (!timeMs || open === undefined || high === undefined || low === undefined || close === undefined) {
    return null
  }
  return {
    time: timeMs,
    open,
    high,
    low,
    close,
    volume: parseNumber(entry.volume ?? entry.v),
  }
}

function normalizeReplayCandles(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.candles)
      ? raw.candles
      : Array.isArray(raw?.data)
        ? raw.data
        : []
  return list.map(normalizeReplayCandle).filter(Boolean).sort((a, b) => a.time - b.time)
}

function aggregateReplayCandles(candles, intervalMs) {
  if (!intervalMs || intervalMs <= 0) return candles
  const buckets = new Map()
  candles.forEach((candle) => {
    const bucketTime = Math.floor(candle.time / intervalMs) * intervalMs
    const existing = buckets.get(bucketTime)
    if (!existing) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? 0,
      })
      return
    }
    existing.high = Math.max(existing.high, candle.high)
    existing.low = Math.min(existing.low, candle.low)
    existing.close = candle.close
    if (typeof candle.volume === "number") {
      existing.volume = (existing.volume ?? 0) + candle.volume
    }
  })
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time)
}

function filterReplayDailyCandles(candles, asOfMs, manifest, sessionDate) {
  const timezone = manifest?.timezone || "America/New_York"
  const closeMinutes = parseTimeToMinutes(manifest?.closeTime)
  const local = getLocalDateParts(asOfMs, timezone)
  const includeCurrent =
    closeMinutes === null ? true : local.minutesOfDay >= closeMinutes && local.dateKey === sessionDate
  return candles.filter((candle) => {
    const candleDate = getLocalDateParts(candle.time, timezone).dateKey
    if (candleDate < sessionDate) return true
    if (candleDate === sessionDate) return includeCurrent
    return false
  })
}

function getArtifactEntry(manifest, symbolKeyV2) {
  if (!manifest || !symbolKeyV2) return null
  if (manifest.artifacts && manifest.artifacts[symbolKeyV2]) return manifest.artifacts[symbolKeyV2]
  if (Array.isArray(manifest.symbols)) {
    const entry = manifest.symbols.find((item) =>
      item?.symbolKeyV2 === symbolKeyV2 ||
      item?.symbol === symbolKeyV2 ||
      item?.key === symbolKeyV2
    )
    if (entry?.artifacts) return entry.artifacts
  }
  return null
}

async function loadReplayArtifact(path, cacheKey, gzip) {
  const cached = replayArtifactCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { payload: cached.value, missing: false }
  }
  try {
    const bucket = initStorage().bucket(config.replayBucket)
    const file = bucket.file(path)
    const [contents] = await file.download()
    const buffer = gzip ? zlib.gunzipSync(contents) : contents
    const payload = JSON.parse(buffer.toString("utf8"))
    replayArtifactCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + config.replayArtifactCacheMs,
    })
    return { payload, missing: false }
  } catch (err) {
    const message = err?.message ? String(err.message) : ""
    if (err?.code === 404 || message.includes("No such object") || message.includes("Not Found")) {
      return { payload: null, missing: true }
    }
    throw err
  }
}

async function writeReplayArtifact(path, payload, gzip) {
  const bucket = initStorage().bucket(config.replayBucket)
  const file = bucket.file(path)
  const raw = Buffer.from(JSON.stringify(payload))
  const data = gzip ? zlib.gzipSync(raw) : raw
  const metadata = gzip
    ? { contentType: "application/json", contentEncoding: "gzip" }
    : { contentType: "application/json" }
  await file.save(data, metadata)
}

function buildQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const bid = parseNumber(entry.bid)
  const ask = parseNumber(entry.ask)
  const volume = parseNumber(entry.volume) ?? parseNumber(entry.avgVolume)
  const change = parseNumber(entry.change)
  const changePercent = parsePercent(
    entry.changesPercentage ?? entry.changePercentage ?? entry.changePercent ?? entry.change
  )
  const dayHigh = parseNumber(entry.dayHigh ?? entry.high)
  const dayLow = parseNumber(entry.dayLow ?? entry.low)
  const previousClose = parseNumber(entry.previousClose ?? entry.prevClose ?? entry.close)
  const open = parseNumber(entry.open ?? entry.opening ?? entry.openPrice)
  const price =
    parseNumber(entry.price) ??
    parseNumber(entry.lastSale) ??
    parseNumber(entry.last) ??
    parseNumber(entry.close) ??
    (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask)

  if (typeof price !== "number") return null

  return {
    ...entry,
    symbol,
    assetClass,
    price,
    bid,
    ask,
    volume,
    change,
    changePercent,
    changePercentage: changePercent,
    dayHigh,
    dayLow,
    previousClose,
    open,
    exchange: entry.exchange || entry.exchangeShortName || undefined,
    name: entry.name || entry.companyName || symbol,
    source: "market",
  }
}

function buildFinnhubQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const price = parseNumber(entry.c)
  if (typeof price !== "number") return null
  const bid = parseNumber(entry.b)
  const ask = parseNumber(entry.a)
  const change = parseNumber(entry.d)
  const changePercent = parseNumber(entry.dp)
  const dayHigh = parseNumber(entry.h)
  const dayLow = parseNumber(entry.l)
  const open = parseNumber(entry.o)
  const previousClose = parseNumber(entry.pc)
  return {
    symbol,
    assetClass,
    price,
    bid,
    ask,
    volume: null,
    change,
    changePercent,
    changePercentage: changePercent,
    dayHigh,
    dayLow,
    previousClose,
    open,
    source: "finnhub",
  }
}

function parseProviderErrorPayload(data) {
  if (!data || typeof data !== "object") return null
  const message =
    data?.["Error Message"] ||
    data?.error ||
    data?.message ||
    data?.Error ||
    data?.Note ||
    data?.Information
  if (typeof message === "string" && message.trim()) return message.trim()
  return null
}

async function fetchFinnhubQuote(symbol) {
  if (!config.finnhubKey) return null
  const url = new URL(`${config.finnhubBaseUrl}/quote`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("token", config.finnhubKey)
  const data = await fetchJson(url.toString())
  return buildFinnhubQuotePayload(data, symbol, "stock")
}

function buildStockDataQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const price =
    parseNumber(entry.price) ??
    parseNumber(entry.last_price) ??
    parseNumber(entry.close) ??
    parseNumber(entry.last) ??
    parseNumber(entry.last_trade_price)
  if (typeof price !== "number") return null
  const bid = parseNumber(entry.bid)
  const ask = parseNumber(entry.ask)
  const change =
    parseNumber(entry.change) ??
    parseNumber(entry.change_price) ??
    parseNumber(entry.day_change)
  const changePercent = parsePercent(entry.change_percent ?? entry.changePercent)
  const dayHigh = parseNumber(entry.high ?? entry.day_high)
  const dayLow = parseNumber(entry.low ?? entry.day_low)
  const open = parseNumber(entry.open ?? entry.day_open)
  const previousClose =
    parseNumber(entry.previous_close ?? entry.prev_close ?? entry.previous_close_price)
  const volume = parseNumber(entry.volume)
  return {
    ...entry,
    symbol,
    assetClass,
    price,
    bid,
    ask,
    volume,
    change,
    changePercent,
    changePercentage: changePercent,
    dayHigh,
    dayLow,
    previousClose,
    open,
    source: "stockdata",
  }
}

async function fetchStockDataQuote(symbol) {
  if (!config.stockdataKey) return null
  const url = new URL(`${config.stockdataBaseUrl}/data/quote`)
  url.searchParams.set("symbols", symbol)
  url.searchParams.set("api_token", config.stockdataKey)
  const data = await fetchJson(url.toString())
  const items = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : data?.data
        ? [data.data]
        : []
  const entry =
    items.find((item) => String(item?.symbol || "").toUpperCase() === symbol) || items[0] || null
  return buildStockDataQuotePayload(entry, symbol, "stock")
}

function buildTwelveDataQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const price = parseNumber(entry.close ?? entry.price ?? entry.last)
  if (typeof price !== "number") return null
  const open = parseNumber(entry.open)
  const dayHigh = parseNumber(entry.high)
  const dayLow = parseNumber(entry.low)
  const volume = parseNumber(entry.volume)
  return {
    symbol,
    assetClass,
    price,
    bid: null,
    ask: null,
    volume,
    change: null,
    changePercent: null,
    changePercentage: null,
    dayHigh,
    dayLow,
    previousClose: null,
    open,
    source: "twelvedata",
  }
}

async function fetchTwelveDataQuote(symbol) {
  if (!config.twelvedataKey) return null
  const url = new URL(`${config.twelvedataBaseUrl}/time_series`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("interval", "1min")
  url.searchParams.set("outputsize", "1")
  url.searchParams.set("apikey", config.twelvedataKey)
  const data = await fetchJson(url.toString())
  if (data?.status === "error") {
    throw new Error(data?.message || "TwelveData error")
  }
  const entry = Array.isArray(data?.values) ? data.values[0] : null
  return buildTwelveDataQuotePayload(entry, symbol, "stock")
}

function buildAlphaVantageQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const price = parseNumber(entry["05. price"])
  if (typeof price !== "number") return null
  const open = parseNumber(entry["02. open"])
  const dayHigh = parseNumber(entry["03. high"])
  const dayLow = parseNumber(entry["04. low"])
  const volume = parseNumber(entry["06. volume"])
  const previousClose = parseNumber(entry["08. previous close"])
  const change = parseNumber(entry["09. change"])
  const changePercent = parsePercent(entry["10. change percent"])
  return {
    symbol,
    assetClass,
    price,
    bid: null,
    ask: null,
    volume,
    change,
    changePercent,
    changePercentage: changePercent,
    dayHigh,
    dayLow,
    previousClose,
    open,
    source: "alphavantage",
  }
}

async function fetchAlphaVantageQuote(symbol) {
  if (!config.alphavantageKey) return null
  const url = new URL(`${config.alphavantageBaseUrl}/query`)
  url.searchParams.set("function", "GLOBAL_QUOTE")
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.alphavantageKey)
  const data = await fetchJson(url.toString())
  if (data?.Note || data?.Information || data?.["Error Message"]) {
    throw new Error(
      data?.Note || data?.Information || data?.["Error Message"] || "Alpha Vantage error"
    )
  }
  const entry = data?.["Global Quote"]
  return buildAlphaVantageQuotePayload(entry, symbol, "stock")
}

async function fetchAlphaVantageOverview(symbol) {
  if (!config.alphavantageKey) return null
  const url = new URL(`${config.alphavantageBaseUrl}/query`)
  url.searchParams.set("function", "OVERVIEW")
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.alphavantageKey)
  const data = await fetchJson(url.toString())
  if (data?.Note || data?.Information || data?.["Error Message"]) {
    throw new Error(
      data?.Note || data?.Information || data?.["Error Message"] || "Alpha Vantage error"
    )
  }
  if (!data || typeof data !== "object") return null
  if (data.Symbol && String(data.Symbol).toUpperCase() !== symbol) return null
  return data
}

async function fetchStockDataEod(symbol, interval, fromDate, toDate) {
  if (!config.stockdataKey) return []
  const url = new URL(`${config.stockdataBaseUrl}/data/eod`)
  url.searchParams.set("symbols", symbol)
  url.searchParams.set("interval", interval)
  url.searchParams.set("api_token", config.stockdataKey)
  if (fromDate) url.searchParams.set("date_from", fromDate)
  if (toDate) url.searchParams.set("date_to", toDate)
  const data = await fetchJson(url.toString())
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
}

async function fetchTwelveDataTimeSeries(symbol, interval, outputsize) {
  if (!config.twelvedataKey) return []
  const url = new URL(`${config.twelvedataBaseUrl}/time_series`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("interval", interval)
  url.searchParams.set("apikey", config.twelvedataKey)
  if (outputsize) url.searchParams.set("outputsize", String(outputsize))
  const data = await fetchJson(url.toString())
  if (data?.status === "error") {
    throw new Error(data?.message || "TwelveData error")
  }
  return Array.isArray(data?.values) ? data.values : []
}

async function fetchAlphaVantageDaily(symbol) {
  if (!config.alphavantageKey) return []
  const url = new URL(`${config.alphavantageBaseUrl}/query`)
  url.searchParams.set("function", "TIME_SERIES_DAILY")
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.alphavantageKey)
  const data = await fetchJson(url.toString())
  if (data?.Note || data?.Information || data?.["Error Message"]) {
    throw new Error(
      data?.Note || data?.Information || data?.["Error Message"] || "Alpha Vantage error"
    )
  }
  const series = data?.["Time Series (Daily)"]
  if (!series || typeof series !== "object") return []
  return Object.entries(series).map(([date, entry]) => ({
    date,
    open: entry["1. open"],
    high: entry["2. high"],
    low: entry["3. low"],
    close: entry["4. close"],
    volume: entry["5. volume"],
  }))
}

async function fetchAlphaVantageIntraday(symbol, interval) {
  if (!config.alphavantageKey) return []
  const allowed = new Set(["1min", "5min", "15min", "30min", "60min"])
  const resolved = interval === "1hour" ? "60min" : interval
  if (!allowed.has(resolved)) return []
  const url = new URL(`${config.alphavantageBaseUrl}/query`)
  url.searchParams.set("function", "TIME_SERIES_INTRADAY")
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("interval", resolved)
  url.searchParams.set("outputsize", "compact")
  url.searchParams.set("apikey", config.alphavantageKey)
  const data = await fetchJson(url.toString())
  if (data?.Note || data?.Information || data?.["Error Message"]) {
    throw new Error(
      data?.Note || data?.Information || data?.["Error Message"] || "Alpha Vantage error"
    )
  }
  const seriesKey = `Time Series (${resolved})`
  const series = data?.[seriesKey]
  if (!series || typeof series !== "object") return []
  return Object.entries(series).map(([date, entry]) => ({
    date,
    open: entry["1. open"],
    high: entry["2. high"],
    low: entry["3. low"],
    close: entry["4. close"],
    volume: entry["5. volume"],
  }))
}

async function resolveQuoteFallback(symbol, assetClass, startedAt) {
  const providers = [
    {
      id: "finnhub",
      enabled: Boolean(config.finnhubKey && assetClass === "stock"),
      fetcher: () => fetchFinnhubQuote(symbol),
    },
    {
      id: "stockdata",
      enabled: Boolean(config.stockdataKey && assetClass === "stock"),
      fetcher: () => fetchStockDataQuote(symbol),
    },
    {
      id: "twelvedata",
      enabled: Boolean(config.twelvedataKey && assetClass === "stock"),
      fetcher: () => fetchTwelveDataQuote(symbol),
    },
    {
      id: "alphavantage",
      enabled: Boolean(config.alphavantageKey && assetClass === "stock"),
      fetcher: () => fetchAlphaVantageQuote(symbol),
    },
  ]

  const rotationKey = getRotationKey("quote", assetClass)
  const ordered = orderProviders(providers, rotationKey, "quote")
  for (const provider of ordered) {
    try {
      const payload = await provider.fetcher()
      if (!payload) continue
      await emitProviderEvent({
        stationId: `provider:${provider.id}`,
        status: "end",
        startMs: startedAt,
        meta: {
          providerId: provider.id,
          endpointName: "quote",
          assetClass,
          paramsHash: hashParams({ symbol, assetClass }),
          httpStatus: 200,
        },
      })
      markProviderSuccess("quote", rotationKey, provider.id)
      return payload
    } catch (err) {
      markProviderCooldown("quote", provider.id, err)
      await emitProviderEvent({
        stationId: `provider:${provider.id}`,
        status: "error",
        startMs: startedAt,
        meta: {
          providerId: provider.id,
          endpointName: "quote",
          assetClass,
          paramsHash: hashParams({ symbol, assetClass }),
        },
        error: { message: err?.message ? String(err.message) : "Request failed" },
      })
    }
  }
  return null
}

async function fetchFallbackDailyCandles(symbol, seriesInterval, limit) {
  const interval = seriesInterval === "1week" ? "1week" : "1day"
  const providers = [
    {
      id: "stockdata",
      enabled: Boolean(config.stockdataKey),
      fetcher: async () => {
        const stockInterval = interval === "1week" ? "week" : "day"
        const entries = await fetchStockDataEod(symbol, stockInterval, null, null)
        if (Array.isArray(entries) && entries.length) {
          return { data: entries, source: "stockdata-eod", providerId: "stockdata" }
        }
        return null
      },
    },
    {
      id: "twelvedata",
      enabled: Boolean(config.twelvedataKey),
      fetcher: async () => {
        const twelveInterval = interval === "1week" ? "1week" : "1day"
        const values = await fetchTwelveDataTimeSeries(symbol, twelveInterval, limit)
        if (Array.isArray(values) && values.length) {
          const mapped = values.map((entry) => ({
            date: entry.datetime || entry.date || entry.time,
            open: entry.open,
            high: entry.high,
            low: entry.low,
            close: entry.close,
            volume: entry.volume,
          }))
          return { data: mapped, source: "twelvedata", providerId: "twelvedata" }
        }
        return null
      },
    },
    {
      id: "alphavantage",
      enabled: Boolean(config.alphavantageKey && interval === "1day"),
      fetcher: async () => {
        const entries = await fetchAlphaVantageDaily(symbol)
        if (Array.isArray(entries) && entries.length) {
          return { data: entries, source: "alphavantage", providerId: "alphavantage" }
        }
        return null
      },
    },
  ]

  const rotationKey = getRotationKey("candles_daily", "stock")
  const ordered = orderProviders(providers, rotationKey, "candles_daily")
  for (const provider of ordered) {
    try {
      const result = await provider.fetcher()
      if (result?.data?.length) {
        markProviderSuccess("candles_daily", rotationKey, provider.id)
        return result
      }
    } catch (err) {
      markProviderCooldown("candles_daily", provider.id, err)
    }
  }
  return { data: [], source: "", providerId: "" }
}

function mapIntervalToMs(interval) {
  const mapping = {
    "1min": 60 * 1000,
    "5min": 5 * 60 * 1000,
    "15min": 15 * 60 * 1000,
    "30min": 30 * 60 * 1000,
    "1hour": 60 * 60 * 1000,
    "4hour": 4 * 60 * 60 * 1000,
  }
  return mapping[interval] || null
}

function mapIntervalToTwelveData(interval) {
  switch (interval) {
    case "1hour":
      return "1h"
    case "4hour":
      return "4h"
    default:
      return interval
  }
}

function mapIntervalToFinnhub(interval) {
  switch (interval) {
    case "1min":
      return "1"
    case "5min":
      return "5"
    case "15min":
      return "15"
    case "30min":
      return "30"
    case "1hour":
      return "60"
    case "1day":
      return "D"
    case "1week":
      return "W"
    default:
      return null
  }
}

function mapIntervalToAlpaca(interval) {
  switch (interval) {
    case "1min":
      return "1Min"
    case "5min":
      return "5Min"
    case "15min":
      return "15Min"
    case "30min":
      return "30Min"
    case "1hour":
      return "1Hour"
    case "1day":
      return "1Day"
    default:
      return null
  }
}

function mapIntervalToPolygon(interval) {
  switch (interval) {
    case "1min":
      return { multiplier: 1, timespan: "minute" }
    case "5min":
      return { multiplier: 5, timespan: "minute" }
    case "15min":
      return { multiplier: 15, timespan: "minute" }
    case "30min":
      return { multiplier: 30, timespan: "minute" }
    case "1hour":
      return { multiplier: 1, timespan: "hour" }
    case "1day":
      return { multiplier: 1, timespan: "day" }
    default:
      return null
  }
}

function mapIntervalToTiingo(interval) {
  switch (interval) {
    case "1hour":
      return "1hour"
    default:
      return interval
  }
}

function mapIntervalToIntrinio(interval) {
  switch (interval) {
    case "1min":
      return "1m"
    case "5min":
      return "5m"
    case "15min":
      return "15m"
    case "30min":
      return "30m"
    case "1hour":
      return "1h"
    case "1day":
      return "1d"
    case "1week":
      return "7d"
    default:
      return null
  }
}

function computeLookbackWindowMs(interval, limit) {
  const stepMs = mapIntervalToMs(interval) || 60 * 1000
  const samples = Math.max(20, Math.min(limit || 120, 500))
  return stepMs * (samples + 5)
}

async function fetchFinnhubCandles(symbol, interval, limit) {
  if (!config.finnhubKey) return []
  const resolution = mapIntervalToFinnhub(interval)
  if (!resolution) return []
  const stepMs = mapIntervalToMs(interval) || 60 * 1000
  const nowSec = Math.floor(Date.now() / 1000)
  const windowSec = Math.max(60, Math.ceil(((limit || 120) + 5) * (stepMs / 1000)))
  const fromSec = Math.max(0, nowSec - windowSec)
  const url = new URL(`${config.finnhubBaseUrl}/stock/candle`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("resolution", resolution)
  url.searchParams.set("from", String(fromSec))
  url.searchParams.set("to", String(nowSec))
  url.searchParams.set("token", config.finnhubKey)
  const data = await fetchJson(url.toString())
  if (data?.s !== "ok") {
    throw new Error(data?.error || data?.message || "Finnhub candles error")
  }
  const times = Array.isArray(data?.t) ? data.t : []
  const opens = Array.isArray(data?.o) ? data.o : []
  const highs = Array.isArray(data?.h) ? data.h : []
  const lows = Array.isArray(data?.l) ? data.l : []
  const closes = Array.isArray(data?.c) ? data.c : []
  const volumes = Array.isArray(data?.v) ? data.v : []
  const entries = []
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i]
    if (!t) continue
    entries.push({
      time: Number(t) * 1000,
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
      volume: volumes[i],
    })
  }
  return entries
}

async function fetchAlpacaCandles(symbol, interval, limit) {
  if (!config.alpacaKey || !config.alpacaSecret) return []
  const timeframe = mapIntervalToAlpaca(interval)
  if (!timeframe) return []
  const windowMs = Math.max(computeLookbackWindowMs(interval, limit), 36 * 60 * 60 * 1000)
  const end = new Date()
  const start = new Date(end.getTime() - windowMs)
  const url = new URL(`${config.alpacaBaseUrl}/stocks/bars`)
  url.searchParams.set("symbols", symbol)
  url.searchParams.set("timeframe", timeframe)
  url.searchParams.set("start", start.toISOString())
  url.searchParams.set("end", end.toISOString())
  if (limit) url.searchParams.set("limit", String(limit))
  const data = await fetchJson(url.toString(), {
    headers: {
      "APCA-API-KEY-ID": config.alpacaKey,
      "APCA-API-SECRET-KEY": config.alpacaSecret,
    },
  })
  const series = data?.bars?.[symbol] || data?.bars || []
  return Array.isArray(series)
    ? series.map((entry) => ({
        time: entry.t ? new Date(entry.t).getTime() : entry.t,
        open: entry.o,
        high: entry.h,
        low: entry.l,
        close: entry.c,
        volume: entry.v,
      }))
    : []
}

async function fetchPolygonCandles(symbol, interval, limit) {
  if (!config.polygonKey) return []
  const mapping = mapIntervalToPolygon(interval)
  if (!mapping) return []
  const windowMs = Math.max(computeLookbackWindowMs(interval, limit), 36 * 60 * 60 * 1000)
  const end = Date.now()
  const start = end - windowMs
  const url = new URL(
    `${config.polygonBaseUrl}/v2/aggs/ticker/${symbol}/range/${mapping.multiplier}/${mapping.timespan}/${start}/${end}`
  )
  url.searchParams.set("adjusted", "true")
  url.searchParams.set("sort", "asc")
  url.searchParams.set("limit", String(Math.max(limit || 120, 120)))
  url.searchParams.set("apiKey", config.polygonKey)
  const data = await fetchJson(url.toString())
  const results = Array.isArray(data?.results) ? data.results : []
  return results.map((entry) => ({
    time: entry.t,
    open: entry.o,
    high: entry.h,
    low: entry.l,
    close: entry.c,
    volume: entry.v,
  }))
}

async function fetchTiingoCandles(symbol, interval, limit) {
  if (!config.tiingoKey) return []
  const resampleFreq = mapIntervalToTiingo(interval)
  if (!resampleFreq) return []
  const windowMs = computeLookbackWindowMs(interval, limit)
  const end = new Date()
  const start = new Date(end.getTime() - windowMs)
  const url = new URL(`${config.tiingoBaseUrl}/iex/${symbol}/prices`)
  url.searchParams.set("resampleFreq", resampleFreq)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  url.searchParams.set("startDate", startDate)
  url.searchParams.set("endDate", endDate)
  url.searchParams.set("token", config.tiingoKey)
  console.log("tiingo candles request", { symbol, resampleFreq, startDate, endDate })
  const data = await fetchJson(url.toString())
  if (!Array.isArray(data)) {
    const detail = data?.detail || data?.error || JSON.stringify(data).slice(0, 200)
    throw new Error(detail || "Tiingo response invalid")
  }
  return data.map((entry) => ({
    time: entry.date || entry.datetime || entry.timestamp,
    open: entry.open,
    high: entry.high,
    low: entry.low,
    close: entry.close,
    volume: entry.volume,
  }))
}

async function fetchIntrinioCandles(symbol, interval, limit) {
  if (!config.intrinioKey) return []
  const intrinioInterval = mapIntervalToIntrinio(interval)
  if (!intrinioInterval) return []
  const windowMs = computeLookbackWindowMs(interval, limit)
  const end = new Date()
  const start = new Date(end.getTime() - windowMs)
  const url = new URL(`${config.intrinioBaseUrl}/securities/${symbol}/prices/intervals`)
  url.searchParams.set("interval", intrinioInterval)
  url.searchParams.set("start_date", start.toISOString().slice(0, 10))
  url.searchParams.set("end_date", end.toISOString().slice(0, 10))
  url.searchParams.set("api_key", config.intrinioKey)
  const data = await fetchJson(url.toString())
  const entries =
    data?.interval_prices || data?.intervals || data?.prices || data?.intraday_prices || []
  return Array.isArray(entries)
    ? entries.map((entry) => ({
        time: entry.datetime || entry.date_time || entry.time || entry.timestamp,
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
      }))
    : []
}

async function resolveReplaySymbolContext(replayState, assetClass, symbol) {
  const legacyKey = buildLegacyKey(symbol, assetClass)
  if (!legacyKey) {
    return { error: { status: 400, payload: { error: "Invalid symbol" } } }
  }
  if (!replayState?.asOf || !replayState?.runId) {
    return {
      error: { status: 500, payload: { error: "Replay controls missing asOf/runId" } },
    }
  }
  const manifest = await loadReplayManifest(replayState)
  if (!manifest) {
    return { error: { status: 500, payload: { error: "Replay manifest unavailable" } } }
  }
  const symbolKeyV2 = manifest?.symbolMap?.[legacyKey]
  const tapeDate = deriveTapeDate(replayState.asOf.getTime(), manifest)
  if (!symbolKeyV2) {
    return {
      error: {
        status: 404,
        payload: buildReplayMissingPayload({
          legacyKey,
          symbolKeyV2: null,
          artifact: "symbolMap",
          tapeDate,
          runId: replayState.runId,
        }),
      },
    }
  }

  const coverage = isOutOfCoverage(replayState.asOf.getTime(), manifest)
  return {
    legacyKey,
    symbolKeyV2,
    tapeDate,
    manifest,
    coverage,
    asOfMs: replayState.asOf.getTime(),
  }
}

async function loadReplayBars(replayState, manifest, symbolKeyV2, tapeDate, interval) {
  const artifactEntry = getArtifactEntry(manifest, symbolKeyV2)
  const expectsDaily = interval === "1day"
  const artifactFlag = expectsDaily ? "bars1d" : "bars1m"
  if (artifactEntry && artifactEntry[artifactFlag] === false) {
    return { missing: true, payload: null }
  }

  const suffix = expectsDaily ? "bars.1d.json.gz" : "bars.1m.json.gz"
  const path = `${config.replayPrefix}/tapes/stocks/${tapeDate}/${symbolKeyV2}.${suffix}`
  const cacheKey = buildCacheKey(
    `replay:${artifactFlag}:${symbolKeyV2}:${tapeDate}`,
    replayState,
    { asOfMs: replayState.asOf?.getTime() }
  )
  return loadReplayArtifact(path, cacheKey, true)
}

function buildReplayQuotePayload(symbol, assetClass, candle, replayState, coverage) {
  return {
    symbol,
    assetClass,
    price: candle.close,
    bid: undefined,
    ask: undefined,
    volume: candle.volume,
    changePercent: undefined,
    source: "replay",
    asOf: replayState.asOf?.toISOString?.() || null,
    meta: coverage?.outOfCoverage ? { outOfCoverage: true } : undefined,
  }
}

async function handleReplayQuote(res, params, replayState) {
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const context = await resolveReplaySymbolContext(replayState, assetClass, symbol)
  if (context.error) {
    respondReplayError(res, context.error.status, context.error.payload)
    return
  }
  const { legacyKey, symbolKeyV2, tapeDate, manifest, asOfMs, coverage } = context
  const barsResult = await loadReplayBars(replayState, manifest, symbolKeyV2, tapeDate, "1min")
  if (barsResult.missing) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "bars1m",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }
  const candles = normalizeReplayCandles(barsResult.payload).filter((candle) => candle.time <= asOfMs)
  if (candles.length === 0) {
    respondReplayError(
      res,
      409,
      buildReplayOutOfCoveragePayload({
        legacyKey,
        symbolKeyV2,
        tapeDate,
        runId: replayState.runId,
        asOf: replayState.asOf?.toISOString?.() || null,
        coverageWindow: coverage.coverageWindow,
      })
    )
    return
  }
  const last = candles[candles.length - 1]
  const payload = buildReplayQuotePayload(symbol, assetClass, last, replayState, coverage)
  respondJson(res, 200, payload)
}

async function handleReplayQuotes(res, params, replayState) {
  const symbolsRaw = params.get("symbols") || ""
  const assetClass = params.get("assetClass") || "stock"
  const rawSymbols = symbolsRaw
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
  if (rawSymbols.length === 0) {
    respondJson(res, 400, { error: "Symbols are required" })
    return
  }

  const manifest = await loadReplayManifest(replayState)
  if (!manifest) {
    respondReplayError(res, 500, { error: "Replay manifest unavailable" })
    return
  }
  const asOf = replayState.asOf
  if (!asOf) {
    respondReplayError(res, 500, { error: "Replay asOf missing" })
    return
  }
  const tapeDate = deriveTapeDate(asOf.getTime(), manifest)
  const coverage = isOutOfCoverage(asOf.getTime(), manifest)

  const items = []
  const missingSymbols = []

  for (const rawSymbol of rawSymbols) {
    const legacyKey = buildLegacyKey(rawSymbol, assetClass)
    if (!legacyKey) {
      missingSymbols.push({ symbol: rawSymbol, reason: "invalid_symbol" })
      continue
    }
    const symbolKeyV2 = manifest?.symbolMap?.[legacyKey]
    if (!symbolKeyV2) {
      missingSymbols.push({ symbol: rawSymbol, reason: "symbolMap_missing" })
      continue
    }
    const barsResult = await loadReplayBars(replayState, manifest, symbolKeyV2, tapeDate, "1min")
    if (barsResult.missing) {
      missingSymbols.push({ symbol: rawSymbol, reason: "bars1m_missing" })
      continue
    }
    const candles = normalizeReplayCandles(barsResult.payload).filter(
      (candle) => candle.time <= asOf.getTime()
    )
    if (candles.length === 0) {
      missingSymbols.push({ symbol: rawSymbol, reason: "out_of_coverage" })
      continue
    }
    const last = candles[candles.length - 1]
    items.push(buildReplayQuotePayload(rawSymbol, assetClass, last, replayState, coverage))
  }

  respondJson(res, 200, {
    items,
    assetClass,
    source: "replay",
    missingSymbols,
  })
}

async function handleReplayCandles(res, params, replayState) {
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const interval = params.get("interval") || "15min"
  const limit = clamp(parseInt(params.get("limit") || "120", 10), 1, 500)
  const dailyModeRaw = (params.get("dailyMode") || "").toLowerCase()
  const dailyMode =
    dailyModeRaw === "strict" || dailyModeRaw === "full" ? dailyModeRaw : "standard"

  const seriesInterval = mapIntervalToSeries(interval)
  const context = await resolveReplaySymbolContext(replayState, assetClass, symbol)
  if (context.error) {
    respondReplayError(res, context.error.status, context.error.payload)
    return
  }
  const { legacyKey, symbolKeyV2, tapeDate, manifest, asOfMs, coverage } = context
  const isDaily = seriesInterval === "1day"
  const barsResult = await loadReplayBars(replayState, manifest, symbolKeyV2, tapeDate, isDaily ? "1day" : "1min")
  if (barsResult.missing) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: isDaily ? "bars1d" : "bars1m",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }

  let candles = normalizeReplayCandles(barsResult.payload)
  if (isDaily) {
    candles = filterReplayDailyCandles(candles, asOfMs, manifest, tapeDate)
  } else {
    candles = candles.filter((candle) => candle.time <= asOfMs)
    const intervalMs = mapIntervalToMs(seriesInterval)
    if (intervalMs && intervalMs !== 60000) {
      candles = aggregateReplayCandles(candles, intervalMs)
    }
  }

  if (candles.length === 0) {
    respondReplayError(
      res,
      409,
      buildReplayOutOfCoveragePayload({
        legacyKey,
        symbolKeyV2,
        tapeDate,
        runId: replayState.runId,
        asOf: replayState.asOf?.toISOString?.() || null,
        coverageWindow: coverage.coverageWindow,
      })
    )
    return
  }

  const payload = {
    symbol,
    assetClass,
    interval: seriesInterval,
    candles: candles.slice(-limit),
    source: "replay",
    asOf: replayState.asOf?.toISOString?.() || null,
    meta: coverage.outOfCoverage ? { outOfCoverage: true } : undefined,
  }
  respondJson(res, 200, payload)
}

async function handleReplayProfile(res, params, replayState) {
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const context = await resolveReplaySymbolContext(replayState, assetClass, symbol)
  if (context.error) {
    respondReplayError(res, context.error.status, context.error.payload)
    return
  }
  const { legacyKey, symbolKeyV2, tapeDate, manifest } = context
  const artifactEntry = getArtifactEntry(manifest, symbolKeyV2)
  if (artifactEntry && artifactEntry.profile === false) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "profile",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }

  const path = `${config.replayPrefix}/tapes/profile/${symbolKeyV2}.json`
  const cacheKey = buildCacheKey(`replay:profile:${symbolKeyV2}`, replayState)
  const result = await loadReplayArtifact(path, cacheKey, false)
  if (result.missing) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "profile",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }
  respondJson(res, 200, { symbol: symbol.toUpperCase(), profile: result.payload, source: "replay" })
}

async function handleReplaySharesFloat(res, params, replayState) {
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const context = await resolveReplaySymbolContext(replayState, assetClass, symbol)
  if (context.error) {
    respondReplayError(res, context.error.status, context.error.payload)
    return
  }
  const { legacyKey, symbolKeyV2, tapeDate, manifest } = context
  const artifactEntry = getArtifactEntry(manifest, symbolKeyV2)
  if (artifactEntry && artifactEntry.sharesFloat === false) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "sharesFloat",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }

  const path = `${config.replayPrefix}/tapes/profile/${symbolKeyV2}.shares-float.json`
  const cacheKey = buildCacheKey(`replay:shares-float:${symbolKeyV2}`, replayState)
  const result = await loadReplayArtifact(path, cacheKey, false)
  if (result.missing) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "sharesFloat",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }
  const payload = Array.isArray(result.payload)
    ? result.payload
    : result.payload
      ? [result.payload]
      : []
  respondJson(res, 200, { symbol: symbol.toUpperCase(), items: payload, source: "replay" })
}

function extractPublishedAt(item) {
  const raw =
    item?.publishedAt ||
    item?.published_at ||
    item?.published ||
    item?.published_at_utc ||
    item?.datetime ||
    item?.date ||
    null
  if (!raw) return null
  const parsed = new Date(raw)
  const time = parsed.getTime()
  return Number.isNaN(time) ? null : time
}

async function handleReplayNews(res, params, replayState) {
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const limit = clamp(parseInt(params.get("limit") || "20", 10), 1, 100)
  const lookbackHours = parseInt(params.get("lookbackHours") || "", 10)
  const lookbackMs = Number.isFinite(lookbackHours) ? lookbackHours * 60 * 60 * 1000 : null

  const context = await resolveReplaySymbolContext(replayState, assetClass, symbol)
  if (context.error) {
    respondReplayError(res, context.error.status, context.error.payload)
    return
  }
  const { legacyKey, symbolKeyV2, tapeDate, manifest, asOfMs } = context
  const artifactEntry = getArtifactEntry(manifest, symbolKeyV2)
  if (artifactEntry && artifactEntry.news === false) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "news",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }

  const path = `${config.replayPrefix}/tapes/news/${tapeDate}/by_symbol/${symbolKeyV2}.json.gz`
  const cacheKey = buildCacheKey(
    `replay:news:${symbolKeyV2}:${tapeDate}`,
    replayState,
    { asOfMs }
  )
  const result = await loadReplayArtifact(path, cacheKey, true)
  if (result.missing) {
    respondReplayError(
      res,
      404,
      buildReplayMissingPayload({
        legacyKey,
        symbolKeyV2,
        artifact: "news",
        tapeDate,
        runId: replayState.runId,
      })
    )
    return
  }

  const rawItems = Array.isArray(result.payload)
    ? result.payload
    : Array.isArray(result.payload?.data)
      ? result.payload.data
      : []
  const filtered = rawItems.filter((item) => {
    const publishedAt = extractPublishedAt(item)
    if (!publishedAt) return false
    if (publishedAt > asOfMs) return false
    if (lookbackMs !== null && publishedAt < asOfMs - lookbackMs) return false
    return true
  })
  respondJson(res, 200, {
    symbol: symbol || "all",
    data: filtered.slice(0, limit),
    source: "replay",
    meta: { count: filtered.length },
  })
}

async function handleQuote(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayQuote(res, params, replayState)
    return
  }
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const normalized = normalizeQuoteSymbol(symbol, assetClass)
  if (!normalized) {
    respondJson(res, 400, { error: "Invalid symbol" })
    return
  }
  const startedAt = Date.now()
  const cacheKey = `quote:${assetClass}:${normalized}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const payload = await resolveQuoteFallback(normalized, assetClass, startedAt)
  if (!payload) {
    const staleEntry = getCachedStale(cacheKey)
    if (staleEntry?.stale) {
      respondJson(res, 200, {
        ...staleEntry.value,
        stale: true,
        staleAgeMs: Date.now() - (staleEntry.storedAt || Date.now()),
      })
      return
    }
    respondError(res, 503, "QUOTE_UNAVAILABLE", "Quote unavailable")
    return
  }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
}

async function handleAftermarketQuote(req, res, params) {
  const symbol = params.get("symbol") || ""
  if (!symbol) {
    respondJson(res, 400, { error: "Symbol is required" })
    return
  }
  const normalized = symbol.toUpperCase().trim()
  const cacheKey = `aftermarket:${normalized}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const payload = await resolveQuoteFallback(normalized, "stock", startedAt)
  if (!payload) {
    const staleEntry = getCachedStale(cacheKey)
    if (staleEntry?.stale) {
      respondJson(res, 200, {
        ...staleEntry.value,
        stale: true,
        staleAgeMs: Date.now() - (staleEntry.storedAt || Date.now()),
      })
      return
    }
    respondError(res, 503, "AFTERMARKET_QUOTE_UNAVAILABLE", "Aftermarket quote unavailable")
    return
  }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
}

async function handleQuotes(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayQuotes(res, params, replayState)
    return
  }
  const symbolsRaw = params.get("symbols") || ""
  const assetClass = params.get("assetClass") || "stock"
  const rawSymbols = symbolsRaw
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
  if (rawSymbols.length === 0) {
    respondJson(res, 400, { error: "Symbols are required" })
    return
  }

  const normalized = []
  rawSymbols.forEach((symbol) => {
    const normalizedSymbol = normalizeQuoteSymbol(symbol, assetClass)
    if (normalizedSymbol) normalized.push(normalizedSymbol)
  })
  const uniqueSymbols = Array.from(new Set(normalized))
  if (uniqueSymbols.length === 0) {
    respondJson(res, 400, { error: "No valid symbols provided" })
    return
  }

  const items = []
  const pending = []
  const startedAt = Date.now()
  uniqueSymbols.forEach((symbol) => {
    const cacheKey = `quote:${assetClass}:${symbol}`
    const cached = getCached(cacheKey)
    if (cached) {
      items.push(cached)
    } else {
      pending.push(symbol)
    }
  })

  if (pending.length > 0) {
    for (const symbol of pending) {
      const payload = await resolveQuoteFallback(symbol, assetClass, startedAt)
      const cacheKey = `quote:${assetClass}:${symbol}`
      if (!payload) {
        const staleEntry = getCachedStale(cacheKey)
        if (staleEntry?.stale) {
          items.push({
            ...staleEntry.value,
            stale: true,
            staleAgeMs: Date.now() - (staleEntry.storedAt || Date.now()),
          })
        }
        continue
      }
      setCached(cacheKey, payload, config.cacheDefaultMs)
      items.push(payload)
    }
  }

  respondJson(res, 200, { items, assetClass, source: "multi" })
}

async function handleCandles(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayCandles(res, params, replayState)
    return
  }
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const interval = params.get("interval") || "15min"
  const limit = clamp(parseInt(params.get("limit") || "120", 10), 1, 500)
  const dailyModeRaw = (params.get("dailyMode") || "").toLowerCase()
  const dailyMode =
    dailyModeRaw === "strict" || dailyModeRaw === "full" ? dailyModeRaw : "standard"

  const normalized = normalizeMarketSymbol(symbol, assetClass)
  if (!normalized) {
    respondJson(res, 400, { error: "Invalid symbol" })
    return
  }

  const seriesInterval = mapIntervalToSeries(interval)
  const cacheKey =
    seriesInterval === "1day" || seriesInterval === "1week"
      ? `candles:${assetClass}:${normalized}:${seriesInterval}:${limit}:${dailyMode}`
      : `candles:${assetClass}:${normalized}:${seriesInterval}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  let data = []
  let source = "market"
  let providerId = ""
  let lastError = null
  let lastProvider = ""
  if (seriesInterval === "1day" || seriesInterval === "1week") {
    const fallback = await fetchFallbackDailyCandles(normalized, seriesInterval, limit)
    if (Array.isArray(fallback.data) && fallback.data.length) {
      data = fallback.data
      source = fallback.source || "market"
      providerId = fallback.providerId || ""
    }
  } else if (assetClass === "stock") {
    const providers = [
      {
        id: "alpaca",
        enabled: Boolean(config.alpacaKey && config.alpacaSecret),
        fetcher: () => fetchAlpacaCandles(normalized, seriesInterval, limit),
      },
      {
        id: "polygon",
        enabled: Boolean(config.polygonKey),
        fetcher: () => fetchPolygonCandles(normalized, seriesInterval, limit),
      },
      {
        id: "tiingo",
        enabled: Boolean(config.tiingoKey),
        fetcher: () => fetchTiingoCandles(normalized, seriesInterval, limit),
      },
      {
        id: "intrinio",
        enabled: Boolean(config.intrinioKey),
        fetcher: () => fetchIntrinioCandles(normalized, seriesInterval, limit),
      },
      {
        id: "twelvedata",
        enabled: Boolean(config.twelvedataKey),
        fetcher: () =>
          fetchTwelveDataTimeSeries(normalized, mapIntervalToTwelveData(seriesInterval), limit),
      },
      {
        id: "finnhub",
        enabled: Boolean(config.finnhubKey),
        fetcher: () => fetchFinnhubCandles(normalized, seriesInterval, limit),
      },
      {
        id: "alphavantage",
        enabled: Boolean(config.alphavantageKey),
        fetcher: () => fetchAlphaVantageIntraday(normalized, seriesInterval),
      },
    ]
    const rotationKey = getRotationKey("candles", assetClass)
    const ordered = orderProviders(providers, rotationKey, "candles")
    for (const provider of ordered) {
      try {
        const values = await provider.fetcher()
        if (Array.isArray(values) && values.length) {
          data = values
          source = provider.id
          providerId = provider.id
          markProviderSuccess("candles", rotationKey, provider.id)
          break
        }
        if (provider.id === "tiingo") {
          console.warn("Candles provider empty", { provider: provider.id })
        }
      } catch (err) {
        console.warn("Candles provider failed", { provider: provider.id, message: err?.message })
        lastError = err
        lastProvider = provider.id
        markProviderCooldown("candles", provider.id, err)
      }
    }
  }
  if (lastError && (!data || data.length === 0)) {
    await emitProviderEvent({
      stationId: `provider:${lastProvider || "market"}`,
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: lastProvider || "market",
        endpointName: "candles",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: seriesInterval, limit }),
      },
      error: { message: lastError?.message ? String(lastError.message) : "Request failed" },
    })
    const staleEntry = getCachedStale(cacheKey)
    if (staleEntry?.stale) {
      respondJson(res, 200, {
        ...staleEntry.value,
        stale: true,
        staleAgeMs: Date.now() - (staleEntry.storedAt || Date.now()),
      })
      return
    }
    respondError(res, 502, "CANDLES_UNAVAILABLE", "Candles unavailable")
    return
  }
  if (!Array.isArray(data) || data.length === 0) {
    const staleEntry = getCachedStale(cacheKey)
    if (staleEntry?.stale) {
      respondJson(res, 200, {
        ...staleEntry.value,
        stale: true,
        staleAgeMs: Date.now() - (staleEntry.storedAt || Date.now()),
      })
      return
    }
    respondError(res, 503, "CANDLES_UNAVAILABLE", "Candles unavailable")
    return
  }
  const candles = data
    .map((entry) => {
      const time = entry.date || entry.datetime || entry.time || entry.timestamp
      const parsedTime = time ? new Date(time).getTime() : null
      const open = parseNumber(entry.open)
      const high = parseNumber(entry.high)
      const low = parseNumber(entry.low)
      const close = parseNumber(entry.close)
      if (!parsedTime || open === undefined || high === undefined || low === undefined || close === undefined) {
        return null
      }
      return {
        time: parsedTime,
        open,
        high,
        low,
        close,
        volume: parseNumber(entry.volume),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time)

  const trimmed = limit && candles.length > limit ? candles.slice(-limit) : candles
  const payload = {
    symbol,
    assetClass,
    interval: seriesInterval,
    candles: trimmed,
    source,
  }
  setCached(cacheKey, payload, config.cacheCandlesMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: `provider:${providerId || "market"}`,
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: providerId || "market",
      endpointName: "candles",
      assetClass,
      paramsHash: hashParams({ symbol: normalized, assetClass, interval: seriesInterval, limit }),
      httpStatus: 200,
      candles: payload.candles.length,
    },
  })
}

async function handleStockList(req, res) {
  const startedAt = Date.now()
  try {
    const payload = await loadSymbolMaster()
    respondJson(res, 200, payload)
    await emitProviderEvent({
      stationId: "provider:nasdaq",
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: "nasdaq",
        endpointName: "stock-list",
        paramsHash: hashParams("stock-list"),
        httpStatus: 200,
        count: Array.isArray(payload?.items) ? payload.items.length : 0,
      },
    })
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:nasdaq",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "nasdaq",
        endpointName: "stock-list",
        paramsHash: hashParams("stock-list"),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    respondJson(res, 502, { error: "Stock list unavailable" })
  }
}

async function handleMoverList(req, res, params, endpointName) {
  const limit = clamp(parseInt(params.get("limit") || "100", 10), 1, 250)
  const cacheKey = `market:movers:${endpointName}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  try {
    const db = initFirestore()
    const doc = await db.doc("market/movers").get()
    const data = doc.exists ? doc.data() : null
    const market = data?.markets?.us || data || {}
    const key =
      endpointName === "biggest-gainers"
        ? "gainers"
        : endpointName === "biggest-losers"
          ? "losers"
          : "actives"
    const list = Array.isArray(market?.[key]) ? market[key] : []
    const items = list.slice(0, limit)
    const payload = { data: items, source: "market-intel", endpoint: endpointName }
    setCached(cacheKey, payload, config.cacheMarketsMs)
    respondJson(res, 200, payload)
    await emitProviderEvent({
      stationId: "provider:market_intel",
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: "market_intel",
        endpointName,
        paramsHash: hashParams({ limit }),
        httpStatus: 200,
        count: items.length,
      },
    })
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:market_intel",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "market_intel",
        endpointName,
        paramsHash: hashParams({ limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    respondJson(res, 502, { error: "Mover list unavailable" })
  }
}

async function handleSearch(req, res, params, endpointName) {
  const query = params.get("query") || ""
  if (!query) {
    respondJson(res, 400, { error: "Missing query" })
    return
  }

  const limit = clamp(parseInt(params.get("limit") || "50", 10), 1, 100)
  const cacheKey = `market:search:${endpointName}:${query}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  try {
    const payload = await loadSymbolMaster()
    const items = Array.isArray(payload?.items) ? payload.items : []
    const needle = query.toUpperCase()
    const filtered =
      endpointName === "search-name"
        ? items.filter((item) => String(item.name || "").toUpperCase().includes(needle))
        : items.filter((item) => String(item.symbol || "").toUpperCase().includes(needle))
    const trimmed = filtered.slice(0, limit)
    const responsePayload = { data: trimmed, source: payload.source || "nasdaq", endpoint: endpointName }
    setCached(cacheKey, responsePayload, config.cacheMarketsMs)
    respondJson(res, 200, responsePayload)
    await emitProviderEvent({
      stationId: "provider:nasdaq",
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: "nasdaq",
        endpointName,
        paramsHash: hashParams({ query, limit }),
        httpStatus: 200,
        count: trimmed.length,
      },
    })
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:nasdaq",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "nasdaq",
        endpointName,
        paramsHash: hashParams({ query, limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    respondJson(res, 502, { error: "Search unavailable" })
  }
}

async function handleCrypto(req, res, params) {
  const limit = clamp(parseInt(params.get("limit") || "50", 10), 1, 250)
  const payload = { data: [], source: "unavailable", endpoint: "crypto_markets", limit }
  respondJson(res, 200, payload)
}

async function handleIndicators(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  const indicator = (params.get("indicator") || "sma").toLowerCase()
  const period = clamp(parseInt(params.get("period") || "20", 10), 2, 200)
  const timeframe = params.get("timeframe") || "5min"
  const limit = clamp(parseInt(params.get("limit") || "100", 10), 1, 500)

  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const validIndicators = ["sma", "ema", "wma", "dema", "tema", "rsi", "adx", "williams", "standarddeviation"]
  if (!validIndicators.includes(indicator)) {
    respondJson(res, 400, { error: `Invalid indicator. Valid: ${validIndicators.join(", ")}` })
    return
  }

  const payload = { symbol, indicator, period, timeframe, data: [], source: "unavailable", limit }
  respondJson(res, 200, payload)
}

async function handleProfile(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayProfile(res, params, replayState)
    return
  }
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `market:profile:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  try {
    const overview = config.alphavantageKey ? await fetchAlphaVantageOverview(symbol) : null
    const payload = {
      symbol,
      profile: overview || null,
      source: overview ? "alphavantage" : "unavailable",
    }
    setCached(cacheKey, payload, config.cacheMarketsMs * 10)
    respondJson(res, 200, payload)
    await emitProviderEvent({
      stationId: `provider:${overview ? "alphavantage" : "market"}`,
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: overview ? "alphavantage" : "market",
        endpointName: "profile",
        paramsHash: hashParams({ symbol }),
        httpStatus: 200,
      },
    })
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:alphavantage",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "alphavantage", endpointName: "profile", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    respondJson(res, 502, { error: "Profile unavailable" })
  }
}

async function handleSharesFloat(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplaySharesFloat(res, params, replayState)
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `market:shares-float:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  try {
    const overview = config.alphavantageKey ? await fetchAlphaVantageOverview(symbol) : null
    const sharesOutstanding = parseNumber(overview?.SharesOutstanding)
    const items = Number.isFinite(sharesOutstanding)
      ? [
          {
            symbol,
            sharesFloat: sharesOutstanding,
            sharesOutstanding,
            fallback: "shares_outstanding",
            source: "alphavantage",
          },
        ]
      : []
    const payload = {
      symbol,
      items,
      source: items.length ? "alphavantage" : "unavailable",
    }
    setCached(cacheKey, payload, config.cacheMarketsMs * 10)
    respondJson(res, 200, payload)
    await emitProviderEvent({
      stationId: `provider:${items.length ? "alphavantage" : "market"}`,
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: items.length ? "alphavantage" : "market",
        endpointName: "shares-float",
        paramsHash: hashParams({ symbol }),
        httpStatus: 200,
        count: items.length,
      },
    })
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:alphavantage",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "alphavantage", endpointName: "shares-float", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    respondJson(res, 502, { error: "Shares float unavailable" })
  }
}

async function handleNews(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayNews(res, params, replayState)
    return
  }
  if (!config.marketauxKey) {
    respondJson(res, 503, { error: "MARKETAUX_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase()
  const limit = clamp(parseInt(params.get("limit") || "20", 10), 1, 100)
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `market:news:${symbol}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  try {
    const items = await fetchMarketauxNewsForSymbols([symbol], limit)
    const payload = { symbol, data: items, source: "marketaux" }
    setCached(cacheKey, payload, config.cacheNewsMs)
    respondJson(res, 200, payload)
    await emitProviderEvent({
      stationId: "provider:marketaux",
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: "marketaux",
        endpointName: "news",
        paramsHash: hashParams({ symbol, limit }),
        httpStatus: 200,
        count: Array.isArray(items) ? items.length : 0,
      },
    })
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:marketaux",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "marketaux", endpointName: "news", paramsHash: hashParams({ symbol, limit }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    respondJson(res, 502, { error: "News unavailable" })
  }
}

async function handlePriceTarget(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const payload = { symbol, priceTarget: null, source: "unavailable" }
  respondJson(res, 200, payload)
}

async function handleAnalystRatings(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const payload = { symbol, rating: null, source: "unavailable", endpoint: "ratings-snapshot" }
  respondJson(res, 200, payload)
}

async function handleRatingsHistorical(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const payload = { symbol, ratings: [], source: "unavailable" }
  respondJson(res, 200, payload)
}

async function handleGrades(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const payload = { symbol, grades: [], source: "unavailable" }
  respondJson(res, 200, payload)
}

async function handleGradesHistorical(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const payload = { symbol, grades: [], source: "unavailable" }
  respondJson(res, 200, payload)
}

async function handleGradesConsensus(req, res, params) {
  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }
  const payload = { symbol, consensus: null, source: "unavailable" }
  respondJson(res, 200, payload)
}

async function handleMarketauxNews(req, res, params) {
  if (!config.marketauxKey) {
    respondJson(res, 500, { error: "MARKETAUX_API_KEY is not configured" })
    return
  }

  const symbols = params.get("symbols") || ""
  const entityTypes = params.get("entity_types") || params.get("entityTypes") || ""
  const limit = clamp(parseInt(params.get("limit") || "20", 10), 1, 100)
  if (!symbols) {
    respondJson(res, 400, { error: "Missing symbols" })
    return
  }

  const cacheKey = `marketaux:news:${symbols}:${entityTypes}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:marketaux",
      status: "end",
      meta: {
        providerId: "marketaux",
        endpointName: "news",
        cacheHit: true,
        paramsHash: hashParams({ symbols, entityTypes, limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(config.marketauxBaseUrl)
  url.searchParams.set("api_token", config.marketauxKey)
  url.searchParams.set("symbols", symbols)
  url.searchParams.set("filter_entities", "true")
  url.searchParams.set("language", "en")
  url.searchParams.set("limit", String(limit))
  if (entityTypes) {
    url.searchParams.set("entity_types", entityTypes)
  }

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:marketaux",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "marketaux",
        endpointName: "news",
        paramsHash: hashParams({ symbols, entityTypes, limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  const payload = { data: Array.isArray(data?.data) ? data.data : [], source: "marketaux" }
  setCached(cacheKey, payload, config.cacheNewsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:marketaux",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "marketaux",
      endpointName: "news",
      paramsHash: hashParams({ symbols, entityTypes, limit }),
      httpStatus: 200,
      count: Array.isArray(payload.data) ? payload.data.length : undefined,
    },
  })
}

function extractMarketauxSymbols(item) {
  if (!item) return []
  if (Array.isArray(item.symbols) && item.symbols.length) return item.symbols
  if (Array.isArray(item.entities) && item.entities.length) {
    return item.entities
      .map((entity) => entity?.symbol)
      .filter(Boolean)
  }
  if (item.symbol) return [item.symbol]
  return []
}

function extractDateKey(raw) {
  if (!raw) return null
  const str = String(raw)
  if (!str) return null
  if (str.includes(" ")) return str.split(" ")[0]
  if (str.includes("T")) return str.split("T")[0]
  const parsed = new Date(str)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function extractTimeMs(raw) {
  return parseTimestamp(raw)
}

function parseTimestamp(raw, timezone = "America/New_York") {
  if (!raw) return null
  if (typeof raw === "number") {
    return raw > 1e12 ? raw : raw * 1000
  }
  const str = String(raw)
  if (!str) return null
  const hasOffset = /Z|[+-]\d{2}:?\d{2}$/.test(str)
  const naiveDateMatch = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(str)
  if (!hasOffset && naiveDateMatch) {
    const iso = str.includes("T") ? str : str.replace(" ", "T")
    const withTime = iso.length === 10 ? `${iso}T00:00:00` : iso
    const zoned = fromZonedTime(withTime, timezone)
    return Number.isNaN(zoned.getTime()) ? null : zoned.getTime()
  }
  const parsed = new Date(str)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.getTime()
}

function filterIntradayBarsForDate(bars, dateKey) {
  if (!Array.isArray(bars) || !dateKey) return []
  return bars.filter((entry) => extractDateKey(entry?.date || entry?.time || entry?.timestamp) === dateKey)
}

function buildDailyBarsFromIntraday(bars) {
  if (!Array.isArray(bars) || bars.length === 0) return []
  const days = new Map()
  bars.forEach((entry) => {
    const timeRaw = entry?.date || entry?.time || entry?.timestamp
    const dateKey = extractDateKey(timeRaw)
    const timeMs = extractTimeMs(timeRaw)
    if (!dateKey || !timeMs) return
    const open = parseNumber(entry.open)
    const high = parseNumber(entry.high)
    const low = parseNumber(entry.low)
    const close = parseNumber(entry.close)
    if (open === undefined || high === undefined || low === undefined || close === undefined) return
    const volume = parseNumber(entry.volume) || 0
    const existing = days.get(dateKey)
    if (!existing) {
      days.set(dateKey, {
        date: dateKey,
        open,
        high,
        low,
        close,
        volume,
        firstTs: timeMs,
        lastTs: timeMs,
      })
      return
    }
    if (timeMs < existing.firstTs) {
      existing.firstTs = timeMs
      existing.open = open
    }
    if (timeMs > existing.lastTs) {
      existing.lastTs = timeMs
      existing.close = close
    }
    existing.high = Math.max(existing.high, high)
    existing.low = Math.min(existing.low, low)
    existing.volume = (existing.volume || 0) + volume
  })

  return Array.from(days.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ firstTs, lastTs, ...rest }) => rest)
}

function buildMarketauxIndex(items) {
  const index = new Map()
  items.forEach((item) => {
    const symbols = extractMarketauxSymbols(item)
    symbols.forEach((symbol) => {
      const normalized = normalizeTicker(symbol) || normalizeSymbol(symbol)
      if (!normalized) return
      if (!index.has(normalized)) index.set(normalized, [])
      index.get(normalized).push(item)
    })
  })
  return index
}

async function loadExistingManifest(bucket, manifestPath) {
  try {
    const file = bucket.file(manifestPath)
    const [contents] = await file.download()
    return JSON.parse(contents.toString("utf8"))
  } catch (err) {
    const message = err?.message ? String(err.message) : ""
    if (err?.code === 404 || message.includes("No such object") || message.includes("Not Found")) {
      return null
    }
    throw err
  }
}

function filterBarsByDate(entries, fromDate, toDate) {
  if (!Array.isArray(entries)) return []
  if (!fromDate && !toDate) return entries
  const fromMs = fromDate ? new Date(fromDate).getTime() : null
  const toMs = toDate ? new Date(toDate).getTime() : null
  return entries.filter((entry) => {
    const rawDate = entry?.date ?? entry?.datetime ?? entry?.timestamp ?? entry?.time
    if (!rawDate) return false
    const ms =
      typeof rawDate === "number"
        ? rawDate > 1e12
          ? rawDate
          : rawDate * 1000
        : new Date(rawDate).getTime()
    if (!Number.isFinite(ms)) return false
    if (fromMs && ms < fromMs) return false
    if (toMs && ms > toMs) return false
    return true
  })
}

async function fetchHistoricalBars(symbol, interval, fromDate, toDate) {
  if (interval === "1day" || interval === "1week") {
    const fallback = await fetchFallbackDailyCandles(symbol, interval, null)
    const data = Array.isArray(fallback.data) ? fallback.data : []
    return filterBarsByDate(data, fromDate, toDate)
  }
  if (!config.twelvedataKey) return []
  const tdInterval = mapIntervalToTwelveData(interval)
  const values = await fetchTwelveDataTimeSeries(symbol, tdInterval, 500)
  const data = Array.isArray(values)
    ? values.map((entry) => ({
        date: entry.datetime || entry.date || entry.time,
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
      }))
    : []
  return filterBarsByDate(data, fromDate, toDate)
}

async function fetchHistoricalFull(symbol, fromDate, toDate) {
  const fallback = await fetchFallbackDailyCandles(symbol, "1day", null)
  const data = Array.isArray(fallback.data) ? fallback.data : []
  return filterBarsByDate(data, fromDate, toDate)
}

async function fetchProfileData(symbol) {
  return fetchAlphaVantageOverview(symbol)
}

async function fetchSharesFloatData(symbol) {
  const overview = await fetchAlphaVantageOverview(symbol)
  const sharesOutstanding = parseNumber(overview?.SharesOutstanding)
  return Number.isFinite(sharesOutstanding)
    ? [{ symbol, sharesFloat: sharesOutstanding, sharesOutstanding, fallback: "shares_outstanding" }]
    : []
}

async function fetchMarketauxNewsForSymbols(symbols, limit) {
  if (!config.marketauxKey) throw new Error("Marketaux key not configured")
  const url = new URL(config.marketauxBaseUrl)
  url.searchParams.set("api_token", config.marketauxKey)
  url.searchParams.set("symbols", symbols.join(","))
  url.searchParams.set("filter_entities", "true")
  url.searchParams.set("language", "en")
  url.searchParams.set("limit", String(limit))
  const data = await fetchJsonWithRetry(url.toString())
  return Array.isArray(data?.data) ? data.data : []
}

const DEFAULT_TAPE_DISCOVERY = {
  includeUniverse: true,
  smallCapMinMarketCap: 5_000_000,
  smallCapMaxMarketCap: 80_000_000,
  smallCapMinVolume: 50_000,
  midCapMinMarketCap: 1_000_000_000,
  midCapMaxMarketCap: 50_000_000_000,
  midCapMinVolume: 500_000,
}

async function discoverTapeSymbols(maxSymbols, options = {}) {
  const settings = {
    includeUniverse:
      typeof options.includeUniverse === "boolean"
        ? options.includeUniverse
        : DEFAULT_TAPE_DISCOVERY.includeUniverse,
    smallCapMinMarketCap:
      parseNumber(options.smallCapMinMarketCap) ?? DEFAULT_TAPE_DISCOVERY.smallCapMinMarketCap,
    smallCapMaxMarketCap:
      parseNumber(options.smallCapMaxMarketCap) ?? DEFAULT_TAPE_DISCOVERY.smallCapMaxMarketCap,
    smallCapMinVolume:
      parseNumber(options.smallCapMinVolume) ?? DEFAULT_TAPE_DISCOVERY.smallCapMinVolume,
    midCapMinMarketCap:
      parseNumber(options.midCapMinMarketCap) ?? DEFAULT_TAPE_DISCOVERY.midCapMinMarketCap,
    midCapMaxMarketCap:
      parseNumber(options.midCapMaxMarketCap) ?? DEFAULT_TAPE_DISCOVERY.midCapMaxMarketCap,
    midCapMinVolume:
      parseNumber(options.midCapMinVolume) ?? DEFAULT_TAPE_DISCOVERY.midCapMinVolume,
  }

  const universeSymbols = new Set()

  // 0. Fetch symbols from market/universe (the actual source algorithms use)
  if (settings.includeUniverse) {
    try {
      const db = initFirestore()
      const universeDoc = await db.doc("market/universe").get()
      if (universeDoc.exists) {
        const data = universeDoc.data()
        // Extract stock symbols from universe
        const stockSymbols = data?.stocks?.symbols || []
        stockSymbols.forEach((s) => typeof s === "string" && universeSymbols.add(s.toUpperCase()))
        // Also include crypto symbols if present
        const cryptoSymbols = data?.crypto?.symbols || []
        cryptoSymbols.forEach((s) => typeof s === "string" && universeSymbols.add(s.toUpperCase()))
        console.log("tape_universe_symbols", {
          stocks: stockSymbols.length,
          crypto: cryptoSymbols.length,
          total: universeSymbols.size,
        })
      }
    } catch (err) {
      console.error("Failed to fetch market/universe:", err.message)
    }
  }

  // Filter function for valid symbols
  const isValidSymbol = (symbol) => {
    if (!symbol || typeof symbol !== "string") return false
    if (symbol.includes(".")) return false
    if (symbol.length > 5) return false // Likely warrants or units
    return true
  }
  const target = Math.max(0, maxSymbols)
  const ordered = Array.from(universeSymbols).filter(isValidSymbol)
  if (ordered.length < target) {
    try {
      const master = await loadSymbolMaster()
      const pool = Array.isArray(master?.items) ? master.items : []
      for (const item of pool) {
        if (ordered.length >= target) break
        const symbol = String(item?.symbol || "").toUpperCase()
        if (!symbol || ordered.includes(symbol)) continue
        if (!isValidSymbol(symbol)) continue
        ordered.push(symbol)
      }
    } catch (err) {
      console.error("Symbol master fallback failed:", err.message)
    }
  }

  console.log("tape_discovery", {
    universeSymbols: universeSymbols.size,
    total: ordered.length,
    target,
    settings,
  })

  return target > 0 ? ordered.slice(0, target) : ordered
}

async function handleReplayBuildTape(req, res, params) {
  if (!config.replayBuildEnabled) {
    respondJson(res, 403, { error: "Replay tape build is disabled" })
    return
  }
  if (!config.replayBucket) {
    respondJson(res, 400, { error: "Replay bucket is not configured" })
    return
  }

  let body = null
  try {
    body = await readJsonBody(req)
  } catch (err) {
    respondJson(res, 400, { error: err.message || "Invalid JSON body" })
    return
  }

  const date = params.get("date") || body?.date
  if (!date) {
    respondJson(res, 400, { error: "Missing date (YYYY-MM-DD)" })
    return
  }
  const datasetId = params.get("datasetId") || body?.datasetId || date
  const assetClass = (body?.assetClass || params.get("assetClass") || "stock").toLowerCase()
  const includeProfile = body?.includeProfile !== false
  const includeSharesFloat = body?.includeSharesFloat !== false
  const includeNews = body?.includeNews === true || params.get("includeNews") === "true"
  if (includeNews && !config.marketauxKey) {
    respondJson(res, 400, { error: "MARKETAUX_API_KEY is required when includeNews=true" })
    return
  }
  const lookbackDays = clamp(
    parseInt(body?.lookbackDays || params.get("lookbackDays") || config.replayBuildLookbackDays, 10),
    1,
    600
  )
  const intradayLookbackDays = clamp(
    parseInt(body?.intradayLookbackDays || params.get("intradayLookbackDays") || "0", 10),
    0,
    60
  )
  const hardMaxSymbols = 2000
  let maxSymbols = clamp(
    parseInt(body?.maxSymbols || params.get("maxSymbols") || config.replayBuildMaxSymbols, 10),
    1,
    hardMaxSymbols
  )
  const autoDiscover = body?.autoDiscover === true || params.get("autoDiscover") === "true"
  const autoDiscoverConfig = normalizeAutoDiscoverConfig(body?.autoDiscoverConfig)
  const autoDiscoverOptions = {
    includeUniverse: autoDiscoverConfig?.includeUniverse,
    smallCapMinMarketCap: autoDiscoverConfig?.smallCapMinMarketCap,
    smallCapMaxMarketCap: autoDiscoverConfig?.smallCapMaxMarketCap,
    smallCapMinVolume: autoDiscoverConfig?.smallCapMinVolume,
    midCapMinMarketCap: autoDiscoverConfig?.midCapMinMarketCap,
    midCapMaxMarketCap: autoDiscoverConfig?.midCapMaxMarketCap,
    midCapMinVolume: autoDiscoverConfig?.midCapMinVolume,
  }

  let symbols = normalizeSymbolList(body?.symbols || params.get("symbols"))
  const symbolSource = normalizeSymbolSource(body?.symbolSource)

  if (!symbolSource) {
    respondJson(res, 400, { error: "symbolSource is required (auto, default, custom)." })
    return
  }
  if (symbolSource === "auto") {
    if (!autoDiscover) {
      respondJson(res, 400, { error: "symbolSource=auto requires autoDiscover=true." })
      return
    }
    if (!autoDiscoverConfig) {
      respondJson(res, 400, { error: "autoDiscoverConfig is required for auto-discover." })
      return
    }
    if (symbols.length > 0) {
      respondJson(res, 400, { error: "Symbols are not allowed when symbolSource=auto." })
      return
    }
  } else {
    if (autoDiscover) {
      respondJson(res, 400, { error: "autoDiscover must be false for custom/default symbols." })
      return
    }
    if (!symbols.length) {
      respondJson(res, 400, { error: "Symbols are required when symbolSource is not auto." })
      return
    }
  }

  // Auto-discover symbols for algorithms if no symbols provided or autoDiscover is true
  if (autoDiscover || !symbols.length) {
    const discovered = await discoverTapeSymbols(maxSymbols, autoDiscoverOptions)
    symbols = [...new Set([...symbols, ...discovered])]
    console.log("tape_auto_discover", {
      requested: normalizeSymbolList(body?.symbols || params.get("symbols")).length,
      discovered: discovered.length,
      total: symbols.length
    })
  }

  if (!symbols.length) {
    respondJson(res, 400, { error: "Missing symbols list and auto-discovery found none" })
    return
  }
  if (symbols.length > hardMaxSymbols) {
    respondJson(res, 400, { error: `Too many symbols (max ${hardMaxSymbols})` })
    return
  }
  if (symbols.length > maxSymbols) {
    if (autoDiscover || !normalizeSymbolList(body?.symbols || params.get("symbols")).length) {
      console.log("tape_max_symbols_bumped", { from: maxSymbols, to: symbols.length })
      maxSymbols = symbols.length
    } else {
      respondJson(res, 400, { error: `Too many symbols (max ${maxSymbols})` })
      return
    }
  }
  const bucket = initStorage().bucket(config.replayBucket)
  const manifestPath = `${config.replayPrefix}/tapes/stocks/${datasetId}/manifest.json`
  let manifest = await loadExistingManifest(bucket, manifestPath)

  if (!manifest) {
    manifest = {
      datasetId,
      timezone: "America/New_York",
      coverage: "RTH",
      openTime: "09:30",
      closeTime: "16:00",
      buildTs: new Date().toISOString(),
      symbols: [],
      symbolMap: {},
      artifacts: {},
      missingSymbols: [],
      provider: {
        source: "market",
        news: includeNews ? "marketaux" : "none",
      },
    }
  }
  const tapeTimezone = manifest?.timezone || "America/New_York"

  const existingByLegacyKey = new Map(
    Array.isArray(manifest.symbols)
      ? manifest.symbols.map((entry) => [entry?.legacyKey, entry])
      : []
  )

  const fromDate = shiftDateKey(date, -lookbackDays)
  let newsIndex = null
  if (includeNews && config.marketauxKey) {
    try {
      const newsItems = await fetchMarketauxNewsForSymbols(symbols, 100)
      newsIndex = buildMarketauxIndex(newsItems)
    } catch (err) {
      console.error("Marketaux tape build failed:", err.message)
      newsIndex = null
    }
  }

  const results = {
    date,
    datasetId,
    assetClass,
    lookbackDays,
    intradayLookbackDays,
    autoDiscover,
    symbolCount: symbols.length,
    okSymbols: [],
    missingSymbols: [],
    errors: [],
  }
  const failedLegacyKeys = new Set()
  const failedSymbolKeyV2 = new Set()

  const chunks = chunkList(symbols, Math.max(config.replayBuildConcurrency, 1))
  for (const chunk of chunks) {
    const processed = await Promise.all(
      chunk.map(async (rawSymbol) => {
        const legacyKey = buildLegacyKey(rawSymbol, assetClass)
        if (!legacyKey) {
          return { rawSymbol, legacyKey, error: "Invalid symbol" }
        }
        const sourceSymbol = normalizeMarketSymbol(rawSymbol, assetClass)
        if (!sourceSymbol) {
          return { rawSymbol, legacyKey, error: "Invalid symbol" }
        }

        let profile = null
        let exchangeHint = null
        if (includeProfile) {
          try {
            profile = await fetchProfileData(sourceSymbol)
            exchangeHint =
              profile?.exchangeShortName ||
              profile?.exchange ||
              profile?.exchangeShortName ||
              null
          } catch (err) {
            console.error(`Profile fetch failed for ${rawSymbol}:`, err.message)
          }
        }
        let sharesFloat = null
        if (includeSharesFloat) {
          try {
            sharesFloat = await fetchSharesFloatData(sourceSymbol)
          } catch (err) {
            console.error(`Shares float fetch failed for ${rawSymbol}:`, err.message)
            sharesFloat = null
          }
        }

        const venueInfo = resolveVenueInfo(rawSymbol, exchangeHint)
        const normalizedSymbol = normalizeSymbolKeyV2(rawSymbol, venueInfo.venue)
        if (!normalizedSymbol) {
          return { rawSymbol, legacyKey, error: "Failed to normalize symbol" }
        }
        const symbolKeyV2 = `${assetClass}:${venueInfo.venue}:${normalizedSymbol}`

        let bars1m = null
        let bars1d = null
        try {
          // Fetch intraday bars for target date plus optional lookback period
          const intradayFromDate = intradayLookbackDays > 0 ? shiftDateKey(date, -intradayLookbackDays) : date
          const intradayRange = await fetchHistoricalBars(sourceSymbol, "1min", intradayFromDate, date)
          bars1m = normalizeReplayCandles(intradayRange)
        } catch (err) {
          return { rawSymbol, legacyKey, symbolKeyV2, error: err.message || "Market data fetch failed" }
        }

        try {
          let dailyRange = await fetchHistoricalBars(sourceSymbol, "1day", fromDate, date)
          if (!Array.isArray(dailyRange) || dailyRange.length <= 1) {
            dailyRange = await fetchHistoricalBars(sourceSymbol, "1day", null, null)
          }
          if (!Array.isArray(dailyRange) || dailyRange.length <= 1) {
            try {
              const hourlyRange = await fetchHistoricalBars(sourceSymbol, "1hour", null, null)
              dailyRange = buildDailyBarsFromIntraday(hourlyRange)
            } catch (err) {
              console.error(`Daily from hourly failed for ${rawSymbol}:`, err.message)
            }
          }
          const fromMs = fromDate ? new Date(fromDate).getTime() : null
          const toMs = date ? new Date(date).getTime() : null
          bars1d = normalizeReplayCandles(dailyRange).filter((candle) => {
            if (fromMs && candle.time < fromMs) return false
            if (toMs && candle.time > toMs) return false
            return true
          })
        } catch (err) {
          console.error(`Daily bars fetch failed for ${rawSymbol}:`, err.message)
          bars1d = null
        }

        const artifacts = {
          bars1m: Array.isArray(bars1m) && bars1m.length > 0,
          bars1d: Array.isArray(bars1d) && bars1d.length > 0,
          profile: Boolean(profile),
          sharesFloat: Array.isArray(sharesFloat) && sharesFloat.length > 0,
          news: includeNews && Boolean(newsIndex),
        }
        const hasTapeSession =
          Array.isArray(bars1m) &&
          bars1m.some((candle) => getLocalDateParts(candle.time, tapeTimezone).dateKey === date)
        const missingReasons = []
        if (!artifacts.bars1m) missingReasons.push("bars1m_missing")
        if (!artifacts.bars1d) missingReasons.push("bars1d_missing")
        if (artifacts.bars1m && !hasTapeSession) missingReasons.push("bars1m_no_tape_session")
        if (includeProfile && !artifacts.profile) missingReasons.push("profile_missing")
        if (includeSharesFloat && !artifacts.sharesFloat) missingReasons.push("shares_float_missing")
        if (includeNews && !artifacts.news) missingReasons.push("news_missing")
        if (missingReasons.length > 0) {
          console.warn("tape_symbol_skipped", { symbol: rawSymbol, reasons: missingReasons })
          return {
            rawSymbol,
            legacyKey,
            symbolKeyV2,
            error: "missing_required_artifacts",
            missing: missingReasons,
          }
        }

        const basePath = `${config.replayPrefix}/tapes/stocks/${date}`
        if (artifacts.bars1m) {
          await writeReplayArtifact(
            `${basePath}/${symbolKeyV2}.bars.1m.json.gz`,
            bars1m,
            true
          )
        }
        if (artifacts.bars1d) {
          await writeReplayArtifact(
            `${basePath}/${symbolKeyV2}.bars.1d.json.gz`,
            bars1d,
            true
          )
        }
        if (includeProfile && profile) {
          await writeReplayArtifact(
            `${config.replayPrefix}/tapes/profile/${symbolKeyV2}.json`,
            profile,
            false
          )
        }
        if (includeSharesFloat && Array.isArray(sharesFloat) && sharesFloat.length > 0) {
          await writeReplayArtifact(
            `${config.replayPrefix}/tapes/profile/${symbolKeyV2}.shares-float.json`,
            sharesFloat,
            false
          )
        }
        if (includeNews && newsIndex) {
          const normalizedKey = normalizeTicker(rawSymbol) || normalizeSymbol(rawSymbol) || normalizedSymbol
          const items = newsIndex.get(normalizedKey) || []
          await writeReplayArtifact(
            `${config.replayPrefix}/tapes/news/${date}/by_symbol/${symbolKeyV2}.json.gz`,
            items,
            true
          )
        }

        return {
          rawSymbol,
          legacyKey,
          symbolKeyV2,
          normalizedSymbol,
          exchangeMeta: venueInfo.exchangeMeta || null,
          venue: venueInfo.venue,
          artifacts,
        }
      })
    )

    processed.forEach((result) => {
      if (result.error) {
        results.missingSymbols.push(result.rawSymbol)
        if (result.legacyKey) failedLegacyKeys.add(result.legacyKey)
        if (result.symbolKeyV2) failedSymbolKeyV2.add(result.symbolKeyV2)
        const errorEntry = { symbol: result.rawSymbol, error: result.error }
        if (Array.isArray(result.missing) && result.missing.length > 0) {
          errorEntry.missing = result.missing
        }
        results.errors.push(errorEntry)
        return
      }
      results.okSymbols.push(result.rawSymbol)
      manifest.symbolMap[result.legacyKey] = result.symbolKeyV2
      manifest.artifacts[result.symbolKeyV2] = result.artifacts
      const existing = existingByLegacyKey.get(result.legacyKey)
      const entry = {
        legacyKey: result.legacyKey,
        symbolKeyV2: result.symbolKeyV2,
        rawSymbol: result.rawSymbol,
        normalizedSymbol: result.normalizedSymbol,
        assetClass,
        venue: result.venue,
        exchangeMeta: result.exchangeMeta,
        artifacts: result.artifacts,
      }
      if (existing) {
        Object.assign(existing, entry)
      } else {
        manifest.symbols.push(entry)
        existingByLegacyKey.set(result.legacyKey, entry)
      }
    })
  }

  if (failedLegacyKeys.size > 0 || failedSymbolKeyV2.size > 0) {
    if (Array.isArray(manifest.symbols)) {
      manifest.symbols = manifest.symbols.filter(
        (entry) =>
          entry &&
          !failedLegacyKeys.has(entry.legacyKey) &&
          !failedSymbolKeyV2.has(entry.symbolKeyV2)
      )
    }
    if (manifest.symbolMap) {
      failedLegacyKeys.forEach((key) => {
        delete manifest.symbolMap[key]
      })
    }
    if (manifest.artifacts) {
      failedSymbolKeyV2.forEach((key) => {
        delete manifest.artifacts[key]
      })
    }
  }

  manifest.buildTs = new Date().toISOString()
  manifest.missingSymbols = results.missingSymbols

  await writeReplayArtifact(manifestPath, manifest, false)

  if (body?.registerRun === true || body?.runId || body?.runLabel || body?.label) {
    try {
      const runPayload = {
        runId: body?.runId,
        label: body?.runLabel || body?.label,
        datasetId,
        tapeDate: date,
        symbolCount: results.okSymbols.length,
        symbolSource: body?.symbolSource,
        maxSymbols,
        autoDiscoverConfig: autoDiscoverConfig,
        source: "tape_builder",
      }
      results.run = await registerReplayRun(runPayload)
    } catch (err) {
      results.runError = err?.message || "Replay run registration failed"
    }
  }

  respondJson(res, 200, results)
}

async function handleReplayRunsList(req, res, params) {
  const limit = params.get("limit")
  const runs = await listReplayRuns(limit)
  respondJson(res, 200, { runs, count: runs.length })
}

async function handleReplayRegisterRun(req, res, params) {
  let body = null
  try {
    body = await readJsonBody(req)
  } catch (err) {
    respondJson(res, 400, { error: err.message || "Invalid JSON body" })
    return
  }
  try {
    const run = await registerReplayRun({
      runId: body?.runId || params.get("runId"),
      label: body?.label || body?.runLabel,
      datasetId: body?.datasetId || params.get("datasetId"),
      tapeDate: body?.tapeDate || body?.date,
      symbolCount: body?.symbolCount,
      manifestPath: body?.manifestPath,
      notes: body?.notes,
      tags: body?.tags,
      symbolSource: body?.symbolSource,
      maxSymbols: body?.maxSymbols,
      autoDiscoverConfig: body?.autoDiscoverConfig,
      source: body?.source || "ui",
    })
    respondJson(res, 200, { ok: true, run })
  } catch (err) {
    respondJson(res, 400, { error: err?.message || "Replay run registration failed" })
  }
}

async function requestHandler(req, res) {
  // Attach request ID for distributed tracing
  const requestId = attachRequestId(req, res)
  const log = createRequestLogger("market-data-gateway", requestId)

  try {
    const cors = applyCorsHeaders(res, req)
    if (req.method === "OPTIONS") {
      res.statusCode = cors.allowed ? 204 : 403
      res.end()
      return
    }

    const rate = checkRateLimit(req)
    if (!rate.allowed) {
      respondJson(res, 429, { error: "Rate limit exceeded." })
      return
    }

    const url = new URL(req.url || "/", "http://localhost")
    const path = url.pathname
    const params = url.searchParams

    // Log incoming request with request ID
    log.info(`${req.method} ${path}`)
    if (path === "/" || path === "/healthz" || path === "/readyz") {
      respondJson(res, 200, { status: "ok" })
      return
    }

    if (path === "/replay/buildTape") {
      if (req.method !== "POST") {
        respondJson(res, 405, { error: "Method not allowed" })
        return
      }
      await handleReplayBuildTape(req, res, params)
      return
    }

    if (path === "/replay/tapeSymbols") {
      const datasetId = params.get("datasetId")
      if (!datasetId) {
        respondJson(res, 400, { error: "Missing datasetId parameter" })
        return
      }
      try {
        const manifestPath = `${config.replayPrefix}/tapes/stocks/${datasetId}/manifest.json`
        const bucket = initStorage().bucket(config.replayBucket)
        const [content] = await bucket.file(manifestPath).download()
        const manifest = JSON.parse(content.toString("utf8"))
        const symbolMap = manifest?.symbolMap || {}
        // Extract stock symbols from the symbolMap keys (format: "stock:SYMBOL")
        const symbols = Object.keys(symbolMap)
          .filter((key) => key.startsWith("stock:"))
          .map((key) => key.replace("stock:", ""))
        respondJson(res, 200, { datasetId, symbols, count: symbols.length })
      } catch (err) {
        console.error("Failed to load tape symbols:", err.message)
        respondJson(res, 404, { error: "Tape not found or invalid", datasetId })
      }
      return
    }

    if (path === "/replay/runs") {
      if (req.method === "GET") {
        await handleReplayRunsList(req, res, params)
        return
      }
      if (req.method === "POST") {
        await handleReplayRegisterRun(req, res, params)
        return
      }
      respondJson(res, 405, { error: "Method not allowed" })
      return
    }

    if (req.method !== "GET") {
      respondJson(res, 405, { error: "Method not allowed" })
      return
    }

    const replayState = await resolveReplayState()
    await maybeAckReplayState(replayState)

    if (path === "/clock") {
      const payload = buildClockPayload(replayState)
      if (!payload.ok) {
        respondJson(res, 500, payload)
        return
      }
      respondJson(res, 200, payload)
      return
    }

    const replaySupportedPaths = new Set([
      "/v1/market/quote",
      "/v1/market/quotes",
      "/v1/market/candles",
      "/v1/market/profile",
      "/v1/market/shares-float",
      "/v1/market/news",
    ])

    if (replayState.mode === "replay" && !replaySupportedPaths.has(path)) {
      respondReplayUnsupported(res, `Replay does not support ${path}`)
      return
    }

    if (path === "/ping/market") {
      const payload = await resolveQuoteFallback("AAPL", "stock", Date.now())
      if (!payload) {
        respondJson(res, 503, { ok: false, error: "No quote providers configured." })
        return
      }
      respondJson(res, 200, { ok: true, source: payload.source || "unknown", sample: "AAPL" })
      return
    }
    if (path === "/ping/marketaux") {
      if (!config.marketauxKey) {
        respondJson(res, 503, { ok: false, error: "Marketaux key not configured." })
        return
      }
      const pingUrl = new URL(config.marketauxBaseUrl)
      pingUrl.searchParams.set("api_token", config.marketauxKey)
      pingUrl.searchParams.set("symbols", "AAPL")
      pingUrl.searchParams.set("limit", "1")
      pingUrl.searchParams.set("language", "en")
      await fetchJson(pingUrl.toString())
      respondJson(res, 200, { ok: true, source: "marketaux" })
      return
    }

    if (path === "/v1/market/quote") {
      await handleQuote(req, res, params, replayState)
      return
    }
    if (path === "/v1/market/aftermarket-quote") {
      await handleAftermarketQuote(req, res, params)
      return
    }
    if (path === "/v1/market/quotes") {
      await handleQuotes(req, res, params, replayState)
      return
    }
    if (path === "/v1/market/candles") {
      await handleCandles(req, res, params, replayState)
      return
    }
    if (path === "/v1/market/biggest-gainers") {
      await handleMoverList(req, res, params, "biggest-gainers")
      return
    }
    if (path === "/v1/market/biggest-losers") {
      await handleMoverList(req, res, params, "biggest-losers")
      return
    }
    if (path === "/v1/market/most-actives") {
      await handleMoverList(req, res, params, "most-actives")
      return
    }
    if (path === "/v1/market/search-symbol") {
      await handleSearch(req, res, params, "search-symbol")
      return
    }
    if (path === "/v1/market/search-name") {
      await handleSearch(req, res, params, "search-name")
      return
    }
    if (path === "/v1/market/stock-list") {
      await handleStockList(req, res)
      return
    }
    if (path === "/v1/market/crypto") {
      await handleCrypto(req, res, params)
      return
    }
    if (path === "/v1/market/indicators") {
      await handleIndicators(req, res, params)
      return
    }
    if (path === "/v1/market/profile") {
      await handleProfile(req, res, params, replayState)
      return
    }
    if (path === "/v1/market/shares-float") {
      await handleSharesFloat(req, res, params, replayState)
      return
    }
    if (path === "/v1/market/news") {
      await handleNews(req, res, params, replayState)
      return
    }
    if (path === "/v1/market/price-target") {
      await handlePriceTarget(req, res, params)
      return
    }
    if (path === "/v1/market/ratings") {
      await handleAnalystRatings(req, res, params)
      return
    }
    if (path === "/v1/market/ratings-snapshot") {
      await handleAnalystRatings(req, res, params)
      return
    }
    if (path === "/v1/market/ratings-historical") {
      await handleRatingsHistorical(req, res, params)
      return
    }
    if (path === "/v1/market/grades") {
      await handleGrades(req, res, params)
      return
    }
    if (path === "/v1/market/grades-historical") {
      await handleGradesHistorical(req, res, params)
      return
    }
    if (path === "/v1/market/grades-consensus") {
      await handleGradesConsensus(req, res, params)
      return
    }
    if (path === "/v1/marketaux/news") {
      await handleMarketauxNews(req, res, params)
      return
    }

    respondJson(res, 404, { error: "Not found" })
  } catch (error) {
    console.error("Gateway error:", error.message)
    respondJson(res, 500, { error: "Gateway error", detail: error.message })
  }
}

const server = http.createServer((req, res) => {
  requestHandler(req, res)
})

server.listen(config.port, () => {
  console.log("Market data gateway listening", { port: config.port })
})

initPipelineRedis().catch((err) => {
  console.error("Pipeline redis init failed:", err.message)
})

setInterval(() => {
  writeHealthStatus().catch(() => {})
}, Math.max(config.healthWriteMs, 5000))
writeHealthStatus().catch(() => {})

function shutdown() {
  if (pipelineRedis) {
    pipelineRedis.quit().catch(() => {})
  }
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
