const http = require("http")
const admin = require("firebase-admin")
const { GoogleAuth } = require("google-auth-library")

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  region:
    process.env.REFRESH_REGION ||
    process.env.CLOUD_RUN_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    "us-west1",
  jobs: (process.env.REFRESH_JOBS ||
    "relayorb-market-intel,relayorb-signal-evaluator")
    .split(",")
    .map((job) => job.trim())
    .filter(Boolean),
  allowlist: (process.env.ADMIN_ALLOWLIST || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  port: parseInt(process.env.PORT || "8080", 10),
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId })
}

const db = admin.firestore()
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  )
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", config.corsOrigin)
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
}

function sendJson(res, status, payload) {
  setCors(res)
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(payload))
}

function parseBearer(req) {
  const header = req.headers.authorization || ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function truncate(text, max = 200) {
  if (!text) return ""
  const cleaned = String(text).replace(/\s+/g, " ").trim()
  if (!cleaned) return ""
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 3)}...`
}

function computePriceLevels(action, price, stopLossPct, takeProfitPct) {
  if (!price || typeof price !== "number" || Number.isNaN(price)) {
    return { stopLossPrice: null, takeProfitPrice: null }
  }
  if (action === "hold") {
    return { stopLossPrice: null, takeProfitPrice: null }
  }
  const stopPct = stopLossPct ?? 2
  const takePct = takeProfitPct ?? 4
  const stop =
    action === "sell"
      ? price * (1 + stopPct / 100)
      : price * (1 - stopPct / 100)
  const target =
    action === "sell"
      ? price * (1 - takePct / 100)
      : price * (1 + takePct / 100)
  return {
    stopLossPrice: Number(stop.toFixed(6)),
    takeProfitPrice: Number(target.toFixed(6)),
  }
}

async function readBody(req) {
  return new Promise((resolve) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 1e6) req.destroy()
    })
    req.on("end", () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        resolve({})
      }
    })
  })
}

async function verifyRequest(req) {
  const token = parseBearer(req)
  if (!token) {
    return { allowed: false, error: "Missing Authorization header." }
  }

  let decoded
  try {
    decoded = await admin.auth().verifyIdToken(token)
  } catch {
    return { allowed: false, error: "Invalid auth token." }
  }

  if (config.allowlist.length === 0) {
    return { allowed: false, error: "Admin allowlist not configured." }
  }

  const email = String(decoded.email || "").toLowerCase()
  if (!email || !config.allowlist.includes(email)) {
    return { allowed: false, error: "Not authorized." }
  }

  return { allowed: true, email, uid: decoded.uid }
}

async function runJob(jobName) {
  const client = await auth.getClient()
  const url = `https://run.googleapis.com/v2/projects/${config.projectId}/locations/${config.region}/jobs/${jobName}:run`
  const res = await client.request({ url, method: "POST" })
  return res.data
}

async function handleRefresh(req, res) {
  const authResult = await verifyRequest(req)
  if (!authResult.allowed) {
    return sendJson(res, 403, { ok: false, error: authResult.error })
  }

  const body = await readBody(req)
  const requestedJobs = Array.isArray(body?.jobs)
    ? body.jobs.map((job) => String(job).trim()).filter(Boolean)
    : []
  const jobList = requestedJobs.length > 0 ? requestedJobs : config.jobs

  const results = await Promise.allSettled(jobList.map((job) => runJob(job)))
  const jobs = results.map((result, index) => {
    const jobName = jobList[index]
    if (result.status === "fulfilled") {
      return compactObject({
        job: jobName,
        status: "started",
        execution: result.value?.name,
      })
    }
    return compactObject({
      job: jobName,
      status: "error",
      error: result.reason?.message || String(result.reason || "Failed"),
    })
  })

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await db
    .doc("market/refresh")
    .set(
      {
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        requestedBy: {
          email: authResult.email,
          uid: authResult.uid,
        },
        requestId,
        jobs,
      },
      { merge: true }
    )

  return sendJson(res, 200, { ok: true, requestId, jobs })
}

function normalizeAction(value) {
  const action = String(value || "").toLowerCase()
  if (action === "buy" || action === "sell" || action === "hold") return action
  return "hold"
}

async function requestAiAdvice(trade) {
  if (!config.openaiKey) {
    throw new Error("OPENAI_API_KEY not configured.")
  }

  const payload = {
    model: config.openaiModel,
    temperature: 0.2,
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content:
          "You are a trading dashboard assistant. Return JSON only, no markdown.",
      },
      {
        role: "user",
        content: [
          "Given the trade context, return JSON:",
          '{"action":"buy|hold|sell","holdMinutes":15-240,"stopLossPct":0.5-8,"takeProfitPct":1-15,"summary":"simple sentence","reasoning":"short reason"}',
          "Rules:",
          "- Use 'hold' if signals are mixed or weak.",
          "- stopLossPct and takeProfitPct are percentages; use null if action is hold.",
          "- Keep the summary short and plain English.",
          "",
          `Symbol: ${trade.symbol}`,
          `Asset class: ${trade.assetClass}`,
          `Side hint: ${trade.side || "n/a"}`,
          `Score: ${trade.score ?? "n/a"} / 100`,
          `Current price: ${trade.price ?? "n/a"}`,
          `Trend: ${trade.trendScore ?? "n/a"} (${trade.trendHorizon ?? "n/a"})`,
          `Bots: ${trade.botsSummary}`,
          `Momentum: ${trade.momentumSummary}`,
          `Sentiment: ${trade.sentimentSummary}`,
          `AI summary: ${trade.aiSummary}`,
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
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI error: ${body.slice(0, 160)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ""
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error("AI response not parsable.")
  }
  const parsed = JSON.parse(match[0])
  const action = normalizeAction(parsed.action)
  const holdMinutes = clamp(parseNumber(parsed.holdMinutes) ?? 60, 15, 240)
  const stopLossPct = parseNumber(parsed.stopLossPct)
  const takeProfitPct = parseNumber(parsed.takeProfitPct)
  const normalizedStop =
    action === "hold"
      ? null
      : clamp(stopLossPct ?? 2, 0.5, 8)
  const normalizedTake =
    action === "hold"
      ? null
      : clamp(takeProfitPct ?? 4, 1, 15)
  const priceLevels = computePriceLevels(action, trade.price, normalizedStop, normalizedTake)
  return {
    action,
    holdMinutes,
    stopLossPct: normalizedStop,
    takeProfitPct: normalizedTake,
    stopLossPrice: priceLevels.stopLossPrice,
    takeProfitPrice: priceLevels.takeProfitPrice,
    summary: truncate(parsed.summary, 140),
    reasoning: truncate(parsed.reasoning, 200),
  }
}

async function handleAdvice(req, res) {
  const authResult = await verifyRequest(req)
  if (!authResult.allowed) {
    return sendJson(res, 403, { ok: false, error: authResult.error })
  }

  const body = await readBody(req)
  const trade = body?.trade || {}
  const symbol = truncate(trade.symbol, 32)
  const assetClass = truncate(trade.assetClass, 16)
  if (!symbol || !assetClass) {
    return sendJson(res, 400, { ok: false, error: "Missing trade symbol." })
  }

  const momentum = trade.momentum || {}
  const signals = trade.signals || {}
  const analysis = trade.analysis || {}

  const promptTrade = {
    symbol,
    assetClass,
    side: truncate(trade.side, 8),
    price: parseNumber(trade.price),
    score: parseNumber(trade.score),
    trendScore: parseNumber(trade.trend?.score),
    trendHorizon: truncate(trade.trend?.horizon, 12),
    botsSummary: trade.signals
      ? `${signals.buy ?? 0} buy / ${signals.sell ?? 0} sell (${signals.total ?? 0} total)`
      : "no bot signals",
    momentumSummary: [
      typeof momentum.change1h === "number"
        ? `1h ${momentum.change1h.toFixed(2)}%`
        : null,
      typeof momentum.change24h === "number"
        ? `24h ${momentum.change24h.toFixed(2)}%`
        : null,
      typeof momentum.change7d === "number"
        ? `7d ${momentum.change7d.toFixed(2)}%`
        : null,
    ]
      .filter(Boolean)
      .join(", "),
    sentimentSummary:
      typeof trade.news?.sentiment === "number"
        ? `${trade.news.sentiment.toFixed(2)} (${trade.news.count ?? 0} headlines)`
        : "n/a",
    aiSummary: truncate(analysis.summary || trade.rationale || "", 160),
  }

  const advice = await requestAiAdvice(promptTrade)
  return sendJson(res, 200, { ok: true, advice })
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    setCors(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === "POST" && req.url === "/refresh") {
    try {
      await handleRefresh(req, res)
    } catch (err) {
      console.error("Refresh failed", err)
      sendJson(res, 500, { ok: false, error: "Refresh failed." })
    }
    return
  }

  if (req.method === "POST" && req.url === "/advice") {
    try {
      await handleAdvice(req, res)
    } catch (err) {
      console.error("Advice failed", err)
      sendJson(res, 500, { ok: false, error: "Advice failed." })
    }
    return
  }

  sendJson(res, 404, { ok: false, error: "Not found." })
})

server.listen(config.port, () => {
  console.log(`Refresh service listening on ${config.port}`)
})
