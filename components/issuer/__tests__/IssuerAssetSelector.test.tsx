/**
 * Tests for components/issuer/IssuerAssetSelector.tsx
 *
 * Strategy: mock the wallet + issuer-assets hooks so the component renders
 * without any Stellar / SDK calls, then drive it through the loading, error,
 * empty, populated and selected states.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AssetEntry } from "@/types";
import { IssuerAssetSelector } from "../IssuerAssetSelector";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));
jest.mock("@/hooks/useAssets", () => ({
  useIssuerAssets: jest.fn(),
}));

import { useWallet } from "@/hooks/useWallet";
import { useIssuerAssets } from "@/hooks/useAssets";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseIssuerAssets = useIssuerAssets as jest.MockedFunction<
  typeof useIssuerAssets
>;

function makeAsset(
  id: bigint,
  name: string,
  assetType = "real_estate",
  valuation = 5_000_000_00n,
): AssetEntry {
  return {
    id,
    tokenContract: `C${"A".repeat(55)}`,
    issuer: `G${"B".repeat(55)}`,
    name,
    assetType,
    valuation,
    createdAt: 1,
    active: true,
  };
}

beforeEach(() => {
  mockUseWallet.mockReturnValue({
    address: "GADDR",
    network: "testnet",
  } as unknown as ReturnType<typeof useWallet>);
});

afterEach(() => jest.clearAllMocks());

describe("IssuerAssetSelector", () => {
  it("shows a spinner while the wallet's assets load", () => {
    mockUseIssuerAssets.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      updatedAt: null,
      refetch: jest.fn(),
    });
    render(<IssuerAssetSelector selected={null} onSelect={jest.fn()} />);

    expect(screen.getByText(/Loading your assets/i)).toBeInTheDocument();
  });

  it("renders an error state with a working retry", () => {
    const refetch = jest.fn();
    mockUseIssuerAssets.mockReturnValue({
      data: null,
      loading: false,
      error: "RPC down",
      updatedAt: null,
      refetch,
    });
    render(<IssuerAssetSelector selected={null} onSelect={jest.fn()} />);

    expect(screen.getByText("RPC down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("prompts to tokenize when there are no assets", () => {
    mockUseIssuerAssets.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      updatedAt: null,
      refetch: jest.fn(),
    });
    render(<IssuerAssetSelector selected={null} onSelect={jest.fn()} />);

    expect(screen.getByText(/No assets registered/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Tokenize an asset/i });
    expect(link).toHaveAttribute("href", "/asset/new");
  });

  it("lists assets and selects one on click", () => {
    const a1 = makeAsset(1n, "Asset A", "real_estate", 5_000_000_00n);
    const a2 = makeAsset(2n, "Asset B", "invoice", 2_500_000_00n);
    mockUseIssuerAssets.mockReturnValue({
      data: [a1, a2],
      loading: false,
      error: null,
      updatedAt: null,
      refetch: jest.fn(),
    });
    const onSelect = jest.fn();
    render(<IssuerAssetSelector selected={null} onSelect={onSelect} />);

    expect(screen.getByText("Asset A")).toBeInTheDocument();
    expect(screen.getByText("Asset B")).toBeInTheDocument();
    // Valuations render compact: 5_000_000_00 cents -> $5M, 2_500_000_00 -> $2.5M.
    expect(screen.getByText("$5M")).toBeInTheDocument();
    expect(screen.getByText("$2.5M")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
    expect(screen.getByText("Invoice")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Asset B"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2n, name: "Asset B" }),
    );
  });

  it("highlights the currently selected asset", () => {
    const a1 = makeAsset(1n, "Asset A");
    mockUseIssuerAssets.mockReturnValue({
      data: [a1],
      loading: false,
      error: null,
      updatedAt: null,
      refetch: jest.fn(),
    });
    render(<IssuerAssetSelector selected={a1} onSelect={jest.fn()} />);

    const btn = screen.getByText("Asset A").closest("button");
    expect(btn).toHaveClass("border-brand-500/40", "bg-brand-500/10");
  });
});
