/** Shimmering placeholder block used while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white/5 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

/**
 * A grid of card-shaped skeletons for asset listings. Each card mirrors the
 * structure and line heights of `AssetCard` so nothing shifts when data
 * arrives. The grid itself is the (single) live region announced to screen
 * readers; the individual blocks stay decorative.
 */
export function CardSkeletonGrid({
  count = 6,
  label = "Loading assets…",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-4 p-5">
          {/* badge row: chip is text-xs + py-1 = 28px */}
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          {/* name (text-lg leading-tight) + "Asset #id" (text-xs) */}
          <div>
            <Skeleton className="h-[22.5px] w-3/4" />
            <Skeleton className="mt-0.5 h-4 w-1/4" />
          </div>
          {/* valuation / holders */}
          <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
            {[0, 1].map((j) => (
              <div key={j}>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-0.5 h-6 w-20" />
              </div>
            ))}
          </div>
          {/* issuer footer */}
          <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
