import React from "react"
import "@/i18n"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "./index.css"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { AppErrorBoundary } from "@/components/AppErrorBoundary"

// Firebase Auth's "authorized domains" almost always includes `localhost` but not `127.0.0.1`.
// When running under WSL/Windows, people often open `http://127.0.0.1:<port>` which breaks Google popup auth with
// `auth/unauthorized-domain`. In dev, normalize to `localhost` automatically.
if (import.meta.env.DEV) {
  const { protocol, hostname, port, pathname, search, hash } = window.location
  const isWindows = navigator.userAgent.includes("Windows")
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)

  // On Windows, developers often open the Vite dev server using the WSL IP (172.x/10.x) which breaks Firebase popup
  // auth unless that IP is added as an authorized domain. Keep dev deterministic by forcing `localhost`.
  if (isWindows && isIpv4 && hostname !== "localhost") {
    window.location.replace(`${protocol}//localhost:${port}${pathname}${search}${hash}`)
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
