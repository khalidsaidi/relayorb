const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

const fmpKey = defineSecret('FMP_API_KEY')
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

function mapIntervalToFmp(interval) {
  const mapping = {
    '1min': '1min',
    '5min': '5min',
    '15min': '15min',
    '30min': '30min',
    '1h': '1hour',
    '4h': '4hour',
    '1day': '1day',
    '1week': '1week',
  }
  return mapping[interval] || '15min'
}

function normalizeSymbolForFmp(symbol, assetClass) {
  const upper = String(symbol || '').trim().toUpperCase()
  if (!upper) return ''
  if (assetClass === 'forex' || assetClass === 'crypto') {
    return upper.replace(/[\/-]/g, '')
  }
  return upper.replace(/\s+/g, '')
}

function buildSeries(data) {
  const series = {}
  data.forEach((entry) => {
    const date = entry.date || entry.time || entry.timestamp
    if (!date) return
    const open = entry.open
    const high = entry.high
    const low = entry.low
    const close = entry.close
    if (open === undefined || high === undefined || low === undefined || close === undefined) return
    series[date] = {
      '1. open': String(open),
      '2. high': String(high),
      '3. low': String(low),
      '4. close': String(close),
      '5. volume': String(entry.volume ?? 0),
    }
  })
  return series
}

exports.chartProxy = onRequest(
  {
    cors: true,
    maxInstances: 10,
    secrets: [fmpKey],
  },
  async (req, res) => {
    try {
      const { symbol, assetClass = 'stock', interval = '15min' } = req.query

      if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' })
      }

      const FMP_API_KEY = fmpKey.value()
      if (!FMP_API_KEY) {
        return res.status(500).json({ error: 'FMP API key is not configured' })
      }

      if (!['stock', 'forex', 'crypto'].includes(assetClass)) {
        return res.status(400).json({ error: `Unsupported asset class: ${assetClass}` })
      }

      const fmpInterval = mapIntervalToFmp(interval)
      const normalizedSymbol = normalizeSymbolForFmp(symbol, assetClass)
      if (!normalizedSymbol) {
        return res.status(400).json({ error: 'Invalid symbol' })
      }

      const url = new URL(`${FMP_BASE_URL}/historical-chart/${fmpInterval}`)
      url.searchParams.set('symbol', normalizedSymbol)
      url.searchParams.set('apikey', FMP_API_KEY)

      const response = await fetch(url.toString())
      const data = await response.json()

      if (!response.ok) {
        return res.status(response.status).json(data)
      }

      if (!Array.isArray(data)) {
        const message = data?.error || data?.Error || 'Invalid response from FMP'
        return res.status(502).json({ error: message })
      }

      res.set('Access-Control-Allow-Origin', '*')
      res.set('Access-Control-Allow-Methods', 'GET')
      res.set('Access-Control-Allow-Headers', 'Content-Type')
      res.json({
        series: buildSeries(data),
        seriesKey: `FMP ${fmpInterval}`,
        source: 'fmp',
      })
    } catch (error) {
      console.error('Chart proxy error:', error)
      res.status(500).json({ error: error.message })
    }
  }
)
