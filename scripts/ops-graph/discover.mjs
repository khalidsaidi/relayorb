import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"

const cwd = process.cwd()
const OUT_DIR = path.join(cwd, "docs/ops")
const DATA_INVENTORY_PATH = path.join(OUT_DIR, "data-inventory.md")
const REDIS_INVENTORY_PATH = path.join(OUT_DIR, "redis-inventory.md")
const PROVIDER_INVENTORY_PATH = path.join(OUT_DIR, "provider-inventory.md")
const BOT_INVENTORY_PATH = path.join(OUT_DIR, "bot-inventory.md")
const BLOCKERS_PATH = path.join(OUT_DIR, "discovery-blockers.md")

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null
  const idx = trimmed.indexOf("=")
  if (idx === -1) return null
  const key = trimmed.slice(0, idx).trim()
  let value = trimmed.slice(idx + 1).trim()
  if (!key) return null
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return { key, value }
}

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const env = {}
    raw.split("\n").forEach((line) => {
      const parsed = parseEnvLine(line)
      if (!parsed) return
      if (!env[parsed.key]) env[parsed.key] = parsed.value
    })
    return env
  } catch {
    return {}
  }
}

function resolveEnv(key, envFile) {
  return process.env[key] || envFile[key] || ""
}

function safeHost(url) {
  if (!url) return ""
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

function summarizeValue(value, depth = 0) {
  if (value === null || value === undefined) return null
  if (value instanceof admin.firestore.Timestamp) return "<timestamp>"
  if (Array.isArray(value)) return `array(len=${value.length})`
  if (typeof value === "string") return "<string>"
  if (typeof value === "number") return "<number>"
  if (typeof value === "boolean") return "<boolean>"
  if (typeof value === "object") {
    if (depth >= 1) return "<map>"
    const entries = Object.entries(value)
      .slice(0, 8)
      .map(([key, val]) => [key, summarizeValue(val, depth + 1)])
    return Object.fromEntries(entries)
  }
  return `<${typeof value}>`
}

function summarizeDoc(data) {
  if (!data || typeof data !== "object") return null
  const entries = Object.entries(data)
    .slice(0, 12)
    .map(([key, value]) => [key, summarizeValue(value, 0)])
  return Object.fromEntries(entries)
}

function formatJsonBlock(data) {
  if (!data) return "n/a"
  return `\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`
}

async function fetchLatestDoc(db, collectionPath) {
  const snap = await db.collection(collectionPath).orderBy("updatedAt", "desc").limit(1).get()
  return snap.docs[0] || null
}

async function main() {
  const envFile = await loadEnvFile(path.join(cwd, ".env"))
  const blockers = []
  const timestamp = new Date().toISOString()
  const redisConnectTimeoutMs = parseInt(
    process.env.REDIS_DISCOVERY_CONNECT_TIMEOUT_MS || "4000",
    10
  )
  const redisScanTimeoutMs = parseInt(process.env.REDIS_DISCOVERY_TIMEOUT_MS || "12000", 10)

  await fs.mkdir(OUT_DIR, { recursive: true })

  const projectId =
    resolveEnv("FIREBASE_PROJECT_ID", envFile) ||
    resolveEnv("GCLOUD_PROJECT", envFile) ||
    resolveEnv("GOOGLE_CLOUD_PROJECT", envFile)

  const serviceAccountCandidate =
    resolveEnv("GOOGLE_APPLICATION_CREDENTIALS", envFile) ||
    path.join(cwd, "relayorb-firebase-service-account.json")
  let serviceAccountPath = ""
  try {
    await fs.access(serviceAccountCandidate)
    serviceAccountPath = serviceAccountCandidate
  } catch {
    serviceAccountPath = ""
  }
  let serviceAccountProjectId = ""

  let firestoreSummary = ""
  let botsSummary = ""
  if (!projectId && !serviceAccountPath) {
    blockers.push("Firestore discovery requires FIREBASE_PROJECT_ID or a service account path.")
  } else {
    try {
      let credential = null
      if (serviceAccountPath) {
        const raw = await fs.readFile(serviceAccountPath, "utf8")
        const parsed = JSON.parse(raw)
        serviceAccountProjectId = parsed?.project_id || ""
        credential = admin.credential.cert(parsed)
      } else {
        credential = admin.credential.applicationDefault()
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential,
          projectId: projectId || serviceAccountProjectId || undefined,
        })
      }

      const db = admin.firestore()
      const collections = await db.listCollections()
      const collectionNames = collections.map((col) => col.id).sort()

      const batchCollection = resolveEnv("BATCH_COLLECTION", envFile) || "batches"

      const docTargets = [
        { path: "market/movers", label: "market/movers" },
        { path: "market/candidates", label: "market/candidates" },
        { path: "market/hotTrades", label: "market/hotTrades" },
        { path: "market/trending", label: "market/trending" },
        { path: "market/actionBoard", label: "market/actionBoard" },
        { path: "market/popular", label: "market/popular" },
        { path: "market/prices", label: "market/prices" },
        { path: "market/prices_snapshot", label: "market/prices_snapshot" },
        { path: "market/universe", label: "market/universe" },
        { path: "market/controls", label: "market/controls" },
        { path: "market/streamSymbols", label: "market/streamSymbols" },
        { path: "market/refresh", label: "market/refresh" },
        { path: `${batchCollection}/<latest>`, label: `${batchCollection}/*` },
        { path: "batch_consumers/<latest>", label: "batch_consumers/*" },
        { path: "analytics/signalPerformance", label: "analytics/signalPerformance" },
        { path: "bots/<latest>", label: "bots/*" },
        { path: "bots/<latest>/signals/<latest>", label: "bots/*/signals/*" },
      ]

      const docSummaries = []
      for (const target of docTargets) {
        let snap = null
        if (target.path.endsWith("/<latest>/signals/<latest>")) {
          const botSnap = await fetchLatestDoc(db, "bots")
          if (botSnap) {
            const signalsSnap = await botSnap.ref
              .collection("signals")
              .orderBy("createdAt", "desc")
              .limit(1)
              .get()
            snap = signalsSnap.docs[0] || null
          }
        } else if (target.path.endsWith("/<latest>")) {
          const collectionPath = target.path.replace("/<latest>", "")
          const latest = await fetchLatestDoc(db, collectionPath)
          snap = latest
        } else {
          snap = await db.doc(target.path).get()
        }
        const exists = snap && snap.exists
        const data = exists ? snap.data() : null
        docSummaries.push({
          label: target.label,
          exists: Boolean(exists),
          fields: exists ? Object.keys(data || {}).slice(0, 12) : [],
          sample: exists ? summarizeDoc(data) : null,
        })
      }

      const effectiveProjectId = projectId || serviceAccountProjectId
      firestoreSummary = [
        "# Data Inventory",
        `Generated at ${timestamp}`,
        "",
        effectiveProjectId ? `Project: ${effectiveProjectId}` : "Project: <unknown>",
        "",
        "Collections:",
        ...collectionNames.map((name) => `- ${name}`),
        "",
        "Sampled Documents:",
        ...docSummaries.map((doc) => {
          const status = doc.exists ? "found" : "missing"
          const fields = doc.fields.length > 0 ? doc.fields.join(", ") : "n/a"
          return [
            `- ${doc.label} (${status})`,
            `  - fields: ${fields}`,
            doc.sample
              ? `  - sample:${formatJsonBlock(doc.sample).replace(/\n/g, "\n    ")}`
              : "  - sample: n/a",
          ].join("\n")
        }),
        "",
      ].join("\n")

      const botSnap = await db.collection("bots").limit(20).get()
      const bots = botSnap.docs.map((doc) => ({
        id: doc.id,
        data: summarizeDoc(doc.data()),
      }))
      botsSummary = [
        "# Bot Inventory",
        `Generated at ${timestamp}`,
        "",
        bots.length === 0 ? "No bot docs found." : "Sampled bots:",
        ...bots.map((bot) => {
          return [
            `- ${bot.id}`,
            bot.data ? `  - sample:${formatJsonBlock(bot.data).replace(/\n/g, "\n    ")}` : "  - sample: n/a",
          ].join("\n")
        }),
        "",
      ].join("\n")
    } catch (err) {
      blockers.push(`Firestore discovery failed: ${err?.message || err}`)
    }
  }

  let redisSummary = ""
  const redisUrl = resolveEnv("REDIS_URL", envFile)
  if (!redisUrl) {
    blockers.push("Redis discovery requires REDIS_URL.")
    redisSummary = [
      "# Redis Inventory",
      `Generated at ${timestamp}`,
      "",
      "Unavailable. Missing REDIS_URL.",
      "",
    ].join("\n")
  } else {
    try {
      const redisModule = await import("redis")
      const { createClient } = redisModule
      const client = createClient({
        url: redisUrl,
        socket: { connectTimeout: redisConnectTimeoutMs },
      })
      client.on("error", () => {})
      let connected = false
      try {
        await Promise.race([
          client.connect(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Redis connect timeout")), redisConnectTimeoutMs)
          }),
        ])
        connected = true

        const prefix = resolveEnv("REDIS_PREFIX", envFile) || "relayorb"
        const streamKey =
          resolveEnv("PIPELINE_EVENTS_STREAM", envFile) || `${prefix}:pipeline_events`
        const eventChannel =
          resolveEnv("REDIS_EVENT_CHANNEL", envFile) || `${prefix}:events`

        const prefixCounts = {}
        let cursor = "0"
        const start = Date.now()
        while (Date.now() - start < redisScanTimeoutMs) {
          const reply = await client.scan(cursor, {
            MATCH: `${prefix}:*`,
            COUNT: 200,
          })
          cursor = reply.cursor
          reply.keys.forEach((key) => {
            const suffix = key.replace(`${prefix}:`, "")
            const group = suffix.split(":")[0] || "unknown"
            prefixCounts[group] = (prefixCounts[group] || 0) + 1
          })
          if (cursor === "0") break
        }

        let streamInfo = null
        try {
          streamInfo = await client.xInfo("STREAM", streamKey)
        } catch {
          streamInfo = null
        }

        redisSummary = [
          "# Redis Inventory",
          `Generated at ${timestamp}`,
          "",
          `Prefix: ${prefix}`,
          "",
          `Event channel: ${eventChannel}`,
          `Pipeline stream: ${streamKey}`,
          "",
          "Key groups (sampled):",
          ...Object.entries(prefixCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([group, count]) => `- ${group}: ~${count}`),
          "",
          streamInfo ? `Stream info: ${JSON.stringify(streamInfo)}` : "Stream info: unavailable",
          "",
        ].join("\n")
      } finally {
        if (connected) {
          await client.quit().catch(() => {})
        } else {
          client.disconnect()
        }
      }
    } catch (err) {
      blockers.push(`Redis discovery failed: ${err?.message || err}`)
    }
  }

  const providers = []
  const fmpKey = resolveEnv("FMP_API_KEY", envFile)
  const fmpBase = resolveEnv("FMP_BASE_URL", envFile) || resolveEnv("FMP_STABLE_BASE_URL", envFile)
  if (fmpKey || fmpBase) {
    providers.push({ id: "fmp", enabled: Boolean(fmpKey), host: safeHost(fmpBase) })
  }
  const marketauxKey = resolveEnv("MARKETAUX_API_KEY", envFile)
  const marketauxBase = resolveEnv("MARKETAUX_BASE_URL", envFile)
  if (marketauxKey || marketauxBase) {
    providers.push({ id: "marketaux", enabled: Boolean(marketauxKey), host: safeHost(marketauxBase) })
  }

  if (providers.length === 0) {
    blockers.push("Provider discovery requires MDG/provider env vars (FMP_API_KEY, MARKETAUX_API_KEY, etc.).")
  }

  const providerSummary = [
    "# Provider Inventory",
    `Generated at ${timestamp}`,
    "",
    providers.length === 0 ? "No providers detected in runtime config." : "Detected providers:",
    ...providers.map((provider) =>
      `- ${provider.id} (enabled=${provider.enabled ? "yes" : "no"}${provider.host ? `, host=${provider.host}` : ""})`
    ),
    "",
  ].join("\n")

  const blockersSummary = [
    "# Discovery Blockers",
    `Generated at ${timestamp}`,
    "",
    blockers.length === 0 ? "None." : blockers.map((blocker) => `- ${blocker}`).join("\n"),
    "",
  ].join("\n")

  await fs.writeFile(
    DATA_INVENTORY_PATH,
    firestoreSummary || "# Data Inventory\nUnavailable.\n",
    "utf8"
  )
  await fs.writeFile(
    REDIS_INVENTORY_PATH,
    redisSummary || "# Redis Inventory\nUnavailable.\n",
    "utf8"
  )
  await fs.writeFile(
    PROVIDER_INVENTORY_PATH,
    providerSummary || "# Provider Inventory\nUnavailable.\n",
    "utf8"
  )
  await fs.writeFile(
    BOT_INVENTORY_PATH,
    botsSummary || "# Bot Inventory\nUnavailable.\n",
    "utf8"
  )
  await fs.writeFile(BLOCKERS_PATH, blockersSummary, "utf8")

  console.log("Discovery artifacts written to docs/ops.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
