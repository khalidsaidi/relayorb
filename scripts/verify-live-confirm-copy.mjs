import { spawn } from "node:child_process"
import process from "node:process"
import admin from "firebase-admin"
import fs from "node:fs"
import { chromium } from "playwright"

const BASE_URL = process.env.UI_BASE_URL || "http://127.0.0.1:5200"
const SERVER_READY_TIMEOUT_MS = 30_000
const ACCOUNT = { key: "acct1", uid: "enEopK5vNkMWZrXJAllC9bX4cgu1" }

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isServerReady(url) {
  try {
    const res = await fetch(url, { method: "GET" })
    return res.ok
  } catch {
    return false
  }
}

async function ensureDevServer() {
  if (await isServerReady(BASE_URL)) {
    return { proc: null }
  }
  const proc = spawn(
    "npm",
    ["run", "dev", "--", "--host", "0.0.0.0", "--port", "5200", "--strictPort"],
    { stdio: "inherit", env: process.env }
  )
  const startedAt = Date.now()
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (await isServerReady(BASE_URL)) {
      return { proc }
    }
    await wait(500)
  }
  throw new Error("Dev server did not start in time.")
}

async function ensureAdmin() {
  if (admin.apps.length) return
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "relayorb-firebase-service-account.json"
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Missing service account: ${serviceAccountPath}`)
  }
  const raw = fs.readFileSync(serviceAccountPath, "utf8")
  const serviceAccount = JSON.parse(raw)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

async function ensureUser(uid) {
  try {
    await admin.auth().getUser(uid)
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err
    await admin.auth().createUser({ uid })
  }
}

async function signInWithToken(page, token) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" })
  await page.evaluate(async (customToken) => {
    const { auth } = await import("/src/lib/firebase")
    let authModule
    try {
      authModule = await import("firebase/auth")
    } catch {
      authModule = await import("/@id/firebase/auth")
    }
    await authModule.signInWithCustomToken(auth, customToken)
  }, token)
  await page.waitForFunction(() => window.location.pathname !== "/signin", null, {
    timeout: 15000,
  })
}

async function main() {
  await ensureAdmin()
  await ensureUser(ACCOUNT.uid)
  const { proc } = await ensureDevServer()
  const browser = await chromium.launch({ headless: true })

  try {
    const token = await admin.auth().createCustomToken(ACCOUNT.uid)
    const context = await browser.newContext()
    const page = await context.newPage()
    await signInWithToken(page, token)
    await page.goto(`${BASE_URL}/ibkr`, { waitUntil: "domcontentloaded" })

    const directTranslation = await page.evaluate(async () => {
      const mod = await import("/src/i18n")
      const i18n = mod.default
      return {
        lang: i18n.language,
        title: i18n.t("ibkr.mode.liveConfirmTitle"),
        body: i18n.t("ibkr.mode.liveConfirmBody"),
        cancel: i18n.t("ibkr.mode.liveCancel"),
        confirm: i18n.t("ibkr.mode.liveConfirm"),
      }
    })
    console.log("i18n.t results:", JSON.stringify(directTranslation, null, 2))

    const liveTab = page.getByRole("tab", { name: "Live" })
    await liveTab.waitFor({ state: "visible" })
    const liveHandle = await liveTab.elementHandle()
    if (liveHandle) {
      await page.waitForFunction((el) => !el.hasAttribute("disabled"), liveHandle, {
        timeout: 15000,
      }).catch(() => {})
    }
    const disabled = await liveTab.getAttribute("disabled")
    if (disabled !== null) {
      console.log("Live tab is disabled; cannot open confirmation dialog.")
      return
    }

    await liveTab.click()
    const dialog = page.getByRole("dialog")
    await dialog.waitFor({ state: "visible" })

    const title = await dialog.getByRole("heading").first().innerText()
    const body = await dialog.locator("[data-slot='dialog-description']").innerText()
    const cancel = await dialog.getByRole("button").first().innerText()
    const confirm = await dialog.getByRole("button").last().innerText()

    console.log(JSON.stringify({ title, body, cancel, confirm }, null, 2))
    await context.close()
  } finally {
    await browser.close()
    if (proc) {
      proc.kill("SIGTERM")
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
