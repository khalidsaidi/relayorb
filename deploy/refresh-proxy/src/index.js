const { onRequest } = require("firebase-functions/v2/https")
const { GoogleAuth } = require("google-auth-library")

const EXPECTED_REGION = "us-west1"
const DEFAULT_SERVICE_NAME = "relayorb-refresh"
const DEFAULT_REGION = "us-west1"

const REFRESH_SERVICE_URL = process.env.REFRESH_SERVICE_URL || ""
const REFRESH_SERVICE_NAME = process.env.REFRESH_SERVICE_NAME || DEFAULT_SERVICE_NAME
const REFRESH_SERVICE_REGION = process.env.REFRESH_SERVICE_REGION || DEFAULT_REGION
const REFRESH_SERVICE_AUDIENCE = process.env.REFRESH_SERVICE_AUDIENCE || ""

const auth = new GoogleAuth()
let idTokenClient = null
let refreshBaseCache = ""
let refreshAudienceCache = ""

function normalizeProxyPath(value) {
  if (!value) return ""
  if (!value.startsWith("/proxy")) return value
  let url = value.replace(/^\/proxy(?=\/|$)/, "")
  if (!url) url = "/"
  if (url.startsWith("?")) url = `/${url}`
  return url
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
  const userToken = req.headers.authorization || ""
  if (userToken) headers["x-relayorb-user-token"] = userToken
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
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*")
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    res.status(204).send("")
    return
  }

  try {
    await proxyRequest(req, res)
  } catch (err) {
    console.error("refreshProxy failed", err)
    res.status(502).json({ ok: false, error: "Proxy failed." })
  }
})
