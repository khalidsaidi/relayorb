import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { auth, firebaseEnabled } from "@/lib/firebase"
import { isAllowedEmail } from "@/config/allowlist"

type AuthState = {
  user: User | null
  loading: boolean
  firebaseEnabled: boolean
  blockedEmail: string | null
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setLoading(false)
      return
    }

    return onAuthStateChanged(auth, (u) => {
      if (u && !isAllowedEmail(u.email)) {
        setBlockedEmail(u.email ?? "unknown")
        setUser(null)
        setLoading(false)
        void signOut(auth)
        return
      }

      setBlockedEmail(null)
      setUser(u)
      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({ user, loading, firebaseEnabled, blockedEmail }),
    [user, loading, blockedEmail]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
