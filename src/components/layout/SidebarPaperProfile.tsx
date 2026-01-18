import { useEffect, useState } from "react"
import { collection, doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Wallet, TrendingUp, TrendingDown } from "lucide-react"
import type { PaperWallet } from "@/lib/types"
import { useTranslation } from "react-i18next"

export function SidebarPaperProfile({ userId, collapsed }: { userId: string; collapsed?: boolean }) {
    const [wallet, setWallet] = useState<PaperWallet | null>(null)
    const [positionCount, setPositionCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const { t } = useTranslation()

    useEffect(() => {
        if (!db || !userId) return

        const unsubWallet = onSnapshot(doc(db, "users", userId, "paper", "wallet"), (doc) => {
            setLoading(false)
            if (doc.exists()) {
                setWallet(doc.data() as PaperWallet)
            } else {
                setWallet(null)
            }
        })

        const unsubPositions = onSnapshot(collection(db, "users", userId, "paper", "wallet", "positions"), (snap) => {
            setPositionCount(snap.size)
        })

        return () => {
            unsubWallet()
            unsubPositions()
        }
    }, [userId])

    if (loading || !wallet) return null

    const startBalance = 100000
    const pnl = wallet.balance - startBalance
    const pnlPercent = (pnl / startBalance) * 100
    const isPositive = pnl >= 0

    if (collapsed) {
        return (
            <div
                className="flex flex-col items-center py-2"
                title={t("paper.balanceLabel", { balance: formatCurrency(wallet.balance) })}
            >
                <div className="rounded-full bg-blue-500/10 p-2 text-blue-600 shadow-sm ring-1 ring-blue-500/20">
                    <Wallet className="h-4 w-4" />
                </div>
                <div className={["mt-1 text-[10px] font-bold", isPositive ? "text-emerald-600" : "text-rose-600"].join(" ")}>
                    {isPositive ? "+" : ""}{Math.abs(pnlPercent).toFixed(0)}%
                </div>
            </div>
        )
    }

    return (
        <div className="mx-2 mt-4 rounded-2xl bg-muted/40 p-4 ring-1 ring-border/40 backdrop-blur-sm shadow-sm transition-all hover:bg-muted/60">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600">
                        <Wallet className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        {t("paper.paperWallet")}
                    </span>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-blue-500/5 text-blue-700 border-blue-500/20">
                    SIM
                </Badge>
            </div>

            <div className="space-y-1 mb-3">
                <div className="text-lg font-bold tracking-tight">{formatCurrency(wallet.balance)}</div>
                <div className="flex items-center gap-1.5">
                    {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                    ) : (
                        <TrendingDown className="h-3 w-3 text-rose-600" />
                    )}
                    <span className={["text-xs font-medium", isPositive ? "text-emerald-600" : "text-rose-600"].join(" ")}>
                        {isPositive ? "+" : "-"}{pnlPercent.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">{t("paper.overallPnl")}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-border/40 pt-3 mt-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-tighter text-muted-foreground/70">
                        {t("paper.openPositions")}
                    </span>
                    <span className="text-xs font-bold font-mono">{positionCount}</span>
                </div>
            </div>
        </div>
    )
}
