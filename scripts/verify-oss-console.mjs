#!/usr/bin/env node
/**
 * Verify RelayOrb OSS console end-to-end in a real browser session.
 *
 * This script:
 * 1) Mints a Firebase Auth custom token for an allowlisted user (via firebase-admin).
 * 2) Uses Playwright to sign in on the target base URL without Google OAuth UI.
 * 3) Clicks through Trader/OpenBB/Finnews/StockPulse and asserts key requests succeed.
 *
 * Usage:
 *   node scripts/verify-oss-console.mjs --base https://relayorb.web.app --email khalidsaidi66@gmail.com
 *
 * Env:
 *   FIREBASE_ADMIN_KEY_PATH  (defaults to .secrets/relayorb-firebase-adminsdk-fbsvc-ca34fed738.json)
 */

import fs from "fs"
import path from "path"
import process from "process"
import admin from "firebase-admin"
import { chromium } from "playwright"

const BAD_CONSOLE_PATTERNS = [
  { re: /width\(-1\).*height\(-1\).*chart/i, label: "Recharts invalid size" },
  { re: /change in the order of Hooks/i, label: "React hooks order violation" },
  { re: /Should have a queue/i, label: "React invalid hook call" },
  { re: /auth\/unauthorized-domain/i, label: "Firebase unauthorized domain" },
]

function parseArgs(argv) {
  const out = { base: "https://relayorb.web.app", email: "" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--base") out.base = String(argv[++i] || "")
    else if (a === "--email") out.email = String(argv[++i] || "")
  }
  return out
}

function loadDotEnv(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  const raw = fs.readFileSync(filePath, "utf8")
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) return
    const idx = trimmed.indexOf("=")
    if (idx < 0) return
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  })
  return out
}

function normalizeBaseUrl(base) {
  const trimmed = String(base || "").trim().replace(/\/+$/, "")
  if (!trimmed) throw new Error("Missing --base")
  return trimmed
}

async function mintCustomToken({ serviceAccountPath, email }) {
  const json = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))
  const app = admin.initializeApp({ credential: admin.credential.cert(json) }, "verify-oss-console")
  try {
    const user = await app.auth().getUserByEmail(email)
    return await app.auth().createCustomToken(user.uid)
  } finally {
    await app.delete().catch(() => {})
  }
}

async function signInWithCustomTokenCompat({ page, baseUrl, firebaseConfig, customToken }) {
  await page.goto(`${baseUrl}/signin`, { waitUntil: "domcontentloaded" })

  // Load compat SDK onto the page (no CSP on Firebase Hosting by default).
  await page.addScriptTag({
    url: "https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js",
  })
  await page.addScriptTag({
    url: "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth-compat.js",
  })

  await page.evaluate(
    async ({ token, config }) => {
      // @ts-ignore
      if (!window.firebase) throw new Error("firebase compat not loaded")
      // @ts-ignore
      const firebase = window.firebase
      try {
        // @ts-ignore
        if (!firebase.apps?.length) firebase.initializeApp(config)
      } catch (e) {
        // ignore duplicate init
      }
      // @ts-ignore
      const auth = firebase.auth()
      // @ts-ignore
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      // @ts-ignore
      await auth.signInWithCustomToken(token)
    },
    { token: customToken, config: firebaseConfig }
  )

  // Reload so the app's modular SDK reads the persisted user and <RequireAuth/> passes deterministically.
  await page.goto(`${baseUrl}/trader`, { waitUntil: "networkidle" })
}

function mustEnv(obj, key) {
  const v = (obj[key] || "").trim()
  if (!v) throw new Error(`Missing ${key} (needed for verification)`)
  return v
}

function formatBodySnippet(text) {
  const raw = String(text || "")
  return raw.replace(/\s+/g, " ").trim().slice(0, 280)
}

async function waitResponse(page, urlIncludes, label, timeoutMs = 45000) {
  const res = await page.waitForResponse((r) => r.url().includes(urlIncludes), {
    timeout: timeoutMs,
  })
  if (!res) throw new Error(`${label} did not return a response: ${urlIncludes}`)
  return res
}

async function wait2xx(page, urlIncludes, label, timeoutMs = 45000) {
  const res = await waitResponse(page, urlIncludes, label, timeoutMs)
  const status = res.status()
  if (status < 200 || status >= 300) {
    let body = ""
    try {
      body = await res.text()
    } catch {
      // ignore
    }
    throw new Error(`${label} returned ${status}: ${urlIncludes} ${formatBodySnippet(body)}`)
  }
}

async function wait2xxOrAlready(page, urlIncludes, label, timeoutMs = 45000) {
  const res = await waitResponse(page, urlIncludes, label, timeoutMs)
  const status = res.status()
  if (status >= 200 && status < 300) return
  if (status === 409) return
  if (status === 400) {
    let body = ""
    try {
      body = await res.text()
    } catch {
      body = ""
    }
    const lower = body.toLowerCase()
    if (lower.includes("already") || lower.includes("exists")) return
  }
  let body = ""
  try {
    body = await res.text()
  } catch {
    // ignore
  }
  throw new Error(`${label} returned ${status}: ${urlIncludes} ${formatBodySnippet(body)}`)
}

async function allOrThrow(label, promises) {
  const results = await Promise.allSettled(promises)
  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => {
      const reason = r.reason
      return reason instanceof Error ? reason.message : String(reason)
    })
  if (errors.length) {
    throw new Error(`${label} failed:\n- ${errors.join("\n- ")}`)
  }
}

async function verifyTrader(page, baseUrl) {
  await page.goto(`${baseUrl}/trader`, { waitUntil: "domcontentloaded" })

  // Make the run deterministic and ensure the watchlist sync path is actually exercised.
  await page.evaluate(() => {
    try {
      localStorage.removeItem("openbb_watchlist")
    } catch {
      // ignore
    }
  })
  await page.getByPlaceholder("AAPL MSFT NVDA").fill("BBAI TSLA")

  // Start response waits before clicking to avoid races on fast endpoints.
  const w1 = wait2xx(page, "/openbb/api/v1/equity/price/quote", "OpenBB quote (Trader)")
  const w2 = wait2xx(page, "/stockpulse/api/ai/rating/", "StockPulse rating (Trader)")
  const w3 = wait2xx(page, "/finnews/api/v1/news/latest", "Finnews latest (Trader)")
  const w4 = wait2xxOrAlready(page, "/stockpulse/api/stocks", "StockPulse watchlist sync (Trader)")
  const w5 = wait2xx(page, "targeted-crawl", "Finnews targeted crawl (Trader)")

  await page.getByRole("button", { name: /Run lookup/i }).click()
  await allOrThrow("Trader", [w1, w2, w3, w4, w5])

  const watch = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("openbb_watchlist") || "[]")
    } catch {
      return []
    }
  })
  if (!Array.isArray(watch) || !watch.includes("BBAI") || !watch.includes("TSLA")) {
    throw new Error(`Trader did not persist OpenBB watchlist (expected BBAI+TSLA). Got: ${JSON.stringify(watch).slice(0, 120)}`)
  }
}

async function verifyOpenbbWatchlist(page, baseUrl) {
  await page.goto(`${baseUrl}/openbb?tab=watchlist`, { waitUntil: "domcontentloaded" })
  await page.getByRole("tab", { name: /Watchlist/i }).click()

  // The watchlist list is client-side (localStorage). It must show the tickers from Trader sync.
  await page.locator("span").filter({ hasText: /\bBBAI\b/ }).first().waitFor({ timeout: 20000 })
  await page.locator("span").filter({ hasText: /\bTSLA\b/ }).first().waitFor({ timeout: 20000 })
}

async function verifyOpenbb(page, baseUrl) {
  const w1 = wait2xx(page, "/openbb/api/v1/equity/price/quote", "OpenBB quote (OpenBB)")
  const w2 = wait2xx(page, "/openbb/api/v1/equity/price/historical", "OpenBB historical (OpenBB)")

  await page.goto(`${baseUrl}/openbb?symbols=AAPL,MSFT`, { waitUntil: "domcontentloaded" })

  // Quick lookup run should fetch quote + candles.
  await page.getByRole("button", { name: /Run lookup/i }).click()
  await allOrThrow("OpenBB", [w1, w2])
}

async function verifyFinnews(page, baseUrl) {
  const w1 = wait2xx(page, "/finnews/api/v1/news/latest", "Finnews latest (Finnews)")
  const w2 = wait2xx(page, "/sec-cik-map.v1.json", "SEC CIK map asset")
  await page.goto(`${baseUrl}/finnews?q=Tesla`, { waitUntil: "domcontentloaded" })
  await allOrThrow("Finnews", [w1, w2])

  // SEC map should be cached (load is async; wait explicitly).
  await page.waitForFunction(() => Boolean(localStorage.getItem("sec_cik_map_v1")), null, {
    timeout: 20000,
  })
  const hasMap = await page.evaluate(() => Boolean(localStorage.getItem("sec_cik_map_v1")))
  if (!hasMap) throw new Error("Finnews: SEC CIK map was not cached in localStorage (sec_cik_map_v1)")
}

async function verifyStockpulse(page, baseUrl) {
  const w1 = wait2xx(page, "/stockpulse/api/status", "StockPulse status")
  const w2 = wait2xx(page, "/stockpulse/api/ai/ratings", "StockPulse ratings")
  const w3 = wait2xx(page, "/stockpulse/api/ai/rating-history/AAPL", "StockPulse rating history")

  await page.goto(`${baseUrl}/stockpulse?ticker=AAPL`, { waitUntil: "domcontentloaded" })
  await allOrThrow("StockPulse", [w1, w2, w3])

  // Chat (minimal assertion: endpoint returns 2xx)
  const chatCard = page.locator('[data-slot="card"]').filter({ hasText: "AI chat" }).first()
  const askButton = chatCard.getByRole("button", { name: /^Ask$/ })
  if (await askButton.count()) {
    const inputs = chatCard.locator("input")
    const w4 = wait2xx(page, "/stockpulse/api/chat/ask", "StockPulse chat")
    await inputs.nth(0).fill("AAPL")
    await inputs.nth(1).fill("Summarize today's sentiment in 2 sentences.")
    await askButton.first().click()
    await w4
  }
}

async function verifyAlerts(page, baseUrl) {
  await page.goto(`${baseUrl}/openbb`, { waitUntil: "domcontentloaded" })
  // Open the alerts popover (bell icon). We assert that polling doesn't error by waiting for network responses.
  const alertsButton = page.getByTitle("Alerts")
  if (await alertsButton.count()) {
    await alertsButton.click()
    const pollButton = page.getByRole("button", { name: /^Poll$/ })
    if (await pollButton.count()) {
      const w1 = wait2xx(page, "/finnews/api/v1/news/latest", "Alerts: Finnews latest")
      const w2 = wait2xx(page, "/stockpulse/api/ai/ratings", "Alerts: StockPulse ratings")
      await pollButton.click()
      // If services are configured, poll triggers Finnews + StockPulse requests.
      await allOrThrow("Alerts", [w1, w2])
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const baseUrl = normalizeBaseUrl(args.base)

  const env = {
    ...loadDotEnv(path.join(process.cwd(), ".env")),
    ...loadDotEnv(path.join(process.cwd(), ".env.local")),
  }

  const email =
    args.email ||
    String(env.VITE_ADMIN_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] ||
    "khalidsaidi66@gmail.com"

  const serviceAccountPath =
    process.env.FIREBASE_ADMIN_KEY_PATH ||
    path.join(process.cwd(), ".secrets", "relayorb-firebase-adminsdk-fbsvc-ca34fed738.json")

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Missing Firebase admin key: ${serviceAccountPath}`)
  }

  const firebaseConfig = {
    apiKey: mustEnv(env, "VITE_FIREBASE_API_KEY"),
    authDomain: mustEnv(env, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: mustEnv(env, "VITE_FIREBASE_PROJECT_ID"),
    appId: mustEnv(env, "VITE_FIREBASE_APP_ID"),
  }

  const token = await mintCustomToken({ serviceAccountPath, email })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const badConsole = []

  page.on("console", (msg) => {
    const type = msg.type()
    if (type !== "warning" && type !== "error") return
    const text = msg.text()
    for (const p of BAD_CONSOLE_PATTERNS) {
      if (p.re.test(text)) {
        badConsole.push({ type, label: p.label, text })
        break
      }
    }
  })
  page.on("pageerror", (err) => {
    const text = err instanceof Error ? err.message : String(err)
    badConsole.push({ type: "pageerror", label: "Unhandled page error", text })
  })

  try {
    await signInWithCustomTokenCompat({ page, baseUrl, firebaseConfig, customToken: token })
    await verifyTrader(page, baseUrl)
    await verifyOpenbbWatchlist(page, baseUrl)
    await verifyOpenbb(page, baseUrl)
    await verifyFinnews(page, baseUrl)
    await verifyStockpulse(page, baseUrl)
    await verifyAlerts(page, baseUrl)
    try {
      await page.screenshot({
        path: path.join(process.cwd(), "tmp.verify-oss-console.ok.png"),
        fullPage: true,
      })
      console.error("Saved screenshot: tmp.verify-oss-console.ok.png")
    } catch {
      // ignore
    }

    if (badConsole.length) {
      const rendered = badConsole
        .slice(0, 8)
        .map((e) => `- [${e.type}] ${e.label}: ${String(e.text || "").slice(0, 260)}`)
        .join("\n")
      throw new Error(`Console errors/warnings detected during verification:\n${rendered}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err)
    try {
      await page.screenshot({ path: path.join(process.cwd(), "tmp.verify-oss-console.png"), fullPage: true })
      console.error("Saved screenshot: tmp.verify-oss-console.png")
    } catch {}
    throw new Error(msg)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
