/**
 * Tests for components/home/FeaturedAssets.tsx
 *
 * Strategy: mock useAssets so the component renders without any Soroban /
 * Stellar SDK calls. Mock AssetCard to a simple element so we can count
 * rendered cards by role/accessible-name without pulling in its full dep tree.
 * Mock the Skeleton/CardSkeletonGrid and Next.js Link to keep the jsdom setup
 * simple.
 *
 * States covered:
 *   1. Loading — skeleton grid is shown, no cards
 *   2. Error   — empty state rendered instead of cards
 *   3. Empty assets list — empty state rendered
 *   4. Assets present — up to 3 rendered, sorted by highest valuation first
 *   5. More than 3 assets — only the top 3 by valuation are shown
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock useAssets ─────────────────────────────────────────────────────────

jest.mock("@/hooks/useAssets", () => ({
  useAssets: jest.fn(),
}));

// ── mock Next.js Link ──────────────────────────────────────────────────────

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ── mock AssetCard to a simple article with the asset name ────────────────

jest.mock("@/components/asset/AssetCard", () => ({
  AssetCard: ({ asset }: { asset: AssetEntry }) => (
    <article aria-label={asset.name}>{asset.name}</article>
  ),
}));

// ── mock CardSkeletonGrid to a simple placeholder ─────────────────────────

jest.mock("@/components/ui/Skeleton", () => ({
  CardSkeletonGrid: ({ count }: { count: number }) => (
    <div data-testid="skeleton-grid" data-count={count} aria-busy="true" />
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} aria-hidden="true" />
  ),
}));

import { useAssets } from "@/hooks/useAssets";
import { FeaturedAssets } from "./FeaturedAssets";

const mockUseAssets = useAssets as jest.MockedFunction<typeof useAssets>;

// ── factory ────────────────────────────────────────────────────────────────

function makeAsset(
  id: number,
  name: string,
  valuation: bigint,
): AssetEntry {
  return {
    id: BigInt(id),
    tokenContract: `CTOKEN${id}`,
    issuer: `GISSUER${id}`,
    name,
    assetType: "real_estate",
    valuation,
    createdAt: 50000,
    active: true,
  };
}

type UseAssetsReturn = ReturnType<typeof useAssets>;

function setupAssets(overrides: Partial<UseAssetsReturn>) {
  mockUseAssets.mockReturnValue({
    assets: [],
    data: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  } as UseAssetsReturn);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("FeaturedAssets", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── section heading always present ──────────────────────────────────────
  it("renders the 'Featured assets' heading", () => {
    setupAssets({ loading: true });
    render(<FeaturedAssets />);
    expect(
      screen.getByRole("heading", { name: /featured assets/i }),
    ).toBeInTheDocument();
  });

  // ── "View all" link ──────────────────────────────────────────────────────
  it("renders a 'View all' link to /explore", () => {
    setupAssets({ loading: false, assets: [] });
    render(<FeaturedAssets />);
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/explore",
    );
  });

  // ── 1. Loading state ─────────────────────────────────────────────────────
  it("renders the skeleton grid while loading", () => {
    setupAssets({ loading: true, assets: [] });
    render(<FeaturedAssets />);
    expect(screen.getByTestId("skeleton-grid")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("does not render the empty state while loading", () => {
    setupAssets({ loading: true, assets: [] });
    render(<FeaturedAssets />);
    expect(screen.queryByText(/no assets yet/i)).not.toBeInTheDocument();
  });

  // ── 2. Error state ───────────────────────────────────────────────────────
  it("renders an error state with retry when there is an error", () => {
    const mockRefetch = jest.fn();
    setupAssets({ loading: false, assets: [], error: "RPC unreachable", refetch: mockRefetch });
    render(<FeaturedAssets />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load featured assets/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  // ── 3. Empty assets list ─────────────────────────────────────────────────
  it("renders the empty state when there are no assets", () => {
    setupAssets({ loading: false, assets: [] });
    render(<FeaturedAssets />);
    expect(screen.getByText(/no assets yet/i)).toBeInTheDocument();
  });

  it("renders the 'Tokenize an asset' action in the empty state", () => {
    setupAssets({ loading: false, assets: [] });
    render(<FeaturedAssets />);
    expect(
      screen.getByRole("link", { name: /tokenize an asset/i }),
    ).toHaveAttribute("href", "/asset/new");
  });

  // ── 4. Up to 3 assets ────────────────────────────────────────────────────
  it("renders one card for a single asset", () => {
    const assets = [makeAsset(1, "Warehouse A", 1_000_000_00n)];
    setupAssets({ loading: false, assets });
    render(<FeaturedAssets />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("article", { name: "Warehouse A" })).toBeInTheDocument();
  });

  it("renders all three cards when exactly 3 assets are present", () => {
    const assets = [
      makeAsset(1, "Asset Alpha", 3_000_000_00n),
      makeAsset(2, "Asset Beta", 2_000_000_00n),
      makeAsset(3, "Asset Gamma", 1_000_000_00n),
    ];
    setupAssets({ loading: false, assets });
    render(<FeaturedAssets />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  // ── 5. More than 3 assets — only top 3 by valuation ─────────────────────
  it("renders only 3 cards even when more than 3 assets are available", () => {
    const assets = [
      makeAsset(1, "Low Value", 100_00n),
      makeAsset(2, "Mid Value", 500_000_00n),
      makeAsset(3, "Top Value", 10_000_000_00n),
      makeAsset(4, "Another Low", 50_00n),
      makeAsset(5, "High Value", 5_000_000_00n),
    ];
    setupAssets({ loading: false, assets });
    render(<FeaturedAssets />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("renders the 3 highest-valued assets and excludes lower-valued ones", () => {
    const assets = [
      makeAsset(1, "Lowest", 100_00n),
      makeAsset(2, "Second", 500_000_00n),
      makeAsset(3, "First", 10_000_000_00n),
      makeAsset(4, "Excluded", 50_00n),
      makeAsset(5, "Third", 5_000_000_00n),
    ];
    setupAssets({ loading: false, assets });
    render(<FeaturedAssets />);
    expect(screen.getByRole("article", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Second" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Third" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Lowest" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Excluded" })).not.toBeInTheDocument();
  });
});
