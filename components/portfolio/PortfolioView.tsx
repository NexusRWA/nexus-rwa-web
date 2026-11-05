"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolio, type Holding } from "@/hooks/usePortfolio";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { HoldingRow } from "@/components/portfolio/HoldingRow";
import { ClaimAllButton } from "@/components/dividend/ClaimAllButton";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTokenAmount, formatUsdCents, truncateAddress } from "@/lib/format";
import { DataFreshness } from "@/components/ui/DataFreshness";

function exportHoldingsCsv(holdings: Holding[]) {
  const rows = holdings.map((holding) => {
    const { asset, metadata, balance } = holding;
    const estimatedValue =
      metadata.totalSupply > 0n
        ? (asset.valuation * balance) / metadata.totalSupply
        : 0n;
    return [
      asset.name,
      asset.id.toString(),
      metadata.symbol,
      asset.tokenContract,
      formatTokenAmount(balance, metadata.decimals),
      formatUsdCents(estimatedValue),
    ];
  });
  const csv = [
    ["Asset", "Asset ID", "Symbol", "Token Contract", "Balance", "Estimated Value (USD)"],
    ...rows,
  ]
    .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `stellar-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Placeholder for the loaded portfolio: mirrors PortfolioSummary, the
 * "Your Holdings" header and `HoldingRow` so the page doesn't shift on load.
 * The wrapper is the single live region announced to screen readers.
 */
function PortfolioSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your portfolio…"
      className="space-y-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-32" />
          </div>
        ))}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="mt-1 h-6 w-48 max-w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex flex-wrap gap-6">
                  {[0, 1].map((j) => (
                    <div key={j} className="space-y-0.5">
                      <Skeleton className="h-4 w-16 ml-auto" />
                      <Skeleton className="h-7 w-24 ml-auto" />
                      {j === 0 && <Skeleton className="h-4 w-20 ml-auto" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** The full portfolio UI — requires a connected wallet. */
export function PortfolioView() {
  const { address } = useWallet();
  const { data, loading, error, refetch, updatedAt } = usePortfolio();

  // Passed to HoldingRow so a successful claim triggers a re-fetch
  const handleClaimed = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
            <path d="M6 7V5a2 2 0 0 1 4 0v2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-base-100">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-base-100/55">
            Your holdings and claimable dividends appear here once you connect a
            Freighter wallet.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  if (loading) return <PortfolioSkeleton />;

  if (error) {
    return (
      <ErrorState
        headingLevel={2}
        title="Failed to load portfolio"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!data || data.holdings.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        title="No holdings yet"
        description="You don't hold any tokenized assets on this network. Browse the explore page to discover available assets."
        icon={
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3h18v18H3z" rx="2" />
            <path d="M3 9h18M9 21V9" strokeLinecap="round" />
          </svg>
        }
        action={
          <Link href="/explore" className="btn-primary">
            Explore assets
          </Link>
        }
      />
    );
  }

  // Separate holdings with and without claimable dividends for section ordering
  const withClaimable = data.holdings.filter((h) => h.totalClaimable.length > 0);
  const withoutClaimable = data.holdings.filter((h) => h.totalClaimable.length === 0);
  const ordered = [...withClaimable, ...withoutClaimable];
  const claimableDistributions = data.holdings.flatMap((holding) =>
    holding.claimableDistributions.filter(
      (distribution) => !distribution.claimed && distribution.claimable > 0n,
    ),
  );

  return (
    <div className="space-y-8">
      <DataFreshness updatedAt={updatedAt} />
      <PortfolioSummary data={data} />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-base-100">Your Holdings</h2>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-base-100/55">
              Connected as{" "}
              <span className="font-mono text-base-100/60">{truncateAddress(address)}</span>
            </p>
            <button
              type="button"
              onClick={() => exportHoldingsCsv(data.holdings)}
              className="btn-secondary py-1.5 text-xs"
            >
              Export CSV
            </button>
          </div>
        </div>

        {withClaimable.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-300">
                {withClaimable.length}
              </span>
              <p className="text-xs text-brand-300/80 font-medium">
                {withClaimable.length === 1 ? "asset has" : "assets have"} claimable dividends
              </p>
            </div>
            <ClaimAllButton
              distributions={claimableDistributions}
              onClaimed={handleClaimed}
            />
          </div>
        )}

        <div className="space-y-4">
          {ordered.map((holding) => (
            <HoldingRow
              key={holding.asset.id.toString()}
              holding={holding}
              onClaimed={handleClaimed}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
