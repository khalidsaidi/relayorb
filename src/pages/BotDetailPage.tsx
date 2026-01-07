import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
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
import { useAuth } from "@/features/auth/auth-context"
import { DEFAULT_EXCHANGES, DEFAULT_MODES, DEFAULT_TIMEFRAMES, parsePairs, uniqueList } from "@/lib/universe"

const commandOptions: { type: BotCommandType; label: string }[] = [
  { type: "start", label: "Start" },
  { type: "stop", label: "Stop" },
  { type: "restart", label: "Restart" },
  { type: "backtest", label: "Backtest" },
  { type: "paper", label: "Paper" },
  { type: "live", label: "Live" },
  { type: "reload_config", label: "Reload Config" },
  { type: "update_agent", label: "Update Agent" },
]

const ENGINE_COMMANDS: Record<string, BotCommandType[]> = {
  freqtrade: ["start", "stop", "restart", "reload_config", "update_agent"],
  hummingbot: ["start", "stop", "restart", "reload_config", "backtest", "update_agent"],
  jesse: ["paper", "live", "stop", "restart", "backtest", "update_agent"],
  default: ["start", "stop", "restart", "reload_config", "update_agent"],
}

type JesseRoute = {
  id: string
  exchange: string
  symbol: string
  timeframe: string
  strategy: string
}

type JesseDataRoute = {
  id: string
  exchange: string
  symbol: string
  timeframe: string
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

const FREQTRADE_STAKE_CURRENCIES = ["USDT", "USD", "USDC", "BTC", "ETH", "EUR"]
const ORDER_TYPE_OPTIONS = ["limit", "market"]
const PERFORMANCE_HORIZONS = ["1h", "24h", "7d"] as const
const RECOMMENDED_SYMBOL_LIMIT = 6

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

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
  const [ftStakeCurrency, setFtStakeCurrency] = useState("")
  const [ftStakeAmount, setFtStakeAmount] = useState("")
  const [ftMaxOpenTrades, setFtMaxOpenTrades] = useState("")
  const [ftStoploss, setFtStoploss] = useState("")
  const [ftTrailingEnabled, setFtTrailingEnabled] = useState(false)
  const [ftTrailingPositive, setFtTrailingPositive] = useState("")
  const [ftTrailingOffset, setFtTrailingOffset] = useState("")
  const [ftEntryOrderType, setFtEntryOrderType] = useState("limit")
  const [ftExitOrderType, setFtExitOrderType] = useState("limit")
  const [ftStoplossOnExchange, setFtStoplossOnExchange] = useState(false)
  const [ftCooldownEnabled, setFtCooldownEnabled] = useState(false)
  const [ftCooldownCandles, setFtCooldownCandles] = useState("")
  const [ftDrawdownEnabled, setFtDrawdownEnabled] = useState(false)
  const [ftDrawdownLookback, setFtDrawdownLookback] = useState("")
  const [ftDrawdownTradeLimit, setFtDrawdownTradeLimit] = useState("")
  const [ftDrawdownStopDuration, setFtDrawdownStopDuration] = useState("")
  const [ftDrawdownMax, setFtDrawdownMax] = useState("")
  const [ftStoplossGuardEnabled, setFtStoplossGuardEnabled] = useState(false)
  const [ftStoplossGuardLookback, setFtStoplossGuardLookback] = useState("")
  const [ftStoplossGuardTradeLimit, setFtStoplossGuardTradeLimit] = useState("")
  const [ftStoplossGuardStopDuration, setFtStoplossGuardStopDuration] = useState("")
  const [ftStoplossGuardOnlyPerPair, setFtStoplossGuardOnlyPerPair] = useState(false)
  const [hbOrderAmount, setHbOrderAmount] = useState("")
  const [hbBidSpread, setHbBidSpread] = useState("")
  const [hbAskSpread, setHbAskSpread] = useState("")
  const [hbOrderRefreshTime, setHbOrderRefreshTime] = useState("")
  const [hbOrderRefreshTolerance, setHbOrderRefreshTolerance] = useState("")
  const [hbMinProfitability, setHbMinProfitability] = useState("")
  const [hbOrderLevels, setHbOrderLevels] = useState("")
  const [hbOrderLevelAmount, setHbOrderLevelAmount] = useState("")
  const [hbOrderLevelSpread, setHbOrderLevelSpread] = useState("")
  const [hbInventorySkewEnabled, setHbInventorySkewEnabled] = useState(false)
  const [hbInventoryTargetBase, setHbInventoryTargetBase] = useState("")
  const [hbPriceCeiling, setHbPriceCeiling] = useState("")
  const [hbPriceFloor, setHbPriceFloor] = useState("")
  const [hbMaxOrderAge, setHbMaxOrderAge] = useState("")
  const [hbCancelOrderWaitTime, setHbCancelOrderWaitTime] = useState("")
  const [hbMakerExchange, setHbMakerExchange] = useState("")
  const [hbTakerExchange, setHbTakerExchange] = useState("")
  const [hbMakerMarket, setHbMakerMarket] = useState("")
  const [hbTakerMarket, setHbTakerMarket] = useState("")
  const [hbXemmMinProfitability, setHbXemmMinProfitability] = useState("")
  const [hbXemmOrderAmount, setHbXemmOrderAmount] = useState("")
  const [hbXemmTopDepthTolerance, setHbXemmTopDepthTolerance] = useState("")
  const [hbTwapTotalAmount, setHbTwapTotalAmount] = useState("")
  const [hbTwapOrderStep, setHbTwapOrderStep] = useState("")
  const [hbTwapOrderInterval, setHbTwapOrderInterval] = useState("")
  const [hbTwapOrderSide, setHbTwapOrderSide] = useState("buy")
  const [hbTwapLimitPrice, setHbTwapLimitPrice] = useState("")
  const [jesseRoutes, setJesseRoutes] = useState<JesseRoute[]>([])
  const [jesseDataRoutes, setJesseDataRoutes] = useState<JesseDataRoute[]>([])
  const [jesseWarmupCandles, setJesseWarmupCandles] = useState("")
  const [jesseFeeRate, setJesseFeeRate] = useState("")
  const [jesseLeverage, setJesseLeverage] = useState("")
  const [advancedConfigText, setAdvancedConfigText] = useState("")
  const [advancedConfigError, setAdvancedConfigError] = useState<string | null>(null)
  const [baselineAdvanced, setBaselineAdvanced] = useState<Record<string, unknown> | null>(null)
  const [expertOpen, setExpertOpen] = useState(false)
  const [expertUnlocked, setExpertUnlocked] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configDirty, setConfigDirty] = useState(false)
  const [recommendations, setRecommendations] = useState<MarketHotTrade[]>([])
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
  const hbStrategyKey =
    bot?.engine === "hummingbot"
      ? (strategyTrimmed || "pure_market_making").toLowerCase()
      : ""
  const hbIsPMM = hbStrategyKey.includes("pure_market_making")
  const hbIsXemm =
    hbStrategyKey.includes("xemm") ||
    hbStrategyKey.includes("cross_exchange_market_making")
  const hbIsTwap = hbStrategyKey.includes("twap")

  const desiredConfigKey = useMemo(
    () => JSON.stringify(bot?.desiredConfig ?? {}),
    [bot?.desiredConfig]
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
      if (ftStakeCurrency) config.stake_currency = ftStakeCurrency
      const riskMaxOpen = parseOptionalNumber(riskMaxOpenOrders)
      const riskMaxPosition = parseOptionalNumber(riskMaxPositionSize)
      const maxOpenTrades =
        parseOptionalNumber(ftMaxOpenTrades) ?? riskMaxOpen
      const stakeAmount =
        parseOptionalNumber(ftStakeAmount) ?? riskMaxPosition
      if (maxOpenTrades !== undefined) config.max_open_trades = maxOpenTrades
      if (stakeAmount !== undefined) config.stake_amount = stakeAmount
      const stoploss = parseOptionalNumber(ftStoploss)
      if (stoploss !== undefined) config.stoploss = stoploss
      config.trailing_stop = ftTrailingEnabled
      if (ftTrailingEnabled) {
        const trailingPositive = parseOptionalNumber(ftTrailingPositive)
        const trailingOffset = parseOptionalNumber(ftTrailingOffset)
        if (trailingPositive !== undefined) {
          config.trailing_stop_positive = trailingPositive
        }
        if (trailingOffset !== undefined) {
          config.trailing_stop_positive_offset = trailingOffset
        }
      }
      const orderTypes: Record<string, unknown> = {}
      if (ftEntryOrderType) orderTypes.entry = ftEntryOrderType
      if (ftExitOrderType) orderTypes.exit = ftExitOrderType
      orderTypes.stoploss_on_exchange = ftStoplossOnExchange
      if (Object.keys(orderTypes).length > 0) {
        config.order_types = orderTypes
      }

      const protections: Array<Record<string, unknown>> = []
      if (ftCooldownEnabled) {
        const cooldownCandles = parseOptionalNumber(ftCooldownCandles) ?? 5
        protections.push({
          method: "CooldownPeriod",
          stop_duration_candles: cooldownCandles,
        })
      }
      if (ftDrawdownEnabled) {
        const lookback = parseOptionalNumber(ftDrawdownLookback) ?? 1440
        const tradeLimit = parseOptionalNumber(ftDrawdownTradeLimit) ?? 1
        const stopDuration = parseOptionalNumber(ftDrawdownStopDuration) ?? 60
        const maxDrawdown = parseOptionalNumber(ftDrawdownMax) ?? 0.2
        protections.push({
          method: "MaxDrawdown",
          lookback_period_candles: lookback,
          trade_limit: tradeLimit,
          stop_duration_candles: stopDuration,
          max_allowed_drawdown: maxDrawdown,
        })
      }
      if (ftStoplossGuardEnabled) {
        const lookback = parseOptionalNumber(ftStoplossGuardLookback) ?? 20
        const tradeLimit = parseOptionalNumber(ftStoplossGuardTradeLimit) ?? 1
        const stopDuration = parseOptionalNumber(ftStoplossGuardStopDuration) ?? 10
        protections.push({
          method: "StoplossGuard",
          lookback_period_candles: lookback,
          trade_limit: tradeLimit,
          stop_duration_candles: stopDuration,
          only_per_pair: ftStoplossGuardOnlyPerPair,
        })
      }
      if (protections.length > 0) {
        config.protections = protections
      }
      return Object.keys(config).length > 0 ? config : null
    }
    if (bot?.engine === "hummingbot") {
      const config: Record<string, unknown> = {}
      const hbStrategy = strategyTrimmed || "pure_market_making"
      config.strategy = hbStrategy
      if (exchangeTrimmed) config.exchange = exchangeTrimmed
      if (pairsDash.length > 0) config.markets = pairsDash
      if (timeframeTrimmed) config.timeframe = timeframeTrimmed
      const params: Record<string, number | boolean | string> = {}
      const strategyKey = hbStrategy.toLowerCase()
      const isPMM = strategyKey.includes("pure_market_making")
      const isXemm = strategyKey.includes("xemm") || strategyKey.includes("cross_exchange_market_making")
      const isTwap = strategyKey.includes("twap")
      const orderAmount = parseOptionalNumber(hbOrderAmount)
      const bidSpread = parseOptionalNumber(hbBidSpread)
      const askSpread = parseOptionalNumber(hbAskSpread)
      const orderRefreshTime = parseOptionalNumber(hbOrderRefreshTime)
      const orderRefreshTolerance = parseOptionalNumber(hbOrderRefreshTolerance)
      const minProfitability = parseOptionalNumber(hbMinProfitability)
      const orderLevels = parseOptionalNumber(hbOrderLevels)
      const orderLevelAmount = parseOptionalNumber(hbOrderLevelAmount)
      const orderLevelSpread = parseOptionalNumber(hbOrderLevelSpread)
      const inventoryTargetBase = parseOptionalNumber(hbInventoryTargetBase)
      const priceCeiling = parseOptionalNumber(hbPriceCeiling)
      const priceFloor = parseOptionalNumber(hbPriceFloor)
      const maxOrderAge = parseOptionalNumber(hbMaxOrderAge)
      const cancelOrderWaitTime = parseOptionalNumber(hbCancelOrderWaitTime)
      if (isPMM) {
        if (orderAmount !== undefined) params.order_amount = orderAmount
        if (bidSpread !== undefined) params.bid_spread = bidSpread
        if (askSpread !== undefined) params.ask_spread = askSpread
        if (orderRefreshTime !== undefined) params.order_refresh_time = orderRefreshTime
        if (orderRefreshTolerance !== undefined) {
          params.order_refresh_tolerance_pct = orderRefreshTolerance
        }
        if (minProfitability !== undefined) params.min_profitability = minProfitability
        if (orderLevels !== undefined) params.order_levels = orderLevels
        if (orderLevelAmount !== undefined) params.order_level_amount = orderLevelAmount
        if (orderLevelSpread !== undefined) params.order_level_spread = orderLevelSpread
        params.inventory_skew_enabled = hbInventorySkewEnabled
        if (inventoryTargetBase !== undefined) {
          params.inventory_target_base_pct = inventoryTargetBase
        }
        if (priceCeiling !== undefined) params.price_ceiling = priceCeiling
        if (priceFloor !== undefined) params.price_floor = priceFloor
        if (maxOrderAge !== undefined) params.max_order_age = maxOrderAge
        if (cancelOrderWaitTime !== undefined) {
          params.cancel_order_wait_time = cancelOrderWaitTime
        }
      }
      if (isXemm) {
        const makerExchange = hbMakerExchange || exchangeTrimmed
        const takerExchange = hbTakerExchange || exchangeTrimmed
        const makerMarket = hbMakerMarket || pairsDash[0] || ""
        const takerMarket = hbTakerMarket || pairsDash[0] || ""
        if (makerExchange) params.maker_exchange = makerExchange
        if (takerExchange) params.taker_exchange = takerExchange
        if (makerMarket) params.maker_market = makerMarket
        if (takerMarket) params.taker_market = takerMarket
        const xemmMinProfit = parseOptionalNumber(hbXemmMinProfitability)
        const xemmOrderAmount = parseOptionalNumber(hbXemmOrderAmount)
        const topDepthTolerance = parseOptionalNumber(hbXemmTopDepthTolerance)
        if (xemmMinProfit !== undefined) params.min_profitability = xemmMinProfit
        if (xemmOrderAmount !== undefined) params.order_amount = xemmOrderAmount
        if (topDepthTolerance !== undefined) params.top_depth_tolerance = topDepthTolerance
      }
      if (isTwap) {
        const totalAmount = parseOptionalNumber(hbTwapTotalAmount)
        const stepSize = parseOptionalNumber(hbTwapOrderStep)
        const stepTime = parseOptionalNumber(hbTwapOrderInterval)
        const limitPrice = parseOptionalNumber(hbTwapLimitPrice)
        if (totalAmount !== undefined) params.total_order_amount = totalAmount
        if (stepSize !== undefined) params.order_step_size = stepSize
        if (stepTime !== undefined) params.order_step_time = stepTime
        if (hbTwapOrderSide) params.order_side = hbTwapOrderSide
        if (limitPrice !== undefined) params.limit_price = limitPrice
      }
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
        data_routes:
          jesseDataRoutes.length > 0
            ? jesseDataRoutes.map((route) => ({
                exchange: route.exchange || exchangeTrimmed || "Binance",
                symbol: normalizePair(route.symbol || "BTC-USDT", "-"),
                timeframe: route.timeframe || timeframeTrimmed || "1m",
              }))
            : [],
      }
      const config: Record<string, unknown> = {}
      if (exchangeTrimmed) config.exchange = exchangeTrimmed
      if (timeframeTrimmed) config.timeframe = timeframeTrimmed
      if (mode) config.mode = mode
      const warmup = parseOptionalNumber(jesseWarmupCandles)
      const feeRate = parseOptionalNumber(jesseFeeRate)
      const leverage = parseOptionalNumber(jesseLeverage)
      if (warmup !== undefined) config.warmup_candles = warmup
      if (feeRate !== undefined) config.fee = feeRate
      if (leverage !== undefined) config.leverage = leverage
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
    ftStakeCurrency,
    ftStakeAmount,
    ftMaxOpenTrades,
    ftStoploss,
    ftTrailingEnabled,
    ftTrailingPositive,
    ftTrailingOffset,
    ftEntryOrderType,
    ftExitOrderType,
    ftStoplossOnExchange,
    ftCooldownEnabled,
    ftCooldownCandles,
    ftDrawdownEnabled,
    ftDrawdownLookback,
    ftDrawdownTradeLimit,
    ftDrawdownStopDuration,
    ftDrawdownMax,
    ftStoplossGuardEnabled,
    ftStoplossGuardLookback,
    ftStoplossGuardTradeLimit,
    ftStoplossGuardStopDuration,
    ftStoplossGuardOnlyPerPair,
    hbOrderAmount,
    hbBidSpread,
    hbAskSpread,
    hbOrderRefreshTime,
    hbOrderRefreshTolerance,
    hbMinProfitability,
    hbOrderLevels,
    hbOrderLevelAmount,
    hbOrderLevelSpread,
    hbInventorySkewEnabled,
    hbInventoryTargetBase,
    hbPriceCeiling,
    hbPriceFloor,
    hbMaxOrderAge,
    hbCancelOrderWaitTime,
    hbMakerExchange,
    hbTakerExchange,
    hbMakerMarket,
    hbTakerMarket,
    hbXemmMinProfitability,
    hbXemmOrderAmount,
    hbXemmTopDepthTolerance,
    hbTwapTotalAmount,
    hbTwapOrderStep,
    hbTwapOrderInterval,
    hbTwapOrderSide,
    hbTwapLimitPrice,
    jesseRoutes,
    jesseDataRoutes,
    jesseWarmupCandles,
    jesseFeeRate,
    jesseLeverage,
  ])

  const wizardConfigText = useMemo(
    () => (wizardConfig ? JSON.stringify(wizardConfig, null, 2) : ""),
    [wizardConfig]
  )

  const availableCommands = useMemo(() => {
    const engineKey = bot?.engine || "default"
    const allowed = ENGINE_COMMANDS[engineKey] || ENGINE_COMMANDS.default
    return commandOptions.filter((option) => allowed.includes(option.type))
  }, [bot?.engine])

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
    let fallbackExchange = defaultExchange
    let fallbackPairs: string[] = []
    let fallbackTimeframe = defaultTimeframe
    let fallbackStrategy = defaultStrategy

    setBaselineAdvanced(advanced ? { ...advanced } : null)

    if (bot.engine === "freqtrade") {
      setFtStakeCurrency("")
      setFtStakeAmount("")
      setFtMaxOpenTrades("")
      setFtStoploss("")
      setFtTrailingEnabled(false)
      setFtTrailingPositive("")
      setFtTrailingOffset("")
      setFtEntryOrderType("limit")
      setFtExitOrderType("limit")
      setFtStoplossOnExchange(false)
      setFtCooldownEnabled(false)
      setFtCooldownCandles("")
      setFtDrawdownEnabled(false)
      setFtDrawdownLookback("")
      setFtDrawdownTradeLimit("")
      setFtDrawdownStopDuration("")
      setFtDrawdownMax("")
      setFtStoplossGuardEnabled(false)
      setFtStoplossGuardLookback("")
      setFtStoplossGuardTradeLimit("")
      setFtStoplossGuardStopDuration("")
      setFtStoplossGuardOnlyPerPair(false)
    }

    if (bot.engine === "hummingbot") {
      setHbOrderLevels("")
      setHbOrderLevelAmount("")
      setHbOrderLevelSpread("")
      setHbInventorySkewEnabled(false)
      setHbInventoryTargetBase("")
      setHbPriceCeiling("")
      setHbPriceFloor("")
      setHbMaxOrderAge("")
      setHbCancelOrderWaitTime("")
      setHbMakerExchange("")
      setHbTakerExchange("")
      setHbMakerMarket("")
      setHbTakerMarket("")
      setHbXemmMinProfitability("")
      setHbXemmOrderAmount("")
      setHbXemmTopDepthTolerance("")
      setHbTwapTotalAmount("")
      setHbTwapOrderStep("")
      setHbTwapOrderInterval("")
      setHbTwapOrderSide("buy")
      setHbTwapLimitPrice("")
    }

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
        if (advanced.stake_currency) {
          setFtStakeCurrency(String(advanced.stake_currency))
        }
        if (advanced.stake_amount !== undefined) {
          setFtStakeAmount(String(advanced.stake_amount))
        }
        if (advanced.max_open_trades !== undefined) {
          setFtMaxOpenTrades(String(advanced.max_open_trades))
        }
        if (advanced.stoploss !== undefined) {
          setFtStoploss(String(advanced.stoploss))
        }
        if (advanced.trailing_stop !== undefined) {
          setFtTrailingEnabled(Boolean(advanced.trailing_stop))
        }
        if (advanced.trailing_stop_positive !== undefined) {
          setFtTrailingPositive(String(advanced.trailing_stop_positive))
        }
        if (advanced.trailing_stop_positive_offset !== undefined) {
          setFtTrailingOffset(String(advanced.trailing_stop_positive_offset))
        }
        const orderTypes = advanced.order_types as Record<string, unknown> | undefined
        if (orderTypes?.entry) {
          setFtEntryOrderType(String(orderTypes.entry))
        }
        if (orderTypes?.exit) {
          setFtExitOrderType(String(orderTypes.exit))
        }
        if (orderTypes?.stoploss_on_exchange !== undefined) {
          setFtStoplossOnExchange(Boolean(orderTypes.stoploss_on_exchange))
        }
        const protections = Array.isArray(advanced.protections)
          ? advanced.protections
          : []
        const cooldown = protections.find(
          (item: Record<string, unknown>) => item?.method === "CooldownPeriod"
        ) as Record<string, unknown> | undefined
        if (cooldown) {
          setFtCooldownEnabled(true)
          if (cooldown.stop_duration_candles !== undefined) {
            setFtCooldownCandles(String(cooldown.stop_duration_candles))
          }
        }
        const maxDrawdown = protections.find(
          (item: Record<string, unknown>) => item?.method === "MaxDrawdown"
        ) as Record<string, unknown> | undefined
        if (maxDrawdown) {
          setFtDrawdownEnabled(true)
          if (maxDrawdown.lookback_period_candles !== undefined) {
            setFtDrawdownLookback(String(maxDrawdown.lookback_period_candles))
          }
          if (maxDrawdown.trade_limit !== undefined) {
            setFtDrawdownTradeLimit(String(maxDrawdown.trade_limit))
          }
          if (maxDrawdown.stop_duration_candles !== undefined) {
            setFtDrawdownStopDuration(String(maxDrawdown.stop_duration_candles))
          }
          if (maxDrawdown.max_allowed_drawdown !== undefined) {
            setFtDrawdownMax(String(maxDrawdown.max_allowed_drawdown))
          }
        }
        const stoplossGuard = protections.find(
          (item: Record<string, unknown>) => item?.method === "StoplossGuard"
        ) as Record<string, unknown> | undefined
        if (stoplossGuard) {
          setFtStoplossGuardEnabled(true)
          if (stoplossGuard.lookback_period_candles !== undefined) {
            setFtStoplossGuardLookback(String(stoplossGuard.lookback_period_candles))
          }
          if (stoplossGuard.trade_limit !== undefined) {
            setFtStoplossGuardTradeLimit(String(stoplossGuard.trade_limit))
          }
          if (stoplossGuard.stop_duration_candles !== undefined) {
            setFtStoplossGuardStopDuration(String(stoplossGuard.stop_duration_candles))
          }
          if (stoplossGuard.only_per_pair !== undefined) {
            setFtStoplossGuardOnlyPerPair(Boolean(stoplossGuard.only_per_pair))
          }
        }
      }

      if (bot.engine === "hummingbot") {
        if (advanced.exchange) fallbackExchange = String(advanced.exchange)
        if (Array.isArray(advanced.markets)) {
          fallbackPairs = advanced.markets.map((pair) => normalizePair(String(pair), "/"))
        }
        if (advanced.timeframe) fallbackTimeframe = String(advanced.timeframe)
        if (advanced.strategy) fallbackStrategy = String(advanced.strategy)
        const params = (advanced.params as Record<string, unknown> | undefined) ?? {}
        if (params.order_levels !== undefined) {
          setHbOrderLevels(String(params.order_levels))
        }
        if (params.order_level_amount !== undefined) {
          setHbOrderLevelAmount(String(params.order_level_amount))
        }
        if (params.order_level_spread !== undefined) {
          setHbOrderLevelSpread(String(params.order_level_spread))
        }
        if (params.inventory_skew_enabled !== undefined) {
          setHbInventorySkewEnabled(Boolean(params.inventory_skew_enabled))
        }
        if (params.inventory_target_base_pct !== undefined) {
          setHbInventoryTargetBase(String(params.inventory_target_base_pct))
        }
        if (params.price_ceiling !== undefined) {
          setHbPriceCeiling(String(params.price_ceiling))
        }
        if (params.price_floor !== undefined) {
          setHbPriceFloor(String(params.price_floor))
        }
        if (params.max_order_age !== undefined) {
          setHbMaxOrderAge(String(params.max_order_age))
        }
        if (params.cancel_order_wait_time !== undefined) {
          setHbCancelOrderWaitTime(String(params.cancel_order_wait_time))
        }
        if (params.maker_exchange !== undefined) {
          setHbMakerExchange(String(params.maker_exchange))
        }
        if (params.taker_exchange !== undefined) {
          setHbTakerExchange(String(params.taker_exchange))
        }
        if (params.maker_market !== undefined) {
          setHbMakerMarket(String(params.maker_market))
        }
        if (params.taker_market !== undefined) {
          setHbTakerMarket(String(params.taker_market))
        }
        if (params.min_profitability !== undefined) {
          const value = String(params.min_profitability)
          setHbMinProfitability(value)
          setHbXemmMinProfitability(value)
        }
        if (params.order_amount !== undefined) {
          const value = String(params.order_amount)
          setHbOrderAmount(value)
          setHbXemmOrderAmount(value)
        }
        if (params.top_depth_tolerance !== undefined) {
          setHbXemmTopDepthTolerance(String(params.top_depth_tolerance))
        }
        if (params.total_order_amount !== undefined) {
          setHbTwapTotalAmount(String(params.total_order_amount))
        }
        if (params.order_step_size !== undefined) {
          setHbTwapOrderStep(String(params.order_step_size))
        }
        if (params.order_step_time !== undefined) {
          setHbTwapOrderInterval(String(params.order_step_time))
        }
        if (params.order_side !== undefined) {
          setHbTwapOrderSide(String(params.order_side))
        }
        if (params.limit_price !== undefined) {
          setHbTwapLimitPrice(String(params.limit_price))
        }
      }

      if (bot.engine === "jesse") {
        const routes = Array.isArray(advanced.routes) ? advanced.routes : []
        const config = advanced.config as Record<string, unknown> | undefined
        if (config?.exchange) fallbackExchange = String(config.exchange)
        if (config?.timeframe) fallbackTimeframe = String(config.timeframe)
        if (config?.warmup_candles !== undefined) {
          setJesseWarmupCandles(String(config.warmup_candles))
        }
        if (config?.fee !== undefined) {
          setJesseFeeRate(String(config.fee))
        }
        if (config?.leverage !== undefined) {
          setJesseLeverage(String(config.leverage))
        }
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
      setHbOrderLevels("")
      setHbOrderLevelAmount("")
      setHbOrderLevelSpread("")
      setHbInventorySkewEnabled(false)
      setHbInventoryTargetBase("")
      setHbPriceCeiling("")
      setHbPriceFloor("")
      setHbMaxOrderAge("")
      setHbCancelOrderWaitTime("")
      setHbMakerExchange("")
      setHbTakerExchange("")
      setHbMakerMarket("")
      setHbTakerMarket("")
      setHbXemmMinProfitability("")
      setHbXemmOrderAmount("")
      setHbXemmTopDepthTolerance("")
      setHbTwapTotalAmount("")
      setHbTwapOrderStep("")
      setHbTwapOrderInterval("")
      setHbTwapOrderSide("buy")
      setHbTwapLimitPrice("")
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
      const dataRoutes = Array.isArray(advanced?.data_routes) ? advanced.data_routes : []
      if (dataRoutes.length > 0) {
        setJesseDataRoutes(
          dataRoutes.map((route: Record<string, unknown>) => ({
            id: makeId(),
            exchange: String(route.exchange ?? exchangeValue ?? "Binance"),
            symbol: String(route.symbol ?? "BTC-USDT"),
            timeframe: String(route.timeframe ?? timeframeValue ?? "1m"),
          }))
        )
      } else {
        setJesseDataRoutes([])
      }
    } else {
      setJesseRoutes([])
      setJesseDataRoutes([])
      setJesseWarmupCandles("")
      setJesseFeeRate("")
      setJesseLeverage("")
    }

    if (bot.engine !== "freqtrade") {
      setFtStakeCurrency("")
      setFtStakeAmount("")
      setFtMaxOpenTrades("")
      setFtStoploss("")
      setFtTrailingEnabled(false)
      setFtTrailingPositive("")
      setFtTrailingOffset("")
      setFtEntryOrderType("limit")
      setFtExitOrderType("limit")
      setFtStoplossOnExchange(false)
      setFtCooldownEnabled(false)
      setFtCooldownCandles("")
      setFtDrawdownEnabled(false)
      setFtDrawdownLookback("")
      setFtDrawdownTradeLimit("")
      setFtDrawdownStopDuration("")
      setFtDrawdownMax("")
      setFtStoplossGuardEnabled(false)
      setFtStoplossGuardLookback("")
      setFtStoplossGuardTradeLimit("")
      setFtStoplossGuardStopDuration("")
      setFtStoplossGuardOnlyPerPair(false)
    }
    setAdvancedConfigError(null)
    setConfigDirty(false)
  }, [bot, desiredConfigKey])

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
      setAdvancedConfigError("Advanced config must be valid JSON")
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
    const pairDash = normalizePair(trade.symbol, "-")
    const defaultStrategy =
      bot?.engine === "hummingbot"
        ? "pure_market_making"
        : bot?.engine === "jesse"
        ? "TrendFollowing"
        : "SampleStrategy"
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
    toast.success("Recommendation applied to config")
    setTimeout(() => {
      configCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)

    if (bot?.engine === "jesse") {
      setJesseRoutes([
        {
          id: makeId(),
          exchange: nextExchange || "Binance",
          symbol: pairDash,
          timeframe: nextTimeframe,
          strategy: nextStrategy,
        },
      ])
    }

    if (bot?.engine === "freqtrade") {
      setAdvancedConfigText(
        JSON.stringify(
          {
            exchange: {
              name: nextExchange || "kraken",
              pair_whitelist: [pairSlash],
            },
            timeframe: nextTimeframe,
            dry_run: mode !== "live",
            strategy: nextStrategy,
          },
          null,
          2
        )
      )
      return
    }

    if (bot?.engine === "hummingbot") {
      setAdvancedConfigText(
        JSON.stringify(
          {
            strategy: nextStrategy,
            exchange: nextExchange || "binance",
            markets: [pairDash],
            timeframe: nextTimeframe,
          },
          null,
          2
        )
      )
      return
    }

    if (bot?.engine === "jesse") {
      setAdvancedConfigText(
        JSON.stringify(
          {
            routes: [
              {
                exchange: nextExchange || "Binance",
                symbol: pairDash,
                timeframe: nextTimeframe,
                strategy: nextStrategy,
              },
            ],
            data_routes: [],
            config: {
              exchange: nextExchange || "Binance",
              timeframe: nextTimeframe,
              mode,
            },
          },
          null,
          2
        )
      )
    }
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

  function buildJesseDataRoute(): JesseDataRoute {
    const basePair = parsePairs(pairsInput)[0] || "BTC-USDT"
    return {
      id: makeId(),
      exchange: exchangeTrimmed || "Binance",
      symbol: normalizePair(basePair, "-"),
      timeframe: timeframeTrimmed || "1m",
    }
  }

  function updateJesseDataRoute(id: string, patch: Partial<JesseDataRoute>) {
    setJesseDataRoutes((prev) =>
      prev.map((route) => (route.id === id ? { ...route, ...patch } : route))
    )
    setConfigDirty(true)
  }

  function addJesseDataRoute() {
    setJesseDataRoutes((prev) => [...prev, buildJesseDataRoute()])
    setConfigDirty(true)
  }

  function removeJesseDataRoute(id: string) {
    setJesseDataRoutes((prev) => prev.filter((route) => route.id !== id))
    setConfigDirty(true)
  }

  async function queueCommand(type: BotCommandType, overridePayload?: Record<string, unknown>) {
    if (!botId) return
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
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

      await addDoc(collection(activeDb, "bots", botId, "commands"), command)
      toast.success("Command queued")
    } catch {
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

    const activeDb = db
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
        doc(activeDb, "bots", botId),
        {
          desiredConfig: config,
          desiredConfigUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setConfigDirty(false)
      toast.success("Universe saved")
    } catch {
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

  function applyRecommendedSymbols(mode: "append" | "replace", limit = RECOMMENDED_SYMBOL_LIMIT) {
    if (!botPerformance) {
      toast.error("No bot accuracy data yet.")
      return
    }
    const picks = (botPerformance.topSymbols?.[recommendHorizon] ?? [])
      .map((item) => item.symbol)
      .filter(Boolean)
      .slice(0, limit)
    if (picks.length === 0) {
      toast.error("No recommendations yet for this horizon.")
      return
    }
    const existing = parsePairs(pairsInput)
    const next =
      mode === "replace" ? picks : uniqueList([...existing, ...picks])
    setPairsInput(next.join(", "))
    setConfigDirty(true)
    toast.success(
      mode === "replace"
        ? "Pairs replaced with recommendations"
        : "Pairs updated with recommendations"
    )
  }

  function addRecommendedSymbol(symbol: string) {
    const trimmed = symbol.trim()
    if (!trimmed) return
    const existing = parsePairs(pairsInput)
    const next = uniqueList([...existing, trimmed])
    setPairsInput(next.join(", "))
    setConfigDirty(true)
    toast.success(`${trimmed} added to pairs`)
  }

  function renderBotPerformancePanel(horizon: (typeof PERFORMANCE_HORIZONS)[number]) {
    const stats = botPerformance?.overall?.[horizon]
    const assetStats = botPerformance?.byAsset?.[horizon] ?? []
    const topSymbols = botPerformance?.topSymbols?.[horizon] ?? []
    const bottomSymbols = botPerformance?.bottomSymbols?.[horizon] ?? []

    return (
      <div className="space-y-3">
        {!firebaseEnabled ? (
          <div className="text-sm opacity-70">Connect Firebase to load accuracy data.</div>
        ) : loadingPerformance ? (
          <div className="text-sm opacity-70">Loading performance...</div>
        ) : !botPerformance ? (
          <div className="text-sm opacity-70">
            This bot has not produced scored predictions yet. Start it and wait for a full horizon
            to pass.
          </div>
        ) : !stats ? (
          <div className="text-sm opacity-70">No scored signals yet for this horizon.</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs text-muted-foreground">Accuracy</div>
                <div className="mt-1 text-2xl font-semibold">
                  {stats.hitRate !== undefined ? `${stats.hitRate.toFixed(1)}%` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats.count ?? 0} signals scored
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="text-xs text-muted-foreground">Avg return</div>
                <div className="mt-1 text-2xl font-semibold">
                  {formatPercent(stats.avgReturn)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Horizon {horizon}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Accuracy by asset
              </div>
              {assetStats.length === 0 ? (
                <div className="text-sm opacity-70">No asset breakdown yet.</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {assetStats.map((asset) => {
                    const label =
                      asset.assetClass === "crypto"
                        ? "Crypto"
                        : asset.assetClass === "stock"
                          ? "Stocks"
                          : asset.assetClass === "forex"
                            ? "FX"
                            : asset.assetClass
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
                          {asset.count} signals • {formatPercent(asset.avgReturn)}
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
                  Best symbols
                </div>
                {topSymbols.length === 0 ? (
                  <div className="text-sm opacity-70">No symbol ranking yet.</div>
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
                            {symbol.assetClass ?? "unknown"}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{symbol.hitRate.toFixed(1)}% hit</div>
                          <div>{formatPercent(symbol.avgReturn)}</div>
                          <div>{symbol.count} signals</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Needs attention
                </div>
                {bottomSymbols.length === 0 ? (
                  <div className="text-sm opacity-70">No symbol ranking yet.</div>
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
                            {symbol.assetClass ?? "unknown"}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{symbol.hitRate.toFixed(1)}% hit</div>
                          <div>{formatPercent(symbol.avgReturn)}</div>
                          <div>{symbol.count} signals</div>
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
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Bot Detail</div>
          <div className="text-2xl font-semibold">{bot?.name || botId}</div>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/bots">
          ← Back to bots
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="reveal lg:order-2" style={{ "--delay": "120ms" } as CSSProperties}>
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
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="reveal" style={{ "--delay": "160ms" } as CSSProperties}>
                  <CardHeader>
                    <CardTitle className="text-base">AI Recommendations</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Curated hot trades with bot consensus and market momentum.
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        Connect Firebase to load recommendations.
                      </div>
                    ) : loadingRecommendations ? (
                      <div className="text-sm opacity-70">Loading recommendations...</div>
                    ) : recommendations.length === 0 ? (
                      <div className="text-sm opacity-70">
                        No recommendations yet. Deploy the market intel worker to populate this feed.
                      </div>
                    ) : (
                      recommendations.slice(0, 3).map((trade) => (
                        <div
                          key={`${trade.assetClass}-${trade.symbol}`}
                          className="rounded-xl border border-border/60 bg-background/70 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{trade.symbol}</div>
                              <div className="text-xs text-muted-foreground">
                                {trade.assetClass}
                              </div>
                            </div>
                            <Badge variant="outline">
                              Score {trade.score?.toFixed(1) ?? "--"}
                            </Badge>
                          </div>
                          {trade.rationale && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {trade.rationale}
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => applyRecommendation(trade)}
                            disabled={!firebaseEnabled}
                          >
                            Use recommendation
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "190ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Active Universe</CardTitle>
                    <Badge variant="outline">{pairsPreview.length} pairs</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0">
                        <div className="text-xs text-muted-foreground">Exchange</div>
                        <div className="text-sm font-medium truncate">
                          {exchangeTrimmed || "--"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0">
                        <div className="text-xs text-muted-foreground">Timeframe</div>
                        <div className="text-sm font-medium truncate">
                          {timeframeTrimmed || "--"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0">
                        <div className="text-xs text-muted-foreground">Mode</div>
                        <div className="text-sm font-medium truncate">{mode || "--"}</div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3 min-w-0 sm:col-span-2 xl:col-span-1">
                        <div className="text-xs text-muted-foreground">Strategy</div>
                        <div className="text-sm font-medium truncate">
                          {strategyTrimmed || "--"}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                      {pairsPreview.length === 0
                        ? "No pairs selected yet."
                        : pairsPreview
                            .slice(0, 6)
                            .map((pair) => pair.toUpperCase())
                            .join(", ")}
                      {pairsPreview.length > 6 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          +{pairsPreview.length - 6} more
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailTab("config")}
                    >
                      Open config
                    </Button>
                  </CardContent>
                </Card>

                <Card className="reveal lg:col-span-2" style={{ "--delay": "220ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Bot Prediction Accuracy</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        How this bot performed by symbol and asset class.
                      </div>
                    </div>
                    {botPerformance?.updatedAt && (
                      <Badge variant="outline">
                        Updated {formatRelativeTimestamp(botPerformance.updatedAt)}
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
              <CardTitle className="text-base">Trading Universe & Config</CardTitle>
              <div className="text-xs text-muted-foreground">
                Choose exchange, pairs, timeframe, and advanced config. Saved configs are applied when adapters reload.
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="exchange">Exchange</Label>
                      <Select
                        id="exchange"
                        value={exchange}
                        onChange={(event) => {
                          setExchange(event.target.value)
                          setConfigDirty(true)
                        }}
                      >
                        <option value="">Select exchange</option>
                        {exchangeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeframe">Timeframe</Label>
                      <Select
                        id="timeframe"
                        value={timeframe}
                        onChange={(event) => {
                          setTimeframe(event.target.value)
                          setConfigDirty(true)
                        }}
                      >
                        <option value="">Select timeframe</option>
                        {timeframeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                      {timeframeInvalid && (
                        <div className="text-xs text-destructive">
                          Timeframe should look like 1m, 1h, 1d.
                        </div>
                      )}
                    </div>
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

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Recommended universe
                        </div>
                        <div className="text-sm font-medium">
                          Based on this bot's prediction accuracy
                        </div>
                      </div>
                      {botPerformance?.updatedAt && (
                        <Badge variant="outline">
                          Updated {formatRelativeTimestamp(botPerformance.updatedAt)}
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
                        Start the bot and let it emit signals to generate recommendations.
                      </div>
                    ) : (botPerformance.topSymbols?.[recommendHorizon] ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No recommended symbols yet for this horizon.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(botPerformance.topSymbols?.[recommendHorizon] ?? [])
                          .slice(0, RECOMMENDED_SYMBOL_LIMIT)
                          .map((symbol) => (
                            <div
                              key={`recommend-${symbol.symbol}`}
                              className="grid min-w-0 gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                            >
                              <div className="min-w-0">
                                <div className="font-mono truncate">{symbol.symbol}</div>
                                <div className="text-xs text-muted-foreground">
                                  {symbol.assetClass ?? "unknown"}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground sm:text-right">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span>{symbol.hitRate.toFixed(1)}% hit</span>
                                  <span>{formatPercent(symbol.avgReturn)}</span>
                                  <span>{symbol.count} signals</span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addRecommendedSymbol(symbol.symbol)}
                                >
                                  Add
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
                        Append top {RECOMMENDED_SYMBOL_LIMIT}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyRecommendedSymbols("replace")}
                        disabled={!botPerformance}
                      >
                        Replace with top {RECOMMENDED_SYMBOL_LIMIT}
                      </Button>
                    </div>
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

                {bot?.engine === "freqtrade" && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Tune stake sizing, execution style, and trailing protection.
                    </div>
                    <div className="space-y-2">
                      <Label>Stake currency</Label>
                      <div className="flex flex-wrap gap-2">
                        {FREQTRADE_STAKE_CURRENCIES.map((currency) => (
                          <Button
                            key={currency}
                            type="button"
                            variant={ftStakeCurrency === currency ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setFtStakeCurrency(currency)
                              setConfigDirty(true)
                            }}
                          >
                            {currency}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="ft-stake-amount" className="text-xs text-muted-foreground">
                          Stake amount
                        </Label>
                        <Input
                          id="ft-stake-amount"
                          type="number"
                          inputMode="decimal"
                          value={ftStakeAmount}
                          onChange={(event) => {
                            setFtStakeAmount(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ft-max-open" className="text-xs text-muted-foreground">
                          Max open trades
                        </Label>
                        <Input
                          id="ft-max-open"
                          type="number"
                          inputMode="numeric"
                          value={ftMaxOpenTrades}
                          onChange={(event) => {
                            setFtMaxOpenTrades(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="3"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ft-stoploss" className="text-xs text-muted-foreground">
                          Stoploss (negative %)
                        </Label>
                        <Input
                          id="ft-stoploss"
                          type="number"
                          inputMode="decimal"
                          value={ftStoploss}
                          onChange={(event) => {
                            setFtStoploss(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="-0.1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>Trailing stop</Label>
                        <Button
                          type="button"
                          variant={ftTrailingEnabled ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFtTrailingEnabled((prev) => !prev)
                            setConfigDirty(true)
                          }}
                          aria-pressed={ftTrailingEnabled}
                        >
                          {ftTrailingEnabled ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
                      {ftTrailingEnabled && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor="ft-trailing-positive"
                              className="text-xs text-muted-foreground"
                            >
                              Trailing positive (%)
                            </Label>
                            <Input
                              id="ft-trailing-positive"
                              type="number"
                              inputMode="decimal"
                              value={ftTrailingPositive}
                              onChange={(event) => {
                                setFtTrailingPositive(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="0.02"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="ft-trailing-offset"
                              className="text-xs text-muted-foreground"
                            >
                              Trailing offset (%)
                            </Label>
                            <Input
                              id="ft-trailing-offset"
                              type="number"
                              inputMode="decimal"
                              value={ftTrailingOffset}
                              onChange={(event) => {
                                setFtTrailingOffset(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="0.04"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Order types</Label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Entry</Label>
                          <div className="flex flex-wrap gap-2">
                            {ORDER_TYPE_OPTIONS.map((option) => (
                              <Button
                                key={`entry-${option}`}
                                type="button"
                                variant={ftEntryOrderType === option ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setFtEntryOrderType(option)
                                  setConfigDirty(true)
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Exit</Label>
                          <div className="flex flex-wrap gap-2">
                            {ORDER_TYPE_OPTIONS.map((option) => (
                              <Button
                                key={`exit-${option}`}
                                type="button"
                                variant={ftExitOrderType === option ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setFtExitOrderType(option)
                                  setConfigDirty(true)
                                }}
                              >
                                {option}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={ftStoplossOnExchange ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFtStoplossOnExchange((prev) => !prev)
                            setConfigDirty(true)
                          }}
                          aria-pressed={ftStoplossOnExchange}
                        >
                          Stoploss on exchange
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Protections
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label>Cooldown</Label>
                          <Button
                            type="button"
                            variant={ftCooldownEnabled ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setFtCooldownEnabled((prev) => !prev)
                              setConfigDirty(true)
                            }}
                            aria-pressed={ftCooldownEnabled}
                          >
                            {ftCooldownEnabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                        {ftCooldownEnabled && (
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={ftCooldownCandles}
                            onChange={(event) => {
                              setFtCooldownCandles(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="Cooldown candles (e.g. 5)"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label>Max drawdown</Label>
                          <Button
                            type="button"
                            variant={ftDrawdownEnabled ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setFtDrawdownEnabled((prev) => !prev)
                              setConfigDirty(true)
                            }}
                            aria-pressed={ftDrawdownEnabled}
                          >
                            {ftDrawdownEnabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                        {ftDrawdownEnabled && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={ftDrawdownLookback}
                              onChange={(event) => {
                                setFtDrawdownLookback(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Lookback candles"
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={ftDrawdownTradeLimit}
                              onChange={(event) => {
                                setFtDrawdownTradeLimit(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Trade limit"
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={ftDrawdownStopDuration}
                              onChange={(event) => {
                                setFtDrawdownStopDuration(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Stop duration candles"
                            />
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={ftDrawdownMax}
                              onChange={(event) => {
                                setFtDrawdownMax(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Max drawdown (e.g. 0.2)"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label>Stoploss guard</Label>
                          <Button
                            type="button"
                            variant={ftStoplossGuardEnabled ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setFtStoplossGuardEnabled((prev) => !prev)
                              setConfigDirty(true)
                            }}
                            aria-pressed={ftStoplossGuardEnabled}
                          >
                            {ftStoplossGuardEnabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                        {ftStoplossGuardEnabled && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={ftStoplossGuardLookback}
                              onChange={(event) => {
                                setFtStoplossGuardLookback(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Lookback candles"
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={ftStoplossGuardTradeLimit}
                              onChange={(event) => {
                                setFtStoplossGuardTradeLimit(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Trade limit"
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={ftStoplossGuardStopDuration}
                              onChange={(event) => {
                                setFtStoplossGuardStopDuration(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="Stop duration candles"
                            />
                            <Button
                              type="button"
                              variant={ftStoplossGuardOnlyPerPair ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => {
                                setFtStoplossGuardOnlyPerPair((prev) => !prev)
                                setConfigDirty(true)
                              }}
                              aria-pressed={ftStoplossGuardOnlyPerPair}
                            >
                              Only per pair
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {bot?.engine === "hummingbot" && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Strategy-specific Hummingbot settings for{" "}
                      <span className="font-medium">{strategyTrimmed || "pure_market_making"}</span>.
                    </div>
                    {hbIsPMM && (
                      <div className="space-y-3">
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
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Liquidity ladder
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label htmlFor="hb-order-levels" className="text-xs text-muted-foreground">
                            Order levels
                          </Label>
                          <Input
                            id="hb-order-levels"
                            type="number"
                            inputMode="numeric"
                            value={hbOrderLevels}
                            onChange={(event) => {
                              setHbOrderLevels(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="3"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="hb-order-level-amount"
                            className="text-xs text-muted-foreground"
                          >
                            Level amount
                          </Label>
                          <Input
                            id="hb-order-level-amount"
                            type="number"
                            inputMode="decimal"
                            value={hbOrderLevelAmount}
                            onChange={(event) => {
                              setHbOrderLevelAmount(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="0.01"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="hb-order-level-spread"
                            className="text-xs text-muted-foreground"
                          >
                            Level spread (%)
                          </Label>
                          <Input
                            id="hb-order-level-spread"
                            type="number"
                            inputMode="decimal"
                            value={hbOrderLevelSpread}
                            onChange={(event) => {
                              setHbOrderLevelSpread(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="0.4"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Inventory skew</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={hbInventorySkewEnabled ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setHbInventorySkewEnabled((prev) => !prev)
                              setConfigDirty(true)
                            }}
                            aria-pressed={hbInventorySkewEnabled}
                          >
                            {hbInventorySkewEnabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="hb-inventory-target"
                          className="text-xs text-muted-foreground"
                        >
                          Target base %
                        </Label>
                        <Input
                          id="hb-inventory-target"
                          type="number"
                          inputMode="decimal"
                          value={hbInventoryTargetBase}
                          onChange={(event) => {
                            setHbInventoryTargetBase(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="50"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="hb-price-floor" className="text-xs text-muted-foreground">
                          Price floor
                        </Label>
                        <Input
                          id="hb-price-floor"
                          type="number"
                          inputMode="decimal"
                          value={hbPriceFloor}
                          onChange={(event) => {
                            setHbPriceFloor(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="20000"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="hb-price-ceiling" className="text-xs text-muted-foreground">
                          Price ceiling
                        </Label>
                        <Input
                          id="hb-price-ceiling"
                          type="number"
                          inputMode="decimal"
                          value={hbPriceCeiling}
                          onChange={(event) => {
                            setHbPriceCeiling(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="30000"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="hb-max-order-age" className="text-xs text-muted-foreground">
                          Max order age (s)
                        </Label>
                        <Input
                          id="hb-max-order-age"
                          type="number"
                          inputMode="numeric"
                          value={hbMaxOrderAge}
                          onChange={(event) => {
                            setHbMaxOrderAge(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="120"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="hb-cancel-wait"
                          className="text-xs text-muted-foreground"
                        >
                          Cancel wait (s)
                        </Label>
                        <Input
                          id="hb-cancel-wait"
                          type="number"
                          inputMode="numeric"
                          value={hbCancelOrderWaitTime}
                          onChange={(event) => {
                            setHbCancelOrderWaitTime(event.target.value)
                            setConfigDirty(true)
                          }}
                          placeholder="30"
                        />
                      </div>
                        </div>
                      </div>
                    )}
                    {hbIsXemm && (
                      <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Cross-exchange (XEMM)
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="hb-maker-exchange" className="text-xs text-muted-foreground">
                              Maker exchange
                            </Label>
                            <Input
                              id="hb-maker-exchange"
                              value={hbMakerExchange}
                              onChange={(event) => {
                                setHbMakerExchange(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder={exchangeTrimmed || "binance"}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-taker-exchange" className="text-xs text-muted-foreground">
                              Taker exchange
                            </Label>
                            <Input
                              id="hb-taker-exchange"
                              value={hbTakerExchange}
                              onChange={(event) => {
                                setHbTakerExchange(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder={exchangeTrimmed || "kraken"}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-maker-market" className="text-xs text-muted-foreground">
                              Maker market
                            </Label>
                            <Input
                              id="hb-maker-market"
                              value={hbMakerMarket}
                              onChange={(event) => {
                                setHbMakerMarket(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder={pairsInput.split(",")[0]?.trim() || "BTC-USDT"}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-taker-market" className="text-xs text-muted-foreground">
                              Taker market
                            </Label>
                            <Input
                              id="hb-taker-market"
                              value={hbTakerMarket}
                              onChange={(event) => {
                                setHbTakerMarket(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder={pairsInput.split(",")[0]?.trim() || "BTC-USDT"}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-xemm-min-profit" className="text-xs text-muted-foreground">
                              Min profitability (%)
                            </Label>
                            <Input
                              id="hb-xemm-min-profit"
                              type="number"
                              inputMode="decimal"
                              value={hbXemmMinProfitability}
                              onChange={(event) => {
                                setHbXemmMinProfitability(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="0.2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-xemm-order-amount" className="text-xs text-muted-foreground">
                              Order amount
                            </Label>
                            <Input
                              id="hb-xemm-order-amount"
                              type="number"
                              inputMode="decimal"
                              value={hbXemmOrderAmount}
                              onChange={(event) => {
                                setHbXemmOrderAmount(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="0.01"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-xemm-depth" className="text-xs text-muted-foreground">
                              Top depth tolerance
                            </Label>
                            <Input
                              id="hb-xemm-depth"
                              type="number"
                              inputMode="decimal"
                              value={hbXemmTopDepthTolerance}
                              onChange={(event) => {
                                setHbXemmTopDepthTolerance(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {hbIsTwap && (
                      <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          TWAP execution
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="hb-twap-total" className="text-xs text-muted-foreground">
                              Total amount
                            </Label>
                            <Input
                              id="hb-twap-total"
                              type="number"
                              inputMode="decimal"
                              value={hbTwapTotalAmount}
                              onChange={(event) => {
                                setHbTwapTotalAmount(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-twap-step" className="text-xs text-muted-foreground">
                              Order step size
                            </Label>
                            <Input
                              id="hb-twap-step"
                              type="number"
                              inputMode="decimal"
                              value={hbTwapOrderStep}
                              onChange={(event) => {
                                setHbTwapOrderStep(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="0.1"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-twap-interval" className="text-xs text-muted-foreground">
                              Step interval (s)
                            </Label>
                            <Input
                              id="hb-twap-interval"
                              type="number"
                              inputMode="numeric"
                              value={hbTwapOrderInterval}
                              onChange={(event) => {
                                setHbTwapOrderInterval(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="60"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="hb-twap-side" className="text-xs text-muted-foreground">
                              Order side
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {["buy", "sell"].map((side) => (
                                <Button
                                  key={side}
                                  type="button"
                                  variant={hbTwapOrderSide === side ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setHbTwapOrderSide(side)
                                    setConfigDirty(true)
                                  }}
                                >
                                  {side}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="hb-twap-limit" className="text-xs text-muted-foreground">
                              Limit price (optional)
                            </Label>
                            <Input
                              id="hb-twap-limit"
                              type="number"
                              inputMode="decimal"
                              value={hbTwapLimitPrice}
                              onChange={(event) => {
                                setHbTwapLimitPrice(event.target.value)
                                setConfigDirty(true)
                              }}
                              placeholder="25000"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {!hbIsPMM && !hbIsXemm && !hbIsTwap && (
                      <div className="text-xs text-muted-foreground">
                        Select a Hummingbot strategy preset to expose its advanced parameters.
                      </div>
                    )}
                  </div>
                )}

                {bot?.engine === "jesse" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Risk & performance
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label htmlFor="jesse-warmup" className="text-xs text-muted-foreground">
                            Warmup candles
                          </Label>
                          <Input
                            id="jesse-warmup"
                            type="number"
                            inputMode="numeric"
                            value={jesseWarmupCandles}
                            onChange={(event) => {
                              setJesseWarmupCandles(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="200"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="jesse-fee" className="text-xs text-muted-foreground">
                            Fee rate (decimal)
                          </Label>
                          <Input
                            id="jesse-fee"
                            type="number"
                            inputMode="decimal"
                            value={jesseFeeRate}
                            onChange={(event) => {
                              setJesseFeeRate(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="0.001"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="jesse-leverage" className="text-xs text-muted-foreground">
                            Leverage
                          </Label>
                          <Input
                            id="jesse-leverage"
                            type="number"
                            inputMode="decimal"
                            value={jesseLeverage}
                            onChange={(event) => {
                              setJesseLeverage(event.target.value)
                              setConfigDirty(true)
                            }}
                            placeholder="1"
                          />
                        </div>
                      </div>
                    </div>
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

                {bot?.engine === "jesse" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Data routes</div>
                      <Button type="button" variant="outline" size="sm" onClick={addJesseDataRoute}>
                        Add data route
                      </Button>
                    </div>
                    {jesseDataRoutes.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No data routes configured yet.
                      </div>
                    ) : (
                      jesseDataRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="rounded-md border border-border/60 bg-background/70 p-3 space-y-2"
                        >
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-data-exchange-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Exchange
                              </Label>
                              <Input
                                id={`jesse-data-exchange-${route.id}`}
                                list="exchange-options"
                                value={route.exchange}
                                onChange={(event) =>
                                  updateJesseDataRoute(route.id, {
                                    exchange: event.target.value,
                                  })
                                }
                                placeholder={exchangeTrimmed || "Binance"}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-data-symbol-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Symbol
                              </Label>
                              <Input
                                id={`jesse-data-symbol-${route.id}`}
                                value={route.symbol}
                                onChange={(event) =>
                                  updateJesseDataRoute(route.id, { symbol: event.target.value })
                                }
                                placeholder="BTC-USDT"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`jesse-data-timeframe-${route.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Timeframe
                              </Label>
                              <Input
                                id={`jesse-data-timeframe-${route.id}`}
                                list="timeframe-options"
                                value={route.timeframe}
                                onChange={(event) =>
                                  updateJesseDataRoute(route.id, {
                                    timeframe: event.target.value,
                                  })
                                }
                                placeholder={timeframeTrimmed || "1m"}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeJesseDataRoute(route.id)}
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

              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Expert config</div>
                    <div className="text-xs text-muted-foreground">
                      Locked raw JSON for engine-specific settings.
                    </div>
                  </div>
                  <Sheet open={expertOpen} onOpenChange={handleExpertOpenChange}>
                    <SheetTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        Open expert
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="sm:max-w-lg">
                      <SheetHeader>
                        <SheetTitle>Expert Config</SheetTitle>
                        <SheetDescription>
                          Raw JSON editor for {engineConfigLabel}. Unlock to edit.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                        {!expertUnlocked ? (
                          <>
                            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                              Editing raw JSON can break adapters. Use this only if you know the
                              engine config format.
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setExpertUnlocked(true)}
                            >
                              Unlock expert editor
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
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          <Card className="reveal" style={{ "--delay": "220ms" } as CSSProperties}>
            <CardHeader>
              <CardTitle className="text-base">Command Console</CardTitle>
              <div className="text-xs text-muted-foreground">
                Commands are queued into <code>bots/{botId}/commands</code>.
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
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
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
                    <div className="mt-2 break-words text-sm font-medium">
                      {event.message || "Adapter emitted an event without a message."}
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
    </div>
    </div>
    </div>
  )
}
