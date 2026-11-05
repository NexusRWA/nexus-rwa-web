/**
 * Tests for components/asset/AssetStats.tsx
 *
 * Strategy: render the component directly with controlled AssetDetail fixtures
 * and assert the formatted values that appear in the term-definition list.
 * No hooks are needed — AssetStats is a pure presentational component.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";

import { AssetStats } from "../AssetStats";

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<AssetDetail["metadata"]> = {}): AssetDetail {
  return {
    id: 1n,
    tokenContract: "CTOKEN123",
    issuer: "GISSUER123",
    name: "Lagos Office Tower",
    assetType: "real_estate",
    valuation: 5_000_000_00n,
    createdAt: 200,
    active: true,
    metadata: {
      name: "Lagos Office Tower",
      symbol: "LOT",
      assetType: "real_estate",
      totalSupply: 1_000_000_00n, // 1,000,000.00 with 2 decimals
      decimals: 2,
      admin: "GADMIN",
      complianceContract: "CCOMPLIANCE",
      assetDescription: "A commercial tower.",
      valuation: 5_000_000_00n, // $5,000,000
      paused: false,
      ...overrides,
    },
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("AssetStats", () => {
  // ── total supply formatting ────────────────────────────────────────────

  it("formats total supply with the correct token symbol", () => {
    render(<AssetStats asset={makeAsset()} />);

    // 1_000_000_00n at 2 decimals = 1,000,000 LOT
    expect(screen.getByText("1,000,000 LOT")).toBeInTheDocument();
  });

  it("displays the 'Total supply' label", () => {
    render(<AssetStats asset={makeAsset()} />);
    expect(screen.getByText("Total supply")).toBeInTheDocument();
  });

  it("formats large supply values with thousands separators", () => {
    render(
      <AssetStats
        asset={makeAsset({ totalSupply: 10_000_000_000_00n, decimals: 2, symbol: "BIG" })}
      />,
    );
    // 10_000_000_000_00n (= 1_000_000_000_000) at 2 decimals = 10,000,000,000 BIG
    expect(screen.getByText("10,000,000,000 BIG")).toBeInTheDocument();
  });

  // ── zero supply ────────────────────────────────────────────────────────

  it("handles a zero-supply asset without crashing and shows '0 <symbol>'", () => {
    render(<AssetStats asset={makeAsset({ totalSupply: 0n, symbol: "NEW" })} />);
    expect(screen.getByText("0 NEW")).toBeInTheDocument();
  });

  // ── decimals row ───────────────────────────────────────────────────────

  it("displays the 'Decimals' label and its value", () => {
    render(<AssetStats asset={makeAsset({ decimals: 7 })} />);
    expect(screen.getByText("Decimals")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("displays decimals of 0 correctly", () => {
    render(
      <AssetStats
        asset={makeAsset({ decimals: 0, totalSupply: 5_000n, symbol: "NODEC" })}
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument(); // decimals value
    expect(screen.getByText("5,000 NODEC")).toBeInTheDocument();
  });

  // ── valuation formatting ───────────────────────────────────────────────

  it("formats valuation from USD cents to a dollar string", () => {
    render(<AssetStats asset={makeAsset({ valuation: 5_000_000_00n })} />);
    // 5_000_000_00n cents = $5,000,000
    expect(screen.getByText("$5,000,000")).toBeInTheDocument();
  });

  it("displays the 'Valuation' label", () => {
    render(<AssetStats asset={makeAsset()} />);
    expect(screen.getByText("Valuation")).toBeInTheDocument();
  });

  it("formats a fractional cent valuation correctly", () => {
    // 1_23n cents = $1.23
    render(<AssetStats asset={makeAsset({ valuation: 1_23n })} />);
    expect(screen.getByText("$1.23")).toBeInTheDocument();
  });

  it("formats zero valuation as $0", () => {
    render(<AssetStats asset={makeAsset({ valuation: 0n })} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  // ── holders row ───────────────────────────────────────────────────────

  it("does not render the Holders row when holders prop is omitted", () => {
    render(<AssetStats asset={makeAsset()} />);
    expect(screen.queryByText("Holders")).not.toBeInTheDocument();
  });

  it("renders the Holders row with the formatted count when holders is provided", () => {
    render(<AssetStats asset={makeAsset()} holders={1_234} />);
    expect(screen.getByText("Holders")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("renders holders of 0 as '0'", () => {
    render(<AssetStats asset={makeAsset()} holders={0} />);
    expect(screen.getByText("Holders")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  // ── row count ─────────────────────────────────────────────────────────

  it("renders 3 rows when holders is omitted", () => {
    render(<AssetStats asset={makeAsset()} />);
    // dl > div rows: Total supply, Decimals, Valuation
    const rows = document.querySelectorAll("dl > div");
    expect(rows).toHaveLength(3);
  });

  it("renders 4 rows when holders is provided", () => {
    render(<AssetStats asset={makeAsset()} holders={42} />);
    const rows = document.querySelectorAll("dl > div");
    expect(rows).toHaveLength(4);
  });
});
