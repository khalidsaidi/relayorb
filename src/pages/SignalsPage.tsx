import { useEffect, useState, type CSSProperties } from "react"
import {
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore"
import type { DocumentData, QuerySnapshot } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotSignalDoc } from "@/lib/types"
import { formatTimestamp } from "@/lib/format"

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

export default function SignalsPage() {
  const [signals, setSignals] = useState<BotSignalDoc[]>([])
  const [loading, setLoading] = useState(() => firebaseEnabled && !!db)

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      return
    }

    const activeDb = db
    let didFallback = false
    let unsubscribe = () => {}

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
      setSignals(nextSignals.slice(0, 30))
      setLoading(false)
    }

    const subscribe = (ordered: boolean) => {
      const baseRef = collectionGroup(activeDb, "signals")
      const ref = ordered
        ? query(baseRef, orderBy("createdAt", "desc"), limit(30))
        : query(baseRef, limit(50))
      unsubscribe = onSnapshot(
        ref,
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
          setLoading(false)
        }
      )
    }

    subscribe(true)
    return () => unsubscribe()
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
          <Badge variant="outline">{signals.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {!firebaseEnabled ? (
            <div className="text-sm opacity-70">Configure Firebase in <code>.env</code> to view signals.</div>
          ) : loading ? (
            <div className="text-sm opacity-70">Loading signals…</div>
          ) : signals.length === 0 ? (
            <div className="text-sm opacity-70">
              No signals yet. Adapters should write to <code>bots/{'{botId}'}/signals</code>.
            </div>
          ) : (
            signals.map((signal) => (
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
