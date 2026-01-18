import { test, expect } from "@playwright/test"

test.describe("RelayOrb unauthenticated flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("relayorb.language", "en")
    })
  })

  test("redirects / to sign-in", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/signin/)
    await expect(page.getByText("Sign in to Control Deck")).toBeVisible()
  })

  test("shows Google sign-in entry", async ({ page }) => {
    await page.goto("/signin")
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible()
  })
})
