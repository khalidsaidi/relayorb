import { useState } from "react"
import { useLocation, Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { firebaseEnabled, auth } from "@/lib/firebase"
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth"
import { useAuth } from "@/features/auth/auth-context"
import { Badge } from "@/components/ui/badge"

export default function SignInPage() {
  const { user, blockedEmail } = useAuth()
  const location = useLocation()
  const [testError, setTestError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from || "/"
  const isE2E = import.meta.env.VITE_E2E === "true"
  const testEmail = import.meta.env.VITE_E2E_TEST_EMAIL as string | undefined
  const testPassword = import.meta.env.VITE_E2E_TEST_PASSWORD as string | undefined

  if (user) return <Navigate to={redirectTo} replace />

  async function signInGoogle() {
    if (!firebaseEnabled || !auth) return
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  async function signInTestUser() {
    if (!firebaseEnabled || !auth) return
    setTestError(null)
    if (!testEmail || !testPassword) {
      setTestError("Missing VITE_E2E_TEST_EMAIL or VITE_E2E_TEST_PASSWORD")
      return
    }

    try {
      await createUserWithEmailAndPassword(auth, testEmail, testPassword)
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : ""
      if (code !== "auth/email-already-in-use") {
        setTestError("Test sign-in failed")
        return
      }
    }

    await signInWithEmailAndPassword(auth, testEmail, testPassword)
  }

  return (
    <div className="app-bg min-h-svh">
      <div className="app-orbs" aria-hidden="true">
        <span className="app-orb app-orb-a" />
        <span className="app-orb app-orb-b" />
        <span className="app-orb app-orb-c" />
      </div>
      <div className="app-grid" aria-hidden="true" />
      <div className="relative z-10 flex min-h-svh items-center justify-center p-4">
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
              <>
                {isE2E && (
                  <div className="space-y-2">
                    <Button variant="secondary" className="w-full" onClick={signInTestUser}>
                      Test sign in
                    </Button>
                    {testError && <div className="text-xs text-destructive">{testError}</div>}
                  </div>
                )}
                <Button className="w-full" onClick={signInGoogle}>
                  Sign in with Google
                </Button>
              </>
            )}
            <div className="text-xs text-muted-foreground">
              Only approved admin accounts can access RelayOrb.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
