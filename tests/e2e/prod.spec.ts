import { test, expect } from "@playwright/test"

const e2eTarget = process.env.RELAYORB_E2E_TARGET || "emulator"

test.describe("RelayOrb production flow", () => {
  test.skip(e2eTarget !== "prod", "Production-only checks")

  test.beforeEach(async ({ page }) => {
    await page.goto("/signin")
    const testButton = page.getByRole("button", { name: /test sign in/i })
    if (await testButton.count()) {
      await testButton.click()
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
