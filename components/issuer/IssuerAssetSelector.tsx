"use client";

import { useIssuerAssets } from "@/hooks/useAssets";
import { useWallet } from "@/hooks/useWallet";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { AssetTypeBadge } from "@/components/asset/AssetTypeBadge";
import { formatUsdCents } from "@/lib/format";
import type { AssetEntry } from "@/types";
import Link from "next/link";

interface IssuerAssetSelectorProps {
  selected: AssetEntry | null;
  onSelect: (asset: AssetEntry) => void;
}

/**
 * Lists assets registered by the connected wallet and lets the issuer pick one
 * to manage. Narrow panel: shown before the tabbed action area.
 */
export function IssuerAssetSelector({ selected, onSelect }: IssuerAssetSelectorProps) {
  const { address, network } = useWallet();
  const { data, loading, error, refetch } = useIssuerAssets(address, network);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-base-100/55">
        <Spinner size={16} /> Loading your assets…
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const assets = data ?? [];

  if (assets.length === 0) {
    return (
      <EmptyState
        title="No assets registered"
        description="You haven't registered any assets from this wallet. Tokenize an asset first."
        action={
          <Link href="/asset/new" className="btn-primary">
            Tokenize an asset
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {assets.map((asset) => {
        const isSelected = selected?.id === asset.id;
        return (
          <button
            key={asset.id.toString()}
            onClick={() => onSelect(asset)}
            className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
              isSelected
                ? "border-brand-500/40 bg-brand-500/10"
                : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AssetTypeBadge type={asset.assetType} />
                  {!asset.active && (
                    <span className="chip bg-white/5 text-base-100/55 text-[10px]">Inactive</span>
                  )}
                </div>
                <p className={`mt-1 truncate text-sm font-semibold ${isSelected ? "text-brand-200" : "text-base-100"}`}>
                  {asset.name}
                </p>
                <p className="text-[11px] text-base-100/55">Asset #{asset.id.toString()}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-gold-300">
                  {formatUsdCents(asset.valuation, { compact: true })}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
