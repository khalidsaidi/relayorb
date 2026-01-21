import { BROKER_UID_MAP } from "@/lib/broker-accounts"

export const ADMIN_UID_ALLOWLIST = new Set(Object.values(BROKER_UID_MAP))
const ALLOW_ALL =
  import.meta.env.VITE_USE_EMULATORS === "true" || import.meta.env.VITE_E2E === "true"

export function isAllowedUid(uid?: string | null) {
  if (ALLOW_ALL) return true
  if (!uid) return false
  return ADMIN_UID_ALLOWLIST.has(uid)
}
