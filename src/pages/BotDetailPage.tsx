import { useEffect, useMemo, useState, type CSSProperties } from "react"
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
import { toast } from "sonner"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotCommandType, BotDesiredConfig, BotDoc, BotEventDoc, BotMode } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/StatusBadge"
import { formatTimestamp } from "@/lib/format"
import { useAuth } from "@/features/auth/AuthProvider"
import { DEFAULT_EXCHANGES, DEFAULT_MODES, DEFAULT_TIMEFRAMES, parsePairs, uniqueList } from "@/lib/universe"

const commandOptions: { type: BotCommandType; label: string }[] = [
  { type: "start", label: "Start" },
  { type: "stop", label: "Stop" },
  { type: "restart", label: "Restart" },
  { type: "backtest", label: "Backtest" },
  { type: "paper", label: "Paper" },
  { type: "live", label: "Live" },
  { type: "reload_config", label: "Reload Config" },
]

type JesseRoute = {
  id: string
  exchange: string
  symbol: string
  timeframe: string
  strategy: string
}

const STRATEGY_PRESETS: Record<string, string[]> = {
  freqtrade: [
    "SampleStrategy",
    "ElliotWaveOscillator",
    "RSI",
    "EMACross",
    "BollingerBands",
  ],
  hummingbot: [
    "pure_market_making",
    "cross_exchange_market_making",
    "hedge",
    "amm_arb",
    "twap",
    "xemm",
  ],
  jesse: ["TrendFollowing", "MeanReversion", "RSI2", "MACD", "BollingerBands"],
  default: ["default"],
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
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
  const [hbOrderAmount, setHbOrderAmount] = useState("")
  const [hbBidSpread, setHbBidSpread] = useState("")
  const [hbAskSpread, setHbAskSpread] = useState("")
  const [hbOrderRefreshTime, setHbOrderRefreshTime] = useState("")
  const [hbOrderRefreshTolerance, setHbOrderRefreshTolerance] = useState("")
  const [hbMinProfitability, setHbMinProfitability] = useState("")
  const [jesseRoutes, setJesseRoutes] = useState<JesseRoute[]>([])
  const [advancedConfigText, setAdvancedConfigText] = useState("")
  const [advancedConfigError, setAdvancedConfigError] = useState<string | null>(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [configDirty, setConfigDirty] = useState(false)
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

  const exchangeOptions = useMemo(
    () => uniqueList([...DEFAULT_EXCHANGES, ...(bot?.capabilities?.exchanges ?? [])]),
    [bot?.capabilities?.exchanges]
  )

  const timeframeOptions = useMemo(
    () => uniqueList([...DEFAULT_TIMEFRAMES, ...(bot?.capabilities?.timeframes ?? [])]),
    [bot?.capabilities?.timeframes]
  )

  const modeOptions = useMemo(
    () => (bot?.capabilities?.modes?.length ? bot.capabilities.modes : Array.from(DEFAULT_MODES)),
    [bot?.capabilities?.modes]
  )

  const strategyOptions = useMemo(() => {
    const engineKey = bot?.engine ?? "default"
    return STRATEGY_PRESETS[engineKey] ?? STRATEGY_PRESETS.default
  }, [bot?.engine])

  const engineConfigLabel = useMemo(() => {
    switch (bot?.engine) {
      case "freqtrade":
        return "Freqtrade Config (JSON)"
      case "hummingbot":
        return "Hummingbot Strategy Config (JSON)"
      case "jesse":
        return "Jesse Routes Config (JSON)"
      default:
        return "Engine Config (JSON)"
    }
  }, [bot?.engine])

  const engineConfigTemplate = useMemo(() => {
    if (bot?.engine === "freqtrade") {
      const riskMaxOpen = parseOptionalNumber(riskMaxOpenOrders)
      const riskMaxPosition = parseOptionalNumber(riskMaxPositionSize)
      const freqtradePairs = parsePairs(pairsInput)
      const freqtradePairList =
        freqtradePairs.length > 0
          ? freqtradePairs.map((pair) => normalizePair(pair, "/"))
          : ["BTC/EUR"]
      return JSON.stringify(
        {
          exchange: {
            name: exchangeTrimmed || "kraken",
            pair_whitelist: freqtradePairList,
          },
          timeframe: timeframeTrimmed || "5m",
          dry_run: mode !== "live",
          strategy: strategyTrimmed || "SampleStrategy",
          ...(riskMaxOpen !== undefined ? { max_open_trades: riskMaxOpen } : {}),
          ...(riskMaxPosition !== undefined ? { stake_amount: riskMaxPosition } : {}),
        },
        null,
        2
      )
    }
    if (bot?.engine === "hummingbot") {
      const params: Record<string, number> = {}
      const orderAmount = parseOptionalNumber(hbOrderAmount)
      const bidSpread = parseOptionalNumber(hbBidSpread)
      const askSpread = parseOptionalNumber(hbAskSpread)
      const orderRefreshTime = parseOptionalNumber(hbOrderRefreshTime)
      const orderRefreshTolerance = parseOptionalNumber(hbOrderRefreshTolerance)
      const minProfitability = parseOptionalNumber(hbMinProfitability)
      if (orderAmount !== undefined) params.order_amount = orderAmount
      if (bidSpread !== undefined) params.bid_spread = bidSpread
      if (askSpread !== undefined) params.ask_spread = askSpread
      if (orderRefreshTime !== undefined) params.order_refresh_time = orderRefreshTime
      if (orderRefreshTolerance !== undefined) {
        params.order_refresh_tolerance_pct = orderRefreshTolerance
      }
      if (minProfitability !== undefined) params.min_profitability = minProfitability
      const hummingbotPairs = parsePairs(pairsInput)
      const hummingbotMarkets =
        hummingbotPairs.length > 0
          ? hummingbotPairs.map((pair) => normalizePair(pair, "-"))
          : ["BTC-USDT"]
      return JSON.stringify(
        {
          strategy: strategyTrimmed || "pure_market_making",
          exchange: exchangeTrimmed || "binance",
          markets: hummingbotMarkets,
          timeframe: timeframeTrimmed || "1m",
          params,
        },
        null,
        2
      )
    }
    if (bot?.engine === "jesse") {
      const routes =
        jesseRoutes.length > 0
          ? jesseRoutes.map((route) => ({
              exchange: route.exchange || exchangeTrimmed || "Binance",
              symbol: normalizePair(route.symbol || "BTC-USDT", "-"),
              timeframe: route.timeframe || timeframeTrimmed || "1m",
              strategy: route.strategy || strategyTrimmed || "TrendFollowing",
            }))
          : [
              {
                exchange: exchangeTrimmed || "Binance",
                symbol: normalizePair(parsePairs(pairsInput)[0] || "BTC-USDT", "-"),
                timeframe: timeframeTrimmed || "1m",
                strategy: strategyTrimmed || "TrendFollowing",
              },
            ]
      return JSON.stringify(
        {
          routes,
          data_routes: [],
          config: {
            exchange: exchangeTrimmed || "Binance",
            timeframe: timeframeTrimmed || "1m",
            mode,
          },
        },
        null,
        2
      )
    }
    return JSON.stringify({ config: {} }, null, 2)
  }, [
    bot?.engine,
    exchangeTrimmed,
    pairsInput,
    timeframeTrimmed,
    mode,
    strategyTrimmed,
    riskMaxOpenOrders,
    riskMaxPositionSize,
    hbOrderAmount,
    hbBidSpread,
    hbAskSpread,
    hbOrderRefreshTime,
    hbOrderRefreshTolerance,
    hbMinProfitability,
    jesseRoutes,
  ])

  const wizardConfig = useMemo(() => {
    const pairs = parsePairs(pairsInput)
    const pairsSlash = pairs.map((pair) => normalizePair(pair, "/"))
    const pairsDash = pairs.map((pair) => normalizePair(pair, "-"))
    if (bot?.engine === "freqtrade") {
      const config: Record<string, unknown> = {}
      if (exchangeTrimmed || pairsSlash.length > 0) {
        const exchangeConfig: Record<string, unknown> = {}
        if (exchangeTrimmed) exchangeConfig.name = exchangeTrimmed.toLowerCase()
        if (pairsSlash.length > 0) exchangeConfig.pair_whitelist = pairsSlash
        config.exchange = exchangeConfig
      }
      if (timeframeTrimmed) config.timeframe = timeframeTrimmed
      if (strategyTrimmed) config.strategy = strategyTrimmed
      const riskMaxOpen = parseOptionalNumber(riskMaxOpenOrders)
      const riskMaxPosition = parseOptionalNumber(riskMaxPositionSize)
      if (riskMaxOpen !== undefined) config.max_open_trades = riskMaxOpen
      if (riskMaxPosition !== undefined) config.stake_amount = riskMaxPosition
      return Object.keys(config).length > 0 ? config : null
    }
    if (bot?.engine === "hummingbot") {
      const config: Record<string, unknown> = {}
      if (strategyTrimmed) config.strategy = strategyTrimmed
      if (exchangeTrimmed) config.exchange = exchangeTrimmed
      if (pairsDash.length > 0) config.markets = pairsDash
      if (timeframeTrimmed) config.timeframe = timeframeTrimmed
      const params: Record<string, number> = {}
      const orderAmount = parseOptionalNumber(hbOrderAmount)
      const bidSpread = parseOptionalNumber(hbBidSpread)
      const askSpread = parseOptionalNumber(hbAskSpread)
      const orderRefreshTime = parseOptionalNumber(hbOrderRefreshTime)
      const orderRefreshTolerance = parseOptionalNumber(hbOrderRefreshTolerance)
      const minProfitability = parseOptionalNumber(hbMinProfitability)
      if (orderAmount !== undefined) params.order_amount = orderAmount
      if (bidSpread !== undefined) params.bid_spread = bidSpread
      if (askSpread !== undefined) params.ask_spread = askSpread
      if (orderRefreshTime !== undefined) params.order_refresh_time = orderRefreshTime
      if (orderRefreshTolerance !== undefined) {
        params.order_refresh_tolerance_pct = orderRefreshTolerance
      }
      if (minProfitability !== undefined) params.min_profitability = minProfitability
      if (Object.keys(params).length > 0) config.params = params
      return Object.keys(config).length > 0 ? config : null
    }
    if (bot?.engine === "jesse") {
      const hasDefaults =
        exchangeTrimmed || timeframeTrimmed || strategyTrimmed || pairs.length > 0
      if (jesseRoutes.length === 0 && !hasDefaults) return null
      const routes = (jesseRoutes.length > 0
        ? jesseRoutes
        : [
            {
              exchange: exchangeTrimmed,
              symbol: pairsDash[0] ?? "",
              timeframe: timeframeTrimmed,
              strategy: strategyTrimmed,
            },
          ]
      ).map((route) => ({
        exchange: route.exchange || exchangeTrimmed || "Binance",
        symbol: normalizePair(route.symbol || pairsDash[0] || "BTC-USDT", "-"),
        timeframe: route.timeframe || timeframeTrimmed || "1m",
        strategy: route.strategy || strategyTrimmed || "TrendFollowing",
      }))
      const advanced: Record<string, unknown> = {
        routes,
        data_routes: [],
      }
      const config: Record<string, unknown> = {}
      if (exchangeTrimmed) config.exchange = exchangeTrimmed
      if (timeframeTrimmed) config.timeframe = timeframeTrimmed
      if (mode) config.mode = mode
      if (Object.keys(config).length > 0) advanced.config = config
      return advanced
    }
    return null
  }, [
    bot?.engine,
    exchangeTrimmed,
    pairsInput,
    timeframeTrimmed,
    mode,
    strategyTrimmed,
    riskMaxOpenOrders,
    riskMaxPositionSize,
    hbOrderAmount,
    hbBidSpread,
    hbAskSpread,
    hbOrderRefreshTime,
    hbOrderRefreshTolerance,
    hbMinProfitability,
    jesseRoutes,
  ])

  const wizardConfigText = useMemo(
    () => (wizardConfig ? JSON.stringify(wizardConfig, null, 2) : ""),
    [wizardConfig]
  )

  useEffect(() => {
    if (!botId || !firebaseEnabled || !db) {
      setLoadingBot(false)
      return
    }

    const ref = doc(db, "bots", botId)
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

    const eventsQuery = query(
      collection(db, "bots", botId, "events"),
      orderBy("createdAt", "desc"),
      limit(15)
    )

    return onSnapshot(eventsQuery, (snap) => {
      setEvents(
        snap.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<BotEventDoc, "id" | "botId">
          return { id: docSnap.id, botId, ...data }
        })
      )
      setLoadingEvents(false)
    })
  }, [botId])

  useEffect(() => {
    if (!bot) return
    const desired = bot.desiredConfig
    const advanced = extractEngineAdvanced(desired?.advanced, bot.engine)
    let fallbackExchange = ""
    let fallbackPairs: string[] = []
    let fallbackTimeframe = ""
    let fallbackStrategy = ""

    if (advanced) {
      if (bot.engine === "freqtrade") {
        const exchangeConfig = advanced.exchange as Record<string, unknown> | undefined
        if (exchangeConfig?.name) fallbackExchange = String(exchangeConfig.name)
        if (Array.isArray(exchangeConfig?.pair_whitelist)) {
          fallbackPairs = exchangeConfig.pair_whitelist.map((pair) =>
            normalizePair(String(pair), "/")
          )
        }
        if (advanced.timeframe) fallbackTimeframe = String(advanced.timeframe)
        if (advanced.strategy) fallbackStrategy = String(advanced.strategy)
      }

      if (bot.engine === "hummingbot") {
        if (advanced.exchange) fallbackExchange = String(advanced.exchange)
        if (Array.isArray(advanced.markets)) {
          fallbackPairs = advanced.markets.map((pair) => normalizePair(String(pair), "/"))
        }
        if (advanced.timeframe) fallbackTimeframe = String(advanced.timeframe)
        if (advanced.strategy) fallbackStrategy = String(advanced.strategy)
      }

      if (bot.engine === "jesse") {
        const routes = Array.isArray(advanced.routes) ? advanced.routes : []
        const config = advanced.config as Record<string, unknown> | undefined
        if (config?.exchange) fallbackExchange = String(config.exchange)
        if (config?.timeframe) fallbackTimeframe = String(config.timeframe)
        if (routes.length > 0) {
          const firstRoute = routes[0] as Record<string, unknown>
          if (!fallbackExchange && firstRoute.exchange) {
            fallbackExchange = String(firstRoute.exchange)
          }
          if (!fallbackTimeframe && firstRoute.timeframe) {
            fallbackTimeframe = String(firstRoute.timeframe)
          }
          if (firstRoute.strategy) fallbackStrategy = String(firstRoute.strategy)
          if (firstRoute.symbol) {
            fallbackPairs = [normalizePair(String(firstRoute.symbol), "/")]
          }
        }
      }
    }

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
    if (bot.engine === "hummingbot") {
      const params = (advanced?.params as Record<string, unknown> | undefined) ?? {}
      setHbOrderAmount(params.order_amount?.toString() ?? "")
      setHbBidSpread(params.bid_spread?.toString() ?? "")
      setHbAskSpread(params.ask_spread?.toString() ?? "")
      setHbOrderRefreshTime(params.order_refresh_time?.toString() ?? "")
      setHbOrderRefreshTolerance(params.order_refresh_tolerance_pct?.toString() ?? "")
      setHbMinProfitability(params.min_profitability?.toString() ?? "")
    } else {
      setHbOrderAmount("")
      setHbBidSpread("")
      setHbAskSpread("")
      setHbOrderRefreshTime("")
      setHbOrderRefreshTolerance("")
      setHbMinProfitability("")
    }

    if (bot.engine === "jesse") {
      const routes = Array.isArray(advanced?.routes) ? advanced.routes : []
      if (routes.length > 0) {
        setJesseRoutes(
          routes.map((route) => ({
            id: makeId(),
            exchange: String(route.exchange ?? ""),
            symbol: String(route.symbol ?? ""),
            timeframe: String(route.timeframe ?? ""),
            strategy: String(route.strategy ?? ""),
          }))
        )
      } else {
        setJesseRoutes([
          {
            id: makeId(),
            exchange: exchangeValue || "Binance",
            symbol: normalizePair(pairsValue[0] || "BTC-USDT", "-"),
            timeframe: timeframeValue || "1m",
            strategy: strategyValue || "TrendFollowing",
          },
        ])
      }
    } else {
      setJesseRoutes([])
    }
    setAdvancedConfigError(null)
    setConfigDirty(false)
  }, [bot?.id, bot?.engine, desiredConfigKey])

  const summary = useMemo(() => {
    return [
      { label: "Positions", value: bot?.summary?.positions ?? "—" },
      { label: "Orders", value: bot?.summary?.orders ?? "—" },
      { label: "PnL", value: bot?.summary?.pnl ?? "—" },
    ]
  }, [bot])

  function parseOptionalNumber(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
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
    } catch (err) {
      setAdvancedConfigError("Advanced config must be valid JSON")
      return null
    }
  }

  function resolveAdvancedConfig() {
    const parsed = parseAdvancedConfig()
    if (parsed === null) return null
    if (parsed !== undefined) return parsed
    return wizardConfig ?? undefined
  }

  function applyWizardConfigText() {
    const template = wizardConfigText || engineConfigTemplate
    if (!template) return
    setAdvancedConfigText(template)
    setAdvancedConfigError(null)
    setConfigDirty(true)
  }

  function buildJesseRoute(): JesseRoute {
    const basePair = parsePairs(pairsInput)[0] || "BTC-USDT"
    return {
      id: makeId(),
      exchange: exchangeTrimmed || "Binance",
      symbol: normalizePair(basePair, "-"),
      timeframe: timeframeTrimmed || "1m",
      strategy: strategyTrimmed || "TrendFollowing",
    }
  }

  function updateJesseRoute(id: string, patch: Partial<JesseRoute>) {
    setJesseRoutes((prev) =>
      prev.map((route) => (route.id === id ? { ...route, ...patch } : route))
    )
    setConfigDirty(true)
  }

  function addJesseRoute() {
    setJesseRoutes((prev) => [...prev, buildJesseRoute()])
    setConfigDirty(true)
  }

  function removeJesseRoute(id: string) {
    setJesseRoutes((prev) => prev.filter((route) => route.id !== id))
    setConfigDirty(true)
  }

  async function queueCommand(type: BotCommandType, overridePayload?: Record<string, unknown>) {
    if (!botId) return
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }

    setPayloadError(null)
    setSending(true)

    let parsedPayload: Record<string, unknown> | undefined = overridePayload
    if (!overridePayload) {
      const trimmed = payload.trim()
      if (trimmed.length > 0) {
        try {
          parsedPayload = JSON.parse(trimmed)
        } catch (err) {
          setPayloadError("Payload must be valid JSON")
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
        requestedBy: user?.email ?? "unknown",
      }
      if (parsedPayload && Object.keys(parsedPayload).length > 0) {
        command.payload = parsedPayload
      }

      await addDoc(collection(db, "bots", botId, "commands"), command)
      toast.success("Command queued")
    } catch (err) {
      toast.error("Failed to queue command")
    } finally {
      setSending(false)
    }
  }

  async function saveUniverseConfig() {
    if (!botId) return
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }

    setConfigSaving(true)
    if (timeframeInvalid) {
      toast.error("Timeframe must look like 1m, 1h, 1d")
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
        doc(db, "bots", botId),
        {
          desiredConfig: config,
          desiredConfigUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setConfigDirty(false)
      toast.success("Universe saved")
    } catch (err) {
      toast.error("Failed to save universe")
    } finally {
      setConfigSaving(false)
    }
  }

  async function applyUniverseConfig() {
    if (timeframeInvalid) {
      toast.error("Timeframe must look like 1m, 1h, 1d")
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Bot Detail</div>
          <div className="text-2xl font-semibold">{bot?.name || botId}</div>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/bots">
          ← Back to bots
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="reveal" style={{ "--delay": "120ms" } as CSSProperties}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Status & Metadata</CardTitle>
            <StatusBadge status={bot?.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            {!firebaseEnabled ? (
              <div className="text-sm opacity-70">Configure Firebase to load bot details.</div>
            ) : loadingBot ? (
              <div className="text-sm opacity-70">Loading bot…</div>
            ) : !bot ? (
              <div className="text-sm opacity-70">Bot not found.</div>
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
                    <div className="text-xs text-muted-foreground">Engine</div>
                    <div className="text-sm font-medium">{bot.engine || "unknown"}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Last Heartbeat</div>
                    <div className="text-sm font-medium">{formatTimestamp(bot.lastHeartbeat)}</div>
                  </div>
                </div>
                {bot.state && (
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Latest Trading State</div>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                      {JSON.stringify(bot.state, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="reveal" style={{ "--delay": "180ms" } as CSSProperties}>
            <CardHeader>
              <CardTitle className="text-base">Trading Universe & Config</CardTitle>
              <div className="text-xs text-muted-foreground">
                Choose exchange, pairs, timeframe, and advanced config. Saved configs are applied when adapters reload.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exchange">Exchange</Label>
                <Input
                  id="exchange"
                  list="exchange-options"
                  value={exchange}
                  onChange={(event) => {
                    setExchange(event.target.value)
                    setConfigDirty(true)
                  }}
                  placeholder="kraken"
                />
                <datalist id="exchange-options">
                  {exchangeOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pairs">Pairs (comma or newline separated)</Label>
                <Textarea
                  id="pairs"
                  value={pairsInput}
                  onChange={(event) => {
                    setPairsInput(event.target.value)
                    setConfigDirty(true)
                  }}
                  className="min-h-24 font-mono text-xs"
                  placeholder="BTC/USDT, ETH/USDT"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeframe">Timeframe</Label>
                <Input
                  id="timeframe"
                  list="timeframe-options"
                  value={timeframe}
                  onChange={(event) => {
                    setTimeframe(event.target.value)
                    setConfigDirty(true)
                  }}
                  placeholder="5m"
                />
                <datalist id="timeframe-options">
                  {timeframeOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {timeframeInvalid && (
                  <div className="text-xs text-destructive">Timeframe should look like 1m, 1h, 1d.</div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Mode</Label>
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
                      {option}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Risk guardrails</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="risk-max-position" className="text-xs text-muted-foreground">
                      Max position size
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
                      Max daily loss
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
                      Max open orders
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
                      Max leverage
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

              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Engine Wizard
                </div>
                <div className="space-y-2">
                  <Label htmlFor="strategy">Strategy preset</Label>
                  <Input
                    id="strategy"
                    list="strategy-options"
                    value={strategy}
                    onChange={(event) => {
                      setStrategy(event.target.value)
                      setConfigDirty(true)
                    }}
                    placeholder={
                      bot?.engine === "hummingbot"
                        ? "pure_market_making"
                        : bot?.engine === "jesse"
                        ? "TrendFollowing"
                        : "SampleStrategy"
                    }
                  />
                  {strategyOptions.length > 0 && (
                    <datalist id="strategy-options">
                      {strategyOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  )}
                </div>

                {bot?.engine === "hummingbot" && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Configure core Hummingbot params. These are written under <code>params</code>.
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="hb-order-amount" className="text-xs text-muted-foreground">
                          Order amount
                        </Label>
                        <Input
                          id="hb-order-amount"
                          type="number"
                          inputMode="decimal"
                          value={hbOrderAmount}
                          onChange={(event) => {
                            setHbOrderAmount(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="0.01"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="hb-bid-spread" className="text-xs text-muted-foreground">
                          Bid spread (%)
                        </Label>
                        <Input
                          id="hb-bid-spread"
                          type="number"
                          inputMode="decimal"
                          value={hbBidSpread}
                          onChange={(event) => {
                            setHbBidSpread(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="0.6"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="hb-ask-spread" className="text-xs text-muted-foreground">
                          Ask spread (%)
                        </Label>
                        <Input
                          id="hb-ask-spread"
                          type="number"
                          inputMode="decimal"
                          value={hbAskSpread}
                          onChange={(event) => {
                            setHbAskSpread(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="0.6"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="hb-order-refresh-time"
                          className="text-xs text-muted-foreground"
                        >
                          Order refresh time (s)
                        </Label>
                        <Input
                          id="hb-order-refresh-time"
                          type="number"
                          inputMode="decimal"
                          value={hbOrderRefreshTime}
                          onChange={(event) => {
                            setHbOrderRefreshTime(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="hb-order-refresh-tolerance"
                          className="text-xs text-muted-foreground"
                        >
                          Refresh tolerance (%)
                        </Label>
                        <Input
                          id="hb-order-refresh-tolerance"
                          type="number"
                          inputMode="decimal"
                          value={hbOrderRefreshTolerance}
                          onChange={(event) => {
                            setHbOrderRefreshTolerance(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="0.2"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="hb-min-profitability"
                          className="text-xs text-muted-foreground"
                        >
                          Min profitability (%)
                        </Label>
                        <Input
                          id="hb-min-profitability"
                          type="number"
                          inputMode="decimal"
                          value={hbMinProfitability}
                          onChange={(event) => {
                            setHbMinProfitability(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="0.1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {bot?.engine === "jesse" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Routes</div>
                      <Button type="button" variant="outline" size="sm" onClick={addJesseRoute}>
                        Add route
                      </Button>
                    </div>
                    {jesseRoutes.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No routes configured yet.
                      </div>
                    ) : (
                      jesseRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="rounded-md border border-border/60 bg-background/70 p-3 space-y-2"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-exchange-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Exchange
                              </Label>
                              <Input
                                id={`jesse-exchange-${route.id}`}
                                list="exchange-options"
                                value={route.exchange}
                                onChange={(event) =>
                                  updateJesseRoute(route.id, { exchange: event.target.value })
                                }
                                placeholder={exchangeTrimmed || "Binance"}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-symbol-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Symbol
                              </Label>
                              <Input
                                id={`jesse-symbol-${route.id}`}
                                value={route.symbol}
                                onChange={(event) =>
                                  updateJesseRoute(route.id, { symbol: event.target.value })
                                }
                                placeholder="BTC-USDT"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-timeframe-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Timeframe
                              </Label>
                              <Input
                                id={`jesse-timeframe-${route.id}`}
                                list="timeframe-options"
                                value={route.timeframe}
                                onChange={(event) =>
                                  updateJesseRoute(route.id, { timeframe: event.target.value })
                                }
                                placeholder={timeframeTrimmed || "1m"}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-strategy-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Strategy
                              </Label>
                              <Input
                                id={`jesse-strategy-${route.id}`}
                                list="strategy-options"
                                value={route.strategy}
                                onChange={(event) =>
                                  updateJesseRoute(route.id, { strategy: event.target.value })
                                }
                                placeholder={strategyTrimmed || "TrendFollowing"}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeJesseRoute(route.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="advanced-config">{engineConfigLabel}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={applyWizardConfigText}
                  >
                    Use wizard JSON
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
                  className="min-h-36 font-mono text-xs"
                  placeholder={engineConfigTemplate}
                />
                {advancedConfigError && (
                  <div className="text-xs text-destructive">{advancedConfigError}</div>
                )}
              </div>

              {bot?.capabilities && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div>Exchanges: {bot.capabilities.exchanges?.length ? bot.capabilities.exchanges.join(", ") : "any"}</div>
                  <div>Timeframes: {bot.capabilities.timeframes?.length ? bot.capabilities.timeframes.join(", ") : "any"}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveUniverseConfig} disabled={configDisabled}>
                  {configSaving ? "Saving..." : "Save Universe"}
                </Button>
                <Button variant="outline" onClick={applyUniverseConfig} disabled={commandDisabled}>
                  Apply Config
                </Button>
                {configDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              </div>
            </CardContent>
          </Card>

          <Card className="reveal" style={{ "--delay": "220ms" } as CSSProperties}>
            <CardHeader>
              <CardTitle className="text-base">Command Console</CardTitle>
              <div className="text-xs text-muted-foreground">
                Commands are queued into <code>bots/{botId}/commands</code>.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {commandOptions.map((option) => (
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
                  Firebase is not configured. Update <code>.env</code> to enable commands.
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Optional JSON payload</div>
                <Textarea
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  className="min-h-28 font-mono text-xs"
                />
                {payloadError && <div className="text-xs text-destructive">{payloadError}</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Events</CardTitle>
          <Badge variant="outline">{events.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {!firebaseEnabled ? (
            <div className="text-sm opacity-70">Configure Firebase to load events.</div>
          ) : loadingEvents ? (
            <div className="text-sm opacity-70">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="text-sm opacity-70">No events yet.</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{event.type || "event"}</span>
                  <span>{formatTimestamp(event.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm font-medium">
                  {event.message || "Adapter emitted an event without a message."}
                </div>
                {event.data && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
