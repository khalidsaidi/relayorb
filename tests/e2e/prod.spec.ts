import { test, expect } from "@playwright/test"

const e2eTarget = process.env.RELAYORB_E2E_TARGET || "emulator"

test.describe("RelayOrb production flow", () => {
  test.skip(e2eTarget !== "prod", "Production-only checks")

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard")
    const testButton = page.getByRole("button", { name: /test sign in/i })
    try {
      await testButton.waitFor({ state: "visible", timeout: 5000 })
      await testButton.click()
    } catch {
      // Already signed in or test sign-in is not available.
    }
    await expect(page.getByRole("tab", { name: "Opportunities" })).toBeVisible()
  })

  test("loads dashboard shell", async ({ page }) => {
    await page.getByRole("tab", { name: "Advanced" }).click()
    const eventStream = page.getByText("Recent Event Stream")
    await eventStream.scrollIntoViewIfNeeded()
    await expect(eventStream).toBeVisible()
  })

  test("loads bots list", async ({ page }) => {
    await page.goto("/bots")
    await expect(page.getByText("Connected bot instances")).toBeVisible()
  })
})
