import { test, expect } from "@playwright/test"
import { signInTestUser } from "./utils/auth"

test.describe("Live charts experience (real FMP)", () => {
  test("renders live quote and FMP intraday chart", async ({ page }) => {
    test.setTimeout(120_000)

    await signInTestUser(page)

    await page.goto("/charts", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: /live charts/i })).toBeVisible({ timeout: 20000 })

    // Wait for a live price to appear (digits, allow decimals)
    const priceMatcher = /[0-9]+\.[0-9]+/
    const priceEl = page.getByText(priceMatcher).first()
    await expect(priceEl).toBeVisible({ timeout: 15000 })

    // Default tab is 5m (FMP-backed)
    const chart = page.getByTestId("fmp-chart-live")
    await expect(chart).toBeVisible({ timeout: 15000 })
    await expect(chart.locator("canvas").first()).toBeVisible({ timeout: 15000 })

    // Switch to EOD to ensure fallback interval also renders
    await page.getByRole("tab", { name: "EOD" }).click()
    await expect(chart).toBeVisible({ timeout: 15000 })
  })
})
