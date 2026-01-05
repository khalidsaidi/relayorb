import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/features/auth/AuthProvider"

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <div className="text-sm opacity-70">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
