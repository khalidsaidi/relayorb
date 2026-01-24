import { BROKER_UID_MAP } from "@/lib/broker-accounts"

export const ADMIN_UID_ALLOWLIST = new Set(Object.values(BROKER_UID_MAP))
const ADMIN_EMAIL_ALLOWLIST = new Set(
  (import.meta.env.VITE_ADMIN_ALLOWLIST || "")
    .split(",")
    .map((entry: string) => entry.trim().toLowerCase())
    .filter(Boolean)
)
const ALLOW_ALL = import.meta.env.VITE_USE_EMULATORS === "true"

export function isAllowedUser(user?: { uid?: string | null; email?: string | null }) {
  if (ALLOW_ALL) return true
  if (!user) return false
  if (user.uid && ADMIN_UID_ALLOWLIST.has(user.uid)) return true
  if (ADMIN_EMAIL_ALLOWLIST.size === 0) return false
  const email = user.email?.toLowerCase()
  if (!email) return false
  return ADMIN_EMAIL_ALLOWLIST.has(email)
}
