"use client";

import { useEffect } from "react";
import { dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { TxProgress } from "@/components/ui/TxProgress";
import { formatTokenAmount } from "@/lib/format";

/** Stellar classic / SAC payment tokens use 7 decimals. */
export const PAYMENT_TOKEN_DECIMALS = 7;

interface ClaimButtonProps {
  distributionId: bigint;
  claimable: bigint;
  claimed: boolean;
  expired?: boolean;
  decimals: number;
  onClaimed?: () => void;
  onPendingClaim?: (amount: bigint) => void;
}

/**
 * Lets a holder claim their proportional share of a distribution. Disabled
 * (with an explanatory label) when there is nothing to claim or it's already
 * been claimed.
 */
export function ClaimButton({
  distributionId,
  claimable,
  claimed,
  expired = false,
  decimals,
  onClaimed,
  onPendingClaim,
}: ClaimButtonProps) {
  const { address } = useWallet();
  const tx = useTx();

  useEffect(() => {
    onPendingClaim?.(tx.phase === "confirming" ? claimable : 0n);
  }, [claimable, onPendingClaim, tx.phase]);

  if (!address) {
    return <p className="text-xs text-base-100/55">Connect a wallet to claim.</p>;
  }

  if (claimed) {
    return (
      <span className="chip border border-white/10 bg-white/5 text-base-100/55">
        Claimed
      </span>
    );
  }
  if (expired) {
    return (
      <span className="chip border border-red-500/25 bg-red-500/10 text-red-300">
        Claim deadline passed
      </span>
    );
  }

  const nothing = claimable <= 0n;

  async function onClaim() {
    // Guard against double-submission even if this ever renders while a
    // previous run hasn't flipped `phase` away from "idle" yet.
    if (tx.pending) return;
    const res = await tx.run((ctx) => dividend.claim(ctx, distributionId));
    // Refetching the dividends list (see AssetDetailView's onClaimed) is what
    // flips this row to "claimed" without a manual page refresh.
    if (res) onClaimed?.();
  }

  return (
    <div className="space-y-2">
      {tx.phase === "idle" ? (
        <button
          onClick={onClaim}
          disabled={nothing || tx.pending}
          className="btn-primary w-full sm:w-auto"
        >
          {nothing
            ? "Nothing to claim"
            : `Claim ${formatTokenAmount(claimable, decimals)}`}
        </button>
      ) : (
        <TxProgress
          phase={tx.phase}
          hash={tx.hash}
          error={tx.error}
          onDismiss={tx.reset}
          onRetry={tx.retry}
          retryable={tx.retryable}
          successMessage="Dividend claimed to your wallet."
        />
      )}
    </div>
  );
}
