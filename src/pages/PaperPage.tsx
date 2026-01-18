import { useEffect, useState } from "react"
import { collection, doc, getDoc, onSnapshot, query, orderBy, limit } from "firebase/firestore"
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
    TableRow
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Wallet,
    History,
    XCircle,
    BarChart3
} from "lucide-react"
import type { PaperWallet, PaperPosition, PaperTransaction } from "@/lib/types"

import { toast } from "sonner"
import { useTranslation } from "react-i18next"

export default function PaperPage() {
    const { user } = useAuth()
    const { prices } = useMarketPrices()
    const { t } = useTranslation()
    const assetLabelMap: Record<PaperPosition["assetClass"], string> = {
        stock: t("assets.stock"),
        crypto: t("assets.crypto"),
        forex: t("assets.fx"),
    }
    const getAssetLabel = (assetClass?: string | null) =>
        assetClass ? assetLabelMap[assetClass as PaperPosition["assetClass"]] ?? assetClass : t("common.unknown")
    const [wallet, setWallet] = useState<PaperWallet | null>(null)
    const [positions, setPositions] = useState<PaperPosition[]>([])
    const [transactions, setTransactions] = useState<PaperTransaction[]>([])
    const [loading, setLoading] = useState(true)

    useStreamSymbols("paper", {
        items: positions,
        enabled: Boolean(user),
    })

    useEffect(() => {
        if (!user || !db) return

        const unsubWallet = onSnapshot(doc(db, "users", user.uid, "paper", "wallet"), (doc) => {
            if (doc.exists()) setWallet(doc.data() as PaperWallet)
            setLoading(false)
        })

        const qPos = query(collection(db, "users", user.uid, "paper", "wallet", "positions"))
        const unsubPos = onSnapshot(qPos, (snap) => {
            setPositions(snap.docs.map(d => d.data() as PaperPosition))
        })

        const qTx = query(
            collection(db, "users", user.uid, "paper", "wallet", "transactions"),
            orderBy("timestamp", "desc"),
            limit(50)
        )
        const unsubTx = onSnapshot(qTx, (snap) => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaperTransaction)))
        })

        return () => {
            unsubWallet()
            unsubPos()
            unsubTx()
        }
    }, [user])

    async function handleClosePosition(pos: PaperPosition) {
        if (!user || !db) return
        try {
            // Fetch current prices to get the exit price
            const priceSnap = await getDoc(doc(db, "market", "prices"))
            if (!priceSnap.exists()) {
                toast.error(t("paper.livePricesUnavailable"))
                return
            }

            const items = (priceSnap.data()?.items as Array<{ symbol: string; price: number }> | undefined) || []
            const priceItem = items.find((p) => p.symbol === pos.symbol)
            const exitPrice = priceItem ? priceItem.price : null

            if (!exitPrice) {
                toast.error(t("paper.priceMissing", { symbol: pos.symbol }))
                return
            }

            const { executePaperTrade } = await import("@/features/paper/paper-service")
            await executePaperTrade(user.uid, {
                symbol: pos.symbol,
                assetClass: pos.assetClass,
                side: "sell",
                price: exitPrice,
                quantity: pos.quantity
            })

            toast.success(t("paper.closedPosition", { symbol: pos.symbol, price: formatCurrency(exitPrice) }))
        } catch (e: unknown) {
            console.error("Close failed:", e)
            const message = e instanceof Error ? e.message : t("paper.closeFailed")
            toast.error(message)
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">{t("paper.loadingPortfolio")}</div>
    if (!wallet) return <div className="p-8 text-center">{t("paper.noWallet")}</div>

    const startBalance = 100000
    const totalPnL = wallet.balance - startBalance
    const pnlPercent = (totalPnL / startBalance) * 100

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("paper.portfolioTitle")}</h1>
                    <p className="text-muted-foreground">{t("paper.portfolioSubtitle")}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 bg-blue-500/5 text-blue-600 border-blue-500/20">
                        {t("paper.simulatedAccount")}
                    </Badge>
                </div>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">{t("paper.buyingPower")}</CardTitle>
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(wallet.balance)}</div>
                        <p className="text-xs text-muted-foreground">{t("paper.availableForTrades")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">{t("paper.totalPnl")}</CardTitle>
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={["text-2xl font-bold", totalPnL >= 0 ? "text-emerald-600" : "text-rose-600"].join(" ")}>
                            {totalPnL >= 0 ? "+" : ""}{formatCurrency(totalPnL)}
                        </div>
                        <p className={["text-xs font-medium", totalPnL >= 0 ? "text-emerald-600" : "text-rose-600"].join(" ")}>
                            {t("paper.overallReturn", { percent: pnlPercent.toFixed(2) })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">{t("paper.activePositions")}</CardTitle>
                        <History className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{positions.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {t("paper.diversifiedAcross", {
                                count: new Set(positions.map(p => p.assetClass)).size,
                            })}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="positions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="positions">{t("paper.tabs.positions")}</TabsTrigger>
                    <TabsTrigger value="history">{t("paper.tabs.history")}</TabsTrigger>
                </TabsList>

                <TabsContent value="positions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("paper.openPositions")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("paper.table.symbol")}</TableHead>
                                        <TableHead>{t("paper.table.assetClass")}</TableHead>
                                        <TableHead className="text-right">{t("paper.table.quantity")}</TableHead>
                                        <TableHead className="text-right">{t("paper.table.avgEntry")}</TableHead>
                                        <TableHead className="text-right">{t("paper.table.currentPrice")}</TableHead>
                                        <TableHead className="text-right">{t("paper.table.unrealizedPnl")}</TableHead>
                                        <TableHead className="text-right">{t("paper.table.slTp")}</TableHead>
                                        <TableHead className="text-right">{t("paper.table.actions")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {positions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                {t("paper.noActivePositions")}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        positions.map((pos) => (
                                            <TableRow key={pos.symbol}>
                                                <TableCell className="font-semibold">{pos.symbol}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{getAssetLabel(pos.assetClass)}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{pos.quantity.toFixed(4)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(pos.avgEntryPrice)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {prices[pos.symbol] ? formatCurrency(prices[pos.symbol]) : t("common.na")}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(() => {
                                                        const current = prices[pos.symbol]
                                                        if (!current) return t("common.na")
                                                        const pnl = (current - pos.avgEntryPrice) * pos.quantity
                                                        const pnlPct = ((current - pos.avgEntryPrice) / pos.avgEntryPrice) * 100
                                                        return (
                                                            <div className={pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                                <div>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}</div>
                                                                <div className="text-[10px]">{pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
                                                            </div>
                                                        )
                                                    })()}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">
                                                    {pos.stopLoss ? <div className="text-rose-600">{t("paper.sl")}: {formatCurrency(pos.stopLoss)}</div> : null}
                                                    {pos.takeProfit ? <div className="text-emerald-600">{t("paper.tp")}: {formatCurrency(pos.takeProfit)}</div> : null}
                                                    {!pos.stopLoss && !pos.takeProfit && t("common.na")}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                        title={t("paper.sellAllTitle")}
                                                        onClick={() => handleClosePosition(pos)}
                                                    >
                                                        <XCircle className="w-4 h-4 mr-1" />
                                                        {t("paper.closePosition")}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("paper.tradeHistory")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("paper.history.time")}</TableHead>
                                        <TableHead>{t("paper.history.symbol")}</TableHead>
                                        <TableHead>{t("paper.history.side")}</TableHead>
                                        <TableHead className="text-right">{t("paper.history.amount")}</TableHead>
                                        <TableHead className="text-right">{t("paper.history.price")}</TableHead>
                                        <TableHead className="text-right">{t("paper.history.total")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                {t("paper.noTransactions")}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {tx.timestamp?.toDate().toLocaleString()}
                                                </TableCell>
                                                <TableCell className="font-medium">{tx.symbol}</TableCell>
                                                <TableCell>
                                                    <Badge className={tx.side === 'buy' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'}>
                                                        {t(`trade.side.${tx.side}`)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{tx.amount.toFixed(4)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(tx.price)}</TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(tx.cost)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
