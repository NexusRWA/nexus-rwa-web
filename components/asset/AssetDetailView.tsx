"use client";

import Link from "next/link";
import { useState } from "react";
import { useAsset, useBalance } from "@/hooks/useAsset";
import { useDividends } from "@/hooks/useDividends";
import { useActivity } from "@/hooks/useActivity";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import { getLatestLedger } from "@/lib/stellar";
import { AssetHeader } from "./AssetHeader";
import { AssetStats } from "./AssetStats";
import { TransferPanel } from "./TransferPanel";
import { CompliancePanel } from "./CompliancePanel";
import { HolderList } from "./HolderList";
import { DistributionCard } from "@/components/dividend/DistributionCard";
import { ClaimAllButton } from "@/components/dividend/ClaimAllButton";
import { ActivityPanel } from "./ActivityPanel";
import { LoadingPanel } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDisplayText } from "@/lib/display";
import { DataFreshness } from "@/components/ui/DataFreshness";

export function AssetDetailView({ id }: { id: bigint }) {
  const { network } = useWallet();
  const asset = useAsset(id);
  const balance = useBalance(asset.data?.tokenContract ?? null);
  const dividends = useDividends(asset.data?.tokenContract ?? null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const activity = useActivity(
    asset.data?.tokenContract ?? null,
    activityRefreshKey,
  );
  const ledger = useAsync(() => getLatestLedger(network), [network]);
  const [holderCount, setHolderCount] = useState<number | undefined>(undefined);
  const [holdersRefreshKey, setHoldersRefreshKey] = useState(0);

  if (asset.loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <LoadingPanel label="Loading asset…" />
      </div>
    );
  }
  if (asset.notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-base-100">Asset not found</h1>
        <p className="mt-2 text-base-100/50">
          No registered asset with id {id.toString()}. The link may be wrong or the asset
          may have been removed.
        </p>
        <Link href="/explore" className="btn-secondary mt-6">← Back to Explore</Link>
      </div>
    );
  }
  if (asset.error || !asset.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <ErrorState
          headingLevel={1}
          title="Couldn't load asset"
          message={asset.error ?? "Something went wrong loading this asset."}
          onRetry={asset.refetch}
        />
        <div className="mt-6 text-center">
          <Link href="/explore" className="btn-secondary">← Back to Explore</Link>
        </div>
      </div>
    );
  }

  const detail = asset.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* #215 a11y: focus-visible ring added to back link */}
      <Link href="/explore" className="mb-5 inline-flex items-center gap-1.5 text-sm text-base-100/60 hover:text-base-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 rounded">
        ← Explore
      </Link>

      <AssetHeader asset={detail} network={network} />
      <div className="mt-2">
        <DataFreshness updatedAt={asset.updatedAt} />
      </div>

      {/* Compliance notice — always visible; these are gated assets. */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-500/15 bg-brand-500/[0.04] px-4 py-3.5 text-sm text-base-100/70">
        <svg className="mt-0.5 shrink-0 text-brand-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>
          This is a <strong className="font-semibold text-base-100">compliance-gated asset</strong>.
          Only KYC-approved addresses can hold or transfer it — every transfer is
          checked on-chain against the compliance contract.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: description, dividends, holders */}
        <div className="space-y-8 lg:col-span-2">
          <section className="card p-6">
            <h2 className="text-lg font-semibold text-base-100">About this asset</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-base-100/70">
              {getDisplayText(detail.metadata.assetDescription, "The issuer hasn't provided a description for this asset.")}
            </p>
          </section>

          <section className="card p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-base-100">Dividend history</h2>
              {dividends.data && dividends.data.length > 0 && (
                <span className="text-sm text-base-100/55">
                  {dividends.data.length} distribution{dividends.data.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {dividends.loading ? (
              <LoadingPanel label="Loading distributions…" />
            ) : dividends.error ? (
              <ErrorState message={dividends.error} onRetry={dividends.refetch} />
            ) : !dividends.data || dividends.data.length === 0 ? (
              <EmptyState
                title="No distributions yet"
                description="The asset issuer creates distributions to share yield with token holders. Completed and active distributions will appear here with your claimable share."
                className="py-10"
              />
            ) : (
              <div className="space-y-4">
                <ClaimAllButton
                  distributions={dividends.data}
                  onClaimed={() => {
                    dividends.refetch();
                    balance.refetch();
                  }}
                />
                {dividends.data.map((d) => (
                  <DistributionCard
                    key={d.id.toString()}
                    distribution={d}
                    currentLedger={ledger.data ?? null}
                    onClaimed={() => {
                      dividends.refetch();
                      balance.refetch();
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-1 text-lg font-semibold text-base-100">Holders</h2>
            <HolderList asset={detail} onCount={setHolderCount} refreshKey={holdersRefreshKey} />
          </section>

          <section className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-base-100">Transfer history</h2>
            <ActivityPanel
              events={activity.data}
              loading={activity.loading}
              error={activity.error}
              decimals={detail.metadata.decimals}
              onRetry={activity.refetch}
            />
          </section>
        </div>

        {/* Right: stats sidebar + transfer */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-100/55">
              Overview
            </h2>
            <AssetStats
              asset={detail}
              {...(holderCount !== undefined ? { holders: holderCount } : {})}
            />
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-100/55">
              Compliance
            </h2>
            <CompliancePanel asset={detail} network={network} />
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-100/55">
              Your position
            </h2>
            <TransferPanel
              asset={detail}
              balance={balance.data ?? 0n}
              // #521: while an account switch is in flight the previous
              // account's balance must not be rendered or validated against.
              balanceLoading={balance.loading}
              onTransferred={() => {
                balance.refetch();
                dividends.refetch();
                setHoldersRefreshKey((k) => k + 1);
                setActivityRefreshKey((k) => k + 1);
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
