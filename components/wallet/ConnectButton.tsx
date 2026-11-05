"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/format";
import { explorerAccountUrl } from "@/lib/stellar";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Connect / connected-account control. When disconnected it prompts Freighter;
 * when connected it shows the truncated address with a dropdown to copy,
 * inspect on the explorer, or disconnect.
 */
export function ConnectButton() {
  const { address, connect, disconnect, connecting, installed, network, error } = useWallet();
  const [open, setOpen] = useState(false);

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-2">
        {/* #215 a11y: btn-primary already has focus-visible ring from globals.css */}
        <button
          onClick={() => connect().catch(() => {})}
          disabled={connecting}
          className="btn-primary"
        >
          {connecting ? <Spinner size={16} className="border-base-950/30 border-t-base-950" /> : <WalletIcon />}
          {connecting ? "Connecting…" : installed ? "Connect Wallet" : "Get Freighter"}
        </button>
        {error && !connecting && (
          <div
            role="alert"
            className="max-w-xs rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-right text-xs text-red-300"
          >
            <p>{error}</p>
            {installed ? (
              <button
                onClick={() => connect().catch(() => {})}
                className="mt-1 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-base-900 rounded"
              >
                Try again
              </button>
            ) : (
              <a
                href="https://www.freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-base-900 rounded"
              >
                Install Freighter ↗
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="h-2 w-2 rounded-full bg-brand-400" />
        <span className="font-mono text-xs">{truncateAddress(address)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={open ? "rotate-180 transition" : "transition"}>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default border-0 bg-transparent p-0"
            aria-label="Close wallet menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-64 animate-fade-in rounded-2xl border border-white/10 bg-base-850 p-3 shadow-2xl shadow-black/40"
          >
            <div className="mb-2 rounded-xl bg-base-950/60 p-3">
              <div className="mb-1 flex items-center justify-between">
                {/* #218 a11y: bumped from /40 to /55 for WCAG AA contrast */}
                <span className="text-[10px] font-medium uppercase tracking-wide text-base-100/55">
                  Connected · {network}
                </span>
                <CopyButton value={address} />
              </div>
              <p className="break-all font-mono text-xs text-base-100/80">{address}</p>
            </div>
            {/* #215 a11y: btn-secondary carries focus-visible ring; inline links get explicit ring */}
            <a
              href={explorerAccountUrl(network, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg px-3 py-2 text-sm text-base-100/70 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-inset"
            >
              View on Stellar Expert ↗
            </a>
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5" />
      <circle cx="16" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
