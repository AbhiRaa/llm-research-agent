import { defineConfig, devices } from "@playwright/test"

/**
 * Smoke E2E for the PROOF frontend.
 *
 * The webServer block builds and previews the SPA on :4173 — the test does
 * not require the agent backend running (it only asserts the empty-state
 * renders), so it's deterministic in CI and doesn't need API keys.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
})
