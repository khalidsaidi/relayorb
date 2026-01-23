import type { FieldValue, Timestamp } from "firebase/firestore"

type FirestoreTimestamp = Timestamp | FieldValue

export type BotStatus =
  | "online"
  | "offline"
  | "error"
  | "starting"
  | "stopping"
  | "idle"
  | "unknown"

export type BotCommandType =
  | "start"
  | "stop"
  | "restart"
  | "reload_config"
  | "configure"
  | "update_agent"

export type BotMode = "signal" | "paper" | "live"

export type BotCapabilities = {
  exchanges?: string[]
  timeframes?: string[]
  modes?: BotMode[]
}

export type BotDesiredConfig = {
  mode?: BotMode
  exchange?: string
  pairs?: string[]
  timeframe?: string
  strategy?: string
  risk?: {
    maxPositionSize?: number
    maxDailyLoss?: number
    maxOpenOrders?: number
    maxLeverage?: number
  }
  advanced?: Record<string, unknown>
  updatedAt?: Timestamp
}

export type BotDoc = {
  id: string
  name?: string
  engine?: string
  status?: BotStatus
  lastHeartbeat?: Timestamp
  updatedAt?: Timestamp
  capabilities?: BotCapabilities
  desiredConfig?: BotDesiredConfig
  summary?: {
    positions?: number
    orders?: number
    pnl?: number
  }
  state?: Record<string, unknown>
}

export type BotEventDoc = {
  id: string
  botId: string
  type?: string
  severity?: "info" | "warn" | "error" | "fill" | "order" | "position" | "system"
  message?: string
  createdAt?: Timestamp
  data?: Record<string, unknown>
}

export type BotSignalDoc = {
  id: string
  botId: string
  symbol?: string
  side?: "buy" | "sell" | "hold"
  strength?: number
  message?: string
  createdAt?: Timestamp
  data?: Record<string, unknown>
  evaluation?: {
    assetClass?: "crypto" | "stock" | "forex"
    symbol?: string
    evaluatedAt?: Timestamp
    horizons?: Record<
      string,
      {
        returnPct?: number
        hit?: boolean
        priceAtSignal?: number
        priceAtHorizon?: number
        source?: string
        marketOpenAtSignal?: boolean
        adjustedSignalTime?: Timestamp
        adjustedHorizonTime?: Timestamp
      }
    >
  }
}

export type MarketStatus = {
  assetClass: "crypto" | "stock" | "forex"
  isOpen: boolean
  nextChange: Date
  nextChangeLabel: string
  countdown: string
  hoursText: string
}

export type BotCommandDoc = {
  id: string
  type: BotCommandType
  payload?: Record<string, unknown>
  createdAt?: Timestamp
  status?: "queued" | "running" | "completed" | "failed"
  requestedBy?: string
}

export type MarketTradeScoreComponents = {
  momentum?: number
  consensus?: number
  liquidity?: number
  news?: number
  universe?: number
  penalties?: {
    spread?: number
    liquidity?: number
    price?: number
    volume?: number
    sentiment?: number
  }
}

export type MarketTradeAnalysis = {
  summary?: string
  details?: string[]
  summaryZh?: string
  detailsZh?: string[]
}

export type MarketUniverseMode =
  | "movers_only"
  | "universe_only"
  | "movers_plus_universe"
  | "movers_filtered_by_universe"
  | "weighted_union"

export type MarketTradeRecommendation = {
  action?: "buy" | "hold" | "sell"
  holdMinutes?: number
  stopLossPct?: number | null
  takeProfitPct?: number | null
}

export type MarketTradeTrendSnapshot = {
  horizon?: TrendHorizon
  score?: number
  components?: MarketTradeScoreComponents
  momentum?: {
    change1m?: number
    change5m?: number
    change15m?: number
    change1h?: number
    change24h?: number
    change7d?: number
    window?: TrendHorizon
  }
}

export type MarketTradeNewsSnapshot = {
  count?: number
  sentiment?: number
  score?: number
}

export type MarketHotTrade = {
  assetClass: "crypto" | "stock" | "forex"
  symbol: string
  name?: string
  exchange?: string
  price?: number
  timeframe?: string
  side?: "buy" | "sell" | "hold"
  profile?: "dip" | "scalp" | "swing_overnight" | "prebreakout"
  score?: number
  confidence?: number
  primary?: boolean
  momentum?: {
    change1m?: number
    change5m?: number
    change15m?: number
    change1h?: number
    change24h?: number
    change7d?: number
  }
  signals?: {
    total?: number
    buy?: number
    sell?: number
    strengthAvg?: number
    recent?: number
    bots?: string[]
  }
  scoreComponents?: MarketTradeScoreComponents
  trend?: MarketTradeTrendSnapshot
  news?: MarketTradeNewsSnapshot
  analysis?: MarketTradeAnalysis
  recommendation?: MarketTradeRecommendation
  source?: string
  rationale?: string
  origins?: string[]
  swing?: {
    asOfTs?: string
    inputs?: {
      ma20?: number
      ma50?: number
      ma20Slope?: number
      atr14?: number
      distributionDays10?: number
      rangePosition?: number
      todayHigh?: number
      todayLow?: number
      lastPrice?: number
      last60mVolume?: number
      avgLast60mVolume?: number
    }
    reasons?: string[]
    entryWindow?: {
      start?: string
      end?: string
      close?: string
      timezone?: string
    }
    exitPlan?: {
      profitTriggerPct?: number
      morningWindowMinutes?: number
      timeExit?: string
      stopAtrMult?: number
      stopType?: string
    }
  }
  prebreakout?: {
    asOfTs?: string
    inputs?: {
      marketCap?: number
      floatShares?: number
      turnoverPct?: number
      rvol?: number
      rangePosition?: number
      runUpPct?: number
      ma20?: number
      ma50?: number
      ma20Slope?: number
      atr14?: number
      atrPct?: number
      todayVolume?: number
      avgVolume?: number
      newsCount?: number
      lastPrice?: number
      todayHigh?: number
      todayLow?: number
    }
    reasons?: string[]
    entryWindow?: {
      start?: string
      end?: string
      close?: string
      timezone?: string
    }
    exitPlan?: {
      profitTriggerPct?: number
      morningWindowMinutes?: number
      timeExit?: string
      stopAtrMult?: number
      stopType?: string
    }
  }
}

export type MarketHotTradesDoc = {
  updatedAt?: FirestoreTimestamp
  items?: MarketHotTrade[]
  sources?: Record<string, string>
  meta?: Record<string, unknown>
}

export type MarketSwingOvernightDoc = {
  updatedAt?: FirestoreTimestamp
  items?: MarketHotTrade[]
  meta?: Record<string, unknown>
}

export type MarketPrebreakoutDoc = {
  updatedAt?: FirestoreTimestamp
  items?: MarketHotTrade[]
  meta?: Record<string, unknown>
}

export type MarketActionBoardDoc = {
  updatedAt?: FirestoreTimestamp
  buys?: MarketHotTrade[]
  sells?: MarketHotTrade[]
  byAsset?: {
    buys?: Partial<Record<"crypto" | "stock" | "forex", MarketHotTrade[]>>
    sells?: Partial<Record<"crypto" | "stock" | "forex", MarketHotTrade[]>>
  }
  meta?: Record<string, unknown>
}

export type MarketPopularItem = {
  assetClass: "crypto" | "stock" | "forex"
  symbol: string
  name?: string
  score?: number
  source?: string
  rationale?: string
}

export type MarketPopularDoc = {
  updatedAt?: FirestoreTimestamp
  items?: MarketPopularItem[]
  meta?: Record<string, unknown>
}

export type TrendHorizon = "15m" | "1h" | "24h" | "7d"

export type TrendWeights = {
  momentum?: number
  volume?: number
  signals?: number
  liquidity?: number
  consensus?: number
  news?: number
}

export type MarketTrendItem = {
  assetClass: "crypto" | "stock" | "forex"
  symbol: string
  name?: string
  price?: number
  horizon: TrendHorizon
  score?: number
  confidence?: number
  components?: MarketTradeScoreComponents
  scoreComponents?: MarketTradeScoreComponents
  news?: {
    count?: number
    sentiment?: number
    score?: number
  }
  momentum?: {
    change1m?: number
    change5m?: number
    change15m?: number
    change1h?: number
    change24h?: number
    change7d?: number
    window?: TrendHorizon
  }
  signals?: {
    total?: number
    buy?: number
    sell?: number
    strengthAvg?: number
    bots?: string[]
  }
  volumeRank?: number
  source?: string
  rationale?: string
}

export type MarketTrendingDoc = {
  updatedAt?: FirestoreTimestamp
  horizons?: TrendHorizon[]
  byHorizon?: Record<
    string,
    Partial<Record<"crypto" | "stock" | "forex", MarketTrendItem[]>>
  >
  weights?: TrendWeights
  meta?: Record<string, unknown>
}

export type MarketControlsDoc = {
  updatedAt?: FirestoreTimestamp
  llmIntervalMinutes?: number
  enableLLM?: boolean
  newsIntervalMinutes?: number
  enableNews?: boolean
  swingOvernightEnabled?: boolean
  swingOvernightAutoPaperEnabled?: boolean
  prebreakoutEnabled?: boolean
  prebreakoutAutoPaperEnabled?: boolean
  dipHorizon?: "1h" | "24h" | "7d"
  trendHorizon?: TrendHorizon
  trendWeights?: TrendWeights
  riskProfile?: "conservative" | "balanced" | "aggressive"
  assetFocus?: Array<"crypto" | "stock" | "forex">
  autoTuneEnabled?: boolean
  autoTuneWithAI?: boolean
  autoTuneIntervalHours?: number
  autoTuneLastAt?: FirestoreTimestamp
  autoTuneNotes?: string
  autoTuneHorizon?: "1h" | "24h" | "7d"
  autoTuneHitRate?: number
  autoTuneSignals?: number
  moverTurnoverMinPct?: number
  moverTurnoverMaxPct?: number
  moverTurnoverScope?: {
    movers?: boolean
    trending?: boolean
    hotTrades?: boolean
  }
  moverPriceMin?: number
  moverPriceMax?: number
  primaryAssets?: {
    crypto?: string[]
    stocks?: string[]
    forex?: string[]
  }
  botWeights?: Record<string, number>
}

export type MarketUniverseDoc = {
  updatedAt?: FirestoreTimestamp
  mode?: MarketUniverseMode
  crypto?: {
    mode?: MarketUniverseMode
    symbols?: string[]
  }
  stocks?: {
    mode?: MarketUniverseMode
    symbols?: string[]
  }
  forex?: {
    mode?: MarketUniverseMode
    pairs?: string[]
  }
}

export type SignalHorizonStats = {
  count?: number
  hits?: number
  hitRate?: number
  avgReturn?: number
}

export type SignalBotPerformance = {
  botId: string
  count: number
  hitRate: number
  avgReturn: number
}

export type SignalAssetPerformance = {
  assetClass: "crypto" | "stock" | "forex" | string
  count: number
  hitRate: number
  avgReturn: number
}

export type SignalSymbolPerformance = {
  symbol: string
  assetClass?: "crypto" | "stock" | "forex" | string | null
  count: number
  hitRate: number
  avgReturn: number
}

export type SignalPerformanceDoc = {
  updatedAt?: Timestamp
  horizons?: Array<"1h" | "24h" | "7d">
  overall?: Record<string, SignalHorizonStats>
  topBots?: Record<string, SignalBotPerformance[]>
  byAsset?: Record<string, SignalAssetPerformance[]>
  topSymbols?: Record<string, SignalSymbolPerformance[]>
  bottomSymbols?: Record<string, SignalSymbolPerformance[]>
  meta?: Record<string, unknown>
}

export type PipelineEvent = {
  ts: string
  eventId: string
  runEnv?: string
  runId?: string | null
  sessionId?: string | null
  batchId?: string | null
  symbolKey?: string | null
  service: string
  stationId: string
  eventType?: string
  edgeKey?: string
  nodeIds?: string[]
  status: "start" | "end" | "error"
  durationMs?: number
  severity?: "info" | "warn" | "error"
  meta?: Record<string, unknown>
  inputs?: {
    redisKeys?: string[]
    firestoreDocs?: string[]
    providerCalls?: Array<Record<string, unknown>>
  }
  outputs?: {
    redisKeys?: string[]
    firestoreDocs?: string[]
  }
  error?: {
    message?: string
    code?: string | number
    stackShort?: string
  }
}

// ============================================================================
// IBKR Broker Integration Types (Option A: 3 Accounts)
// ============================================================================
//
// Firestore Collections:
//   - brokerAccounts/{brokerAccountKey}    → BrokerAccountDoc
//   - trading/controls                      → TradingControlsDoc
//   - executionRequests/{requestId}         → ExecutionRequestDoc
//   - brokerOrders/{requestId}              → BrokerOrderDoc
//   - brokerInstruments/{assetKey}         → contract cache (conId, etc.)
//   - executor_consumers/{brokerAccountKey} → executor heartbeat
// ============================================================================

export type BrokerAccountKey = "acct1" | "acct2" | "acct3"

/** Firestore: brokerAccounts/{brokerAccountKey} */
export type BrokerAccountDoc = {
  brokerAccountKey: BrokerAccountKey
  ibAccountCode: string
  gatewayHost: string
  gatewayPortPaper: number
  gatewayPortLive: number
  clientIdPaper: number
  clientIdLive: number
  enabled: boolean
  paperEnabled: boolean
  liveEnabled: boolean
  allowedUids: string[]
  notes?: string
  ordersRefreshRequestedAt?: FirestoreTimestamp
  updatedAt?: FirestoreTimestamp
}

/** Firestore: executor_consumers/{brokerAccountKey} */
export type ExecutorConsumerDoc = {
  brokerAccountKey: BrokerAccountKey
  sessionId?: string
  lastHeartbeat?: FirestoreTimestamp
  lastConnectAttemptAt?: FirestoreTimestamp
  lastConnectionAt?: FirestoreTimestamp
  lastConnectError?: string
  status?: "listening" | "idle"
  ibConnected?: boolean
  ibAccount?: string
  ibMode?: ExecutionMode
  stats?: {
    claimed?: number
    submitted?: number
    filled?: number
    rejected?: number
    errors?: number
  }
}

export type TradingControlsCaps = {
  maxNotionalPerTrade?: number
  maxDailyNotional?: number
  maxOrdersPerMinute?: number
  maxOpenOrders?: number
}

export type TradingControlsDoc = {
  ibkrEnabled: boolean
  killSwitch: boolean
  requireManualConfirm: boolean
  requireBracket: boolean
  limitOnly: boolean
  caps: TradingControlsCaps
  updatedAt?: FirestoreTimestamp
}

export type ExecutionMode = "paper" | "live"

export type ExecutionStatus =
  | "pending"
  | "approved"
  | "claimed"
  | "submitted"
  | "working"
  | "filled"
  | "partial"
  | "cancelled"
  | "rejected"
  | "error"
  | "expired"

export type OrderSnapshot = {
  symbol: string
  assetClass: "crypto" | "stock" | "forex"
  assetKey: string
  exchange?: string
  primaryExchange?: string
  side: "buy" | "sell"
  quantity: number
  orderType: "limit" | "market"
  limitPrice?: number
  stopLoss?: number
  takeProfit?: number
  timeInForce?: "DAY" | "GTC" | "IOC"
}

export type TradeProposalDoc = {
  id: string
  brokerAccountKey: BrokerAccountKey
  symbol: string
  assetClass: "crypto" | "stock" | "forex"
  assetKey: string
  side: "buy" | "sell"
  exchange?: string
  primaryExchange?: string
  quantity: number
  price: number
  stopLoss?: number
  takeProfit?: number
  orderDraft?: OrderSnapshot
  score?: number
  confidence?: number
  profile?: string
  analysis?: unknown
  computedAt: FirestoreTimestamp
  expiresAt: FirestoreTimestamp
  updatedAt?: FirestoreTimestamp
}

export type ExecutionRequestDoc = {
  id: string
  brokerAccountKey: BrokerAccountKey
  proposalId: string
  requestedByUid: string
  approvedByUid?: string
  ibAccountCodeSnapshot?: string
  approvedAt?: FirestoreTimestamp
  mode: ExecutionMode
  status: ExecutionStatus
  statusReason?: string
  orderSnapshot: OrderSnapshot
  expiresAt: FirestoreTimestamp
  claimedAt?: FirestoreTimestamp
  claimedBy?: string
  claimSessionId?: string
  submittedAt?: FirestoreTimestamp
  filledAt?: FirestoreTimestamp
  cancelledAt?: FirestoreTimestamp
  rejectedAt?: FirestoreTimestamp
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

export type BrokerOrderDoc = {
  id: string
  brokerAccountKey: BrokerAccountKey
  ibAccountCode: string
  gatewayInstanceId?: string
  executionRequestId: string
  symbol?: string
  assetKey?: string
  side?: "buy" | "sell"
  quantity?: number
  orderType?: "limit" | "market"
  limitPrice?: number
  stopLoss?: number
  takeProfit?: number
  conId?: number
  parentOrderId?: number
  tpOrderId?: number
  slOrderId?: number
  orderIds: number[]
  status: ExecutionStatus
  filledQuantity?: number
  avgFillPrice?: number
  lastError?: string
  submittedAt?: FirestoreTimestamp
  lastUpdateAt?: FirestoreTimestamp
  createdAt: FirestoreTimestamp
}

export type BrokerPositionDoc = {
  id: string
  brokerAccountKey: BrokerAccountKey
  assetKey: string
  symbol: string
  assetClass?: "stock" | "forex"
  exchange?: string
  primaryExchange?: string
  currency?: string
  position: number
  avgCost?: number
  marketPrice?: number
  marketValue?: number
  unrealizedPnl?: number
  realizedPnl?: number
  account?: string
  isOpen?: boolean
  updatedAt?: FirestoreTimestamp
}

export type BrokerAccountSummaryDoc = {
  id: string
  brokerAccountKey: BrokerAccountKey
  account?: string
  currency?: string
  values?: {
    netLiquidation?: number
    totalCash?: number
    availableFunds?: number
    buyingPower?: number
    unrealizedPnl?: number
    realizedPnl?: number
  }
  updatedAt?: FirestoreTimestamp
}
