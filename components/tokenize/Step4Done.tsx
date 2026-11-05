import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { explorerTxUrl } from "@/lib/stellar";
import type { ValidatedToken } from "@/lib/tokenizeFlow";
import { formatUsdCents } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/types";

interface Step4Props {
  validated: ValidatedToken;
  name: string;
  assetType: string;
  valuation: bigint;
  assetId: bigint | null;
  txHash: string;
}

/** Success screen shown after registration. */
export function Step4Done({ validated, name, assetType, valuation, assetId, txHash }: Step4Props) {
  const { network } = useWallet();
  const { metadata } = validated;

  return (
    <div className="card overflow-hidden">
      {/* Hero gradient band */}
      <div className="relative border-b border-white/5 bg-gradient-to-br from-brand-500/[0.12] via-transparent to-gold-500/[0.06] px-6 py-10 text-center sm:px-10 sm:py-14">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-bold text-base-100 sm:text-3xl">
          Asset registered
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-base-100/60">
          <strong className="text-base-100">{name}</strong> is now live on the
          Nexus RWA platform.
        </p>
      </div>

      {/* Details */}
      <div className="px-6 py-6 sm:px-10">
        <dl className="divide-y divide-white/5">
          {assetId !== null && (
            <Row label="Asset ID" value={`#${assetId.toString()}`} />
          )}
          <Row label="Asset class" value={ASSET_TYPE_LABELS[assetType as keyof typeof ASSET_TYPE_LABELS] ?? assetType} />
          <Row label="Valuation" value={formatUsdCents(valuation)} accent="text-gold-300" />
          <Row label="Symbol" value={metadata.symbol} mono />
        </dl>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-white/5 px-6 py-5 sm:px-10">
        {assetId !== null && (
          <Link href={`/asset/${assetId}`} className="btn-primary">
            View asset page →
          </Link>
        )}
        <Link href="/issuer" className="btn-secondary">
          Go to issuer dashboard
        </Link>
        <a
          href={explorerTxUrl(network, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-sm"
        >
          View transaction ↗
        </a>
      </div>

      {/* Next steps */}
      <div className="border-t border-white/5 bg-white/[0.015] px-6 py-5 sm:px-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-base-100/55">
          Recommended next steps
        </p>
        <ol className="space-y-2 text-sm text-base-100/60">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-base-100/55">1</span>
            <span>
              Go to the{" "}
              <Link href="/issuer" className="text-brand-400 hover:underline">
                Issuer Dashboard
              </Link>{" "}
              and add approved addresses to the compliance allowlist.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-base-100/55">2</span>
            <span>Mint tokens to KYC-approved holders from the Token tab.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-base-100/55">3</span>
            <span>Create a dividend distribution when yield is ready to distribute.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-base-100/55">{label}</dt>
      <dd className={`text-sm font-semibold ${accent ?? "text-base-100"} ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
