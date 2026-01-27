import { useEffect, useMemo, useState } from "react"
import { collection, doc, documentId, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import { useAuth } from "@/features/auth/auth-context"
import { useMarketPrices } from "@/features/market/use-market-prices"
import { useStreamSymbols } from "@/features/market/use-stream-symbols"
import { formatCurrency, formatNumber, formatTimestamp } from "@/lib/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Wallet } from "lucide-react"
import type {
  BrokerAccountSummaryDoc,
  BrokerPositionDoc,
  BrokerOrderDoc,
  ExecutionRequestDoc,
} from "@/lib/types"
import { useTranslation } from "react-i18next"
import { useIbkrAccount } from "@/features/ibkr/use-ibkr-account"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { toast } from "sonner"

const EXECUTION_TERMINAL_STATUSES = new Set([
  "filled",
  "cancelled",
  "expired",
  "rejected",
  "error",
])

const IB_TERMINAL_STATUSES = new Set([
  "Filled",
  "Cancelled",
  "Canceled",
  "ApiCancelled",
  "ApiCanceled",
  "Expired",
  "Rejected",
  "Inactive",
])

export default function PaperPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { replayActive } = useReplayControls()
  const { prices } = useMarketPrices()
  const { brokerAccountKey, brokerAccount } = useIbkrAccount(user?.uid)
  const [summary, setSummary] = useState<BrokerAccountSummaryDoc | null>(null)
  const [positions, setPositions] = useState<BrokerPositionDoc[]>([])
  const [orders, setOrders] = useState<BrokerOrderDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showRawOrderJson, setShowRawOrderJson] = useState(false)
  const [orderFilter, setOrderFilter] = useState<"all" | "manual" | "robot">("all")
  const [requestMeta, setRequestMeta] = useState<Record<string, ExecutionRequestDoc>>({})

  const readIbString = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined

  const openPositions = useMemo(
    () => positions.filter((pos) => pos.isOpen !== false && pos.position !== 0),
    [positions]
  )
  const getOrderOrigin = (order: BrokerOrderDoc) => {
    const requestId = order.executionRequestId || order.id
    const requestDoc = requestId ? requestMeta[requestId] : undefined
    const requestSource = (
      typeof order.requestSource === "string" ? order.requestSource : requestDoc?.source
    )?.trim()
    const requestStrategy = order.requestStrategy || requestDoc?.strategy
    const requestedByUid =
      typeof order.requestedByUid === "string"
        ? order.requestedByUid
        : requestDoc?.requestedByUid || ""
    if (requestSource && requestSource !== "manual") return "robot"
    if (requestStrategy) return "robot"
    if (requestedByUid.startsWith("system-")) return "robot"
    return "manual"
  }
  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        const hasIbkrIdentity =
          typeof order.conId === "number" ||
          (Array.isArray(order.orderIds) && order.orderIds.length > 0)
        const hasSymbol = Boolean(order.symbol || order.assetKey)
        return hasIbkrIdentity && hasSymbol
      }),
    [orders]
  )
  const requestIds = useMemo(() => {
    const ids = new Set<string>()
    for (const order of visibleOrders) {
      const requestId = order.executionRequestId || order.id
      if (!requestId || requestId.startsWith("ibkr-")) continue
      ids.add(requestId)
    }
    return Array.from(ids)
  }, [visibleOrders])
  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return visibleOrders
    return visibleOrders.filter((order) => getOrderOrigin(order) === orderFilter)
  }, [visibleOrders, orderFilter, requestMeta])
  const selectedOrder = useMemo(
    () => (selectedOrderId ? filteredOrders.find((order) => order.id === selectedOrderId) ?? null : null),
    [selectedOrderId, filteredOrders]
  )
  const selectedOrderJson = useMemo(() => {
    if (!selectedOrder) return ""
    return JSON.stringify(
      selectedOrder,
      (_key, value) => {
        if (value && typeof value.toMillis === "function") {
          return new Date(value.toMillis()).toISOString()
        }
        return value
      },
      2
    )
  }, [selectedOrder])
  const selectedOrderCancelDisabled = useMemo(() => {
    if (!selectedOrder) return true
    const isTerminal =
      (selectedOrder.status && EXECUTION_TERMINAL_STATUSES.has(selectedOrder.status)) ||
      (selectedOrder.ibStatus && IB_TERMINAL_STATUSES.has(selectedOrder.ibStatus))
    const cancelPending = Boolean(selectedOrder.cancelRequested || selectedOrder.cancelInProgressAt)
    const cancelSent = Boolean(selectedOrder.cancelSubmittedAt && !selectedOrder.cancelError)
    return (
      replayActive ||
      isTerminal ||
      cancelPending ||
      cancelSent ||
      !selectedOrder.orderIds ||
      selectedOrder.orderIds.length === 0
    )
  }, [selectedOrder, replayActive])

  useEffect(() => {
    if (filteredOrders.length === 0) {
      if (selectedOrderId) {
        setSelectedOrderId(null)
      }
      return
    }
    if (!selectedOrderId || !filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id)
    }
  }, [filteredOrders, selectedOrderId])

  useEffect(() => {
    setShowRawOrderJson(false)
  }, [selectedOrderId])

  useEffect(() => {
    if (!db || requestIds.length === 0) {
      setRequestMeta({})
      return
    }
    const firestore = db
    setRequestMeta({})
    const chunks: string[][] = []
    for (let i = 0; i < requestIds.length; i += 10) {
      chunks.push(requestIds.slice(i, i + 10))
    }
    const unsubs = chunks.map((chunk) => {
      const reqQuery = query(collection(firestore, "executionRequests"), where(documentId(), "in", chunk))
      return onSnapshot(reqQuery, (snap) => {
        setRequestMeta((prev) => {
          const next = { ...prev }
          snap.docs.forEach((docSnap) => {
            next[docSnap.id] = docSnap.data() as ExecutionRequestDoc
          })
          return next
        })
      })
    })
    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [requestIds.join("|"), db])

  useStreamSymbols("broker-portfolio", {
    items: openPositions.map((pos) => ({
      symbol: pos.symbol,
      assetClass: pos.assetClass ?? "stock",
    })),
    enabled: Boolean(user && brokerAccountKey),
  })

  useEffect(() => {
    if (!user || !db || !brokerAccountKey) return

    const unsubSummary = onSnapshot(
      doc(db, "brokerAccountSummaries", brokerAccountKey),
      (snap) => {
        setSummary(snap.exists() ? ({ id: snap.id, ...snap.data() } as BrokerAccountSummaryDoc) : null)
        setLoading(false)
      }
    )

    const positionsQuery = query(
      collection(db, "brokerPositions"),
      where("brokerAccountKey", "==", brokerAccountKey)
    )
    const unsubPositions = onSnapshot(positionsQuery, (snap) => {
      setPositions(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BrokerPositionDoc)))
    })

    const ordersQuery = query(
      collection(db, "brokerOrders"),
      where("brokerAccountKey", "==", brokerAccountKey)
    )
    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as BrokerOrderDoc))
      const readMillis = (value?: BrokerOrderDoc["createdAt"]) =>
        value && typeof (value as { toMillis?: () => number }).toMillis === "function"
          ? (value as { toMillis: () => number }).toMillis()
          : 0
      const readOrderMillis = (order: BrokerOrderDoc) =>
        readMillis(order.lastUpdateAt) || readMillis(order.createdAt)
      const sorted = docs.sort((a, b) => readOrderMillis(b) - readOrderMillis(a))
      setOrders(sorted.slice(0, 50))
    })

    return () => {
      unsubSummary()
      unsubPositions()
      unsubOrders()
    }
  }, [user, brokerAccountKey])

  async function handleCancelOrder(order: BrokerOrderDoc) {
    if (replayActive) {
      toast.error(t("replay.actionsDisabled"))
      return
    }
    if (!firebaseEnabled || !db) {
      toast.error(t("ibkr.errors.firebase"))
      return
    }
    if (!brokerAccountKey) {
      toast.error(t("ibkr.errors.noAccount"))
      return
    }
    if (!order.orderIds || order.orderIds.length === 0) {
      toast.error(t("ibkr.cancelUnavailable"))
      return
    }
    try {
      const ref = doc(db, "brokerOrders", order.id)
      await updateDoc(ref, {
        cancelRequested: true,
        cancelRequestedAt: serverTimestamp(),
        cancelRequestedBy: user?.uid || null,
        cancelError: null,
      })
      toast.success(t("ibkr.cancelRequested"))
    } catch (error) {
      console.error(error)
      toast.error(t("ibkr.cancelRequestFailed"))
    }
  }

  if (!brokerAccountKey) {
    return <div className="p-8 text-center text-muted-foreground">{t("ibkr.portfolio.noAccount")}</div>
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{t("ibkr.portfolio.loading")}</div>
  }

  const netLiq = summary?.values?.netLiquidation ?? 0
  const buyingPower = summary?.values?.buyingPower ?? summary?.values?.availableFunds ?? 0
  const unrealizedPnl = summary?.values?.unrealizedPnl ?? 0
  const realizedPnl = summary?.values?.realizedPnl ?? 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("ibkr.portfolio.title")}</h1>
          <p className="text-muted-foreground">{t("ibkr.portfolio.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {brokerAccount?.ibAccountCode ? (
            <Badge variant="outline" className="px-3 py-1 bg-blue-500/5 text-blue-600 border-blue-500/20">
              {t("ibkr.portfolio.account", { account: brokerAccount.ibAccountCode })}
            </Badge>
          ) : null}
          <Badge variant="outline" className="px-3 py-1 bg-emerald-500/5 text-emerald-700 border-emerald-500/20">
            {t("ibkr.portfolio.paperMode")}
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("ibkr.portfolio.netLiq")}</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(netLiq)}</div>
            <p className="text-xs text-muted-foreground">{t("ibkr.portfolio.netLiqHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("ibkr.portfolio.buyingPower")}</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(buyingPower)}</div>
            <p className="text-xs text-muted-foreground">{t("ibkr.portfolio.available")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("ibkr.portfolio.unrealizedPnl")}</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={[
                "text-2xl font-bold",
                unrealizedPnl >= 0 ? "text-emerald-600" : "text-rose-600",
              ].join(" ")}
            >
              {unrealizedPnl >= 0 ? "+" : ""}
              {formatCurrency(unrealizedPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("ibkr.portfolio.realizedPnl", { value: formatCurrency(realizedPnl) })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="positions">{t("ibkr.portfolio.tabs.positions")}</TabsTrigger>
          <TabsTrigger value="orders">{t("ibkr.portfolio.tabs.orders")}</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("ibkr.portfolio.openPositions")}</CardTitle>
            </CardHeader>
            <CardContent>
              {openPositions.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("ibkr.portfolio.noPositions")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ibkr.portfolio.table.symbol")}</TableHead>
                      <TableHead>{t("ibkr.portfolio.table.exchange")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.quantity")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.avgCost")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.lastPrice")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.marketValue")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.unrealized")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openPositions.map((pos) => {
                      const lastPrice = prices[pos.symbol] ?? pos.marketPrice ?? pos.avgCost ?? 0
                      return (
                        <TableRow key={pos.id}>
                          <TableCell className="font-medium">{pos.symbol}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {pos.primaryExchange || pos.exchange || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{pos.position.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pos.avgCost ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(lastPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pos.marketValue ?? 0)}</TableCell>
                          <TableCell
                            className={[
                              "text-right",
                              (pos.unrealizedPnl ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600",
                            ].join(" ")}
                          >
                            {pos.unrealizedPnl ? (pos.unrealizedPnl >= 0 ? "+" : "") : ""}
                            {formatCurrency(pos.unrealizedPnl ?? 0)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("ibkr.portfolio.recentOrders")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Tabs value={orderFilter} onValueChange={(value) => setOrderFilter(value as typeof orderFilter)}>
                  <TabsList>
                    <TabsTrigger value="all">{t("ibkr.portfolio.orderFilters.all")}</TabsTrigger>
                    <TabsTrigger value="manual">{t("ibkr.portfolio.orderFilters.manual")}</TabsTrigger>
                    <TabsTrigger value="robot">{t("ibkr.portfolio.orderFilters.robot")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {filteredOrders.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("ibkr.portfolio.noOrders")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ibkr.portfolio.table.symbol")}</TableHead>
                      <TableHead>{t("ibkr.portfolio.table.side")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.quantity")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.limitPrice")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("ibkr.portfolio.table.tif")}</TableHead>
                      <TableHead>{t("ibkr.portfolio.table.status")}</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("ibkr.portfolio.table.lastUpdate")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const ibOrder = order.ibOrder as Record<string, unknown> | undefined
                      const ibOrderState = order.ibOrderState as Record<string, unknown> | undefined
                      const brokerStatus =
                        order.ibStatus ||
                        readIbString(ibOrderState?.status) ||
                        readIbString(ibOrder?.status)
                      const brokerStatusLabel = brokerStatus ?? t("common.na")
                      const statusLabel = order.status ? t(`ibkr.status.${order.status}`) : t("common.na")
                      const timeInForce =
                        order.timeInForce || readIbString(ibOrder?.tif) || t("common.na")
                      const rawOrderType = order.orderType || readIbString(ibOrder?.orderType)
                      const normalizedOrderType = rawOrderType
                        ? rawOrderType.toLowerCase() === "mkt"
                          ? "market"
                          : rawOrderType.toLowerCase() === "lmt"
                            ? "limit"
                            : rawOrderType.toLowerCase() === "stp"
                              ? "stop"
                              : rawOrderType.toLowerCase()
                        : undefined
                      const orderTypeLabel = rawOrderType ? rawOrderType.toUpperCase() : t("common.na")
                      const limitLabel =
                        normalizedOrderType === "market"
                          ? "MKT"
                          : typeof order.limitPrice === "number"
                            ? formatCurrency(order.limitPrice)
                            : t("common.na")
                      const filledQty =
                        typeof order.filledQuantity === "number" ? order.filledQuantity : null
                      const remainingQty =
                        typeof order.remainingQuantity === "number" ? order.remainingQuantity : null
                      const showFill = filledQty !== null || remainingQty !== null
                      const filledLabel = filledQty !== null ? formatNumber(filledQty) : null
                      const remainingLabel =
                        remainingQty !== null ? formatNumber(remainingQty) : null
                      const fillLine =
                        filledLabel && remainingLabel
                          ? `Filled ${filledLabel} · Remaining ${remainingLabel}`
                          : filledLabel
                          ? `Filled ${filledLabel}`
                          : remainingLabel
                          ? `Remaining ${remainingLabel}`
                          : null
                      const lastUpdateLabel = formatTimestamp(order.lastUpdateAt ?? order.createdAt)
                      const isSelected = selectedOrderId === order.id
                      const showAppStatus = !brokerStatus && Boolean(order.status)
                      return (
                        <TableRow
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={[
                            "cursor-pointer",
                            isSelected ? "bg-muted/40" : "",
                          ].join(" ")}
                        >
                          <TableCell className="font-medium">{order.symbol ?? t("common.na")}</TableCell>
                          <TableCell className="uppercase text-[11px] text-muted-foreground">
                            {order.side ?? t("common.na")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono">{order.quantity ?? t("common.na")}</span>
                              {showFill && fillLine ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {fillLine}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span>{limitLabel}</span>
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {orderTypeLabel}
                              </span>
                              {typeof order.lastFillPrice === "number" ? (
                                <span className="text-[10px] text-muted-foreground">
                                  Last: {formatCurrency(order.lastFillPrice)}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                            {timeInForce}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">
                            <div className="flex flex-col items-start gap-1">
                              <span className="uppercase">{brokerStatusLabel}</span>
                              {showAppStatus ? (
                                <span className="uppercase text-muted-foreground/70">{statusLabel}</span>
                              ) : null}
                              {order.whyHeld ? (
                                <span className="text-amber-700">Held: {order.whyHeld}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-[10px] text-muted-foreground">
                            {lastUpdateLabel}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {selectedOrder ? (
                <div className="mt-4 space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-foreground">
                      {t("ibkr.portfolio.detailsTitle")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRawOrderJson((value) => !value)}
                      >
                        {showRawOrderJson
                          ? t("ibkr.portfolio.hideRawJson")
                          : t("ibkr.portfolio.showRawJson")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelOrder(selectedOrder)}
                        disabled={selectedOrderCancelDisabled}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                  {showRawOrderJson ? (
                    <pre className="max-h-[520px] overflow-auto rounded-md border bg-background/60 p-3 text-xs text-foreground">
                      {selectedOrderJson}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
