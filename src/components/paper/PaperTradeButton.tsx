import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlayCircle } from "lucide-react"
import { PaperTradeDialog } from "./PaperTradeDialog"
import type { MarketHotTrade } from "@/lib/types"
import { useTranslation } from "react-i18next"

interface PaperTradeButtonProps {
    trade: MarketHotTrade
    className?: string
    size?: "default" | "sm" | "lg" | "icon"
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    children?: React.ReactNode
}

export function PaperTradeButton({
    trade,
    className,
    size = "icon",
    variant = "ghost",
    children
}: PaperTradeButtonProps) {
    const [open, setOpen] = useState(false)
    const { t } = useTranslation()

    // Ensure side is valid, default to 'buy' if missing
    const side = trade.side === "sell" ? "sell" : "buy"

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={(e) => {
                    e.stopPropagation() // Prevent parent row click if any
                    setOpen(true)
                }}
                title={t("paper.tradeTitle", { side: side.toUpperCase(), symbol: trade.symbol })}
            >
                {children ? children : (
                    <>
                        <PlayCircle className="h-4 w-4" />
                        <span className="sr-only">{t("paper.tradeButton")}</span>
                    </>
                )}
            </Button>

            <PaperTradeDialog
                open={open}
                onOpenChange={setOpen}
                tradeStr={{
                    symbol: trade.symbol,
                    assetClass: trade.assetClass,
                    side: side,
                    price: trade.price,
                }}
            />
        </>
    )
}
