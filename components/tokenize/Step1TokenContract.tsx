"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { validateTokenContract, type ValidatedToken } from "@/lib/tokenizeFlow";
import { Spinner } from "@/components/ui/Spinner";
import { AssetTypeBadge } from "@/components/asset/AssetTypeBadge";
import { formatTokenAmount } from "@/lib/format";

interface Step1Props {
  onValidated: (result: ValidatedToken) => void;
}

/**
 * Step 1: the issuer enters the address of their already-deployed asset-token
 * contract. We call get_metadata to confirm the contract exists and is a valid
 * RWA asset-token before proceeding.
 */
export function Step1TokenContract({ onValidated }: Step1Props) {
  const { network } = useWallet();
  const [tokenContract, setTokenContract] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const addr = tokenContract.trim();
    if (!StrKey.isValidContract(addr)) {
      setError("Enter a valid Soroban contract address (starts with C).");
      return;
    }
    setLoading(true);
    try {
      const result = await validateTokenContract(network, addr);
      onValidated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Context banner */}
      <div className="rounded-2xl border border-brand-500/15 bg-brand-500/[0.04] px-5 py-4">
        <div className="flex gap-3">
          <svg
            className="mt-0.5 shrink-0 text-brand-400"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <div className="space-y-2 text-sm text-base-100/70">
            <p>
              <strong className="font-semibold text-base-100">Before you start:</strong> the
              asset-token and compliance contracts must already be deployed on{" "}
              <span className="font-mono text-brand-300">{network}</span>.
            </p>
            <p>
              Deploy them using the{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-base-100/80">
                stellar-rwa-contracts
              </code>{" "}
              deploy scripts, then come back here with the token contract address to
              register it on the platform.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-base-100">Token contract address</h2>
          <p className="mt-1 text-sm text-base-100/55">
            The deployed Soroban asset-token contract. We&apos;ll read its on-chain
            metadata to pre-fill the next step.
          </p>
        </div>

        <div>
          <label htmlFor="token-contract" className="label">Contract address</label>
          <input
            id="token-contract"
            value={tokenContract}
            onChange={(e) => setTokenContract(e.target.value)}
            placeholder="C…"
            disabled={loading}
            className="input font-mono text-xs"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading || !tokenContract.trim()} className="btn-primary w-full sm:w-auto">
          {loading ? (
            <>
              <Spinner size={16} className="border-base-950/30 border-t-base-950" />
              Verifying contract…
            </>
          ) : (
            "Verify & continue →"
          )}
        </button>
      </form>

      {/* How-to reference */}
      <details className="group rounded-2xl border border-white/5 bg-white/[0.02]">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-medium text-base-100/60 hover:text-base-100 list-none">
          <span>How to deploy a token contract</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="transition-transform group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" />
          </svg>
        </summary>
        <div className="border-t border-white/5 px-5 py-4 text-sm text-base-100/60 space-y-2">
          <p>
            1. Clone the{" "}
            <code className="rounded bg-white/5 px-1 font-mono text-xs">stellar-rwa-contracts</code>{" "}
            repository and install dependencies.
          </p>
          <p>
            2. Set your issuer keypair and RPC endpoint in{" "}
            <code className="rounded bg-white/5 px-1 font-mono text-xs">.env</code>.
          </p>
          <p>
            3. Run{" "}
            <code className="rounded bg-white/5 px-1 font-mono text-xs">
              stellar contract deploy --wasm target/…/asset_token.wasm
            </code>{" "}
            and note the returned contract ID.
          </p>
          <p>
            4. Call{" "}
            <code className="rounded bg-white/5 px-1 font-mono text-xs">initialize</code> on
            the deployed contract with your asset metadata and compliance contract address.
          </p>
          <p>5. Paste the contract ID above and continue.</p>
        </div>
      </details>
    </div>
  );
}

/** Preview card shown after a successful validation. */
export function TokenContractPreview({ validated }: { validated: ValidatedToken }) {
  const { metadata, tokenContract } = validated;
  return (
    <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AssetTypeBadge type={metadata.assetType} />
            <span className="chip border border-white/10 bg-white/5 font-mono text-base-100/70">
              {metadata.symbol}
            </span>
            {metadata.paused && (
              <span className="chip border border-amber-500/30 bg-amber-500/10 text-amber-300">
                Paused
              </span>
            )}
          </div>
          <p className="mt-1.5 font-semibold text-base-100">{metadata.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-base-100/55">
            {tokenContract.slice(0, 10)}…{tokenContract.slice(-6)}
          </p>
        </div>
        <dl className="space-y-1 text-right text-xs">
          <div>
            <dt className="text-base-100/55">Supply</dt>
            <dd className="font-semibold text-base-100">
              {formatTokenAmount(metadata.totalSupply, metadata.decimals)} {metadata.symbol}
            </dd>
          </div>
          <div>
            <dt className="text-base-100/55">Decimals</dt>
            <dd className="font-semibold text-base-100">{metadata.decimals}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
