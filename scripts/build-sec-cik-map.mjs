import fs from "node:fs"
import path from "node:path"
import https from "node:https"

const SEC_URL = "https://www.sec.gov/files/company_tickers.json"
const DEFAULT_UA = "relayorb (khalidsaidi66@gmail.com)"

function fetchJson(url, { userAgent } = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": userAgent || DEFAULT_UA,
            Accept: "application/json",
          },
        },
        (res) => {
          let body = ""
          res.setEncoding("utf8")
          res.on("data", (chunk) => (body += chunk))
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`SEC fetch failed: ${res.statusCode} ${body.slice(0, 200)}`))
              return
            }
            try {
              resolve(JSON.parse(body))
            } catch (err) {
              reject(err)
            }
          })
        }
      )
      .on("error", reject)
  })
}

function padCik(value) {
  const n = String(value || "").trim()
  if (!n) return ""
  // SEC uses 10-digit, zero-padded CIKs in most URLs and feeds.
  return n.padStart(10, "0")
}

async function main() {
  const userAgent = process.env.SEC_USER_AGENT || DEFAULT_UA
  const outPath = process.env.SEC_CIK_MAP_OUT || path.join(process.cwd(), "public", "sec-cik-map.v1.json")

  console.log(`Fetching ${SEC_URL}`)
  const json = await fetchJson(SEC_URL, { userAgent })

  const cikToTicker = {}
  const tickerToCik = {}

  for (const entry of Object.values(json || {})) {
    if (!entry || typeof entry !== "object") continue
    const cik = padCik(entry.cik_str)
    const ticker = String(entry.ticker || "").trim().toUpperCase()
    if (!cik || !ticker) continue
    cikToTicker[cik] = ticker
    // Keep first seen CIK per ticker (good enough for enrichment).
    if (!tickerToCik[ticker]) tickerToCik[ticker] = cik
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        cikToTicker,
        tickerToCik,
      },
      null,
      2
    ),
    "utf8"
  )

  console.log(`Wrote ${outPath} (cikToTicker=${Object.keys(cikToTicker).length})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

