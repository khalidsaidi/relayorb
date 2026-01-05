export const ADMIN_ALLOWLIST = ["khalidsaidi66@gmail.com"]

export function isAllowedEmail(email?: string | null) {
  if (!email) return false
  return ADMIN_ALLOWLIST.map((item) => item.toLowerCase()).includes(email.toLowerCase())
}
