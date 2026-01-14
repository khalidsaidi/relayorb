import { useState } from "react"
import { useAuth } from "@/features/auth/auth-context"
import { executePaperTrade } from "@/features/paper/paper-service"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useMarketPrices } from "@/features/market/use-market-prices"
import type { MarketHotTrade } from "@/lib/types"
import { formatAssetPrice } from "@/lib/format"

interface PaperTradeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tradeStr: {
        symbol: string
        assetClass: MarketHotTrade["assetClass"]
        side: "buy" | "sell"
        price?: number
    }
}

export function PaperTradeDialog({ open, onOpenChange, tradeStr }: PaperTradeDialogProps) {
    const { user } = useAuth()
    const { prices, livePrices } = useMarketPrices()
    const [amount, setAmount] = useState("1000") // Default $1000
    const [mode, setMode] = useState<"usd" | "share">("usd")
    const [side, setSide] = useState<"buy" | "sell">(tradeStr.side)
    const [stopLoss, setStopLoss] = useState("")
    const [takeProfit, setTakeProfit] = useState("")
    const [loading, setLoading] = useState(false)

    const livePrice = prices[tradeStr.symbol] ?? tradeStr.price ?? 100
    const price = livePrice

    // Calculate derived values
    const quantity = mode === "usd"
        ? parseFloat(amount) / price
        : parseFloat(amount)

    const totalCost = mode === "usd"
        ? parseFloat(amount)
        : parseFloat(amount) * price

    async function handleTrade() {
        if (!user) {
            toast.error("You must be logged in")
            return
        }

        setLoading(true)
        try {
            await executePaperTrade(user.uid, {
                symbol: tradeStr.symbol,
                assetClass: tradeStr.assetClass,
                side: side,
                price: price,
                quantity: quantity,
                stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
                takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
            })
            toast.success(`Executed paper ${side.toUpperCase()} for ${tradeStr.symbol}`)
            onOpenChange(false)
        } catch (err) {
            console.error(err)
            toast.error("Failed to place paper trade")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Paper Trade: {tradeStr.symbol}</DialogTitle>
                    <DialogDescription>
                        Placing a {side.toUpperCase()} order at ${formatAssetPrice(price, tradeStr.assetClass)}
                        {livePrices[tradeStr.symbol] && " (Live)"}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Side Toggle */}
                    <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="buy" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700">Buy / Long</TabsTrigger>
                            <TabsTrigger value="sell" className="data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-700">Sell / Short</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Amount Mode */}
                    <Tabs value={mode} onValueChange={(v) => setMode(v as "usd" | "share")} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="usd">Amount ($)</TabsTrigger>
                            <TabsTrigger value="share">Quantity (Units)</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">
                            {mode === "usd" ? "Value" : "Units"}
                        </Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="col-span-3"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="stopLoss">Stop Loss ($)</Label>
                            <Input
                                id="stopLoss"
                                type="number"
                                placeholder="Optional"
                                value={stopLoss}
                                onChange={e => setStopLoss(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="takeProfit">Take Profit ($)</Label>
                            <Input
                                id="takeProfit"
                                type="number"
                                placeholder="Optional"
                                value={takeProfit}
                                onChange={e => setTakeProfit(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-lg bg-muted p-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Est. Quantity:</span>
                            <span className="font-medium">{quantity.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Value:</span>
                            <span className="font-medium">${totalCost.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleTrade}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        variant={side === "buy" ? "default" : "destructive"}
                    >
                        {loading ? "Trading..." : `Confirm ${side.toUpperCase()}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
