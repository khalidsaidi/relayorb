#!/usr/bin/env node
/**
 * Check Firestore market configuration
 *
 * Queries:
 * - market/universe - what symbols and mode are configured
 * - market/controls - any control settings
 * - market/streamSymbols - what watchlist is active
 * - market/hotTrades - current movers
 * - market/actionBoard - current action items
 */

import admin from "firebase-admin"

const projectId = process.env.FIREBASE_PROJECT_ID || "relayorb"

if (!admin.apps.length) {
  admin.initializeApp({ projectId })
}

const db = admin.firestore()

async function checkMarketConfig() {
  console.log("\n========================================")
  console.log("FIRESTORE MARKET CONFIGURATION CHECK")
  console.log("========================================\n")

  try {
    // 1. Check market/universe
    console.log("1. Checking market/universe document...")
    console.log("----------------------------------------")
    const universeDoc = await db.doc("market/universe").get()
    if (universeDoc.exists) {
      const universe = universeDoc.data()
      console.log("Global mode:", universe.mode || "NOT SET")

      if (universe.crypto) {
        console.log("\nCrypto configuration:")
        console.log("  Mode:", universe.crypto.mode || "inherits global")
        console.log("  Symbols count:", Array.isArray(universe.crypto.symbols) ? universe.crypto.symbols.length : 0)
        if (Array.isArray(universe.crypto.symbols)) {
          console.log("  Symbols:", universe.crypto.symbols.slice(0, 10).join(", ") +
            (universe.crypto.symbols.length > 10 ? "..." : ""))
        }
      }

      if (universe.stocks) {
        console.log("\nStock configuration:")
        console.log("  Mode:", universe.stocks.mode || "inherits global")
        console.log("  Symbols count:", Array.isArray(universe.stocks.symbols) ? universe.stocks.symbols.length : 0)
        if (Array.isArray(universe.stocks.symbols)) {
          console.log("  Symbols:", universe.stocks.symbols.slice(0, 10).join(", ") +
            (universe.stocks.symbols.length > 10 ? "..." : ""))
        }
      }

      if (universe.forex) {
        console.log("\nForex configuration:")
        console.log("  Mode:", universe.forex.mode || "inherits global")
        console.log("  Pairs count:", Array.isArray(universe.forex.pairs) ? universe.forex.pairs.length : 0)
        if (Array.isArray(universe.forex.pairs)) {
          console.log("  Pairs:", universe.forex.pairs.join(", "))
        }
      }

      console.log("\nFull universe document:")
      console.log(JSON.stringify(universe, null, 2))
    } else {
      console.log("❌ market/universe document DOES NOT EXIST")
    }

    // 2. Check market/controls
    console.log("\n\n2. Checking market/controls document...")
    console.log("----------------------------------------")
    const controlsDoc = await db.doc("market/controls").get()
    if (controlsDoc.exists) {
      const controls = controlsDoc.data()
      console.log("Controls:")
      console.log(JSON.stringify(controls, null, 2))
    } else {
      console.log("market/controls document does not exist")
    }

    // 3. Check market/streamSymbols
    console.log("\n\n3. Checking market/streamSymbols document...")
    console.log("----------------------------------------")
    const streamDoc = await db.doc("market/streamSymbols").get()
    if (streamDoc.exists) {
      const stream = streamDoc.data()
      console.log("Top symbols:")
      if (stream.symbols) {
        console.log("  Crypto:", Array.isArray(stream.symbols.crypto) ? stream.symbols.crypto.length : 0, "symbols")
        console.log("  Stock:", Array.isArray(stream.symbols.stock) ? stream.symbols.stock.length : 0, "symbols")
        console.log("  Forex:", Array.isArray(stream.symbols.forex) ? stream.symbols.forex.length : 0, "symbols")
      }

      if (stream.sources) {
        console.log("\nSources:")
        for (const [sourceName, source] of Object.entries(stream.sources)) {
          console.log(`  ${sourceName}:`)
          if (source.symbols) {
            console.log(`    Crypto: ${Array.isArray(source.symbols.crypto) ? source.symbols.crypto.length : 0}`)
            console.log(`    Stock: ${Array.isArray(source.symbols.stock) ? source.symbols.stock.length : 0}`)
            console.log(`    Forex: ${Array.isArray(source.symbols.forex) ? source.symbols.forex.length : 0}`)
          }
          if (source.updatedAt) {
            const age = Date.now() - source.updatedAt.toMillis()
            console.log(`    Age: ${Math.round(age / 60000)} minutes`)
          }
        }
      }

      console.log("\nFull streamSymbols document:")
      console.log(JSON.stringify(stream, null, 2))
    } else {
      console.log("market/streamSymbols document does not exist")
    }

    // 4. Check market/hotTrades
    console.log("\n\n4. Checking market/hotTrades document...")
    console.log("----------------------------------------")
    const hotTradesDoc = await db.doc("market/hotTrades").get()
    if (hotTradesDoc.exists) {
      const hotTrades = hotTradesDoc.data()
      const items = hotTrades.items || []
      console.log("Hot trades count:", items.length)
      if (hotTrades.updatedAt) {
        const age = Date.now() - hotTrades.updatedAt.toMillis()
        console.log("Last updated:", Math.round(age / 60000), "minutes ago")
      }
      if (items.length > 0) {
        console.log("\nSample items:")
        items.slice(0, 5).forEach(item => {
          console.log(`  ${item.symbol} (${item.assetClass})`)
        })
      }
    } else {
      console.log("market/hotTrades document does not exist")
    }

    // 5. Check market/actionBoard
    console.log("\n\n5. Checking market/actionBoard document...")
    console.log("----------------------------------------")
    const actionBoardDoc = await db.doc("market/actionBoard").get()
    if (actionBoardDoc.exists) {
      const actionBoard = actionBoardDoc.data()
      const buys = actionBoard.buys || []
      const sells = actionBoard.sells || []
      console.log("Buys:", buys.length)
      console.log("Sells:", sells.length)
      if (actionBoard.updatedAt) {
        const age = Date.now() - actionBoard.updatedAt.toMillis()
        console.log("Last updated:", Math.round(age / 60000), "minutes ago")
      }
    } else {
      console.log("market/actionBoard document does not exist")
    }

    // 6. Check market/prices to see what's actually being tracked
    console.log("\n\n6. Checking market/prices document...")
    console.log("----------------------------------------")
    const pricesDoc = await db.doc("market/prices").get()
    if (pricesDoc.exists) {
      const prices = pricesDoc.data()
      const items = prices.items || []
      console.log("Total prices tracked:", items.length)

      const byAssetClass = { crypto: 0, stock: 0, forex: 0 }
      items.forEach(item => {
        if (item.assetClass && byAssetClass.hasOwnProperty(item.assetClass)) {
          byAssetClass[item.assetClass]++
        }
      })

      console.log("By asset class:")
      console.log("  Crypto:", byAssetClass.crypto)
      console.log("  Stock:", byAssetClass.stock)
      console.log("  Forex:", byAssetClass.forex)

      if (prices.meta) {
        console.log("\nMeta:")
        console.log("  Run ID:", prices.meta.runId)
        console.log("  Watchlist:", prices.meta.watchlist)
      }

      if (prices.updatedAt) {
        const age = Date.now() - prices.updatedAt.toMillis()
        console.log("\nLast updated:", Math.round(age / 1000), "seconds ago")
      }

      // Show stock symbols being tracked
      const stockItems = items.filter(i => i.assetClass === "stock")
      if (stockItems.length > 0) {
        console.log("\nStock symbols being tracked:")
        console.log(stockItems.map(i => i.symbol).join(", "))
      }
    } else {
      console.log("market/prices document does not exist")
    }

    // 7. Check pipeline/price_streamer health
    console.log("\n\n7. Checking pipeline/price_streamer health...")
    console.log("----------------------------------------")
    const healthDoc = await db.doc("pipeline/price_streamer").get()
    if (healthDoc.exists) {
      const health = healthDoc.data()
      console.log("Status:", health.status)
      console.log("Run ID:", health.runId)
      if (health.watchlist) {
        console.log("Watchlist:")
        console.log("  Crypto:", health.watchlist.crypto)
        console.log("  Stock:", health.watchlist.stock)
        console.log("  Forex:", health.watchlist.forex)
      }
      if (health.marketStatus) {
        console.log("Market status:")
        console.log("  Crypto:", health.marketStatus.crypto)
        console.log("  Stock:", health.marketStatus.stock)
        console.log("  Forex:", health.marketStatus.forex)
      }
      if (health.pollHealth) {
        console.log("Poll health:")
        console.log(JSON.stringify(health.pollHealth, null, 2))
      }
      if (health.heartbeatAt) {
        const age = Date.now() - health.heartbeatAt.toMillis()
        console.log("Last heartbeat:", Math.round(age / 1000), "seconds ago")
      }
    } else {
      console.log("pipeline/price_streamer document does not exist")
    }

    console.log("\n========================================")
    console.log("DIAGNOSIS")
    console.log("========================================\n")

    // Provide diagnosis
    if (universeDoc.exists) {
      const universe = universeDoc.data()
      const stockMode = universe.stocks?.mode || universe.mode || "movers_plus_universe"
      const stockSymbolCount = Array.isArray(universe.stocks?.symbols) ? universe.stocks.symbols.length : 0

      console.log("Stock tracking mode:", stockMode)
      console.log("Stock universe size:", stockSymbolCount)

      if (stockMode === "universe_only" && stockSymbolCount < 10) {
        console.log("\n⚠️  WARNING: Mode is 'universe_only' but only", stockSymbolCount, "symbols configured!")
        console.log("This explains why only a few stocks are being tracked.")
        console.log("\nRecommended fix:")
        console.log("1. Change mode to 'movers_plus_universe' to include gainers/losers/actives")
        console.log("2. OR add more symbols to universe.stocks.symbols array")
      }

      if (stockMode === "movers_filtered_by_universe" && stockSymbolCount < 10) {
        console.log("\n⚠️  WARNING: Mode is 'movers_filtered_by_universe' but universe only has", stockSymbolCount, "symbols!")
        console.log("Discovered movers will be filtered to only include these symbols.")
      }
    }

  } catch (err) {
    console.error("Error checking configuration:", err)
    process.exit(1)
  }

  process.exit(0)
}

checkMarketConfig()
