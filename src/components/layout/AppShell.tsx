import { useMemo } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TerminalSquare, Newspaper, Radar, LogOut } from "lucide-react"
import { useAuth } from "@/features/auth/auth-context"
import { auth, firebaseEnabled } from "@/lib/firebase"
import { signOut } from "firebase/auth"

type NavItem = {
  to: string
  label: string
  icon: JSX.Element
}

function getPageTitle(pathname: string, t: (key: string) => string) {
  if (pathname.startsWith("/openbb")) return t("nav.openbb")
  if (pathname.startsWith("/finnews")) return t("nav.finnews")
  if (pathname.startsWith("/stockpulse")) return t("nav.stockpulse")
  return t("nav.openbb")
}

export function AppShell() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageTitle = useMemo(() => getPageTitle(pathname, t), [pathname, t])

  const navItems: NavItem[] = [
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
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
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
          <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-6 py-4">
            <div className="text-lg font-semibold text-foreground">{pageTitle}</div>
            <div className="flex items-center gap-3">
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
