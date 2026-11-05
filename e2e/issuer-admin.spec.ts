/**
 * E2E: Issuer dashboard admin gating
 *
 * The mocked asset's on-chain admin is WALLET_ADDRESS. A different wallet must
 * see an explanatory notice and disabled controls; the admin wallet must not.
 */

import { test, expect } from "@playwright/test";
import {
  decodeInvocation,
  mockFreighterWallet,
  mockRpc,
  PAYMENT_TOKEN,
  RECIPIENT_ADDRESS,
  WALLET_ADDRESS,
} from "./fixtures";

async function openTokenPanel(page: import("@playwright/test").Page) {
  await page.goto("/issuer");
  await page.getByRole("button", { name: /lagos office tower/i }).click();
  await expect(page.getByLabel(/recipient address/i)).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Issuer admin gating", () => {
  test("non-admin wallet sees the notice and disabled controls", async ({ page }) => {
    await mockFreighterWallet(page, { address: RECIPIENT_ADDRESS });
    await mockRpc(page);
    await openTokenPanel(page);

    await expect(page.getByText(/not the on-chain admin/i)).toBeVisible();
    await expect(page.getByLabel(/recipient address/i)).toBeDisabled();
    await expect(page.getByLabel(/^amount/i)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /pause transfers/i }),
    ).toBeDisabled();
  });

  test("admin wallet sees working controls and no notice", async ({ page }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);
    await openTokenPanel(page);

    await expect(page.getByText(/not the on-chain admin/i)).toHaveCount(0);
    await expect(page.getByLabel(/recipient address/i)).toBeEnabled();
    await expect(page.getByLabel(/^amount/i)).toBeEnabled();
    await expect(page.getByRole("button", { name: "Mint", exact: true })).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /pause transfers/i }),
    ).toBeEnabled();
  });

  test("creates a distribution with the live eligible holder snapshot", async ({ page }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page, { balance: 500, allowance: 500 });

    const invocations: NonNullable<ReturnType<typeof decodeInvocation>>[] = [];
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      try {
        const body = JSON.parse(request.postData() ?? "{}");
        if (body.method !== "simulateTransaction") return;
        const invocation = decodeInvocation(body.params?.transaction ?? "");
        if (invocation) invocations.push(invocation);
      } catch {
        // Ignore non-JSON requests.
      }
    });

    await page.goto("/issuer");
    await page.getByRole("button", { name: /lagos office tower/i }).click();
    await expect(page.getByLabel(/recipient address/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Distributions" }).click();
    await expect(page.getByText(/snapshot: 2 eligible holders/i)).toBeVisible();

    await page.getByLabel(/payment token contract/i).fill(PAYMENT_TOKEN);
    await page.getByLabel(/total pool amount/i).fill("1");
    await page.getByRole("button", { name: /create distribution/i }).click();
    await expect(page.getByLabel(/payment token contract/i)).toHaveValue("");

    const creation = invocations.find((invocation) => invocation.fn === "create_distribution");
    expect(creation).toBeDefined();
    expect(creation!.args).toHaveLength(5);
    expect(creation!.args[4]).toEqual(
      expect.arrayContaining([
        [WALLET_ADDRESS, 500n],
        [RECIPIENT_ADDRESS, 500n],
      ]),
    );
  });
});
