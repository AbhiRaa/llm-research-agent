import { test, expect } from "@playwright/test"

test("home renders the PROOF empty state with starter cards", async ({ page }) => {
  await page.goto("/")

  // masthead + ghosted headline
  await expect(page.locator("h1", { hasText: /^PROOF$/ })).toBeVisible()
  await expect(page.locator("h2", { hasText: /^SOURCED\./ })).toBeVisible()

  // the printed index of starter questions
  await expect(
    page.getByRole("button", { name: /Apple event/i }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Formula 1/i }),
  ).toBeVisible()

  // composer
  await expect(page.getByPlaceholder(/Set your query/i)).toBeVisible()
})

test("theme toggle switches the document class", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("radio", { name: /Dark theme/i }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("radio", { name: /Light theme/i }).click()
  await expect(page.locator("html")).toHaveClass(/light/)
})
