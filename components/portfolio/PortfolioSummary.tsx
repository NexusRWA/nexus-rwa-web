import { formatUsdCents, formatTokenAmount, truncateAddress } from "@/lib/format";
import type { PortfolioData } from "@/hooks/usePortfolio";

interface PortfolioSummaryProps {
  data: PortfolioData;
}

/** Header stat cards: portfolio value, holding count, total claimable dividends. */
export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  const claimableValue =
    data.totalClaimable.length > 0 ? (
      <span className="flex flex-col items-end">
        {data.totalClaimable.map(({ paymentToken, decimals, amount }) => (
          <span key={`${paymentToken}:${decimals}`}>
            {formatTokenAmount(amount, decimals)} {truncateAddress(paymentToken)}
          </span>
        ))}
      </span>
    ) : (
      "—"
    );

  const stats = [
    {
      label: "Estimated Value",
      value: formatUsdCents(data.totalValueCents, { compact: true }),
      accent: "text-gold-300",
    },
    {
      label: "Assets Held",
      value: data.holdings.length.toLocaleString(),
      accent: "text-base-100",
    },
    {
      label: "Claimable Dividends",
      value: claimableValue,
      accent: data.totalClaimable.length > 0 ? "text-brand-300" : "text-base-100/55",
    },
  ];

  return (
    <div className="space-y-4">
      {data.isIncomplete && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-soft/20 bg-warning-soft/5 px-4 py-3 text-sm text-warning-soft">
          <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>
            <strong>Portfolio incomplete:</strong> Failed to load distributions for {data.failedAssetCount} asset{data.failedAssetCount === 1 ? "" : "s"}.
            The claimable dividend total may be understated.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-base-100/55">
              {s.label}
            </dt>
            <dd className={`mt-2 text-2xl font-bold ${s.accent}`}>{s.value}</dd>
          </div>
        ))}
      </div>
    </div>
  );
}
