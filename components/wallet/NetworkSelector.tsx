"use client";

import { useWallet } from "@/hooks/useWallet";
import type { Network } from "@/types";

const NETWORKS: { value: Network; label: string }[] = [
  { value: "testnet", label: "Testnet" },
  { value: "mainnet", label: "Mainnet" },
];

/**
 * Switches the active network for read-only browsing. While a wallet is
 * connected the app follows Freighter's network, so the control locks and
 * simply reflects the wallet's current network.
 */
export function NetworkSelector() {
  const { network, setNetwork, address, walletNetwork, networkUnknown } = useWallet();
  const locked = Boolean(address);
  const networkMismatch = locked && walletNetwork !== null && walletNetwork !== network;

  if (locked) {
    if (networkUnknown) {
      return (
        <span
          title="Couldn't verify your wallet's network. Reconnect before signing anything — writes are blocked until this resolves."
          className="chip border border-red-500/25 bg-red-500/10 text-red-300"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Network unknown
        </span>
      );
    }
    if (networkMismatch) {
      return (
        <span
          title="Your wallet and app are on different networks. Switch your wallet to match this network to continue."
          className="chip border border-red-500/25 bg-red-500/10 text-red-300"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Network mismatch
        </span>
      );
    }
    return (
      <span
        title="Network follows your connected wallet"
        role="status"
        aria-label={`Current network: ${label(walletNetwork ?? network)}. Follows your connected wallet.`}
        className="chip border border-white/10 bg-white/5 text-base-100/60"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
        {label(walletNetwork ?? network)}
      </span>
    );
  }

  /*
   * #219 a11y: the two network toggle buttons are a logical group — wrap them
   * in a div with role="group" and aria-label so screen readers announce the
   * purpose before reading individual button labels.
   * #215 a11y: each button now carries a focus-visible ring.
   * #218 a11y: inactive button text bumped from /50 to /65 for WCAG AA contrast.
   */
  return (
    <div
      role="group"
      aria-label="Network"
      className="inline-flex rounded-xl border border-white/10 bg-base-900/60 p-0.5"
    >
      <span role="status" className="sr-only">
        Current network: {label(network)}
      </span>
      {NETWORKS.map((n) => (
        <button
          key={n.value}
          type="button"
          onClick={() => setNetwork(n.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-base-900 ${
            network === n.value
              ? "bg-white/10 text-base-100"
              : "text-base-100/65 hover:text-base-100/80"
          }`}
          aria-pressed={network === n.value}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

function label(n: Network): string {
  return n === "mainnet" ? "Mainnet" : "Testnet";
}
