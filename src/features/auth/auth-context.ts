import { createContext, useContext } from "react"
import type { User } from "firebase/auth"

export type AuthState = {
  user: User | null
  loading: boolean
  firebaseEnabled: boolean
  blockedEmail: string | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
