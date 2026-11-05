"use client";

import type { AssetDetail, Network } from "@/types";
import { useComplianceOverview } from "@/hooks/useCompliance";
import { truncateAddress } from "@/lib/format";
import { explorerContractUrl } from "@/lib/stellar";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";

interface CompliancePanelProps {
  asset: AssetDetail;
  network: Network;
}

/**
 * Read-only view of the rules gating an asset: which compliance contract
 * enforces them, how many addresses are approved, and which jurisdictions are
 * blocked. Anyone can verify these against the chain via the explorer link.
 */
export function CompliancePanel({ asset, network }: CompliancePanelProps) {
  const complianceId = asset.metadata.complianceContract;
  const { data, loading, error, refetch } = useComplianceOverview(complianceId || null);

  if (!complianceId) {
    return (
      <p className="text-sm text-base-100/55">
        This asset&apos;s token contract doesn&apos;t reference a compliance contract, so
        there are no allowlist or jurisdiction rules to verify on-chain.
      </p>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load compliance data"
        message={error}
        onRetry={refetch}
        className="py-6"
      />
    );
  }

  const jurisdictions = data?.jurisdictions ?? [];
  const blockedCount = jurisdictions.filter((j) => j.blocked).length;

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-white/5">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-sm text-base-100/55">Contract</dt>
          <dd className="flex items-center gap-1.5">
            <a
              href={explorerContractUrl(network, complianceId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-base-100/70 hover:text-brand-300"
            >
              {truncateAddress(complianceId, 6, 6)}
            </a>
            <CopyButton value={complianceId} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-sm text-base-100/55">Approved addresses</dt>
          <dd className="text-sm font-semibold text-base-100">
            {loading ? (
              <Spinner size={14} label="Loading compliance data" />
            ) : !data ? (
              "—"
            ) : (
              data.allowlistSize.toLocaleString()
            )}
          </dd>
        </div>
      </dl>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm text-base-100/55">Jurisdictions</p>
          {blockedCount > 0 && (
            <span className="text-xs text-red-300">{blockedCount} blocked</span>
          )}
        </div>
        <p
          role="note"
          className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-200/80"
        >
          <strong className="text-amber-200">Important:</strong> Jurisdictions are
          read from KYC records in the allowlist. A blocked jurisdiction won&apos;t
          appear here unless an approved address has that jurisdiction.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-base-100/55">
            <Spinner size={14} /> Checking jurisdictions…
          </div>
        ) : jurisdictions.length === 0 ? (
          <p className="text-xs text-base-100/55">
            No jurisdictions are registered on this asset&apos;s allowlist yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {jurisdictions.map((j) => (
              <li key={j.code}>
                <span
                  className={`chip border ${
                    j.blocked
                      ? "border-red-500/25 bg-red-500/10 text-red-300"
                      : "border-white/10 bg-white/5 text-base-100/60"
                  }`}
                >
                  {j.code}
                  {j.blocked && " · Blocked"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-base-100/55">
        Jurisdictions are read from the allowlist&apos;s KYC records — the contract
        doesn&apos;t publish a full block list, so a blocked code with no approved
        address won&apos;t appear here.
      </p>
    </div>
  );
}
