import { useLocation, Navigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { firebaseEnabled, auth } from "@/lib/firebase"
import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { useAuth } from "@/features/auth/auth-context"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function SignInPage() {
  const { user, blockedEmail } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  const redirectTo = (location.state as { from?: string } | null)?.from || "/"

  if (user) return <Navigate to={redirectTo} replace />

  async function signInGoogle() {
    if (!firebaseEnabled || !auth) return
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err && "code" in err ? String((err as any).code) : ""
      if (code === "auth/unauthorized-domain") {
        toast.error(
          `Google sign-in is blocked for this URL. Open this app on http://localhost:${window.location.port}/ (not 127.0.0.1 or a WSL IP).`
        )
      } else {
        toast.error(err instanceof Error ? err.message : "Sign-in failed")
      }
      throw err
    }
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
              <Badge variant="secondary">{t("auth.privateConsole")}</Badge>
              <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                {t("app.relayOrb")}
              </span>
            </div>
            <CardTitle className="text-2xl">{t("auth.signInTitle")}</CardTitle>
            <CardDescription>
              {t("auth.signInDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!firebaseEnabled ? (
              <div className="space-y-2 text-sm">
                <div className="font-medium">{t("auth.firebaseNotConfigured")}</div>
                <div className="opacity-80">
                  {t("auth.fillEnvPrefix")} <code>.env</code> {t("auth.fillEnvMiddle")}{" "}
                  <code>.env.example</code>
                  {t("auth.fillEnvSuffix")}
                </div>
              </div>
            ) : blockedEmail ? (
              <div className="space-y-2 text-sm">
                <div className="font-medium text-destructive">{t("auth.accessDenied")}</div>
                <div className="opacity-80">
                  <span className="font-mono text-xs">{blockedEmail}</span>{" "}
                  {t("auth.notOnAllowlist")}
                </div>
              </div>
            ) : (
              <>
                <Button className="w-full" onClick={signInGoogle}>
                  {t("auth.signInWithGoogle")}
                </Button>
              </>
            )}
            <div className="text-xs text-muted-foreground">
              {t("auth.onlyApprovedAdmins")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
