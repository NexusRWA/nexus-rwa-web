"use client";

import { useState } from "react";
import Link from "next/link";
import type { Holding } from "@/hooks/usePortfolio";
import { assetHref, formatTokenAmount, formatUsdCents, percent, truncateAddress } from "@/lib/format";
import { AssetTypeBadge } from "@/components/asset/AssetTypeBadge";
import { DistributionCard } from "@/components/dividend/DistributionCard";

interface HoldingRowProps {
  holding: Holding;
  onClaimed?: () => void;
}

/**
 * Renders one held asset: balance, estimated value, and an expandable list of
 * distributions the wallet can claim from.
 */
export function HoldingRow({ holding, onClaimed }: HoldingRowProps) {
  const { asset, metadata, balance, claimableDistributions, totalClaimable } = holding;
  const [expanded, setExpanded] = useState(false);

  const sharePercent =
    metadata.totalSupply > 0n
      ? percent(balance, metadata.totalSupply)
      : 0;

  const estimatedValue =
    metadata.totalSupply > 0n
      ? (asset.valuation * balance) / metadata.totalSupply
      : 0n;

  const claimableCount = claimableDistributions.filter(
    (d) => !d.claimed && d.claimable > 0n,
  ).length;

  const hasDistributions = claimableDistributions.length > 0;

  return (
    <div className="card overflow-hidden">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-4 p-5">
        {/* Asset identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AssetTypeBadge type={asset.assetType} />
            {!asset.active && (
              <span className="chip bg-white/5 text-base-100/55">Inactive</span>
            )}
          </div>
          <Link
            href={assetHref(asset.id)}
            className="mt-1 block text-base font-semibold text-base-100 hover:text-brand-300 transition-colors"
          >
            {asset.name}
          </Link>
          <p className="text-xs text-base-100/55">
            Asset #{asset.id.toString()} ·{" "}
            <span className="font-mono">{metadata.symbol}</span>
          </p>
        </div>

        {/* Balance + value */}
        <dl className="flex flex-wrap gap-6 text-right">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-base-100/55">Balance</dt>
            <dd className="mt-0.5 text-lg font-bold text-base-100">
              {formatTokenAmount(balance, metadata.decimals)}
            </dd>
            <dd className="text-xs text-base-100/55">{sharePercent.toFixed(2)}% of supply</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-base-100/55">Est. Value</dt>
            <dd className="mt-0.5 text-lg font-bold text-gold-300">
              {formatUsdCents(estimatedValue, { compact: true })}
            </dd>
          </div>
          {totalClaimable.length > 0 && (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-base-100/55">Claimable</dt>
              {totalClaimable.map(({ paymentToken, decimals, amount }) => (
                <dd key={`${paymentToken}:${decimals}`} className="mt-0.5 text-lg font-bold text-brand-300">
                  {formatTokenAmount(amount, decimals)} {truncateAddress(paymentToken)}
                </dd>
              ))}
            </div>
          )}
        </dl>

        {/* Expand toggle */}
        {hasDistributions && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse distributions" : "Show distributions"}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            {claimableCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-300">
                {claimableCount}
              </span>
            )}
            <span className="hidden sm:inline">
              {expanded ? "Hide" : "Dividends"}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded distribution list */}
      {expanded && hasDistributions && (
        <div className="border-t border-white/5 bg-white/[0.02] px-5 py-4 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-base-100/55">
            Distributions
          </p>
          {claimableDistributions.map((d) => (
            <DistributionCard
              key={d.id.toString()}
              distribution={d}
              currentLedger={null}
              {...(onClaimed !== undefined ? { onClaimed } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}
