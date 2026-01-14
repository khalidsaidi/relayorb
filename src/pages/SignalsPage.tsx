import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore"
import type { DocumentData, QuerySnapshot, Unsubscribe } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotSignalDoc } from "@/lib/types"
import { formatTimestamp } from "@/lib/format"
import { SignalMarketIndicator } from "@/components/SignalMarketIndicator"
import { useStreamSymbols } from "@/features/market/use-stream-symbols"

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

function extractSignalSymbol(signal: BotSignalDoc) {
  return (
    signal.symbol ||
    (signal.data?.pair as string | undefined) ||
    (signal.data?.symbol as string | undefined) ||
    signal.evaluation?.symbol ||
    ""
  )
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<BotSignalDoc[]>([])
  const [loading, setLoading] = useState(() => firebaseEnabled && !!db)
  const [assetFilter, setAssetFilter] = useState<"all" | "crypto" | "stock" | "forex">("all")

  const streamItems = useMemo(
    () =>
      signals
        .map((signal) => ({
          symbol: extractSignalSymbol(signal),
          assetClass:
            signal.evaluation?.assetClass ||
            (typeof signal.data?.assetClass === "string" ? signal.data.assetClass : undefined),
        }))
        .filter((entry) => entry.symbol),
    [signals]
  )

  const filteredSignals = useMemo(() => {
    if (assetFilter === "all") return signals
    return signals.filter((signal) => {
      const assetClass =
        signal.evaluation?.assetClass ||
        (typeof signal.data?.assetClass === "string" ? signal.data.assetClass : undefined)
      return assetClass === assetFilter
    })
  }, [signals, assetFilter])

  useStreamSymbols("signals", {
    items: streamItems,
    enabled: !loading,
  })

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }

    const activeDb = db
    const unsubscribes: Unsubscribe[] = []
    // Track signals per bot for merging
    const signalsByBot: Record<string, BotSignalDoc[]> = {}

    // Bots to query - fetch signals from each to ensure balanced representation
    const botConfigs = [
      { botId: "backtrader-crypto", perBot: 15 },
      { botId: "backtrader-stocks", perBot: 15 },
      { botId: "backtrader-forex", perBot: 15 },
      { botId: "market-intel", perBot: 5 },
    ]

    const mergeAndUpdate = () => {
      const allSignals = Object.values(signalsByBot).flat()
      allSignals.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0
        const bTime = b.createdAt?.toMillis?.() ?? 0
        return bTime - aTime
      })
      setSignals(allSignals.slice(0, 50))
      setLoading(false)
    }

    for (const { botId, perBot } of botConfigs) {
      const ref = query(
        collection(activeDb, "bots", botId, "signals"),
        orderBy("createdAt", "desc"),
        limit(perBot)
      )
      const unsub = onSnapshot(
        ref,
        (snap: QuerySnapshot<DocumentData>) => {
          signalsByBot[botId] = snap.docs.map((doc) => {
            const data = doc.data() as Omit<BotSignalDoc, "id" | "botId">
            return { id: doc.id, botId, ...data }
          })
          mergeAndUpdate()
        },
        (error) => {
          console.error(`Signals listener error for ${botId}`, error)
          setLoading(false)
        }
      )
      unsubscribes.push(unsub)
    }

    return () => {
      for (const unsub of unsubscribes) {
        unsub()
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Signals</div>
        <div className="text-2xl font-semibold">Trading Signals</div>
      </div>

      <Card className="reveal" style={{ "--delay": "120ms" } as CSSProperties}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Signal Feed</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1">
              {[
                { value: "all", label: "All" },
                { value: "crypto", label: "Crypto" },
                { value: "stock", label: "Stocks" },
                { value: "forex", label: "FX" },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={assetFilter === filter.value ? "secondary" : "ghost"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() =>
                    setAssetFilter(filter.value as "all" | "crypto" | "stock" | "forex")
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <Badge variant="outline">{filteredSignals.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!firebaseEnabled ? (
            <div className="text-sm opacity-70">Configure Firebase in <code>.env</code> to view signals.</div>
          ) : loading ? (
            <div className="text-sm opacity-70">Loading signals…</div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-sm opacity-70">
              {signals.length === 0
                ? <>No signals yet. Adapters should write to <code>bots/{'{botId}'}/signals</code>.</>
                : `No ${assetFilter} signals found. Try a different filter.`}
            </div>
          ) : (
            filteredSignals.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{signal.botId}</span>
                  <span>{formatTimestamp(signal.createdAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {signal.side && (
                    <Badge variant={signalBadgeVariant(signal.side)} className="uppercase">
                      {signal.side}
                    </Badge>
                  )}
                  {typeof signal.strength === "number" && (
                    <Badge variant="secondary">Strength {signal.strength.toFixed(2)}</Badge>
                  )}
                  <SignalMarketIndicator signal={signal} />
                  <div className="text-sm font-medium">
                    {signal.message || "Signal detected"}
                  </div>
                </div>
                {signal.data && (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs">
                    {JSON.stringify(signal.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
