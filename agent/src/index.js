import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import crypto from "node:crypto"
import admin from "firebase-admin"
import { createClient } from "redis"
import AlpacaAdapter from "../adapters/alpaca/adapter.js"
import OandaAdapter from "../adapters/oanda/adapter.js"

const CONFIG_ENV = "RELAYORB_CONFIG_PATH"
const DEFAULT_CONFIG = "config.json"
const FREQTRADE_CONFIG_PATH = process.env.RELAYORB_FREQTRADE_CONFIG || ""
const REDIS_URL = process.env.REDIS_URL || ""
const REDIS_PREFIX = process.env.REDIS_PREFIX || "relayorb"
const EVENT_CHANNEL =
  process.env.RELAYORB_EVENT_CHANNEL || `${REDIS_PREFIX}:events`
const RUN_ID = process.env.RELAYORB_RUN_ID || process.env.RUN_ID || ""
const EVENT_AUTO_SCAN = process.env.RELAYORB_EVENT_AUTO_SCAN !== "false"
const EVENT_BATCH_LIMIT = parseInt(
  process.env.RELAYORB_EVENT_BATCH_LIMIT || "25",
  10
)
const EVENT_DEBOUNCE_MS = parseInt(
  process.env.RELAYORB_EVENT_DEBOUNCE_MS || "60000",
  10
)
const BATCH_COLLECTION = process.env.RELAYORB_BATCH_COLLECTION || "batches"
const BATCH_CONSUMER_ID = process.env.RELAYORB_BATCH_CONSUMER_ID || "agent"
const BATCH_POLL_ENABLED = process.env.RELAYORB_BATCH_POLL_ENABLED !== "false"
const BATCH_POLL_INTERVAL_MS = parseInt(
  process.env.RELAYORB_BATCH_POLL_INTERVAL_MS || "15000",
  10
)
const BATCH_POLL_LIMIT = parseInt(
  process.env.RELAYORB_BATCH_POLL_LIMIT || "3",
  10
)
const PIPELINE_EVENTS_ENABLED = process.env.PIPELINE_EVENTS_ENABLED !== "false"
const PIPELINE_EVENTS_STREAM = process.env.PIPELINE_EVENTS_STREAM || ""
const PIPELINE_EVENTS_MAXLEN = parseInt(
  process.env.PIPELINE_EVENTS_MAXLEN || "20000",
  10
)
const PIPELINE_EVENTS_SAMPLE_RATE = parseFloat(
  process.env.PIPELINE_EVENTS_SAMPLE_RATE || "0.15"
)
const PIPELINE_EVENTS_RUN_ENV = process.env.PIPELINE_EVENTS_RUN_ENV || "prod"

// Structured JSON logging for Cloud Logging
const STRUCTURED_LOGGING = process.env.STRUCTURED_LOGGING === "true"

const log = (message, extra = {}) => {
  const stamp = new Date().toISOString()
  if (STRUCTURED_LOGGING) {
    const entry = {
      severity: "INFO",
      message: typeof message === "string" ? message : JSON.stringify(message),
      timestamp: stamp,
      service: "relayorb-agent",
      ...extra,
    }
    console.log(JSON.stringify(entry))
    return
  }
  console.log(`[relayorb-agent ${stamp}] ${message}`)
}

const logEvent = (event, data = {}) => {
  const payload = { event, ...(RUN_ID ? { runId: RUN_ID } : {}), ...data }
  if (STRUCTURED_LOGGING) {
    const entry = {
      severity: "INFO",
      message: event,
      timestamp: new Date().toISOString(),
      service: "relayorb-agent",
      ...payload,
    }
    console.log(JSON.stringify(entry))
  } else {
    log(JSON.stringify(payload))
  }
}

const logError = (message, error = null, extra = {}) => {
  const stamp = new Date().toISOString()
  if (STRUCTURED_LOGGING) {
    const entry = {
      severity: "ERROR",
      message: typeof message === "string" ? message : JSON.stringify(message),
      timestamp: stamp,
      service: "relayorb-agent",
      error: error?.message || null,
      stack: error?.stack || null,
      ...extra,
    }
    console.error(JSON.stringify(entry))
  } else {
    console.error(`[relayorb-agent ${stamp}] ERROR: ${message}`, error)
  }
}

let pipelineRedis = null
let pipelineRedisReady = false

// Agent health tracking
const agentHealth = {
  startedAt: Date.now(),
  lastHeartbeatAt: null,
  bots: new Map(), // botId -> { lastPollAt, lastSignalAt, consecutiveErrors, status }
}
const HEARTBEAT_INTERVAL_MS = 300000 // 5 minutes

function resolvePipelineStream() {
  if (PIPELINE_EVENTS_STREAM) return PIPELINE_EVENTS_STREAM
  const prefix = REDIS_PREFIX ? `${REDIS_PREFIX}:` : ""
  return `${prefix}pipeline_events`
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

function buildPipelineEvent(payload) {
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv: PIPELINE_EVENTS_RUN_ENV,
    service: "relayorb-agent",
    severity: "info",
    ...payload,
  }
}

async function publishPipelineEvent(event) {
  if (!PIPELINE_EVENTS_ENABLED || !pipelineRedis || !pipelineRedisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(PIPELINE_EVENTS_MAXLEN)
    ? Math.max(PIPELINE_EVENTS_MAXLEN, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ["XADD", stream, "MAXLEN", "~", String(maxlen), "*", "payload", payload]
  try {
    await Promise.race([
      pipelineRedis.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    log(`pipeline event publish failed: ${String(err)}`)
  }
}

async function initPipelineRedis() {
  if (!REDIS_URL || !PIPELINE_EVENTS_ENABLED) return null
  const client = createClient({ url: REDIS_URL })
  client.on("error", (err) => {
    pipelineRedisReady = false
    log(`pipeline redis error: ${String(err)}`)
  })
  try {
    await client.connect()
    pipelineRedisReady = true
    pipelineRedis = client
    return client
  } catch (err) {
    pipelineRedisReady = false
    log(`pipeline redis connect failed: ${String(err)}`)
    return null
  }
}

const DEFAULT_CAPABILITIES = {
  freqtrade: {
    exchanges: ["kraken", "coinbase", "kucoin", "bybit", "okx"],
    timeframes: ["1m", "5m", "15m", "1h", "4h", "1d"],
    modes: ["signal", "paper", "live"],
  },
  alpaca: {
    assetClasses: ["stock"],
    timeframes: ["1m", "5m", "15m", "1h", "1d"],
    modes: ["signal"],
  },
  backtrader: {
    assetClasses: ["stock", "forex"],
    timeframes: ["15m", "1h", "4h", "1d"],
    modes: ["signal"],
  },
  oanda: {
    assetClasses: ["forex"],
    timeframes: ["1m", "5m", "15m", "1h", "4h", "1d"],
    modes: ["signal"],
  },
}

function resolveConfigPath() {
  const rawPath = process.env[CONFIG_ENV] || DEFAULT_CONFIG
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath)
}

async function loadConfig() {
  const configPath = resolveConfigPath()
  const raw = await fs.readFile(configPath, "utf8")
  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.bots)) {
    throw new Error("Config must include a bots array")
  }
  return parsed
}

function initFirestore(projectId) {
  const credential = admin.credential.applicationDefault()
  admin.initializeApp({
    credential,
    projectId: projectId || undefined,
  })
  const db = admin.firestore()
  db.settings({ ignoreUndefinedProperties: true })
  return db
}

function createDeduper(limit = 200) {
  const cache = new Set()
  return {
    has(key) {
      return cache.has(key)
    },
    add(key) {
      cache.add(key)
      if (cache.size > limit) {
        const items = Array.from(cache)
        cache.clear()
        for (const item of items.slice(-Math.floor(limit / 2))) {
          cache.add(item)
        }
      }
    },
  }
}

function resolveCapabilities(bot) {
  const base = DEFAULT_CAPABILITIES[bot.engine] || {}
  if (!bot.capabilities) return base

  return {
    exchanges: bot.capabilities.exchanges?.length ? bot.capabilities.exchanges : base.exchanges,
    timeframes: bot.capabilities.timeframes?.length ? bot.capabilities.timeframes : base.timeframes,
    modes: bot.capabilities.modes?.length ? bot.capabilities.modes : base.modes,
  }
}

function resolveTradingMode(bot) {
  const raw = typeof bot?.desiredConfig?.mode === "string" ? bot.desiredConfig.mode : ""
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return "paper"
  if (normalized === "live") return "live"
  if (["paper", "dry-run", "dryrun", "signal"].includes(normalized)) return "paper"
  return normalized
}

function withBaseUrl(baseUrl, endpoint) {
  return `${baseUrl.replace(/\/$/, "")}${endpoint}`
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw)
  } catch (err) {
    return null
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
}


function normalizePair(pair, separator) {
  if (!pair) return pair
  const trimmed = String(pair).trim().toUpperCase()
  if (separator === "/") return trimmed.replace(/-/g, "/")
  if (separator === "-") return trimmed.replace(/\//g, "-")
  return trimmed
}

const SIGNAL_QUOTES = ["USDT", "USDC", "USD", "BTC", "ETH", "EUR"]
const FX_CODES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "SEK",
  "NOK",
  "MXN",
  "CNH",
])

function looksLikePair(left, right) {
  if (!left || !right) return false
  const base = String(left).toUpperCase()
  const quote = String(right).toUpperCase()
  if (SIGNAL_QUOTES.includes(quote)) return true
  if (FX_CODES.has(base) && FX_CODES.has(quote)) return true
  return false
}

function normalizeSignalSymbol(value) {
  if (!value) return null
  const upper = String(value).trim().toUpperCase()
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
  if (compact.length === 6) {
    const base = compact.slice(0, 3)
    const quote = compact.slice(3)
    if (FX_CODES.has(base) && FX_CODES.has(quote)) {
      return `${base}/${quote}`
    }
  }
  for (const quote of SIGNAL_QUOTES) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      return `${compact.slice(0, -quote.length)}/${quote}`
    }
  }
  return compact
}

function resolveBotAssetClass(bot) {
  const desired = bot?.desiredConfig?.assetClass
  if (desired) return String(desired).toLowerCase()
  const engine = String(bot?.engine || "").toLowerCase()
  if (engine === "freqtrade") return "crypto"
  if (engine === "oanda") return "forex"
  if (engine === "alpaca") return "stock"
  if (engine === "backtrader") return "stock"
  return null
}

function candidateMagnitude(candidate) {
  const values = [
    candidate?.change15m,
    candidate?.change5m,
    candidate?.change1m,
    candidate?.change24h,
  ].filter((value) => typeof value === "number")
  if (!values.length) return 0
  return Math.max(...values.map((value) => Math.abs(value)))
}

function selectCandidateSymbols(items, assetClass, limit) {
  if (!Array.isArray(items)) return []
  const trimmed = items
    .filter((item) => item?.assetClass === assetClass && item?.symbol)
    .sort((a, b) => candidateMagnitude(b) - candidateMagnitude(a))
    .slice(0, Math.max(limit, 0))
    .map((item) => normalizeSignalSymbol(item.symbol))
    .filter(Boolean)
  return Array.from(new Set(trimmed))
}

async function readCandidateBatch(db) {
  try {
    const snap = await db.doc("market/candidates").get()
    if (!snap.exists) return null
    const data = snap.data() || {}
    const items = Array.isArray(data.items) ? data.items : []
    const batchId = data.batchId || data.meta?.runId || null
    return { items, batchId }
  } catch (err) {
    log(`candidate batch read failed: ${String(err)}`)
    return null
  }
}

function resolveBatchCollection(db) {
  return db.collection(BATCH_COLLECTION)
}

function resolveBatchConsumerDoc(db) {
  return db.collection("batch_consumers").doc(BATCH_CONSUMER_ID)
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === "function") return value.toDate()
  return null
}

async function readBatchDoc(db, batchId) {
  if (!batchId) return null
  try {
    const snap = await resolveBatchCollection(db).doc(batchId).get()
    if (!snap.exists) return null
    const data = snap.data() || {}
    return {
      id: snap.id,
      items: Array.isArray(data.items) ? data.items : [],
      createdAt: toDate(data.createdAt),
    }
  } catch (err) {
    log(`batch read failed: ${String(err)}`)
    return null
  }
}

async function readBatchConsumerState(db) {
  try {
    const snap = await resolveBatchConsumerDoc(db).get()
    if (!snap.exists) return null
    const data = snap.data() || {}
    return {
      lastBatchId: data.lastBatchId || null,
      lastProcessedAt: toDate(data.lastProcessedAt),
    }
  } catch (err) {
    log(`batch consumer read failed: ${String(err)}`)
    return null
  }
}

async function updateBatchConsumerState(db, batchId) {
  if (!batchId) return
  try {
    await resolveBatchConsumerDoc(db).set(
      {
        lastBatchId: batchId,
        lastProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        runId: RUN_ID || null,
      },
      { merge: true }
    )
    logEvent("ag_cursor_advance", { batchId })
  } catch (err) {
    log(`batch consumer update failed: ${String(err)}`)
  }
}

async function fetchPendingBatches(db, lastProcessedAt) {
  try {
    let query = resolveBatchCollection(db)
    if (lastProcessedAt) {
      query = query
        .where("createdAt", ">", lastProcessedAt)
        .orderBy("createdAt", "asc")
        .limit(BATCH_POLL_LIMIT)
    } else {
      query = query.orderBy("createdAt", "desc").limit(1)
    }
    const snap = await query.get()
    if (snap.empty) return []
    const docs = snap.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        items: Array.isArray(data.items) ? data.items : [],
        createdAt: toDate(data.createdAt),
      }
    })
    if (!lastProcessedAt) return docs.reverse()
    return docs
  } catch (err) {
    log(`batch lookup failed: ${String(err)}`)
    return []
  }
}

async function queueScanCommand(db, bot, symbols, assetClass) {
  if (!symbols.length) return
  const commandsRef = db.collection("bots").doc(bot.id).collection("commands")
  await commandsRef.add({
    type: bot.eventCommand || "scan",
    payload: {
      symbols,
      assetClass,
      timeframe: bot?.desiredConfig?.timeframe,
      strategy: bot?.desiredConfig?.strategy,
    },
    status: "queued",
    requestedBy: "event:new_batch",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  logEvent("ag_queue_scan", {
    botId: bot.id,
    assetClass,
    count: symbols.length,
  })
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: `bot_engine:${bot.engine || "unknown"}`,
      eventType: "bot_run",
      edgeKey: `relayorb_agent->bot_engine:${bot.engine || "unknown"}`,
      nodeIds: ["relayorb_agent", `bot_engine:${bot.engine || "unknown"}`],
      status: "end",
      batchId: RUN_ID || undefined,
      meta: {
        botId: bot.id,
        engine: bot.engine,
        botEngineId: bot.engine,
        assetClass,
        count: symbols.length,
        mode: bot?.desiredConfig?.mode || null,
        strategy: bot?.desiredConfig?.strategy || null,
        timeframe: bot?.desiredConfig?.timeframe || null,
        tradingMode: resolveTradingMode(bot),
      },
    })
  )
}

async function triggerBatchScan(db, bots, items) {
  const limit = Math.max(EVENT_BATCH_LIMIT, 1)
  for (const bot of bots) {
    const shouldTrigger =
      bot.eventTrigger !== undefined ? Boolean(bot.eventTrigger) : EVENT_AUTO_SCAN
    if (!shouldTrigger) continue
    const assetClass = resolveBotAssetClass(bot)
    if (!assetClass) continue
    const symbols = selectCandidateSymbols(items, assetClass, limit)
    if (symbols.length === 0) continue
    try {
      await queueScanCommand(db, bot, symbols, assetClass)
      log(`queued ${symbols.length} symbols for ${bot.id}`)
    } catch (err) {
      log(`event scan failed for ${bot.id}: ${String(err)}`)
    }
  }
}

async function handleBatchScan(db, bots, batch) {
  const items =
    Array.isArray(batch?.items) && batch.items.length
      ? batch.items
      : (await readCandidateBatch(db))?.items || []
  if (!items.length) return
  logEvent("ag_read_candidates", {
    batchId: batch?.id || batch?.batchId || null,
    count: items.length,
  })
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "agent",
      eventType: "fs_read",
      edgeKey: "firestore->relayorb_agent",
      nodeIds: ["relayorb_agent", "firestore"],
      status: "end",
      batchId: batch?.id || batch?.batchId || undefined,
      meta: {
        candidateCount: items.length,
      },
      inputs: {
        firestoreDocs: [batch?.id ? `${BATCH_COLLECTION}/${batch.id}` : "market/candidates"],
      },
    })
  )
  await triggerBatchScan(db, bots, items)
  if (batch?.id) {
    await updateBatchConsumerState(db, batch.id)
  }
}

let batchPollInFlight = false
async function pollForBatches(db, bots) {
  if (batchPollInFlight) return
  batchPollInFlight = true
  try {
    const state = await readBatchConsumerState(db)
    const pending = await fetchPendingBatches(db, state?.lastProcessedAt || null)
    for (const batch of pending) {
      if (!batch?.id) continue
      if (batch.id === state?.lastBatchId) continue
      logEvent("ag_poll_missed_batches", { batchId: batch.id })
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: "agent",
          eventType: "batch_poll",
          edgeKey: "firestore->relayorb_agent",
          nodeIds: ["relayorb_agent", "firestore"],
          status: "end",
          batchId: batch.id,
          meta: { source: "poll", candidateCount: batch.items?.length || 0 },
        })
      )
      await handleBatchScan(db, bots, batch)
    }
  } catch (err) {
    log(`batch poll failed: ${String(err)}`)
  } finally {
    batchPollInFlight = false
  }
}

function startBatchPoller(db, bots) {
  if (!BATCH_POLL_ENABLED) return
  pollForBatches(db, bots).catch(() => {})
  setInterval(() => {
    pollForBatches(db, bots).catch(() => {})
  }, BATCH_POLL_INTERVAL_MS)
}

async function startEventListener(db, bots) {
  if (!REDIS_URL) return
  const client = createClient({ url: REDIS_URL })
  client.on("error", (err) => {
    log(`redis error: ${String(err)}`)
  })

  try {
    await client.connect()
  } catch (err) {
    log(`redis connect failed: ${String(err)}`)
    return
  }

  const subscriber = client.duplicate()
  await subscriber.connect()
  let lastEventAt = 0
  let lastBatchId = null

  await subscriber.subscribe(EVENT_CHANNEL, async (message) => {
    let payload
    try {
      payload = JSON.parse(message)
    } catch {
      return
    }
    if (payload?.type !== "new_batch") return
    const batchId = payload.batchId || payload.runId || null
    const eventRunId = payload.runId || null
    const now = Date.now()
    if (batchId && batchId === lastBatchId) return
    if (now - lastEventAt < EVENT_DEBOUNCE_MS) return
    lastEventAt = now
    lastBatchId = batchId

    logEvent("ag_new_batch_received", { batchId, runId: eventRunId || RUN_ID || null })
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "agent",
        eventType: "batch_consume",
        edgeKey: "new_batch->relayorb_agent",
        nodeIds: ["relayorb_agent", "new_batch"],
        status: "end",
        batchId: batchId || undefined,
        meta: { source: "redis_event", runId: eventRunId || RUN_ID || null },
        inputs: {
          redisKeys: [EVENT_CHANNEL],
        },
      })
    )
    const batchDoc = batchId ? await readBatchDoc(db, batchId) : null
    if (batchDoc && batchDoc.items.length) {
      await handleBatchScan(db, bots, batchDoc)
      lastBatchId = batchId
      return
    }

    const fallback = await readCandidateBatch(db)
    if (!fallback || !fallback.items.length) return
    await handleBatchScan(db, bots, {
      id: batchId || fallback.batchId,
      items: fallback.items,
    })
    lastBatchId = batchId || fallback.batchId
  })

  log(`redis event listener active on ${EVENT_CHANNEL}`)
}

function extractSymbolFromText(text) {
  if (!text) return null
  const upper = String(text).toUpperCase()
  const match = upper.match(/[A-Z0-9]{2,10}[/-][A-Z0-9]{2,10}/)
  if (match) return normalizeSignalSymbol(match[0])
  const tokens = upper.match(/\b[A-Z0-9]{6,12}\b/g) || []
  for (const token of tokens) {
    const normalized = normalizeSignalSymbol(token)
    if (normalized && normalized.includes("/")) return normalized
  }
  return null
}

function resolveSignalSymbol(signal) {
  if (!signal || typeof signal !== "object") return null
  const data = signal.data || {}
  const candidate =
    signal.symbol ||
    signal.pair ||
    data.pair ||
    data.symbol ||
    data.trading_pair ||
    data.tradingPair ||
    data.market ||
    data.instrument
  const normalized = normalizeSignalSymbol(candidate)
  if (normalized) return normalized
  return extractSymbolFromText(signal.message)
}

function parseSignalTimestamp(signal) {
  if (!signal || typeof signal !== "object") return null
  const data = signal.data || {}
  const candidate =
    signal.timestamp ??
    signal.time ??
    signal.createdAt ??
    data.timestamp ??
    data.time ??
    data.ts ??
    data.createdAt ??
    data.created_at

  if (!candidate) return null
  if (candidate instanceof Date) return candidate
  if (typeof candidate?.toDate === "function") return candidate.toDate()
  if (typeof candidate === "number") {
    const ms = candidate < 1e12 ? candidate * 1000 : candidate
    const date = new Date(ms)
    return Number.isFinite(date.getTime()) ? date : null
  }
  if (typeof candidate === "string") {
    const date = new Date(candidate)
    return Number.isFinite(date.getTime()) ? date : null
  }
  return null
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object") return target
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const base = target[key] && typeof target[key] === "object" ? target[key] : {}
      target[key] = mergeDeep({ ...base }, value)
      continue
    }
    if (value !== undefined) {
      target[key] = value
    }
  }
  return target
}

function resolveAdvanced(payload, engine) {
  if (!payload || typeof payload !== "object") return null
  const advanced = payload.advanced
  if (!advanced || typeof advanced !== "object") return null
  if (engine && advanced[engine]) return advanced[engine]
  if (engine && advanced[`${engine}Config`]) return advanced[`${engine}Config`]
  if (engine && advanced[`${engine}_config`]) return advanced[`${engine}_config`]
  return advanced
}

async function applyFreqtradeConfig(payload) {
  if (!FREQTRADE_CONFIG_PATH) {
    return { applied: false, note: "Missing RELAYORB_FREQTRADE_CONFIG" }
  }
  const existing = (await readJsonFile(FREQTRADE_CONFIG_PATH)) || {}
  const patch = {}

  const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
  if (payload.exchange || pairs.length > 0) {
    const exchange = { ...(existing.exchange || {}) }
    if (payload.exchange) exchange.name = String(payload.exchange).toLowerCase()
    if (pairs.length > 0) exchange.pair_whitelist = pairs.map((pair) => normalizePair(pair, "/"))
    patch.exchange = exchange
  }

  if (payload.timeframe) patch.timeframe = payload.timeframe
  if (payload.strategy) patch.strategy = payload.strategy
  if (payload.mode) patch.dry_run = payload.mode !== "live"

  if (payload.risk?.maxOpenOrders !== undefined) patch.max_open_trades = payload.risk.maxOpenOrders
  if (payload.risk?.maxPositionSize !== undefined) patch.stake_amount = payload.risk.maxPositionSize

  const advanced = resolveAdvanced(payload, "freqtrade")
  const merged = mergeDeep(mergeDeep({ ...existing }, patch), advanced || {})
  await writeJsonFile(FREQTRADE_CONFIG_PATH, merged)
  return { applied: true, path: FREQTRADE_CONFIG_PATH }
}


async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    redirect: "follow",
    ...options,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status} ${res.statusText} ${text}`.trim())
  }

  if (res.status === 204) return null
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    const text = await res.text()
    return { raw: text }
  }
  return res.json()
}

class FreqtradeAdapter {
  constructor(bot) {
    this.bot = bot
    this.baseUrl = bot.api?.baseUrl
    this.username = bot.api?.username
    this.password = bot.api?.password
    this.accessToken = null
    this.deduper = createDeduper()
    this.signalDeduper = createDeduper()
  }

  async login() {
    if (!this.username || !this.password) {
      throw new Error("Freqtrade username/password missing")
    }
    const basic = Buffer.from(`${this.username}:${this.password}`).toString("base64")
    const data = await fetchJson(withBaseUrl(this.baseUrl, "/token/login"), {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
      },
    })
    this.accessToken = data?.access_token || null
    if (!this.accessToken) {
      throw new Error("Freqtrade login failed (no access token)")
    }
  }

  async request(endpoint, { method = "GET", auth = true, body } = {}) {
    const headers = {}
    if (body) headers["Content-Type"] = "application/json"
    if (auth) {
      if (!this.accessToken) {
        await this.login()
      }
      headers.Authorization = `Bearer ${this.accessToken}`
    }

    try {
      return await fetchJson(withBaseUrl(this.baseUrl, endpoint), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (auth && message.includes("401")) {
        await this.login()
        headers.Authorization = `Bearer ${this.accessToken}`
        return fetchJson(withBaseUrl(this.baseUrl, endpoint), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })
      }
      throw err
    }
  }

  normalizeLogs(raw) {
    const entries = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.logs)
        ? raw.logs
        : Array.isArray(raw?.data)
          ? raw.data
          : []

    return entries.map((entry) => {
      if (typeof entry === "string") {
        return {
          message: entry,
          severity: "info",
          data: { raw: entry },
        }
      }

      if (entry && typeof entry === "object") {
        const message = entry.message || entry.msg || JSON.stringify(entry)
        const level = (entry.level || entry.severity || "info").toString().toLowerCase()
        const severity = level.includes("error") ? "error" : level.includes("warn") ? "warn" : "info"
        return {
          message,
          severity,
          data: entry,
        }
      }

      return {
        message: String(entry),
        severity: "info",
        data: { raw: entry },
      }
    })
  }

  extractSignalsFromLogs(entries) {
    const signals = []
    for (const entry of entries) {
      const message = entry?.message ? String(entry.message) : ""
      const lower = message.toLowerCase()
      let side = null
      if (lower.includes("entering trade") || lower.includes("buy")) side = "buy"
      if (lower.includes("exiting trade") || lower.includes("sell")) side = "sell"
      if (!side) continue

      const pair =
        entry?.data?.pair ||
        entry?.data?.market ||
        (message.match(/([A-Z0-9]{2,}[/-][A-Z0-9]{2,})/i) || [])[1]

      signals.push({
        side,
        strength: 0.65,
        message: pair ? `${side.toUpperCase()} signal for ${pair}` : message,
        data: { pair, source: "logs", raw: entry?.data ?? null },
      })
    }
    return signals
  }

  extractSignalsFromOpenTrades(openTrades) {
    if (!Array.isArray(openTrades)) return []
    return openTrades.map((trade) => {
      const pair = trade?.pair || trade?.symbol || null
      return {
        side: "buy",
        strength: 0.55,
        message: pair ? `Active trade ${pair}` : "Active trade",
        data: { pair, source: "open_trades", raw: trade },
      }
    })
  }

  /**
   * Extract signals from Freqtrade's analyzed dataframe for a specific pair
   * Uses the strategy's buy/sell indicators
   */
  extractSignalsFromDataframe(pair, dataframe) {
    if (!dataframe || !Array.isArray(dataframe.data) || dataframe.data.length === 0) {
      return []
    }
    
    const signals = []
    const columns = dataframe.columns || []
    const data = dataframe.data
    
    // Find column indices
    const dateIdx = columns.indexOf("date")
    const closeIdx = columns.indexOf("close")
    const enterLongIdx = columns.indexOf("enter_long") !== -1 
      ? columns.indexOf("enter_long") 
      : columns.indexOf("buy")
    const exitLongIdx = columns.indexOf("exit_long") !== -1 
      ? columns.indexOf("exit_long") 
      : columns.indexOf("sell")
    const rsiIdx = columns.indexOf("rsi")
    
    // Check the last few candles for signals
    const checkCandles = Math.min(5, data.length)
    for (let i = data.length - checkCandles; i < data.length; i++) {
      const row = data[i]
      if (!row) continue
      
      const hasEnter = enterLongIdx >= 0 && row[enterLongIdx] === 1
      const hasExit = exitLongIdx >= 0 && row[exitLongIdx] === 1
      
      if (!hasEnter && !hasExit) continue
      
      const price = closeIdx >= 0 ? row[closeIdx] : null
      const rsi = rsiIdx >= 0 ? row[rsiIdx] : null
      const timestamp = dateIdx >= 0 ? row[dateIdx] : null
      
      const side = hasEnter ? "buy" : "sell"
      const indicators = rsi !== null ? { rsi: Number(rsi.toFixed(2)) } : {}
      
      signals.push({
        symbol: pair,
        side,
        strength: 0.75, // Freqtrade strategy signals are high confidence
        message: `${side.toUpperCase()} signal from strategy for ${pair}`,
        timestamp: timestamp || new Date().toISOString(),
        data: {
          pair,
          symbol: pair,
          source: "freqtrade_dataframe",
          price,
          indicators,
          assetClass: "crypto",
        },
      })
    }
    
    return signals
  }

  /**
   * Request analysis for specific symbols
   * Updates the whitelist temporarily and triggers analysis
   */
  async analyzeSymbols(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return { signals: [], analyzed: 0 }
    }
    
    const signals = []
    const pairs = symbols.map(s => normalizePair(s, "/"))
    
    try {
      // Get current whitelist
      const config = await this.request("/show_config")
      const currentWhitelist = config?.exchange?.pair_whitelist || []
      
      // Get available pairs
      let availablePairs = []
      try {
        const pairlists = await this.request("/pairlists")
        availablePairs = Array.isArray(pairlists?.whitelist) 
          ? pairlists.whitelist 
          : []
      } catch {
        availablePairs = currentWhitelist
      }
      
      // Filter to pairs that are available
      const validPairs = pairs.filter(p => 
        availablePairs.length === 0 || 
        availablePairs.includes(p) || 
        availablePairs.includes(p.replace("/", ""))
      )
      
      if (validPairs.length === 0) {
        log(`No valid pairs to analyze from ${pairs.join(", ")}`)
        return { signals: [], analyzed: 0 }
      }
      
      // Get current config to determine timeframe
      const ftConfig = await this.request("/show_config")
      const timeframe = ftConfig?.timeframe || "15m"
      
      // Try to get analyzed candles for each pair using /pair_candles
      for (const pair of validPairs.slice(0, 10)) { // Limit to 10 pairs per scan
        try {
          // Use /pair_candles endpoint (available in Freqtrade 2024.11+)
          const candleResult = await this.request(`/pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}&limit=50`)
          
          if (candleResult && candleResult.data && candleResult.data.length > 0) {
            // Convert pair_candles response to dataframe format for signal extraction
            const dataframe = {
              columns: candleResult.columns || candleResult.all_columns || [],
              data: candleResult.data,
            }
            const pairSignals = this.extractSignalsFromDataframe(pair, dataframe)
            for (const signal of pairSignals) {
              const key = JSON.stringify({ 
                symbol: signal.symbol, 
                side: signal.side,
                timestamp: signal.timestamp 
              })
              if (!this.signalDeduper.has(key)) {
                this.signalDeduper.add(key)
                signals.push(signal)
              }
            }
          }
        } catch (err) {
          // Pair may not be in whitelist or endpoint may not be available
          log(`Freqtrade candles request failed for ${pair}: ${String(err)}`)
        }
      }
      
      // Also check for any new signals in logs after analysis
      try {
        const rawLogs = await this.request("/logs")
        const normalized = this.normalizeLogs(rawLogs)
        const logSignals = this.extractSignalsFromLogs(normalized)
        
        for (const signal of logSignals) {
          const pair = signal?.data?.pair || ""
          if (pairs.some(p => p.includes(pair) || pair.includes(p))) {
            const key = JSON.stringify(signal)
            if (!this.signalDeduper.has(key)) {
              this.signalDeduper.add(key)
              signals.push(signal)
            }
          }
        }
      } catch {
        // Ignore log errors during scan
      }
      
      return { signals, analyzed: validPairs.length }
    } catch (err) {
      log(`Freqtrade analysis failed: ${String(err)}`)
      return { signals: [], analyzed: 0, error: String(err) }
    }
  }

  async poll() {
    const state = {}
    let status = "offline"
    const events = []
    const signals = []

    try {
      await this.request("/ping", { auth: false })
      status = "online"
    } catch (err) {
      return { status, state }
    }

    try {
      state.health = await this.request("/health")
    } catch (err) {
      state.health = { error: String(err) }
    }

    try {
      state.openTrades = await this.request("/status")
    } catch (err) {
      state.openTrades = { error: String(err) }
    }

    try {
      state.balance = await this.request("/balance")
    } catch (err) {
      state.balance = { error: String(err) }
    }

    try {
      const rawLogs = await this.request("/logs")
      const normalized = this.normalizeLogs(rawLogs)
      for (const entry of normalized.slice(0, 20)) {
        const key = JSON.stringify(entry)
        if (this.deduper.has(key)) continue
        this.deduper.add(key)
        events.push({
          type: "log",
          severity: entry.severity,
          message: entry.message,
          data: entry.data,
        })
      }

      const logSignals = this.extractSignalsFromLogs(normalized)
      for (const signal of logSignals) {
        const key = JSON.stringify(signal)
        if (this.signalDeduper.has(key)) continue
        this.signalDeduper.add(key)
        signals.push(signal)
      }
    } catch (err) {
      events.push({
        type: "log",
        severity: "warn",
        message: `Freqtrade log poll failed: ${String(err)}`,
      })
    }

    const tradeSignals = this.extractSignalsFromOpenTrades(state.openTrades)
    for (const signal of tradeSignals) {
      const key = JSON.stringify(signal)
      if (this.signalDeduper.has(key)) continue
      this.signalDeduper.add(key)
      signals.push(signal)
    }

    const openPositions = Array.isArray(state.openTrades) ? state.openTrades.length : undefined
    const summary = typeof openPositions === "number" ? { positions: openPositions } : undefined

    return { status, summary, state, events, signals }
  }

  async executeCommand(type, payload) {
    switch (type) {
      case "start":
        await this.request("/start", { method: "POST" })
        return { status: "online" }
      case "stop":
        await this.request("/stop", { method: "POST" })
        return { status: "idle" }
      case "restart":
        await this.request("/stop", { method: "POST" })
        await this.request("/start", { method: "POST" })
        return { status: "online" }
      case "reload_config":
        await this.request("/reload_config", { method: "POST" })
        return { status: "online" }
      case "configure":
        const freqtradeResult = await applyFreqtradeConfig(payload || {})
        await this.request("/reload_config", { method: "POST" })
        return { status: "online", result: freqtradeResult }
      case "scan":
      case "analyze":
        // Active analysis of specific symbols
        const symbols = Array.isArray(payload?.symbols) ? payload.symbols : []
        if (symbols.length === 0) {
          return { status: "online", signals: [], error: "No symbols provided" }
        }
        const analysisResult = await this.analyzeSymbols(symbols)
        return { 
          status: "online", 
          signals: analysisResult.signals,
          analyzed: analysisResult.analyzed,
        }
      case "execute_trade":
      case "trade":
        // Execute a trade via Freqtrade (paper or live depending on dry_run config)
        const tradePayload = payload || {}
        const pair = tradePayload.pair || tradePayload.symbol
        const side = tradePayload.side || "buy"
        
        if (!pair) {
          return { status: "error", error: "No pair/symbol provided for trade" }
        }
        
        try {
          if (side === "buy" || side === "enter") {
            // Force entry for the pair
            const result = await this.request("/forcebuy", {
              method: "POST",
              body: {
                pair,
                price: tradePayload.price || null,
                stake_amount: tradePayload.amount || null,
              },
            })
            return { 
              status: "online", 
              trade: result,
              executed: true,
              side: "buy",
              pair,
            }
          } else if (side === "sell" || side === "exit") {
            // Force exit for the pair
            const result = await this.request("/forceexit", {
              method: "POST",
              body: {
                tradeid: tradePayload.tradeId || "all",
              },
            })
            return { 
              status: "online", 
              trade: result,
              executed: true,
              side: "sell",
              pair,
            }
          } else {
            return { status: "error", error: `Unknown trade side: ${side}` }
          }
        } catch (err) {
          return { status: "error", error: String(err), pair, side }
        }
      
      case "get_trades":
        // Get current open trades
        const trades = await this.request("/status")
        return { status: "online", trades: trades || [] }
      
      case "get_balance":
        // Get current balance
        const balance = await this.request("/balance")
        return { status: "online", balance }
      
      default:
        throw new Error(`Unsupported command: ${type}`)
    }
  }
}

class BacktraderAdapter {
  constructor(bot) {
    this.bot = bot
    this.baseUrl = bot.api?.baseUrl || "http://backtrader:8080"
    this.signalDeduper = createDeduper()
    this.deduper = createDeduper()
    this.lastRunAt = 0
    this.minRunIntervalMs = Math.max(60000, (bot.pollIntervalSeconds || 300) * 1000)
    this.lastRunId = null
  }

  normalizeSide(raw) {
    const side = String(raw || "").toLowerCase()
    if (side === "buy" || side === "sell" || side === "hold") return side
    return null
  }

  buildSignal(sig, fallbackAssetClass) {
    const side = this.normalizeSide(sig?.side)
    if (!side || side === "hold") return null
    const symbol = sig?.symbol || sig?.data?.symbol || "unknown"
    return {
      symbol,
      side,
      strength: typeof sig.strength === "number" ? sig.strength : 0.65,
      message: sig.message || `${side} signal for ${symbol}`,
      data: {
        pair: symbol,
        symbol: symbol,
        source: "backtrader",
        price: sig.price,
        indicators: sig.rsi ? { rsi: sig.rsi, sma: sig.sma } : undefined,
        assetClass: sig.assetClass || fallbackAssetClass,
        raw: sig,
      },
    }
  }

  async request(endpoint, { method = "GET", body } = {}) {
    const headers = {}
    if (body) headers["Content-Type"] = "application/json"
    return fetchJson(withBaseUrl(this.baseUrl, endpoint), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async poll() {
    const state = {}
    let status = "offline"
    const events = []
    const signals = []

    try {
      await this.request("/ping")
      status = "online"
    } catch (err) {
      return { status, state }
    }

    const runConfig = this.resolveRunConfig()
    // Dynamic symbols - no longer filter by static config symbols
    // All signals from this bot's strategies are accepted
    const strategyPrefix = `${this.bot.id}-`

    const runEvent = await this.maybeRunStrategy()
    if (runEvent) {
      events.push(runEvent)
    }

    try {
      state.health = await this.request("/health")
    } catch (err) {
      state.health = { error: String(err) }
    }

    try {
      state.balance = await this.request("/balance")
    } catch (err) {
      state.balance = { error: String(err) }
    }

    try {
      const rawLogs = await this.request("/logs")
      const logs = Array.isArray(rawLogs) ? rawLogs : []
      for (const entry of logs.slice(0, 20)) {
        const key = JSON.stringify(entry)
        if (this.deduper.has(key)) continue
        this.deduper.add(key)
        events.push({
          type: "log",
          severity: entry.level || "info",
          message: entry.message || String(entry),
          data: entry.data || entry,
        })
      }
    } catch (err) {
      events.push({
        type: "log",
        severity: "warn",
        message: `Backtrader log poll failed: ${String(err)}`,
      })
    }

    try {
      const query = this.lastRunId
        ? `?strategy_id=${encodeURIComponent(this.lastRunId)}`
        : ""
      let signalsData = await this.request(`/signals${query}`)
      let rawSignals = Array.isArray(signalsData?.signals) ? signalsData.signals : []
      // Filter signals by strategy prefix - accept all signals from this bot's strategies
      // No longer filtering by static config symbols since symbols are dispatched dynamically
      let filteredSignals = rawSignals.filter((sig) => {
        if (sig?.strategy_id) {
          return String(sig.strategy_id).startsWith(strategyPrefix)
        }
        // Accept signals without strategy_id (legacy signals)
        return true
      })
      
      let retryCount = 0
      while (this.lastRunId && filteredSignals.length === 0 && retryCount < 5) {
        retryCount += 1
        await new Promise((resolve) => setTimeout(resolve, 5000))
        signalsData = await this.request(`/signals${query}`)
        rawSignals = Array.isArray(signalsData?.signals) ? signalsData.signals : []
        filteredSignals = rawSignals.filter((sig) => {
          if (sig?.strategy_id) {
            return String(sig.strategy_id).startsWith(strategyPrefix)
          }
          return true
        })
      }

      for (const sig of filteredSignals) {
        const signal = this.buildSignal(sig, runConfig.assetClass)
        if (!signal) continue
        const symbol = signal.symbol || sig.symbol || sig.data?.symbol || "unknown"
        const key = JSON.stringify({
          symbol,
          side: signal.side,
          message: sig.message,
          strategy_id: sig.strategy_id,
        })
        if (this.signalDeduper.has(key)) continue
        this.signalDeduper.add(key)
        signals.push(signal)
      }
    } catch (err) {
      events.push({
        type: "log",
        severity: "warn",
        message: `Backtrader signals poll failed: ${String(err)}`,
      })
    }

    return { status, state, events, signals }
  }

  resolveRunConfig() {
    const desired = this.bot.desiredConfig || {}
    const symbols = Array.isArray(desired.symbols) ? desired.symbols : []
    const pairs = Array.isArray(desired.pairs) ? desired.pairs : []
    const list = symbols.length > 0 ? symbols : pairs
    return {
      symbols: list.map((item) => String(item).trim()).filter(Boolean),
      assetClass: desired.assetClass || "stock",
      timeframe: desired.timeframe || "1d",
      strategy: desired.strategy || "default",
    }
  }

  async maybeRunStrategy() {
    // Skip automatic strategy runs - symbols are now dispatched dynamically
    // by Market Intel via scan commands. This prevents duplicate work and
    // removes the static symbol limitation from bot configs.
    //
    // The bot will only analyze symbols when it receives a "scan" command
    // from Market Intel with the dynamically discovered symbols.
    //
    // If you need fallback polling (e.g., when Market Intel is down),
    // you can set ENABLE_FALLBACK_POLLING=true in the environment.
    if (process.env.ENABLE_FALLBACK_POLLING !== "true") {
      return null
    }
    
    const config = this.resolveRunConfig()
    if (!config.symbols.length) return null

    const now = Date.now()
    if (now - this.lastRunAt < this.minRunIntervalMs) return null
    this.lastRunAt = now
    this.lastRunId = `${this.bot.id}-${now}`

    try {
      await this.request("/run", {
        method: "POST",
        body: { id: this.lastRunId, config },
      })
      const waitMs = Math.min(60000, Math.max(8000, config.symbols.length * 750))
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      return null
    } catch (err) {
      return {
        type: "log",
        severity: "warn",
        message: `Backtrader run failed: ${String(err)}`,
      }
    }
  }

  async executeCommand(type, payload) {
    switch (type) {
      case "start":
      case "run":
        const config = payload || {}
        if (config.id) {
          this.lastRunId = String(config.id)
        } else {
          this.lastRunId = `${this.bot.id}-${Date.now()}`
          config.id = this.lastRunId
        }
        const result = await this.request("/run", {
          method: "POST",
          body: { id: config.id, config },
        })
        return { status: "online", result }
      case "stop":
        await this.request(`/stop/${this.bot.id}`, { method: "POST" })
        return { status: "idle" }
      case "scan":
      case "analyze":
        // Trigger strategy run for symbols in payload with improved timing and retry
        const symbols = Array.isArray(payload?.symbols) ? payload.symbols : []
        if (symbols.length === 0) {
          throw new Error("scan/analyze requires symbols array in payload")
        }
        
        const assetClass = payload?.assetClass || this.bot.desiredConfig?.assetClass || "stock"
        const scanId = `${this.bot.id}-scan-${Date.now()}`
        this.lastRunId = scanId
        
        await this.request("/run", {
          method: "POST",
          body: {
            id: scanId,
            config: {
              symbols: symbols,
              assetClass,
              timeframe: payload?.timeframe || this.bot.desiredConfig?.timeframe || "1d",
              strategy: payload?.strategy || this.bot.desiredConfig?.strategy || "default",
            },
          },
        })
        
        // Adaptive wait time based on symbol count and asset class
        // Crypto/Forex need less data, stocks may need more due to market hours
        const baseWaitMs = assetClass === "crypto" ? 600 : assetClass === "forex" ? 700 : 800
        const initialWaitMs = Math.min(90000, Math.max(10000, symbols.length * baseWaitMs))
        await new Promise((resolve) => setTimeout(resolve, initialWaitMs))
        
        // Retry with exponential backoff to handle slow strategy runs
        const maxRetries = 6
        const retryDelays = [3000, 5000, 8000, 12000, 15000, 20000]
        let scannedSignals = []
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const signalsData = await this.request(
            `/signals?strategy_id=${encodeURIComponent(scanId)}`
          )
          const rawSignals = Array.isArray(signalsData?.signals) ? signalsData.signals : []
          
          for (const sig of rawSignals) {
            const signal = this.buildSignal(sig, assetClass)
            if (!signal) continue
            const symbol = signal.symbol || sig.symbol || sig.data?.symbol || "unknown"
            const key = JSON.stringify({
              symbol,
              side: signal.side,
              message: sig.message,
              strategy_id: sig.strategy_id,
            })
            if (this.signalDeduper.has(key)) continue
            this.signalDeduper.add(key)
            scannedSignals.push(signal)
          }
          
          // If we got signals or it's the last attempt, stop retrying
          if (scannedSignals.length > 0 || attempt === maxRetries) {
            break
          }
          
          // Check if strategy is still running
          try {
            const status = await this.request("/health")
            const activeStrategies = status?.activeStrategies || 0
            if (activeStrategies === 0 && rawSignals.length === 0) {
              // Strategy completed but no signals - that's valid, stop retrying
              log(`Backtrader scan ${scanId} completed with no signals`)
              break
            }
          } catch {
            // Health check failed, continue with retry
          }
          
          // Wait before next retry
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt] || 5000))
        }
        
        logEvent("ag_scan_complete", { 
          scanId, 
          symbolCount: symbols.length, 
          signalCount: scannedSignals.length,
          assetClass,
        })
        
        return { status: "online", signals: scannedSignals, scanId, analyzed: symbols.length }
      default:
        throw new Error(`Unsupported command: ${type}`)
    }
  }
}

function createAdapter(bot) {
  switch (bot.engine) {
    case "freqtrade":
      return new FreqtradeAdapter(bot)
    case "alpaca":
      return new AlpacaAdapter(bot)
    case "oanda":
      return new OandaAdapter(bot)
    case "backtrader":
      return new BacktraderAdapter(bot)
    default:
      throw new Error(`Unknown engine: ${bot.engine}`)
  }
}

async function ensureBotDoc(db, bot) {
  const docRef = db.collection("bots").doc(bot.id)
  const snap = await docRef.get()
  const existing = snap.exists ? snap.data() : {}
  const capabilities = resolveCapabilities(bot)
  const patch = {
    id: bot.id,
    name: bot.name || bot.id,
    engine: bot.engine,
    status: "unknown",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (capabilities && Object.keys(capabilities).length > 0) {
    patch.capabilities = capabilities
  }

  if (!existing?.desiredConfig && bot.desiredConfig) {
    patch.desiredConfig = bot.desiredConfig
  }

  await docRef.set(patch, { merge: true })
}

async function writeEvents(db, botId, events) {
  if (!events || events.length === 0) return
  const ref = db.collection("bots").doc(botId).collection("events")
  const batch = db.batch()
  for (const event of events.slice(0, 50)) {
    const docRef = ref.doc()
    batch.set(docRef, {
      botId,
      type: event.type || "event",
      severity: event.severity || "info",
      message: event.message || "",
      data: event.data || null,
      runId: RUN_ID || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}

async function writeSignals(db, botId, signals) {
  if (!signals || signals.length === 0) return
  const ref = db.collection("bots").doc(botId).collection("signals")
  
  // Firestore batch limit is 500 operations per batch
  // Process ALL signals using multiple batches if needed
  const BATCH_SIZE = 450 // Leave some margin below 500
  const totalSignals = signals.length
  let writtenCount = 0
  
  for (let i = 0; i < totalSignals; i += BATCH_SIZE) {
    const chunk = signals.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    
    for (const signal of chunk) {
      const docRef = ref.doc()
      const symbol = resolveSignalSymbol(signal)
      const signalTime = parseSignalTimestamp(signal)
      batch.set(docRef, {
        botId,
        symbol: symbol || null,
        side: signal.side || null,
        strength: typeof signal.strength === "number" ? signal.strength : null,
        message: signal.message || "",
        data: signal.data || null,
        runId: RUN_ID || null,
        createdAt: signalTime
          ? admin.firestore.Timestamp.fromDate(signalTime)
          : admin.firestore.FieldValue.serverTimestamp(),
      })
    }
    
    await batch.commit()
    writtenCount += chunk.length
  }
  
  if (totalSignals > BATCH_SIZE) {
    log(`Wrote ${writtenCount} signals in ${Math.ceil(totalSignals / BATCH_SIZE)} batches for ${botId}`)
  }
}

async function applyUpdate(db, bot, update) {
  const patch = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (update?.status) patch.status = update.status
  if (update?.summary) patch.summary = update.summary
  if (update?.state) patch.state = update.state

  await db.collection("bots").doc(bot.id).set(patch, { merge: true })
  await writeEvents(db, bot.id, update?.events || [])
  await writeSignals(db, bot.id, update?.signals || [])
  if (update?.signals?.length) {
    const sampledSignals = update.signals.slice(0, 5).map((signal) => {
      const symbol = resolveSignalSymbol(signal)
      return {
        symbolKey: symbol ? `${resolveBotAssetClass(bot) || "unknown"}:${symbol}` : null,
        signal: signal.side || null,
        strength: typeof signal.strength === "number" ? signal.strength : null,
      }
    })
    logEvent("ag_write_bot_signals", {
      botId: bot.id,
      count: update.signals.length,
    })
    await publishPipelineEvent(
      buildPipelineEvent({
        stationId: "bot_signals",
        eventType: "fs_write",
        edgeKey: "relayorb_agent->bot_signals",
        nodeIds: ["relayorb_agent", "bot_signals", "firestore"],
        status: "end",
        batchId: RUN_ID || undefined,
        meta: {
          botId: bot.id,
          engine: bot.engine,
          botEngineId: bot.engine,
          count: update.signals.length,
          mode: bot?.desiredConfig?.mode || null,
          strategy: bot?.desiredConfig?.strategy || null,
          timeframe: bot?.desiredConfig?.timeframe || null,
          runtimeMs:
            typeof update?.summary?.runtimeMs === "number" ? update.summary.runtimeMs : null,
          perSymbolSignals: sampledSignals,
          tradingMode: resolveTradingMode(bot),
        },
        outputs: {
          firestoreDocs: [`bots/${bot.id}/signals`],
        },
      })
    )
    if (shouldSample(PIPELINE_EVENTS_SAMPLE_RATE)) {
      const sampled = update.signals.slice(0, 6)
      await Promise.all(
        sampled.map((signal) => {
          const symbol = resolveSignalSymbol(signal)
          return publishPipelineEvent(
            buildPipelineEvent({
              stationId: "bot_signals",
              eventType: "fs_write",
              edgeKey: "relayorb_agent->bot_signals",
              nodeIds: ["relayorb_agent", "bot_signals", "firestore"],
              status: "end",
              batchId: RUN_ID || undefined,
              symbolKey: symbol ? `${resolveBotAssetClass(bot) || "unknown"}:${symbol}` : undefined,
              meta: {
                botId: bot.id,
                engine: bot.engine,
                botEngineId: bot.engine,
                side: signal.side || null,
                strength: typeof signal.strength === "number" ? signal.strength : null,
                strategy: bot?.desiredConfig?.strategy || null,
                timeframe: bot?.desiredConfig?.timeframe || null,
                tradingMode: resolveTradingMode(bot),
              },
            })
          )
        })
      )
    }
  }
}

async function markBotError(db, bot, err) {
  const message = err instanceof Error ? err.message : String(err)
  await db.collection("bots").doc(bot.id).set(
    {
      status: "error",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
      state: {
        error: message,
      },
    },
    { merge: true }
  )
}

function startPolling(db, bot, adapter) {
  const interval = Math.max(5, bot.pollIntervalSeconds || 10) * 1000
  let running = false

  // Initialize bot health tracking
  agentHealth.bots.set(bot.id, {
    lastPollAt: null,
    lastSignalAt: null,
    consecutiveErrors: 0,
    status: "starting",
    engine: bot.engine,
    pollIntervalSeconds: bot.pollIntervalSeconds || 300,
  })

  const tick = async () => {
    if (running) return
    running = true
    const botHealth = agentHealth.bots.get(bot.id)
    try {
      const update = await adapter.poll()
      await applyUpdate(db, bot, update)
      
      // Update health tracking
      if (botHealth) {
        botHealth.lastPollAt = Date.now()
        botHealth.consecutiveErrors = 0
        botHealth.status = update?.status || "online"
        if (update?.signals?.length > 0) {
          botHealth.lastSignalAt = Date.now()
        }
      }
    } catch (err) {
      log(`poll failed for ${bot.id}: ${String(err)}`)
      await markBotError(db, bot, err)
      
      // Update health tracking on error
      if (botHealth) {
        botHealth.consecutiveErrors = (botHealth.consecutiveErrors || 0) + 1
        botHealth.status = "error"
        botHealth.lastError = err.message
      }
    } finally {
      running = false
    }
  }

  tick()
  setInterval(tick, interval)
}

async function claimCommand(db, ref) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const data = snap.data()
    if (data.status && data.status !== "queued") return null
    tx.update(ref, {
      status: "running",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return data
  })
}

function startCommandListener(db, bot, adapter) {
  const commandsRef = db.collection("bots").doc(bot.id).collection("commands")
  const query = commandsRef.where("status", "==", "queued")

  query.onSnapshot((snap) => {
    snap.docChanges().forEach(async (change) => {
      if (change.type !== "added") return
      const preview = change.doc.data()
      if (preview?.type === "update_agent") return
      const docRef = change.doc.ref
      const data = await claimCommand(db, docRef)
      if (!data) return

      const commandType = data.type
      const payload = data.payload || {}

      try {
        if (commandType === "scan" || commandType === "analyze") {
          let update = null
          const botHealth = agentHealth.bots.get(bot.id)
          try {
            update = await adapter.executeCommand(commandType, payload)
          } catch (err) {
            update = await adapter.poll()
          }
          if (!update || typeof update !== "object") {
            update = {}
          }
          if (Array.isArray(payload.symbols) && payload.symbols.length > 0) {
            const allowed = new Set(
              payload.symbols.map(normalizeSignalSymbol).filter(Boolean)
            )
            if (allowed.size > 0) {
              update.signals = (update.signals || []).filter((signal) => {
                const resolved = resolveSignalSymbol(signal)
                if (!resolved) return false
                return allowed.has(normalizeSignalSymbol(resolved))
              })
            }
          }
          await applyUpdate(db, bot, update)
          
          // Update health tracking after successful scan
          if (botHealth) {
            botHealth.lastPollAt = Date.now()
            botHealth.consecutiveErrors = 0
            botHealth.status = update?.status || "online"
            if (update?.signals?.length > 0) {
              botHealth.lastSignalAt = Date.now()
            }
          }
          
          await docRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            result: {
              signals: update?.signals?.length || 0,
            },
          })
          return
        }

        const result = await adapter.executeCommand(commandType, payload)
        await docRef.update({
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: result?.result || null,
        })
        if (commandType === "configure" && payload && Object.keys(payload).length > 0) {
          await db.collection("bots").doc(bot.id).set(
            {
              desiredConfig: payload,
              desiredConfigUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastConfigAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        }
        if (result?.status) {
          await db.collection("bots").doc(bot.id).set(
            {
              status: result.status,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        }
      } catch (err) {
        await docRef.update({
          status: "failed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: {
            message: err instanceof Error ? err.message : String(err),
          },
        })
      }
    })
  })
}

/**
 * Write agent health status to Firestore for pipeline visibility
 */
async function writeAgentHeartbeat(db) {
  const now = Date.now()
  const uptimeMs = now - agentHealth.startedAt
  
  // Build bot health summary
  const botsHealth = {}
  let healthyBots = 0
  let errorBots = 0
  
  for (const [botId, health] of agentHealth.bots) {
    const pollAgeMs = health.lastPollAt ? now - health.lastPollAt : null
    // Use bot's poll interval + buffer to determine staleness
    // Default to 5 minutes if pollInterval not available
    const pollIntervalMs = (health.pollIntervalSeconds || 300) * 1000
    const staleThresholdMs = pollIntervalMs + 120000 // poll interval + 2 min buffer
    const isStale = pollAgeMs !== null && pollAgeMs > staleThresholdMs
    
    botsHealth[botId] = {
      status: health.status,
      engine: health.engine,
      lastPollAt: health.lastPollAt ? new Date(health.lastPollAt).toISOString() : null,
      lastSignalAt: health.lastSignalAt ? new Date(health.lastSignalAt).toISOString() : null,
      pollAgeMs,
      isStale,
      consecutiveErrors: health.consecutiveErrors,
      lastError: health.lastError || null,
    }
    
    if (health.status === "error" || health.consecutiveErrors > 3 || isStale) {
      errorBots++
    } else {
      healthyBots++
    }
  }
  
  const overallStatus = errorBots === 0 ? "ok" : healthyBots === 0 ? "error" : "degraded"
  
  const healthDoc = {
    service: "relayorb_agent",
    status: overallStatus,
    startedAt: new Date(agentHealth.startedAt).toISOString(),
    uptimeMs,
    heartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
    runId: RUN_ID || null,
    bots: botsHealth,
    summary: {
      total: agentHealth.bots.size,
      healthy: healthyBots,
      error: errorBots,
    },
  }
  
  try {
    await db.doc("pipeline/relayorb_agent").set(healthDoc, { merge: true })
    agentHealth.lastHeartbeatAt = now
    logEvent("ag_heartbeat", { status: overallStatus, healthy: healthyBots, error: errorBots })
  } catch (err) {
    log(`heartbeat write failed: ${String(err)}`)
  }
}

async function main() {
  const config = await loadConfig()
  const db = initFirestore(config.firestore?.projectId)
  await initPipelineRedis()

  logEvent("ag_run_start", { botCount: config.bots.length })
  await publishPipelineEvent(
    buildPipelineEvent({
      stationId: "agent",
      eventType: "service_start",
      edgeKey: "relayorb_agent->bot_engine:freqtrade",
      nodeIds: ["relayorb_agent"],
      status: "start",
      batchId: RUN_ID || undefined,
      meta: { botCount: config.bots.length },
    })
  )

  for (const bot of config.bots) {
    if (!bot.id || !bot.engine) {
      throw new Error("Each bot requires id and engine")
    }
    const adapter = createAdapter(bot)
    await ensureBotDoc(db, bot)
    startPolling(db, bot, adapter)
    startCommandListener(db, bot, adapter)
    log(`started adapter for ${bot.id} (${bot.engine})`)
  }

  await startEventListener(db, config.bots)
  startBatchPoller(db, config.bots)
  
  // Start heartbeat - writes health status to Firestore every 5 minutes
  setInterval(() => {
    writeAgentHeartbeat(db).catch((err) => log(`heartbeat error: ${String(err)}`))
  }, HEARTBEAT_INTERVAL_MS)
  
  // Initial heartbeat
  writeAgentHeartbeat(db).catch((err) => log(`initial heartbeat error: ${String(err)}`))
}

main().catch((err) => {
  log(`fatal: ${String(err)}`)
  process.exit(1)
})
