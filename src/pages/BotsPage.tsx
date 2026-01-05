import { useEffect, useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { collection, onSnapshot } from "firebase/firestore"
import { db, firebaseEnabled } from "@/lib/firebase"
import type { BotDoc } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseEnabled || !db) {
      setLoading(false)
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

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Inventory</div>
        <div className="text-2xl font-semibold">Bots</div>
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
          ) : (
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
                {bots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm opacity-70">
                      No bots yet. Create a <code>bots</code> collection in Firestore and start writing docs.
                    </TableCell>
                  </TableRow>
                ) : (
                  bots.map((bot) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
