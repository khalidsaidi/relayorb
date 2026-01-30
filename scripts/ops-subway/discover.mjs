import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"

const cwd = process.cwd()
const REPORT_PATH = path.join(cwd, "docs/ops-subway/DISCOVERY_REPORT.md")

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null
  const idx = trimmed.indexOf("=")
  if (idx === -1) return null
  const key = trimmed.slice(0, idx).trim()
  let value = trimmed.slice(idx + 1).trim()
  if (!key) return null
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
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
  if (Array.isArray(value)) {
    return `array(len=${value.length})`
  }
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

async function main() {
  const envFile = await loadEnvFile(path.join(cwd, ".env"))
  const blockers = []
  const timestamp = new Date().toISOString()
  const redisConnectTimeoutMs = parseInt(
    process.env.REDIS_DISCOVERY_CONNECT_TIMEOUT_MS || "4000",
    10
  )
  const redisScanTimeoutMs = parseInt(
    process.env.REDIS_DISCOVERY_TIMEOUT_MS || "12000",
    10
  )

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

      const docTargets = [
        { path: "market/prices", label: "market/prices" },
        { path: "market/prices_snapshot", label: "market/prices_snapshot" },
        { path: "market/movers", label: "market/movers" },
        { path: "market/hotTrades", label: "market/hotTrades" },
        { path: "market/actionBoard", label: "market/actionBoard" },
        { path: "market/trending", label: "market/trending" },
        { path: "market/popular", label: "market/popular" },
        { path: "market/candidates", label: "market/candidates" },
        { path: "market/controls", label: "market/controls" },
        { path: "market/universe", label: "market/universe" },
        { path: "market/streamSymbols", label: "market/streamSymbols" },
        { path: "market/refresh", label: "market/refresh" },
      ]

      const batchCollection = resolveEnv("BATCH_COLLECTION", envFile) || "batches"
      docTargets.push({ path: `${batchCollection}/<latest>`, label: `${batchCollection}/*` })
      docTargets.push({ path: "batch_consumers/<latest>", label: "batch_consumers/*" })
      docTargets.push({ path: "bots/<latest>", label: "bots/*" })
      docTargets.push({ path: "analytics/signalPerformance", label: "analytics/signalPerformance" })

      const docSummaries = []

      for (const target of docTargets) {
        let snap = null
        if (target.path.endsWith("/<latest>")) {
          const collectionPath = target.path.replace("/<latest>", "")
          const querySnap = await db.collection(collectionPath).orderBy("updatedAt", "desc").limit(1).get()
          snap = querySnap.docs[0] || null
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
        "## Firestore",
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
            doc.sample ? `  - sample:${formatJsonBlock(doc.sample).replace(/\n/g, "\n    ")}` : "  - sample: n/a",
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
  } else {
    try {
      const redisModule = await import("redis")
      const { createClient } = redisModule
      const client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: redisConnectTimeoutMs,
        },
      })
      client.on("error", () => {})
      let connected = false
      try {
        await Promise.race([
          client.connect(),
          new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Redis connect timeout")),
              redisConnectTimeoutMs
            )
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
        let scanned = 0
        const redisDeadline = Date.now() + redisScanTimeoutMs
        do {
          if (Date.now() > redisDeadline) {
            blockers.push("Redis discovery timed out before scan completed.")
            break
          }
          const reply = await client.scan(cursor, { MATCH: `${prefix}:*`, COUNT: 200 })
          cursor = reply.cursor
          const keys = reply.keys || []
          scanned += keys.length
          keys.forEach((key) => {
            const parts = key.split(":")
            const group = parts.slice(0, Math.min(parts.length, 3)).join(":")
            prefixCounts[group] = (prefixCounts[group] || 0) + 1
          })
        } while (cursor !== "0" && scanned < 2000)

        let streamInfo = null
        try {
          streamInfo = await client.xInfo("STREAM", streamKey)
        } catch {
          streamInfo = null
        }

        redisSummary = [
          "## Redis",
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
  const finnhubKey = resolveEnv("FINNHUB_API_KEY", envFile)
  const finnhubBase = resolveEnv("FINNHUB_BASE_URL", envFile)
  if (finnhubKey || finnhubBase) {
    providers.push({ id: "finnhub", enabled: Boolean(finnhubKey), host: safeHost(finnhubBase) })
  }
  const stockdataKey = resolveEnv("STOCKDATA_API_KEY", envFile) || resolveEnv("STOCKDATA_TOKEN", envFile)
  const stockdataBase = resolveEnv("STOCKDATA_BASE_URL", envFile)
  if (stockdataKey || stockdataBase) {
    providers.push({ id: "stockdata", enabled: Boolean(stockdataKey), host: safeHost(stockdataBase) })
  }
  const twelvedataKey = resolveEnv("TWELVEDATA_API_KEY", envFile)
  const twelvedataBase = resolveEnv("TWELVEDATA_BASE_URL", envFile)
  if (twelvedataKey || twelvedataBase) {
    providers.push({ id: "twelvedata", enabled: Boolean(twelvedataKey), host: safeHost(twelvedataBase) })
  }
  const alphavantageKey = resolveEnv("ALPHAVANTAGE_API_KEY", envFile)
  const alphavantageBase = resolveEnv("ALPHAVANTAGE_BASE_URL", envFile)
  if (alphavantageKey || alphavantageBase) {
    providers.push({ id: "alphavantage", enabled: Boolean(alphavantageKey), host: safeHost(alphavantageBase) })
  }
  const marketauxKey = resolveEnv("MARKETAUX_API_KEY", envFile)
  const marketauxBase = resolveEnv("MARKETAUX_BASE_URL", envFile)
  if (marketauxKey || marketauxBase) {
    providers.push({ id: "marketaux", enabled: Boolean(marketauxKey), host: safeHost(marketauxBase) })
  }

  const providerSummary = [
    "## Providers",
    providers.length === 0 ? "No providers detected in runtime config." : "Detected providers:",
    ...providers.map((provider) =>
      `- ${provider.id} (enabled=${provider.enabled ? "yes" : "no"}${provider.host ? `, host=${provider.host}` : ""})`
    ),
    "",
  ].join("\n")

  const blockerSummary = [
    "## Discovery Blockers",
    blockers.length === 0 ? "None." : blockers.map((blocker) => `- ${blocker}`).join("\n"),
    "",
  ].join("\n")

  const output = [
    "# Ops Subway Discovery Report",
    `Generated at ${timestamp}`,
    "",
    firestoreSummary || "## Firestore\nUnavailable.\n",
    redisSummary || "## Redis\nUnavailable.\n",
    providerSummary,
    blockerSummary,
  ].join("\n")

  await fs.writeFile(REPORT_PATH, output, "utf8")
  console.log(`Discovery report written to ${REPORT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
