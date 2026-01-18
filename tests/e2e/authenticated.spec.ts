import { test, expect } from "@playwright/test"
import { signInTestUser } from "./utils/auth"

test.describe("RelayOrb authenticated flow", () => {
  test.beforeEach(async ({ page }) => {
    await signInTestUser(page)
  })

  test("shows dashboard shell and event stream card", async ({ page }) => {
    await page.goto("/dashboard")
    const advancedTab = page.getByRole("tab", { name: "Advanced" })
    await expect(advancedTab).toBeVisible({ timeout: 20000 })
    await advancedTab.scrollIntoViewIfNeeded()
    await advancedTab.click({ force: true })
    const eventStream = page.getByText("Recent Event Stream")
    await eventStream.scrollIntoViewIfNeeded()
    await expect(eventStream).toBeVisible({ timeout: 20000 })
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
      const commandsTab = page.getByRole("tab", { name: "Commands" })
      await expect(commandsTab).toBeVisible({ timeout: 15000 })
      await commandsTab.click({ force: true })
      await expect(page.getByText("Command Console")).toBeVisible()
    }
  })

  test("covers swing overnight ui behaviors", async ({ page }) => {
    await page.route("**/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          jobs: [{ job: "market_intel" }],
        }),
      })
    })
    await page.route("**/advice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          advice: {
            action: "buy",
            holdMinutes: 90,
            stopLossPct: 2,
            takeProfitPct: 4,
            summary: "Buy test setup.",
          },
        }),
      })
    })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async () => undefined },
        configurable: true,
      })
      ;(window as Window & { __E2E_REFRESH_URL__?: string }).__E2E_REFRESH_URL__ =
        "https://e2e.local"
      ;(window as Window & { __E2E_DISABLE_FIRESTORE_WRITES__?: boolean }).__E2E_DISABLE_FIRESTORE_WRITES__ =
        true
      ;(window as Window & { __E2E_SWING_OVERNIGHT__?: unknown }).__E2E_SWING_OVERNIGHT__ = {
        updatedAt: { toMillis: () => Date.now() - 60_000 },
        items: [
          {
            assetClass: "stock",
            symbol: "AAPL",
            name: "Apple Inc.",
            price: 192.34,
            side: "buy",
            profile: "swing_overnight",
            score: 72.4,
            momentum: { change24h: 1.2, change1h: 0.4 },
            signals: { total: 8, buy: 6, sell: 2 },
            scoreComponents: {
              momentum: 18,
              consensus: 12,
              liquidity: 8,
              news: 4,
              universe: 3,
              penalties: { spread: -2 },
            },
            source: "swing_overnight",
            analysis: {
              summary: "Late-day pullback near MA20 with trend intact.",
              details: [
                "Note: dip setup • liquidity strong • in your universe",
                "Trend above MA20/MA50.",
                "AI note: volume cooling into the close.",
                "No heavy distribution days.",
              ],
            },
          },
        ],
      }
      ;(window as Window & { __E2E_PREBREAKOUT__?: unknown }).__E2E_PREBREAKOUT__ = {
        updatedAt: { toMillis: () => Date.now() - 30_000 },
        items: [
          {
            assetClass: "stock",
            symbol: "MULN",
            name: "Mullen Automotive",
            price: 0.18,
            side: "buy",
            profile: "prebreakout",
            score: 68.2,
            momentum: { change24h: 3.4, change1h: 1.1 },
            signals: { total: 5, buy: 4, sell: 1 },
            scoreComponents: {
              momentum: 14,
              consensus: 9,
              liquidity: 6,
              news: 3,
              universe: 4,
            },
            source: "prebreakout",
            analysis: {
              summary: "BUY signal · pre-breakout watch.",
              details: [
                "Note: microcap float • liquidity strong • in your universe",
                "Microcap gate: market cap $22M and float 4.8M.",
                "Turnover: 450.0% (target 300-800%).",
              ],
            },
          },
        ],
      }
      ;(window as Window & { __E2E_MARKET_PRICES__?: unknown }).__E2E_MARKET_PRICES__ = {
        prices: { AAPL: 193.25, MULN: 0.19 },
        livePrices: { AAPL: 193.25, MULN: 0.19 },
      }
    })

    await page.goto("/dashboard")
    const swingCard = page
      .locator("[data-slot='card']")
      .filter({ hasText: "Swing (Overnight)" })
      .first()
    await expect(swingCard).toBeVisible({ timeout: 20000 })
    await expect(swingCard.getByText("AAPL")).toBeVisible()
    await expect(swingCard.getByText("Overnight Swing")).toBeVisible()
    await expect(swingCard.getByText(/Updated/i)).toBeVisible()

    const prebreakoutCard = page
      .locator("[data-slot='card']")
      .filter({ hasText: "Pre-Breakout Watch" })
      .first()
    await expect(prebreakoutCard).toBeVisible({ timeout: 20000 })
    await expect(prebreakoutCard.getByText("MULN")).toBeVisible()
    await expect(
      prebreakoutCard.getByText("Pre-Breakout", { exact: true })
    ).toBeVisible()

    const manageAssets = page.getByRole("button", { name: /manage assets/i })
    await manageAssets.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    const swingSection = dialog.getByText("Swing (Overnight)").locator("..").locator("..")
    const swingToggle = swingSection.getByRole("button", { name: /swing on|swing off/i })
    await swingToggle.scrollIntoViewIfNeeded()
    const initialPressed = await swingToggle.getAttribute("aria-pressed")
    await swingToggle.click({ force: true })
    await expect(swingToggle).toHaveAttribute(
      "aria-pressed",
      initialPressed === "true" ? "false" : "true"
    )
    const autoPaperToggle = dialog
      .getByRole("button", { name: /auto-paper on|auto-paper off/i })
      .first()
    if (initialPressed === "true") {
      await expect(autoPaperToggle).toBeDisabled()
    } else {
      await expect(autoPaperToggle).toBeEnabled()
    }
    await swingToggle.click({ force: true })
    await expect(swingToggle).toHaveAttribute("aria-pressed", initialPressed ?? "false")
    const savePrefs = dialog.getByRole("button", { name: /save preferences/i })
    await savePrefs.scrollIntoViewIfNeeded()
    await savePrefs.click()
    await expect(page.getByText("Preferences saved")).toBeVisible()
    await expect(dialog).toBeHidden()

    await page.goto("/trade-now")
    await page.getByRole("button", { name: /refresh now/i }).click()
    await expect(page.getByText("Refresh started: market_intel")).toBeVisible()
    const swingList = page
      .locator("[data-slot='card']")
      .filter({ hasText: "Swing (Overnight)" })
      .first()
    await expect(swingList).toBeVisible({ timeout: 20000 })
    await expect(swingList.getByText("AAPL")).toBeVisible()
    await expect(swingList.getByText("Overnight Swing")).toBeVisible()
    await expect(swingList.getByText(/Updated/i)).toBeVisible()
    await expect(swingList.getByText("8 bot signals · 6 buy / 2 sell")).toBeVisible()
    await expect(swingList.getByTitle("Live price")).toBeVisible()
    await expect(swingList.getByText("Rules").first()).toBeVisible()

    const whyPick = swingList.getByText("Why this pick").first()
    await whyPick.click()
    await expect(swingList.getByText("Trend above MA20/MA50.")).toBeVisible()
    await expect(swingList.getByText("LLM").first()).toBeVisible()
    await expect(swingList.getByText(/dip setup/i)).toBeVisible()

    const tradeButton = swingList.getByRole("button", { name: /trade/i }).first()
    await expect(tradeButton).toBeVisible()
    await tradeButton.click()
    await expect(page.getByRole("heading", { name: /Paper Trade: AAPL/i })).toBeVisible()
    await expect(page.getByText("(Live)")).toBeVisible()
    await page.keyboard.press("Escape")
    const askAiButton = swingList.getByRole("button", { name: /ask ai/i }).first()
    await expect(askAiButton).toBeEnabled()
    await askAiButton.click()
    await expect(swingList.getByText("AI:")).toBeVisible()
    await expect(
      swingList.getByRole("button", { name: /apply ai suggestion/i })
    ).toBeVisible()
    await swingList.getByRole("button", { name: /apply ai suggestion/i }).click()
    await expect(page.getByText(/Applied AI BUY for AAPL/i)).toBeVisible()
    const copyPrompt = swingList.getByRole("button", { name: /copy ai prompt/i }).first()
    await copyPrompt.click()
    await expect(page.getByText("AI prompt copied")).toBeVisible()

    const breakdownButton = swingList.getByTitle("Score breakdown").first()
    await breakdownButton.click()
    const breakdownDialog = page.getByRole("dialog")
    await expect(breakdownDialog.getByRole("heading", { name: /AAPL Score Breakdown/i })).toBeVisible()
    await expect(breakdownDialog.getByText("Profile: swing overnight")).toBeVisible()
    await expect(breakdownDialog.getByText("Source: swing_overnight")).toBeVisible()
    await expect(breakdownDialog.getByText("Bots: 6 buy / 2 sell")).toBeVisible()
    await expect(breakdownDialog.getByText("Momentum")).toBeVisible()
    await expect(breakdownDialog.getByText("Rules").first()).toBeVisible()
    await expect(breakdownDialog.getByText("LLM").first()).toBeVisible()
    await page.keyboard.press("Escape")

    const chartButton = swingList.getByTitle("View Chart").first()
    await chartButton.click()
    await expect(page.getByRole("heading", { name: /AAPL Chart/i })).toBeVisible()
    await expect(page.getByTestId("fmp-chart-modal").first()).toBeVisible({ timeout: 15000 })
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: /crypto/i }).click()
    await expect(
      page.locator("[data-slot='card']").filter({ hasText: "Swing (Overnight)" })
    ).toHaveCount(0)
    await page.getByRole("button", { name: /stocks/i }).click()
    await expect(
      page.locator("[data-slot='card']").filter({ hasText: "Swing (Overnight)" })
    ).toBeVisible()
  })

  test("shows swing overnight empty states", async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as Window & { __E2E_SWING_OVERNIGHT__?: unknown }).__E2E_SWING_OVERNIGHT__ = {
        updatedAt: { toMillis: () => Date.now() - 120_000 },
        items: [],
      }
      ;(window as Window & { __E2E_PREBREAKOUT__?: unknown }).__E2E_PREBREAKOUT__ = {
        updatedAt: { toMillis: () => Date.now() - 120_000 },
        items: [],
      }
    })

    await page.goto("/dashboard")
    await expect(page.getByText("No overnight swing picks yet.")).toBeVisible({ timeout: 20000 })
    await expect(page.getByText("No pre-breakout picks yet.")).toBeVisible({ timeout: 20000 })

    await page.goto("/trade-now")
    await expect(page.getByText("No overnight swing picks right now.")).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText("No pre-breakout setups right now.")).toBeVisible({
      timeout: 20000,
    })
  })
})
