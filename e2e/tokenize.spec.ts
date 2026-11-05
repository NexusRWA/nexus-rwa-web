/**
 * E2E: Tokenize wizard
 *
 * Walks all four steps — token contract → asset details → confirm → done —
 * and asserts the registry `register_asset` write is attempted with the
 * arguments the issuer entered.
 */

import { test, expect } from "@playwright/test";
import {
  decodeInvocation,
  mockFreighterWallet,
  mockRpc,
  TOKEN_CONTRACT,
  WALLET_ADDRESS,
} from "./fixtures";

test.describe("Tokenize wizard", () => {
  test("walks steps 1-4 and submits register_asset with the entered details", async ({
    page,
  }) => {
    await mockFreighterWallet(page, { address: WALLET_ADDRESS });
    await mockRpc(page);

    // Record every contract invocation the app sends to the RPC.
    const invocations: NonNullable<ReturnType<typeof decodeInvocation>>[] = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      try {
        const body = JSON.parse(req.postData() ?? "{}");
        if (body.method !== "simulateTransaction") return;
        const inv = decodeInvocation(body.params?.transaction ?? "");
        if (inv) invocations.push(inv);
      } catch {
        // not a JSON-RPC body
      }
    });

    await page.goto("/asset/new");

    // Step 1 — token contract is validated against get_metadata.
    await page.getByLabel(/contract address/i).fill(TOKEN_CONTRACT);
    await page.getByRole("button", { name: /verify & continue/i }).click();

    // Step 2 — asset details, pre-filled from on-chain metadata.
    await expect(
      page.getByRole("heading", { name: /asset details/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/asset name/i)).toHaveValue("Lagos Office Tower");
    await page.getByLabel(/asset name/i).fill("Lagos Tower Series A");
    await page.getByRole("button", { name: "Commodity" }).click();
    await page.getByLabel(/valuation/i).fill("2,500,000");
    await page.getByRole("button", { name: /review/i }).click();

    // Step 3 — review, then submit the registry transaction.
    await expect(
      page.getByRole("heading", { name: /review & confirm/i }),
    ).toBeVisible();
    await expect(page.getByText("Lagos Tower Series A")).toBeVisible();
    await page.getByRole("button", { name: /register asset on-chain/i }).click();

    // Step 4 — success screen.
    await expect(
      page.getByRole("heading", { name: /asset registered/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("#7")).toBeVisible();

    const register = invocations.find((i) => i.fn === "register_asset");
    expect(register).toBeDefined();
    expect(register!.args).toEqual([
      WALLET_ADDRESS,
      TOKEN_CONTRACT,
      "Lagos Tower Series A",
      "commodity",
      250_000_000n, // $2,500,000.00 in cents
    ]);
  });
});
