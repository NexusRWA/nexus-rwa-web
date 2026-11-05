"use client";

import { useState } from "react";
import type { ValidatedToken } from "@/lib/tokenizeFlow";
import type { TokenizeFormData } from "@/lib/tokenizeFlow";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/types";
import { formatRawPlain, formatUsdCents, parseUsdToCents } from "@/lib/format";
import { TokenContractPreview } from "./Step1TokenContract";

interface Step2Props {
  validated: ValidatedToken;
  initial: Partial<TokenizeFormData>;
  onBack: () => void;
  onNext: (data: Pick<TokenizeFormData, "name" | "assetType" | "valuation">) => void;
}

/**
 * Step 2: collect registry metadata — display name, asset class, and
 * valuation. The token contract fields are pre-filled from Step 1's metadata
 * but remain editable so the issuer can override the registry display name.
 */
export function Step2AssetDetails({ validated, initial, onBack, onNext }: Step2Props) {
  const { metadata } = validated;

  const [name, setName] = useState(initial.name ?? metadata.name ?? "");
  const [assetType, setAssetType] = useState(
    initial.assetType ??
      (ASSET_TYPES.find((type) => type === metadata.assetType) ?? "real_estate"),
  );
  const [valuationInput, setValuationInput] = useState(
    initial.valuation ? formatRawPlain(initial.valuation, 2) : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Asset name is required.";
    else if (name.trim().length > 100) next.name = "Name must be 100 characters or fewer.";
    if (!valuationInput.trim()) {
      next.valuation = "Valuation is required.";
    } else {
      try {
        const cents = parseUsdToCents(valuationInput.replace(/,/g, ""));
        if (cents <= 0n) next.valuation = "Valuation must be greater than zero.";
      } catch {
        next.valuation = "Enter a valid USD amount (e.g. 1,000,000).";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const valuation = parseUsdToCents(valuationInput.replace(/,/g, ""));
    onNext({ name: name.trim(), assetType, valuation });
  }

  const previewCents = (() => {
    try { return parseUsdToCents(valuationInput.replace(/,/g, "")); }
    catch { return null; }
  })();

  return (
    <div className="space-y-5">
      <TokenContractPreview validated={validated} />

      <form onSubmit={onSubmit} className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-base-100">Asset details</h2>
          <p className="mt-1 text-sm text-base-100/55">
            These fields are stored in the registry contract and shown throughout
            the platform.
          </p>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="asset-name" className="label">Asset name</label>
          <input
            id="asset-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lagos Office Tower — Series A"
            maxLength={100}
            className="input"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "asset-name-error" : undefined}
          />
          {errors.name && (
            <p id="asset-name-error" role="alert" className="mt-1 text-xs text-red-400">
              {errors.name}
            </p>
          )}
        </div>

        {/* Asset type
            #219 a11y: the toggle buttons form a logical choice group — wrapping
            them in a <fieldset> with a <legend> gives screen readers the group
            name ("Asset class") before reading the individual option labels.
            #215 a11y: each button carries a focus-visible ring. */}
        <fieldset>
          <legend className="label block">Asset class</legend>
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAssetType(t)}
                aria-pressed={assetType === t}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ${
                  assetType === t
                    ? "border-brand-500/50 bg-brand-500/15 text-brand-300"
                    : "border-white/10 bg-white/[0.02] text-base-100/60 hover:border-white/20 hover:text-base-100"
                }`}
              >
                {ASSET_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Valuation */}
        <div>
          <label htmlFor="asset-valuation" className="label">Valuation (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-base-100/55">
              $
            </span>
            <input
              id="asset-valuation"
              value={valuationInput}
              onChange={(e) => setValuationInput(e.target.value)}
              placeholder="1,000,000"
              inputMode="decimal"
              className="input pl-7"
              aria-invalid={errors.valuation ? true : undefined}
              aria-describedby={errors.valuation ? "asset-valuation-error" : undefined}
            />
          </div>
          {previewCents && previewCents > 0n && (
            <p className="mt-1 text-xs text-base-100/55">
              {formatUsdCents(previewCents)}
            </p>
          )}
          {errors.valuation && (
            <p id="asset-valuation-error" role="alert" className="mt-1 text-xs text-red-400">
              {errors.valuation}
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-white/5 pt-2">
          <button type="button" onClick={onBack} className="btn-ghost">
            ← Back
          </button>
          <button type="submit" className="btn-primary">
            Review →
          </button>
        </div>
      </form>
    </div>
  );
}
