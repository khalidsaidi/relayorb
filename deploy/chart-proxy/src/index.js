const { onRequest } = require('firebase-functions/v2/https')

const MARKET_DATA_GATEWAY_URL = process.env.MARKET_DATA_GATEWAY_URL || ''

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

function buildSeries(data) {
  const series = {}
  data.forEach((entry) => {
    const time = entry.time ?? entry.date ?? entry.timestamp
    const date =
      typeof time === 'number'
        ? new Date(time).toISOString()
        : time
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
  },
  async (req, res) => {
    try {
      const { symbol, assetClass = 'stock', interval = '15min' } = req.query

      if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' })
      }

      if (!MARKET_DATA_GATEWAY_URL) {
        return res.status(500).json({ error: 'MARKET_DATA_GATEWAY_URL is not configured' })
      }

      if (!['stock', 'forex', 'crypto'].includes(assetClass)) {
        return res.status(400).json({ error: `Unsupported asset class: ${assetClass}` })
      }

      const fmpInterval = mapIntervalToFmp(interval)
      const base = MARKET_DATA_GATEWAY_URL.endsWith('/')
        ? MARKET_DATA_GATEWAY_URL
        : `${MARKET_DATA_GATEWAY_URL}/`
      const url = new URL('v1/fmp/candles', base)
      url.searchParams.set('symbol', symbol)
      url.searchParams.set('assetClass', assetClass)
      url.searchParams.set('interval', fmpInterval)
      url.searchParams.set('limit', '200')

      const response = await fetch(url.toString())
      const data = await response.json()

      if (!response.ok) {
        return res.status(response.status).json(data)
      }

      if (!Array.isArray(data?.candles)) {
        const message = data?.error || data?.Error || 'Invalid response from gateway'
        return res.status(502).json({ error: message })
      }

      res.set('Access-Control-Allow-Origin', '*')
      res.set('Access-Control-Allow-Methods', 'GET')
      res.set('Access-Control-Allow-Headers', 'Content-Type')
      res.json({
        series: buildSeries(data.candles),
        seriesKey: `FMP ${fmpInterval}`,
        source: data?.source || 'fmp',
      })
    } catch (error) {
      console.error('Chart proxy error:', error)
      res.status(500).json({ error: error.message })
    }
  }
)
