import admin from "firebase-admin"
import fs from "fs"

const projectId = process.env.FIREBASE_PROJECT_ID || "relayorb"
const runId = process.env.REPLAY_RUN_ID
const symbolsPath = process.env.SYMBOLS_PATH || "tmp-replay-symbols.json"

if (!runId) {
  console.error("Missing REPLAY_RUN_ID")
  process.exit(1)
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId })
}

const db = admin.firestore()

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function uniqueList(items) {
  return Array.from(new Set(items)).filter(Boolean)
}

async function main() {
  const [universeSnap, controlsSnap] = await Promise.all([
    db.doc("market/universe").get(),
    db.doc("market/controls").get(),
  ])
  if (!universeSnap.exists) {
    throw new Error("market/universe not found")
  }
  if (!controlsSnap.exists) {
    throw new Error("market/controls not found")
  }

  const universe = universeSnap.data() || {}
  const controls = controlsSnap.data() || {}

  const rawSymbols = JSON.parse(fs.readFileSync(symbolsPath, "utf8"))
  if (!Array.isArray(rawSymbols) || rawSymbols.length === 0) {
    throw new Error(`No symbols found in ${symbolsPath}`)
  }

  const replaySymbols = uniqueList(rawSymbols.map(normalizeTicker).filter(Boolean))
  const nextUniverse = {
    ...universe,
    stocks: {
      ...universe.stocks,
      symbols: replaySymbols,
    },
  }

  const nextControls = {
    ...controls,
    swingOvernightEnabled: true,
    prebreakoutEnabled: true,
  }

  await db
    .doc(`replay/controls/runs/${runId}/configSnapshot/meta`)
    .set(
      {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        universe: nextUniverse,
        controls: nextControls,
      },
      { merge: true }
    )

  console.log(`Replay config snapshot written for runId=${runId}`)
  console.log(`Symbols: ${replaySymbols.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
