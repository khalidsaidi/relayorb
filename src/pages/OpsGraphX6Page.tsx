import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Graph, type Edge, type Node } from "@antv/x6"
import { register } from "@antv/x6-react-shape"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OpsGraphNodeCard } from "@/components/OpsGraphX6/OpsGraphNodeCard"
import { PipelineHealthBadge } from "@/components/PipelineHealthBadge"
import { PipelineHealthPanel } from "@/components/PipelineHealthPanel"
import { usePipelineEvents } from "@/features/ops/use-pipeline-events"
import type { PipelineEvent } from "@/lib/types"
import opsLayoutConfig from "@/ops/ops_graph_layout.json"
import graphSpec from "@/ops/graph_topology.json"

const LAYOUT_CACHE_PREFIX = "ops_graph_layout:"
const BASE_LAYOUT = {
  marginX: 220,
  marginY: 200,
  laneWidth: 360,
  rowHeight: 190,
  trackSpacing: 26,
  localTrackSpacing: 22,
  outPad: 28,
  inPad: 18,
  channelPad: 32,
  sameLaneOffset: 120,
  backedgeGap: 80,
  backedgeSpacing: 26,
}
const MAX_SWEEPS = 4
const MAX_INTERSECTIONS = 24
const MAX_EDGE_LENGTH = 2400
const PAN_STEP = 80
const PAN_STEP_FAST = 220

const RATE_WINDOW_MS = 60_000
const ERROR_WINDOW_MS = 5 * 60_000

const EDGE_COLORS: Record<string, string> = {
  read: "#2563eb",
  write: "#16a34a",
  call: "#f97316",
  event: "#0ea5e9",
  trigger: "#eab308",
}

const LABEL_OFFSETS: Record<string, number> = {
  read: -40,
  write: 40,
  call: -60,
  event: 60,
  trigger: 72,
}

const CATEGORY_LANE_FALLBACK: Record<string, number> = {
  provider: 0,
  gateway: 1,
  chart: 2,
  service: 2,
  store: 3,
  compute: 4,
  queue: 5,
  bot: 6,
  score: 7,
  ui: 9,
  unknown: 4,
}

const NODE_SIZES = {
  core: { width: 250, height: 130 },
  standard: { width: 230, height: 118 },
  bus: { width: 8, height: 8 },
}

const layoutConfig = opsLayoutConfig as OpsLayoutConfig

let x6Registered = false

function ensureX6Shapes() {
  if (x6Registered) return
  register({
    shape: "ops-node",
    width: NODE_SIZES.standard.width,
    height: NODE_SIZES.standard.height,
    component: OpsGraphNodeCard,
  })
  Graph.registerNode(
    "ops-bus",
    {
      inherit: "rect",
      width: NODE_SIZES.bus.width,
      height: NODE_SIZES.bus.height,
      attrs: {
        body: { fill: "transparent", stroke: "transparent" },
      },
    },
    true
  )
  x6Registered = true
}

type GraphNodeSpec = {
  id: string
  label: string
  x: number
  y: number
  category: string
  type?: string
  core?: boolean
  lane?: number
  orderHint?: number
  role?: "bus"
}

type GraphEdgeSpec = {
  id: string
  from: string
  to: string
  kind: string
  core?: boolean
  label?: string
  labelMode?: "auto" | "always" | "none"
  logicalId?: string
  count?: number
}

type Point = { x: number; y: number }

type OpsLayoutConfig = {
  laneByNodeId?: Record<string, number>
  hiddenNodes?: string[]
  pinnedOrder?: Record<string, number>
}

type LayoutSizing = typeof BASE_LAYOUT

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

function getEventKey(event: PipelineEvent) {
  const parts = [event.eventId, event.ts, event.stationId, event.edgeKey, event.symbolKey]
    .map((value) => (value ? String(value) : ""))
    .filter(Boolean)
  return parts.join("|")
}

function collectProviderKeys(event: PipelineEvent) {
  const ids = new Set<string>()
  if (event.stationId?.startsWith("provider:")) ids.add(event.stationId)
  const edgeKey = event.edgeKey || ""
  const match = edgeKey.match(/provider:[^->]+/g)
  if (match) match.forEach((id) => ids.add(id))
  const meta = event.meta as Record<string, unknown> | undefined
  const metaProvider = typeof meta?.provider === "string" ? meta.provider : null
  if (metaProvider) {
    ids.add(metaProvider.startsWith("provider:") ? metaProvider : `provider:${metaProvider}`)
  }
  return Array.from(ids)
}

function collectBotEngineKeys(event: PipelineEvent) {
  const ids = new Set<string>()
  if (event.stationId?.startsWith("bot_engine:")) ids.add(event.stationId)
  const edgeKey = event.edgeKey || ""
  const match = edgeKey.match(/bot_engine:[^->]+/g)
  if (match) match.forEach((id) => ids.add(id))
  const meta = event.meta as Record<string, unknown> | undefined
  const metaEngine =
    typeof meta?.engine === "string"
      ? meta.engine
      : typeof meta?.botEngineId === "string"
        ? meta.botEngineId
        : null
  if (metaEngine) {
    ids.add(metaEngine.startsWith("bot_engine:") ? metaEngine : `bot_engine:${metaEngine}`)
  }
  return Array.from(ids)
}

function resolveLaneIndex(node: GraphNodeSpec) {
  const laneOverride = layoutConfig.laneByNodeId?.[node.id]
  if (typeof laneOverride === "number") return laneOverride
  if (typeof node.lane === "number") return node.lane
  if (node.id.startsWith("provider:")) return 0
  if (node.id.startsWith("bot_engine:")) return 6
  if (node.type === "ui" || node.category === "ui") return 9
  return CATEGORY_LANE_FALLBACK[node.category] ?? 4
}

function getNodeDimensions(node: GraphNodeSpec) {
  if (node.role === "bus") return NODE_SIZES.bus
  const base = node.core ? NODE_SIZES.core : NODE_SIZES.standard
  const label = (node.label || "").trim()
  const wordCount = label ? label.split(/\s+/).length : 0
  const isLong = label.length >= 20 || wordCount >= 3
  return {
    width: base.width + (isLong ? 24 : 0),
    height: base.height + (isLong ? 18 : 0),
  }
}


function percentile(values: number[], target: number) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor((sorted.length - 1) * target)
  return sorted[idx] ?? null
}

type NodeStats = {
  lastSeen: number | null
  rateCount: number
  totalCount: number
  errorCount: number
  durations: number[]
  kindCounts: Record<string, number>
}

type EdgeStats = {
  lastSeen: number | null
  rateCount: number
  totalCount: number
  errorCount: number
  durations: number[]
}

type ComputedStats = {
  nodeStats: Map<string, NodeStats>
  edgeStats: Map<string, EdgeStats>
}

function computeStats(
  events: PipelineEvent[],
  edgeById: Map<string, GraphEdgeSpec>,
  edgeAliases?: Map<string, string>
) {
  const now = Date.now()
  const nodeStats = new Map<string, NodeStats>()
  const edgeStats = new Map<string, EdgeStats>()

  const ensureNode = (id: string) => {
    if (!nodeStats.has(id)) {
      nodeStats.set(id, {
        lastSeen: null,
        rateCount: 0,
        totalCount: 0,
        errorCount: 0,
        durations: [],
        kindCounts: { read: 0, write: 0, call: 0, event: 0, trigger: 0 },
      })
    }
    return nodeStats.get(id)!
  }

  const ensureEdge = (id: string) => {
    if (!edgeStats.has(id)) {
      edgeStats.set(id, {
        lastSeen: null,
        rateCount: 0,
        totalCount: 0,
        errorCount: 0,
        durations: [],
      })
    }
    return edgeStats.get(id)!
  }

  events.forEach((event) => {
    const ts = Date.parse(event.ts)
    const eventTime = Number.isFinite(ts) ? ts : now
    const inRateWindow = now - eventTime <= RATE_WINDOW_MS
    const inErrorWindow = now - eventTime <= ERROR_WINDOW_MS
    const edgeIds = Array.from(
      new Set(resolveEdgeKeys(event).map((edgeId) => edgeAliases?.get(edgeId) || edgeId))
    )
    const nodeIds = resolveNodeIds(event)

    edgeIds.forEach((edgeId) => {
      const edge = edgeById.get(edgeId)
      const stats = ensureEdge(edgeId)
      stats.lastSeen = stats.lastSeen ? Math.max(stats.lastSeen, eventTime) : eventTime
      if (inRateWindow) stats.rateCount += 1
      if (inErrorWindow) {
        stats.totalCount += 1
        if (event.status === "error") stats.errorCount += 1
        if (typeof event.durationMs === "number") stats.durations.push(event.durationMs)
      }
      if (edge) {
        const kind = edge.kind.toLowerCase()
        ;[edge.from, edge.to].forEach((nodeId) => {
          const nodeStatsEntry = ensureNode(nodeId)
          nodeStatsEntry.lastSeen = nodeStatsEntry.lastSeen
            ? Math.max(nodeStatsEntry.lastSeen, eventTime)
            : eventTime
          if (inRateWindow) nodeStatsEntry.rateCount += 1
          if (inErrorWindow) {
            nodeStatsEntry.totalCount += 1
            if (event.status === "error") nodeStatsEntry.errorCount += 1
            if (typeof event.durationMs === "number") nodeStatsEntry.durations.push(event.durationMs)
          }
          if (nodeStatsEntry.kindCounts[kind] !== undefined) {
            nodeStatsEntry.kindCounts[kind] += 1
          }
        })
      }
    })

    nodeIds.forEach((nodeId) => {
      const stats = ensureNode(nodeId)
      stats.lastSeen = stats.lastSeen ? Math.max(stats.lastSeen, eventTime) : eventTime
      if (inRateWindow) stats.rateCount += 1
      if (inErrorWindow) {
        stats.totalCount += 1
        if (event.status === "error") stats.errorCount += 1
        if (typeof event.durationMs === "number") stats.durations.push(event.durationMs)
      }
    })
  })

  return { nodeStats, edgeStats }
}

type OpsLayout = {
  positions: Map<string, Point>
  edgeVertices: Map<string, Point[]>
  edgePorts: Map<string, { sourcePort: string; targetPort: string }>
  portsByNode: Map<string, { inPorts: string[]; outPorts: string[] }>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  debug?: {
    laneBoundaries: number[]
    channelBands: Array<{ x: number; width: number }>
    forwardTrackYs: number[]
    sameLaneTrackYs: number[]
    backedgeTrackYs: number[]
  }
}

type OpsLayoutBuild = {
  layout: OpsLayout
  edgePolylines: Map<string, Point[]>
  maxEdgeLength: number
}

function buildFixedPorts(nodes: GraphNodeSpec[], edges: GraphEdgeSpec[]) {
  const portsByNode = new Map<string, { inPorts: string[]; outPorts: string[] }>()
  const edgePorts = new Map<string, { sourcePort: string; targetPort: string }>()
  nodes.forEach((node) => {
    portsByNode.set(node.id, { inPorts: [`${node.id}:in:0`], outPorts: [`${node.id}:out:0`] })
  })
  edges.forEach((edge) => {
    edgePorts.set(edge.id, {
      sourcePort: `${edge.from}:out:0`,
      targetPort: `${edge.to}:in:0`,
    })
  })
  return { portsByNode, edgePorts }
}

function normalizePinnedOrder(config: OpsLayoutConfig) {
  const pinned = new Map<string, number>()
  const entries = Object.entries(config.pinnedOrder || {})
  entries.forEach(([key, value]) => {
    if (typeof value === "number") pinned.set(key, value)
  })
  return pinned
}

function buildStructuralGraph(nodes: GraphNodeSpec[], edges: GraphEdgeSpec[]) {
  const hidden = new Set(layoutConfig.hiddenNodes || [])
  const visibleNodes = nodes.filter((node) => !hidden.has(node.id))
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]))
  const edgeAliases = new Map<string, string>()
  const edgeList = edges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to))
  edgeList.sort((a, b) => a.id.localeCompare(b.id))

  const edgeByKey = new Map<string, GraphEdgeSpec>()
  edgeList.forEach((edge) => {
    const kind = edge.kind.toLowerCase()
    const key = `${edge.from}|${edge.to}|${kind}`
    const existing = edgeByKey.get(key)
    if (!existing) {
      const next = { ...edge, kind, count: 1 }
      edgeByKey.set(key, next)
      edgeAliases.set(edge.id, next.id)
      return
    }
    existing.count = (existing.count ?? 1) + 1
    edgeAliases.set(edge.id, existing.id)
  })

  return {
    nodes: visibleNodes,
    edges: Array.from(edgeByKey.values()),
    edgeAliases,
  }
}

function computeLaneOrder(
  nodes: GraphNodeSpec[],
  edges: GraphEdgeSpec[],
  laneByNode: Map<string, number>,
  pinnedOrder: Map<string, number>
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const laneOrder = new Map<number, string[]>()
  nodes.forEach((node) => {
    const lane = laneByNode.get(node.id) ?? 0
    if (!laneOrder.has(lane)) laneOrder.set(lane, [])
    laneOrder.get(lane)?.push(node.id)
  })

  const laneIndices = Array.from(laneOrder.keys()).sort((a, b) => a - b)
  const initialIndex = new Map<string, number>()

  laneOrder.forEach((list) => {
    list.sort((a, b) => {
      const nodeA = nodeById.get(a)
      const nodeB = nodeById.get(b)
      const pinnedA = pinnedOrder.get(a)
      const pinnedB = pinnedOrder.get(b)
      if (pinnedA !== undefined || pinnedB !== undefined) {
        if (pinnedA === undefined) return 1
        if (pinnedB === undefined) return -1
        if (pinnedA !== pinnedB) return pinnedA - pinnedB
      }
      const hintA = nodeA?.orderHint ?? Number.POSITIVE_INFINITY
      const hintB = nodeB?.orderHint ?? Number.POSITIVE_INFINITY
      if (hintA !== hintB) return hintA - hintB
      const labelA = nodeA?.label || nodeA?.id || a
      const labelB = nodeB?.label || nodeB?.id || b
      if (labelA !== labelB) return labelA.localeCompare(labelB)
      return a.localeCompare(b)
    })
    list.forEach((id, index) => initialIndex.set(id, index))
  })

  const neighborsLeft = new Map<string, string[]>()
  const neighborsRight = new Map<string, string[]>()
  edges.forEach((edge) => {
    const fromLane = laneByNode.get(edge.from)
    const toLane = laneByNode.get(edge.to)
    if (fromLane === undefined || toLane === undefined) return
    if (fromLane < toLane && fromLane + 1 === toLane) {
      const left = neighborsLeft.get(edge.to) || []
      left.push(edge.from)
      neighborsLeft.set(edge.to, left)
      const right = neighborsRight.get(edge.from) || []
      right.push(edge.to)
      neighborsRight.set(edge.from, right)
    }
  })

  const getBarycenter = (neighbors: string[] | undefined, indices: Map<string, number>) => {
    if (!neighbors || neighbors.length === 0) return null
    let total = 0
    let count = 0
    neighbors.forEach((id) => {
      const idx = indices.get(id)
      if (idx === undefined) return
      total += idx
      count += 1
    })
    if (!count) return null
    return total / count
  }

  const reorder = (list: string[], neighborMap: Map<string, string[]>, indices: Map<string, number>) => {
    list.sort((a, b) => {
      const baryA = getBarycenter(neighborMap.get(a), indices)
      const baryB = getBarycenter(neighborMap.get(b), indices)
      if (baryA === null && baryB === null) {
        return (initialIndex.get(a) ?? 0) - (initialIndex.get(b) ?? 0)
      }
      if (baryA === null) return 1
      if (baryB === null) return -1
      if (baryA !== baryB) return baryA - baryB
      return (initialIndex.get(a) ?? 0) - (initialIndex.get(b) ?? 0)
    })
  }

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep += 1) {
    for (let i = 1; i < laneIndices.length; i += 1) {
      const lane = laneIndices[i]
      const prevLane = laneIndices[i - 1]
      const prevList = laneOrder.get(prevLane) || []
      const prevIndices = new Map(prevList.map((id, idx) => [id, idx]))
      const list = laneOrder.get(lane)
      if (list) reorder(list, neighborsLeft, prevIndices)
    }
    for (let i = laneIndices.length - 2; i >= 0; i -= 1) {
      const lane = laneIndices[i]
      const nextLane = laneIndices[i + 1]
      const nextList = laneOrder.get(nextLane) || []
      const nextIndices = new Map(nextList.map((id, idx) => [id, idx]))
      const list = laneOrder.get(lane)
      if (list) reorder(list, neighborsRight, nextIndices)
    }
  }

  return { laneOrder, laneIndices }
}

function simplifyPoints(points: Point[]) {
  const compacted: Point[] = []
  points.forEach((point) => {
    const last = compacted[compacted.length - 1]
    if (!last || last.x !== point.x || last.y !== point.y) {
      compacted.push(point)
    }
  })
  const simplified: Point[] = []
  compacted.forEach((point) => {
    const last = simplified[simplified.length - 1]
    const prev = simplified[simplified.length - 2]
    if (
      prev &&
      last &&
      ((prev.x === last.x && last.x === point.x) || (prev.y === last.y && last.y === point.y))
    ) {
      simplified[simplified.length - 1] = point
    } else {
      simplified.push(point)
    }
  })
  return simplified
}

function polylineLength(points: Point[]) {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    total += Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }
  return total
}

function countEdgeIntersections(edgePolylines: Map<string, Point[]>) {
  const segments: Array<{ edgeId: string; a: Point; b: Point; horizontal: boolean }> = []
  edgePolylines.forEach((points, edgeId) => {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]
      const b = points[i]
      if (a.x === b.x && a.y === b.y) continue
      const horizontal = a.y === b.y
      segments.push({ edgeId, a, b, horizontal })
    }
  })

  const isEndpoint = (point: Point, segment: { a: Point; b: Point }) =>
    (point.x === segment.a.x && point.y === segment.a.y) ||
    (point.x === segment.b.x && point.y === segment.b.y)

  let intersections = 0
  for (let i = 0; i < segments.length; i += 1) {
    const segA = segments[i]
    for (let j = i + 1; j < segments.length; j += 1) {
      const segB = segments[j]
      if (segA.edgeId === segB.edgeId) continue
      if (segA.horizontal === segB.horizontal) continue
      const h = segA.horizontal ? segA : segB
      const v = segA.horizontal ? segB : segA
      const hx1 = Math.min(h.a.x, h.b.x)
      const hx2 = Math.max(h.a.x, h.b.x)
      const vy1 = Math.min(v.a.y, v.b.y)
      const vy2 = Math.max(v.a.y, v.b.y)
      const ix = v.a.x
      const iy = h.a.y
      if (ix < hx1 || ix > hx2 || iy < vy1 || iy > vy2) continue
      const intersection = { x: ix, y: iy }
      if (isEndpoint(intersection, h) && isEndpoint(intersection, v)) continue
      intersections += 1
    }
  }
  return intersections
}

function computeOpsLayoutWithSizing(
  nodes: GraphNodeSpec[],
  edges: GraphEdgeSpec[],
  sizing: LayoutSizing
): OpsLayoutBuild {
  const laneByNode = new Map(nodes.map((node) => [node.id, resolveLaneIndex(node)]))
  const pinnedOrder = normalizePinnedOrder(layoutConfig)
  const { laneOrder } = computeLaneOrder(nodes, edges, laneByNode, pinnedOrder)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const positions = new Map<string, Point>()
  const nodeSizes = new Map<string, { width: number; height: number }>()
  laneOrder.forEach((nodeIds, lane) => {
    nodeIds.forEach((id, index) => {
      const node = nodeById.get(id)
      if (!node) return
      const size = getNodeDimensions(node)
      const x = sizing.marginX + lane * sizing.laneWidth
      const y = sizing.marginY + index * sizing.rowHeight
      positions.set(id, { x, y })
      nodeSizes.set(id, size)
    })
  })

  const maxLane = Math.max(0, ...Array.from(laneByNode.values()))
  const laneCenterX = (lane: number) => sizing.marginX + lane * sizing.laneWidth
  const boundaryAfterLane = (lane: number) => sizing.marginX + (lane + 0.5) * sizing.laneWidth
  const boundaryBeforeLane = (lane: number) => sizing.marginX + (lane - 0.5) * sizing.laneWidth
  const safeAfterLane = (lane: number) =>
    lane < maxLane ? boundaryAfterLane(lane) : laneCenterX(lane) + sizing.laneWidth / 2 + sizing.channelPad
  const safeBeforeLane = (lane: number) =>
    lane > 0 ? boundaryBeforeLane(lane) : laneCenterX(lane) - sizing.laneWidth / 2 - sizing.channelPad

  const { portsByNode, edgePorts } = buildFixedPorts(nodes, edges)

  const edgeVertices = new Map<string, Point[]>()
  const edgePolylines = new Map<string, Point[]>()

  const forwardEdges: GraphEdgeSpec[] = []
  const sameLaneEdges: GraphEdgeSpec[] = []
  const backEdges: GraphEdgeSpec[] = []
  edges.forEach((edge) => {
    const fromLane = laneByNode.get(edge.from) ?? 0
    const toLane = laneByNode.get(edge.to) ?? 0
    if (fromLane < toLane) forwardEdges.push(edge)
    else if (fromLane > toLane) backEdges.push(edge)
    else sameLaneEdges.push(edge)
  })

  const edgeSort = (a: GraphEdgeSpec, b: GraphEdgeSpec) => {
    const aFrom = laneByNode.get(a.from) ?? 0
    const aTo = laneByNode.get(a.to) ?? 0
    const bFrom = laneByNode.get(b.from) ?? 0
    const bTo = laneByNode.get(b.to) ?? 0
    if (aFrom !== bFrom) return aFrom - bFrom
    if (aTo !== bTo) return aTo - bTo
    return a.id.localeCompare(b.id)
  }
  forwardEdges.sort(edgeSort)
  sameLaneEdges.sort(edgeSort)
  backEdges.sort(edgeSort)

  const usedByBoundary = new Map<number, Set<number>>()
  const forwardTrackYs = new Set<number>()
  const sameLaneTrackYs = new Set<number>()
  const sameLaneTracksByLane = new Map<number, Set<number>>()

  const allocateTrackIndex = (
    boundaries: number[],
    desiredY: number,
    spacing: number
  ) => {
    const origin = sizing.marginY
    const preferred = Math.round((desiredY - origin) / spacing)
    const isFree = (index: number) =>
      boundaries.every((boundary) => {
        const used = usedByBoundary.get(boundary)
        return !used || !used.has(index)
      })
    const claim = (index: number) => {
      boundaries.forEach((boundary) => {
        if (!usedByBoundary.has(boundary)) usedByBoundary.set(boundary, new Set())
        usedByBoundary.get(boundary)?.add(index)
      })
      return index
    }
    for (let offset = 0; offset < 120; offset += 1) {
      if (offset === 0) {
        if (isFree(preferred)) return claim(preferred)
        continue
      }
      const plus = preferred + offset
      if (isFree(plus)) return claim(plus)
      const minus = preferred - offset
      if (isFree(minus)) return claim(minus)
    }
    return claim(preferred)
  }

  const allocateSameLaneIndex = (lane: number, desiredY: number) => {
    const origin = sizing.marginY
    const preferred = Math.round((desiredY - origin) / sizing.localTrackSpacing)
    if (!sameLaneTracksByLane.has(lane)) sameLaneTracksByLane.set(lane, new Set())
    const used = sameLaneTracksByLane.get(lane)!
    for (let offset = 0; offset < 80; offset += 1) {
      if (offset === 0 && !used.has(preferred)) {
        used.add(preferred)
        return preferred
      }
      const plus = preferred + offset
      if (!used.has(plus)) {
        used.add(plus)
        return plus
      }
      const minus = preferred - offset
      if (!used.has(minus)) {
        used.add(minus)
        return minus
      }
    }
    used.add(preferred)
    return preferred
  }

  forwardEdges.forEach((edge) => {
    const fromLane = laneByNode.get(edge.from) ?? 0
    const toLane = laneByNode.get(edge.to) ?? 0
    const sourcePos = positions.get(edge.from)
    const targetPos = positions.get(edge.to)
    if (!sourcePos || !targetPos) return
    const sourceSize = nodeSizes.get(edge.from) || NODE_SIZES.standard
    const targetSize = nodeSizes.get(edge.to) || NODE_SIZES.standard
    const start = { x: sourcePos.x + sourceSize.width / 2, y: sourcePos.y }
    const end = { x: targetPos.x - targetSize.width / 2, y: targetPos.y }
    const spanBoundaries: number[] = []
    for (let lane = fromLane; lane < toLane; lane += 1) {
      spanBoundaries.push(lane)
    }
    const desiredY = (start.y + end.y) / 2
    const trackIndex = allocateTrackIndex(spanBoundaries, desiredY, sizing.trackSpacing)
    const trackY = sizing.marginY + trackIndex * sizing.trackSpacing
    forwardTrackYs.add(trackY)
    const leftX = safeAfterLane(fromLane)
    const rightX = safeBeforeLane(toLane)
    const points = [
      start,
      { x: start.x + sizing.outPad, y: start.y },
      { x: leftX, y: start.y },
      { x: leftX, y: trackY },
      { x: rightX, y: trackY },
      { x: rightX, y: end.y },
      { x: end.x - sizing.inPad, y: end.y },
      end,
    ]
    const simplified = simplifyPoints(points)
    edgeVertices.set(edge.id, simplified.length > 2 ? simplified.slice(1, -1) : [])
    edgePolylines.set(edge.id, simplified)
  })

  sameLaneEdges.forEach((edge) => {
    const lane = laneByNode.get(edge.from) ?? 0
    const sourcePos = positions.get(edge.from)
    const targetPos = positions.get(edge.to)
    if (!sourcePos || !targetPos) return
    const sourceSize = nodeSizes.get(edge.from) || NODE_SIZES.standard
    const targetSize = nodeSizes.get(edge.to) || NODE_SIZES.standard
    const start = { x: sourcePos.x + sourceSize.width / 2, y: sourcePos.y }
    const end = { x: targetPos.x - targetSize.width / 2, y: targetPos.y }
    const desiredY = (start.y + end.y) / 2
    const trackIndex = allocateSameLaneIndex(lane, desiredY)
    const trackY = sizing.marginY + trackIndex * sizing.localTrackSpacing
    sameLaneTrackYs.add(trackY)
    const loopX = safeAfterLane(lane) + sizing.sameLaneOffset
    const points = [
      start,
      { x: start.x + sizing.outPad, y: start.y },
      { x: loopX, y: start.y },
      { x: loopX, y: trackY },
      { x: loopX, y: end.y },
      { x: end.x - sizing.inPad, y: end.y },
      end,
    ]
    const simplified = simplifyPoints(points)
    edgeVertices.set(edge.id, simplified.length > 2 ? simplified.slice(1, -1) : [])
    edgePolylines.set(edge.id, simplified)
  })

  const backedgeTrackYs: number[] = []
  backEdges.forEach((edge, index) => {
    const fromLane = laneByNode.get(edge.from) ?? 0
    const toLane = laneByNode.get(edge.to) ?? 0
    const sourcePos = positions.get(edge.from)
    const targetPos = positions.get(edge.to)
    if (!sourcePos || !targetPos) return
    const sourceSize = nodeSizes.get(edge.from) || NODE_SIZES.standard
    const targetSize = nodeSizes.get(edge.to) || NODE_SIZES.standard
    const start = { x: sourcePos.x + sourceSize.width / 2, y: sourcePos.y }
    const end = { x: targetPos.x - targetSize.width / 2, y: targetPos.y }
    const highwayY = sizing.marginY - sizing.backedgeGap - index * sizing.backedgeSpacing
    backedgeTrackYs.push(highwayY)
    const leftX = safeBeforeLane(toLane)
    const rightX = safeAfterLane(fromLane)
    const points = [
      start,
      { x: start.x + sizing.outPad, y: start.y },
      { x: rightX, y: start.y },
      { x: rightX, y: highwayY },
      { x: leftX, y: highwayY },
      { x: leftX, y: end.y },
      { x: end.x - sizing.inPad, y: end.y },
      end,
    ]
    const simplified = simplifyPoints(points)
    edgeVertices.set(edge.id, simplified.length > 2 ? simplified.slice(1, -1) : [])
    edgePolylines.set(edge.id, simplified)
  })

  const allPoints: Point[] = []
  positions.forEach((pos, id) => {
    const size = nodeSizes.get(id)
    if (!size) return
    allPoints.push({ x: pos.x - size.width / 2, y: pos.y - size.height / 2 })
    allPoints.push({ x: pos.x + size.width / 2, y: pos.y + size.height / 2 })
  })
  edgePolylines.forEach((points) => {
    allPoints.push(...points)
  })
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  allPoints.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    minX = sizing.marginX
    minY = sizing.marginY
    maxX = sizing.marginX + sizing.laneWidth
    maxY = sizing.marginY + sizing.rowHeight
  }

  let maxEdgeLength = 0
  edgePolylines.forEach((points) => {
    maxEdgeLength = Math.max(maxEdgeLength, polylineLength(points))
  })

  const laneBoundaries = Array.from({ length: Math.max(0, maxLane) }, (_, index) =>
    boundaryAfterLane(index)
  )
  const channelBands = laneBoundaries.map((x) => ({ x, width: sizing.channelPad * 2 }))

  return {
    layout: {
      positions,
      edgeVertices,
      edgePorts,
      portsByNode,
      bounds: { minX, minY, maxX, maxY },
      debug: {
        laneBoundaries,
        channelBands,
        forwardTrackYs: Array.from(forwardTrackYs).sort((a, b) => a - b),
        sameLaneTrackYs: Array.from(sameLaneTrackYs).sort((a, b) => a - b),
        backedgeTrackYs,
      },
    },
    edgePolylines,
    maxEdgeLength,
  }
}

function computeOpsLayout(nodes: GraphNodeSpec[], edges: GraphEdgeSpec[]): OpsLayout {
  const attempts = [
    { laneScale: 1, rowScale: 1, trackDelta: 0 },
    { laneScale: 1.15, rowScale: 1.1, trackDelta: 6 },
    { laneScale: 1.3, rowScale: 1.2, trackDelta: 10 },
  ]
  let lastLayout: OpsLayout | null = null
  let lastIntersections = 0

  for (const attempt of attempts) {
    const sizing: LayoutSizing = {
      ...BASE_LAYOUT,
      laneWidth: BASE_LAYOUT.laneWidth * attempt.laneScale,
      rowHeight: BASE_LAYOUT.rowHeight * attempt.rowScale,
      trackSpacing: BASE_LAYOUT.trackSpacing + attempt.trackDelta,
      localTrackSpacing: BASE_LAYOUT.localTrackSpacing + attempt.trackDelta,
    }
    const result = computeOpsLayoutWithSizing(nodes, edges, sizing)
    const intersections = countEdgeIntersections(result.edgePolylines)
    lastLayout = result.layout
    lastIntersections = intersections
    if (result.maxEdgeLength > MAX_EDGE_LENGTH) {
      console.warn("[ops-graph] edge length outlier", { maxEdgeLength: result.maxEdgeLength })
    }
    if (intersections <= MAX_INTERSECTIONS) return result.layout
  }

  if (lastLayout && lastIntersections > MAX_INTERSECTIONS) {
    console.warn("[ops-graph] intersections remain high", { intersections: lastIntersections })
    return lastLayout
  }

  return (
    lastLayout || {
      positions: new Map(),
      edgeVertices: new Map(),
      edgePorts: new Map(),
      portsByNode: new Map(),
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    }
  )
}

function addDebugOverlay(graph: Graph, layout: OpsLayout) {
  const debug = layout.debug
  if (!debug) return
  const { minX, minY, maxX, maxY } = layout.bounds
  const padding = 80
  const x1 = minX - padding
  const x2 = maxX + padding
  const y1 = minY - padding
  const y2 = maxY + padding
  const height = y2 - y1

  debug.channelBands.forEach((band, index) => {
    graph.addNode({
      id: `debug/channel-${index}`,
      shape: "rect",
      x: band.x - band.width / 2,
      y: y1,
      width: band.width,
      height,
      attrs: {
        body: { fill: "#f8fafc", stroke: "transparent", opacity: 0.55 },
      },
      zIndex: 0,
      data: { debug: true },
    })
  })

  debug.laneBoundaries.forEach((x, index) => {
    graph.addEdge({
      id: `debug/boundary-${index}`,
      source: { x, y: y1 },
      target: { x, y: y2 },
      attrs: { line: { stroke: "#cbd5f5", strokeWidth: 1, strokeDasharray: "4 6" } },
      zIndex: 0,
      data: { debug: true },
    })
  })

  debug.forwardTrackYs.forEach((y, index) => {
    graph.addEdge({
      id: `debug/track-forward-${index}`,
      source: { x: x1, y },
      target: { x: x2, y },
      attrs: { line: { stroke: "#e2e8f0", strokeWidth: 1, strokeDasharray: "6 8" } },
      zIndex: 0,
      data: { debug: true },
    })
  })

  debug.sameLaneTrackYs.forEach((y, index) => {
    graph.addEdge({
      id: `debug/track-same-${index}`,
      source: { x: x1, y },
      target: { x: x2, y },
      attrs: { line: { stroke: "#fde68a", strokeWidth: 1, strokeDasharray: "2 6" } },
      zIndex: 0,
      data: { debug: true },
    })
  })

  debug.backedgeTrackYs.forEach((y, index) => {
    graph.addEdge({
      id: `debug/track-back-${index}`,
      source: { x: x1, y },
      target: { x: x2, y },
      attrs: { line: { stroke: "#fdba74", strokeWidth: 1, strokeDasharray: "8 6" } },
      zIndex: 0,
      data: { debug: true },
    })
  })
}

type PersistedLayout = {
  version: 1
  positions: Record<string, Point>
  edgeVertices: Record<string, Point[]>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`
}

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function loadLayoutFromStorage(
  key: string,
  nodes: GraphNodeSpec[],
  edges: GraphEdgeSpec[]
): OpsLayout | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedLayout
    if (parsed.version !== 1) return null
    const positions = new Map<string, Point>()
    Object.entries(parsed.positions || {}).forEach(([id, point]) => {
      if (typeof point?.x !== "number" || typeof point?.y !== "number") return
      positions.set(id, { x: point.x, y: point.y })
    })
    if (nodes.some((node) => !positions.has(node.id))) return null
    const edgeVertices = new Map<string, Point[]>()
    Object.entries(parsed.edgeVertices || {}).forEach(([id, points]) => {
      if (!Array.isArray(points)) return
      edgeVertices.set(
        id,
        points.filter((point) => typeof point?.x === "number" && typeof point?.y === "number")
      )
    })
    const bounds = parsed.bounds
    if (
      !bounds ||
      typeof bounds.minX !== "number" ||
      typeof bounds.minY !== "number" ||
      typeof bounds.maxX !== "number" ||
      typeof bounds.maxY !== "number"
    ) {
      return null
    }
    const { portsByNode, edgePorts } = buildFixedPorts(nodes, edges)
    return { positions, edgeVertices, edgePorts, portsByNode, bounds }
  } catch (error) {
    console.warn("[ops-graph] failed to load cached layout", error)
    return null
  }
}

function saveLayoutToStorage(key: string, layout: OpsLayout) {
  if (typeof window === "undefined") return
  const positions: Record<string, Point> = {}
  layout.positions.forEach((pos, id) => {
    positions[id] = { x: pos.x, y: pos.y }
  })
  const edgeVertices: Record<string, Point[]> = {}
  layout.edgeVertices.forEach((points, id) => {
    edgeVertices[id] = points.map((point) => ({ x: point.x, y: point.y }))
  })
  const payload: PersistedLayout = {
    version: 1,
    positions,
    edgeVertices,
    bounds: layout.bounds,
  }
  window.localStorage.setItem(key, JSON.stringify(payload))
}

function resolveEdgeLabel(edge: GraphEdgeSpec) {
  const kind = edge.kind.toLowerCase()
  if (edge.labelMode === "none") return ""
  if (edge.labelMode === "always") {
    return edge.label ? edge.label.toUpperCase() : kind.toUpperCase()
  }
  if (edge.label) return edge.label.toUpperCase()
  if (["read", "write", "call", "event", "trigger"].includes(kind)) {
    return kind.toUpperCase()
  }
  return ""
}

function shouldShowEdgeLabel(
  edgeData: { labelText?: string; labelMode?: string; core?: boolean },
  zoom: number
) {
  if (!edgeData.labelText) return false
  if (zoom >= 1.1) return true
  if (zoom >= 0.85) return edgeData.labelMode === "always" || edgeData.core
  return edgeData.labelMode === "always" && edgeData.core
}

function resolveRateLabel(kindCounts: Record<string, number>) {
  const entries = Object.entries(kindCounts)
  entries.sort((a, b) => b[1] - a[1])
  const top = entries[0]?.[0] || "events"
  if (top === "read") return "reads"
  if (top === "write") return "writes"
  if (top === "call") return "calls"
  if (top === "trigger") return "triggers"
  if (top === "event") return "events"
  return "events"
}

function applyNodeMetrics(
  graph: Graph,
  nodeSpecs: GraphNodeSpec[],
  stats: ComputedStats,
  zoom: number,
  tvMode = false
) {
  const now = Date.now()
  graph.batchUpdate(() => {
    nodeSpecs.forEach((node) => {
      const cell = graph.getCellById(node.id)
      if (!cell || !cell.isNode()) return
      const entry = stats.nodeStats.get(node.id)
      const lastSeen = entry?.lastSeen ?? null
      const age = lastSeen ? now - lastSeen : null
      const errorRate =
        entry && entry.totalCount > 0 ? (entry.errorCount / entry.totalCount) * 100 : null
      const status = errorRate && errorRate > 1 ? "error" : age !== null && age < 90_000 ? "active" : "idle"
      const rate =
        entry && entry.rateCount > 0 ? (entry.rateCount / RATE_WINDOW_MS) * 60_000 : null
      const p95 = entry ? percentile(entry.durations, 0.95) : null
      const rateLabel = entry ? resolveRateLabel(entry.kindCounts) : "events"
      const next = {
        label: node.label,
        category: node.category,
        status,
        lastSeenMs: age,
        ratePerMin: rate,
        rateLabel,
        p95Ms: p95,
        errorRate,
        zoom,
        tvMode,
      }
      cell.setData({ ...(cell.getData() || {}), ...next })
    })
  })
}

export default function OpsGraphX6Page() {
  ensureX6Shapes()

  const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
  const eventsUrl = useMemo(() => {
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/ops/events?tail=300`
  }, [base])

  const { events, status, error, connectedAt } = usePipelineEvents(eventsUrl)
  const [layoutPending, setLayoutPending] = useState(false)
  const [opsLayout, setOpsLayout] = useState<OpsLayout | null>(null)
  const [freezeLive, setFreezeLive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)
  const forceRecomputeRef = useRef(false)

  const observedProviderKey = useMemo(() => {
    const ids = new Set<string>()
    events.forEach((event) => {
      collectProviderKeys(event).forEach((id) => ids.add(id))
    })
    return Array.from(ids).sort((a, b) => a.localeCompare(b)).join("|")
  }, [events])

  const observedProviderIds = useMemo(
    () => (observedProviderKey ? observedProviderKey.split("|") : []),
    [observedProviderKey]
  )

  const observedBotEngineKey = useMemo(() => {
    const ids = new Set<string>()
    events.forEach((event) => {
      collectBotEngineKeys(event).forEach((id) => ids.add(id))
    })
    return Array.from(ids).sort((a, b) => a.localeCompare(b)).join("|")
  }, [events])

  const observedBotEngineIds = useMemo(
    () => (observedBotEngineKey ? observedBotEngineKey.split("|") : []),
    [observedBotEngineKey]
  )

  const baseNodes = useMemo(() => graphSpec.nodes as GraphNodeSpec[], [])
  const baseEdges = useMemo(() => graphSpec.edges as GraphEdgeSpec[], [])

  const nodeSpecsBase = useMemo<GraphNodeSpec[]>(() => {
    const existing = new Set(baseNodes.map((node) => node.id))
    const dynamicProviders = observedProviderIds.filter(
      (id) => !existing.has(id) && id !== "provider:unknown"
    )
    const providerExtras = dynamicProviders.map((id, index) => ({
      id,
      label: id.replace("provider:", "").toUpperCase(),
      x: 0,
      y: 0,
      category: "provider",
      lane: 0,
      orderHint: 10 + index,
      core: false,
    }))

    const dynamicBots = observedBotEngineIds.filter(
      (id) => !existing.has(id) && id !== "bot_engine:unknown"
    )
    const botExtras = dynamicBots.map((id, index) => ({
      id,
      label: id.replace("bot_engine:", "").toUpperCase(),
      x: 0,
      y: 0,
      category: "bot",
      lane: 6,
      orderHint: 10 + index,
      core: false,
    }))

    return [...baseNodes, ...providerExtras, ...botExtras]
  }, [baseNodes, observedProviderIds, observedBotEngineIds])

  const edgeSpecsBase = useMemo<GraphEdgeSpec[]>(() => {
    const edges: GraphEdgeSpec[] = [...baseEdges]
    const existing = new Set(edges.map((edge) => edge.id))

    observedProviderIds.forEach((id) => {
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

    observedBotEngineIds.forEach((id) => {
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

    return edges
  }, [baseEdges, observedProviderIds, observedBotEngineIds])

  const structuralGraph = useMemo(
    () => buildStructuralGraph(nodeSpecsBase, edgeSpecsBase),
    [nodeSpecsBase, edgeSpecsBase]
  )
  const nodeSpecs = useMemo<GraphNodeSpec[]>(
    () => structuralGraph.nodes.map((node) => ({ ...node })),
    [structuralGraph]
  )
  const edgeSpecs = useMemo<GraphEdgeSpec[]>(
    () =>
      structuralGraph.edges.map((edge) => ({
        ...edge,
        logicalId: edge.logicalId || edge.id,
      })),
    [structuralGraph]
  )
  const edgeAliases = useMemo(() => structuralGraph.edgeAliases, [structuralGraph])

  const topologySignature = useMemo(() => {
    const nodeIds = nodeSpecs.map((node) => node.id).join("|")
    const edgeIds = edgeSpecs.map((edge) => edge.id).join("|")
    return `${nodeIds}::${edgeIds}`
  }, [nodeSpecs, edgeSpecs])

  const edgeById = useMemo(() => new Map(edgeSpecs.map((edge) => [edge.id, edge])), [edgeSpecs])
  const stats = useMemo(() => computeStats(events, edgeById, edgeAliases), [events, edgeById, edgeAliases])

  const pageRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const nodeRef = useRef<Map<string, Node>>(new Map())
  const edgeRef = useRef<Map<string, Edge>>(new Map())
  const edgeSpecsRef = useRef(edgeSpecs)
  const edgeAliasesRef = useRef(edgeAliases)
  const zoomRef = useRef(1)
  const freezeRef = useRef(false)
  const tvModeRef = useRef(false)
  const pulseRef = useRef<Map<string, number>>(new Map())
  const errorRef = useRef<Map<string, number>>(new Map())
  const rafRef = useRef<number | null>(null)
  const statsRef = useRef(stats)
  const nodeSpecsRef = useRef(nodeSpecs)
  const eventsRef = useRef<PipelineEvent[]>(events)
  const layoutRef = useRef<OpsLayout | null>(opsLayout)
  const initialViewAppliedRef = useRef(false)
  const processedEventsRef = useRef<Set<string>>(new Set())
  const pendingEventsRef = useRef<PipelineEvent[]>([])
  const flushRef = useRef<number | null>(null)

  useEffect(() => {
    nodeSpecsRef.current = nodeSpecs
  }, [nodeSpecs])

  useEffect(() => {
    edgeSpecsRef.current = edgeSpecs
  }, [edgeSpecs])

  useEffect(() => {
    edgeAliasesRef.current = edgeAliases
  }, [edgeAliases])

  useEffect(() => {
    if (!freezeLive) statsRef.current = stats
  }, [stats, freezeLive])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    layoutRef.current = opsLayout
  }, [opsLayout])

  useEffect(() => {
    initialViewAppliedRef.current = false
  }, [topologySignature, layoutTick])

  const getLayoutBounds = useCallback(() => {
    const layout = layoutRef.current
    if (!layout) return null
    const { minX, minY, maxX, maxY } = layout.bounds
    const width = maxX - minX
    const height = maxY - minY
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null
    }
    return { x: minX, y: minY, width, height }
  }, [])

  const applyEdgeLabels = useCallback((zoom: number, isTvMode = false) => {
    const graph = graphRef.current
    if (!graph) return
    graph.batchUpdate(() => {
      edgeRef.current.forEach((edge) => {
        const data = edge.getData() as
          | {
              labelText?: string
              labelMode?: string
              core?: boolean
              labelOffset?: number
              baseWidth?: number
            }
          | undefined

        // TV Mode: thicker edges for visibility
        if (isTvMode) {
          const baseWidth = data?.baseWidth ?? 1.2
          edge.attr("line/strokeWidth", baseWidth * 2.5)
          edge.attr("line/strokeOpacity", 0.85)
        } else {
          const baseWidth = data?.baseWidth ?? 1.2
          edge.attr("line/strokeWidth", baseWidth)
          edge.attr("line/strokeOpacity", 0.55)
        }

        if (!data?.labelText || !shouldShowEdgeLabel(data, zoom)) {
          edge.setLabels([])
          return
        }
        edge.setLabels([
          {
            attrs: {
              label: { 
                text: data.labelText,
                // TV: larger, bolder labels
                fontSize: isTvMode ? 16 : 11,
                fontWeight: isTvMode ? 700 : 400,
                fontFamily: isTvMode ? "Arial, Helvetica, sans-serif" : undefined,
                fill: isTvMode ? "#000000" : "#374151",
              },
              body: { 
                fill: "#ffffff", 
                stroke: isTvMode ? "#374151" : "#e2e8f0",
                strokeWidth: isTvMode ? 2 : 1,
                rx: 4, 
                ry: 4,
              },
            },
            position: {
              distance: 0.6,
              offset: data.labelOffset ?? 12,
            },
          },
        ])
      })
    })
  }, [])

  const buildGraph = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const layout = layoutRef.current
    if (!layout) return
    const nodes = nodeSpecsRef.current
    const edges = edgeSpecsRef.current
    const positions = layout.positions
    const edgeVertices = layout.edgeVertices
    const edgePorts = layout.edgePorts
    const portsByNode = layout.portsByNode
    graph.batchUpdate(() => {
      graph.clearCells()
      nodeRef.current.clear()
      edgeRef.current.clear()

      nodes.forEach((node) => {
        const size = getNodeDimensions(node)
        const pos = positions.get(node.id) || { x: node.x, y: node.y }
        const shape = node.role === "bus" ? "ops-bus" : "ops-node"
        const ports = portsByNode.get(node.id) || {
          inPorts: [`${node.id}:in:0`],
          outPorts: [`${node.id}:out:0`],
        }
        const cell = graph.addNode({
          id: node.id,
          shape,
          width: size.width,
          height: size.height,
          x: pos.x - size.width / 2,
          y: pos.y - size.height / 2,
          ports: {
            groups: {
              in: {
                position: { name: "left" },
                attrs: {
                  circle: {
                    r: 2,
                    magnet: true,
                    stroke: "transparent",
                    fill: "transparent",
                  },
                },
              },
              out: {
                position: { name: "right" },
                attrs: {
                  circle: {
                    r: 2,
                    magnet: true,
                    stroke: "transparent",
                    fill: "transparent",
                  },
                },
              },
            },
            items: [
              ...ports.inPorts.map((id) => ({ id, group: "in" })),
              ...ports.outPorts.map((id) => ({ id, group: "out" })),
            ],
          },
          data: {
            label: node.label,
            category: node.category,
            status: "idle",
            lastSeenMs: null,
            ratePerMin: null,
            rateLabel: "events",
            p95Ms: null,
            errorRate: null,
            zoom: zoomRef.current,
          },
          zIndex: node.role === "bus" ? 0 : 2,
        })
        nodeRef.current.set(node.id, cell)
      })

      edges.forEach((edge) => {
        const edgeKind = edge.kind.toLowerCase()
        const color = EDGE_COLORS[edgeKind] || "#94a3b8"
        const baseWidth = edge.core ? 1.8 : 1.2
        const labelText = resolveEdgeLabel(edge)
        const labelOffset = LABEL_OFFSETS[edgeKind] ?? 12
        const ports = edgePorts.get(edge.id)
        const vertices = edgeVertices.get(edge.id) || []
        const cell = graph.addEdge({
          id: edge.id,
          source: ports ? { cell: edge.from, port: ports.sourcePort } : { cell: edge.from },
          target: ports ? { cell: edge.to, port: ports.targetPort } : { cell: edge.to },
          vertices,
          router: { name: "normal" },
          connector: { name: "rounded" },
          attrs: {
            line: {
              stroke: color,
              strokeWidth: baseWidth,
              strokeOpacity: 0.55,
              targetMarker: { name: "classic", size: 6 },
              strokeDasharray:
                edgeKind === "call"
                  ? "6 6"
                  : edgeKind === "event"
                    ? "4 6"
                    : edgeKind === "trigger"
                      ? "8 6"
                      : "0",
            },
          },
          labels: [],
          data: {
            kind: edgeKind,
            color,
            baseWidth,
            labelText,
            labelMode: edge.labelMode ?? "auto",
            core: edge.core ?? false,
            labelOffset,
          },
          zIndex: 1,
        })
        cell.setVertices(vertices)
        edgeRef.current.set(edge.id, cell)
      })

      if (showDebug) {
        addDebugOverlay(graph, layout)
      }
    })

    applyNodeMetrics(graph, nodes, statsRef.current, zoomRef.current, tvModeRef.current)
    applyEdgeLabels(zoomRef.current, tvModeRef.current)
    processedEventsRef.current.clear()
    eventsRef.current.forEach((event) => {
      processedEventsRef.current.add(getEventKey(event))
    })
  }, [applyEdgeLabels, showDebug])

  useEffect(() => {
    if (!containerRef.current || graphRef.current) return
    const graph = new Graph({
      container: containerRef.current,
      background: { color: "#ffffff" },
      autoResize: true,
      grid: false,
      panning: true,
      mousewheel: {
        enabled: true,
        modifiers: ["ctrl", "meta"],
        minScale: 0.35,
        maxScale: 2.2,
      },
      interacting: {
        nodeMovable: false,
        edgeMovable: false,
        edgeLabelMovable: false,
        arrowheadMovable: false,
      },
    })
    graphRef.current = graph

    graph.on("scale", ({ sx }) => {
      if (Math.abs(sx - zoomRef.current) < 0.02) return
      zoomRef.current = sx
      applyNodeMetrics(graph, nodeSpecsRef.current, statsRef.current, zoomRef.current, tvModeRef.current)
      applyEdgeLabels(sx, tvModeRef.current)
    })

    buildGraph()

    return () => {
      graph.dispose()
      graphRef.current = null
    }
  }, [applyEdgeLabels, buildGraph])

  useEffect(() => {
    if (!graphRef.current || !layoutRef.current) return
    buildGraph()
    const graph = graphRef.current
    if (!graph || initialViewAppliedRef.current) return
    const bounds = getLayoutBounds()
    if (bounds) {
      graph.zoomToFit({ padding: 60, maxScale: 1, contentArea: bounds })
    } else {
      graph.centerContent()
    }
    initialViewAppliedRef.current = true
  }, [buildGraph, opsLayout, topologySignature, getLayoutBounds])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    if (freezeLive) return
    applyNodeMetrics(graph, nodeSpecs, statsRef.current, zoomRef.current, tvModeRef.current)
  }, [stats, nodeSpecs, freezeLive])

  useEffect(() => {
    freezeRef.current = freezeLive
  }, [freezeLive])

  useEffect(() => {
    tvModeRef.current = tvMode
    // Update node metrics and edge styling when TV mode changes
    const graph = graphRef.current
    if (graph) {
      // When entering TV mode, zoom to 180% for better visibility on large screens
      if (tvMode) {
        const targetZoom = 1.8
        graph.zoomTo(targetZoom)
        zoomRef.current = targetZoom
        applyNodeMetrics(graph, nodeSpecsRef.current, statsRef.current, targetZoom, tvMode)
        applyEdgeLabels(targetZoom, tvMode)
      } else {
        // When exiting TV mode, fit the view
        const bounds = getLayoutBounds()
        if (bounds) {
          graph.zoomToFit({ padding: 60, maxScale: 1, contentArea: bounds })
        }
        const newZoom = graph.zoom()
        zoomRef.current = newZoom
        applyNodeMetrics(graph, nodeSpecsRef.current, statsRef.current, newZoom, tvMode)
        applyEdgeLabels(newZoom, tvMode)
      }
    }
  }, [tvMode, applyEdgeLabels, getLayoutBounds])

  useEffect(() => {
    if (!isFullscreen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [isFullscreen])

  // Trigger graph resize when entering/exiting fullscreen
  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    // Small delay to allow DOM to update before resizing
    const timer = setTimeout(() => {
      graph.resize()
      // Fit the view after resize
      const bounds = getLayoutBounds()
      if (bounds) {
        graph.zoomToFit({ padding: 60, maxScale: 1, contentArea: bounds })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [isFullscreen, getLayoutBounds])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const graph = graphRef.current
      if (!graph) return
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable='true']")) return
      event.preventDefault()
      const step = event.shiftKey ? PAN_STEP_FAST : PAN_STEP
      switch (event.key) {
        case "ArrowLeft":
          graph.translateBy(step, 0)
          break
        case "ArrowRight":
          graph.translateBy(-step, 0)
          break
        case "ArrowUp":
          graph.translateBy(0, step)
          break
        case "ArrowDown":
          graph.translateBy(0, -step)
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  useEffect(() => {
    const tick = () => {
      const graph = graphRef.current
      if (!graph) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const now = Date.now()
      if (!freezeRef.current) {
        pulseRef.current.forEach((value, edgeId) => {
          const edge = edgeRef.current.get(edgeId)
          if (!edge) {
            pulseRef.current.delete(edgeId)
            return
          }
          const next = value * 0.86
          const data = edge.getData() as { color?: string; baseWidth?: number } | undefined
          const baseWidth = data?.baseWidth ?? 1.2
          const color = data?.color ?? "#94a3b8"
          const strokeWidth = baseWidth + next * 3
          const strokeOpacity = 0.25 + next * 0.75
          edge.attr("line/strokeWidth", strokeWidth)
          edge.attr("line/strokeOpacity", strokeOpacity)
          const errorUntil = errorRef.current.get(edgeId)
          if (errorUntil && now <= errorUntil) {
            edge.attr("line/stroke", "#ef4444")
          } else {
            edge.attr("line/stroke", color)
            if (errorUntil) errorRef.current.delete(edgeId)
          }
          if (next < 0.04) {
            pulseRef.current.delete(edgeId)
            edge.attr("line/strokeWidth", baseWidth)
            edge.attr("line/strokeOpacity", 0.55)
          } else {
            pulseRef.current.set(edgeId, next)
          }
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (freezeRef.current) return
    const processed = processedEventsRef.current
    const fresh: PipelineEvent[] = []
    for (const event of events) {
      const key = getEventKey(event)
      if (processed.has(key)) break
      fresh.push(event)
    }
    if (!fresh.length) return
    pendingEventsRef.current.push(...fresh.reverse())
    if (flushRef.current) return
    flushRef.current = requestAnimationFrame(() => {
      const batch = pendingEventsRef.current.splice(0)
      batch.forEach((event) => {
        const edgeIds = Array.from(
          new Set(
            resolveEdgeKeys(event).map(
              (edgeId) => edgeAliasesRef.current?.get(edgeId) || edgeId
            )
          )
        )
        edgeIds.forEach((edgeId) => {
          const current = pulseRef.current.get(edgeId) ?? 0
          pulseRef.current.set(edgeId, Math.min(1, current + 0.65))
          if (event.status === "error") {
            errorRef.current.set(edgeId, Date.now() + ERROR_WINDOW_MS)
          }
        })
      })
      batch.forEach((event) => processed.add(getEventKey(event)))
      if (processed.size > 3000) {
        const trimmed = Array.from(processed).slice(0, 1500)
        processedEventsRef.current = new Set(trimmed)
      }
      flushRef.current = null
    })
  }, [events])

  const handleFitView = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const bounds = getLayoutBounds()
    if (bounds) {
      graph.zoomToFit({ padding: 60, maxScale: 1, contentArea: bounds })
    } else {
      graph.zoomToFit({ padding: 40 })
    }
  }, [getLayoutBounds])

  const handleZoomIn = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const currentZoom = graph.zoom()
    const newZoom = Math.min(currentZoom * 1.25, 3)
    graph.zoomTo(newZoom)
    zoomRef.current = newZoom
    applyNodeMetrics(graph, nodeSpecsRef.current, statsRef.current, newZoom, tvModeRef.current)
    applyEdgeLabels(newZoom, tvModeRef.current)
  }, [applyEdgeLabels])

  const handleZoomOut = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const currentZoom = graph.zoom()
    const newZoom = Math.max(currentZoom * 0.8, 0.25)
    graph.zoomTo(newZoom)
    zoomRef.current = newZoom
    applyNodeMetrics(graph, nodeSpecsRef.current, statsRef.current, newZoom, tvModeRef.current)
    applyEdgeLabels(newZoom, tvModeRef.current)
  }, [applyEdgeLabels])

  const handleZoomTo = useCallback((targetZoom: number) => {
    const graph = graphRef.current
    if (!graph) return
    graph.zoomTo(targetZoom)
    zoomRef.current = targetZoom
    applyNodeMetrics(graph, nodeSpecsRef.current, statsRef.current, targetZoom, tvModeRef.current)
    applyEdgeLabels(targetZoom, tvModeRef.current)
  }, [applyEdgeLabels])

  const handleResetView = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const bounds = getLayoutBounds()
    if (bounds) {
      graph.zoomToFit({ padding: 60, maxScale: 1, contentArea: bounds })
      return
    }
    graph.zoom(1)
    graph.translate(0, 0)
  }, [getLayoutBounds])

  const layoutConfigSignature = useMemo(
    () =>
      stableStringify({
        laneByNodeId: layoutConfig.laneByNodeId || {},
        hiddenNodes: layoutConfig.hiddenNodes || [],
        pinnedOrder: layoutConfig.pinnedOrder || {},
      }),
    []
  )

  const layoutKey = useMemo(
    () => `${LAYOUT_CACHE_PREFIX}${hashString(`${layoutConfigSignature}|${topologySignature}`)}`,
    [layoutConfigSignature, topologySignature]
  )

  useEffect(() => {
    let cancelled = false
    const run = () => {
      setLayoutPending(true)
      const allowCache = !forceRecomputeRef.current
      const cached = allowCache ? loadLayoutFromStorage(layoutKey, nodeSpecs, edgeSpecs) : null
      forceRecomputeRef.current = false
      if (cached) {
        if (!cancelled) {
          setOpsLayout(cached)
          setLayoutPending(false)
        }
        return
      }
      const next = computeOpsLayout(nodeSpecs, edgeSpecs)
      if (!cancelled) {
        setOpsLayout(next)
        saveLayoutToStorage(layoutKey, next)
        setLayoutPending(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [layoutKey, nodeSpecs, edgeSpecs, layoutTick])

  const handleRecomputeLayout = useCallback(() => {
    forceRecomputeRef.current = true
    setLayoutTick((prev) => prev + 1)
  }, [])

  const handleDebugLayout = useCallback(() => {
    setShowDebug((prev) => !prev)
    const layout = layoutRef.current
    if (!layout) {
      console.warn("Layout not ready.")
      return
    }
    const { minX, minY, maxX, maxY } = layout.bounds
    console.info("[OpsGraph] nodes:", nodeSpecs.length, "edges:", edgeSpecs.length)
    console.info("[OpsGraph] bounds:", { minX, minY, maxX, maxY })
  }, [edgeSpecs.length, nodeSpecs.length])

  const statusBadge =
    status === "live"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "error"
          ? "Error"
          : "Idle"

  return (
    <div
      ref={pageRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen bg-white"
          : "flex min-h-svh flex-col gap-4 px-6 py-6"
      }
    >
      {/* Fullscreen floating controls */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
          <PipelineHealthBadge showLabel size="md" />
          <Badge
            variant={status === "live" ? "default" : status === "error" ? "destructive" : "outline"}
            className="bg-white/90 backdrop-blur-sm text-base px-3 py-1"
          >
            {statusBadge}
          </Badge>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-lg bg-white/95 backdrop-blur-sm shadow-md p-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-xl font-bold"
              onClick={handleZoomOut}
              title="Zoom out"
            >
              −
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-sm font-medium"
              onClick={() => handleZoomTo(1)}
              title="100% zoom"
            >
              100%
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-sm font-medium"
              onClick={() => handleZoomTo(1.5)}
              title="150% zoom"
            >
              150%
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-sm font-bold text-blue-600"
              onClick={() => handleZoomTo(2)}
              title="200% zoom - recommended for TV"
            >
              200%
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-xl font-bold"
              onClick={handleZoomIn}
              title="Zoom in"
            >
              +
            </Button>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="bg-white/95 backdrop-blur-sm shadow-md h-9 px-4 text-sm"
            onClick={handleFitView}
          >
            Fit
          </Button>
          <Button
            size="sm"
            variant={tvMode ? "default" : "secondary"}
            className={tvMode 
              ? "shadow-md h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700" 
              : "bg-white/95 backdrop-blur-sm shadow-md h-9 px-4 text-sm"
            }
            onClick={() => setTvMode((prev) => !prev)}
            title="TV Mode - larger text and auto-zoom for big screens"
          >
            📺 TV Mode
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/95 backdrop-blur-sm shadow-md h-9 px-4 text-sm"
            onClick={() => setIsFullscreen(false)}
          >
            ✕ Exit
          </Button>
        </div>
      )}

      {/* Normal mode header and controls */}
      {!isFullscreen && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold">Ops Graph</h1>
              <p className="text-sm text-muted-foreground">
                Diagram-grade pipeline map with live metrics and orthogonal routing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PipelineHealthBadge showLabel />
              <Badge variant="outline">{statusBadge}</Badge>
              {connectedAt ? (
                <Badge variant="secondary">Connected {connectedAt.toLocaleTimeString()}</Badge>
              ) : null}
              {error ? <Badge variant="destructive">{error}</Badge> : null}
            </div>
          </header>

          {/* Pipeline Health Panel */}
          <PipelineHealthPanel defaultExpanded={false} />

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleResetView}>
              Reset
            </Button>
            <Button size="sm" variant="secondary" onClick={handleFitView}>
              Fit
            </Button>
            <Button size="sm" variant="secondary" onClick={handleRecomputeLayout} disabled={layoutPending}>
              {layoutPending ? "Recomputing..." : "Recompute Layout"}
            </Button>
            <Button
              size="sm"
              variant={showDebug ? "default" : "secondary"}
              onClick={handleDebugLayout}
            >
              {showDebug ? "Hide Debug Overlay" : "Debug Overlay"}
            </Button>
            <Button
              size="sm"
              variant={freezeLive ? "default" : "secondary"}
              onClick={() => setFreezeLive((prev) => !prev)}
            >
              {freezeLive ? "Resume Live" : "Freeze Live"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setIsFullscreen(true)}>
              Full Screen
            </Button>
          </div>
        </>
      )}

      {/* Graph container - always rendered to preserve the X6 instance */}
      <div
        className={
          isFullscreen
            ? "h-full w-full"
            : "flex-1 min-h-[640px] rounded-2xl border border-border/60 bg-white shadow-sm"
        }
      >
        <div 
          ref={containerRef} 
          data-testid="ops-graph-canvas" 
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
