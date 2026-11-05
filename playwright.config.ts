import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Nexus RWA e2e suite.
 *
 * The tests run against the Next.js dev server and mock all external
 * network calls (Soroban RPC + REST API) at the browser-level via
 * page.route(), so no real blockchain or backend is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in parallel — safe because every test uses its own page. */
  fullyParallel: true,
  /* CI: no retries on a non-flaky suite. */
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    /* Capture a trace on first retry so CI failures are diagnosable. */
    trace: "on-first-retry",
    /* Headless everywhere. */
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Start the Next.js server before the suite runs. */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
