import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "firebase/firestore"
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
} from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatTimestamp } from "@/lib/format"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { X } from "lucide-react"

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
]

const LLM_INTERVAL_OPTIONS = [15, 30, 60, 120, 240]
const DIP_HORIZON_OPTIONS: DipHorizon[] = ["1h", "24h", "7d"]
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [bots, setBots] = useState<BotDoc[]>([])
  const [events, setEvents] = useState<BotEventDoc[]>([])
  const [signals, setSignals] = useState<BotSignalDoc[]>([])
  const [hotTrades, setHotTrades] = useState<MarketHotTrade[]>([])
  const [hotTradesUpdatedAt, setHotTradesUpdatedAt] = useState<MarketHotTradesDoc["updatedAt"]>()
  const [popular, setPopular] = useState<MarketPopularDoc | null>(null)
  const [universe, setUniverse] = useState<MarketUniverseDoc | null>(null)
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
  const [forexSearch, setForexSearch] = useState("")
  const [includeCryptoTrending, setIncludeCryptoTrending] = useState(true)
  const [includeStockTrending, setIncludeStockTrending] = useState(true)
  const [includeForexTrending, setIncludeForexTrending] = useState(true)
  const [llmIntervalMinutes, setLlmIntervalMinutes] = useState(30)
  const [llmEnabled, setLlmEnabled] = useState(true)
  const [dipHorizon, setDipHorizon] = useState<DipHorizon>("24h")
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced")
  const [assetFocus, setAssetFocus] = useState<AssetClass[]>([
    "crypto",
    "stock",
    "forex",
  ])
  const [loadingBots, setLoadingBots] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [loadingHotTrades, setLoadingHotTrades] = useState(true)
  const [startingBots, setStartingBots] = useState(false)

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
        setIncludeCryptoTrending(true)
        setIncludeStockTrending(true)
        setIncludeForexTrending(true)
        return
      }
      const data = snap.data() as MarketUniverseDoc
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
      setIncludeCryptoTrending(data.crypto?.includeTrending ?? true)
      setIncludeStockTrending(data.stocks?.includeTrending ?? true)
      setIncludeForexTrending(data.forex?.includeTrending ?? true)
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
        setDipHorizon("24h")
        setRiskProfile("balanced")
        setAssetFocus(["crypto", "stock", "forex"])
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
      const nextHorizon =
        data.dipHorizon && DIP_HORIZON_OPTIONS.includes(data.dipHorizon)
          ? data.dipHorizon
          : "24h"
      setDipHorizon(nextHorizon)
      const nextRisk = RISK_OPTIONS.some((option) => option.value === data.riskProfile)
        ? (data.riskProfile as RiskProfile)
        : "balanced"
      setRiskProfile(nextRisk)
      const focus = Array.isArray(data.assetFocus)
        ? data.assetFocus.filter((item): item is AssetClass =>
            ASSET_FOCUS_OPTIONS.some((option) => option.value === item)
          )
        : []
      setAssetFocus(focus.length > 0 ? focus : ["crypto", "stock", "forex"])
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

    const eventsQuery = query(
      collectionGroup(db, "events"),
      orderBy("createdAt", "desc"),
      limit(10)
    )

    return onSnapshot(eventsQuery, (snap) => {
      setEvents(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<BotEventDoc, "id" | "botId">
          const botId = doc.ref.parent.parent?.id ?? "unknown"
          return { id: doc.id, botId, ...data }
        })
      )
      setLoadingEvents(false)
    })
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoadingSignals(false)
      return
    }

    const signalsQuery = query(
      collectionGroup(db, "signals"),
      orderBy("createdAt", "desc"),
      limit(5)
    )

    return onSnapshot(signalsQuery, (snap) => {
      setSignals(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<BotSignalDoc, "id" | "botId">
          const botId = doc.ref.parent.parent?.id ?? "unknown"
          return { id: doc.id, botId, ...data }
        })
      )
      setLoadingSignals(false)
    })
  }, [])

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
    if (offlineBots.length === 0) {
      toast.message("All bots are already running")
      return
    }

    setStartingBots(true)
    try {
      await Promise.all(
        offlineBots.map((bot) =>
          addDoc(collection(db, "bots", bot.id, "commands"), {
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

  function normalizeSymbol(value: string) {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return ""
    if (trimmed.includes("/")) return trimmed.replace(/\s+/g, "")
    if (trimmed.includes("-")) return trimmed.replace(/\s+/g, "").replace(/-/g, "/")
    return trimmed.replace(/\s+/g, "")
  }

  function normalizeTicker(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "")
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
        stockSuggestions,
        stockSearch,
        stockSelection,
        normalizeTicker
      ),
    [stockSuggestions, stockSearch, stockSelection]
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

  const focusedHotTrades = useMemo(
    () => hotTrades.filter((trade) => assetFocusSet.has(trade.assetClass)),
    [hotTrades, assetFocusSet]
  )

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

  function isWatchlisted(trade: MarketHotTrade) {
    if (!trade.symbol) return false
    if (trade.assetClass === "stock") {
      return watchlistSets.stocks.has(normalizeTicker(trade.symbol))
    }
    if (trade.assetClass === "forex") {
      return watchlistSets.forex.has(normalizeSymbol(trade.symbol))
    }
    return watchlistSets.crypto.has(normalizeSymbol(trade.symbol))
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

    setPreferencesSaving(true)
    try {
      const payload: MarketUniverseDoc = {
        crypto: {
          includeTrending: includeCryptoTrending,
          symbols: uniqueList(cryptoSelection.map(normalizeSymbol).filter(Boolean)),
        },
        stocks: {
          includeTrending: includeStockTrending,
          symbols: uniqueList(stockSelection.map(normalizeTicker).filter(Boolean)),
        },
        forex: {
          includeTrending: includeForexTrending,
          pairs: uniqueList(forexSelection.map(normalizeSymbol).filter(Boolean)),
        },
        updatedAt: serverTimestamp(),
      }

      const controls = {
        llmIntervalMinutes,
        enableLLM: llmEnabled,
        dipHorizon,
        riskProfile,
        assetFocus: assetFocus.length > 0 ? assetFocus : ["crypto", "stock", "forex"],
        primaryAssets: {
          crypto: uniqueList(primaryCryptoSelection.map(normalizeSymbol).filter(Boolean)),
          stocks: uniqueList(primaryStockSelection.map(normalizeTicker).filter(Boolean)),
          forex: uniqueList(primaryForexSelection.map(normalizeSymbol).filter(Boolean)),
        },
        updatedAt: serverTimestamp(),
      }

      await Promise.all([
        setDoc(doc(db, "market", "universe"), payload, { merge: true }),
        setDoc(doc(db, "market", "controls"), controls, { merge: true }),
      ])
      toast.success("Preferences saved")
      setUniverseOpen(false)
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setPreferencesSaving(false)
    }
  }

  async function addTradeToUniverse(trade: MarketHotTrade) {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }
    if (!trade.symbol) return

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

    const payload: MarketUniverseDoc = {
      crypto: {
        includeTrending: includeCryptoTrending,
        symbols: Array.from(cryptoSymbols),
      },
      stocks: {
        includeTrending: includeStockTrending,
        symbols: Array.from(stockSymbols),
      },
      forex: {
        includeTrending: includeForexTrending,
        pairs: Array.from(forexPairs),
      },
      updatedAt: serverTimestamp(),
    }

    try {
      await setDoc(doc(db, "market", "universe"), payload, { merge: true })
      toast.success("Added to universe")
    } catch {
      toast.error("Failed to update universe")
    }
  }

  async function addTradeToPrimary(trade: MarketHotTrade) {
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }
    if (!trade.symbol) return

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

    const universePayload: MarketUniverseDoc = {
      crypto: {
        includeTrending: includeCryptoTrending,
        symbols: Array.from(cryptoSymbols),
      },
      stocks: {
        includeTrending: includeStockTrending,
        symbols: Array.from(stockSymbols),
      },
      forex: {
        includeTrending: includeForexTrending,
        pairs: Array.from(forexPairs),
      },
      updatedAt: serverTimestamp(),
    }

    const controlsPayload: MarketControlsDoc = {
      primaryAssets: {
        crypto: Array.from(primaryCrypto),
        stocks: Array.from(primaryStocks),
        forex: Array.from(primaryForex),
      },
      updatedAt: serverTimestamp(),
    }

    try {
      await Promise.all([
        setDoc(doc(db, "market", "universe"), universePayload, { merge: true }),
        setDoc(doc(db, "market", "controls"), controlsPayload, { merge: true }),
      ])
      toast.success("Added to primary picks")
    } catch {
      toast.error("Failed to update primary picks")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Dip Radar</div>
          <div className="text-2xl font-semibold">Opportunities</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Horizon {dipHorizon}</Badge>
          <Badge variant="outline">Risk {riskProfile}</Badge>
          <Badge variant="outline">Focus {assetFocusLabel}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setUniverseOpen(true)}>
          Tune preferences
        </Button>
      </div>

      <Dialog open={universeOpen} onOpenChange={setUniverseOpen}>
        <DialogContent className="w-[min(96vw,980px)] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Market Preferences</DialogTitle>
            <DialogDescription>
              Choose your universe and tune how often the AI refreshes.
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
                </div>
              </TabsContent>

              <TabsContent value="universe" className="space-y-4">
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
                      <Button
                        type="button"
                        variant={includeCryptoTrending ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setIncludeCryptoTrending((prev) => !prev)}
                        aria-pressed={includeCryptoTrending}
                      >
                        {includeCryptoTrending ? "Trending on" : "Trending off"}
                      </Button>
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={cryptoSearch}
                            onChange={(event) => setCryptoSearch(event.target.value)}
                            placeholder="Search crypto pairs"
                          />
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
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            More picks
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
                      <Button
                        type="button"
                        variant={includeStockTrending ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setIncludeStockTrending((prev) => !prev)}
                        aria-pressed={includeStockTrending}
                      >
                        {includeStockTrending ? "Trending on" : "Trending off"}
                      </Button>
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={stockSearch}
                            onChange={(event) => setStockSearch(event.target.value)}
                            placeholder="Search stock tickers"
                          />
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
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            More picks
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
                      Alpha Vantage free tier supports limited symbols per run.
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
                      <Button
                        type="button"
                        variant={includeForexTrending ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setIncludeForexTrending((prev) => !prev)}
                        aria-pressed={includeForexTrending}
                      >
                        {includeForexTrending ? "Trending on" : "Trending off"}
                      </Button>
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={forexSearch}
                            onChange={(event) => setForexSearch(event.target.value)}
                            placeholder="Search FX pairs"
                          />
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
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            More picks
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
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <Card className="reveal" style={{ "--delay": "140ms" } as CSSProperties}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Dip Radar</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Horizon {dipHorizon} • {riskProfile} risk • {assetFocusLabel}
                    </div>
                  </div>
                  <Badge variant="outline">{dipIdeas.length} picks</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!firebaseEnabled ? (
                    <div className="text-sm opacity-70">Connect Firebase to load market intel.</div>
                  ) : loadingHotTrades ? (
                    <div className="text-sm opacity-70">Scanning for dips...</div>
                  ) : dipIdeas.length === 0 ? (
                    <div className="text-sm opacity-70">
                      No dip opportunities yet. Adjust horizon or risk to widen the scan.
                    </div>
                  ) : (
                    dipIdeas.map((trade) => {
                      const horizonChange = getHorizonChange(trade, dipHorizon)
                      return (
                        <div
                          key={`dip-${trade.assetClass}-${trade.symbol}`}
                          className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.6)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{trade.symbol}</div>
                              <div className="text-xs text-muted-foreground">
                                {trade.name || trade.assetClass}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="uppercase">
                                {trade.assetClass}
                              </Badge>
                              <Badge variant="outline" className={scoreTone(trade.score)}>
                                Score {trade.score?.toFixed(1) ?? "—"}
                              </Badge>
                              {isPrimaryTrade(trade) && (
                                <Badge variant="secondary">Primary</Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {dipHorizon} move:{" "}
                              {horizonChange === null ? "—" : formatChange(horizonChange)}
                            </span>
                            {trade.signals?.total ? (
                              <span>{trade.signals.total} bot signals</span>
                            ) : (
                              <span>No bot signals yet</span>
                            )}
                          </div>
                          {trade.rationale && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              {trade.rationale}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
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
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="reveal" style={{ "--delay": "180ms" } as CSSProperties}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Hot Trades</CardTitle>
                    <div className="text-xs text-muted-foreground">Consensus + momentum + bot strength</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hotTradesUpdatedAt && (
                      <Badge variant="outline">{formatTimestamp(hotTradesUpdatedAt)}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!firebaseEnabled ? (
                    <div className="text-sm opacity-70">Connect Firebase to load market intel.</div>
                  ) : loadingHotTrades ? (
                    <div className="text-sm opacity-70">Loading hot trades...</div>
                  ) : focusedHotTrades.length === 0 ? (
                    <div className="text-sm opacity-70">
                      No hot trades yet. Deploy the market intel worker to populate this feed.
                    </div>
                  ) : (
                    focusedHotTrades.slice(0, 6).map((trade) => (
                      <div
                        key={`${trade.assetClass}-${trade.symbol}`}
                        className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.6)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{trade.symbol}</div>
                            <div className="text-xs text-muted-foreground">
                              {trade.name || trade.assetClass}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="uppercase">{trade.assetClass}</Badge>
                            {trade.side && (
                              <Badge variant={signalBadgeVariant(trade.side)} className="uppercase">
                                {trade.side}
                              </Badge>
                            )}
                            <Badge variant="outline" className={scoreTone(trade.score)}>
                              Score {trade.score?.toFixed(1) ?? "—"}
                            </Badge>
                            {isWatchlisted(trade) && (
                              <Badge variant="secondary">Watchlist</Badge>
                            )}
                            {isPrimaryTrade(trade) && (
                              <Badge variant="secondary">Primary</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>24h: {formatChange(trade.momentum?.change24h)}</span>
                          {trade.signals?.total ? (
                            <span>{trade.signals.total} bot signals</span>
                          ) : (
                            <span>No bot signals yet</span>
                          )}
                          {trade.exchange && <span>{trade.exchange}</span>}
                        </div>
                        {trade.rationale && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {trade.rationale}
                          </div>
                        )}
                        {!isWatchlisted(trade) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3"
                            onClick={() => addTradeToUniverse(trade)}
                            disabled={!firebaseEnabled}
                          >
                            Add to universe
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

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
                        <div key={`buy-${trade.symbol}`} className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{trade.symbol}</div>
                            <div className="text-xs text-muted-foreground">
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
                        <div key={`sell-${trade.symbol}`} className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{trade.symbol}</div>
                            <div className="text-xs text-muted-foreground">
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

            <div className="space-y-4">
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
    </div>
  )
}
