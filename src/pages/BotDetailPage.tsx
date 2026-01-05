import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Link, useParams } from "react-router-dom"
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore"
import { toast } from "sonner"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotCommandType, BotDoc, BotEventDoc } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/StatusBadge"
import { formatTimestamp } from "@/lib/format"
import { useAuth } from "@/features/auth/AuthProvider"

const commandOptions: { type: BotCommandType; label: string }[] = [
  { type: "start", label: "Start" },
  { type: "stop", label: "Stop" },
  { type: "restart", label: "Restart" },
  { type: "backtest", label: "Backtest" },
  { type: "paper", label: "Paper" },
  { type: "live", label: "Live" },
  { type: "reload_config", label: "Reload Config" },
]

export default function BotDetailPage() {
  const { botId } = useParams()
  const { user } = useAuth()
  const [bot, setBot] = useState<BotDoc | null>(null)
  const [events, setEvents] = useState<BotEventDoc[]>([])
  const [loadingBot, setLoadingBot] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [payload, setPayload] = useState("{}")
  const [payloadError, setPayloadError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const commandDisabled = sending || !firebaseEnabled

  useEffect(() => {
    if (!botId || !firebaseEnabled || !db) {
      setLoadingBot(false)
      return
    }

    const ref = doc(db, "bots", botId)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setBot(null)
        setLoadingBot(false)
        return
      }
      const data = snap.data() as Omit<BotDoc, "id">
      setBot({ id: snap.id, ...data })
      setLoadingBot(false)
    })
  }, [botId])

  useEffect(() => {
    if (!botId || !firebaseEnabled || !db) {
      setLoadingEvents(false)
      return
    }

    const eventsQuery = query(
      collection(db, "bots", botId, "events"),
      orderBy("createdAt", "desc"),
      limit(15)
    )

    return onSnapshot(eventsQuery, (snap) => {
      setEvents(
        snap.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<BotEventDoc, "id" | "botId">
          return { id: docSnap.id, botId, ...data }
        })
      )
      setLoadingEvents(false)
    })
  }, [botId])

  const summary = useMemo(() => {
    return [
      { label: "Positions", value: bot?.summary?.positions ?? "—" },
      { label: "Orders", value: bot?.summary?.orders ?? "—" },
      { label: "PnL", value: bot?.summary?.pnl ?? "—" },
    ]
  }, [bot])

  async function queueCommand(type: BotCommandType) {
    if (!botId) return
    if (!firebaseEnabled || !db) {
      toast.error("Firebase not configured")
      return
    }

    setPayloadError(null)
    setSending(true)

    let parsedPayload: Record<string, unknown> | undefined
    const trimmed = payload.trim()
    if (trimmed.length > 0) {
      try {
        parsedPayload = JSON.parse(trimmed)
      } catch (err) {
        setPayloadError("Payload must be valid JSON")
        setSending(false)
        return
      }
    }

    try {
      const command: Record<string, unknown> = {
        type,
        status: "queued",
        createdAt: serverTimestamp(),
        requestedBy: user?.email ?? "unknown",
      }
      if (parsedPayload && Object.keys(parsedPayload).length > 0) {
        command.payload = parsedPayload
      }

      await addDoc(collection(db, "bots", botId, "commands"), command)
      toast.success("Command queued")
    } catch (err) {
      toast.error("Failed to queue command")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Bot Detail</div>
          <div className="text-2xl font-semibold">{bot?.name || botId}</div>
        </div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/bots">
          ← Back to bots
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="reveal" style={{ "--delay": "120ms" } as CSSProperties}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Status & Metadata</CardTitle>
            <StatusBadge status={bot?.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            {!firebaseEnabled ? (
              <div className="text-sm opacity-70">Configure Firebase to load bot details.</div>
            ) : loadingBot ? (
              <div className="text-sm opacity-70">Loading bot…</div>
            ) : !bot ? (
              <div className="text-sm opacity-70">Bot not found.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {summary.map((item) => (
                    <div key={item.label} className="rounded-lg border border-border/60 bg-background/70 p-3">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-lg font-semibold">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Engine</div>
                    <div className="text-sm font-medium">{bot.engine || "unknown"}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Last Heartbeat</div>
                    <div className="text-sm font-medium">{formatTimestamp(bot.lastHeartbeat)}</div>
                  </div>
                </div>
                {bot.state && (
                  <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="text-xs text-muted-foreground">Latest Trading State</div>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                      {JSON.stringify(bot.state, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="reveal" style={{ "--delay": "180ms" } as CSSProperties}>
          <CardHeader>
            <CardTitle className="text-base">Command Console</CardTitle>
            <div className="text-xs text-muted-foreground">
              Commands are queued into <code>bots/{botId}/commands</code>.
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              {commandOptions.map((option) => (
                <Button
                  key={option.type}
                  variant="outline"
                  className="justify-start"
                  disabled={commandDisabled}
                  onClick={() => queueCommand(option.type)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {!firebaseEnabled && (
              <div className="text-xs text-muted-foreground">
                Firebase is not configured. Update <code>.env</code> to enable commands.
              </div>
            )}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Optional JSON payload</div>
              <Textarea
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                className="min-h-28 font-mono text-xs"
              />
              {payloadError && <div className="text-xs text-destructive">{payloadError}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="reveal" style={{ "--delay": "240ms" } as CSSProperties}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Events</CardTitle>
          <Badge variant="outline">{events.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {!firebaseEnabled ? (
            <div className="text-sm opacity-70">Configure Firebase to load events.</div>
          ) : loadingEvents ? (
            <div className="text-sm opacity-70">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="text-sm opacity-70">No events yet.</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{event.type || "event"}</span>
                  <span>{formatTimestamp(event.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm font-medium">
                  {event.message || "Adapter emitted an event without a message."}
                </div>
                {event.data && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                    {JSON.stringify(event.data, null, 2)}
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
