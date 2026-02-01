import { Navigate, Route, Routes } from "react-router-dom"
import SignInPage from "@/pages/SignInPage"
import TradeNowPage from "@/pages/TradeNowPage"
import DashboardPage from "@/pages/DashboardPage"
import SignalsPage from "@/pages/SignalsPage"
import BotsPage from "@/pages/BotsPage"
import BotDetailPage from "@/pages/BotDetailPage"
import PaperPage from "@/pages/PaperPage"
import LiveChartsPage from "@/pages/LiveChartsPage"
import IbkrOrderPage from "@/pages/IbkrOrderPage"
import OrbRobotPage from "@/pages/OrbRobotPage"
import { RequireAuth } from "@/features/auth/RequireAuth"
import { AppShell } from "@/components/layout/AppShell"
import { PipelineHealthProvider } from "@/features/ops/pipeline-health-context"
import { MarketDataProvider } from "@/features/market/market-data-context"
import { Toaster } from "@/components/ui/sonner"

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />

        <Route element={<RequireAuth />}>
          <Route
            element={
              <PipelineHealthProvider>
                <MarketDataProvider>
                  <AppShell />
                </MarketDataProvider>
              </PipelineHealthProvider>
            }
          >
            <Route path="/" element={<TradeNowPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/bots" element={<BotsPage />} />
            <Route path="/bots/:botId" element={<BotDetailPage />} />
            <Route path="/portfolio" element={<PaperPage />} />
            <Route path="/ibkr" element={<IbkrOrderPage />} />
            <Route path="/orb" element={<OrbRobotPage />} />
            <Route path="/charts" element={<LiveChartsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </>
  )
}
