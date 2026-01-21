const MDG_URL =
  process.env.MDG_URL ||
  "https://relayorb-market-data-gateway-1071103469376.us-west1.run.app"

const RULES = {
  minMarketCap: 5_000_000,
  maxMarketCap: 80_000_000,
  maxFloatShares: 5_000_000,
  turnoverMinPct: 5,
  turnoverMaxPct: 800,
  rvolMin: 1.5,
  rvolMax: 8,
  closeNearHighMin: 0.75,
  runUpLookback: 10,
  maxRunUpPct: 70,
  volumeLookbackSessions: 3,
  maShort: 10,
  maLong: 20,
  maSlopeLookback: 3,
  maAlignmentMin: 0.9,
  maAlignmentMax: 1.2,
  atrPctMax: 0.2,
  newsMaxCount: 8,
}

const TSX_SUFFIXES = [".TO", ".TSX", ".TSXV", ".V"]

const MAX_MICROCAPS = Number(process.env.MAX_MICROCAPS || 300)
const MAX_SCAN = Number(process.env.MAX_SCAN || 3000)
const CONCURRENCY = Number(process.env.CONCURRENCY || 4)
const MICROCAPS_FILE = process.env.MICROCAPS_FILE || ""
const SEED_SYMBOLS = (process.env.SEED_SYMBOLS || "TNMG,VERO,JAGX,FFIE,TOP,HKIT")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean)
const OUTPUT_MATCHES_FILE = process.env.OUTPUT_MATCHES_FILE || ""
const TARGET_DATE = process.env.TARGET_DATE || ""

function buildUrl(path, params = {}) {
  const url = new URL(path, MDG_URL)
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

async function fetchJson(path, params) {
  const url = buildUrl(path, params)
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${path} failed: ${res.status} ${text.slice(0, 200)}`)
  }
  return res.json()
}

function mapWithConcurrency(list, limit, mapper) {
  let index = 0
  const results = []
  const workers = new Array(Math.max(1, limit)).fill(null).map(async () => {
    while (index < list.length) {
      const current = index++
      results[current] = await mapper(list[current], current)
    }
  })
  return Promise.all(workers).then(() => results)
}

function getEtDateKey(date) {
  const et = new Date(
    new Date(date).toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  return et.toISOString().slice(0, 10)
}

function computeSma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null
  const slice = values.slice(-period)
  const sum = slice.reduce((acc, value) => acc + value, 0)
  return sum / period
}

function computeAtr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null
  const recent = candles.slice(-(period + 1))
  const ranges = []
  for (let i = 1; i < recent.length; i += 1) {
    const prev = recent[i - 1]
    const curr = recent[i]
    if (!prev || !curr) continue
    const highLow = curr.high - curr.low
    const highClose = Math.abs(curr.high - prev.close)
    const lowClose = Math.abs(curr.low - prev.close)
    const tr = Math.max(highLow, highClose, lowClose)
    if (Number.isFinite(tr)) ranges.push(tr)
  }
  if (ranges.length === 0) return null
  const atr = ranges.reduce((sum, value) => sum + value, 0) / ranges.length
  const lastClose = recent[recent.length - 1]?.close
  if (!lastClose) return null
  return atr
}

function resolveProfileMarketCap(profile) {
  if (!profile || typeof profile !== "object") return null
  const candidates = [
    profile.mktCap,
    profile.marketCap,
    profile.marketCapitalization,
    profile.marketCapUsd,
  ]
  const parsed = candidates.map((value) => Number(value)).find(Number.isFinite)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveProfileFloatShares(profile) {
  if (!profile || typeof profile !== "object") return null
  const candidates = [profile.sharesFloat, profile.float, profile.floatShares, profile.freeFloat]
  const parsed = candidates.map((value) => Number(value)).find(Number.isFinite)
  return Number.isFinite(parsed) ? parsed : null
}

function groupSessions(intraday) {
  const sessions = new Map()
  intraday.forEach((candle) => {
    const dateKey = getEtDateKey(new Date(candle.time))
    const list = sessions.get(dateKey) || []
    list.push(candle)
    sessions.set(dateKey, list)
  })
  return sessions
}

function computeSessionVolume(session) {
  return session.reduce((sum, candle) => sum + (Number(candle.volume) || 0), 0)
}

function matchesRules({ profile, sharesFloat, daily, intraday }) {
  const marketCap = resolveProfileMarketCap(profile)
  if (!Number.isFinite(marketCap)) return null
  if (marketCap < RULES.minMarketCap || marketCap > RULES.maxMarketCap) return null

  const floatShares =
    resolveProfileFloatShares(sharesFloat) ?? resolveProfileFloatShares(profile)
  if (!Number.isFinite(floatShares) || floatShares <= 0) return null
  if (floatShares > RULES.maxFloatShares) return null

  const sessions = groupSessions(intraday)
  const sessionKeys = Array.from(sessions.keys()).sort()
  const results = []

  for (const sessionKey of sessionKeys) {
    if (TARGET_DATE && sessionKey !== TARGET_DATE) continue
    const session = sessions.get(sessionKey) || []
    if (session.length === 0) continue

    const cleanedDaily = daily.filter(
      (candle) => getEtDateKey(new Date(candle.time)) < sessionKey
    )
    if (cleanedDaily.length < RULES.maLong + RULES.maSlopeLookback) continue

    const closes = cleanedDaily.map((candle) => candle.close).filter(Number.isFinite)
    const volumes = cleanedDaily.map((candle) => candle.volume).filter(Number.isFinite)
    if (closes.length < RULES.maLong || volumes.length < RULES.volumeLookbackSessions) continue

    const ma20 = computeSma(closes, RULES.maShort)
    const ma50 = computeSma(closes, RULES.maLong)
    const ma20Prev = computeSma(
      closes.slice(0, closes.length - RULES.maSlopeLookback),
      RULES.maShort
    )
    if (!ma20 || !ma50 || !ma20Prev) continue

    const atr14 = computeAtr(cleanedDaily, 14)
    if (!atr14) continue

    const todayHigh = Math.max(...session.map((candle) => candle.high || 0))
    const todayLow = Math.min(...session.map((candle) => candle.low || Infinity))
    if (!Number.isFinite(todayHigh) || !Number.isFinite(todayLow) || todayHigh <= todayLow) {
      continue
    }

    const lastCandle = session[session.length - 1]
    const lastPrice = Number(lastCandle?.close)
    if (!Number.isFinite(lastPrice)) continue

    const todayVolume = computeSessionVolume(session)
    if (!Number.isFinite(todayVolume) || todayVolume <= 0) continue

    const recentVolumes = volumes.slice(-RULES.volumeLookbackSessions)
    const avgVolume =
      recentVolumes.length > 0
        ? recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length
        : null
    if (!avgVolume) continue

    const rvol = todayVolume / avgVolume
    const turnoverPct = (todayVolume / floatShares) * 100
    const rangePosition = (lastPrice - todayLow) / (todayHigh - todayLow)
    if (!Number.isFinite(rangePosition)) continue

    const lookbackIndex = cleanedDaily.length - RULES.runUpLookback - 1
    if (lookbackIndex < 0) continue
    const baseClose = cleanedDaily[lookbackIndex]?.close
    if (!baseClose) continue
    const runUpPct = ((lastPrice - baseClose) / baseClose) * 100

    const ma20Slope = ma20 - ma20Prev
    const maAlignment = ma20 / ma50
    const atrPct = (atr14 / closes[closes.length - 1]) * 100
    const closeNearHigh = rangePosition >= RULES.closeNearHighMin

    if (
      rvol < RULES.rvolMin ||
      rvol > RULES.rvolMax ||
      turnoverPct < RULES.turnoverMinPct ||
      turnoverPct > RULES.turnoverMaxPct ||
      !closeNearHigh ||
      runUpPct > RULES.maxRunUpPct ||
      ma20Slope <= 0 ||
      maAlignment < RULES.maAlignmentMin ||
      maAlignment > RULES.maAlignmentMax ||
      atrPct > RULES.atrPctMax * 100
    ) {
      continue
    }

    results.push({
      dateKey: sessionKey,
      rvol: Number(rvol.toFixed(2)),
      turnoverPct: Number(turnoverPct.toFixed(2)),
      rangePosition: Number(rangePosition.toFixed(2)),
      runUpPct: Number(runUpPct.toFixed(2)),
      atrPct: Number(atrPct.toFixed(2)),
    })
  }

  return results.length > 0 ? results : null
}

async function fetchProfile(symbol) {
  const data = await fetchJson("/v1/fmp/profile", { symbol })
  return data?.profile || null
}

async function fetchSharesFloat(symbol) {
  const data = await fetchJson("/v1/fmp/shares-float", { symbol })
  return Array.isArray(data?.items) ? data.items[0] : null
}

async function fetchCandles(symbol, interval, limit) {
  const data = await fetchJson("/v1/fmp/candles", {
    symbol,
    assetClass: "stock",
    interval,
    limit,
  })
  return Array.isArray(data?.candles) ? data.candles : []
}

async function main() {
  console.log("Fetching stock list...")
  const listData = await fetchJson("/v1/fmp/stock-list")
  const stockList = Array.isArray(listData?.items) ? listData.items : []
  if (stockList.length === 0) throw new Error("Empty stock list")

  const shuffled = stockList
    .map((item) => item.symbol)
    .filter(Boolean)
    .map((symbol) => symbol.toUpperCase())
    .filter((symbol) => !TSX_SUFFIXES.some((suffix) => symbol.endsWith(suffix)))
    .sort(() => Math.random() - 0.5)

  const uniqueSeed = Array.from(new Set([...SEED_SYMBOLS, ...shuffled]))
  const symbolsToCheck = uniqueSeed.slice(0, MAX_SCAN)

  let uniqueMicrocaps = []
  if (MICROCAPS_FILE) {
    try {
      const fs = await import("fs")
      if (fs.existsSync(MICROCAPS_FILE)) {
        const stored = JSON.parse(fs.readFileSync(MICROCAPS_FILE, "utf8"))
        if (Array.isArray(stored) && stored.length > 0) {
          uniqueMicrocaps = stored.map((symbol) => String(symbol).toUpperCase())
          console.log(`Loaded ${uniqueMicrocaps.length} microcaps from ${MICROCAPS_FILE}`)
        }
      }
    } catch (err) {
      console.warn("Failed to load microcaps file", err.message)
    }
  }

  if (!uniqueMicrocaps.length) {
    console.log(`Scanning for microcaps (max ${MAX_MICROCAPS})...`)
    const microcaps = []
    let scanned = 0
    await mapWithConcurrency(symbolsToCheck, CONCURRENCY, async (symbol) => {
      if (microcaps.length >= MAX_MICROCAPS) return
      try {
        const [profile, sharesFloat] = await Promise.all([
          fetchProfile(symbol),
          fetchSharesFloat(symbol),
        ])
        const marketCap = Number(profile?.marketCap)
        const floatShares = Number(sharesFloat?.floatShares)
        if (
          Number.isFinite(marketCap) &&
          marketCap >= RULES.minMarketCap &&
          marketCap <= RULES.maxMarketCap &&
          Number.isFinite(floatShares) &&
          floatShares > 0 &&
          floatShares <= RULES.maxFloatShares
        ) {
          microcaps.push(symbol)
        }
      } catch (err) {
        return
      } finally {
        scanned += 1
        if (scanned % 200 === 0) {
          console.log(`Checked ${scanned}/${symbolsToCheck.length}, microcaps=${microcaps.length}`)
        }
      }
    })

    uniqueMicrocaps = Array.from(new Set(microcaps))
    console.log(`Found ${uniqueMicrocaps.length} microcaps`)
  }

  const matches = []
  await mapWithConcurrency(uniqueMicrocaps, CONCURRENCY, async (symbol) => {
    try {
      const [profile, sharesFloat, daily, intraday] = await Promise.all([
        fetchProfile(symbol),
        fetchSharesFloat(symbol),
        fetchCandles(symbol, "1day", 120),
        fetchCandles(symbol, "5min", 500),
      ])
      if (!daily.length || !intraday.length) return
      const result = matchesRules({ profile, sharesFloat, daily, intraday })
      if (result) {
        result.forEach((entry) => {
          matches.push({ symbol, ...entry })
        })
      }
    } catch (err) {
      return
    }
  })

  if (OUTPUT_MATCHES_FILE) {
    try {
      const fs = await import("fs")
      const uniqueSymbols = Array.from(new Set(matches.map((entry) => entry.symbol)))
      fs.writeFileSync(OUTPUT_MATCHES_FILE, JSON.stringify(uniqueSymbols, null, 2))
      console.log(`Saved ${uniqueSymbols.length} symbols to ${OUTPUT_MATCHES_FILE}`)
    } catch (err) {
      console.warn("Failed to write matches file", err.message)
    }
  }

  if (!matches.length) {
    console.log("No pre-breakout matches found.")
    return
  }

  const byDate = matches.reduce((acc, entry) => {
    acc[entry.dateKey] = acc[entry.dateKey] || []
    acc[entry.dateKey].push(entry)
    return acc
  }, {})
  const bestDate = Object.entries(byDate).sort((a, b) => b[1].length - a[1].length)[0]
  console.log(`Found ${matches.length} matches across ${Object.keys(byDate).length} dates.`)
  if (bestDate) {
    const [dateKey, entries] = bestDate
    console.log(`Best date: ${dateKey} (${entries.length} matches)`)
    console.log(entries.slice(0, 10))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
