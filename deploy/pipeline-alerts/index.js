/**
 * Pipeline Alerts Service
 * 
 * Runs verification checks and sends email alerts when issues are detected.
 * Designed to run as a Cloud Run Job on a schedule (every 5 minutes).
 * 
 * Environment variables:
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - SENDGRID_API_KEY: SendGrid API key for sending emails
 * - ALERT_FROM_EMAIL: From email address (must be verified in SendGrid)
 * - GCP_PROJECT_ID: GCP project ID for logging API
 */

import admin from "firebase-admin"
import sgMail from "@sendgrid/mail"
import { Logging } from "@google-cloud/logging"
import { JobsClient } from "@google-cloud/run"
import fs from "node:fs"
import { createClient } from "redis"

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

function getEasternTimeParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const lookup = new Map(parts.map((part) => [part.type, part.value]))
  return {
    weekday: lookup.get("weekday") || "",
    hour: parseInt(lookup.get("hour") || "0", 10),
    minute: parseInt(lookup.get("minute") || "0", 10),
  }
}

function isUsMarketOpenNow() {
  const { weekday, hour, minute } = getEasternTimeParts()
  if (weekday === "Sat" || weekday === "Sun") return false
  const minutes = hour * 60 + minute
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60
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

assertRemoteOnly("pipeline-alerts")
assertUsWest1("pipeline-alerts")

// Configuration
const config = {
  projectId: process.env.FIREBASE_PROJECT_ID || "relayorb",
  gcpProjectId: process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "relayorb",
  sendgridApiKey: process.env.SENDGRID_API_KEY || "",
  // Note: For SendGrid, the from email must be verified as a Sender Identity
  // For new accounts, you need to verify at: https://app.sendgrid.com/settings/sender_auth
  fromEmail: process.env.ALERT_FROM_EMAIL || "alerts@relayorb.app",

  // Redis configuration for pipeline events
  redisUrl: process.env.REDIS_URL || "",
  pipelineEventsStream: process.env.PIPELINE_EVENTS_STREAM || "pipeline_events",

  // Thresholds
  thresholds: {
    signalFreshness: 30 * 60 * 1000,      // 30 minutes
    priceFreshness: 5 * 60 * 1000,        // 5 minutes
    pipelineRunFreshness: 10 * 60 * 1000, // 10 minutes
    heartbeatFreshness: 10 * 60 * 1000,   // 10 minutes
    errorCountThreshold: 5,               // Alert if more than N errors in lookback
    errorLookbackMinutes: 15,             // Check errors in last N minutes
  },

  // Alert cooldown: don't send same alert within this period
  alertCooldownMs: 30 * 60 * 1000, // 30 minutes

  // Services to monitor for errors
  monitoredServices: [
    "relayorb-market-data-gateway",
    "relayorb-price-streamer",
    "relayorb-refresh",
    "relayorb-orb-runner",
  ],

  // Jobs to monitor for errors
  monitoredJobs: [
    "relayorb-market-intel",
    "relayorb-signal-evaluator",
    "pipeline-alerts",
  ],

  // Expected Cloud Run jobs that should be deployed (us-west1 production)
  expectedJobs: [
    "relayorb-market-intel",
    "relayorb-signal-evaluator",
    "pipeline-alerts",
  ],

  // Expected bots that should be running and generating signals
  expectedBots: [
    { id: "backtrader-crypto", engine: "backtrader", required: true },
    { id: "backtrader-stocks", engine: "backtrader", required: true },
    { id: "backtrader-forex", engine: "backtrader", required: true },
  ],

  // Zombie detection: bot is "online" but hasn't produced signals in this time
  zombieThresholdMs: 60 * 60 * 1000, // 1 hour - if no signals in 1 hour while "online", it's a zombie

  // GCP region for Cloud Run (production is in us-west1)
  gcpRegion: process.env.GCP_REGION || "us-west1",
}

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId })
}
const db = admin.firestore()

// Initialize SendGrid
if (config.sendgridApiKey) {
  sgMail.setApiKey(config.sendgridApiKey)
}

// Initialize Cloud Logging client
const logging = new Logging({ projectId: config.gcpProjectId })

// Initialize Cloud Run Jobs client
const runJobsClient = new JobsClient()

// Initialize Redis client for pipeline events
let redisClient = null
if (config.redisUrl) {
  redisClient = createClient({ url: config.redisUrl })
  redisClient.on("error", (err) => console.error("Redis client error:", err))
}

// ============================================================================
// CLOUD LOGGING CHECKS
// ============================================================================

async function checkServiceErrors() {
  const errors = []
  const lookbackMs = config.thresholds.errorLookbackMinutes * 60 * 1000
  const startTime = new Date(Date.now() - lookbackMs).toISOString()
  
  for (const serviceName of config.monitoredServices) {
    try {
      // Query for ERROR severity logs from this service
      const filter = `
        resource.type="cloud_run_revision"
        resource.labels.service_name="${serviceName}"
        severity>=ERROR
        timestamp>="${startTime}"
      `.trim().replace(/\s+/g, " ")
      
      const [entries] = await logging.getEntries({
        filter,
        pageSize: 50,
        orderBy: "timestamp desc",
      })
      
      if (entries.length > 0) {
        // Group errors by message pattern
        const errorPatterns = new Map()
        
        for (const entry of entries) {
          const payload = entry.data?.textPayload || 
                          entry.data?.jsonPayload?.message || 
                          entry.data?.httpRequest?.status?.toString() ||
                          "Unknown error"
          
          // Extract error pattern (first 100 chars, normalized)
          let pattern = String(payload).slice(0, 100).replace(/\d+/g, "N")
          
          // Special handling for HTTP errors
          if (entry.data?.httpRequest?.status >= 400) {
            const status = entry.data.httpRequest.status
            const url = entry.data.httpRequest.requestUrl || ""
            const path = url.split("?")[0].split("/").slice(-2).join("/")
            pattern = `HTTP ${status} on ${path}`
          }
          
          if (!errorPatterns.has(pattern)) {
            errorPatterns.set(pattern, { count: 0, sample: payload, status: entry.data?.httpRequest?.status })
          }
          errorPatterns.get(pattern).count++
        }
        
        errors.push({
          service: serviceName,
          errorCount: entries.length,
          patterns: Array.from(errorPatterns.entries()).map(([pattern, data]) => ({
            pattern,
            count: data.count,
            sample: data.sample,
            httpStatus: data.status,
          })).sort((a, b) => b.count - a.count).slice(0, 3),
        })
      }
    } catch (err) {
      console.error(`Failed to check logs for ${serviceName}:`, err.message)
    }
  }
  
  return errors
}

async function checkJobErrors() {
  const errors = []
  const lookbackMs = config.thresholds.errorLookbackMinutes * 60 * 1000
  const startTime = new Date(Date.now() - lookbackMs).toISOString()

  for (const jobName of config.monitoredJobs || []) {
    try {
      const filter = `
        resource.type="cloud_run_job"
        resource.labels.job_name="${jobName}"
        severity>=ERROR
        timestamp>="${startTime}"
      `.trim().replace(/\s+/g, " ")

      const [entries] = await logging.getEntries({
        filter,
        pageSize: 50,
        orderBy: "timestamp desc",
      })

      if (entries.length > 0) {
        const errorPatterns = new Map()

        for (const entry of entries) {
          const payload = entry.data?.textPayload ||
                          entry.data?.jsonPayload?.message ||
                          entry.data?.httpRequest?.status?.toString() ||
                          "Unknown error"

          let pattern = String(payload).slice(0, 100).replace(/\d+/g, "N")

          if (entry.data?.httpRequest?.status >= 400) {
            const status = entry.data.httpRequest.status
            const url = entry.data.httpRequest.requestUrl || ""
            const path = url.split("?")[0].split("/").slice(-2).join("/")
            pattern = `HTTP ${status} on ${path}`
          }

          if (!errorPatterns.has(pattern)) {
            errorPatterns.set(pattern, { count: 0, sample: payload, status: entry.data?.httpRequest?.status })
          }
          errorPatterns.get(pattern).count++
        }

        errors.push({
          job: jobName,
          errorCount: entries.length,
          patterns: Array.from(errorPatterns.entries()).map(([pattern, data]) => ({
            pattern,
            count: data.count,
            sample: data.sample,
            httpStatus: data.status,
          })).sort((a, b) => b.count - a.count).slice(0, 3),
        })
      }
    } catch (err) {
      console.error(`Failed to check logs for job ${jobName}:`, err.message)
    }
  }

  return errors
}

async function checkPipelineStreamErrors() {
  if (!redisClient || !config.redisUrl) {
    return []
  }

  const errors = []
  const lookbackMs = config.thresholds.errorLookbackMinutes * 60 * 1000
  const startTime = Date.now() - lookbackMs

  try {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect()
    }

    // Read recent events from the stream
    // Using XREVRANGE to get events in reverse order (newest first)
    const streamKey = config.pipelineEventsStream
    const count = 1000 // Check last 1000 events
    const entries = await redisClient.xRevRange(streamKey, "+", "-", { COUNT: count })

    // Group errors by station/event type
    const errorGroups = new Map()

    for (const entry of entries) {
      try {
        const payload = entry.message?.payload
        if (!payload) continue

        const event = JSON.parse(payload)

        // Check if event is an error and within lookback window
        if (event.severity === "error" && event.timestamp) {
          const eventTime = new Date(event.timestamp).getTime()
          if (eventTime < startTime) continue

          // Create a grouping key based on event type and station
          const stationId = event.stationId || "unknown"
          const eventType = event.eventType || "unknown"
          const groupKey = `${stationId}:${eventType}`

          if (!errorGroups.has(groupKey)) {
            errorGroups.set(groupKey, {
              stationId,
              eventType,
              count: 0,
              samples: [],
            })
          }

          const group = errorGroups.get(groupKey)
          group.count++

          // Keep up to 3 sample error messages
          if (group.samples.length < 3 && event.error?.message) {
            group.samples.push({
              message: event.error.message,
              timestamp: event.timestamp,
              meta: event.meta,
            })
          }
        }
      } catch (err) {
        // Skip malformed event
        console.error("Failed to parse pipeline event:", err.message)
      }
    }

    // Convert error groups to array and add to results
    for (const [groupKey, data] of errorGroups.entries()) {
      errors.push({
        source: "pipeline_stream",
        groupKey,
        stationId: data.stationId,
        eventType: data.eventType,
        errorCount: data.count,
        samples: data.samples,
      })
    }
  } catch (err) {
    console.error("Failed to check pipeline stream:", err.message)
  }

  return errors
}

// ============================================================================
// CLOUD RUN JOB DEPLOYMENT CHECKS
// ============================================================================

async function checkJobDeployments() {
  const missingJobs = []

  try {
    // Get list of deployed Cloud Run jobs using API
    const parent = `projects/${config.gcpProjectId}/locations/${config.gcpRegion}`
    const [jobs] = await runJobsClient.listJobs({ parent })

    // Extract job names from the full resource names
    // Resource names are like: projects/PROJECT/locations/REGION/jobs/JOB_NAME
    const deployedJobs = jobs.map(job => {
      const parts = job.name.split("/")
      return parts[parts.length - 1]
    })

    // Check each expected job
    for (const expectedJob of config.expectedJobs) {
      if (!deployedJobs.includes(expectedJob)) {
        missingJobs.push(expectedJob)
      }
    }
  } catch (err) {
    console.error("Failed to check job deployments:", err.message)
    return {
      error: err.message,
      missingJobs: [],
    }
  }

  return { missingJobs, error: null }
}

// ============================================================================
// VERIFICATION CHECKS
// ============================================================================

async function runVerification() {
  const results = {
    timestamp: new Date().toISOString(),
    overall: "unknown",
    checks: [],
    alerts: [],
  }

  const addCheck = (category, name, status, message, details = {}) => {
    results.checks.push({ category, name, status, message, details })
    if (status === "failed") {
      results.alerts.push({ severity: "error", category, name, message, details })
    } else if (status === "warning") {
      results.alerts.push({ severity: "warning", category, name, message, details })
    }
  }

  try {
    // Check pipeline status
    const statusDoc = await db.doc("pipeline/status").get()
    
    if (!statusDoc.exists) {
      addCheck("services", "pipeline_status", "failed", "Pipeline status document missing")
    } else {
      const status = statusDoc.data()
      
      // Check overall status
      if (status.status === "ok") {
        addCheck("services", "pipeline_overall", "passed", "Pipeline healthy")
      } else if (status.status === "degraded") {
        addCheck("services", "pipeline_overall", "warning", 
          `Pipeline degraded: ${status.summary?.error || 0} errors`)
      } else {
        addCheck("services", "pipeline_overall", "failed", 
          `Pipeline status: ${status.status}`)
      }
      
      // Check each service
      const services = status.services || {}
      for (const [name, service] of Object.entries(services)) {
        if (service.status === "error" || service.status === "stale") {
          addCheck("services", `${name}_status`, "failed", 
            `${name.replace(/_/g, " ")} is ${service.status}`)
        } else if (service.ageMs > config.thresholds.heartbeatFreshness) {
          addCheck("services", `${name}_freshness`, "warning", 
            `${name.replace(/_/g, " ")} last seen ${Math.round(service.ageMs / 60000)} min ago`)
        }
        if (name === "orb_runner" && service.details) {
          const accountCount = service.details.accountCount ?? null
          const enabledCount = service.details.enabledCount ?? null
          if (accountCount === 0) {
            addCheck("services", "orb_runner_accounts", "failed", "orb runner has no accounts loaded", {
              accountCount,
              enabledCount,
            })
          } else if (enabledCount === 0) {
            addCheck("services", "orb_runner_enabled", "warning", "orb runner has no enabled accounts", {
              accountCount,
              enabledCount,
            })
          }
          if (service.details.gateway?.circuitState === "open") {
            addCheck("services", "orb_runner_gateway", "failed", "orb runner gateway circuit is open", {
              gateway: service.details.gateway,
            })
          }
        }
      }
    }

    // Check Cloud Run job deployments
    console.log("Checking Cloud Run job deployments...")
    const jobDeploymentCheck = await checkJobDeployments()

    if (jobDeploymentCheck.error) {
      addCheck("deployments", "job_deployment_check_failed", "warning",
        `Failed to verify job deployments: ${jobDeploymentCheck.error}`)
    } else if (jobDeploymentCheck.missingJobs.length > 0) {
      for (const missingJob of jobDeploymentCheck.missingJobs) {
        addCheck("deployments", `${missingJob}_not_deployed`, "failed",
          `Cloud Run job "${missingJob}" is not deployed in region ${config.gcpRegion}`)
      }
    } else {
      addCheck("deployments", "all_jobs_deployed", "passed",
        `All ${config.expectedJobs.length} expected Cloud Run jobs are deployed`)
    }

    // Check prices
    const pricesDoc = await db.doc("market/prices").get()
    if (pricesDoc.exists) {
      const prices = pricesDoc.data()
      const items = prices.items || []
      if (items.length === 0) {
        addCheck("prices", "no_prices", "failed", "No price data available")
      }
    } else {
      addCheck("prices", "prices_missing", "failed", "Prices document missing")
    }

    // Check hot trades
    const hotTradesDoc = await db.doc("market/hotTrades").get()
    if (hotTradesDoc.exists) {
      const hotTrades = hotTradesDoc.data()
      const updatedAt = hotTrades.updatedAt?.toMillis?.() || 0
      const age = Date.now() - updatedAt
      
      if (age > config.thresholds.pipelineRunFreshness) {
        addCheck("intel", "hot_trades_stale", "warning", 
          `Hot trades are ${Math.round(age / 60000)} minutes old`)
      }
    } else {
      addCheck("intel", "hot_trades_missing", "failed", "Hot trades document missing")
    }

    // Check bot signals freshness and zombie detection
    const controlsDoc = await db.doc("market/controls").get()
    const controls = controlsDoc.exists ? controlsDoc.data() : null
    const cryptoEnabled = controls?.cryptoEnabled !== false
    const forexEnabled = controls?.forexEnabled !== false

    const botsSnap = await db.collection("bots").get()
    const foundBotIds = new Set()
    const usMarketOpen = isUsMarketOpenNow()

    for (const botDoc of botsSnap.docs) {
      const bot = botDoc.data()
      foundBotIds.add(botDoc.id)

      // Skip market-intel pseudo-bot (it's a pipeline, not a trading bot)
      if (bot.engine === "market-intel") continue
      const inferredAssetClass =
        bot.desiredConfig?.assetClass ||
        (botDoc.id.includes("crypto") ? "crypto" : botDoc.id.includes("forex") ? "forex" : "stock")
      if (inferredAssetClass === "crypto" && !cryptoEnabled) continue
      if (inferredAssetClass === "forex" && !forexEnabled) continue

      if (inferredAssetClass === "stock" && !usMarketOpen) {
        continue
      }

      const signalsSnap = await db.collection("bots").doc(botDoc.id).collection("signals")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get()

      if (!signalsSnap.empty) {
        const latestSignal = signalsSnap.docs[0].data()
        const signalAge = Date.now() - (latestSignal.createdAt?.toMillis?.() || 0)

        // Check for stale signals (warning after 30 min)
        if (signalAge > config.thresholds.signalFreshness) {
          addCheck("signals", `${botDoc.id}_stale`, "warning",
            `${botDoc.id} signals are ${Math.round(signalAge / 60000)} minutes old`)
        }

        // Zombie detection: bot is "online" but hasn't produced signals in a long time
        const isOnline = bot.status === "online"
        const heartbeatAge = Date.now() - (bot.lastHeartbeat?.toMillis?.() || 0)
        const heartbeatFresh = heartbeatAge < config.thresholds.heartbeatFreshness

        if (isOnline && heartbeatFresh && signalAge > config.zombieThresholdMs) {
          addCheck("bots", `${botDoc.id}_zombie`, "failed",
            `${botDoc.id} is zombie: online with fresh heartbeat but no signals for ${Math.round(signalAge / 60000)} minutes`,
            { lastSignalAge: signalAge, lastHeartbeatAge: heartbeatAge, mode: bot.desiredConfig?.mode })
        }
      } else {
        // Bot has never produced signals
        if (bot.status === "online") {
          addCheck("bots", `${botDoc.id}_no_signals`, "warning",
            `${botDoc.id} is online but has never produced signals`)
        }
      }
    }

    // Check for expected bots that are missing
    for (const expectedBot of config.expectedBots) {
      if (expectedBot.id.includes("crypto") && !cryptoEnabled) continue
      if (expectedBot.id.includes("forex") && !forexEnabled) continue
      if (!foundBotIds.has(expectedBot.id)) {
        const severity = expectedBot.required ? "failed" : "warning"
        addCheck("bots", `${expectedBot.id}_missing`, severity,
          `Expected bot ${expectedBot.id} (${expectedBot.engine}) is not registered`)
      }
    }

    // Check Cloud Run service logs for errors
    console.log("Checking service logs for errors...")
    const serviceErrors = await checkServiceErrors()

    for (const serviceError of serviceErrors) {
      if (serviceError.errorCount >= config.thresholds.errorCountThreshold) {
        // Determine severity based on error patterns
        const hasHttpErrors = serviceError.patterns.some(p => p.httpStatus >= 500)
        const topPattern = serviceError.patterns[0]

        const severity = hasHttpErrors ? "failed" : "warning"
        const message = `${serviceError.service} has ${serviceError.errorCount} errors in last ${config.thresholds.errorLookbackMinutes}min`
        const details = {
          errorCount: serviceError.errorCount,
          topError: topPattern?.sample?.slice(0, 200),
          patterns: serviceError.patterns.map(p => `${p.pattern} (${p.count}x)`).join("; "),
        }

        addCheck("logs", `${serviceError.service}_errors`, severity, message, details)
      }
    }

    // Check Cloud Run job logs for errors
    console.log("Checking job logs for errors...")
    const jobErrors = await checkJobErrors()

    for (const jobError of jobErrors) {
      if (jobError.errorCount >= config.thresholds.errorCountThreshold) {
        const hasHttpErrors = jobError.patterns.some(p => p.httpStatus >= 500)
        const topPattern = jobError.patterns[0]

        const severity = hasHttpErrors ? "failed" : "warning"
        const message = `${jobError.job} has ${jobError.errorCount} errors in last ${config.thresholds.errorLookbackMinutes}min`
        const details = {
          errorCount: jobError.errorCount,
          topError: topPattern?.sample?.slice(0, 200),
          patterns: jobError.patterns.map(p => `${p.pattern} (${p.count}x)`).join("; "),
        }

        addCheck("logs", `${jobError.job}_errors`, severity, message, details)
      }
    }

    // Check Redis pipeline stream for error events
    console.log("Checking pipeline stream for error events...")
    const pipelineErrors = await checkPipelineStreamErrors()

    for (const pipelineError of pipelineErrors) {
      if (pipelineError.errorCount >= config.thresholds.errorCountThreshold) {
        const topSample = pipelineError.samples[0]
        const message = `Pipeline ${pipelineError.stationId} (${pipelineError.eventType}) has ${pipelineError.errorCount} errors in last ${config.thresholds.errorLookbackMinutes}min`
        const details = {
          errorCount: pipelineError.errorCount,
          topError: topSample?.message?.slice(0, 200),
          samples: pipelineError.samples.map(s => `${s.message} (${s.timestamp})`).join("; "),
        }

        addCheck("pipeline_stream", pipelineError.groupKey, "failed", message, details)
      }
    }

  } catch (err) {
    addCheck("system", "verification_error", "failed", `Verification failed: ${err.message}`)
  }

  // Determine overall status
  const hasErrors = results.alerts.some(a => a.severity === "error")
  const hasWarnings = results.alerts.some(a => a.severity === "warning")
  results.overall = hasErrors ? "failed" : hasWarnings ? "warning" : "passed"

  return results
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

async function getAlertRecipients() {
  const emails = []
  try {
    // Check config/alerts for explicit recipients
    const configDoc = await db.doc("config/alerts").get()
    if (configDoc.exists) {
      const alertConfig = configDoc.data()
      if (alertConfig.enabled === false) {
        console.log("Email alerts are disabled in config")
        return []
      }
      if (Array.isArray(alertConfig.recipients)) {
        emails.push(...alertConfig.recipients.filter(e => e && e.includes("@")))
      }
    }
    
    // Fallback: check users collection
    if (emails.length === 0) {
      const usersSnap = await db.collection("users").get()
      usersSnap.docs.forEach(doc => {
        const user = doc.data()
        if (user.email) {
          emails.push(user.email)
        }
      })
    }
  } catch (err) {
    console.error("Failed to fetch alert recipients:", err.message)
  }
  return emails
}

async function shouldSendAlert(alertKey) {
  // Check if we've sent this alert recently
  const alertMetaRef = db.doc("alerts/meta")
  const alertMeta = (await alertMetaRef.get()).data() || {}
  const lastSent = alertMeta[alertKey]?.lastSentAt?.toMillis?.() || 0
  const elapsed = Date.now() - lastSent
  
  return elapsed > config.alertCooldownMs
}

async function markAlertSent(alertKey) {
  const alertMetaRef = db.doc("alerts/meta")
  await alertMetaRef.set({
    [alertKey]: {
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  }, { merge: true })
}

async function sendAlertEmail(results) {
  if (!config.sendgridApiKey) {
    console.log("SendGrid not configured (set SENDGRID_API_KEY), skipping email")
    console.log("ALERT_SUMMARY:", JSON.stringify({
      status: results.overall,
      alertCount: results.alerts.length,
      issues: results.alerts.slice(0, 5).map(a => `${a.severity}:${a.name}`).join(", ")
    }))
    return
  }

  const emails = await getAlertRecipients()
  if (emails.length === 0) {
    console.log("No alert recipients configured, skipping email")
    return
  }

  // Create alert key based on issues
  const alertKey = results.alerts
    .filter(a => a.severity === "error")
    .map(a => `${a.category}:${a.name}`)
    .sort()
    .join("|") || "general_warning"

  // Check cooldown
  if (!(await shouldSendAlert(alertKey))) {
    console.log(`Alert "${alertKey}" in cooldown, skipping email`)
    return
  }

  // Build email content
  const errorAlerts = results.alerts.filter(a => a.severity === "error")
  const warningAlerts = results.alerts.filter(a => a.severity === "warning")

  const subject = results.overall === "failed"
    ? "🚨 RelayOrb Pipeline ALERT - Action Required"
    : "⚠️ RelayOrb Pipeline Warning"

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: ${results.overall === "failed" ? "#dc2626" : "#f59e0b"}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9fafb; }
    .alert { padding: 12px; margin: 10px 0; border-radius: 6px; }
    .error { background: #fee2e2; border-left: 4px solid #dc2626; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .footer { padding: 20px; color: #666; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin:0">${results.overall === "failed" ? "🚨 Pipeline Alert" : "⚠️ Pipeline Warning"}</h1>
    <p style="margin:10px 0 0 0">Detected at ${new Date(results.timestamp).toLocaleString()}</p>
  </div>
  
  <div class="content">
    ${errorAlerts.length > 0 ? `
      <h2>❌ Critical Issues (${errorAlerts.length})</h2>
      ${errorAlerts.map(a => `
        <div class="alert error">
          <strong>[${a.category}] ${a.name}</strong><br>
          ${a.message}
        </div>
      `).join("")}
    ` : ""}
    
    ${warningAlerts.length > 0 ? `
      <h2>⚠️ Warnings (${warningAlerts.length})</h2>
      ${warningAlerts.map(a => `
        <div class="alert warning">
          <strong>[${a.category}] ${a.name}</strong><br>
          ${a.message}
        </div>
      `).join("")}
    ` : ""}
    
    <h2>🔧 Recommended Actions</h2>
    <ul>
      ${errorAlerts.some(a => a.category === "services") ? "<li>Check Cloud Run service logs for errors</li>" : ""}
      ${errorAlerts.some(a => a.category === "prices") ? "<li>Verify relayorb-price-streamer is running and market-data providers are healthy</li>" : ""}
      ${errorAlerts.some(a => a.name.includes("_stale")) ? "<li>Check if scheduled jobs are running on time</li>" : ""}
      <li>Run verification: <code>node scripts/verify-pipeline.cjs</code></li>
      <li>View logs: <a href="https://console.cloud.google.com/logs?project=relayorb">Cloud Console</a></li>
    </ul>
  </div>
  
  <div class="footer">
    <p>This is an automated alert from RelayOrb Pipeline Monitoring.</p>
    <p>To change recipients, update <code>config/alerts</code> in Firestore.</p>
  </div>
</body>
</html>
`

  try {
    const msg = {
      to: emails,
      from: config.fromEmail,
      subject,
      html,
    }
    
    await sgMail.send(msg)
    console.log(`Alert email sent to ${emails.length} recipients: ${emails.join(", ")}`)
    await markAlertSent(alertKey)
  } catch (err) {
    console.error("Failed to send alert email:", err.message)
    if (err.response) {
      console.error("SendGrid error details:", err.response.body)
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("Pipeline alerts check starting...")
  
  const results = await runVerification()
  
  console.log(`Verification complete: ${results.overall}`)
  console.log(`  Checks: ${results.checks.length}`)
  console.log(`  Alerts: ${results.alerts.length}`)
  
  // Log verification results to Firestore
  await db.doc("alerts/last_verification").set({
    ...results,
    runAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(err => console.error("Failed to save verification results:", err.message))
  
  // Send email if there are issues
  if (results.overall !== "passed") {
    await sendAlertEmail(results)
  } else {
    console.log("Pipeline healthy, no alerts to send")
  }

  // Clean up Redis connection
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit().catch(err => console.error("Failed to close Redis:", err.message))
  }

  console.log("Pipeline alerts check complete")
}

main().catch(async (err) => {
  console.error("Pipeline alerts failed:", err)
  // Clean up Redis connection on error
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit().catch(e => console.error("Failed to close Redis:", e.message))
  }
  process.exit(1)
})
