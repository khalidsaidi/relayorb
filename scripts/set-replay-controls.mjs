import admin from "firebase-admin"

const projectId = process.env.FIREBASE_PROJECT_ID || "relayorb"
const runId = process.env.REPLAY_RUN_ID
const datasetId = process.env.DATASET_ID
const desiredMode = process.env.DESIRED_MODE || "replay"
const phase = process.env.REPLAY_PHASE || "paused"
const asOfInput = process.env.REPLAY_ASOF || ""
const speed = Number.isFinite(Number(process.env.REPLAY_SPEED))
  ? Number(process.env.REPLAY_SPEED)
  : 1
const requiredServices = (process.env.REQUIRED_SERVICES ||
  "mdg,price-streamer,market-intel,signal-evaluator,ui")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
const botsReplayEnabled = process.env.BOTS_REPLAY_ENABLED === "true"

if (!runId || !datasetId) {
  console.error("Missing REPLAY_RUN_ID or DATASET_ID")
  process.exit(1)
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId })
}

const db = admin.firestore()

function parseAsOf(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed
}

async function main() {
  const ref = db.doc("replay/controls")
  const snap = await ref.get()
  const current = snap.exists ? snap.data() : {}
  const nextVersion = Number.isFinite(current?.version) ? current.version + 1 : 1
  const asOfDate = parseAsOf(asOfInput)

  const payload = {
    desiredMode,
    phase,
    activeRunId: runId,
    datasetId,
    requiredServices,
    speedScript: [{ speed }],
    botsReplayEnabled,
    version: nextVersion,
    sessionId: desiredMode === "replay" ? `session-${Date.now()}` : current?.sessionId || null,
  }
  if (asOfDate) {
    payload.asOf = admin.firestore.Timestamp.fromDate(asOfDate)
  }

  await ref.set(payload, { merge: true })
  console.log("Replay controls updated", payload)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
