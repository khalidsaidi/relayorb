import { useEffect, useMemo, useState } from "react"
import { Timestamp, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import {
  TrendingDown,
  TrendingUp,
  LineChart,
  Wallet,
  BadgeDollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { FmpCandleChart } from "@/components/charts/FmpCandleChart"
import { useAuth } from "@/features/auth/auth-context"
import { useIbkrAccount } from "@/features/ibkr/use-ibkr-account"
import { useIbkrExecutor } from "@/features/ibkr/use-ibkr-executor"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import {
  useFmpChart,
  useFmpQuote,
  useFmpSymbolSearch,
} from "@/features/market/use-fmp-data"
import { useMarketPrices } from "@/features/market/use-market-prices"
import { db, firebaseEnabled } from "@/lib/firebase"
import { buildAssetKey } from "@/lib/broker-accounts"
import { formatAssetPrice, formatNumber, formatTimestamp } from "@/lib/format"
import { storeLastExecutionRequest } from "@/lib/ibkr-last-execution"
import type {
  BrokerOrderDoc,
  ExecutionMode,
  ExecutionRequestDoc,
  OrderSnapshot,
} from "@/lib/types"

const REQUEST_TTL_MS = 2 * 60 * 1000
type AssetClass = "stock" | "forex"
type OrderType = "limit" | "market"

function parseNumberInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Normalize common non-ASCII digit sets before parsing.
  let cleaned = trimmed.normalize("NFKC")
  cleaned = cleaned.replace(/[\u0660-\u0669]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x0660)
  )
  cleaned = cleaned.replace(/[\u06f0-\u06f9]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x06f0)
  )
  cleaned = cleaned.replace(/[\s_'\u2019]/g, "")
  const hasComma = cleaned.includes(",")
  const hasDot = cleaned.includes(".")

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",")
    const lastDot = cleaned.lastIndexOf(".")
    const decimalSeparator = lastComma > lastDot ? "," : "."
    const groupingSeparator = decimalSeparator === "," ? "." : ","
    cleaned = cleaned.replace(new RegExp(`\\${groupingSeparator}`, "g"), "")
    cleaned = cleaned.replace(decimalSeparator, ".")
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, "")
    } else {
      cleaned = cleaned.replace(/,/g, ".")
    }
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, "")
    }
  }

  if (!/^[+-]?\d*(\.\d*)?$/.test(cleaned)) return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function formatForexSymbol(value: string) {
  const trimmed = value.trim().toUpperCase()
  const compact = trimmed.replace(/[^A-Z]/g, "")
  if (compact.length >= 6) {
    return `${compact.slice(0, 3)}/${compact.slice(3, 6)}`
  }
  return trimmed.replace(/-/g, "/")
}

function normalizeMarketSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[/-]/g, "")
}

function resolveOrderSymbol(symbol: string, assetClass: AssetClass) {
  if (assetClass === "forex") return formatForexSymbol(symbol)
  return symbol.trim().toUpperCase()
}

export default function IbkrOrderPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { brokerAccountKey, brokerAccount, tradingControls } = useIbkrAccount(user?.uid)
  const executor = useIbkrExecutor(brokerAccountKey)
  const { replayActive } = useReplayControls()
  const { prices } = useMarketPrices()

  const [assetClass, setAssetClass] = useState<AssetClass>("stock")
  const [symbolInput, setSymbolInput] = useState("AAPL")
  const [activeSymbol, setActiveSymbol] = useState("AAPL")
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const [showMatches, setShowMatches] = useState(false)
  const [interval, setInterval] = useState<"1m" | "5m" | "15m" | "30m" | "1h" | "eod">("5m")
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [orderType, setOrderType] = useState<OrderType>("limit")
  const [timeInForce, setTimeInForce] = useState<OrderSnapshot["timeInForce"]>("DAY")
  const [useBracket, setUseBracket] = useState(false)
  const [mode, setMode] = useState<ExecutionMode>("paper")
  const [draftInputs, setDraftInputs] = useState({
    limitPrice: "",
    quantity: "",
    stopLoss: "",
    takeProfit: "",
  })
  const [touched, setTouched] = useState({
    limitPrice: false,
    quantity: false,
    stopLoss: false,
    takeProfit: false,
  })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [prefillPrice, setPrefillPrice] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [requestDoc, setRequestDoc] = useState<ExecutionRequestDoc | null>(null)
  const [brokerOrder, setBrokerOrder] = useState<BrokerOrderDoc | null>(null)
  const [statusTrail, setStatusTrail] = useState<string[]>([])

  const paperEnabled = brokerAccount?.enabled && brokerAccount?.paperEnabled
  const liveEnabled = brokerAccount?.enabled && brokerAccount?.liveEnabled
  const limitOnly = tradingControls?.limitOnly ?? false
  const requireBracket = tradingControls?.requireBracket ?? false

  const defaultSymbols = useMemo(
    () => ({
      stock: "AAPL",
      forex: "EURUSD",
    }),
    []
  )

  useEffect(() => {
    const nextSymbol = resolveOrderSymbol(defaultSymbols[assetClass], assetClass)
    setSymbolInput(nextSymbol)
    setActiveSymbol(nextSymbol)
    setSelectedExchange(null)
    setShowMatches(false)
    setPrefillPrice(true)
  }, [assetClass, defaultSymbols])

  useEffect(() => {
    if (paperEnabled && !liveEnabled) {
      setMode("paper")
    } else if (!paperEnabled && liveEnabled) {
      setMode("live")
    }
  }, [paperEnabled, liveEnabled])

  useEffect(() => {
    if (requireBracket) {
      setUseBracket(true)
    }
  }, [requireBracket])

  useEffect(() => {
    if (limitOnly && orderType === "market") {
      setOrderType("limit")
    }
  }, [limitOnly, orderType])

  const searchQuery = symbolInput.trim()
  const { results: symbolMatches, loading: symbolLoading } = useFmpSymbolSearch(
    searchQuery,
    assetClass
  )
  const normalizedSymbol = useMemo(
    () => normalizeMarketSymbol(activeSymbol),
    [activeSymbol]
  )
  const { quote } = useFmpQuote(normalizedSymbol)
  const fmpInterval =
    interval === "1m"
      ? "1min"
      : interval === "eod"
        ? "eod"
        : interval === "1h"
          ? "1hour"
          : interval === "30m"
            ? "30min"
            : interval === "15m"
              ? "15min"
              : "5min"
  const { bars, latest, error: chartError } = useFmpChart(
    normalizedSymbol,
    fmpInterval,
    120,
    assetClass
  )

  const livePrice = activeSymbol ? prices[activeSymbol] : undefined
  const currentPrice = quote?.price ?? livePrice
  const priceChange =
    quote?.changePercentage ??
    (quote?.price && quote?.open ? ((quote.price - quote.open) / quote.open) * 100 : undefined)

  useEffect(() => {
    if (!prefillPrice) return
    if (typeof currentPrice !== "number") return
    setDraftInputs((prev) => ({
      ...prev,
      limitPrice: String(currentPrice),
    }))
    setPrefillPrice(false)
  }, [currentPrice, prefillPrice])

  useEffect(() => {
    if (!firebaseEnabled || !db || !requestId) return
    const requestRef = doc(db, "executionRequests", requestId)
    const orderRef = doc(db, "brokerOrders", requestId)
    const unsubRequest = onSnapshot(requestRef, (snap) => {
      setRequestDoc(snap.exists() ? (snap.data() as ExecutionRequestDoc) : null)
    })
    const unsubOrder = onSnapshot(orderRef, (snap) => {
      setBrokerOrder(snap.exists() ? (snap.data() as BrokerOrderDoc) : null)
    })
    return () => {
      unsubRequest()
      unsubOrder()
    }
  }, [requestId])

  useEffect(() => {
    const status = requestDoc?.status
    if (!status) return
    setStatusTrail((prev) => (prev.includes(status) ? prev : [...prev, status]))
  }, [requestDoc?.status])

  const parsedInputs = useMemo(
    () => ({
      quantity: parseNumberInput(draftInputs.quantity),
      limitPrice: parseNumberInput(draftInputs.limitPrice),
      stopLoss: parseNumberInput(draftInputs.stopLoss),
      takeProfit: parseNumberInput(draftInputs.takeProfit),
    }),
    [
      draftInputs.quantity,
      draftInputs.limitPrice,
      draftInputs.stopLoss,
      draftInputs.takeProfit,
    ]
  )

  const resolvedInputs = useMemo(
    () => ({
      quantity: parsedInputs.quantity,
      limitPrice:
        orderType === "limit" ? parsedInputs.limitPrice : currentPrice ?? parsedInputs.limitPrice,
      stopLoss: parsedInputs.stopLoss,
      takeProfit: parsedInputs.takeProfit,
    }),
    [parsedInputs, currentPrice, orderType]
  )

  const quantityInvalid = parsedInputs.quantity === null || parsedInputs.quantity <= 0
  const limitPriceInvalid =
    orderType === "limit" &&
    (parsedInputs.limitPrice === null || (parsedInputs.limitPrice ?? 0) <= 0)
  const stopLossInvalid =
    useBracket &&
    (parsedInputs.stopLoss === null || (parsedInputs.stopLoss ?? 0) <= 0)
  const takeProfitInvalid =
    useBracket &&
    (parsedInputs.takeProfit === null || (parsedInputs.takeProfit ?? 0) <= 0)
  const stopLossTakeProfitRelationInvalid =
    useBracket &&
    !stopLossInvalid &&
    !takeProfitInvalid &&
    ((side === "buy" &&
      (resolvedInputs.stopLoss ?? 0) >= (resolvedInputs.takeProfit ?? 0)) ||
      (side === "sell" &&
        (resolvedInputs.stopLoss ?? 0) <= (resolvedInputs.takeProfit ?? 0)))

  const hasInvalidInputs =
    quantityInvalid ||
    limitPriceInvalid ||
    stopLossInvalid ||
    takeProfitInvalid ||
    stopLossTakeProfitRelationInvalid

  const showQuantityError = (submitAttempted || touched.quantity) && quantityInvalid
  const showLimitPriceError = (submitAttempted || touched.limitPrice) && limitPriceInvalid
  const showStopLossError =
    useBracket &&
    (submitAttempted || touched.stopLoss || touched.takeProfit) &&
    (stopLossInvalid || stopLossTakeProfitRelationInvalid)
  const showTakeProfitError =
    useBracket &&
    (submitAttempted || touched.stopLoss || touched.takeProfit) &&
    (takeProfitInvalid || stopLossTakeProfitRelationInvalid)

  const notional =
    (resolvedInputs.quantity || 0) * (resolvedInputs.limitPrice || currentPrice || 0)

  const connectionError = executor?.lastConnectError ? String(executor.lastConnectError) : ""
  const connectionStatus = executor?.ibConnected ? "connected" : connectionError ? "error" : "idle"
  const connectionLabel =
    connectionStatus === "connected"
      ? t("ibkr.sidebar.connected")
      : connectionStatus === "error"
        ? t("ibkr.sidebar.connectionFailed")
        : t("ibkr.sidebar.disconnected")

  async function handleLoadSymbol() {
    const resolvedSymbol = resolveOrderSymbol(symbolInput, assetClass)
    if (!resolvedSymbol) {
      toast.error(t("ibkr.errors.symbolMissing"))
      return
    }
    setSymbolInput(resolvedSymbol)
    setActiveSymbol(resolvedSymbol)
    setShowMatches(false)
    setPrefillPrice(true)
  }

  function handleSelectMatch(match: { symbol: string; exchange?: string }) {
    const resolvedSymbol = resolveOrderSymbol(match.symbol, assetClass)
    setSymbolInput(resolvedSymbol)
    setActiveSymbol(resolvedSymbol)
    setSelectedExchange(match.exchange || null)
    setShowMatches(false)
    setPrefillPrice(true)
  }

  async function handleSubmit() {
    setSubmitAttempted(true)
    if (!firebaseEnabled || !db) {
      toast.error(t("ibkr.errors.firebase"))
      return
    }
    if (!brokerAccountKey || !user?.uid) {
      toast.error(t("ibkr.errors.noAccount"))
      return
    }
    if (replayActive) {
      toast.error(t("replay.actionsDisabled"))
      return
    }
    if (tradingControls?.ibkrEnabled === false) {
      toast.error(t("ibkr.errors.ibkrDisabled"))
      return
    }
    if (tradingControls?.killSwitch) {
      toast.error(t("ibkr.errors.killSwitchActive"))
      return
    }
    if (mode === "paper" && !paperEnabled) {
      toast.error(t("ibkr.errors.paperDisabled"))
      return
    }
    if (mode === "live" && !liveEnabled) {
      toast.error(t("ibkr.errors.liveDisabled"))
      return
    }
    if (hasInvalidInputs) {
      toast.error(t("ibkr.errors.invalidOrder"))
      return
    }
    if (!activeSymbol.trim()) {
      toast.error(t("ibkr.errors.symbolMissing"))
      return
    }
    if (orderType === "market" && typeof currentPrice !== "number") {
      toast.error(t("ibkr.errors.currentPriceMissing"))
      return
    }
    if (requireBracket && !useBracket) {
      toast.error(t("ibkr.errors.bracketRequired"))
      return
    }

    setSubmitting(true)
    try {
      const id = crypto.randomUUID()
      const now = Date.now()
      const expiresAt = Timestamp.fromMillis(now + REQUEST_TTL_MS)
      const symbol = resolveOrderSymbol(activeSymbol, assetClass)
      const assetKey = buildAssetKey(assetClass, symbol)
      const limitPrice =
        orderType === "limit" ? resolvedInputs.limitPrice : currentPrice ?? resolvedInputs.limitPrice

      const orderSnapshot: OrderSnapshot = {
        symbol,
        assetClass,
        assetKey,
        exchange: selectedExchange || undefined,
        side,
        quantity: resolvedInputs.quantity || 0,
        orderType,
        limitPrice: limitPrice ?? undefined,
        stopLoss: useBracket ? resolvedInputs.stopLoss ?? undefined : undefined,
        takeProfit: useBracket ? resolvedInputs.takeProfit ?? undefined : undefined,
        timeInForce: timeInForce || "DAY",
      }

      const payload: ExecutionRequestDoc = {
        id,
        brokerAccountKey,
        proposalId: `manual:${assetClass}:${symbol}:${now}`,
        requestedByUid: user.uid,
        approvedByUid: user.uid,
        ibAccountCodeSnapshot: brokerAccount?.ibAccountCode || undefined,
        approvedAt: serverTimestamp(),
        mode,
        status: "approved",
        orderSnapshot,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await setDoc(doc(db, "executionRequests", id), payload)
      storeLastExecutionRequest({
        id,
        brokerAccountKey,
        createdAt: now,
        mode,
        orderSnapshot,
      })
      setRequestId(id)
      setStatusTrail(["approved"])
      toast.success(t("ibkr.requestCreated"))
    } catch (err) {
      console.error(err)
      toast.error(t("ibkr.errors.requestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const requestPending = Boolean(requestId) && !requestDoc
  const statusLabel = requestDoc?.status ? t(`ibkr.status.${requestDoc.status}`) : null
  const brokerStatusLabel = brokerOrder?.ibStatus
    ? brokerOrder.ibStatus
    : brokerOrder?.status
      ? t(`ibkr.status.${brokerOrder.status}`)
      : t("common.na")
  const statusTrailLabel = statusTrail.length
    ? statusTrail.map((item) => t(`ibkr.status.${item}`)).join(" -> ")
    : t("common.na")
  const statusUpdated =
    brokerOrder?.lastUpdateAt ?? requestDoc?.updatedAt ?? requestDoc?.createdAt

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("ibkr.orderPage.kicker")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("ibkr.orderPage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("ibkr.orderPage.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brokerAccountKey ? (
            <Badge variant="outline">
              {t("ibkr.accountLabel", { account: brokerAccountKey.toUpperCase() })}
            </Badge>
          ) : null}
          <Badge variant="secondary">{t(`ibkr.mode.${mode}`)}</Badge>
          <Badge
            variant={connectionStatus === "connected" ? "secondary" : "outline"}
            className={
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                : connectionStatus === "error"
                  ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                  : ""
            }
          >
            {connectionLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <LineChart className="h-4 w-4" />
                {t("ibkr.orderPage.symbolTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                  value={assetClass}
                  onChange={(e) => {
                    const next = e.target.value as AssetClass
                    setAssetClass(next)
                  }}
                >
                  <option value="stock">{t("assets.stock")}</option>
                  <option value="forex">{t("assets.forex")}</option>
                </select>
                <div className="flex-1 min-w-[200px]">
                  <Input
                    value={symbolInput}
                    onChange={(e) => {
                      setSymbolInput(e.target.value)
                      setShowMatches(true)
                      setSelectedExchange(null)
                    }}
                    placeholder={t("ibkr.orderPage.symbolPlaceholder")}
                  />
                </div>
                <Button onClick={handleLoadSymbol} disabled={!symbolInput.trim()}>
                  {t("ibkr.orderPage.load")}
                </Button>
              </div>

              {showMatches && symbolMatches.length > 0 && (
                <div className="w-full rounded-lg border border-border/60 bg-background/95 p-2 shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground px-1 pb-1">
                    {symbolLoading ? t("common.loading") : t("ibkr.orderPage.matches")}
                  </div>
                  <div className="flex flex-col divide-y divide-border/60">
                    {symbolMatches.map((match) => (
                      <button
                        key={`${match.symbol}-${match.exchange || ""}`}
                        className="flex items-center justify-between px-2 py-1 text-left hover:bg-muted/60"
                        onClick={() => handleSelectMatch(match)}
                      >
                        <span className="font-semibold">{match.symbol}</span>
                        <span className="text-xs text-muted-foreground">
                          {match.name || match.exchange || match.currency || ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("ibkr.orderPage.currentPrice")}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                    {typeof currentPrice === "number"
                      ? formatAssetPrice(currentPrice, assetClass)
                      : t("common.na")}
                    {priceChange !== undefined ? (
                      <span
                        className={`flex items-center gap-1 text-sm font-medium ${
                          priceChange >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {priceChange >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {`${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%`}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {quote?.timestamp
                      ? t("ibkr.orderPage.quoteUpdated", {
                          time: new Date(quote.timestamp).toLocaleTimeString(),
                        })
                      : typeof currentPrice === "number"
                        ? t("ibkr.orderPage.quoteFallback")
                        : t("common.na")}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("ibkr.orderPage.lastBar")}
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {latest?.close !== undefined
                      ? formatAssetPrice(latest.close, assetClass)
                      : t("common.na")}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {latest?.time
                      ? t("ibkr.orderPage.barUpdated", {
                          time: new Date(latest.time).toLocaleTimeString(),
                        })
                      : t("common.na")}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex flex-col justify-between">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("ibkr.orderPage.priceTools")}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      if (typeof currentPrice !== "number") return
                      setDraftInputs((prev) => ({
                        ...prev,
                        limitPrice: String(currentPrice),
                      }))
                    }}
                    disabled={typeof currentPrice !== "number"}
                  >
                    {t("ibkr.orderPage.useCurrentPrice")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("ibkr.orderPage.chartTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs value={interval} onValueChange={(value) => setInterval(value as typeof interval)}>
                <TabsList className="flex flex-wrap">
                  <TabsTrigger value="1m">1m</TabsTrigger>
                  <TabsTrigger value="5m">5m</TabsTrigger>
                  <TabsTrigger value="15m">15m</TabsTrigger>
                  <TabsTrigger value="30m">30m</TabsTrigger>
                  <TabsTrigger value="1h">1h</TabsTrigger>
                  <TabsTrigger value="eod">EOD</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="rounded-lg border border-border/60 bg-muted/10 p-2">
                {chartError ? (
                  <div className="text-sm text-destructive">{chartError}</div>
                ) : bars.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {t("ibkr.orderPage.chartEmpty")}
                  </div>
                ) : (
                  <FmpCandleChart bars={bars} height={320} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("ibkr.orderPage.ticketTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">{t("ibkr.orderPage.sideLabel")}</div>
                <Tabs value={side} onValueChange={(value) => setSide(value as typeof side)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">{t("trade.side.buy")}</TabsTrigger>
                    <TabsTrigger value="sell">{t("trade.side.sell")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {t("ibkr.orderPage.orderTypeLabel")}
                </div>
                <Tabs
                  value={orderType}
                  onValueChange={(value) => setOrderType(value as OrderType)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="limit">{t("ibkr.orderPage.limit")}</TabsTrigger>
                    <TabsTrigger value="market" disabled={limitOnly}>
                      {t("ibkr.orderPage.market")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t("ibkr.labels.quantity")}
                  </span>
                  <Input
                    value={draftInputs.quantity}
                    onChange={(event) =>
                      setDraftInputs((prev) => ({ ...prev, quantity: event.target.value }))
                    }
                    onBlur={() =>
                      setTouched((prev) => (prev.quantity ? prev : { ...prev, quantity: true }))
                    }
                    inputMode="decimal"
                    aria-invalid={showQuantityError || undefined}
                  />
                  {showQuantityError ? (
                    <div className="text-xs text-destructive">
                      {t("ibkr.errors.invalidQuantity")}
                    </div>
                  ) : null}
                </div>
                {orderType === "limit" ? (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {t("ibkr.labels.limitPrice")}
                    </span>
                    <Input
                      value={draftInputs.limitPrice}
                      onChange={(event) => {
                        setDraftInputs((prev) => ({ ...prev, limitPrice: event.target.value }))
                        setPrefillPrice(false)
                      }}
                      onBlur={() =>
                        setTouched((prev) =>
                          prev.limitPrice ? prev : { ...prev, limitPrice: true }
                        )
                      }
                      inputMode="decimal"
                      aria-invalid={showLimitPriceError || undefined}
                    />
                    {showLimitPriceError ? (
                      <div className="text-xs text-destructive">
                        {t("ibkr.errors.invalidLimitPrice")}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {t("ibkr.orderPage.marketReference")}
                    </span>
                    <div className="text-sm font-medium">
                      {typeof currentPrice === "number"
                        ? formatAssetPrice(currentPrice, assetClass)
                        : t("common.na")}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("ibkr.orderPage.bracketLabel")}</span>
                  {requireBracket ? (
                    <Badge variant="secondary">{t("ibkr.orderPage.bracketRequired")}</Badge>
                  ) : null}
                </div>
                <Tabs
                  value={useBracket ? "bracket" : "none"}
                  onValueChange={(value) => {
                    if (requireBracket && value === "none") return
                    setUseBracket(value === "bracket")
                  }}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="none" disabled={requireBracket}>
                      {t("ibkr.orderPage.bracketNone")}
                    </TabsTrigger>
                    <TabsTrigger value="bracket">{t("ibkr.orderPage.bracketOn")}</TabsTrigger>
                  </TabsList>
                </Tabs>
                {useBracket ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">
                        {t("ibkr.labels.stopLoss")}
                      </span>
                      <Input
                        value={draftInputs.stopLoss}
                        onChange={(event) =>
                          setDraftInputs((prev) => ({ ...prev, stopLoss: event.target.value }))
                        }
                        onBlur={() =>
                          setTouched((prev) =>
                            prev.stopLoss ? prev : { ...prev, stopLoss: true }
                          )
                        }
                        inputMode="decimal"
                        aria-invalid={showStopLossError || undefined}
                      />
                      {showStopLossError ? (
                        <div className="text-xs text-destructive">
                          {t(
                            stopLossInvalid
                              ? "ibkr.errors.invalidStopLoss"
                              : "ibkr.errors.stopLossTakeProfitRelation"
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">
                        {t("ibkr.labels.takeProfit")}
                      </span>
                      <Input
                        value={draftInputs.takeProfit}
                        onChange={(event) =>
                          setDraftInputs((prev) => ({ ...prev, takeProfit: event.target.value }))
                        }
                        onBlur={() =>
                          setTouched((prev) =>
                            prev.takeProfit ? prev : { ...prev, takeProfit: true }
                          )
                        }
                        inputMode="decimal"
                        aria-invalid={showTakeProfitError || undefined}
                      />
                      {showTakeProfitError ? (
                        <div className="text-xs text-destructive">
                          {t(
                            takeProfitInvalid
                              ? "ibkr.errors.invalidTakeProfit"
                              : "ibkr.errors.stopLossTakeProfitRelation"
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {t("ibkr.orderPage.timeInForceLabel")}
                </div>
                <select
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                  value={timeInForce}
                  onChange={(event) =>
                    setTimeInForce(event.target.value as OrderSnapshot["timeInForce"])
                  }
                >
                  <option value="DAY">DAY</option>
                  <option value="GTC">GTC</option>
                  <option value="IOC">IOC</option>
                </select>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BadgeDollarSign className="h-4 w-4" />
                  {t("ibkr.orderPage.orderSummary")}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.orderPage.symbolLabel")}</span>
                    <span className="font-medium">{activeSymbol || t("common.na")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.orderPage.sideLabel")}</span>
                    <span className="font-medium">{t(`trade.side.${side}`)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.orderPage.orderTypeLabel")}</span>
                    <span className="font-medium">{t(`ibkr.orderPage.${orderType}`)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.labels.quantity")}</span>
                    <span className="font-medium">
                      {resolvedInputs.quantity ?? t("common.na")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.orderPage.estNotional")}</span>
                    <span className="font-medium">
                      {notional ? formatNumber(notional) : t("common.na")}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">{t("ibkr.labels.mode")}</div>
                <Tabs value={mode} onValueChange={(value) => setMode(value as ExecutionMode)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paper" disabled={!paperEnabled}>
                      {t("ibkr.mode.paper")}
                    </TabsTrigger>
                    <TabsTrigger value="live" disabled={!liveEnabled}>
                      {t("ibkr.mode.live")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  hasInvalidInputs ||
                  replayActive ||
                  (!paperEnabled && !liveEnabled) ||
                  !brokerAccountKey
                }
              >
                {submitting ? t("common.loading") : t("ibkr.orderPage.submit")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4" />
                {t("ibkr.orderPage.statusTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {requestPending ? (
                <div>{t("ibkr.requestPending")}</div>
              ) : requestDoc ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.requestIdLabel")}</span>
                    <span className="font-mono text-foreground">{requestId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.labels.status")}</span>
                    <span className="text-foreground">{statusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.requestBrokerStatusLabel")}</span>
                    <span className="text-foreground">{brokerStatusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.requestProgressLabel")}</span>
                    <span className="text-foreground">{statusTrailLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("ibkr.requestUpdatedLabel")}</span>
                    <span className="text-foreground">
                      {statusUpdated ? formatTimestamp(statusUpdated) : t("common.na")}
                    </span>
                  </div>
                  {requestDoc.statusReason || brokerOrder?.lastError ? (
                    <div className="rounded-md border border-rose-200/60 bg-rose-500/10 p-2 text-rose-700">
                      {requestDoc.statusReason || brokerOrder?.lastError}
                    </div>
                  ) : null}
                </>
              ) : (
                <div>{t("ibkr.orderPage.statusEmpty")}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
