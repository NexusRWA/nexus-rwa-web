/**
 * Tests for components/asset/AssetCard.tsx
 *
 * Strategy: mock next/link so it renders as a plain <a> without a router,
 * build AssetEntry fixtures with makeAsset(), and assert that the card renders
 * the asset name, type badge, formatted valuation, and links to the correct
 * detail route. Also covers the inactive chip and the holders / supply display.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// Render Next.js Link as a plain <a> — no router needed.
jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
    onFocus,
    onMouseEnter,
  }: {
    children: React.ReactNode;
    href: string;
    onFocus?: () => void;
    onMouseEnter?: () => void;
  }) => (
    <a href={href} onFocus={onFocus} onMouseEnter={onMouseEnter}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/assetCache", () => ({
  prefetchAssetMetadata: jest.fn().mockResolvedValue(undefined),
}));

import { AssetCard } from "../AssetCard";
import { prefetchAssetMetadata } from "@/lib/assetCache";

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: 1n,
    tokenContract: "CTOKEN123456789",
    issuer: "GISSUER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    name: "Lagos Office Tower",
    assetType: "real_estate",
    valuation: 5_000_000_00n,
    createdAt: 100,
    active: true,
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("AssetCard", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders the asset name", () => {
    render(<AssetCard asset={makeAsset()} />);
    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
  });

  it("renders the asset type badge", () => {
    render(<AssetCard asset={makeAsset()} />);
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("renders the formatted valuation", () => {
    render(<AssetCard asset={makeAsset()} />);
    // 5_000_000_00n cents => $5M (compact)
    expect(screen.getByText("$5M")).toBeInTheDocument();
  });

  it("links to the correct asset detail route", () => {
    render(<AssetCard asset={makeAsset({ id: 7n })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/asset/7");
  });

  it("prefetches metadata when the card receives pointer or keyboard focus", () => {
    const asset = makeAsset();
    render(<AssetCard asset={asset} />);
    const link = screen.getByRole("link");

    fireEvent.mouseEnter(link);
    fireEvent.focus(link);

    expect(prefetchAssetMetadata).toHaveBeenNthCalledWith(
      1,
      "testnet",
      asset.tokenContract,
    );
    expect(prefetchAssetMetadata).toHaveBeenNthCalledWith(
      2,
      "testnet",
      asset.tokenContract,
    );
  });

  it("shows 'Inactive' chip when asset.active is false", () => {
    render(<AssetCard asset={makeAsset({ active: false })} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("does not show the 'Inactive' chip when asset is active", () => {
    render(<AssetCard asset={makeAsset({ active: true })} />);
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("shows the holder count when provided", () => {
    render(<AssetCard asset={makeAsset()} holders={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows the supply string when provided", () => {
    render(<AssetCard asset={makeAsset()} supply="1,000,000" />);
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
  });

  it("shows '—' when neither holders nor supply is provided", () => {
    render(<AssetCard asset={makeAsset()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders 'Unnamed asset' fallback when name is empty", () => {
    render(<AssetCard asset={makeAsset({ name: "" })} />);
    expect(screen.getByText("Unnamed asset")).toBeInTheDocument();
  });

  it("renders the Invoice type badge for an invoice asset", () => {
    render(<AssetCard asset={makeAsset({ assetType: "invoice" })} />);
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("renders the Commodity type badge for a commodity asset", () => {
    render(<AssetCard asset={makeAsset({ assetType: "commodity" })} />);
    expect(screen.getByText("Commodity")).toBeInTheDocument();
  });
});
