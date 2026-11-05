"use client";

import type { ValidatedToken, TokenizeFormData } from "@/lib/tokenizeFlow";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { ASSET_TYPE_LABELS } from "@/types";
import { formatUsdCents, formatTokenAmount, truncateAddress } from "@/lib/format";
import { TxProgress } from "@/components/ui/TxProgress";
import { TokenContractPreview } from "./Step1TokenContract";

interface Step3Props {
  validated: ValidatedToken;
  formData: Pick<TokenizeFormData, "name" | "assetType" | "valuation">;
  onBack: () => void;
  onRegistered: (assetId: bigint | null, txHash: string) => void;
}

/** Review all details and submit the register_asset transaction. */
export function Step3Confirm({ validated, formData, onBack, onRegistered }: Step3Props) {
  const { address } = useWallet();
  const tx = useTx();
  const { metadata, tokenContract } = validated;

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Registry name", value: formData.name },
    { label: "Asset class", value: ASSET_TYPE_LABELS[formData.assetType as keyof typeof ASSET_TYPE_LABELS] ?? formData.assetType },
    { label: "Valuation", value: formatUsdCents(formData.valuation) },
    { label: "Token contract", value: tokenContract, mono: true },
    { label: "On-chain name", value: metadata.name },
    { label: "Symbol", value: metadata.symbol },
    { label: "Total supply", value: `${formatTokenAmount(metadata.totalSupply, metadata.decimals)} ${metadata.symbol}` },
    { label: "Compliance contract", value: metadata.complianceContract, mono: true },
    { label: "Issuer (you)", value: address ?? "—", mono: true },
  ];

  async function handleConfirm() {
    const { registry } = await import("@/lib/contracts");
    const result = await tx.run((ctx) =>
      registry.registerAsset(ctx, {
        issuer: ctx.source,
        tokenContract,
        name: formData.name,
        assetType: formData.assetType,
        valuation: formData.valuation,
      }),
    );
    if (result) {
      let assetId: bigint | null = null;
      if (result.returnValue !== undefined && result.returnValue !== null) {
        try { assetId = BigInt(result.returnValue as string | number | bigint); } catch { /* void */ }
      }
      onRegistered(assetId, result.hash);
    }
  }

  return (
    <div className="space-y-5">
      <TokenContractPreview validated={validated} />

      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-base-100">Review & confirm</h2>
          <p className="mt-1 text-sm text-base-100/55">
            Check everything below before submitting. The registry transaction
            cannot be reversed.
          </p>
        </div>

        <dl className="divide-y divide-white/5">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <dt className="text-sm text-base-100/55">{r.label}</dt>
              <dd
                className={`max-w-[60%] break-all text-right text-sm font-semibold text-base-100 ${
                  r.mono ? "font-mono text-xs text-base-100/80" : ""
                }`}
              >
                {r.mono ? truncateAddress(r.value, 8, 6) : r.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 text-xs text-amber-200/80">
          <strong className="font-semibold text-amber-200">Note:</strong> once registered,
          the asset is publicly visible on the platform. Make sure the compliance
          contract is configured and at least one address is on the allowlist
          before distributing tokens.
        </div>

        <div className="flex gap-3 border-t border-white/5 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={tx.pending}
            className="btn-ghost"
          >
            ← Back
          </button>

          {tx.phase === "idle" ? (
            <button onClick={handleConfirm} disabled={tx.pending} className="btn-primary">
              Register asset on-chain
            </button>
          ) : (
            <TxProgress
              phase={tx.phase}
              hash={tx.hash}
              error={tx.error}
              onDismiss={tx.reset}
              onRetry={tx.retry}
              retryable={tx.retryable}
              successMessage="Asset registered successfully."
            />
          )}
        </div>
      </div>
    </div>
  );
}
