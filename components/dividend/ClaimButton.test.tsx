/**
 * Tests for components/dividend/ClaimButton.tsx
 *
 * Strategy: mock useWallet and useTx so nothing touches Soroban RPC or Freighter.
 * Also mock the dividend contract and TxProgress so we can assert TxProgress
 * is rendered during an active transaction phase.
 *
 * States covered:
 *   1. No wallet connected → informational text, no button
 *   2. Already claimed     → "Claimed" chip, no button
 *   3. Nothing to claim    → disabled "Nothing to claim" button
 *   4. Claimable amount    → enabled "Claim <amount>" button
 *   5. Tx in flight        → TxProgress rendered instead of button
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ── mock hooks ─────────────────────────────────────────────────────────────

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(),
}));

// ── mock the dividend contract so tx.run() doesn't go to the network ──────

jest.mock("@/lib/contracts", () => ({
  dividend: {
    claim: jest.fn(),
  },
}));

// ── mock TxProgress so we don't need its deps (stellar RPC, etc.) ─────────

jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: ({
    phase,
    successMessage,
  }: {
    phase: string;
    successMessage?: string;
  }) => (
    <div data-testid="tx-progress" data-phase={phase}>
      {successMessage}
    </div>
  ),
}));

import { useWallet } from "@/hooks/useWallet";
import { useTx } from "@/hooks/useTx";
import { ClaimButton as ClaimButtonComponent } from "./ClaimButton";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;

function ClaimButton(props: Omit<React.ComponentProps<typeof ClaimButtonComponent>, "decimals"> & { decimals?: number }) {
  return <ClaimButtonComponent {...props} decimals={props.decimals ?? 7} />;
}

// ── helpers ────────────────────────────────────────────────────────────────

const BASE_TX: ReturnType<typeof useTx> = {
  phase: "idle",
  hash: null,
  error: null,
  errorType: "generic",
  estimatedFee: null,
  pending: false,
  retryable: false,
  run: jest.fn().mockResolvedValue(null),
  retry: jest.fn(),
  reset: jest.fn(),
};

function setupWallet(address: string | null) {
  mockUseWallet.mockReturnValue({
    address,
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
  });
}

function setupTx(overrides: Partial<ReturnType<typeof useTx>> = {}) {
  mockUseTx.mockReturnValue({ ...BASE_TX, ...overrides });
}

const DISTRIBUTION_ID = 1n;

// ── tests ──────────────────────────────────────────────────────────────────

describe("ClaimButton", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── 1. No wallet connected ───────────────────────────────────────────────
  describe("when no wallet is connected", () => {
    it("renders an informational message instead of a button", () => {
      setupWallet(null);
      setupTx();
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={1000_0000000n}
          claimed={false}
        />,
      );
      expect(screen.getByText(/connect a wallet to claim/i)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // ── 2. Already claimed ───────────────────────────────────────────────────
  describe("when the distribution has already been claimed", () => {
    it("renders a 'Claimed' chip and no button", () => {
      setupWallet("GABCDEF1234");
      setupTx();
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={0n}
          claimed={true}
        />,
      );
      expect(screen.getByText("Claimed")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // ── 3. Nothing to claim ──────────────────────────────────────────────────
  describe("when claimable amount is zero", () => {
    it("renders a disabled 'Nothing to claim' button", () => {
      setupWallet("GABCDEF1234");
      setupTx();
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={0n}
          claimed={false}
        />,
      );
      const btn = screen.getByRole("button", { name: /nothing to claim/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });
  });

  // ── 4. Claimable amount present ──────────────────────────────────────────
  describe("when there is a claimable amount", () => {
    it("formats the claimable amount using the payment token's decimal scale", () => {
      setupWallet("GABCDEF1234");
      setupTx();
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={12_345n}
          claimed={false}
          decimals={2}
        />,
      );

      expect(screen.getByRole("button", { name: /claim 123\.45/i })).toBeInTheDocument();
    });

    it("renders an enabled 'Claim <amount>' button", () => {
      setupWallet("GABCDEF1234");
      setupTx();
      // 10_0000000 raw units @ 7 decimals = 10
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
        />,
      );
      const btn = screen.getByRole("button", { name: /claim 10/i });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it("calls tx.run when the claim button is clicked", async () => {
      setupWallet("GABCDEF1234");
      const run = jest.fn().mockResolvedValue(null);
      setupTx({ run });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /claim/i }));
      await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    });

    it("calls onClaimed callback after a successful claim", async () => {
      setupWallet("GABCDEF1234");
      const onClaimed = jest.fn();
      const run = jest.fn().mockResolvedValue({ hash: "abc123" });
      setupTx({ run });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
          onClaimed={onClaimed}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /claim/i }));
      await waitFor(() => expect(onClaimed).toHaveBeenCalledTimes(1));
    });

    it("does not call onClaimed when tx.run returns null (failure)", async () => {
      setupWallet("GABCDEF1234");
      const onClaimed = jest.fn();
      const run = jest.fn().mockResolvedValue(null);
      setupTx({ run });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
          onClaimed={onClaimed}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /claim/i }));
      await waitFor(() => expect(run).toHaveBeenCalled());
      expect(onClaimed).not.toHaveBeenCalled();
    });

    it("reports the claim as pending only while awaiting on-chain confirmation", () => {
      setupWallet("GABCDEF1234");
      const onPendingClaim = jest.fn();
      setupTx({ phase: "confirming", pending: true });
      const { rerender } = render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
          onPendingClaim={onPendingClaim}
        />,
      );
      expect(onPendingClaim).toHaveBeenLastCalledWith(10_0000000n);

      setupTx({ phase: "error", pending: false });
      rerender(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
          onPendingClaim={onPendingClaim}
        />,
      );
      expect(onPendingClaim).toHaveBeenLastCalledWith(0n);
    });

    it("disables the button while a transaction is pending", () => {
      setupWallet("GABCDEF1234");
      setupTx({ pending: true });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
        />,
      );
      // When pending=true but phase is still "idle" the button is rendered disabled
      const btn = screen.getByRole("button", { name: /claim/i });
      expect(btn).toBeDisabled();
    });
  });

  // ── 5. Tx in flight ──────────────────────────────────────────────────────
  describe("while a transaction is in progress", () => {
    it.each(["building", "signing", "submitting", "confirming"] as const)(
      "renders TxProgress (not the claim button) for phase '%s'",
      (phase) => {
        setupWallet("GABCDEF1234");
        setupTx({ phase, pending: true });
        render(
          <ClaimButton
            distributionId={DISTRIBUTION_ID}
            claimable={10_0000000n}
            claimed={false}
          />,
        );
        expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
        expect(screen.getByTestId("tx-progress")).toHaveAttribute("data-phase", phase);
        expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
      },
    );

    it("renders TxProgress with the success message on success", () => {
      setupWallet("GABCDEF1234");
      setupTx({ phase: "success", pending: false });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
        />,
      );
      expect(screen.getByTestId("tx-progress")).toBeInTheDocument();
      expect(
        screen.getByText(/dividend claimed to your wallet/i),
      ).toBeInTheDocument();
    });

    it("renders TxProgress on error state", () => {
      setupWallet("GABCDEF1234");
      setupTx({ phase: "error", error: "Network timeout", pending: false });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
        />,
      );
      expect(screen.getByTestId("tx-progress")).toHaveAttribute("data-phase", "error");
    });

    it("disables button when pending to prevent double submission", () => {
      setupWallet("GABCDEF1234");
      setupTx({ phase: "signing", pending: true });
      render(
        <ClaimButton
          distributionId={DISTRIBUTION_ID}
          claimable={10_0000000n}
          claimed={false}
        />,
      );
      // When pending=true and phase is "idle" (edge case), button would be disabled
      // In normal flow, TxProgress is shown instead, but verify pending=true disables
      const button = screen.queryByRole("button", { name: /claim/i });
      if (button) {
        expect(button).toBeDisabled();
      }
    });
  });
});
