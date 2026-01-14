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
    await expect(graph.locator("canvas").first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("button", { name: /ops layout/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /auto layout/i })).toBeVisible()
  })

  test("supports ops map and auto layout toggles", async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto("/ops/graph")
    await expect(page.getByRole("button", { name: /ops layout/i })).toBeVisible()
    const autoLayout = page.getByRole("button", { name: /auto layout/i })
    await autoLayout.click()
    await expect(page.getByRole("button", { name: /auto layout/i })).toBeVisible({ timeout: 30000 })
    const opsLayout = page.getByRole("button", { name: /ops layout/i })
    await opsLayout.click()
    await expect(page.getByRole("button", { name: /ops layout/i })).toBeVisible()
  })
})
