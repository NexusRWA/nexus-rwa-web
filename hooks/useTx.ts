"use client";

import { useCallback, useRef, useState } from "react";
import type { TxPhase, TxResult, TxTelemetry, TxErrorType } from "@/types";
import type { WriteCtx } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/components/ui/ToastProvider";
import { ContractError, TransactionTimeoutError } from "@/lib/stellar";
import { LockedWalletError, UserRejectedError } from "@/lib/freighter";

interface RunResult {
  phase: TxPhase;
  hash: string | null;
  error: string | null;
  errorType: TxErrorType;
  /** Estimated network fee in stroops from simulation. */
  estimatedFee: bigint | null;
  /** True while the transaction is building/signing/submitting/confirming. */
  pending: boolean;
  /**
   * True when the last error is transient and re-submitting the same action
   * may succeed (e.g. rate-limit, RPC blip). False for deterministic contract
   * rejections (auth, invalid state) that will always fail.
   */
  retryable: boolean;
  /**
   * Execute a write. `action` receives a WriteCtx whose onPhase is wired to
   * this hook's phase state. Resolves with the TxResult, or null on failure.
   */
  run: (action: (ctx: WriteCtx) => Promise<TxResult>) => Promise<TxResult | null>;
  /** Re-run the last action with the same inputs without re-entering the form. */
  retry: () => Promise<TxResult | null>;
  reset: () => void;
}

/**
 * Errors that are deterministic — retrying the same call will always fail, so
 * the retry affordance should not be offered. These are contract-layer errors
 * (auth failures, invalid state, insufficient balance, etc.) that originate
 * from the Soroban contract returning an explicit error code.
 */
function isNonRetryableError(error: unknown): boolean {
  // ContractError wraps every rejection that comes back from the chain itself.
  // These are deterministic: re-submitting the same transaction will always
  // produce the same result, so a retry button would mislead the user.
  return error instanceof ContractError;
}

/**
 * Optional telemetry defaults — no-ops when not provided by the consumer.
 * Assign to `window.__rwaTxTelemetry` or pass via `useTx(telemetry)`.
 */
const noopTelemetry: TxTelemetry = {};

/**
 * Drives a single on-chain write: tracks phase (building → signing →
 * submitting → confirming → success/error) so the UI can show progress, and
 * exposes the resulting hash. Errors are captured as friendly messages.
 *
 * After a transient failure (rate limit, RPC blip, network timeout) the hook
 * sets `retryable: true` and stores the last action so callers can surface a
 * retry control without re-entering the form. Deterministic contract rejections
 * (auth errors, invalid state) set `retryable: false`.
 *
 * @param telemetry Optional lifecycle callbacks for product analytics or error
 * monitoring (e.g. Sentry). Each phase change, success and error emit to the
 * provided callbacks without blocking the transaction flow.
 */
export function useTx(telemetry?: TxTelemetry): RunResult {
  const { writeCtx } = useWallet();
  const { addToast } = useToast();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<TxErrorType>("generic");
  const [estimatedFee, setEstimatedFee] = useState<bigint | null>(null);
  const [retryable, setRetryable] = useState(false);
  /** Holds the last submitted action so `retry()` can re-run it. */
  const lastActionRef = useRef<((ctx: WriteCtx) => Promise<TxResult>) | null>(null);
  const t = telemetry ?? noopTelemetry;

  const reset = useCallback(() => {
    setPhase("idle");
    setHash(null);
    setError(null);
    setErrorType("generic");
    setEstimatedFee(null);
    setRetryable(false);
    lastActionRef.current = null;
  }, []);

  const run = useCallback(
    async (action: (ctx: WriteCtx) => Promise<TxResult>) => {
      lastActionRef.current = action;
      setError(null);
      setErrorType("generic");
      setHash(null);
      setEstimatedFee(null);
      setRetryable(false);
      setPhase("building");
      t.onPhase?.("building");
      try {
        const ctx = writeCtx((p) => {
          setPhase(p);
          t.onPhase?.(p);
        });
        const result = await action(ctx);
        setHash(result.hash);
        setEstimatedFee(result.estimatedFee ?? null);
        setPhase("success");
        t.onPhase?.("success");
        t.onSuccess?.(result.hash, result);
        return result;
      } catch (e) {
        // A declined signature is a normal user choice, not a failure: reset to
        // idle without an error so the form stays filled in for a retry.
        if (e instanceof UserRejectedError) {
          setPhase("idle");
          t.onPhase?.("idle");
          return null;
        }

        let msg: string;
        let nextPhase: TxPhase = "error";
        let errType: TxErrorType = "generic";

        if (e instanceof TransactionTimeoutError) {
          msg = e.message;
          nextPhase = "timeout";
          errType = "timeout";
          setHash(e.hash); // Keep the hash visible so the user can check the explorer.
        } else if (e instanceof LockedWalletError) {
          msg = e.message;
          errType = "locked-wallet";
        } else {
          msg = e instanceof Error ? e.message : "Transaction failed.";
          if (e instanceof ContractError) {
            console.error("Transaction failed:", e.detail);
            errType = e.isAuth ? "auth" : "generic";
          }
        }

        setError(msg);
        setErrorType(errType);
        setPhase(nextPhase);
        // Only offer retry for errors that are not deterministic contract rejections.
        setRetryable(!isNonRetryableError(e));
        addToast({ title: "Transaction failed", description: msg, tone: "error" });
        t.onPhase?.(nextPhase === "timeout" ? "error" : nextPhase, msg);
        t.onError?.(msg, errType);
        return null;
      }
    },
    [addToast, writeCtx, t],
  );

  const retry = useCallback(async () => {
    const action = lastActionRef.current;
    if (!action) return null;
    return run(action);
  }, [run]);

  return {
    phase,
    hash,
    error,
    errorType,
    estimatedFee,
    pending: phase === "building" || phase === "signing" || phase === "submitting" || phase === "confirming",
    retryable,
    run,
    retry,
    reset,
  };
}
