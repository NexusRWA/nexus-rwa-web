/**
 * Tests for components/issuer/panels/DistributionPanel.tsx
 *
 * Focus areas:
 *   1. ExistingDistributionsCard renders a progress bar whose width is
 *      derived from percent(d.distributed, d.totalAmount). The width must
 *      always be clamped to [0, 100].
 *
 *   2. (#323) CreateDistributionCard shows known-token preset buttons so the
 *      issuer can fill the payment-token field without pasting a raw contract
 *      address. Each preset button fills the input with the correct contract ID
 *      for the current network.
 *
 * Strategy: mock useDividends so we control the Distribution objects directly,
 * mock useTx / CreateDistributionCard dependencies so we only test the
 * ExistingDistributionsCard branch, and spy on percent() to confirm the clamp
 * at the render site defends against an out-of-range return.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AssetDetail } from "@/types";

// ── mock useDividends ──────────────────────────────────────────────────────

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(() => ({ address: "GTESTADDRESS", network: "testnet" })),
}));

jest.mock("@/hooks/useAsync", () => ({
  useAsync: jest.fn(() => ({ data: null, loading: false, error: null, refetch: jest.fn() })),
}));

jest.mock("@/hooks/useDividends", () => ({
  useDividends: jest.fn(),
}));

jest.mock("@/hooks/useHolders", () => ({
  useHolders: jest.fn(() => ({
    data: [],
    loading: false,
    error: null,
    updatedAt: null,
    refetch: jest.fn(),
  })),
  fetchOnChainHolders: jest.fn().mockResolvedValue([]),
}));

// ── mock useTx (CreateDistributionCard) ───────────────────────────────────

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(() => ({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    retryable: false,
    run: jest.fn(),
    retry: jest.fn(),
    reset: jest.fn(),
  })),
}));

// ── mock @stellar/stellar-sdk ─────────────────────────────────────────────

// Only StrKey is stubbed; lib/stellar reads Networks at import time, so the
// rest of the module has to stay real.
jest.mock("@stellar/stellar-sdk", () => ({
  ...jest.requireActual("@stellar/stellar-sdk"),
  StrKey: {
    isValidEd25519PublicKey: () => false,
    isValidContract: (address: string) => address.startsWith("C"),
  },
}));

// ── mock ActionCard / TxProgress / Spinner / EmptyState / ErrorState ──────

jest.mock("@/components/issuer/ActionCard", () => ({
  ActionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: () => <div data-testid="tx-progress" />,
}));
jest.mock("@/components/ui/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));
jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));
jest.mock("@/components/ui/ErrorState", () => ({
  ErrorState: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));

// ── mock percent so we can force out-of-range values ──────────────────────
// By default we proxy to the real implementation; individual tests override.

import * as formatModule from "@/lib/format";
const realPercent = formatModule.percent;
const percentSpy = jest.spyOn(formatModule, "percent");

// ── imports after mocks ────────────────────────────────────────────────────

import { useDividends } from "@/hooks/useDividends";
import type { DistributionWithClaim } from "@/hooks/useDividends";
import { useAsync } from "@/hooks/useAsync";
import { DistributionPanel } from "../DistributionPanel";

const mockUseDividends = useDividends as jest.MockedFunction<typeof useDividends>;
const mockUseAsync = useAsync as jest.Mock;

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(): AssetDetail {
  return {
    id: 1n,
    tokenContract: "CTOKEN123",
    issuer: "GISSUER123",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: 1_000_000_00n,
    createdAt: 50000,
    active: true,
    metadata: {
      name: "Test Asset",
      symbol: "TST",
      assetType: "real_estate",
      totalSupply: 1_000_000n,
      decimals: 7,
      admin: "GISSUER123",
      complianceContract: "CCOMPLIANCE",
      assetDescription: "",
      valuation: 1_000_000_00n,
      paused: false,
    },
  };
}

function makeDistribution(
  id: bigint,
  distributed: bigint,
  totalAmount: bigint,
  completed = false,
): DistributionWithClaim {
  return {
    id,
    assetToken: "CTOKEN123",
    paymentToken: "CPAYTOKEN",
    totalAmount,
    distributed,
    paymentTokenDecimals: 7,
    createdAt: 100,
    completed,
    claimable: 0n,
    claimed: false,
  };
}

type DividendsReturn = ReturnType<typeof useDividends>;

function setupDividends(data: DividendsReturn["data"], extras: Partial<DividendsReturn> = {}) {
  mockUseDividends.mockReturnValue({
    data,
    loading: false,
    error: null,
    refetch: jest.fn(),
    ...extras,
  } as DividendsReturn);
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("DistributionPanel – ExistingDistributionsCard progress bar clamping", () => {
  beforeEach(() => {
    percentSpy.mockImplementation(realPercent);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders a progress bar at 50% when half the total is distributed", () => {
    setupDividends([makeDistribution(1n, 5_000_000n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBe("50%");
  });

  it("renders the bar at 100% when fully distributed (normal complete case)", () => {
    setupDividends([makeDistribution(1n, 10_000_000n, 10_000_000n, true)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("clamps bar width to 100% when percent() returns above 100", () => {
    // Force percent() to return 102.5 to simulate a rounding path where
    // distributed slightly exceeds totalAmount.
    percentSpy.mockReturnValue(102.5);

    setupDividends([makeDistribution(1n, 10_200_000n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("clamps bar width to 0% when percent() returns a negative value", () => {
    // Defensive: percent() itself clamps but we guard at the render site too.
    percentSpy.mockReturnValue(-5);

    setupDividends([makeDistribution(1n, 0n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("renders a bar at 0% for a brand-new distribution with nothing distributed", () => {
    setupDividends([makeDistribution(1n, 0n, 10_000_000n)]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bar = document.querySelector(".bg-gradient-to-r") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });

  it("renders multiple distributions with individually correct bar widths", () => {
    setupDividends([
      makeDistribution(1n, 2_500_000n, 10_000_000n),   // 25%
      makeDistribution(2n, 10_000_000n, 10_000_000n, true), // 100%
    ]);
    render(<DistributionPanel asset={makeAsset()} />);

    const bars = Array.from(
      document.querySelectorAll<HTMLElement>(".bg-gradient-to-r"),
    );
    expect(bars).toHaveLength(2);
    expect(bars.map((bar) => bar.style.width)).toEqual(["25%", "100%"]);
  });

  it("shows an empty state when there are no distributions", () => {
    setupDividends([]);
    render(<DistributionPanel asset={makeAsset()} />);

    expect(screen.getByText(/no distributions yet/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when the distributions fetch fails", () => {
    setupDividends(null, { error: "RPC unavailable", loading: false });
    render(<DistributionPanel asset={makeAsset()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ── known-token preset tests (#323) ────────────────────────────────────────
//
// The XLM SAC contract IDs used in these tests are the canonical well-known
// addresses embedded in KNOWN_TOKENS inside DistributionPanel.tsx.

const XLM_SAC_TESTNET = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN4";
const XLM_SAC_MAINNET = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

import { useWallet } from "@/hooks/useWallet";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

describe("DistributionPanel – CreateDistributionCard known-token presets (#323)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure distributions card renders with no data to avoid interfering.
    mockUseDividends.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      updatedAt: null,
      refetch: jest.fn(),
    } as ReturnType<typeof useDividends>);
  });

  it("shows an XLM SAC preset button on testnet", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "testnet" } as ReturnType<typeof useWallet>);
    render(<DistributionPanel asset={makeAsset()} />);

    expect(screen.getByRole("button", { name: /use native xlm .sac. \(CDLZFC/i })).toBeInTheDocument();
  });

  it("shows an XLM SAC preset button on mainnet", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "mainnet" } as ReturnType<typeof useWallet>);
    render(<DistributionPanel asset={makeAsset()} />);

    expect(screen.getByRole("button", { name: /use native xlm .sac. \(CAS3J7/i })).toBeInTheDocument();
  });

  it("clicking the testnet XLM SAC preset fills the payment-token input", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "testnet" } as ReturnType<typeof useWallet>);
    render(<DistributionPanel asset={makeAsset()} />);

    fireEvent.click(screen.getByRole("button", { name: /use native xlm .sac. \(CDLZFC/i }));

    const input = document.getElementById("dist-payment-token") as HTMLInputElement;
    expect(input.value).toBe(XLM_SAC_TESTNET);
  });

  it("clicking the mainnet XLM SAC preset fills the payment-token input with the mainnet address", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "mainnet" } as ReturnType<typeof useWallet>);
    render(<DistributionPanel asset={makeAsset()} />);

    fireEvent.click(screen.getByRole("button", { name: /use native xlm .sac. \(CAS3J7/i }));

    const input = document.getElementById("dist-payment-token") as HTMLInputElement;
    expect(input.value).toBe(XLM_SAC_MAINNET);
  });

  it("applies an active style to the preset button when its address is currently in the input", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "testnet" } as ReturnType<typeof useWallet>);
    render(<DistributionPanel asset={makeAsset()} />);

    const presetBtn = screen.getByRole("button", { name: /use native xlm .sac. \(CDLZFC/i });

    // Before clicking: should NOT have the active (brand) class.
    expect(presetBtn.className).not.toContain("text-brand-300");

    // After clicking: should get the active class.
    fireEvent.click(presetBtn);
    expect(presetBtn.className).toContain("text-brand-300");
  });

  it("clicking a preset does not submit the form", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "testnet" } as ReturnType<typeof useWallet>);
    const { useTx: mockUseTxFn } = require("@/hooks/useTx") as { useTx: jest.MockedFunction<typeof import("@/hooks/useTx").useTx> };
    const mockRunFn = mockUseTxFn().run as jest.Mock;
    render(<DistributionPanel asset={makeAsset()} />);

    fireEvent.click(screen.getByRole("button", { name: /use native xlm .sac. \(CDLZFC/i }));

    expect(mockRunFn).not.toHaveBeenCalled();
  });

  it("clearly blocks creation when the dividend contract allowance is too low", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "testnet" } as ReturnType<typeof useWallet>);
    mockUseAsync.mockImplementation((_loader: unknown, deps: unknown[]) => ({
      // Two deps is the payment-token decimals read, which must resolve before
      // the requested amount can be parsed and compared.
      data:
        deps.length === 2
          ? { token: deps[1], decimals: 7 }
          : deps.length === 4
            ? { token: deps[1], amount: 5_0000000n }
            : { token: deps[1], amount: 100_0000000n },
      loading: false,
      error: null,
      refetch: jest.fn(),
    }));
    render(<DistributionPanel asset={makeAsset()} />);

    fireEvent.change(screen.getByLabelText(/payment token contract/i), {
      target: { value: XLM_SAC_TESTNET },
    });
    fireEvent.change(screen.getByLabelText(/total pool amount/i), {
      target: { value: "10" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/not approved to spend enough/i);
    expect(screen.getByRole("button", { name: /create distribution/i })).toBeDisabled();
  });

  it("blocks creation when the requested pool exceeds the payment-token balance", () => {
    mockUseWallet.mockReturnValue({ address: "GTESTADDRESS", network: "testnet" } as ReturnType<typeof useWallet>);
    const run = jest.fn();
    const { useTx: mockUseTxFn } = require("@/hooks/useTx") as { useTx: jest.Mock };
    mockUseTxFn.mockReturnValue({
      phase: "idle",
      hash: null,
      error: null,
      errorType: "generic",
      pending: false,
      run,
      reset: jest.fn(),
    });
    mockUseAsync.mockImplementation((_loader: unknown, deps: unknown[]) => ({
      // Two deps is the payment-token decimals read.
      data:
        deps.length === 2
          ? { token: deps[1], decimals: 7 }
          : deps.length === 4
            ? { token: deps[1], amount: 100_0000000n }
            : { token: deps[1], amount: 5_0000000n },
      loading: false,
      error: null,
      refetch: jest.fn(),
    }));
    render(<DistributionPanel asset={makeAsset()} />);

    fireEvent.change(screen.getByLabelText(/payment token contract/i), {
      target: { value: XLM_SAC_TESTNET },
    });
    fireEvent.change(screen.getByLabelText(/total pool amount/i), {
      target: { value: "10" },
    });

    const submitButton = screen.getByRole("button", { name: /create distribution/i });
    expect(submitButton).toBeDisabled();
    fireEvent.submit(submitButton.closest("form")!);
    expect(screen.getByText(/exceeds your payment-token balance/i)).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });
});
