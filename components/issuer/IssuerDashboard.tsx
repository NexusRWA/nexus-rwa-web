"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useAsset } from "@/hooks/useAsset";
import { IssuerAssetSelector } from "@/components/issuer/IssuerAssetSelector";
import { TokenPanel } from "@/components/issuer/panels/TokenPanel";
import { CompliancePanel } from "@/components/issuer/panels/CompliancePanel";
import { DistributionPanel } from "@/components/issuer/panels/DistributionPanel";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { AssetTypeBadge } from "@/components/asset/AssetTypeBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatUsdCents } from "@/lib/format";
import { truncateAddress } from "@/lib/display";
import { explorerAddressUrl } from "@/lib/stellar";
import type { AssetEntry } from "@/types";
import { DataFreshness } from "@/components/ui/DataFreshness";

type Tab = "token" | "compliance" | "distributions";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "token",
    label: "Token",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "distributions",
    label: "Distributions",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function IssuerDashboard() {
  const { address, network } = useWallet();
  const [selectedAsset, setSelectedAsset] = useState<AssetEntry | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("token");

  // Reload the full asset detail (including metadata like paused status) on
  // demand after mutating actions.
  const assetDetail = useAsset(selectedAsset?.id ?? null);

  const isAdmin = assetDetail.data?.metadata.admin === address;

  const handleAssetSelect = useCallback((asset: AssetEntry) => {
    setSelectedAsset(asset);
    setActiveTab("token");
  }, []);

  const handleMutated = useCallback(() => {
    assetDetail.refetch();
  }, [assetDetail]);

  // Wallet gate
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-base-100">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-base-100/55">
            Connect the wallet used to register your assets. Only the asset admin
            can access issuer controls.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Left sidebar: asset selector */}
      <aside className="lg:col-span-1">
        <div className="card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-base-100/55">
            Your assets
          </h2>
          <IssuerAssetSelector
            selected={selectedAsset}
            onSelect={handleAssetSelect}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:col-span-3">
        {!selectedAsset ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 text-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-base-100/20"
            >
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm text-base-100/55">Select an asset to manage</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Asset context header */}
            <AssetContextBar
              asset={selectedAsset}
              loading={assetDetail.loading}
              error={assetDetail.error}
              {...(assetDetail.data
                ? {
                    paused: assetDetail.data.metadata.paused,
                    admin: assetDetail.data.metadata.admin,
                  }
                : {})}
              network={network}
              updatedAt={assetDetail.updatedAt}
            />

            {/* Tab bar */}
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-1 rounded-2xl border border-white/5 bg-white/[0.02] p-1 inline-flex min-w-full sm:w-full">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-shrink-0 items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-white/10 text-base-100"
                        : "text-base-100/55 hover:text-base-100"
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.charAt(0)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel content */}
            {assetDetail.loading ? (
              <div className="space-y-4">
                {[0, 1].map((i) => (
                  <div key={i} className="card p-5 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : assetDetail.error ? (
              <ErrorState
                message={assetDetail.error}
                onRetry={assetDetail.refetch}
              />
            ) : assetDetail.data ? (
              <>
                {!isAdmin && (
                  <p
                    role="alert"
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90"
                  >
                    The connected wallet is not the on-chain admin of this asset, so
                    issuer actions are disabled. Connect the admin wallet to mint,
                    pause, manage compliance or create distributions.
                  </p>
                )}
                {/* A disabled fieldset natively disables every control inside it. */}
                <fieldset disabled={!isAdmin} className="min-w-0 space-y-5 border-0 p-0">
                {/* Issue #367: Warn if connected wallet is not the asset admin */}
                {address && address !== assetDetail.data.metadata.admin && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200/90"
                  >
                    <p className="font-semibold">You are not the admin of this asset</p>
                    <p className="mt-1 text-xs text-red-200/70">
                      This asset is controlled by{" "}
                      <code className="font-mono">{truncateAddress(assetDetail.data.metadata.admin)}</code>. Only the admin
                      can perform these actions.
                    </p>
                  </div>
                )}

                {activeTab === "token" && (
                  <TokenPanel
                    asset={assetDetail.data}
                    onMinted={handleMutated}
                    onPauseToggled={handleMutated}
                    isAdmin={address === assetDetail.data.metadata.admin}
                  />
                )}
                {activeTab === "compliance" && (
                  <CompliancePanel
                    asset={assetDetail.data}
                    onChanged={handleMutated}
                    isAdmin={address === assetDetail.data.metadata.admin}
                  />
                )}
                {activeTab === "distributions" && (
                  <DistributionPanel
                    asset={assetDetail.data}
                    onCreated={handleMutated}
                    isAdmin={address === assetDetail.data.metadata.admin}
                  />
                )}
                </fieldset>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Compact bar showing the currently managed asset ----

function AssetContextBar({
  asset,
  loading,
  paused,
  error,
  admin,
  network,
  updatedAt,
}: {
  asset: AssetEntry;
  loading: boolean;
  paused?: boolean;
  error?: string | null;
  admin?: string;
  network: import("@/types").Network;
  updatedAt: number | null;
}) {
  return (
    <div className="space-y-2">
      <div className="card space-y-3 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <AssetTypeBadge type={asset.assetType} />
            {loading ? (
              <Skeleton className="h-4 w-16" />
            ) : paused ? (
              <span className="chip border border-amber-500/30 bg-amber-500/10 text-amber-300">
                Paused
              </span>
            ) : null}
            <span className="text-base font-semibold text-base-100">{asset.name}</span>
            <span className="text-sm text-base-100/55">#{asset.id.toString()}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gold-300">
              {formatUsdCents(asset.valuation, { compact: true })}
            </p>
            {error && <p className="text-[11px] text-red-400/80">Metadata unavailable</p>}
          </div>
        </div>
        {/* Issue #370: Show the asset's admin address */}
        {admin && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div>
              <p className="text-xs font-medium text-base-100/60">Controlled by</p>
              <a
                href={explorerAddressUrl(network ?? "testnet", admin)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-base-100/80 hover:text-brand-300"
              >
                {truncateAddress(admin)}
              </a>
            </div>
            <CopyButton value={admin} label="" className="shrink-0" />
          </div>
        )}
      </div>
      <DataFreshness updatedAt={updatedAt} />
    </div>
  );
}
