import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  endAt,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAt,
  serverTimestamp,
} from "firebase/firestore"
import type { DocumentData, QuerySnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type {
  BotDoc,
  BotEventDoc,
  BotSignalDoc,
  MarketHotTrade,
  MarketHotTradesDoc,
  MarketSwingOvernightDoc,
  MarketPrebreakoutDoc,
  MarketPopularDoc,
  MarketControlsDoc,
  MarketUniverseDoc,
  MarketUniverseMode,
  MarketTrendingDoc,
  MarketTrendItem,
  SignalPerformanceDoc,
  TrendHorizon,
  TrendWeights,
} from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatAssetPrice, formatRelativeTimestamp, formatSessionTimeLabel, formatTimestamp } from "@/lib/format"
import { StatusBadge } from "@/components/StatusBadge"
import { MarketStatusBadge } from "@/components/MarketStatusBadge"
import { PaperTradeButton } from "@/components/paper/PaperTradeButton"
import { ScoreBreakdownDialog } from "@/components/score/ScoreBreakdownDialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/auth-context"
import { useMarketPrices } from "@/features/market/use-market-prices"
import { useStreamSymbols } from "@/features/market/use-stream-symbols"
import { X, BarChart3, InfoIcon, Clipboard, Sparkles } from "lucide-react"
import { AssetChartModal } from "@/components/charts/AssetChartModal"
import { usePaperAutomation } from "@/features/paper/use-paper-monitor"
import { PipelineHealthBadge } from "@/components/PipelineHealthBadge"
import { copyAiPrompt } from "@/features/ai/ai-prompt"
import { findAnalysisNoteKind, getAnalysisNoteKind, localizeAnalysis } from "@/lib/analysis-localize"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import {
  getE2eDisableFirestoreWrites,
  getE2ePrebreakoutOverride,
  getE2eSwingOvernightOverride,
} from "@/lib/e2e-overrides"
import { useTranslation } from "react-i18next"

function signalBadgeVariant(side?: string) {
  switch (side) {
    case "buy":
      return "default"
    case "sell":
      return "destructive"
    case "hold":
      return "secondary"
    default:
      return "outline"
  }
}

type AssetClass = MarketHotTrade["assetClass"]
type DipHorizon = "1h" | "24h" | "7d"
type RiskProfile = "conservative" | "balanced" | "aggressive"

const POPULAR_CRYPTO = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "ADA/USDT",
  "DOGE/USDT",
  "AVAX/USDT",
  "LINK/USDT",
  "MATIC/USDT",
  "DOT/USDT",
  "LTC/USDT",
  "ATOM/USDT",
  "TRX/USDT",
  "NEAR/USDT",
  "OP/USDT",
  "ARB/USDT",
  "INJ/USDT",
  "RNDR/USDT",
  "IMX/USDT",
  "SUI/USDT",
  "APT/USDT",
  "TIA/USDT",
  "UNI/USDT",
  "AAVE/USDT",
  "FIL/USDT",
  "ICP/USDT",
  "XLM/USDT",
  "BCH/USDT",
  "ETC/USDT",
  "HBAR/USDT",
  "FTM/USDT",
  "GALA/USDT",
  "PEPE/USDT",
  "SHIB/USDT",
]

const POPULAR_STOCKS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOGL",
  "TSLA",
  "AMD",
  "NFLX",
  "INTC",
  "AVGO",
  "ORCL",
  "CRM",
  "JPM",
  "V",
  "MA",
  "BRK.B",
  "SPY",
  "QQQ",
  "VTI",
  "DIA",
  "IWM",
  "TSM",
  "COST",
  "WMT",
  "KO",
  "PEP",
  "DIS",
  "NKE",
  "BA",
  "ADBE",
  "PYPL",
  "XOM",
  "CVX",
]

const POPULAR_FX = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "NZD/USD",
  "USD/CAD",
  "EUR/JPY",
  "GBP/JPY",
  "EUR/GBP",
  "AUD/JPY",
  "CAD/JPY",
  "EUR/AUD",
  "USD/SEK",
  "USD/NOK",
  "USD/MXN",
  "USD/CNH",
  "EUR/CAD",
  "GBP/CAD",
  "AUD/NZD",
  "CHF/JPY",
  "NZD/JPY",
  "EUR/NZD",
  "EUR/CHF",
  "GBP/CHF",
]

const LLM_INTERVAL_OPTIONS = [15, 30, 60, 120, 240]
const NEWS_INTERVAL_OPTIONS = [15, 30, 60, 120, 240]
const AUTO_TUNE_INTERVAL_OPTIONS = [6, 12, 24, 48]
const DIP_HORIZON_OPTIONS: DipHorizon[] = ["1h", "24h", "7d"]
const TREND_HORIZON_OPTIONS: TrendHorizon[] = ["15m", "1h", "24h", "7d"]
const DEFAULT_TREND_WEIGHTS: Required<TrendWeights> = {
  momentum: 50,
  volume: 20,
  signals: 20,
  liquidity: 0,
  consensus: 0,
  news: 10,
}
const RISK_OPTIONS: RiskProfile[] = ["conservative", "balanced", "aggressive"]
const ASSET_FOCUS_OPTIONS: AssetClass[] = ["crypto", "stock", "forex"]
const DEFAULT_UNIVERSE_MODE: MarketUniverseMode = "movers_plus_universe"
const UNIVERSE_MODE_OPTIONS: MarketUniverseMode[] = [
  "movers_plus_universe",
  "weighted_union",
  "movers_only",
  "universe_only",
  "movers_filtered_by_universe",
]
const UNIVERSE_MODE_SET = new Set(UNIVERSE_MODE_OPTIONS)
const BOT_WEIGHT_MIN = 0
const BOT_WEIGHT_MAX = 5

function clampBotWeight(value: number) {
  return Math.min(BOT_WEIGHT_MAX, Math.max(BOT_WEIGHT_MIN, value))
}

function resolveUniverseMode(value?: string | null): MarketUniverseMode {
  if (!value) return DEFAULT_UNIVERSE_MODE
  const normalized = String(value).trim().toLowerCase() as MarketUniverseMode
  return UNIVERSE_MODE_SET.has(normalized) ? normalized : DEFAULT_UNIVERSE_MODE
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const { prices, livePrices } = useMarketPrices()
  const { replayActive, controls: replayControls } = useReplayControls()
  const replayRunId = replayActive ? replayControls?.activeRunId || null : null

  const [bots, setBots] = useState<BotDoc[]>([])
  const [events, setEvents] = useState<BotEventDoc[]>([])
  const [signals, setSignals] = useState<BotSignalDoc[]>([])
  const [hotTrades, setHotTrades] = useState<MarketHotTrade[]>([])
  const [hotTradesUpdatedAt, setHotTradesUpdatedAt] = useState<MarketHotTradesDoc["updatedAt"]>()
  const [swingOvernight, setSwingOvernight] = useState<MarketHotTrade[]>([])
  const [swingOvernightUpdatedAt, setSwingOvernightUpdatedAt] =
    useState<MarketSwingOvernightDoc["updatedAt"]>()
  const [prebreakout, setPrebreakout] = useState<MarketHotTrade[]>([])
  const [prebreakoutUpdatedAt, setPrebreakoutUpdatedAt] =
    useState<MarketPrebreakoutDoc["updatedAt"]>()
  const [prebreakoutMeta, setPrebreakoutMeta] = useState<MarketPrebreakoutDoc["meta"]>()
  const [trending, setTrending] = useState<MarketTrendingDoc | null>(null)
  const [trendingUpdatedAt, setTrendingUpdatedAt] = useState<MarketTrendingDoc["updatedAt"]>()
  const [popular, setPopular] = useState<MarketPopularDoc | null>(null)
  const [universe, setUniverse] = useState<MarketUniverseDoc | null>(null)
  const [signalPerformance, setSignalPerformance] = useState<SignalPerformanceDoc | null>(null)
  const [universeOpen, setUniverseOpen] = useState(false)
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [cryptoSelection, setCryptoSelection] = useState<string[]>([])
  const [stockSelection, setStockSelection] = useState<string[]>([])
  const [forexSelection, setForexSelection] = useState<string[]>([])
  const [primaryCryptoSelection, setPrimaryCryptoSelection] = useState<string[]>([])
  const [primaryStockSelection, setPrimaryStockSelection] = useState<string[]>([])
  const [primaryForexSelection, setPrimaryForexSelection] = useState<string[]>([])
  const [cryptoSearch, setCryptoSearch] = useState("")
  const [stockSearch, setStockSearch] = useState("")
  const [stockSymbolMatches, setStockSymbolMatches] = useState<string[]>([])
  const [stockSymbolLoading, setStockSymbolLoading] = useState(false)
  const [forexSearch, setForexSearch] = useState("")
  const [quickStockMatches, setQuickStockMatches] = useState<string[]>([])
  const [quickStockLoading, setQuickStockLoading] = useState(false)
  const [cryptoMode, setCryptoMode] = useState<MarketUniverseMode>(DEFAULT_UNIVERSE_MODE)
  const [stockMode, setStockMode] = useState<MarketUniverseMode>(DEFAULT_UNIVERSE_MODE)
  const [forexMode, setForexMode] = useState<MarketUniverseMode>(DEFAULT_UNIVERSE_MODE)
  const [llmIntervalMinutes, setLlmIntervalMinutes] = useState(30)
  const [llmEnabled, setLlmEnabled] = useState(true)
  const [newsIntervalMinutes, setNewsIntervalMinutes] = useState(30)
  const [newsEnabled, setNewsEnabled] = useState(true)
  const [swingOvernightEnabled, setSwingOvernightEnabled] = useState(false)
  const [swingOvernightAutoPaperEnabled, setSwingOvernightAutoPaperEnabled] = useState(false)
  const [prebreakoutEnabled, setPrebreakoutEnabled] = useState(false)
  const [prebreakoutAutoPaperEnabled, setPrebreakoutAutoPaperEnabled] = useState(false)
  const [dipHorizon, setDipHorizon] = useState<DipHorizon>("24h")
  const [trendHorizon, setTrendHorizon] = useState<TrendHorizon>("15m")
  const [trendMomentumWeight, setTrendMomentumWeight] = useState(
    DEFAULT_TREND_WEIGHTS.momentum
  )
  const [trendVolumeWeight, setTrendVolumeWeight] = useState(
    DEFAULT_TREND_WEIGHTS.volume
  )
  const [trendSignalsWeight, setTrendSignalsWeight] = useState(
    DEFAULT_TREND_WEIGHTS.signals
  )
  const [trendNewsWeight, setTrendNewsWeight] = useState(
    DEFAULT_TREND_WEIGHTS.news
  )
  const [botWeightBacktrader, setBotWeightBacktrader] = useState(1)
  const [chartOpen, setChartOpen] = useState(false)
  const [chartAsset, setChartAsset] = useState<MarketHotTrade | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdownAsset, setBreakdownAsset] = useState<MarketHotTrade | MarketTrendItem | null>(null)
  const [autoTuneEnabled, setAutoTuneEnabled] = useState(true)
  const [autoTuneWithAI, setAutoTuneWithAI] = useState(true)
  const [autoTuneIntervalHours, setAutoTuneIntervalHours] = useState(6)
  const [autoTuneLastAt, setAutoTuneLastAt] = useState<
    MarketControlsDoc["autoTuneLastAt"]
  >()
  const [autoTuneNotes, setAutoTuneNotes] = useState("")
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced")
  const [quickAssetClass, setQuickAssetClass] = useState<AssetClass>("crypto")
  const [quickAssetInput, setQuickAssetInput] = useState("")
  const [quickSuggestionIndex, setQuickSuggestionIndex] = useState(-1)
  const [assetFocus, setAssetFocus] = useState<AssetClass[]>([
    "crypto",
    "stock",
    "forex",
  ])
  const [trendAssetFocus, setTrendAssetFocus] = useState<AssetClass[]>([
    "crypto",
    "stock",
    "forex",
  ])
  const [loadingBots, setLoadingBots] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [loadingHotTrades, setLoadingHotTrades] = useState(true)
  const [loadingSwingOvernight, setLoadingSwingOvernight] = useState(true)
  const [loadingPrebreakout, setLoadingPrebreakout] = useState(true)
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [loadingPerformance, setLoadingPerformance] = useState(true)
  const [startingBots, setStartingBots] = useState(false)
  const [refreshingJobs, setRefreshingJobs] = useState(false)

  const refreshEndpoint = useMemo(() => {
    const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/refresh`
  }, [])
  const e2eDisableWrites = getE2eDisableFirestoreWrites()

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingBots(false)
      return
    }

    const ref = collection(db, "bots")
    return onSnapshot(ref, (snap) => {
      setBots(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<BotDoc, "id">
          return { id: doc.id, ...data }
        })
      )
      setLoadingBots(false)
    })
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }

    const ref = doc(db, "market", "universe")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setUniverse(null)
        setCryptoSelection([])
        setStockSelection([])
        setForexSelection([])
        setCryptoMode(DEFAULT_UNIVERSE_MODE)
        setStockMode(DEFAULT_UNIVERSE_MODE)
        setForexMode(DEFAULT_UNIVERSE_MODE)
        return
      }
      const data = snap.data() as MarketUniverseDoc
      const globalMode = resolveUniverseMode(data.mode)
      setUniverse(data)
      setCryptoSelection(
        uniqueList((data.crypto?.symbols ?? []).map(normalizeSymbol).filter(Boolean))
      )
      setStockSelection(
        uniqueList((data.stocks?.symbols ?? []).map(normalizeTicker).filter(Boolean))
      )
      setForexSelection(
        uniqueList((data.forex?.pairs ?? []).map(normalizeSymbol).filter(Boolean))
      )
      setCryptoMode(resolveUniverseMode(data.crypto?.mode ?? globalMode))
      setStockMode(resolveUniverseMode(data.stocks?.mode ?? globalMode))
      setForexMode(resolveUniverseMode(data.forex?.mode ?? globalMode))
    })
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingPerformance(false)
      return
    }

    const ref = doc(db, "analytics", "signalPerformance")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setSignalPerformance(null)
        setLoadingPerformance(false)
        return
      }
      const data = snap.data() as SignalPerformanceDoc
      setSignalPerformance(data)
      setLoadingPerformance(false)
    })
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }

    const ref = doc(db, "market", "controls")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLlmIntervalMinutes(30)
        setLlmEnabled(true)
        setNewsIntervalMinutes(30)
        setNewsEnabled(true)
        setSwingOvernightEnabled(false)
        setSwingOvernightAutoPaperEnabled(false)
        setPrebreakoutEnabled(false)
        setPrebreakoutAutoPaperEnabled(false)
        setDipHorizon("24h")
        setTrendHorizon("15m")
        setTrendMomentumWeight(DEFAULT_TREND_WEIGHTS.momentum)
        setTrendVolumeWeight(DEFAULT_TREND_WEIGHTS.volume)
        setTrendSignalsWeight(DEFAULT_TREND_WEIGHTS.signals)
        setTrendNewsWeight(DEFAULT_TREND_WEIGHTS.news)
        setBotWeightBacktrader(1)
        setAutoTuneEnabled(true)
        setAutoTuneWithAI(true)
        setAutoTuneIntervalHours(6)
        setAutoTuneLastAt(undefined)
        setAutoTuneNotes("")
        setRiskProfile("balanced")
        setAssetFocus(["crypto", "stock", "forex"])
        setTrendAssetFocus(["crypto", "stock", "forex"])
        setPrimaryCryptoSelection([])
        setPrimaryStockSelection([])
        setPrimaryForexSelection([])
        return
      }
      const data = snap.data() as MarketControlsDoc
      const parsed = Number(data.llmIntervalMinutes)
      if (Number.isFinite(parsed) && LLM_INTERVAL_OPTIONS.includes(parsed)) {
        setLlmIntervalMinutes(parsed)
      } else {
        setLlmIntervalMinutes(30)
      }
      setLlmEnabled(data.enableLLM !== false)
      const parsedNews = Number(data.newsIntervalMinutes)
      if (Number.isFinite(parsedNews) && NEWS_INTERVAL_OPTIONS.includes(parsedNews)) {
        setNewsIntervalMinutes(parsedNews)
      } else {
        setNewsIntervalMinutes(30)
      }
      setNewsEnabled(data.enableNews !== false)
      setSwingOvernightEnabled(data.swingOvernightEnabled === true)
      setSwingOvernightAutoPaperEnabled(data.swingOvernightAutoPaperEnabled === true)
      setPrebreakoutEnabled(data.prebreakoutEnabled === true)
      setPrebreakoutAutoPaperEnabled(data.prebreakoutAutoPaperEnabled === true)
      const nextHorizon =
        data.dipHorizon && DIP_HORIZON_OPTIONS.includes(data.dipHorizon)
          ? data.dipHorizon
          : "24h"
      setDipHorizon(nextHorizon)
      const nextTrendHorizon =
        data.trendHorizon && TREND_HORIZON_OPTIONS.includes(data.trendHorizon)
          ? data.trendHorizon
          : "15m"
      setTrendHorizon(nextTrendHorizon)
      const weightMomentum =
        typeof data.trendWeights?.momentum === "number"
          ? data.trendWeights.momentum
          : DEFAULT_TREND_WEIGHTS.momentum
      const weightVolume =
        typeof data.trendWeights?.liquidity === "number"
          ? data.trendWeights.liquidity
          : typeof data.trendWeights?.volume === "number"
            ? data.trendWeights.volume
            : DEFAULT_TREND_WEIGHTS.volume
      const weightSignals =
        typeof data.trendWeights?.consensus === "number"
          ? data.trendWeights.consensus
          : typeof data.trendWeights?.signals === "number"
            ? data.trendWeights.signals
            : DEFAULT_TREND_WEIGHTS.signals
      const weightNews =
        typeof data.trendWeights?.news === "number"
          ? data.trendWeights.news
          : DEFAULT_TREND_WEIGHTS.news
      setTrendMomentumWeight(weightMomentum)
      setTrendVolumeWeight(weightVolume)
      setTrendSignalsWeight(weightSignals)
      setTrendNewsWeight(weightNews)
      const botWeights = data.botWeights || {}
      const backtraderWeight =
        typeof botWeights["engine:backtrader"] === "number"
          ? botWeights["engine:backtrader"]
          : typeof botWeights.backtrader === "number"
            ? botWeights.backtrader
            : 1
      setBotWeightBacktrader(clampBotWeight(backtraderWeight))
      const parsedAutoTuneInterval = Number(data.autoTuneIntervalHours)
      setAutoTuneEnabled(data.autoTuneEnabled !== false)
      setAutoTuneWithAI(data.autoTuneWithAI !== false)
      if (
        Number.isFinite(parsedAutoTuneInterval) &&
        AUTO_TUNE_INTERVAL_OPTIONS.includes(parsedAutoTuneInterval)
      ) {
        setAutoTuneIntervalHours(parsedAutoTuneInterval)
      } else {
        setAutoTuneIntervalHours(6)
      }
      setAutoTuneLastAt(data.autoTuneLastAt)
      setAutoTuneNotes(typeof data.autoTuneNotes === "string" ? data.autoTuneNotes : "")
      const nextRisk = RISK_OPTIONS.includes(data.riskProfile as RiskProfile)
        ? (data.riskProfile as RiskProfile)
        : "balanced"
      setRiskProfile(nextRisk)
      const focus = Array.isArray(data.assetFocus)
        ? data.assetFocus.filter((item): item is AssetClass =>
          ASSET_FOCUS_OPTIONS.includes(item)
        )
        : []
      const nextFocus: AssetClass[] =
        focus.length > 0 ? focus : ["crypto", "stock", "forex"]
      setAssetFocus(nextFocus)
      setTrendAssetFocus(nextFocus)
      setPrimaryCryptoSelection(
        uniqueList((data.primaryAssets?.crypto ?? []).map(normalizeSymbol).filter(Boolean))
      )
      setPrimaryStockSelection(
        uniqueList((data.primaryAssets?.stocks ?? []).map(normalizeTicker).filter(Boolean))
      )
      setPrimaryForexSelection(
        uniqueList((data.primaryAssets?.forex ?? []).map(normalizeSymbol).filter(Boolean))
      )
    })
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingHotTrades(false)
      return
    }

    if (replayActive && !replayRunId) {
      setHotTrades([])
      setHotTradesUpdatedAt(undefined)
      setLoadingHotTrades(false)
      return
    }

    const ref = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "hotTrades")
      : doc(db, "market", "hotTrades")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setHotTrades([])
        setHotTradesUpdatedAt(undefined)
        setLoadingHotTrades(false)
        return
      }
      const data = snap.data() as MarketHotTradesDoc
      setHotTrades(data.items ?? [])
      setHotTradesUpdatedAt(data.updatedAt)
      setLoadingHotTrades(false)
    })
  }, [replayActive, replayRunId])

  useEffect(() => {
    const e2eOverride = getE2eSwingOvernightOverride()
    if (e2eOverride) {
      setSwingOvernight(e2eOverride.items ?? [])
      setSwingOvernightUpdatedAt(e2eOverride.updatedAt)
      setLoadingSwingOvernight(false)
      return
    }
    if (!firebaseEnabled || !db) {
      setLoadingSwingOvernight(false)
      return
    }

    if (replayActive && !replayRunId) {
      setSwingOvernight([])
      setSwingOvernightUpdatedAt(undefined)
      setLoadingSwingOvernight(false)
      return
    }

    const ref = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "swingOvernight")
      : doc(db, "market", "swingOvernight")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setSwingOvernight([])
        setSwingOvernightUpdatedAt(undefined)
        setLoadingSwingOvernight(false)
        return
      }
      const data = snap.data() as MarketSwingOvernightDoc
      setSwingOvernight(data.items ?? [])
      setSwingOvernightUpdatedAt(data.updatedAt)
      setLoadingSwingOvernight(false)
    })
  }, [replayActive, replayRunId])

  useEffect(() => {
    const e2eOverride = getE2ePrebreakoutOverride()
    if (e2eOverride) {
      setPrebreakout(e2eOverride.items ?? [])
      setPrebreakoutUpdatedAt(e2eOverride.updatedAt)
      setPrebreakoutMeta(e2eOverride.meta ?? {})
      setLoadingPrebreakout(false)
      return
    }
    if (!firebaseEnabled || !db) {
      setLoadingPrebreakout(false)
      return
    }

    if (replayActive && !replayRunId) {
      setPrebreakout([])
      setPrebreakoutUpdatedAt(undefined)
      setLoadingPrebreakout(false)
      return
    }

    const ref = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "prebreakout")
      : doc(db, "market", "prebreakout")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
      setPrebreakout([])
      setPrebreakoutUpdatedAt(undefined)
      setPrebreakoutMeta(undefined)
      setLoadingPrebreakout(false)
      return
    }
    const data = snap.data() as MarketPrebreakoutDoc
    setPrebreakout(data.items ?? [])
    setPrebreakoutUpdatedAt(data.updatedAt)
    setPrebreakoutMeta(data.meta ?? {})
    setLoadingPrebreakout(false)
  })
  }, [replayActive, replayRunId])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingTrending(false)
      return
    }

    if (replayActive && !replayRunId) {
      setTrending(null)
      setTrendingUpdatedAt(undefined)
      setLoadingTrending(false)
      return
    }

    const ref = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "trending")
      : doc(db, "market", "trending")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setTrending(null)
        setTrendingUpdatedAt(undefined)
        setLoadingTrending(false)
        return
      }
      const data = snap.data() as MarketTrendingDoc
      setTrending(data)
      setTrendingUpdatedAt(data.updatedAt)
      setLoadingTrending(false)
    })
  }, [replayActive, replayRunId])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }

    if (replayActive && !replayRunId) {
      setPopular(null)
      return
    }

    const ref = replayRunId
      ? doc(db, "replay", "controls", "runs", replayRunId, "market", "popular")
      : doc(db, "market", "popular")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setPopular(null)
        return
      }
      const data = snap.data() as MarketPopularDoc
      setPopular(data)
    })
  }, [replayActive, replayRunId])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingEvents(false)
      return
    }

    const activeDb = db
    let didFallback = false
    let unsubscribe = () => { }

    const handleSnapshot = (snap: QuerySnapshot<DocumentData>) => {
      const nextEvents = snap.docs.map((doc) => {
        const data = doc.data() as Omit<BotEventDoc, "id" | "botId">
        const botId = doc.ref.parent.parent?.id ?? "unknown"
        return { id: doc.id, botId, ...data }
      })
      nextEvents.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setEvents(nextEvents.slice(0, 10))
      setLoadingEvents(false)
    }

    const subscribe = (ordered: boolean) => {
      const baseRef = collectionGroup(activeDb, "events")
      const eventsQuery = ordered
        ? query(baseRef, orderBy("createdAt", "desc"), limit(10))
        : query(baseRef, limit(50))
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
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingSignals(false)
      return
    }

    const activeDb = db
    let didFallback = false
    let unsubscribe = () => { }

    const handleSnapshot = (snap: QuerySnapshot<DocumentData>) => {
      const nextSignals = snap.docs.map((doc) => {
        const data = doc.data() as Omit<BotSignalDoc, "id" | "botId">
        const botId = doc.ref.parent.parent?.id ?? "unknown"
        return { id: doc.id, botId, ...data }
      })
      nextSignals.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setSignals(nextSignals.slice(0, 5))
      setLoadingSignals(false)
    }

    const subscribe = (ordered: boolean) => {
      const baseRef = collectionGroup(activeDb, "signals")
      const signalsQuery = ordered
        ? query(baseRef, orderBy("createdAt", "desc"), limit(5))
        : query(baseRef, limit(30))
      unsubscribe = onSnapshot(
        signalsQuery,
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
          console.error("Signals listener error", error)
          setLoadingSignals(false)
        }
      )
    }

    subscribe(true)
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setStockSymbolMatches([])
      setStockSymbolLoading(false)
      return
    }

    const activeDb = db
    const trimmed = stockSearch.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "")
    if (!trimmed || trimmed.length < 2) {
      setStockSymbolMatches([])
      setStockSymbolLoading(false)
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      setStockSymbolLoading(true)
      try {
        const ref = collection(activeDb, "market_symbols_stocks")
        const snap = await getDocs(
          query(ref, orderBy("symbol"), startAt(trimmed), endAt(`${trimmed}\uf8ff`), limit(20))
        )
        if (cancelled) return
        const matches = new Set<string>()
        snap.docs.forEach((doc) => {
          const data = doc.data() as { symbol?: string }
          const normalized = String(data?.symbol || "")
            .toUpperCase()
            .trim()
            .replace(/[^A-Z0-9.-]/g, "")
          if (normalized) matches.add(normalized)
        })
        setStockSymbolMatches(Array.from(matches))
      } catch {
        if (!cancelled) {
          setStockSymbolMatches([])
        }
      } finally {
        if (!cancelled) {
          setStockSymbolLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [stockSearch])

  useEffect(() => {
    if (!firebaseEnabled || !db || quickAssetClass !== "stock") {
      setQuickStockMatches([])
      setQuickStockLoading(false)
      return
    }

    const activeDb = db
    const trimmed = quickAssetInput.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "")
    if (!trimmed || trimmed.length < 2) {
      setQuickStockMatches([])
      setQuickStockLoading(false)
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      setQuickStockLoading(true)
      try {
        const ref = collection(activeDb, "market_symbols_stocks")
        const snap = await getDocs(
          query(ref, orderBy("symbol"), startAt(trimmed), endAt(`${trimmed}\uf8ff`), limit(25))
        )
        if (cancelled) return
        const matches = new Set<string>()
        snap.docs.forEach((doc) => {
          const data = doc.data() as { symbol?: string }
          const normalized = String(data?.symbol || "")
            .toUpperCase()
            .trim()
            .replace(/[^A-Z0-9.-]/g, "")
          if (normalized) matches.add(normalized)
        })
        setQuickStockMatches(Array.from(matches))
      } catch {
        if (!cancelled) {
          setQuickStockMatches([])
        }
      } finally {
        if (!cancelled) {
          setQuickStockLoading(false)
        }
      }
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [quickAssetInput, quickAssetClass])

  useEffect(() => {
    setQuickSuggestionIndex(-1)
  }, [quickAssetInput, quickAssetClass])


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
  const riskLabelMap = useMemo(
    () => ({
      conservative: t("dashboard.risk.conservative"),
      balanced: t("dashboard.risk.balanced"),
      aggressive: t("dashboard.risk.aggressive"),
    }),
    [t]
  )
  const universeModeLabelMap = useMemo(
    () => ({
      movers_plus_universe: t("dashboard.universe.mode.moversPlusUniverse"),
      weighted_union: t("dashboard.universe.mode.moversPlusUniverseBoosted"),
      movers_only: t("dashboard.universe.mode.moversOnly"),
      universe_only: t("dashboard.universe.mode.universeOnly"),
      movers_filtered_by_universe: t("dashboard.universe.mode.moversFilteredByUniverse"),
    }),
    [t]
  )

  const getAssetLabel = (assetClass?: string | null, variant: "short" | "long" = "long") => {
    if (!assetClass) return unknownLabel
    const map = variant === "short" ? assetLabelShortMap : assetLabelMap
    return map[assetClass as AssetClass] ?? assetClass
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      online: 0,
      offline: 0,
      error: 0,
      starting: 0,
      stopping: 0,
      idle: 0,
      unknown: 0,
    }

    bots.forEach((bot) => {
      const key = bot.status ?? "unknown"
      counts[key] = (counts[key] || 0) + 1
    })

    return counts
  }, [bots])

  const totalBots = bots.length
  const assetFocusLabel = useMemo(() => {
    const labels = ASSET_FOCUS_OPTIONS.filter((option) =>
      assetFocus.includes(option)
    ).map((option) => assetLabelMap[option])
    return labels.length > 0 ? labels.join(" + ") : t("assets.allShort")
  }, [assetFocus, assetLabelMap, t])

  const offlineBots = useMemo(
    () =>
      bots.filter((bot) => {
        const status = bot.status ?? "unknown"
        return ["offline", "error", "idle", "unknown"].includes(status)
      }),
    [bots]
  )

  async function startOfflineBots() {
    if (replayActive) {
      toast.info(t("replay.actionsDisabled"))
      return
    }
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }
    const activeDb = db
    if (offlineBots.length === 0) {
      toast.message(t("dashboard.toasts.allBotsRunning"))
      return
    }

    setStartingBots(true)
    try {
      await Promise.all(
        offlineBots.map((bot) =>
          addDoc(collection(activeDb, "bots", bot.id, "commands"), {
            type: "start",
            status: "queued",
            createdAt: serverTimestamp(),
            requestedBy: user?.email ?? unknownLabel,
          })
        )
      )
      toast.success(t("dashboard.toasts.startQueued", { count: offlineBots.length }))
    } catch {
      toast.error(t("dashboard.toasts.startFailed"))
    } finally {
      setStartingBots(false)
    }
  }

  async function triggerRefresh() {
    if (replayActive) {
      toast.info(t("replay.actionsDisabled"))
      return
    }
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }
    if (!refreshEndpoint) {
      toast.error(t("tradeNow.refreshNotConfigured"))
      return
    }
    if (!user) {
      toast.error(t("tradeNow.mustBeSignedIn"))
      return
    }

    setRefreshingJobs(true)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch(refreshEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload?.error || t("tradeNow.refreshFailed", { status: response.status })
        )
      }
      const jobNames = Array.isArray(payload?.jobs)
        ? payload.jobs.map((job: { job?: string }) => job.job).filter(Boolean)
        : []
      toast.success(
        jobNames.length > 0
          ? t("tradeNow.refreshStartedWithJobs", { jobs: jobNames.join(", ") })
          : t("tradeNow.refreshStarted")
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tradeNow.refreshFailedGeneric"))
    } finally {
      setRefreshingJobs(false)
    }
  }

  function scoreTone(score?: number) {
    if (!score && score !== 0) return "bg-muted text-muted-foreground"
    if (score >= 75) return "bg-emerald-500/15 text-emerald-800"
    if (score >= 60) return "bg-sky-500/15 text-sky-700"
    if (score >= 45) return "bg-amber-500/15 text-amber-700"
    return "bg-slate-500/10 text-slate-600"
  }

  function formatChange(value?: number) {
    if (value === undefined || value === null) return naLabel
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  function formatSentiment(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return naLabel
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}`
  }

  function formatPercent(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return naLabel
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  function getHorizonChange(trade: MarketHotTrade, horizon: DipHorizon) {
    const momentum = trade.momentum
    if (!momentum) return null
    if (horizon === "1h" && typeof momentum.change1h === "number") return momentum.change1h
    if (horizon === "7d" && typeof momentum.change7d === "number") return momentum.change7d
    if (typeof momentum.change24h === "number") return momentum.change24h
    if (typeof momentum.change1h === "number") return momentum.change1h
    if (typeof momentum.change7d === "number") return momentum.change7d
    return null
  }

  function getTrendMomentum(item: MarketTrendItem, horizon: TrendHorizon) {
    const momentum = item?.momentum
    if (!momentum) return { change: null, window: horizon }
    const window = momentum.window ?? horizon
    if (window === "15m" && typeof momentum.change15m === "number") {
      return { change: momentum.change15m, window }
    }
    if (window === "1h" && typeof momentum.change1h === "number") {
      return { change: momentum.change1h, window }
    }
    if (window === "24h" && typeof momentum.change24h === "number") {
      return { change: momentum.change24h, window }
    }
    if (window === "7d" && typeof momentum.change7d === "number") {
      return { change: momentum.change7d, window }
    }
    if (typeof momentum.change24h === "number") {
      return { change: momentum.change24h, window: "24h" }
    }
    if (typeof momentum.change1h === "number") {
      return { change: momentum.change1h, window: "1h" }
    }
    if (typeof momentum.change7d === "number") {
      return { change: momentum.change7d, window: "7d" }
    }
    if (typeof momentum.change15m === "number") {
      return { change: momentum.change15m, window: "15m" }
    }
    return { change: null, window }
  }

  function getDipThreshold(profile: RiskProfile) {
    switch (profile) {
      case "conservative":
        return { change: -2.5, minScore: 65 }
      case "aggressive":
        return { change: -0.7, minScore: 45 }
      case "balanced":
      default:
        return { change: -1.4, minScore: 55 }
    }
  }

  function renderPerformancePanel(horizon: DipHorizon) {
    const stats = signalPerformance?.overall?.[horizon]
    const topBots = signalPerformance?.topBots?.[horizon] ?? []
    const assetStats = signalPerformance?.byAsset?.[horizon] ?? []
    const topSymbols = signalPerformance?.topSymbols?.[horizon] ?? []
    const bottomSymbols = signalPerformance?.bottomSymbols?.[horizon] ?? []
    return (
      <div className="space-y-3">
        {!firebaseEnabled ? (
          <div className="text-sm opacity-70">{t("dashboard.performance.firebaseHint")}</div>
        ) : loadingPerformance ? (
          <div className="text-sm opacity-70">{t("dashboard.performance.loading")}</div>
        ) : !stats ? (
          <div className="text-sm opacity-70">
            {signalPerformance?.overall &&
              Object.keys(signalPerformance.overall).length > 0
              ? t("dashboard.performance.shortHorizonOnly")
              : t("dashboard.performance.empty")}
          </div>
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
                {t("dashboard.performance.bestBots")}
              </div>
              {topBots.length === 0 ? (
                <div className="text-sm opacity-70">
                  {t("dashboard.performance.bestBotsEmpty")}
                </div>
              ) : (
                <div className="space-y-2">
                  {topBots.map((bot) => (
                    <div
                      key={bot.botId}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                    >
                      <div className="font-mono">{bot.botId}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{t("dashboard.labels.signalsCount", { count: bot.count })}</span>
                        <span>{t("dashboard.performance.hitRate", { value: bot.hitRate.toFixed(1) })}</span>
                        <span>{formatPercent(bot.avgReturn)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

            <div className="grid gap-3 sm:grid-cols-2">
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

  function normalizeSymbol(value: string) {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return ""
    const cleaned = trimmed.includes("-")
      ? trimmed.replace(/\s+/g, "").replace(/-/g, "/")
      : trimmed.replace(/\s+/g, "")
    if (!cleaned) return ""
    if (!/[A-Z]/.test(cleaned)) return ""
    return cleaned
  }

  function normalizeTicker(value: string) {
    const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "")
    if (!cleaned) return ""
    if (!/[A-Z]/.test(cleaned)) return ""
    return cleaned
  }

  function uniqueList(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
  }

  function toggleSelection(
    list: string[],
    value: string,
    normalizer: (entry: string) => string
  ) {
    const normalized = normalizer(value)
    if (!normalized) return list
    if (list.includes(normalized)) {
      return list.filter((item) => item !== normalized)
    }
    return [...list, normalized]
  }

  function addSelection(
    list: string[],
    value: string,
    normalizer: (entry: string) => string
  ) {
    const normalized = normalizer(value)
    if (!normalized) return list
    if (list.includes(normalized)) return list
    return [...list, normalized]
  }

  function removeSelection(list: string[], value: string) {
    return list.filter((item) => item !== value)
  }

  function toggleAssetFocus(value: AssetClass) {
    setAssetFocus((prev) => {
      const next = prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
      return next.length > 0 ? next : prev
    })
  }

  function toggleTrendFocus(value: AssetClass) {
    setTrendAssetFocus((prev) => {
      const next = prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
      return next.length > 0 ? next : prev
    })
  }

  function addPrimaryCrypto(value: string) {
    setPrimaryCryptoSelection((prev) => addSelection(prev, value, normalizeSymbol))
    setCryptoSelection((prev) => addSelection(prev, value, normalizeSymbol))
  }

  function addPrimaryStock(value: string) {
    setPrimaryStockSelection((prev) => addSelection(prev, value, normalizeTicker))
    setStockSelection((prev) => addSelection(prev, value, normalizeTicker))
  }

  function addPrimaryForex(value: string) {
    setPrimaryForexSelection((prev) => addSelection(prev, value, normalizeSymbol))
    setForexSelection((prev) => addSelection(prev, value, normalizeSymbol))
  }

  function addCustomCrypto() {
    if (!normalizedCryptoSearch) return
    setCryptoSelection((prev) => addSelection(prev, normalizedCryptoSearch, normalizeSymbol))
    setCryptoSearch("")
  }

  function addCustomStock() {
    if (!normalizedStockSearch) return
    setStockSelection((prev) => addSelection(prev, normalizedStockSearch, normalizeTicker))
    setStockSearch("")
  }

  function addCustomForex() {
    if (!normalizedForexSearch) return
    setForexSelection((prev) => addSelection(prev, normalizedForexSearch, normalizeSymbol))
    setForexSearch("")
  }

  function filterOptions(
    options: string[],
    query: string,
    selected: string[],
    normalizer: (entry: string) => string,
    limitCount = 12
  ) {
    const needle = normalizer(query) || query.trim().toUpperCase()
    const selectedSet = new Set(selected)
    const filtered = options.filter((option) => {
      if (selectedSet.has(option)) return false
      if (!needle) return true
      return option.includes(needle)
    })
    return filtered.slice(0, limitCount)
  }

  const assetFocusSet = useMemo(() => new Set(assetFocus), [assetFocus])

  const watchlistSets = useMemo(() => {
    return {
      crypto: new Set(
        (universe?.crypto?.symbols ?? []).map(normalizeSymbol).filter(Boolean)
      ),
      stocks: new Set(
        (universe?.stocks?.symbols ?? []).map(normalizeTicker).filter(Boolean)
      ),
      forex: new Set(
        (universe?.forex?.pairs ?? []).map(normalizeSymbol).filter(Boolean)
      ),
    }
  }, [universe])

  const primarySets = useMemo(() => {
    return {
      crypto: new Set(primaryCryptoSelection.map(normalizeSymbol).filter(Boolean)),
      stocks: new Set(primaryStockSelection.map(normalizeTicker).filter(Boolean)),
      forex: new Set(primaryForexSelection.map(normalizeSymbol).filter(Boolean)),
    }
  }, [primaryCryptoSelection, primaryStockSelection, primaryForexSelection])

  const normalizedQuickAsset = useMemo(() => {
    if (quickAssetClass === "stock") return normalizeTicker(quickAssetInput)
    return normalizeSymbol(quickAssetInput)
  }, [quickAssetClass, quickAssetInput])

  const quickAssetExists = useMemo(() => {
    if (!normalizedQuickAsset) return false
    if (quickAssetClass === "stock") {
      return watchlistSets.stocks.has(normalizeTicker(normalizedQuickAsset))
    }
    if (quickAssetClass === "forex") {
      return watchlistSets.forex.has(normalizeSymbol(normalizedQuickAsset))
    }
    return watchlistSets.crypto.has(normalizeSymbol(normalizedQuickAsset))
  }, [normalizedQuickAsset, quickAssetClass, watchlistSets])

  const canQuickAdd = normalizedQuickAsset.length > 0 && !quickAssetExists

  const trendingCrypto = useMemo(() => {
    return uniqueList(
      hotTrades
        .filter((trade) => trade.assetClass === "crypto")
        .map((trade) => normalizeSymbol(trade.symbol || ""))
        .filter(Boolean)
    ).slice(0, 6)
  }, [hotTrades])

  const trendingStocks = useMemo(() => {
    return uniqueList(
      hotTrades
        .filter((trade) => trade.assetClass === "stock")
        .map((trade) => normalizeTicker(trade.symbol || ""))
        .filter(Boolean)
    ).slice(0, 6)
  }, [hotTrades])

  const trendingFx = useMemo(() => {
    return uniqueList(
      hotTrades
        .filter((trade) => trade.assetClass === "forex")
        .map((trade) => normalizeSymbol(trade.symbol || ""))
        .filter(Boolean)
    ).slice(0, 6)
  }, [hotTrades])

  const popularCrypto = useMemo(() => {
    return uniqueList(
      (popular?.items ?? [])
        .filter((item) => item.assetClass === "crypto")
        .map((item) => normalizeSymbol(item.symbol))
        .filter(Boolean)
    ).slice(0, 10)
  }, [popular])

  const popularStocks = useMemo(() => {
    return uniqueList(
      (popular?.items ?? [])
        .filter((item) => item.assetClass === "stock")
        .map((item) => normalizeTicker(item.symbol))
        .filter(Boolean)
    ).slice(0, 10)
  }, [popular])

  const popularFx = useMemo(() => {
    return uniqueList(
      (popular?.items ?? [])
        .filter((item) => item.assetClass === "forex")
        .map((item) => normalizeSymbol(item.symbol))
        .filter(Boolean)
    ).slice(0, 10)
  }, [popular])

  const featuredCrypto = useMemo(
    () => (popularCrypto.length > 0 ? popularCrypto : POPULAR_CRYPTO),
    [popularCrypto]
  )
  const featuredStocks = useMemo(
    () => (popularStocks.length > 0 ? popularStocks : POPULAR_STOCKS),
    [popularStocks]
  )
  const featuredFx = useMemo(
    () => (popularFx.length > 0 ? popularFx : POPULAR_FX),
    [popularFx]
  )

  const trendingItems = useMemo(() => {
    const items: MarketTrendItem[] = []
    const byHorizon = trending?.byHorizon || {}
    Object.values(byHorizon).forEach((bucket) => {
      if (!bucket) return
      ;(["crypto", "stock", "forex"] as const).forEach((assetClass) => {
        const list = bucket?.[assetClass] ?? []
        if (Array.isArray(list) && list.length > 0) {
          items.push(...list)
        }
      })
    })
    return items
  }, [trending])

  const performanceItems = useMemo(() => {
    const items: Array<{ symbol?: string | null; assetClass?: string | null }> = []
    const add = (list?: { symbol: string; assetClass?: string | null }[]) => {
      if (!Array.isArray(list)) return
      list.forEach((entry) => {
        if (!entry?.symbol) return
        items.push({ symbol: entry.symbol, assetClass: entry.assetClass ?? null })
      })
    }
    const top = signalPerformance?.topSymbols || {}
    const bottom = signalPerformance?.bottomSymbols || {}
    Object.values(top).forEach((list) => add(list))
    Object.values(bottom).forEach((list) => add(list))
    return items
  }, [signalPerformance])

  const cryptoSuggestions = useMemo(
    () =>
      uniqueList(
        [
          ...(popularCrypto.length > 0 ? popularCrypto : POPULAR_CRYPTO),
          ...trendingCrypto,
          ...cryptoSelection,
        ]
          .map(normalizeSymbol)
          .filter(Boolean)
      ),
    [popularCrypto, trendingCrypto, cryptoSelection]
  )

  const stockSuggestions = useMemo(
    () =>
      uniqueList(
        [
          ...(popularStocks.length > 0 ? popularStocks : POPULAR_STOCKS),
          ...trendingStocks,
          ...stockSelection,
        ]
          .map(normalizeTicker)
          .filter(Boolean)
      ),
    [popularStocks, trendingStocks, stockSelection]
  )

  const stockSearchSuggestions = useMemo(() => {
    if (!stockSearch || stockSymbolMatches.length === 0) {
      return stockSuggestions
    }
    return uniqueList([...stockSymbolMatches, ...stockSuggestions])
  }, [stockSearch, stockSymbolMatches, stockSuggestions])

  const forexSuggestions = useMemo(
    () =>
      uniqueList(
        [
          ...(popularFx.length > 0 ? popularFx : POPULAR_FX),
          ...trendingFx,
          ...forexSelection,
        ]
          .map(normalizeSymbol)
          .filter(Boolean)
      ),
    [popularFx, trendingFx, forexSelection]
  )

  const quickSuggestions = useMemo(() => {
    const limitCount = 25
    if (quickAssetClass === "stock") {
      const base = quickStockMatches.length > 0 ? quickStockMatches : stockSuggestions
      return filterOptions(base, quickAssetInput, stockSelection, normalizeTicker, limitCount)
    }
    if (quickAssetClass === "forex") {
      return filterOptions(
        forexSuggestions,
        quickAssetInput,
        forexSelection,
        normalizeSymbol,
        limitCount
      )
    }
    return filterOptions(
      cryptoSuggestions,
      quickAssetInput,
      cryptoSelection,
      normalizeSymbol,
      limitCount
    )
  }, [
    quickAssetClass,
    quickAssetInput,
    quickStockMatches,
    stockSuggestions,
    stockSelection,
    forexSuggestions,
    forexSelection,
    cryptoSuggestions,
    cryptoSelection,
  ])

  useEffect(() => {
    setQuickSuggestionIndex((prev) =>
      prev >= quickSuggestions.length ? -1 : prev
    )
  }, [quickSuggestions.length])

  const filteredCryptoOptions = useMemo(
    () =>
      filterOptions(
        cryptoSuggestions,
        cryptoSearch,
        cryptoSelection,
        normalizeSymbol
      ),
    [cryptoSuggestions, cryptoSearch, cryptoSelection]
  )

  const filteredStockOptions = useMemo(
    () =>
      filterOptions(
        stockSearchSuggestions,
        stockSearch,
        stockSelection,
        normalizeTicker
      ),
    [stockSearchSuggestions, stockSearch, stockSelection]
  )

  const filteredForexOptions = useMemo(
    () =>
      filterOptions(
        forexSuggestions,
        forexSearch,
        forexSelection,
        normalizeSymbol
      ),
    [forexSuggestions, forexSearch, forexSelection]
  )

  const streamBuckets = useMemo(
    () => ({
      crypto: uniqueList([
        ...featuredCrypto,
        ...cryptoSuggestions,
        ...cryptoSelection,
        ...primaryCryptoSelection,
      ]),
      stock: uniqueList([
        ...featuredStocks,
        ...stockSearchSuggestions,
        ...quickStockMatches,
        ...stockSelection,
        ...primaryStockSelection,
      ]),
      forex: uniqueList([
        ...featuredFx,
        ...forexSuggestions,
        ...forexSelection,
        ...primaryForexSelection,
      ]),
    }),
    [
      featuredCrypto,
      featuredStocks,
      featuredFx,
      cryptoSuggestions,
      stockSearchSuggestions,
      quickStockMatches,
      forexSuggestions,
      cryptoSelection,
      stockSelection,
      forexSelection,
      primaryCryptoSelection,
      primaryStockSelection,
      primaryForexSelection,
    ]
  )

  const streamItems = useMemo(
    () => [
      ...hotTrades,
      ...swingOvernight,
      ...prebreakout,
      ...(popular?.items ?? []),
      ...trendingItems,
      ...performanceItems,
    ],
    [hotTrades, swingOvernight, prebreakout, popular?.items, trendingItems, performanceItems]
  )

  useStreamSymbols("dashboard", {
    items: streamItems,
    buckets: streamBuckets,
    enabled: !loadingHotTrades,
  })

  const normalizedCryptoSearch = normalizeSymbol(cryptoSearch)
  const normalizedStockSearch = normalizeTicker(stockSearch)
  const normalizedForexSearch = normalizeSymbol(forexSearch)

  const canAddCrypto = Boolean(
    normalizedCryptoSearch && !cryptoSelection.includes(normalizedCryptoSearch)
  )
  const canAddStock = Boolean(
    normalizedStockSearch && !stockSelection.includes(normalizedStockSearch)
  )
  const canAddForex = Boolean(
    normalizedForexSearch && !forexSelection.includes(normalizedForexSearch)
  )

  const primaryCryptoOptions = useMemo(
    () =>
      filterOptions(
        popularCrypto.length > 0 ? popularCrypto : cryptoSuggestions,
        "",
        primaryCryptoSelection,
        normalizeSymbol,
        8
      ),
    [popularCrypto, cryptoSuggestions, primaryCryptoSelection]
  )

  const primaryStockOptions = useMemo(
    () =>
      filterOptions(
        popularStocks.length > 0 ? popularStocks : stockSuggestions,
        "",
        primaryStockSelection,
        normalizeTicker,
        8
      ),
    [popularStocks, stockSuggestions, primaryStockSelection]
  )

  const primaryForexOptions = useMemo(
    () =>
      filterOptions(
        popularFx.length > 0 ? popularFx : forexSuggestions,
        "",
        primaryForexSelection,
        normalizeSymbol,
        8
      ),
    [popularFx, forexSuggestions, primaryForexSelection]
  )

  const focusedHotTrades: MarketHotTrade[] = useMemo(
    () => hotTrades.filter((trade) => assetFocusSet.has(trade.assetClass)),
    [hotTrades, assetFocusSet]
  )
  const swingOvernightItems = useMemo(
    () => swingOvernight.filter((trade) => trade.assetClass === "stock"),
    [swingOvernight]
  )
  const prebreakoutItems = useMemo(
    () => prebreakout.filter((trade) => trade.assetClass === "stock"),
    [prebreakout]
  )
  const prebreakoutEntryBadge = useMemo(() => {
    if (!prebreakoutMeta || typeof prebreakoutMeta !== "object") return null
    const meta = prebreakoutMeta as Record<string, unknown>
    const entryWindow = meta.entryWindow as
      | { start?: string; end?: string; close?: string; timezone?: string }
      | undefined
    if (!entryWindow?.start) return null
    const timezone =
      entryWindow.timezone === "America/New_York" ? "ET" : entryWindow.timezone || "ET"
    const status = typeof meta.status === "string" ? meta.status : ""
    const ready = meta.ready === true || status === "active"
    if (ready) {
      const end = entryWindow.end || entryWindow.close || entryWindow.start
      return t("tradeNow.prebreakoutEntryWindowOpen", {
        time: formatSessionTimeLabel(end),
        tz: timezone,
      })
    }
    return t("tradeNow.prebreakoutEntryWindowOpens", {
      time: formatSessionTimeLabel(entryWindow.start),
      tz: timezone,
    })
  }, [prebreakoutMeta, t])

  const paperMonitorItems = useMemo(
    () => [...hotTrades, ...swingOvernight, ...prebreakout],
    [hotTrades, swingOvernight, prebreakout]
  )

  // Monitor paper positions for stop loss / take profit
  usePaperAutomation(replayActive ? undefined : user?.uid, paperMonitorItems)


  const trendFocusSet = useMemo(() => new Set(trendAssetFocus), [trendAssetFocus])
  const trendingBuckets = useMemo(() => {
    const byHorizon = trending?.byHorizon?.[trendHorizon] ?? {}
    return {
      crypto: trendFocusSet.has("crypto") ? byHorizon.crypto ?? [] : [],
      stock: trendFocusSet.has("stock") ? byHorizon.stock ?? [] : [],
      forex: trendFocusSet.has("forex") ? byHorizon.forex ?? [] : [],
    }
  }, [trending, trendHorizon, trendFocusSet])

  const trendWeightsDisplay = useMemo(() => {
    return {
      momentum:
        typeof trending?.weights?.momentum === "number"
          ? trending.weights.momentum
          : trendMomentumWeight,
      liquidity:
        typeof trending?.weights?.liquidity === "number"
          ? trending.weights.liquidity
          : typeof trending?.weights?.volume === "number"
            ? trending.weights.volume
            : trendVolumeWeight,
      consensus:
        typeof trending?.weights?.consensus === "number"
          ? trending.weights.consensus
          : typeof trending?.weights?.signals === "number"
            ? trending.weights.signals
            : trendSignalsWeight,
      news:
        typeof trending?.weights?.news === "number"
          ? trending.weights.news
          : trendNewsWeight,
    }
  }, [
    trending,
    trendMomentumWeight,
    trendVolumeWeight,
    trendSignalsWeight,
    trendNewsWeight,
  ])

  const buyIdeas = useMemo(
    () => focusedHotTrades.filter((trade) => trade.side === "buy").slice(0, 3),
    [focusedHotTrades]
  )

  const sellIdeas = useMemo(
    () => focusedHotTrades.filter((trade) => trade.side === "sell").slice(0, 3),
    [focusedHotTrades]
  )

  const dipIdeas = useMemo(() => {
    const { change, minScore } = getDipThreshold(riskProfile)
    return focusedHotTrades
      .filter((trade) => {
        const horizonChange = getHorizonChange(trade, dipHorizon)
        if (horizonChange === null) return false
        return horizonChange <= change && (trade.score ?? 0) >= minScore
      })
      .slice(0, 4)
  }, [focusedHotTrades, dipHorizon, riskProfile])

  const nearDipIdeas = useMemo(() => {
    if (dipIdeas.length > 0) return []
    return focusedHotTrades
      .map((trade) => ({
        trade,
        horizonChange: getHorizonChange(trade, dipHorizon),
      }))
      .filter((entry) => entry.horizonChange !== null)
      .sort((a, b) => {
        if (a.horizonChange === null && b.horizonChange === null) return 0
        if (a.horizonChange === null) return 1
        if (b.horizonChange === null) return -1
        if (a.horizonChange !== b.horizonChange) {
          return a.horizonChange - b.horizonChange
        }
        return (b.trade.score ?? 0) - (a.trade.score ?? 0)
      })
      .slice(0, 4)
      .map((entry) => entry.trade)
  }, [dipIdeas.length, focusedHotTrades, dipHorizon])

  const dipDisplayMode = dipIdeas.length > 0 ? "strict" : nearDipIdeas.length > 0 ? "closest" : "empty"
  const displayDipIdeas = dipDisplayMode === "strict" ? dipIdeas : nearDipIdeas

  function isSymbolWatchlisted(assetClass: AssetClass, symbol: string) {
    if (!symbol) return false
    if (assetClass === "stock") {
      return watchlistSets.stocks.has(normalizeTicker(symbol))
    }
    if (assetClass === "forex") {
      return watchlistSets.forex.has(normalizeSymbol(symbol))
    }
    return watchlistSets.crypto.has(normalizeSymbol(symbol))
  }

  function isWatchlisted(trade: MarketHotTrade) {
    return trade.symbol ? isSymbolWatchlisted(trade.assetClass, trade.symbol) : false
  }

  function isPrimaryTrade(trade: MarketHotTrade) {
    if (!trade.symbol) return false
    if (trade.assetClass === "stock") {
      return primarySets.stocks.has(normalizeTicker(trade.symbol))
    }
    if (trade.assetClass === "forex") {
      return primarySets.forex.has(normalizeSymbol(trade.symbol))
    }
    return primarySets.crypto.has(normalizeSymbol(trade.symbol))
  }

  async function savePreferences() {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }

    const activeDb = db
    setPreferencesSaving(true)
    try {
      if (getE2eDisableFirestoreWrites()) {
        toast.success(t("dashboard.toasts.preferencesSaved"))
        setUniverseOpen(false)
        return
      }
      const resolvedAssetFocus: AssetClass[] =
        assetFocus.length > 0 ? assetFocus : ["crypto", "stock", "forex"]
      const payload: MarketUniverseDoc = {
        crypto: {
          mode: cryptoMode,
          symbols: uniqueList(cryptoSelection.map(normalizeSymbol).filter(Boolean)),
        },
        stocks: {
          mode: stockMode,
          symbols: uniqueList(stockSelection.map(normalizeTicker).filter(Boolean)),
        },
        forex: {
          mode: forexMode,
          pairs: uniqueList(forexSelection.map(normalizeSymbol).filter(Boolean)),
        },
        updatedAt: serverTimestamp(),
      }

      const controls: MarketControlsDoc = {
        llmIntervalMinutes,
        enableLLM: llmEnabled,
        newsIntervalMinutes,
        enableNews: newsEnabled,
        swingOvernightEnabled,
        swingOvernightAutoPaperEnabled,
        prebreakoutEnabled,
        prebreakoutAutoPaperEnabled,
        dipHorizon,
        trendHorizon,
        trendWeights: {
          momentum: trendMomentumWeight,
          liquidity: trendVolumeWeight,
          consensus: trendSignalsWeight,
          news: trendNewsWeight,
        },
        botWeights: {
          "engine:backtrader": clampBotWeight(botWeightBacktrader),
        },
        autoTuneEnabled,
        autoTuneWithAI,
        autoTuneIntervalHours,
        riskProfile,
        assetFocus: resolvedAssetFocus,
        primaryAssets: {
          crypto: uniqueList(primaryCryptoSelection.map(normalizeSymbol).filter(Boolean)),
          stocks: uniqueList(primaryStockSelection.map(normalizeTicker).filter(Boolean)),
          forex: uniqueList(primaryForexSelection.map(normalizeSymbol).filter(Boolean)),
        },
        updatedAt: serverTimestamp(),
      }

      await Promise.all([
        setDoc(doc(activeDb, "market", "universe"), payload, { merge: true }),
        setDoc(doc(activeDb, "market", "controls"), controls, { merge: true }),
      ])
      toast.success(t("dashboard.toasts.preferencesSaved"))
      setUniverseOpen(false)
    } catch {
      toast.error(t("dashboard.toasts.preferencesSaveFailed"))
    } finally {
      setPreferencesSaving(false)
    }
  }

  async function addTradeToUniverse(trade: { assetClass: AssetClass; symbol?: string | null }) {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }
    if (!trade.symbol) return

    const activeDb = db
    const cryptoSymbols = new Set(
      uniqueList((universe?.crypto?.symbols ?? []).map(normalizeSymbol).filter(Boolean))
    )
    const stockSymbols = new Set(
      uniqueList((universe?.stocks?.symbols ?? []).map(normalizeTicker).filter(Boolean))
    )
    const forexPairs = new Set(
      uniqueList((universe?.forex?.pairs ?? []).map(normalizeSymbol).filter(Boolean))
    )

    if (trade.assetClass === "stock") {
      const symbol = normalizeTicker(trade.symbol)
      if (symbol) stockSymbols.add(symbol)
    } else if (trade.assetClass === "forex") {
      const pair = normalizeSymbol(trade.symbol)
      if (pair) forexPairs.add(pair)
    } else {
      const pair = normalizeSymbol(trade.symbol)
      if (pair) cryptoSymbols.add(pair)
    }

    const nextCrypto = Array.from(cryptoSymbols)
    const nextStocks = Array.from(stockSymbols)
    const nextForex = Array.from(forexPairs)
    const payload: MarketUniverseDoc = {
      crypto: {
        mode: cryptoMode,
        symbols: nextCrypto,
      },
      stocks: {
        mode: stockMode,
        symbols: nextStocks,
      },
      forex: {
        mode: forexMode,
        pairs: nextForex,
      },
      updatedAt: serverTimestamp(),
    }

    const prevUniverse = universe
    const prevCrypto = cryptoSelection
    const prevStocks = stockSelection
    const prevForex = forexSelection

    setUniverse(payload)
    setCryptoSelection(nextCrypto)
    setStockSelection(nextStocks)
    setForexSelection(nextForex)

    try {
      await setDoc(doc(activeDb, "market", "universe"), payload, { merge: true })
      toast.success(t("dashboard.toasts.universeAdded"))
    } catch {
      setUniverse(prevUniverse)
      setCryptoSelection(prevCrypto)
      setStockSelection(prevStocks)
      setForexSelection(prevForex)
      toast.error(t("dashboard.toasts.universeUpdateFailed"))
    }
  }

  async function addTradeToPrimary(trade: MarketHotTrade) {
    if (!firebaseEnabled || !db) {
      toast.error(t("tradeNow.firebaseNotConfigured"))
      return
    }
    if (!trade.symbol) return

    const activeDb = db
    const cryptoSymbols = new Set(
      uniqueList((universe?.crypto?.symbols ?? []).map(normalizeSymbol).filter(Boolean))
    )
    const stockSymbols = new Set(
      uniqueList((universe?.stocks?.symbols ?? []).map(normalizeTicker).filter(Boolean))
    )
    const forexPairs = new Set(
      uniqueList((universe?.forex?.pairs ?? []).map(normalizeSymbol).filter(Boolean))
    )

    const primaryCrypto = new Set(primaryCryptoSelection.map(normalizeSymbol).filter(Boolean))
    const primaryStocks = new Set(primaryStockSelection.map(normalizeTicker).filter(Boolean))
    const primaryForex = new Set(primaryForexSelection.map(normalizeSymbol).filter(Boolean))

    if (trade.assetClass === "stock") {
      const symbol = normalizeTicker(trade.symbol)
      if (symbol) {
        stockSymbols.add(symbol)
        primaryStocks.add(symbol)
      }
    } else if (trade.assetClass === "forex") {
      const pair = normalizeSymbol(trade.symbol)
      if (pair) {
        forexPairs.add(pair)
        primaryForex.add(pair)
      }
    } else {
      const pair = normalizeSymbol(trade.symbol)
      if (pair) {
        cryptoSymbols.add(pair)
        primaryCrypto.add(pair)
      }
    }

    const nextCrypto = Array.from(cryptoSymbols)
    const nextStocks = Array.from(stockSymbols)
    const nextForex = Array.from(forexPairs)
    const nextPrimaryCrypto = Array.from(primaryCrypto)
    const nextPrimaryStocks = Array.from(primaryStocks)
    const nextPrimaryForex = Array.from(primaryForex)
    const universePayload: MarketUniverseDoc = {
      crypto: {
        mode: cryptoMode,
        symbols: nextCrypto,
      },
      stocks: {
        mode: stockMode,
        symbols: nextStocks,
      },
      forex: {
        mode: forexMode,
        pairs: nextForex,
      },
      updatedAt: serverTimestamp(),
    }

    const controlsPayload: MarketControlsDoc = {
      primaryAssets: {
        crypto: nextPrimaryCrypto,
        stocks: nextPrimaryStocks,
        forex: nextPrimaryForex,
      },
      updatedAt: serverTimestamp(),
    }

    const prevUniverse = universe
    const prevCrypto = cryptoSelection
    const prevStocks = stockSelection
    const prevForex = forexSelection
    const prevPrimaryCrypto = primaryCryptoSelection
    const prevPrimaryStocks = primaryStockSelection
    const prevPrimaryForex = primaryForexSelection

    setUniverse(universePayload)
    setCryptoSelection(nextCrypto)
    setStockSelection(nextStocks)
    setForexSelection(nextForex)
    setPrimaryCryptoSelection(nextPrimaryCrypto)
    setPrimaryStockSelection(nextPrimaryStocks)
    setPrimaryForexSelection(nextPrimaryForex)

    try {
      await Promise.all([
        setDoc(doc(activeDb, "market", "universe"), universePayload, { merge: true }),
        setDoc(doc(activeDb, "market", "controls"), controlsPayload, { merge: true }),
      ])
      toast.success(t("dashboard.toasts.primaryAdded"))
    } catch {
      setUniverse(prevUniverse)
      setCryptoSelection(prevCrypto)
      setStockSelection(prevStocks)
      setForexSelection(prevForex)
      setPrimaryCryptoSelection(prevPrimaryCrypto)
      setPrimaryStockSelection(prevPrimaryStocks)
      setPrimaryForexSelection(prevPrimaryForex)
      toast.error(t("dashboard.toasts.primaryUpdateFailed"))
    }
  }

  async function addQuickSymbol(symbol: string) {
    const normalized =
      quickAssetClass === "stock"
        ? normalizeTicker(symbol)
        : normalizeSymbol(symbol)
    if (!normalized) return
    await addTradeToUniverse({
      assetClass: quickAssetClass,
      symbol: normalized,
    })
    setQuickAssetInput("")
    setQuickSuggestionIndex(-1)
  }

  async function addQuickAsset() {
    if (!normalizedQuickAsset) return
    await addQuickSymbol(normalizedQuickAsset)
  }

  const universeTotal =
    cryptoSelection.length + stockSelection.length + forexSelection.length
  const visibleCrypto = cryptoSelection.slice(0, 6)
  const visibleStocks = stockSelection.slice(0, 6)
  const visibleForex = forexSelection.slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            {t("dashboard.header.kicker")}
          </div>
          <div className="text-2xl font-semibold">{t("dashboard.header.title")}</div>
          <div className="text-sm text-muted-foreground">
            {t("dashboard.header.subtitle")}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <PipelineHealthBadge showLabel />
            <MarketStatusBadge assetClass="crypto" />
            <MarketStatusBadge assetClass="stock" />
            <MarketStatusBadge assetClass="forex" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setUniverseOpen(true)}>
            {t("dashboard.actions.manageAssets")}
          </Button>
          <Button
            variant="secondary"
            onClick={triggerRefresh}
            disabled={
              !firebaseEnabled ||
              refreshingJobs ||
              !refreshEndpoint ||
              replayActive ||
              e2eDisableWrites
            }
            title={
              replayActive
                ? t("replay.actionsDisabled")
                : refreshEndpoint && !e2eDisableWrites
                  ? t("tradeNow.refreshTitle")
                  : t("tradeNow.refreshDisabledTitle")
            }
          >
            {refreshingJobs ? t("tradeNow.refreshing") : t("tradeNow.refreshNow")}
          </Button>
          <Button
            variant="outline"
            onClick={startOfflineBots}
            disabled={!firebaseEnabled || startingBots || replayActive}
            title={replayActive ? t("replay.actionsDisabled") : undefined}
          >
            {startingBots ? t("dashboard.actions.startingBots") : t("dashboard.actions.startOfflineBots")}
          </Button>
          <Badge variant="outline">{t("dashboard.badges.botsTracked", { count: totalBots })}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-xs">
        <Badge variant="outline">{t("dashboard.badges.horizon", { value: dipHorizon })}</Badge>
        <Badge variant="outline">{t("dashboard.badges.risk", { value: riskLabelMap[riskProfile] })}</Badge>
        <Badge variant="outline">{t("dashboard.badges.focus", { value: assetFocusLabel })}</Badge>
      </div>



      <Dialog open={universeOpen} onOpenChange={setUniverseOpen}>
        <DialogContent className="w-[min(96vw,1100px)] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("dashboard.universe.title")}</DialogTitle>
            <DialogDescription>
              {t("dashboard.universe.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <Tabs defaultValue="dip" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dip">{t("dashboard.universe.tabs.dipAi")}</TabsTrigger>
                <TabsTrigger value="universe">{t("dashboard.universe.tabs.universe")}</TabsTrigger>
                <TabsTrigger value="primary">{t("dashboard.universe.tabs.primary")}</TabsTrigger>
              </TabsList>

              <TabsContent value="dip" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t("dashboard.dip.aiCadence")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.dip.aiCadenceDescription")}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={llmEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setLlmEnabled((prev) => !prev)}
                        aria-pressed={llmEnabled}
                      >
                        {llmEnabled ? t("dashboard.dip.llmOn") : t("dashboard.dip.llmOff")}
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>{t("dashboard.dip.llmInterval")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {LLM_INTERVAL_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={llmIntervalMinutes === option ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setLlmIntervalMinutes(option)}
                          >
                            {option}m
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t("dashboard.dip.newsCadence")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.dip.newsCadenceDescription")}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={newsEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setNewsEnabled((prev) => !prev)}
                        aria-pressed={newsEnabled}
                      >
                        {newsEnabled ? t("dashboard.dip.newsOn") : t("dashboard.dip.newsOff")}
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>{t("dashboard.dip.newsInterval")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {NEWS_INTERVAL_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={newsIntervalMinutes === option ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setNewsIntervalMinutes(option)}
                          >
                            {option}m
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{t("dashboard.swing.title")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.swing.description")}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={swingOvernightEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSwingOvernightEnabled((prev) => !prev)}
                        aria-pressed={swingOvernightEnabled}
                      >
                        {swingOvernightEnabled
                          ? t("dashboard.swing.enabledOn")
                          : t("dashboard.swing.enabledOff")}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.swing.autoPaperDescription")}
                      </div>
                      <Button
                        type="button"
                        variant={swingOvernightAutoPaperEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSwingOvernightAutoPaperEnabled((prev) => !prev)}
                        aria-pressed={swingOvernightAutoPaperEnabled}
                        disabled={!swingOvernightEnabled}
                      >
                        {swingOvernightAutoPaperEnabled
                          ? t("dashboard.swing.autoPaperOn")
                          : t("dashboard.swing.autoPaperOff")}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          {t("dashboard.prebreakoutControls.title")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.prebreakoutControls.description")}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={prebreakoutEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPrebreakoutEnabled((prev) => !prev)}
                        aria-pressed={prebreakoutEnabled}
                      >
                        {prebreakoutEnabled
                          ? t("dashboard.prebreakoutControls.enabledOn")
                          : t("dashboard.prebreakoutControls.enabledOff")}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.prebreakoutControls.autoPaperDescription")}
                      </div>
                      <Button
                        type="button"
                        variant={prebreakoutAutoPaperEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPrebreakoutAutoPaperEnabled((prev) => !prev)}
                        aria-pressed={prebreakoutAutoPaperEnabled}
                        disabled={!prebreakoutEnabled}
                      >
                        {prebreakoutAutoPaperEnabled
                          ? t("dashboard.prebreakoutControls.autoPaperOn")
                          : t("dashboard.prebreakoutControls.autoPaperOff")}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="text-sm font-medium">{t("dashboard.dip.tuningTitle")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.dip.tuningDescription")}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("dashboard.dip.horizonLabel")}</Label>
                        <div className="flex flex-wrap gap-2">
                          {DIP_HORIZON_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={dipHorizon === option ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => setDipHorizon(option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("dashboard.dip.riskLabel")}</Label>
                        <div className="flex flex-wrap gap-2">
                          {RISK_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={riskProfile === option ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => setRiskProfile(option)}
                            >
                              {riskLabelMap[option]}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>{t("dashboard.dip.assetFocusLabel")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {ASSET_FOCUS_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={assetFocus.includes(option) ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleAssetFocus(option)}
                          >
                            {assetLabelMap[option]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 md:col-span-2">
                    <div className="text-sm font-medium">{t("dashboard.dip.scoreWeightingTitle")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.dip.scoreWeightingDescription")}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("dashboard.dip.trendHorizonLabel")}</Label>
                        <div className="flex flex-wrap gap-2">
                          {TREND_HORIZON_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant={trendHorizon === option ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => setTrendHorizon(option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("dashboard.dip.weightsLabel")}</Label>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("dashboard.dip.weights.momentum")}
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={trendMomentumWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendMomentumWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={trendMomentumWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendMomentumWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                              className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("dashboard.dip.weights.liquidity")}
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={trendVolumeWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendVolumeWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={trendVolumeWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendVolumeWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                              className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("dashboard.dip.weights.botConsensus")}
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={trendSignalsWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendSignalsWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={trendSignalsWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendSignalsWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                              className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("dashboard.dip.weights.news")}
                            </Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={trendNewsWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendNewsWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={trendNewsWeight}
                              onChange={(event) => {
                                const next = Number(event.target.value)
                                if (Number.isFinite(next)) {
                                  setTrendNewsWeight(Math.max(0, Math.min(100, next)))
                                }
                              }}
                              className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.dip.totalWeight", {
                            value:
                              trendMomentumWeight +
                              trendVolumeWeight +
                              trendSignalsWeight +
                              trendNewsWeight,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>{t("dashboard.dip.botWeightLabel")}</Label>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("dashboard.dip.botWeightBacktrader")}
                        </Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={BOT_WEIGHT_MIN}
                            max={BOT_WEIGHT_MAX}
                            step={0.1}
                            value={botWeightBacktrader}
                            onChange={(event) => {
                              const next = Number(event.target.value)
                              if (Number.isFinite(next)) {
                                setBotWeightBacktrader(clampBotWeight(next))
                              }
                            }}
                          />
                          <input
                            type="range"
                            min={BOT_WEIGHT_MIN}
                            max={BOT_WEIGHT_MAX}
                            step={0.1}
                            value={botWeightBacktrader}
                            onChange={(event) => {
                              const next = Number(event.target.value)
                              if (Number.isFinite(next)) {
                                setBotWeightBacktrader(clampBotWeight(next))
                              }
                            }}
                            className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                          />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.dip.botWeightDescription")}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>{t("dashboard.dip.autoTuneLabel")}</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={autoTuneEnabled ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setAutoTuneEnabled((prev) => !prev)}
                          aria-pressed={autoTuneEnabled}
                        >
                          {autoTuneEnabled
                            ? t("dashboard.dip.autoTuneOn")
                            : t("dashboard.dip.autoTuneOff")}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.dip.autoTuneDescription")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={autoTuneWithAI ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setAutoTuneWithAI((prev) => !prev)}
                          disabled={!autoTuneEnabled}
                          aria-pressed={autoTuneWithAI}
                        >
                          {autoTuneWithAI
                            ? t("dashboard.dip.autoTuneAiOn")
                            : t("dashboard.dip.autoTuneAiOff")}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.dip.autoTuneAiDescription")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {AUTO_TUNE_INTERVAL_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={
                              autoTuneIntervalHours === option ? "secondary" : "outline"
                            }
                            size="sm"
                            onClick={() => setAutoTuneIntervalHours(option)}
                            disabled={!autoTuneEnabled}
                          >
                            {option}h
                          </Button>
                        ))}
                      </div>
                      {autoTuneLastAt ? (
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.dip.lastTuned", {
                            time: formatRelativeTimestamp(autoTuneLastAt),
                          })}
                        </div>
                      ) : null}
                      {autoTuneNotes ? (
                        <div className="text-xs text-muted-foreground">{autoTuneNotes}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="universe" className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.universe.addAssetsHint")}
                </div>
                <Tabs defaultValue="crypto" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="crypto">{assetLabelMap.crypto}</TabsTrigger>
                    <TabsTrigger value="stocks">{assetLabelMap.stock}</TabsTrigger>
                    <TabsTrigger value="fx">{assetLabelMap.forex}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="crypto" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{t("dashboard.universe.crypto.title")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.universe.crypto.subtitle")}
                        </div>
                      </div>
                      <Select
                        value={cryptoMode}
                        onChange={(event) =>
                          setCryptoMode(resolveUniverseMode(event.target.value))
                        }
                        className="w-[220px]"
                        aria-label={t("dashboard.universe.crypto.ariaLabel")}
                      >
                        {UNIVERSE_MODE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {universeModeLabelMap[option]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {featuredCrypto.map((symbol) => (
                        <Button
                          key={symbol}
                          type="button"
                          variant={cryptoSelection.includes(symbol) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() =>
                            setCryptoSelection((prev) =>
                              toggleSelection(prev, symbol, normalizeSymbol)
                            )
                          }
                        >
                          {symbol}
                        </Button>
                      ))}
                    </div>
                    {trendingCrypto.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard.universe.trendingNow")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trendingCrypto.map((symbol) => (
                            <Button
                              key={symbol}
                              type="button"
                              variant={cryptoSelection.includes(symbol) ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                setCryptoSelection((prev) =>
                                  toggleSelection(prev, symbol, normalizeSymbol)
                                )
                              }
                            >
                              {symbol}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.universe.addCustomPair")}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-auto flex-1 min-w-[200px]"
                              value={cryptoSearch}
                              onChange={(event) => setCryptoSearch(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  addCustomCrypto()
                                }
                              }}
                              placeholder={t("dashboard.universe.crypto.searchPlaceholder")}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addCustomCrypto}
                              disabled={!canAddCrypto}
                            >
                              {t("common.add")}
                            </Button>
                            {cryptoSearch && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setCryptoSearch("")}
                              >
                                {t("common.clear")}
                              </Button>
                            )}
                          </div>
                          {canAddCrypto && (
                            <div className="text-xs text-muted-foreground">
                              {t("dashboard.universe.addToUniverse", {
                                symbol: normalizedCryptoSearch,
                              })}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {cryptoSearch
                              ? t("dashboard.universe.searchResults")
                              : t("dashboard.universe.morePicks")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {filteredCryptoOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.universe.noMatches")}
                              </span>
                            ) : (
                              filteredCryptoOptions.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setCryptoSelection((prev) =>
                                      addSelection(prev, symbol, normalizeSymbol)
                                    )
                                  }
                                >
                                  {symbol}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard.universe.yourPicks")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cryptoSelection.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("dashboard.universe.noPairsSelected")}
                            </span>
                          ) : (
                            cryptoSelection.map((symbol) => (
                              <Button
                                key={symbol}
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setCryptoSelection((prev) => removeSelection(prev, symbol))
                                }
                              >
                                {symbol}
                                <X className="ml-1 h-3 w-3" />
                              </Button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="stocks" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{t("dashboard.universe.stocks.title")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.universe.stocks.subtitle")}
                        </div>
                      </div>
                      <Select
                        value={stockMode}
                        onChange={(event) =>
                          setStockMode(resolveUniverseMode(event.target.value))
                        }
                        className="w-[220px]"
                        aria-label={t("dashboard.universe.stocks.ariaLabel")}
                      >
                        {UNIVERSE_MODE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {universeModeLabelMap[option]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {featuredStocks.map((symbol) => (
                        <Button
                          key={symbol}
                          type="button"
                          variant={stockSelection.includes(symbol) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() =>
                            setStockSelection((prev) =>
                              toggleSelection(prev, symbol, normalizeTicker)
                            )
                          }
                        >
                          {symbol}
                        </Button>
                      ))}
                    </div>
                    {trendingStocks.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard.universe.trendingNow")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trendingStocks.map((symbol) => (
                            <Button
                              key={symbol}
                              type="button"
                              variant={stockSelection.includes(symbol) ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                setStockSelection((prev) =>
                                  toggleSelection(prev, symbol, normalizeTicker)
                                )
                              }
                            >
                              {symbol}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.universe.addCustomTicker")}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-auto flex-1 min-w-[200px]"
                              value={stockSearch}
                              onChange={(event) => setStockSearch(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  addCustomStock()
                                }
                              }}
                              placeholder={t("dashboard.universe.stocks.searchPlaceholder")}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addCustomStock}
                              disabled={!canAddStock}
                            >
                              {t("common.add")}
                            </Button>
                            {stockSearch && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setStockSearch("")}
                              >
                                {t("common.clear")}
                              </Button>
                            )}
                          </div>
                          {canAddStock && (
                            <div className="text-xs text-muted-foreground">
                              {t("dashboard.universe.addToUniverse", {
                                symbol: normalizedStockSearch,
                              })}
                            </div>
                          )}
                          {stockSearch && (
                            <div className="text-xs text-muted-foreground">
                              {stockSearch.length < 2
                                ? t("dashboard.universe.stocks.searchHint")
                                : stockSymbolLoading
                                  ? t("dashboard.universe.stocks.searching")
                                  : stockSymbolMatches.length > 0
                                    ? t("dashboard.universe.stocks.matches", {
                                        count: stockSymbolMatches.length,
                                      })
                                    : t("dashboard.universe.stocks.noMatches")}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {stockSearch
                              ? t("dashboard.universe.searchResults")
                              : t("dashboard.universe.morePicks")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {filteredStockOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.universe.noMatches")}
                              </span>
                            ) : (
                              filteredStockOptions.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setStockSelection((prev) =>
                                      addSelection(prev, symbol, normalizeTicker)
                                    )
                                  }
                                >
                                  {symbol}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard.universe.yourPicks")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {stockSelection.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("dashboard.universe.noTickersSelected")}
                            </span>
                          ) : (
                            stockSelection.map((symbol) => (
                              <Button
                                key={symbol}
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setStockSelection((prev) => removeSelection(prev, symbol))
                                }
                              >
                                {symbol}
                                <X className="ml-1 h-3 w-3" />
                              </Button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.universe.stocks.focusedHint")}
                    </div>
                  </TabsContent>

                  <TabsContent value="fx" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{t("dashboard.universe.fx.title")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("dashboard.universe.fx.subtitle")}
                        </div>
                      </div>
                      <Select
                        value={forexMode}
                        onChange={(event) =>
                          setForexMode(resolveUniverseMode(event.target.value))
                        }
                        className="w-[220px]"
                        aria-label={t("dashboard.universe.fx.ariaLabel")}
                      >
                        {UNIVERSE_MODE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {universeModeLabelMap[option]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {featuredFx.map((symbol) => (
                        <Button
                          key={symbol}
                          type="button"
                          variant={forexSelection.includes(symbol) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() =>
                            setForexSelection((prev) =>
                              toggleSelection(prev, symbol, normalizeSymbol)
                            )
                          }
                        >
                          {symbol}
                        </Button>
                      ))}
                    </div>
                    {trendingFx.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard.universe.trendingNow")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trendingFx.map((symbol) => (
                            <Button
                              key={symbol}
                              type="button"
                              variant={forexSelection.includes(symbol) ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                setForexSelection((prev) =>
                                  toggleSelection(prev, symbol, normalizeSymbol)
                                )
                              }
                            >
                              {symbol}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.universe.addCustomPair")}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-auto flex-1 min-w-[200px]"
                              value={forexSearch}
                              onChange={(event) => setForexSearch(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  addCustomForex()
                                }
                              }}
                              placeholder={t("dashboard.universe.fx.searchPlaceholder")}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addCustomForex}
                              disabled={!canAddForex}
                            >
                              {t("common.add")}
                            </Button>
                            {forexSearch && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setForexSearch("")}
                              >
                                {t("common.clear")}
                              </Button>
                            )}
                          </div>
                          {canAddForex && (
                            <div className="text-xs text-muted-foreground">
                              {t("dashboard.universe.addToUniverse", {
                                symbol: normalizedForexSearch,
                              })}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {forexSearch
                              ? t("dashboard.universe.searchResults")
                              : t("dashboard.universe.morePicks")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {filteredForexOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.universe.noMatches")}
                              </span>
                            ) : (
                              filteredForexOptions.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setForexSelection((prev) =>
                                      addSelection(prev, symbol, normalizeSymbol)
                                    )
                                  }
                                >
                                  {symbol}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard.universe.yourPicks")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {forexSelection.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("dashboard.universe.noPairsSelected")}
                            </span>
                          ) : (
                            forexSelection.map((symbol) => (
                              <Button
                                key={symbol}
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setForexSelection((prev) => removeSelection(prev, symbol))
                                }
                              >
                                {symbol}
                                <X className="ml-1 h-3 w-3" />
                              </Button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="primary" className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="text-sm font-medium">{t("dashboard.primary.title")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.primary.subtitle")}
                  </div>
                </div>
                <Tabs defaultValue="crypto" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="crypto">{assetLabelMap.crypto}</TabsTrigger>
                    <TabsTrigger value="stocks">{assetLabelMap.stock}</TabsTrigger>
                    <TabsTrigger value="fx">{assetLabelMap.forex}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="crypto" className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          {t("dashboard.primary.crypto.title")}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.primary.selected", {
                            count: primaryCryptoSelection.length,
                          })}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.universe.yourPicks")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryCryptoSelection.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.primary.crypto.empty")}
                              </span>
                            ) : (
                              primaryCryptoSelection.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setPrimaryCryptoSelection((prev) =>
                                      removeSelection(prev, symbol)
                                    )
                                  }
                                >
                                  {symbol}
                                  <X className="ml-1 h-3 w-3" />
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.primary.suggested")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryCryptoOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.primary.noPopular")}
                              </span>
                            ) : (
                              primaryCryptoOptions.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addPrimaryCrypto(symbol)}
                                >
                                  {symbol}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="stocks" className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          {t("dashboard.primary.stocks.title")}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.primary.selected", {
                            count: primaryStockSelection.length,
                          })}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.universe.yourPicks")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryStockSelection.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.primary.stocks.empty")}
                              </span>
                            ) : (
                              primaryStockSelection.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setPrimaryStockSelection((prev) =>
                                      removeSelection(prev, symbol)
                                    )
                                  }
                                >
                                  {symbol}
                                  <X className="ml-1 h-3 w-3" />
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.primary.suggested")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryStockOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.primary.noPopular")}
                              </span>
                            ) : (
                              primaryStockOptions.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addPrimaryStock(symbol)}
                                >
                                  {symbol}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="fx" className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          {t("dashboard.primary.fx.title")}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.primary.selected", {
                            count: primaryForexSelection.length,
                          })}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.universe.yourPicks")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryForexSelection.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.primary.fx.empty")}
                              </span>
                            ) : (
                              primaryForexSelection.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setPrimaryForexSelection((prev) =>
                                      removeSelection(prev, symbol)
                                    )
                                  }
                                >
                                  {symbol}
                                  <X className="ml-1 h-3 w-3" />
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("dashboard.primary.suggested")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryForexOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("dashboard.primary.noPopular")}
                              </span>
                            ) : (
                              primaryForexOptions.map((symbol) => (
                                <Button
                                  key={symbol}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addPrimaryForex(symbol)}
                                >
                                  {symbol}
                                </Button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUniverseOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={savePreferences} disabled={preferencesSaving}>
              {preferencesSaving
                ? t("dashboard.actions.savingPreferences")
                : t("dashboard.actions.savePreferences")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="opportunities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opportunities">{t("dashboard.tabs.opportunities")}</TabsTrigger>
          <TabsTrigger value="advanced">{t("dashboard.tabs.advanced")}</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="reveal" style={{ "--delay": "140ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{t("dashboard.dipRadar.title")}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.dipRadar.subtitle", {
                          horizon: dipHorizon,
                          risk: riskLabelMap[riskProfile],
                          focus: assetFocusLabel,
                        })}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {t("dashboard.dipRadar.picks", { count: displayDipIdeas.length })}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.states.connectFirebaseMarketIntel")}
                      </div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">{t("dashboard.dipRadar.loading")}</div>
                    ) : displayDipIdeas.length === 0 ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.dipRadar.empty")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dipDisplayMode === "closest" && (
                          <div className="text-xs text-muted-foreground">
                            {t("dashboard.dipRadar.closestHint")}
                          </div>
                        )}
                        {displayDipIdeas.map((trade) => {
                          const horizonChange = getHorizonChange(trade, dipHorizon)
                          return (
                            <div
                              key={`dip-${trade.assetClass}-${trade.symbol}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold">{trade.symbol}</div>
                                  <Badge variant="outline" className="uppercase">
                                    {getAssetLabel(trade.assetClass, "short")}
                                  </Badge>
                                  {isPrimaryTrade(trade) && (
                                    <Badge variant="secondary">{t("dashboard.badges.primary")}</Badge>
                                  )}
                                  <div className="ml-auto flex items-center gap-1">
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
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground">
                                    {(() => {
                                      const current = prices[trade.symbol] ?? trade.price
                                      return formatAssetPrice(current, trade.assetClass)
                                    })()}
                                  </span>
                                  {livePrices[trade.symbol] && (
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                                      title={t("tradeNow.livePrice")}
                                    ></span>
                                  )}
                                  <span>·</span>
                                  {trade.name || getAssetLabel(trade.assetClass)} · {dipHorizon}{" "}
                                  {t("dashboard.dipRadar.moveLabel")}:{" "}
                                  {horizonChange === null ? naLabel : formatChange(horizonChange)}
                                </div>
                            {trade.rationale && (() => {
                              const noteKind = findAnalysisNoteKind(trade.analysis?.details)
                              return (
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
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
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={scoreTone(trade.score)}>
                                  {t("dashboard.labels.score", {
                                    score: trade.score?.toFixed(1) ?? naLabel,
                                  })}
                                </Badge>
                                <Badge variant="outline">
                                  {trade.signals?.total
                                    ? t("dashboard.labels.signalsCount", {
                                        count: trade.signals.total,
                                      })
                                    : t("dashboard.labels.noSignals")}
                                </Badge>
                                {!isPrimaryTrade(trade) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addTradeToPrimary(trade)}
                                    disabled={!firebaseEnabled}
                                  >
                                    {t("dashboard.actions.markPrimary")}
                                  </Button>
                                )}
                                {!isWatchlisted(trade) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addTradeToUniverse(trade)}
                                    disabled={!firebaseEnabled}
                                  >
                                    {t("dashboard.actions.addToUniverse")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "180ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{t("dashboard.hotTrades.title")}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.hotTrades.subtitle")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hotTradesUpdatedAt && (
                        <Badge variant="outline">
                          {t("tradeNow.updatedAt", {
                            time: formatRelativeTimestamp(hotTradesUpdatedAt),
                          })}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.states.connectFirebaseMarketIntel")}
                      </div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">{t("dashboard.hotTrades.loading")}</div>
                    ) : focusedHotTrades.length === 0 ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.hotTrades.empty")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {focusedHotTrades.slice(0, 6).map((trade) => (
                          <div
                            key={`${trade.assetClass}-${trade.symbol}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold">{trade.symbol}</div>
                                <Badge variant="outline" className="uppercase">
                                  {getAssetLabel(trade.assetClass, "short")}
                                </Badge>
                                {trade.side && (
                                  <Badge
                                    variant={signalBadgeVariant(trade.side)}
                                    className="uppercase"
                                  >
                                    {t(`trade.side.${trade.side}`)}
                                  </Badge>
                                )}
                                {isWatchlisted(trade) && (
                                  <Badge variant="secondary">{t("dashboard.badges.watchlist")}</Badge>
                                )}
                                {isPrimaryTrade(trade) && (
                                  <Badge variant="secondary">{t("dashboard.badges.primary")}</Badge>
                                )}
                                <div className="ml-auto flex items-center gap-1">
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
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground">
                                  {(() => {
                                    const current = prices[trade.symbol] ?? trade.price
                                    return formatAssetPrice(current, trade.assetClass)
                                  })()}
                                </span>
                                  {livePrices[trade.symbol] && (
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                                      title={t("tradeNow.livePrice")}
                                    ></span>
                                  )}
                                  <span>·</span>
                                  {trade.name || getAssetLabel(trade.assetClass)} · {t("tradeNow.twentyFourHour")}:{" "}
                                  {formatChange(trade.momentum?.change24h)}
                                  {trade.exchange ? ` · ${trade.exchange}` : ""}
                                </div>
                              {trade.rationale && (() => {
                                const noteKind = findAnalysisNoteKind(trade.analysis?.details)
                                return (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
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
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={scoreTone(trade.score)}>
                                {t("dashboard.labels.score", {
                                  score: trade.score?.toFixed(1) ?? naLabel,
                                })}
                              </Badge>
                              <Badge variant="outline">
                                {trade.signals?.total
                                  ? t("dashboard.labels.signalsCount", {
                                      count: trade.signals.total,
                                    })
                                  : t("dashboard.labels.noSignals")}
                              </Badge>
                              {!isWatchlisted(trade) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addTradeToUniverse(trade)}
                                  disabled={!firebaseEnabled}
                                >
                                  {t("dashboard.actions.addToUniverse")}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "200ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {t("dashboard.swingOvernight.title")}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.swingOvernight.subtitle")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {swingOvernightUpdatedAt && (
                        <Badge variant="outline">
                          {t("tradeNow.updatedAt", {
                            time: formatRelativeTimestamp(swingOvernightUpdatedAt),
                          })}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.states.connectFirebaseMarketIntel")}
                      </div>
                    ) : loadingSwingOvernight ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.swingOvernight.loading")}
                      </div>
                    ) : swingOvernightItems.length === 0 ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.swingOvernight.empty")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {swingOvernightItems.slice(0, 6).map((trade) => {
                          const localized = localizeAnalysis(
                            trade.analysis,
                            t,
                            i18n.language
                          )
                          const noteKind = findAnalysisNoteKind(trade.analysis?.details)
                          return (
                            <div
                              key={`swing-${trade.symbol}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold">{trade.symbol}</div>
                                  <Badge variant="outline" className="uppercase">
                                    {getAssetLabel(trade.assetClass, "short")}
                                  </Badge>
                                  <Badge variant="secondary">
                                    {t("tradeNow.swingOvernightBadge")}
                                  </Badge>
                                  <div className="ml-auto flex items-center gap-1">
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
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground">
                                    {(() => {
                                      const current = prices[trade.symbol] ?? trade.price
                                      return formatAssetPrice(current, trade.assetClass)
                                    })()}
                                  </span>
                                  {livePrices[trade.symbol] && (
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                                      title={t("tradeNow.livePrice")}
                                    ></span>
                                  )}
                                  <span>·</span>
                                  {trade.name || getAssetLabel(trade.assetClass)} ·{" "}
                                  {t("tradeNow.twentyFourHour")}:{" "}
                                  {formatChange(trade.momentum?.change24h)}
                                </div>
                                {localized.summary ? (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    {noteKind ? (
                                      <Badge
                                        variant="outline"
                                        className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                                      >
                                        {t(`analysis.badges.${noteKind}`)}
                                      </Badge>
                                    ) : null}
                                    <span>{localized.summary}</span>
                                  </div>
                                ) : trade.rationale ? (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
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
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={scoreTone(trade.score)}>
                                  {t("dashboard.labels.score", {
                                    score: trade.score?.toFixed(1) ?? naLabel,
                                  })}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "210ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {t("dashboard.prebreakout.title")}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.prebreakout.subtitle")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {prebreakoutEntryBadge && (
                        <Badge variant="outline" className="text-[10px]">
                          {prebreakoutEntryBadge}
                        </Badge>
                      )}
                      {prebreakoutUpdatedAt && (
                        <Badge variant="outline">
                          {t("tradeNow.updatedAt", {
                            time: formatRelativeTimestamp(prebreakoutUpdatedAt),
                          })}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.states.connectFirebaseMarketIntel")}
                      </div>
                    ) : loadingPrebreakout ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.prebreakout.loading")}
                      </div>
                    ) : prebreakoutItems.length === 0 ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.prebreakout.empty")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {prebreakoutItems.slice(0, 6).map((trade) => {
                          const localized = localizeAnalysis(trade.analysis, t, i18n.language)
                          const noteKind = findAnalysisNoteKind(trade.analysis?.details)
                          return (
                            <div
                              key={`prebreakout-${trade.symbol}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold">{trade.symbol}</div>
                                  <Badge variant="outline" className="uppercase">
                                    {getAssetLabel(trade.assetClass, "short")}
                                  </Badge>
                                  <Badge variant="secondary">
                                    {t("tradeNow.prebreakoutBadge")}
                                  </Badge>
                                  <div className="ml-auto flex items-center gap-1">
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
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground">
                                    {(() => {
                                      const current = prices[trade.symbol] ?? trade.price
                                      return formatAssetPrice(current, trade.assetClass)
                                    })()}
                                  </span>
                                  {livePrices[trade.symbol] && (
                                    <span
                                      className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                                      title={t("tradeNow.livePrice")}
                                    ></span>
                                  )}
                                  <span>·</span>
                                  {trade.name || getAssetLabel(trade.assetClass)} ·{" "}
                                  {t("tradeNow.twentyFourHour")}:{" "}
                                  {formatChange(trade.momentum?.change24h)}
                                </div>
                                {localized.summary ? (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    {noteKind ? (
                                      <Badge
                                        variant="outline"
                                        className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                                      >
                                        {t(`analysis.badges.${noteKind}`)}
                                      </Badge>
                                    ) : null}
                                    <span>{localized.summary}</span>
                                  </div>
                                ) : trade.rationale ? (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
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
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={scoreTone(trade.score)}>
                                  {t("dashboard.labels.score", {
                                    score: trade.score?.toFixed(1) ?? naLabel,
                                  })}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal lg:col-span-2" style={{ "--delay": "220ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{t("dashboard.trending.title")}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.trending.subtitle")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {trendingUpdatedAt && (
                        <Badge variant="outline">
                          {t("tradeNow.updatedAt", {
                            time: formatRelativeTimestamp(trendingUpdatedAt),
                          })}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.states.connectFirebaseTrending")}
                      </div>
                    ) : loadingTrending ? (
                      <div className="text-sm opacity-70">{t("dashboard.trending.loading")}</div>
                    ) : !trending ? (
                      <div className="text-sm opacity-70">
                        {t("dashboard.trending.empty")}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          {TREND_HORIZON_OPTIONS.map((option) => (
                            <Button
                              key={`trend-${option}`}
                              type="button"
                              size="sm"
                              variant={trendHorizon === option ? "secondary" : "outline"}
                              onClick={() => setTrendHorizon(option)}
                            >
                              {option}
                            </Button>
                          ))}
                          <div className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
                            {t("dashboard.trending.weights", {
                              momentum: trendWeightsDisplay.momentum,
                              liquidity: trendWeightsDisplay.liquidity,
                              consensus: trendWeightsDisplay.consensus,
                              news: trendWeightsDisplay.news,
                            })}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ASSET_FOCUS_OPTIONS.map((option) => (
                            <Button
                              key={`trend-focus-${option}`}
                              type="button"
                              size="sm"
                              variant={trendAssetFocus.includes(option) ? "secondary" : "outline"}
                              onClick={() => toggleTrendFocus(option)}
                            >
                              {assetLabelMap[option]}
                            </Button>
                          ))}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {(["crypto", "stock", "forex"] as AssetClass[]).map((assetClass) => {
                            const list =
                              assetClass === "crypto"
                                ? trendingBuckets.crypto
                                : assetClass === "stock"
                                  ? trendingBuckets.stock
                                  : trendingBuckets.forex
                            if (!trendFocusSet.has(assetClass)) return null
                            const label = getAssetLabel(assetClass)
                            return (
                              <div
                                key={`trend-${assetClass}`}
                                className="rounded-2xl border border-border/60 bg-background/60 p-4 space-y-3"
                              >
                                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                  {label}
                                </div>
                                {list.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">
                                    {t("dashboard.trending.noPicks")}
                                  </div>
                                ) : (
                                  list.map((item) => {
                                    const momentum = getTrendMomentum(item, trendHorizon)
                                    const momentumLabel = momentum.window ?? trendHorizon
                                    const showNewsMetric = Boolean(
                                      item.news?.count && item.news.count > 0
                                    )
                                    const scoreComponents = item.scoreComponents || item.components
                                    const liquidityValue =
                                      scoreComponents?.liquidity ?? (item.components as { volume?: number } | undefined)?.volume
                                    const consensusValue =
                                      scoreComponents?.consensus ?? (item.components as { signals?: number } | undefined)?.signals
                                    const metrics = [
                                      {
                                        key: "momentum",
                                        label: t("dashboard.trending.metrics.momentum"),
                                        value: scoreComponents?.momentum,
                                      },
                                      {
                                        key: "liquidity",
                                        label: t("dashboard.trending.metrics.liquidity"),
                                        value: liquidityValue,
                                      },
                                      {
                                        key: "consensus",
                                        label: t("dashboard.trending.metrics.consensus"),
                                        value: consensusValue,
                                      },
                                    ]
                                    if (scoreComponents?.universe) {
                                      metrics.push({
                                        key: "universe",
                                        label: t("dashboard.trending.metrics.universe"),
                                        value: scoreComponents?.universe,
                                      })
                                    }
                                    if (showNewsMetric) {
                                      metrics.push({
                                        key: "news",
                                        label: t("dashboard.trending.metrics.news"),
                                        value: scoreComponents?.news,
                                      })
                                    }
                                    return (
                                      <div
                                        key={`trend-${assetClass}-${item.symbol}`}
                                        className="group min-w-0 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm font-semibold tracking-tight truncate">
                                                {item.symbol}
                                              </div>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => {
                                                  setBreakdownAsset(item)
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
                                                  setChartAsset({
                                                    assetClass,
                                                    symbol: item.symbol,
                                                    name: item.name,
                                                    price: item.price,
                                                  })
                                                  setChartOpen(true)
                                                }}
                                                title={t("tradeNow.viewChart")}
                                              >
                                                <BarChart3 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                                                {momentumLabel} {formatChange(momentum.change ?? undefined)}
                                              </div>
                                              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                                                {(() => {
                                                  const current = prices[item.symbol] ?? item.price
                                                  return formatAssetPrice(current, item.assetClass)
                                                })()}
                                                {livePrices[item.symbol] && (
                                                  <span
                                                    className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                                                    title={t("tradeNow.livePrice")}
                                                  ></span>
                                                )}
                                              </div>
                                            </div>
                                            {item.signals?.total ? (
                                              <div className="mt-2 text-[11px] text-muted-foreground">
                                                {t("dashboard.labels.signalsBreakdown", {
                                                  total: item.signals.total,
                                                  buy: item.signals.buy ?? 0,
                                                  sell: item.signals.sell ?? 0,
                                                })}
                                              </div>
                                            ) : null}
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <Badge variant="outline" className={scoreTone(item.score)}>
                                              {item.score?.toFixed(1) ?? naLabel}
                                            </Badge>
                                            {!isSymbolWatchlisted(assetClass, item.symbol) && (
                                              <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-7 rounded-full px-3 text-xs"
                                                onClick={() =>
                                                  addTradeToUniverse({
                                                    assetClass,
                                                    symbol: item.symbol,
                                                  })
                                                }
                                                disabled={!firebaseEnabled}
                                              >
                                                {t("common.add")}
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="mt-3 space-y-1">
                                          {metrics.map((metric) => {
                                            const value =
                                              typeof metric.value === "number" ? metric.value : null
                                            const clamped =
                                              value === null ? 0 : Math.min(Math.max(value, 0), 100)
                                            const display =
                                              value === null ? naLabel : Math.round(value).toString()
                                            return (
                                              <div
                                                key={`${item.symbol}-${metric.key}`}
                                                className="flex items-center gap-3 text-[11px] text-muted-foreground"
                                              >
                                                <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.2em]">
                                                  {metric.label}
                                                </span>
                                                <div className="relative h-1.5 flex-1 rounded-full bg-muted/40">
                                                  <div
                                                    className="h-1.5 rounded-full bg-primary/60 transition"
                                                    style={{ width: `${clamped}%` }}
                                                  />
                                                </div>
                                                <span className="w-8 shrink-0 text-right font-mono text-[10px]">
                                                  {display}
                                                </span>
                                              </div>
                                            )
                                          })}
                                        </div>
                                        {showNewsMetric ? (
                                          <div className="mt-2 text-[11px] text-muted-foreground">
                                            {t("dashboard.trending.newsLine", {
                                              count: item.news?.count ?? 0,
                                              sentiment: formatSentiment(item.news?.sentiment),
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("dashboard.ideas.topBuys")}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.ideas.topBuysSubtitle")}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">{t("tradeNow.connectFirebase")}</div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">{t("dashboard.ideas.loading")}</div>
                    ) : buyIdeas.length === 0 ? (
                      <div className="text-sm opacity-70">{t("dashboard.ideas.noBuys")}</div>
                    ) : (
                      buyIdeas.map((trade) => {
                        const localizedAnalysis = localizeAnalysis(trade.analysis, t, i18n.language)
                        return (
                        <div key={`buy-${trade.symbol}`} className="group space-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{trade.symbol}</div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setBreakdownAsset(trade)
                                    setBreakdownOpen(true)
                                  }}
                                  title={t("tradeNow.scoreBreakdown")}
                                >
                                  <InfoIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setChartAsset(trade)
                                    setChartOpen(true)
                                  }}
                                  title={t("tradeNow.viewChart")}
                                >
                                  <BarChart3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={async () => {
                                    const ok = await copyAiPrompt(trade)
                                    if (ok) toast.success(t("tradeNow.aiPromptCopied"))
                                    else toast.error(t("tradeNow.aiPromptCopyFailed"))
                                  }}
                                  title={t("tradeNow.copyAiPrompt")}
                                >
                                  <Clipboard className="h-3.5 w-3.5" />
                                </Button>
                                <PaperTradeButton
                                  trade={trade}
                                  size="icon"
                                  className="h-5 w-5 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
                                  disabled={replayActive}
                                  disabledReason={t("replay.actionsDisabled")}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {(() => {
                                  const current = prices[trade.symbol] ?? trade.price
                                  return formatAssetPrice(current, trade.assetClass)
                                })()}
                                {livePrices[trade.symbol] && (
                                  <span
                                    className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"
                                    title={t("tradeNow.livePrice")}
                                  ></span>
                                )}
                                <span>·</span>
                                {t("tradeNow.twentyFourHour")}: {formatChange(trade.momentum?.change24h)}
                              </div>
                            </div>
                            <Badge variant="outline" className={scoreTone(trade.score)}>
                              {trade.score?.toFixed(0) ?? naLabel}
                            </Badge>
                          </div>
                          {localizedAnalysis.details?.length ? (
                            <details className="text-[10px] text-muted-foreground">
                              <summary className="cursor-pointer text-[10px] flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> {t("tradeNow.whyThisPick")}
                              </summary>
                              <ul className="mt-1 space-y-0.5 break-words list-disc pl-4">
                                {localizedAnalysis.details.slice(0, 4).map((line, index) => {
                                  const noteKind = getAnalysisNoteKind(trade.analysis?.details?.[index])
                                  return (
                                    <li key={`${trade.symbol}-buy-detail-${index}`}>
                                      <span className="inline-flex items-center gap-1">
                                        {noteKind ? (
                                          <Badge
                                            variant="outline"
                                            className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                                          >
                                            {t(`analysis.badges.${noteKind}`)}
                                          </Badge>
                                        ) : null}
                                        <span>{line}</span>
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      )})
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "270ms" } as CSSProperties}>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("dashboard.ideas.topSells")}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.ideas.topSellsSubtitle")}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">{t("tradeNow.connectFirebase")}</div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">{t("dashboard.ideas.loading")}</div>
                    ) : sellIdeas.length === 0 ? (
                      <div className="text-sm opacity-70">{t("dashboard.ideas.noSells")}</div>
                    ) : (
                      sellIdeas.map((trade) => {
                        const localizedAnalysis = localizeAnalysis(trade.analysis, t, i18n.language)
                        return (
                        <div
                          key={`sell-${trade.symbol}`}
                          className="group space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{trade.symbol}</div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setBreakdownAsset(trade)
                                    setBreakdownOpen(true)
                                  }}
                                  title={t("tradeNow.scoreBreakdown")}
                                >
                                  <InfoIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setChartAsset(trade)
                                    setChartOpen(true)
                                  }}
                                  title={t("tradeNow.viewChart")}
                                >
                                  <BarChart3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={async () => {
                                    const ok = await copyAiPrompt(trade)
                                    if (ok) toast.success(t("tradeNow.aiPromptCopied"))
                                    else toast.error(t("tradeNow.aiPromptCopyFailed"))
                                  }}
                                  title={t("tradeNow.copyAiPrompt")}
                                >
                                  <Clipboard className="h-3.5 w-3.5" />
                                </Button>
                                <PaperTradeButton
                                  trade={trade}
                                  size="icon"
                                  className="h-5 w-5 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
                                  disabled={replayActive}
                                  disabledReason={t("replay.actionsDisabled")}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {(() => {
                                  const current = prices[trade.symbol] ?? trade.price
                                  return formatAssetPrice(current, trade.assetClass)
                                })()}
                                {livePrices[trade.symbol] && (
                                  <span
                                    className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"
                                    title={t("tradeNow.livePrice")}
                                  ></span>
                                )}
                                <span>·</span>
                                {t("tradeNow.twentyFourHour")}: {formatChange(trade.momentum?.change24h)}
                              </div>
                            </div>
                            <Badge variant="outline" className={scoreTone(trade.score)}>
                              {trade.score?.toFixed(0) ?? naLabel}
                            </Badge>
                          </div>
                          {localizedAnalysis.details?.length ? (
                            <details className="text-[10px] text-muted-foreground">
                              <summary className="cursor-pointer text-[10px] flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> {t("tradeNow.whyThisPick")}
                              </summary>
                              <ul className="mt-1 space-y-0.5 break-words list-disc pl-4">
                                {localizedAnalysis.details.slice(0, 4).map((line, index) => {
                                  const noteKind = getAnalysisNoteKind(trade.analysis?.details?.[index])
                                  return (
                                    <li key={`${trade.symbol}-sell-detail-${index}`}>
                                      <span className="inline-flex items-center gap-1">
                                        {noteKind ? (
                                          <Badge
                                            variant="outline"
                                            className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                                          >
                                            {t(`analysis.badges.${noteKind}`)}
                                          </Badge>
                                        ) : null}
                                        <span>{line}</span>
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      )})
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <Card className="reveal" style={{ "--delay": "200ms" } as CSSProperties}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{t("dashboard.universe.summaryTitle")}</CardTitle>
                  <Badge variant="outline">
                    {t("dashboard.universe.assetsCount", { count: universeTotal })}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {t("dashboard.universe.quickAdd")}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        className="w-auto min-w-[140px]"
                        value={quickAssetClass}
                        onChange={(event) =>
                          setQuickAssetClass(event.target.value as AssetClass)
                        }
                      >
                        <option value="crypto">{assetLabelMap.crypto}</option>
                        <option value="stock">{assetLabelMap.stock}</option>
                        <option value="forex">{assetLabelMap.forex}</option>
                      </Select>
                      <div className="relative w-full min-w-[180px] flex-1">
                        <Input
                          className="w-full"
                          value={quickAssetInput}
                          onChange={(event) => setQuickAssetInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              if (quickSuggestions.length === 0) return
                              event.preventDefault()
                              setQuickSuggestionIndex((prev) =>
                                Math.min(prev + 1, quickSuggestions.length - 1)
                              )
                              return
                            }
                            if (event.key === "ArrowUp") {
                              if (quickSuggestions.length === 0) return
                              event.preventDefault()
                              setQuickSuggestionIndex((prev) => (prev <= 0 ? -1 : prev - 1))
                              return
                            }
                            if (event.key === "Enter") {
                              event.preventDefault()
                              if (
                                quickSuggestionIndex >= 0 &&
                                quickSuggestionIndex < quickSuggestions.length
                              ) {
                                addQuickSymbol(quickSuggestions[quickSuggestionIndex])
                              } else if (canQuickAdd) {
                                addQuickAsset()
                              }
                            }
                          }}
                          placeholder={
                            quickAssetClass === "stock"
                              ? t("dashboard.universe.quickAddPlaceholderStock")
                              : quickAssetClass === "forex"
                                ? t("dashboard.universe.quickAddPlaceholderFx")
                                : t("dashboard.universe.quickAddPlaceholderCrypto")
                          }
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={quickAssetInput.trim().length > 0}
                          aria-controls="quick-asset-list"
                          aria-activedescendant={
                            quickSuggestionIndex >= 0
                              ? `quick-asset-option-${quickSuggestionIndex}`
                              : undefined
                          }
                        />
                        {quickAssetInput.trim().length > 0 && quickSuggestions.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                            <div
                              className="max-h-60 overflow-auto py-1"
                              role="listbox"
                              id="quick-asset-list"
                            >
                              {quickSuggestions.map((symbol, index) => (
                                <button
                                  key={`quick-${quickAssetClass}-${symbol}`}
                                  type="button"
                                  role="option"
                                  aria-selected={index === quickSuggestionIndex}
                                  id={`quick-asset-option-${index}`}
                                  className={[
                                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                                    index === quickSuggestionIndex
                                      ? "bg-muted text-foreground"
                                      : "hover:bg-muted/60",
                                  ].join(" ")}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => addQuickSymbol(symbol)}
                                >
                                  <span className="font-medium">{symbol}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {getAssetLabel(quickAssetClass, "short")}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {quickAssetInput.trim().length > 0 && quickSuggestions.length === 0 && (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground shadow-lg">
                            {t("dashboard.universe.noMatchesFound")}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={addQuickAsset}
                        disabled={!canQuickAdd}
                      >
                        {t("common.add")}
                      </Button>
                    </div>
                    {quickAssetClass === "stock" && quickAssetInput && (
                      <div className="text-xs text-muted-foreground">
                        {quickAssetInput.trim().length < 2
                          ? t("dashboard.universe.stocks.searchHint")
                          : quickStockLoading
                            ? t("dashboard.universe.stocks.searching")
                            : quickStockMatches.length > 0
                              ? t("dashboard.universe.stocks.matches", {
                                  count: quickStockMatches.length,
                                })
                              : t("dashboard.universe.stocks.noMatches")}
                      </div>
                    )}
                    {!canQuickAdd && normalizedQuickAsset ? (
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.universe.alreadyInUniverse")}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.universe.manageAssetsHint")}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {assetLabelMap.crypto}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleCrypto.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.universe.noCryptoYet")}
                        </span>
                      ) : (
                        visibleCrypto.map((symbol) => (
                          <Badge key={symbol} variant="secondary" className="font-mono">
                            {symbol}
                          </Badge>
                        ))
                      )}
                      {cryptoSelection.length > visibleCrypto.length && (
                        <Badge variant="outline">
                          +{cryptoSelection.length - visibleCrypto.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {assetLabelMap.stock}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleStocks.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.universe.noStocksYet")}
                        </span>
                      ) : (
                        visibleStocks.map((symbol) => (
                          <Badge key={symbol} variant="secondary" className="font-mono">
                            {symbol}
                          </Badge>
                        ))
                      )}
                      {stockSelection.length > visibleStocks.length && (
                        <Badge variant="outline">
                          +{stockSelection.length - visibleStocks.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {assetLabelMap.forex}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleForex.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.universe.noFxYet")}
                        </span>
                      ) : (
                        visibleForex.map((symbol) => (
                          <Badge key={symbol} variant="secondary" className="font-mono">
                            {symbol}
                          </Badge>
                        ))
                      )}
                      {forexSelection.length > visibleForex.length && (
                        <Badge variant="outline">
                          +{forexSelection.length - visibleForex.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setUniverseOpen(true)}>
                    {t("dashboard.universe.addOrEditAssets")}
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.universe.addFromHotTradesHint")}
                  </div>
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "210ms" } as CSSProperties}>
                <CardHeader>
                  <CardTitle className="text-base">{t("dashboard.quickActions.title")}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.quickActions.subtitle")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.quickActions.offlineBots")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">{offlineBots.length}</div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={startOfflineBots}
                    disabled={!firebaseEnabled || startingBots || replayActive}
                    title={replayActive ? t("replay.actionsDisabled") : undefined}
                  >
                    {startingBots
                      ? t("dashboard.actions.startingBots")
                      : t("dashboard.actions.startOfflineBots")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
                <CardHeader>
                  <CardTitle className="text-base">{t("dashboard.signalSnapshot.title")}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.signalSnapshot.subtitle")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.signalSnapshot.tracked")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">{signals.length}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.signalSnapshot.hint")}
                  </div>
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "260ms" } as CSSProperties}>
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t("dashboard.performance.title")}</CardTitle>
                    {signalPerformance?.updatedAt && (
                      <Badge variant="outline">
                        {t("tradeNow.updatedAt", {
                          time: formatRelativeTimestamp(signalPerformance.updatedAt),
                        })}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.performance.subtitle")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Tabs defaultValue="1h" className="space-y-3">
                    <TabsList className="grid w-full grid-cols-3">
                      {DIP_HORIZON_OPTIONS.map((option) => (
                        <TabsTrigger key={option} value={option}>
                          {option}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {DIP_HORIZON_OPTIONS.map((option) => (
                      <TabsContent key={`perf-${option}`} value={option}>
                        {renderPerformancePanel(option)}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="reveal" style={{ "--delay": "0ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-sm">{t("status.online")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-3xl font-semibold">{statusCounts.online}</div>
                <StatusBadge status="online" />
              </CardContent>
            </Card>
            <Card className="reveal" style={{ "--delay": "90ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-sm">{t("status.error")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-3xl font-semibold">{statusCounts.error}</div>
                <StatusBadge status="error" />
              </CardContent>
            </Card>
            <Card className="reveal" style={{ "--delay": "180ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-sm">{t("dashboard.statusCards.offlineIdle")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-3xl font-semibold">
                  {statusCounts.offline + statusCounts.idle + statusCounts.unknown}
                </div>
                <StatusBadge status="offline" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="reveal" style={{ "--delay": "220ms" } as CSSProperties}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{t("dashboard.events.title")}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {t("dashboard.events.subtitle")}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!firebaseEnabled ? (
                  <div className="text-sm opacity-70">
                    {t("dashboard.events.firebaseHintPrefix")} <code>.env</code>{" "}
                    {t("dashboard.events.firebaseHintSuffix")}
                  </div>
                ) : loadingEvents ? (
                  <div className="text-sm opacity-70">{t("dashboard.events.loading")}</div>
                ) : events.length === 0 ? (
                  <div className="text-sm opacity-70">
                    {t("dashboard.events.emptyPrefix")} <code>bots/{'{botId}'}/events</code>
                    {t("dashboard.events.emptySuffix")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div key={event.id} className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/70 p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-mono">{event.botId}</span>
                          <span>{formatTimestamp(event.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.severity && (
                            <Badge variant="secondary" className="capitalize">
                              {event.severity}
                            </Badge>
                          )}
                          <div className="text-sm font-medium">
                            {event.type || t("dashboard.events.eventFallback")}
                          </div>
                        </div>
                        <div className="text-sm break-words opacity-80">
                          {event.message || t("dashboard.events.messageFallback")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="reveal" style={{ "--delay": "260ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.botMatrix.title")}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.botMatrix.subtitle")}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!firebaseEnabled ? (
                  <div className="text-sm opacity-70">{t("dashboard.botMatrix.firebaseHint")}</div>
                ) : loadingBots ? (
                  <div className="text-sm opacity-70">{t("bots.loading")}</div>
                ) : bots.length === 0 ? (
                  <div className="text-sm opacity-70">{t("dashboard.botMatrix.empty")}</div>
                ) : (
                  bots.slice(0, 6).map((bot) => (
                    <div key={bot.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{bot.name || bot.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {bot.engine || t("bots.unknownEngine")}
                        </div>
                      </div>
                      <StatusBadge status={bot.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="reveal" style={{ "--delay": "300ms" } as CSSProperties}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{t("dashboard.signalRadar.title")}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.signalRadar.subtitle")}
                </div>
              </div>
              <Badge variant="outline">{signals.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {!firebaseEnabled ? (
                <div className="text-sm opacity-70">{t("tradeNow.connectFirebase")}</div>
              ) : loadingSignals ? (
                <div className="text-sm opacity-70">{t("signals.loading")}</div>
              ) : signals.length === 0 ? (
                <div className="text-sm opacity-70">
                  {t("signals.emptyPrefix")} <code>bots/{'{botId}'}/signals</code>
                  {t("signals.emptySuffix")}
                </div>
              ) : (
                signals.map((signal) => (
                  <div key={signal.id} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{signal.botId}</span>
                      <span>{formatTimestamp(signal.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {signal.side && (
                        <Badge variant={signalBadgeVariant(signal.side)} className="uppercase">
                          {t(`trade.side.${signal.side}`)}
                        </Badge>
                      )}
                      {typeof signal.strength === "number" && (
                        <Badge variant="secondary">
                          {t("signals.strength", { value: signal.strength.toFixed(2) })}
                        </Badge>
                      )}
                      <div className="text-sm break-words font-medium">
                        {signal.message || t("signals.detected")}
                      </div>
                    </div>
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
  )
}
