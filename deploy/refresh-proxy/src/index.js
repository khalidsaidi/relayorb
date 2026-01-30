const { onRequest } = require("firebase-functions/v2/https")
const { GoogleAuth } = require("google-auth-library")
const admin = require("firebase-admin")

const EXPECTED_REGION = "us-west1"
const DEFAULT_SERVICE_NAME = "relayorb-refresh"
const DEFAULT_REGION = "us-west1"

const REFRESH_SERVICE_URL = process.env.REFRESH_SERVICE_URL || ""
const REFRESH_SERVICE_NAME = process.env.REFRESH_SERVICE_NAME || DEFAULT_SERVICE_NAME
const REFRESH_SERVICE_REGION = process.env.REFRESH_SERVICE_REGION || DEFAULT_REGION
const REFRESH_SERVICE_AUDIENCE = process.env.REFRESH_SERVICE_AUDIENCE || ""
const CORS_ORIGINS =
  process.env.REFRESH_PROXY_CORS_ORIGINS ||
  process.env.CORS_ORIGINS ||
  process.env.REFRESH_PROXY_CORS_ORIGIN ||
  "*"
const RATE_LIMIT_ENABLED = process.env.REFRESH_PROXY_RATE_LIMIT_ENABLED !== "false"
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.REFRESH_PROXY_RATE_LIMIT_WINDOW_MS || "60000",
  10
)
const RATE_LIMIT_MAX = parseInt(process.env.REFRESH_PROXY_RATE_LIMIT_MAX || "120", 10)

const auth = new GoogleAuth()
let idTokenClient = null
let refreshBaseCache = ""
let refreshAudienceCache = ""

if (!admin.apps.length) {
  admin.initializeApp()
}

function normalizeProxyPath(value) {
  if (!value) return ""
  if (!value.startsWith("/proxy")) return value
  let url = value.replace(/^\/proxy(?=\/|$)/, "")
  if (!url) url = "/"
  if (url.startsWith("?")) url = `/${url}`
  return url
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

const resolvedCorsOrigins = parseCorsOrigins(CORS_ORIGINS)
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

function applyCors(res, req) {
  const origin = resolveCorsOrigin(req)
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
  return { allowed: isCorsAllowed(req) }
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
  if (!RATE_LIMIT_ENABLED) return { allowed: true }
  const now = Date.now()
  const windowMs = Math.max(RATE_LIMIT_WINDOW_MS || 0, 1000)
  const max = Math.max(RATE_LIMIT_MAX || 0, 1)
  const key = resolveClientIp(req) || "unknown"
  const entry = rateLimitState.get(key) || { count: 0, resetAt: now + windowMs }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }
  entry.count += 1
  rateLimitState.set(key, entry)
  return { allowed: entry.count <= max }
}

function parseUserToken(req) {
  const header =
    req.headers["x-relayorb-user-token"] ||
    req.headers["x-user-token"] ||
    req.headers.authorization ||
    ""
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

async function verifyUser(req) {
  const token = parseUserToken(req)
  if (!token) return { allowed: false, status: 401, error: "Auth required." }
  try {
    await admin.auth().verifyIdToken(token)
    return { allowed: true }
  } catch (err) {
    return { allowed: false, status: 401, error: "Invalid auth token." }
  }
}

async function fetchMetadata(path) {
  const res = await fetch(`http://metadata.google.internal/computeMetadata/v1/${path}`, {
    headers: { "Metadata-Flavor": "Google" },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Metadata fetch failed ${res.status}: ${body.slice(0, 160)}`)
  }
  return res.text()
}

async function resolveRefreshBase() {
  if (REFRESH_SERVICE_URL) return REFRESH_SERVICE_URL.replace(/\/+$/, "")
  if (refreshBaseCache) return refreshBaseCache
  const projectNumber = await fetchMetadata("project/numeric-project-id")
  const base = `https://${REFRESH_SERVICE_NAME}-${projectNumber}.${REFRESH_SERVICE_REGION}.run.app`
  refreshBaseCache = base
  return base
}

async function resolveRefreshAudience() {
  if (REFRESH_SERVICE_AUDIENCE) return REFRESH_SERVICE_AUDIENCE.replace(/\/+$/, "")
  if (refreshAudienceCache) return refreshAudienceCache
  const base = await resolveRefreshBase()
  refreshAudienceCache = base.replace(/\/+$/, "")
  return refreshAudienceCache
}

async function getIdTokenClient() {
  if (idTokenClient) return idTokenClient
  const audience = await resolveRefreshAudience()
  idTokenClient = await auth.getIdTokenClient(audience)
  return idTokenClient
}

function buildTargetUrl(base, req) {
  const normalized = normalizeProxyPath(req.originalUrl || req.url || "")
  const url = new URL(normalized || "/", base.endsWith("/") ? base : `${base}/`)
  return url.toString()
}

function buildForwardHeaders(req) {
  const headers = {}
  const contentType = req.headers["content-type"]
  if (contentType) headers["Content-Type"] = String(contentType)
  const accept = req.headers.accept
  if (accept) headers["Accept"] = String(accept)
  const userToken =
    req.headers["x-relayorb-user-token"] ||
    req.headers["x-user-token"] ||
    req.headers.authorization ||
    ""
  if (userToken) headers["x-relayorb-user-token"] = String(userToken)
  return headers
}

async function proxyRequest(req, res) {
  const base = await resolveRefreshBase()
  const targetUrl = buildTargetUrl(base, req)
  const client = await getIdTokenClient()
  const method = req.method || "GET"
  const headers = buildForwardHeaders(req)

  const data =
    method === "GET" || method === "HEAD"
      ? undefined
      : req.rawBody && req.rawBody.length > 0
      ? req.rawBody
      : undefined

  const response = await client.request({
    url: targetUrl,
    method,
    headers,
    data,
    responseType: "arraybuffer",
    validateStatus: () => true,
  })

  const contentType = response.headers?.["content-type"]
  if (contentType) res.setHeader("Content-Type", contentType)
  res.status(response.status || 500)
  res.send(Buffer.from(response.data || ""))
}

exports.refreshProxy = onRequest({ region: EXPECTED_REGION }, async (req, res) => {
  const cors = applyCors(res, req)
  if (req.method === "OPTIONS") {
    res.status(cors.allowed ? 204 : 403).send("")
    return
  }
  const rate = checkRateLimit(req)
  if (!rate.allowed) {
    res.status(429).json({ ok: false, error: "Rate limit exceeded." })
    return
  }
  const authResult = await verifyUser(req)
  if (!authResult.allowed) {
    res.status(authResult.status || 401).json({ ok: false, error: authResult.error })
    return
  }

  try {
    await proxyRequest(req, res)
  } catch (err) {
    console.error("refreshProxy failed", err)
    res.status(502).json({ ok: false, error: "Proxy failed." })
  }
})
