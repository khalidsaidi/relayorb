import { useMemo, type ReactNode } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LayoutDashboard, TerminalSquare, Newspaper, Radar, LogOut, ExternalLink, HeartPulse } from "lucide-react"
import { useAuth } from "@/features/auth/auth-context"
import { auth, firebaseEnabled } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { resolveFinnewsUrl, resolveOpenbbApiUrl, resolveStockpulseUrl } from "@/lib/runtime-urls"
import { fetchJsonOrThrow } from "@/lib/http"
import { toast } from "sonner"
import { AlertsBell } from "@/features/alerts/AlertsBell"

type NavItem = {
  to: string
  label: string
  icon: ReactNode
}

function getPageTitle(pathname: string, t: (key: string) => string) {
  if (pathname.startsWith("/trader")) return t("nav.trader")
  if (pathname.startsWith("/openbb")) return t("nav.openbb")
  if (pathname.startsWith("/finnews")) return t("nav.finnews")
  if (pathname.startsWith("/stockpulse")) return t("nav.stockpulse")
  return t("nav.trader")
}

export function AppShell() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageTitle = useMemo(() => getPageTitle(pathname, t), [pathname, t])
  const openbbUrl = useMemo(() => resolveOpenbbApiUrl(), [])
  const finnewsUrl = useMemo(() => resolveFinnewsUrl(), [])
  const stockpulseUrl = useMemo(() => resolveStockpulseUrl(), [])

  const endpointHint = useMemo(() => {
    const urls = [openbbUrl, finnewsUrl, stockpulseUrl].filter(Boolean)
    if (!urls.length) return "unconfigured"
    const host = (() => {
      try {
        return new URL(urls[0]).host
      } catch {
        return ""
      }
    })()
    if (!host) return "custom"
    if (host.includes("sslip.io")) return "vm"
    return "custom"
  }, [openbbUrl, finnewsUrl, stockpulseUrl])

  async function checkAllHealth() {
    const checks: Array<{ service: string; url: string }> = []
    if (openbbUrl) checks.push({ service: "OpenBB", url: `${openbbUrl}/openapi.json` })
    if (stockpulseUrl) checks.push({ service: "StockPulse", url: `${stockpulseUrl}/api/status` })
    if (finnewsUrl) checks.push({ service: "Finnews", url: `${finnewsUrl}/health` })

    if (!checks.length) {
      toast.error("No endpoints configured in env.")
      return
    }

    try {
      await Promise.all(
        checks.map((c) => fetchJsonOrThrow(c.service, c.url, undefined, 15000))
      )
      toast.success("All services healthy")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    }
  }

  const navItems: NavItem[] = [
    { to: "/trader", label: t("nav.trader"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/openbb", label: t("nav.openbb"), icon: <TerminalSquare className="h-4 w-4" /> },
    { to: "/finnews", label: t("nav.finnews"), icon: <Newspaper className="h-4 w-4" /> },
    { to: "/stockpulse", label: t("nav.stockpulse"), icon: <Radar className="h-4 w-4" /> },
  ]

  async function doSignOut() {
    if (!firebaseEnabled || !auth) return
    await signOut(auth)
    navigate("/signin", { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="grid min-h-screen grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-border/60 bg-background/80 p-4">
          <div className="text-sm font-semibold text-foreground">RelayOrb</div>
          <nav className="mt-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive ? "bg-muted/70 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-h-screen">
          <header className="flex items-center justify-between gap-4 border-b border-border/60 bg-background/60 px-6 py-4">
            <div className="min-w-0 text-lg font-semibold text-foreground truncate">{pageTitle}</div>
            <div className="flex items-center gap-3 shrink-0">
              <AlertsBell />
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                    <HeartPulse className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Endpoints</span>
                    <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                      {endpointHint.toUpperCase()}
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[360px] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Current endpoints</div>
                      <div className="text-xs text-muted-foreground">
                        These URLs are compiled from your `VITE_*` env at build time.
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={checkAllHealth}>
                      Health
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    {[
                      { label: "OpenBB", url: openbbUrl, openPath: "" },
                      { label: "Finnews", url: finnewsUrl, openPath: "" },
                      { label: "StockPulse", url: stockpulseUrl, openPath: "" },
                    ].map((row) => (
                      <div key={row.label} className="rounded-lg border border-border/60 bg-muted/20 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-foreground">{row.label}</div>
                          {row.url ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(row.url, "_blank", "noopener,noreferrer")}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="text-[11px]">Open</span>
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                          {row.url || "(not configured)"}
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Avatar className="h-8 w-8">
                <AvatarFallback>{user?.email?.slice(0, 2)?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              {firebaseEnabled ? (
                <Button size="sm" variant="outline" onClick={doSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.signOut")}
                </Button>
              ) : null}
            </div>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
