"use client";

import { useWallet } from "@/hooks/useWallet";
import { explorerTxUrl } from "@/lib/stellar";
import { formatStroopsToXLM } from "@/lib/format";
import type { TxPhase, TxErrorType } from "@/types";
import { Spinner } from "./Spinner";

const PHASE_LABEL: Record<Exclude<TxPhase, "idle">, string> = {
  building: "Preparing transaction…",
  signing: "Awaiting signature in Freighter…",
  submitting: "Submitting to the network…",
  confirming: "Confirming on-chain…",
  success: "Confirmed",
  timeout: "Confirmation timed out",
  error: "Transaction failed",
};

interface TxProgressProps {
  phase: TxPhase;
  hash: string | null;
  error: string | null;
  errorType?: TxErrorType;
  /** Estimated network fee in stroops from simulation. */
  estimatedFee?: bigint | null;
  /** Called when the user dismisses a success/error result. */
  onDismiss?: () => void;
  /**
   * Called when the user clicks the retry button on a transient error.
   * When provided alongside `retryable: true`, a "Try again" button is shown
   * inside the error state. Not shown for deterministic contract rejections.
   */
  onRetry?: () => void;
  /**
   * Whether the last error is safe to retry (transient: rate-limit, RPC blip).
   * Set to `false` (or omit) for deterministic contract rejections that will
   * always fail, so the retry affordance is hidden.
   */
  retryable?: boolean;
  successMessage?: string;
}

/**
 * Renders the live status of an on-chain action driven by `useTx`: a spinner
 * with the current phase while pending, then a success (with explorer link) or
 * error result. When the phase reaches "signing", displays the estimated fee
 * so the user can review it before approving the transaction. When the error
 * is transient and `onRetry` + `retryable` are provided, a "Try again" button
 * is shown so the user can re-submit without re-entering the form.
 */
export function TxProgress({
  phase,
  hash,
  error,
  errorType = "generic",
  estimatedFee,
  onDismiss,
  onRetry,
  retryable = false,
  successMessage = "Your transaction is confirmed.",
}: TxProgressProps) {
  const { network } = useWallet();
  if (phase === "idle") return null;

  const pending =
    phase === "building" ||
    phase === "signing" ||
    phase === "submitting" ||
    phase === "confirming";

  if (pending) {
    // Show fee estimate during the signing phase
    const showFeeEstimate = phase === "signing" && estimatedFee !== undefined && estimatedFee !== null;

    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-base-100/80"
      >
        <div className="flex items-center gap-3">
          <Spinner size={18} decorative />
          <span>{PHASE_LABEL[phase]}</span>
        </div>
        {showFeeEstimate && (
          <div className="border-t border-brand-500/10 pt-2 text-xs text-base-100/60">
            <div className="flex items-center justify-between gap-2">
              <span>Estimated fee:</span>
              <code className="font-mono">{formatStroopsToXLM(estimatedFee)}</code>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === "error") {
    // Issue #369: Distinguish Auth errors from other contract errors
    const isAuth = errorType === "auth";
    const displayError = isAuth
      ? error || "You are not authorized to perform this action."
      : error ?? "The transaction did not complete.";

    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          isAuth
            ? "border-red-500/40 bg-red-500/10 text-red-200"
            : "border-red-500/25 bg-red-500/5 text-red-300"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <div>
            <span>{displayError}</span>
            {retryable && onRetry && (
              <button
                onClick={onRetry}
                className="mt-1.5 flex items-center gap-1 text-xs text-red-300/80 underline decoration-red-300/40 underline-offset-2 hover:text-red-300 hover:decoration-red-300"
                aria-label="Retry the transaction"
              >
                {/* Refresh icon */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Try again
              </button>
            )}
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>
    );
  }

  // timeout state - visually distinct from error, includes explorer link
  if (phase === "timeout") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start justify-between gap-3 rounded-xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3 text-sm"
      >
        <div className="flex items-start gap-2.5 text-yellow-300">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <div>
            <p>{error ?? "Confirmation timed out."}</p>
            {hash && (
              <a
                href={explorerTxUrl(network, hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-xs text-yellow-400 underline decoration-yellow-400/40 underline-offset-2 hover:decoration-yellow-400"
              >
                Check transaction on Stellar Expert ↗
              </a>
            )}
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 text-yellow-300/60 hover:text-yellow-300" aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>
    );
  }

  // success
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start justify-between gap-3 rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-2.5 text-brand-300">
        <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p>{successMessage}</p>
          {hash && (
            <a
              href={explorerTxUrl(network, hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-xs text-brand-400 underline decoration-brand-400/40 underline-offset-2 hover:decoration-brand-400"
            >
              View on Stellar Expert ↗
            </a>
          )}
        </div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-brand-300/60 hover:text-brand-300" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
