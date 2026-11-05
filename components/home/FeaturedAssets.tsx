"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAssets } from "@/hooks/useAssets";
import { AssetCard } from "@/components/asset/AssetCard";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

/** The highest-valued active assets, shown on the landing page. */
export function FeaturedAssets() {
  const { assets, loading, error, refetch } = useAssets();

  const featured = useMemo(
    () =>
      [...assets]
        .sort((a, b) => (a.valuation > b.valuation ? -1 : a.valuation < b.valuation ? 1 : 0))
        .slice(0, 3),
    [assets],
  );

  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-base-100">Featured assets</h2>
          <p className="mt-1 text-sm text-base-100/55">Live, on-chain, compliance-gated.</p>
        </div>
        <Link href="/explore" className="text-sm font-medium text-brand-400 hover:text-brand-300">
          View all →
        </Link>
      </div>

      {loading ? (
        <CardSkeletonGrid count={3} />
      ) : error ? (
        <ErrorState
          title="Couldn't load featured assets"
          message={error}
          onRetry={refetch}
        />
      ) : featured.length === 0 ? (
        <EmptyState
          title="No assets yet"
          description="Tokenized assets will appear here once they're registered on-chain."
          action={
            <Link href="/asset/new" className="btn-primary">
              Tokenize an asset
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((asset) => (
            <AssetCard key={asset.id.toString()} asset={asset} />
          ))}
        </div>
      )}
    </section>
  );
}
