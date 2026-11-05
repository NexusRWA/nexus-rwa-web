/**
 * Tests for components/issuer/panels/TokenPanel.tsx
 *
 * Focus: how MintCard surfaces parseTokenAmount validation errors as form
 * validation messages — specifically, amounts with more fractional digits than
 * metadata.decimals allows, and a token with decimals === 0.
 *
 * Strategy: mock useTx so no Soroban/Freighter calls occur, mock StrKey so
 * address validation is trivially satisfied, and submit the form directly via
 * userEvent / fireEvent.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { AssetDetail } from "@/types";

// ── mock useTx ─────────────────────────────────────────────────────────────
// Default: idle, never pending — the submit button is visible.

const mockRun = jest.fn().mockResolvedValue(true);

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(() => ({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    retryable: false,
    run: mockRun,
    retry: jest.fn(),
    reset: jest.fn(),
  })),
}));

// ── mock @stellar/stellar-sdk (StrKey) ─────────────────────────────────────
// Accept any string starting with "G" as a valid Ed25519 public key so tests
// don't have to generate real Stellar keypairs.

// Only StrKey is stubbed; lib/stellar reads Networks at import time, so the
// rest of the module has to stay real.
jest.mock("@stellar/stellar-sdk", () => ({
  ...jest.requireActual("@stellar/stellar-sdk"),
  StrKey: {
    isValidEd25519PublicKey: (addr: string) => addr.startsWith("G"),
    isValidContract: (addr: string) => addr.startsWith("C"),
  },
}));

// ── mock ActionCard / TxProgress (layout-only) ────────────────────────────

jest.mock("@/components/issuer/ActionCard", () => ({
  ActionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: () => <div data-testid="tx-progress" />,
}));

// ── imports after mocks ────────────────────────────────────────────────────

import { TokenPanel } from "../TokenPanel";

// ── helpers ────────────────────────────────────────────────────────────────

function makeAsset(decimals: number, paused = false): AssetDetail {
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
      totalSupply: 10_000_000_000n, // Much larger supply to avoid triggering large mint confirmation
      decimals,
      admin: "GISSUER123",
      complianceContract: "CCOMPLIANCE",
      assetDescription: "A test asset",
      valuation: 1_000_000_00n,
      paused,
    },
  };
}

const VALID_RECIPIENT = "GABCDEFGHIJ";

async function fillAndSubmit(amount: string, recipient = VALID_RECIPIENT) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: recipient },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: amount },
    });
    fireEvent.click(screen.getByRole("button", { name: /mint/i }));
  });
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("TokenPanel – MintCard parseTokenAmount validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockResolvedValue(true);
  });

  // ── decimals = 7 (normal Stellar token) ───────────────────────────────

  describe("token with 7 decimals", () => {
    beforeEach(() => {
      render(<TokenPanel asset={makeAsset(7)} />);
    });

    it("accepts an amount with exactly 7 decimal places and calls tx.run", async () => {
      await fillAndSubmit("1.1234567");
      await waitFor(() => {
        expect(screen.queryByRole("paragraph")).not.toHaveTextContent(/decimal/i);
        expect(mockRun).toHaveBeenCalledTimes(1);
      });
    });

    it("shows an error and does not call tx.run when amount has 8 decimal places", async () => {
      await fillAndSubmit("1.12345678");
      await waitFor(() => {
        expect(screen.getByText(/maximum 7 decimal places/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("shows an error for 1 extra decimal digit beyond the token's precision", async () => {
      await fillAndSubmit("0.00000001"); // 8 fractional digits
      await waitFor(() => {
        expect(screen.getByText(/maximum 7 decimal places/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("shows 'Enter a valid number' for a non-numeric string", async () => {
      await fillAndSubmit("abc");
      await waitFor(() => {
        expect(screen.getByText(/enter a valid number/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("shows 'Enter a valid number' for scientific notation", async () => {
      await fillAndSubmit("1e5");
      await waitFor(() => {
        expect(screen.getByText(/enter a valid number/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("shows 'Amount must be greater than zero' for 0", async () => {
      await fillAndSubmit("0");
      await waitFor(() => {
        expect(screen.getByText(/amount must be greater than zero/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });
  });

  // ── decimals = 0 (whole-unit-only token) ──────────────────────────────

  describe("token with 0 decimals", () => {
    beforeEach(() => {
      render(<TokenPanel asset={makeAsset(0)} />);
    });

    it("accepts a whole number and calls tx.run", async () => {
      await fillAndSubmit("100");
      await waitFor(() => {
        expect(mockRun).toHaveBeenCalledTimes(1);
      });
    });

    it("shows 'Maximum 0 decimal places' for any fractional input", async () => {
      await fillAndSubmit("1.5");
      await waitFor(() => {
        expect(screen.getByText(/maximum 0 decimal places/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("shows the error even for a single trailing decimal digit", async () => {
      await fillAndSubmit("10.1");
      await waitFor(() => {
        expect(screen.getByText(/maximum 0 decimal places/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("shows 'Enter a valid number' for an empty string", async () => {
      await fillAndSubmit("");
      await waitFor(() => {
        expect(screen.getByText(/enter a valid number/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });
  });

  // ── decimals = 2 (edge case) ───────────────────────────────────────────

  describe("token with 2 decimals", () => {
    beforeEach(() => {
      render(<TokenPanel asset={makeAsset(2)} />);
    });

    it("shows 'Maximum 2 decimal places' when 3 fractional digits are entered", async () => {
      await fillAndSubmit("1.123");
      await waitFor(() => {
        expect(screen.getByText(/maximum 2 decimal places/i)).toBeInTheDocument();
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    it("accepts exactly 2 decimal places", async () => {
      await fillAndSubmit("1.99");
      await waitFor(() => {
        expect(mockRun).toHaveBeenCalledTimes(1);
      });
    });

    it("accepts a value with no fractional part", async () => {
      await fillAndSubmit("1000");
      await waitFor(() => {
        expect(mockRun).toHaveBeenCalledTimes(1);
      });
    });
  });
});
