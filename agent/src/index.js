import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"

const CONFIG_ENV = "RELAYORB_CONFIG_PATH"
const DEFAULT_CONFIG = "config.json"
const FREQTRADE_CONFIG_PATH = process.env.RELAYORB_FREQTRADE_CONFIG || ""
const HUMMINGBOT_BOTS_DIR = process.env.RELAYORB_HUMMINGBOT_DIR || ""
const JESSE_PROJECT_DIR = process.env.RELAYORB_JESSE_DIR || ""

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
  hummingbot: {
    exchanges: ["binance", "kraken", "coinbase", "kucoin", "bybit", "okx"],
    timeframes: ["1m", "5m", "15m", "1h", "4h", "1d"],
    modes: ["signal", "paper", "live"],
  },
  jesse: {
    exchanges: ["binance", "kraken", "coinbase", "kucoin", "bybit", "okx"],
    timeframes: ["1m", "5m", "15m", "1h", "4h", "1d"],
    modes: ["signal", "paper", "live"],
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

async function readFileTail(filePath, maxBytes = 65536) {
  let handle = null
  try {
    handle = await fs.open(filePath, "r")
    const stat = await handle.stat()
    const size = stat.size
    if (size === 0) return ""
    const start = Math.max(0, size - maxBytes)
    const length = size - start
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, start)
    return buffer.toString("utf8")
  } catch (err) {
    return null
  } finally {
    if (handle) {
      await handle.close().catch(() => {})
    }
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
}

async function writeYamlFromJson(filePath, data) {
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

function buildRelayorbMeta(payload) {
  if (!payload || typeof payload !== "object") return {}
  const meta = {
    exchange: payload.exchange,
    pairs: payload.pairs,
    timeframe: payload.timeframe,
    mode: payload.mode,
    strategy: payload.strategy,
    risk: payload.risk,
  }
  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined))
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

async function applyHummingbotConfig(botId, payload) {
  if (!HUMMINGBOT_BOTS_DIR) {
    return { applied: false, note: "Missing RELAYORB_HUMMINGBOT_DIR" }
  }

  const botDir = path.join(HUMMINGBOT_BOTS_DIR, botId)
  const confDir = path.join(botDir, "conf")
  const advanced = resolveAdvanced(payload, "hummingbot") || {}
  const config = { ...advanced }

  const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
  if (payload.strategy && !config.strategy) config.strategy = payload.strategy
  if (payload.exchange && !config.exchange) config.exchange = payload.exchange
  if (pairs.length > 0 && !config.markets) {
    config.markets = pairs.map((pair) => normalizePair(pair, "-"))
  }
  if (payload.timeframe && !config.timeframe) config.timeframe = payload.timeframe

  const relayorbMeta = buildRelayorbMeta(payload)
  if (Object.keys(relayorbMeta).length > 0) {
    config.relayorb = { ...(config.relayorb || {}), ...relayorbMeta }
  }

  await writeYamlFromJson(path.join(confDir, "conf.yml"), config)
  await writeJsonFile(path.join(botDir, "relayorb.json"), { config, payload })
  return { applied: true, path: path.join(confDir, "conf.yml") }
}

async function applyJesseConfig(payload) {
  if (!JESSE_PROJECT_DIR) {
    return { applied: false, note: "Missing RELAYORB_JESSE_DIR" }
  }

  const configDir = path.join(JESSE_PROJECT_DIR, "config")
  const advanced = resolveAdvanced(payload, "jesse") || {}
  const exchange = payload.exchange || advanced.exchange || "Binance"
  const timeframe = payload.timeframe || advanced.timeframe || "1m"
  const strategy = payload.strategy || advanced.strategy || "DefaultStrategy"

  const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
  const routes =
    Array.isArray(advanced.routes) && advanced.routes.length
      ? advanced.routes
      : pairs.map((pair) => ({
          exchange,
          symbol: normalizePair(pair, "-"),
          timeframe,
          strategy,
        }))

  const dataRoutes =
    advanced.data_routes || advanced.dataRoutes || []

  await writeJsonFile(path.join(configDir, "routes.json"), {
    routes,
    data_routes: dataRoutes,
  })

  const relayorbMeta = buildRelayorbMeta(payload)
  const config = { ...(advanced.config || {}) }
  if (!config.exchange) config.exchange = exchange
  if (!config.timeframe) config.timeframe = timeframe
  if (payload.mode && !config.mode) config.mode = payload.mode
  if (Object.keys(relayorbMeta).length > 0) {
    config.relayorb = { ...(config.relayorb || {}), ...relayorbMeta }
  }
  await writeJsonFile(path.join(configDir, "config.json"), config)
  await writeJsonFile(path.join(JESSE_PROJECT_DIR, "relayorb.json"), { config, payload })
  return { applied: true, path: path.join(configDir, "routes.json") }
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

class HummingbotAdapter {
  constructor(bot) {
    this.bot = bot
    this.baseUrl = bot.api?.baseUrl
    this.username = bot.api?.username
    this.password = bot.api?.password
    this.remoteId = bot.api?.remoteId || bot.id
    this.signalDeduper = createDeduper()
    this.logDeduper = createDeduper()
  }

  authHeader() {
    if (!this.username || !this.password) {
      throw new Error("Hummingbot API username/password missing")
    }
    const basic = Buffer.from(`${this.username}:${this.password}`).toString("base64")
    return `Basic ${basic}`
  }

  async request(endpoint, { method = "GET", body } = {}) {
    const headers = {
      Authorization: this.authHeader(),
    }
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
    let mqttActive = false

    try {
      state.service = await this.request("/bot-orchestration/status")
      status = "online"
    } catch (err) {
      return { status, state: { error: String(err) } }
    }

    try {
      state.botStatus = await this.request(`/bot-orchestration/${encodeURIComponent(this.remoteId)}/status`)
      const rawStatus =
        state.botStatus?.data?.status ||
        state.botStatus?.status ||
        state.botStatus?.state ||
        ""
      const recentlyActive = state.botStatus?.data?.recently_active === true
      if (typeof rawStatus === "string") {
        const normalized = rawStatus.toLowerCase()
        if (normalized.includes("run")) {
          status = "online"
        } else if (recentlyActive) {
          status = "online"
        } else if (normalized.includes("not_found") || normalized.includes("stop") || normalized.includes("idle")) {
          status = "idle"
        }
      }
    } catch (err) {
      state.botStatus = { error: String(err) }
    }

    try {
      state.mqtt = await this.request("/bot-orchestration/mqtt")
      const activeBots = state.mqtt?.data?.active_bots || state.mqtt?.active_bots || []
      if (Array.isArray(activeBots) && activeBots.includes(this.remoteId)) {
        mqttActive = true
        status = "online"
      }
    } catch (err) {
      state.mqtt = { error: String(err) }
    }

    try {
      state.orders = await this.request("/trading/orders/active", { method: "POST", body: {} })
    } catch (err) {
      state.orders = { error: String(err) }
    }

    try {
      state.trades = await this.request("/trading/trades", { method: "POST", body: {} })
    } catch (err) {
      state.trades = { error: String(err) }
    }

    const orders = Array.isArray(state.orders)
      ? state.orders
      : Array.isArray(state.orders?.orders)
        ? state.orders.orders
        : []

    for (const order of orders.slice(0, 20)) {
      const sideRaw = order?.side || order?.trade_type || order?.order_side || ""
      const side = typeof sideRaw === "string" ? sideRaw.toLowerCase() : ""
      if (!["buy", "sell"].includes(side)) continue
      const pair = order?.market || order?.trading_pair || order?.symbol || null
      const signal = {
        side,
        strength: 0.6,
        message: pair ? `${side.toUpperCase()} order ${pair}` : `${side.toUpperCase()} order`,
        data: { pair, source: "orders", raw: order },
      }
      const key = JSON.stringify(signal)
      if (this.signalDeduper.has(key)) continue
      this.signalDeduper.add(key)
      signals.push(signal)
    }

    const trades = Array.isArray(state.trades)
      ? state.trades
      : Array.isArray(state.trades?.trades)
        ? state.trades.trades
        : []

    for (const trade of trades.slice(0, 20)) {
      const sideRaw = trade?.side || trade?.trade_type || trade?.order_side || ""
      const side = typeof sideRaw === "string" ? sideRaw.toLowerCase() : ""
      if (!["buy", "sell"].includes(side)) continue
      const pair = trade?.market || trade?.trading_pair || trade?.symbol || null
      const signal = {
        side,
        strength: 0.7,
        message: pair ? `${side.toUpperCase()} trade ${pair}` : `${side.toUpperCase()} trade`,
        data: { pair, source: "trades", raw: trade },
      }
      const key = JSON.stringify(signal)
      if (this.signalDeduper.has(key)) continue
      this.signalDeduper.add(key)
      signals.push(signal)
    }

    try {
      await this.collectLogSignals(events, signals)
    } catch (err) {
      events.push({
        type: "log",
        severity: "warn",
        message: `Hummingbot log parse failed: ${String(err)}`,
      })
    }

    return { status, state, events, signals }
  }

  async collectLogSignals(events, signals) {
    if (!HUMMINGBOT_BOTS_DIR) return
    const logDir = path.join(HUMMINGBOT_BOTS_DIR, "instances", this.remoteId, "logs")
    const logFiles = ["logs_simple_pmm.log", "logs_hummingbot.log"]
    const marker = "EVENT_LOG - "

    for (const file of logFiles) {
      const raw = await readFileTail(path.join(logDir, file))
      if (!raw) continue
      const lines = raw.split("\n")
      for (const line of lines) {
        const idx = line.indexOf(marker)
        if (idx === -1) continue
        const jsonPart = line.slice(idx + marker.length).trim()
        if (!jsonPart.startsWith("{")) continue
        let data
        try {
          data = JSON.parse(jsonPart)
        } catch (err) {
          continue
        }

        const eventName = (data?.event_name || data?.event || "").toString()
        const lowered = eventName.toLowerCase()
        const side = lowered.includes("buy")
          ? "buy"
          : lowered.includes("sell")
            ? "sell"
            : null
        if (!side) continue

        const pair = data?.trading_pair || data?.symbol || data?.market || null
        const message = pair
          ? `${side.toUpperCase()} ${pair}`
          : `${side.toUpperCase()} signal`
        const signal = {
          side,
          strength: lowered.includes("filled") ? 0.8 : 0.6,
          message,
          data: { pair, source: "logs", event: eventName, raw: data },
        }
        const key = JSON.stringify(signal)
        if (!this.signalDeduper.has(key)) {
          this.signalDeduper.add(key)
          signals.push(signal)
        }

        const eventKey = JSON.stringify({ eventName, pair, id: data?.order_id || data?.trade_id || data?.timestamp })
        if (!this.logDeduper.has(eventKey)) {
          this.logDeduper.add(eventKey)
          events.push({
            type: "log",
            severity: "info",
            message: `Hummingbot ${eventName}`,
            data,
          })
        }
      }
    }
  }

  async executeCommand(type, payload) {
    switch (type) {
      case "start":
        await this.request("/bot-orchestration/start-bot", {
          method: "POST",
          body: { bot_name: this.remoteId },
        })
        return { status: "online" }
      case "stop":
        await this.request("/bot-orchestration/stop-bot", {
          method: "POST",
          body: { bot_name: this.remoteId },
        })
        return { status: "idle" }
      case "restart":
        await this.request("/bot-orchestration/stop-bot", {
          method: "POST",
          body: { bot_name: this.remoteId },
        })
        await this.request("/bot-orchestration/start-bot", {
          method: "POST",
          body: { bot_name: this.remoteId },
        })
        return { status: "online" }
      case "reload_config":
        if (!payload || Object.keys(payload).length === 0) {
          throw new Error("reload_config requires a payload")
        }
        await this.updateControllerConfig(payload)
        return { status: "online" }
      case "configure":
        if (!payload || Object.keys(payload).length === 0) {
          throw new Error("configure requires a payload")
        }
        const hummingbotResult = await applyHummingbotConfig(this.remoteId, payload)
        await this.updateControllerConfig(payload)
        return { status: "online", result: hummingbotResult }
      case "backtest":
        if (!payload || Object.keys(payload).length === 0) {
          throw new Error("backtest requires a payload")
        }
        await this.request("/backtesting/run", { method: "POST", body: payload })
        return { status: "online" }
      case "paper":
      case "live":
        throw new Error(`Hummingbot API does not expose '${type}' as a direct command. Use start/stop or bot-orchestration endpoints.`)
      default:
        throw new Error(`Unsupported command: ${type}`)
    }
  }

  async updateControllerConfig(payload) {
    const configPayload = resolveAdvanced(payload, "hummingbot") || payload || {}
    const controllerName =
      configPayload.controller ||
      configPayload.controllerName ||
      configPayload.controller_id ||
      configPayload.controllerId
    const controllerConfig =
      configPayload.controllerConfig ||
      configPayload.controller_config ||
      configPayload.config

    if (!controllerName || !controllerConfig) {
      return
    }

    await this.request(
      `/controllers/bots/${encodeURIComponent(this.remoteId)}/${encodeURIComponent(controllerName)}/config`,
      {
        method: "POST",
        body: controllerConfig,
      }
    )
  }
}

class JesseAdapter {
  constructor(bot) {
    this.bot = bot
    this.baseUrl = bot.api?.baseUrl
    this.password = bot.api?.password
    this.token = null
    this.signalDeduper = createDeduper()
  }

  async login() {
    if (!this.password) {
      throw new Error("Jesse password missing")
    }
    const data = await fetchJson(withBaseUrl(this.baseUrl, "/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: this.password }),
    })
    this.token = data?.auth_token || null
    if (!this.token) {
      throw new Error("Jesse login failed (no auth token)")
    }
  }

  async request(endpoint, { method = "POST", body } = {}) {
    if (!this.token) {
      await this.login()
    }
    const headers = {
      Authorization: this.token,
    }
    if (body) headers["Content-Type"] = "application/json"

    try {
      return await fetchJson(withBaseUrl(this.baseUrl, endpoint), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("401")) {
        await this.login()
        headers.Authorization = this.token
        return fetchJson(withBaseUrl(this.baseUrl, endpoint), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })
      }
      throw err
    }
  }

  async poll() {
    const state = {}
    let status = "offline"
    const signals = []

    try {
      state.general = await this.request("/system/general-info", { method: "POST" })
      status = "online"
    } catch (err) {
      return { status, state: { error: String(err) } }
    }

    try {
      state.orders = await this.request("/live/orders", { method: "POST" })
    } catch (err) {
      state.orders = { error: String(err) }
    }

    const orders = Array.isArray(state.orders)
      ? state.orders
      : Array.isArray(state.orders?.orders)
        ? state.orders.orders
        : []

    for (const order of orders.slice(0, 20)) {
      const sideRaw = order?.side || order?.type || ""
      const side = typeof sideRaw === "string" ? sideRaw.toLowerCase() : ""
      if (!["buy", "sell"].includes(side)) continue
      const pair = order?.symbol || order?.pair || order?.trading_pair || null
      const signal = {
        side,
        strength: 0.6,
        message: pair ? `${side.toUpperCase()} order ${pair}` : `${side.toUpperCase()} order`,
        data: { pair, source: "orders", raw: order },
      }
      const key = JSON.stringify(signal)
      if (this.signalDeduper.has(key)) continue
      this.signalDeduper.add(key)
      signals.push(signal)
    }

    return { status, state, signals }
  }

  async executeCommand(type, payload) {
    switch (type) {
      case "paper":
      case "live": {
        if (!payload || Object.keys(payload).length === 0) {
          throw new Error(`${type} requires a payload`)
        }
        const body = {
          ...payload,
          paper_mode: type === "paper",
        }
        await this.request("/live", { method: "POST", body })
        return { status: "online" }
      }
      case "stop": {
        if (!payload || !payload.id) {
          throw new Error("stop requires payload.id")
        }
        if (payload.paper_mode === undefined) {
          throw new Error("stop requires payload.paper_mode")
        }
        await this.request("/live/cancel", { method: "POST", body: payload })
        return { status: "idle" }
      }
      case "backtest": {
        if (!payload || Object.keys(payload).length === 0) {
          throw new Error("backtest requires a payload")
        }
        await this.request("/backtest", { method: "POST", body: payload })
        return { status: "online" }
      }
      case "restart": {
        if (!payload || !payload.stop || !payload.start) {
          throw new Error("restart requires payload.stop and payload.start")
        }
        await this.request("/live/cancel", { method: "POST", body: payload.stop })
        await this.request("/live", { method: "POST", body: payload.start })
        return { status: "online" }
      }
      case "configure":
        const jesseResult = await applyJesseConfig(payload || {})
        return {
          result: {
            ...jesseResult,
            note: "Config written. Restart Jesse to apply routes.",
          },
        }
      case "reload_config":
      case "start":
        throw new Error(`Jesse uses live/paper commands. Use 'live' or 'paper' with payload instead of '${type}'.`)
      default:
        throw new Error(`Unsupported command: ${type}`)
    }
  }
}

function createAdapter(bot) {
  switch (bot.engine) {
    case "freqtrade":
      return new FreqtradeAdapter(bot)
    case "hummingbot":
      return new HummingbotAdapter(bot)
    case "jesse":
      return new JesseAdapter(bot)
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
    batch.set(docRef, {
      botId,
      side: signal.side || null,
      strength: typeof signal.strength === "number" ? signal.strength : null,
      message: signal.message || "",
      data: signal.data || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
      const docRef = change.doc.ref
      const data = await claimCommand(db, docRef)
      if (!data) return

      const commandType = data.type
      const payload = data.payload || {}

      try {
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
