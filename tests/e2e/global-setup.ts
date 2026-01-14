import { Timestamp } from "firebase-admin/firestore"
import { getAdmin } from "./utils/admin"

const DEFAULT_TEST_EMAIL = "relayorb-admin-test@relayorb.local"
const DEFAULT_TEST_PASSWORD = "relayorb-e2e"

function resolveEnv(name: string, fallback: string) {
  const value = process.env[name] || fallback
  process.env[name] = value
  return value
}

export default async function globalSetup() {
  const target = process.env.RELAYORB_E2E_TARGET || "prod"
  if (target !== "emulator") {
    return
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is not set. Run tests via Firebase emulators.")
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST is not set. Run tests via Firebase emulators.")
  }

  const testEmail = resolveEnv("VITE_E2E_TEST_EMAIL", DEFAULT_TEST_EMAIL)
  const testPassword = resolveEnv("VITE_E2E_TEST_PASSWORD", DEFAULT_TEST_PASSWORD)

  const { auth, db } = getAdmin()

  try {
    await auth.getUserByEmail(testEmail)
  } catch {
    await auth.createUser({ email: testEmail, password: testPassword })
  }

  const botsRef = db.collection("bots")
  if (typeof db.recursiveDelete === "function") {
    await db.recursiveDelete(botsRef)
  } else {
    const snap = await botsRef.get()
    const batch = db.batch()
    snap.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
  }

  const now = Timestamp.now()
  const bots = [
    {
      id: "freqtrade-1",
      name: "Freqtrade Paper",
      engine: "freqtrade",
      status: "online",
      lastHeartbeat: now,
      summary: { positions: 1, orders: 2, pnl: 12.34 },
      state: { mode: "dry_run" },
    },
    {
      id: "backtrader-stocks",
      name: "Backtrader Stocks",
      engine: "backtrader",
      status: "online",
      lastHeartbeat: now,
      summary: { positions: 0, orders: 0, pnl: 1.1 },
    },
    {
      id: "backtrader-forex",
      name: "Backtrader FX",
      engine: "backtrader",
      status: "idle",
      lastHeartbeat: now,
      summary: { positions: 0, orders: 0, pnl: 0 },
    },
  ]

  await Promise.all(
    bots.map((bot) => {
      const data: Record<string, unknown> = {
        name: bot.name,
        engine: bot.engine,
        status: bot.status,
        lastHeartbeat: bot.lastHeartbeat,
        summary: bot.summary,
        updatedAt: now,
      }

      if (bot.state) {
        data.state = bot.state
      }

      return botsRef.doc(bot.id).set(data)
    })
  )

  await botsRef.doc("freqtrade-1").collection("events").doc("seed-1").set({
    type: "system",
    severity: "info",
    message: "Freqtrade connected",
    createdAt: now,
    data: { source: "seed" },
  })

}
