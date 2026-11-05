"use client";

import { usePlatformStats } from "@/hooks/useAssets";
import { useHolderTotals } from "@/hooks/useHolderTotals";
import { formatUsdCents, compactNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { DataFreshness } from "@/components/ui/DataFreshness";

/** Headline platform metrics sourced live from the registry contract. */
export function PlatformStats() {
  const stats = usePlatformStats();
  const holders = useHolderTotals(
    stats.data?.totalHolders !== null ? null : (stats.data?.assets ?? null),
  );

  const holderCount = stats.data?.totalHolders ?? holders.data ?? null;

  const failure = stats.error ?? holders.error;
  if (failure) {
    return (
      <ErrorState
        headingLevel={2}
        title="Couldn't load platform stats"
        message={failure}
        // Retry only the load that failed.
        onRetry={stats.error ? stats.refetch : holders.refetch}
      />
    );
  }

  const items = [
    {
      label: "Assets tokenized",
      value: stats.data ? stats.data.totalAssets.toLocaleString() : null,
    },
    {
      label: "Total value locked (self-reported)",
      value: stats.data ? formatUsdCents(stats.data.tvl, { compact: true }) : null,
    },
    {
      label: "Approved holders",
      value: holderCount !== null ? compactNumber(holderCount) : null,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="card p-6 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-base-100/55">
              {item.label}
            </p>
            {item.value === null ? (
              <Skeleton className="mt-2 h-9 w-40" />
            ) : (
              <p className="mt-2 text-3xl font-bold text-base-100">{item.value}</p>
            )}
          </div>
        ))}
      </div>
      <DataFreshness updatedAt={stats.updatedAt} />
    </div>
  );
}
