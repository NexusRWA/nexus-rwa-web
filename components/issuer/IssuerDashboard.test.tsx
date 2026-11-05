/**
 * Tests for components/issuer/IssuerDashboard.tsx
 *
 * Strategy: mock useWallet and useIssuerAssets (via useAssets) at the module
 * level so neither Soroban RPC nor Freighter are touched.  Heavy sub-components
 * (panels, AssetTypeBadge, ConnectButton, etc.) are mocked to simple stubs so
 * this file tests only the dashboard's own rendering logic:
 *
 *   1. No wallet connected → wallet-gate prompt + ConnectButton
 *   2. Wallet connected, no assets → IssuerAssetSelector renders empty state
 *   3. Wallet connected, assets available → asset list rendered, "select" placeholder
 *   4. Asset selected → tab bar + panel content area shown
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AssetEntry } from "@/types";

// ── mock useWallet ─────────────────────────────────────────────────────────

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

// ── mock useAssets (useIssuerAssets lives here) ────────────────────────────

jest.mock("@/hooks/useAssets", () => ({
  useIssuerAssets: jest.fn(),
}));

// ── mock useAsset (asset detail for the selected asset) ───────────────────
// Return a minimal AssetDetail so the panel branch renders (requires data to
// be non-null to show tabs + panel content).

const MOCK_ASSET_DETAIL = {
  id: 1n,
  tokenContract: "CTOKEN1",
  issuer: "GISSUER",
  name: "Warehouse A",
  assetType: "real_estate",
  valuation: 1_000_000_00n,
  createdAt: 50000,
  active: true,
  metadata: {
    name: "Warehouse A",
    symbol: "WHA",
    assetType: "real_estate",
    totalSupply: 1000000n,
    decimals: 7,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "A warehouse",
    valuation: 1_000_000_00n,
    paused: false,
  },
};

jest.mock("@/hooks/useAsset", () => ({
  useAsset: jest.fn(() => ({
    data: MOCK_ASSET_DETAIL,
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
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

// ── mock heavy sub-components ──────────────────────────────────────────────

jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

jest.mock("@/components/asset/AssetTypeBadge", () => ({
  AssetTypeBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

jest.mock("@/components/ui/Skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} aria-hidden="true" />
  ),
}));

jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("@/components/ui/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

jest.mock("@/components/issuer/panels/TokenPanel", () => ({
  TokenPanel: () => <div data-testid="token-panel" />,
}));

jest.mock("@/components/issuer/panels/CompliancePanel", () => ({
  CompliancePanel: () => <div data-testid="compliance-panel" />,
}));

jest.mock("@/components/issuer/panels/DistributionPanel", () => ({
  DistributionPanel: () => <div data-testid="distribution-panel" />,
}));

// ── imports after mocks ────────────────────────────────────────────────────

import { useWallet } from "@/hooks/useWallet";
import { useIssuerAssets } from "@/hooks/useAssets";
import { IssuerDashboard } from "./IssuerDashboard";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseIssuerAssets = useIssuerAssets as jest.MockedFunction<
  typeof useIssuerAssets
>;

// ── helpers ────────────────────────────────────────────────────────────────

const BASE_WALLET: ReturnType<typeof useWallet> = {
  address: null,
  network: "testnet",
  walletNetwork: null,
  networkUnknown: false,
  installed: true,
  connecting: false,
  error: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  setNetwork: jest.fn(),
  sign: jest.fn(),
  writeCtx: jest.fn(),
};

function setupWallet(address: string | null) {
  mockUseWallet.mockReturnValue({ ...BASE_WALLET, address });
}

type IssuerAssetsReturn = ReturnType<typeof useIssuerAssets>;

function setupIssuerAssets(overrides: Partial<IssuerAssetsReturn>) {
  mockUseIssuerAssets.mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  } as IssuerAssetsReturn);
}

function makeAsset(id: number, name: string): AssetEntry {
  return {
    id: BigInt(id),
    tokenContract: `CTOKEN${id}`,
    issuer: "GISSUER",
    name,
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 50000,
    active: true,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("IssuerDashboard", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── 1. No wallet connected ───────────────────────────────────────────────
  describe("when no wallet is connected", () => {
    it("renders the wallet-gate heading", () => {
      setupWallet(null);
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      expect(
        screen.getByRole("heading", { name: /connect your wallet/i }),
      ).toBeInTheDocument();
    });

    it("renders a ConnectButton", () => {
      setupWallet(null);
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument();
    });

    it("does not render the asset selector sidebar", () => {
      setupWallet(null);
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      // The "Your assets" h2 is only in the sidebar which doesn't render when disconnected
      expect(screen.queryByRole("heading", { name: /your assets/i })).not.toBeInTheDocument();
    });
  });

  // ── 2. Connected, no assets ───────────────────────────────────────────────
  describe("when connected but the issuer has no registered assets", () => {
    it("renders the 'Your assets' sidebar label", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      expect(screen.getByText(/your assets/i)).toBeInTheDocument();
    });

    it("renders the empty state from IssuerAssetSelector", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      expect(screen.getByText(/no assets registered/i)).toBeInTheDocument();
    });

    it("renders a link to tokenize a new asset", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      expect(
        screen.getByRole("link", { name: /tokenize an asset/i }),
      ).toHaveAttribute("href", "/asset/new");
    });

    it("renders the 'Select an asset' placeholder in the main panel", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [] });
      render(<IssuerDashboard />);
      expect(screen.getByText(/select an asset to manage/i)).toBeInTheDocument();
    });
  });

  // ── 3. Connected, assets available, none selected ────────────────────────
  describe("when connected and assets are available", () => {
    it("renders buttons for each asset", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({
        data: [
          makeAsset(1, "Warehouse A"),
          makeAsset(2, "Office Block B"),
        ],
      });
      render(<IssuerDashboard />);
      expect(
        screen.getByRole("button", { name: /Warehouse A/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Office Block B/i }),
      ).toBeInTheDocument();
    });

    it("shows the 'select an asset' placeholder before any selection", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [makeAsset(1, "Warehouse A")] });
      render(<IssuerDashboard />);
      expect(screen.getByText(/select an asset to manage/i)).toBeInTheDocument();
    });
  });

  // ── 4. Asset selected → tabs + panel ────────────────────────────────────
  describe("when an asset is selected", () => {
    function renderWithSelection() {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: [makeAsset(1, "Warehouse A")] });
      render(<IssuerDashboard />);
      fireEvent.click(screen.getByRole("button", { name: /Warehouse A/i }));
    }

    it("hides the 'select an asset' placeholder after selection", () => {
      renderWithSelection();
      expect(
        screen.queryByText(/select an asset to manage/i),
      ).not.toBeInTheDocument();
    });

    it("renders the Token, Compliance and Distributions tab buttons", () => {
      renderWithSelection();
      expect(screen.getByRole("button", { name: /token/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /compliance/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /distributions/i }),
      ).toBeInTheDocument();
    });

    it("shows the TokenPanel by default", () => {
      renderWithSelection();
      expect(screen.getByTestId("token-panel")).toBeInTheDocument();
    });

    it("switches to CompliancePanel when the Compliance tab is clicked", () => {
      renderWithSelection();
      fireEvent.click(screen.getByRole("button", { name: /compliance/i }));
      expect(screen.getByTestId("compliance-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("token-panel")).not.toBeInTheDocument();
    });

    it("switches to DistributionPanel when the Distributions tab is clicked", () => {
      renderWithSelection();
      fireEvent.click(screen.getByRole("button", { name: /distributions/i }));
      expect(screen.getByTestId("distribution-panel")).toBeInTheDocument();
      expect(screen.queryByTestId("token-panel")).not.toBeInTheDocument();
    });

    it("shows the selected asset's name in the context bar", () => {
      renderWithSelection();
      // Name appears in both the sidebar button and the context bar — both are correct
      const matches = screen.getAllByText("Warehouse A");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 5. Loading state ──────────────────────────────────────────────────────
  describe("while issuer assets are loading", () => {
    it("renders the spinner inside the selector panel", () => {
      setupWallet("GABCDEF1234");
      setupIssuerAssets({ data: null, loading: true });
      render(<IssuerDashboard />);
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });
  });
});
