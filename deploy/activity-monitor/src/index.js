const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')
const fs = require('fs')
const { JobsClient } = require('@google-cloud/run')

const EXPECTED_REGION = 'us-west1'
const DMI_PRODUCT_PATHS = [
  '/sys/class/dmi/id/product_name',
  '/sys/devices/virtual/dmi/id/product_name',
]
const DMI_VENDOR_PATHS = [
  '/sys/class/dmi/id/sys_vendor',
  '/sys/devices/virtual/dmi/id/sys_vendor',
]

function assertRemoteOnly(serviceName) {
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
        return String(fs.readFileSync(path, 'utf8')).trim()
      }
    } catch (_) {
      continue
    }
  }
  return ''
}

function isGceVm() {
  const product = readDmiValue(DMI_PRODUCT_PATHS).toLowerCase()
  const vendor = readDmiValue(DMI_VENDOR_PATHS).toLowerCase()
  return product.includes('google') || vendor.includes('google')
}

function extractRegionFromResource(value) {
  if (!value) return ''
  const match = value.match(/\/locations\/([^/]+)/)
  return match ? match[1] : ''
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
    ''
  )
}

function assertUsWest1(serviceName) {
  const region = resolveRuntimeRegion()
  if (region !== EXPECTED_REGION) {
    console.error(
      `Refusing to start ${serviceName} outside ${EXPECTED_REGION} (got: ${
        region || 'unknown'
      }).`
    )
    process.exit(1)
  }
}

function toFiniteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTurnoverScope(scope) {
  return {
    movers: scope?.movers !== false,
    trending: scope?.trending !== false,
    hotTrades: scope?.hotTrades !== false,
  }
}

function hasTurnoverChange(before, after) {
  const beforeMin = toFiniteNumber(before?.moverTurnoverMinPct)
  const beforeMax = toFiniteNumber(before?.moverTurnoverMaxPct)
  const afterMin = toFiniteNumber(after?.moverTurnoverMinPct)
  const afterMax = toFiniteNumber(after?.moverTurnoverMaxPct)
  if (beforeMin !== afterMin || beforeMax !== afterMax) return true

  const beforeScope = normalizeTurnoverScope(before?.moverTurnoverScope)
  const afterScope = normalizeTurnoverScope(after?.moverTurnoverScope)
  return (
    beforeScope.movers !== afterScope.movers ||
    beforeScope.trending !== afterScope.trending ||
    beforeScope.hotTrades !== afterScope.hotTrades
  )
}

if (!admin.apps.length) {
  admin.initializeApp()
}
const db = admin.firestore()
const runJobsClient = new JobsClient()

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'relayorb'
const LOCATION = process.env.LOCATION || 'us-west1'
const MARKET_INTEL_JOB = 'relayorb-market-intel'
const REFRESH_JOBS = (process.env.REFRESH_JOBS || 'relayorb-market-intel,relayorb-signal-evaluator')
  .split(',')
  .map((job) => job.trim())
  .filter(Boolean)
const ADMIN_ALLOWLIST = (process.env.ADMIN_ALLOWLIST || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)
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

async function triggerJob(jobName) {
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/jobs/${jobName}`
  const [operation] = await runJobsClient.runJob({ name: parent })
  return operation?.name || null
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
    region: 'us-west1',
  },
  async (event) => {
    assertRemoteOnly('activity-monitor')
    assertUsWest1('activity-monitor')
    return handleActivityCheck()
  }
)

exports.turnoverControlsTrigger = onDocumentUpdated(
  {
    document: 'market/controls',
    region: 'us-west1',
  },
  async (event) => {
    assertRemoteOnly('turnover-controls-trigger')
    assertUsWest1('turnover-controls-trigger')
    const before = event?.data?.before?.data() || {}
    const after = event?.data?.after?.data() || {}
    if (!hasTurnoverChange(before, after)) return null

    console.log('turnover_controls_changed', {
      before: {
        min: toFiniteNumber(before?.moverTurnoverMinPct),
        max: toFiniteNumber(before?.moverTurnoverMaxPct),
        scope: normalizeTurnoverScope(before?.moverTurnoverScope),
      },
      after: {
        min: toFiniteNumber(after?.moverTurnoverMinPct),
        max: toFiniteNumber(after?.moverTurnoverMaxPct),
        scope: normalizeTurnoverScope(after?.moverTurnoverScope),
      },
    })

    return triggerMarketIntel()
  }
)

exports.refreshBatchTrigger = onDocumentCreated(
  {
    document: 'batches/{batchId}',
    region: 'us-west1',
  },
  async (event) => {
    assertRemoteOnly('refresh-batch-trigger')
    assertUsWest1('refresh-batch-trigger')
    const snap = event?.data
    if (!snap?.exists) return null
    const data = snap.data() || {}
    if (data.processedAt || data.status === 'processed') return null
    if (data.type && data.type !== 'refresh') return null

    const email = String(data.requestedByEmail || '').toLowerCase()
    if (ADMIN_ALLOWLIST.length > 0 && (!email || !ADMIN_ALLOWLIST.includes(email))) {
      await snap.ref.set(
        {
          status: 'rejected',
          rejectionReason: 'not_authorized',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      return null
    }

    const requestedJobs = Array.isArray(data.jobs)
      ? data.jobs.map((job) => String(job).trim()).filter(Boolean)
      : []
    const jobs = requestedJobs.length > 0 ? requestedJobs : REFRESH_JOBS
    const results = []
    for (const job of jobs) {
      try {
        const execution = await triggerJob(job)
        results.push({ job, status: 'started', execution })
      } catch (err) {
        results.push({
          job,
          status: 'error',
          error: err?.message || String(err || 'Failed'),
        })
      }
    }
    await snap.ref.set(
      {
        status: 'processed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        jobs: results,
      },
      { merge: true }
    )
    return null
  }
)
