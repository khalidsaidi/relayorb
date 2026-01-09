import { test, expect } from "@playwright/test"
import { getAdmin } from "./utils/admin"

const testEmail = process.env.VITE_E2E_TEST_EMAIL || ""
const e2eTarget = process.env.RELAYORB_E2E_TARGET || "emulator"

test.describe("RelayOrb authenticated flow", () => {
  test.skip(e2eTarget === "prod", "Emulator-only authenticated tests")
  test.describe.configure({ mode: "serial" })

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

  test("shows seeded bots and events on dashboard", async ({ page }) => {
    await page.getByRole("tab", { name: "Advanced" }).click()
    const eventStream = page.getByText("Recent Event Stream")
    await eventStream.scrollIntoViewIfNeeded()
    await expect(eventStream).toBeVisible()
    await expect(page.getByText("Freqtrade connected")).toBeVisible()
    await expect(page.getByText("Freqtrade Paper")).toBeVisible()
    await expect(page.getByText("3 bots tracked")).toBeVisible()
  })

  test("queues commands from bot detail", async ({ page }) => {
    const { db } = getAdmin()

    await page.goto("/bots")
    await expect(page.getByRole("link", { name: "freqtrade-1" })).toBeVisible()
    await page.getByRole("link", { name: "freqtrade-1" }).click()

    await page.getByRole("tab", { name: "Commands" }).click()
    await expect(page.getByText("Command Console")).toBeVisible()
    await page.getByRole("button", { name: /^Start$/ }).click()
    await expect(page.getByText("Command queued")).toBeVisible()

    await expect.poll(async () => {
      const snap = await db
        .collection("bots")
        .doc("freqtrade-1")
        .collection("commands")
        .where("type", "==", "start")
        .limit(1)
        .get()

      if (snap.empty) return null
      const data = snap.docs[0].data() as { status?: string; requestedBy?: string }
      return { status: data.status, requestedBy: data.requestedBy }
    }).toEqual({ status: "queued", requestedBy: testEmail })
  })
})
