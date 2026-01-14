#!/usr/bin/env node
/**
 * Check positions in Firestore
 */

import admin from "firebase-admin"

const projectId = process.env.FIREBASE_PROJECT_ID || "relayorb"

if (!admin.apps.length) {
  admin.initializeApp({ projectId })
}

const db = admin.firestore()

async function checkPositions() {
  console.log("\n========================================")
  console.log("CHECKING POSITIONS")
  console.log("========================================\n")

  try {
    const positionsSnap = await db.collectionGroup("positions").get()
    console.log("Total positions found:", positionsSnap.size)

    if (!positionsSnap.empty) {
      console.log("\nPositions by asset class:")
      const byAssetClass = { crypto: 0, stock: 0, forex: 0, unknown: 0 }
      const symbols = new Set()

      positionsSnap.docs.forEach(doc => {
        const position = doc.data()
        const assetClass = position.assetClass || "unknown"
        byAssetClass[assetClass] = (byAssetClass[assetClass] || 0) + 1
        if (position.symbol) {
          symbols.add(`${position.symbol} (${assetClass})`)
        }
      })

      console.log("  Crypto:", byAssetClass.crypto)
      console.log("  Stock:", byAssetClass.stock)
      console.log("  Forex:", byAssetClass.forex)
      console.log("  Unknown:", byAssetClass.unknown)

      console.log("\nSymbols in positions:")
      Array.from(symbols).sort().forEach(s => console.log("  ", s))
    }
  } catch (err) {
    console.error("Error:", err)
  }

  process.exit(0)
}

checkPositions()
