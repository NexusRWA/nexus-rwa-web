"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import type { Network } from "@/types";
import { assetToken, contractIds, dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useAsync } from "@/hooks/useAsync";
import { useWallet } from "@/hooks/useWallet";
import { getLatestLedger } from "@/lib/stellar";
import { useDividends } from "@/hooks/useDividends";
import { fetchOnChainHolders, useHolders, type Holder } from "@/hooks/useHolders";
import { parseTokenAmount, formatTokenAmount, truncateAddress } from "@/lib/format";
import { arg } from "@/lib/stellar";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { percent } from "@/lib/format";

// ---- Known-token presets (#323) ----
//
// Issuers most commonly pay dividends in the native XLM Stellar Asset Contract
// (SAC) or in a USDC-equivalent stablecoin. Hard-coding the well-known
// testnet/mainnet contract IDs here lets the form surface a one-click shortcut
// so the issuer doesn't have to find and paste the address manually.
//
// The XLM SAC is deterministic: on testnet it is the SEP-41 wrapper for the
// native XLM asset deployed by the Stellar Development Foundation.
// Sources:
//   Testnet  – https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN4
//   Mainnet  – https://stellar.expert/explorer/public/contract/CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA

interface KnownToken {
  label: string;
  symbol: string;
  contractId: string;
}

const KNOWN_TOKENS: Record<Network, KnownToken[]> = {
  testnet: [
    {
      label: "Native XLM (SAC)",
      symbol: "XLM",
      contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN4",
    },
  ],
  mainnet: [
    {
      label: "Native XLM (SAC)",
      symbol: "XLM",
      contractId: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    },
  ],
};

// Leave room for the rest of the transaction envelope and its auth data.
const MAX_SNAPSHOT_XDR_BYTES = 48 * 1024;

interface DistributionPanelProps {
  asset: AssetDetail;
  onCreated?: () => void;
  isAdmin?: boolean;
}

/** Create new dividend distributions and view existing ones for the asset. */
export function DistributionPanel({ asset, onCreated, isAdmin = true }: DistributionPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-base-100/50">
        <strong>Required role:</strong> dividend contract caller must be registered issuer for this asset
      </div>
      <CreateDistributionCard
        tokenContract={asset.tokenContract}
        complianceContract={asset.metadata.complianceContract}
        assetDecimals={asset.metadata.decimals}
        assetSymbol={asset.metadata.symbol}
        {...(onCreated !== undefined ? { onCreated } : {})}
        isAdmin={isAdmin}
      />
      <ExistingDistributionsCard tokenContract={asset.tokenContract} />
    </div>
  );
}

// ---- Create distribution ----

function sameHolderSnapshot(left: Holder[], right: Holder[]): boolean {
  if (left.length !== right.length) return false;
  const balancesByAddress = new Map(left.map(({ address, balance }) => [address, balance]));
  return right.every(
    ({ address, balance }) => balancesByAddress.get(address) === balance,
  );
}

function CreateDistributionCard({
  tokenContract,
  complianceContract,
  assetDecimals,
  assetSymbol,
  onCreated,
  isAdmin = true,
}: {
  tokenContract: string;
  complianceContract: string;
  assetDecimals: number;
  assetSymbol: string;
  onCreated?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const { address, network } = useWallet();
  const [paymentToken, setPaymentToken] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [claimDeadline, setClaimDeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [refreshedSnapshot, setRefreshedSnapshot] = useState<{
    key: string;
    holders: Holder[];
  } | null>(null);
  const holderState = useHolders(complianceContract, tokenContract);
  const snapshotKey = `${complianceContract}:${tokenContract}`;
  const holderSnapshot =
    refreshedSnapshot?.key === snapshotKey
      ? refreshedSnapshot.holders
      : holderState.data;
  const snapshotTotal = (holderSnapshot ?? []).reduce(
    (total, holder) => total + holder.balance,
    0n,
  );

  // Only fetch when the input looks like a valid contract address.
  const isValidPt =
    paymentToken.trim().length > 0 &&
    (StrKey.isValidContract(paymentToken.trim()) ||
      StrKey.isValidEd25519PublicKey(paymentToken.trim()));

  // #293: Show the issuer's balance in the payment token before they submit.
  const { data: balanceData, loading: balanceLoading } = useAsync(
    async () => ({
      token: paymentToken.trim(),
      amount: await assetToken.balance(network, paymentToken.trim(), address!),
    }),
    [network, paymentToken, address],
    isValidPt && !!address,
  );
  const balance = balanceData?.token === paymentToken.trim() ? balanceData.amount : null;

  // #293: Show how much the dividend contract is already approved to pull.
  // Issuers need to approve at least totalAmount before the distribution can be funded.
  const dividendContractId = contractIds(network).dividend;
  const { data: allowanceData, loading: allowanceLoading } = useAsync(
    async () => ({
      token: paymentToken.trim(),
      amount: await assetToken.allowance(network, paymentToken.trim(), address!, dividendContractId),
    }),
    [network, paymentToken, address, dividendContractId],
    isValidPt && !!address,
  );
  const allowance = allowanceData?.token === paymentToken.trim() ? allowanceData.amount : null;

  const { data: decimalsData, loading: decimalsLoading, error: decimalsError } = useAsync(
    async () => ({
      token: paymentToken.trim(),
      decimals: await assetToken.decimals(network, paymentToken.trim()),
    }),
    [network, paymentToken],
    isValidPt,
  );
  const paymentTokenDecimals =
    decimalsData?.token === paymentToken.trim() ? decimalsData.decimals : null;

  // Parse the requested amount for comparison (best-effort; errors handled on submit).
  let requestedRaw: bigint | null = null;
  try {
    if (totalAmount.trim() && paymentTokenDecimals !== null) {
      requestedRaw = parseTokenAmount(totalAmount, paymentTokenDecimals);
    }
  } catch {
    // handled at submit time
  }

  const insufficientBalance = balance !== null && requestedRaw !== null && requestedRaw > balance;
  const needsApproval = allowance !== null && requestedRaw !== null && requestedRaw > allowance;

  // Submit-time errors are attributed to the field they concern.
  const tokenInvalid = !!formError && /payment token/i.test(formError);
  const totalFormInvalid = !!formError && !tokenInvalid;
  const totalInvalid = insufficientBalance || totalFormInvalid;
  const totalErrorIds =
    [
      totalFormInvalid && "dist-form-error",
      (insufficientBalance || needsApproval) && "dist-total-error",
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const pt = paymentToken.trim();
    if (!StrKey.isValidContract(pt) && !StrKey.isValidEd25519PublicKey(pt)) {
      setFormError("Enter a valid payment token contract address (C…).");
      return;
    }

    let raw: bigint;
    try {
      const decimals = await assetToken.decimals(network, pt);
      raw = parseTokenAmount(totalAmount, decimals);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }
    if (raw <= 0n) {
      setFormError("Total amount must be greater than zero.");
      return;
    }
    if (balance !== null && raw > balance) {
      setFormError("Total amount exceeds your payment-token balance.");
      return;
    }
    if (allowance !== null && raw > allowance) {
      setFormError("The dividend contract allowance is insufficient. Approve it to spend at least the requested amount before creating this distribution.");
      return;
    }
    let deadline = 0;
    if (claimDeadline.trim()) {
      deadline = Number.parseInt(claimDeadline.trim(), 10);
      if (!Number.isInteger(deadline) || deadline < 0) {
        setFormError("Claim deadline must be a non-negative ledger number (0 = no deadline).");
        return;
      }
      if (deadline > 0) {
        try {
          const latestLedger = await getLatestLedger(network);
          if (deadline <= latestLedger) {
            setFormError(`Ledger ${deadline} has already passed (current ledger: ${latestLedger}).`);
            return;
          }
        } catch {
          // The contract remains the final authority if the ledger is unavailable.
        }
      }
    }

    let eligible: Holder[];
    setSnapshotRefreshing(true);
    try {
      eligible = await fetchOnChainHolders(network, complianceContract, tokenContract);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? `Unable to refresh holder snapshot: ${err.message}`
          : "Unable to refresh holder snapshot. Try again.",
      );
      return;
    } finally {
      setSnapshotRefreshing(false);
    }
    if (!holderSnapshot || !sameHolderSnapshot(holderSnapshot, eligible)) {
      setRefreshedSnapshot({ key: snapshotKey, holders: eligible });
      setFormError("Holder balances changed. Review the updated snapshot and submit again.");
      return;
    }
    if (eligible.length === 0) {
      setFormError("No eligible holders have a balance in this asset.");
      return;
    }
    const eligibleTuples = eligible.map(
      ({ address, balance }) => [address, balance] as const,
    );
    const snapshotBytes = arg.vecOfTuples(eligibleTuples).toXDR().length;
    if (snapshotBytes > MAX_SNAPSHOT_XDR_BYTES) {
      setFormError(
        `The ${eligible.length}-holder snapshot is too large for one Soroban transaction. Reduce the eligible holder count and try again.`,
      );
      return;
    }

    const res = await tx.run((ctx) =>
      dividend.createDistribution(ctx, tokenContract, pt, raw, eligibleTuples, deadline),
    );
    if (res) {
      setPaymentToken("");
      setTotalAmount("");
      setClaimDeadline("");
      onCreated?.();
    }
  }

  return (
    <ActionCard
      title="Create distribution"
      description="Fund a new dividend distribution. Eligible holders receive shares based on their balances in the confirmed snapshot."
      accent="bg-gold-500/10 text-gold-400"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
        </svg>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs">
          {holderSnapshot === null ? (
            <span className="text-base-100/55">
              {holderState.loading
                ? "Loading holder snapshot…"
                : "Holder snapshot is unavailable. Refresh the page and try again."}
            </span>
          ) : holderSnapshot.length === 0 ? (
            <span className="text-base-100/55">No eligible holders</span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="text-base-100/70">
                Snapshot: {holderSnapshot.length} eligible holders
              </span>
              <span className="text-base-100/70">
                Total balance: {formatTokenAmount(snapshotTotal, assetDecimals)} {assetSymbol}
              </span>
            </div>
          )}
        </div>
        <div>
          <label htmlFor="dist-payment-token" className="label">Payment token contract</label>
          <input
            id="dist-payment-token"
            value={paymentToken}
            onChange={(e) => setPaymentToken(e.target.value)}
            placeholder="C… (SAC or Soroban token contract)"
            disabled={tx.pending || !isAdmin}
            className="input font-mono text-xs"
            spellCheck={false}
            aria-invalid={tokenInvalid || undefined}
            aria-describedby={tokenInvalid ? "dist-form-error" : undefined}
          />
          <p className="mt-1 text-[11px] text-base-100/55">
            This is the token used to pay holders — typically a stablecoin or XLM SAC.
          </p>

          {/* #323: Known-token preset buttons so the issuer doesn't have to paste
              the XLM SAC address (or other well-known tokens) manually. */}
          {KNOWN_TOKENS[network] && KNOWN_TOKENS[network].length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-base-100/30">Presets:</span>
              {KNOWN_TOKENS[network].map((token) => (
                <button
                  key={token.contractId}
                  type="button"
                  disabled={tx.pending}
                  onClick={() => setPaymentToken(token.contractId)}
                  aria-label={`Use ${token.label} (${token.contractId})`}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    paymentToken.trim() === token.contractId
                      ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                      : "border-white/10 bg-white/[0.04] text-base-100/50 hover:border-white/20 hover:text-base-100/80",
                  ].join(" ")}
                >
                  <span>{token.symbol}</span>
                  <span className="text-base-100/30">·</span>
                  <span>{token.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="dist-deadline" className="label">Claim deadline ledger</label>
          <input
            id="dist-deadline"
            value={claimDeadline}
            onChange={(e) => setClaimDeadline(e.target.value)}
            placeholder="0 = no deadline"
            inputMode="numeric"
            disabled={tx.pending || !isAdmin}
            className="input"
          />
          <p className="mt-1 text-[11px] text-base-100/40">
            Holders can claim until this ledger. Leave at 0 for unlimited claims.
          </p>
        </div>

        {/* #293: surface balance + allowance so the issuer knows before submitting */}
        {isValidPt && address && (
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base-100/55">Your balance</span>
              {balanceLoading ? (
                <Spinner size={10} />
              ) : balance !== null && paymentTokenDecimals !== null ? (
                <span className={insufficientBalance ? "font-semibold text-red-400" : "text-base-100/80"}>
                  {formatTokenAmount(balance, paymentTokenDecimals)}
                </span>
              ) : (
                <span className="text-base-100/55">—</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base-100/55">Dividend contract allowance</span>
              {allowanceLoading ? (
                <Spinner size={10} />
              ) : allowance !== null && paymentTokenDecimals !== null ? (
                <span className={needsApproval ? "font-semibold text-amber-400" : "text-base-100/80"}>
                  {formatTokenAmount(allowance, paymentTokenDecimals)}
                </span>
              ) : (
                <span className="text-base-100/55">—</span>
              )}
            </div>
          </div>
        )}

        {insufficientBalance && (
          <p id="dist-total-error" role="alert" className="text-xs text-red-400">
            The requested pool exceeds your payment-token balance.
          </p>
        )}
        {needsApproval && !insufficientBalance && (
          <p id="dist-total-error" role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            The dividend contract is not approved to spend enough of this token on your behalf.
            Creating this distribution is blocked until you submit an{" "}
            <strong className="font-semibold">approve</strong> transaction for at least{" "}
            {formatTokenAmount(requestedRaw ?? 0n, paymentTokenDecimals ?? 0)} tokens.
          </p>
        )}

        <div>
          <label htmlFor="dist-total" className="label">Total pool amount</label>
          <div className="relative">
            <input
              id="dist-total"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="Enter amount"
              inputMode="decimal"
              disabled={tx.pending || !isAdmin}
              className="input pr-16"
              aria-invalid={totalInvalid || undefined}
              aria-describedby={totalErrorIds}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/55">
              tokens
            </span>
          </div>
          <p className="mt-1 text-[11px] text-base-100/55">
            {paymentTokenDecimals !== null
              ? `Uses ${paymentTokenDecimals} decimals for ${truncateAddress(paymentToken.trim())}.`
              : decimalsLoading
                ? "Loading payment token decimals…"
                : decimalsError
                  ? `Couldn't load payment token decimals: ${decimalsError}`
                  : "Enter a payment token contract to load its decimals."}
          </p>
        </div>

        {formError && <p id="dist-form-error" role="alert" className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button
            type="submit"
            disabled={tx.pending || snapshotRefreshing || !isAdmin || insufficientBalance || needsApproval}
            className="btn-primary"
            title={
              !isAdmin
                ? "Only the asset admin can create distributions"
                : insufficientBalance
                  ? "The requested amount exceeds your payment-token balance"
                  : needsApproval
                    ? "Approve the dividend contract before creating this distribution"
                    : ""
            }
          >
            {snapshotRefreshing ? "Refreshing holder snapshot…" : "Create distribution"}
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            errorType={tx.errorType}
            onDismiss={tx.reset}
            onRetry={tx.retry}
            retryable={tx.retryable}
            successMessage="Distribution created. Holders can now claim their share."
          />
        )}
      </form>
    </ActionCard>
  );
}

// ---- Existing distributions ----

function ExistingDistributionsCard({ tokenContract }: { tokenContract: string }) {
  const { data, loading, error, refetch } = useDividends(tokenContract);
  const distributions = data ?? [];

  return (
    <ActionCard
      title="Distribution history"
      description="All distributions created for this asset and their claim progress."
      accent="bg-brand-500/10 text-brand-400"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z" rx="2" />
          <path d="M3 9h18M9 21V9" strokeLinecap="round" />
        </svg>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-base-100/55">
          <Spinner size={14} /> Loading distributions…
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load distributions"
          message={error}
          onRetry={refetch}
          className="py-6"
        />
      ) : distributions.length === 0 ? (
        <EmptyState
          title="No distributions yet"
          description="Create your first distribution above."
          className="py-8 border-0 bg-transparent"
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {distributions.map((d) => {
            const pct = percent(d.distributed, d.totalAmount);
            return (
              <li key={d.id.toString()} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-base-100">
                        Distribution #{d.id.toString()}
                      </span>
                      {d.completed ? (
                        <span className="chip border border-brand-500/25 bg-brand-500/10 text-brand-300 text-[10px]">Complete</span>
                      ) : (
                        <span className="chip border border-gold-500/25 bg-gold-500/10 text-gold-300 text-[10px]">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-base-100/55">
                      Payment token: {truncateAddress(d.paymentToken)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold-300">
                      {formatTokenAmount(d.totalAmount, d.paymentTokenDecimals)}
                    </p>
                    <p className="text-[11px] text-base-100/55">{pct.toFixed(1)}% claimed</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ActionCard>
  );
}
