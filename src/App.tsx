import { Navigate, Route, Routes } from "react-router-dom"
import SignInPage from "@/pages/SignInPage"
import TraderDashboardPage from "@/pages/TraderDashboardPage"
import OpenbbPage from "@/pages/OpenbbPage"
import FinnewsPage from "@/pages/FinnewsPage"
import StockpulsePage from "@/pages/StockpulsePage"
import { RequireAuth } from "@/features/auth/RequireAuth"
import { AppShell } from "@/components/layout/AppShell"
import { Toaster } from "@/components/ui/sonner"

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />

        <Route element={<RequireAuth />}>
          <Route
            element={
              <AppShell />
            }
          >
            <Route path="/" element={<Navigate to="/trader" replace />} />
            <Route path="/trader" element={<TraderDashboardPage />} />
            <Route path="/openbb" element={<OpenbbPage />} />
            <Route path="/finnews" element={<FinnewsPage />} />
            <Route path="/stockpulse" element={<StockpulsePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </>
  )
}
