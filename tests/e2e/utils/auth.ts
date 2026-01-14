import type { Page } from "@playwright/test"

export async function signInTestUser(page: Page) {
  await page.goto("/signin", { waitUntil: "domcontentloaded" })
  const testButton = page.getByRole("button", { name: /test sign in/i })
  try {
    await testButton.waitFor({ state: "visible", timeout: 5000 })
    await testButton.click()
  } catch {
    // Already signed in or test sign-in is not available.
  }

  const shellLink = page.getByRole("link", { name: /trade now/i })
  try {
    await shellLink.waitFor({ state: "visible", timeout: 30000 })
  } catch (err) {
    const firebaseDisabled = page.getByText(/firebase not configured/i)
    if (await firebaseDisabled.isVisible().catch(() => false)) {
      throw new Error("Firebase not configured: set .env and restart the dev server.")
    }
    const accessDenied = page.getByText(/access denied/i)
    if (await accessDenied.isVisible().catch(() => false)) {
      const blockedEmail = await page.locator("span.font-mono").first().textContent()
      throw new Error(`Access denied for ${blockedEmail || "unknown email"}.`)
    }
    const testError = page.getByText(/missing vite_e2e_test_email|test sign-in failed/i)
    if (await testError.isVisible().catch(() => false)) {
      const message = await testError.textContent()
      throw new Error(message || "Test sign-in failed.")
    }
    throw err
  }
}
