/**
 * Tests for components/wallet/ConnectButton.tsx
 *
 * Strategy: mock useWallet, truncateAddress, explorerAccountUrl, CopyButton, and
 * Spinner so the component renders without any network or clipboard calls. All
 * meaningful render states and user interactions are covered.
 *
 * States:
 *   1. Disconnected + Freighter not installed  → "Get Freighter" button
 *   2. Disconnected + Freighter installed      → "Connect Wallet" button
 *   3. Connecting (in-flight)                  → spinner + "Connecting…" text + disabled
 *   4. Connected                               → truncated address button, dropdown toggling
 *   5. Connected dropdown open                 → menu items (copy, explorer link, disconnect)
 *   6. Disconnect interaction                  → calls disconnect(), closes dropdown
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectButton } from "./ConnectButton";

// ── mock useWallet ────────────────────────────────────────────────────────

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/lib/format", () => ({
  truncateAddress: (addr: string) => `${addr.slice(0, 4)}…${addr.slice(-4)}`,
}));

jest.mock("@/lib/stellar", () => ({
  explorerAccountUrl: (_network: string, addr: string) =>
    `https://stellar.expert/account/${addr}`,
}));

// Render CopyButton as a simple labelled button so aria queries work
jest.mock("@/components/ui/CopyButton", () => ({
  CopyButton: ({ value }: { value: string }) => (
    <button aria-label={`Copy ${value}`}>Copy</button>
  ),
}));

// Render Spinner as a simple element so we can assert its presence
jest.mock("@/components/ui/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

import { useWallet } from "@/hooks/useWallet";

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// ── helpers ───────────────────────────────────────────────────────────────

const BASE_WALLET: ReturnType<typeof useWallet> = {
  address: null,
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  connecting: false,
  installed: true,
  network: "testnet" as const,
  walletNetwork: null,
  networkUnknown: false,
  error: null,
  setNetwork: jest.fn(),
  sign: jest.fn(),
  writeCtx: jest.fn(),
};

function setup(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  mockUseWallet.mockReturnValue({ ...BASE_WALLET, ...overrides });
  return render(<ConnectButton />);
}

// ── tests ─────────────────────────────────────────────────────────────────

describe("ConnectButton", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── state 1: Freighter not installed ─────────────────────────────────
  describe("when Freighter is not installed", () => {
    it('renders "Get Freighter" button', () => {
      setup({ installed: false });
      expect(
        screen.getByRole("button", { name: /get freighter/i }),
      ).toBeInTheDocument();
    });

    it("is not disabled when not connecting", () => {
      setup({ installed: false, connecting: false });
      expect(screen.getByRole("button", { name: /get freighter/i })).not.toBeDisabled();
    });

    it("calls connect() when clicked", () => {
      const connect = jest.fn().mockResolvedValue(undefined);
      setup({ installed: false, connect });
      fireEvent.click(screen.getByRole("button", { name: /get freighter/i }));
      expect(connect).toHaveBeenCalledTimes(1);
    });
  });

  // ── state 2: Freighter installed, disconnected ────────────────────────
  describe("when Freighter is installed and wallet is disconnected", () => {
    it('renders "Connect Wallet" button', () => {
      setup({ installed: true });
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument();
    });

    it("calls connect() when clicked", () => {
      const connect = jest.fn().mockResolvedValue(undefined);
      setup({ installed: true, connect });
      fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
      expect(connect).toHaveBeenCalledTimes(1);
    });

    it("does not show a dropdown menu", () => {
      setup({ installed: true });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  // ── state 3: connecting in-flight ─────────────────────────────────────
  describe("when connecting is in progress", () => {
    it('shows spinner and "Connecting…" text', () => {
      setup({ connecting: true, installed: true });
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.getByText(/connecting…/i)).toBeInTheDocument();
    });

    it("disables the button while connecting", () => {
      setup({ connecting: true, installed: true });
      // The button text includes "Connecting…"; find by role
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
    });
  });

  // ── state 4: connected, dropdown closed ───────────────────────────────
  describe("when connected", () => {
    const ADDRESS = "GABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF";

    it("shows truncated address in the button", () => {
      setup({ address: ADDRESS });
      // truncateAddress mock: first 4 + … + last 4
      expect(screen.getByText(`GABC…CDEF`)).toBeInTheDocument();
    });

    it("dropdown is closed by default", () => {
      setup({ address: ADDRESS });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("button has aria-expanded=false when closed", () => {
      setup({ address: ADDRESS });
      const btn = screen.getByRole("button", { name: /GABC…CDEF/i });
      expect(btn).toHaveAttribute("aria-expanded", "false");
    });
  });

  // ── state 5: connected, dropdown open ─────────────────────────────────
  describe("dropdown menu when connected", () => {
    const ADDRESS = "GABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF";

    function openDropdown() {
      setup({ address: ADDRESS, network: "testnet" });
      fireEvent.click(screen.getByRole("button", { name: /GABC…CDEF/i }));
    }

    it("opens the dropdown on button click", () => {
      openDropdown();
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("button has aria-expanded=true when open", () => {
      openDropdown();
      const btn = screen.getByRole("button", { name: /GABC…CDEF/i });
      expect(btn).toHaveAttribute("aria-expanded", "true");
    });

    it("shows full address inside the menu", () => {
      openDropdown();
      expect(screen.getByRole("menu")).toHaveTextContent(ADDRESS);
    });

    it('shows "Connected · testnet" label', () => {
      openDropdown();
      expect(screen.getByText(/connected · testnet/i)).toBeInTheDocument();
    });

    it("renders the explorer link pointing to the correct URL", () => {
      openDropdown();
      const link = screen.getByRole("link", { name: /view on stellar expert/i });
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/account/${ADDRESS}`,
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders a CopyButton for the address", () => {
      openDropdown();
      expect(
        screen.getByRole("button", { name: new RegExp(`Copy ${ADDRESS}`, "i") }),
      ).toBeInTheDocument();
    });

    it("closes the dropdown when the backdrop overlay is clicked", () => {
      openDropdown();
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close wallet menu" }));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("toggles dropdown closed when address button is clicked again", () => {
      openDropdown();
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /GABC…CDEF/i }));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  // ── state 6: disconnect interaction ──────────────────────────────────
  describe("disconnect", () => {
    const ADDRESS = "GABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF1234ABCDEF";

    it("calls disconnect() and closes the dropdown when Disconnect is clicked", () => {
      const disconnect = jest.fn();
      mockUseWallet.mockReturnValue({
        ...BASE_WALLET,
        address: ADDRESS,
        disconnect,
      } as ReturnType<typeof useWallet>);
      render(<ConnectButton />);

      // Open the dropdown
      fireEvent.click(screen.getByRole("button", { name: /GABC…CDEF/i }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Click Disconnect
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
