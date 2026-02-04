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

const EXPECTED_REGION = "us-west1"
const DMI_PRODUCT_PATHS = [
  "/sys/class/dmi/id/product_name",
  "/sys/devices/virtual/dmi/id/product_name",
]
const DMI_VENDOR_PATHS = [
  "/sys/class/dmi/id/sys_vendor",
  "/sys/devices/virtual/dmi/id/sys_vendor",
]

function assertRemoteOnly(serviceName) {
  if (process.env.ALLOW_LOCAL_RUN === "1") {
    return
  }
  const isCloudRun = Boolean(
    process.env.K_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.CLOUD_RUN_TASK_INDEX ||
      process.env.CLOUD_RUN_TASK_ATTEMPT
  )
  const isGce = isGceVm()
  if (!isCloudRun && !isGce) {
    console.error(`Refusing to start ${serviceName} locally.`)
    process.exit(1)
  }
}

function readDmiValue(paths) {
  for (const path of paths) {
    try {
      if (fs.existsSync(path)) {
        return String(fs.readFileSync(path, "utf8")).trim()
      }
    } catch (_) {
      continue
    }
  }
  return ""
}

function isGceVm() {
  const product = readDmiValue(DMI_PRODUCT_PATHS).toLowerCase()
  const vendor = readDmiValue(DMI_VENDOR_PATHS).toLowerCase()
  return product.includes("google") || vendor.includes("google")
}

function extractRegionFromResource(value) {
  if (!value) return ""
  const match = value.match(/\/locations\/([^/]+)/)
  return match ? match[1] : ""
}

function resolveRuntimeRegion() {
  return (
    process.env.RUN_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    process.env.CLOUD_RUN_REGION ||
    process.env.GCP_REGION ||
    process.env.FUNCTION_REGION ||
    process.env.FUNCTIONS_REGION ||
    process.env.LOCATION ||
    process.env.REGION ||
    extractRegionFromResource(process.env.EVENTARC_CLOUD_EVENT_SOURCE) ||
    extractRegionFromResource(process.env.EVENTARC_EVENT_SOURCE) ||
    ""
  )
}

function assertUsWest1(serviceName) {
  const region = resolveRuntimeRegion()
  if (region !== EXPECTED_REGION) {
    console.error(
      `Refusing to start ${serviceName} outside ${EXPECTED_REGION} (got: ${
        region || "unknown"
      }).`
    )
    process.exit(1)
  }
}

assertRemoteOnly("agent-updater")
assertUsWest1("agent-updater")

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
