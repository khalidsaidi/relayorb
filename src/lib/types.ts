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

export type BotDoc = {
  id: string
  name?: string
  engine?: string
  status?: BotStatus
  lastHeartbeat?: Timestamp
  updatedAt?: Timestamp
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

export type BotCommandDoc = {
  id: string
  type: BotCommandType
  payload?: Record<string, unknown>
  createdAt?: Timestamp
  status?: "queued" | "running" | "completed" | "failed"
  requestedBy?: string
}
