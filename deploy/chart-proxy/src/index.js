const crypto = require('crypto')
const { createClient } = require('redis')
const { onRequest } = require('firebase-functions/v2/https')

const MARKET_DATA_GATEWAY_URL = process.env.MARKET_DATA_GATEWAY_URL || ''
const REDIS_URL = process.env.REDIS_URL || ''
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'relayorb'
const PIPELINE_EVENTS_ENABLED = process.env.PIPELINE_EVENTS_ENABLED !== 'false'
const PIPELINE_EVENTS_STREAM = process.env.PIPELINE_EVENTS_STREAM || ''
const PIPELINE_EVENTS_MAXLEN = parseInt(process.env.PIPELINE_EVENTS_MAXLEN || '20000', 10)
const PIPELINE_EVENTS_RUN_ENV = process.env.PIPELINE_EVENTS_RUN_ENV || 'prod'

let pipelineRedis = null
let pipelineRedisReady = false

function resolvePipelineStream() {
  if (PIPELINE_EVENTS_STREAM) return PIPELINE_EVENTS_STREAM
  const prefix = REDIS_PREFIX ? `${REDIS_PREFIX}:` : ''
  return `${prefix}pipeline_events`
}

function createEventId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function hashParams(value) {
  if (!value) return null
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    return crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 12)
  } catch (_) {
    return null
  }
}

function buildPipelineEvent(payload) {
  return {
    ts: new Date().toISOString(),
    eventId: createEventId(),
    runEnv: PIPELINE_EVENTS_RUN_ENV,
    service: 'chart-proxy',
    severity: 'info',
    ...payload,
  }
}

async function ensurePipelineRedis() {
  if (!REDIS_URL || !PIPELINE_EVENTS_ENABLED) return null
  if (pipelineRedis && pipelineRedisReady) return pipelineRedis
  if (!pipelineRedis) {
    pipelineRedis = createClient({ url: REDIS_URL })
    pipelineRedis.on('error', (err) => {
      pipelineRedisReady = false
      console.error('Pipeline Redis error:', err?.message || err)
    })
  }
  try {
    await pipelineRedis.connect()
    pipelineRedisReady = true
    return pipelineRedis
  } catch (err) {
    pipelineRedisReady = false
    console.error('Pipeline Redis connect failed:', err?.message || err)
    return null
  }
}

async function publishPipelineEvent(event) {
  const client = await ensurePipelineRedis()
  if (!client || !pipelineRedisReady) return
  const stream = resolvePipelineStream()
  const maxlen = Number.isFinite(PIPELINE_EVENTS_MAXLEN)
    ? Math.max(PIPELINE_EVENTS_MAXLEN, 1000)
    : 20000
  const payload = JSON.stringify(event)
  const command = ['XADD', stream, 'MAXLEN', '~', String(maxlen), '*', 'payload', payload]
  try {
    await Promise.race([
      client.sendCommand(command),
      new Promise((resolve) => setTimeout(resolve, 75)),
    ])
  } catch (err) {
    console.error('Pipeline event publish failed:', err?.message || err)
  }
}

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
    const startedAt = Date.now()
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
      const paramsHash = hashParams({ symbol, assetClass, interval: fmpInterval, limit: '200' })
      const endpointName = 'v1/fmp/candles'
      url.searchParams.set('symbol', symbol)
      url.searchParams.set('assetClass', assetClass)
      url.searchParams.set('interval', fmpInterval)
      url.searchParams.set('limit', '200')

      const response = await fetch(url.toString())
      const data = await response.json()

      if (!response.ok) {
        await publishPipelineEvent(
          buildPipelineEvent({
            stationId: 'chart_proxy',
            eventType: 'gateway_call',
            edgeKey: 'chart_proxy->market_data_gateway',
            nodeIds: ['chart_proxy', 'market_data_gateway'],
            status: 'error',
            durationMs: Date.now() - startedAt,
            symbolKey: `${assetClass}:${symbol}`,
            meta: {
              interval,
              httpStatus: response.status,
            },
            inputs: {
              providerCalls: [
                {
                  providerId: 'mdg',
                  endpointName,
                  paramsHash,
                },
              ],
            },
            error: { message: data?.error || 'Gateway error' },
          })
        )
        return res.status(response.status).json(data)
      }

      if (!Array.isArray(data?.candles)) {
        const message = data?.error || data?.Error || 'Invalid response from gateway'
        await publishPipelineEvent(
          buildPipelineEvent({
            stationId: 'chart_proxy',
            eventType: 'gateway_call',
            edgeKey: 'chart_proxy->market_data_gateway',
            nodeIds: ['chart_proxy', 'market_data_gateway'],
            status: 'error',
            durationMs: Date.now() - startedAt,
            symbolKey: `${assetClass}:${symbol}`,
            meta: {
              interval,
              httpStatus: 502,
            },
            inputs: {
              providerCalls: [
                {
                  providerId: 'mdg',
                  endpointName,
                  paramsHash,
                },
              ],
            },
            error: { message },
          })
        )
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
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: 'chart_proxy',
          eventType: 'gateway_call',
          edgeKey: 'chart_proxy->market_data_gateway',
          nodeIds: ['chart_proxy', 'market_data_gateway'],
          status: 'end',
          durationMs: Date.now() - startedAt,
          symbolKey: `${assetClass}:${symbol}`,
          meta: {
            interval,
            source: data?.source || 'fmp',
            candleCount: Array.isArray(data?.candles) ? data.candles.length : 0,
          },
          inputs: {
            providerCalls: [
              {
                providerId: 'mdg',
                endpointName,
                paramsHash,
              },
            ],
          },
        })
      )
    } catch (error) {
      console.error('Chart proxy error:', error)
      await publishPipelineEvent(
        buildPipelineEvent({
          stationId: 'chart_proxy',
          eventType: 'gateway_call',
          edgeKey: 'chart_proxy->market_data_gateway',
          nodeIds: ['chart_proxy', 'market_data_gateway'],
          status: 'error',
          durationMs: Date.now() - startedAt,
          meta: { httpStatus: 500 },
          error: { message: error?.message || 'Chart proxy error' },
        })
      )
      res.status(500).json({ error: error.message })
    }
  }
)
