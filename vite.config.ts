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

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
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
