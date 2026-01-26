import { spawn } from "node:child_process"
import process from "node:process"
import admin from "firebase-admin"
import fs from "node:fs"
import { chromium } from "playwright"

const BASE_URL = process.env.UI_BASE_URL || "http://127.0.0.1:5173"
const SERVER_READY_TIMEOUT_MS = 30_000
const DEFAULT_PROPOSAL_QTY = 100

const ACCOUNTS = [
  { key: "acct1", uid: "enEopK5vNkMWZrXJAllC9bX4cgu1" },
  { key: "acct2", uid: "TpMgVF4dkfRoiiGPsntwHNdnQpd2" },
]

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
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
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

function normalizeSymbol(symbol) {
  return symbol.toUpperCase().replace(/[\\/]/g, "_")
}

async function pickActionBoardTrade(db) {
  const snap = await db.doc("market/actionBoard").get()
  if (!snap.exists) return null
  const data = snap.data() || {}
  const combined = []
  if (Array.isArray(data.buys)) combined.push(...data.buys)
  if (Array.isArray(data.sells)) combined.push(...data.sells)
  return combined.find((item) => item?.assetClass === "stock") || null
}

async function pickHotTrade(db) {
  const snap = await db.doc("market/hotTrades").get()
  if (!snap.exists) return null
  const data = snap.data() || {}
  const items = Array.isArray(data.items) ? data.items : []
  return items.find((item) => item?.assetClass === "stock") || null
}

async function ensureTradeProposal(db, accountKey, trade) {
  const symbol = String(trade.symbol || "").toUpperCase()
  if (!symbol) throw new Error("Trade symbol missing")
  const proposalId = `${accountKey}_stock_${normalizeSymbol(symbol)}`
  const now = admin.firestore.Timestamp.now()
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000)
  const price = Number(trade.price) || 1
  const side = trade.side === "sell" ? "sell" : "buy"
  const payload = {
    id: proposalId,
    brokerAccountKey: accountKey,
    symbol,
    assetClass: "stock",
    assetKey: `stock:${symbol}`,
    side,
    quantity: DEFAULT_PROPOSAL_QTY,
    price,
    computedAt: now,
    expiresAt,
    updatedAt: now,
  }
  await db.doc(`tradeProposals/${proposalId}`).set(payload, { merge: true })
  return proposalId
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

async function expectTabs(page, contextLabel) {
  const paperTab = page.getByRole("tab", { name: "Paper" })
  const liveTab = page.getByRole("tab", { name: "Live" })
  await paperTab.waitFor({ state: "visible" })
  await liveTab.waitFor({ state: "visible" })
  const liveHandle = await liveTab.elementHandle()
  if (!liveHandle) throw new Error(`${contextLabel}: Live tab not found`)
  await page.waitForFunction((el) => !el.hasAttribute("disabled"), liveHandle, {
    timeout: 10000,
  })
}

async function verifyOrbPage(page) {
  await page.goto(`${BASE_URL}/orb`, { waitUntil: "domcontentloaded" })
  await page.getByText("Execution mode").waitFor({ state: "visible" })
  await expectTabs(page, "ORB Robot")
}

async function verifyIbkrOrderPage(page) {
  await page.goto(`${BASE_URL}/ibkr`, { waitUntil: "domcontentloaded" })
  await expectTabs(page, "IBKR Order")
}

async function openFirstExecuteDialog(page) {
  const executeButton = page.locator("button:enabled", { hasText: "Execute" }).first()
  await executeButton.waitFor({ state: "visible" })
  await executeButton.click()
  await page.getByRole("dialog").waitFor({ state: "visible" })
}

async function verifyExecuteDialog(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" })
  await openFirstExecuteDialog(page)
  await expectTabs(page, "Execute Trade Dialog")
  await page.keyboard.press("Escape")
}

async function verifyDashboardDialog(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" })
  await openFirstExecuteDialog(page)
  await expectTabs(page, "Dashboard Execute Dialog")
  await page.keyboard.press("Escape")
}

async function main() {
  await ensureAdmin()
  const db = admin.firestore()
  const actionTrade = await pickActionBoardTrade(db)
  const fallbackTrade = actionTrade || (await pickHotTrade(db))
  if (!fallbackTrade || !fallbackTrade.symbol) {
    throw new Error("No stock trade found in actionBoard or hotTrades.")
  }
  const tradeSymbol = String(fallbackTrade.symbol).toUpperCase()

  for (const account of ACCOUNTS) {
    await ensureUser(account.uid)
    await ensureTradeProposal(db, account.key, fallbackTrade)
  }

  const replayRef = db.doc("replay/controls")
  const replaySnap = await replayRef.get()
  const replayBefore = replaySnap.exists ? replaySnap.data() : null
  const replayVersion = Number.isFinite(replayBefore?.version) ? replayBefore.version : 0
  const replayWasActive = replayBefore?.desiredMode === "replay"

  if (replayWasActive) {
    await replayRef.set(
      {
        desiredMode: "live",
        version: replayVersion + 1,
      },
      { merge: true }
    )
  }

  const { proc } = await ensureDevServer()
  const browser = await chromium.launch({ headless: true })

  try {
    for (const account of ACCOUNTS) {
      const token = await admin.auth().createCustomToken(account.uid)
      const context = await browser.newContext()
      const page = await context.newPage()
      await signInWithToken(page, token)
      await verifyOrbPage(page)
      await verifyIbkrOrderPage(page)
      await verifyExecuteDialog(page)
      await verifyDashboardDialog(page)
      await context.close()
      console.log(`Verified trading toggles for ${account.key}`)
    }
  } finally {
    await browser.close()
    if (replayWasActive && replayBefore) {
      await replayRef.set(
        {
          ...replayBefore,
          version: replayVersion + 2,
        },
        { merge: true }
      )
    }
    if (proc) {
      proc.kill("SIGTERM")
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
