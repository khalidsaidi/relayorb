import React, { useEffect, useMemo, useState } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { auth, firebaseEnabled } from "@/lib/firebase"
import { isAllowedEmail } from "@/config/allowlist"
import { AuthContext } from "@/features/auth/auth-context"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => firebaseEnabled && !!auth)
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      return
    }

    const activeAuth = auth
    return onAuthStateChanged(activeAuth, (u) => {
      if (u && !isAllowedEmail(u.email)) {
        setBlockedEmail(u.email ?? "unknown")
        setUser(null)
        setLoading(false)
        void signOut(activeAuth)
        return
      }

      setBlockedEmail(null)
      setUser(u)

      if (u) {
        // Init paper wallet lazily
        import("@/features/paper/paper-service").then(({ ensurePaperWallet }) => {
          ensurePaperWallet(u.uid).catch((err) =>
            console.error("Failed to ensure paper wallet", err)
          )
        })
      }

      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({ user, loading, firebaseEnabled, blockedEmail }),
    [user, loading, blockedEmail]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
