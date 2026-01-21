import admin from "firebase-admin"
import fs from "fs"

const projectId = process.env.FIREBASE_PROJECT_ID || "relayorb"
const outputPath = process.env.OUTPUT_PATH || "tmp-replay-symbols.json"
const extraSymbols = (process.env.EXTRA_SYMBOLS || "TNMG,VERO,RCFX.L,BRN")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean)

if (!admin.apps.length) {
  admin.initializeApp({ projectId })
}

const db = admin.firestore()

function normalizeTicker(raw) {
  if (!raw) return null
  const cleaned = String(raw).toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
  if (!cleaned) return null
  if (!/[A-Z]/.test(cleaned)) return null
  return cleaned
}

function uniqueList(items) {
  return Array.from(new Set(items)).filter(Boolean)
}

async function readUniverseSymbols() {
  const snap = await db.doc("market/universe").get()
  if (!snap.exists) return []
  const data = snap.data() || {}
  const stockSymbols = Array.isArray(data?.stocks?.symbols)
    ? data.stocks.symbols.map(normalizeTicker).filter(Boolean)
    : []
  return stockSymbols
}

async function readTrendingSymbols() {
  const snap = await db.doc("market/trending").get()
  if (!snap.exists) return []
  const data = snap.data() || {}
  const trendingStocks = data?.["24h"]?.stock || []
  const symbols = Array.isArray(trendingStocks)
    ? trendingStocks
        .map((item) => normalizeTicker(item?.symbol))
        .filter(Boolean)
    : []
  return symbols
}

function readMicrocapFile(path) {
  if (!path || !fs.existsSync(path)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(path, "utf8"))
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) => normalizeTicker(item?.symbol || item))
      .filter(Boolean)
  } catch {
    return []
  }
}

async function main() {
  const [universeSymbols, trendingSymbols] = await Promise.all([
    readUniverseSymbols(),
    readTrendingSymbols(),
  ])
  const microcapSymbols = readMicrocapFile(process.env.MICROCAPS_FILE || "tmp-prebreakout-eligible.json")
  const symbols = uniqueList([
    ...universeSymbols,
    ...trendingSymbols,
    ...microcapSymbols,
    ...extraSymbols,
  ])

  fs.writeFileSync(outputPath, JSON.stringify(symbols, null, 2))
  console.log(`Wrote ${symbols.length} symbols to ${outputPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
