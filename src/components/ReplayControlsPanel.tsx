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
import { db, firebaseEnabled } from "@/lib/firebase"
import { formatRelativeTimestamp, formatTimestamp } from "@/lib/format"
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

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function toLocalInput(ts?: unknown) {
  if (!ts || typeof (ts as { toDate?: () => Date })?.toDate !== "function") return ""
  const date = (ts as { toDate: () => Date }).toDate()
  if (!Number.isFinite(date.getTime())) return ""
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

export function ReplayControlsPanel() {
  const { t } = useTranslation()
  const { controls } = useReplayControls()
  const { consumerMap } = useReplayConsumers()

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advancedContentRef = useRef<HTMLDivElement | null>(null)
  const [runIdInput, setRunIdInput] = useState("")
  const [datasetIdInput, setDatasetIdInput] = useState("")
  const [requiredInput, setRequiredInput] = useState("")
  const [speedInput, setSpeedInput] = useState("")
  const [asOfInput, setAsOfInput] = useState("")
  const [botsReplayEnabledInput, setBotsReplayEnabledInput] = useState<boolean | null>(null)

  const runIdValue = runIdInput || controls?.activeRunId || ""
  const datasetIdValue = datasetIdInput || controls?.datasetId || ""
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
      return "1"
    })()
  const asOfInputValue = asOfInput || (controls?.asOf ? toLocalInput(controls.asOf) : "")
  const botsReplayEnabled =
    botsReplayEnabledInput ??
    (typeof controls?.botsReplayEnabled === "boolean" ? controls.botsReplayEnabled : false)

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
    await updateControls(
      {
        activeRunId: runId,
        datasetId,
        requiredServices,
        speedScript,
        botsReplayEnabled,
      },
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
    await updateControls(
      {
        desiredMode: "replay",
        phase: "running",
        sessionId: `session-${Date.now()}`,
        version: nextVersion(),
        activeRunId: runId,
        datasetId,
        requiredServices,
        speedScript,
        botsReplayEnabled,
      },
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
    await updateControls({ desiredMode: "live", phase: "ready" }, t("replay.controls.stopped"))
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
      <CardContent className="space-y-4">
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

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="replay-asof">{t("replay.controls.asOfLabel")}</Label>
            <Input
              id="replay-asof"
              type="datetime-local"
              value={asOfInputValue}
              onChange={(e) => setAsOfInput(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("replay.controls.entryHint")}
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
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
              className="mt-3 space-y-4 rounded-lg border border-border/60 bg-muted/10 p-3"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("replay.controls.advanced")}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="replay-run-id">{t("replay.controls.runIdLabel")}</Label>
                  <Input
                    id="replay-run-id"
                    value={runIdValue}
                    onChange={(e) => setRunIdInput(e.target.value)}
                    placeholder={t("replay.controls.runIdPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replay-dataset-id">{t("replay.controls.datasetIdLabel")}</Label>
                  <Input
                    id="replay-dataset-id"
                    value={datasetIdValue}
                    onChange={(e) => setDatasetIdInput(e.target.value)}
                    placeholder={t("replay.controls.datasetIdPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replay-required-services">{t("replay.controls.requiredLabel")}</Label>
                  <Input
                    id="replay-required-services"
                    value={requiredInputValue}
                    onChange={(e) => setRequiredInput(e.target.value)}
                    placeholder={DEFAULT_REQUIRED_SERVICES.join(", ")}
                  />
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

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleApplySettings}>{t("replay.controls.apply")}</Button>
              </div>

              <Separator />

              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <span>{t("replay.controls.sessionId")}: {controls?.sessionId || t("common.na")}</span>
                <span>{t("replay.controls.version")}: {controls?.version ?? t("common.na")}</span>
                <span>{t("replay.controls.runId")}: {controls?.activeRunId || t("common.na")}</span>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">{t("replay.controls.acksTitle")}</div>
                <div className="grid gap-2 md:grid-cols-2">
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
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
