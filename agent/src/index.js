import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"

const CONFIG_ENV = "RELAYORB_CONFIG_PATH"
const DEFAULT_CONFIG = "config.json"

const log = (message) => {
  const stamp = new Date().toISOString()
  console.log(`[relayorb-agent ${stamp}] ${message}`)
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
  return admin.firestore()
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

function withBaseUrl(baseUrl, endpoint) {
  return `${baseUrl.replace(/\/$/, "")}${endpoint}`
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

  async poll() {
    const state = {}
    let status = "offline"
    const events = []

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
    } catch (err) {
      events.push({
        type: "log",
        severity: "warn",
        message: `Freqtrade log poll failed: ${String(err)}`,
      })
    }

    const summary = {
      positions: Array.isArray(state.openTrades) ? state.openTrades.length : undefined,
    }

    return { status, summary, state, events }
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

    try {
      state.bots = await this.request("/bot-orchestration/bots")
      status = "online"
    } catch (err) {
      return { status, state: { error: String(err) } }
    }

    try {
      state.status = await this.request(`/bot-orchestration/bots/${encodeURIComponent(this.remoteId)}/status`)
      const running = state.status?.status || state.status?.state || ""
      if (typeof running === "string") {
        status = running.toLowerCase().includes("run") ? "online" : "idle"
      }
    } catch (err) {
      state.status = { error: String(err) }
    }

    return { status, state }
  }

  async executeCommand(type, payload) {
    switch (type) {
      case "start":
        await this.request(`/bot-orchestration/bots/${encodeURIComponent(this.remoteId)}/start`, { method: "POST" })
        return { status: "online" }
      case "stop":
        await this.request(`/bot-orchestration/bots/${encodeURIComponent(this.remoteId)}/stop`, { method: "POST" })
        return { status: "idle" }
      case "restart":
        await this.request(`/bot-orchestration/bots/${encodeURIComponent(this.remoteId)}/stop`, { method: "POST" })
        await this.request(`/bot-orchestration/bots/${encodeURIComponent(this.remoteId)}/start`, { method: "POST" })
        return { status: "online" }
      case "reload_config":
        if (!payload || Object.keys(payload).length === 0) {
          throw new Error("reload_config requires a payload")
        }
        await this.request(`/bot-orchestration/bots/${encodeURIComponent(this.remoteId)}/config`, {
          method: "PUT",
          body: payload,
        })
        return { status: "online" }
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
}

class JesseAdapter {
  constructor(bot) {
    this.bot = bot
    this.baseUrl = bot.api?.baseUrl
    this.password = bot.api?.password
    this.token = null
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

    try {
      state.general = await this.request("/system/general-info", { method: "POST" })
      status = "online"
    } catch (err) {
      return { status, state: { error: String(err) } }
    }

    return { status, state }
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
  await docRef.set(
    {
      id: bot.id,
      name: bot.name || bot.id,
      engine: bot.engine,
      status: "unknown",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
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
