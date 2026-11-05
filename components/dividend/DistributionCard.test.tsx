/**
 * Tests for components/dividend/DistributionCard.tsx
 *
 * Strategy: mock ClaimButton (to avoid its useTx / useWallet deps) and
 * date-fns so relative-time strings are deterministic. Prop-drive
 * DistributionWithClaim directly to test rendering logic.
 *
 * States covered:
 *   1. Active distribution — "Active" badge shown
 *   2. Completed distribution — "Complete" badge shown
 *   3. Claimed percentage rendered correctly
 *   4. Claimed row shown when wallet has already claimed
 *   5. Claimed row shown when claimable > 0
 *   6. No claim row when nothing to claim and not yet claimed
 *   7. Ledger fallback text when currentLedger is null
 *   8. Approximate date shown when currentLedger is provided
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DistributionWithClaim } from "@/hooks/useDividends";

// ── mock ClaimButton ───────────────────────────────────────────────────────

jest.mock("./ClaimButton", () => ({
  PAYMENT_TOKEN_DECIMALS: 7,
  ClaimButton: ({
    distributionId,
    claimed,
    claimable,
    onPendingClaim,
  }: {
    distributionId: bigint;
    claimed: boolean;
    claimable: bigint;
    onPendingClaim?: (amount: bigint) => void;
  }) => (
    <button
      data-testid="claim-button"
      data-distribution-id={distributionId.toString()}
      data-claimed={String(claimed)}
      data-claimable={claimable.toString()}
      onClick={() => onPendingClaim?.(claimable)}
    >
      Mock claim
    </button>
  ),
}));

// ── mock date-fns to avoid non-deterministic relative times ───────────────

jest.mock("date-fns", () => ({
  formatDistanceToNow: jest.fn(() => "2 days ago"),
}));

// ── mock ledgerToApproxDate so we control when a date is returned ─────────

jest.mock("@/lib/format", () => {
  const actual = jest.requireActual("@/lib/format");
  return {
    ...actual,
    ledgerToApproxDate: jest.fn(() => new Date("2024-01-01T00:00:00Z")),
  };
});

import { DistributionCard } from "./DistributionCard";

// ── factory ────────────────────────────────────────────────────────────────

function makeDistribution(
  overrides: Partial<DistributionWithClaim> = {},
): DistributionWithClaim {
  return {
    id: 1n,
    assetToken: "CASSET1234",
    paymentToken: "CPAYMENT5678",
    totalAmount: 1000_0000000n, // 1000 tokens @ 7 decimals
    distributed: 250_0000000n, // 250 tokens = 25%
    paymentTokenDecimals: 7,
    createdAt: 50000,
    completed: false,
    claimable: 0n,
    claimed: false,
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("DistributionCard", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── distribution id ──────────────────────────────────────────────────────
  it("renders the distribution id in the heading", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ id: 42n })}
        currentLedger={null}
      />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Distribution #42",
    );
  });

  // ── status badges ────────────────────────────────────────────────────────
  it("shows 'Active' badge for incomplete distributions", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ completed: false })}
        currentLedger={null}
      />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("shows 'Complete' badge for completed distributions", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ completed: true })}
        currentLedger={null}
      />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  // ── claimed percentage ───────────────────────────────────────────────────
  it("renders 25.0% when 250 of 1000 tokens are distributed", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          distributed: 250_0000000n,
          totalAmount: 1000_0000000n,
        })}
        currentLedger={null}
      />,
    );
    expect(screen.getByText(/25\.0%/)).toBeInTheDocument();
  });

  it("includes a submitted claim in progress while clearly marking it pending", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          distributed: 250_0000000n,
          totalAmount: 1000_0000000n,
          claimable: 100_0000000n,
        })}
        currentLedger={null}
      />,
    );

    const claim = screen.getByTestId("claim-button");
    expect(claim).toBeInTheDocument();
    fireEvent.click(claim);
    expect(screen.getByText(/claimed \(including pending\)/i)).toBeInTheDocument();
    expect(screen.getByText(/350 \/ 1,000 \(35\.0%\)/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/awaiting on-chain confirmation/i);
  });

  it("renders 100.0% when fully distributed", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          distributed: 1000_0000000n,
          totalAmount: 1000_0000000n,
          completed: true,
        })}
        currentLedger={null}
      />,
    );
    expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
  });

  it("renders 0.0% when nothing has been distributed", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          distributed: 0n,
          totalAmount: 1000_0000000n,
        })}
        currentLedger={null}
      />,
    );
    expect(screen.getByText(/0\.0%/)).toBeInTheDocument();
  });

  // ── total pool amount ────────────────────────────────────────────────────
  it("renders the total pool amount", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ totalAmount: 500_0000000n })}
        currentLedger={null}
      />,
    );
    // 500_0000000 @ 7 decimals = 500 – rendered twice (numerator + total)
    const matches = screen.getAllByText("500");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("formats distribution amounts using the payment token's decimals", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({
          totalAmount: 12_345n,
          distributed: 1_234n,
          paymentTokenDecimals: 2,
        })}
        currentLedger={null}
      />,
    );

    expect(screen.getByText("123.45")).toBeInTheDocument();
    expect(screen.getByText("12.34 / 123.45 (10.0%)")).toBeInTheDocument();
  });

  // ── claim row visibility ─────────────────────────────────────────────────
  it("renders ClaimButton when claimed=true", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimed: true, claimable: 0n })}
        currentLedger={null}
      />,
    );
    expect(screen.getByTestId("claim-button")).toBeInTheDocument();
    expect(screen.getByTestId("claim-button")).toHaveAttribute(
      "data-claimed",
      "true",
    );
  });

  it("renders ClaimButton when claimable > 0", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimed: false, claimable: 10_0000000n })}
        currentLedger={null}
      />,
    );
    expect(screen.getByTestId("claim-button")).toBeInTheDocument();
    expect(screen.getByTestId("claim-button")).toHaveAttribute(
      "data-claimable",
      "100000000",
    );
  });

  it("does not render ClaimButton when claimable=0 and not yet claimed", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ claimed: false, claimable: 0n })}
        currentLedger={null}
      />,
    );
    expect(screen.queryByTestId("claim-button")).not.toBeInTheDocument();
  });

  // ── date / ledger display ────────────────────────────────────────────────
  it("shows ledger number when currentLedger is null", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ createdAt: 50000 })}
        currentLedger={null}
      />,
    );
    expect(screen.getByText(/Ledger 50000/)).toBeInTheDocument();
  });

  it("shows approximate date when currentLedger is provided", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ createdAt: 50000 })}
        currentLedger={55000}
      />,
    );
    // date-fns mock returns "2 days ago"
    expect(screen.getByText(/Created ~2 days ago/)).toBeInTheDocument();
  });

  // ── payment token truncation ─────────────────────────────────────────────
  it("renders a truncated payment token address", () => {
    render(
      <DistributionCard
        distribution={makeDistribution({ paymentToken: "CPAYMENT5678ABCDEF" })}
        currentLedger={null}
      />,
    );
    // truncateAddress keeps first 4 + "…" + last 4
    expect(screen.getByText(/Payment token CPAY…CDEF/i)).toBeInTheDocument();
  });
});
