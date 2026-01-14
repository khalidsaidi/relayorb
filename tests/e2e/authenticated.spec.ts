import { test, expect } from "@playwright/test"
import { signInTestUser } from "./utils/auth"

test.describe("RelayOrb authenticated flow", () => {
  test.beforeEach(async ({ page }) => {
    await signInTestUser(page)
  })

  test("shows dashboard shell and event stream card", async ({ page }) => {
    await page.goto("/dashboard")
    await page.getByRole("tab", { name: "Advanced" }).click()
    const eventStream = page.getByText("Recent Event Stream")
    await eventStream.scrollIntoViewIfNeeded()
    await expect(eventStream).toBeVisible()
  })

  test("opens bot detail without mutating state", async ({ page }) => {
    await page.goto("/bots")
    await expect(page.getByText("Connected bot instances")).toBeVisible()

    const loading = page.getByText(/loading bots/i)
    if (await loading.isVisible()) {
      await loading.waitFor({ state: "detached", timeout: 15000 })
    }

    const emptyState = page.getByText(/no bots yet/i)
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible()
      return
    }

    const botLink = page.locator("table tbody tr a").first()
    if (await botLink.count()) {
      await botLink.click()
      await expect(page.getByRole("tab", { name: "Commands" })).toBeVisible()
      await page.getByRole("tab", { name: "Commands" }).click()
      await expect(page.getByText("Command Console")).toBeVisible()
    }
  })
})
