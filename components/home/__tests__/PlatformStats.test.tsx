/**
 * Tests for components/home/PlatformStats.tsx
 *
 * Strategy: mock usePlatformStats and useHolderTotals so the component renders
 * without any Soroban / Stellar SDK calls. The three stat tiles are tested
 * across loading, error, and success states.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock hooks ─────────────────────────────────────────────────────────────
jest.mock("@/hooks/useAssets", () => ({
  usePlatformStats: jest.fn(),
}));

jest.mock("@/hooks/useHolderTotals", () => ({
  useHolderTotals: jest.fn(),
}));

import { usePlatformStats } from "@/hooks/useAssets";
import { useHolderTotals } from "@/hooks/useHolderTotals";
import { PlatformStats } from "../PlatformStats";

const mockUsePlatformStats = usePlatformStats as jest.MockedFunction<
  typeof usePlatformStats
>;
const mockUseHolderTotals = useHolderTotals as jest.MockedFunction<
  typeof useHolderTotals
>;

// ── helpers ────────────────────────────────────────────────────────────────

/** Return value shape for usePlatformStats */
interface PlatformStatsResult {
  data?: { totalAssets: number; tvl: bigint; totalHolders: number | null; assets: AssetEntry[] | null } | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  refetch: () => void;
}

/** Return value shape for useHolderTotals */
interface HolderTotalsResult {
  data: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function setupMocks(
  statsResult: Partial<PlatformStatsResult>,
  holderResult: Partial<HolderTotalsResult>,
) {
  mockUsePlatformStats.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    updatedAt: null,
    refetch: jest.fn(),
    ...statsResult,
  } as ReturnType<typeof usePlatformStats>);
  mockUseHolderTotals.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...holderResult,
  } as ReturnType<typeof useHolderTotals>);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("PlatformStats", () => {
  afterEach(() => jest.clearAllMocks());

  // ── tile labels always present ─────────────────────────────────────────
  it("renders all three tile labels when data is loading", () => {
    setupMocks(
      { loading: true, error: null },
      { data: null, loading: true, error: null },
    );

    render(<PlatformStats />);

    expect(screen.getByText(/assets tokenized/i)).toBeInTheDocument();
    expect(screen.getByText(/total value locked/i)).toBeInTheDocument();
    expect(screen.getByText(/approved holders/i)).toBeInTheDocument();
  });

  // ── loading state ──────────────────────────────────────────────────────
  it("renders skeleton placeholders while data is loading", () => {
    setupMocks(
      { loading: true, error: null },
      { data: null, loading: true, error: null },
    );

    const { container } = render(<PlatformStats />);

    // Skeletons render with aria-hidden="true"
    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);

    // No numeric values should be visible yet
    expect(screen.queryByText(/^\d/)).toBeNull();
  });

  // ── error state ────────────────────────────────────────────────────────
  it("renders an ErrorState with retry when usePlatformStats returns an error", () => {
    const mockRefetch = jest.fn();
    mockUsePlatformStats.mockReturnValue({
      data: null,
      loading: false,
      error: "RPC down",
      updatedAt: null,
      refetch: mockRefetch,
    } as ReturnType<typeof usePlatformStats>);
    mockUseHolderTotals.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      updatedAt: null,
      refetch: jest.fn(),
    } as ReturnType<typeof useHolderTotals>);

    render(<PlatformStats />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load platform stats/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  // ── success state ──────────────────────────────────────────────────────
  it("renders formatted values when all data resolves", () => {
    setupMocks(
      {
        data: {
          totalAssets: 42,
          tvl: 5_000_000_00n, // $5,000,000
          totalHolders: null,
          assets: [],
        },
        loading: false,
        error: null,
      },
      { data: 1234, loading: false, error: null },
    );

    render(<PlatformStats />);

    // "Assets tokenized" tile
    expect(screen.getByText("42")).toBeInTheDocument();

    // "Total value locked" tile – formatUsdCents with compact:true → "$5M"
    expect(screen.getByText("$5M")).toBeInTheDocument();

    // "Approved holders" tile – compactNumber(1234) → "1.2K"
    expect(screen.getByText("1.2K")).toBeInTheDocument();
  });

  it("renders single-digit total assets correctly", () => {
    setupMocks(
      {
        data: { totalAssets: 1, tvl: 100_00n, totalHolders: null, assets: [] },
        loading: false,
        error: null,
      },
      { data: 0, loading: false, error: null },
    );

    render(<PlatformStats />);

    expect(screen.getByText("1")).toBeInTheDocument();
    // holders = 0, compactNumber(0) → "0"
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  // ── partial loading: stats ready but holders still loading ────────────
  it("shows stats values but skeleton for holders when only holder data is pending", () => {
    setupMocks(
      {
        data: { totalAssets: 7, tvl: 2_500_000_00n, totalHolders: null, assets: [] },
        loading: false,
        error: null,
      },
      { data: null, loading: true, error: null }, // holder totals not yet resolved
    );

    const { container } = render(<PlatformStats />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("$2.5M")).toBeInTheDocument();

    // "Approved holders" tile still shows a skeleton
    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ── large numbers formatting ───────────────────────────────────────────
  it("formats large TVL values with compact notation", () => {
    setupMocks(
      {
        data: { totalAssets: 100, tvl: 1_200_000_000_00n, totalHolders: null, assets: [] }, // $1.2B
        loading: false,
        error: null,
      },
      { data: 50_000, loading: false, error: null },
    );

    render(<PlatformStats />);

    expect(screen.getByText("$1.2B")).toBeInTheDocument();
    expect(screen.getByText("50K")).toBeInTheDocument();
  });

  // ── three tiles rendered ───────────────────────────────────────────────
  it("renders exactly 3 stat tiles when data is loading", () => {
    setupMocks(
      { loading: true, error: null },
      { data: null, loading: true, error: null },
    );

    const { container } = render(<PlatformStats />);

    // Each tile is a div.card.p-6
    const tiles = container.querySelectorAll(".card.p-6");
    expect(tiles).toHaveLength(3);
  });
});
