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
  | "backtest"
  | "paper"
  | "live"
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
      }
    >
  }
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
  base?: number
  momentum?: number
  shortMomentum?: number
  consensus?: number
  strength?: number
  recency?: number
  liquidity?: number
  watchlist?: number
  primary?: number
}

export type MarketTradeAnalysis = {
  summary?: string
  details?: string[]
}

export type MarketTradeTrendSnapshot = {
  horizon?: TrendHorizon
  score?: number
  components?: {
    momentum?: number
    volume?: number
    signals?: number
    news?: number
  }
  momentum?: {
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
  score?: number
  confidence?: number
  primary?: boolean
  momentum?: {
    change1h?: number
    change24h?: number
    change7d?: number
  }
  signals?: {
    total?: number
    buy?: number
    sell?: number
    strengthAvg?: number
    bots?: string[]
  }
  scoreComponents?: MarketTradeScoreComponents
  trend?: MarketTradeTrendSnapshot
  news?: MarketTradeNewsSnapshot
  analysis?: MarketTradeAnalysis
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
  news?: number
}

export type MarketTrendItem = {
  assetClass: "crypto" | "stock" | "forex"
  symbol: string
  name?: string
  price?: number
  horizon: TrendHorizon
  score?: number
  components?: {
    momentum?: number
    volume?: number
    signals?: number
    news?: number
  }
  news?: {
    count?: number
    sentiment?: number
    score?: number
  }
  momentum?: {
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
}

export type MarketUniverseDoc = {
  updatedAt?: FirestoreTimestamp
  crypto?: {
    includeTrending?: boolean
    symbols?: string[]
  }
  stocks?: {
    includeTrending?: boolean
    symbols?: string[]
  }
  forex?: {
    includeTrending?: boolean
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
