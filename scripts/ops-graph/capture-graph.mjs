import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"
import { chromium } from "playwright"

const cwd = process.cwd()
const baseUrl = process.env.RELAYORB_APP_URL || "https://relayorb.web.app"
const targetEmail =
  process.env.RELAYORB_CAPTURE_EMAIL || "relayorb-admin-test@relayorb.local"
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(cwd, "relayorb-firebase-service-account.json")

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

async function loadFirebaseConfig() {
  const envFile = await loadEnvFile(path.join(cwd, ".env"))
  const resolve = (key) => process.env[key] || envFile[key] || ""
  const config = {
    apiKey: resolve("VITE_FIREBASE_API_KEY"),
    authDomain: resolve("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: resolve("VITE_FIREBASE_PROJECT_ID"),
    appId: resolve("VITE_FIREBASE_APP_ID"),
    storageBucket: resolve("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: resolve("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    measurementId: resolve("VITE_FIREBASE_MEASUREMENT_ID"),
  }
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error("Missing Firebase web config (check .env VITE_FIREBASE_* values).")
  }
  return config
}

async function resolveRuntimeConfig() {
  const envFile = await loadEnvFile(path.join(cwd, ".env"))
  const resolve = (key) => process.env[key] || envFile[key] || ""
  return {
    apiKey: resolve("VITE_FIREBASE_API_KEY"),
    refreshUrl: resolve("VITE_REFRESH_URL"),
  }
}

async function ensureUser(email) {
  try {
    return await admin.auth().getUserByEmail(email)
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err
    return admin.auth().createUser({ email, emailVerified: true })
  }
}

function timestampSlug() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, "0")
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("")
}

function resolveBatchId(event) {
  if (event?.batchId) return event.batchId
  const meta = event?.meta
  if (meta && typeof meta === "object" && typeof meta.runId === "string") {
    return meta.runId
  }
  return null
}

async function fetchSymbolBatchId(apiKey, refreshUrl, customToken) {
  if (!apiKey || !refreshUrl) return { batchId: null, symbolCount: 0, symbolBatchCount: 0 }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  if (!response.ok) return { batchId: null, symbolCount: 0, symbolBatchCount: 0 }
  const data = await response.json()
  const idToken = data?.idToken
  if (!idToken) return { batchId: null, symbolCount: 0, symbolBatchCount: 0 }

  const streamUrl = `${refreshUrl.replace(/\/+$/, "")}/ops/events?tail=200`
  const streamRes = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!streamRes.ok || !streamRes.body) return { batchId: null, symbolCount: 0, symbolBatchCount: 0 }

  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const start = Date.now()
  const events = []

  while (events.length < 200 && Date.now() - start < 4000) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() || ""
    for (const part of parts) {
      const lines = part.split("\n")
      let eventName = ""
      const dataLines = []
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.replace("event:", "").trim()
        } else if (line.startsWith("data:")) {
          dataLines.push(line.replace("data:", "").trim())
        }
      }
      if (!dataLines.length || eventName === "ready") continue
      try {
        const payload = JSON.parse(dataLines.join("\n"))
        events.push(payload)
      } catch {
        // ignore
      }
    }
  }

  await reader.cancel().catch(() => {})

  const symbolEvents = events.filter((event) => event?.symbolKey)
  const symbolWithBatch = symbolEvents.filter((event) => resolveBatchId(event))
  const symbolEvent = symbolWithBatch[0] || symbolEvents[0]
  return {
    batchId: symbolEvent ? resolveBatchId(symbolEvent) : null,
    symbolCount: symbolEvents.length,
    symbolBatchCount: symbolWithBatch.length,
  }
}

async function main() {
  const serviceAccountRaw = await fs.readFile(serviceAccountPath, "utf8")
  const serviceAccount = JSON.parse(serviceAccountRaw)
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }

  const firebaseConfig = await loadFirebaseConfig()
  const runtimeConfig = await resolveRuntimeConfig()
  const user = await ensureUser(targetEmail)
  const customToken = await admin.auth().createCustomToken(user.uid)
  const symbolSummary = await fetchSymbolBatchId(
    runtimeConfig.apiKey,
    runtimeConfig.refreshUrl,
    customToken
  )
  const targetBatchId = symbolSummary.batchId

  const outDir = path.join(cwd, "docs/ops-graph")
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1480, height: 900 },
    recordVideo: { dir: outDir, size: { width: 1480, height: 900 } },
  })
  const page = await context.newPage()

  await page.goto(`${baseUrl}/signin`, { waitUntil: "domcontentloaded" })

  await page.evaluate(
    async ({ config, token }) => {
      const { initializeApp } = await import(
        "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js"
      )
      const { getAuth, signInWithCustomToken } = await import(
        "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js"
      )
      const app = initializeApp(config)
      const auth = getAuth(app)
      await signInWithCustomToken(auth, token)
    },
    { config: firebaseConfig, token: customToken }
  )

  await page.waitForTimeout(1500)
  await page.goto(`${baseUrl}/ops/graph`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("text=Dataflow Activity Graph", { timeout: 15000 })

  try {
    await page.waitForSelector("text=Live", { timeout: 15000 })
  } catch {
    // continue; stream may still connect
  }

  try {
    const fitButton = page.locator("button", { hasText: "Fit View" }).first()
    if (await fitButton.count()) {
      await fitButton.click()
      await page.waitForTimeout(600)
    }
  } catch {
    // ignore
  }

  let batchCount = 0
  let symbolCount = 0

  const batchButtons = page.locator("text=Recent Batches").locator("..").locator("button")
  try {
    await batchButtons.first().waitFor({ timeout: 30000 })
    batchCount = await batchButtons.count()
    if (targetBatchId) {
      const targetButton = page.locator("button", { hasText: targetBatchId }).first()
      if (await targetButton.count()) {
        await targetButton.click()
        await page.waitForTimeout(800)
      }
    } else if (batchCount > 0) {
      await batchButtons.first().click()
      await page.waitForTimeout(800)
    }

    const symbolHeader = page.locator("text=Symbols").first()
    if (await symbolHeader.count()) {
      const symbolButtons = symbolHeader.locator("..").locator("button")
      symbolCount = await symbolButtons.count()
      if (symbolCount > 0) {
        await symbolButtons.first().click()
        await page.waitForTimeout(1000)
      }
    }
  } catch {
    // ignore
  }

  const outPath = path.join(outDir, `ops-graph-${timestampSlug()}.png`)
  await page.screenshot({ path: outPath, fullPage: true })

  await page.waitForTimeout(2000)
  await page.close()
  await context.close()
  const videoPath = await page.video()?.path()

  await browser.close()

  let finalVideoPath = null
  if (videoPath) {
    finalVideoPath = path.join(outDir, `ops-graph-${timestampSlug()}.webm`)
    await fs.rename(videoPath, finalVideoPath)
  }

  console.log(`Detected batches: ${batchCount}`)
  console.log(`Detected symbols: ${symbolCount}`)
  if (targetBatchId) {
    console.log(`Target batch: ${targetBatchId}`)
  }
  console.log(`SSE symbol events: ${symbolSummary.symbolCount}`)
  console.log(`SSE symbol events with batch: ${symbolSummary.symbolBatchCount}`)
  console.log(`Screenshot saved to ${outPath}`)
  if (finalVideoPath) {
    console.log(`Recording saved to ${finalVideoPath}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
