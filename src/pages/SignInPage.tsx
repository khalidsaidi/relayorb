import { useLocation, Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { firebaseEnabled, auth } from "@/lib/firebase"
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { useAuth } from "@/features/auth/AuthProvider"
import { Badge } from "@/components/ui/badge"

export default function SignInPage() {
  const { user, blockedEmail } = useAuth()
  const location = useLocation()

  const redirectTo = (location.state as { from?: string } | null)?.from || "/"

  if (user) return <Navigate to={redirectTo} replace />

  async function signInGoogle() {
    if (!firebaseEnabled || !auth) return
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/60 bg-background/80 shadow-lg backdrop-blur">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">Private Console</Badge>
            <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">RelayOrb</span>
          </div>
          <CardTitle className="text-2xl">Sign in to Control Deck</CardTitle>
          <CardDescription>
            This dashboard is locked to a single admin allowlist and exposes unified controls for all bot engines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!firebaseEnabled ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">Firebase not configured</div>
              <div className="opacity-80">
                Fill <code>.env</code> at the project root using <code>.env.example</code>, then restart the dev server.
              </div>
            </div>
          ) : blockedEmail ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium text-destructive">Access denied</div>
              <div className="opacity-80">
                <span className="font-mono text-xs">{blockedEmail}</span> is not on the admin allowlist.
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={signInGoogle}>
              Sign in with Google
            </Button>
          )}
          <div className="text-xs text-muted-foreground">
            Only approved admin accounts can access RelayOrb.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
