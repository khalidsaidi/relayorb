import { useEffect, useMemo, useRef, useState } from "react"
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from "firebase/firestore"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Activity, AlertTriangle, ChevronDown, Clock, HelpCircle, Target, Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db, firebaseEnabled } from "@/lib/firebase"
import { formatAssetPrice, formatNumber, formatTimestamp } from "@/lib/format"
import { useAuth } from "@/features/auth/auth-context"
import { useIbkrAccount } from "@/features/ibkr/use-ibkr-account"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import type {
  ExecutionRequestDoc,
  OrbControlDoc,
  OrbStateDoc,
  OrbStrategyProfile,
  ExecutionMode,
} from "@/lib/types"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type EntryType = "ORB_RAW" | "ORB_VWAP" | "ORB_ATR_BUFFER" | "ORB_MULTI_BAR"
type ExitType = "FIXED_STOP" | "TRAILING_STOP" | "REMEMBERED_ORB_STOP" | "TIME_STOP"

type ControlDraft = {
  enabled: boolean
  executionMode: ExecutionMode
  mode: "daily_universe" | "single_symbol"
  priceMin: string
  priceMax: string
  minDollarVolume: string
  maxSymbols: string
  symbol: string
  orbRangeMinutes: string
  entryDelayMinutes: string
  orderType: "limit" | "market"
  entryType: EntryType
  atrBufferPct: string
  confirmationBars: string
  breakoutCheckIntervalMinutes: string
  exitType: ExitType
  stopPct: string
  timeStopMinutes: string
  forceFlatMinutes: string
  positionPct: string
  maxTradesPerDay: string
  maxTradesPerSymbolPerDay: string
  reentryCooldownMinutes: string
  maxDailyLossPct: string
}

const DEFAULT_DAILY_PROFILE: OrbStrategyProfile = {
  mode: "daily_universe",
  universe: {
    price_min: 10,
    price_max: 80,
    min_dollar_volume: 50_000_000,
    max_symbols: 10,
  },
  symbols: {
    include: ["AMD"],
    exclude: [],
  },
  session: {
    type: "RTH",
    include_premarket: false,
    include_afterhours: false,
  },
  orb: {
    range_minutes: 1,
    entry_delay_minutes: 15,
    breakout_check_interval_minutes: null,
  },
  entry: {
    type: "ORB_RAW",
    atr_buffer_pct: 0,
    confirmation_bars: 1,
  },
  exit: {
    type: "FIXED_STOP",
    stop_pct: 2,
    time_stop_minutes: null,
    force_flat_minutes_before_close: 5,
  },
  risk: {
    max_trades_per_day: 10,
    max_trades_per_symbol_per_day: 1,
    reentry_cooldown_minutes: 0,
    position_pct: 0.1,
    max_daily_loss_pct: 2,
  },
}

const DEFAULT_SINGLE_PROFILE: OrbStrategyProfile = {
  mode: "single_symbol",
  universe: DEFAULT_DAILY_PROFILE.universe,
  symbols: {
    include: ["AMD"],
    exclude: [],
  },
  session: DEFAULT_DAILY_PROFILE.session,
  orb: {
    range_minutes: 15,
    entry_delay_minutes: 1,
    breakout_check_interval_minutes: null,
  },
  entry: {
    type: "ORB_VWAP",
    atr_buffer_pct: 0,
    confirmation_bars: 1,
  },
  exit: {
    type: "TRAILING_STOP",
    stop_pct: 0.8,
    time_stop_minutes: null,
    force_flat_minutes_before_close: 5,
  },
  risk: {
    max_trades_per_day: 1,
    max_trades_per_symbol_per_day: 1,
    reentry_cooldown_minutes: 0,
    position_pct: 0.1,
    max_daily_loss_pct: 2,
  },
}

const DEFAULT_DRAFT: ControlDraft = {
  enabled: false,
  executionMode: "paper",
  mode: "daily_universe",
  priceMin: String(DEFAULT_DAILY_PROFILE.universe.price_min),
  priceMax: String(DEFAULT_DAILY_PROFILE.universe.price_max),
  minDollarVolume: String(DEFAULT_DAILY_PROFILE.universe.min_dollar_volume),
  maxSymbols: String(DEFAULT_DAILY_PROFILE.universe.max_symbols),
  symbol: DEFAULT_SINGLE_PROFILE.symbols.include[0] || "",
  orbRangeMinutes: String(DEFAULT_DAILY_PROFILE.orb.range_minutes),
  entryDelayMinutes: String(DEFAULT_DAILY_PROFILE.orb.entry_delay_minutes),
  orderType: "limit",
  entryType: DEFAULT_SINGLE_PROFILE.entry.type as EntryType,
  atrBufferPct: String(DEFAULT_SINGLE_PROFILE.entry.atr_buffer_pct),
  confirmationBars: String(DEFAULT_SINGLE_PROFILE.entry.confirmation_bars),
  breakoutCheckIntervalMinutes: "",
  exitType: DEFAULT_SINGLE_PROFILE.exit.type as ExitType,
  stopPct: String(DEFAULT_SINGLE_PROFILE.exit.stop_pct),
  timeStopMinutes: "",
  forceFlatMinutes: String(DEFAULT_DAILY_PROFILE.exit.force_flat_minutes_before_close),
  positionPct: String(DEFAULT_DAILY_PROFILE.risk.position_pct),
  maxTradesPerDay: String(DEFAULT_DAILY_PROFILE.risk.max_trades_per_day),
  maxTradesPerSymbolPerDay: String(
    DEFAULT_DAILY_PROFILE.risk.max_trades_per_symbol_per_day ?? 1
  ),
  reentryCooldownMinutes: String(DEFAULT_DAILY_PROFILE.risk.reentry_cooldown_minutes ?? 0),
  maxDailyLossPct: String(DEFAULT_SINGLE_PROFILE.risk.max_daily_loss_pct),
}

function formatControlValue(value: number | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return String(fallback)
}

function formatOptionalControlValue(value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function parseNumberField(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeSymbolInput(value: string) {
  return value.toUpperCase().trim().replace(/[^A-Z0-9.-]/g, "")
}

const ET_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const ET_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function getEtDateKey(date: Date) {
  const parts = ET_DATE_FORMATTER.formatToParts(date)
  const map: Record<string, string> = {}
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value
    }
  })
  if (!map.year || !map.month || !map.day) return ""
  return `${map.year}-${map.month}-${map.day}`
}

function getTimeZoneOffsetMinutes(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(date)
  const map: Record<string, string> = {}
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value
    }
  })
  const year = Number(map.year)
  const month = Number(map.month)
  const day = Number(map.day)
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  const second = Number(map.second)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  return (asUtc - date.getTime()) / 60000
}

function formatDateTimeFromParts(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(date)
  const map: Record<string, string> = {}
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value
    }
  })
  if (!map.year || !map.month || !map.day || !map.hour || !map.minute) {
    return formatter.format(date)
  }
  const second = map.second ?? "00"
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${second}`
}

function getEtMinutes(date: Date) {
  const parts = ET_OFFSET_FORMATTER.formatToParts(date)
  const map: Record<string, string> = {}
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value
    }
  })
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function buildEtDate(sessionKey: string, minutes: number) {
  const [year, month, day] = sessionKey.split("-").map((value) => Number(value))
  if (!year || !month || !day) return null
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), ET_OFFSET_FORMATTER)
  return new Date(utcGuess - offsetMinutes * 60 * 1000)
}

function formatEtTime(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`
}

function formatEtDateTime(date: Date) {
  return formatDateTimeFromParts(date, ET_OFFSET_FORMATTER)
}

function formatLocalDateTime(date: Date) {
  return formatDateTimeFromParts(date, LOCAL_DATE_FORMATTER)
}

function formatEtTimeInput(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function parseEtTimeInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function formatSymbolList(symbols: Array<string | null | undefined>, limit = 4) {
  const unique = Array.from(
    new Set(
      symbols
        .map((symbol) => (symbol ? String(symbol).trim().toUpperCase() : ""))
        .filter(Boolean)
    )
  )
  if (!unique.length) return ""
  const visible = unique.slice(0, limit)
  const extra = unique.length - visible.length
  return extra > 0 ? `${visible.join(", ")} +${extra}` : visible.join(", ")
}

type AggressivePresetDraft = {
  orbRangeMinutes: string
  entryDelayMinutes: string
  entryType: EntryType
  confirmationBars: string
  exitType: ExitType
  stopPct: string
  positionPct: string
  breakoutCheckIntervalMinutes: string
  maxTradesPerSymbolPerDay: string
  reentryCooldownMinutes: string
  maxTradesPerDay: string
}

function buildAggressivePresetDraft(draft: ControlDraft): AggressivePresetDraft {
  const maxSymbolsValue =
    parseNumberField(draft.maxSymbols) ?? DEFAULT_DAILY_PROFILE.universe.max_symbols
  const aggressiveMaxTradesPerSymbol = 3
  const aggressiveMaxTradesPerDay = Math.max(
    1,
    Math.round(maxSymbolsValue * aggressiveMaxTradesPerSymbol)
  )
  return {
    orbRangeMinutes: "5",
    entryDelayMinutes: "0",
    entryType: "ORB_RAW",
    confirmationBars: "1",
    exitType: "TRAILING_STOP",
    stopPct: "1.2",
    positionPct: "0.4",
    breakoutCheckIntervalMinutes: "2",
    maxTradesPerSymbolPerDay: String(aggressiveMaxTradesPerSymbol),
    reentryCooldownMinutes: "5",
    maxTradesPerDay:
      draft.mode === "daily_universe" ? String(aggressiveMaxTradesPerDay) : "3",
  }
}

function isAggressivePresetApplied(draft: ControlDraft, preset: AggressivePresetDraft) {
  return (
    draft.orbRangeMinutes === preset.orbRangeMinutes &&
    draft.entryDelayMinutes === preset.entryDelayMinutes &&
    draft.entryType === preset.entryType &&
    draft.confirmationBars === preset.confirmationBars &&
    draft.exitType === preset.exitType &&
    draft.stopPct === preset.stopPct &&
    draft.positionPct === preset.positionPct &&
    draft.breakoutCheckIntervalMinutes === preset.breakoutCheckIntervalMinutes &&
    draft.maxTradesPerSymbolPerDay === preset.maxTradesPerSymbolPerDay &&
    draft.reentryCooldownMinutes === preset.reentryCooldownMinutes &&
    draft.maxTradesPerDay === preset.maxTradesPerDay
  )
}

function areDraftsEqual(a: ControlDraft, b: ControlDraft) {
  return (
    a.enabled === b.enabled &&
    a.executionMode === b.executionMode &&
    a.mode === b.mode &&
    a.priceMin === b.priceMin &&
    a.priceMax === b.priceMax &&
    a.minDollarVolume === b.minDollarVolume &&
    a.maxSymbols === b.maxSymbols &&
    a.symbol === b.symbol &&
    a.orbRangeMinutes === b.orbRangeMinutes &&
    a.entryDelayMinutes === b.entryDelayMinutes &&
    a.orderType === b.orderType &&
    a.entryType === b.entryType &&
    a.atrBufferPct === b.atrBufferPct &&
    a.confirmationBars === b.confirmationBars &&
    a.breakoutCheckIntervalMinutes === b.breakoutCheckIntervalMinutes &&
    a.exitType === b.exitType &&
    a.stopPct === b.stopPct &&
    a.timeStopMinutes === b.timeStopMinutes &&
    a.forceFlatMinutes === b.forceFlatMinutes &&
    a.positionPct === b.positionPct &&
    a.maxTradesPerDay === b.maxTradesPerDay &&
    a.maxTradesPerSymbolPerDay === b.maxTradesPerSymbolPerDay &&
    a.reentryCooldownMinutes === b.reentryCooldownMinutes &&
    a.maxDailyLossPct === b.maxDailyLossPct
  )
}

function resolveReplayAsOf(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return new Date((value as { toMillis: () => number }).toMillis())
  }
  const parsed = new Date(value as string)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function resolveTimestampMillis(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (
    typeof (value as { seconds?: number }).seconds === "number" &&
    typeof (value as { nanoseconds?: number }).nanoseconds === "number"
  ) {
    const seconds = (value as { seconds: number }).seconds
    const nanos = (value as { nanoseconds: number }).nanoseconds
    return seconds * 1000 + Math.floor(nanos / 1_000_000)
  }
  return null
}

function pickLatestDate(a: Date | null, b: Date | null) {
  if (a && b) return a.getTime() >= b.getTime() ? a : b
  return a || b
}

function resolveProfileFromControls(controls: OrbControlDoc): OrbStrategyProfile {
  if (controls.strategyProfile) {
    const mode =
      controls.strategyProfile.mode === "single_symbol" ? "single_symbol" : "daily_universe"
    const base = mode === "single_symbol" ? DEFAULT_SINGLE_PROFILE : DEFAULT_DAILY_PROFILE
    return {
      ...base,
      ...controls.strategyProfile,
      mode,
      universe: {
        ...base.universe,
        ...(controls.strategyProfile.universe || {}),
      },
      symbols: {
        ...base.symbols,
        ...(controls.strategyProfile.symbols || {}),
      },
      session: {
        ...base.session,
        ...(controls.strategyProfile.session || {}),
      },
      orb: {
        ...base.orb,
        ...(controls.strategyProfile.orb || {}),
      },
      entry: {
        ...base.entry,
        ...(controls.strategyProfile.entry || {}),
      },
      exit: {
        ...base.exit,
        ...(controls.strategyProfile.exit || {}),
      },
      risk: {
        ...base.risk,
        ...(controls.strategyProfile.risk || {}),
      },
    }
  }
  const legacySymbol = controls.singleSymbol || DEFAULT_SINGLE_PROFILE.symbols.include[0] || ""
  const mode = controls.singleSymbolMode ? "single_symbol" : "daily_universe"
  const base = mode === "single_symbol" ? DEFAULT_SINGLE_PROFILE : DEFAULT_DAILY_PROFILE
  return {
    ...base,
    mode,
    universe: {
      price_min: controls.priceMin ?? base.universe.price_min,
      price_max: controls.priceMax ?? base.universe.price_max,
      min_dollar_volume: controls.minDollarVolume ?? base.universe.min_dollar_volume,
      max_symbols: controls.maxSymbols ?? base.universe.max_symbols,
    },
    symbols: {
      include: legacySymbol ? [legacySymbol] : [],
      exclude: [],
    },
    orb: {
      range_minutes: controls.openingRangeMinutes ?? base.orb.range_minutes,
      entry_delay_minutes: controls.breakoutDelayMinutes ?? base.orb.entry_delay_minutes,
      breakout_check_interval_minutes: base.orb.breakout_check_interval_minutes ?? null,
    },
    entry: {
      ...base.entry,
    },
    exit: {
      ...base.exit,
      stop_pct: controls.stopLossPct ?? base.exit.stop_pct,
      force_flat_minutes_before_close:
        controls.liquidateMinutesBeforeClose ?? base.exit.force_flat_minutes_before_close,
    },
    risk: {
      ...base.risk,
      position_pct: controls.positionSizePct ?? base.risk.position_pct,
      max_trades_per_day: controls.maxBreakouts ?? base.risk.max_trades_per_day,
    },
  }
}

function buildDraftFromControls(controls: OrbControlDoc): ControlDraft {
  const profile = resolveProfileFromControls(controls)
  const symbol = profile.symbols?.include?.[0] || ""
  const isSingle = profile.mode === "single_symbol"
  const defaultProfile = isSingle ? DEFAULT_SINGLE_PROFILE : DEFAULT_DAILY_PROFILE

  return {
    enabled: controls.enabled ?? false,
    executionMode: controls.mode === "live" ? "live" : "paper",
    mode: profile.mode || "daily_universe",
    priceMin: formatControlValue(
      profile.universe?.price_min,
      DEFAULT_DAILY_PROFILE.universe.price_min
    ),
    priceMax: formatControlValue(
      profile.universe?.price_max,
      DEFAULT_DAILY_PROFILE.universe.price_max
    ),
    minDollarVolume: formatControlValue(
      profile.universe?.min_dollar_volume,
      DEFAULT_DAILY_PROFILE.universe.min_dollar_volume
    ),
    maxSymbols: formatControlValue(
      profile.universe?.max_symbols,
      DEFAULT_DAILY_PROFILE.universe.max_symbols
    ),
    symbol,
    orbRangeMinutes: formatControlValue(
      profile.orb?.range_minutes,
      defaultProfile.orb.range_minutes
    ),
    entryDelayMinutes: formatControlValue(
      profile.orb?.entry_delay_minutes,
      defaultProfile.orb.entry_delay_minutes
    ),
    orderType: controls.orderType === "market" ? "market" : "limit",
    entryType: (profile.entry?.type || DEFAULT_SINGLE_PROFILE.entry.type) as EntryType,
    atrBufferPct: formatControlValue(
      profile.entry?.atr_buffer_pct,
      DEFAULT_SINGLE_PROFILE.entry.atr_buffer_pct
    ),
    confirmationBars: formatControlValue(
      profile.entry?.confirmation_bars,
      DEFAULT_SINGLE_PROFILE.entry.confirmation_bars
    ),
    breakoutCheckIntervalMinutes: formatOptionalControlValue(
      profile.orb?.breakout_check_interval_minutes ?? null
    ),
    exitType: (profile.exit?.type || DEFAULT_SINGLE_PROFILE.exit.type) as ExitType,
    stopPct: formatControlValue(profile.exit?.stop_pct, DEFAULT_SINGLE_PROFILE.exit.stop_pct),
    timeStopMinutes: formatOptionalControlValue(profile.exit?.time_stop_minutes ?? null),
    forceFlatMinutes: formatControlValue(
      profile.exit?.force_flat_minutes_before_close,
      DEFAULT_DAILY_PROFILE.exit.force_flat_minutes_before_close
    ),
    positionPct: formatControlValue(
      profile.risk?.position_pct,
      DEFAULT_DAILY_PROFILE.risk.position_pct
    ),
    maxTradesPerDay: formatControlValue(
      profile.risk?.max_trades_per_day,
      defaultProfile.risk.max_trades_per_day
    ),
    maxTradesPerSymbolPerDay: formatControlValue(
      profile.risk?.max_trades_per_symbol_per_day,
      defaultProfile.risk.max_trades_per_symbol_per_day ?? 1
    ),
    reentryCooldownMinutes: formatControlValue(
      profile.risk?.reentry_cooldown_minutes,
      defaultProfile.risk.reentry_cooldown_minutes ?? 0
    ),
    maxDailyLossPct: formatControlValue(
      profile.risk?.max_daily_loss_pct,
      DEFAULT_SINGLE_PROFILE.risk.max_daily_loss_pct
    ),
  }
}

function formatFirestoreError(error: unknown) {
  if (!error || typeof error !== "object") return ""
  const code = "code" in error && typeof error.code === "string" ? error.code : ""
  const message = error instanceof Error ? error.message : ""
  if (message && code && !message.includes(code)) {
    return `${code}: ${message}`
  }
  return message || code
}

export default function OrbRobotPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { brokerAccountKey, brokerAccount } = useIbkrAccount(user?.uid)
  const [controls, setControls] = useState<OrbControlDoc | null>(null)
  const [stateDoc, setStateDoc] = useState<OrbStateDoc | null>(null)
  const [draft, setDraft] = useState<ControlDraft>(DEFAULT_DRAFT)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(firebaseEnabled && !!db)
  const [requests, setRequests] = useState<ExecutionRequestDoc[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [replayUpdating, setReplayUpdating] = useState(false)
  const [orbRunLoading, setOrbRunLoading] = useState(false)
  const [lastRunRequestedAt, setLastRunRequestedAt] = useState<Date | null>(null)
  const [runCooldownUntil, setRunCooldownUntil] = useState<number | null>(null)
  const [aggressivePresetBackup, setAggressivePresetBackup] =
    useState<ControlDraft | null>(null)
  const [runUntilTarget, setRunUntilTarget] = useState<"next_order" | "time">("next_order")
  const [runUntilStepMinutes, setRunUntilStepMinutes] = useState("1")
  const [runUntilStopTime, setRunUntilStopTime] = useState("")
  const [runUntilActive, setRunUntilActive] = useState(false)
  const [runUntilStatus, setRunUntilStatus] = useState("")
  const [confirmLiveOpen, setConfirmLiveOpen] = useState(false)
  const runUntilCancelRef = useRef(false)
  const requestsRef = useRef<ExecutionRequestDoc[]>([])
  const { controls: replayControls } = useReplayControls()
  const paperEnabled = brokerAccount?.enabled && brokerAccount?.paperEnabled
  const liveEnabled = brokerAccount?.enabled && brokerAccount?.liveEnabled

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoading(false)
      return
    }
    if (!brokerAccountKey) {
      setLoading(false)
      setRequests([])
      return
    }

    const controlsRef = doc(db, "orbControls", brokerAccountKey)
    const stateRef = doc(db, "orbStates", brokerAccountKey)
    const reqQuery = query(
      collection(db, "executionRequests"),
      where("brokerAccountKey", "==", brokerAccountKey),
      orderBy("createdAt", "desc"),
      limit(50)
    )

    const unsubControls = onSnapshot(controlsRef, (snap) => {
      setControls(snap.exists() ? (snap.data() as OrbControlDoc) : null)
      setLoading(false)
    })
    const unsubState = onSnapshot(stateRef, (snap) => {
      setStateDoc(snap.exists() ? (snap.data() as OrbStateDoc) : null)
    })
    const unsubRequests = onSnapshot(reqQuery, (snap) => {
      const docs = snap.docs.map((docSnap) => docSnap.data() as ExecutionRequestDoc)
      const filtered = docs.filter((entry) => entry.source === "orb")
      setRequests(filtered.slice(0, 20))
    })

    return () => {
      unsubControls()
      unsubState()
      unsubRequests()
    }
  }, [brokerAccountKey])

  useEffect(() => {
    requestsRef.current = requests
  }, [requests])

  useEffect(() => {
    if (!controls || dirty) return
    setDraft(buildDraftFromControls(controls))
    setAggressivePresetBackup(null)
  }, [controls, dirty])

  useEffect(() => {
    if (!paperEnabled && !liveEnabled) return
    if (paperEnabled && !liveEnabled && draft.executionMode !== "paper") {
      setDraft((prev) => ({ ...prev, executionMode: "paper" }))
      setDirty(true)
    } else if (!paperEnabled && liveEnabled && draft.executionMode !== "live") {
      setDraft((prev) => ({ ...prev, executionMode: "live" }))
      setDirty(true)
    }
  }, [paperEnabled, liveEnabled, draft.executionMode])

  function requestExecutionMode(nextMode: ExecutionMode) {
    if (nextMode === draft.executionMode) return
    if (nextMode === "live") {
      setConfirmLiveOpen(true)
      return
    }
    setDraft((prev) => ({ ...prev, executionMode: nextMode }))
    setDirty(true)
  }

  function confirmLiveMode() {
    setDraft((prev) => ({ ...prev, executionMode: "live" }))
    setDirty(true)
    setConfirmLiveOpen(false)
  }

  function cancelLiveMode() {
    setConfirmLiveOpen(false)
  }

  const canWrite = firebaseEnabled && !!db && !!brokerAccountKey
  const activeProfile = controls ? resolveProfileFromControls(controls) : DEFAULT_DAILY_PROFILE
  const activeMode = activeProfile.mode || "daily_universe"
  const isDailyDraft = draft.mode === "daily_universe"
  const orbRange = stateDoc?.orbRange
  const universe = stateDoc?.universe || []
  const orbHighs = (stateDoc?.orbHighs ?? {}) as Record<string, number>
  const tradedSymbols = useMemo(
    () => new Set(stateDoc?.tradePlaced || []),
    [stateDoc?.tradePlaced]
  )
  const positionBadge = stateDoc?.inPosition
    ? t("orb.context.positionOpen")
    : stateDoc?.entryPending
    ? t("orb.context.positionPending")
    : t("orb.context.positionFlat")
  const orbRunnerBase = (import.meta.env.VITE_ORB_RUNNER_URL || "").replace(/\/+$/, "")
  const orbRangeMinutesLabel =
    activeProfile.orb?.range_minutes ?? DEFAULT_DAILY_PROFILE.orb.range_minutes
  const replayAsOfDate = resolveReplayAsOf(replayControls?.asOf)
  const replayAsOfEt = replayAsOfDate ? formatEtDateTime(replayAsOfDate) : ""
  const replayAsOfLocal = replayAsOfDate ? formatLocalDateTime(replayAsOfDate) : ""
  const replayAsOfMinutes = replayAsOfDate ? getEtMinutes(replayAsOfDate) : null
  const replayDateKey =
    stateDoc?.sessionKey || (replayAsOfDate ? getEtDateKey(replayAsOfDate) : "")
  const replayMode = replayControls?.desiredMode === "replay"
  const replayPhase = replayControls?.phase || "ready"
  const replayReady = replayMode && replayControls?.activeRunId && replayControls?.datasetId
  const replayOpenMinutes = 9 * 60 + 30
  const replayCloseMinutes = 16 * 60
  const replayRangeMinutes = orbRangeMinutesLabel
  const replayEntryDelay =
    activeProfile.orb?.entry_delay_minutes ?? DEFAULT_DAILY_PROFILE.orb.entry_delay_minutes
  const replayForceFlat =
    activeProfile.exit?.force_flat_minutes_before_close ??
    DEFAULT_DAILY_PROFILE.exit.force_flat_minutes_before_close
  const replayRangeEnd = replayOpenMinutes + Math.max(replayRangeMinutes, 1)
  const replayEntryMinute =
    activeMode === "daily_universe"
      ? replayOpenMinutes + Math.max(replayEntryDelay, 0)
      : replayRangeEnd + Math.max(replayEntryDelay, 0)
  const replayLiquidationMinute =
    replayCloseMinutes -
    Math.max(replayForceFlat, DEFAULT_DAILY_PROFILE.exit.force_flat_minutes_before_close)
  const runUntilStopPlaceholder = formatEtTimeInput(replayLiquidationMinute)
  const orbRangeStartLabel = formatEtTimeInput(replayOpenMinutes)
  const orbRangeEndLabel = formatEtTimeInput(replayRangeEnd)
  const orbRangeWindowLabel = `${orbRangeStartLabel}-${orbRangeEndLabel} ET`
  const currentEtMinutes = replayAsOfMinutes ?? getEtMinutes(new Date())
  const currentEtLabel =
    typeof currentEtMinutes === "number" ? formatEtTime(currentEtMinutes) : ""
  const orbHighHeader = `${t("orb.universe.orbHigh")} (${orbRangeWindowLabel})`
  const rangeComplete = Boolean(stateDoc?.lastOpenRangeAt)
  const capturedLabel = stateDoc?.lastOpenRangeAt
    ? formatTimestamp(stateDoc.lastOpenRangeAt)
    : t("orb.universe.capturedPending")
  const replaySteps = useMemo(() => {
    const steps = []
    if (activeMode === "daily_universe") {
      steps.push({
        key: "universe",
        label: t("orb.replay.steps.universe"),
        hint: t("orb.replay.steps.universeHint"),
        minutes: replayOpenMinutes - 10,
      })
    }
    steps.push({
      key: "range",
      label: t("orb.replay.steps.range"),
      hint: t("orb.replay.steps.rangeHint"),
      minutes: replayRangeEnd,
    })
    steps.push({
      key: "entry",
      label:
        activeMode === "daily_universe"
          ? t("orb.replay.steps.breakout")
          : t("orb.replay.steps.entry"),
      hint:
        activeMode === "daily_universe"
          ? t("orb.replay.steps.breakoutHint")
          : t("orb.replay.steps.entryHint"),
      minutes: replayEntryMinute,
    })
    steps.push({
      key: "liquidation",
      label: t("orb.replay.steps.liquidation"),
      hint: t("orb.replay.steps.liquidationHint"),
      minutes: replayLiquidationMinute,
    })
    return steps
  }, [
    activeMode,
    replayEntryMinute,
    replayLiquidationMinute,
    replayOpenMinutes,
    replayRangeEnd,
    t,
  ])
  const runCooldownActive =
    typeof runCooldownUntil === "number" && Date.now() < runCooldownUntil
  const lastRunFromState = resolveReplayAsOf(stateDoc?.lastRunRequestedAt)
  const lastRunAt = pickLatestDate(lastRunFromState, lastRunRequestedAt)
  const lastRunMs = lastRunAt ? lastRunAt.getTime() : null
  const ordersSinceRunEntries = useMemo(() => {
    if (!lastRunMs) return []
    return requests.filter((request) => {
      const createdMs = resolveTimestampMillis(request.createdAt)
      return typeof createdMs === "number" && createdMs >= lastRunMs
    })
  }, [requests, lastRunMs])
  const ordersSinceRun = ordersSinceRunEntries.length
  const ordersSinceRunSymbols = useMemo(
    () =>
      formatSymbolList(
        ordersSinceRunEntries.map((request) => request.orderSnapshot?.symbol)
      ),
    [ordersSinceRunEntries]
  )

  useEffect(() => {
    if (!runCooldownActive || typeof runCooldownUntil !== "number") return
    const delay = Math.max(runCooldownUntil - Date.now(), 250)
    const timer = window.setTimeout(() => {
      setRunCooldownUntil(null)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [runCooldownActive, runCooldownUntil])

  async function handleToggleEnabled() {
    if (!canWrite || !db || !brokerAccountKey) return
    if (draft.executionMode === "live" && !liveEnabled) {
      toast.error(t("ibkr.errors.liveDisabled"))
      return
    }
    if (draft.executionMode === "paper" && !paperEnabled) {
      toast.error(t("ibkr.errors.paperDisabled"))
      return
    }
    const nextEnabled = !draft.enabled
    setDraft((prev) => ({ ...prev, enabled: nextEnabled }))
    setDirty(true)
    try {
      await setDoc(
        doc(db, "orbControls", brokerAccountKey),
        {
          enabled: nextEnabled,
          brokerAccountKey,
          mode: draft.executionMode,
          updatedAt: serverTimestamp(),
          updatedByUid: user?.uid || undefined,
        },
        { merge: true }
      )
      setDirty(false)
    } catch (error) {
      console.error(error)
      const detail = formatFirestoreError(error)
      toast.error(detail ? `${t("orb.errors.saveFailed")}: ${detail}` : t("orb.errors.saveFailed"))
    }
  }

  async function handleSave() {
    if (!canWrite || !db || !brokerAccountKey) return
    if (draft.executionMode === "live" && !liveEnabled) {
      toast.error(t("ibkr.errors.liveDisabled"))
      return
    }
    if (draft.executionMode === "paper" && !paperEnabled) {
      toast.error(t("ibkr.errors.paperDisabled"))
      return
    }

    const mode = draft.mode
    const symbol = normalizeSymbolInput(draft.symbol)
    const priceMin = parseNumberField(draft.priceMin)
    const priceMax = parseNumberField(draft.priceMax)
    const minDollarVolume = parseNumberField(draft.minDollarVolume)
    const maxSymbols = parseNumberField(draft.maxSymbols)
    const orbRangeMinutes = parseNumberField(draft.orbRangeMinutes)
    const entryDelayMinutes = parseNumberField(draft.entryDelayMinutes)
    const atrBufferPct = parseNumberField(draft.atrBufferPct)
    const confirmationBars = parseNumberField(draft.confirmationBars)
    const breakoutCheckIntervalMinutes = draft.breakoutCheckIntervalMinutes.trim()
      ? parseNumberField(draft.breakoutCheckIntervalMinutes)
      : null
    const stopPct = parseNumberField(draft.stopPct)
    const timeStopMinutes = draft.timeStopMinutes.trim()
      ? parseNumberField(draft.timeStopMinutes)
      : null
    const forceFlatMinutes = parseNumberField(draft.forceFlatMinutes)
    const positionPct = parseNumberField(draft.positionPct)
    const maxTradesPerDay = parseNumberField(draft.maxTradesPerDay)
    const maxTradesPerSymbolPerDay = parseNumberField(draft.maxTradesPerSymbolPerDay)
    const reentryCooldownMinutes = draft.reentryCooldownMinutes.trim()
      ? parseNumberField(draft.reentryCooldownMinutes)
      : null
    const maxDailyLossPct = parseNumberField(draft.maxDailyLossPct)

    if (mode === "single_symbol" && !symbol) {
      toast.error(t("orb.errors.invalidSymbol"))
      return
    }

    if (mode === "daily_universe") {
      if (
        priceMin === null ||
        priceMax === null ||
        minDollarVolume === null ||
        maxSymbols === null
      ) {
        toast.error(t("orb.errors.invalidNumber"))
        return
      }
      if (priceMin >= priceMax) {
        toast.error(t("orb.errors.invalidPriceRange"))
        return
      }
      if (minDollarVolume < 0) {
        toast.error(t("orb.errors.invalidDollarVolume"))
        return
      }
      if (maxSymbols < 1) {
        toast.error(t("orb.errors.invalidMaxSymbols"))
        return
      }
      if (
        breakoutCheckIntervalMinutes !== null &&
        breakoutCheckIntervalMinutes <= 0
      ) {
        toast.error(t("orb.errors.invalidBreakoutInterval"))
        return
      }
      if (maxTradesPerSymbolPerDay === null || maxTradesPerSymbolPerDay < 1) {
        toast.error(t("orb.errors.invalidMaxTradesPerSymbol"))
        return
      }
      if (reentryCooldownMinutes !== null && reentryCooldownMinutes < 0) {
        toast.error(t("orb.errors.invalidReentryCooldown"))
        return
      }
    }

    if (orbRangeMinutes === null || orbRangeMinutes <= 0) {
      toast.error(t("orb.errors.invalidRangeMinutes"))
      return
    }
    if (entryDelayMinutes === null || entryDelayMinutes < 0) {
      toast.error(t("orb.errors.invalidEntryDelay"))
      return
    }
    if (forceFlatMinutes === null || forceFlatMinutes <= 0) {
      toast.error(t("orb.errors.invalidForceFlat"))
      return
    }
    if (positionPct === null || positionPct <= 0 || positionPct > 1) {
      toast.error(t("orb.errors.invalidPositionSize"))
      return
    }
    if (maxTradesPerDay === null || maxTradesPerDay < 1) {
      toast.error(t("orb.errors.invalidMaxTrades"))
      return
    }
    if (mode === "single_symbol") {
      if (atrBufferPct === null || atrBufferPct < 0) {
        toast.error(t("orb.errors.invalidAtrBuffer"))
        return
      }
      if (confirmationBars === null || confirmationBars < 1) {
        toast.error(t("orb.errors.invalidConfirmationBars"))
        return
      }
      if (maxDailyLossPct === null || maxDailyLossPct < 0) {
        toast.error(t("orb.errors.invalidDailyLoss"))
        return
      }

      if (draft.exitType === "TIME_STOP") {
        if (timeStopMinutes === null || timeStopMinutes <= 0) {
          toast.error(t("orb.errors.invalidTimeStop"))
          return
        }
      }

      if (draft.exitType === "FIXED_STOP" || draft.exitType === "TRAILING_STOP") {
        if (stopPct === null || stopPct <= 0) {
          toast.error(t("orb.errors.invalidStopLoss"))
          return
        }
      }
    }

    setSaving(true)
    try {
      const resolvedAtrBufferPct =
        atrBufferPct ?? DEFAULT_SINGLE_PROFILE.entry.atr_buffer_pct
      const resolvedConfirmationBars =
        confirmationBars ?? DEFAULT_SINGLE_PROFILE.entry.confirmation_bars
      const resolvedStopPct = stopPct ?? DEFAULT_SINGLE_PROFILE.exit.stop_pct
      const resolvedMaxDailyLossPct =
        maxDailyLossPct ?? DEFAULT_SINGLE_PROFILE.risk.max_daily_loss_pct
      const resolvedMaxTradesPerDay = Math.max(
        1,
        Math.round(
          maxTradesPerDay ??
            (mode === "single_symbol"
              ? DEFAULT_SINGLE_PROFILE.risk.max_trades_per_day
              : DEFAULT_DAILY_PROFILE.risk.max_trades_per_day)
        )
      )
      const fallbackRisk =
        mode === "single_symbol" ? DEFAULT_SINGLE_PROFILE.risk : DEFAULT_DAILY_PROFILE.risk
      const resolvedMaxTradesPerSymbol = Math.max(
        1,
        Math.round(maxTradesPerSymbolPerDay ?? fallbackRisk.max_trades_per_symbol_per_day ?? 1)
      )
      const resolvedReentryCooldownMinutes = Math.max(
        0,
        Math.round(reentryCooldownMinutes ?? fallbackRisk.reentry_cooldown_minutes ?? 0)
      )
      const resolvedBreakoutCheckIntervalMinutes =
        breakoutCheckIntervalMinutes !== null
          ? Math.max(1, Math.round(breakoutCheckIntervalMinutes))
          : null

      const strategyProfile: OrbStrategyProfile = {
        mode,
        universe: {
          price_min: priceMin ?? DEFAULT_DAILY_PROFILE.universe.price_min,
          price_max: priceMax ?? DEFAULT_DAILY_PROFILE.universe.price_max,
          min_dollar_volume:
            minDollarVolume ?? DEFAULT_DAILY_PROFILE.universe.min_dollar_volume,
          max_symbols: Math.round(maxSymbols ?? DEFAULT_DAILY_PROFILE.universe.max_symbols),
        },
        symbols: {
          include: symbol ? [symbol] : [],
          exclude: [],
        },
        session: {
          type: "RTH",
          include_premarket: false,
          include_afterhours: false,
        },
        orb: {
          range_minutes: Math.round(orbRangeMinutes),
          entry_delay_minutes: Math.round(entryDelayMinutes),
          breakout_check_interval_minutes: resolvedBreakoutCheckIntervalMinutes,
        },
        entry: {
          type: draft.entryType,
          atr_buffer_pct: resolvedAtrBufferPct,
          confirmation_bars: Math.round(resolvedConfirmationBars),
        },
        exit: {
          type: draft.exitType,
          stop_pct: resolvedStopPct,
          time_stop_minutes:
            draft.exitType === "TIME_STOP" ? Math.round(timeStopMinutes || 0) : null,
          force_flat_minutes_before_close: Math.round(forceFlatMinutes),
        },
        risk: {
          max_trades_per_day: resolvedMaxTradesPerDay,
          max_trades_per_symbol_per_day: resolvedMaxTradesPerSymbol,
          reentry_cooldown_minutes: resolvedReentryCooldownMinutes,
          position_pct: positionPct,
          max_daily_loss_pct: resolvedMaxDailyLossPct,
        },
      }

      await setDoc(
        doc(db, "orbControls", brokerAccountKey),
        {
          enabled: draft.enabled,
          brokerAccountKey,
          mode: draft.executionMode,
          strategyProfile,
          orderType: draft.orderType,
          updatedAt: serverTimestamp(),
          updatedByUid: user?.uid || undefined,
        },
        { merge: true }
      )
      setDirty(false)
      toast.success(t("orb.saved"))
    } catch (error) {
      console.error(error)
      const detail = formatFirestoreError(error)
      toast.error(detail ? `${t("orb.errors.saveFailed")}: ${detail}` : t("orb.errors.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function updateReplayControls(
    patch: Record<string, unknown>,
    successMessage?: string
  ) {
    if (!canWrite || !db) return false
    setReplayUpdating(true)
    try {
      const nextVersion =
        typeof replayControls?.version === "number" ? replayControls.version + 1 : 1
      const payload: Record<string, unknown> = {
        ...patch,
        version: nextVersion,
        updatedAt: serverTimestamp(),
      }
      if (replayControls?.desiredMode !== "replay") {
        payload.desiredMode = "replay"
      }
      if (!replayControls?.sessionId) {
        payload.sessionId = `session-${Date.now()}`
      }
      await setDoc(doc(db, "replay", "controls"), payload, { merge: true })
      if (successMessage) {
        toast.success(successMessage)
      }
      return true
    } catch (error) {
      console.error(error)
      const detail = formatFirestoreError(error)
      toast.error(
        detail
          ? `${t("orb.replay.errors.updateFailed")}: ${detail}`
          : t("orb.replay.errors.updateFailed")
      )
      return false
    } finally {
      setReplayUpdating(false)
    }
  }

  async function handleReplayStep(minutes: number, label: string) {
    if (!replayDateKey) {
      toast.error(t("orb.replay.errors.missingSession"))
      return
    }
    if (!replayReady) {
      toast.error(t("orb.replay.errors.notReady"))
      return
    }
    const target = buildEtDate(replayDateKey, minutes)
    if (!target) {
      toast.error(t("orb.replay.errors.invalidTime"))
      return
    }
    await updateReplayControls(
      {
        asOf: Timestamp.fromDate(target),
        phase: "paused",
      },
      t("orb.replay.updated", { label })
    )
  }

  async function handleReplayPhase(nextPhase: "paused" | "running") {
    if (!replayReady) {
      toast.error(t("orb.replay.errors.notReady"))
      return
    }
    await updateReplayControls(
      { phase: nextPhase },
      nextPhase === "running" ? t("orb.replay.started") : t("orb.replay.paused")
    )
  }

  async function resolveOrbRunToken() {
    if (!user) return ""
    try {
      return await user.getIdToken()
    } catch {
      return ""
    }
  }

  async function runOrbOnce(authToken?: string) {
    const headers: Record<string, string> = {}
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    const response = await fetch(`${orbRunnerBase}/run`, { method: "POST", headers })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `HTTP ${response.status}`)
    }
  }

  async function handleRunOrb() {
    if (!orbRunnerBase) {
      toast.error(t("orb.replay.errors.runnerMissing"))
      return
    }
    const authToken = await resolveOrbRunToken()
    if (!authToken) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }
    setOrbRunLoading(true)
    try {
      await runOrbOnce(authToken)
      setLastRunRequestedAt(new Date())
      setRunCooldownUntil(Date.now() + 4000)
      toast.success(t("orb.replay.runQueued"))
    } catch (error) {
      console.error(error)
      const detail = error instanceof Error ? error.message : ""
      toast.error(
        detail ? `${t("orb.replay.errors.runFailed")}: ${detail}` : t("orb.replay.errors.runFailed")
      )
    } finally {
      setOrbRunLoading(false)
    }
  }

  async function handleRunUntilStop() {
    if (!runUntilActive) return
    runUntilCancelRef.current = true
    setRunUntilStatus(t("orb.replay.runUntil.statusStopped"))
  }

  async function handleRunUntil() {
    if (runUntilActive) return
    if (!replayReady) {
      toast.error(t("orb.replay.errors.notReady"))
      return
    }
    if (!orbRunnerBase) {
      toast.error(t("orb.replay.errors.runnerMissing"))
      return
    }
    const authToken = await resolveOrbRunToken()
    if (!authToken) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }
    if (!replayDateKey) {
      toast.error(t("orb.replay.errors.missingSession"))
      return
    }
    if (replayPhase === "running") {
      toast.error(t("orb.replay.runUntil.errors.pauseFirst"))
      return
    }

    const stepValue = parseNumberField(runUntilStepMinutes)
    if (stepValue === null || stepValue <= 0) {
      toast.error(t("orb.replay.runUntil.errors.invalidStep"))
      return
    }
    const stepMinutes = Math.min(60, Math.max(1, Math.round(stepValue)))
    const stopMinutesInput = runUntilStopTime.trim()
      ? parseEtTimeInput(runUntilStopTime)
      : null
    if (runUntilStopTime.trim() && stopMinutesInput === null) {
      toast.error(t("orb.replay.runUntil.errors.invalidStop"))
      return
    }

    const startMinutes = replayAsOfMinutes ?? replayOpenMinutes
    const stopMinutes = Math.min(
      stopMinutesInput ?? replayLiquidationMinute,
      replayCloseMinutes
    )

    if (stopMinutes <= startMinutes) {
      toast.error(t("orb.replay.runUntil.errors.stopBeforeStart"))
      return
    }

    const maxSteps = Math.ceil((stopMinutes - startMinutes) / stepMinutes) + 1
    const cappedMaxSteps = Math.min(maxSteps, 480)
    const runStartMs = Date.now() - 1500

    setLastRunRequestedAt(new Date())
    setRunUntilActive(true)
    runUntilCancelRef.current = false
    setRunUntilStatus(t("orb.replay.runUntil.statusStep", { time: formatEtTime(startMinutes) }))

    let orderFound = false
    let hadError = false
    try {
      for (let step = 0; step < cappedMaxSteps; step += 1) {
        if (runUntilCancelRef.current) break
        const targetMinutes = Math.min(startMinutes + step * stepMinutes, stopMinutes)
        const targetDate = buildEtDate(replayDateKey, targetMinutes)
        if (!targetDate) {
          hadError = true
          break
        }

        setRunUntilStatus(t("orb.replay.runUntil.statusStep", { time: formatEtTime(targetMinutes) }))
        const updated = await updateReplayControls(
          {
            asOf: Timestamp.fromDate(targetDate),
            phase: "paused",
          },
          undefined
        )
        if (!updated) {
          hadError = true
          break
        }

        try {
        await runOrbOnce(authToken)
        } catch (error) {
          console.error(error)
          const detail = error instanceof Error ? error.message : ""
          toast.error(
            detail
              ? `${t("orb.replay.errors.runFailed")}: ${detail}`
              : t("orb.replay.errors.runFailed")
          )
          hadError = true
          break
        }

        await new Promise((resolve) => window.setTimeout(resolve, 750))

        if (runUntilTarget === "next_order") {
          const hasOrder = requestsRef.current.some((request) => {
            const createdMs = resolveTimestampMillis(request.createdAt)
            return typeof createdMs === "number" && createdMs >= runStartMs
          })
          if (hasOrder) {
            orderFound = true
            break
          }
        }

        if (targetMinutes >= stopMinutes) break
      }
    } finally {
      if (runUntilCancelRef.current) {
        setRunUntilStatus(t("orb.replay.runUntil.statusStopped"))
      } else if (hadError) {
        setRunUntilStatus(t("orb.replay.runUntil.statusError"))
      } else if (runUntilTarget === "next_order") {
        setRunUntilStatus(
          orderFound
            ? t("orb.replay.runUntil.statusFound")
            : t("orb.replay.runUntil.statusNone", { time: formatEtTime(stopMinutes) })
        )
      } else {
        setRunUntilStatus(t("orb.replay.runUntil.statusDone", { time: formatEtTime(stopMinutes) }))
      }
      setRunUntilActive(false)
      runUntilCancelRef.current = false
    }
  }

  const aggressivePreset = buildAggressivePresetDraft(draft)
  const aggressivePresetApplied = isAggressivePresetApplied(draft, aggressivePreset)

  function applyAggressivePreset() {
    if (aggressivePresetApplied) {
      const fallback = controls ? buildDraftFromControls(controls) : DEFAULT_DRAFT
      const nextDraft = aggressivePresetBackup ? { ...aggressivePresetBackup } : fallback
      setDraft(nextDraft)
      setDirty(controls ? !areDraftsEqual(nextDraft, fallback) : true)
      setAggressivePresetBackup(null)
      return
    }

    const preset = buildAggressivePresetDraft(draft)
    setAggressivePresetBackup({ ...draft })
    setDraft((prev) => ({
      ...prev,
      ...preset,
    }))
    setDirty(true)
  }

  if (!firebaseEnabled) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("orb.errors.firebase")}
      </div>
    )
  }

  if (!brokerAccountKey) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("orb.errors.noAccount")}
      </div>
    )
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("orb.kicker")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("orb.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("orb.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t("orb.account", { account: brokerAccountKey.toUpperCase() })}
          </Badge>
          <Badge variant="secondary">{t(`orb.mode.${draft.executionMode}`)}</Badge>
          <Badge
            variant={draft.enabled ? "secondary" : "outline"}
            className={
              draft.enabled ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : ""
            }
          >
            {draft.enabled ? t("orb.enabled") : t("orb.disabled")}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="order-1 space-y-6 lg:order-1 lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" />
                {t("orb.controls.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{t("orb.controls.enableTitle")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("orb.controls.enableHint")}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={draft.enabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleEnabled}
                  disabled={!canWrite}
                >
                  {draft.enabled ? t("orb.enabled") : t("orb.disabled")}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {t("orb.controls.executionMode")}
                </div>
                <Tabs
                  value={draft.executionMode}
                  onValueChange={(value) => {
                    const nextMode = value === "live" ? "live" : "paper"
                    requestExecutionMode(nextMode)
                  }}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paper" disabled={!paperEnabled}>
                      {t("ibkr.mode.paper")}
                    </TabsTrigger>
                    <TabsTrigger value="live" disabled={!liveEnabled}>
                      {t("ibkr.mode.live")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {draft.executionMode === "live" ? (
                  <div className="rounded-md border border-rose-200/60 bg-rose-500/10 p-2 text-xs text-rose-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      {t("ibkr.mode.liveCautionTitle")}
                    </div>
                    <div className="mt-1">{t("ibkr.mode.liveCautionBody")}</div>
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t("orb.controls.mode")}</div>
                  <select
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    value={draft.mode}
                    onChange={(event) => {
                      const value =
                        event.target.value === "single_symbol"
                          ? "single_symbol"
                          : "daily_universe"
                      setDraft((prev) => ({ ...prev, mode: value }))
                      setDirty(true)
                    }}
                  >
                    <option value="daily_universe">{t("orb.controls.modeDaily")}</option>
                    <option value="single_symbol">{t("orb.controls.modeSingle")}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t("orb.controls.presets")}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={aggressivePresetApplied ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={aggressivePresetApplied}
                      onClick={applyAggressivePreset}
                    >
                      {aggressivePresetApplied
                        ? `${t("orb.controls.presetAggressive")} (${t(
                            "orb.controls.presetApplied"
                          )})`
                        : t("orb.controls.presetAggressive")}
                    </Button>
                  </div>
                </div>

                {isDailyDraft ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.priceMin")}
                      </div>
                      <Input
                        type="number"
                        value={draft.priceMin}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, priceMin: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.priceMax")}
                      </div>
                      <Input
                        type="number"
                        value={draft.priceMax}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, priceMax: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.minDollarVolume")}
                      </div>
                      <Input
                        type="number"
                        value={draft.minDollarVolume}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, minDollarVolume: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.maxSymbols")}
                      </div>
                      <Input
                        type="number"
                        value={draft.maxSymbols}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, maxSymbols: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.openingRangeMinutes")}
                      </div>
                      <Input
                        type="number"
                        value={draft.orbRangeMinutes}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, orbRangeMinutes: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.breakoutDelayMinutes")}
                      </div>
                      <Input
                        type="number"
                        value={draft.entryDelayMinutes}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, entryDelayMinutes: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.positionPct")}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.positionPct}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, positionPct: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.liquidateMinutesBeforeClose")}
                      </div>
                      <Input
                        type="number"
                        value={draft.forceFlatMinutes}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, forceFlatMinutes: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{t("orb.controls.symbol")}</div>
                      <Input
                        type="text"
                        placeholder="AMD"
                        value={draft.symbol}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, symbol: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.orbRangeMinutes")}
                      </div>
                      <Input
                        type="number"
                        value={draft.orbRangeMinutes}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, orbRangeMinutes: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.entryDelayMinutes")}
                      </div>
                      <Input
                        type="number"
                        value={draft.entryDelayMinutes}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, entryDelayMinutes: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.entryType")}
                      </div>
                      <select
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                        value={draft.entryType}
                        onChange={(event) => {
                          const value = event.target.value as EntryType
                          setDraft((prev) => ({ ...prev, entryType: value }))
                          setDirty(true)
                        }}
                      >
                        <option value="ORB_RAW">{t("orb.controls.entryTypeRaw")}</option>
                        <option value="ORB_VWAP">{t("orb.controls.entryTypeVwap")}</option>
                        <option value="ORB_ATR_BUFFER">{t("orb.controls.entryTypeAtr")}</option>
                        <option value="ORB_MULTI_BAR">{t("orb.controls.entryTypeMulti")}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.exitType")}
                      </div>
                      <select
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                        value={draft.exitType}
                        onChange={(event) => {
                          const value = event.target.value as ExitType
                          setDraft((prev) => ({ ...prev, exitType: value }))
                          setDirty(true)
                        }}
                      >
                        <option value="FIXED_STOP">{t("orb.controls.exitTypeFixed")}</option>
                        <option value="TRAILING_STOP">{t("orb.controls.exitTypeTrailing")}</option>
                        <option value="REMEMBERED_ORB_STOP">
                          {t("orb.controls.exitTypeOrb")}
                        </option>
                        <option value="TIME_STOP">{t("orb.controls.exitTypeTime")}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.positionPct")}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.positionPct}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, positionPct: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("orb.controls.forceFlatMinutes")}
                      </div>
                      <Input
                        type="number"
                        value={draft.forceFlatMinutes}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, forceFlatMinutes: event.target.value }))
                          setDirty(true)
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t("orb.controls.orderType")}</div>
                  <select
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    value={draft.orderType}
                    onChange={(event) => {
                      const value = event.target.value === "market" ? "market" : "limit"
                      setDraft((prev) => ({ ...prev, orderType: value }))
                      setDirty(true)
                    }}
                  >
                    <option value="limit">{t("orb.controls.orderTypeLimit")}</option>
                    <option value="market">{t("orb.controls.orderTypeMarket")}</option>
                  </select>
                </div>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 px-0 text-sm"
                  >
                    {t("orb.controls.advancedTitle")}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        advancedOpen ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="text-xs text-muted-foreground">
                    {isDailyDraft
                      ? t("orb.controls.advancedHintDaily")
                      : t("orb.controls.advancedHint")}
                  </div>
                  {isDailyDraft ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.breakoutCheckInterval")}
                        </div>
                        <Input
                          type="number"
                          value={draft.breakoutCheckIntervalMinutes}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              breakoutCheckIntervalMinutes: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.maxTradesPerSymbol")}
                        </div>
                        <Input
                          type="number"
                          value={draft.maxTradesPerSymbolPerDay}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              maxTradesPerSymbolPerDay: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.reentryCooldownMinutes")}
                        </div>
                        <Input
                          type="number"
                          value={draft.reentryCooldownMinutes}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              reentryCooldownMinutes: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.maxTradesPerDayTotal")}
                        </div>
                        <Input
                          type="number"
                          value={draft.maxTradesPerDay}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              maxTradesPerDay: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.atrBufferPct")}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.atrBufferPct}
                          onChange={(event) => {
                            setDraft((prev) => ({ ...prev, atrBufferPct: event.target.value }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.confirmationBars")}
                        </div>
                        <Input
                          type="number"
                          value={draft.confirmationBars}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              confirmationBars: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.stopPct")}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.stopPct}
                          onChange={(event) => {
                            setDraft((prev) => ({ ...prev, stopPct: event.target.value }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.timeStopMinutes")}
                        </div>
                        <Input
                          type="number"
                          value={draft.timeStopMinutes}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              timeStopMinutes: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.maxTradesPerDay")}
                        </div>
                        <Input
                          type="number"
                          value={draft.maxTradesPerDay}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              maxTradesPerDay: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {t("orb.controls.maxDailyLossPct")}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.maxDailyLossPct}
                          onChange={(event) => {
                            setDraft((prev) => ({
                              ...prev,
                              maxDailyLossPct: event.target.value,
                            }))
                            setDirty(true)
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={handleSave} disabled={!dirty || saving || !canWrite}>
                  {saving ? t("orb.saving") : t("orb.save")}
                </Button>
                {dirty ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraft(controls ? buildDraftFromControls(controls) : DEFAULT_DRAFT)
                      setDirty(false)
                    }}
                  >
                    {t("orb.reset")}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("orb.status.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("orb.status.state")}</span>
                <span>{stateDoc?.status || t("common.na")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("orb.status.session")}</span>
                <span>{stateDoc?.sessionKey || t("common.na")}</span>
              </div>
              <Separator />
              {activeMode === "daily_universe" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastUniverse")}</span>
                    <span>{formatTimestamp(stateDoc?.lastUniverseAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastOpenRange")}</span>
                    <span>{formatTimestamp(stateDoc?.lastOpenRangeAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastBreakout")}</span>
                    <span>{formatTimestamp(stateDoc?.lastBreakoutAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastLiquidation")}</span>
                    <span>{formatTimestamp(stateDoc?.lastLiquidationAt)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.nextOpenRange")}</span>
                    <span>{stateDoc?.nextOpenRangeLabel || t("common.na")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.nextBreakout")}</span>
                    <span>{stateDoc?.nextBreakoutLabel || t("common.na")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("orb.status.nextLiquidation")}
                    </span>
                    <span>{stateDoc?.nextLiquidationLabel || t("common.na")}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastOpenRange")}</span>
                    <span>{formatTimestamp(stateDoc?.lastOpenRangeAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastEntryCheck")}</span>
                    <span>{formatTimestamp(stateDoc?.lastEntryCheckAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastEntry")}</span>
                    <span>{formatTimestamp(stateDoc?.lastEntryAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.lastExit")}</span>
                    <span>{formatTimestamp(stateDoc?.lastExitAt)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.nextOpenRange")}</span>
                    <span>{stateDoc?.nextOpenRangeLabel || t("common.na")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("orb.status.nextEntry")}</span>
                    <span>{stateDoc?.nextEntryLabel || t("common.na")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("orb.status.nextLiquidation")}
                    </span>
                    <span>{stateDoc?.nextLiquidationLabel || t("common.na")}</span>
                  </div>
                </>
              )}
              {stateDoc?.lastError ? (
                <>
                  <Separator />
                  <div className="text-xs text-rose-600">{stateDoc.lastError}</div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="order-2 space-y-6 lg:order-3 lg:col-span-12">
          {activeMode === "daily_universe" ? (
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4" />
                    {t("orb.universe.title")}
                  </CardTitle>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("orb.universe.rangeWindowLabel")}
                    </div>
                    <div className="text-xs font-medium">{orbRangeWindowLabel}</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("orb.universe.currentTimeLabel")}
                    </div>
                    <div className="text-xs font-medium">
                      {currentEtLabel || t("common.na")}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("orb.universe.capturedAtLabel")}
                    </div>
                    <div className="text-xs font-medium">{capturedLabel}</div>
                  </div>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  {t("orb.universe.statusLegend")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {universe.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {t("orb.universe.empty")}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("orb.universe.symbol")}</TableHead>
                        <TableHead>{t("orb.universe.price")}</TableHead>
                        <TableHead>{t("orb.universe.volume")}</TableHead>
                        <TableHead>{t("orb.universe.dollarVolume")}</TableHead>
                        <TableHead>{orbHighHeader}</TableHead>
                        <TableHead>{t("orb.universe.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {universe.map((item) => {
                        const orbHigh = orbHighs[item.symbol]
                        const statusLabel = !rangeComplete
                          ? t("orb.universe.rangePending")
                          : tradedSymbols.has(item.symbol)
                          ? t("orb.universe.traded")
                          : t("orb.universe.pending")
                        return (
                          <TableRow key={item.symbol}>
                            <TableCell className="font-medium">{item.symbol}</TableCell>
                            <TableCell>{formatAssetPrice(item.price, "stock")}</TableCell>
                            <TableCell>{formatNumber(item.volume)}</TableCell>
                            <TableCell>{formatNumber(item.dollarVolume)}</TableCell>
                            <TableCell>{formatAssetPrice(orbHigh, "stock")}</TableCell>
                            <TableCell>
                              <Badge
                                variant={tradedSymbols.has(item.symbol) ? "secondary" : "outline"}
                              >
                                {statusLabel}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4" />
                  {t("orb.context.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!stateDoc?.symbol ? (
                  <div className="text-sm text-muted-foreground">{t("orb.context.empty")}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("orb.context.symbol")}</TableHead>
                        <TableHead>{t("orb.context.price")}</TableHead>
                        <TableHead>{t("orb.context.orbHigh")}</TableHead>
                        <TableHead>{t("orb.context.orbLow")}</TableHead>
                        <TableHead>{t("orb.context.vwap")}</TableHead>
                        <TableHead>{t("orb.context.atr")}</TableHead>
                        <TableHead>{t("orb.context.bars")}</TableHead>
                        <TableHead>{t("orb.context.position")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow key={stateDoc.symbol}>
                        <TableCell className="font-medium">{stateDoc.symbol}</TableCell>
                        <TableCell>{formatAssetPrice(stateDoc.lastPrice, "stock")}</TableCell>
                        <TableCell>{formatAssetPrice(orbRange?.high, "stock")}</TableCell>
                        <TableCell>{formatAssetPrice(orbRange?.low, "stock")}</TableCell>
                        <TableCell>{formatAssetPrice(stateDoc.vwap, "stock")}</TableCell>
                        <TableCell>{formatAssetPrice(stateDoc.atr, "stock")}</TableCell>
                        <TableCell>{formatNumber(stateDoc.barsSinceBreakout)}</TableCell>
                        <TableCell>
                          <Badge variant={stateDoc.inPosition ? "secondary" : "outline"}>
                            {positionBadge}
                          </Badge>
                          {stateDoc.activeStop ? (
                            <div className="text-xs text-muted-foreground">
                              {t("orb.context.stop", {
                                stop: formatAssetPrice(stateDoc.activeStop, "stock"),
                              })}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4" />
                {t("orb.orders.title")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("orb.orders.help")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("orb.orders.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("orb.orders.symbol")}</TableHead>
                      <TableHead>{t("orb.orders.side")}</TableHead>
                      <TableHead>{t("orb.orders.qty")}</TableHead>
                      <TableHead>{t("orb.orders.price")}</TableHead>
                      <TableHead>{t("orb.orders.status")}</TableHead>
                      <TableHead>{t("orb.orders.timing")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const snapshot = request.orderSnapshot
                      const orderType = snapshot?.orderType || "limit"
                      const orderTypeLabel = orderType === "market" ? "MKT" : "LIMIT"
                      const priceLabel =
                        orderType === "market"
                          ? "MKT"
                          : formatAssetPrice(snapshot?.limitPrice, "stock")
                      const timeInForce = snapshot?.timeInForce || "DAY"
                      const statusLabel = request.status
                        ? t(`ibkr.status.${request.status}`)
                        : t("common.na")
                      const modeLabel = request.mode ? t(`ibkr.mode.${request.mode}`) : t("common.na")
                      const priceMetaParts = [orderTypeLabel, timeInForce]
                      if (typeof snapshot?.stopLoss === "number") {
                        priceMetaParts.push(
                          t("orb.orders.stopLoss", {
                            value: formatAssetPrice(snapshot.stopLoss, "stock"),
                          })
                        )
                      }
                      if (typeof snapshot?.takeProfit === "number") {
                        priceMetaParts.push(
                          t("orb.orders.takeProfit", {
                            value: formatAssetPrice(snapshot.takeProfit, "stock"),
                          })
                        )
                      }
                      const priceMeta = priceMetaParts.filter(Boolean).join(" | ")
                      const statusMeta = [statusLabel, modeLabel].filter(Boolean).join(" | ")
                      const timingParts = []
                      if (request.submittedAt) {
                        timingParts.push(
                          `${t("orb.orders.timingSubmitted")}: ${formatTimestamp(request.submittedAt)}`
                        )
                      }
                      if (request.filledAt) {
                        timingParts.push(
                          `${t("orb.orders.timingFilled")}: ${formatTimestamp(request.filledAt)}`
                        )
                      }
                      if (!request.filledAt && request.updatedAt) {
                        timingParts.push(
                          `${t("orb.orders.timingUpdated")}: ${formatTimestamp(request.updatedAt)}`
                        )
                      }
                      const timingMeta = timingParts.join(" | ")
                      return (
                        <TableRow key={request.id}>
                          <TableCell>{snapshot?.symbol || "—"}</TableCell>
                          <TableCell className="uppercase">{snapshot?.side || "—"}</TableCell>
                          <TableCell>{formatNumber(snapshot?.quantity)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{priceLabel}</span>
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {priceMeta}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            <div className="flex flex-col gap-1">
                              <span className="uppercase text-foreground">{statusMeta}</span>
                              {request.statusReason ? (
                                <span className="text-amber-700">{request.statusReason}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            <div className="flex flex-col gap-1">
                              <span>
                                {t("orb.orders.timingCreated")}: {formatTimestamp(request.createdAt)}
                              </span>
                              {timingMeta ? <span>{timingMeta}</span> : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="order-3 space-y-6 lg:order-2 lg:col-span-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {t("orb.replay.title")}
                </CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={t("orb.replay.help.trigger")}
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("orb.replay.help.title")}</DialogTitle>
                      <DialogDescription>{t("orb.replay.help.intro")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div className="space-y-2">
                        <div className="font-medium">{t("orb.replay.help.stepsTitle")}</div>
                        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                          <li>{t("orb.replay.help.steps.step1")}</li>
                          <li>{t("orb.replay.help.steps.step2")}</li>
                          <li>{t("orb.replay.help.steps.step3")}</li>
                          <li>{t("orb.replay.help.steps.step4")}</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium">{t("orb.replay.help.autoTitle")}</div>
                        <p className="text-muted-foreground">
                          {t("orb.replay.help.autoBody")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium">{t("orb.replay.help.runTitle")}</div>
                        <p className="text-muted-foreground">
                          {t("orb.replay.help.runBody")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium">{t("orb.replay.help.loopTitle")}</div>
                        <p className="text-muted-foreground">
                          {t("orb.replay.help.loopBody")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium">{t("orb.replay.help.safetyTitle")}</div>
                        <p className="text-muted-foreground">
                          {t("orb.replay.help.safetyBody")}
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="text-xs text-muted-foreground">{t("orb.replay.subtitle")}</div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("orb.replay.statusLabel")}</span>
                <Badge variant={replayMode ? "secondary" : "outline"}>
                  {replayMode
                    ? replayPhase === "running"
                      ? t("orb.replay.statusRunning")
                      : t("orb.replay.statusPaused")
                    : t("orb.replay.statusDisabled")}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("orb.replay.sessionLabel")}</span>
                <span>{replayDateKey || t("common.na")}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("orb.replay.asOfLabel")}</span>
                <span>
                  {replayAsOfDate
                    ? t("orb.replay.asOfValue", { et: replayAsOfEt, local: replayAsOfLocal })
                    : t("common.na")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleReplayPhase("paused")}
                  disabled={
                    !replayReady ||
                    replayUpdating ||
                    replayPhase === "paused" ||
                    runUntilActive
                  }
                >
                  {t("orb.replay.pause")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleReplayPhase("running")}
                  disabled={
                    !replayReady ||
                    replayUpdating ||
                    replayPhase === "running" ||
                    runUntilActive
                  }
                >
                  {t("orb.replay.resume")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRunOrb}
                  disabled={!replayReady || orbRunLoading || runCooldownActive || runUntilActive}
                >
                  {orbRunLoading
                    ? t("orb.replay.runRunning")
                    : runCooldownActive
                    ? t("orb.replay.runQueuedLabel")
                    : t("orb.replay.run")}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {replayMode
                  ? replayPhase === "running"
                    ? t("orb.replay.autoHint")
                    : t("orb.replay.pausedHint")
                  : t("orb.replay.disabledHint")}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("orb.replay.lastRunRequested")}</span>
                  <span>
                    {lastRunAt ? lastRunAt.toLocaleString() : t("common.na")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("orb.replay.ordersSinceRun")}</span>
                  <span>
                    {lastRunMs
                      ? ordersSinceRunSymbols
                        ? `${ordersSinceRun} · ${ordersSinceRunSymbols}`
                        : String(ordersSinceRun)
                      : t("common.na")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("orb.replay.lastRobotUpdate")}</span>
                  <span>{formatTimestamp(stateDoc?.updatedAt)}</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="text-xs font-medium">{t("orb.replay.runUntil.title")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("orb.replay.runUntil.hint")}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {t("orb.replay.runUntil.targetLabel")}
                  </span>
                  <Button
                    type="button"
                    variant={runUntilTarget === "next_order" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setRunUntilTarget("next_order")}
                    disabled={runUntilActive}
                  >
                    {t("orb.replay.runUntil.targetOrder")}
                  </Button>
                  <Button
                    type="button"
                    variant={runUntilTarget === "time" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setRunUntilTarget("time")}
                    disabled={runUntilActive}
                  >
                    {t("orb.replay.runUntil.targetTime")}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {t("orb.replay.runUntil.stepLabel")}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    inputMode="numeric"
                    className="h-8 w-20"
                    value={runUntilStepMinutes}
                    onChange={(event) => setRunUntilStepMinutes(event.target.value)}
                    disabled={runUntilActive}
                  />
                  <span className="text-muted-foreground">{t("orb.replay.runUntil.stepUnit")}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {runUntilTarget === "time"
                      ? t("orb.replay.runUntil.stopLabelTime")
                      : t("orb.replay.runUntil.stopLabelOrder")}
                  </span>
                  <Input
                    type="text"
                    placeholder={runUntilStopPlaceholder}
                    className="h-8 w-24"
                    value={runUntilStopTime}
                    onChange={(event) => setRunUntilStopTime(event.target.value)}
                    disabled={runUntilActive}
                  />
                  <span className="text-muted-foreground">ET</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRunUntil}
                    disabled={
                      !replayReady ||
                      replayUpdating ||
                      runUntilActive ||
                      replayPhase === "running"
                    }
                  >
                    {runUntilActive
                      ? t("orb.replay.runUntil.running")
                      : runUntilTarget === "next_order"
                      ? t("orb.replay.runUntil.actionOrder")
                      : t("orb.replay.runUntil.actionTime")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRunUntilStop}
                    disabled={!runUntilActive}
                  >
                    {t("orb.replay.runUntil.stop")}
                  </Button>
                </div>
                {runUntilStatus ? (
                  <div className="text-xs text-muted-foreground">{runUntilStatus}</div>
                ) : null}
              </div>
              <Separator />
              <div className="text-xs font-medium">{t("orb.replay.steps.title")}</div>
              <div className="space-y-2">
                {replaySteps.map((step) => (
                  <div
                    key={step.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{step.label}</div>
                      <div className="text-xs text-muted-foreground">{step.hint}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleReplayStep(step.minutes, step.label)}
                      disabled={!replayReady || replayUpdating || runUntilActive}
                    >
                      {formatEtTime(step.minutes)}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
      <Dialog open={confirmLiveOpen} onOpenChange={(next) => (!next ? cancelLiveMode() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ibkr.mode.liveConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("ibkr.mode.liveConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelLiveMode}>
              {t("ibkr.mode.liveCancel")}
            </Button>
            <Button variant="destructive" onClick={confirmLiveMode}>
              {t("ibkr.mode.liveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
