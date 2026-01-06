import type { Timestamp } from "firebase/firestore"

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
  side?: "buy" | "sell" | "hold"
  strength?: number
  message?: string
  createdAt?: Timestamp
  data?: Record<string, unknown>
}

export type BotCommandDoc = {
  id: string
  type: BotCommandType
  payload?: Record<string, unknown>
  createdAt?: Timestamp
  status?: "queued" | "running" | "completed" | "failed"
  requestedBy?: string
}

export type MarketHotTrade = {
  assetClass: "crypto" | "stock" | "forex"
  symbol: string
  name?: string
  exchange?: string
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
  source?: string
  rationale?: string
}

export type MarketHotTradesDoc = {
  updatedAt?: Timestamp
  items?: MarketHotTrade[]
  sources?: Record<string, string>
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
  updatedAt?: Timestamp
  items?: MarketPopularItem[]
  meta?: Record<string, unknown>
}

export type MarketControlsDoc = {
  updatedAt?: Timestamp
  llmIntervalMinutes?: number
  enableLLM?: boolean
  dipHorizon?: "1h" | "24h" | "7d"
  riskProfile?: "conservative" | "balanced" | "aggressive"
  assetFocus?: Array<"crypto" | "stock" | "forex">
  primaryAssets?: {
    crypto?: string[]
    stocks?: string[]
    forex?: string[]
  }
}

export type MarketUniverseDoc = {
  updatedAt?: Timestamp
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
