#!/usr/bin/env node
/**
 * Pipeline Verification Script
 * 
 * Comprehensive end-to-end verification of the RelayOrb trading pipeline.
 * Checks every component, validates business logic, and reports issues.
 * 
 * Usage:
 *   node scripts/verify-pipeline.js [--json] [--fix] [--verbose]
 * 
 * Options:
 *   --json     Output results as JSON
 *   --fix      Attempt to fix issues where possible
 *   --verbose  Show detailed logs
 */

const admin = require("firebase-admin")

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Freshness thresholds (in ms)
  thresholds: {
    signalFreshness: 30 * 60 * 1000,      // 30 minutes - signals should be recent
    priceFreshness: 5 * 60 * 1000,        // 5 minutes - prices should be very fresh
    pipelineRunFreshness: 10 * 60 * 1000, // 10 minutes - market intel should run frequently
    botPollFreshness: 5 * 60 * 1000,      // 5 minutes - bots should be polled frequently
    heartbeatFreshness: 10 * 60 * 1000,   // 10 minutes - services should heartbeat
  },
  
  // Expected ranges for sanity checks
  sanityRanges: {
    btcPrice: { min: 10000, max: 500000 },
    ethPrice: { min: 500, max: 50000 },
    stockPrice: { min: 0.01, max: 10000 },
    score: { min: 0, max: 100 },
  },
  
  // Minimum expected counts
  minimums: {
    hotTradesCount: 1,
    signalsPerBot: 1,
    pricesCount: 1,
  },
}

// ============================================================================
// INITIALIZATION
// ============================================================================

const args = process.argv.slice(2)
const JSON_OUTPUT = args.includes("--json")
const VERBOSE = args.includes("--verbose")
const FIX_MODE = args.includes("--fix")

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "relayorb",
  })
}
const db = admin.firestore()

// ============================================================================
// RESULT TRACKING
// ============================================================================

const results = {
  timestamp: new Date().toISOString(),
  overall: "unknown",
  summary: {
    passed: 0,
    warnings: 0,
    failed: 0,
    skipped: 0,
  },
  checks: [],
  alerts: [],
  recommendations: [],
}

function log(...args) {
  if (!JSON_OUTPUT) console.log(...args)
}

function logVerbose(...args) {
  if (VERBOSE && !JSON_OUTPUT) console.log("  [verbose]", ...args)
}

function addCheck(category, name, status, message, details = {}) {
  const check = { category, name, status, message, details, timestamp: new Date().toISOString() }
  results.checks.push(check)
  results.summary[status] = (results.summary[status] || 0) + 1
  
  const icon = status === "passed" ? "✅" : status === "warning" ? "⚠️" : status === "failed" ? "❌" : "⏭️"
  log(`${icon} [${category}] ${name}: ${message}`)
  
  if (status === "failed") {
    results.alerts.push({ severity: "error", category, name, message, details })
  } else if (status === "warning") {
    results.alerts.push({ severity: "warning", category, name, message, details })
  }
}

function addRecommendation(priority, message) {
  results.recommendations.push({ priority, message })
}

// ============================================================================
// CHECK 1: SERVICE HEALTH
// ============================================================================

async function checkServiceHealth() {
  log("\n📊 Checking Service Health...")
  
  try {
    const statusDoc = await db.doc("pipeline/status").get()
    
    if (!statusDoc.exists) {
      addCheck("services", "pipeline_status", "failed", 
        "Pipeline status document does not exist - services not reporting health")
      return
    }
    
    const status = statusDoc.data()
    const now = Date.now()
    
    // Check overall pipeline status
    if (status.status === "ok") {
      addCheck("services", "pipeline_overall", "passed", "Pipeline status is OK")
    } else if (status.status === "degraded") {
      addCheck("services", "pipeline_overall", "warning", 
        `Pipeline is degraded: ${status.summary?.degraded || 0} degraded, ${status.summary?.error || 0} errors`)
    } else {
      addCheck("services", "pipeline_overall", "failed", 
        `Pipeline status is ${status.status}`, { summary: status.summary })
    }
    
    // Check each service
    const services = status.services || {}
    
    for (const [serviceName, service] of Object.entries(services)) {
      const displayName = serviceName.replace(/_/g, " ")
      
      // Check service status
      if (service.status === "ok") {
        addCheck("services", `${serviceName}_status`, "passed", `${displayName} is healthy`)
      } else if (service.status === "degraded" || service.status === "stale") {
        addCheck("services", `${serviceName}_status`, "warning", 
          `${displayName} is ${service.status}`, { details: service.details })
      } else {
        addCheck("services", `${serviceName}_status`, "failed", 
          `${displayName} status is ${service.status}`, { details: service.details })
      }
      
      // Check freshness
      if (service.ageMs !== null && service.ageMs !== undefined) {
        if (service.ageMs > CONFIG.thresholds.heartbeatFreshness) {
          addCheck("services", `${serviceName}_freshness`, "failed", 
            `${displayName} last seen ${Math.round(service.ageMs / 60000)} minutes ago`)
        } else {
          logVerbose(`${displayName} last seen ${Math.round(service.ageMs / 1000)}s ago`)
        }
      }
      
      // Check service-specific details
      if (serviceName === "relayorb_agent" && service.details?.bots) {
        await checkBotHealth(service.details.bots)
      }
      
      if (serviceName === "price_streamer" && service.details) {
        await checkPriceStreamerHealth(service.details)
      }
    }
    
  } catch (err) {
    addCheck("services", "pipeline_status", "failed", `Failed to read pipeline status: ${err.message}`)
  }
}

async function checkBotHealth(bots) {
  log("\n🤖 Checking Bot Health...")
  
  for (const [botId, bot] of Object.entries(bots)) {
    // Check bot status
    if (bot.status === "online" && !bot.isStale) {
      addCheck("bots", `${botId}_status`, "passed", `${botId} is online and fresh`)
    } else if (bot.isStale) {
      addCheck("bots", `${botId}_status`, "warning", 
        `${botId} data is stale (${Math.round(bot.pollAgeMs / 60000)} min since last poll)`)
    } else if (bot.status === "error" || bot.consecutiveErrors > 0) {
      addCheck("bots", `${botId}_status`, "failed", 
        `${botId} has errors: ${bot.lastError || "unknown"}`, { consecutiveErrors: bot.consecutiveErrors })
    }
    
    // Check signal generation
    if (bot.lastSignalAt) {
      const signalAge = Date.now() - new Date(bot.lastSignalAt).getTime()
      if (signalAge > CONFIG.thresholds.signalFreshness) {
        addCheck("bots", `${botId}_signals`, "warning", 
          `${botId} last signal was ${Math.round(signalAge / 60000)} minutes ago`)
      } else {
        logVerbose(`${botId} last signal ${Math.round(signalAge / 1000)}s ago`)
      }
    } else {
      addCheck("bots", `${botId}_signals`, "warning", 
        `${botId} has never generated signals (or tracking not updated)`)
    }
  }
}

async function checkPriceStreamerHealth(details) {
  log("\n💰 Checking Price Streamer Health...")
  
  // Check rate limit
  if (details.rateLimit) {
    const rl = details.rateLimit
    if (rl.utilizationPct > 90) {
      addCheck("prices", "rate_limit", "failed", 
        `Rate limit critical: ${rl.utilizationPct}% utilized (${rl.callsThisMinute}/${rl.limitPerMinute})`)
    } else if (rl.utilizationPct > 70) {
      addCheck("prices", "rate_limit", "warning", 
        `Rate limit high: ${rl.utilizationPct}% utilized`)
    } else {
      addCheck("prices", "rate_limit", "passed", 
        `Rate limit OK: ${rl.utilizationPct}% utilized`)
    }
  }
  
  // Check market status awareness
  if (details.marketStatus) {
    const ms = details.marketStatus
    log(`  Market Status: Stock=${ms.stock}, Crypto=${ms.crypto}, Forex=${ms.forex}`)
  }
  
  // Check watchlist
  if (details.watchlist) {
    const wl = details.watchlist
    const total = (wl.crypto || 0) + (wl.stock || 0) + (wl.forex || 0)
    if (total === 0) {
      addCheck("prices", "watchlist", "failed", "Watchlist is empty - no symbols being tracked")
    } else {
      addCheck("prices", "watchlist", "passed", 
        `Tracking ${total} symbols (${wl.crypto} crypto, ${wl.stock} stock, ${wl.forex} forex)`)
    }
  }
  
  // Check poll health
  if (details.pollHealth) {
    for (const [asset, health] of Object.entries(details.pollHealth)) {
      if (health.errors > 0) {
        addCheck("prices", `${asset}_poll`, "warning", 
          `${asset} polling has ${health.errors} errors`)
      }
      if (health.isStale) {
        addCheck("prices", `${asset}_poll`, "warning", 
          `${asset} poll data is stale`)
      }
    }
  }
}

// ============================================================================
// CHECK 2: SIGNAL VERIFICATION
// ============================================================================

async function checkSignals() {
  log("\n📡 Checking Bot Signals...")
  
  try {
    const botsSnap = await db.collection("bots").get()
    const now = Date.now()
    
    for (const botDoc of botsSnap.docs) {
      const bot = botDoc.data()
      const botId = botDoc.id
      
      // Skip non-trading bots
      if (bot.engine === "market-intel") continue
      
      // Check signals collection
      const signalsSnap = await db.collection("bots").doc(botId).collection("signals")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get()
      
      if (signalsSnap.empty) {
        addCheck("signals", `${botId}_exists`, "warning", 
          `${botId} has no signals in database`)
        continue
      }
      
      const latestSignal = signalsSnap.docs[0].data()
      const signalAge = latestSignal.createdAt 
        ? now - latestSignal.createdAt.toMillis()
        : null
      
      if (signalAge === null) {
        addCheck("signals", `${botId}_timestamp`, "warning", 
          `${botId} signals missing createdAt timestamp`)
      } else if (signalAge > CONFIG.thresholds.signalFreshness) {
        addCheck("signals", `${botId}_freshness`, "warning", 
          `${botId} latest signal is ${Math.round(signalAge / 60000)} minutes old`)
      } else {
        addCheck("signals", `${botId}_freshness`, "passed", 
          `${botId} has fresh signals (${Math.round(signalAge / 1000)}s ago)`)
      }
      
      // Check signal diversity
      const signals = signalsSnap.docs.map(d => d.data())
      const directions = new Set(signals.map(s => s.direction || s.side))
      const symbols = new Set(signals.map(s => s.symbol))
      
      logVerbose(`${botId}: ${signals.length} recent signals, ${symbols.size} symbols, directions: ${[...directions].join(",")}`)
      
      if (directions.size === 1 && signals.length > 5) {
        addCheck("signals", `${botId}_diversity`, "warning", 
          `${botId} all recent signals are "${[...directions][0]}" - possible issue`)
      }
    }
    
  } catch (err) {
    addCheck("signals", "read_signals", "failed", `Failed to read signals: ${err.message}`)
  }
}

// ============================================================================
// CHECK 3: PRICE DATA VERIFICATION
// ============================================================================

async function checkPrices() {
  log("\n💵 Checking Price Data...")
  
  try {
    // Check market/prices
    const pricesDoc = await db.doc("market/prices").get()
    
    if (!pricesDoc.exists) {
      addCheck("prices", "prices_doc", "failed", "market/prices document does not exist")
      return
    }
    
    const pricesData = pricesDoc.data()
    const items = pricesData.items || []
    const now = Date.now()
    
    if (items.length === 0) {
      addCheck("prices", "prices_count", "failed", "No price data in market/prices")
      return
    }
    
    addCheck("prices", "prices_count", "passed", `${items.length} prices in market/prices`)
    
    // Check price freshness
    let staleCount = 0
    let freshCount = 0
    const pricesByAsset = { crypto: [], stock: [], forex: [] }
    
    for (const item of items) {
      const age = item.updatedAt ? now - item.updatedAt : null
      if (age !== null && age > CONFIG.thresholds.priceFreshness) {
        staleCount++
      } else {
        freshCount++
      }
      
      if (item.assetClass && pricesByAsset[item.assetClass]) {
        pricesByAsset[item.assetClass].push(item)
      }
    }
    
    if (staleCount > items.length / 2) {
      addCheck("prices", "prices_freshness", "warning", 
        `${staleCount}/${items.length} prices are stale (> 5 min old)`)
    } else {
      addCheck("prices", "prices_freshness", "passed", 
        `${freshCount}/${items.length} prices are fresh`)
    }
    
    // Sanity check key prices
    await checkPriceSanity(items)
    
    // Check universe coverage
    await checkUniverseCoverage(items)
    
  } catch (err) {
    addCheck("prices", "read_prices", "failed", `Failed to read prices: ${err.message}`)
  }
}

async function checkPriceSanity(items) {
  log("\n🔍 Checking Price Sanity...")
  
  const priceMap = new Map()
  for (const item of items) {
    priceMap.set(item.symbol?.toUpperCase(), item)
  }
  
  // Check for any crypto with reasonable price (not specifically BTC since it may not be "hot")
  const cryptoItems = items.filter(i => i.assetClass === "crypto")
  if (cryptoItems.length > 0) {
    const sampleCrypto = cryptoItems[0]
    addCheck("sanity", "crypto_exists", "passed", 
      `Found ${cryptoItems.length} crypto prices (e.g., ${sampleCrypto.symbol} @ $${sampleCrypto.price})`)
    
    // Check BTC if present
    const btc = priceMap.get("BTC/USD") || priceMap.get("BTCUSD") || priceMap.get("BTC/USDT")
    if (btc) {
      const price = btc.price
      if (price < CONFIG.sanityRanges.btcPrice.min || price > CONFIG.sanityRanges.btcPrice.max) {
        addCheck("sanity", "btc_price", "failed", 
          `BTC price ${price} is outside expected range (${CONFIG.sanityRanges.btcPrice.min}-${CONFIG.sanityRanges.btcPrice.max})`)
      } else {
        addCheck("sanity", "btc_price", "passed", `BTC price $${price.toLocaleString()} is reasonable`)
      }
    } else {
      logVerbose("BTC not in hot/active prices (may not be 'moving' today)")
    }
    
    // Check ETH if present
    const eth = priceMap.get("ETH/USD") || priceMap.get("ETHUSD") || priceMap.get("ETH/USDT")
    if (eth) {
      const price = eth.price
      if (price < CONFIG.sanityRanges.ethPrice.min || price > CONFIG.sanityRanges.ethPrice.max) {
        addCheck("sanity", "eth_price", "failed", 
          `ETH price ${price} is outside expected range`)
      } else {
        addCheck("sanity", "eth_price", "passed", `ETH price $${price.toLocaleString()} is reasonable`)
      }
    }
  } else {
    addCheck("sanity", "crypto_exists", "warning", "No crypto prices found")
  }
  
  // Check for zero or negative prices
  const badPrices = items.filter(i => !i.price || i.price <= 0)
  if (badPrices.length > 0) {
    addCheck("sanity", "zero_prices", "failed", 
      `${badPrices.length} items have zero or negative prices: ${badPrices.slice(0, 3).map(i => i.symbol).join(", ")}`)
  }
}

async function checkUniverseCoverage(priceItems) {
  log("\n🌍 Checking Universe Coverage...")
  
  try {
    const universeDoc = await db.doc("market/universe").get()
    if (!universeDoc.exists) {
      addCheck("universe", "universe_doc", "warning", "market/universe document does not exist")
      return
    }
    
    const universe = universeDoc.data()
    const priceSymbols = new Set(priceItems.map(i => i.symbol?.toUpperCase()))
    
    // Check crypto universe
    const cryptoSymbols = universe.crypto?.symbols || []
    for (const symbol of cryptoSymbols) {
      const normalized = symbol.toUpperCase().replace("-", "/")
      const found = priceSymbols.has(normalized) || 
                    priceSymbols.has(normalized.replace("/", "")) ||
                    priceSymbols.has(normalized + "T")
      if (!found) {
        addCheck("universe", `crypto_${symbol}`, "warning", 
          `Universe crypto ${symbol} not found in prices`)
      } else {
        logVerbose(`Universe crypto ${symbol} has price data`)
      }
    }
    
    // Check stock universe
    const stockSymbols = universe.stocks?.symbols || []
    for (const symbol of stockSymbols) {
      if (!priceSymbols.has(symbol.toUpperCase())) {
        addCheck("universe", `stock_${symbol}`, "warning", 
          `Universe stock ${symbol} not found in prices (may be market closed)`)
      } else {
        addCheck("universe", `stock_${symbol}`, "passed", 
          `Universe stock ${symbol} has price data`)
      }
    }
    
  } catch (err) {
    addCheck("universe", "read_universe", "failed", `Failed to read universe: ${err.message}`)
  }
}

// ============================================================================
// CHECK 4: MARKET INTEL OUTPUT
// ============================================================================

async function checkMarketIntel() {
  log("\n📈 Checking Market Intel Output...")
  
  try {
    // Check hotTrades
    const hotTradesDoc = await db.doc("market/hotTrades").get()
    
    if (!hotTradesDoc.exists) {
      addCheck("intel", "hot_trades_doc", "failed", "market/hotTrades document does not exist")
      return
    }
    
    const hotTrades = hotTradesDoc.data()
    const items = hotTrades.items || []
    const now = Date.now()
    
    // Check freshness
    if (hotTrades.updatedAt) {
      const age = now - hotTrades.updatedAt.toMillis()
      if (age > CONFIG.thresholds.pipelineRunFreshness) {
        addCheck("intel", "hot_trades_freshness", "warning", 
          `hotTrades is ${Math.round(age / 60000)} minutes old`)
      } else {
        addCheck("intel", "hot_trades_freshness", "passed", 
          `hotTrades updated ${Math.round(age / 1000)}s ago`)
      }
    }
    
    // Check count
    if (items.length < CONFIG.minimums.hotTradesCount) {
      addCheck("intel", "hot_trades_count", "warning", 
        `Only ${items.length} hot trades (expected at least ${CONFIG.minimums.hotTradesCount})`)
    } else {
      addCheck("intel", "hot_trades_count", "passed", `${items.length} hot trades`)
    }
    
    // Check actionBoard
    const actionBoardDoc = await db.doc("market/actionBoard").get()
    if (actionBoardDoc.exists) {
      const actionBoard = actionBoardDoc.data()
      const buys = actionBoard.buys?.length || 0
      const sells = actionBoard.sells?.length || 0
      addCheck("intel", "action_board", "passed", 
        `Action board has ${buys} buys, ${sells} sells`)
    }
    
    // Validate hot trades content
    await validateHotTrades(items)
    
  } catch (err) {
    addCheck("intel", "read_intel", "failed", `Failed to read market intel: ${err.message}`)
  }
}

async function validateHotTrades(items) {
  log("\n✅ Validating Hot Trades Content...")
  
  // Check score distribution
  const scores = items.map(i => i.score).filter(s => typeof s === "number")
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const allSame = scores.every(s => s === scores[0])
    
    if (allSame && scores.length > 3) {
      addCheck("validation", "score_diversity", "warning", 
        `All ${scores.length} hot trades have the same score (${scores[0]}) - possible calculation issue`)
    }
    
    const outOfRange = scores.filter(s => s < 0 || s > 100)
    if (outOfRange.length > 0) {
      addCheck("validation", "score_range", "failed", 
        `${outOfRange.length} scores out of 0-100 range`)
    }
    
    logVerbose(`Score stats: min=${Math.min(...scores)}, max=${Math.max(...scores)}, avg=${avgScore.toFixed(1)}`)
  }
  
  // Check asset class distribution
  const assetClasses = {}
  for (const item of items) {
    const ac = item.assetClass || "unknown"
    assetClasses[ac] = (assetClasses[ac] || 0) + 1
  }
  
  log(`  Asset distribution: ${JSON.stringify(assetClasses)}`)
  
  // Check that items have required fields
  const missingFields = []
  for (const item of items.slice(0, 5)) {
    if (!item.symbol) missingFields.push("symbol")
    if (!item.assetClass) missingFields.push("assetClass")
    if (item.score === undefined) missingFields.push("score")
  }
  
  if (missingFields.length > 0) {
    addCheck("validation", "required_fields", "warning", 
      `Some hot trades missing fields: ${[...new Set(missingFields)].join(", ")}`)
  }
  
  // Check side distribution
  const sides = items.map(i => i.side).filter(Boolean)
  const sideCount = { buy: 0, sell: 0, hold: 0 }
  sides.forEach(s => sideCount[s] = (sideCount[s] || 0) + 1)
  
  if (sides.length > 0 && (sideCount.buy === 0 || sideCount.sell === 0)) {
    addCheck("validation", "side_diversity", "warning", 
      `Hot trades are all ${sideCount.buy > 0 ? "buy" : "sell"} - no opposing signals`)
  } else if (sides.length > 0) {
    logVerbose(`Side distribution: ${JSON.stringify(sideCount)}`)
  }
}

// ============================================================================
// CHECK 5: BOT CONFIGURATION
// ============================================================================

async function checkBotConfiguration() {
  log("\n⚙️ Checking Bot Configuration...")
  
  try {
    const botsSnap = await db.collection("bots").get()
    
    for (const botDoc of botsSnap.docs) {
      const bot = botDoc.data()
      const botId = botDoc.id
      
      // Skip non-trading bots
      if (bot.engine === "market-intel") continue
      
      // Check required fields
      if (!bot.engine) {
        addCheck("config", `${botId}_engine`, "failed", `${botId} missing engine field`)
      }
      
      if (bot.engine === "backtrader") {
        if (!bot.api?.baseUrl) {
          addCheck("config", `${botId}_baseUrl`, "warning", 
            `${botId} missing api.baseUrl - using default`)
        }
      }
      
      // Check enabled status
      if (bot.enabled === false) {
        addCheck("config", `${botId}_enabled`, "warning", `${botId} is disabled`)
      }
    }
    
  } catch (err) {
    addCheck("config", "read_bots", "failed", `Failed to read bot config: ${err.message}`)
  }
}

// ============================================================================
// CHECK 6: CROSS-SERVICE CONSISTENCY
// ============================================================================

async function checkConsistency() {
  log("\n🔗 Checking Cross-Service Consistency...")
  
  try {
    // Get hot trades
    const hotTradesDoc = await db.doc("market/hotTrades").get()
    const hotTrades = hotTradesDoc.exists ? (hotTradesDoc.data().items || []) : []
    
    // Get prices
    const pricesDoc = await db.doc("market/prices").get()
    const prices = pricesDoc.exists ? (pricesDoc.data().items || []) : []
    const priceSymbols = new Set(prices.map(p => p.symbol?.toUpperCase()))
    
    // Check that hot trades have prices
    // Note: price-streamer watches hot trades, so they should have prices
    let missingPrices = 0
    const missingSymbols = []
    for (const trade of hotTrades) {
      const symbol = trade.symbol?.toUpperCase()
      if (symbol && !priceSymbols.has(symbol)) {
        missingPrices++
        missingSymbols.push(symbol)
        logVerbose(`Hot trade ${symbol} has no price data`)
      }
    }
    
    if (missingPrices === hotTrades.length && hotTrades.length > 0) {
      // All missing - this is a real problem
      addCheck("consistency", "hot_trades_prices", "failed", 
        `All ${hotTrades.length} hot trades are missing price data - price cache may have just started`)
    } else if (missingPrices > hotTrades.length / 2) {
      // More than half missing
      addCheck("consistency", "hot_trades_prices", "warning", 
        `${missingPrices}/${hotTrades.length} hot trades are missing price data: ${missingSymbols.slice(0, 3).join(", ")}...`)
    } else if (missingPrices > 0) {
      // Some missing - may be due to failed quotes
      logVerbose(`${missingPrices}/${hotTrades.length} hot trades missing prices (may be quote failures)`)
      addCheck("consistency", "hot_trades_prices", "passed", 
        `${hotTrades.length - missingPrices}/${hotTrades.length} hot trades have price data`)
    } else if (hotTrades.length > 0) {
      addCheck("consistency", "hot_trades_prices", "passed", 
        "All hot trades have corresponding price data")
    }
    
    // Check that universe symbols appear in hot trades or have valid reason
    const universeDoc = await db.doc("market/universe").get()
    if (universeDoc.exists) {
      const universe = universeDoc.data()
      const stockSymbols = universe.stocks?.symbols || []
      const hotTradeSymbols = new Set(hotTrades.map(t => t.symbol?.toUpperCase()))
      
      for (const symbol of stockSymbols) {
        if (!hotTradeSymbols.has(symbol.toUpperCase())) {
          // Check if we have a price for it at least
          if (priceSymbols.has(symbol.toUpperCase())) {
            logVerbose(`Universe ${symbol} has price but not in hot trades`)
          } else {
            addCheck("consistency", `universe_${symbol}`, "warning", 
              `Universe stock ${symbol} not in hot trades and no price data`)
          }
        }
      }
    }
    
  } catch (err) {
    addCheck("consistency", "check_consistency", "failed", `Consistency check failed: ${err.message}`)
  }
}

// ============================================================================
// GENERATE REPORT
// ============================================================================

function generateReport() {
  // Determine overall status
  if (results.summary.failed > 0) {
    results.overall = "failed"
  } else if (results.summary.warnings > 0) {
    results.overall = "warning"
  } else if (results.summary.passed > 0) {
    results.overall = "passed"
  }
  
  // Generate recommendations based on failures
  if (results.alerts.some(a => a.category === "config" && a.name.includes("credentials"))) {
    addRecommendation("high", "Bot credentials are missing - update Firestore bots collection with API credentials")
  }
  
  if (results.alerts.some(a => a.category === "prices" && a.name === "watchlist")) {
    addRecommendation("high", "Price streamer watchlist is empty - check universe configuration")
  }
  
  if (results.alerts.some(a => a.category === "signals")) {
    addRecommendation("medium", "Signal generation issues detected - check bot connectivity and logs")
  }
  
  if (results.summary.warnings > 5) {
    addRecommendation("medium", "Multiple warnings detected - review pipeline configuration")
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log("=" .repeat(60))
  log("🔍 RelayOrb Pipeline Verification")
  log("=" .repeat(60))
  log(`Time: ${results.timestamp}`)
  log("")
  
  try {
    await checkServiceHealth()
    await checkSignals()
    await checkPrices()
    await checkMarketIntel()
    await checkBotConfiguration()
    await checkConsistency()
    
    generateReport()
    
    log("\n" + "=" .repeat(60))
    log("📋 SUMMARY")
    log("=" .repeat(60))
    log(`Overall: ${results.overall.toUpperCase()}`)
    log(`Passed: ${results.summary.passed}`)
    log(`Warnings: ${results.summary.warnings}`)
    log(`Failed: ${results.summary.failed}`)
    
    if (results.alerts.length > 0) {
      log("\n🚨 ALERTS:")
      for (const alert of results.alerts.filter(a => a.severity === "error")) {
        log(`  ❌ [${alert.category}] ${alert.message}`)
      }
      for (const alert of results.alerts.filter(a => a.severity === "warning")) {
        log(`  ⚠️ [${alert.category}] ${alert.message}`)
      }
    }
    
    if (results.recommendations.length > 0) {
      log("\n💡 RECOMMENDATIONS:")
      for (const rec of results.recommendations) {
        log(`  [${rec.priority}] ${rec.message}`)
      }
    }
    
    if (JSON_OUTPUT) {
      console.log(JSON.stringify(results, null, 2))
    }
    
    // Exit with appropriate code
    process.exit(results.overall === "failed" ? 1 : 0)
    
  } catch (err) {
    console.error("Verification failed:", err)
    process.exit(1)
  }
}

main()
