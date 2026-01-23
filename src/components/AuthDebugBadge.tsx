import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/auth-context"

const PROXY_URL = (import.meta.env.VITE_MARKET_DATA_PROXY_URL || "").replace(/\/+$/, "")
const GATEWAY_URL = (import.meta.env.VITE_MARKET_DATA_GATEWAY_URL || "").replace(/\/+$/, "")
const GATEWAY_BASE = (PROXY_URL || GATEWAY_URL || "").replace(/\/+$/, "")
const GATEWAY_AUTH_ENABLED = (() => {
  const flag = import.meta.env.VITE_MARKET_DATA_GATEWAY_AUTH
  if (flag === "true") return true
  if (flag === "false") return false
  return Boolean(PROXY_URL && GATEWAY_BASE === PROXY_URL)
})()

type TokenState = "unknown" | "ok" | "missing" | "error" | "disabled"

export function AuthDebugBadge() {
  const { user, loading } = useAuth()
  const [tokenState, setTokenState] = useState<TokenState>("unknown")
  const [tokenError, setTokenError] = useState("")

  useEffect(() => {
    let active = true

    async function checkToken() {
      if (!GATEWAY_AUTH_ENABLED) {
        if (active) {
          setTokenState("disabled")
          setTokenError("")
        }
        return
      }
      if (!user) {
        if (active) {
          setTokenState("missing")
          setTokenError("")
        }
        return
      }
      try {
        const token = await user.getIdToken()
        if (!active) return
        if (token) {
          setTokenState("ok")
          setTokenError("")
        } else {
          setTokenState("missing")
          setTokenError("empty token")
        }
      } catch (err) {
        if (!active) return
        setTokenState("error")
        setTokenError(err instanceof Error ? err.message : "token error")
      }
    }

    checkToken()
    return () => {
      active = false
    }
  }, [user])

  const debugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH === "true"
  const authLabel = useMemo(() => {
    if (loading) return "checking"
    if (!user) return "signed out"
    return user.email || "signed in"
  }, [loading, user])

  if (!debugEnabled) return null

  const gatewayLabel = PROXY_URL ? "proxy" : GATEWAY_URL ? "gateway" : "unset"
  const tokenBadgeVariant =
    tokenState === "ok" ? "secondary" : tokenState === "disabled" ? "outline" : "destructive"

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[260px] rounded-xl border border-border/70 bg-background/90 p-3 text-xs shadow-lg backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Debug Auth
        </span>
        <Badge variant={tokenBadgeVariant}>{tokenState}</Badge>
      </div>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <div>
          <span className="text-foreground">User:</span> {authLabel}
        </div>
        <div>
          <span className="text-foreground">Gateway:</span> {gatewayLabel}
        </div>
        {tokenError ? (
          <div className="text-destructive">Token: {tokenError}</div>
        ) : null}
      </div>
    </div>
  )
}
