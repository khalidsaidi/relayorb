const MDG_URL =
  process.env.MDG_URL ||
  "https://relayorb-market-data-gateway-1071103469376.us-west1.run.app"

const MICROCAPS_FILE = process.env.MICROCAPS_FILE || "tmp-microcaps.json"
const CONCURRENCY = Number(process.env.CONCURRENCY || 6)
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 1000)

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
}

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

async function fetchProfile(symbol) {
  const data = await fetchJson("/v1/fmp/profile", { symbol })
  return data?.profile || null
}

async function fetchSharesFloat(symbol) {
  const data = await fetchJson("/v1/fmp/shares-float", { symbol })
  return Array.isArray(data?.items) ? data.items[0] : null
}

async function fetchDaily(symbol) {
  const data = await fetchJson("/v1/fmp/candles", {
    symbol,
    assetClass: "stock",
    interval: "1day",
    limit: DAILY_LIMIT,
  })
  return Array.isArray(data?.candles) ? data.candles : []
}

function percentile(values, pct) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.floor((pct / 100) * (sorted.length - 1)))
  return sorted[idx]
}

async function main() {
  const fs = await import("fs")
  if (!fs.existsSync(MICROCAPS_FILE)) {
    throw new Error(`Missing microcaps file: ${MICROCAPS_FILE}`)
  }
  const microcaps = JSON.parse(fs.readFileSync(MICROCAPS_FILE, "utf8"))
  if (!Array.isArray(microcaps) || microcaps.length === 0) {
    throw new Error("Microcaps list is empty")
  }

  const counters = {
    total: 0,
    passAll: 0,
    fail: {
      rvolMin: 0,
      rvolMax: 0,
      turnoverMin: 0,
      turnoverMax: 0,
      closeNearHigh: 0,
      runUpMax: 0,
      maSlope: 0,
      maAlignMin: 0,
      maAlignMax: 0,
      atrMax: 0,
    },
  }

  const near = {
    rvolMax: [],
    turnoverMax: [],
    runUpMax: [],
  }
  const samples = {
    rvol: [],
    turnover: [],
    rangePosition: [],
  }

  await mapWithConcurrency(microcaps, CONCURRENCY, async (symbol) => {
    try {
      const [profile, sharesFloat, daily] = await Promise.all([
        fetchProfile(symbol),
        fetchSharesFloat(symbol),
        fetchDaily(symbol),
      ])
      const marketCap = Number(profile?.marketCap)
      const floatShares = Number(sharesFloat?.floatShares)
      if (
        !Number.isFinite(marketCap) ||
        marketCap < RULES.minMarketCap ||
        marketCap > RULES.maxMarketCap ||
        !Number.isFinite(floatShares) ||
        floatShares <= 0 ||
        floatShares > RULES.maxFloatShares
      ) {
        return
      }

      const cleaned = daily
        .map((candle) => ({
          ...candle,
          dateKey: getEtDateKey(new Date(candle.time)),
        }))
        .sort((a, b) => a.time - b.time)

      for (let i = RULES.maLong + RULES.maSlopeLookback; i < cleaned.length; i += 1) {
        const window = cleaned.slice(0, i)
        const candidate = cleaned[i]
        const closes = window.map((candle) => candle.close).filter(Number.isFinite)
        const volumes = window.map((candle) => candle.volume).filter(Number.isFinite)
        if (
          closes.length < RULES.maLong ||
          volumes.length < RULES.volumeLookbackSessions
        ) {
          continue
        }

        const ma20 = computeSma(closes, RULES.maShort)
        const ma50 = computeSma(closes, RULES.maLong)
        const ma20Prev = computeSma(
          closes.slice(0, closes.length - RULES.maSlopeLookback),
          RULES.maShort
        )
        if (!ma20 || !ma50 || !ma20Prev) continue

        const atr14 = computeAtr(window, 14)
        if (!atr14) continue

        const todayHigh = candidate.high
        const todayLow = candidate.low
        const lastPrice = candidate.close
        if (!todayHigh || !todayLow || todayHigh <= todayLow) continue

        const todayVolume = candidate.volume
        const recentVolumes = volumes.slice(-RULES.volumeLookbackSessions)
        const avgVolume = recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length
        const rvol = todayVolume / avgVolume
        const turnoverPct = (todayVolume / floatShares) * 100
        const rangePosition = (lastPrice - todayLow) / (todayHigh - todayLow)
        if (Number.isFinite(rvol)) samples.rvol.push(rvol)
        if (Number.isFinite(turnoverPct)) samples.turnover.push(turnoverPct)
        if (Number.isFinite(rangePosition)) samples.rangePosition.push(rangePosition)

        const lookbackIndex = window.length - RULES.runUpLookback - 1
        if (lookbackIndex < 0) continue
        const baseClose = window[lookbackIndex]?.close
        if (!baseClose) continue
        const runUpPct = ((lastPrice - baseClose) / baseClose) * 100

        const ma20Slope = ma20 - ma20Prev
        const maAlignment = ma20 / ma50
        const atrPct = (atr14 / closes[closes.length - 1]) * 100
        const closeNearHigh = rangePosition >= RULES.closeNearHighMin

        counters.total += 1
        const fails = []
        if (rvol < RULES.rvolMin) {
          counters.fail.rvolMin += 1
          fails.push("rvolMin")
        }
        if (rvol > RULES.rvolMax) {
          counters.fail.rvolMax += 1
          fails.push("rvolMax")
        }
        if (turnoverPct < RULES.turnoverMinPct) {
          counters.fail.turnoverMin += 1
          fails.push("turnoverMin")
        }
        if (turnoverPct > RULES.turnoverMaxPct) {
          counters.fail.turnoverMax += 1
          fails.push("turnoverMax")
        }
        if (!closeNearHigh) {
          counters.fail.closeNearHigh += 1
          fails.push("closeNearHigh")
        }
        if (runUpPct > RULES.maxRunUpPct) {
          counters.fail.runUpMax += 1
          fails.push("runUpMax")
        }
        if (ma20Slope <= 0) {
          counters.fail.maSlope += 1
          fails.push("maSlope")
        }
        if (maAlignment < RULES.maAlignmentMin) {
          counters.fail.maAlignMin += 1
          fails.push("maAlignMin")
        }
        if (maAlignment > RULES.maAlignmentMax) {
          counters.fail.maAlignMax += 1
          fails.push("maAlignMax")
        }
        if (atrPct > RULES.atrPctMax * 100) {
          counters.fail.atrMax += 1
          fails.push("atrMax")
        }

        if (!fails.length) counters.passAll += 1
        if (fails.length === 1 && fails[0] === "rvolMax") near.rvolMax.push(rvol)
        if (fails.length === 1 && fails[0] === "turnoverMax") {
          near.turnoverMax.push(turnoverPct)
        }
        if (fails.length === 1 && fails[0] === "runUpMax") near.runUpMax.push(runUpPct)
      }
    } catch (err) {
      return
    }
  })

  console.log("Total evaluated windows:", counters.total)
  console.log("Pass all:", counters.passAll)
  console.log("Failure counts:", counters.fail)
  console.log("Near-miss rvolMax (p50/p90/p99):", {
    p50: percentile(near.rvolMax, 50),
    p90: percentile(near.rvolMax, 90),
    p99: percentile(near.rvolMax, 99),
  })
  console.log("Near-miss turnoverMax (p50/p90/p99):", {
    p50: percentile(near.turnoverMax, 50),
    p90: percentile(near.turnoverMax, 90),
    p99: percentile(near.turnoverMax, 99),
  })
  console.log("Near-miss runUpMax (p50/p90/p99):", {
    p50: percentile(near.runUpMax, 50),
    p90: percentile(near.runUpMax, 90),
    p99: percentile(near.runUpMax, 99),
  })
  console.log("RVOL distribution (p50/p90/p95/p99):", {
    p50: percentile(samples.rvol, 50),
    p90: percentile(samples.rvol, 90),
    p95: percentile(samples.rvol, 95),
    p99: percentile(samples.rvol, 99),
  })
  console.log("Turnover distribution (p50/p90/p95/p99):", {
    p50: percentile(samples.turnover, 50),
    p90: percentile(samples.turnover, 90),
    p95: percentile(samples.turnover, 95),
    p99: percentile(samples.turnover, 99),
  })
  console.log("Range position distribution (p50/p90/p95/p99):", {
    p50: percentile(samples.rangePosition, 50),
    p90: percentile(samples.rangePosition, 90),
    p95: percentile(samples.rangePosition, 95),
    p99: percentile(samples.rangePosition, 99),
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
