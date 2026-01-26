import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Bot,
  LogOut,
  Menu,
  Activity,
  PanelLeft,
  PanelRight,
  TrendingUp,
  BarChart3,
  LineChart,
  BadgeDollarSign,
  Target,
  Languages,
} from "lucide-react"
import { useAuth } from "@/features/auth/auth-context"
import { auth, db, firebaseEnabled } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { toast } from "sonner"
import { SidebarBrokerProfile } from "./SidebarPaperProfile"
import { usePresence } from "@/features/presence/use-presence"
import { PipelineHealthBadge } from "@/components/PipelineHealthBadge"
import { AuthDebugBadge } from "@/components/AuthDebugBadge"
import { languageOptions, setStoredLanguage, type SupportedLanguage } from "@/i18n"
import { useReplayControls } from "@/features/replay/use-replay-controls"
import { ReplayControlsPanel } from "@/components/ReplayControlsPanel"
import { useIbkrAccount } from "@/features/ibkr/use-ibkr-account"
import { formatTimestamp } from "@/lib/format"

type NavItem = {
  to: string
  label: string
  icon: ReactNode
}

const SIDEBAR_STORAGE_KEY = "relayorb.sidebar.collapsed"

function getPageTitle(pathname: string, t: (key: string) => string) {
  if (pathname === "/") return t("nav.tradeNow")
  if (pathname.startsWith("/bots/")) return t("nav.botDetail")
  if (pathname.startsWith("/bots")) return t("nav.bots")
  if (pathname.startsWith("/signals")) return t("nav.signals")
  if (pathname.startsWith("/ibkr")) return t("nav.ibkrOrder")
  if (pathname.startsWith("/orb")) return t("nav.orbRobot")
  if (pathname.startsWith("/charts")) return t("nav.liveCharts")
  if (pathname.startsWith("/portfolio")) return t("nav.portfolio")
  if (pathname.startsWith("/dashboard")) return t("nav.dashboard")
  return t("nav.dashboard")
}

function NavItemLink({
  to,
  icon,
  label,
  collapsed,
}: NavItem & { collapsed?: boolean }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        [
          "flex items-center rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition",
          collapsed ? "justify-center" : "gap-2",
          isActive
            ? "bg-background/80 text-foreground shadow-sm ring-1 ring-border/60"
            : "hover:bg-muted/60 hover:text-foreground",
        ].join(" ")
      }
    >
      {icon}
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
    </NavLink>
  )
}

export function AppShell() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageTitle = useMemo(() => getPageTitle(pathname, t), [pathname, t])
  const { controls: replayControls, replayActive } = useReplayControls()
  const { brokerAccountKey, brokerAccount, tradingControls } = useIbkrAccount(user?.uid)
  const replayAsOfLabel = useMemo(
    () => formatTimestamp(replayControls?.asOf as Parameters<typeof formatTimestamp>[0]),
    [replayControls?.asOf]
  )
  const replayRequired = useMemo(() => {
    const list = Array.isArray(replayControls?.requiredServices)
      ? replayControls.requiredServices
      : []
    const filtered = list.filter((service) => service !== "ui")
    return filtered.length ? filtered : ["mdg", "price-streamer", "market-intel", "signal-evaluator"]
  }, [replayControls?.requiredServices])
  const replayPlaybackLabel = useMemo(() => {
    if (!replayActive) return t("replay.controls.playbackStopped")
    return replayControls?.phase === "paused"
      ? t("replay.controls.playbackPaused")
      : t("replay.controls.playbackRunning")
  }, [replayActive, replayControls?.phase, t])
  const replayDesiredMode = replayControls?.desiredMode ?? "live"
  const replayRunId = replayControls?.activeRunId ?? ""
  const replayDatasetId = replayControls?.datasetId ?? ""
  const replaySpeedScript =
    Array.isArray(replayControls?.speedScript) && replayControls.speedScript.length
      ? replayControls.speedScript
      : [{ speed: 1 }]
  const replayBotsEnabled = replayControls?.botsReplayEnabled === true
  const canWriteReplayControls = Boolean(firebaseEnabled && db)

  const navItems: NavItem[] = [
    { to: "/", label: t("nav.tradeNow"), icon: <TrendingUp className="h-4 w-4" /> },
    { to: "/dashboard", label: t("nav.dashboard"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/charts", label: t("nav.liveCharts"), icon: <LineChart className="h-4 w-4" /> },
    { to: "/ibkr", label: t("nav.ibkrOrder"), icon: <BadgeDollarSign className="h-4 w-4" /> },
    { to: "/orb", label: t("nav.orbRobot"), icon: <Target className="h-4 w-4" /> },
    { to: "/signals", label: t("nav.signals"), icon: <Activity className="h-4 w-4" /> },
    { to: "/bots", label: t("nav.bots"), icon: <Bot className="h-4 w-4" /> },
    { to: "/portfolio", label: t("nav.portfolio"), icon: <BarChart3 className="h-4 w-4" /> },
  ]
  
  // Track user presence for activity-based refresh
  usePresence()
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1"
  })
  const [replaySheetOpen, setReplaySheetOpen] = useState(false)
  const [replayToggleBusy, setReplayToggleBusy] = useState(false)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0")
  }, [sidebarCollapsed])

  async function doSignOut() {
    if (!firebaseEnabled || !auth) return
    await signOut(auth)
    navigate("/signin", { replace: true })
  }

  function nextReplayVersion() {
    const current = typeof replayControls?.version === "number" ? replayControls.version : 0
    return current + 1
  }

  async function updateReplayControls(patch: Record<string, unknown>, successMessage: string) {
    if (!canWriteReplayControls || !db) {
      toast.error(t("replay.controls.notAvailable"))
      return
    }
    try {
      const ref = doc(db, "replay", "controls")
      await setDoc(ref, patch, { merge: true })
      toast.success(successMessage)
    } catch {
      toast.error(t("replay.controls.updateFailed"))
    }
  }

  async function handleReplayModeChange(nextMode: "live" | "replay") {
    if (replayToggleBusy) return
    if (nextMode === replayDesiredMode) return
    if (nextMode === "replay" && (!replayRunId.trim() || !replayDatasetId.trim())) {
      toast.error(t("replay.controls.runIdRequired"))
      setReplaySheetOpen(true)
      return
    }
    setReplayToggleBusy(true)
    try {
      if (nextMode === "replay") {
        await updateReplayControls(
          {
            desiredMode: "replay",
            phase: "running",
            sessionId: `session-${Date.now()}`,
            version: nextReplayVersion(),
            activeRunId: replayRunId,
            datasetId: replayDatasetId,
            requiredServices: replayRequired,
            speedScript: replaySpeedScript,
            botsReplayEnabled: replayBotsEnabled,
          },
          t("replay.controls.switchQueued")
        )
      } else {
        await updateReplayControls(
          {
            desiredMode: "live",
            mode: "live",
            phase: "idle",
            activeRunId: null,
            datasetId: null,
            sessionId: null,
            version: null,
          },
          t("replay.controls.stopped")
        )
      }
    } finally {
      setReplayToggleBusy(false)
    }
  }

  const initials =
    (user?.displayName || user?.email || "U")
      .split(" ")
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U"

  const sidebarWidth = sidebarCollapsed ? "72px" : "220px"

  return (
    <div className="app-bg min-h-svh">
      <div className="app-orbs" aria-hidden="true">
        <span className="app-orb app-orb-a" />
        <span className="app-orb app-orb-b" />
        <span className="app-orb app-orb-c" />
      </div>
      <div className="app-grid" aria-hidden="true" />

      <div
        className="relative z-10 grid min-h-svh md:grid-cols-[var(--sidebar-width)_1fr]"
        style={{ "--sidebar-width": sidebarWidth } as CSSProperties}
      >
        <aside
          className={[
            "hidden md:flex flex-col border-r/60 bg-background/70 backdrop-blur-xl transition-[width] duration-300",
            sidebarCollapsed ? "w-[72px]" : "w-[220px]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className={sidebarCollapsed ? "text-center" : ""}>
              <div className="text-xs uppercase tracking-[0.25em] opacity-60">
                {sidebarCollapsed ? "RO" : t("app.relayOrb")}
              </div>
              {!sidebarCollapsed && (
                <div className="text-lg font-semibold">{t("app.controlDeck")}</div>
              )}
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-4">
            {navItems.map((item) => (
              <NavItemLink key={item.to} {...item} collapsed={sidebarCollapsed} />
            ))}
          </nav>

          {user && (
            <SidebarBrokerProfile
              brokerAccountKey={brokerAccountKey}
              brokerAccount={brokerAccount}
              tradingControls={tradingControls}
              collapsed={sidebarCollapsed}
            />
          )}

          <div className="mt-auto px-4 pb-4">
            <Separator className="my-4" />
            <Button
              variant="outline"
              className={sidebarCollapsed ? "h-10 w-10 p-0" : "w-full"}
              onClick={doSignOut}
            >
              <LogOut className={sidebarCollapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
              {!sidebarCollapsed && t("auth.signOut")}
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex min-w-0 items-center justify-between border-b/60 bg-background/70 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label={t("app.openMenu")}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                  <SheetHeader>
                    <SheetTitle>{t("app.relayOrb")}</SheetTitle>
                    <SheetDescription className="sr-only">
                      {t("app.controlDeck")}
                    </SheetDescription>
                  </SheetHeader>
                  <nav className="mt-4 flex flex-col gap-1">
                    {navItems.map((item) => (
                      <NavItemLink key={item.to} {...item} collapsed={false} />
                    ))}
                  </nav>

                  {user && (
                    <div className="mt-4 border-t border-border/40 pt-4">
                      <SidebarBrokerProfile
                        brokerAccountKey={brokerAccountKey}
                        brokerAccount={brokerAccount}
                        tradingControls={tradingControls}
                        collapsed={false}
                      />
                    </div>
                  )}
                </SheetContent>
              </Sheet>

              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
              >
                {sidebarCollapsed ? (
                  <PanelRight className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>

              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("app.console")}
                </div>
                <div className="text-base font-semibold">{pageTitle}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {firebaseEnabled && <PipelineHealthBadge showLabel={false} />}
              {!firebaseEnabled ? (
                <Badge variant="outline">{t("app.firebaseDisabled")}</Badge>
              ) : (
                <Badge variant="secondary">{t("app.privateAccess")}</Badge>
              )}
              {brokerAccountKey ? (
                <Badge variant="outline">
                  {t("ibkr.accountLabel", { account: brokerAccountKey.toUpperCase() })}
                </Badge>
              ) : null}

              {firebaseEnabled && (
                <>
                  <div className="flex items-center rounded-full border border-border/60 bg-background/80 p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={replayDesiredMode === "live" ? "secondary" : "ghost"}
                      onClick={() => handleReplayModeChange("live")}
                      disabled={!canWriteReplayControls || replayToggleBusy}
                      aria-pressed={replayDesiredMode === "live"}
                    >
                      {t("replay.controls.mode.live")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={replayDesiredMode === "replay" ? "secondary" : "ghost"}
                      onClick={() => handleReplayModeChange("replay")}
                      disabled={!canWriteReplayControls || replayToggleBusy}
                      aria-pressed={replayDesiredMode === "replay"}
                    >
                      {t("replay.controls.mode.replay")}
                    </Button>
                  </div>

                  <Sheet open={replaySheetOpen} onOpenChange={setReplaySheetOpen}>
                    <SheetTrigger asChild>
                      <Button variant={replayActive ? "secondary" : "outline"} size="sm">
                        {t("replay.controls.open")}
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-6 lg:max-w-3xl xl:max-w-4xl"
                    >
                      <SheetHeader className="sr-only">
                        <SheetTitle>{t("replay.controls.title")}</SheetTitle>
                        <SheetDescription>{t("replay.controls.subtitle")}</SheetDescription>
                      </SheetHeader>
                      <ReplayControlsPanel />
                    </SheetContent>
                  </Sheet>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("app.language")}>
                    <Languages className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {languageOptions.map((option) => {
                    const active = i18n.language === option.value
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setStoredLanguage(option.value as SupportedLanguage)}
                      >
                        {active ? "✓ " : ""}
                        {option.nativeLabel} · {option.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="ml-2 hidden max-w-[180px] truncate text-sm sm:inline">
                      {user?.displayName || user?.email || t("auth.userFallback")}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={doSignOut}>{t("auth.signOut")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {replayActive && (
            <div
              data-testid="replay-banner"
              className="border-b border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 md:px-6"
            >
              <div className="flex w-full max-w-none flex-wrap items-center gap-3">
                <Badge variant="destructive" className="uppercase tracking-[0.2em]">
                  {t("replay.active")}
                </Badge>
                <span className="font-semibold">{t("replay.bannerTitle")}</span>
                <span className="text-amber-900/80">{t("replay.bannerSubtitle")}</span>
                <span className="text-amber-900/80">
                  {t("replay.runId")}: {replayControls?.activeRunId || t("common.na")}
                </span>
                <span className="text-amber-900/80">
                  {t("replay.datasetId")}: {replayControls?.datasetId || t("common.na")}
                </span>
                <span className="text-amber-900/80">
                  {t("replay.asOf")}: {replayAsOfLabel}
                </span>
                <span className="text-amber-900/80">
                  {t("replay.controls.playbackLabel")}: {replayPlaybackLabel}
                </span>
              </div>
            </div>
          )}

          <div className="flex-1 p-4 md:p-6">
            <div className="w-full max-w-none">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <AuthDebugBadge />
    </div>
  )
}
