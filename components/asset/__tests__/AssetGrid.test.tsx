/**
 * Tests for components/asset/AssetGrid.tsx
 *
 * Strategy: mock next/link so AssetCard renders without a router, then pass
 * different asset arrays and assert the grid renders the correct number of
 * cards (one per asset) and nothing extra when the list is empty.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// Render Next.js Link as a plain <a> — no router needed.
jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/assetCache", () => ({
  prefetchAssetMetadata: jest.fn().mockResolvedValue(undefined),
}));

import { AssetGrid } from "../AssetGrid";

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(
  overrides: Partial<AssetEntry> & Pick<AssetEntry, "id" | "name">,
): AssetEntry {
  return {
    tokenContract: "CTOKEN123456789",
    issuer: "GISSUER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 100,
    active: true,
    ...overrides,
  };
}

const ASSET_A = makeAsset({ id: 1n, name: "Lagos Office Tower" });
const ASSET_B = makeAsset({ id: 2n, name: "Trade Invoice #42", assetType: "invoice" });
const ASSET_C = makeAsset({ id: 3n, name: "Gold Reserve", assetType: "commodity" });

// ── tests ──────────────────────────────────────────────────────────────────

describe("AssetGrid", () => {
  it("renders no cards for an empty asset list", () => {
    render(<AssetGrid assets={[]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a single card for a single-asset list", () => {
    render(<AssetGrid assets={[ASSET_A]} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
  });

  it("renders one card per asset", () => {
    render(<AssetGrid assets={[ASSET_A, ASSET_B, ASSET_C]} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders the correct names for each asset", () => {
    render(<AssetGrid assets={[ASSET_A, ASSET_B, ASSET_C]} />);
    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
    expect(screen.getByText("Trade Invoice #42")).toBeInTheDocument();
    expect(screen.getByText("Gold Reserve")).toBeInTheDocument();
  });

  it("links each card to its detail route", () => {
    render(<AssetGrid assets={[ASSET_A, ASSET_B]} />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/asset/1");
    expect(hrefs).toContain("/asset/2");
  });

  it("renders pagination controls when totalPages > 1", () => {
    const onPageChange = jest.fn();
    render(
      <AssetGrid
        assets={[ASSET_A, ASSET_B]}
        page={1}
        totalPages={3}
        total={6}
        onPageChange={onPageChange}
      />
    );

    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(nav).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /previous page/i });
    const nextBtn = screen.getByRole("button", { name: /next page/i });
    const page1Btn = screen.getByRole("button", { name: "Page 1" });

    // Prev disabled on page 1
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Current page conveyed to screen readers
    expect(page1Btn).toHaveAttribute("aria-current", "page");

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables the next page button when on the last page", () => {
    const onPageChange = jest.fn();
    render(
      <AssetGrid
        assets={[ASSET_A]}
        page={3}
        totalPages={3}
        total={3}
        onPageChange={onPageChange}
      />
    );

    const nextBtn = screen.getByRole("button", { name: /next page/i });
    expect(nextBtn).toBeDisabled();
  });
});
