const http = require("http")
const admin = require("firebase-admin")
const { GoogleAuth } = require("google-auth-library")
const { createClient } = require("redis")

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
  tavilyKey: process.env.TAVILY_API_KEY || "",
  serpApiKey: process.env.SERP_API_KEY || "",
  redisUrl: process.env.REDIS_URL || "",
  redisPrefix: process.env.REDIS_PREFIX || "relayorb",
  redisEventChannel: process.env.REDIS_EVENT_CHANNEL || "",
  redisEventEnabled: process.env.REDIS_EVENT_ENABLED !== "false",
  redisEventDebounceMs: parseInt(process.env.REDIS_EVENT_DEBOUNCE_MS || "60000", 10),
  redisEventJobs: (process.env.REDIS_EVENT_JOBS || "relayorb-signal-evaluator")
    .split(",")
    .map((job) => job.trim())
    .filter(Boolean),
  batchCollection: process.env.BATCH_COLLECTION || "batches",
  batchConsumerId: process.env.BATCH_CONSUMER_ID || "refresh-service",
  batchPollEnabled: process.env.BATCH_POLL_ENABLED !== "false",
  batchPollIntervalMs: parseInt(process.env.BATCH_POLL_INTERVAL_MS || "60000", 10),
  batchPollLimit: parseInt(process.env.BATCH_POLL_LIMIT || "3", 10),
  marketIntelJob: process.env.MARKET_INTEL_JOB || "relayorb-market-intel",
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

function readHeader(req, name) {
  const key = String(name || "").toLowerCase()
  if (!key) return ""
  return String(req.headers[key] || "").trim()
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function resolveEventChannel() {
  if (config.redisEventChannel) return config.redisEventChannel
  const prefix = config.redisPrefix ? `${config.redisPrefix}:` : ""
  return `${prefix}events`
}

function resolveBatchCollection() {
  return db.collection(config.batchCollection)
}

function resolveBatchConsumerDoc() {
  return db.collection("batch_consumers").doc(config.batchConsumerId)
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === "function") return value.toDate()
  return null
}

async function readBatchConsumerState() {
  try {
    const snap = await resolveBatchConsumerDoc().get()
    if (!snap.exists) return null
    const data = snap.data() || {}
    return {
      lastBatchId: data.lastBatchId || null,
      lastProcessedAt: toDate(data.lastProcessedAt),
    }
  } catch (err) {
    console.error("Batch consumer read failed", err.message || err)
    return null
  }
}

async function updateBatchConsumerState(batchId) {
  if (!batchId) return
  try {
    await resolveBatchConsumerDoc().set(
      {
        lastBatchId: batchId,
        lastProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    console.log("ref_cursor_advance", { batchId })
  } catch (err) {
    console.error("Batch consumer update failed", err.message || err)
  }
}

async function fetchPendingBatches(lastProcessedAt) {
  try {
    let query = resolveBatchCollection()
    if (lastProcessedAt) {
      query = query
        .where("createdAt", ">", lastProcessedAt)
        .orderBy("createdAt", "asc")
        .limit(config.batchPollLimit)
    } else {
      query = query.orderBy("createdAt", "desc").limit(1)
    }
    const snap = await query.get()
    if (snap.empty) return []
    const docs = snap.docs.map((doc) => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        runId: data.runId || data.meta?.runId || null,
        createdAt: toDate(data.createdAt),
      }
    })
    if (!lastProcessedAt) return docs.reverse()
    return docs
  } catch (err) {
    console.error("Batch lookup failed", err.message || err)
    return []
  }
}

async function runJobsForBatch(batchId, runId) {
  const jobs = config.redisEventJobs.length ? config.redisEventJobs : config.jobs
  const overrides = runId ? { env: { RUN_ID: runId } } : undefined
  await Promise.all(jobs.map((job) => runJob(job, overrides)))
  await updateBatchConsumerState(batchId)
}

let batchPollInFlight = false
async function pollForBatches() {
  if (batchPollInFlight) return
  batchPollInFlight = true
  try {
    const state = await readBatchConsumerState()
    const pending = await fetchPendingBatches(state?.lastProcessedAt || null)
    for (const batch of pending) {
      if (!batch?.id) continue
      if (batch.id === state?.lastBatchId) continue
      console.log("ref_poll_missed_batches", {
        batchId: batch.id,
        runId: batch.runId || null,
      })
      await runJobsForBatch(batch.id, batch.runId)
    }
  } catch (err) {
    console.error("Batch poll failed", err.message || err)
  } finally {
    batchPollInFlight = false
  }
}

function startBatchPoller() {
  if (!config.batchPollEnabled) return
  pollForBatches().catch(() => {})
  setInterval(() => {
    pollForBatches().catch(() => {})
  }, config.batchPollIntervalMs)
}

async function startRedisEventListener() {
  if (!config.redisUrl || !config.redisEventEnabled) return null
  const client = createClient({ url: config.redisUrl })
  client.on("error", (err) => {
    const message = err?.message ? String(err.message) : "Unknown error"
    console.error("Redis error:", message)
  })

  try {
    await client.connect()
  } catch (err) {
    console.error("Redis connection failed:", err.message)
    return null
  }

  const subscriber = client.duplicate()
  await subscriber.connect()
  const channel = resolveEventChannel()
  let lastEventAt = 0
  let lastBatchId = null

  await subscriber.subscribe(channel, async (message) => {
    let payload
    try {
      payload = JSON.parse(message)
    } catch {
      return
    }
    if (payload?.type !== "new_batch") return
    const batchId = payload.batchId || payload.runId || null
    const runId = payload.runId || null
    const now = Date.now()
    if (batchId && batchId === lastBatchId) return
    if (now - lastEventAt < config.redisEventDebounceMs) return
    lastBatchId = batchId
    lastEventAt = now

    try {
      const jobs = config.redisEventJobs.length ? config.redisEventJobs : config.jobs
      console.log("ref_new_batch_received", { batchId, runId })
      const overrides = runId ? { env: { RUN_ID: runId } } : undefined
      await Promise.all(jobs.map((job) => runJob(job, overrides)))
      if (batchId) {
        await updateBatchConsumerState(batchId)
      }
      console.log("ref_trigger_se", { jobs, batchId, runId })
    } catch (err) {
      console.error("Redis event job trigger failed", err.message || err)
    }
  })

  console.log("Redis event listener active", { channel })
  return { client, subscriber }
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

function resolveRunId(req, body) {
  return (
    readHeader(req, "x-run-id") ||
    body?.runId ||
    body?.run_id ||
    ""
  )
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

async function runJob(jobName, overrides = {}) {
  const client = await auth.getClient()
  const url = `https://run.googleapis.com/v2/projects/${config.projectId}/locations/${config.region}/jobs/${jobName}:run`
  const envOverrides = overrides?.env || {}
  const overrideEntries = Object.entries(envOverrides).filter(([, value]) => value !== undefined)
  const payload =
    overrideEntries.length > 0
      ? {
        overrides: {
          containerOverrides: [
            {
              env: overrideEntries.map(([name, value]) => ({
                name,
                value: String(value),
              })),
            },
          ],
        },
      }
      : undefined
  const res = await client.request({
    url,
    method: "POST",
    data: payload,
  })
  return res.data
}

async function handleRefresh(req, res) {
  const authResult = await verifyRequest(req)
  if (!authResult.allowed) {
    return sendJson(res, 403, { ok: false, error: authResult.error })
  }

  const body = await readBody(req)
  const runId = resolveRunId(req, body)
  const requestedJobs = Array.isArray(body?.jobs)
    ? body.jobs.map((job) => String(job).trim()).filter(Boolean)
    : []
  const jobList = requestedJobs.length > 0 ? requestedJobs : config.jobs

  const overrides = runId ? { env: { RUN_ID: runId } } : undefined
  const results = await Promise.allSettled(
    jobList.map((job) => runJob(job, overrides))
  )
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
        runId: runId || null,
        jobs,
      },
      { merge: true }
    )

  console.log("ref_refresh", { requestId, runId: runId || null, jobs })
  return sendJson(res, 200, { ok: true, requestId, jobs })
}

async function handleScanOnce(req, res) {
  const authResult = await verifyRequest(req)
  if (!authResult.allowed) {
    return sendJson(res, 403, { ok: false, error: authResult.error })
  }

  const body = await readBody(req)
  const runId = resolveRunId(req, body)
  if (!runId) {
    return sendJson(res, 400, { ok: false, error: "Missing runId." })
  }

  const jobName = String(body?.job || config.marketIntelJob).trim()
  const redisPrefix = readHeader(req, "x-redis-prefix") || body?.redisPrefix || ""
  const overrides = {
    env: compactObject({
      RUN_ID: runId,
      REDIS_PREFIX: redisPrefix || undefined,
      FIRESTORE_RUN_FIELD: body?.firestoreRunField,
      BATCH_COLLECTION: body?.batchCollection,
    }),
  }

  const result = await runJob(jobName, overrides)
  console.log("ref_scan_once", {
    runId,
    job: jobName,
    execution: result?.name || null,
  })

  return sendJson(res, 200, {
    ok: true,
    runId,
    batchId: runId,
    job: jobName,
    execution: result?.name || null,
  })
}

function normalizeAction(value) {
  const action = String(value || "").toLowerCase()
  if (action === "buy" || action === "sell" || action === "hold") return action
  return "hold"
}

/**
 * Web search function that the AI can call
 * Uses Tavily API (AI-focused search) or SerpAPI as fallback
 */
async function searchWeb(query) {
  // Try Tavily first (designed for AI, better results)
  if (config.tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: config.tavilyKey,
          query,
          search_depth: "basic",
          max_results: 5,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.results?.map(result => ({
          title: result.title,
          content: result.content,
          url: result.url,
        })) || []
      }
    } catch (err) {
      console.error("Tavily search failed:", err.message)
    }
  }
  
  // Fallback to SerpAPI
  if (config.serpApiKey) {
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${config.serpApiKey}&num=5`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const results = data.organic_results || []
        return results.map(item => ({
          title: item.title,
          content: item.snippet || "",
          url: item.link,
        }))
      }
    } catch (err) {
      console.error("SerpAPI search failed:", err.message)
    }
  }
  
  return []
}

async function requestAiAdvice(trade) {
  if (!config.openaiKey) {
    throw new Error("OPENAI_API_KEY not configured.")
  }

  // Extract momentum data for better context
  const momentum1h = trade.momentum?.change1h
  const momentum24h = trade.momentum?.change24h
  const momentum7d = trade.momentum?.change7d
  
  // Calculate volatility estimate from momentum ranges
  const volatility = momentum1h !== undefined && momentum24h !== undefined
    ? Math.abs(momentum24h - (momentum1h || 0))
    : null

  // Build search query for the asset
  const searchQuery = trade.assetClass === "stock"
    ? `${trade.symbol} stock news today price analysis`
    : trade.assetClass === "crypto"
    ? `${trade.symbol} cryptocurrency news today price analysis`
    : `${trade.symbol} forex news today analysis`

  // Define web search function for the AI
  const webSearchFunction = {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for recent news, analysis, and information about a trading symbol. Use this to find breaking news, earnings reports, technical analysis, or market sentiment that could affect the trade.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query about the asset (e.g., 'AAPL stock news today', 'BTC cryptocurrency analysis')",
          },
        },
        required: ["query"],
      },
    },
  }

  const payload = {
    model: config.openaiModel,
    temperature: 0.2,
    max_tokens: 600, // Increased to allow more detailed reasoning with web search results
    tools: [webSearchFunction],
    tool_choice: "auto", // Let AI decide, but instructions strongly encourage search
    messages: [
      {
        role: "system",
        content:
          "You are a trading dashboard assistant. Analyze all provided data AND search the web for recent news and information about the asset to make accurate recommendations. Use the search_web function to find breaking news, earnings, technical analysis, or market events that could affect the trade. Return JSON only, no markdown.",
      },
      {
        role: "user",
        content: [
          "Given the trade context, FIRST search the web for recent information about this asset, THEN analyze ALL data and return JSON:",
          '{"action":"buy|hold|sell","holdMinutes":number,"stopLossPct":0.5-8,"takeProfitPct":1-15,"summary":"simple sentence","reasoning":"short reason"}',
          "",
          "IMPORTANT: You MUST use the search_web function to find recent news, earnings reports, technical analysis, or market events about this asset before making your recommendation. The search is required.",
          "",
          "After searching, in your reasoning field, explicitly mention:",
          "- What news or information you found in the web search",
          "- How it affects the trade recommendation",
          "- Any breaking news, earnings, or events that impact the decision",
          "",
          "Calculate holdMinutes (15-1440 minutes) based on:",
          `- Trend horizon: ${trade.trendHorizon || 'n/a'} (15m=15min, 1h=60min, 24h=1440min, 7d=10080min)`,
          "- Momentum speed: Fast moves (high 1h change) = shorter holds, slow trends = longer holds",
          "- Asset class: Crypto moves faster (15-120min), Stocks slower (60-480min), Forex varies",
          "- Signal strength: Strong signals = shorter holds (capture move quickly), weak = longer",
          "- Volatility: High volatility = shorter holds, low = longer",
          "- Recent news/events: Breaking news or events may require immediate action or longer holds",
          "",
          "Rules:",
          "- Use 'hold' if signals are mixed or weak.",
          "- stopLossPct and takeProfitPct are percentages; use null if action is hold.",
          "- holdMinutes should reflect when the trade thesis expires or target should be reached",
          "- For crypto scalps: 15-60min, for swing trades: 240-1440min",
          "- Consider recent news: breaking news may require shorter holds, earnings may require longer",
          "- In your reasoning, explicitly mention what you found in the web search and how it affects your recommendation",
          "- Keep the summary short and plain English.",
          "- Make the reasoning detailed (up to 300 characters) - include web search findings.",
          "",
          `Symbol: ${trade.symbol}`,
          `Asset class: ${trade.assetClass}`,
          `Side hint: ${trade.side || "n/a"}`,
          `Score: ${trade.score ?? "n/a"} / 100`,
          `Current price: ${trade.price ?? "n/a"}`,
          `Trend score: ${trade.trendScore ?? "n/a"} (higher = stronger trend)`,
          `Trend horizon: ${trade.trendHorizon || "n/a"} (timeframe of the trend signal)`,
          `Momentum 1h: ${momentum1h !== undefined ? momentum1h.toFixed(2) + '%' : 'n/a'}`,
          `Momentum 24h: ${momentum24h !== undefined ? momentum24h.toFixed(2) + '%' : 'n/a'}`,
          `Momentum 7d: ${momentum7d !== undefined ? momentum7d.toFixed(2) + '%' : 'n/a'}`,
          `Volatility estimate: ${volatility !== null ? volatility.toFixed(2) + '%' : 'n/a'}`,
          `Bots: ${trade.botsSummary}`,
          `Sentiment: ${trade.sentimentSummary}`,
          `AI summary: ${trade.aiSummary}`,
          "",
          "Now search the web for recent information about this asset, then provide your recommendation.",
        ].join("\n"),
      },
    ],
  }

  // Handle function calling loop for web search
  let messages = payload.messages
  let maxIterations = 3
  let iteration = 0
  let parsed = null
  
  while (iteration < maxIterations) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({ ...payload, messages }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OpenAI error: ${body.slice(0, 160)}`)
    }

    const data = await res.json()
    const message = data?.choices?.[0]?.message
    
    if (!message) {
      throw new Error("No message in OpenAI response")
    }
    
    // Add AI's response to conversation
    messages.push(message)
    
    // Check if AI wants to call a function
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Execute function calls
      const toolResults = []
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === "search_web") {
          try {
            const args = JSON.parse(toolCall.function.arguments || "{}")
            const searchResults = await searchWeb(args.query || searchQuery)
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: "search_web",
              content: JSON.stringify({
                query: args.query || searchQuery,
                results: searchResults.map(r => ({
                  title: r.title,
                  content: r.content,
                  url: r.url,
                })),
              }),
            })
          } catch (searchErr) {
            console.error("Web search error:", searchErr)
            // Return empty results if search fails
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: "search_web",
              content: JSON.stringify({
                query: toolCall.function.arguments || searchQuery,
                results: [],
                error: "Web search temporarily unavailable",
              }),
            })
          }
        }
      }
      
      // Add function results to conversation
      messages.push(...toolResults)
      iteration++
      continue
    }
    
    // AI returned final response
    const content = message.content || ""
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error("AI response not parsable.")
    }
    parsed = JSON.parse(match[0])
    break
  }
  
  if (!parsed) {
    throw new Error("AI did not return a valid response after function calls.")
  }
  const action = normalizeAction(parsed.action)
  
  // Validate and clamp holdMinutes from AI
  const aiHoldMinutes = parseNumber(parsed.holdMinutes)
  const holdMinutes = aiHoldMinutes 
    ? clamp(aiHoldMinutes, 15, 1440) // 15 minutes to 24 hours max
    : (trade.trendHorizon 
        ? (trade.trendHorizon === "15m" ? 15 : 
           trade.trendHorizon === "1h" ? 60 : 
           trade.trendHorizon === "24h" ? 1440 : 
           trade.trendHorizon === "7d" ? 1440 : 60) // Use trend horizon as fallback
        : 60) // Default fallback
  
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
    reasoning: truncate(parsed.reasoning, 400), // Increased to show web search results
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

  if (req.method === "GET" && req.url === "/readyz") {
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

  if (req.method === "POST" && req.url === "/admin/scanOnce") {
    try {
      await handleScanOnce(req, res)
    } catch (err) {
      console.error("ScanOnce failed", err)
      sendJson(res, 500, { ok: false, error: "ScanOnce failed." })
    }
    return
  }

  if (req.method === "POST" && req.url === "/advice") {
    try {
      await handleAdvice(req, res)
    } catch (err) {
      console.error("Advice failed", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { ok: false, error: `Advice failed: ${errorMessage}` })
    }
    return
  }

  sendJson(res, 404, { ok: false, error: "Not found." })
})

server.listen(config.port, () => {
  console.log(`Refresh service listening on ${config.port}`)
})

startBatchPoller()

startRedisEventListener().catch((err) => {
  console.error("Redis listener failed", err.message || err)
})
