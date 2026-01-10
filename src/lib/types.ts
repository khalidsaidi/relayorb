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
  profile?: "dip" | "scalp"
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
}

export type MarketHotTradesDoc = {
  updatedAt?: FirestoreTimestamp
  items?: MarketHotTrade[]
  sources?: Record<string, string>
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

export type PaperWallet = {
  userId: string
  balance: number
  currency: string // "USD"
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type PaperTransaction = {
  id: string
  userId: string
  botId?: string // if triggered by a bot
  symbol: string
  assetClass: "crypto" | "stock" | "forex"
  side: "buy" | "sell"
  amount: number // quantity
  price: number
  cost: number // total cost
  timestamp: Timestamp
  type: "open" | "close"
  stopLoss?: number
  takeProfit?: number
}

export type PaperPosition = {
  symbol: string
  assetClass: "crypto" | "stock" | "forex"
  avgEntryPrice: number
  quantity: number
  currentPrice?: number
  unrealizedPnL?: number
  stopLoss?: number
  takeProfit?: number
}
