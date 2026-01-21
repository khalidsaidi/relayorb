/**
 * IBKR Executor Service (Option A: 3 Accounts)
 *
 * This service is deployed 3 times, each with a different BROKER_ACCOUNT_KEY:
 *   - ibkr-executor-acct1 with BROKER_ACCOUNT_KEY=acct1
 *   - ibkr-executor-acct2 with BROKER_ACCOUNT_KEY=acct2
 *   - ibkr-executor-acct3 with BROKER_ACCOUNT_KEY=acct3
 *
 * Uses @stoqey/ib for IBKR TWS/Gateway connection.
 * Reference: https://github.com/stoqey/ib
 */

const { IBApi, EventName, SecType, OrderType, OrderAction } = require("@stoqey/ib")
const admin = require("firebase-admin")
const http = require("http")
const crypto = require("crypto")

// ============================================================================
// Configuration
// ============================================================================

const config = {
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "relayorb",
  brokerAccountKey: process.env.BROKER_ACCOUNT_KEY || "",
  port: parseInt(process.env.PORT || "8080", 10),
  sessionId: `executor-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || "30000", 10),
  claimTimeoutMs: parseInt(process.env.CLAIM_TIMEOUT_MS || "5000", 10),
  requestExpiryMs: parseInt(process.env.REQUEST_EXPIRY_MS || "60000", 10),
  ibReconnectDelayMs: parseInt(process.env.IB_RECONNECT_DELAY_MS || "5000", 10),
  ibOrderDelayMs: parseInt(process.env.IB_ORDER_DELAY_MS || "50", 10), // Delay between parent and child orders
}

// Validate required config
if (!config.brokerAccountKey || !["acct1", "acct2", "acct3"].includes(config.brokerAccountKey)) {
  console.error("FATAL: BROKER_ACCOUNT_KEY must be one of: acct1, acct2, acct3")
  process.exit(1)
}

// ============================================================================
// Firebase Initialization
// ============================================================================

if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId })
}

const db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

// ============================================================================
// State
// ============================================================================

const state = {
  brokerAccount: null,
  tradingControls: null,
  replayControls: null,
  listening: false,
  unsubscribe: null,
  lastHeartbeat: null,
  claimedRequests: new Map(),
  // IBKR connection state
  ib: null,
  ibConnected: false,
  ibNextOrderId: null,
  ibAccount: null,
  contractCache: new Map(), // symbol -> contract with conId
  pendingContracts: new Map(), // reqId -> { resolve, reject, symbol }
  pendingOrders: new Map(), // orderId -> { requestId, type }
  ibMode: null,
  stats: {
    claimed: 0,
    submitted: 0,
    filled: 0,
    rejected: 0,
    errors: 0,
  },
  startedAt: null,
}

// ============================================================================
// Firestore Loaders
// ============================================================================

async function loadBrokerAccount() {
  // Firestore path: brokerAccounts/{brokerAccountKey}
  const ref = db.doc(`brokerAccounts/${config.brokerAccountKey}`)
  const snap = await ref.get()
  if (!snap.exists) {
    console.warn(`Broker account ${config.brokerAccountKey} not found in Firestore`)
    return null
  }
  return snap.data()
}

async function loadTradingControls() {
  const ref = db.doc("trading/controls")
  const snap = await ref.get()
  if (!snap.exists) {
    console.warn("Trading controls not found in Firestore")
    return null
  }
  return snap.data()
}

async function loadReplayControls() {
  const ref = db.doc("replay/controls")
  const snap = await ref.get()
  if (!snap.exists) return null
  return snap.data()
}

function isReplayMode() {
  if (!state.replayControls) return false
  return state.replayControls.desiredMode === "replay"
}

// ============================================================================
// IBKR Connection Management
// ============================================================================

function getIbPort(mode) {
  if (!state.brokerAccount) return 4002 // Default paper port
  return mode === "live"
    ? state.brokerAccount.gatewayPortLive || 4001
    : state.brokerAccount.gatewayPortPaper || 4002
}

function getIbClientId(mode) {
  if (!state.brokerAccount) return 1
  return mode === "live"
    ? state.brokerAccount.clientIdLive || 1
    : state.brokerAccount.clientIdPaper || 1
}

function connectToIb(mode = "paper") {
  if (state.ib) {
    try {
      state.ib.disconnect()
    } catch (e) {
      // ignore
    }
  }

  const host = state.brokerAccount?.gatewayHost || "127.0.0.1"
  const port = getIbPort(mode)
  const clientId = getIbClientId(mode)

  state.ibMode = mode
  console.log(`Connecting to IBKR Gateway (${mode}) at ${host}:${port} with clientId ${clientId}`)

  state.ib = new IBApi({
    host,
    port,
    clientId,
  })

  // Connection events
  state.ib.on(EventName.connected, () => {
    console.log("IBKR: Connected")
    state.ibConnected = true
    state.ib.reqIds()
  })

  state.ib.on(EventName.disconnected, () => {
    console.log("IBKR: Disconnected")
    state.ibConnected = false
    state.ibNextOrderId = null
    // Schedule reconnect
    setTimeout(() => {
      if (!state.ibConnected && state.brokerAccount?.enabled) {
        connectToIb(state.ibMode || "paper")
      }
    }, config.ibReconnectDelayMs)
  })

  state.ib.on(EventName.error, (err, code, reqId) => {
    console.error(`IBKR Error: ${err?.message || err} (code: ${code}, reqId: ${reqId})`)

    // Handle specific error codes
    if (code === 502) {
      // "Couldn't connect to TWS"
      state.ibConnected = false
    } else if (code === 10006) {
      // "Missing parent order" - need to add delay
      console.warn("IBKR: Missing parent order error - may need longer delay")
    }
  })

  // Next valid order ID
  state.ib.on(EventName.nextValidId, (orderId) => {
    console.log(`IBKR: Next valid order ID: ${orderId}`)
    state.ibNextOrderId = orderId
  })

  // Contract details response
  state.ib.on(EventName.contractDetails, (reqId, contractDetails) => {
    const pending = state.pendingContracts.get(reqId)
    if (pending) {
      const contract = contractDetails.contract
      console.log(`IBKR: Contract resolved for ${pending.symbol}: conId=${contract.conId}`)
      state.contractCache.set(pending.cacheKey, contract)
      pending.resolve(contract)
      state.pendingContracts.delete(reqId)
    }
  })

  state.ib.on(EventName.contractDetailsEnd, (reqId) => {
    const pending = state.pendingContracts.get(reqId)
    if (pending && !state.contractCache.has(pending.cacheKey)) {
      pending.reject(new Error(`Contract not found for ${pending.symbol}`))
      state.pendingContracts.delete(reqId)
    }
  })

  // Order status updates
  state.ib.on(EventName.orderStatus, (orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice) => {
    console.log(`IBKR OrderStatus: orderId=${orderId} status=${status} filled=${filled} remaining=${remaining} avgFillPrice=${avgFillPrice}`)

    const pending = state.pendingOrders.get(orderId)
    if (pending) {
      updateOrderStatus(pending.requestId, orderId, status, filled, avgFillPrice).catch(err => {
        console.error(`Failed to update order status: ${err.message}`)
      })
    }
  })

  // Execution details
  state.ib.on(EventName.execDetails, (reqId, contract, execution) => {
    console.log(`IBKR ExecDetails: orderId=${execution.orderId} execId=${execution.execId} shares=${execution.shares} price=${execution.price}`)
  })

  // Managed accounts
  state.ib.on(EventName.managedAccounts, (accountsList) => {
    const accounts = accountsList.split(",").map(a => a.trim()).filter(Boolean)
    console.log(`IBKR: Managed accounts: ${accounts.join(", ")}`)
    if (accounts.length > 0) {
      state.ibAccount = accounts[0]
    }
  })

  try {
    state.ib.connect()
  } catch (err) {
    console.error(`IBKR connect failed: ${err.message}`)
    state.ibConnected = false
  }
}

async function waitForIbConnection(timeoutMs = 10000) {
  const startedAt = Date.now()
  while (!state.ibConnected) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("IBKR connection timeout")
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

async function ensureIbConnection(mode) {
  if (state.ibConnected && state.ibMode === mode) return
  connectToIb(mode)
  await waitForIbConnection()
}

// ============================================================================
// Contract Resolution
// ============================================================================

function parseAssetKey(assetKey, fallbackSymbol) {
  if (!assetKey || typeof assetKey !== "string") {
    return { assetClass: "stock", symbol: fallbackSymbol }
  }
  const [assetClass, symbol] = assetKey.split(":")
  return {
    assetClass: assetClass || "stock",
    symbol: symbol || fallbackSymbol,
  }
}

async function resolveContract(assetKey, fallbackSymbol) {
  const parsed = parseAssetKey(assetKey, fallbackSymbol)
  const symbol = parsed.symbol
  const assetClass = parsed.assetClass
  if (!symbol) {
    throw new Error("Missing symbol for contract resolution")
  }
  if (assetClass !== "stock") {
    throw new Error(`Unsupported asset class for IBKR: ${assetClass}`)
  }
  const secType = SecType.STK
  const cacheKey = assetKey || `stock:${symbol}`

  // Check cache first
  const cached = state.contractCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Check Firestore cache
  // Firestore path: brokerInstruments/{assetKey}
  const cacheRef = db.doc(`brokerInstruments/${cacheKey}`)
  const cacheSnap = await cacheRef.get()
  if (cacheSnap.exists) {
    const data = cacheSnap.data()
    if (data.conId) {
      const contract = {
        conId: data.conId,
        symbol: data.symbol || symbol,
        secType: data.secType || secType,
        exchange: data.exchange || "SMART",
        currency: data.currency || "USD",
        primaryExch: data.primaryExch,
      }
      state.contractCache.set(cacheKey, contract)
      return contract
    }
  }

  // Request from IBKR
  if (!state.ibConnected || !state.ib) {
    throw new Error("IBKR not connected")
  }

  const reqId = Math.floor(Math.random() * 1000000)
  const contract = {
    symbol: symbol.replace(".TO", ""), // Strip TSX suffix if present
    secType,
    exchange: "SMART",
    currency: "USD",
    primaryExch: symbol.endsWith(".TO") ? "TSE" : undefined,
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      state.pendingContracts.delete(reqId)
      reject(new Error(`Contract resolution timeout for ${symbol}`))
    }, 10000)

    state.pendingContracts.set(reqId, {
      symbol,
      cacheKey,
      resolve: (resolvedContract) => {
        clearTimeout(timeout)
        // Cache to Firestore
        cacheRef.set({
          assetKey: cacheKey,
          symbol,
          conId: resolvedContract.conId,
          secType: resolvedContract.secType,
          exchange: resolvedContract.exchange,
          currency: resolvedContract.currency,
          primaryExch: resolvedContract.primaryExch,
          cachedAt: FieldValue.serverTimestamp(),
        }, { merge: true }).catch(err => {
          console.warn(`Failed to cache contract: ${err.message}`)
        })
        state.contractCache.set(cacheKey, resolvedContract)
        resolve(resolvedContract)
      },
      reject: (err) => {
        clearTimeout(timeout)
        reject(err)
      },
    })

    state.ib.reqContractDetails(reqId, contract)
  })
}

// ============================================================================
// Order Submission
// ============================================================================

async function updateOrderStatus(requestId, orderId, status, filledQty, avgPrice) {
  const requestRef = db.doc(`executionRequests/${requestId}`)
  const brokerOrderRef = db.doc(`brokerOrders/${requestId}`)

  const statusMap = {
    "PreSubmitted": "working",
    "Submitted": "working",
    "Filled": "filled",
    "Cancelled": "cancelled",
    "Inactive": "error",
    "PendingSubmit": "submitted",
    "PendingCancel": "working",
    "ApiCanceled": "cancelled",
    "ApiPending": "submitted",
  }

  const mappedStatus = statusMap[status] || "working"

  const update = {
    status: mappedStatus,
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (mappedStatus === "filled") {
    update.filledAt = FieldValue.serverTimestamp()
    state.stats.filled++
  }

  await Promise.all([
    requestRef.update(update),
    brokerOrderRef.update({
      status: mappedStatus,
      filledQuantity: filledQty,
      avgFillPrice: avgPrice,
      lastUpdateAt: FieldValue.serverTimestamp(),
    }),
  ])
}

function getNextOrderId() {
  if (state.ibNextOrderId === null) {
    throw new Error("No valid order ID available")
  }
  const orderId = state.ibNextOrderId
  state.ibNextOrderId++
  return orderId
}

async function submitBracketOrder(request, contract) {
  const snapshot = request.orderSnapshot
  const parentOrderId = getNextOrderId()
  const tpOrderId = getNextOrderId()
  const slOrderId = getNextOrderId()

  const action = snapshot.side === "buy" ? OrderAction.BUY : OrderAction.SELL
  const reverseAction = snapshot.side === "buy" ? OrderAction.SELL : OrderAction.BUY

  // Track orders
  state.pendingOrders.set(parentOrderId, { requestId: request.id, type: "parent" })
  state.pendingOrders.set(tpOrderId, { requestId: request.id, type: "takeProfit" })
  state.pendingOrders.set(slOrderId, { requestId: request.id, type: "stopLoss" })

  // Parent order (entry)
  const parentOrder = {
    orderId: parentOrderId,
    action,
    orderType: snapshot.orderType === "limit" ? OrderType.LMT : OrderType.MKT,
    totalQuantity: snapshot.quantity,
    lmtPrice: snapshot.limitPrice,
    account: state.ibAccount || state.brokerAccount?.ibAccountCode,
    transmit: false, // Don't transmit until all orders are placed
    tif: snapshot.timeInForce || "DAY",
  }

  // Take profit order
  const tpOrder = {
    orderId: tpOrderId,
    action: reverseAction,
    orderType: OrderType.LMT,
    totalQuantity: snapshot.quantity,
    lmtPrice: snapshot.takeProfit,
    parentId: parentOrderId,
    account: state.ibAccount || state.brokerAccount?.ibAccountCode,
    transmit: false,
    tif: "GTC",
  }

  // Stop loss order
  const slOrder = {
    orderId: slOrderId,
    action: reverseAction,
    orderType: OrderType.STP,
    totalQuantity: snapshot.quantity,
    auxPrice: snapshot.stopLoss, // Stop price
    parentId: parentOrderId,
    account: state.ibAccount || state.brokerAccount?.ibAccountCode,
    transmit: true, // This triggers transmission of all orders
    tif: "GTC",
  }

  console.log(`Submitting bracket order for ${snapshot.symbol}:`)
  console.log(`  Parent: orderId=${parentOrderId} ${action} ${snapshot.quantity} @ ${snapshot.limitPrice}`)
  console.log(`  TP: orderId=${tpOrderId} ${reverseAction} @ ${snapshot.takeProfit}`)
  console.log(`  SL: orderId=${slOrderId} ${reverseAction} @ ${snapshot.stopLoss}`)

  // Place parent order
  state.ib.placeOrder(parentOrderId, contract, parentOrder)

  // Small delay to ensure parent is processed (IB recommendation)
  await new Promise(resolve => setTimeout(resolve, config.ibOrderDelayMs))

  // Place take profit order
  state.ib.placeOrder(tpOrderId, contract, tpOrder)

  // Small delay
  await new Promise(resolve => setTimeout(resolve, config.ibOrderDelayMs))

  // Place stop loss order (this transmits all)
  state.ib.placeOrder(slOrderId, contract, slOrder)

  return {
    parentOrderId,
    tpOrderId,
    slOrderId,
    orderIds: [parentOrderId, tpOrderId, slOrderId],
  }
}

async function submitOrder(request) {
  const snapshot = request.orderSnapshot
  console.log(`Submitting order for ${snapshot.symbol}`)

  const mode = request.mode === "live" ? "live" : "paper"
  await ensureIbConnection(mode)

  // Resolve contract
  const contract = await resolveContract(snapshot.assetKey, snapshot.symbol)

  // Check if bracket order is required
  const requireBracket = state.tradingControls?.requireBracket
  if (requireBracket && (!snapshot.stopLoss || !snapshot.takeProfit)) {
    throw new Error("Bracket required but SL/TP not provided")
  }

  let orderResult
  if (snapshot.stopLoss && snapshot.takeProfit) {
    orderResult = await submitBracketOrder(request, contract)
  } else {
    // Simple order without bracket
    const orderId = getNextOrderId()
    const action = snapshot.side === "buy" ? OrderAction.BUY : OrderAction.SELL

    const order = {
      orderId,
      action,
      orderType: snapshot.orderType === "limit" ? OrderType.LMT : OrderType.MKT,
      totalQuantity: snapshot.quantity,
      lmtPrice: snapshot.limitPrice,
      account: state.ibAccount || state.brokerAccount?.ibAccountCode,
      transmit: true,
      tif: snapshot.timeInForce || "DAY",
    }

    state.pendingOrders.set(orderId, { requestId: request.id, type: "single" })
    state.ib.placeOrder(orderId, contract, order)
    orderResult = { parentOrderId: orderId, orderIds: [orderId] }
  }

  // Update Firestore
  const requestRef = db.doc(`executionRequests/${request.id}`)
  const brokerOrderRef = db.doc(`brokerOrders/${request.id}`)

  await requestRef.update({
    status: "submitted",
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await brokerOrderRef.set({
    id: request.id,
    brokerAccountKey: config.brokerAccountKey,
    ibAccountCode: state.ibAccount || state.brokerAccount?.ibAccountCode,
    gatewayInstanceId: `${config.brokerAccountKey}:${state.ibMode || mode}`,
    executionRequestId: request.id,
    conId: contract.conId,
    parentOrderId: orderResult.parentOrderId,
    tpOrderId: orderResult.tpOrderId || null,
    slOrderId: orderResult.slOrderId || null,
    orderIds: orderResult.orderIds,
    status: "submitted",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  })

  return { success: true, ...orderResult }
}

// ============================================================================
// Claim Transaction (Atomic)
// ============================================================================

async function claimRequest(requestId) {
  const requestRef = db.doc(`executionRequests/${requestId}`)

  try {
    const result = await db.runTransaction(async (transaction) => {
      const requestSnap = await transaction.get(requestRef)
      if (!requestSnap.exists) {
        return { success: false, reason: "request_not_found" }
      }

      const request = requestSnap.data()

      // Check 1: status == "approved"
      if (request.status !== "approved") {
        return { success: false, reason: `invalid_status:${request.status}` }
      }

      // Check 2: expiresAt > now
      const now = Date.now()
      const expiresAtMs = request.expiresAt?.toMillis?.() || 0
      if (expiresAtMs <= now) {
        return { success: false, reason: "expired" }
      }

      // Check 3: brokerAccountKey matches
      if (request.brokerAccountKey !== config.brokerAccountKey) {
        return { success: false, reason: "account_mismatch" }
      }

      // Check 4: approvedByUid in allowedUids
      if (!state.brokerAccount?.allowedUids?.includes(request.approvedByUid)) {
        return { success: false, reason: "uid_not_allowed" }
      }

      // Check 5: trading/controls.ibkrEnabled == true
      if (!state.tradingControls?.ibkrEnabled) {
        return { success: false, reason: "ibkr_disabled" }
      }

      // Check 6: trading/controls.killSwitch == false
      if (state.tradingControls?.killSwitch) {
        return { success: false, reason: "kill_switch_active" }
      }

      // Check 7: brokerAccounts.enabled == true
      if (!state.brokerAccount?.enabled) {
        return { success: false, reason: "account_disabled" }
      }

      // Check 8: mode live requires liveEnabled; mode paper requires paperEnabled
      const mode = request.mode || "paper"
      if (mode === "live" && !state.brokerAccount?.liveEnabled) {
        return { success: false, reason: "live_not_enabled" }
      }
      if (mode === "paper" && !state.brokerAccount?.paperEnabled) {
        return { success: false, reason: "paper_not_enabled" }
      }

      // Check 9: Replay guard
      if (isReplayMode()) {
        return { success: false, reason: "replay_mode_active" }
      }

      // All checks passed - claim the request
      transaction.update(requestRef, {
        status: "claimed",
        claimedAt: FieldValue.serverTimestamp(),
        claimedBy: config.brokerAccountKey,
        claimSessionId: config.sessionId,
        updatedAt: FieldValue.serverTimestamp(),
      })

      return { success: true, request: { id: requestId, ...request } }
    })

    return result
  } catch (err) {
    console.error(`Claim transaction failed for ${requestId}:`, err.message)
    return { success: false, reason: `transaction_error:${err.message}` }
  }
}

// ============================================================================
// Risk Checks
// ============================================================================

function checkRiskLimits(request) {
  const caps = state.tradingControls?.caps || {}
  const snapshot = request.orderSnapshot || {}

  // Check max notional per trade
  const notional = (snapshot.quantity || 0) * (snapshot.limitPrice || 0)
  if (caps.maxNotionalPerTrade && notional > caps.maxNotionalPerTrade) {
    return { pass: false, reason: `notional_exceeds_limit:${notional}>${caps.maxNotionalPerTrade}` }
  }

  // Check requireBracket
  if (state.tradingControls?.requireBracket) {
    if (!snapshot.stopLoss || !snapshot.takeProfit) {
      return { pass: false, reason: "bracket_required" }
    }
  }

  // Check limitOnly
  if (state.tradingControls?.limitOnly && snapshot.orderType !== "limit") {
    return { pass: false, reason: "limit_only_required" }
  }

  return { pass: true }
}

// ============================================================================
// Request Processing
// ============================================================================

async function processRequest(requestId, requestData) {
  console.log(`Processing request ${requestId}`)

  // Refresh state before claiming
  state.brokerAccount = await loadBrokerAccount()
  state.tradingControls = await loadTradingControls()
  state.replayControls = await loadReplayControls()

  // Attempt to claim
  const claimResult = await claimRequest(requestId)
  if (!claimResult.success) {
    console.log(`Claim failed for ${requestId}: ${claimResult.reason}`)
    if (claimResult.reason.startsWith("invalid_status") || claimResult.reason === "expired") {
      return
    }
    state.stats.rejected++
    return
  }

  state.stats.claimed++
  state.claimedRequests.set(requestId, claimResult.request)

  // Risk checks
  const riskCheck = checkRiskLimits(claimResult.request)
  if (!riskCheck.pass) {
    console.log(`Risk check failed for ${requestId}: ${riskCheck.reason}`)
    const requestRef = db.doc(`executionRequests/${requestId}`)
    await requestRef.update({
      status: "rejected",
      statusReason: riskCheck.reason,
      rejectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    state.stats.rejected++
    return
  }

  // Submit order
  try {
    const submitResult = await submitOrder(claimResult.request)
    if (submitResult.success) {
      state.stats.submitted++
      console.log(`Order submitted for ${requestId}: orderIds=${submitResult.orderIds.join(",")}`)
    } else {
      state.stats.errors++
    }
  } catch (err) {
    console.error(`Order submission failed for ${requestId}:`, err.message)
    const requestRef = db.doc(`executionRequests/${requestId}`)
    await requestRef.update({
      status: "error",
      statusReason: err.message,
      updatedAt: FieldValue.serverTimestamp(),
    })
    state.stats.errors++
  }
}

// ============================================================================
// Firestore Listener
// ============================================================================

function startListening() {
  if (state.listening) return

  const query = db
    .collection("executionRequests")
    .where("status", "==", "approved")
    .where("brokerAccountKey", "==", config.brokerAccountKey)
    .where("expiresAt", ">", admin.firestore.Timestamp.now())

  state.unsubscribe = query.onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const requestId = change.doc.id
          const requestData = change.doc.data()

          if (requestData.status === "approved") {
            processRequest(requestId, requestData).catch((err) => {
              console.error(`Request processing error for ${requestId}:`, err.message)
            })
          }
        }
      })
    },
    (error) => {
      console.error("Firestore listener error:", error.message)
      state.listening = false
      setTimeout(startListening, 5000)
    }
  )

  state.listening = true
  console.log(`Listening for execution requests for account: ${config.brokerAccountKey}`)
}

function stopListening() {
  if (state.unsubscribe) {
    state.unsubscribe()
    state.unsubscribe = null
  }
  state.listening = false
}

// ============================================================================
// Health Endpoint
// ============================================================================

function buildHealthPayload() {
  return {
    service: "ibkr-executor",
    brokerAccountKey: config.brokerAccountKey,
    sessionId: config.sessionId,
    status: state.listening ? "listening" : "idle",
    ibkr: {
      connected: state.ibConnected,
      account: state.ibAccount,
      nextOrderId: state.ibNextOrderId,
      contractsCached: state.contractCache.size,
      pendingOrders: state.pendingOrders.size,
      mode: state.ibMode || "paper",
      gatewayHost: state.brokerAccount?.gatewayHost || null,
      gatewayPort: getIbPort(state.ibMode || "paper"),
    },
    brokerAccountEnabled: state.brokerAccount?.enabled ?? false,
    tradingEnabled: state.tradingControls?.ibkrEnabled ?? false,
    killSwitch: state.tradingControls?.killSwitch ?? true,
    replayMode: isReplayMode(),
    stats: state.stats,
    lastHeartbeat: state.lastHeartbeat,
    uptimeMs: Date.now() - (state.startedAt || Date.now()),
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    const path = (req.url || "/").split("?")[0]
    if (path === "/" || path === "/healthz" || path === "/readyz") {
      const payload = buildHealthPayload()
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      })
      res.end(JSON.stringify(payload))
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("Not found")
  })

  server.listen(config.port, () => {
    console.log(`Health server listening on port ${config.port}`)
  })

  return server
}

// ============================================================================
// Heartbeat
// ============================================================================

async function writeHeartbeat() {
  try {
    const ref = db.doc(`executor_consumers/${config.brokerAccountKey}`)
    await ref.set(
      {
        brokerAccountKey: config.brokerAccountKey,
        sessionId: config.sessionId,
        lastHeartbeat: FieldValue.serverTimestamp(),
        status: state.listening ? "listening" : "idle",
        ibConnected: state.ibConnected,
        ibAccount: state.ibAccount,
        stats: state.stats,
      },
      { merge: true }
    )
    state.lastHeartbeat = new Date().toISOString()
  } catch (err) {
    console.error("Heartbeat write failed:", err.message)
  }
}

// ============================================================================
// Main
// ============================================================================

async function run() {
  state.startedAt = Date.now()
  console.log(`IBKR Executor starting for account: ${config.brokerAccountKey}`)
  console.log(`Session ID: ${config.sessionId}`)

  // Load initial state
  state.brokerAccount = await loadBrokerAccount()
  state.tradingControls = await loadTradingControls()
  state.replayControls = await loadReplayControls()

  if (!state.brokerAccount) {
    console.warn(`Broker account ${config.brokerAccountKey} not configured - executor will wait`)
  } else {
    console.log(`Broker account loaded: ${state.brokerAccount.ibAccountCode || "N/A"}`)
    console.log(`  Enabled: ${state.brokerAccount.enabled}`)
    console.log(`  Paper enabled: ${state.brokerAccount.paperEnabled}`)
    console.log(`  Live enabled: ${state.brokerAccount.liveEnabled}`)
    console.log(`  Gateway: ${state.brokerAccount.gatewayHost}:${getIbPort(state.ibMode || "paper")}`)

    // Connect to IBKR if enabled
    if (state.brokerAccount.enabled) {
      connectToIb(state.ibMode || "paper")
    }
  }

  if (state.tradingControls) {
    console.log("Trading controls loaded:")
    console.log(`  IBKR enabled: ${state.tradingControls.ibkrEnabled}`)
    console.log(`  Kill switch: ${state.tradingControls.killSwitch}`)
    console.log(`  Require manual confirm: ${state.tradingControls.requireManualConfirm}`)
    console.log(`  Require bracket: ${state.tradingControls.requireBracket}`)
  }

  // Start health server
  startServer()

  // Start listening for requests
  startListening()

  // Periodic heartbeat
  setInterval(writeHeartbeat, config.heartbeatIntervalMs)
  writeHeartbeat()

  // Periodic state refresh
  setInterval(async () => {
    state.brokerAccount = await loadBrokerAccount()
    state.tradingControls = await loadTradingControls()
    state.replayControls = await loadReplayControls()

    // Reconnect to IBKR if needed
    if (state.brokerAccount?.enabled && !state.ibConnected) {
      connectToIb(state.ibMode || "paper")
    }
  }, 60000)
}

run().catch((err) => {
  console.error("Executor startup failed:", err.message)
  process.exit(1)
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down executor...")
  stopListening()
  if (state.ib) {
    state.ib.disconnect()
  }
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.log("Shutting down executor...")
  stopListening()
  if (state.ib) {
    state.ib.disconnect()
  }
  process.exit(0)
})
