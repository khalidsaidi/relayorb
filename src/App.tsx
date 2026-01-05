import { Navigate, Route, Routes } from "react-router-dom"
import SignInPage from "@/pages/SignInPage"
import DashboardPage from "@/pages/DashboardPage"
import SignalsPage from "@/pages/SignalsPage"
import BotsPage from "@/pages/BotsPage"
import BotDetailPage from "@/pages/BotDetailPage"
import { RequireAuth } from "@/features/auth/RequireAuth"
import { AppShell } from "@/components/layout/AppShell"
import { Toaster } from "@/components/ui/sonner"

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/bots" element={<BotsPage />} />
            <Route path="/bots/:botId" element={<BotDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </>
  )
}
