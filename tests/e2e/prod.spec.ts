import { test, expect } from "@playwright/test"
import { signInTestUser } from "./utils/auth"

test.describe("RelayOrb ops graph", () => {
  test.beforeEach(async ({ page }) => {
    await signInTestUser(page)
  })

  test("renders ops graph canvas", async ({ page }) => {
    await page.goto("/ops/graph")
    await expect(page.getByRole("heading", { name: /ops graph/i })).toBeVisible()
    const graph = page.getByTestId("ops-graph-canvas")
    await expect(graph).toBeVisible()
    await expect(graph.locator(".x6-graph, svg, canvas").first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("button", { name: /recompute layout/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /debug overlay/i })).toBeVisible()
  })

  test("supports layout and debug toggles", async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto("/ops/graph")
    const recomputeLayout = page.getByRole("button", { name: /recompute layout/i })
    await expect(recomputeLayout).toBeVisible()
    await recomputeLayout.click()
    await expect(page.getByRole("button", { name: /recompute layout/i })).toBeVisible({
      timeout: 30000,
    })
    const debugToggle = page.getByRole("button", { name: /debug overlay/i })
    await debugToggle.click()
    await expect(page.getByRole("button", { name: /hide debug overlay/i })).toBeVisible()
    await page.getByRole("button", { name: /hide debug overlay/i }).click()
    await expect(page.getByRole("button", { name: /debug overlay/i })).toBeVisible()
  })
})
