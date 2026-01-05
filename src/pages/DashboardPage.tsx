import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { collection, collectionGroup, limit, onSnapshot, orderBy, query } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotDoc, BotEventDoc, BotSignalDoc } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatTimestamp } from "@/lib/format"
import { StatusBadge } from "@/components/StatusBadge"

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

export default function DashboardPage() {
  const [bots, setBots] = useState<BotDoc[]>([])
  const [events, setEvents] = useState<BotEventDoc[]>([])
  const [signals, setSignals] = useState<BotSignalDoc[]>([])
  const [loadingBots, setLoadingBots] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Overview</div>
          <div className="text-2xl font-semibold">Fleet Health</div>
        </div>
        <Badge variant="outline">{totalBots} bots tracked</Badge>
      </div>

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
        <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
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
              <div className="text-sm opacity-70">Loading events…</div>
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
                    <div className="text-sm opacity-80">
                      {event.message || "Adapter emitted an event without a message."}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="reveal" style={{ "--delay": "320ms" } as CSSProperties}>
          <CardHeader>
            <CardTitle className="text-base">Bot Matrix</CardTitle>
            <div className="text-xs text-muted-foreground">Current statuses pulled from bots collection</div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!firebaseEnabled ? (
              <div className="text-sm opacity-70">Connect Firebase to load bot metadata.</div>
            ) : loadingBots ? (
              <div className="text-sm opacity-70">Loading bots…</div>
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

      <Card className="reveal" style={{ "--delay": "380ms" } as CSSProperties}>
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
            <div className="text-sm opacity-70">Loading signals…</div>
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
                  <div className="text-sm font-medium">{signal.message || "Signal detected"}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
