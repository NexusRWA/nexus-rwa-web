/**
 * Tests for components/asset/CompliancePanel.tsx
 *
 * Strategy: mock useComplianceOverview so the panel renders without any
 * Soroban / Stellar SDK calls, then drive it through the loading, error,
 * blocked, allowed and missing-contract states.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { truncateAddress } from "@/lib/format";

// ── mock hooks / SDK-backed modules ────────────────────────────────────────
jest.mock("@/hooks/useCompliance", () => ({
  useComplianceOverview: jest.fn(),
}));

jest.mock("@/lib/stellar", () => ({
  explorerContractUrl: (_network: string, contractId: string) =>
    `https://stellar.expert/contract/${contractId}`,
}));

import { useComplianceOverview } from "@/hooks/useCompliance";
import { CompliancePanel } from "../CompliancePanel";

const mockUseComplianceOverview = useComplianceOverview as jest.MockedFunction<
  typeof useComplianceOverview
>;

// ── helpers ────────────────────────────────────────────────────────────────

const COMPLIANCE_ID = "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU";

function makeAsset(complianceContract = COMPLIANCE_ID): AssetDetail {
  return {
    id: 1n,
    tokenContract: "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX",
    issuer: "GBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
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
      admin: "GBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3",
      complianceContract,
      assetDescription: "A commercial tower.",
      valuation: 5_000_000_00n,
      paused: false,
    },
  };
}

type OverviewState = ReturnType<typeof useComplianceOverview>;

function setupMock(state: Partial<OverviewState>) {
  mockUseComplianceOverview.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...state,
  } as OverviewState);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("CompliancePanel", () => {
  afterEach(() => jest.clearAllMocks());

  it("shows the compliance contract, allowlist size and blocked jurisdictions", () => {
    setupMock({
      data: {
        allowlistSize: 12,
        jurisdictions: [
          { code: "KP", blocked: true },
          { code: "NG", blocked: false },
          { code: "US", blocked: false },
        ],
      },
    });

    render(<CompliancePanel asset={makeAsset()} network="testnet" />);

    // Contract address, truncated the same way the rest of the app does it,
    // linked out to the explorer.
    const link = screen.getByRole("link", {
      name: truncateAddress(COMPLIANCE_ID, 6, 6),
    });
    expect(link).toHaveAttribute("href", expect.stringContaining(COMPLIANCE_ID));

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/1 blocked/)).toBeInTheDocument();
    expect(screen.getByText(/KP · Blocked/)).toBeInTheDocument();
    expect(screen.getByText("NG")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "A blocked jurisdiction won't appear here unless an approved address has that jurisdiction.",
    );
  });

  it("renders no blocked summary when every jurisdiction is allowed", () => {
    setupMock({
      data: {
        allowlistSize: 3,
        jurisdictions: [
          { code: "DE", blocked: false },
          { code: "KE", blocked: false },
        ],
      },
    });

    render(<CompliancePanel asset={makeAsset()} network="testnet" />);

    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getByText("KE")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ blocked/i)).toBeNull();
    expect(screen.queryByText(/· Blocked/)).toBeNull();
  });

  it("explains when the asset has no compliance contract", () => {
    render(<CompliancePanel asset={makeAsset("")} network="testnet" />);

    expect(
      screen.getByText(/doesn't reference a compliance contract/i),
    ).toBeInTheDocument();
    // Nothing to look up, so the hook is disabled with a null id.
    expect(mockUseComplianceOverview).toHaveBeenCalledWith(null);
  });

  it("renders an error state with retry when the compliance read fails", () => {
    const mockRefetch = jest.fn();
    setupMock({ error: "RPC down", refetch: mockRefetch });

    render(<CompliancePanel asset={makeAsset()} network="testnet" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load compliance data/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("says so when the allowlist has no jurisdictions yet", () => {
    setupMock({ data: { allowlistSize: 0, jurisdictions: [] } });

    render(<CompliancePanel asset={makeAsset()} network="testnet" />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.getByText(/no jurisdictions are registered/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("shows a spinner while the compliance data loads", () => {
    setupMock({ loading: true });

    render(<CompliancePanel asset={makeAsset()} network="testnet" />);

    expect(screen.getByText(/checking jurisdictions/i)).toBeInTheDocument();
    expect(screen.queryByText("—")).toBeNull();
  });
});
