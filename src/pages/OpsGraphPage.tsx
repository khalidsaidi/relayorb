import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  Handle,
  Position,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  MarkerType,
  getSmoothStepPath,
} from "reactflow"
import { motion } from "framer-motion"
import {
  Activity,
  Bot,
  ChartCandlestick,
  Database,
  GitBranch,
  Globe,
  HelpCircle,
  GripVertical,
  Monitor,
  Radar,
  Router,
  Signal,
  TriangleAlert,
} from "lucide-react"

import "reactflow/dist/style.css"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"
import type { PipelineEvent } from "@/lib/types"
import graphSpec from "@/ops/graph_topology.json"
import { usePipelineEvents } from "@/features/ops/use-pipeline-events"
import "@/features/ops/reactflow-dev-warnings"

const EDGE_COLORS: Record<string, string> = {
  read: "#1d4ed8",
  write: "#059669",
  call: "#ea580c",
  event: "#0284c7",
  trigger: "#d97706",
}

const CATEGORY_COLORS: Record<string, string> = {
  store: "#2563eb",
  service: "#0f766e",
  compute: "#0891b2",
  queue: "#d97706",
  bot: "#16a34a",
  score: "#0284c7",
  ui: "#475569",
  provider: "#ea580c",
  gateway: "#06b6d4",
  chart: "#1d4ed8",
  unknown: "#64748b",
}

const CATEGORY_STYLES: Record<string, string> = {
  store: "bg-blue-100/95 text-slate-900 ring-blue-400/80",
  service: "bg-teal-100/95 text-slate-900 ring-teal-400/80",
  compute: "bg-cyan-100/95 text-slate-900 ring-cyan-400/80",
  queue: "bg-amber-100/95 text-slate-900 ring-amber-400/80",
  bot: "bg-emerald-100/95 text-slate-900 ring-emerald-400/80",
  score: "bg-sky-100/95 text-slate-900 ring-sky-400/80",
  ui: "bg-slate-100/95 text-slate-900 ring-slate-400/80",
  provider: "bg-orange-100/95 text-slate-900 ring-orange-400/80",
  gateway: "bg-cyan-100/95 text-slate-900 ring-cyan-400/80",
  chart: "bg-blue-100/95 text-slate-900 ring-blue-400/80",
  unknown: "bg-slate-200/90 text-slate-900 ring-slate-400/80",
}

const CATEGORY_GLOWS: Record<string, string> = {
  store: "37,99,235",
  service: "20,184,166",
  compute: "14,165,233",
  queue: "217,119,6",
  bot: "22,163,74",
  score: "2,132,199",
  ui: "100,116,139",
  provider: "249,115,22",
  gateway: "14,165,233",
  chart: "37,99,235",
  unknown: "100,116,139",
}

const STATUS_STYLES: Record<string, string> = {
  idle: "opacity-85",
  active: "ring-2 ring-sky-500/70 shadow-[0_0_22px_rgba(37,99,235,0.45)]",
  error: "ring-2 ring-rose-500/70 shadow-[0_0_22px_rgba(244,63,94,0.45)]",
}

const ICONS: Record<string, typeof Activity> = {
  store: Database,
  service: Activity,
  compute: Radar,
  queue: GitBranch,
  bot: Bot,
  score: Signal,
  ui: Monitor,
  provider: Globe,
  gateway: Router,
  chart: ChartCandlestick,
  unknown: HelpCircle,
}

const FLOW_LANES: FlowLaneSpec[] = [
  {
    id: "lane-core",
    label: "Core Pipeline",
    tone: "sky",
    match: (node) =>
      [
        "price_streamer",
        "redis",
        "market_intel",
        "movers_15m",
        "candidates_merge",
        "score_compute",
        "firestore",
        "ui",
      ].includes(node.id),
  },
  {
    id: "lane-batch",
    label: "Batch + Bots",
    tone: "emerald",
    match: (node) =>
      [
        "new_batch",
        "refresh_service",
        "relayorb_agent",
        "bot_signals",
        "signal_evaluator",
        "signal_performance",
      ].includes(node.id) || node.id.startsWith("bot_engine:"),
  },
  {
    id: "lane-providers",
    label: "Provider Gateway",
    tone: "amber",
    match: (node) =>
      ["chart_proxy", "market_data_gateway"].includes(node.id) ||
      node.id.startsWith("provider:"),
  },
]

const LANE_STYLES: Record<FlowLaneData["tone"], { border: string; bg: string; text: string }> = {
  sky: {
    border: "border-sky-200/70",
    bg: "bg-gradient-to-br from-sky-100/40 via-sky-50/20 to-transparent",
    text: "text-sky-700",
  },
  emerald: {
    border: "border-emerald-200/70",
    bg: "bg-gradient-to-br from-emerald-100/40 via-emerald-50/20 to-transparent",
    text: "text-emerald-700",
  },
  amber: {
    border: "border-amber-200/70",
    bg: "bg-gradient-to-br from-amber-100/40 via-amber-50/20 to-transparent",
    text: "text-amber-700",
  },
}

const NODE_DIMENSIONS = { width: 240, height: 70 }
const LANE_PADDING = { x: 120, y: 70 }

const REQUIRED_BATCH_EDGES = [
  "market_intel->new_batch",
  "new_batch->relayorb_agent",
  "new_batch->refresh_service",
  "refresh_service->signal_evaluator",
  "relayorb_agent->bot_signals",
  "candidates_merge->firestore",
  "score_compute->firestore",
]

const CRITICAL_EDGE_IDS = [
  "price_streamer->market_data_gateway",
  "market_data_gateway->provider:fmp",
  "market_data_gateway->provider:marketaux",
  "signal_evaluator->market_data_gateway",
  "price_streamer->redis",
  "redis->market_intel",
  "market_intel->movers_15m",
  "movers_15m->candidates_merge",
  "candidates_merge->firestore",
  "market_intel->new_batch",
  "new_batch->relayorb_agent",
  "new_batch->refresh_service",
  "refresh_service->signal_evaluator",
  "relayorb_agent->bot_engine:freqtrade",
  "relayorb_agent->bot_engine:backtrader",
  "relayorb_agent->bot_signals",
  "firestore->signal_evaluator",
  "signal_evaluator->firestore",
  "firestore->ui",
]

type GraphNodeSpec = {
  id: string
  label: string
  x: number
  y: number
  category: string
  type?: string
  core?: boolean
}

type GraphEdgeSpec = {
  id: string
  from: string
  to: string
  kind: string
  core?: boolean
  label?: string
  labelMode?: "auto" | "always"
}

type NodeStats = {
  lastEvent?: PipelineEvent
  errorCount: number
  avgDuration: number | null
  durationSum: number
  durationCount: number
  lastSeen: number | null
}

type EdgeStats = {
  lastEvent?: PipelineEvent
  errorCount: number
  avgDuration: number | null
  durationSum: number
  durationCount: number
  eventCount: number
  lastSeen: number | null
}

type GraphNodeData = {
  label: string
  category: string
  intensity: number
  status: "idle" | "active" | "error"
  lastEvent?: PipelineEvent
  errorCount: number
  avgDuration: number | null
  core?: boolean
  step?: number
  pathActive?: boolean
  dimmed?: boolean
  highlighted?: boolean
  metaLines?: string[]
  metaBadges?: string[]
  freeze?: boolean
  minimalVisible?: boolean
}

type GraphEdgeData = {
  intensity: number
  color: string
  kind: string
  lastEvent?: PipelineEvent
  avgDuration: number | null
  errorCount: number
  pathActive?: boolean
  dimmed?: boolean
  highlighted?: boolean
  core?: boolean
  traffic?: number
  label?: string | null
  labelMode?: "auto" | "always"
  status?: PipelineEvent["status"]
  statusColor?: string
  ageMs?: number | null
  pulseKey?: number
  freeze?: boolean
  minimalVisible?: boolean
}

type FlowLaneData = {
  label: string
  tone: "sky" | "emerald" | "amber"
}

type FlowLaneSpec = {
  id: string
  label: string
  tone: FlowLaneData["tone"]
  match: (node: GraphNodeSpec) => boolean
}

type BatchState = {
  batchId: string
  lastEventAt: number
  lastEdgeKey?: string
  status: string
}

type SymbolSummary = {
  symbolKey: string
  lastEventAt: number
  lastEdgeKey?: string
  origins: string[]
  action?: string | null
  score?: number | null
}

type FilterState = {
  batchId: string
  symbolKey: string
  providerId: string
  botEngineId: string
  onlyErrors: boolean
  onlyBots: boolean
  onlyExternal: boolean
  onlyReads: boolean
  onlyWrites: boolean
  onlyCalls: boolean
  onlyTriggers: boolean
  showUnknown: boolean
}

const STATION_NODE_FALLBACK: Record<string, string[]> = {
  redis_hot: ["redis"],
  mi_movers: ["market_intel", "movers_15m"],
  mi_candidates: ["market_intel", "candidates_merge"],
  scoring: ["market_intel", "score_compute"],
  analysis_written: ["score_compute", "firestore", "ui"],
  mi_batch_written: ["candidates_merge", "firestore"],
  mi_new_batch: ["market_intel", "new_batch"],
  refresh_trigger: ["refresh_service"],
  refresh_poll: ["refresh_service", "firestore"],
  agent: ["relayorb_agent"],
  bot_signals: ["bot_signals"],
  signal_eval: ["signal_evaluator"],
  signal_performance: ["signal_performance"],
  mdg: ["market_data_gateway"],
  chart_proxy: ["chart_proxy"],
  ui_visible: ["ui"],
}

const STATION_EDGE_FALLBACK: Record<string, string> = {
  redis_hot: "price_streamer->redis",
  mi_movers: "market_intel->movers_15m",
  mi_candidates: "movers_15m->candidates_merge",
  scoring: "candidates_merge->score_compute",
  analysis_written: "score_compute->firestore",
  mi_batch_written: "candidates_merge->firestore",
  mi_new_batch: "market_intel->new_batch",
  refresh_trigger: "new_batch->refresh_service",
  refresh_poll: "firestore->refresh_service",
  agent: "new_batch->relayorb_agent",
  bot_signals: "relayorb_agent->bot_signals",
  signal_eval: "firestore->signal_evaluator",
  signal_performance: "signal_evaluator->signal_performance",
  mdg: "market_data_gateway->provider:unknown",
  chart_proxy: "chart_proxy->market_data_gateway",
}

const NODE_ALIASES: Record<string, string> = {
  mdg: "market_data_gateway",
  marketdatagateway: "market_data_gateway",
  signal_eval: "signal_evaluator",
  ui_visible: "ui",
  agent: "relayorb_agent",
  mi_new_batch: "new_batch",
  refresh_poll: "refresh_service",
  refresh_trigger: "refresh_service",
  mi_movers: "movers_15m",
  mi_candidates: "candidates_merge",
  mi_batch_written: "firestore",
}

function normalizeNodeId(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("provider:") || trimmed.startsWith("bot_engine:")) return trimmed
  const lowered = trimmed.toLowerCase()
  const underscored = lowered.replace(/-/g, "_")
  return NODE_ALIASES[underscored] || NODE_ALIASES[lowered] || underscored
}

function parseEdgeKey(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes("->")) {
    const parts = trimmed.split("->")
    if (parts.length < 2) return null
    const from = normalizeNodeId(parts[0])
    const to = normalizeNodeId(parts.slice(1).join("->"))
    return from && to ? { from, to } : null
  }
  if (trimmed.includes("→")) {
    const parts = trimmed.split("→")
    if (parts.length < 2) return null
    const from = normalizeNodeId(parts[0])
    const to = normalizeNodeId(parts.slice(1).join("→"))
    return from && to ? { from, to } : null
  }
  const dashIndex = trimmed.indexOf("-")
  if (dashIndex > 0) {
    const from = normalizeNodeId(trimmed.slice(0, dashIndex))
    const to = normalizeNodeId(trimmed.slice(dashIndex + 1))
    return from && to ? { from, to } : null
  }
  return null
}

function normalizeEdgeKey(raw: string) {
  const parsed = parseEdgeKey(raw)
  if (!parsed) return raw.trim()
  return `${parsed.from}->${parsed.to}`
}

function resolveBatchId(event: PipelineEvent) {
  if (event.batchId) return event.batchId
  const meta = event.meta as Record<string, unknown> | undefined
  const fallback = typeof meta?.runId === "string" ? meta.runId : null
  return fallback || null
}

function extractOriginList(meta: Record<string, unknown> | undefined) {
  const raw = meta?.origins
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean)
  }
  if (typeof raw === "object") {
    return Object.keys(raw as Record<string, unknown>).filter(Boolean)
  }
  return []
}

function resolveEdgeKey(event: PipelineEvent) {
  if (event.edgeKey) return normalizeEdgeKey(event.edgeKey)
  const stationId = event.stationId
  if (!stationId) return ""
  if (stationId.startsWith("provider:")) return `market_data_gateway->${stationId}`
  if (stationId.startsWith("bot_engine:")) return `relayorb_agent->${stationId}`
  return STATION_EDGE_FALLBACK[stationId] || ""
}

function resolveEdgeKeys(event: PipelineEvent) {
  const base = resolveEdgeKey(event)
  if (!base) return []
  const derived: string[] = []
  if (base === "relayorb_agent->bot_signals") derived.push("bot_signals->firestore")
  if (base === "signal_evaluator->signal_performance") derived.push("signal_evaluator->firestore")
  return [base, ...derived]
}

function resolveNodeIds(event: PipelineEvent) {
  if (Array.isArray(event.nodeIds) && event.nodeIds.length > 0) {
    return event.nodeIds.map((id) => normalizeNodeId(String(id))).filter(Boolean)
  }
  const stationId = event.stationId
  if (!stationId) return []
  if (stationId.startsWith("provider:") || stationId.startsWith("bot_engine:")) return [stationId]
  const fallback = STATION_NODE_FALLBACK[stationId] || []
  if (fallback.length) return fallback.map((id) => normalizeNodeId(id)).filter(Boolean)
  return [normalizeNodeId(stationId)].filter(Boolean)
}

function formatAge(ms: number) {
  if (!Number.isFinite(ms)) return "-"
  const clamped = Math.max(ms, 0)
  const seconds = Math.floor(clamped / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes % 60 > 0 || hours > 0) parts.push(`${minutes % 60}m`)
  parts.push(`${seconds % 60}s`)
  return parts.join(" ")
}

type LayoutDirection = "LR" | "TB"

const CATEGORY_RANK_HINT: Record<string, number> = {
  provider: 0,
  gateway: 1,
  chart: 1,
  service: 2,
  compute: 3,
  queue: 3,
  bot: 4,
  score: 4,
  store: 5,
  ui: 6,
  unknown: 7,
}

const CATEGORY_BAND_HINT: Record<string, number> = {
  provider: 0,
  gateway: 1,
  chart: 1,
  service: 2,
  compute: 3,
  queue: 4,
  bot: 5,
  score: 6,
  store: 7,
  ui: 8,
  unknown: 9,
}

function computeFlowLayout(
  nodes: GraphNodeSpec[],
  edges: GraphEdgeSpec[],
  direction: LayoutDirection
) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, string[]>()
  const incomingCount = new Map<string, number>()
  const incomingList = new Map<string, string[]>()
  nodes.forEach((node) => {
    outgoing.set(node.id, [])
    incomingCount.set(node.id, 0)
    incomingList.set(node.id, [])
  })

  const layoutEdges = edges.filter((edge) => edge.kind !== "read")
  layoutEdges.forEach((edge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return
    outgoing.get(edge.from)?.push(edge.to)
    incomingCount.set(edge.to, (incomingCount.get(edge.to) || 0) + 1)
    incomingList.get(edge.to)?.push(edge.from)
  })

  const ranks = new Map<string, number>()
  const queue: string[] = []
  nodes.forEach((node) => {
    if ((incomingCount.get(node.id) || 0) === 0) {
      queue.push(node.id)
      ranks.set(node.id, 0)
    }
  })

  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    const rank = ranks.get(current) || 0
    const targets = outgoing.get(current) || []
    targets.forEach((target) => {
      const nextRank = Math.max(ranks.get(target) || 0, rank + 1)
      ranks.set(target, nextRank)
      const remaining = (incomingCount.get(target) || 0) - 1
      incomingCount.set(target, remaining)
      if (remaining === 0) queue.push(target)
    })
  }

  let maxRank = Math.max(0, ...Array.from(ranks.values()))
  nodes.forEach((node) => {
    const hint = CATEGORY_RANK_HINT[node.category] ?? 3
    let rank = ranks.get(node.id)
    if (rank === undefined) rank = hint
    rank = Math.max(rank, hint)
    ranks.set(node.id, rank)
    maxRank = Math.max(maxRank, rank)
  })

  nodes.forEach((node) => {
    if (node.category === "unknown") {
      ranks.set(node.id, maxRank + 1)
    }
  })

  maxRank = Math.max(0, ...Array.from(ranks.values()))

  const rankGroups = new Map<number, string[]>()
  nodes.forEach((node) => {
    const rank = ranks.get(node.id) || 0
    if (!rankGroups.has(rank)) rankGroups.set(rank, [])
    rankGroups.get(rank)?.push(node.id)
  })

  const order = new Map<string, number>()
  rankGroups.forEach((ids) => {
    ids.sort((a, b) => {
      const nodeA = nodes.find((node) => node.id === a)
      const nodeB = nodes.find((node) => node.id === b)
      const yA = nodeA?.y ?? 0
      const yB = nodeB?.y ?? 0
      if (yA !== yB) return yA - yB
      return a.localeCompare(b)
    })
    ids.forEach((id, index) => order.set(id, index))
  })

  const ranksSorted = Array.from(rankGroups.keys()).sort((a, b) => a - b)

  const reorderRank = (rank: number, forward: boolean) => {
    const ids = rankGroups.get(rank)
    if (!ids || ids.length <= 1) return
    const scored = ids.map((id) => {
      const neighbors = forward ? incomingList.get(id) || [] : outgoing.get(id) || []
      const scores = neighbors
        .map((neighbor) => order.get(neighbor))
        .filter((value): value is number => typeof value === "number")
      const score =
        scores.length > 0
          ? scores.reduce((sum, value) => sum + value, 0) / scores.length
          : order.get(id) || 0
      return { id, score, fallback: order.get(id) || 0 }
    })
    scored.sort((a, b) => a.score - b.score || a.fallback - b.fallback || a.id.localeCompare(b.id))
    rankGroups.set(rank, scored.map((item) => item.id))
    scored.forEach((item, index) => order.set(item.id, index))
  }

  for (let pass = 0; pass < 2; pass += 1) {
    ranksSorted.forEach((rank) => reorderRank(rank, true))
    ranksSorted.slice().reverse().forEach((rank) => reorderRank(rank, false))
  }

  const nodeGapX = 320
  const nodeGapY = 160
  const positions = new Map<string, { x: number; y: number }>()
  const categoryById = new Map(nodes.map((node) => [node.id, node.category]))
  const mainGap = direction === "LR" ? nodeGapX : nodeGapY
  const crossGap = direction === "LR" ? nodeGapY : nodeGapX
  const bandGap = crossGap * 0.6
  ranksSorted.forEach((rank) => {
    const ids = rankGroups.get(rank) || []
    const bandGroups = new Map<number, string[]>()
    ids.forEach((id) => {
      const category = categoryById.get(id) || "unknown"
      const band = CATEGORY_BAND_HINT[category] ?? 9
      if (!bandGroups.has(band)) bandGroups.set(band, [])
      bandGroups.get(band)?.push(id)
    })
    const bandsSorted = Array.from(bandGroups.keys()).sort((a, b) => a - b)
    let offsetPx = 0
    bandsSorted.forEach((band) => {
      const bandIds = bandGroups.get(band) || []
      bandIds.forEach((id, index) => {
        const main = rank * mainGap
        const cross = offsetPx + index * crossGap
        const x = direction === "LR" ? main : cross
        const y = direction === "LR" ? cross : main
        positions.set(id, { x, y })
      })
      if (bandIds.length) offsetPx += bandIds.length * crossGap + bandGap
    })
  })

  let minX = Infinity
  let minY = Infinity
  positions.forEach((pos) => {
    if (pos.x < minX) minX = pos.x
    if (pos.y < minY) minY = pos.y
  })
  const padX = 120
  const padY = 120
  positions.forEach((pos, id) => {
    positions.set(id, { x: pos.x - minX + padX, y: pos.y - minY + padY })
  })

  return positions
}

function formatOriginSummary(origins: Record<string, unknown> | null | undefined) {
  if (!origins) return null
  const entries = Object.entries(origins)
    .map(([key, value]) => ({
      key,
      count: typeof value === "number" ? value : Number(value),
    }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  if (entries.length === 0) return null
  const summary = entries.map((item) => `${item.key}:${item.count}`).join(" · ")
  return `Origins ${summary}`
}

function formatOriginBadges(origins: Record<string, unknown> | null | undefined) {
  if (!origins) return null
  const orderedKeys = ["mover15m", "user_universe", "manual", "trending", "other"]
  const entries = orderedKeys
    .map((key) => ({
      key,
      count: typeof origins[key] === "number" ? Number(origins[key]) : 0,
    }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0)
  if (entries.length === 0) return null
  return entries.map((item) => {
    const label =
      item.key === "mover15m"
        ? "Movers"
        : item.key === "user_universe"
          ? "Universe"
          : item.key === "manual"
            ? "Manual"
            : item.key === "trending"
              ? "Trending"
              : "Other"
    return `${label} ${item.count}`
  })
}

function summarizeNodeMeta(event?: PipelineEvent) {
  if (!event?.meta || typeof event.meta !== "object") return null
  const meta = event.meta as Record<string, unknown>
  if (typeof meta.candidateCount === "number") return `${meta.candidateCount} candidates`
  if (typeof meta.count === "number") return `${meta.count} items`
  if (typeof meta.scored === "number") return `${meta.scored} scored`
  if (
    typeof meta.buy === "number" ||
    typeof meta.hold === "number" ||
    typeof meta.sell === "number"
  ) {
    const buy = typeof meta.buy === "number" ? meta.buy : 0
    const hold = typeof meta.hold === "number" ? meta.hold : 0
    const sell = typeof meta.sell === "number" ? meta.sell : 0
    return `B ${buy} · H ${hold} · S ${sell}`
  }
  if (typeof meta.symbolsUpdated === "number") return `${meta.symbolsUpdated} updates`
  if (typeof meta.latencyMs === "number") return `${Math.round(meta.latencyMs)} ms`
  return null
}

function computeLatencyStats(events: PipelineEvent[]) {
  const durations = events
    .map((event) => (typeof event.durationMs === "number" ? event.durationMs : null))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)
  if (durations.length === 0) return null
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length
  const index = Math.max(0, Math.floor(durations.length * 0.95) - 1)
  const p95 = durations[index]
  return { avg, p95, count: durations.length }
}

function computeEventRate(events: PipelineEvent[]) {
  if (events.length < 2) return null
  const times = events
    .map((event) => Date.parse(event.ts))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (times.length < 2) return null
  const spanMs = times[times.length - 1] - times[0]
  if (spanMs <= 0) return null
  return (events.length / spanMs) * 60000
}

function mergeEvents(primary: PipelineEvent[], secondary: PipelineEvent[], limit: number) {
  const merged: PipelineEvent[] = []
  const seen = new Set<string>()
  const add = (event: PipelineEvent) => {
    const key = event.eventId || `${event.stationId}-${event.ts}`
    if (seen.has(key)) return
    seen.add(key)
    merged.push(event)
  }
  primary.forEach(add)
  secondary.forEach(add)
  return merged.slice(0, limit)
}

function collectInputSummary(events: PipelineEvent[]) {
  const redisKeys = new Set<string>()
  const firestoreDocs = new Set<string>()
  const providerCalls = new Map<string, Record<string, unknown>>()
  events.forEach((event) => {
    event.inputs?.redisKeys?.forEach((key) => redisKeys.add(key))
    event.inputs?.firestoreDocs?.forEach((doc) => firestoreDocs.add(doc))
    event.inputs?.providerCalls?.forEach((call) => {
      const providerId = String((call as Record<string, unknown>)?.providerId || "unknown")
      const endpoint = String((call as Record<string, unknown>)?.endpointName || "endpoint")
      const key = `${providerId}:${endpoint}`
      if (!providerCalls.has(key)) providerCalls.set(key, call as Record<string, unknown>)
    })
  })
  return {
    redisKeys: Array.from(redisKeys.values()).slice(0, 8),
    firestoreDocs: Array.from(firestoreDocs.values()).slice(0, 8),
    providerCalls: Array.from(providerCalls.values()).slice(0, 8),
  }
}

function eventMatchesFilters(event: PipelineEvent, filters: FilterState) {
  const batchFilter = filters.batchId.trim()
  if (batchFilter) {
    const batchId = resolveBatchId(event)
    if (!batchId || !batchId.includes(batchFilter)) return false
  }

  const symbolFilter = filters.symbolKey.trim()
  if (symbolFilter) {
    const symbolKey = event.symbolKey || ""
    if (!symbolKey.toLowerCase().includes(symbolFilter.toLowerCase())) return false
  }

  const providerFilter = filters.providerId.trim().toLowerCase()
  if (providerFilter) {
    const station = event.stationId || ""
    const edgeKey = event.edgeKey || ""
    const metaProvider =
      typeof (event.meta as Record<string, unknown> | undefined)?.providerId === "string"
        ? String((event.meta as Record<string, unknown>).providerId)
        : ""
    const matches =
      station.toLowerCase().includes(providerFilter) ||
      edgeKey.toLowerCase().includes(`provider:${providerFilter}`) ||
      metaProvider.toLowerCase() === providerFilter
    if (!matches) return false
  }

  const botFilter = filters.botEngineId.trim().toLowerCase()
  if (botFilter) {
    const station = event.stationId || ""
    const edgeKey = event.edgeKey || ""
    const metaEngine =
      typeof (event.meta as Record<string, unknown> | undefined)?.engine === "string"
        ? String((event.meta as Record<string, unknown>).engine)
        : typeof (event.meta as Record<string, unknown> | undefined)?.botEngineId === "string"
          ? String((event.meta as Record<string, unknown>).botEngineId)
          : ""
    const matches =
      station.toLowerCase().includes(`bot_engine:${botFilter}`) ||
      edgeKey.toLowerCase().includes(`bot_engine:${botFilter}`) ||
      metaEngine.toLowerCase().includes(botFilter)
    if (!matches) return false
  }

  if (filters.onlyErrors && event.status !== "error") return false

  if (filters.onlyBots) {
    const station = event.stationId || ""
    const edgeKey = event.edgeKey || ""
    const isBot =
      station.startsWith("bot_engine:") ||
      station === "bot_signals" ||
      event.service === "relayorb-agent" ||
      edgeKey.includes("bot_engine") ||
      edgeKey.includes("bot_signals")
    if (!isBot) return false
  }

  if (filters.onlyExternal) {
    const station = event.stationId || ""
    const edgeKey = event.edgeKey || ""
    const isExternal =
      station.startsWith("provider:") ||
      edgeKey.includes("provider:") ||
      event.eventType === "provider_call"
    if (!isExternal) return false
  }

  const kind = inferEdgeKind(event)
  if (filters.onlyReads && kind !== "read") return false
  if (filters.onlyWrites && kind !== "write") return false
  if (filters.onlyCalls && kind !== "call") return false
  if (filters.onlyTriggers && kind !== "trigger") return false

  return true
}

function inferEdgeKind(event: PipelineEvent) {
  const type = (event.eventType || "").toLowerCase()
  if (type.includes("redis")) return type.includes("read") ? "read" : "write"
  if (type.includes("firestore") || type.startsWith("fs_")) {
    return type.includes("read") ? "read" : "write"
  }
  if (type.includes("provider") || type.includes("http") || type.includes("call")) return "call"
  if (type.includes("trigger") || type.includes("publish") || type.includes("consume")) return "trigger"
  return "event"
}

function FlowLaneNode({ data }: NodeProps<FlowLaneData>) {
  const style = LANE_STYLES[data.tone]
  return (
    <div
      className={cn(
        "pointer-events-none relative h-full w-full rounded-[28px] border border-dashed",
        "shadow-[0_20px_40px_-32px_rgba(15,23,42,0.25)]",
        style.border,
        style.bg
      )}
    >
      <div
        className={cn(
          "absolute left-6 top-4 text-[10px] font-semibold uppercase tracking-[0.32em]",
          style.text
        )}
      >
        {data.label}
      </div>
      <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_15%_25%,rgba(255,255,255,0.8),transparent_55%)]" />
    </div>
  )
}

function GraphNode({ data }: NodeProps<GraphNodeData>) {
  const Icon = ICONS[data.category] || Activity
  const dimmed = Boolean(data.dimmed)
  const accent = CATEGORY_COLORS[data.category] || "#64748b"
  const accentRgb = CATEGORY_GLOWS[data.category] || "100,116,139"
  const pathBoost = data.pathActive ? 0.55 : 0
  const highlightBoost = data.highlighted ? 0.35 : 0
  const intensityBase = Math.min(Math.max(data.intensity + pathBoost + highlightBoost, 0), 1)
  const baseMin = data.minimalVisible ? 0.15 : 0
  const intensityClamped = Math.max(baseMin, intensityBase)
  const intensity = dimmed ? intensityClamped * 0.35 : intensityClamped
  const glowColor =
    data.status === "error"
      ? "244,63,94"
      : CATEGORY_GLOWS[data.category] || "148,163,184"
  const glow = intensity > 0.05
    ? `0 0 ${12 + intensity * 26}px rgba(${glowColor}, ${0.18 + intensity * 0.55})`
    : "none"
  const statusLabel = data.status === "error" ? "Error" : data.status === "active" ? "Active" : "Idle"
  const timestamp = data.lastEvent ? new Date(data.lastEvent.ts).toLocaleTimeString() : "-"
  const metaSummary = summarizeNodeMeta(data.lastEvent)
  const metaLines = Array.isArray(data.metaLines) ? data.metaLines.filter(Boolean) : []
  const metaBadges = Array.isArray(data.metaBadges) ? data.metaBadges.filter(Boolean) : []

  const handleClass = "h-2 w-2 rounded-full border-0 bg-transparent opacity-0"
  const sizeClass = data.core ? "min-w-[250px] min-h-[66px]" : "min-w-[220px] min-h-[60px]"
  const borderClass = data.core ? "border-l-[8px]" : "border-l-[6px]"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              "relative flex items-center gap-3 rounded-xl border border-slate-300/80 px-3 py-2",
              data.core ? "ring-2 ring-inset" : "ring-1 ring-inset",
              "shadow-[0_10px_22px_-16px_rgba(15,23,42,0.38)] backdrop-blur-sm",
              CATEGORY_STYLES[data.category] || "bg-white",
              STATUS_STYLES[data.status],
              dimmed && "opacity-40",
              sizeClass,
              borderClass,
              data.highlighted && "ring-2 ring-sky-400/60"
            )}
            style={{ borderLeftColor: accent }}
            animate={data.freeze ? undefined : { boxShadow: glow }}
            transition={data.freeze ? undefined : { duration: 0.6 }}
          >
            <span
              className="relative flex h-8 w-8 items-center justify-center rounded-md shadow-inner"
              style={{ backgroundColor: `rgba(${accentRgb}, 0.18)`, color: accent }}
            >
              <Icon className="h-4 w-4" />
              {data.status === "active" && !data.freeze && (
                <motion.span
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: accent }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-[12px] font-semibold leading-snug">
                {data.step && (
                  <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold text-muted-foreground shadow-sm">
                    {data.step}
                  </span>
                )}
                <span className="break-words text-slate-900">{data.label}</span>
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-600">
                {data.category.replace(/_/g, " ")}
              </div>
              {metaSummary && <div className="text-[11px] text-slate-500">{metaSummary}</div>}
              {metaBadges.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {metaBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/70 bg-white/80 px-2 py-0.5 shadow-sm"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
              {metaLines.map((line) => (
                <div key={line} className="text-[11px] text-slate-500">
                  {line}
                </div>
              ))}
            </div>
            <div className="ml-auto text-right text-[11px] leading-snug text-muted-foreground">
              <div className="font-semibold text-foreground/80">{statusLabel}</div>
              <div>{timestamp}</div>
            </div>
            {data.status === "error" && (
              <TriangleAlert className="absolute -right-2 -top-2 h-4 w-4 text-rose-500" />
            )}
            <Handle type="target" position={Position.Left} className={handleClass} />
            <Handle type="source" position={Position.Right} className={handleClass} />
            <Handle id="target-left" type="target" position={Position.Left} className={handleClass} />
            <Handle id="source-left" type="source" position={Position.Left} className={handleClass} />
            <Handle id="target-right" type="target" position={Position.Right} className={handleClass} />
            <Handle id="source-right" type="source" position={Position.Right} className={handleClass} />
            <Handle id="target-top" type="target" position={Position.Top} className={handleClass} />
            <Handle id="source-top" type="source" position={Position.Top} className={handleClass} />
            <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClass} />
            <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClass} />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px]">
          <div className="space-y-1 text-xs">
            <div className="text-sm font-semibold">{data.label}</div>
            <div className="text-muted-foreground">Last update: {timestamp}</div>
            {data.avgDuration !== null && (
              <div>Avg latency: {data.avgDuration.toFixed(0)} ms</div>
            )}
            {data.errorCount > 0 && <div>Errors: {data.errorCount}</div>}
            {data.lastEvent?.service && <div>Service: {data.lastEvent.service}</div>}
            {data.lastEvent?.eventType && <div>Event: {data.lastEvent.eventType}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<GraphEdgeData>) {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "_")
  const pathId = `edge-path-${safeId}`
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })
  const dimFactor = data?.dimmed ? 0.6 : 1
  const pathBoost = data?.pathActive ? 0.45 : 0
  const highlightBoost = data?.highlighted ? 0.35 : 0
  const intensity = Math.min(1, (data?.intensity ?? 0) + pathBoost + highlightBoost)
  const traffic = data?.traffic ?? 0
  const trafficBoost = data?.freeze ? traffic * 0.4 : traffic * (data?.core ? 2.0 : 1.3)
  const color = data?.color ?? "#94a3b8"
  const coreWeight = data?.core ? 1.1 : 0.75
  const baseWidth = data?.core ? 1.1 : 0.6
  const strokeWidth =
    ((baseWidth + intensity * (data?.core ? 1.9 : 1.2)) * coreWeight + trafficBoost) *
    (data?.dimmed ? 0.8 : 1)
  const opacity =
    Math.min(
      1,
      ((data?.core ? 0.6 : 0.32) + intensity * 0.55 + traffic * 0.35) *
        dimFactor *
        (data?.core ? 1 : 0.85)
    ) *
    (data?.freeze ? 0.8 : 1)
  const dash =
    data?.kind === "call"
      ? "4 8"
      : data?.kind === "event"
        ? "3 7"
        : data?.kind === "trigger"
          ? "6 6"
          : undefined
  const statusColor = data?.statusColor
  const label =
    data?.label && typeof data.label === "string"
      ? data.label
      : data?.kind && typeof data.kind === "string"
        ? data.kind.replace(/_/g, " ").toUpperCase()
        : null
  const labelMode = data?.labelMode ?? "auto"
  const showLabel =
    Boolean(label) &&
    !data?.dimmed &&
    (labelMode === "always" ||
      data?.highlighted ||
      data?.pathActive ||
      intensity > 0.38 ||
      traffic > 0.55)
  const ageMs = data?.ageMs ?? null
  const showPulse =
    !data?.freeze &&
    typeof ageMs === "number" &&
    ageMs >= 0 &&
    ageMs < 9000 &&
    !data?.dimmed &&
    intensity > 0.25

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="#0f172a"
        strokeWidth={strokeWidth + 0.8}
        strokeOpacity={data?.dimmed ? 0.03 : 0.08}
        strokeLinecap="round"
      />
      {statusColor && (
        <path
          d={edgePath}
          fill="none"
          stroke={statusColor}
          strokeWidth={strokeWidth}
          strokeOpacity={data?.dimmed ? 0.28 : 0.6}
          strokeLinecap="round"
        />
      )}
      <path
        id={pathId}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeOpacity={opacity}
        strokeLinecap="round"
        markerEnd={markerEnd}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full border border-white/60 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
      {intensity > 0.2 && !data?.dimmed && !data?.freeze && (
        <motion.path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 0.45}
          strokeLinecap="round"
          strokeDasharray="6 10"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -40 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          style={{
            opacity: Math.min(0.85, intensity + 0.12),
            filter: `drop-shadow(0 0 ${2 + intensity * 6}px ${color})`,
          }}
        />
      )}
      {intensity > 0.3 && !data?.dimmed && !data?.freeze && (
        <EdgeLabelRenderer>
          <motion.div
            className="pointer-events-none absolute h-3 w-3 rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}`,
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            animate={{ scale: [0.8, 1.4, 0.9], opacity: [0.7, 1, 0.6] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </EdgeLabelRenderer>
      )}
      {showPulse && (
        <circle
          key={data?.pulseKey}
          r={5 + intensity * 2}
          fill={statusColor ?? color}
          stroke="#ffffff"
          strokeWidth={1.2}
        >
          <animateMotion dur="1.2s" repeatCount="1">
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      )}
    </>
  )
}

const NODE_TYPES = { graphNode: GraphNode, lane: FlowLaneNode } as const
const EDGE_TYPES = { graphEdge: GraphEdge } as const

export default function OpsGraphPage() {
  const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
  const eventsUrl = useMemo(() => {
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/ops/events?tail=300`
  }, [base])

  const { user } = useAuth()
  const { events, status, error, connectedAt } = usePipelineEvents(eventsUrl)
  const nodeTypes = NODE_TYPES
  const edgeTypes = EDGE_TYPES
  const handleFlowError = useCallback((code: string, message: string) => {
    if (code === "002") return
    console.warn(`[React Flow] ${message}`)
  }, [])
  const opsBase = useMemo(() => (base ? base.replace(/\/+$/, "") : ""), [base])

  const [filters, setFilters] = useState<FilterState>({
    batchId: "",
    symbolKey: "",
    providerId: "",
    botEngineId: "",
    onlyErrors: false,
    onlyBots: false,
    onlyExternal: false,
    onlyReads: false,
    onlyWrites: false,
    onlyCalls: false,
    onlyTriggers: false,
    showUnknown: true,
  })
  const [focusFlow, setFocusFlow] = useState(false)
  const [showLanes, setShowLanes] = useState(false)
  const [layoutMode, setLayoutMode] = useState<"flow" | "fixed">("flow")
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("LR")

  const baseFilteredEvents = useMemo(() => {
    return events.filter((event) => eventMatchesFilters(event, filters))
  }, [events, filters])

  const frozenEventsRef = useRef<PipelineEvent[] | null>(null)
  const freezeNowRef = useRef<number | null>(null)
  const frozenEdgeSpecsRef = useRef<GraphEdgeSpec[] | null>(null)
  const frozenLayoutPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null)
  const frozenIntensitiesRef = useRef<{
    edgeIntensity: Record<string, number>
    nodeIntensity: Record<string, number>
  } | null>(null)
  const [freezeLive, setFreezeLive] = useState(false)

  const renderEvents = freezeLive
    ? frozenEventsRef.current || baseFilteredEvents
    : baseFilteredEvents

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 2000)
    return () => clearInterval(id)
  }, [])

  const now = useMemo(() => {
    if (freezeLive && freezeNowRef.current !== null) return freezeNowRef.current
    return Date.now()
  }, [tick, freezeLive])
  const flowRef = useRef<ReactFlowInstance | null>(null)
  const initialFitRef = useRef(false)
  const viewportTouchedRef = useRef(false)
  const topologySignatureRef = useRef<string>("")
  const graphCardRef = useRef<HTMLDivElement | null>(null)
  const graphBoundsRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const isFullView = isFullscreen || isExpanded
  const [showActiveFlow, setShowActiveFlow] = useState(false)
  const [flowOverlayOffset, setFlowOverlayOffset] = useState({ x: 0, y: 0 })
  const graphHeightStyle = useMemo(() => {
    if (isFullView) {
      return { height: "calc(100vh - 120px)", minHeight: "720px" }
    }
    return {
      height: "calc(100vh - 200px)",
      minHeight: "640px",
      maxHeight: "980px",
    }
  }, [isFullView])

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(document.fullscreenElement)
      const isTarget = document.fullscreenElement === graphCardRef.current
      setIsFullscreen(active && isTarget)
      if (active) setIsExpanded(false)
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    if (!isExpanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isExpanded])

  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [batchDetailKey, setBatchDetailKey] = useState<string | null>(null)
  const [batchDetailEvents, setBatchDetailEvents] = useState<PipelineEvent[] | null>(null)
  const [batchDetailLoading, setBatchDetailLoading] = useState(false)
  const [symbolDetailKey, setSymbolDetailKey] = useState<string | null>(null)
  const [symbolDetailEvents, setSymbolDetailEvents] = useState<PipelineEvent[] | null>(null)
  const [symbolDetailLoading, setSymbolDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const fetchOpsSearch = useCallback(
    async (params: Record<string, string>) => {
      if (!opsBase || !user) return null
      const token = await user.getIdToken()
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.set(key, value)
      })
      if (!searchParams.has("limit")) searchParams.set("limit", "200")
      const url = `${opsBase}/ops/events/search?${searchParams.toString()}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const body = await response.text().catch(() => "")
        throw new Error(body || `Search failed (${response.status})`)
      }
      const payload = await response.json()
      if (!payload?.ok || !Array.isArray(payload?.events)) return []
      return payload.events as PipelineEvent[]
    },
    [opsBase, user]
  )

  useEffect(() => {
    if (!selectedBatch || !user || !opsBase) {
      setBatchDetailEvents(null)
      setBatchDetailKey(null)
      return
    }
    if (batchDetailKey === selectedBatch) return
    setBatchDetailLoading(true)
    setDetailError(null)
    fetchOpsSearch({ batchId: selectedBatch })
      .then((events) => {
        setBatchDetailEvents(events)
        setBatchDetailKey(selectedBatch)
      })
      .catch((err) => {
        setDetailError(err instanceof Error ? err.message : "Detail fetch failed")
        setBatchDetailEvents(null)
        setBatchDetailKey(selectedBatch)
      })
      .finally(() => setBatchDetailLoading(false))
  }, [selectedBatch, batchDetailKey, fetchOpsSearch, opsBase, user])

  useEffect(() => {
    if (!selectedSymbol || !user || !opsBase) {
      setSymbolDetailEvents(null)
      setSymbolDetailKey(null)
      return
    }
    const key = `${selectedBatch || ""}:${selectedSymbol}`
    if (symbolDetailKey === key) return
    setSymbolDetailLoading(true)
    setDetailError(null)
    fetchOpsSearch({
      batchId: selectedBatch || "",
      symbolKey: selectedSymbol,
    })
      .then((events) => {
        setSymbolDetailEvents(events)
        setSymbolDetailKey(key)
      })
      .catch((err) => {
        setDetailError(err instanceof Error ? err.message : "Detail fetch failed")
        setSymbolDetailEvents(null)
        setSymbolDetailKey(key)
      })
      .finally(() => setSymbolDetailLoading(false))
  }, [selectedBatch, selectedSymbol, symbolDetailKey, fetchOpsSearch, opsBase, user])

  const baseNodes = useMemo(() => graphSpec.nodes as GraphNodeSpec[], [])
  const baseEdges = useMemo(() => graphSpec.edges as GraphEdgeSpec[], [])

  const observedProviderIds = useMemo(() => {
    const ids = new Set<string>()
    events.forEach((event) => {
      if (event.stationId?.startsWith("provider:")) ids.add(event.stationId)
      const edgeKey = event.edgeKey || ""
      const match = edgeKey.match(/provider:[^->]+/g)
      if (match) {
        match.forEach((provider) => ids.add(provider))
      }
    })
    return Array.from(ids).sort((a, b) => a.localeCompare(b))
  }, [events])

  const observedBotEngineIds = useMemo(() => {
    const ids = new Set<string>()
    events.forEach((event) => {
      if (event.stationId?.startsWith("bot_engine:")) ids.add(event.stationId)
      const edgeKey = event.edgeKey || ""
      const match = edgeKey.match(/bot_engine:[^->]+/g)
      if (match) {
        match.forEach((engine) => ids.add(engine))
      }
    })
    return Array.from(ids).sort((a, b) => a.localeCompare(b))
  }, [events])

  const observedUnknownNodeIds = useMemo(() => {
    const ids = new Set<string>()
    const known = new Set(baseNodes.map((node) => node.id))
    observedProviderIds.forEach((id) => known.add(id))
    observedBotEngineIds.forEach((id) => known.add(id))

    events.forEach((event) => {
      resolveNodeIds(event).forEach((nodeId) => {
        if (!nodeId) return
        if (known.has(nodeId)) return
        if (nodeId.startsWith("provider:") || nodeId.startsWith("bot_engine:")) return
        ids.add(nodeId)
      })
      const edgeKey = resolveEdgeKey(event)
      const parsed = edgeKey ? parseEdgeKey(edgeKey) : null
      if (parsed) {
        ;[parsed.from, parsed.to].forEach((nodeId) => {
          if (!nodeId) return
          if (known.has(nodeId)) return
          if (nodeId.startsWith("provider:") || nodeId.startsWith("bot_engine:")) return
          ids.add(nodeId)
        })
      }
    })

    return Array.from(ids).sort((a, b) => a.localeCompare(b))
  }, [events, baseNodes, observedProviderIds, observedBotEngineIds])

  const [stableProviderIds, setStableProviderIds] = useState<string[]>([])
  const [stableBotEngineIds, setStableBotEngineIds] = useState<string[]>([])
  const [stableUnknownNodeIds, setStableUnknownNodeIds] = useState<string[]>([])
  const [stableExtraEdges, setStableExtraEdges] = useState<GraphEdgeSpec[]>([])

  useEffect(() => {
    if (observedProviderIds.length === 0) return
    setStableProviderIds((prev) => {
      const set = new Set(prev)
      observedProviderIds.forEach((id) => set.add(id))
      const next = Array.from(set).sort((a, b) => a.localeCompare(b))
      return next.length === prev.length ? prev : next
    })
  }, [observedProviderIds])

  useEffect(() => {
    if (observedBotEngineIds.length === 0) return
    setStableBotEngineIds((prev) => {
      const set = new Set(prev)
      observedBotEngineIds.forEach((id) => set.add(id))
      const next = Array.from(set).sort((a, b) => a.localeCompare(b))
      return next.length === prev.length ? prev : next
    })
  }, [observedBotEngineIds])

  useEffect(() => {
    if (observedUnknownNodeIds.length === 0) return
    setStableUnknownNodeIds((prev) => {
      const set = new Set(prev)
      observedUnknownNodeIds.forEach((id) => set.add(id))
      const next = Array.from(set).sort((a, b) => a.localeCompare(b))
      return next.length === prev.length ? prev : next
    })
  }, [observedUnknownNodeIds])

  const nodeSpecs = useMemo<GraphNodeSpec[]>(() => {
    const existing = new Set(baseNodes.map((node) => node.id))
    const providerBase = baseNodes.find((node) => node.id === "provider:unknown")
    const providerBaseX = providerBase?.x ?? 760
    const providerBaseY = providerBase?.y ?? 600
    const providerSpacing = 90
    const dynamicProviders = stableProviderIds.filter(
      (id) => !existing.has(id) && id !== "provider:unknown"
    )

    const providerExtras = dynamicProviders.map((id, index) => ({
      id,
      label: id.replace("provider:", "").toUpperCase(),
      x: providerBaseX,
      y: providerBaseY + providerSpacing * (index + 1),
      category: "provider",
      core: false,
    }))

    const botBase = baseNodes.find((node) => node.id === "bot_engine:unknown")
    const botBaseX = botBase?.x ?? 930
    const botBaseY = botBase?.y ?? 360
    const botSpacing = 80
    const dynamicBots = stableBotEngineIds.filter(
      (id) => !existing.has(id) && id !== "bot_engine:unknown"
    )

    const botExtras = dynamicBots.map((id, index) => ({
      id,
      label: id.replace("bot_engine:", "").toUpperCase(),
      x: botBaseX,
      y: botBaseY + botSpacing * (index + 1),
      category: "bot",
      core: false,
    }))

    const unknownBaseX = 80
    const unknownBaseY = providerBaseY + providerSpacing * (dynamicProviders.length + 2)
    const unknownSpacingX = 200
    const unknownSpacingY = 120
    const unknownPerRow = 5
    const unknownExtras = filters.showUnknown
      ? stableUnknownNodeIds
        .filter((id) => !existing.has(id))
        .map((id, index) => ({
          id,
          label: id.replace(/[:_]/g, " "),
          x: unknownBaseX + (index % unknownPerRow) * unknownSpacingX,
          y: unknownBaseY + Math.floor(index / unknownPerRow) * unknownSpacingY,
          category: "unknown",
          core: false,
        }))
      : []

    return [...baseNodes, ...providerExtras, ...botExtras, ...unknownExtras]
  }, [
    baseNodes,
    stableProviderIds,
    stableBotEngineIds,
    stableUnknownNodeIds,
    filters.showUnknown,
  ])

  const edgeSpecs = useMemo<GraphEdgeSpec[]>(() => {
    const edges: GraphEdgeSpec[] = [...baseEdges]
    const existing = new Set(edges.map((edge) => edge.id))

    stableProviderIds.forEach((id) => {
      const edgeId = `market_data_gateway->${id}`
      if (existing.has(edgeId)) return
      edges.push({
        id: edgeId,
        from: "market_data_gateway",
        to: id,
        kind: "call",
        core: false,
      })
      existing.add(edgeId)
    })

    stableBotEngineIds.forEach((id) => {
      const edgeId = `relayorb_agent->${id}`
      if (existing.has(edgeId)) return
      edges.push({
        id: edgeId,
        from: "relayorb_agent",
        to: id,
        kind: "call",
        core: false,
      })
      existing.add(edgeId)
    })

    const nodeIdSet = new Set(nodeSpecs.map((node) => node.id))
    stableExtraEdges.forEach((edge) => {
      if (existing.has(edge.id)) return
      if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to)) return
      edges.push(edge)
      existing.add(edge.id)
    })

    return edges
  }, [baseEdges, stableProviderIds, stableBotEngineIds, stableExtraEdges, nodeSpecs])

  const edgeSpecMap = useMemo(() => {
    return new Map(edgeSpecs.map((edge) => [edge.id, edge]))
  }, [edgeSpecs])

  const nodeConnections = useMemo(() => {
    const map = new Map<string, { edges: string[]; neighbors: Set<string> }>()
    nodeSpecs.forEach((node) => map.set(node.id, { edges: [], neighbors: new Set() }))
    edgeSpecs.forEach((edge) => {
      if (!map.has(edge.from)) map.set(edge.from, { edges: [], neighbors: new Set() })
      if (!map.has(edge.to)) map.set(edge.to, { edges: [], neighbors: new Set() })
      map.get(edge.from)?.edges.push(edge.id)
      map.get(edge.to)?.edges.push(edge.id)
      map.get(edge.from)?.neighbors.add(edge.to)
      map.get(edge.to)?.neighbors.add(edge.from)
    })
    return map
  }, [nodeSpecs, edgeSpecs])

  const layoutEdgeSpecs = useMemo<GraphEdgeSpec[]>(() => {
    if (freezeLive && frozenEdgeSpecsRef.current) return frozenEdgeSpecsRef.current
    const edges: GraphEdgeSpec[] = [...baseEdges]
    const existing = new Set(edges.map((edge) => edge.id))
    stableProviderIds.forEach((id) => {
      const edgeId = `market_data_gateway->${id}`
      if (existing.has(edgeId)) return
      edges.push({
        id: edgeId,
        from: "market_data_gateway",
        to: id,
        kind: "call",
        core: false,
      })
      existing.add(edgeId)
    })
    stableBotEngineIds.forEach((id) => {
      const edgeId = `relayorb_agent->${id}`
      if (existing.has(edgeId)) return
      edges.push({
        id: edgeId,
        from: "relayorb_agent",
        to: id,
        kind: "call",
        core: false,
      })
      existing.add(edgeId)
    })
    const payload = edges
    if (freezeLive) frozenEdgeSpecsRef.current = payload
    return payload
  }, [baseEdges, stableProviderIds, stableBotEngineIds, freezeLive])

  const layoutPositions = useMemo(() => {
    if (freezeLive && frozenLayoutPositionsRef.current) return frozenLayoutPositionsRef.current
    if (layoutMode === "fixed") {
      const map = new Map<string, { x: number; y: number }>()
      nodeSpecs.forEach((node) => map.set(node.id, { x: node.x, y: node.y }))
      if (freezeLive) frozenLayoutPositionsRef.current = map
      return map
    }
    const layoutEdges = layoutEdgeSpecs.filter(
      (edge) => edge.core || edge.kind === "call" || edge.kind === "trigger"
    )
    const computed = computeFlowLayout(nodeSpecs, layoutEdges, layoutDirection)
    if (freezeLive) frozenLayoutPositionsRef.current = computed
    return computed
  }, [nodeSpecs, layoutEdgeSpecs, layoutMode, layoutDirection, freezeLive])

  const nodeStats = useMemo<Record<string, NodeStats>>(() => {
    const stats: Record<string, NodeStats> = {}
    renderEvents.forEach((event) => {
      const ids = resolveNodeIds(event)
      const ts = Date.parse(event.ts) || now
      const duration = typeof event.durationMs === "number" ? event.durationMs : null
      ids.forEach((id) => {
        if (!id) return
        if (!stats[id]) {
          stats[id] = {
            lastEvent: event,
            errorCount: event.status === "error" ? 1 : 0,
            avgDuration: duration,
            durationSum: duration ?? 0,
            durationCount: duration ? 1 : 0,
            lastSeen: ts,
          }
          return
        }
        const current = stats[id]
        if (duration !== null) {
          current.durationSum += duration
          current.durationCount += 1
          current.avgDuration = current.durationSum / current.durationCount
        }
        if (event.status === "error") current.errorCount += 1
        if (!current.lastSeen || ts > current.lastSeen) {
          current.lastSeen = ts
          current.lastEvent = event
        }
      })
    })
    return stats
  }, [renderEvents, now])

  const edgeStats = useMemo<Record<string, EdgeStats>>(() => {
    const stats: Record<string, EdgeStats> = {}
    renderEvents.forEach((event) => {
      const edgeKeys = resolveEdgeKeys(event)
      if (!edgeKeys.length) return
      const ts = Date.parse(event.ts) || now
      const duration = typeof event.durationMs === "number" ? event.durationMs : null
      edgeKeys.forEach((edgeKey) => {
        if (!stats[edgeKey]) {
          stats[edgeKey] = {
            lastEvent: event,
            errorCount: event.status === "error" ? 1 : 0,
            avgDuration: duration,
            durationSum: duration ?? 0,
            durationCount: duration ? 1 : 0,
            eventCount: 1,
            lastSeen: ts,
          }
          return
        }
        const current = stats[edgeKey]
        current.eventCount += 1
        if (duration !== null) {
          current.durationSum += duration
          current.durationCount += 1
          current.avgDuration = current.durationSum / current.durationCount
        }
        if (event.status === "error") current.errorCount += 1
        if (!current.lastSeen || ts > current.lastSeen) {
          current.lastSeen = ts
          current.lastEvent = event
        }
      })
    })
    return stats
  }, [renderEvents, now])

  const batchStates = useMemo<BatchState[]>(() => {
    const map = new Map<string, BatchState>()
    events.forEach((event) => {
      const batchId = resolveBatchId(event)
      if (!batchId || map.has(batchId)) return
      map.set(batchId, {
        batchId,
        lastEventAt: Date.parse(event.ts) || Date.now(),
        lastEdgeKey: resolveEdgeKey(event) || undefined,
        status: event.status,
      })
    })
    return Array.from(map.values()).slice(0, 12)
  }, [events])

  useEffect(() => {
    if (selectedBatch || batchStates.length === 0) return
    setSelectedBatch(batchStates[0].batchId)
  }, [batchStates, selectedBatch])

  const intensities = useMemo(() => {
    if (freezeLive && frozenIntensitiesRef.current) return frozenIntensitiesRef.current
    const edgeIntensity: Record<string, number> = {}
    const nodeIntensity: Record<string, number> = {}
    const decayMs = 25000
    const eventsToUse = renderEvents.slice(0, 240)

    eventsToUse.forEach((event) => {
      const ts = Date.parse(event.ts) || now
      const age = Math.max(0, now - ts)
      const weight = Math.exp(-age / decayMs)
      if (weight < 0.03) return

      const edgeKeys = resolveEdgeKeys(event)
      edgeKeys.forEach((edgeKey) => {
        edgeIntensity[edgeKey] = Math.min(1, (edgeIntensity[edgeKey] || 0) + weight)
      })

      resolveNodeIds(event).forEach((id) => {
        if (!id) return
        nodeIntensity[id] = Math.min(1, (nodeIntensity[id] || 0) + weight * 0.9)
      })
    })

    const payload = { edgeIntensity, nodeIntensity }
    if (freezeLive) frozenIntensitiesRef.current = payload
    return payload
  }, [renderEvents, now, freezeLive])

  const laneStepMap = useMemo(() => {
    const map = new Map<string, number>()
    FLOW_LANES.forEach((lane) => {
      const ordered = nodeSpecs
        .filter((node) => lane.match(node))
        .sort((a, b) => {
          const posA = layoutPositions.get(a.id) ?? { x: a.x, y: a.y }
          const posB = layoutPositions.get(b.id) ?? { x: b.x, y: b.y }
          return posA.x === posB.x ? posA.y - posB.y : posA.x - posB.x
        })
      ordered.forEach((node, index) => {
        map.set(node.id, index + 1)
      })
    })
    return map
  }, [nodeSpecs, layoutPositions])

  const activeBatchId = selectedBatch ?? batchStates[0]?.batchId ?? null

  const activeBatchEvents = useMemo(() => {
    if (!activeBatchId) return []
    return renderEvents
      .filter((event) => resolveBatchId(event) === activeBatchId)
      .sort((a, b) => (Date.parse(a.ts) || 0) - (Date.parse(b.ts) || 0))
  }, [renderEvents, activeBatchId])

  const activeBatchEdges = useMemo(() => {
    const set = new Set<string>()
    activeBatchEvents.forEach((event) => {
      resolveEdgeKeys(event).forEach((edgeKey) => set.add(edgeKey))
    })
    return set
  }, [activeBatchEvents])

  const activeBatchNodes = useMemo(() => {
    const set = new Set<string>()
    activeBatchEvents.forEach((event) => {
      resolveNodeIds(event).forEach((id) => {
        if (id) set.add(id)
      })
    })
    return set
  }, [activeBatchEvents])

  const focusActive = focusFlow && activeBatchEdges.size > 0

  const activeBatchPath = useMemo(() => {
    const list: string[] = []
    const seen = new Set<string>()
    activeBatchEvents.forEach((event) => {
      resolveEdgeKeys(event).forEach((edgeKey) => {
        if (!edgeKey || seen.has(edgeKey)) return
        seen.add(edgeKey)
        list.push(edgeKey)
      })
    })
    return list
  }, [activeBatchEvents])

  const originBreakdown = useMemo(() => {
    const candidateEvent = renderEvents.find(
      (event) => event.stationId === "mi_candidates" && resolveBatchId(event) === selectedBatch
    )
    const meta = candidateEvent?.meta as Record<string, unknown> | undefined
    return meta?.origins && typeof meta.origins === "object"
      ? (meta.origins as Record<string, number>)
      : null
  }, [renderEvents, selectedBatch])

  const latestOriginSummary = useMemo(() => {
    const candidateEvent = renderEvents.find((event) => event.stationId === "mi_candidates")
    const meta = candidateEvent?.meta as Record<string, unknown> | undefined
    const origins =
      meta?.originsBreakdown && typeof meta.originsBreakdown === "object"
        ? (meta.originsBreakdown as Record<string, unknown>)
        : meta?.origins && typeof meta.origins === "object"
          ? (meta.origins as Record<string, unknown>)
          : null
    return formatOriginSummary(origins)
  }, [renderEvents])

  const latestOriginBadges = useMemo(() => {
    const candidateEvent = renderEvents.find((event) => event.stationId === "mi_candidates")
    const meta = candidateEvent?.meta as Record<string, unknown> | undefined
    const origins =
      meta?.originsBreakdown && typeof meta.originsBreakdown === "object"
        ? (meta.originsBreakdown as Record<string, unknown>)
        : meta?.origins && typeof meta.origins === "object"
          ? (meta.origins as Record<string, unknown>)
          : null
    return formatOriginBadges(origins)
  }, [renderEvents])

  const newBatchMeta = useMemo(() => {
    const publishEvent = renderEvents.find((event) => resolveEdgeKey(event) === "market_intel->new_batch")
    const headBatchId = publishEvent ? resolveBatchId(publishEvent) : null
    const headTs = publishEvent ? Date.parse(publishEvent.ts) : null
    const agentEvent = renderEvents.find((event) => resolveEdgeKey(event) === "new_batch->relayorb_agent")
    const refreshEvent = renderEvents.find((event) => resolveEdgeKey(event) === "new_batch->refresh_service")
    const agentTs = agentEvent ? Date.parse(agentEvent.ts) : null
    const refreshTs = refreshEvent ? Date.parse(refreshEvent.ts) : null
    const agentLag = headTs && agentTs ? Math.max(0, headTs - agentTs) : null
    const refreshLag = headTs && refreshTs ? Math.max(0, headTs - refreshTs) : null
    return {
      headBatchId,
      agentLag,
      refreshLag,
      headTs,
    }
  }, [renderEvents])

  const botEngineMeta = useMemo(() => {
    const map = new Map<string, string[]>()
    const seen = new Set<string>()
    renderEvents.forEach((event) => {
      const stationId = event.stationId || ""
      if (!stationId.startsWith("bot_engine:")) return
      if (seen.has(stationId)) return
      seen.add(stationId)
      const meta = event.meta as Record<string, unknown> | undefined
      const strategy = typeof meta?.strategy === "string" ? meta.strategy : null
      const timeframe = typeof meta?.timeframe === "string" ? meta.timeframe : null
      const runtimeMs = typeof meta?.runtimeMs === "number" ? meta.runtimeMs : null
      const mode =
        typeof meta?.tradingMode === "string"
          ? meta.tradingMode
          : typeof meta?.mode === "string"
            ? meta.mode
            : null
      const lines: string[] = []
      if (strategy) lines.push(`Strategy ${strategy}`)
      if (timeframe) lines.push(`TF ${timeframe}`)
      if (runtimeMs !== null) lines.push(`Runtime ${Math.round(runtimeMs)}ms`)
      if (mode) lines.push(`Mode ${mode}`)
      if (lines.length) map.set(stationId, lines.slice(0, 2))
    })
    return map
  }, [renderEvents])

  const mdgMeta = useMemo(() => {
    const stats = {
      count: 0,
      errors: 0,
      durations: [] as number[],
    }
    renderEvents.forEach((event) => {
      if (event.stationId !== "mdg") return
      stats.count += 1
      if (event.status === "error") stats.errors += 1
      if (typeof event.durationMs === "number") {
        stats.durations.push(event.durationMs)
      }
    })
    if (stats.count === 0) return null
    const durations = stats.durations.slice().sort((a, b) => a - b)
    const p95Index = Math.max(0, Math.floor(durations.length * 0.95) - 1)
    const p95 = durations[p95Index]
    const avg = durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null
    return {
      count: stats.count,
      errors: stats.errors,
      avg: avg !== null ? Math.round(avg) : null,
      p95: p95 !== undefined ? Math.round(p95) : null,
    }
  }, [events])

  const providerStats = useMemo(() => {
    const map = new Map<string, {
      id: string
      label: string
      lastSeen: number | null
      errorCount: number
      avgDuration: number | null
      durationSum: number
      durationCount: number
      durations: number[]
      p95: number | null
      cacheHits: number
      requestCount: number
      lastHttpStatus: number | null
    }>()

    events.forEach((event) => {
      const stationId = event.stationId
      if (!stationId?.startsWith("provider:")) return
      const meta = event.meta as Record<string, unknown> | undefined
      const ts = Date.parse(event.ts) || Date.now()
      const duration = typeof event.durationMs === "number" ? event.durationMs : null
      const cacheHit = Boolean(meta?.cacheHit)
      const httpStatus =
        typeof meta?.httpStatus === "number"
          ? meta.httpStatus
          : typeof meta?.status === "number"
            ? meta.status
            : null

      const existing = map.get(stationId)
      if (!existing) {
        map.set(stationId, {
          id: stationId,
          label: stationId.replace("provider:", "").toUpperCase(),
          lastSeen: ts,
          errorCount: event.status === "error" ? 1 : 0,
          avgDuration: duration,
          durationSum: duration ?? 0,
          durationCount: duration ? 1 : 0,
          durations: duration !== null ? [duration] : [],
          p95: duration,
          cacheHits: cacheHit ? 1 : 0,
          requestCount: 1,
          lastHttpStatus: httpStatus,
        })
        return
      }

      existing.requestCount += 1
      if (event.status === "error") existing.errorCount += 1
      if (cacheHit) existing.cacheHits += 1
      if (duration !== null) {
        existing.durationSum += duration
        existing.durationCount += 1
        existing.avgDuration = existing.durationSum / existing.durationCount
        existing.durations.push(duration)
        if (existing.durations.length > 60) existing.durations.shift()
        const sorted = existing.durations.slice().sort((a, b) => a - b)
        const index = Math.max(0, Math.floor(sorted.length * 0.95) - 1)
        existing.p95 = sorted[index] ?? null
      }
      if (!existing.lastSeen || ts > existing.lastSeen) {
        existing.lastSeen = ts
        existing.lastHttpStatus = httpStatus
      }
    })

    return Array.from(map.values()).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
  }, [renderEvents])

  const providerMetaLines = useMemo(() => {
    const map = new Map<string, string[]>()
    providerStats.forEach((provider) => {
      const cachePct =
        provider.requestCount > 0
          ? Math.round((provider.cacheHits / provider.requestCount) * 100)
          : 0
      const lineOne = [
        provider.p95 ? `p95 ${provider.p95.toFixed(0)}ms` : null,
        provider.avgDuration ? `avg ${provider.avgDuration.toFixed(0)}ms` : null,
        `cache ${cachePct}%`,
      ]
        .filter(Boolean)
        .join(" · ")
      const lineTwo = [
        provider.errorCount ? `${provider.errorCount} errors` : null,
        provider.requestCount ? `${provider.requestCount} calls` : null,
      ]
        .filter(Boolean)
        .join(" · ")
      const lines = [lineOne, lineTwo].filter(Boolean).slice(0, 2)
      if (lines.length) map.set(provider.id, lines)
    })
    return map
  }, [providerStats])

  const nodeMetaLines = useMemo(() => {
    const map = new Map<string, string[]>()
    if (latestOriginSummary) {
      map.set("candidates_merge", [latestOriginSummary])
    }
    // new_batch badges are rendered separately for clearer visibility.
    if (mdgMeta) {
      const lineOne = `Calls ${mdgMeta.count} · p95 ${mdgMeta.p95 ?? "-"}ms`
      const lineTwo = mdgMeta.errors ? `${mdgMeta.errors} errors` : "Errors 0"
      map.set("market_data_gateway", [lineOne, lineTwo])
    }
    providerMetaLines.forEach((lines, id) => map.set(id, lines))
    botEngineMeta.forEach((lines, id) => map.set(id, lines))
    return map
  }, [latestOriginSummary, newBatchMeta, mdgMeta, providerMetaLines, botEngineMeta])

  const nodeMetaBadges = useMemo(() => {
    const map = new Map<string, string[]>()
    if (newBatchMeta.headBatchId) {
      const headLabel = newBatchMeta.headBatchId.slice(-8)
      const agLag = newBatchMeta.agentLag !== null ? formatAge(newBatchMeta.agentLag) : "—"
      const refLag = newBatchMeta.refreshLag !== null ? formatAge(newBatchMeta.refreshLag) : "—"
      map.set("new_batch", [`Head ${headLabel}`, `AG ${agLag}`, `REF ${refLag}`])
    }
    if (latestOriginBadges && latestOriginBadges.length) {
      map.set("candidates_merge", latestOriginBadges)
    }
    return map
  }, [newBatchMeta, latestOriginBadges])

  const { highlightedEdges, highlightedNodes, highlightActive } = useMemo(() => {
    const edges = new Set<string>()
    const nodes = new Set<string>()
    const activeEdge = hoverEdgeId || selectedEdge
    const activeNode = hoverNodeId || selectedNode

    if (activeEdge) {
      edges.add(activeEdge)
      const edgeSpec = edgeSpecMap.get(activeEdge)
      if (edgeSpec) {
        nodes.add(edgeSpec.from)
        nodes.add(edgeSpec.to)
      }
    }

    if (activeNode) {
      nodes.add(activeNode)
      const connections = nodeConnections.get(activeNode)
      if (connections) {
        connections.edges.forEach((edgeId) => edges.add(edgeId))
        connections.neighbors.forEach((nodeId) => nodes.add(nodeId))
      }
    }

    edges.forEach((edgeId) => {
      const edgeSpec = edgeSpecMap.get(edgeId)
      if (edgeSpec) {
        nodes.add(edgeSpec.from)
        nodes.add(edgeSpec.to)
      }
    })

    return {
      highlightedEdges: edges,
      highlightedNodes: nodes,
      highlightActive: edges.size > 0 || nodes.size > 0,
    }
  }, [hoverEdgeId, selectedEdge, hoverNodeId, selectedNode, edgeSpecMap, nodeConnections])

  const nodes = useMemo<Node[]>(() => {
    const laneNodes = showLanes
      ? FLOW_LANES
        .map((lane) => {
          const laneTargets = nodeSpecs.filter((node) => lane.match(node))
          if (laneTargets.length === 0) return null
          const positions = laneTargets.map((node) => layoutPositions.get(node.id) ?? node)
          const minX = Math.min(...positions.map((pos) => pos.x))
          const minY = Math.min(...positions.map((pos) => pos.y))
          const maxX = Math.max(...positions.map((pos) => pos.x))
          const maxY = Math.max(...positions.map((pos) => pos.y))
          const width = (maxX - minX) + NODE_DIMENSIONS.width + LANE_PADDING.x * 2
          const height = (maxY - minY) + NODE_DIMENSIONS.height + LANE_PADDING.y * 2
          return {
            id: lane.id,
            type: "lane",
            position: { x: minX - LANE_PADDING.x, y: minY - LANE_PADDING.y },
            data: { label: lane.label, tone: lane.tone },
            selectable: false,
            draggable: false,
            zIndex: 0,
            className: "pointer-events-none",
            style: { width, height },
          } as Node
        })
        .filter(Boolean) as Node[]
      : []

  const graphNodes = nodeSpecs.map((node) => {
    const stats = nodeStats[node.id]
    const intensity = intensities.nodeIntensity[node.id] ?? 0
      const lastSeen = stats?.lastSeen || 0
      const status =
        stats?.lastEvent?.status === "error" && now - lastSeen < 5 * 60 * 1000
          ? "error"
          : intensity > 0.2
            ? "active"
            : "idle"
      const pathActive = activeBatchNodes.has(node.id)
      const isHighlighted = highlightedNodes.has(node.id)
      const dimmed = (focusActive && !pathActive) || (highlightActive && !isHighlighted)
      const metaLines = nodeMetaLines.get(node.id)
      const metaBadges = nodeMetaBadges.get(node.id)
      const position = layoutPositions.get(node.id) ?? { x: node.x, y: node.y }
      return {
        id: node.id,
        type: "graphNode",
        position,
      data: {
        label: node.label,
        category: node.category,
        intensity,
        status,
          lastEvent: stats?.lastEvent,
          errorCount: stats?.errorCount ?? 0,
          avgDuration: stats?.avgDuration ?? null,
          core: node.core,
          step: laneStepMap.get(node.id),
        pathActive,
        dimmed,
        highlighted: isHighlighted,
        metaLines,
        metaBadges,
        freeze: freezeLive,
        minimalVisible: freezeLive,
      },
        draggable: false,
        selectable: true,
        zIndex: 2,
      }
    })
    return [...laneNodes, ...graphNodes]
  }, [
    nodeSpecs,
    nodeStats,
    intensities,
    now,
    laneStepMap,
    activeBatchNodes,
    focusActive,
    showLanes,
    nodeMetaLines,
    nodeMetaBadges,
    layoutPositions,
    highlightedNodes,
    highlightActive,
  ])

  const nodePositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    nodeSpecs.forEach((node) => {
      const pos = layoutPositions.get(node.id) ?? { x: node.x, y: node.y }
      map.set(node.id, pos)
    })
    return map
  }, [nodeSpecs, layoutPositions])

  const fitViewNodes = useMemo<Node[]>(() => {
    return nodeSpecs.map((node) => ({
      id: node.id,
      type: "graphNode",
      position: layoutPositions.get(node.id) ?? { x: node.x, y: node.y },
      width: NODE_DIMENSIONS.width,
      height: NODE_DIMENSIONS.height,
      data: {},
    }))
  }, [nodeSpecs, layoutPositions])

  const topologySignature = useMemo(() => {
    const nodeIds = nodeSpecs.map((node) => node.id).join("|")
    const edgeIds = edgeSpecs.map((edge) => edge.id).join("|")
    return `${nodeIds}::${edgeIds}`
  }, [nodeSpecs, edgeSpecs])

  const handleFitView = useCallback(() => {
    if (!flowRef.current) return
    viewportTouchedRef.current = false
    flowRef.current.fitView({
      nodes: fitViewNodes,
      padding: isFullView ? 0.1 : 0.16,
      minZoom: 0.2,
      maxZoom: 2.2,
      duration: 420,
    })
  }, [fitViewNodes, isFullView])

  useEffect(() => {
    initialFitRef.current = false
    handleFitView()
  }, [layoutMode, layoutDirection, handleFitView])

  useEffect(() => {
    if (!flowRef.current || !topologySignature) return
    if (topologySignatureRef.current === topologySignature) return
    topologySignatureRef.current = topologySignature
    if (viewportTouchedRef.current) return
    handleFitView()
  }, [topologySignature, handleFitView])

  useEffect(() => {
    if (!flowRef.current || fitViewNodes.length === 0) return
    if (!initialFitRef.current) {
      flowRef.current.fitView({
        nodes: fitViewNodes,
        padding: isFullView ? 0.1 : 0.14,
        minZoom: 0.2,
        maxZoom: 1.8,
        duration: 0,
      })
      initialFitRef.current = true
      return
    }
    if (isFullView) handleFitView()
  }, [fitViewNodes, isFullView, handleFitView])

  const handleResetView = useCallback(() => {
    if (!flowRef.current) return
    flowRef.current.setViewport({ x: 120, y: 60, zoom: 0.72 }, { duration: 320 })
  }, [])

  const handleToggleFullScreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    if (isExpanded) {
      setIsExpanded(false)
      return
    }
    if (graphCardRef.current?.requestFullscreen) {
      try {
        await graphCardRef.current.requestFullscreen()
        return
      } catch (err) {
        console.warn("Fullscreen request failed, using expanded view instead.", err)
      }
    }
    setIsExpanded(true)
  }, [graphCardRef, isExpanded])

  const edges = useMemo<Edge[]>(() => {
    const pickHandles = (from: string, to: string) => {
      const source = nodePositionMap.get(from)
      const target = nodePositionMap.get(to)
      if (!source || !target) {
        return { sourceHandle: "source-right", targetHandle: "target-left" }
      }
      const dx = target.x - source.x
      const dy = target.y - source.y
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx >= 0) return { sourceHandle: "source-right", targetHandle: "target-left" }
        return { sourceHandle: "source-left", targetHandle: "target-right" }
      }
      if (dy >= 0) return { sourceHandle: "source-bottom", targetHandle: "target-top" }
      return { sourceHandle: "source-top", targetHandle: "target-bottom" }
    }

    return edgeSpecs
      .map((edge) => {
        if (!nodePositionMap.has(edge.from) || !nodePositionMap.has(edge.to)) return null
      const stats = edgeStats[edge.id]
      const intensity = intensities.edgeIntensity[edge.id] ?? 0
      const traffic = stats ? Math.min(1, (stats.eventCount || 0) / 6) : 0
      const color = EDGE_COLORS[edge.kind] || "#94a3b8"
      const status = stats?.lastEvent?.status
      const statusColor =
        status === "error"
          ? "#ef4444"
          : status === "end"
            ? "#16a34a"
            : status === "start"
              ? "#2563eb"
              : undefined
      const lastSeen = stats?.lastSeen ?? null
      const ageMs = lastSeen ? Math.max(0, now - lastSeen) : null
      const handles = pickHandles(edge.from, edge.to)
      const pathActive = activeBatchEdges.has(edge.id)
      const isHighlighted = highlightedEdges.has(edge.id)
      const dimmed = (focusActive && !pathActive) || (highlightActive && !isHighlighted)
      const markerSize = edge.core ? 8 : 6
      const label = edge.label ?? null
      const labelMode = edge.labelMode ?? "auto"
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: "graphEdge",
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        data: {
          intensity,
          color,
          kind: edge.kind,
          lastEvent: stats?.lastEvent,
          avgDuration: stats?.avgDuration ?? null,
          errorCount: stats?.errorCount ?? 0,
          pathActive,
          dimmed,
          highlighted: isHighlighted,
          core: edge.core,
          traffic,
          label,
          labelMode,
          status,
          statusColor,
          ageMs,
          pulseKey: stats?.lastEvent?.eventId || lastSeen || undefined,
          freeze: freezeLive,
          minimalVisible: freezeLive,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: statusColor ?? color,
          width: markerSize,
          height: markerSize,
        },
      }
      })
      .filter(Boolean) as Edge[]
  }, [
    edgeSpecs,
    edgeStats,
    intensities,
    nodePositionMap,
    activeBatchEdges,
    focusActive,
    now,
    highlightedEdges,
    highlightActive,
  ])

  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    nodeSpecs.forEach((node) => map.set(node.id, node.label))
    return map
  }, [nodeSpecs])

  const edgeLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    edgeSpecs.forEach((edge) => map.set(edge.id, `${edge.from} → ${edge.to}`))
    return map
  }, [edgeSpecs])

  const edgeShortLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    edgeSpecs.forEach((edge) => {
      const fromLabel = nodeLabelMap.get(edge.from) || edge.from
      const toLabel = nodeLabelMap.get(edge.to) || edge.to
      map.set(edge.id, `${fromLabel} → ${toLabel}`)
    })
    return map
  }, [edgeSpecs, nodeLabelMap])

  const selectedNodeEvents = useMemo(() => {
    if (!selectedNode) return []
    return renderEvents.filter((event) => resolveNodeIds(event).includes(selectedNode)).slice(0, 50)
  }, [renderEvents, selectedNode])

  const selectedProviderStats = useMemo(() => {
    if (!selectedNode || !selectedNode.startsWith("provider:")) return null
    return providerStats.find((provider) => provider.id === selectedNode) || null
  }, [providerStats, selectedNode])

  const selectedBotMeta = useMemo(() => {
    if (!selectedNode || !selectedNode.startsWith("bot_engine:")) return null
    const event = selectedNodeEvents.find((entry) => entry.stationId === selectedNode)
    if (!event) return null
    const meta = event.meta as Record<string, unknown> | undefined
    return {
      strategy: typeof meta?.strategy === "string" ? meta.strategy : null,
      timeframe: typeof meta?.timeframe === "string" ? meta.timeframe : null,
      runtimeMs: typeof meta?.runtimeMs === "number" ? meta.runtimeMs : null,
      mode:
        typeof meta?.tradingMode === "string"
          ? meta.tradingMode
          : typeof meta?.mode === "string"
            ? meta.mode
            : null,
    }
  }, [selectedNode, selectedNodeEvents])

  const selectedNodeMetaLines = useMemo(() => {
    if (!selectedNode) return []
    return nodeMetaLines.get(selectedNode) || []
  }, [selectedNode, nodeMetaLines])

  const selectedEdgeEvents = useMemo(() => {
    if (!selectedEdge) return []
    return renderEvents
      .filter((event) => resolveEdgeKeys(event).includes(selectedEdge))
      .slice(0, 50)
  }, [renderEvents, selectedEdge])

  const selectedEdgeStatsSummary = useMemo(() => {
    if (!selectedEdgeEvents.length) return null
    return {
      latency: computeLatencyStats(selectedEdgeEvents),
      rate: computeEventRate(selectedEdgeEvents),
      errors: selectedEdgeEvents.filter((event) => event.status === "error").length,
    }
  }, [selectedEdgeEvents])

  const selectedNodeStatsSummary = useMemo(() => {
    if (!selectedNodeEvents.length) return null
    return {
      latency: computeLatencyStats(selectedNodeEvents),
      rate: computeEventRate(selectedNodeEvents),
      errors: selectedNodeEvents.filter((event) => event.status === "error").length,
    }
  }, [selectedNodeEvents])

  const selectedBatchEvents = useMemo(() => {
    if (!selectedBatch) return []
    const detailMatch = batchDetailKey === selectedBatch && batchDetailEvents?.length
      ? batchDetailEvents
      : null
    const baseEvents = renderEvents.filter((event) => resolveBatchId(event) === selectedBatch).slice(0, 40)
    return detailMatch ? mergeEvents(detailMatch, baseEvents, 120) : baseEvents
  }, [renderEvents, selectedBatch, batchDetailEvents, batchDetailKey])

  const missingBatchEdges = useMemo(() => {
    if (!selectedBatch) return []
    const seen = new Set(
      selectedBatchEvents.flatMap((event) => resolveEdgeKeys(event))
    )
    return REQUIRED_BATCH_EDGES.filter((edgeId) => !seen.has(edgeId))
  }, [selectedBatch, selectedBatchEvents])

  const selectedBatchInputs = useMemo(() => {
    if (!selectedBatch) return null
    return collectInputSummary(selectedBatchEvents)
  }, [selectedBatch, selectedBatchEvents])

  const symbolSummaries = useMemo<SymbolSummary[]>(() => {
    if (!selectedBatch) return []
    const map = new Map<string, SymbolSummary>()
    renderEvents.forEach((event) => {
      if (!event.symbolKey) return
      if (resolveBatchId(event) !== selectedBatch) return
      const ts = Date.parse(event.ts) || Date.now()
      const meta = event.meta as Record<string, unknown> | undefined
      const origins = extractOriginList(meta)
      const action = typeof meta?.action === "string" ? meta.action : null
      const score = typeof meta?.score === "number" ? meta.score : null
      const existing = map.get(event.symbolKey)
      const nextOrigins = origins.length ? origins : existing?.origins ?? []
      const next: SymbolSummary = {
        symbolKey: event.symbolKey,
        lastEventAt: existing?.lastEventAt && existing.lastEventAt > ts ? existing.lastEventAt : ts,
        lastEdgeKey: existing?.lastEventAt && existing.lastEventAt > ts
          ? existing.lastEdgeKey
          : resolveEdgeKey(event),
        origins: nextOrigins,
        action: action ?? existing?.action ?? null,
        score: score ?? existing?.score ?? null,
      }
      map.set(event.symbolKey, next)
    })

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        origins: item.origins.length > 0 ? item.origins : ["unknown"],
      }))
      .sort((a, b) => b.lastEventAt - a.lastEventAt)
      .slice(0, 16)
  }, [renderEvents, selectedBatch])

  const selectedSymbolEvents = useMemo(() => {
    if (!selectedSymbol) return []
    const detailKey = `${selectedBatch || ""}:${selectedSymbol}`
    const detailMatch = symbolDetailKey === detailKey && symbolDetailEvents?.length
      ? symbolDetailEvents
      : null
    const baseEvents = renderEvents
      .filter((event) => {
        if (event.symbolKey !== selectedSymbol) return false
        if (!selectedBatch) return true
        return resolveBatchId(event) === selectedBatch
      })
      .slice(0, 24)
    return detailMatch ? mergeEvents(detailMatch, baseEvents, 120) : baseEvents
  }, [renderEvents, selectedSymbol, selectedBatch, symbolDetailEvents, symbolDetailKey])

  const selectedSymbolInputs = useMemo(() => {
    if (!selectedSymbol) return null
    return collectInputSummary(selectedSymbolEvents)
  }, [selectedSymbol, selectedSymbolEvents])

  const selectedSymbolOrigins = useMemo(() => {
    if (!selectedSymbol) return []
    for (const event of selectedSymbolEvents) {
      const origins = extractOriginList(event.meta as Record<string, unknown> | undefined)
      if (origins.length) return origins
    }
    return ["unknown"]
  }, [selectedSymbol, selectedSymbolEvents])

  const selectedSymbolSignals = useMemo(() => {
    const summary = {
      buy: 0,
      sell: 0,
      hold: 0,
      total: 0,
      engines: new Set<string>(),
      modes: new Set<string>(),
      strategies: new Set<string>(),
      timeframes: new Set<string>(),
    }
    selectedSymbolEvents.forEach((event) => {
      if (event.stationId !== "bot_signals") return
      summary.total += 1
      const meta = event.meta as Record<string, unknown> | undefined
      const side = typeof meta?.side === "string" ? meta.side.toLowerCase() : "hold"
      if (side === "buy") summary.buy += 1
      else if (side === "sell") summary.sell += 1
      else summary.hold += 1
      const engine = typeof meta?.engine === "string" ? meta.engine : null
      if (engine) summary.engines.add(engine)
      const mode = typeof meta?.tradingMode === "string"
        ? meta.tradingMode
        : typeof meta?.mode === "string"
          ? meta.mode
          : null
      if (mode) summary.modes.add(mode)
      const strategy = typeof meta?.strategy === "string" ? meta.strategy : null
      if (strategy) summary.strategies.add(strategy)
      const timeframe = typeof meta?.timeframe === "string" ? meta.timeframe : null
      if (timeframe) summary.timeframes.add(timeframe)
    })
    return {
      buy: summary.buy,
      sell: summary.sell,
      hold: summary.hold,
      total: summary.total,
      engines: Array.from(summary.engines),
      modes: Array.from(summary.modes),
      strategies: Array.from(summary.strategies),
      timeframes: Array.from(summary.timeframes),
    }
  }, [selectedSymbolEvents])

  const selectedSymbolScoreEvent = useMemo(() => {
    return selectedSymbolEvents.find((event) => {
      const meta = event.meta as Record<string, unknown> | undefined
      return (
        typeof meta?.score === "number" ||
        typeof meta?.action === "string" ||
        typeof meta?.holdMinutes === "number"
      )
    })
  }, [selectedSymbolEvents])

  const selectedSymbolScore = useMemo(() => {
    const meta = selectedSymbolScoreEvent?.meta as Record<string, unknown> | undefined
    return {
      score: typeof meta?.score === "number" ? meta.score : null,
      action: typeof meta?.action === "string" ? meta.action : null,
      holdMinutes: typeof meta?.holdMinutes === "number" ? meta.holdMinutes : null,
      stopLossPct: typeof meta?.stopLossPct === "number" ? meta.stopLossPct : null,
      takeProfitPct: typeof meta?.takeProfitPct === "number" ? meta.takeProfitPct : null,
      confidence: typeof meta?.confidence === "number" ? meta.confidence : null,
      reasonsShort: typeof meta?.reasonsShort === "string" ? meta.reasonsShort : null,
    }
  }, [selectedSymbolScoreEvent])

  useEffect(() => {
    if (renderEvents.length === 0) return
    setStableExtraEdges((prev) => {
      const existing = new Set(prev.map((edge) => edge.id))
      const additions: GraphEdgeSpec[] = []
      renderEvents.forEach((event) => {
        resolveEdgeKeys(event).forEach((edgeKey) => {
          if (!edgeKey || existing.has(edgeKey)) return
          const parsed = parseEdgeKey(edgeKey)
          if (!parsed) return
          additions.push({
            id: edgeKey,
            from: parsed.from,
            to: parsed.to,
            kind: inferEdgeKind(event),
            core: false,
          })
          existing.add(edgeKey)
        })
      })
      return additions.length > 0 ? [...prev, ...additions] : prev
    })
  }, [renderEvents])

  const telemetryGaps = useMemo(() => {
    const staleMs = 6 * 60 * 1000
    const critical = new Set(
      edgeSpecs.filter((edge) => edge.core).map((edge) => edge.id)
    )
    CRITICAL_EDGE_IDS.forEach((id) => critical.add(id))
    return Array.from(critical)
      .map((edgeId) => edgeSpecMap.get(edgeId))
      .filter((edge): edge is GraphEdgeSpec => Boolean(edge))
      .map((edge) => {
        const lastSeen = edgeStats[edge.id]?.lastSeen ?? null
        const ageMs = lastSeen ? now - lastSeen : null
        return {
          id: edge.id,
          label: edgeShortLabelMap.get(edge.id) || edge.id,
          lastSeen,
          ageMs,
        }
      })
      .filter((edge) => edge.ageMs === null || edge.ageMs > staleMs)
      .slice(0, 6)
  }, [edgeSpecs, edgeStats, edgeShortLabelMap, now, edgeSpecMap])

  const recentErrors = useMemo(() => {
    return renderEvents.filter((event) => event.status === "error").slice(0, 6)
  }, [renderEvents])

  const recentErrorCount = useMemo(() => {
    return recentErrors.length
  }, [recentErrors])

  const statusBadge =
    status === "live"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "error"
          ? "Error"
          : "Idle"

  const activeFilters =
    filters.batchId ||
    filters.symbolKey ||
    filters.providerId ||
    filters.botEngineId ||
    filters.onlyErrors ||
    filters.onlyBots ||
    filters.onlyExternal ||
    filters.onlyReads ||
    filters.onlyWrites ||
    filters.onlyCalls ||
    filters.onlyTriggers

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Ops Console</div>
            <h1 className="text-2xl font-semibold">Dataflow Activity Graph</h1>
            <p className="text-sm text-muted-foreground">
              Real-time pipeline topology with pulsing edges, provider usage, and origin drilldowns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "error" ? "destructive" : "secondary"}>{statusBadge}</Badge>
            {connectedAt && (
              <Badge variant="outline">Connected {connectedAt.toLocaleTimeString()}</Badge>
            )}
            {recentErrorCount > 0 && (
              <Badge variant="destructive">{recentErrorCount} errors</Badge>
            )}
            {activeFilters && <Badge variant="outline">Filtered</Badge>}
            {error && <Badge variant="destructive">{error}</Badge>}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative min-h-[640px]">
            {isExpanded && (
              <div
                className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm"
                onClick={() => setIsExpanded(false)}
              />
            )}
            <Card
              className={cn(
                "relative overflow-hidden border-border/60 bg-background/80 p-2",
                isExpanded && "fixed inset-6 z-50"
              )}
              ref={graphCardRef}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.05),transparent_60%),radial-gradient(circle_at_80%_70%,rgba(15,118,110,0.05),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.6))]" />
              <div className="relative w-full" style={graphHeightStyle} ref={graphBoundsRef}>
                <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handleResetView}>
                    Reset View
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleFitView}>
                    Fit View
                  </Button>
                  <Button
                    size="sm"
                    variant={layoutMode === "flow" ? "default" : "secondary"}
                    onClick={() =>
                      setLayoutMode((mode) => (mode === "flow" ? "fixed" : "flow"))
                    }
                  >
                    {layoutMode === "flow" ? "Flow Layout" : "Fixed Layout"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={layoutMode !== "flow"}
                    onClick={() =>
                      setLayoutDirection((dir) => (dir === "LR" ? "TB" : "LR"))
                    }
                  >
                    {layoutDirection === "LR" ? "Left → Right" : "Top → Bottom"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowActiveFlow((value) => !value)}
                  >
                    {showActiveFlow ? "Hide Flow" : "Show Flow"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowLanes((value) => !value)}
                  >
                    {showLanes ? "Hide Lanes" : "Show Lanes"}
                  </Button>
                  <Button
                    size="sm"
                    variant={freezeLive ? "default" : "secondary"}
                    onClick={() => {
                      setFreezeLive((prev) => {
                        const next = !prev
                        if (next) {
                          frozenEventsRef.current = renderEvents
                          freezeNowRef.current = Date.now()
                        } else {
                          frozenEventsRef.current = null
                          freezeNowRef.current = null
                        }
                        return next
                      })
                    }}
                  >
                    {freezeLive ? "Unfreeze" : "Freeze Live"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleToggleFullScreen}
                  >
                      {isFullView ? "Exit Full Screen" : "Full Screen"}
                    </Button>
                  </div>
                {activeBatchId && showActiveFlow && (
                  <motion.div
                    className="absolute left-4 top-4 z-20 max-w-[360px] cursor-grab rounded-2xl border border-white/70 bg-white/80 p-3 text-xs shadow-lg backdrop-blur active:cursor-grabbing"
                    drag
                    dragConstraints={graphBoundsRef}
                    dragMomentum={false}
                    style={{ x: flowOverlayOffset.x, y: flowOverlayOffset.y }}
                    onDragEnd={(_, info) => {
                      setFlowOverlayOffset((prev) => ({
                        x: prev.x + info.offset.x,
                        y: prev.y + info.offset.y,
                      }))
                    }}
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                      <GripVertical className="h-3 w-3" />
                      Active Batch Flow
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {activeBatchId}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      {activeBatchPath.length === 0 && <span>No flow steps yet.</span>}
                      {activeBatchPath.slice(0, 6).map((edgeId) => (
                        <span
                          key={edgeId}
                          className="rounded-full border border-white/70 bg-white/90 px-2 py-0.5"
                        >
                          {edgeShortLabelMap.get(edgeId) || edgeId}
                        </span>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-3 h-7 px-2 text-[10px] uppercase tracking-[0.2em]"
                      onClick={() => setShowActiveFlow(false)}
                    >
                      Hide
                    </Button>
                  </motion.div>
                )}
                <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-4 py-2 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
                  {Object.entries(EDGE_COLORS).map(([kind, color]) => (
                    <div key={kind} className="flex items-center gap-2">
                      <span className="h-2 w-5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="capitalize">{kind}</span>
                    </div>
                  ))}
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Live pulses
                  </span>
                </div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onError={handleFlowError}
                  onInit={(instance) => {
                    flowRef.current = instance
                    if (!viewportTouchedRef.current) {
                      requestAnimationFrame(() => {
                        handleFitView()
                        initialFitRef.current = true
                      })
                    }
                  }}
                  defaultViewport={{ x: 120, y: 60, zoom: 0.72 }}
                  minZoom={0.2}
                  maxZoom={2.2}
                  nodesDraggable={false}
                  nodesFocusable={false}
                  proOptions={{ hideAttribution: true }}
                  onNodeClick={(_, node) => {
                    setSelectedNode(node.id)
                    setSelectedEdge(null)
                  }}
                  onEdgeClick={(_, edge) => {
                    setSelectedEdge(edge.id)
                    setSelectedNode(null)
                  }}
                  onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
                  onNodeMouseLeave={() => setHoverNodeId(null)}
                  onEdgeMouseEnter={(_, edge) => setHoverEdgeId(edge.id)}
                  onEdgeMouseLeave={() => setHoverEdgeId(null)}
                  onPaneClick={() => {
                    setSelectedNode(null)
                    setSelectedEdge(null)
                  }}
                  onMoveStart={() => {
                    viewportTouchedRef.current = true
                  }}
                >
                  <MiniMap
                    nodeStrokeColor={(node) =>
                      node.type === "lane"
                        ? "transparent"
                        : CATEGORY_COLORS[(node.data as GraphNodeData)?.category] || "#94a3b8"
                    }
                    nodeColor={(node) =>
                      node.type === "lane"
                        ? "transparent"
                        : (node.data as GraphNodeData)?.status === "error"
                          ? "#f43f5e"
                          : "#e2e8f0"
                    }
                    maskColor="rgba(15, 23, 42, 0.08)"
                  />
                  <Controls showInteractive={false} />
                  <Background color="#e2e8f0" gap={32} size={1} variant={BackgroundVariant.Dots} />
                </ReactFlow>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Filters</div>
                  <div className="text-xs text-muted-foreground">Narrow activity to batches, symbols, or providers.</div>
                </div>
                {activeFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setFilters({
                        batchId: "",
                        symbolKey: "",
                        providerId: "",
                        botEngineId: "",
                        onlyErrors: false,
                        onlyBots: false,
                        onlyExternal: false,
                        onlyReads: false,
                        onlyWrites: false,
                        onlyCalls: false,
                        onlyTriggers: false,
                        showUnknown: true,
                      })
                    }
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <Input
                    placeholder="Filter by batchId"
                    value={filters.batchId}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, batchId: event.target.value }))
                    }
                  />
                  <Input
                    placeholder="Filter by symbolKey"
                    value={filters.symbolKey}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, symbolKey: event.target.value }))
                    }
                  />
                  <Input
                    placeholder="Filter by providerId"
                    value={filters.providerId}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, providerId: event.target.value }))
                    }
                  />
                  <Input
                    placeholder="Filter by bot engine"
                    value={filters.botEngineId}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, botEngineId: event.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={filters.onlyErrors ? "default" : "outline"}
                    onClick={() => setFilters((prev) => ({ ...prev, onlyErrors: !prev.onlyErrors }))}
                  >
                    Only errors
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.onlyBots ? "default" : "outline"}
                    onClick={() => setFilters((prev) => ({ ...prev, onlyBots: !prev.onlyBots }))}
                  >
                    Only bots
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.onlyExternal ? "default" : "outline"}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, onlyExternal: !prev.onlyExternal }))
                    }
                  >
                    Only external
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.onlyReads ? "default" : "outline"}
                    onClick={() => setFilters((prev) => ({ ...prev, onlyReads: !prev.onlyReads }))}
                  >
                    Only reads
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.onlyWrites ? "default" : "outline"}
                    onClick={() => setFilters((prev) => ({ ...prev, onlyWrites: !prev.onlyWrites }))}
                  >
                    Only writes
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.onlyCalls ? "default" : "outline"}
                    onClick={() => setFilters((prev) => ({ ...prev, onlyCalls: !prev.onlyCalls }))}
                  >
                    Only calls
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.onlyTriggers ? "default" : "outline"}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, onlyTriggers: !prev.onlyTriggers }))
                    }
                  >
                    Only triggers
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.showUnknown ? "default" : "outline"}
                    onClick={() => setFilters((prev) => ({ ...prev, showUnknown: !prev.showUnknown }))}
                  >
                    {filters.showUnknown ? "Hide unknown" : "Show unknown"}
                  </Button>
                  <Button
                    size="sm"
                    variant={focusFlow ? "default" : "outline"}
                    onClick={() => setFocusFlow((prev) => !prev)}
                  >
                    Focus flow
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 p-4">
              <div className="text-sm font-semibold">Global Status</div>
              <Separator className="my-3" />
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Events buffered</span>
                  <span className="font-semibold text-foreground">{renderEvents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Latest batch</span>
                  <span className="font-semibold text-foreground">
                    {batchStates[0]?.batchId ? batchStates[0].batchId.slice(-8) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Batch head</span>
                  <span className="font-semibold text-foreground">
                    {newBatchMeta.headBatchId ? newBatchMeta.headBatchId.slice(-8) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>AG lag</span>
                  <span className="font-semibold text-foreground">
                    {newBatchMeta.agentLag !== null ? formatAge(newBatchMeta.agentLag) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>REF lag</span>
                  <span className="font-semibold text-foreground">
                    {newBatchMeta.refreshLag !== null ? formatAge(newBatchMeta.refreshLag) : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Providers active</span>
                  <span className="font-semibold text-foreground">{providerStats.length}</span>
                </div>
              </div>
              {providerStats.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">Providers</div>
                  {providerStats.slice(0, 4).map((provider) => (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-2 py-1 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{provider.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {provider.requestCount} calls • {provider.errorCount} errors
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        <div>
                          {provider.avgDuration ? `${provider.avgDuration.toFixed(0)} ms avg` : "-"}
                        </div>
                        <div>
                          {provider.p95 ? `${provider.p95.toFixed(0)} ms p95` : "-"}
                        </div>
                        <div>
                          Cache {provider.requestCount > 0
                            ? `${Math.round((provider.cacheHits / provider.requestCount) * 100)}%`
                            : "0%"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {telemetryGaps.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">Telemetry gaps</div>
                  {telemetryGaps.map((gap) => (
                    <div
                      key={gap.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-2 py-1 text-[11px]"
                    >
                      <span className="truncate">{gap.label}</span>
                      <span className="text-rose-500">
                        {gap.ageMs === null ? "never" : formatAge(gap.ageMs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Recent Batches</div>
                  <div className="text-xs text-muted-foreground">Click to drill down.</div>
                </div>
                <Badge variant="outline">{batchStates.length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {batchStates.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                    No batch activity yet.
                  </div>
                )}
                {batchStates.map((batch) => (
                  <button
                    key={batch.batchId}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-left text-xs",
                      selectedBatch === batch.batchId
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50"
                    )}
                    onClick={() => {
                      setSelectedBatch(batch.batchId)
                      setSelectedSymbol(null)
                    }}
                  >
                    <div>
                      <div className="font-semibold">{batch.batchId}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {batch.lastEdgeKey || "-"}
                      </div>
                    </div>
                    <Badge variant="secondary">{batch.status}</Badge>
                  </button>
                ))}
              </div>
            </Card>

            {(selectedNode || selectedEdge) && (
              <Card className="border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Selection</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedNode(null)
                      setSelectedEdge(null)
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <Separator className="my-3" />
                {selectedNode && (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-foreground">
                      {nodeLabelMap.get(selectedNode) || selectedNode}
                    </div>
                    {selectedNodeStatsSummary && (
                      <div className="text-[11px] text-muted-foreground">
                        {selectedNodeStatsSummary.latency
                          ? `Avg ${selectedNodeStatsSummary.latency.avg.toFixed(0)} ms · P95 ${selectedNodeStatsSummary.latency.p95.toFixed(0)} ms`
                          : "Latency: —"}
                        {selectedNodeStatsSummary.rate
                          ? ` · ${selectedNodeStatsSummary.rate.toFixed(1)} ev/min`
                          : ""}
                        {selectedNodeStatsSummary.errors > 0
                          ? ` · ${selectedNodeStatsSummary.errors} errors`
                          : ""}
                      </div>
                    )}
                    {(selectedNodeMetaLines.length > 0 || selectedProviderStats || selectedBotMeta) && (
                      <div className="rounded-lg border border-border/60 bg-muted/40 p-2 text-[11px] text-muted-foreground">
                        {selectedNodeMetaLines.length > 0 && (
                          <div className="space-y-1">
                            {selectedNodeMetaLines.map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                        )}
                        {selectedProviderStats && (
                          <div className="mt-2 space-y-1">
                            <div>
                              Cache {selectedProviderStats.requestCount > 0
                                ? `${Math.round((selectedProviderStats.cacheHits / selectedProviderStats.requestCount) * 100)}%`
                                : "0%"} · {selectedProviderStats.errorCount} errors
                            </div>
                            <div>
                              Avg {selectedProviderStats.avgDuration
                                ? `${selectedProviderStats.avgDuration.toFixed(0)}ms`
                                : "—"} · P95 {selectedProviderStats.p95
                                ? `${selectedProviderStats.p95.toFixed(0)}ms`
                                : "—"}
                            </div>
                          </div>
                        )}
                        {selectedBotMeta && (
                          <div className="mt-2 space-y-1">
                            {selectedBotMeta.strategy && (
                              <div>Strategy {selectedBotMeta.strategy}</div>
                            )}
                            {selectedBotMeta.timeframe && (
                              <div>Timeframe {selectedBotMeta.timeframe}</div>
                            )}
                            {selectedBotMeta.runtimeMs !== null && (
                              <div>Runtime {Math.round(selectedBotMeta.runtimeMs)}ms</div>
                            )}
                            {selectedBotMeta.mode && (
                              <div>Mode {selectedBotMeta.mode}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-muted-foreground">Last 50 events</div>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {selectedNodeEvents.map((event) => (
                        <div key={`${event.eventId}-${event.ts}`} className="rounded-lg border border-border/60 px-2 py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{event.stationId}</span>
                            <span className={event.status === "error" ? "text-rose-500" : "text-muted-foreground"}>
                              {event.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {event.eventType || "event"} • {new Date(event.ts).toLocaleTimeString()}
                          </div>
                          {(event.batchId || event.symbolKey) && (
                            <div className="text-[11px] text-muted-foreground">
                              {event.batchId ? `Batch ${event.batchId.slice(-8)}` : ""}
                              {event.batchId && event.symbolKey ? " · " : ""}
                              {event.symbolKey ? event.symbolKey : ""}
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedNodeEvents.length === 0 && (
                        <div className="text-muted-foreground">No events yet.</div>
                      )}
                    </div>
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-foreground">
                      {edgeLabelMap.get(selectedEdge) || selectedEdge}
                    </div>
                    {selectedEdgeStatsSummary && (
                      <div className="text-[11px] text-muted-foreground">
                        {selectedEdgeStatsSummary.latency
                          ? `Avg ${selectedEdgeStatsSummary.latency.avg.toFixed(0)} ms · P95 ${selectedEdgeStatsSummary.latency.p95.toFixed(0)} ms`
                          : "Latency: —"}
                        {selectedEdgeStatsSummary.rate
                          ? ` · ${selectedEdgeStatsSummary.rate.toFixed(1)} ev/min`
                          : ""}
                        {selectedEdgeStatsSummary.errors > 0
                          ? ` · ${selectedEdgeStatsSummary.errors} errors`
                          : ""}
                      </div>
                    )}
                    <div className="text-muted-foreground">Last 50 events</div>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {selectedEdgeEvents.map((event) => (
                        <div key={`${event.eventId}-${event.ts}`} className="rounded-lg border border-border/60 px-2 py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{event.stationId}</span>
                            <span className={event.status === "error" ? "text-rose-500" : "text-muted-foreground"}>
                              {event.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {event.eventType || "event"} • {new Date(event.ts).toLocaleTimeString()}
                          </div>
                          {(event.batchId || event.symbolKey) && (
                            <div className="text-[11px] text-muted-foreground">
                              {event.batchId ? `Batch ${event.batchId.slice(-8)}` : ""}
                              {event.batchId && event.symbolKey ? " · " : ""}
                              {event.symbolKey ? event.symbolKey : ""}
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedEdgeEvents.length === 0 && (
                        <div className="text-muted-foreground">No events yet.</div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {selectedBatch && (
              <Card className="border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Batch {selectedBatch.slice(-8)}</div>
                    <div className="text-xs text-muted-foreground">Origins and timeline</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedBatch(null)}>
                    Clear
                  </Button>
                </div>
                <Separator className="my-3" />
                {(batchDetailLoading || detailError) && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    {batchDetailLoading ? "Loading full batch history…" : null}
                    {detailError ? `Detail fetch error: ${detailError}` : null}
                  </div>
                )}
                {originBreakdown && (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                    <div className="text-[11px] uppercase text-muted-foreground">Origins</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(originBreakdown).map(([origin, count]) => (
                        <Badge key={origin} variant={origin === "unknown" ? "destructive" : "outline"}>
                          {origin}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                  <div className="text-[11px] uppercase text-muted-foreground">Completeness</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingBatchEdges.length === 0 ? (
                      <Badge variant="outline">All core stages present</Badge>
                    ) : (
                      missingBatchEdges.map((edgeId) => (
                        <Badge key={edgeId} variant="destructive">
                          Missing {edgeShortLabelMap.get(edgeId) || edgeId}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="text-[11px] uppercase text-muted-foreground">Symbols</div>
                  <div className="max-h-40 space-y-2 overflow-auto">
                    {symbolSummaries.map((symbol) => (
                      <button
                        key={symbol.symbolKey}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border border-border/60 px-2 py-1",
                          selectedSymbol === symbol.symbolKey
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/50"
                        )}
                        onClick={() => setSelectedSymbol(symbol.symbolKey)}
                      >
                        <span className="font-medium">{symbol.symbolKey}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {symbol.origins.join(", ")}
                        </span>
                      </button>
                    ))}
                    {symbolSummaries.length === 0 && (
                      <div className="text-muted-foreground">No symbol samples yet.</div>
                    )}
                  </div>
                </div>
                {selectedBatchInputs && (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                    <div className="text-[11px] uppercase text-muted-foreground">Inputs</div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      <div>
                        Redis: {selectedBatchInputs.redisKeys.length
                          ? selectedBatchInputs.redisKeys.join(", ")
                          : "—"}
                      </div>
                      <div>
                        Firestore: {selectedBatchInputs.firestoreDocs.length
                          ? selectedBatchInputs.firestoreDocs.join(", ")
                          : "—"}
                      </div>
                      <div>
                        Providers: {selectedBatchInputs.providerCalls.length
                          ? selectedBatchInputs.providerCalls
                            .map((call) =>
                              `${String(call.providerId || "unknown")}/${String(call.endpointName || "endpoint")}`
                            )
                            .join(", ")
                          : "—"}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-3 space-y-2 text-xs">
                  <div className="text-[11px] uppercase text-muted-foreground">Timeline</div>
                  <div className="max-h-44 space-y-2 overflow-auto">
                    {selectedBatchEvents.map((event) => (
                      <div key={`${event.eventId}-${event.ts}`} className="rounded-lg border border-border/60 px-2 py-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{event.stationId}</span>
                          <span className={event.status === "error" ? "text-rose-500" : "text-muted-foreground"}>
                            {event.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {event.eventType || "event"} • {new Date(event.ts).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    {selectedBatchEvents.length === 0 && (
                      <div className="text-muted-foreground">No batch events yet.</div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {selectedSymbol && (
              <Card className="border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{selectedSymbol}</div>
                    {selectedBatch && (
                      <div className="text-xs text-muted-foreground">Batch {selectedBatch.slice(-8)}</div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSymbol(null)}>
                    Clear
                  </Button>
                </div>
                <Separator className="my-3" />
                {(symbolDetailLoading || detailError) && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    {symbolDetailLoading ? "Loading symbol history…" : null}
                    {detailError ? `Detail fetch error: ${detailError}` : null}
                  </div>
                )}
                <div className="rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                  <div className="text-[11px] uppercase text-muted-foreground">Origins</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedSymbolOrigins.map((origin) => (
                      <Badge key={origin} variant={origin === "unknown" ? "destructive" : "outline"}>
                        {origin}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                  <div className="text-[11px] uppercase text-muted-foreground">Scoring</div>
                  {selectedSymbolScoreEvent ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {selectedSymbolScore.score !== null && (
                        <div>Score: {selectedSymbolScore.score}</div>
                      )}
                      {selectedSymbolScore.action && (
                        <div>Action: {selectedSymbolScore.action}</div>
                      )}
                      {selectedSymbolScore.holdMinutes !== null && (
                        <div>Hold: {selectedSymbolScore.holdMinutes}m</div>
                      )}
                      {selectedSymbolScore.stopLossPct !== null && (
                        <div>SL: {selectedSymbolScore.stopLossPct}%</div>
                      )}
                      {selectedSymbolScore.takeProfitPct !== null && (
                        <div>TP: {selectedSymbolScore.takeProfitPct}%</div>
                      )}
                      {selectedSymbolScore.confidence !== null && (
                        <div>Confidence: {selectedSymbolScore.confidence}</div>
                      )}
                      {selectedSymbolScore.reasonsShort && (
                        <div className="col-span-2 text-muted-foreground">
                          {selectedSymbolScore.reasonsShort}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-muted-foreground">No scoring data yet.</div>
                  )}
                </div>

                <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                  <div className="text-[11px] uppercase text-muted-foreground">Bot Signals</div>
                  {selectedSymbolSignals.total > 0 ? (
                    <div className="mt-2 space-y-1">
                      <div>
                        {selectedSymbolSignals.buy} buy • {selectedSymbolSignals.sell} sell • {" "}
                        {selectedSymbolSignals.hold} hold
                      </div>
                      {selectedSymbolSignals.engines.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Engines: {selectedSymbolSignals.engines.join(", ")}
                        </div>
                      )}
                      {selectedSymbolSignals.modes.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Trading mode: {selectedSymbolSignals.modes.join(", ")}
                        </div>
                      )}
                      {selectedSymbolSignals.strategies.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Strategy: {selectedSymbolSignals.strategies.join(", ")}
                        </div>
                      )}
                      {selectedSymbolSignals.timeframes.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Timeframe: {selectedSymbolSignals.timeframes.join(", ")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-muted-foreground">No bot signals sampled.</div>
                  )}
                </div>
                {selectedSymbolInputs && (
                  <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
                    <div className="text-[11px] uppercase text-muted-foreground">Inputs used</div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      <div>
                        Redis: {selectedSymbolInputs.redisKeys.length
                          ? selectedSymbolInputs.redisKeys.join(", ")
                          : "—"}
                      </div>
                      <div>
                        Firestore: {selectedSymbolInputs.firestoreDocs.length
                          ? selectedSymbolInputs.firestoreDocs.join(", ")
                          : "—"}
                      </div>
                      <div>
                        Providers: {selectedSymbolInputs.providerCalls.length
                          ? selectedSymbolInputs.providerCalls
                            .map((call) =>
                              `${String(call.providerId || "unknown")}/${String(call.endpointName || "endpoint")}`
                            )
                            .join(", ")
                          : "—"}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
