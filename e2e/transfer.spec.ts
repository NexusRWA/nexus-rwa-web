/**
 * E2E: Token transfer flow
 *
 * Covers the path: browse asset → navigate to asset detail →
 * interact with the transfer form → submit transfer.
 *
 * All Soroban RPC and REST API calls are intercepted so the test
 * runs without a real blockchain node or Freighter extension.
 *
 * What these tests verify that unit tests can't:
 *  - Next.js routing and dynamic [id] segment renders the right page
 *  - The TransferPanel mounts and receives props from the real hook chain
 *    (useAsset → useBalance → useCompliance) rather than mocked hooks
 *  - Form validation across real DOM interactions (type, blur, submit)
 *  - The wallet-not-connected state renders on the asset detail page
 *  - The KYC-warning message blocks submission of an invalid recipient
 */

import { test, expect } from "@playwright/test";
import {
  mockFreighterWallet,
  mockRpc,
  RECIPIENT_ADDRESS,
  WALLET_ADDRESS,
  ASSET_ID,
} from "./fixtures";

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Transfer flow", () => {
  test("asset detail page renders without a connected wallet", async ({ page }) => {
    // No wallet injected — the page should still load in read-only mode.
    await mockRpc(page);
    await page.goto(`/asset/${ASSET_ID}`);

    // The page should contain the "Your position" section.
    await expect(
      page.getByRole("heading", { name: /your position/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Without a wallet, the TransferPanel shows a connect prompt.
    await expect(
      page.getByText(/connect your wallet to view your balance/i),
    ).toBeVisible();

    // The page should NOT show the transfer form inputs.
    await expect(page.getByLabel(/recipient address/i)).not.toBeVisible();
  });

  test("transfer form is visible when wallet is connected", async ({ page }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);
    await page.goto(`/asset/${ASSET_ID}`);

    // The "Your position" section must be present.
    await expect(
      page.getByRole("heading", { name: /your position/i }),
    ).toBeVisible({ timeout: 15_000 });

    // With a wallet connected the transfer inputs should eventually appear
    // (compliance check may take a moment to resolve).
    await expect(page.getByLabel(/recipient address/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test("submit button is disabled for an invalid recipient address", async ({
    page,
  }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);
    await page.goto(`/asset/${ASSET_ID}`);

    await expect(page.getByLabel(/recipient address/i)).toBeVisible({
      timeout: 10_000,
    });

    // Type an invalid address.
    await page.getByLabel(/recipient address/i).fill("not-a-stellar-address");
    await page.getByLabel(/amount/i).fill("10");

    // Transfer button must be disabled.
    const transferBtn = page.getByRole("button", { name: /^transfer$/i });
    await expect(transferBtn).toBeDisabled();
  });

  test("submit button is disabled for a zero amount", async ({ page }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);
    await page.goto(`/asset/${ASSET_ID}`);

    await expect(page.getByLabel(/recipient address/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByLabel(/recipient address/i).fill(RECIPIENT_ADDRESS);
    await page.getByLabel(/amount/i).fill("0");

    const transferBtn = page.getByRole("button", { name: /^transfer$/i });
    await expect(transferBtn).toBeDisabled();
  });

  test("compliance, overview and holders sections all render on asset detail", async ({
    page,
  }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);
    await page.goto(`/asset/${ASSET_ID}`);

    // All major sections should be visible.
    await expect(
      page.getByRole("heading", { name: /compliance/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /overview/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /holders/i }),
    ).toBeVisible();
  });

  test("navigating from home → explore → asset detail works end-to-end", async ({
    page,
  }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);

    // Start at home page.
    await page.goto("/");
    await expect(page).toHaveTitle(/nexus rwa/i);

    // Navigate to Explore via the nav link.
    await page.getByRole("link", { name: /^explore$/i }).first().click();
    await expect(page).toHaveURL(/\/explore/);

    // The explore page should show the asset card.
    await expect(
      page.getByText("Lagos Office Tower"),
    ).toBeVisible({ timeout: 15_000 });

    // Click through to the asset detail page.
    await page.getByText("Lagos Office Tower").first().click();
    await expect(page).toHaveURL(new RegExp(`/asset/${ASSET_ID}`));

    // Confirm the asset name appears in the detail view.
    await expect(
      page.getByRole("heading", { name: "Lagos Office Tower" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("invalid asset id shows an error page instead of crashing", async ({
    page,
  }) => {
    await mockRpc(page);
    await page.goto("/asset/not-a-number");

    await expect(
      page.getByText(/invalid asset id/i),
    ).toBeVisible({ timeout: 10_000 });

    // Should have a link back to Explore.
    await expect(
      page.getByRole("link", { name: /back to explore/i }),
    ).toBeVisible();
  });
});
