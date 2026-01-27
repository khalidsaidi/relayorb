import { useEffect, useMemo, useRef, useState } from "react"
import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { fromZonedTime } from "date-fns-tz"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { db, firebaseEnabled } from "@/lib/firebase"
import { formatNumber, formatRelativeTimestamp, formatTimestamp } from "@/lib/format"
import { useAuth } from "@/features/auth/auth-context"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { useReplayConsumers } from "@/features/replay/use-replay-consumers"
import { useReplayRuns } from "@/features/replay/use-replay-runs"
import { ChevronDown } from "lucide-react"

const DEFAULT_REQUIRED_SERVICES = [
  "mdg",
  "price-streamer",
  "market-intel",
  "signal-evaluator",
]
const DEFAULT_REPLAY_SPEED = "1"
const DEFAULT_REPLAY_BOTS_ENABLED = false
const DEFAULT_TAPE_LOOKBACK_DAYS = "120"
const DEFAULT_TAPE_INTRADAY_LOOKBACK_DAYS = "2"
const DEFAULT_TAPE_MAX_SYMBOLS = "500"
const DEFAULT_TAPE_INCLUDE_NEWS = false
const DEFAULT_TAPE_INCLUDE_PROFILE = true
const DEFAULT_TAPE_INCLUDE_SHARES_FLOAT = true
const DEFAULT_TAPE_SYMBOLS_PATH = "/replay-default-symbols.json"
const DEFAULT_AUTO_DISCOVER_SMALL_CAP_MIN = "5000000"
const DEFAULT_AUTO_DISCOVER_SMALL_CAP_MAX = "80000000"
const DEFAULT_AUTO_DISCOVER_SMALL_CAP_VOLUME = "50000"
const DEFAULT_AUTO_DISCOVER_MID_CAP_MIN = "1000000000"
const DEFAULT_AUTO_DISCOVER_MID_CAP_MAX = "50000000000"
const DEFAULT_AUTO_DISCOVER_MID_CAP_VOLUME = "500000"
const ET_TIMEZONE = "America/New_York"
const MARKET_DATA_PROXY_URL = (import.meta.env.VITE_MARKET_DATA_PROXY_URL || "").replace(
  /\/+$/,
  ""
)
const MARKET_DATA_GATEWAY_URL = (import.meta.env.VITE_MARKET_DATA_GATEWAY_URL || "").replace(
  /\/+$/,
  ""
)
const MARKET_DATA_BASE = (MARKET_DATA_PROXY_URL || MARKET_DATA_GATEWAY_URL || "").replace(
  /\/+$/,
  ""
)
const MARKET_DATA_AUTH_ENABLED = (() => {
  const flag = import.meta.env.VITE_MARKET_DATA_GATEWAY_AUTH
  if (flag === "true") return true
  if (flag === "false") return false
  return Boolean(MARKET_DATA_PROXY_URL && MARKET_DATA_BASE === MARKET_DATA_PROXY_URL)
})()

type SymbolSourceOption = "default" | "auto" | "custom"

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function toLocalInput(ts?: unknown) {
  if (!ts) return ""
  let date: Date | null = null
  if (ts instanceof Date) {
    date = ts
  } else if (typeof ts === "number") {
    date = new Date(ts)
  } else if (typeof (ts as { toDate?: () => Date })?.toDate === "function") {
    date = (ts as { toDate: () => Date }).toDate()
  } else if (typeof ts === "string") {
    date = new Date(ts)
  }
  if (!date || !Number.isFinite(date.getTime())) return ""
  const pad = (num: number) => String(num).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function parseLocalInput(value: string) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed
}

function parseOptionalInt(value: string) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  if (!entries.length) return null
  return Object.fromEntries(entries) as Partial<T>
}

function parseSymbolsInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((item) => String(item).trim().toUpperCase())
              .filter(Boolean)
          )
        )
      }
    } catch {
      // Fall back to parsing as a delimiter-separated string.
    }
  }
  const unique = new Set<string>()
  trimmed
    .split(/[\s,]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .forEach((symbol) => unique.add(symbol))
  return Array.from(unique)
}

function getEtDateKey(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  if (!lookup.year || !lookup.month || !lookup.day) return ""
  return `${lookup.year}-${lookup.month}-${lookup.day}`
}

function extractDateKey(value?: string | null) {
  if (!value) return ""
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : ""
}

function buildEtDateTime(dateKey: string, hours: number, minutes: number) {
  if (!dateKey) return null
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return null
  const hh = String(hours).padStart(2, "0")
  const mm = String(minutes).padStart(2, "0")
  const iso = `${year}-${month}-${day}T${hh}:${mm}:00`
  const base = new Date(iso)
  if (!Number.isFinite(base.getTime())) return null
  return fromZonedTime(base, ET_TIMEZONE)
}

export function ReplayControlsPanel() {
  const { t } = useTranslation()
  const { controls } = useReplayControls()
  const { consumerMap } = useReplayConsumers()
  const { runs, runMap, error: runsError } = useReplayRuns()
  const { user } = useAuth()

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advancedContentRef = useRef<HTMLDivElement | null>(null)
  const [selectedRunId, setSelectedRunId] = useState("")
  const [runIdInput, setRunIdInput] = useState("")
  const [datasetIdInput, setDatasetIdInput] = useState("")
  const [requiredInput, setRequiredInput] = useState("")
  const [speedInput, setSpeedInput] = useState("")
  const [asOfInput, setAsOfInput] = useState("")
  const [botsReplayEnabledInput, setBotsReplayEnabledInput] = useState<boolean | null>(null)
  const [tapeDateInput, setTapeDateInput] = useState(() => getEtDateKey(new Date()))
  const [tapeDatasetInput, setTapeDatasetInput] = useState(() => getEtDateKey(new Date()))
  const [tapeLookbackDaysInput, setTapeLookbackDaysInput] = useState(DEFAULT_TAPE_LOOKBACK_DAYS)
  const [tapeIntradayLookbackDaysInput, setTapeIntradayLookbackDaysInput] = useState(
    DEFAULT_TAPE_INTRADAY_LOOKBACK_DAYS
  )
  const [tapeMaxSymbolsInput, setTapeMaxSymbolsInput] = useState(DEFAULT_TAPE_MAX_SYMBOLS)
  const [symbolSourceInput, setSymbolSourceInput] = useState<SymbolSourceOption>("default")
  const [tapeIncludeNews, setTapeIncludeNews] = useState(DEFAULT_TAPE_INCLUDE_NEWS)
  const [tapeIncludeProfile, setTapeIncludeProfile] = useState(DEFAULT_TAPE_INCLUDE_PROFILE)
  const [tapeIncludeSharesFloat, setTapeIncludeSharesFloat] = useState(
    DEFAULT_TAPE_INCLUDE_SHARES_FLOAT
  )
  const [tapeSymbolsInput, setTapeSymbolsInput] = useState("")
  const [defaultSymbols, setDefaultSymbols] = useState<string[]>([])
  const [autoDiscoverIncludeUniverse, setAutoDiscoverIncludeUniverse] = useState(true)
  const [autoDiscoverSmallCapMin, setAutoDiscoverSmallCapMin] = useState(
    DEFAULT_AUTO_DISCOVER_SMALL_CAP_MIN
  )
  const [autoDiscoverSmallCapMax, setAutoDiscoverSmallCapMax] = useState(
    DEFAULT_AUTO_DISCOVER_SMALL_CAP_MAX
  )
  const [autoDiscoverSmallCapVolume, setAutoDiscoverSmallCapVolume] = useState(
    DEFAULT_AUTO_DISCOVER_SMALL_CAP_VOLUME
  )
  const [autoDiscoverMidCapMin, setAutoDiscoverMidCapMin] = useState(
    DEFAULT_AUTO_DISCOVER_MID_CAP_MIN
  )
  const [autoDiscoverMidCapMax, setAutoDiscoverMidCapMax] = useState(
    DEFAULT_AUTO_DISCOVER_MID_CAP_MAX
  )
  const [autoDiscoverMidCapVolume, setAutoDiscoverMidCapVolume] = useState(
    DEFAULT_AUTO_DISCOVER_MID_CAP_VOLUME
  )
  const [runLabelInput, setRunLabelInput] = useState("")
  const [runLabelTouched, setRunLabelTouched] = useState(false)
  const [registerRun, setRegisterRun] = useState(true)
  const [tapeSymbolsLoaded, setTapeSymbolsLoaded] = useState(false)
  const [tapeBuildBusy, setTapeBuildBusy] = useState(false)
  const [tapeBuildStatus, setTapeBuildStatus] = useState<{
    tone: "success" | "error"
    message: string
  } | null>(null)
  const [marketIntelBusy, setMarketIntelBusy] = useState(false)

  const resolvedRunId = (runIdInput || selectedRunId || controls?.activeRunId || "").trim()
  const selectedRun = resolvedRunId ? runMap.get(resolvedRunId) : undefined
  const runIdValue = resolvedRunId
  const datasetIdValue = (datasetIdInput || selectedRun?.datasetId || controls?.datasetId || "").trim()
  const requiredInputValue =
    requiredInput ||
    (Array.isArray(controls?.requiredServices) && controls?.requiredServices.length
      ? controls.requiredServices.filter((service) => service !== "ui").join(", ")
      : DEFAULT_REQUIRED_SERVICES.join(", "))
  const speedInputValue =
    speedInput ||
    (() => {
      const segment = controls?.speedScript?.[0]
      if (
        segment &&
        typeof segment === "object" &&
        typeof (segment as { speed?: number }).speed === "number"
      ) {
        return String((segment as { speed: number }).speed)
      }
      return DEFAULT_REPLAY_SPEED
    })()
  const selectedTapeDate =
    selectedRun?.tapeDate ||
    extractDateKey(selectedRun?.datasetId) ||
    extractDateKey(datasetIdValue)
  const defaultAsOf = selectedTapeDate ? buildEtDateTime(selectedTapeDate, 9, 30) : null
  const asOfInputValue =
    asOfInput ||
    (controls?.asOf
      ? toLocalInput(controls.asOf)
      : defaultAsOf
        ? toLocalInput(defaultAsOf)
        : "")
  const botsReplayEnabled =
    botsReplayEnabledInput ??
    (typeof controls?.botsReplayEnabled === "boolean"
      ? controls.botsReplayEnabled
      : DEFAULT_REPLAY_BOTS_ENABLED)
  const showCustomRun = Boolean(runIdValue && !runMap.has(runIdValue))
  const selectedRunLabel =
    selectedRun?.label || selectedRun?.datasetId || selectedRun?.runId || ""
  const selectedRunTapeDate =
    selectedRun?.tapeDate || extractDateKey(datasetIdValue) || ""
  const selectedRunSymbolCountValue =
    typeof selectedRun?.symbolCount === "number" ? selectedRun.symbolCount : null
  const selectedRunSymbolCount =
    selectedRunSymbolCountValue !== null ? String(selectedRunSymbolCountValue) : ""
  const selectedRunSymbolSource =
    typeof selectedRun?.symbolSource === "string" ? selectedRun.symbolSource : ""
  const selectedRunMaxSymbols =
    typeof selectedRun?.maxSymbols === "number" ? selectedRun.maxSymbols : null
  const symbolList = useMemo(() => parseSymbolsInput(tapeSymbolsInput), [tapeSymbolsInput])
  const parsedMaxSymbols = Number.parseInt(
    tapeMaxSymbolsInput || DEFAULT_TAPE_MAX_SYMBOLS,
    10
  )
  const maxSymbolsNumber = Number.isFinite(parsedMaxSymbols)
    ? Math.max(1, Math.round(parsedMaxSymbols))
    : Number.parseInt(DEFAULT_TAPE_MAX_SYMBOLS, 10)
  const lookbackDays =
    parseOptionalInt(tapeLookbackDaysInput) ?? Number.parseInt(DEFAULT_TAPE_LOOKBACK_DAYS, 10)
  const intradayLookbackDays =
    parseOptionalInt(tapeIntradayLookbackDaysInput) ??
    Number.parseInt(DEFAULT_TAPE_INTRADAY_LOOKBACK_DAYS, 10)
  const autoDiscoverSmallCapMinValue =
    parseOptionalInt(autoDiscoverSmallCapMin) ??
    Number.parseInt(DEFAULT_AUTO_DISCOVER_SMALL_CAP_MIN, 10)
  const autoDiscoverSmallCapMaxValue =
    parseOptionalInt(autoDiscoverSmallCapMax) ??
    Number.parseInt(DEFAULT_AUTO_DISCOVER_SMALL_CAP_MAX, 10)
  const autoDiscoverSmallCapVolumeValue =
    parseOptionalInt(autoDiscoverSmallCapVolume) ??
    Number.parseInt(DEFAULT_AUTO_DISCOVER_SMALL_CAP_VOLUME, 10)
  const autoDiscoverMidCapMinValue =
    parseOptionalInt(autoDiscoverMidCapMin) ??
    Number.parseInt(DEFAULT_AUTO_DISCOVER_MID_CAP_MIN, 10)
  const autoDiscoverMidCapMaxValue =
    parseOptionalInt(autoDiscoverMidCapMax) ??
    Number.parseInt(DEFAULT_AUTO_DISCOVER_MID_CAP_MAX, 10)
  const autoDiscoverMidCapVolumeValue =
    parseOptionalInt(autoDiscoverMidCapVolume) ??
    Number.parseInt(DEFAULT_AUTO_DISCOVER_MID_CAP_VOLUME, 10)
  const symbolSource = symbolSourceInput
  const tapeAutoDiscover = symbolSource === "auto"
  const customSymbolCount = symbolList.length
  const defaultSymbolCount = defaultSymbols.length
  const selectedSymbolCount =
    symbolSource === "auto"
      ? maxSymbolsNumber
      : symbolSource === "default"
      ? defaultSymbolCount
      : customSymbolCount
  const recordingExtras = useMemo(() => {
    const extras: string[] = []
    if (tapeIncludeProfile) extras.push(t("replay.controls.recordingScopeProfile"))
    if (tapeIncludeSharesFloat) extras.push(t("replay.controls.recordingScopeFloat"))
    if (tapeIncludeNews) extras.push(t("replay.controls.recordingScopeNews"))
    return extras
  }, [t, tapeIncludeProfile, tapeIncludeSharesFloat, tapeIncludeNews])
  const recordingScopeLine = useMemo(() => {
    const symbolsSummary =
      symbolSource === "auto"
        ? t("replay.controls.recordingScopeSymbolsAuto", { count: maxSymbolsNumber })
        : symbolSource === "default"
        ? t("replay.controls.recordingScopeSymbolsDefault", { count: selectedSymbolCount })
        : symbolSource === "custom"
        ? t("replay.controls.recordingScopeSymbolsCustom", { count: selectedSymbolCount })
        : t("replay.controls.recordingScopeSymbolsUnset")
    const parts = [
      t("replay.controls.recordingScopeStocks"),
      t("replay.controls.recordingScopeBars"),
      t("replay.controls.recordingScopeLookback", { days: lookbackDays }),
      intradayLookbackDays > 0
        ? t("replay.controls.recordingScopeIntraday", { days: intradayLookbackDays })
        : null,
      symbolsSummary,
    ]
    return parts.filter(Boolean).join(" | ")
  }, [
    symbolSource,
    maxSymbolsNumber,
    lookbackDays,
    intradayLookbackDays,
    t,
    selectedSymbolCount,
  ])
  const recordingExtrasLine = useMemo(() => {
    if (!recordingExtras.length) return ""
    return t("replay.controls.recordingScopeExtras", {
      extras: recordingExtras.join(", "),
    })
  }, [recordingExtras, t])
  const recordingSourceLine = useMemo(() => {
    if (symbolSource === "auto") {
      return t("replay.controls.recordingScopeSourceAuto")
    }
    if (symbolSource === "default") {
      return t("replay.controls.recordingScopeSourceDefault", { count: selectedSymbolCount })
    }
    if (symbolSource === "custom") {
      return t("replay.controls.recordingScopeSourceCustom", { count: selectedSymbolCount })
    }
    return t("replay.controls.recordingScopeSourceUnset")
  }, [symbolSource, selectedSymbolCount, t])
  const generatedRunLabel = useMemo(() => {
    const sourceLabel =
      symbolSource === "auto"
        ? t("replay.controls.tape.runLabelSourceAuto", { count: maxSymbolsNumber })
        : symbolSource === "default"
        ? t("replay.controls.tape.runLabelSourceDefault", { count: selectedSymbolCount })
        : symbolSource === "custom"
        ? t("replay.controls.tape.runLabelSourceCustom", { count: selectedSymbolCount })
        : t("replay.controls.tape.runLabelSourceUnset")
    const dateLabel = tapeDateInput.trim() || tapeDatasetInput.trim() || getEtDateKey(new Date())
    return t("replay.controls.tape.runLabelTemplate", {
      date: dateLabel,
      source: sourceLabel,
    })
  }, [
    symbolSource,
    maxSymbolsNumber,
    tapeDateInput,
    tapeDatasetInput,
    selectedSymbolCount,
    t,
  ])
  const autoDiscoverSummaryLine = useMemo(() => {
    if (!tapeAutoDiscover) return ""
    const universeLabel = autoDiscoverIncludeUniverse
      ? t("replay.controls.autoDiscover.summaryUniverseOn")
      : t("replay.controls.autoDiscover.summaryUniverseOff")
    return t("replay.controls.autoDiscover.summary", {
      universe: universeLabel,
      smallMin: formatNumber(autoDiscoverSmallCapMinValue),
      smallMax: formatNumber(autoDiscoverSmallCapMaxValue),
      smallVol: formatNumber(autoDiscoverSmallCapVolumeValue),
      midMin: formatNumber(autoDiscoverMidCapMinValue),
      midMax: formatNumber(autoDiscoverMidCapMaxValue),
      midVol: formatNumber(autoDiscoverMidCapVolumeValue),
    })
  }, [
    tapeAutoDiscover,
    autoDiscoverIncludeUniverse,
    autoDiscoverSmallCapMinValue,
    autoDiscoverSmallCapMaxValue,
    autoDiscoverSmallCapVolumeValue,
    autoDiscoverMidCapMinValue,
    autoDiscoverMidCapMaxValue,
    autoDiscoverMidCapVolumeValue,
    t,
  ])
  const selectedRunSourceLabel = useMemo(() => {
    if (!selectedRunSymbolSource) return ""
    if (selectedRunSymbolSource === "auto") {
      const maxLabel =
        selectedRunMaxSymbols !== null
          ? String(selectedRunMaxSymbols)
          : selectedRunSymbolCount || t("common.na")
      return t("replay.controls.runDetails.sourceAuto", { count: maxLabel })
    }
    if (selectedRunSymbolSource === "default") {
      return t("replay.controls.recordingScopeSourceDefault", {
        count: selectedRunSymbolCount || t("common.na"),
      })
    }
    if (selectedRunSymbolSource === "custom") {
      return t("replay.controls.recordingScopeSourceCustom", {
        count: selectedRunSymbolCount || t("common.na"),
      })
    }
    return ""
  }, [
    selectedRunSymbolSource,
    selectedRunSymbolCount,
    selectedRunMaxSymbols,
    t,
  ])
  const selectedRunAutoDiscoverSummaryLine = useMemo(() => {
    if (selectedRunSymbolSource !== "auto") return ""
    const config = selectedRun?.autoDiscoverConfig
    if (!config || typeof config !== "object") {
      return t("replay.controls.runDetails.constraintsUnknown")
    }
    const universeLabel =
      config.includeUniverse === false
        ? t("replay.controls.autoDiscover.summaryUniverseOff")
        : t("replay.controls.autoDiscover.summaryUniverseOn")
    return t("replay.controls.autoDiscover.summary", {
      universe: universeLabel,
      smallMin: formatNumber(config.smallCapMinMarketCap),
      smallMax: formatNumber(config.smallCapMaxMarketCap),
      smallVol: formatNumber(config.smallCapMinVolume),
      midMin: formatNumber(config.midCapMinMarketCap),
      midMax: formatNumber(config.midCapMaxMarketCap),
      midVol: formatNumber(config.midCapMinVolume),
    })
  }, [selectedRunSymbolSource, selectedRun?.autoDiscoverConfig, t])
  const gatewayBase = MARKET_DATA_BASE
  const marketIntelJob = useMemo(
    () => (import.meta.env.VITE_MARKET_INTEL_JOB || "relayorb-market-intel").trim(),
    []
  )

  const requiredServices = useMemo(() => {
    const parsed = parseList(requiredInputValue)
    return parsed.length ? parsed : DEFAULT_REQUIRED_SERVICES
  }, [requiredInputValue])
  const requiredServicesFiltered = useMemo(
    () => requiredServices.filter((service) => service !== "ui"),
    [requiredServices]
  )

  const ackStatus = useMemo(() => {
    return requiredServicesFiltered.map((serviceName) => {
      const consumer = consumerMap.get(serviceName)
      const versionMatch =
        consumer?.seenControlsVersion !== undefined &&
        consumer?.seenControlsVersion === controls?.version
      const sessionMatch = consumer?.sessionId && controls?.sessionId === consumer.sessionId
      const modeMatch = consumer?.effectiveMode === controls?.desiredMode
      const acked = Boolean(versionMatch && sessionMatch && modeMatch)
      return { serviceName, consumer, acked }
    })
  }, [consumerMap, requiredServicesFiltered, controls?.version, controls?.sessionId, controls?.desiredMode])

  const canWrite = Boolean(firebaseEnabled && db)
  const marketIntelDisabledReason = useMemo(() => {
    if (!firebaseEnabled || !db) return t("tradeNow.firebaseNotConfigured")
    if (!user) return t("tradeNow.mustBeSignedIn")
    if (!marketIntelJob) return t("replay.controls.refreshNotConfigured")
    return ""
  }, [firebaseEnabled, db, user, marketIntelJob, t])
  const desiredMode = controls?.desiredMode || "live"
  const phase = controls?.phase || "ready"
  const isReplay = desiredMode === "replay"
  const ackedCount = ackStatus.filter((item) => item.acked).length
  const totalRequired = requiredServicesFiltered.length
  const allAcked = totalRequired > 0 && ackedCount === totalRequired
  const replayActive = desiredMode === "replay" && phase === "running" && allAcked
  const replayPending = desiredMode === "replay" && !replayActive
  const statusLabel = replayActive
    ? t("replay.controls.statusReplay")
    : replayPending
    ? t("replay.controls.statusPending")
    : t("replay.controls.statusLive")
  const statusVariant = replayActive ? "default" : replayPending ? "secondary" : "outline"
  const playbackLabel = isReplay
    ? phase === "paused"
      ? t("replay.controls.playbackPaused")
      : t("replay.controls.playbackRunning")
    : t("replay.controls.playbackStopped")

  useEffect(() => {
    if (!advancedOpen) return
    advancedContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [advancedOpen])

  useEffect(() => {
    if (runLabelTouched) return
    setRunLabelInput(generatedRunLabel)
  }, [generatedRunLabel, runLabelTouched])

  useEffect(() => {
    if (selectedRunId || runIdInput) return
    if (controls?.activeRunId) {
      setSelectedRunId(controls.activeRunId)
      return
    }
    if (runs.length) {
      setSelectedRunId(runs[0].runId)
    }
  }, [selectedRunId, runIdInput, controls?.activeRunId, runs])

  useEffect(() => {
    if (tapeSymbolsLoaded) return
    let cancelled = false
    async function loadDefaultSymbols() {
      try {
        const response = await fetch(DEFAULT_TAPE_SYMBOLS_PATH)
        if (!response.ok) throw new Error("Failed to load default symbols")
        const payload = await response.json()
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.symbols)
            ? payload.symbols
            : []
        const normalized = Array.from(
          new Set(
            list.map((item: unknown) => String(item).trim().toUpperCase()).filter(Boolean)
          )
        )
        if (!cancelled) {
          setDefaultSymbols(normalized)
        }
      } catch {
        // Ignore default symbol load errors.
      } finally {
        if (!cancelled) setTapeSymbolsLoaded(true)
      }
    }
    loadDefaultSymbols()
    return () => {
      cancelled = true
    }
  }, [tapeSymbolsLoaded])

  async function updateControls(patch: Record<string, unknown>, successMessage: string) {
    if (!canWrite || !db) {
      toast.error(t("replay.controls.notAvailable"))
      return
    }
    try {
      const ref = doc(db, "replay", "controls")
      await setDoc(ref, patch, { merge: true })
      toast.success(successMessage)
    } catch {
      toast.error(t("replay.controls.updateFailed"))
    }
  }

  function nextVersion() {
    const current = typeof controls?.version === "number" ? controls.version : 0
    return current + 1
  }

  async function handleApplySettings() {
    const runId = runIdValue.trim()
    const datasetId = datasetIdValue.trim()
    if (!runId || !datasetId) {
      toast.error(t("replay.controls.runIdRequired"))
      return
    }
    const speed = Number(speedInputValue)
    const speedScript = Number.isFinite(speed) ? [{ speed }] : controls?.speedScript
    const asOfParsed = parseLocalInput(asOfInputValue)
    const payload: Record<string, unknown> = {
      activeRunId: runId,
      datasetId,
      requiredServices: requiredServicesFiltered,
      speedScript,
      botsReplayEnabled,
    }
    if (asOfParsed) {
      payload.asOf = Timestamp.fromDate(asOfParsed)
    }
    await updateControls(
      payload,
      t("replay.controls.settingsSaved")
    )
  }

  async function handleSwitchToReplay() {
    const runId = runIdValue.trim()
    const datasetId = datasetIdValue.trim()
    if (!runId || !datasetId) {
      toast.error(t("replay.controls.runIdRequired"))
      return
    }
    const speed = Number(speedInputValue)
    const speedScript = Number.isFinite(speed) ? [{ speed }] : controls?.speedScript
    const asOfParsed = parseLocalInput(asOfInputValue)
    const payload: Record<string, unknown> = {
      desiredMode: "replay",
      phase: "running",
      sessionId: `session-${Date.now()}`,
      version: nextVersion(),
      activeRunId: runId,
      datasetId,
      requiredServices: requiredServicesFiltered,
      speedScript,
      botsReplayEnabled,
    }
    if (asOfParsed) {
      payload.asOf = Timestamp.fromDate(asOfParsed)
    }
    await updateControls(
      payload,
      t("replay.controls.switchQueued")
    )
  }

  async function handleStart() {
    const runId = runIdValue.trim()
    const datasetId = datasetIdValue.trim()
    if (!runId || !datasetId) {
      toast.error(t("replay.controls.runIdRequired"))
      return
    }
    const speed = Number(speedInputValue)
    const speedScript = Number.isFinite(speed) ? [{ speed }] : controls?.speedScript
    const payload: Record<string, unknown> = {
      phase: "running",
    }
    if (runId !== controls?.activeRunId) {
      payload.activeRunId = runId
    }
    if (datasetId !== controls?.datasetId) {
      payload.datasetId = datasetId
    }
    if (speedScript) {
      payload.speedScript = speedScript
    }
    if (botsReplayEnabled !== controls?.botsReplayEnabled) {
      payload.botsReplayEnabled = botsReplayEnabled
    }
    await updateControls(payload, t("replay.controls.started"))
  }

  async function handlePause() {
    await updateControls({ phase: "paused" }, t("replay.controls.paused"))
  }

  async function handleStop() {
    await updateControls(
      {
        desiredMode: "live",
        mode: "live",
        phase: "ready",
        activeRunId: null,
        datasetId: null,
        sessionId: null,
        version: null,
      },
      t("replay.controls.stopped")
    )
  }

  async function handleSeek() {
    const parsed = parseLocalInput(asOfInputValue)
    if (!parsed) {
      toast.error(t("replay.controls.invalidAsOf"))
      return
    }
    const runId = runIdValue.trim()
    const datasetId = datasetIdValue.trim()
    if (!runId || !datasetId) {
      toast.error(t("replay.controls.runIdRequired"))
      return
    }
    const speed = Number(speedInputValue)
    const speedScript = Number.isFinite(speed) ? [{ speed }] : controls?.speedScript
    const payload: Record<string, unknown> = {
      desiredMode: "replay",
      phase: "paused",
      version: nextVersion(),
      sessionId: controls?.sessionId || `session-${Date.now()}`,
      activeRunId: runId,
      datasetId,
      requiredServices: requiredServicesFiltered,
      speedScript,
      botsReplayEnabled,
      asOf: Timestamp.fromDate(parsed),
    }
    await updateControls(payload, t("replay.controls.seekQueued"))
  }

  async function handleBuildTape() {
    if (!gatewayBase) {
      toast.error(t("replay.controls.tape.gatewayMissing"))
      return
    }
    if (MARKET_DATA_AUTH_ENABLED && !user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }
    const date = tapeDateInput.trim()
    if (!date) {
      toast.error(t("replay.controls.tape.dateRequired"))
      return
    }
    if (symbolSource === "auto" && parseOptionalInt(tapeMaxSymbolsInput) === undefined) {
      toast.error(t("replay.controls.tape.maxSymbolsRequired"))
      return
    }
    const datasetId = tapeDatasetInput.trim() || date
    setTapeBuildBusy(true)
    setTapeBuildStatus(null)
    try {
      const payload: Record<string, unknown> = {
        date,
        datasetId,
        assetClass: "stock",
        autoDiscover: tapeAutoDiscover,
        includeNews: tapeIncludeNews,
        includeProfile: tapeIncludeProfile,
        includeSharesFloat: tapeIncludeSharesFloat,
        symbolSource,
      }
      if (registerRun) {
        payload.registerRun = true
        const runLabel = runLabelInput.trim()
        if (runLabel) payload.runLabel = runLabel
      }
      const lookbackDays = parseOptionalInt(tapeLookbackDaysInput)
      if (lookbackDays !== undefined) payload.lookbackDays = lookbackDays
      const intradayLookbackDays = parseOptionalInt(tapeIntradayLookbackDaysInput)
      if (intradayLookbackDays !== undefined) {
        payload.intradayLookbackDays = intradayLookbackDays
      }
      const maxSymbols = parseOptionalInt(tapeMaxSymbolsInput)
      if (maxSymbols !== undefined) payload.maxSymbols = maxSymbols
      const symbols =
        symbolSource === "default"
          ? defaultSymbols
          : symbolSource === "custom"
          ? parseSymbolsInput(tapeSymbolsInput)
          : []
      if (symbolSource === "default" && symbols.length === 0) {
        toast.error(t("replay.controls.tape.defaultSymbolsMissing"))
        return
      }
      if (symbolSource === "custom" && symbols.length === 0) {
        toast.error(t("replay.controls.tape.symbolsRequired"))
        return
      }
      if (symbolSource !== "auto") {
        payload.symbols = symbols
      }

      if (tapeAutoDiscover) {
        const config = compactObject({
          includeUniverse: autoDiscoverIncludeUniverse,
          smallCapMinMarketCap: parseOptionalInt(autoDiscoverSmallCapMin),
          smallCapMaxMarketCap: parseOptionalInt(autoDiscoverSmallCapMax),
          smallCapMinVolume: parseOptionalInt(autoDiscoverSmallCapVolume),
          midCapMinMarketCap: parseOptionalInt(autoDiscoverMidCapMin),
          midCapMaxMarketCap: parseOptionalInt(autoDiscoverMidCapMax),
          midCapMinVolume: parseOptionalInt(autoDiscoverMidCapVolume),
        })
        if (config) {
          payload.autoDiscoverConfig = config
        }
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (MARKET_DATA_AUTH_ENABLED) {
        try {
          const token = await user?.getIdToken()
          if (token) headers.Authorization = `Bearer ${token}`
        } catch {
          // Allow request to proceed without auth header.
        }
      }
      const response = await fetch(`${gatewayBase}/replay/buildTape`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || t("replay.controls.tape.buildFailed"))
      }
      const okCount = Array.isArray(result?.okSymbols)
        ? result.okSymbols.length
        : Number.isFinite(result?.symbolCount)
          ? result.symbolCount
          : 0
      const missingCount = Array.isArray(result?.missingSymbols)
        ? result.missingSymbols.length
        : 0
      const runResult = result?.run
      if (runResult?.runId) {
        setSelectedRunId(runResult.runId)
        setRunIdInput("")
        setDatasetIdInput("")
      }
      const runLabel = typeof runResult?.label === "string" ? runResult.label : runResult?.runId
      const recordingName = result?.datasetId || datasetId
      const symbolsSummary = t("replay.controls.tape.summarySymbols", { count: okCount })
      const missingSummary = missingCount
        ? `, ${t("replay.controls.tape.summarySkipped", { count: missingCount })}`
        : ""
      const savedSummary = runLabel
        ? ` - ${t("replay.controls.tape.summarySavedAs", { label: runLabel })}`
        : ""
      const summary = `${recordingName}: ${symbolsSummary}${missingSummary}${savedSummary}`
      setTapeBuildStatus({ tone: "success", message: summary })
      toast.success(t("replay.controls.tape.buildOk", { summary }))
    } catch (err) {
      let message = err instanceof Error ? err.message : t("replay.controls.tape.buildFailed")
      if (message === "Failed to fetch") {
        message = t("replay.controls.tape.fetchFailed")
      }
      setTapeBuildStatus({ tone: "error", message })
      toast.error(message)
    } finally {
      setTapeBuildBusy(false)
    }
  }

  async function triggerRefreshViaBatch(jobs?: string[]) {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return false
    }
    if (!user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return false
    }
    const runId = runIdValue.trim()
    const payload: Record<string, unknown> = {
      runId: runId || undefined,
      type: "refresh",
      source: "ui",
      requestedByUid: user.uid,
      requestedByEmail: user.email || null,
      createdAt: serverTimestamp(),
    }
    if (Array.isArray(jobs) && jobs.length > 0) {
      payload.jobs = jobs
    }
    await addDoc(collection(db, "batches"), payload)
    return true
  }

  async function handleRunMarketIntel() {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }
    if (!user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }
    if (!marketIntelJob) {
      toast.error(t("replay.controls.refreshNotConfigured"))
      return
    }
    setMarketIntelBusy(true)
    try {
      const ok = await triggerRefreshViaBatch([marketIntelJob])
      if (ok) {
        toast.success(t("replay.controls.marketIntelStarted"))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tradeNow.refreshFailedGeneric"))
    } finally {
      setMarketIntelBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("replay.controls.title")}</CardTitle>
            <CardDescription>{t("replay.controls.subtitle")}</CardDescription>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t("replay.controls.statusLabel")}:{" "}
              <span className="font-semibold">{statusLabel}</span>
            </span>
            {isReplay ? (
              <span>
                {t("replay.controls.servicesReady", { ready: ackedCount, total: totalRequired })}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
            {isReplay ? (
              <>
                <span>
                  {t("replay.controls.playbackLabel")}:{" "}
                  <span className="font-semibold">{playbackLabel}</span>
                </span>
                <span>
                  {t("replay.controls.datasetId")}: {controls?.datasetId || t("common.na")}
                </span>
                <span>
                  {t("replay.controls.asOf")}:{" "}
                  {formatTimestamp(controls?.asOf as Parameters<typeof formatTimestamp>[0])}
                </span>
              </>
            ) : (
              <span>{t("replay.controls.liveHint")}</span>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("replay.controls.step1Kicker")}
            </div>
            <div className="text-sm font-medium">{t("replay.controls.step1Title")}</div>
            <div className="text-xs text-muted-foreground">
              {t("replay.controls.step1Hint")}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="replay-tape-date">{t("replay.controls.tape.dateLabel")}</Label>
              <Input
                id="replay-tape-date"
                type="date"
                value={tapeDateInput}
                onChange={(e) => setTapeDateInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replay-tape-dataset">
                {t("replay.controls.tape.datasetLabel")}
              </Label>
              <Input
                id="replay-tape-dataset"
                value={tapeDatasetInput}
                onChange={(e) => setTapeDatasetInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replay-run-label">
                {t("replay.controls.tape.runLabelLabel")}
              </Label>
              <Input
                id="replay-run-label"
                value={runLabelInput}
                onChange={(e) => {
                  setRunLabelInput(e.target.value)
                  setRunLabelTouched(true)
                }}
                placeholder={t("replay.controls.tape.runLabelPlaceholder")}
                disabled={!registerRun}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("replay.controls.tape.symbolSourceLabel")}</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant={symbolSource === "default" ? "secondary" : "outline"}
                onClick={() => setSymbolSourceInput("default")}
                className="h-auto items-start justify-start text-left flex flex-col gap-1"
              >
                <span className="text-sm font-medium">
                  {t("replay.controls.tape.symbolSourceDefault")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t("replay.controls.tape.symbolSourceDefaultHint", {
                    count: defaultSymbolCount,
                  })}
                </span>
              </Button>
              <Button
                variant={symbolSource === "auto" ? "secondary" : "outline"}
                onClick={() => setSymbolSourceInput("auto")}
                className="h-auto items-start justify-start text-left flex flex-col gap-1"
              >
                <span className="text-sm font-medium">
                  {t("replay.controls.tape.symbolSourceAuto")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t("replay.controls.tape.symbolSourceAutoHint")}
                </span>
              </Button>
              <Button
                variant={symbolSource === "custom" ? "secondary" : "outline"}
                onClick={() => setSymbolSourceInput("custom")}
                className="h-auto items-start justify-start text-left flex flex-col gap-1"
              >
                <span className="text-sm font-medium">
                  {t("replay.controls.tape.symbolSourceCustom")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t("replay.controls.tape.symbolSourceCustomHint")}
                </span>
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("replay.controls.tape.symbolSourceSummaryLabel")}
              </div>
              <div className="text-sm font-medium">{recordingSourceLine}</div>
              {symbolSource === "custom" ? (
                <div className="text-[11px] text-muted-foreground">
                  {t("replay.controls.recordingScopeSymbolsCustom", {
                    count: selectedSymbolCount,
                  })}
                </div>
              ) : null}
              {symbolSource === "auto" && autoDiscoverSummaryLine ? (
                <div className="text-[11px] text-muted-foreground">
                  {autoDiscoverSummaryLine}
                </div>
              ) : null}
            </div>
          </div>
          {symbolSource === "default" ? (
            <p
              className={`text-[11px] ${
                defaultSymbols.length
                  ? "text-muted-foreground"
                  : "text-rose-600"
              }`}
            >
              {defaultSymbols.length
                ? t("replay.controls.tape.defaultSymbolsHint", {
                    count: defaultSymbols.length,
                  })
                : t("replay.controls.tape.defaultSymbolsMissing")}
            </p>
          ) : null}
          {symbolSource === "custom" ? (
            <div className="space-y-2">
              <Label htmlFor="replay-tape-symbols">
                {t("replay.controls.tape.symbolsLabel")}
              </Label>
              <Textarea
                id="replay-tape-symbols"
                value={tapeSymbolsInput}
                onChange={(e) => setTapeSymbolsInput(e.target.value)}
                placeholder={t("replay.controls.tape.symbolsPlaceholder")}
                rows={6}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("replay.controls.tape.symbolsHint")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => setTapeSymbolsInput("")}
                >
                  {t("replay.controls.tape.clearSymbols")}
                </Button>
              </div>
            </div>
          ) : null}
          <div
            className={`space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4 ${
              symbolSource !== "auto" ? "opacity-70" : ""
            }`}
          >
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {t("replay.controls.autoDiscover.title")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("replay.controls.autoDiscover.hint")}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="replay-tape-max-symbols">
                  {t("replay.controls.tape.maxSymbolsLabel")}
                </Label>
                <Input
                  id="replay-tape-max-symbols"
                  type="number"
                  min="1"
                  max="2000"
                  value={tapeMaxSymbolsInput}
                  onChange={(e) => setTapeMaxSymbolsInput(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={autoDiscoverIncludeUniverse ? "secondary" : "outline"}
                onClick={() =>
                  setAutoDiscoverIncludeUniverse((prev) => !prev)
                }
                disabled={symbolSource !== "auto"}
              >
                {autoDiscoverIncludeUniverse
                  ? t("replay.controls.autoDiscover.includeUniverseOn")
                  : t("replay.controls.autoDiscover.includeUniverseOff")}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="replay-auto-smallcap-min">
                  {t("replay.controls.autoDiscover.smallCapMinMarketCap")}
                </Label>
                <Input
                  id="replay-auto-smallcap-min"
                  type="number"
                  min="0"
                  step="1"
                  value={autoDiscoverSmallCapMin}
                  onChange={(e) => setAutoDiscoverSmallCapMin(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay-auto-smallcap-max">
                  {t("replay.controls.autoDiscover.smallCapMaxMarketCap")}
                </Label>
                <Input
                  id="replay-auto-smallcap-max"
                  type="number"
                  min="0"
                  step="1"
                  value={autoDiscoverSmallCapMax}
                  onChange={(e) => setAutoDiscoverSmallCapMax(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay-auto-smallcap-volume">
                  {t("replay.controls.autoDiscover.smallCapMinVolume")}
                </Label>
                <Input
                  id="replay-auto-smallcap-volume"
                  type="number"
                  min="0"
                  step="1"
                  value={autoDiscoverSmallCapVolume}
                  onChange={(e) => setAutoDiscoverSmallCapVolume(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay-auto-midcap-min">
                  {t("replay.controls.autoDiscover.midCapMinMarketCap")}
                </Label>
                <Input
                  id="replay-auto-midcap-min"
                  type="number"
                  min="0"
                  step="1"
                  value={autoDiscoverMidCapMin}
                  onChange={(e) => setAutoDiscoverMidCapMin(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay-auto-midcap-max">
                  {t("replay.controls.autoDiscover.midCapMaxMarketCap")}
                </Label>
                <Input
                  id="replay-auto-midcap-max"
                  type="number"
                  min="0"
                  step="1"
                  value={autoDiscoverMidCapMax}
                  onChange={(e) => setAutoDiscoverMidCapMax(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replay-auto-midcap-volume">
                  {t("replay.controls.autoDiscover.midCapMinVolume")}
                </Label>
                <Input
                  id="replay-auto-midcap-volume"
                  type="number"
                  min="0"
                  step="1"
                  value={autoDiscoverMidCapVolume}
                  onChange={(e) => setAutoDiscoverMidCapVolume(e.target.value)}
                  disabled={symbolSource !== "auto"}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant={registerRun ? "secondary" : "outline"}
              onClick={() => setRegisterRun((prev) => !prev)}
            >
              {registerRun
                ? t("replay.controls.tape.registerOn")
                : t("replay.controls.tape.registerOff")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBuildTape} disabled={tapeBuildBusy}>
              {tapeBuildBusy
                ? t("replay.controls.tape.buildRunning")
                : t("replay.controls.tape.build")}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("replay.controls.recordingScopeTitle")}: {recordingScopeLine}
          </div>
          {recordingExtrasLine ? (
            <div className="text-xs text-muted-foreground">{recordingExtrasLine}</div>
          ) : null}
          <div className="text-xs text-muted-foreground">
            {t("replay.controls.recordingScopeSourceLabel")}: {recordingSourceLine}
          </div>
          {autoDiscoverSummaryLine ? (
            <div className="text-xs text-muted-foreground">{autoDiscoverSummaryLine}</div>
          ) : null}
          {tapeBuildStatus ? (
            <div
              className={`text-xs ${
                tapeBuildStatus.tone === "success"
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {tapeBuildStatus.message}
            </div>
          ) : null}
          {!gatewayBase ? (
            <div className="text-xs text-rose-700">
              {t("replay.controls.tape.gatewayMissing")}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("replay.controls.step2Kicker")}
            </div>
            <div className="text-sm font-medium">{t("replay.controls.step2Title")}</div>
            <div className="text-xs text-muted-foreground">
              {t("replay.controls.step2Hint")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="replay-run-select">{t("replay.controls.runSelectLabel")}</Label>
            <Select
              id="replay-run-select"
              value={runIdValue || ""}
              onChange={(e) => {
                setSelectedRunId(e.target.value)
                setRunIdInput("")
                setDatasetIdInput("")
              }}
            >
              <option value="" disabled>
                {runs.length
                  ? t("replay.controls.runSelectPlaceholder")
                  : t("replay.controls.runSelectEmpty")}
              </option>
              {showCustomRun ? (
                <option value={runIdValue}>
                  {t("replay.controls.runSelectCustom", { runId: runIdValue })}
                </option>
              ) : null}
              {runs.map((run) => (
                <option key={run.runId} value={run.runId}>
                  {run.label || run.datasetId || run.runId}
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {t("replay.controls.runSelectHelp")}
            </p>
            {runsError ? (
              <p className="text-[11px] text-rose-600">
                {t("replay.controls.runSelectError", { message: runsError })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              {t("replay.controls.runDetails.tape")}:{" "}
              {datasetIdValue || t("common.na")}
            </span>
            <span>
              {t("replay.controls.runDetails.date")}:{" "}
              {selectedRunTapeDate || t("common.na")}
            </span>
            <span>
              {t("replay.controls.runDetails.symbols")}:{" "}
              {selectedRunSymbolCount || t("common.na")}
            </span>
            {selectedRunSourceLabel ? (
              <span>
                {t("replay.controls.runDetails.source")}:{" "}
                {selectedRunSourceLabel}
              </span>
            ) : null}
            {selectedRunAutoDiscoverSummaryLine ? (
              <span>
                {t("replay.controls.runDetails.constraints")}:{" "}
                {selectedRunAutoDiscoverSummaryLine}
              </span>
            ) : null}
            {selectedRunLabel ? (
              <span>
                {t("replay.controls.runDetails.label")}:{" "}
                {selectedRunLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("replay.controls.step3Kicker")}
            </div>
            <div className="text-sm font-medium">{t("replay.controls.step3Title")}</div>
            <div className="text-xs text-muted-foreground">
              {t("replay.controls.step3Hint")}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="replay-asof">{t("replay.controls.asOfLabel")}</Label>
              <Input
                id="replay-asof"
                type="datetime-local"
                value={asOfInputValue}
                onChange={(e) => setAsOfInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("replay.controls.asOfHelp")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replay-speed">{t("replay.controls.speedLabel")}</Label>
              <Input
                id="replay-speed"
                type="number"
                min="0.1"
                step="0.1"
                value={speedInputValue}
                onChange={(e) => setSpeedInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("replay.controls.speedHelp")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isReplay ? (
              <Button onClick={handleSwitchToReplay}>
                {t("replay.controls.switch")}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleStop}>
                  {t("replay.controls.stop")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleStart}
                  disabled={phase === "running"}
                >
                  {t("replay.controls.start")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handlePause}
                  disabled={phase !== "running"}
                >
                  {t("replay.controls.pause")}
                </Button>
                <Button variant="secondary" onClick={handleSeek}>
                  {t("replay.controls.seek")}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={handleRunMarketIntel}
              disabled={marketIntelBusy || Boolean(marketIntelDisabledReason)}
              title={
                marketIntelBusy
                  ? t("replay.controls.marketIntelRunning")
                  : marketIntelDisabledReason || t("replay.controls.marketIntelRun")
              }
            >
              {marketIntelBusy
                ? t("replay.controls.marketIntelRunning")
                : t("replay.controls.marketIntelRun")}
            </Button>
          </div>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-sm transition hover:bg-muted/30 data-[state=open]:border-primary/30 data-[state=open]:bg-primary/5"
          >
            <div className="space-y-0.5">
              <div className="font-medium">{t("replay.controls.advanced")}</div>
              <div className="text-xs text-muted-foreground">
                {t("replay.controls.advancedHint")}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:hidden data-[state=open]:block">
            <div
              ref={advancedContentRef}
              className="mt-3 space-y-5 rounded-lg border border-border/60 bg-muted/10 p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("replay.controls.advanced")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="replay-run-id">{t("replay.controls.runIdLabel")}</Label>
                  <Input
                    id="replay-run-id"
                    value={runIdValue}
                    onChange={(e) => setRunIdInput(e.target.value)}
                    placeholder={t("replay.controls.runIdPlaceholder")}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("replay.controls.runIdHelp")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replay-dataset-id">{t("replay.controls.datasetIdLabel")}</Label>
                  <Input
                    id="replay-dataset-id"
                    value={datasetIdValue}
                    onChange={(e) => setDatasetIdInput(e.target.value)}
                    placeholder={t("replay.controls.datasetIdPlaceholder")}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("replay.controls.datasetIdHelp")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replay-required-services">{t("replay.controls.requiredLabel")}</Label>
                  <Input
                    id="replay-required-services"
                    value={requiredInputValue}
                    onChange={(e) => setRequiredInput(e.target.value)}
                    placeholder={DEFAULT_REQUIRED_SERVICES.join(", ")}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("replay.controls.requiredHelp")}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant={botsReplayEnabled ? "secondary" : "outline"}
                    onClick={() => setBotsReplayEnabledInput((prev) => !(prev ?? botsReplayEnabled))}
                  >
                    {botsReplayEnabled
                      ? t("replay.controls.botsOn")
                      : t("replay.controls.botsOff")}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleApplySettings}>{t("replay.controls.apply")}</Button>
              </div>

              <Separator />

              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                <span>{t("replay.controls.sessionId")}: {controls?.sessionId || t("common.na")}</span>
                <span>{t("replay.controls.version")}: {controls?.version ?? t("common.na")}</span>
                <span>{t("replay.controls.runId")}: {controls?.activeRunId || t("common.na")}</span>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">{t("replay.controls.acksTitle")}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {ackStatus.map(({ serviceName, consumer, acked }) => (
                    <div key={serviceName} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">{serviceName}</span>
                        <span className="text-muted-foreground">
                          {consumer?.lastHeartbeat
                            ? t("replay.controls.lastHeartbeat", {
                                time: formatRelativeTimestamp(
                                  consumer.lastHeartbeat as Parameters<typeof formatRelativeTimestamp>[0]
                                ),
                              })
                            : t("replay.controls.noHeartbeat")}
                        </span>
                      </div>
                      <Badge variant={acked ? "default" : "outline"}>
                        {acked ? t("replay.controls.acked") : t("replay.controls.pending")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {t("replay.controls.recordingOptions.title")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("replay.controls.recordingOptions.hint")}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="replay-tape-lookback">
                      {t("replay.controls.tape.lookbackLabel")}
                    </Label>
                    <Input
                      id="replay-tape-lookback"
                      type="number"
                      min="1"
                      max="600"
                      value={tapeLookbackDaysInput}
                      onChange={(e) => setTapeLookbackDaysInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="replay-tape-intraday">
                      {t("replay.controls.tape.intradayLookbackLabel")}
                    </Label>
                    <Input
                      id="replay-tape-intraday"
                      type="number"
                      min="0"
                      max="60"
                      value={tapeIntradayLookbackDaysInput}
                      onChange={(e) => setTapeIntradayLookbackDaysInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={tapeIncludeNews ? "secondary" : "outline"}
                    onClick={() => setTapeIncludeNews((prev) => !prev)}
                  >
                    {tapeIncludeNews
                      ? t("replay.controls.tape.includeNewsOn")
                      : t("replay.controls.tape.includeNewsOff")}
                  </Button>
                  <Button
                    variant={tapeIncludeProfile ? "secondary" : "outline"}
                    onClick={() => setTapeIncludeProfile((prev) => !prev)}
                  >
                    {tapeIncludeProfile
                      ? t("replay.controls.tape.includeProfileOn")
                      : t("replay.controls.tape.includeProfileOff")}
                  </Button>
                  <Button
                    variant={tapeIncludeSharesFloat ? "secondary" : "outline"}
                    onClick={() => setTapeIncludeSharesFloat((prev) => !prev)}
                  >
                    {tapeIncludeSharesFloat
                      ? t("replay.controls.tape.includeFloatOn")
                      : t("replay.controls.tape.includeFloatOff")}
                  </Button>
                </div>
             </div>
           </div>
         </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
