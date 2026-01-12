import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import admin from "firebase-admin"

const cwd = process.cwd()
const envPath = path.join(cwd, ".env")

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

async function getIdToken() {
  const envFile = await loadEnvFile(envPath)
  const apiKey = process.env.VITE_FIREBASE_API_KEY || envFile.VITE_FIREBASE_API_KEY
  if (!apiKey) throw new Error("Missing VITE_FIREBASE_API_KEY")

  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(cwd, "relayorb-firebase-service-account.json")
  const raw = await fs.readFile(serviceAccountPath, "utf8")
  const serviceAccount = JSON.parse(raw)

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }

  const email = "relayorb-admin-test@relayorb.local"
  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err
    user = await admin.auth().createUser({ email, emailVerified: true })
  }

  const customToken = await admin.auth().createCustomToken(user.uid)
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Auth exchange failed: ${body || response.status}`)
  }

  const data = await response.json()
  if (!data?.idToken) throw new Error("Missing idToken from Auth response")
  return data.idToken
}

async function main() {
  const envFile = await loadEnvFile(envPath)
  const refreshUrl = process.env.VITE_REFRESH_URL || envFile.VITE_REFRESH_URL
  if (!refreshUrl) throw new Error("Missing VITE_REFRESH_URL")

  const idToken = await getIdToken()
  const streamUrl = `${refreshUrl.replace(/\/+$/, "")}/ops/events?tail=200`

  const response = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  })

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "")
    throw new Error(`SSE request failed: ${response.status} ${body}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const events = []
  let buffer = ""
  const start = Date.now()

  while (events.length < 200 && Date.now() - start < 5000) {
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
        // ignore parse errors
      }
    }
  }

  await reader.cancel()

  const providerCount = events.filter(
    (event) => typeof event.stationId === "string" && event.stationId.startsWith("provider:")
  ).length
  const symbolCount = events.filter((event) => event.symbolKey).length
  const symbolWithBatchCount = events.filter(
    (event) => event.symbolKey && (event.batchId || event?.meta?.runId)
  ).length

  console.log(`SSE events: ${events.length}`)
  console.log(`Provider events: ${providerCount}`)
  console.log(`Symbol events: ${symbolCount}`)
  console.log(`Symbol events with batch: ${symbolWithBatchCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
