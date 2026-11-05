"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { assetToken } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useTx } from "@/hooks/useTx";
import { useCompliance } from "@/hooks/useCompliance";
import { formatTokenAmount, formatRawPlain, parseTokenAmount } from "@/lib/format";
import { TxProgress } from "@/components/ui/TxProgress";
import { ErrorState } from "@/components/ui/ErrorState";
import { ComplianceBadge } from "@/components/compliance/ComplianceBadge";

interface TransferPanelProps {
  asset: AssetDetail;
  balance: bigint;
  /**
   * True while the balance for the *current* account is still in flight.
   * `balance` must not be read as authoritative while this is set — during an
   * account switch the value belongs to the previous address (#521).
   */
  balanceLoading?: boolean;
  onTransferred?: () => void;
}

/**
 * Transfer form for an asset token. The action is gated on the connected
 * wallet's compliance status: transfers are only enabled for KYC-approved
 * holders, and the recipient is validated up front. Every gating condition is
 * surfaced with an explicit message rather than a silently disabled button.
 */
export function TransferPanel({
  asset,
  balance,
  balanceLoading = false,
  onTransferred,
}: TransferPanelProps) {
  const { address } = useWallet();
  const { metadata } = asset;
  const compliance = useCompliance(metadata.complianceContract, address);
  const tx = useTx();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const trimmedTo = to.trim();
  const recipientFormatValid =
    StrKey.isValidEd25519PublicKey(trimmedTo) || StrKey.isValidContract(trimmedTo);
  const isOwnAddress = recipientFormatValid && trimmedTo === address;
  const recipientCompliance = useCompliance(
    metadata.complianceContract,
    recipientFormatValid ? trimmedTo : null,
  );

  if (!address) {
    return (
      <p className="text-sm text-base-100/55">
        Connect your wallet to view your balance and transfer this asset.
      </p>
    );
  }

  const complianceLoading = compliance.loading;
  const approved = compliance.data?.allowed ?? false;
  const status = compliance.data?.status ?? "None";
  const paused = metadata.paused;
  // Do not evaluate transfer eligibility while compliance or the balance is
  // still loading — treating an unresolved status as "not allowed" would flash
  // "Transfer unavailable" copy before the check completes (issues #33 / #34),
  // and an unresolved balance must not be read as zero (#521).
  const canTransfer =
    !complianceLoading && !balanceLoading && approved && !paused && balance > 0n;
  let amountValid = false;
  if (!balanceLoading) {
    try {
      const rawAmount = parseTokenAmount(amount, metadata.decimals);
      amountValid = rawAmount > 0n && rawAmount <= balance;
    } catch {
      amountValid = false;
    }
  }
  const recipientInvalid =
    recipientFormatValid && !recipientCompliance.loading && !recipientCompliance.data?.allowed;
  const amountInvalid = !!amountError;
  const formValid = recipientFormatValid && !isOwnAddress && amountValid && !amountError;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (paused) {
      setFormError("Transfers are paused by the issuer for this asset.");
      return;
    }

    const recipient = to.trim();
    if (!StrKey.isValidEd25519PublicKey(recipient) && !StrKey.isValidContract(recipient)) {
      setFormError("Enter a valid Stellar address (starts with G or C).");
      return;
    }
    if (recipient === address) {
      setFormError("You can't transfer to your own address.");
      return;
    }
    if (recipientCompliance.loading || !recipientCompliance.data) {
      setFormError("Still checking recipient compliance — try again in a moment.");
      return;
    }
    if (!recipientCompliance.data.allowed) {
      setFormError("Recipient isn't KYC-approved for this asset and can't receive a transfer.");
      return;
    }
    let raw: bigint;
    try {
      raw = parseTokenAmount(amount, metadata.decimals);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }
    if (raw <= 0n) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    // Never submit against an unresolved balance — it belongs to the previous
    // account while a switch is in flight (#521).
    if (balanceLoading) {
      setFormError("Still loading your balance — try again in a moment.");
      return;
    }
    if (raw > balance) {
      setFormError("Amount exceeds your balance.");
      return;
    }

    const res = await tx.run((ctx) =>
      assetToken.transfer(ctx, asset.tokenContract, recipient, raw),
    );
    if (res) {
      setTo("");
      setAmount("");
      setAmountError(null);
      onTransferred?.();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-base-100/55">Your balance</span>
        {balanceLoading ? (
          <span className="text-xs text-base-100/55">Loading…</span>
        ) : (
          <span className="font-semibold text-base-100">
            {formatTokenAmount(balance, metadata.decimals)} {metadata.symbol}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-base-100/55">Your compliance status</span>
        {compliance.loading ? (
          <span className="text-xs text-base-100/55">Checking…</span>
        ) : (
          <ComplianceBadge status={status} />
        )}
      </div>
      {compliance.data?.record && (
        <p className="text-xs text-base-100/40">
          Approval{" "}
          {compliance.data.record.expiresAt === 0
            ? "does not expire."
            : `expires at ledger ${compliance.data.record.expiresAt}.`}
        </p>
      )}

      {/* A failed compliance read is not the same as "not approved". */}
      {compliance.error && (
        <ErrorState
          title="Couldn't check your compliance status"
          message={compliance.error}
          onRetry={compliance.refetch}
          className="py-6"
        />
      )}

      {/* Explicit gating messages. */}
      {!compliance.loading && !compliance.error && !approved && (
        <p role="alert" aria-live="polite" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-200/90">
          {status === "None"
            ? "Your address isn't on this asset's KYC allowlist. Ask the issuer to approve you before you can hold or transfer it."
            : status === "Suspended"
              ? "Your approval is suspended for this asset. Contact the issuer to reinstate it."
              : status === "Pending"
                ? "Your KYC approval is pending. Transfers unlock once the issuer approves you."
                : "Your address is not permitted to transfer this asset (rejected or expired approval)."}
        </p>
      )}
      {paused && (
        <p role="alert" aria-live="polite" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-200/90">
          Transfers are paused by the issuer for this asset. You can transfer once
          the issuer unpauses the token.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3 border-t border-white/5 pt-4">
        <div>
          <label htmlFor="transfer-to" className="label">Recipient address</label>
          <input
            id="transfer-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G… or C…"
            disabled={!canTransfer || complianceLoading || tx.pending}
            className="input font-mono text-xs sm:text-sm overflow-x-auto"
            spellCheck={false}
            aria-invalid={recipientInvalid || undefined}
            aria-describedby={recipientInvalid ? "transfer-to-error" : undefined}
          />
          {recipientFormatValid && (
            <p
              id={recipientInvalid ? "transfer-to-error" : undefined}
              role="status"
              aria-live="polite"
              className="mt-1.5 text-xs"
            >
              {recipientCompliance.loading ? (
                <span className="text-base-100/55">Checking recipient compliance…</span>
              ) : recipientCompliance.data?.allowed ? (
                <span className="text-brand-300">Recipient is KYC-approved.</span>
              ) : (
                <span className="text-red-400">
                  Recipient isn&apos;t KYC-approved for this asset and can&apos;t receive a
                  transfer.
                </span>
              )}
            </p>
          )}
          {isOwnAddress && (
            <p role="alert" aria-live="polite" className="mt-1.5 text-xs text-amber-300">
              This is your connected wallet address. Choose a different recipient to avoid an unnecessary self-transfer.
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="transfer-amount" className="label">Amount</label>
            {/* #215 a11y: focus-visible ring added (no .btn base class here) */}
            {canTransfer && (
              <button
                type="button"
                onClick={() => setAmount(formatRawPlain(balance, metadata.decimals))}
                className="mb-1.5 text-xs text-brand-400 hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-base-950 rounded"
              >
                Max
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="transfer-amount"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                setAmount(val);
                // Inline decimal validation — check on every keystroke so the
                // user gets immediate feedback without waiting for form submit.
                if (val === "") {
                  setAmountError(null);
                } else {
                  try {
                    parseTokenAmount(val, metadata.decimals);
                    setAmountError(null);
                  } catch (err) {
                    setAmountError(err instanceof Error ? err.message : null);
                  }
                }
              }}
              placeholder="0.00"
              inputMode="decimal"
              disabled={!canTransfer || complianceLoading || tx.pending}
              className="input pr-16"
              aria-invalid={amountInvalid || undefined}
              aria-describedby={amountInvalid ? "transfer-amount-error" : undefined}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/55">
              {metadata.symbol}
            </span>
          </div>
          {amountError && (
            <p id="transfer-amount-error" role="alert" aria-live="polite" className="mt-1.5 text-xs text-red-400">
              {amountError}
            </p>
          )}
        </div>

        {formError && <p role="alert" aria-live="assertive" className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button
            type="submit"
            disabled={!canTransfer || complianceLoading || !formValid || tx.pending}
            className="btn-primary w-full"
          >
            {complianceLoading
              ? "Checking compliance…"
              : paused
                ? "Transfers paused"
              : canTransfer
                ? "Transfer"
                : "Transfer unavailable"}
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            onDismiss={tx.reset}
            onRetry={tx.retry}
            retryable={tx.retryable}
            successMessage="Transfer confirmed."
          />
        )}
      </form>
    </div>
  );
}
