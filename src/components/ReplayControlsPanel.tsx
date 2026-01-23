import { useEffect, useMemo, useRef, useState } from "react"
import { doc, setDoc, Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { db, firebaseEnabled } from "@/lib/firebase"
import { formatRelativeTimestamp, formatTimestamp } from "@/lib/format"
import { useAuth } from "@/features/auth/auth-context"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { useReplayConsumers } from "@/features/replay/use-replay-consumers"
import { ChevronDown } from "lucide-react"

const DEFAULT_REQUIRED_SERVICES = [
  "mdg",
  "price-streamer",
  "market-intel",
  "signal-evaluator",
  "ui",
]
const DEFAULT_REPLAY_RUN_ID = "replay-2026-01-22-microcap"
const DEFAULT_REPLAY_DATASET_ID = "2026-01-22-microcap"
const DEFAULT_REPLAY_ASOF = new Date("2026-01-22T20:55:00Z")
const DEFAULT_REPLAY_SPEED = "1"
const DEFAULT_REPLAY_BOTS_ENABLED = false
const DEFAULT_TAPE_DATE = "2026-01-22"
const DEFAULT_TAPE_DATASET_ID = "2026-01-22-microcap"
const DEFAULT_TAPE_LOOKBACK_DAYS = "120"
const DEFAULT_TAPE_INTRADAY_LOOKBACK_DAYS = "2"
const DEFAULT_TAPE_MAX_SYMBOLS = "500"
const DEFAULT_TAPE_AUTO_DISCOVER = false
const DEFAULT_TAPE_INCLUDE_NEWS = false
const DEFAULT_TAPE_INCLUDE_PROFILE = true
const DEFAULT_TAPE_INCLUDE_SHARES_FLOAT = true
const DEFAULT_TAPE_SYMBOLS_PATH = "/replay-default-symbols.json"

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
    } catch (_) {
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

export function ReplayControlsPanel() {
  const { t } = useTranslation()
  const { controls } = useReplayControls()
  const { consumerMap } = useReplayConsumers()
  const { user } = useAuth()

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advancedContentRef = useRef<HTMLDivElement | null>(null)
  const [runIdInput, setRunIdInput] = useState("")
  const [datasetIdInput, setDatasetIdInput] = useState("")
  const [requiredInput, setRequiredInput] = useState("")
  const [speedInput, setSpeedInput] = useState("")
  const [asOfInput, setAsOfInput] = useState("")
  const [botsReplayEnabledInput, setBotsReplayEnabledInput] = useState<boolean | null>(null)
  const [tapeDateInput, setTapeDateInput] = useState(DEFAULT_TAPE_DATE)
  const [tapeDatasetInput, setTapeDatasetInput] = useState(DEFAULT_TAPE_DATASET_ID)
  const [tapeLookbackDaysInput, setTapeLookbackDaysInput] = useState(DEFAULT_TAPE_LOOKBACK_DAYS)
  const [tapeIntradayLookbackDaysInput, setTapeIntradayLookbackDaysInput] = useState(
    DEFAULT_TAPE_INTRADAY_LOOKBACK_DAYS
  )
  const [tapeMaxSymbolsInput, setTapeMaxSymbolsInput] = useState(DEFAULT_TAPE_MAX_SYMBOLS)
  const [tapeAutoDiscover, setTapeAutoDiscover] = useState(DEFAULT_TAPE_AUTO_DISCOVER)
  const [tapeIncludeNews, setTapeIncludeNews] = useState(DEFAULT_TAPE_INCLUDE_NEWS)
  const [tapeIncludeProfile, setTapeIncludeProfile] = useState(DEFAULT_TAPE_INCLUDE_PROFILE)
  const [tapeIncludeSharesFloat, setTapeIncludeSharesFloat] = useState(
    DEFAULT_TAPE_INCLUDE_SHARES_FLOAT
  )
  const [tapeSymbolsInput, setTapeSymbolsInput] = useState("")
  const [tapeSymbolsLoaded, setTapeSymbolsLoaded] = useState(false)
  const [tapeBuildBusy, setTapeBuildBusy] = useState(false)
  const [tapeBuildStatus, setTapeBuildStatus] = useState<{
    tone: "success" | "error"
    message: string
  } | null>(null)
  const [marketIntelBusy, setMarketIntelBusy] = useState(false)
  const [guideOpen, setGuideOpen] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)

  const runIdValue = runIdInput || controls?.activeRunId || DEFAULT_REPLAY_RUN_ID
  const datasetIdValue = datasetIdInput || controls?.datasetId || DEFAULT_REPLAY_DATASET_ID
  const requiredInputValue =
    requiredInput ||
    (Array.isArray(controls?.requiredServices) && controls?.requiredServices.length
      ? controls.requiredServices.join(", ")
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
  const asOfInputValue =
    asOfInput || (controls?.asOf ? toLocalInput(controls.asOf) : toLocalInput(DEFAULT_REPLAY_ASOF))
  const botsReplayEnabled =
    botsReplayEnabledInput ??
    (typeof controls?.botsReplayEnabled === "boolean"
      ? controls.botsReplayEnabled
      : DEFAULT_REPLAY_BOTS_ENABLED)
  const gatewayBase = (import.meta.env.VITE_MARKET_DATA_GATEWAY_URL || "").replace(/\/+$/, "")
  const refreshEndpoint = useMemo(() => {
    const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/refresh`
  }, [])
  const marketIntelJob = useMemo(
    () => (import.meta.env.VITE_MARKET_INTEL_JOB || "relayorb-market-intel").trim(),
    []
  )

  const requiredServices = useMemo(() => {
    const parsed = parseList(requiredInputValue)
    return parsed.length ? parsed : DEFAULT_REQUIRED_SERVICES
  }, [requiredInputValue])

  const ackStatus = useMemo(() => {
    return requiredServices.map((serviceName) => {
      const consumer = consumerMap.get(serviceName)
      const versionMatch =
        consumer?.seenControlsVersion !== undefined &&
        consumer?.seenControlsVersion === controls?.version
      const sessionMatch = consumer?.sessionId && controls?.sessionId === consumer.sessionId
      const modeMatch = consumer?.effectiveMode === controls?.desiredMode
      const acked = Boolean(versionMatch && sessionMatch && modeMatch)
      return { serviceName, consumer, acked }
    })
  }, [consumerMap, requiredServices, controls?.version, controls?.sessionId, controls?.desiredMode])

  const canWrite = Boolean(firebaseEnabled && db)
  const desiredMode = controls?.desiredMode || "live"
  const phase = controls?.phase || "ready"
  const isReplay = desiredMode === "replay"
  const ackedCount = ackStatus.filter((item) => item.acked).length
  const totalRequired = requiredServices.length
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
    if (tapeSymbolsLoaded || tapeSymbolsInput) return
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
        if (!cancelled && list.length > 0 && !tapeSymbolsInput) {
          const joined = list.map((item: unknown) => String(item)).join(", ")
          setTapeSymbolsInput(joined)
        }
      } catch (_) {
        // Ignore default symbol load errors.
      } finally {
        if (!cancelled) setTapeSymbolsLoaded(true)
      }
    }
    loadDefaultSymbols()
    return () => {
      cancelled = true
    }
  }, [tapeSymbolsLoaded, tapeSymbolsInput])

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
      requiredServices,
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
      requiredServices,
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
    await updateControls({ phase: "running" }, t("replay.controls.started"))
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
    await updateControls(
      {
        asOf: Timestamp.fromDate(parsed),
        phase: "paused",
        version: nextVersion(),
      },
      t("replay.controls.seekQueued")
    )
  }

  async function handleBuildTape() {
    if (!gatewayBase) {
      toast.error(t("replay.controls.tape.gatewayMissing"))
      return
    }
    if (!user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }
    const date = tapeDateInput.trim()
    if (!date) {
      toast.error(t("replay.controls.tape.dateRequired"))
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
      }
      const lookbackDays = parseOptionalInt(tapeLookbackDaysInput)
      if (lookbackDays !== undefined) payload.lookbackDays = lookbackDays
      const intradayLookbackDays = parseOptionalInt(tapeIntradayLookbackDaysInput)
      if (intradayLookbackDays !== undefined) {
        payload.intradayLookbackDays = intradayLookbackDays
      }
      const maxSymbols = parseOptionalInt(tapeMaxSymbolsInput)
      if (maxSymbols !== undefined) payload.maxSymbols = maxSymbols
      const symbols = parseSymbolsInput(tapeSymbolsInput)
      if (symbols.length > 0) payload.symbols = symbols

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      try {
        const token = await user.getIdToken()
        if (token) headers.Authorization = `Bearer ${token}`
      } catch (_) {
        // Allow request to proceed without auth header.
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
      const summary = `${result?.datasetId || datasetId}: ${okCount} ok, ${missingCount} missing`
      setTapeBuildStatus({ tone: "success", message: summary })
      toast.success(t("replay.controls.tape.buildOk", { summary }))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("replay.controls.tape.buildFailed")
      setTapeBuildStatus({ tone: "error", message })
      toast.error(message)
    } finally {
      setTapeBuildBusy(false)
    }
  }

  async function handleRunMarketIntel() {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }
    if (!refreshEndpoint) {
      toast.error(t("replay.controls.refreshNotConfigured"))
      return
    }
    if (!user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }
    setMarketIntelBusy(true)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch(refreshEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobs: [marketIntelJob],
          runId: runIdValue.trim() || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload?.error || t("tradeNow.refreshFailed", { status: response.status })
        )
      }
      toast.success(t("replay.controls.marketIntelStarted"))
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

        <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-left text-sm transition hover:bg-muted/25 data-[state=open]:border-primary/30 data-[state=open]:bg-primary/5"
            >
              <div className="space-y-0.5">
                <div className="font-medium">{t("replay.controls.guideTitle")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("replay.controls.guideIntro")}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:hidden data-[state=open]:block">
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
              <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
                <li>{t("replay.controls.guideSteps.buildTape")}</li>
                <li>{t("replay.controls.guideSteps.configureReplay")}</li>
                <li>{t("replay.controls.guideSteps.enableReplay")}</li>
                <li>{t("replay.controls.guideSteps.runMarketIntel")}</li>
                <li>{t("replay.controls.guideSteps.checkOutputs")}</li>
              </ol>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
            disabled={marketIntelBusy}
          >
            {marketIntelBusy
              ? t("replay.controls.marketIntelRunning")
              : t("replay.controls.marketIntelRun")}
          </Button>
        </div>

        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-left text-sm transition hover:bg-muted/25 data-[state=open]:border-primary/30 data-[state=open]:bg-primary/5"
            >
              <div className="space-y-0.5">
                <div className="font-medium">{t("replay.controls.helpTitle")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("replay.controls.helpIntro")}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:hidden data-[state=open]:block">
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
              <ul className="list-disc space-y-2 pl-4">
                <li>{t("replay.controls.helpItems.gatewayMissing")}</li>
                <li>{t("replay.controls.helpItems.refreshMissing")}</li>
                <li>{t("replay.controls.helpItems.signInRequired")}</li>
                <li>{t("replay.controls.helpItems.includeNews")}</li>
                <li>{t("replay.controls.helpItems.outputsEmpty")}</li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
                  <div className="text-sm font-medium">{t("replay.controls.tape.title")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("replay.controls.tape.hint")}
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
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={tapeAutoDiscover ? "secondary" : "outline"}
                    onClick={() => setTapeAutoDiscover((prev) => !prev)}
                  >
                    {tapeAutoDiscover
                      ? t("replay.controls.tape.autoDiscoverOn")
                      : t("replay.controls.tape.autoDiscoverOff")}
                  </Button>
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
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleBuildTape} disabled={tapeBuildBusy}>
                    {tapeBuildBusy
                      ? t("replay.controls.tape.buildRunning")
                      : t("replay.controls.tape.build")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTapeSymbolsInput("")}
                    disabled={tapeBuildBusy}
                  >
                    {t("replay.controls.tape.clearSymbols")}
                  </Button>
                </div>

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
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
