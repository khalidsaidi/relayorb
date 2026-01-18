const http = require("http")
const crypto = require("crypto")
const admin = require("firebase-admin")
const { Storage } = require("@google-cloud/storage")
const { createClient } = require("redis")
const zlib = require("zlib")

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  fmpKey: process.env.FMP_API_KEY || "",
  marketauxKey: process.env.MARKETAUX_API_KEY || "",
  port: parseInt(process.env.PORT || "8080", 10),
  fmpBaseUrl: process.env.FMP_BASE_URL || "https://financialmodelingprep.com",
  fmpStableBaseUrl:
    process.env.FMP_STABLE_BASE_URL || "https://financialmodelingprep.com/stable",
  marketauxBaseUrl: process.env.MARKETAUX_BASE_URL || "https://api.marketaux.com/v1/news/all",
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
  corsOrigin: process.env.MDG_CORS_ORIGIN || "*",
  corsAllowHeaders: process.env.MDG_CORS_HEADERS || "Content-Type",
  replayAllowed: process.env.REPLAY_ALLOWED !== "false",
  replayBucket: process.env.REPLAY_GCS_BUCKET || process.env.REPLAY_BUCKET || "",
  replayPrefix: process.env.REPLAY_GCS_PREFIX || "replay",
  replayControlsCacheMs: parseInt(process.env.REPLAY_CONTROLS_CACHE_MS || "1500", 10),
  replayManifestCacheMs: parseInt(process.env.REPLAY_MANIFEST_CACHE_MS || "10000", 10),
  replayArtifactCacheMs: parseInt(process.env.REPLAY_ARTIFACT_CACHE_MS || "60000", 10),
  replayAckIntervalMs: parseInt(process.env.REPLAY_ACK_INTERVAL_MS || "15000", 10),
}

const cache = new Map()
let pipelineRedis = null
let pipelineRedisReady = false
let firestore = null
let storage = null
const replayControlsCache = { value: null, expiresAt: 0 }
const replayManifestCache = { value: null, expiresAt: 0, key: "" }
const replayArtifactCache = new Map()
const replayAckState = { lastSentAt: 0, lastSessionId: null, lastVersion: null, lastMode: null }
let lastReplayState = { mode: "live", runId: null, sessionId: null }

function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, ...data }))
}

function applyCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", config.corsOrigin)
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", config.corsAllowHeaders)
  res.setHeader("Access-Control-Max-Age", "86400")
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  logEvent("mdg_cache_hit", { key })
  return entry.value
}

function setCached(key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(ttlMs, 0),
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

function buildPipelineEvent(payload) {
  const runEnv = lastReplayState?.mode === "replay" ? "replay" : config.pipelineEventsRunEnv
  const runId = lastReplayState?.runId || undefined
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

function mapIntervalToFmp(interval) {
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

function normalizeFmpSymbol(symbol, assetClass) {
  if (!symbol) return ""
  const upper = String(symbol).trim().toUpperCase()
  if (!upper) return ""
  if (assetClass === "forex" || assetClass === "crypto") {
    return upper.replace(/[\/-]/g, "")
  }
  return upper.replace(/\s+/g, "")
}

function normalizeFmpQuoteSymbol(symbol, assetClass) {
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
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (i + 1)))
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

function respondJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": config.corsOrigin,
  })
  res.end(JSON.stringify(payload))
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
  const hour = parseInt(lookup.hour, 10)
  const minute = parseInt(lookup.minute, 10)
  const second = parseInt(lookup.second, 10)
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

async function resolveReplayState() {
  const controls = await readReplayControls()
  const desiredMode = controls?.desiredMode === "replay" ? "replay" : "live"
  if (!config.replayAllowed || desiredMode !== "replay") {
    lastReplayState = { mode: "live", runId: null, sessionId: null }
    return { mode: "live", controls }
  }
  const state = {
    mode: "replay",
    controls,
    runId: controls?.activeRunId || null,
    datasetId: controls?.datasetId || null,
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
  let runInfo = null
  try {
    if (state.runId) {
      const snap = await db.doc(`replay/controls/runs/${state.runId}`).get()
      runInfo = snap.exists ? snap.data() : null
    }
  } catch (err) {
    console.error("Replay run read failed:", err.message)
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
  let timeMs = null
  if (typeof rawTime === "number") {
    timeMs = rawTime > 1e12 ? rawTime : rawTime * 1000
  } else if (rawTime) {
    const parsed = new Date(rawTime).getTime()
    timeMs = Number.isFinite(parsed) ? parsed : null
  }
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

function buildFmpQuotePayload(entry, symbol, assetClass) {
  if (!entry) return null
  const bid = parseNumber(entry.bid)
  const ask = parseNumber(entry.ask)
  const volume = parseNumber(entry.volume) ?? parseNumber(entry.avgVolume)
  const changePercent = parsePercent(
    entry.changesPercentage ?? entry.changePercentage ?? entry.changePercent ?? entry.change
  )
  const price =
    parseNumber(entry.price) ??
    parseNumber(entry.lastSale) ??
    parseNumber(entry.last) ??
    parseNumber(entry.close) ??
    (bid !== undefined && ask !== undefined ? (bid + ask) / 2 : bid ?? ask)

  if (typeof price !== "number") return null

  return {
    symbol,
    assetClass,
    price,
    bid,
    ask,
    volume,
    changePercent,
    name: entry.name || entry.companyName || symbol,
    source: "fmp",
  }
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

  const fmpInterval = mapIntervalToFmp(interval)
  const context = await resolveReplaySymbolContext(replayState, assetClass, symbol)
  if (context.error) {
    respondReplayError(res, context.error.status, context.error.payload)
    return
  }
  const { legacyKey, symbolKeyV2, tapeDate, manifest, asOfMs, coverage } = context
  const isDaily = fmpInterval === "1day"
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
    const intervalMs = mapIntervalToMs(fmpInterval)
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
    interval: fmpInterval,
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

async function fetchFmpQuoteCached(symbol, assetClass) {
  const cacheKey = `fmp:quote:${assetClass}:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) return { payload: cached, cacheHit: true }

  const url = new URL(`${config.fmpStableBaseUrl}/quote`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)
  const data = await fetchJson(url.toString())
  const entry = Array.isArray(data) ? data[0] : data
  const payload = buildFmpQuotePayload(entry, symbol, assetClass)
  if (!payload) return { payload: null, cacheHit: false }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  return { payload, cacheHit: false }
}

async function handleFmpQuote(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayQuote(res, params, replayState)
    return
  }
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const normalized = normalizeFmpQuoteSymbol(symbol, assetClass)
  if (!normalized) {
    respondJson(res, 400, { error: "Invalid symbol" })
    return
  }
  const cacheKey = `fmp:quote:${assetClass}:${normalized}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        cacheHit: true,
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/quote`)
  url.searchParams.set("symbol", normalized)
  url.searchParams.set("apikey", config.fmpKey)
  let entry = null
  try {
    const data = await fetchJson(url.toString())
    entry = Array.isArray(data) ? data[0] : data
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  if (!entry) {
    respondJson(res, 404, { error: "Quote not found" })
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
        httpStatus: 404,
      },
    })
    return
  }

  const payload = buildFmpQuotePayload(entry, symbol, assetClass)
  if (!payload) {
    respondJson(res, 502, { error: "Invalid price response" })
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "quote",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass }),
        httpStatus: 502,
      },
      error: { message: "Invalid price response" },
    })
    return
  }
  setCached(cacheKey, payload, config.cacheDefaultMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "quote",
      assetClass,
      paramsHash: hashParams({ symbol: normalized, assetClass }),
      httpStatus: 200,
    },
  })
}

async function handleFmpQuotes(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayQuotes(res, params, replayState)
    return
  }
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
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
    const normalizedSymbol = normalizeFmpQuoteSymbol(symbol, assetClass)
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
    const cacheKey = `fmp:quote:${assetClass}:${symbol}`
    const cached = getCached(cacheKey)
    if (cached) {
      items.push(cached)
    } else {
      pending.push(symbol)
    }
  })

  if (pending.length > 0) {
    const batches = chunkList(pending, 100)
    for (const batch of batches) {
      const url = new URL(`${config.fmpStableBaseUrl}/quote`)
      url.searchParams.set("symbol", batch.join(","))
      url.searchParams.set("apikey", config.fmpKey)
      let entries = []
      try {
        const data = await fetchJson(url.toString())
        entries = Array.isArray(data) ? data : []
      } catch (err) {
        await emitProviderEvent({
          stationId: "provider:fmp",
          status: "error",
          startMs: startedAt,
          meta: {
            providerId: "fmp",
            endpointName: "quotes",
            assetClass,
            paramsHash: hashParams({ count: pending.length, assetClass }),
          },
          error: { message: err?.message ? String(err.message) : "Request failed" },
        })
        throw err
      }
      entries.forEach((entry) => {
        const entrySymbol = String(entry?.symbol || "").toUpperCase().trim()
        if (!entrySymbol) return
        const payload = buildFmpQuotePayload(entry, entrySymbol, assetClass)
        if (!payload) return
        const cacheKey = `fmp:quote:${assetClass}:${entrySymbol}`
        setCached(cacheKey, payload, config.cacheDefaultMs)
        items.push(payload)
      })
    }
  }

  respondJson(res, 200, { items, assetClass, source: "fmp" })
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "quotes",
      assetClass,
      cacheHit: items.length > 0 && pending.length === 0,
      paramsHash: hashParams({ count: uniqueSymbols.length, assetClass }),
      symbolsRequested: uniqueSymbols.length,
      symbolsReturned: items.length,
      httpStatus: 200,
    },
  })
}

async function handleFmpCandles(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayCandles(res, params, replayState)
    return
  }
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }
  const symbol = params.get("symbol") || ""
  const assetClass = params.get("assetClass") || "stock"
  const interval = params.get("interval") || "15min"
  const limit = clamp(parseInt(params.get("limit") || "120", 10), 1, 500)

  const normalized = normalizeFmpSymbol(symbol, assetClass)
  if (!normalized) {
    respondJson(res, 400, { error: "Invalid symbol" })
    return
  }

  const fmpInterval = mapIntervalToFmp(interval)
  const cacheKey = `fmp:candles:${assetClass}:${normalized}:${fmpInterval}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "candles",
        cacheHit: true,
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpBaseUrl}/stable/historical-chart/${fmpInterval}`)
  url.searchParams.set("symbol", normalized)
  url.searchParams.set("apikey", config.fmpKey)
  let data = []
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "candles",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  if (!Array.isArray(data)) {
    respondJson(res, 502, { error: "Invalid candles response" })
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "candles",
        assetClass,
        paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
        httpStatus: 502,
      },
      error: { message: "Invalid candles response" },
    })
    return
  }
  const candles = data
    .map((entry) => {
      const time = entry.date || entry.time || entry.timestamp
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

  const payload = {
    symbol,
    assetClass,
    interval: fmpInterval,
    candles: candles.slice(-limit),
    source: "fmp",
  }
  setCached(cacheKey, payload, config.cacheCandlesMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "candles",
      assetClass,
      paramsHash: hashParams({ symbol: normalized, assetClass, interval: fmpInterval, limit }),
      httpStatus: 200,
      candles: payload.candles.length,
    },
  })
}

async function handleFmpStockList(req, res) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }

  const cacheKey = "fmp:stock-list"
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "stock-list",
        cacheHit: true,
        paramsHash: hashParams("stock-list"),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  // Use stable API endpoint instead of deprecated v3 endpoint
  const url = new URL(`${config.fmpStableBaseUrl}/stock-list`)
  url.searchParams.set("apikey", config.fmpKey)
  let raw = ""
  try {
    raw = await fetchText(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "stock-list",
        paramsHash: hashParams("stock-list"),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }
  const trimmed = raw.trim()
  let items = []

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed)
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : []
    items = list
      .map((entry) => {
        const symbol = normalizeTicker(entry.symbol || entry.ticker || entry.Symbol || "")
        if (!symbol) return null
        return {
          symbol,
          name: entry.name || entry.companyName || entry.Name || symbol,
          exchange: entry.exchange || entry.Exchange || undefined,
          assetType: entry.type || entry.assetType || entry.Type || undefined,
        }
      })
      .filter(Boolean)
  } else {
    items = parseStockList(raw)
  }
  const payload = { items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheStockListMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "stock-list",
      paramsHash: hashParams("stock-list"),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpMoverList(req, res, params, endpointName) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }

  const limit = clamp(parseInt(params.get("limit") || "100", 10), 1, 250)
  const cacheKey = `fmp:movers:${endpointName}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName,
        cacheHit: true,
        paramsHash: hashParams({ limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/${endpointName}`)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJsonWithRetry(url.toString(), { timeoutMs: 12000 }, 2, 750)
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName,
        paramsHash: hashParams({ limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
  const payload = { data: items, source: "fmp", endpoint: endpointName }
  setCached(cacheKey, payload, config.cacheMarketsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName,
      paramsHash: hashParams({ limit }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpSearch(req, res, params, endpointName) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }

  const query = params.get("query") || ""
  if (!query) {
    respondJson(res, 400, { error: "Missing query" })
    return
  }

  const limit = clamp(parseInt(params.get("limit") || "50", 10), 1, 100)
  const cacheKey = `fmp:search:${endpointName}:${query}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName,
        cacheHit: true,
        paramsHash: hashParams({ query, limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/${endpointName}`)
  url.searchParams.set("query", query)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName,
        paramsHash: hashParams({ query, limit }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
  const payload = { data: items, source: "fmp", endpoint: endpointName }
  setCached(cacheKey, payload, config.cacheMarketsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName,
      paramsHash: hashParams({ query, limit }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpCrypto(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP API key is not configured" })
    return
  }

  const limit = clamp(parseInt(params.get("limit") || "50", 10), 1, 250)

  const cacheKey = `fmp:crypto:markets:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: "crypto_markets",
        cacheHit: true,
        paramsHash: hashParams({ limit }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()

  // Top crypto symbols to fetch. Fetch quotes individually (stable/quote is single-symbol for crypto).
  const topCryptoSymbols = [
    "BTCUSD", "ETHUSD", "USDTUSD", "BNBUSD", "SOLUSD",
    "XRPUSD", "USDCUSD", "ADAUSD", "DOGUSD", "TRXUSD",
    "AVAXUSD", "TONUSD", "LINKUSD", "SHIBUSD", "WBTCUSD",
    "DOTUSD", "BCHUSD", "NEARCUSD", "MATICUSD", "LTCUSD",
    "DAITUSD", "UNIUSD", "ICPUSD", "APTUSD", "ETCUSD",
    "FILUSD", "RENDERUSD", "STXUSD", "ATOMUSD", "ARBUSD",
    "XLMUSD", "ALGOUSD", "GRTUSD", "SANDUSD", "MANAUSD",
    "AAVEUSD", "FTMUSD", "MKRUSD", "SNXUSD", "COMPUSD",
    "SUSHIUSD", "ZECUSD", "YFIUSD", "ENJUSD", "CHZUSD",
    "BATCUSD", "1INCHUSD", "ZRXUSD", "RVNUSD", "QTUMUSD"
  ].slice(0, limit)

  const data = []
  const errors = []
  let cacheHits = 0

  const concurrency = clamp(config.cryptoQuoteConcurrency, 1, 20)
  for (let i = 0; i < topCryptoSymbols.length; i += concurrency) {
    const batch = topCryptoSymbols.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map((symbol) => fetchFmpQuoteCached(symbol, "crypto"))
    )
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const payload = result.value?.payload
        if (payload) {
          if (result.value.cacheHit) cacheHits += 1
          data.push(payload)
          return
        }
        errors.push({ symbol: batch[index], error: "Empty quote response" })
        return
      }
      const message = result.reason?.message ? String(result.reason.message) : "Request failed"
      errors.push({ symbol: batch[index], error: message })
    })
  }

  if (data.length === 0) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: "crypto_markets",
        paramsHash: hashParams({ limit }),
      },
      error: { message: "No crypto data fetched", errors: errors.slice(0, 3) },
    })
    respondJson(res, 502, { error: "Failed to fetch crypto data", errors })
    return
  }

  // Sort by volume descending
  const sorted = data
    .filter(item => item && item.symbol && item.volume > 0)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))

  const payload = {
    data: sorted.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      changePercentage: item.changePercent,
      volume: item.volume,
    })),
    source: "fmp",
  }
  setCached(cacheKey, payload, config.cacheMarketsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "crypto_markets",
      paramsHash: hashParams({ limit }),
      httpStatus: 200,
      count: sorted.length,
      cacheHits,
      errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
    },
  })
}

async function handleFmpIndicators(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

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

  const cacheKey = `fmp:indicator:${indicator}:${symbol}:${period}:${timeframe}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "end",
      meta: {
        providerId: "fmp",
        endpointName: `indicator_${indicator}`,
        cacheHit: true,
        paramsHash: hashParams({ symbol, indicator, period, timeframe }),
        httpStatus: 200,
      },
    })
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/technical-indicators/${indicator}`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("periodLength", String(period))
  url.searchParams.set("timeframe", timeframe)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: {
        providerId: "fmp",
        endpointName: `indicator_${indicator}`,
        paramsHash: hashParams({ symbol, indicator, period, timeframe }),
      },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data.slice(0, limit) : []
  const payload = { symbol, indicator, period, timeframe, data: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheCandlesMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: `indicator_${indicator}`,
      paramsHash: hashParams({ symbol, indicator, period, timeframe }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpProfile(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayProfile(res, params, replayState)
    return
  }
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:profile:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/profile`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "profile", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const profile = Array.isArray(data) ? data[0] : null
  const payload = { symbol, profile, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 10) // cache profile longer
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "profile",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
}

async function handleFmpNews(req, res, params, replayState) {
  if (replayState?.mode === "replay") {
    await handleReplayNews(res, params, replayState)
    return
  }
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase()
  const limit = clamp(parseInt(params.get("limit") || "20", 10), 1, 100)

  const cacheKey = `fmp:news:${symbol}:${limit}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  // Use /stable/news/stock endpoint (not /stable/stock-news)
  const url = new URL(`${config.fmpStableBaseUrl}/news/stock`)
  if (symbol) url.searchParams.set("symbols", symbol)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "stock_news", paramsHash: hashParams({ symbol, limit }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data : []
  const payload = { symbol: symbol || "all", data: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheNewsMs)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "stock_news",
      paramsHash: hashParams({ symbol, limit }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpPriceTarget(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:pricetarget:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/price-target-consensus`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "price_target", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const target = Array.isArray(data) ? data[0] : null
  const payload = { symbol, priceTarget: target, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 5)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "price_target",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
}

async function handleFmpAnalystRatings(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:ratings:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/ratings-snapshot`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "ratings-snapshot", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const rating = Array.isArray(data) ? data[0] : null
  const payload = { symbol, rating, source: "fmp", endpoint: "ratings-snapshot" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 5)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "ratings-snapshot",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
}

async function handleFmpRatingsHistorical(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:ratings-historical:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/ratings-historical`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "ratings-historical", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data : []
  const payload = { symbol, ratings: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 10)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "ratings-historical",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpGrades(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:grades:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/grades`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "grades", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data : []
  const payload = { symbol, grades: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 10)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "grades",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpGradesHistorical(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:grades-historical:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/grades-historical`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "grades-historical", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const items = Array.isArray(data) ? data : []
  const payload = { symbol, grades: items, source: "fmp" }
  setCached(cacheKey, payload, config.cacheMarketsMs * 10)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "grades-historical",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
      count: items.length,
    },
  })
}

async function handleFmpGradesConsensus(req, res, params) {
  if (!config.fmpKey) {
    respondJson(res, 500, { error: "FMP_API_KEY is not configured" })
    return
  }

  const symbol = (params.get("symbol") || "").toUpperCase().replace(/[/-]/g, "")
  if (!symbol) {
    respondJson(res, 400, { error: "Missing symbol" })
    return
  }

  const cacheKey = `fmp:grades-consensus:${symbol}`
  const cached = getCached(cacheKey)
  if (cached) {
    respondJson(res, 200, cached)
    return
  }

  const startedAt = Date.now()
  const url = new URL(`${config.fmpStableBaseUrl}/grades-consensus`)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("apikey", config.fmpKey)

  let data = null
  try {
    data = await fetchJson(url.toString())
  } catch (err) {
    await emitProviderEvent({
      stationId: "provider:fmp",
      status: "error",
      startMs: startedAt,
      meta: { providerId: "fmp", endpointName: "grades-consensus", paramsHash: hashParams({ symbol }) },
      error: { message: err?.message ? String(err.message) : "Request failed" },
    })
    throw err
  }

  const consensus = Array.isArray(data) ? data[0] : null
  // Cache for 6 hours since analyst grades don't change frequently
  const payload = { symbol, consensus, source: "fmp" }
  setCached(cacheKey, payload, 6 * 60 * 60 * 1000)
  respondJson(res, 200, payload)
  await emitProviderEvent({
    stationId: "provider:fmp",
    status: "end",
    startMs: startedAt,
    meta: {
      providerId: "fmp",
      endpointName: "grades-consensus",
      paramsHash: hashParams({ symbol }),
      httpStatus: 200,
    },
  })
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

async function requestHandler(req, res) {
  try {
    applyCorsHeaders(res)
    if (req.method === "OPTIONS") {
      res.statusCode = 204
      res.end()
      return
    }

    const url = new URL(req.url || "/", "http://localhost")
    const path = url.pathname
    if (path === "/" || path === "/healthz" || path === "/readyz") {
      respondJson(res, 200, { status: "ok" })
      return
    }

    if (req.method !== "GET") {
      respondJson(res, 405, { error: "Method not allowed" })
      return
    }

    const params = url.searchParams
    const replayState = await resolveReplayState()
    await maybeAckReplayState(replayState)

    const replaySupportedPaths = new Set([
      "/v1/fmp/quote",
      "/v1/fmp/quotes",
      "/v1/fmp/candles",
      "/v1/fmp/profile",
      "/v1/fmp/news",
    ])

    if (replayState.mode === "replay" && !replaySupportedPaths.has(path)) {
      respondReplayUnsupported(res, `Replay does not support ${path}`)
      return
    }

    if (path === "/ping/fmp") {
      if (!config.fmpKey) {
        respondJson(res, 503, { ok: false, error: "FMP key not configured." })
        return
      }
      const pingUrl = new URL(`${config.fmpStableBaseUrl}/quote`)
      pingUrl.searchParams.set("symbol", "AAPL")
      pingUrl.searchParams.set("apikey", config.fmpKey)
      const data = await fetchJson(pingUrl.toString())
      respondJson(res, 200, {
        ok: true,
        source: "fmp",
        sample: Array.isArray(data) ? data?.[0]?.symbol || null : null,
      })
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

    if (path === "/v1/fmp/quote") {
      await handleFmpQuote(req, res, params, replayState)
      return
    }
    if (path === "/v1/fmp/quotes") {
      await handleFmpQuotes(req, res, params, replayState)
      return
    }
    if (path === "/v1/fmp/candles") {
      await handleFmpCandles(req, res, params, replayState)
      return
    }
    if (path === "/v1/fmp/biggest-gainers") {
      await handleFmpMoverList(req, res, params, "biggest-gainers")
      return
    }
    if (path === "/v1/fmp/biggest-losers") {
      await handleFmpMoverList(req, res, params, "biggest-losers")
      return
    }
    if (path === "/v1/fmp/most-actives") {
      await handleFmpMoverList(req, res, params, "most-actives")
      return
    }
    if (path === "/v1/fmp/search-symbol") {
      await handleFmpSearch(req, res, params, "search-symbol")
      return
    }
    if (path === "/v1/fmp/search-name") {
      await handleFmpSearch(req, res, params, "search-name")
      return
    }
    if (path === "/v1/fmp/stock-list") {
      await handleFmpStockList(req, res)
      return
    }
    if (path === "/v1/fmp/crypto") {
      await handleFmpCrypto(req, res, params)
      return
    }
    if (path === "/v1/fmp/indicators") {
      await handleFmpIndicators(req, res, params)
      return
    }
    if (path === "/v1/fmp/profile") {
      await handleFmpProfile(req, res, params, replayState)
      return
    }
    if (path === "/v1/fmp/news") {
      await handleFmpNews(req, res, params, replayState)
      return
    }
    if (path === "/v1/fmp/price-target") {
      await handleFmpPriceTarget(req, res, params)
      return
    }
    if (path === "/v1/fmp/ratings") {
      await handleFmpAnalystRatings(req, res, params)
      return
    }
    if (path === "/v1/fmp/ratings-snapshot") {
      await handleFmpAnalystRatings(req, res, params)
      return
    }
    if (path === "/v1/fmp/ratings-historical") {
      await handleFmpRatingsHistorical(req, res, params)
      return
    }
    if (path === "/v1/fmp/grades") {
      await handleFmpGrades(req, res, params)
      return
    }
    if (path === "/v1/fmp/grades-historical") {
      await handleFmpGradesHistorical(req, res, params)
      return
    }
    if (path === "/v1/fmp/grades-consensus") {
      await handleFmpGradesConsensus(req, res, params)
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

function shutdown() {
  if (pipelineRedis) {
    pipelineRedis.quit().catch(() => {})
  }
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
