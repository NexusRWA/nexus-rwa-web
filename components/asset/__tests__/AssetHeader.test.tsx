/**
 * Tests for components/asset/AssetHeader.tsx
 *
 * Strategy: mock @/lib/stellar so the explorer URL is deterministic, build an
 * AssetDetail with makeAsset(), and assert the headline fields render — name,
 * symbol, formatted valuation, asset id, the token-contract explorer link, the
 * truncated issuer, and the asset-type badge. Also covers the conditional
 * "Paused" / "Delisted" chips and the unnamed-asset fallback.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { truncateAddress } from "@/lib/format";

// The header only needs explorerContractUrl; keep it deterministic and avoid
// pulling in the full Stellar SDK for a pure render test.
jest.mock("@/lib/stellar", () => ({
  explorerContractUrl: (_network: string, contractId: string) =>
    `https://stellar.expert/contract/${contractId}`,
}));

import { AssetHeader } from "../AssetHeader";

const TOKEN =
  "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX";
const ISSUER = "GBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3";

function makeAsset(overrides: Partial<AssetDetail> = {}): AssetDetail {
  const base: AssetDetail = {
    id: 1n,
    tokenContract: TOKEN,
    issuer: ISSUER,
    name: "Lagos Office Tower",
    assetType: "real_estate",
    valuation: 5_000_000_00n,
    createdAt: 100,
    active: true,
    metadata: {
      name: "Lagos Office Tower",
      symbol: "LOT",
      assetType: "real_estate",
      totalSupply: 1_000_000n,
      decimals: 2,
      admin: ISSUER,
      complianceContract:
        "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU",
      assetDescription: "A commercial tower.",
      valuation: 5_000_000_00n,
      paused: false,
    },
  };
  return { ...base, ...overrides };
}

describe("AssetHeader", () => {
  it("renders name, symbol, formatted valuation, asset id and the type badge", () => {
    render(<AssetHeader asset={makeAsset()} network="testnet" />);

    expect(screen.getByText("Lagos Office Tower")).toBeInTheDocument();
    expect(screen.getByText("LOT")).toBeInTheDocument();
    // 5_000_000_00 cents -> $5,000,000
    expect(screen.getByText("$5,000,000")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("links the token contract to the explorer, truncated", () => {
    render(<AssetHeader asset={makeAsset()} network="testnet" />);

    const link = screen.getByRole("link", {
      name: truncateAddress(TOKEN, 6, 6),
    });
    expect(link).toHaveAttribute("href", `https://stellar.expert/contract/${TOKEN}`);
  });

  it("shows the issuer address, truncated", () => {
    render(<AssetHeader asset={makeAsset()} network="testnet" />);

    expect(screen.getByText(truncateAddress(ISSUER, 6, 6))).toBeInTheDocument();
  });

  it("renders a Paused chip when the token is paused", () => {
    const asset = makeAsset({
      metadata: { ...makeAsset().metadata, paused: true },
    });
    render(<AssetHeader asset={asset} network="testnet" />);

    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("renders a Delisted chip when the asset is inactive", () => {
    render(<AssetHeader asset={makeAsset({ active: false })} network="testnet" />);

    expect(screen.getByText("Delisted")).toBeInTheDocument();
  });

  it("falls back to 'Unnamed asset' when the name is empty", () => {
    const asset = makeAsset({
      name: "",
      metadata: { ...makeAsset().metadata, name: "" },
    });
    render(<AssetHeader asset={asset} network="testnet" />);

    expect(screen.getByText("Unnamed asset")).toBeInTheDocument();
  });
});
