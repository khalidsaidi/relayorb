import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Bell, RefreshCw, Trash2 } from "lucide-react"
import { useInAppAlerts } from "@/features/alerts/use-inapp-alerts"

function formatRelative(value?: string) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const diffMs = Date.now() - parsed.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatUntil(ms: number) {
  const n = Number(ms || 0)
  if (!Number.isFinite(n) || n <= 0) return "-"
  const diffMs = n - Date.now()
  if (diffMs <= 0) return "now"
  const minutes = Math.ceil(diffMs / 60000)
  if (minutes <= 1) return "in 1m"
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.ceil(hours / 24)
  return `in ${days}d`
}

export function AlertsBell() {
  const {
    alerts,
    unreadCount,
    settings,
    setSettings,
    isMuted,
    mutedUntilMs,
    muteForMs,
    muteUntilEndOfDay,
    unmute,
    pollNow,
    clearAlerts,
    markAllRead,
    finnewsBase,
    stockpulseBase,
  } = useInAppAlerts()

  const [open, setOpen] = useState(false)

  const canRun = Boolean(finnewsBase || stockpulseBase)

  const pollOptions = useMemo(() => [15, 30, 60, 300], [])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) markAllRead()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center rounded-full border border-border/60 bg-background/70 p-2 text-muted-foreground hover:text-foreground"
          title="Alerts"
        >
          <Bell className="h-4 w-4" />
          {unreadCount ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Alerts</div>
            <div className="text-xs text-muted-foreground">
              New SEC filings, rating changes, and RSI threshold crossings for your OpenBB watchlist.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!canRun} onClick={() => void pollNow()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Poll
            </Button>
            <Button size="sm" variant="outline" onClick={clearAlerts} disabled={!alerts.length}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            <span className="text-muted-foreground">Enabled</span>
          </label>

          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Poll interval</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={String(settings.pollIntervalSec)}
                onChange={(e) => setSettings((prev) => ({ ...prev, pollIntervalSec: Number(e.target.value) }))}
              >
                {pollOptions.map((s) => (
                  <option key={s} value={String(s)}>
                    {s}s
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={settings.enableFilings}
              onChange={(e) => setSettings((prev) => ({ ...prev, enableFilings: e.target.checked }))}
            />
            <span className="text-muted-foreground">Filings</span>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={settings.enableRatingChanges}
              onChange={(e) => setSettings((prev) => ({ ...prev, enableRatingChanges: e.target.checked }))}
            />
            <span className="text-muted-foreground">Ratings</span>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={settings.enableRsiThresholds}
              onChange={(e) => setSettings((prev) => ({ ...prev, enableRsiThresholds: e.target.checked }))}
            />
            <span className="text-muted-foreground">RSI</span>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">RSI thresholds</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Oversold</Label>
                <Input
                  className="h-8 text-xs"
                  value={String(settings.rsiOversold)}
                  onChange={(e) => setSettings((prev) => ({ ...prev, rsiOversold: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Overbought</Label>
                <Input
                  className="h-8 text-xs"
                  value={String(settings.rsiOverbought)}
                  onChange={(e) => setSettings((prev) => ({ ...prev, rsiOverbought: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              RSI is taken from StockPulse ratings (fast). You’ll get an alert when RSI crosses into oversold/overbought.
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.toastOnNew}
                onChange={(e) => setSettings((prev) => ({ ...prev, toastOnNew: e.target.checked }))}
              />
              <span className="text-muted-foreground">Toast on new alerts</span>
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={isMuted ? "destructive" : "secondary"} className="text-[10px]">
                {isMuted ? `Muted ${formatUntil(mutedUntilMs)}` : "Live"}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => muteForMs(60 * 60 * 1000)}
                disabled={isMuted}
                title="Mute toasts for 1 hour"
              >
                Mute 1h
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={muteUntilEndOfDay}
                disabled={isMuted}
                title="Mute toasts until the end of your local day"
              >
                Mute today
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={unmute}
                disabled={!isMuted}
              >
                Unmute
              </Button>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Muting only disables toast popups. Alerts still record in the list.
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-foreground">Recent</div>
            <Badge variant="secondary" className="text-[10px]">
              {alerts.length}
            </Badge>
          </div>

          {!alerts.length ? (
            <div className="mt-2 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              No alerts yet. Add tickers in OpenBB → Watchlist (or run a lookup in Trader), enable alert toggles, then click Poll.
            </div>
          ) : (
            <div className="mt-2 max-h-[280px] space-y-2 overflow-auto pr-1">
              {alerts.slice(0, 50).map((a) => (
                <div key={a.id} className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{a.ticker}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {a.type}
                        </Badge>
                      </div>
                      <div className="mt-1 text-foreground">{a.title}</div>
                      {a.body ? <div className="mt-1 text-muted-foreground line-clamp-2">{a.body}</div> : null}
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                      {formatRelative(a.createdAt)}
                      {a.url ? (
                        <div className="mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
                          >
                            Open
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
