"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { DistributionWithClaim } from "@/hooks/useDividends";
import {
  formatTokenAmount,
  percent,
  truncateAddress,
  ledgerToApproxDate as approxDate,
} from "@/lib/format";
import { ClaimButton } from "./ClaimButton";

interface DistributionCardProps {
  distribution: DistributionWithClaim;
  currentLedger: number | null;
  onClaimed?: () => void;
}

/** A single dividend distribution with progress and a claim action. */
export function DistributionCard({ distribution, currentLedger, onClaimed }: DistributionCardProps) {
  const d = distribution;
  const [pendingClaim, setPendingClaim] = useState(0n);
  const displayedDistributed = d.distributed + pendingClaim;
  const pct = percent(displayedDistributed, d.totalAmount);
  const deadline = d.claimDeadline ?? 0;
  const expired = deadline > 0 && currentLedger !== null && currentLedger >= deadline;
  const when =
    currentLedger !== null ? approxDate(d.createdAt, currentLedger) : null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base-100">Distribution #{d.id.toString()}</h3>
            {d.completed ? (
              <span className="chip border border-brand-500/25 bg-brand-500/10 text-brand-300">
                Complete
              </span>
            ) : (
              <span className="chip border border-gold-500/25 bg-gold-500/10 text-gold-300">
                Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-base-100/55">
            {when
              ? `Created ~${formatDistanceToNow(when, { addSuffix: true })}`
              : `Ledger ${d.createdAt}`}
            {" · "}
            Payment token {truncateAddress(d.paymentToken)}
          </p>
          {deadline > 0 && (
            <p className={`mt-1 text-xs ${expired ? "text-red-300" : "text-gold-300"}`}>
              {expired ? "Claim deadline passed" : `Claim by ledger ${deadline}`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-base-100/55">Total pool</p>
          <p className="text-lg font-bold text-gold-300">
            {formatTokenAmount(d.totalAmount, d.paymentTokenDecimals)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-base-100/55">
          <span>{pendingClaim > 0n ? "Claimed (including pending)" : "Claimed"}</span>
          <span>
            {formatTokenAmount(displayedDistributed, d.paymentTokenDecimals)} / {formatTokenAmount(d.totalAmount, d.paymentTokenDecimals)}
            {" "}({pct.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pendingClaim > 0n && (
          <p role="status" className="mt-1.5 text-xs text-amber-300">
            Claim submitted — awaiting on-chain confirmation.
          </p>
        )}
      </div>

      {(d.claimable > 0n || d.claimed) && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <ClaimButton
            distributionId={d.id}
            claimable={d.claimable}
            claimed={d.claimed}
            expired={expired}
            decimals={d.paymentTokenDecimals}
            {...(onClaimed !== undefined ? { onClaimed } : {})}
            onPendingClaim={setPendingClaim}
          />
        </div>
      )}
    </div>
  );
}
