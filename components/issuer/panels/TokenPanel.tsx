"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { assetToken } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { parseTokenAmount, formatTokenAmount, formatRawPlain } from "@/lib/format";
import { ActionCard } from "@/components/issuer/ActionCard";
import { TxProgress } from "@/components/ui/TxProgress";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface TokenPanelProps {
  asset: AssetDetail;
  onMinted?: () => void;
  onPauseToggled?: () => void;
  isAdmin?: boolean;
}

/** Mint tokens to an address, and pause / unpause the token contract. */
export function TokenPanel({ asset, onMinted, onPauseToggled, isAdmin = true }: TokenPanelProps) {
  const { metadata, tokenContract } = asset;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-base-100/50">
        <strong>Required role:</strong> asset-token <code className="font-mono text-base-100/60">admin</code>
      </div>
      <MintCard
        tokenContract={tokenContract}
        metadata={metadata}
        {...(onMinted !== undefined ? { onMinted } : {})}
        isAdmin={isAdmin}
      />
      <PauseCard
        tokenContract={tokenContract}
        paused={metadata.paused}
        {...(onPauseToggled !== undefined ? { onToggled: onPauseToggled } : {})}
        isAdmin={isAdmin}
      />
    </div>
  );
}

// ---- Mint ----

/**
 * Threshold for requiring confirmation on large mint amounts.
 * Mints that would increase supply by more than 50% of current supply require
 * an extra confirmation step to prevent accidental supply inflation.
 */
const LARGE_MINT_THRESHOLD_PERCENT = 50;

function MintCard({
  tokenContract,
  metadata,
  onMinted,
  isAdmin = true,
}: {
  tokenContract: string;
  metadata: AssetDetail["metadata"];
  onMinted?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMint, setPendingMint] = useState<{ recipient: string; raw: bigint } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const recipient = to.trim();
    if (!StrKey.isValidEd25519PublicKey(recipient) && !StrKey.isValidContract(recipient)) {
      setFormError("Enter a valid Stellar address (G… or C…).");
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

    // Check if this is a large mint that requires confirmation
    if (
      raw * 100n >
      metadata.totalSupply * BigInt(LARGE_MINT_THRESHOLD_PERCENT)
    ) {
      setPendingMint({ recipient, raw });
      setConfirmOpen(true);
      return;
    }

    // Otherwise, mint directly
    await executeMint(recipient, raw);
  }

  async function executeMint(recipient: string, raw: bigint) {
    const res = await tx.run((ctx) =>
      assetToken.mint(ctx, tokenContract, recipient, raw),
    );
    if (res) {
      setTo("");
      setAmount("");
      setPendingMint(null);
      onMinted?.();
    }
  }

  function handleConfirmLargeMint() {
    setConfirmOpen(false);
    if (pendingMint) {
      void executeMint(pendingMint.recipient, pendingMint.raw);
    }
  }

  function handleCancelMint() {
    setConfirmOpen(false);
    setPendingMint(null);
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen && !!pendingMint}
        title="Confirm large mint?"
        description={
          pendingMint
            ? `You're minting ${formatTokenAmount(pendingMint.raw, metadata.decimals)} ${
                metadata.symbol
              } (${formatRawPlain(pendingMint.raw, metadata.decimals)} raw). This will increase total supply from ${formatTokenAmount(
                metadata.totalSupply,
                metadata.decimals,
              )} by more than ${LARGE_MINT_THRESHOLD_PERCENT}%. Are you sure this is correct?`
            : ""
        }
        confirmLabel="Yes, mint these tokens"
        onConfirm={handleConfirmLargeMint}
        onCancel={handleCancelMint}
      />

      <ActionCard
        title="Mint tokens"
        description="Issue new tokens to a KYC-approved address, increasing total supply."
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          </svg>
        }
      >
      {/* #294: warn the issuer when the token is paused so mint attempts don't silently fail */}
      {metadata.paused && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90"
        >
          This token is currently paused. Minting will likely fail until the token is
          unpaused below.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="mint-to" className="label">Recipient address</label>
          <input
            id="mint-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="G… or C…"
            disabled={tx.pending || !isAdmin}
            className="input font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div>
          <label htmlFor="mint-amount" className="label">Amount</label>
          <div className="relative">
            <input
              id="mint-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              disabled={tx.pending || !isAdmin}
              className="input pr-20"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-base-100/55">
              {metadata.symbol}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-base-100/55">
            Current supply: {formatTokenAmount(metadata.totalSupply, metadata.decimals)} {metadata.symbol}
          </p>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button
            type="submit"
            disabled={tx.pending || !isAdmin}
            className="btn-primary"
            title={!isAdmin ? "Only the asset admin can mint tokens" : ""}
          >
            Mint
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
            successMessage="Tokens minted successfully."
          />
        )}
      </form>
      </ActionCard>
    </>
  );
}

// ---- Pause / Unpause ----

interface AssetMetadata {
  name?: string;
}

function PauseCard({
  tokenContract,
  paused,
  onToggled,
  isAdmin = true,
}: {
  tokenContract: string;
  paused: boolean;
  onToggled?: () => void;
  isAdmin?: boolean;
}) {
  const tx = useTx();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestToggle() {
    setConfirmOpen(true);
  }

  async function doToggle() {
    setConfirmOpen(false);
    const res = await tx.run((ctx) =>
      paused
        ? assetToken.unpause(ctx, tokenContract)
        : assetToken.pause(ctx, tokenContract),
    );
    if (res) onToggled?.();
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title={paused ? "Unpause transfers?" : "Pause all transfers?"}
        description={
          paused
            ? "This will re-enable all token transfers. Existing holders will be able to send or receive this asset again. Are you sure?"
            : "This will immediately stop all token transfers. Existing holders won't be able to send or receive this asset until you unpause it. Are you sure you want to continue?"
        }
        confirmLabel={paused ? "Yes, unpause transfers" : "Yes, pause transfers"}
        onConfirm={doToggle}
        onCancel={() => setConfirmOpen(false)}
      />

      <ActionCard
        title={paused ? "Unpause transfers" : "Pause transfers"}
        description={
          paused
            ? "All transfers are currently blocked. Unpause to allow compliant holders to transfer the asset again."
            : "Temporarily stop all transfers of this token. Useful during compliance reviews or emergency situations."
        }
        accent={paused ? "bg-brand-500/10 text-brand-400" : "bg-amber-500/10 text-amber-400"}
        icon={
          paused ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          )
        }
      >
        {paused && (
          <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90">
            Transfers are currently paused. Holders cannot send or receive this token.
          </p>
        )}
        {tx.phase === "idle" ? (
          <button
            onClick={requestToggle}
            disabled={tx.pending || !isAdmin}
            className={paused ? "btn-primary" : "btn-secondary"}
            title={!isAdmin ? "Only the asset admin can control pausing" : ""}
          >
            {paused ? "Unpause transfers" : "Pause transfers"}
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
            successMessage={paused ? "Token unpaused." : "Token paused."}
          />
        )}
      </ActionCard>
    </>
  );
}
