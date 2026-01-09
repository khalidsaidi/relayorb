import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"
import AlpacaAdapter from "../adapters/alpaca/adapter.js"
import AlphaVantageAdapter from "../adapters/alphavantage/adapter.js"
import OandaAdapter from "../adapters/oanda/adapter.js"

const CONFIG_ENV = "RELAYORB_CONFIG_PATH"
const DEFAULT_CONFIG = "config.json"
const FREQTRADE_CONFIG_PATH = process.env.RELAYORB_FREQTRADE_CONFIG || ""

const log = (message) => {
  const stamp = new Date().toISOString()
  console.log(`[relayorb-agent ${stamp}] ${message}`)
}

const DEFAULT_CAPABILITIES = {
  freqtrade: {
    exchanges: ["binance", "kraken", "coinbase", "kucoin", "bybit", "okx"],
    timeframes: ["1m", "5m", "15m", "1h", "4h", "1d"],
    modes: ["signal", "paper", "live"],
  },
  alpaca: {
    assetClasses: ["stock"],
    timeframes: ["1m", "5m", "15m", "1h", "1d"],
    modes: ["signal"],
  },
  alphavantage: {
    assetClasses: ["stock"],
    timeframes: ["1d"], // Free tier only supports daily
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
      case "backtest":
      case "paper":
      case "live":
        throw new Error(`Freqtrade does not support '${type}' via REST API. Use start/stop or configure dry_run.`)
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
      const signalsData = await this.request(`/signals${query}`)
      const rawSignals = Array.isArray(signalsData?.signals) ? signalsData.signals : []
      
      for (const sig of rawSignals) {
        // Backtrader signals have: side, strength, message, price, timestamp, symbol
        const symbol = sig.symbol || sig.data?.symbol || "unknown"
        
        if (!sig.side || sig.side === "hold") continue
        
        const signal = {
          side: sig.side,
          strength: typeof sig.strength === "number" ? sig.strength : 0.65,
          message: sig.message || `${sig.side} signal for ${symbol}`,
          data: {
            pair: symbol,
            symbol: symbol,
            source: "backtrader",
            price: sig.price,
            indicators: sig.rsi ? { rsi: sig.rsi, sma: sig.sma } : undefined,
            raw: sig,
          },
        }
        
        const key = JSON.stringify({ symbol, side: sig.side, message: sig.message })
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
      await new Promise((resolve) => setTimeout(resolve, 8000))
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
        // Trigger strategy run for symbols in payload
        const symbols = Array.isArray(payload?.symbols) ? payload.symbols : []
        if (symbols.length === 0) {
          throw new Error("scan/analyze requires symbols array in payload")
        }
        
        const scanId = `${this.bot.id}-scan-${Date.now()}`
        await this.request("/run", {
          method: "POST",
          body: {
            id: scanId,
            config: {
              symbols: symbols,
              assetClass: payload?.assetClass || this.bot.desiredConfig?.assetClass || "stock",
              timeframe: payload?.timeframe || this.bot.desiredConfig?.timeframe || "1d",
              strategy: payload?.strategy || this.bot.desiredConfig?.strategy || "default",
            },
          },
        })
        
        // Poll for signals after a delay
        await new Promise(resolve => setTimeout(resolve, 5000))
        const signalsData = await this.request("/signals")
        const scanSignals = Array.isArray(signalsData?.signals) 
          ? signalsData.signals.filter(s => s.strategy_id === scanId)
          : []
        
        return { signals: scanSignals.length }
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
    case "alphavantage":
      return new AlphaVantageAdapter(bot)
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}

async function writeSignals(db, botId, signals) {
  if (!signals || signals.length === 0) return
  const ref = db.collection("bots").doc(botId).collection("signals")
  const batch = db.batch()
  for (const signal of signals.slice(0, 50)) {
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
      createdAt: signalTime
        ? admin.firestore.Timestamp.fromDate(signalTime)
        : admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
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

  const tick = async () => {
    if (running) return
    running = true
    try {
      const update = await adapter.poll()
      await applyUpdate(db, bot, update)
    } catch (err) {
      log(`poll failed for ${bot.id}: ${String(err)}`)
      await markBotError(db, bot, err)
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
          const update = await adapter.poll()
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

async function main() {
  const config = await loadConfig()
  const db = initFirestore(config.firestore?.projectId)

  log(`loaded config for ${config.bots.length} bot(s)`) 

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
}

main().catch((err) => {
  log(`fatal: ${String(err)}`)
  process.exit(1)
})
