import { defineConfig } from "@playwright/test"

const reuseExistingServer = process.env.VITE_E2E !== "true"
const webPort = Number.parseInt(process.env.VITE_E2E_PORT || "5175", 10)
const baseURL = `http://127.0.0.1:${Number.isFinite(webPort) ? webPort : 5175}`

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${Number.isFinite(webPort) ? webPort : 5175} --strictPort`,
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
})
