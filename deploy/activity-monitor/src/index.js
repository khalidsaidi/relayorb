const { onSchedule } = require('firebase-functions/v2/scheduler')
const admin = require('firebase-admin')
const { CloudRunJobsClient } = require('@google-cloud/run').v2

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()
const runJobsClient = new CloudRunJobsClient()

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'relayorb'
const LOCATION = process.env.LOCATION || 'us-west1'
const MARKET_INTEL_JOB = 'relayorb-market-intel'
const ACTIVE_TIMEOUT_MS = 90 * 1000 // User is active if last seen < 90 seconds ago
const MIN_BOOST_INTERVAL_MS = 90 * 1000 // Minimum interval between boosted runs (90 seconds)

async function checkActiveUsers() {
  const now = Date.now()
  const cutoffTime = new Date(now - ACTIVE_TIMEOUT_MS)
  const cutoff = admin.firestore.Timestamp.fromDate(cutoffTime)
  
  try {
    // Check for active users
    const presenceSnap = await db
      .collection('presence')
      .where('lastSeen', '>=', cutoff)
      .where('active', '==', true)
      .limit(10)
      .get()
    
    const activeCount = presenceSnap.size
    const activeUsers = presenceSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    console.log(`Found ${activeCount} active users:`, activeUsers.map(u => u.email || u.id))
    
    return { active: activeCount > 0, count: activeCount, users: activeUsers }
  } catch (err) {
    console.error('Failed to check active users:', err)
    return { active: false, count: 0, users: [], error: err.message }
  }
}

async function getLastMarketIntelRun() {
  try {
    const metaRef = db.doc('market/hotTrades')
    const metaSnap = await metaRef.get()
    
    if (!metaSnap.exists) return null
    
    const data = metaSnap.data()
    const updatedAt = data?.updatedAt
    
    if (!updatedAt) return null
    
    return updatedAt.toDate()
  } catch (err) {
    console.error('Failed to get last market-intel run:', err)
    return null
  }
}

async function triggerMarketIntel() {
  try {
    const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/jobs/${MARKET_INTEL_JOB}`
    
    const [operation] = await runJobsClient.runJob({
      name: parent,
    })
    
    console.log('Triggered market-intel job:', operation.name)
    return { success: true, execution: operation.name }
  } catch (err) {
    console.error('Failed to trigger market-intel:', err)
    return { success: false, error: err.message }
  }
}

async function handleActivityCheck() {
  console.log('Checking for active users...')
  
  const { active, count, users } = await checkActiveUsers()
  
  if (!active) {
    console.log('No active users detected, skipping boost')
    return { boosted: false, reason: 'no_active_users' }
  }
  
  console.log(`Active users detected: ${count}, boosting market-intel frequency`)
  
  // Check last run time
  const lastRun = await getLastMarketIntelRun()
  const now = new Date()
  
  if (lastRun) {
    const elapsedMs = now.getTime() - lastRun.getTime()
    
    if (elapsedMs < MIN_BOOST_INTERVAL_MS) {
      console.log(`Last run was ${Math.round(elapsedMs / 1000)}s ago, skipping (min interval: ${MIN_BOOST_INTERVAL_MS / 1000}s)`)
      return { boosted: false, reason: 'too_soon', elapsedSeconds: Math.round(elapsedMs / 1000) }
    }
  }
  
  // Trigger market-intel
  const result = await triggerMarketIntel()
  
  if (result.success) {
    // Update activity metadata
    await db.doc('market/activity').set({
      lastBoostedAt: admin.firestore.FieldValue.serverTimestamp(),
      activeUsers: count,
      activeUserEmails: users.map(u => u.email || u.id),
      boostReason: 'active_users_detected',
    }, { merge: true })
    
    console.log('Successfully boosted market-intel')
    return { boosted: true, activeUsers: count, execution: result.execution }
  } else {
    return { boosted: false, reason: 'trigger_failed', error: result.error }
  }
}

// Cloud Function that runs every minute
exports.activityMonitor = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'UTC',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    return handleActivityCheck()
  }
)
