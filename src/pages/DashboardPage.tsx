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
import { formatRelativeTimestamp, formatTimestamp } from "@/lib/format"
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
import { X, BarChart3, InfoIcon } from "lucide-react"
import { AssetChartModal } from "@/components/charts/AssetChartModal"
import { usePaperAutomation } from "@/features/paper/use-paper-monitor"

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
  news: 10,
}
const RISK_OPTIONS: { value: RiskProfile; label: string }[] = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" },
]
const ASSET_FOCUS_OPTIONS: { value: AssetClass; label: string }[] = [
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stocks" },
  { value: "forex", label: "FX" },
]
const DEFAULT_UNIVERSE_MODE: MarketUniverseMode = "movers_plus_universe"
const UNIVERSE_MODE_OPTIONS: { value: MarketUniverseMode; label: string }[] = [
  { value: "movers_plus_universe", label: "Movers + universe" },
  { value: "weighted_union", label: "Movers + universe (boosted)" },
  { value: "movers_only", label: "Movers only" },
  { value: "universe_only", label: "Universe only" },
  { value: "movers_filtered_by_universe", label: "Movers filtered by universe" },
]
const UNIVERSE_MODE_SET = new Set(UNIVERSE_MODE_OPTIONS.map((option) => option.value))
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
  const { prices, livePrices } = useMarketPrices()

  const [bots, setBots] = useState<BotDoc[]>([])
  const [events, setEvents] = useState<BotEventDoc[]>([])
  const [signals, setSignals] = useState<BotSignalDoc[]>([])
  const [hotTrades, setHotTrades] = useState<MarketHotTrade[]>([])
  const [hotTradesUpdatedAt, setHotTradesUpdatedAt] = useState<MarketHotTradesDoc["updatedAt"]>()
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
  const [botWeightFreqtrade, setBotWeightFreqtrade] = useState(1)
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
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [loadingPerformance, setLoadingPerformance] = useState(true)
  const [startingBots, setStartingBots] = useState(false)
  const [refreshingJobs, setRefreshingJobs] = useState(false)

  const refreshEndpoint = useMemo(() => {
    const base = (import.meta.env.VITE_REFRESH_URL || "").trim()
    if (!base) return ""
    return `${base.replace(/\/+$/, "")}/refresh`
  }, [])

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
        setDipHorizon("24h")
        setTrendHorizon("15m")
        setTrendMomentumWeight(DEFAULT_TREND_WEIGHTS.momentum)
        setTrendVolumeWeight(DEFAULT_TREND_WEIGHTS.volume)
        setTrendSignalsWeight(DEFAULT_TREND_WEIGHTS.signals)
        setTrendNewsWeight(DEFAULT_TREND_WEIGHTS.news)
        setBotWeightFreqtrade(1)
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
      const freqtradeWeight =
        typeof botWeights["engine:freqtrade"] === "number"
          ? botWeights["engine:freqtrade"]
          : typeof botWeights.freqtrade === "number"
            ? botWeights.freqtrade
            : 1
      const backtraderWeight =
        typeof botWeights["engine:backtrader"] === "number"
          ? botWeights["engine:backtrader"]
          : typeof botWeights.backtrader === "number"
            ? botWeights.backtrader
            : 1
      setBotWeightFreqtrade(clampBotWeight(freqtradeWeight))
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
      const nextRisk = RISK_OPTIONS.some((option) => option.value === data.riskProfile)
        ? (data.riskProfile as RiskProfile)
        : "balanced"
      setRiskProfile(nextRisk)
      const focus = Array.isArray(data.assetFocus)
        ? data.assetFocus.filter((item): item is AssetClass =>
          ASSET_FOCUS_OPTIONS.some((option) => option.value === item)
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

    const ref = doc(db, "market", "hotTrades")
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
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingTrending(false)
      return
    }

    const ref = doc(db, "market", "trending")
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
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }

    const ref = doc(db, "market", "popular")
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setPopular(null)
        return
      }
      const data = snap.data() as MarketPopularDoc
      setPopular(data)
    })
  }, [])

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
      assetFocus.includes(option.value)
    ).map((option) => option.label)
    return labels.length > 0 ? labels.join(" + ") : "All"
  }, [assetFocus])

  const offlineBots = useMemo(
    () =>
      bots.filter((bot) => {
        const status = bot.status ?? "unknown"
        return ["offline", "error", "idle", "unknown"].includes(status)
      }),
    [bots]
  )

  async function startOfflineBots() {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }
    const activeDb = db
    if (offlineBots.length === 0) {
      toast.message("All bots are already running")
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
            requestedBy: user?.email ?? "unknown",
          })
        )
      )
      toast.success(`Queued start for ${offlineBots.length} bots`)
    } catch {
      toast.error("Failed to start bots")
    } finally {
      setStartingBots(false)
    }
  }

  async function triggerRefresh() {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }
    if (!refreshEndpoint) {
      toast.error("Refresh service not configured")
      return
    }
    if (!user) {
      toast.error("You must be signed in")
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
        throw new Error(payload?.error || `Refresh failed (${response.status})`)
      }
      const jobNames = Array.isArray(payload?.jobs)
        ? payload.jobs.map((job: { job?: string }) => job.job).filter(Boolean)
        : []
      toast.success(
        jobNames.length > 0
          ? `Refresh started: ${jobNames.join(", ")}`
          : "Refresh started"
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed")
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
    if (value === undefined || value === null) return "—"
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  function formatSentiment(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return "—"
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}`
  }

  function formatPercent(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return "—"
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
          <div className="text-sm opacity-70">Connect Firebase to load accuracy data.</div>
        ) : loadingPerformance ? (
          <div className="text-sm opacity-70">Loading performance...</div>
        ) : !stats ? (
          <div className="text-sm opacity-70">
            {signalPerformance?.overall &&
              Object.keys(signalPerformance.overall).length > 0
              ? "Only shorter horizons have results. 24h/7d appear once signals age."
              : "No evaluations yet. Run the signal evaluator worker to populate accuracy data."}
          </div>
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
                Best performing bots
              </div>
              {topBots.length === 0 ? (
                <div className="text-sm opacity-70">
                  Not enough scored signals yet to rank bots.
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
                        <span>{bot.count} signals</span>
                        <span>{bot.hitRate.toFixed(1)}% hit</span>
                        <span>{formatPercent(bot.avgReturn)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

            <div className="grid gap-3 sm:grid-cols-2">
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
      ...(popular?.items ?? []),
      ...trendingItems,
      ...performanceItems,
    ],
    [hotTrades, popular?.items, trendingItems, performanceItems]
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

  // Monitor paper positions for stop loss / take profit
  usePaperAutomation(user?.uid, hotTrades)


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
      toast.error("Firebase not configured")
      return
    }

    const activeDb = db
    setPreferencesSaving(true)
    try {
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
        dipHorizon,
        trendHorizon,
        trendWeights: {
          momentum: trendMomentumWeight,
          liquidity: trendVolumeWeight,
          consensus: trendSignalsWeight,
          volume: trendVolumeWeight,
          signals: trendSignalsWeight,
          news: trendNewsWeight,
        },
        botWeights: {
          "engine:freqtrade": clampBotWeight(botWeightFreqtrade),
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
      toast.success("Preferences saved")
      setUniverseOpen(false)
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setPreferencesSaving(false)
    }
  }

  async function addTradeToUniverse(trade: { assetClass: AssetClass; symbol?: string | null }) {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
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
      toast.success("Added to universe")
    } catch {
      setUniverse(prevUniverse)
      setCryptoSelection(prevCrypto)
      setStockSelection(prevStocks)
      setForexSelection(prevForex)
      toast.error("Failed to update universe")
    }
  }

  async function addTradeToPrimary(trade: MarketHotTrade) {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
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
      toast.success("Added to primary picks")
    } catch {
      setUniverse(prevUniverse)
      setCryptoSelection(prevCrypto)
      setStockSelection(prevStocks)
      setForexSelection(prevForex)
      setPrimaryCryptoSelection(prevPrimaryCrypto)
      setPrimaryStockSelection(prevPrimaryStocks)
      setPrimaryForexSelection(prevPrimaryForex)
      toast.error("Failed to update primary picks")
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
            Market Radar
          </div>
          <div className="text-2xl font-semibold">Trade Opportunities</div>
          <div className="text-sm text-muted-foreground">
            Spot high-probability dips and momentum shifts across your universe.
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <MarketStatusBadge assetClass="crypto" />
            <MarketStatusBadge assetClass="stock" />
            <MarketStatusBadge assetClass="forex" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setUniverseOpen(true)}>
            Manage assets
          </Button>
          <Button
            variant="secondary"
            onClick={triggerRefresh}
            disabled={!firebaseEnabled || refreshingJobs || !refreshEndpoint}
            title={refreshEndpoint ? "Run market jobs now" : "Set VITE_REFRESH_URL to enable"}
          >
            {refreshingJobs ? "Refreshing..." : "Refresh now"}
          </Button>
          <Button
            variant="outline"
            onClick={startOfflineBots}
            disabled={!firebaseEnabled || startingBots}
          >
            {startingBots ? "Starting bots..." : "Start offline bots"}
          </Button>
          <Badge variant="outline">{totalBots} bots tracked</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-xs">
        <Badge variant="outline">Horizon {dipHorizon}</Badge>
        <Badge variant="outline">Risk {riskProfile}</Badge>
        <Badge variant="outline">Focus {assetFocusLabel}</Badge>
      </div>



      <Dialog open={universeOpen} onOpenChange={setUniverseOpen}>
        <DialogContent className="w-[min(96vw,1100px)] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Asset Universe</DialogTitle>
            <DialogDescription>
              Pick assets to track. Use popular lists, trending picks, or search to add.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <Tabs defaultValue="dip" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dip">Dip & AI</TabsTrigger>
                <TabsTrigger value="universe">Universe</TabsTrigger>
                <TabsTrigger value="primary">Primary</TabsTrigger>
              </TabsList>

              <TabsContent value="dip" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">AI cadence</div>
                        <div className="text-xs text-muted-foreground">
                          LLM summaries refresh on this schedule.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={llmEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setLlmEnabled((prev) => !prev)}
                        aria-pressed={llmEnabled}
                      >
                        {llmEnabled ? "LLM on" : "LLM off"}
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>LLM interval</Label>
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
                        <div className="text-sm font-medium">News cadence</div>
                        <div className="text-xs text-muted-foreground">
                          Marketaux headlines refresh on this schedule.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={newsEnabled ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setNewsEnabled((prev) => !prev)}
                        aria-pressed={newsEnabled}
                      >
                        {newsEnabled ? "News on" : "News off"}
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>News interval</Label>
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

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="text-sm font-medium">Dip tuning</div>
                    <div className="text-xs text-muted-foreground">
                      Adjust the dip horizon, risk filter, and asset focus.
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Dip horizon</Label>
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
                        <Label>Risk profile</Label>
                        <div className="flex flex-wrap gap-2">
                          {RISK_OPTIONS.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              variant={riskProfile === option.value ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => setRiskProfile(option.value)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Asset focus</Label>
                      <div className="flex flex-wrap gap-2">
                        {ASSET_FOCUS_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={assetFocus.includes(option.value) ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleAssetFocus(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 md:col-span-2">
                    <div className="text-sm font-medium">Score weighting</div>
                    <div className="text-xs text-muted-foreground">
                      Tune the mix used across hot trades and trending lists.
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Trend horizon</Label>
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
                        <Label>Weights (0-100)</Label>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Momentum</Label>
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
                            <Label className="text-xs text-muted-foreground">Liquidity</Label>
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
                            <Label className="text-xs text-muted-foreground">Bot consensus</Label>
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
                            <Label className="text-xs text-muted-foreground">News</Label>
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
                          Total weight{" "}
                          {trendMomentumWeight +
                            trendVolumeWeight +
                            trendSignalsWeight +
                            trendNewsWeight}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Bot weights (0-5)</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Freqtrade</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={BOT_WEIGHT_MIN}
                            max={BOT_WEIGHT_MAX}
                            step={0.1}
                            value={botWeightFreqtrade}
                            onChange={(event) => {
                              const next = Number(event.target.value)
                              if (Number.isFinite(next)) {
                                setBotWeightFreqtrade(clampBotWeight(next))
                              }
                            }}
                          />
                          <input
                            type="range"
                            min={BOT_WEIGHT_MIN}
                            max={BOT_WEIGHT_MAX}
                            step={0.1}
                            value={botWeightFreqtrade}
                            onChange={(event) => {
                              const next = Number(event.target.value)
                              if (Number.isFinite(next)) {
                                setBotWeightFreqtrade(clampBotWeight(next))
                              }
                            }}
                            className="h-2 w-full cursor-pointer accent-[hsl(var(--primary))]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Backtrader</Label>
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
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Weights multiply signal influence per engine.
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Auto-tune weights</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={autoTuneEnabled ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setAutoTuneEnabled((prev) => !prev)}
                          aria-pressed={autoTuneEnabled}
                        >
                          {autoTuneEnabled ? "Auto-tune on" : "Auto-tune off"}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Adjusts weights from recent accuracy with optional AI nudging.
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
                          {autoTuneWithAI ? "AI assist on" : "AI assist off"}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Keeps changes small and logged.
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
                          Last tuned {formatRelativeTimestamp(autoTuneLastAt)}.
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
                  Add assets from the curated lists or search by symbol. Use Add to save picks.
                </div>
                <Tabs defaultValue="crypto" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="crypto">Crypto</TabsTrigger>
                    <TabsTrigger value="stocks">Stocks</TabsTrigger>
                    <TabsTrigger value="fx">FX</TabsTrigger>
                  </TabsList>

                  <TabsContent value="crypto" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">Crypto pairs</div>
                        <div className="text-xs text-muted-foreground">
                          Track the pairs you want to scan.
                        </div>
                      </div>
                      <Select
                        value={cryptoMode}
                        onChange={(event) =>
                          setCryptoMode(resolveUniverseMode(event.target.value))
                        }
                        className="w-[220px]"
                        aria-label="Crypto universe mode"
                      >
                        {UNIVERSE_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
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
                          Trending now
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
                            Add custom pair
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
                              placeholder="Search or add (e.g. BTC/USDT)"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addCustomCrypto}
                              disabled={!canAddCrypto}
                            >
                              Add
                            </Button>
                            {cryptoSearch && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setCryptoSearch("")}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          {canAddCrypto && (
                            <div className="text-xs text-muted-foreground">
                              Add {normalizedCryptoSearch} to your universe.
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {cryptoSearch ? "Search results" : "More picks"}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {filteredCryptoOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No matches</span>
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
                          Your picks
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cryptoSelection.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              No pairs selected yet.
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
                        <div className="text-sm font-medium">Stock tickers</div>
                        <div className="text-xs text-muted-foreground">
                          Focus on the equities you want covered.
                        </div>
                      </div>
                      <Select
                        value={stockMode}
                        onChange={(event) =>
                          setStockMode(resolveUniverseMode(event.target.value))
                        }
                        className="w-[220px]"
                        aria-label="Stock universe mode"
                      >
                        {UNIVERSE_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
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
                          Trending now
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
                            Add custom ticker
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
                              placeholder="Search or add (e.g. AAPL)"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addCustomStock}
                              disabled={!canAddStock}
                            >
                              Add
                            </Button>
                            {stockSearch && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setStockSearch("")}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          {canAddStock && (
                            <div className="text-xs text-muted-foreground">
                              Add {normalizedStockSearch} to your universe.
                            </div>
                          )}
                          {stockSearch && (
                            <div className="text-xs text-muted-foreground">
                              {stockSearch.length < 2
                                ? "Type 2+ letters to search the cached global ticker list."
                                : stockSymbolLoading
                                  ? "Searching cached global tickers..."
                                  : stockSymbolMatches.length > 0
                                    ? `Showing ${stockSymbolMatches.length} cached matches.`
                                    : "No cached matches found."}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {stockSearch ? "Search results" : "More picks"}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {filteredStockOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No matches</span>
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
                          Your picks
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {stockSelection.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              No tickers selected yet.
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
                      Keep the stock list focused to reduce gateway load.
                    </div>
                  </TabsContent>

                  <TabsContent value="fx" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">FX pairs</div>
                        <div className="text-xs text-muted-foreground">
                          Select the currency pairs you trade.
                        </div>
                      </div>
                      <Select
                        value={forexMode}
                        onChange={(event) =>
                          setForexMode(resolveUniverseMode(event.target.value))
                        }
                        className="w-[220px]"
                        aria-label="FX universe mode"
                      >
                        {UNIVERSE_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
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
                          Trending now
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
                            Add custom pair
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
                              placeholder="Search or add (e.g. EUR/USD)"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addCustomForex}
                              disabled={!canAddForex}
                            >
                              Add
                            </Button>
                            {forexSearch && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setForexSearch("")}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          {canAddForex && (
                            <div className="text-xs text-muted-foreground">
                              Add {normalizedForexSearch} to your universe.
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {forexSearch ? "Search results" : "More picks"}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {filteredForexOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No matches</span>
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
                          Your picks
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {forexSelection.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              No pairs selected yet.
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
                  <div className="text-sm font-medium">Primary picks</div>
                  <div className="text-xs text-muted-foreground">
                    These assets get extra weight in dip scoring and summaries.
                  </div>
                </div>
                <Tabs defaultValue="crypto" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="crypto">Crypto</TabsTrigger>
                    <TabsTrigger value="stocks">Stocks</TabsTrigger>
                    <TabsTrigger value="fx">FX</TabsTrigger>
                  </TabsList>

                  <TabsContent value="crypto" className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">Primary crypto picks</div>
                        <span className="text-xs text-muted-foreground">
                          {primaryCryptoSelection.length} selected
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Your picks
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryCryptoSelection.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Pick your top crypto focus assets.
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
                            Suggested
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryCryptoOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                No popular picks available yet.
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
                        <div className="text-sm font-medium">Primary stock picks</div>
                        <span className="text-xs text-muted-foreground">
                          {primaryStockSelection.length} selected
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Your picks
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryStockSelection.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Choose your top tickers.
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
                            Suggested
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryStockOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                No popular picks available yet.
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
                        <div className="text-sm font-medium">Primary FX picks</div>
                        <span className="text-xs text-muted-foreground">
                          {primaryForexSelection.length} selected
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Your picks
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryForexSelection.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Select your top FX pairs.
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
                            Suggested
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {primaryForexOptions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                No popular picks available yet.
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
              Cancel
            </Button>
            <Button onClick={savePreferences} disabled={preferencesSaving}>
              {preferencesSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="opportunities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="reveal" style={{ "--delay": "140ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Dip Radar</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        Horizon {dipHorizon} • {riskProfile} risk • {assetFocusLabel}
                      </div>
                    </div>
                    <Badge variant="outline">{displayDipIdeas.length} picks</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        Connect Firebase to load market intel.
                      </div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">Scanning for dips...</div>
                    ) : displayDipIdeas.length === 0 ? (
                      <div className="text-sm opacity-70">
                        No dip opportunities yet. Adjust horizon or risk to widen the scan.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dipDisplayMode === "closest" && (
                          <div className="text-xs text-muted-foreground">
                            No strict dips found. Showing the closest opportunities to your
                            horizon.
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
                                    {trade.assetClass}
                                  </Badge>
                                  {isPrimaryTrade(trade) && (
                                    <Badge variant="secondary">Primary</Badge>
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
                                      title="Score breakdown"
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
                                      title="View Chart"
                                    >
                                      <BarChart3 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground">
                                    {(() => {
                                      const current = prices[trade.symbol] || trade.price
                                      return current ? (current < 1 ? current.toFixed(4) : current.toFixed(2)) : "--"
                                    })()}
                                  </span>
                                  {livePrices[trade.symbol] && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live price"></span>
                                  )}
                                  <span>·</span>
                                  {trade.name || trade.assetClass} · {dipHorizon} move:{" "}
                                  {horizonChange === null ? "--" : formatChange(horizonChange)}
                                </div>
                                {trade.rationale && (
                                  <div className="text-xs text-muted-foreground">
                                    {trade.rationale}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={scoreTone(trade.score)}>
                                  Score {trade.score?.toFixed(1) ?? "--"}
                                </Badge>
                                <Badge variant="outline">
                                  {trade.signals?.total ? `${trade.signals.total} signals` : "No signals"}
                                </Badge>
                                {!isPrimaryTrade(trade) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addTradeToPrimary(trade)}
                                    disabled={!firebaseEnabled}
                                  >
                                    Mark primary
                                  </Button>
                                )}
                                {!isWatchlisted(trade) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addTradeToUniverse(trade)}
                                    disabled={!firebaseEnabled}
                                  >
                                    Add to universe
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
                      <CardTitle className="text-base">Hot Trades</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        Consensus + momentum + bot strength
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hotTradesUpdatedAt && (
                        <Badge variant="outline">
                          Updated {formatRelativeTimestamp(hotTradesUpdatedAt)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        Connect Firebase to load market intel.
                      </div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">Loading hot trades...</div>
                    ) : focusedHotTrades.length === 0 ? (
                      <div className="text-sm opacity-70">
                        No hot trades yet. Deploy the market intel worker to populate this feed.
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
                                  {trade.assetClass}
                                </Badge>
                                {trade.side && (
                                  <Badge
                                    variant={signalBadgeVariant(trade.side)}
                                    className="uppercase"
                                  >
                                    {trade.side}
                                  </Badge>
                                )}
                                {isWatchlisted(trade) && (
                                  <Badge variant="secondary">Watchlist</Badge>
                                )}
                                {isPrimaryTrade(trade) && (
                                  <Badge variant="secondary">Primary</Badge>
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
                                    title="Score breakdown"
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
                                    title="View Chart"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground">
                                  {(() => {
                                    const current = prices[trade.symbol] || trade.price
                                    return current ? (current < 1 ? current.toFixed(4) : current.toFixed(2)) : "--"
                                  })()}
                                </span>
                                {livePrices[trade.symbol] && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live price"></span>
                                )}
                                <span>·</span>
                                {trade.name || trade.assetClass} · 24h:{" "}
                                {formatChange(trade.momentum?.change24h)}
                                {trade.exchange ? ` · ${trade.exchange}` : ""}
                              </div>
                              {trade.rationale && (
                                <div className="text-xs text-muted-foreground">
                                  {trade.rationale}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={scoreTone(trade.score)}>
                                Score {trade.score?.toFixed(1) ?? "--"}
                              </Badge>
                              <Badge variant="outline">
                                {trade.signals?.total ? `${trade.signals.total} signals` : "No signals"}
                              </Badge>
                              {!isWatchlisted(trade) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addTradeToUniverse(trade)}
                                  disabled={!firebaseEnabled}
                                >
                                  Add to universe
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal lg:col-span-2" style={{ "--delay": "210ms" } as CSSProperties}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Trending Now</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        Weighted momentum, liquidity, and bot consensus.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {trendingUpdatedAt && (
                        <Badge variant="outline">
                          Updated {formatRelativeTimestamp(trendingUpdatedAt)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">
                        Connect Firebase to load trending data.
                      </div>
                    ) : loadingTrending ? (
                      <div className="text-sm opacity-70">Loading trending list...</div>
                    ) : !trending ? (
                      <div className="text-sm opacity-70">
                        No trending data yet. Deploy the market intel worker to populate this feed.
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
                            Weights: M{trendWeightsDisplay.momentum} · L{trendWeightsDisplay.liquidity} · C{trendWeightsDisplay.consensus} · N{trendWeightsDisplay.news}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ASSET_FOCUS_OPTIONS.map((option) => (
                            <Button
                              key={`trend-focus-${option.value}`}
                              type="button"
                              size="sm"
                              variant={trendAssetFocus.includes(option.value) ? "secondary" : "outline"}
                              onClick={() => toggleTrendFocus(option.value)}
                            >
                              {option.label}
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
                            const label =
                              assetClass === "crypto"
                                ? "Crypto"
                                : assetClass === "stock"
                                  ? "Stocks"
                                  : "FX"
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
                                    No picks yet.
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
                                      { key: "momentum", label: "Momentum", value: scoreComponents?.momentum },
                                      { key: "liquidity", label: "Liquidity", value: liquidityValue },
                                      { key: "consensus", label: "Consensus", value: consensusValue },
                                    ]
                                    if (scoreComponents?.universe) {
                                      metrics.push({
                                        key: "universe",
                                        label: "Universe",
                                        value: scoreComponents?.universe,
                                      })
                                    }
                                    if (showNewsMetric) {
                                      metrics.push({
                                        key: "news",
                                        label: "News",
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
                                                title="Score breakdown"
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
                                                title="View Chart"
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
                                                  const current = prices[item.symbol] || item.price
                                                  return current ? (current < 1 ? current.toFixed(4) : current.toFixed(2)) : "--"
                                                })()}
                                                {livePrices[item.symbol] && (
                                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live price"></span>
                                                )}
                                              </div>
                                            </div>
                                            {item.signals?.total ? (
                                              <div className="mt-2 text-[11px] text-muted-foreground">
                                                {item.signals.total} signals · {item.signals.buy ?? 0} buy / {item.signals.sell ?? 0} sell
                                              </div>
                                            ) : null}
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <Badge variant="outline" className={scoreTone(item.score)}>
                                              {item.score?.toFixed(1) ?? "--"}
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
                                                Add
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
                                              value === null ? "--" : Math.round(value).toString()
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
                                            {item.news?.count} headlines · sentiment{" "}
                                            {formatSentiment(item.news?.sentiment)}
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
                    <CardTitle className="text-sm">Top Buys</CardTitle>
                    <div className="text-xs text-muted-foreground">Highest confidence longs</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">Connect Firebase to view signals.</div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">Loading ideas...</div>
                    ) : buyIdeas.length === 0 ? (
                      <div className="text-sm opacity-70">No buy ideas yet.</div>
                    ) : (
                      buyIdeas.map((trade) => (
                        <div key={`buy-${trade.symbol}`} className="group flex items-center justify-between">
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
                                title="Score breakdown"
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
                                title="View Chart"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                              <PaperTradeButton trade={trade} size="icon" className="h-5 w-5 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {(() => {
                                const current = prices[trade.symbol] || trade.price
                                return current ? (current < 1 ? current.toFixed(4) : current.toFixed(2)) : "--"
                              })()}
                              {livePrices[trade.symbol] && (
                                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" title="Live price"></span>
                              )}
                              <span>·</span>
                              24h: {formatChange(trade.momentum?.change24h)}
                            </div>
                          </div>
                          <Badge variant="outline" className={scoreTone(trade.score)}>
                            {trade.score?.toFixed(0) ?? "--"}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="reveal" style={{ "--delay": "270ms" } as CSSProperties}>
                  <CardHeader>
                    <CardTitle className="text-sm">Top Sells</CardTitle>
                    <div className="text-xs text-muted-foreground">Risk-off or take profit</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!firebaseEnabled ? (
                      <div className="text-sm opacity-70">Connect Firebase to view signals.</div>
                    ) : loadingHotTrades ? (
                      <div className="text-sm opacity-70">Loading ideas...</div>
                    ) : sellIdeas.length === 0 ? (
                      <div className="text-sm opacity-70">No sell ideas yet.</div>
                    ) : (
                      sellIdeas.map((trade) => (
                        <div
                          key={`sell-${trade.symbol}`}
                          className="group flex items-center justify-between"
                        >
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
                                title="Score breakdown"
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
                                title="View Chart"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                              <PaperTradeButton trade={trade} size="icon" className="h-5 w-5 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {(() => {
                                const current = prices[trade.symbol] || trade.price
                                return current ? (current < 1 ? current.toFixed(4) : current.toFixed(2)) : "--"
                              })()}
                              {livePrices[trade.symbol] && (
                                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" title="Live price"></span>
                              )}
                              <span>·</span>
                              24h: {formatChange(trade.momentum?.change24h)}
                            </div>
                          </div>
                          <Badge variant="outline" className={scoreTone(trade.score)}>
                            {trade.score?.toFixed(0) ?? "--"}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <Card className="reveal" style={{ "--delay": "200ms" } as CSSProperties}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Your Universe</CardTitle>
                  <Badge variant="outline">{universeTotal} assets</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Quick add
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        className="w-auto min-w-[140px]"
                        value={quickAssetClass}
                        onChange={(event) =>
                          setQuickAssetClass(event.target.value as AssetClass)
                        }
                      >
                        <option value="crypto">Crypto</option>
                        <option value="stock">Stocks</option>
                        <option value="forex">FX</option>
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
                              ? "Search tickers (e.g. AAPL)"
                              : quickAssetClass === "forex"
                                ? "Search pairs (e.g. EUR/USD)"
                                : "Search pairs (e.g. BTC/USDT)"
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
                                    {quickAssetClass === "stock"
                                      ? "Stock"
                                      : quickAssetClass === "forex"
                                        ? "FX"
                                        : "Crypto"}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {quickAssetInput.trim().length > 0 && quickSuggestions.length === 0 && (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground shadow-lg">
                            No matches found.
                          </div>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={addQuickAsset}
                        disabled={!canQuickAdd}
                      >
                        Add
                      </Button>
                    </div>
                    {quickAssetClass === "stock" && quickAssetInput && (
                      <div className="text-xs text-muted-foreground">
                        {quickAssetInput.trim().length < 2
                          ? "Type 2+ letters to search the cached global ticker list."
                          : quickStockLoading
                            ? "Searching cached global tickers..."
                            : quickStockMatches.length > 0
                              ? `Showing ${quickStockMatches.length} cached matches.`
                              : "No cached matches found."}
                      </div>
                    )}
                    {!canQuickAdd && normalizedQuickAsset ? (
                      <div className="text-xs text-muted-foreground">
                        Already in your universe.
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Use Manage assets for bulk edits and trending picks.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Crypto
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleCrypto.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No crypto pairs yet.</span>
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
                      Stocks
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleStocks.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No stock tickers yet.</span>
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
                      FX
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleForex.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No FX pairs yet.</span>
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
                    Add or edit assets
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Use Manage assets or tap Add to universe from Hot Trades.
                  </div>
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "210ms" } as CSSProperties}>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Keep the fleet healthy with one click.
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Offline / idle bots</div>
                    <div className="mt-1 text-2xl font-semibold">{offlineBots.length}</div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={startOfflineBots}
                    disabled={!firebaseEnabled || startingBots}
                  >
                    {startingBots ? "Starting bots..." : "Start offline bots"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
                <CardHeader>
                  <CardTitle className="text-base">Signal Snapshot</CardTitle>
                  <div className="text-xs text-muted-foreground">Live feed size and freshness</div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Signals tracked</div>
                    <div className="mt-1 text-2xl font-semibold">{signals.length}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Open Advanced to view the full signal stream.
                  </div>
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "260ms" } as CSSProperties}>
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Prediction Accuracy</CardTitle>
                    {signalPerformance?.updatedAt && (
                      <Badge variant="outline">
                        Updated {formatRelativeTimestamp(signalPerformance.updatedAt)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Signals vs market outcomes by horizon.
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
                <CardTitle className="text-sm">Online</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-3xl font-semibold">{statusCounts.online}</div>
                <StatusBadge status="online" />
              </CardContent>
            </Card>
            <Card className="reveal" style={{ "--delay": "90ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-sm">Error</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <div className="text-3xl font-semibold">{statusCounts.error}</div>
                <StatusBadge status="error" />
              </CardContent>
            </Card>
            <Card className="reveal" style={{ "--delay": "180ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-sm">Offline / Idle</CardTitle>
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
                  <CardTitle className="text-base">Recent Event Stream</CardTitle>
                  <div className="text-xs text-muted-foreground">Normalized logs across every adapter</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!firebaseEnabled ? (
                  <div className="text-sm opacity-70">Configure Firebase in <code>.env</code> to view events.</div>
                ) : loadingEvents ? (
                  <div className="text-sm opacity-70">Loading events...</div>
                ) : events.length === 0 ? (
                  <div className="text-sm opacity-70">
                    No events yet. Adapters should write to <code>bots/{'{botId}'}/events</code>.
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
                            {event.type || "event"}
                          </div>
                        </div>
                        <div className="text-sm break-words opacity-80">
                          {event.message || "Adapter emitted an event without a message."}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="reveal" style={{ "--delay": "260ms" } as CSSProperties}>
              <CardHeader>
                <CardTitle className="text-base">Bot Matrix</CardTitle>
                <div className="text-xs text-muted-foreground">Current statuses pulled from bots collection</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!firebaseEnabled ? (
                  <div className="text-sm opacity-70">Connect Firebase to load bot metadata.</div>
                ) : loadingBots ? (
                  <div className="text-sm opacity-70">Loading bots...</div>
                ) : bots.length === 0 ? (
                  <div className="text-sm opacity-70">No bots registered yet.</div>
                ) : (
                  bots.slice(0, 6).map((bot) => (
                    <div key={bot.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{bot.name || bot.id}</div>
                        <div className="text-xs text-muted-foreground">{bot.engine || "unknown engine"}</div>
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
                <CardTitle className="text-base">Signal Radar</CardTitle>
                <div className="text-xs text-muted-foreground">Latest trade ideas from every engine</div>
              </div>
              <Badge variant="outline">{signals.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {!firebaseEnabled ? (
                <div className="text-sm opacity-70">Connect Firebase to view signals.</div>
              ) : loadingSignals ? (
                <div className="text-sm opacity-70">Loading signals...</div>
              ) : signals.length === 0 ? (
                <div className="text-sm opacity-70">
                  No signals yet. Adapters should write to <code>bots/{'{botId}'}/signals</code>.
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
                          {signal.side}
                        </Badge>
                      )}
                      {typeof signal.strength === "number" && (
                        <Badge variant="secondary">Strength {signal.strength.toFixed(2)}</Badge>
                      )}
                      <div className="text-sm break-words font-medium">
                        {signal.message || "Signal detected"}
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
