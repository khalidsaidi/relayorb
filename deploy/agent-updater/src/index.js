const admin = require("firebase-admin")
const fs = require("fs")
const { spawn } = require("child_process")

const config = {
  configPath: process.env.RELAYORB_CONFIG_PATH || "/config/config.json",
  composePath: process.env.RELAYORB_COMPOSE_PATH || "/host/docker-compose.yml",
  composeProject: process.env.RELAYORB_COMPOSE_PROJECT || "relayorb",
  agentService: process.env.RELAYORB_AGENT_SERVICE || "relayorb-agent",
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
}

const pendingCommands = []
let updateRunning = false

function loadConfig() {
  try {
    const raw = fs.readFileSync(config.configPath, "utf8")
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Failed to read config at ${config.configPath}: ${err.message}`)
  }
}

function initFirestore(projectId) {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId,
      credential: admin.credential.applicationDefault(),
    })
  }
  return admin.firestore()
}

function runCompose(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "docker-compose",
      ["-f", config.composePath, "-p", config.composeProject, ...args],
      { stdio: "inherit" }
    )
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`docker-compose ${args.join(" ")} exited with ${code}`))
    })
  })
}

async function claimCommand(db, ref) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const data = snap.data()
    if (data.status && data.status !== "queued") return null
    tx.update(ref, {
      status: "running",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return data
  })
}

async function performUpdate() {
  await runCompose(["pull", config.agentService])
  await runCompose(["up", "-d", "--no-deps", config.agentService])
}

async function processQueue() {
  if (updateRunning) return
  updateRunning = true
  while (pendingCommands.length > 0) {
    const next = pendingCommands.shift()
    if (!next) continue
    try {
      await handleCommand(next.db, next.docRef, next.botId)
    } catch (err) {
      console.error("Update command failed", err)
    }
  }
  updateRunning = false
}

async function handleCommand(db, docRef, botId) {
  const data = await claimCommand(db, docRef)
  if (!data) return

  try {
    await performUpdate()
    await docRef.update({
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      result: {
        message: "Agent updated",
        updatedAt: new Date().toISOString(),
      },
    })
    await db.collection("bots").doc(botId).collection("events").add({
      type: "system",
      severity: "info",
      message: "RelayOrb agent updated",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (err) {
    await docRef.update({
      status: "failed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    })
  }
}

async function start() {
  const runtimeConfig = loadConfig()
  const projectId = runtimeConfig?.firestore?.projectId || config.projectId
  const bots = Array.isArray(runtimeConfig?.bots) ? runtimeConfig.bots : []
  const botIds = bots.map((bot) => bot?.id).filter(Boolean)
  if (botIds.length === 0) {
    throw new Error("No bots found in config; cannot watch update commands.")
  }

  const db = initFirestore(projectId)
  console.log("RelayOrb updater online", { botIds, composePath: config.composePath })

  botIds.forEach((botId) => {
    const ref = db.collection("bots").doc(botId).collection("commands")
    const query = ref.where("status", "==", "queued").where("type", "==", "update_agent")
    query.onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return
        pendingCommands.push({ db, docRef: change.doc.ref, botId })
        processQueue()
      })
    })
  })
}

start().catch((err) => {
  console.error("Agent updater failed to start", err)
  process.exit(1)
})
