import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const proxyBase =
    env.VITE_REFRESH_PROXY_BASE_URL?.replace(/\/+$/, "") ||
    "https://us-west1-relayorb.cloudfunctions.net"
  const proxyPath = (env.VITE_REFRESH_PROXY_FUNCTION_PATH || "refreshProxy").replace(
    /^\/+/,
    ""
  )
  // `loadEnv()` reads `.env*` files; for dev we also want runtime env vars set by scripts (e.g. `dev-wsl.sh`).
  const hmrHost = (process.env.VITE_HMR_HOST || env.VITE_HMR_HOST || "").trim()
  const hmrClientPortRaw = (process.env.VITE_HMR_CLIENT_PORT || env.VITE_HMR_CLIENT_PORT || "").trim()
  const hmrClientPort = hmrClientPortRaw ? Number(hmrClientPortRaw) : undefined

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      hmr: hmrHost
        ? {
            protocol: "ws",
            host: hmrHost,
            clientPort: hmrClientPort || 5173,
          }
        : undefined,
      proxy: {
        "/proxy": {
          target: proxyBase,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/proxy/, `/${proxyPath}/proxy`),
        },
      },
    },
  }
})
