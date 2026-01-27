import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Link, useParams } from "react-router-dom"
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "firebase/firestore"
import type { DocumentData, QuerySnapshot } from "firebase/firestore"
import { toast } from "sonner"
import { db, firebaseEnabled } from "@/lib/firebase"
import type {
  BotCommandType,
  BotDesiredConfig,
  BotDoc,
  BotEventDoc,
  BotMode,
  MarketHotTrade,
  MarketHotTradesDoc,
  SignalPerformanceDoc,
} from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/StatusBadge"
import { formatRelativeTimestamp, formatTimestamp } from "@/lib/format"
import { findAnalysisNoteKind } from "@/lib/analysis-localize"
import { useAuth } from "@/features/auth/auth-context"
import { DEFAULT_EXCHANGES, DEFAULT_MODES, DEFAULT_TIMEFRAMES, parsePairs, uniqueList } from "@/lib/universe"
import { AssetChartModal } from "@/components/charts/AssetChartModal"
import { ScoreBreakdownDialog } from "@/components/score/ScoreBreakdownDialog"
import { useStreamSymbols } from "@/features/market/use-stream-symbols"
import { useMarketControls } from "@/features/market/use-market-controls"
import { BarChart3, InfoIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

const COMMAND_OPTIONS: BotCommandType[] = [
  "start",
  "stop",
  "restart",
  "reload_config",
  "update_agent",
]

const ENGINE_COMMANDS: Record<string, BotCommandType[]> = {
  backtrader: ["start", "stop", "restart", "reload_config", "update_agent"],
  default: ["start", "stop", "restart", "reload_config", "update_agent"],
}

const STRATEGY_PRESETS: Record<string, string[]> = {
  backtrader: ["default", "momentum", "mean-reversion"],
  default: ["default"],
}
const PERFORMANCE_HORIZONS = ["1h", "24h", "7d"] as const
const RECOMMENDED_SYMBOL_LIMIT = 6
type AssetClass = MarketHotTrade["assetClass"]

function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

function normalizePair(pair: string, separator: "/" | "-") {
  const trimmed = pair.trim().toUpperCase()
  if (!trimmed) return trimmed
  if (separator === "/") return trimmed.replace(/-/g, "/")
  return trimmed.replace(/\//g, "-")
}

function extractEngineAdvanced(advanced: unknown, engine?: string) {
  if (!advanced || typeof advanced !== "object" || Array.isArray(advanced)) return null
  const record = advanced as Record<string, unknown>
  if (engine) {
    const nested =
      record[engine] ?? record[`${engine}Config`] ?? record[`${engine}_config`]
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>
    }
  }
  return record
}

export default function BotDetailPage() {
  const { botId } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()
  const { cryptoEnabled, forexEnabled } = useMarketControls()
  const naLabel = t("common.na")
  const unknownLabel = t("common.unknown")
  const assetLabelMap = useMemo(
    () => ({
      crypto: t("assets.crypto"),
      stock: t("assets.stocks"),
      forex: t("assets.fx"),
    }),
    [t]
  )
  const assetLabelShortMap = useMemo(
    () => ({
      crypto: t("assets.crypto"),
      stock: t("assets.stock"),
      forex: t("assets.fx"),
    }),
    [t]
  )
  const getAssetLabel = (assetClass?: string | null, variant: "short" | "long" = "long") => {
    if (!assetClass) return unknownLabel
    const map = variant === "short" ? assetLabelShortMap : assetLabelMap
    return map[assetClass as AssetClass] ?? assetClass
  }
  const getModeLabel = (modeValue?: string | null) => {
    if (!modeValue) return naLabel
    return t(`botDetail.mode.${modeValue}`, { defaultValue: modeValue })
  }
  const isAssetEnabled = useCallback(
    (assetClass?: string | null) => {
      if (assetClass === "crypto") return cryptoEnabled
      if (assetClass === "forex") return forexEnabled
      return true
    },
    [cryptoEnabled, forexEnabled]
  )
  const [bot, setBot] = useState<BotDoc | null>(null)
  const [events, setEvents] = useState<BotEventDoc[]>([])
  const [loadingBot, setLoadingBot] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [payload, setPayload] = useState("{}")
  const [payloadError, setPayloadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [exchange, setExchange] = useState("")
  const [pairsInput, setPairsInput] = useState("")
  const [timeframe, setTimeframe] = useState("")
  const [mode, setMode] = useState<BotMode>("signal")
  const [strategy, setStrategy] = useState("")
  const [riskMaxPositionSize, setRiskMaxPositionSize] = useState("")
  const [riskMaxDailyLoss, setRiskMaxDailyLoss] = useState("")
  const [riskMaxOpenOrders, setRiskMaxOpenOrders] = useState("")
  const [riskMaxLeverage, setRiskMaxLeverage] = useState("")
  const [advancedConfigText, setAdvancedConfigText] = useState("")
  const [advancedConfigError, setAdvancedConfigError] = useState<string | null>(null)
  const [baselineAdvanced, setBaselineAdvanced] = useState<Record<string, unknown> | null>(null)
  const [expertOpen, setExpertOpen] = useState(false)
  const [expertUnlocked, setExpertUnlocked] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configDirty, setConfigDirty] = useState(false)
  const [recommendations, setRecommendations] = useState<MarketHotTrade[]>([])
  const [chartOpen, setChartOpen] = useState(false)
  const [chartAsset, setChartAsset] = useState<MarketHotTrade | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdownAsset, setBreakdownAsset] = useState<MarketHotTrade | null>(null)
  const [loadingRecommendations, setLoadingRecommendations] = useState(true)
  const [botPerformance, setBotPerformance] = useState<SignalPerformanceDoc | null>(null)
  const [loadingPerformance, setLoadingPerformance] = useState(true)
  const [recommendHorizon, setRecommendHorizon] = useState<(typeof PERFORMANCE_HORIZONS)[number]>("1h")
  const [detailTab, setDetailTab] = useState("overview")
  const configCardRef = useRef<HTMLDivElement | null>(null)
  const commandDisabled = sending || !firebaseEnabled
  const configDisabled = configSaving || !firebaseEnabled
  const exchangeTrimmed = exchange.trim()
  const timeframeTrimmed = timeframe.trim()
  const strategyTrimmed = strategy.trim()
  const timeframeInvalid = timeframeTrimmed.length > 0 && !/^\d+[mhdw]$/i.test(timeframeTrimmed)
  const desiredConfigKey = useMemo(
    () => JSON.stringify(bot?.desiredConfig ?? {}),
    [bot?.desiredConfig]
  )

  const commandOptions = useMemo(
    () =>
      COMMAND_OPTIONS.map((type) => ({
        type,
        label: t(`botDetail.commands.${type}`),
      })),
    [t]
  )

  const pairsPreview = useMemo(() => parsePairs(pairsInput), [pairsInput])

  const exchangeOptions = useMemo(
    () =>
      uniqueList([
        ...DEFAULT_EXCHANGES,
        ...(bot?.capabilities?.exchanges ?? []),
        ...(exchangeTrimmed ? [exchangeTrimmed] : []),
      ]),
    [bot?.capabilities?.exchanges, exchangeTrimmed]
  )

  const timeframeOptions = useMemo(
    () =>
      uniqueList([
        ...DEFAULT_TIMEFRAMES,
        ...(bot?.capabilities?.timeframes ?? []),
        ...(timeframeTrimmed ? [timeframeTrimmed] : []),
      ]),
    [bot?.capabilities?.timeframes, timeframeTrimmed]
  )

  const modeOptions = useMemo(
    () => (bot?.capabilities?.modes?.length ? bot.capabilities.modes : Array.from(DEFAULT_MODES)),
    [bot?.capabilities?.modes]
  )

  const strategyOptions = useMemo(() => {
    const engineKey = bot?.engine ?? "default"
    const presets = STRATEGY_PRESETS[engineKey] ?? STRATEGY_PRESETS.default
    return uniqueList([...presets, ...(strategyTrimmed ? [strategyTrimmed] : [])])
  }, [bot?.engine, strategyTrimmed])

  const performanceItems = useMemo(() => {
    const items: Array<{ symbol?: string | null; assetClass?: string | null }> = []
    const add = (list?: { symbol: string; assetClass?: string | null }[]) => {
      if (!Array.isArray(list)) return
      list.forEach((entry) => {
        if (!entry?.symbol) return
        if (!isAssetEnabled(entry.assetClass ?? null)) return
        items.push({ symbol: entry.symbol, assetClass: entry.assetClass ?? null })
      })
    }
    const top = botPerformance?.topSymbols || {}
    const bottom = botPerformance?.bottomSymbols || {}
    Object.values(top).forEach((list) => add(list))
    Object.values(bottom).forEach((list) => add(list))
    return items
  }, [botPerformance, isAssetEnabled])

  const visibleRecommendations = useMemo(
    () => recommendations.filter((trade) => isAssetEnabled(trade.assetClass ?? null)),
    [recommendations, isAssetEnabled]
  )

  const streamItems = useMemo(
    () => [...visibleRecommendations, ...performanceItems],
    [visibleRecommendations, performanceItems]
  )

  useStreamSymbols(`bot-${botId || "unknown"}`, {
    items: streamItems,
    enabled: Boolean(botId),
  })

  const engineConfigLabel = "Engine Config (JSON)"
  const engineConfigTemplate = JSON.stringify({ config: {} }, null, 2)

  const wizardConfig = useMemo(() => {
    const pairs = parsePairs(pairsInput)
    const pairsSlash = pairs.map((pair) => normalizePair(pair, "/"))
    const config: Record<string, unknown> = {}
    if (exchangeTrimmed || pairsSlash.length > 0) {
      const exchangeConfig: Record<string, unknown> = {}
      if (exchangeTrimmed) exchangeConfig.name = exchangeTrimmed.toLowerCase()
      if (pairsSlash.length > 0) exchangeConfig.pair_whitelist = pairsSlash
      config.exchange = exchangeConfig
    }
    if (timeframeTrimmed) config.timeframe = timeframeTrimmed
    if (strategyTrimmed) config.strategy = strategyTrimmed

    const risk: Record<string, unknown> = {}
    const riskMaxOpen = parseOptionalNumber(riskMaxOpenOrders)
    const riskMaxPosition = parseOptionalNumber(riskMaxPositionSize)
    const riskMaxDaily = parseOptionalNumber(riskMaxDailyLoss)
    const riskMaxLev = parseOptionalNumber(riskMaxLeverage)
    if (riskMaxOpen !== undefined) risk.maxOpenOrders = riskMaxOpen
    if (riskMaxPosition !== undefined) risk.maxPositionSize = riskMaxPosition
    if (riskMaxDaily !== undefined) risk.maxDailyLoss = riskMaxDaily
    if (riskMaxLev !== undefined) risk.maxLeverage = riskMaxLev
    if (Object.keys(risk).length > 0) config.risk = risk

    return Object.keys(config).length > 0 ? config : null
  }, [
    exchangeTrimmed,
    pairsInput,
    timeframeTrimmed,
    strategyTrimmed,
    riskMaxOpenOrders,
    riskMaxPositionSize,
    riskMaxDailyLoss,
    riskMaxLeverage,
  ])

  const wizardConfigText = useMemo(
    () => (wizardConfig ? JSON.stringify(wizardConfig, null, 2) : ""),
    [wizardConfig]
  )

  const availableCommands = useMemo(() => {
    const engineKey = bot?.engine || "default"
    const allowed = ENGINE_COMMANDS[engineKey] || ENGINE_COMMANDS.default
    return commandOptions.filter((option) => allowed.includes(option.type))
  }, [bot?.engine, commandOptions])

  useEffect(() => {
    if (!botId || !firebaseEnabled || !db) {
      setLoadingBot(false)
      return
    }

    const activeDb = db
    const ref = doc(activeDb, "bots", botId)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setBot(null)
        setLoadingBot(false)
        return
      }
      const data = snap.data() as Omit<BotDoc, "id">
      setBot({ id: snap.id, ...data })
      setLoadingBot(false)
    })
  }, [botId])

  useEffect(() => {
    if (!botId || !firebaseEnabled || !db) {
      setLoadingEvents(false)
      return
    }

    const activeDb = db
    let didFallback = false
    let unsubscribe = () => {}

    const handleSnapshot = (snap: QuerySnapshot<DocumentData>) => {
      const nextEvents = snap.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<BotEventDoc, "id" | "botId">
        return { id: docSnap.id, botId, ...data }
      })
      nextEvents.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setEvents(nextEvents.slice(0, 15))
      setLoadingEvents(false)
    }

    const subscribe = (ordered: boolean) => {
      const baseRef = collection(activeDb, "bots", botId, "events")
      const eventsQuery = ordered
        ? query(baseRef, orderBy("createdAt", "desc"), limit(15))
        : query(baseRef, limit(100))
      unsubscribe = onSnapshot(
        eventsQuery,
        handleSnapshot,
        (error) => {
          const code =
            typeof error === "object" && error && "code" in error
              ? String(error.code)
              : ""
          if (ordered && code === "failed-precondition" && !didFallback) {
            didFallback = true
            unsubscribe()
            subscribe(false)
            return
          }
          console.error("Events listener error", error)
          setLoadingEvents(false)
        }
      )
    }

    subscribe(true)
    return () => unsubscribe()
  }, [botId])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingRecommendations(false)
      return
    }

    const activeDb = db
    const ref = doc(activeDb, "market", "hotTrades")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setRecommendations([])
        setLoadingRecommendations(false)
        return
      }
      const data = snap.data() as MarketHotTradesDoc
      setRecommendations(data.items ?? [])
      setLoadingRecommendations(false)
    })
  }, [])

  useEffect(() => {
    if (!botId || !firebaseEnabled || !db) {
      setBotPerformance(null)
      setLoadingPerformance(false)
      return
    }

    setLoadingPerformance(true)
    const activeDb = db
    const ref = doc(activeDb, "bots", botId, "analytics", "signalPerformance")
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setBotPerformance(null)
          setLoadingPerformance(false)
          return
        }
        const data = snap.data() as SignalPerformanceDoc
        setBotPerformance(data)
        setLoadingPerformance(false)
      },
      () => {
        setLoadingPerformance(false)
      }
    )
  }, [botId])

  useEffect(() => {
    if (!bot) return
    const desired = bot.desiredConfig
    const advanced = extractEngineAdvanced(desired?.advanced, bot.engine)
    const defaultExchange =
      bot.capabilities?.exchanges?.[0] ?? DEFAULT_EXCHANGES[0] ?? ""
    const defaultTimeframe =
      bot.capabilities?.timeframes?.[0] ?? DEFAULT_TIMEFRAMES[0] ?? ""
    const defaultStrategy =
      (STRATEGY_PRESETS[bot.engine ?? "default"] ?? STRATEGY_PRESETS.default)[0] ??
      ""
    const fallbackExchange = defaultExchange
    const fallbackPairs: string[] = []
    const fallbackTimeframe = defaultTimeframe
    const fallbackStrategy = defaultStrategy

    setBaselineAdvanced(advanced ? { ...advanced } : null)

    const exchangeValue = desired?.exchange || fallbackExchange
    const timeframeValue = desired?.timeframe || fallbackTimeframe
    const strategyValue = desired?.strategy || fallbackStrategy
    const pairsValue =
      desired?.pairs && desired.pairs.length > 0 ? desired.pairs : fallbackPairs

    setExchange(exchangeValue || "")
    setTimeframe(timeframeValue || "")
    setMode(desired?.mode ?? "signal")
    setPairsInput(pairsValue.join(", "))
    setStrategy(strategyValue || "")
    setRiskMaxPositionSize(desired?.risk?.maxPositionSize?.toString() ?? "")
    setRiskMaxDailyLoss(desired?.risk?.maxDailyLoss?.toString() ?? "")
    setRiskMaxOpenOrders(desired?.risk?.maxOpenOrders?.toString() ?? "")
    setRiskMaxLeverage(desired?.risk?.maxLeverage?.toString() ?? "")
    setAdvancedConfigText(desired?.advanced ? JSON.stringify(desired.advanced, null, 2) : "")
    setAdvancedConfigError(null)
    setConfigDirty(false)
  }, [bot, desiredConfigKey])

  const summary = useMemo(() => {
    return [
      { label: t("botDetail.summary.positions"), value: bot?.summary?.positions ?? naLabel },
      { label: t("botDetail.summary.orders"), value: bot?.summary?.orders ?? naLabel },
      { label: t("botDetail.summary.pnl"), value: bot?.summary?.pnl ?? naLabel },
    ]
  }, [bot, naLabel, t])

  function parseOptionalNumber(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  function mergeDeep(
    base: Record<string, unknown>,
    patch?: Record<string, unknown> | null
  ) {
    if (!patch) return { ...base }
    const result: Record<string, unknown> = { ...base }
    Object.entries(patch).forEach(([key, value]) => {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof result[key] === "object" &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = mergeDeep(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>
        )
      } else {
        result[key] = value
      }
    })
    return result
  }

  function parseAdvancedConfig() {
    const trimmed = advancedConfigText.trim()
    if (!trimmed) {
      setAdvancedConfigError(null)
      return undefined
    }
    try {
      const parsed = JSON.parse(trimmed)
      setAdvancedConfigError(null)
      return parsed as Record<string, unknown>
    } catch {
      setAdvancedConfigError(t("botDetail.errors.advancedConfigInvalid"))
      return null
    }
  }

  function resolveAdvancedConfig() {
    if (expertUnlocked) {
      const parsed = parseAdvancedConfig()
      if (parsed === null) return null
      if (parsed !== undefined) return parsed
    }
    const base = baselineAdvanced ? { ...baselineAdvanced } : {}
    const merged = wizardConfig ? mergeDeep(base, wizardConfig) : base
    return Object.keys(merged).length > 0 ? merged : undefined
  }

  function handleExpertOpenChange(open: boolean) {
    setExpertOpen(open)
    if (!open) {
      setExpertUnlocked(false)
    }
  }

  function applyWizardConfigText() {
    const template = wizardConfigText || engineConfigTemplate
    if (!template) return
    setAdvancedConfigText(template)
    setAdvancedConfigError(null)
    setConfigDirty(true)
  }

  function applyRecommendation(trade: MarketHotTrade) {
    if (!trade?.symbol) return
    const pairSlash = normalizePair(trade.symbol, "/")
    const defaultStrategy = "default"
    const nextStrategy = strategyTrimmed || defaultStrategy
    const nextExchange = trade.exchange || exchangeTrimmed
    const nextTimeframe = trade.timeframe || timeframeTrimmed || "1m"

    const mergedPairs = uniqueList([
      ...parsePairs(pairsInput).map((pair) => normalizePair(pair, "/")),
      pairSlash,
    ])

    setExchange(nextExchange || "")
    setPairsInput(mergedPairs.join(", "))
    setTimeframe(nextTimeframe)
    setStrategy(nextStrategy)
    setConfigDirty(true)
    setAdvancedConfigError(null)
    setDetailTab("config")
    toast.success(t("botDetail.toasts.recommendationApplied"))
    setTimeout(() => {
      configCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)

    setAdvancedConfigText(engineConfigTemplate)
  }

  async function queueCommand(type: BotCommandType, overridePayload?: Record<string, unknown>) {
    if (!botId) return
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }

    const activeDb = db
    setPayloadError(null)
    setSending(true)

    let parsedPayload: Record<string, unknown> | undefined = overridePayload
    if (!overridePayload) {
      const trimmed = payload.trim()
      if (trimmed.length > 0) {
        try {
          parsedPayload = JSON.parse(trimmed)
        } catch {
          setPayloadError(t("botDetail.errors.payloadInvalid"))
          setSending(false)
          return
        }
      }
    }

    try {
      const command: Record<string, unknown> = {
        type,
        status: "queued",
        createdAt: serverTimestamp(),
        requestedBy: user?.email ?? unknownLabel,
      }
      if (parsedPayload && Object.keys(parsedPayload).length > 0) {
        command.payload = parsedPayload
      }

      await addDoc(collection(activeDb, "bots", botId, "commands"), command)
      toast.success(t("botDetail.toasts.commandQueued"))
    } catch {
      toast.error(t("botDetail.toasts.commandFailed"))
    } finally {
      setSending(false)
    }
  }

  async function saveUniverseConfig() {
    if (!botId) return
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }

    const activeDb = db
    setConfigSaving(true)
    if (timeframeInvalid) {
      toast.error(t("botDetail.toasts.timeframeInvalid"))
      setConfigSaving(false)
      return
    }
    const advancedConfig = resolveAdvancedConfig()
    if (advancedConfig === null) {
      setConfigSaving(false)
      return
    }
    const pairs = parsePairs(pairsInput).map((pair) => pair.toUpperCase())
    const config: BotDesiredConfig = { mode }
    if (exchangeTrimmed) config.exchange = exchangeTrimmed
    if (timeframeTrimmed) config.timeframe = timeframeTrimmed
    if (pairs.length > 0) config.pairs = pairs
    if (strategyTrimmed) config.strategy = strategyTrimmed

    const risk: NonNullable<BotDesiredConfig["risk"]> = {}
    const maxPositionSize = parseOptionalNumber(riskMaxPositionSize)
    const maxDailyLoss = parseOptionalNumber(riskMaxDailyLoss)
    const maxOpenOrders = parseOptionalNumber(riskMaxOpenOrders)
    const maxLeverage = parseOptionalNumber(riskMaxLeverage)
    if (maxPositionSize !== undefined) risk.maxPositionSize = maxPositionSize
    if (maxDailyLoss !== undefined) risk.maxDailyLoss = maxDailyLoss
    if (maxOpenOrders !== undefined) risk.maxOpenOrders = maxOpenOrders
    if (maxLeverage !== undefined) risk.maxLeverage = maxLeverage
    if (Object.keys(risk).length > 0) {
      config.risk = risk
    }

    if (advancedConfig) {
      config.advanced = advancedConfig
    }

    try {
      await setDoc(
        doc(activeDb, "bots", botId),
        {
          desiredConfig: config,
          desiredConfigUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setConfigDirty(false)
      toast.success(t("botDetail.toasts.universeSaved"))
    } catch {
      toast.error(t("botDetail.toasts.universeSaveFailed"))
    } finally {
      setConfigSaving(false)
    }
  }

  async function applyUniverseConfig() {
    if (timeframeInvalid) {
      toast.error(t("botDetail.toasts.timeframeInvalid"))
      return
    }
    const advancedConfig = resolveAdvancedConfig()
    if (advancedConfig === null) {
      return
    }
    const pairs = parsePairs(pairsInput).map((pair) => pair.toUpperCase())
    const payload: Record<string, unknown> = {
      mode,
    }
    if (exchangeTrimmed) payload.exchange = exchangeTrimmed
    if (timeframeTrimmed) payload.timeframe = timeframeTrimmed
    if (pairs.length > 0) payload.pairs = pairs
    if (strategyTrimmed) payload.strategy = strategyTrimmed

    const risk: NonNullable<BotDesiredConfig["risk"]> = {}
    const maxPositionSize = parseOptionalNumber(riskMaxPositionSize)
    const maxDailyLoss = parseOptionalNumber(riskMaxDailyLoss)
    const maxOpenOrders = parseOptionalNumber(riskMaxOpenOrders)
    const maxLeverage = parseOptionalNumber(riskMaxLeverage)
    if (maxPositionSize !== undefined) risk.maxPositionSize = maxPositionSize
    if (maxDailyLoss !== undefined) risk.maxDailyLoss = maxDailyLoss
    if (maxOpenOrders !== undefined) risk.maxOpenOrders = maxOpenOrders
    if (maxLeverage !== undefined) risk.maxLeverage = maxLeverage
    if (Object.keys(risk).length > 0) {
      payload.risk = risk
    }
    if (advancedConfig) {
      payload.advanced = advancedConfig
    }
    await queueCommand("configure", payload)
  }

  const recommendedTopSymbols = useMemo(
    () =>
      (botPerformance?.topSymbols?.[recommendHorizon] ?? []).filter((item) =>
        isAssetEnabled(item.assetClass ?? null)
      ),
    [botPerformance, recommendHorizon, isAssetEnabled]
  )

  function applyRecommendedSymbols(mode: "append" | "replace", limit = RECOMMENDED_SYMBOL_LIMIT) {
    if (!botPerformance) {
      toast.error(t("botDetail.toasts.noAccuracyData"))
      return
    }
    const picks = recommendedTopSymbols
      .map((item) => item.symbol)
      .filter(Boolean)
      .slice(0, limit)
    if (picks.length === 0) {
      toast.error(t("botDetail.toasts.noRecommendations"))
      return
    }
    const existing = parsePairs(pairsInput)
    const next =
      mode === "replace" ? picks : uniqueList([...existing, ...picks])
    setPairsInput(next.join(", "))
    setConfigDirty(true)
    toast.success(
      mode === "replace"
        ? t("botDetail.toasts.pairsReplaced")
        : t("botDetail.toasts.pairsUpdated")
    )
  }

  function addRecommendedSymbol(symbol: string) {
    const trimmed = symbol.trim()
    if (!trimmed) return
    const existing = parsePairs(pairsInput)
    const next = uniqueList([...existing, trimmed])
    setPairsInput(next.join(", "))
    setConfigDirty(true)
    toast.success(t("botDetail.toasts.pairAdded", { symbol: trimmed }))
  }

  function renderBotPerformancePanel(horizon: (typeof PERFORMANCE_HORIZONS)[number]) {
    const stats = botPerformance?.overall?.[horizon]
    const assetStats = (botPerformance?.byAsset?.[horizon] ?? []).filter((asset) =>
      isAssetEnabled(asset.assetClass ?? null)
    )
    const topSymbols = (botPerformance?.topSymbols?.[horizon] ?? []).filter((symbol) =>
      isAssetEnabled(symbol.assetClass ?? null)
    )
    const bottomSymbols = (botPerformance?.bottomSymbols?.[horizon] ?? []).filter((symbol) =>
      isAssetEnabled(symbol.assetClass ?? null)
    )

    return (
      <div className="space-y-3">
        {!firebaseEnabled ? (
          <div className="text-sm opacity-70">{t("dashboard.performance.firebaseHint")}</div>
        ) : loadingPerformance ? (
          <div className="text-sm opacity-70">{t("dashboard.performance.loading")}</div>
        ) : !botPerformance ? (
          <div className="text-sm opacity-70">
            {t("botDetail.performance.noPredictions")}
          </div>
        ) : !stats ? (
          <div className="text-sm opacity-70">{t("botDetail.performance.noSignalsForHorizon")}</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.performance.accuracy")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {stats.hitRate !== undefined ? `${stats.hitRate.toFixed(1)}%` : naLabel}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.performance.signalsScored", { count: stats.count ?? 0 })}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.performance.avgReturn")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {formatPercent(stats.avgReturn)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.performance.horizon", { horizon })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("dashboard.performance.accuracyByAsset")}
              </div>
              {assetStats.length === 0 ? (
                <div className="text-sm opacity-70">{t("dashboard.performance.assetsEmpty")}</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {assetStats.map((asset) => {
                    const label = getAssetLabel(asset.assetClass)
                    return (
                      <div
                        key={asset.assetClass}
                        className="rounded-lg border border-border/60 bg-background/70 p-3"
                      >
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="mt-1 text-lg font-semibold">
                          {asset.hitRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.performance.assetLine", {
                            count: asset.count,
                            value: formatPercent(asset.avgReturn),
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("dashboard.performance.bestSymbols")}
                </div>
                {topSymbols.length === 0 ? (
                  <div className="text-sm opacity-70">{t("dashboard.performance.symbolsEmpty")}</div>
                ) : (
                  <div className="space-y-2">
                    {topSymbols.map((symbol) => (
                      <div
                        key={`top-${symbol.symbol}`}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-mono truncate">{symbol.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {getAssetLabel(symbol.assetClass)}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{t("dashboard.performance.hitRate", { value: symbol.hitRate.toFixed(1) })}</div>
                          <div>{formatPercent(symbol.avgReturn)}</div>
                          <div>{t("dashboard.labels.signalsCount", { count: symbol.count })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("dashboard.performance.needsAttention")}
                </div>
                {bottomSymbols.length === 0 ? (
                  <div className="text-sm opacity-70">{t("dashboard.performance.symbolsEmpty")}</div>
                ) : (
                  <div className="space-y-2">
                    {bottomSymbols.map((symbol) => (
                      <div
                        key={`bottom-${symbol.symbol}`}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-mono truncate">{symbol.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {getAssetLabel(symbol.assetClass)}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{t("dashboard.performance.hitRate", { value: symbol.hitRate.toFixed(1) })}</div>
                          <div>{formatPercent(symbol.avgReturn)}</div>
                          <div>{t("dashboard.labels.signalsCount", { count: symbol.count })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            {t("botDetail.header.kicker")}
          </div>
          <div className="text-2xl font-semibold">{bot?.name || botId}</div>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/bots">
          {t("botDetail.header.backToBots")}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="reveal lg:order-2" style={{ "--delay": "120ms" } as CSSProperties}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("botDetail.status.title")}</CardTitle>
            <StatusBadge status={bot?.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            {!firebaseEnabled ? (
              <div className="text-sm opacity-70">{t("botDetail.status.firebaseHint")}</div>
            ) : loadingBot ? (
              <div className="text-sm opacity-70">{t("botDetail.status.loading")}</div>
            ) : !bot ? (
              <div className="text-sm opacity-70">{t("botDetail.status.notFound")}</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {summary.map((item) => (
                    <div key={item.label} className="rounded-lg border border-border/60 bg-background/70 p-3">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-lg font-semibold">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("bots.table.engine")}
                    </div>
                    <div className="text-sm font-medium">{bot.engine || unknownLabel}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("bots.table.lastHeartbeat")}
                    </div>
                    <div className="text-sm font-medium">{formatTimestamp(bot.lastHeartbeat)}</div>
                  </div>
                </div>
                {bot.state && (
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("botDetail.status.latestTradingState")}
                    </div>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs">
                      {JSON.stringify(bot.state, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs value={detailTab} onValueChange={setDetailTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
              <TabsTrigger value="overview">{t("botDetail.tabs.overview")}</TabsTrigger>
              <TabsTrigger value="config">{t("botDetail.tabs.config")}</TabsTrigger>
              <TabsTrigger value="commands">{t("botDetail.tabs.commands")}</TabsTrigger>
              <TabsTrigger value="events">{t("botDetail.tabs.events")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="reveal" style={{ "--delay": "160ms" } as CSSProperties}>
                  <CardHeader>
                    <CardTitle className="text-base">{t("botDetail.recommendations.title")}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {t("botDetail.recommendations.subtitle")}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        {t("botDetail.recommendations.firebaseHint")}
                      </div>
                    ) : loadingRecommendations ? (
                      <div className="text-sm opacity-70">{t("botDetail.recommendations.loading")}</div>
                    ) : visibleRecommendations.length === 0 ? (
                      <div className="text-sm opacity-70">
                        {t("botDetail.recommendations.empty")}
                      </div>
                    ) : (
                      visibleRecommendations.slice(0, 3).map((trade) => (
                        <div
                          key={`${trade.assetClass}-${trade.symbol}`}
                          className="rounded-xl border border-border/60 bg-background/70 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">{trade.symbol}</div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setBreakdownAsset(trade)
                                    setBreakdownOpen(true)
                                  }}
                                  title={t("tradeNow.scoreBreakdown")}
                                >
                                  <InfoIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setChartAsset(trade)
                                    setChartOpen(true)
                                  }}
                                  title={t("tradeNow.viewChart")}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {getAssetLabel(trade.assetClass)}
                              </div>
                            </div>
                            <Badge variant="outline">
                              {t("dashboard.labels.score", {
                                score: trade.score?.toFixed(1) ?? naLabel,
                              })}
                            </Badge>
                          </div>
                          {trade.rationale && (() => {
                            const noteKind = findAnalysisNoteKind(trade.analysis?.details)
                            return (
                              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                                {noteKind ? (
                                  <Badge
                                    variant="outline"
                                    className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                                  >
                                    {t(`analysis.badges.${noteKind}`)}
                                  </Badge>
                                ) : null}
                                <span>{trade.rationale}</span>
                              </div>
                            )
                          })()}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => applyRecommendation(trade)}
                            disabled={!firebaseEnabled}
                          >
                            {t("botDetail.recommendations.use")}
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "190ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{t("botDetail.universe.title")}</CardTitle>
                    <Badge variant="outline">
                      {t("botDetail.universe.pairsCount", { count: pairsPreview.length })}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {t("bots.exchange")}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {exchangeTrimmed || naLabel}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {t("bots.timeframe")}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {timeframeTrimmed || naLabel}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0">
                        <div className="text-xs text-muted-foreground">{t("botDetail.config.mode")}</div>
                        <div className="text-sm font-medium truncate">{getModeLabel(mode)}</div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0 sm:col-span-2 xl:col-span-1">
                        <div className="text-xs text-muted-foreground">
                          {t("botDetail.config.strategy")}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {strategyTrimmed || naLabel}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                      {pairsPreview.length === 0
                        ? t("botDetail.universe.empty")
                        : pairsPreview
                            .slice(0, 6)
                            .map((pair) => pair.toUpperCase())
                            .join(", ")}
                      {pairsPreview.length > 6 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("botDetail.universe.more", { count: pairsPreview.length - 6 })}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailTab("config")}
                    >
                      {t("botDetail.universe.openConfig")}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="reveal lg:col-span-2" style={{ "--delay": "220ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{t("botDetail.performance.title")}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {t("botDetail.performance.subtitle")}
                      </div>
                    </div>
                    {botPerformance?.updatedAt && (
                      <Badge variant="outline">
                        {t("tradeNow.updatedAt", {
                          time: formatRelativeTimestamp(botPerformance.updatedAt),
                        })}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Tabs defaultValue="1h" className="space-y-3">
                      <TabsList className="grid w-full grid-cols-3">
                        {PERFORMANCE_HORIZONS.map((option) => (
                          <TabsTrigger key={option} value={option}>
                            {option}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {PERFORMANCE_HORIZONS.map((option) => (
                        <TabsContent key={`bot-perf-${option}`} value={option}>
                          {renderBotPerformancePanel(option)}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
          <Card
            ref={configCardRef}
            className="reveal"
            style={{ "--delay": "200ms" } as CSSProperties}
          >
            <CardHeader>
              <CardTitle className="text-base">{t("botDetail.config.title")}</CardTitle>
              <div className="text-xs text-muted-foreground">
                {t("botDetail.config.subtitle")}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="exchange">{t("bots.exchange")}</Label>
                      <Select
                        id="exchange"
                        value={exchange}
                        onChange={(event) => {
                          setExchange(event.target.value)
                          setConfigDirty(true)
                        }}
                      >
                        <option value="">{t("botDetail.config.selectExchange")}</option>
                        {exchangeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeframe">{t("bots.timeframe")}</Label>
                      <Select
                        id="timeframe"
                        value={timeframe}
                        onChange={(event) => {
                          setTimeframe(event.target.value)
                          setConfigDirty(true)
                        }}
                      >
                        <option value="">{t("botDetail.config.selectTimeframe")}</option>
                        {timeframeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                      {timeframeInvalid && (
                        <div className="text-xs text-destructive">
                          {t("botDetail.config.timeframeHint")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pairs">{t("botDetail.config.pairsLabel")}</Label>
                    <Textarea
                      id="pairs"
                      value={pairsInput}
                      onChange={(event) => {
                        setPairsInput(event.target.value)
                        setConfigDirty(true)
                      }}
                      className="min-h-24 font-mono text-xs"
                      placeholder={t("botDetail.config.pairsPlaceholder")}
                    />
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("botDetail.recommended.title")}
                        </div>
                        <div className="text-sm font-medium">
                          {t("botDetail.recommended.subtitle")}
                        </div>
                      </div>
                      {botPerformance?.updatedAt && (
                        <Badge variant="outline">
                          {t("tradeNow.updatedAt", {
                            time: formatRelativeTimestamp(botPerformance.updatedAt),
                          })}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {PERFORMANCE_HORIZONS.map((option) => (
                        <Button
                          key={`recommend-${option}`}
                          type="button"
                          size="sm"
                          variant={recommendHorizon === option ? "default" : "outline"}
                          onClick={() => setRecommendHorizon(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>

                    {!botPerformance ? (
                      <div className="text-sm text-muted-foreground">
                        {t("botDetail.recommended.noPerformance")}
                      </div>
                    ) : recommendedTopSymbols.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {t("botDetail.recommended.empty")}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recommendedTopSymbols
                          .slice(0, RECOMMENDED_SYMBOL_LIMIT)
                          .map((symbol) => (
                            <div
                              key={`recommend-${symbol.symbol}`}
                              className="grid min-w-0 gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                            >
                              <div className="min-w-0">
                                <div className="font-mono truncate">{symbol.symbol}</div>
                                <div className="text-xs text-muted-foreground">
                                  {getAssetLabel(symbol.assetClass)}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground sm:text-right">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span>{t("dashboard.performance.hitRate", { value: symbol.hitRate.toFixed(1) })}</span>
                                  <span>{formatPercent(symbol.avgReturn)}</span>
                                  <span>{t("dashboard.labels.signalsCount", { count: symbol.count })}</span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addRecommendedSymbol(symbol.symbol)}
                                >
                                  {t("common.add")}
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyRecommendedSymbols("append")}
                        disabled={!botPerformance}
                      >
                        {t("botDetail.recommended.appendTop", { count: RECOMMENDED_SYMBOL_LIMIT })}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyRecommendedSymbols("replace")}
                        disabled={!botPerformance}
                      >
                        {t("botDetail.recommended.replaceTop", { count: RECOMMENDED_SYMBOL_LIMIT })}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("botDetail.config.mode")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {modeOptions.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          variant={mode === option ? "default" : "outline"}
                          onClick={() => {
                            setMode(option)
                            setConfigDirty(true)
                          }}
                        >
                          {getModeLabel(option)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("botDetail.config.riskGuardrails")}</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="risk-max-position" className="text-xs text-muted-foreground">
                        {t("botDetail.config.risk.maxPosition")}
                      </Label>
                      <Input
                        id="risk-max-position"
                        type="number"
                        inputMode="decimal"
                        value={riskMaxPositionSize}
                        onChange={(event) => {
                          setRiskMaxPositionSize(event.target.value)
                          setConfigDirty(true)
                        }}
                        placeholder="0.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="risk-max-loss" className="text-xs text-muted-foreground">
                        {t("botDetail.config.risk.maxDailyLoss")}
                      </Label>
                      <Input
                        id="risk-max-loss"
                        type="number"
                        inputMode="decimal"
                        value={riskMaxDailyLoss}
                        onChange={(event) => {
                          setRiskMaxDailyLoss(event.target.value)
                          setConfigDirty(true)
                        }}
                        placeholder="250"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="risk-max-orders" className="text-xs text-muted-foreground">
                        {t("botDetail.config.risk.maxOpenOrders")}
                      </Label>
                      <Input
                        id="risk-max-orders"
                        type="number"
                        inputMode="numeric"
                        value={riskMaxOpenOrders}
                        onChange={(event) => {
                          setRiskMaxOpenOrders(event.target.value)
                          setConfigDirty(true)
                        }}
                        placeholder="5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="risk-max-leverage" className="text-xs text-muted-foreground">
                        {t("botDetail.config.risk.maxLeverage")}
                      </Label>
                      <Input
                        id="risk-max-leverage"
                        type="number"
                        inputMode="decimal"
                        value={riskMaxLeverage}
                        onChange={(event) => {
                          setRiskMaxLeverage(event.target.value)
                          setConfigDirty(true)
                        }}
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("botDetail.config.engineWizard")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="strategy">{t("botDetail.config.strategyPreset")}</Label>
                  <Input
                    id="strategy"
                    list="strategy-options"
                    value={strategy}
                    onChange={(event) => {
                      setStrategy(event.target.value)
                      setConfigDirty(true)
                    }}
                    placeholder={t("botDetail.config.strategyPlaceholder")}
                  />
                  {strategyOptions.length > 0 && (
                    <datalist id="strategy-options">
                      {strategyOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  )}
                  {strategyOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {strategyOptions.map((option) => (
                        <Button
                          key={`strategy-${option}`}
                          type="button"
                          size="sm"
                          variant={strategyTrimmed === option ? "secondary" : "outline"}
                          onClick={() => {
                            setStrategy(option)
                            setConfigDirty(true)
                          }}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t("botDetail.expert.title")}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("botDetail.expert.subtitle")}
                      </div>
                    </div>
                    <Sheet open={expertOpen} onOpenChange={handleExpertOpenChange}>
                      <SheetTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          {t("botDetail.expert.open")}
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="sm:max-w-lg">
                        <SheetHeader>
                          <SheetTitle>{t("botDetail.expert.sheetTitle")}</SheetTitle>
                          <SheetDescription>
                            {t("botDetail.expert.sheetDescription", {
                              label: engineConfigLabel,
                            })}
                          </SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                          {!expertUnlocked ? (
                            <>
                              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                                {t("botDetail.expert.warning")}
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setExpertUnlocked(true)}
                              >
                                {t("botDetail.expert.unlock")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="advanced-config">{engineConfigLabel}</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={applyWizardConfigText}
                                >
                                  {t("botDetail.expert.useWizard")}
                                </Button>
                              </div>
                              <Textarea
                                id="advanced-config"
                                value={advancedConfigText}
                                onChange={(event) => {
                                  setAdvancedConfigText(event.target.value)
                                  setAdvancedConfigError(null)
                                  setConfigDirty(true)
                                }}
                                className="min-h-48 font-mono text-xs"
                                placeholder={engineConfigTemplate}
                              />
                              {advancedConfigError && (
                                <div className="text-xs text-destructive">
                                  {advancedConfigError}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

              {bot?.capabilities && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div>
                    {t("botDetail.capabilities.exchanges", {
                      value: bot.capabilities.exchanges?.length
                        ? bot.capabilities.exchanges.join(", ")
                        : t("botDetail.capabilities.any"),
                    })}
                  </div>
                  <div>
                    {t("botDetail.capabilities.timeframes", {
                      value: bot.capabilities.timeframes?.length
                        ? bot.capabilities.timeframes.join(", ")
                        : t("botDetail.capabilities.any"),
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveUniverseConfig} disabled={configDisabled}>
                  {configSaving ? t("botDetail.config.saving") : t("botDetail.config.saveUniverse")}
                </Button>
                <Button variant="outline" onClick={applyUniverseConfig} disabled={commandDisabled}>
                  {t("botDetail.config.applyConfig")}
                </Button>
                {configDirty && (
                  <span className="text-xs text-muted-foreground">
                    {t("botDetail.config.unsavedChanges")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          <Card className="reveal" style={{ "--delay": "220ms" } as CSSProperties}>
            <CardHeader>
              <CardTitle className="text-base">{t("botDetail.commands.title")}</CardTitle>
              <div className="text-xs text-muted-foreground">
                {t("botDetail.commands.subtitlePrefix")} <code>bots/{botId}/commands</code>
                {t("botDetail.commands.subtitleSuffix")}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {availableCommands.map((option) => (
                  <Button
                    key={option.type}
                    variant="outline"
                    className="justify-start"
                    disabled={commandDisabled}
                    onClick={() => queueCommand(option.type)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {!firebaseEnabled && (
                <div className="text-xs text-muted-foreground">
                  {t("botDetail.commands.firebaseHintPrefix")} <code>.env</code>{" "}
                  {t("botDetail.commands.firebaseHintSuffix")}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("botDetail.commands.payloadLabel")}
                </div>
                <Textarea
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  className="min-h-28 font-mono text-xs"
                />
                {payloadError && <div className="text-xs text-destructive">{payloadError}</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("botDetail.events.title")}</CardTitle>
              <Badge variant="outline">{events.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {!firebaseEnabled ? (
                <div className="text-sm opacity-70">{t("dashboard.events.firebaseHintPrefix")} <code>.env</code>{" "}{t("dashboard.events.firebaseHintSuffix")}</div>
              ) : loadingEvents ? (
                <div className="text-sm opacity-70">{t("dashboard.events.loading")}</div>
              ) : events.length === 0 ? (
                <div className="text-sm opacity-70">{t("botDetail.events.empty")}</div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{event.type || t("dashboard.events.eventFallback")}</span>
                      <span>{formatTimestamp(event.createdAt)}</span>
                    </div>
                    <div className="mt-2 break-words text-sm font-medium">
                      {event.message || t("dashboard.events.messageFallback")}
                    </div>
                    {event.data && (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <AssetChartModal
        open={chartOpen}
        onOpenChange={setChartOpen}
        asset={chartAsset}
      />
      <ScoreBreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        asset={breakdownAsset}
      />
    </div>
    </div>
    </div>
  )
}
