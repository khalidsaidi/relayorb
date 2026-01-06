import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LayoutDashboard, Bot, LogOut, Menu, Activity, PanelLeft, PanelRight } from "lucide-react"
import { useAuth } from "@/features/auth/auth-context"
import { auth, firebaseEnabled } from "@/lib/firebase"
import { signOut } from "firebase/auth"

type NavItem = {
  to: string
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/signals", label: "Signals", icon: <Activity className="h-4 w-4" /> },
  { to: "/bots", label: "Bots", icon: <Bot className="h-4 w-4" /> },
]

const SIDEBAR_STORAGE_KEY = "relayorb.sidebar.collapsed"

function usePageTitle() {
  const { pathname } = useLocation()
  if (pathname.startsWith("/bots/")) return "Bot Detail"
  if (pathname.startsWith("/bots")) return "Bots"
  if (pathname.startsWith("/signals")) return "Signals"
  return "Dashboard"
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
  const navigate = useNavigate()
  const pageTitle = usePageTitle()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1"
  })

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0")
  }, [sidebarCollapsed])

  async function doSignOut() {
    if (!firebaseEnabled || !auth) return
    await signOut(auth)
    navigate("/signin", { replace: true })
  }

  const initials =
    (user?.displayName || user?.email || "U")
      .split(" ")
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U"

  const sidebarWidth = sidebarCollapsed ? "84px" : "260px"

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
            sidebarCollapsed ? "w-[84px]" : "w-[260px]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className={sidebarCollapsed ? "text-center" : ""}>
              <div className="text-xs uppercase tracking-[0.25em] opacity-60">
                {sidebarCollapsed ? "RO" : "RelayOrb"}
              </div>
              {!sidebarCollapsed && <div className="text-lg font-semibold">Control Deck</div>}
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-4">
            {navItems.map((item) => (
              <NavItemLink key={item.to} {...item} collapsed={sidebarCollapsed} />
            ))}
          </nav>

          <div className="mt-auto px-4 pb-4">
            <Separator className="my-4" />
            <Button
              variant="outline"
              className={sidebarCollapsed ? "h-10 w-10 p-0" : "w-full"}
              onClick={doSignOut}
            >
              <LogOut className={sidebarCollapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
              {!sidebarCollapsed && "Sign out"}
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex min-w-0 items-center justify-between border-b/60 bg-background/70 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                  <SheetHeader>
                    <SheetTitle>RelayOrb</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-4 flex flex-col gap-1">
                    {navItems.map((item) => (
                      <NavItemLink key={item.to} {...item} collapsed={false} />
                    ))}
                  </nav>
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
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Console</div>
                <div className="text-base font-semibold">{pageTitle}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!firebaseEnabled ? (
                <Badge variant="outline">Firebase Disabled</Badge>
              ) : (
                <Badge variant="secondary">Private Access</Badge>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="ml-2 hidden max-w-[180px] truncate text-sm sm:inline">
                      {user?.displayName || user?.email || "User"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={doSignOut}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-6">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
