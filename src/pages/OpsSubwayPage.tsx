import { useCallback, useMemo, useState } from "react"
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
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
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { PipelineEvent } from "@/lib/types"
import subwaySpec from "@/ops/subway_map_spec.json"
import { usePipelineEvents } from "@/features/ops/use-pipeline-events"
import "@/features/ops/reactflow-dev-warnings"

const LINE_COLORS: Record<string, string> = {
  core: "#0ea5e9",
  bots: "#22c55e",
  providers: "#f97316",
  charts: "#38bdf8",
}

const CATEGORY_COLORS: Record<string, string> = {
  store: "#38bdf8",
  compute: "#818cf8",
  queue: "#f59e0b",
  bot: "#22c55e",
  score: "#d946ef",
  ui: "#94a3b8",
  provider: "#f97316",
  gateway: "#22d3ee",
  chart: "#38bdf8",
  unknown: "#94a3b8",
}

const CATEGORY_STYLES: Record<string, string> = {
  store: "bg-sky-50/90 text-sky-900 ring-sky-200",
  compute: "bg-indigo-50/90 text-indigo-900 ring-indigo-200",
  queue: "bg-amber-50/90 text-amber-900 ring-amber-200",
  bot: "bg-emerald-50/90 text-emerald-900 ring-emerald-200",
  score: "bg-fuchsia-50/90 text-fuchsia-900 ring-fuchsia-200",
  ui: "bg-slate-50/90 text-slate-900 ring-slate-200",
  provider: "bg-orange-50/90 text-orange-900 ring-orange-200",
  gateway: "bg-cyan-50/90 text-cyan-900 ring-cyan-200",
  chart: "bg-sky-100/80 text-sky-900 ring-sky-200",
  unknown: "bg-slate-100/80 text-slate-900 ring-slate-200",
}

const STATUS_STYLES: Record<string, string> = {
  idle: "opacity-70",
  active: "ring-2 ring-primary/60 shadow-[0_0_18px_rgba(56,189,248,0.35)]",
  ok: "ring-1 ring-emerald-400/50",
  error: "ring-2 ring-rose-500/60 shadow-[0_0_18px_rgba(244,63,94,0.3)]",
}

const ICONS: Record<string, typeof Activity> = {
  store: Database,
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

type StationSpec = {
  id: string
  label: string
  x: number
  y: number
  category: string
  core?: boolean
}

type EdgeSpec = {
  from: string
  to: string
  lineId: string
}

type StationState = {
  status: "idle" | "active" | "ok" | "error"
  updatedAt: number | null
  lastEvent?: PipelineEvent
  errorCount: number
  avgDuration: number | null
  durationSum: number
  durationCount: number
}

type BatchState = {
  batchId: string
  lastStationId: string
  prevStationId?: string
  updatedAt: number
  status: string
}

type ProviderStat = {
  id: string
  label: string
  lastEvent?: PipelineEvent
  lastSeen: number | null
  errorCount: number
  avgDuration: number | null
  durationSum: number
  durationCount: number
  cacheHits: number
  requestCount: number
  lastHttpStatus: number | null
}

type SymbolSummary = {
  symbolKey: string
  lastEventAt: number
  lastStationId: string
  origins: string[]
  action?: string | null
  score?: number | null
}

type TrainNodeData = {
  batchId: string
  status: string
  updatedAt: number
  label: string
}

type StationNodeData = {
  label: string
  category: string
  status: StationState["status"]
  updatedAt: number | null
  lastEvent?: PipelineEvent
  errorCount: number
  avgDuration: number | null
  core?: boolean
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

function StationNode({ data }: NodeProps<StationNodeData>) {
  const Icon = ICONS[data.category] || Activity
  const statusLabel =
    data.status === "error"
      ? "Error"
      : data.status === "active"
        ? "Active"
        : data.status === "ok"
          ? "Done"
          : "Idle"
  const lastEvent = data.lastEvent
  const timestamp = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "-"
  const handleClass = "h-2 w-2 rounded-full border-0 bg-transparent opacity-0"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative flex min-w-[170px] items-center gap-2 rounded-2xl border border-border/60 px-3 py-2",
              "shadow-sm backdrop-blur-sm",
              CATEGORY_STYLES[data.category] || "bg-white",
              STATUS_STYLES[data.status]
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{data.label}</div>
              <div className="text-xs text-muted-foreground">{statusLabel}</div>
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
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">
          <div className="space-y-1 text-xs">
            <div className="text-sm font-semibold">{data.label}</div>
            <div className="text-muted-foreground">Last update: {timestamp}</div>
            {lastEvent?.service && <div>Service: {lastEvent.service}</div>}
            {data.avgDuration !== null && (
              <div>Avg latency: {data.avgDuration.toFixed(0)} ms</div>
            )}
            {data.errorCount > 0 && <div>Errors: {data.errorCount}</div>}
            {lastEvent?.meta && (
              <div className="line-clamp-3">Meta: {JSON.stringify(lastEvent.meta)}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TrainNode({ data }: NodeProps<TrainNodeData>) {
  const statusColor =
    data.status === "error" ? "bg-rose-500" : data.status === "start" ? "bg-sky-500" : "bg-emerald-500"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-full"
          aria-label={`Batch ${data.label}`}
        >
          <motion.span
            className={cn(
              "absolute h-8 w-8 rounded-full opacity-40",
              statusColor
            )}
            animate={{ scale: [1, 1.4, 1], opacity: [0.35, 0.15, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
          <span
            className={cn(
              "relative z-10 h-3 w-3 rounded-full border border-white",
              statusColor
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="space-y-1 text-xs">
          <div className="text-sm font-semibold">Batch {data.label}</div>
          <div>Status: {data.status}</div>
          <div>Updated: {new Date(data.updatedAt).toLocaleTimeString()}</div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const NODE_TYPES = { station: StationNode, train: TrainNode } as const
const EDGE_TYPES = {} as const

export default function OpsSubwayPage() {
  const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
  const eventsUrl = useMemo(() => {
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/ops/events?tail=200`
  }, [base])

  const { events, status, error, connectedAt } = usePipelineEvents(eventsUrl)
  const nodeTypes = NODE_TYPES
  const edgeTypes = EDGE_TYPES
  const handleFlowError = useCallback((code: string, message: string) => {
    if (code === "002") return
    console.warn(`[React Flow] ${message}`)
  }, [])

  const baseStations = useMemo(() => subwaySpec.stations as StationSpec[], [])
  const baseEdges = useMemo(() => subwaySpec.edges as EdgeSpec[], [])

  const providerIds = useMemo(() => {
    const ids = new Set<string>()
    events.forEach((event) => {
      if (event.stationId?.startsWith("provider:")) ids.add(event.stationId)
    })
    return Array.from(ids)
  }, [events])

  const botEngineIds = useMemo(() => {
    const ids = new Set<string>()
    events.forEach((event) => {
      if (event.stationId?.startsWith("bot_engine:")) ids.add(event.stationId)
    })
    return Array.from(ids)
  }, [events])

  const unknownStationIds = useMemo(() => {
    const ids = new Set<string>()
    const knownIds = new Set(baseStations.map((station) => station.id))
    events.forEach((event) => {
      const stationId = event.stationId
      if (!stationId) return
      if (knownIds.has(stationId)) return
      if (stationId.startsWith("provider:")) return
      if (stationId.startsWith("bot_engine:")) return
      ids.add(stationId)
    })
    return Array.from(ids)
  }, [events, baseStations])

  const stationSpecs = useMemo<StationSpec[]>(() => {
    const existing = new Set(baseStations.map((station) => station.id))
    const baseProvider = baseStations.find((station) => station.id === "provider:unknown")
    const providerBaseX = baseProvider?.x ?? 900
    const providerBaseY = baseProvider?.y ?? 520
    const providerSpacing = 160
    const dynamicProviders = providerIds.filter(
      (id) => !existing.has(id) && id !== "provider:unknown"
    )

    const providerExtras = dynamicProviders.map((id, index) => ({
      id,
      label: id.replace("provider:", "").toUpperCase(),
      x: providerBaseX + providerSpacing * (index + 1),
      y: providerBaseY,
      category: "provider",
      core: false,
    }))

    const baseBot = baseStations.find((station) => station.id === "bot_engine:unknown")
    const botBaseX = baseBot?.x ?? 1560
    const botBaseY = baseBot?.y ?? 320
    const botSpacing = 160
    const dynamicBots = botEngineIds.filter(
      (id) => !existing.has(id) && id !== "bot_engine:unknown"
    )
    const botExtras = dynamicBots.map((id, index) => ({
      id,
      label: id.replace("bot_engine:", "").toUpperCase(),
      x: botBaseX + botSpacing * (index + 1),
      y: botBaseY,
      category: "bot",
      core: false,
    }))

    const unknownBaseX = 140
    const unknownBaseY = 660
    const unknownSpacingX = 220
    const unknownSpacingY = 110
    const unknownPerRow = 6
    const unknownExtras = unknownStationIds
      .filter((id) => !existing.has(id))
      .map((id, index) => ({
        id,
        label: id.replace(/[:_]/g, " "),
        x: unknownBaseX + (index % unknownPerRow) * unknownSpacingX,
        y: unknownBaseY + Math.floor(index / unknownPerRow) * unknownSpacingY,
        category: "unknown",
        core: false,
      }))

    return [...baseStations, ...providerExtras, ...botExtras, ...unknownExtras]
  }, [baseStations, providerIds, botEngineIds, unknownStationIds])

  const edgeSpecs = useMemo<EdgeSpec[]>(() => {
    const existingTargets = new Set(baseEdges.map((edge) => edge.to))
    const providerEdges = providerIds
      .filter((id) => !existingTargets.has(id))
      .map((id) => ({ from: "mdg", to: id, lineId: "providers" }))
    const botEdges = botEngineIds
      .filter((id) => !existingTargets.has(id))
      .map((id) => ({ from: "agent", to: id, lineId: "bots" }))
    return [...baseEdges, ...providerEdges, ...botEdges]
  }, [baseEdges, providerIds, botEngineIds])

  const stationLookup = useMemo(() => {
    const map = new Map<string, StationSpec>()
    stationSpecs.forEach((station) => map.set(station.id, station))
    return map
  }, [stationSpecs])

  const stationState = useMemo<Record<string, StationState>>(() => {
    const state: Record<string, StationState> = {}
    const now = Date.now()

    events.forEach((event) => {
      const stationId = event.stationId
      if (!stationId) return
      const ts = Date.parse(event.ts) || now
      const existing = state[stationId]
      const duration = typeof event.durationMs === "number" ? event.durationMs : null

      if (!existing) {
        state[stationId] = {
          status: event.status === "error" ? "error" : event.status === "start" ? "active" : "ok",
          updatedAt: ts,
          lastEvent: event,
          errorCount: event.status === "error" ? 1 : 0,
          avgDuration: duration,
          durationSum: duration ?? 0,
          durationCount: duration ? 1 : 0,
        }
        return
      }

      if (duration !== null) {
        existing.durationSum += duration
        existing.durationCount += 1
        existing.avgDuration = existing.durationSum / existing.durationCount
      }
      if (event.status === "error") existing.errorCount += 1
      if (ts > (existing.updatedAt || 0)) {
        existing.updatedAt = ts
        existing.status = event.status === "error" ? "error" : event.status === "start" ? "active" : "ok"
        existing.lastEvent = event
      }
    })

    if (state.analysis_written && !state.ui_visible) {
      state.ui_visible = {
        status: "ok",
        updatedAt: state.analysis_written.updatedAt,
        lastEvent: state.analysis_written.lastEvent,
        errorCount: 0,
        avgDuration: null,
        durationSum: 0,
        durationCount: 0,
      }
    }

    Object.entries(state).forEach(([, value]) => {
      if (!value.updatedAt) return
      const age = now - value.updatedAt
      if (value.status !== "error" && age < 30000) {
        value.status = "active"
      }
      if (age > 5 * 60 * 1000) {
        value.status = "idle"
      }
    })

    return state
  }, [events])

  const batchStates = useMemo<BatchState[]>(() => {
    const list = [...events].reverse()
    const map = new Map<string, BatchState>()

    list.forEach((event) => {
      const batchId = resolveBatchId(event)
      if (!batchId) return
      const stationId = event.stationId
      if (!stationId || !stationLookup.has(stationId)) return
      const prev = map.get(batchId)
      const ts = Date.parse(event.ts) || Date.now()
      map.set(batchId, {
        batchId,
        lastStationId: stationId,
        prevStationId: prev?.lastStationId,
        updatedAt: ts,
        status: event.status,
      })
    })

    return Array.from(map.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12)
  }, [events, stationLookup])

  const activeEdges = useMemo(() => {
    const set = new Set<string>()
    batchStates.forEach((batch) => {
      if (!batch.prevStationId) return
      set.add(`${batch.prevStationId}-${batch.lastStationId}`)
    })
    return set
  }, [batchStates])

  const nodes = useMemo<Node[]>(() => {
    const stationNodes: Node[] = stationSpecs.map((station) => {
      const state = stationState[station.id]
      return {
        id: station.id,
        type: "station",
        position: { x: station.x, y: station.y },
        data: {
          label: station.label,
          category: station.category,
          status: state?.status ?? "idle",
          updatedAt: state?.updatedAt ?? null,
          lastEvent: state?.lastEvent,
          errorCount: state?.errorCount ?? 0,
          avgDuration: state?.avgDuration ?? null,
          core: station.core,
        },
        draggable: false,
        selectable: true,
      }
    })

    const trainNodes: Node[] = batchStates
      .map((batch, index) => {
        const position = stationLookup.get(batch.lastStationId)
        if (!position) return null
        return {
          id: `train:${batch.batchId}`,
          type: "train",
          position: { x: position.x + 46, y: position.y - 36 - index * 2 },
          data: {
            batchId: batch.batchId,
            status: batch.status,
            updatedAt: batch.updatedAt,
            label: batch.batchId.slice(-6),
          },
          draggable: false,
          selectable: true,
          className: "transition-transform duration-700 ease-out pointer-events-auto",
        }
      })
      .filter(Boolean) as Node[]

    return [...stationNodes, ...trainNodes]
  }, [stationSpecs, stationState, batchStates, stationLookup])

  const edges = useMemo<Edge[]>(() => {
    const pickHandles = (from: string, to: string) => {
      const source = stationLookup.get(from)
      const target = stationLookup.get(to)
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

    return edgeSpecs.map((edge) => {
      const color = LINE_COLORS[edge.lineId] || "#94a3b8"
      const isActive = activeEdges.has(`${edge.from}-${edge.to}`)
      const handles = pickHandles(edge.from, edge.to)
      return {
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: "smoothstep",
        animated: isActive,
        style: {
          stroke: color,
          strokeWidth: edge.lineId === "core" ? 3 : 2,
          opacity: isActive ? 1 : 0.6,
        },
      }
    })
  }, [edgeSpecs, activeEdges, stationLookup])

  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  const selectedBatchEvents = useMemo(() => {
    if (!selectedBatch) return []
    return events.filter((event) => resolveBatchId(event) === selectedBatch).slice(0, 20)
  }, [events, selectedBatch])

  const symbolSummaries = useMemo<SymbolSummary[]>(() => {
    if (!selectedBatch) return []
    const map = new Map<string, SymbolSummary>()
    events.forEach((event) => {
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
        lastStationId: existing?.lastEventAt && existing.lastEventAt > ts
          ? existing.lastStationId
          : event.stationId,
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
  }, [events, selectedBatch])

  const selectedSymbolEvents = useMemo(() => {
    if (!selectedSymbol) return []
    return events
      .filter((event) => {
        if (event.symbolKey !== selectedSymbol) return false
        if (!selectedBatch) return true
        return resolveBatchId(event) === selectedBatch
      })
      .slice(0, 24)
  }, [events, selectedSymbol, selectedBatch])

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
    })
    return {
      buy: summary.buy,
      sell: summary.sell,
      hold: summary.hold,
      total: summary.total,
      engines: Array.from(summary.engines),
      modes: Array.from(summary.modes),
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
    }
  }, [selectedSymbolScoreEvent])

  const selectedSymbolIo = useMemo(() => {
    const inputs = { redisKeys: new Set<string>(), firestoreDocs: new Set<string>() }
    const outputs = { redisKeys: new Set<string>(), firestoreDocs: new Set<string>() }
    selectedSymbolEvents.forEach((event) => {
      event.inputs?.redisKeys?.forEach((key) => inputs.redisKeys.add(key))
      event.inputs?.firestoreDocs?.forEach((doc) => inputs.firestoreDocs.add(doc))
      event.outputs?.redisKeys?.forEach((key) => outputs.redisKeys.add(key))
      event.outputs?.firestoreDocs?.forEach((doc) => outputs.firestoreDocs.add(doc))
    })
    return {
      inputs: {
        redisKeys: Array.from(inputs.redisKeys),
        firestoreDocs: Array.from(inputs.firestoreDocs),
      },
      outputs: {
        redisKeys: Array.from(outputs.redisKeys),
        firestoreDocs: Array.from(outputs.firestoreDocs),
      },
    }
  }, [selectedSymbolEvents])

  const selectedStationEvent = selectedStation ? stationState[selectedStation]?.lastEvent : undefined

  const originBreakdown = useMemo(() => {
    const candidateEvent = events.find(
      (event) => event.stationId === "mi_candidates" && resolveBatchId(event) === selectedBatch
    )
    const meta = candidateEvent?.meta as Record<string, unknown> | undefined
    return meta?.origins && typeof meta.origins === "object" ? (meta.origins as Record<string, number>) : null
  }, [events, selectedBatch])

  const processorList = useMemo(() => {
    const map = new Map<string, PipelineEvent>()
    events.forEach((event) => {
      if (!map.has(event.service)) map.set(event.service, event)
    })
    return Array.from(map.values())
  }, [events])

  const providerStats = useMemo<ProviderStat[]>(() => {
    const map = new Map<string, ProviderStat>()
    events.forEach((event) => {
      const stationId = event.stationId
      if (!stationId?.startsWith("provider:")) return
      const meta = event.meta as Record<string, unknown> | undefined
      const ts = Date.parse(event.ts) || Date.now()
      const existing = map.get(stationId)
      const duration = typeof event.durationMs === "number" ? event.durationMs : null
      const cacheHit = Boolean(meta?.cacheHit)
      const httpStatus =
        typeof meta?.httpStatus === "number"
          ? meta.httpStatus
          : typeof meta?.status === "number"
            ? meta.status
            : null

      if (!existing) {
        map.set(stationId, {
          id: stationId,
          label: stationId.replace("provider:", "").toUpperCase(),
          lastEvent: event,
          lastSeen: ts,
          errorCount: event.status === "error" ? 1 : 0,
          avgDuration: duration,
          durationSum: duration ?? 0,
          durationCount: duration ? 1 : 0,
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
      }
      if (ts > (existing.lastSeen || 0)) {
        existing.lastSeen = ts
        existing.lastEvent = event
        existing.lastHttpStatus = httpStatus
      }
    })

    return Array.from(map.values()).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
  }, [events])

  const bottlenecks = useMemo(() => {
    return Object.entries(stationState)
      .map(([id, state]) => ({
        id,
        label: stationSpecs.find((station) => station.id === id)?.label || id,
        avgDuration: state.avgDuration,
      }))
      .filter((entry) => typeof entry.avgDuration === "number")
      .sort((a, b) => (b.avgDuration ?? 0) - (a.avgDuration ?? 0))
      .slice(0, 5)
  }, [stationState, stationSpecs])

  const recentErrors = useMemo(() => {
    return events.filter((event) => event.status === "error").slice(0, 5)
  }, [events])

  const recentErrorCount = useMemo(() => {
    const now = Date.now()
    return events.filter((event) => {
      if (event.status !== "error") return false
      const ts = Date.parse(event.ts)
      if (!Number.isFinite(ts)) return false
      return now - ts < 5 * 60 * 1000
    }).length
  }, [events])

  const statusBadge =
    status === "live"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "error"
          ? "Error"
          : "Idle"

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Ops Console
            </div>
            <h1 className="text-2xl font-semibold">Pipeline Subway Map</h1>
            <p className="text-sm text-muted-foreground">
              Live batch trains across the trading pipeline, with provenance and provider activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === "error" ? "destructive" : "secondary"}>{statusBadge}</Badge>
            {connectedAt && (
              <Badge variant="outline">Connected {connectedAt.toLocaleTimeString()}</Badge>
            )}
            {recentErrorCount > 0 && (
              <Badge variant="destructive">{recentErrorCount} errors (5m)</Badge>
            )}
            {error && <Badge variant="destructive">{error}</Badge>}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="relative overflow-hidden border-border/60 bg-background/80 p-2">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.12),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(34,197,94,0.1),transparent_55%)]" />
            <div className="relative h-[700px] w-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onError={handleFlowError}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable={false}
                nodesFocusable={false}
                proOptions={{ hideAttribution: true }}
                onNodeClick={(_, node) => {
                  if (node.type === "train") {
                    const batchId = (node.data as TrainNodeData).batchId
                    setSelectedBatch(batchId)
                    setSelectedStation(null)
                    setSelectedSymbol(null)
                    return
                  }
                  if (node.type === "station") {
                    setSelectedStation(node.id)
                    setSelectedBatch(null)
                    setSelectedSymbol(null)
                  }
                }}
              >
                <MiniMap
                  nodeStrokeColor={(node) =>
                    CATEGORY_COLORS[(node.data as StationNodeData)?.category] || "#94a3b8"
                  }
                  nodeColor={(node) =>
                    (node.data as StationNodeData)?.status === "error"
                      ? "#f43f5e"
                      : "#e2e8f0"
                  }
                  maskColor="rgba(15, 23, 42, 0.08)"
                />
                <Controls showInteractive={false} />
                <Background color="#cbd5f5" gap={24} />
              </ReactFlow>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
              {subwaySpec.lines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <span
                    className="h-2 w-6 rounded-full"
                    style={{ backgroundColor: LINE_COLORS[line.id] || "#94a3b8" }}
                  />
                  <span>{line.label}</span>
                </div>
              ))}
              <span className="ml-auto">Trains = batchId</span>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Recent Batches</div>
                  <div className="text-xs text-muted-foreground">Latest movers + universe scans.</div>
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
                      setSelectedStation(null)
                      setSelectedSymbol(null)
                    }}
                  >
                    <div>
                      <div className="font-semibold">{batch.batchId}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {batch.lastStationId}
                      </div>
                    </div>
                    <Badge variant="secondary">{batch.status}</Badge>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-border/60 p-4">
              <div className="text-sm font-semibold">Selection</div>
              <Separator className="my-3" />
              {selectedSymbol && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{selectedSymbol}</div>
                      {selectedBatch && (
                        <div className="text-[11px] text-muted-foreground">
                          Batch {selectedBatch}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedBatch && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedSymbol(null)}
                        >
                          Back
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSymbol(null)
                          setSelectedBatch(null)
                          setSelectedStation(null)
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                    <div className="text-[11px] uppercase text-muted-foreground">Origins</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {selectedSymbolOrigins.map((origin) => (
                        <Badge
                          key={origin}
                          variant={origin === "unknown" ? "destructive" : "outline"}
                        >
                          {origin}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
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
                      </div>
                    ) : (
                      <div className="mt-2 text-muted-foreground">No scoring data yet.</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                    <div className="text-[11px] uppercase text-muted-foreground">Bot Signals</div>
                    {selectedSymbolSignals.total > 0 ? (
                      <div className="mt-2 space-y-1">
                        <div>
                          {selectedSymbolSignals.buy} buy • {selectedSymbolSignals.sell} sell •{" "}
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
                      </div>
                    ) : (
                      <div className="mt-2 text-muted-foreground">No bot signals sampled.</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                    <div className="text-[11px] uppercase text-muted-foreground">Inputs / Outputs</div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      {selectedSymbolIo.inputs.redisKeys.length > 0 && (
                        <div>Inputs Redis: {selectedSymbolIo.inputs.redisKeys.join(", ")}</div>
                      )}
                      {selectedSymbolIo.inputs.firestoreDocs.length > 0 && (
                        <div>
                          Inputs Firestore: {selectedSymbolIo.inputs.firestoreDocs.join(", ")}
                        </div>
                      )}
                      {selectedSymbolIo.outputs.redisKeys.length > 0 && (
                        <div>Outputs Redis: {selectedSymbolIo.outputs.redisKeys.join(", ")}</div>
                      )}
                      {selectedSymbolIo.outputs.firestoreDocs.length > 0 && (
                        <div>
                          Outputs Firestore: {selectedSymbolIo.outputs.firestoreDocs.join(", ")}
                        </div>
                      )}
                      {selectedSymbolIo.inputs.redisKeys.length === 0 &&
                        selectedSymbolIo.inputs.firestoreDocs.length === 0 &&
                        selectedSymbolIo.outputs.redisKeys.length === 0 &&
                        selectedSymbolIo.outputs.firestoreDocs.length === 0 && (
                          <div>No IO metadata captured.</div>
                        )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedSymbolEvents.map((event) => (
                      <div
                        key={`${event.eventId}-${event.ts}`}
                        className="rounded-lg border border-border/60 bg-background/60 px-2 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{event.stationId}</span>
                          <Badge variant="secondary">{event.status}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {event.service} • {new Date(event.ts).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedSymbol && selectedBatch && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Batch {selectedBatch}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedBatch(null)
                        setSelectedSymbol(null)
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                    <div className="text-[11px] uppercase text-muted-foreground">Origins</div>
                    {originBreakdown ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {Object.entries(originBreakdown).map(([key, value]) => (
                          <Badge key={key} variant="outline">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-muted-foreground">UNKNOWN ORIGIN</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                    <div className="text-[11px] uppercase text-muted-foreground">
                      Symbols (sampled)
                    </div>
                    <div className="mt-2 space-y-2">
                      {symbolSummaries.length === 0 && (
                        <div className="text-muted-foreground">
                          No symbol-level events yet (sampling or stream idle).
                        </div>
                      )}
                      {symbolSummaries.map((symbol) => (
                        <button
                          key={symbol.symbolKey}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border border-border/60 px-2 py-2 text-left",
                            selectedSymbol === symbol.symbolKey
                              ? "bg-primary/10 text-primary"
                              : "bg-background/60"
                          )}
                          onClick={() => setSelectedSymbol(symbol.symbolKey)}
                        >
                          <div>
                            <div className="font-medium">{symbol.symbolKey}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {symbol.lastStationId}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {symbol.action && (
                              <Badge variant="secondary">{symbol.action}</Badge>
                            )}
                            {symbol.score !== null && (
                              <div className="text-[11px] text-muted-foreground">
                                Score {symbol.score}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedBatchEvents.map((event) => (
                      <div
                        key={`${event.eventId}-${event.ts}`}
                        className="rounded-lg border border-border/60 bg-background/60 px-2 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{event.stationId}</span>
                          <Badge variant="secondary">{event.status}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {event.service} • {new Date(event.ts).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedSymbol && !selectedBatch && selectedStation && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Station {selectedStation}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedStation(null)}
                    >
                      Clear
                    </Button>
                  </div>
                  {selectedStationEvent ? (
                    <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                      <div className="flex items-center justify-between">
                        <span>{selectedStationEvent.service}</span>
                        <Badge variant="secondary">{selectedStationEvent.status}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(selectedStationEvent.ts).toLocaleTimeString()}
                      </div>
                      {selectedStationEvent.meta && (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {JSON.stringify(selectedStationEvent.meta)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No events for this station yet.</div>
                  )}
                </div>
              )}

              {!selectedSymbol && !selectedBatch && !selectedStation && (
                <div className="text-xs text-muted-foreground">
                  Click a station or train to inspect its latest events.
                </div>
              )}
            </Card>

            <Card className="border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Provider Health</div>
                <Badge variant="outline">{providerStats.length}</Badge>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {providerStats.length === 0 && (
                  <div className="text-muted-foreground">No provider activity yet.</div>
                )}
                {providerStats.map((provider) => {
                  const cacheRate =
                    provider.requestCount > 0
                      ? Math.round((provider.cacheHits / provider.requestCount) * 100)
                      : 0
                  return (
                    <div
                      key={provider.id}
                      className="rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{provider.label}</span>
                        <Badge variant={provider.errorCount > 0 ? "destructive" : "secondary"}>
                          {provider.errorCount > 0 ? "Errors" : "OK"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {provider.avgDuration !== null && (
                          <span>Avg {provider.avgDuration.toFixed(0)} ms • </span>
                        )}
                        <span>Cache {cacheRate}% • {provider.requestCount} calls</span>
                      </div>
                      {provider.lastHttpStatus && (
                        <div className="text-[11px] text-muted-foreground">
                          Last HTTP {provider.lastHttpStatus}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="border-border/60 p-4">
              <div className="text-sm font-semibold">Bottlenecks</div>
              <div className="mt-3 space-y-2 text-xs">
                {bottlenecks.length === 0 && (
                  <div className="text-muted-foreground">No latency samples yet.</div>
                )}
                {bottlenecks.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <span>{entry.label}</span>
                    <Badge variant="outline">
                      {entry.avgDuration?.toFixed(0)} ms
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {recentErrors.length > 0 && (
              <Card className="border-border/60 p-4">
                <div className="text-sm font-semibold text-rose-500">Recent Errors</div>
                <div className="mt-3 space-y-2 text-xs">
                  {recentErrors.map((event) => (
                    <div
                      key={`${event.eventId}-${event.ts}`}
                      className="rounded-lg border border-rose-200/60 bg-rose-50/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{event.stationId}</span>
                        <Badge variant="destructive">error</Badge>
                      </div>
                      <div className="text-[11px] text-rose-600/80">
                        {event.service} • {new Date(event.ts).toLocaleTimeString()}
                      </div>
                      {event.error?.message && (
                        <div className="mt-1 text-[11px] text-rose-700">
                          {event.error.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="border-border/60 p-4">
              <div className="text-sm font-semibold">Active Processors</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {processorList.length === 0 && (
                  <div className="text-xs text-muted-foreground">No processors yet.</div>
                )}
                {processorList.map((event) => (
                  <Badge key={event.service} variant="outline">
                    {event.service}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
