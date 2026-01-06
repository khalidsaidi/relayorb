import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { collection, onSnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotDoc } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/StatusBadge"
import { formatTimestamp } from "@/lib/format"

export default function BotsPage() {
  const [bots, setBots] = useState<BotDoc[]>([])
  const [loading, setLoading] = useState(() => firebaseEnabled && !!db)

  useEffect(() => {
    if (!firebaseEnabled || !db) {
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
      setLoading(false)
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

  const statusBadges = [
    { label: "Online", value: statusCounts.online, className: "bg-emerald-500/15 text-emerald-800" },
    { label: "Idle", value: statusCounts.idle, className: "bg-sky-500/15 text-sky-700" },
    { label: "Offline", value: statusCounts.offline, className: "bg-slate-500/10 text-slate-700" },
    { label: "Error", value: statusCounts.error, className: "bg-rose-500/15 text-rose-700" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Inventory</div>
          <div className="text-2xl font-semibold">Bots</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {statusBadges.map((badge) => (
            <Badge key={badge.label} variant="outline" className={badge.className}>
              {badge.label} {badge.value}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="reveal" style={{ "--delay": "100ms" } as CSSProperties}>
        <CardHeader>
          <CardTitle className="text-base">Connected bot instances</CardTitle>
        </CardHeader>
        <CardContent>
          {!firebaseEnabled ? (
            <div className="text-sm opacity-70">Configure Firebase in <code>.env</code> to load bots.</div>
          ) : loading ? (
            <div className="text-sm opacity-70">Loading bots…</div>
          ) : bots.length === 0 ? (
            <div className="text-sm opacity-70">
              No bots yet. Create a <code>bots</code> collection in Firestore and start writing docs.
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {bots.map((bot) => (
                  <Link
                    key={bot.id}
                    to={`/bots/${bot.id}`}
                    className="group rounded-2xl border border-border/60 bg-background/70 p-4 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.6)] transition hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{bot.name || bot.id}</div>
                        <div className="text-xs text-muted-foreground">{bot.engine || "unknown engine"}</div>
                        <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/80">
                          {bot.id}
                        </div>
                      </div>
                      <StatusBadge status={bot.status} />
                    </div>
                    <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <div className="text-[0.55rem] uppercase tracking-[0.25em]">Exchange</div>
                        <div className="text-sm text-foreground">{bot.desiredConfig?.exchange || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[0.55rem] uppercase tracking-[0.25em]">Timeframe</div>
                        <div className="text-sm text-foreground">{bot.desiredConfig?.timeframe || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[0.55rem] uppercase tracking-[0.25em]">Heartbeat</div>
                        <div className="text-sm text-foreground">{formatTimestamp(bot.lastHeartbeat)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Exchange</TableHead>
                      <TableHead>Timeframe</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Heartbeat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bots.map((bot) => (
                      <TableRow key={bot.id}>
                        <TableCell className="font-mono text-xs">
                          <Link className="underline-offset-2 hover:underline" to={`/bots/${bot.id}`}>
                            {bot.id}
                          </Link>
                        </TableCell>
                        <TableCell>{bot.engine || "unknown"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {bot.desiredConfig?.exchange || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {bot.desiredConfig?.timeframe || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={bot.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatTimestamp(bot.lastHeartbeat)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
