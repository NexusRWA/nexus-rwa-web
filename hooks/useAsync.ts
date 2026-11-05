"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  refetch: () => void;
}

/**
 * Run an async loader whenever its dependencies change, tracking
 * loading/error state and guarding against out-of-order responses.
 * Pass `enabled: false` to defer until preconditions are met.
 *
 * `data` is scoped to the `(deps, enabled)` key it was loaded for. When that
 * key changes — or when the load fails — `data` is reset to `null`, so the
 * hook can never expose a value produced for previous dependencies. This
 * matters for account-scoped reads such as `useBalance` (deps
 * `[tokenContract, address, network]`) and `useDividends` (deps include
 * `address`): during an account switch the previous account's balance must not
 * be presented as the new account's.
 *
 * A plain `refetch()` keeps the current data while it reloads, so manual
 * refreshes do not flash an empty state.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const reqId = useRef(0);
  // Serialize deps to a stable string key so memoization is by value, not by
  // array identity/length — unstable references or a changing-length caller
  // deps array no longer break the useCallback dependency list below.
  const depsKey = JSON.stringify(deps);
  // Identifies the dependency set the currently exposed `data` belongs to.
  // `null` means nothing has been loaded yet.
  const loadedKey = useRef<string | null>(null);
  const runKey = `${enabled}|${depsKey}`;

  const run = useCallback(() => {
    if (!enabled) {
      // The hook is disabled, so any data we hold was produced for conditions
      // that no longer hold (e.g. a wallet that just disconnected).
      if (loadedKey.current !== null) {
        loadedKey.current = null;
        setData(null);
        setUpdatedAt(null);
      }
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    // Drop data from a different dependency set, but keep it for a refetch of
    // the same one so a manual refresh doesn't blank the view.
    if (loadedKey.current !== runKey) {
      setData(null);
      setUpdatedAt(null);
    }
    loadedKey.current = runKey;
    setLoading(true);
    setError(null);
    loader()
      .then((res) => {
        if (id === reqId.current) {
          setData(res);
          setUpdatedAt(Date.now());
          setLoading(false);
        }
      })
      .catch((e) => {
        if (id === reqId.current) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
          // A failed load must not leave the previous key's value on screen.
          setData(null);
          setUpdatedAt(null);
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, depsKey, runKey]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, updatedAt, refetch: run };
}
