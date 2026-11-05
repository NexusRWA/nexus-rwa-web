/**
 * Tests for components/wallet/NetworkSelector.tsx
 *
 * Strategy: mock useWallet so the component renders without any Freighter or
 * Soroban calls. All meaningful render states and user interactions are covered.
 *
 * States:
 *   1. Disconnected (locked=false)   → interactive toggle showing Testnet / Mainnet buttons
 *   2. Connected, network known      → locked chip displaying the wallet's network
 *   3. Connected, network unknown    → "Network unknown" error chip
 *
 * Interactions (disconnected only):
 *   4. Click Testnet button          → setNetwork("testnet") called
 *   5. Click Mainnet button          → setNetwork("mainnet") called
 *   6. Active button has aria-pressed=true; inactive has aria-pressed=false
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkSelector } from "./NetworkSelector";

// ── mock useWallet ────────────────────────────────────────────────────────

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

import { useWallet } from "@/hooks/useWallet";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// ── helpers ───────────────────────────────────────────────────────────────

const BASE_WALLET: ReturnType<typeof useWallet> = {
  address: null,
  network: "testnet" as const,
  setNetwork: jest.fn(),
  walletNetwork: null,
  networkUnknown: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  connecting: false,
  installed: true,
  error: null,
  sign: jest.fn(),
  writeCtx: jest.fn(),
};

function setup(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  mockUseWallet.mockReturnValue({ ...BASE_WALLET, ...overrides });
  return render(<NetworkSelector />);
}

// ── tests ─────────────────────────────────────────────────────────────────

describe("NetworkSelector", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── state 1: disconnected — interactive toggle ────────────────────────
  describe("when disconnected (no address)", () => {
    it("renders both network buttons", () => {
      setup({ address: null, network: "testnet" });
      expect(screen.getByRole("button", { name: /testnet/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /mainnet/i })).toBeInTheDocument();
    });

    it("exposes a named group and announces the current network", () => {
      setup({ address: null, network: "mainnet" });
      expect(screen.getByRole("group", { name: "Network" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Current network: Mainnet");
    });

    it("does not render a locked chip", () => {
      setup({ address: null });
      // A locked chip renders as a <span> with no role button
      expect(screen.queryByText(/network unknown/i)).not.toBeInTheDocument();
    });

    it("marks the active network button with aria-pressed=true", () => {
      setup({ address: null, network: "testnet" });
      expect(screen.getByRole("button", { name: /testnet/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: /mainnet/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("marks mainnet active when network is mainnet", () => {
      setup({ address: null, network: "mainnet" });
      expect(screen.getByRole("button", { name: /mainnet/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: /testnet/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("calls setNetwork('mainnet') when Mainnet button is clicked", () => {
      const setNetwork = jest.fn();
      setup({ address: null, network: "testnet", setNetwork });
      fireEvent.click(screen.getByRole("button", { name: /mainnet/i }));
      expect(setNetwork).toHaveBeenCalledTimes(1);
      expect(setNetwork).toHaveBeenCalledWith("mainnet");
    });

    it("calls setNetwork('testnet') when Testnet button is clicked", () => {
      const setNetwork = jest.fn();
      setup({ address: null, network: "mainnet", setNetwork });
      fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
      expect(setNetwork).toHaveBeenCalledTimes(1);
      expect(setNetwork).toHaveBeenCalledWith("testnet");
    });

    it("renders exactly 2 buttons", () => {
      setup({ address: null });
      expect(screen.getAllByRole("button")).toHaveLength(2);
    });
  });

  // ── state 2: connected, network known ────────────────────────────────
  describe("when connected with a known network", () => {
    it("renders a locked chip (no interactive buttons)", () => {
      setup({
        address: "GABCDEF1234",
        network: "testnet",
        walletNetwork: "testnet",
        networkUnknown: false,
      });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it('shows "Testnet" label when on testnet', () => {
      setup({
        address: "GABCDEF1234",
        network: "testnet",
        walletNetwork: "testnet",
        networkUnknown: false,
      });
      expect(screen.getByText("Testnet")).toBeInTheDocument();
    });

    it('shows "Mainnet" label when on mainnet', () => {
      setup({
        address: "GABCDEF1234",
        network: "mainnet",
        walletNetwork: "mainnet",
        networkUnknown: false,
      });
      expect(screen.getByText("Mainnet")).toBeInTheDocument();
    });

    it("uses walletNetwork when available and matches network", () => {
      // walletNetwork takes priority for the label when they match
      setup({
        address: "GABCDEF1234",
        network: "mainnet",
        walletNetwork: "mainnet",
        networkUnknown: false,
      });
      expect(screen.getByText("Mainnet")).toBeInTheDocument();
    });

    it("shows network mismatch warning when wallet and app networks differ", () => {
      // When walletNetwork differs from network, show the mismatch warning
      setup({
        address: "GABCDEF1234",
        network: "testnet",
        walletNetwork: "mainnet",
        networkUnknown: false,
      });
      expect(screen.getByText(/network mismatch/i)).toBeInTheDocument();
    });

    it("falls back to network label when walletNetwork is null but connected", () => {
      // walletNetwork null AND networkUnknown false is an edge case;
      // the component renders the label() of (walletNetwork ?? network)
      setup({
        address: "GABCDEF1234",
        network: "testnet",
        walletNetwork: null,
        networkUnknown: false,
      });
      expect(screen.getByText("Testnet")).toBeInTheDocument();
    });

    it("chip has a tooltip indicating the network follows the wallet", () => {
      setup({
        address: "GABCDEF1234",
        network: "testnet",
        walletNetwork: "testnet",
        networkUnknown: false,
      });
      const chip = screen.getByText("Testnet").closest("span");
      expect(chip).toHaveAttribute("title", expect.stringMatching(/wallet/i));
    });
  });

  // ── state 3: connected, network unknown ──────────────────────────────
  describe("when connected but network is unknown", () => {
    it('renders "Network unknown" chip', () => {
      setup({
        address: "GABCDEF1234",
        networkUnknown: true,
        walletNetwork: null,
      });
      expect(screen.getByText(/network unknown/i)).toBeInTheDocument();
    });

    it("does not render interactive buttons", () => {
      setup({
        address: "GABCDEF1234",
        networkUnknown: true,
        walletNetwork: null,
      });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("chip has a warning tooltip about reconnecting", () => {
      setup({
        address: "GABCDEF1234",
        networkUnknown: true,
        walletNetwork: null,
      });
      const chip = screen.getByText(/network unknown/i).closest("span");
      expect(chip).toHaveAttribute("title", expect.stringMatching(/reconnect/i));
    });
  });
});
