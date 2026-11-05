"use client";

import { memo } from "react";
import Link from "next/link";
import type { AssetEntry } from "@/types";
import { assetHref, formatUsdCents, truncateAddress } from "@/lib/format";
import { getDisplayText } from "@/lib/display";
import { AssetTypeBadge } from "./AssetTypeBadge";
import { useWallet } from "@/hooks/useWallet";
import { prefetchAssetMetadata } from "@/lib/assetCache";

interface AssetCardProps {
  asset: AssetEntry;
  /** Optional holder count when known (registry doesn't track it directly). */
  holders?: number;
  /** Optional total supply string when metadata has been loaded. */
  supply?: string;
  /** Heading level for the asset name; 2 when the card sits directly under an h1. */
  headingLevel?: 2 | 3;
}

/** Summary card linking to an asset's detail page. */
function AssetCardComponent({ asset, holders, supply, headingLevel = 3 }: AssetCardProps) {
  const Heading = `h${headingLevel}` as const;
  const { network } = useWallet();

  const prefetchMetadata = () => {
    void prefetchAssetMetadata(network, asset.tokenContract).catch(
      (error: unknown) => {
        console.warn(
          "Could not prefetch asset metadata; it will be retried on open.",
          error,
        );
      },
    );
  };

  return (
    <Link
      href={assetHref(asset.id)}
      onMouseEnter={prefetchMetadata}
      onFocus={prefetchMetadata}
      className="card card-hover group flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <AssetTypeBadge type={asset.assetType} />
        {!asset.active && (
          <span className="chip bg-white/5 text-base-100/55">Inactive</span>
        )}
      </div>

      <div>
        <Heading className="text-lg font-semibold leading-tight text-base-100 transition-colors group-hover:text-brand-300">
          {getDisplayText(asset.name, "Unnamed asset")}
        </Heading>
        <p className="mt-0.5 text-xs text-base-100/55">Asset #{asset.id.toString()}</p>
      </div>

      <dl className="space-y-3 border-t border-white/5 pt-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-base-100/55">Valuation</dt>
          <dd className="mt-0.5 text-base font-semibold text-gold-300">
            {formatUsdCents(asset.valuation, { compact: true })}
          </dd>
        </div>
        {supply && (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-base-100/40">Supply</dt>
            <dd className="mt-0.5 text-base font-semibold text-base-100">{supply}</dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-base-100/55">
            {supply ? "Supply" : "Holders"}
          </dt>
          <dt className="text-[11px] uppercase tracking-wide text-base-100/40">Holders</dt>
          {/* The count needs a per-asset read, so list views may not have it. */}
          <dd className="mt-0.5 text-base font-semibold text-base-100">
            {holders === undefined ? "—" : holders.toLocaleString()}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3 text-xs text-base-100/55">
        <span>Issuer</span>
        <span className="font-mono text-base-100/60">{truncateAddress(asset.issuer)}</span>
      </div>
    </Link>
  );
}

export const AssetCard = memo(AssetCardComponent);
