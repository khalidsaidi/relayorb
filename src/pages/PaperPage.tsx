import { useEffect, useMemo, useState } from "react"
import { collection, doc, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/features/auth/auth-context"
import { useMarketPrices } from "@/features/market/use-market-prices"
import { useStreamSymbols } from "@/features/market/use-stream-symbols"
import { formatCurrency } from "@/lib/format"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Wallet } from "lucide-react"
import type {
  BrokerAccountSummaryDoc,
  BrokerPositionDoc,
  BrokerOrderDoc,
} from "@/lib/types"
import { useTranslation } from "react-i18next"
import { useIbkrAccount } from "@/features/ibkr/use-ibkr-account"

export default function PaperPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { prices } = useMarketPrices()
  const { brokerAccountKey, brokerAccount } = useIbkrAccount(user?.uid)
  const [summary, setSummary] = useState<BrokerAccountSummaryDoc | null>(null)
  const [positions, setPositions] = useState<BrokerPositionDoc[]>([])
  const [orders, setOrders] = useState<BrokerOrderDoc[]>([])
  const [loading, setLoading] = useState(true)

  const openPositions = useMemo(
    () => positions.filter((pos) => pos.isOpen !== false && pos.position !== 0),
    [positions]
  )
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
      const sorted = docs.sort((a, b) => readMillis(b.createdAt) - readMillis(a.createdAt))
      setOrders(sorted.slice(0, 50))
    })

    return () => {
      unsubSummary()
      unsubPositions()
      unsubOrders()
    }
  }, [user, brokerAccountKey])

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
              {visibleOrders.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("ibkr.portfolio.noOrders")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ibkr.portfolio.table.symbol")}</TableHead>
                      <TableHead>{t("ibkr.portfolio.table.side")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.quantity")}</TableHead>
                      <TableHead className="text-right">{t("ibkr.portfolio.table.limitPrice")}</TableHead>
                      <TableHead>{t("ibkr.portfolio.table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.symbol ?? "-"}</TableCell>
                        <TableCell className="uppercase text-[11px] text-muted-foreground">
                          {order.side ?? "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">{order.quantity ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {order.limitPrice ? formatCurrency(order.limitPrice) : "-"}
                        </TableCell>
                        <TableCell className="uppercase text-[10px] text-muted-foreground">
                          {order.status ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
