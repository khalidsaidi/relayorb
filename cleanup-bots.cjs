const admin = require("firebase-admin")
const serviceAccount = require("./relayorb-firebase-service-account.json")

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()
const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run") || args.has("-n")
const targetEngines = new Set(["hummingbot", "jesse"])

function isTargetEngine(value) {
  if (!value) return false
  return targetEngines.has(String(value).trim().toLowerCase())
}

async function deleteRef(ref) {
  if (dryRun) {
    console.log(`[dry-run] delete ${ref.path}`)
    return
  }
  if (typeof db.recursiveDelete === "function") {
    await db.recursiveDelete(ref)
  } else {
    await ref.delete()
  }
  console.log(`deleted ${ref.path}`)
}

async function cleanupTopLevelBots() {
  const snapshot = await db.collection("bots").get()
  const targets = snapshot.docs.filter((doc) => isTargetEngine(doc.data()?.engine))
  if (targets.length === 0) {
    console.log("No matching bots found in top-level bots collection.")
    return 0
  }
  for (const doc of targets) {
    await deleteRef(doc.ref)
  }
  return targets.length
}

async function cleanupUserBots() {
  const usersSnap = await db.collection("users").get()
  if (usersSnap.empty) {
    console.log("No users found.")
    return 0
  }
  let removed = 0
  for (const userDoc of usersSnap.docs) {
    const botsSnap = await userDoc.ref.collection("bots").get()
    if (botsSnap.empty) continue
    const targets = botsSnap.docs.filter((doc) => isTargetEngine(doc.data()?.engine))
    for (const doc of targets) {
      await deleteRef(doc.ref)
      removed += 1
    }
  }
  if (removed === 0) {
    console.log("No matching bots found in user bot collections.")
  }
  return removed
}

async function run() {
  console.log(`Cleanup bots: ${dryRun ? "dry-run" : "apply"}`)
  const topLevelRemoved = await cleanupTopLevelBots()
  const userRemoved = await cleanupUserBots()
  const total = topLevelRemoved + userRemoved
  console.log(`Done. Removed ${total} bot docs.`)
}

run().catch((error) => {
  console.error("Cleanup failed:", error)
  process.exit(1)
})
