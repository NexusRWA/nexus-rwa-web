"use client";

import { useRef, useState } from "react";
import type { DistributionWithClaim } from "@/hooks/useDividends";
import { useWallet } from "@/hooks/useWallet";
import { useTx } from "@/hooks/useTx";
import { dividend } from "@/lib/contracts";
import { TxProgress } from "@/components/ui/TxProgress";

interface ClaimAllButtonProps {
  distributions: DistributionWithClaim[];
  onClaimed?: () => void;
}

/** Sequentially submits claims for every currently claimable distribution. */
export function ClaimAllButton({
  distributions,
  onClaimed,
}: ClaimAllButtonProps) {
  const { address } = useWallet();
  const tx = useTx();
  const runningRef = useRef(false);
  const [progress, setProgress] = useState<{ claimed: number; total: number } | null>(
    null,
  );
  const [result, setResult] = useState<{ claimed: number; total: number } | null>(
    null,
  );
  const claimable = distributions.filter((d) => !d.claimed && d.claimable > 0n);

  if (claimable.length < 2) return null;
  if (!address) {
    return <p className="text-xs text-base-100/40">Connect a wallet to claim.</p>;
  }

  async function claimAll() {
    if (runningRef.current || tx.pending) return;
    runningRef.current = true;
    setResult(null);
    setProgress({ claimed: 0, total: claimable.length });

    let claimed = 0;
    try {
      for (const distribution of claimable) {
        setProgress({ claimed, total: claimable.length });
        const res = await tx.run((ctx) => dividend.claim(ctx, distribution.id));
        if (!res) break;
        claimed += 1;
      }
      setResult({ claimed, total: claimable.length });
    } finally {
      runningRef.current = false;
      setProgress(null);
      if (claimed > 0) onClaimed?.();
    }
  }

  if (progress || tx.phase !== "idle") {
    const partialResult =
      result && result.claimed < result.total
        ? `Claimed ${result.claimed} of ${result.total}; remaining claims were not submitted.`
        : null;

    return (
      <div className="space-y-2">
        {progress && (
          <p role="status" className="text-sm text-base-100/60">
            Claiming distribution {Math.min(progress.claimed + 1, progress.total)} of{" "}
            {progress.total}. Each claim needs its own transaction confirmation.
          </p>
        )}
        {partialResult && (
          <p role="status" className="text-sm text-amber-300">
            {partialResult}
          </p>
        )}
        <TxProgress
          phase={tx.phase}
          hash={tx.hash}
          error={tx.error}
          errorType={tx.errorType}
          onDismiss={tx.reset}
          successMessage={
            result !== null && result.claimed === result.total
              ? `Claimed all ${result.total} distributions.`
              : "Dividend claimed to your wallet."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {result && result.claimed < result.total && (
        <p role="status" className="text-sm text-amber-300">
          Claimed {result.claimed} of {result.total}; remaining claims were not submitted.
        </p>
      )}
      <button
        onClick={claimAll}
        disabled={tx.pending}
        className="btn-primary"
      >
        Claim all {claimable.length} distributions
      </button>
      <p className="text-xs text-base-100/40">
        Each distribution is submitted as a separate transaction.
      </p>
    </div>
  );
}
