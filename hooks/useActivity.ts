"use client";

import { useCallback } from "react";

import { api, type ApiEvent, API_MAX_PAGES, API_PAGE_SIZE } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";

export interface TransferActivity {
  id: number;
  from: string;
  to: string;
  amount: bigint;
  ledger: number;
  timestamp: string | null;
}

function toTransferActivity(event: ApiEvent): TransferActivity | null {
  const { from, to, amount } = event.data;
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    typeof amount !== "string" ||
    !/^\d+$/.test(amount)
  ) {
    return null;
  }

  return {
    id: event.id,
    from,
    to,
    amount: BigInt(amount),
    ledger: event.ledger,
    timestamp: event.timestamp,
  };
}

/** Recent indexed transfer events for one asset token. */
export function useActivity(tokenContract: string | null, refreshKey = 0) {
  // Only run when the API is configured — no point trying without a base URL.
  const enabled = Boolean(tokenContract) && api.isConfigured();

  // Memoize the fetcher so it closes over the current tokenContract instead of
  // a stale value captured on an earlier render. useAsync re-runs when this
  // identity changes, so tokenContract must be in the dependency array.
  const fetchActivity = useCallback(async (): Promise<TransferActivity[]> => {
    if (!tokenContract) return [];

    // Walk pages until we get a short page (end of data).
    const all: import("@/lib/api").ApiEvent[] = [];
    for (let page = 0; page < API_MAX_PAGES; page++) {
      const offset = page * API_PAGE_SIZE;
      const batch = await api.getEvents({ offset, limit: API_PAGE_SIZE });
      if (!batch) {
        throw new Error(
          "Transfer history is unavailable. Configure the indexing API or try again later.",
        );
      }
      all.push(...batch);
      if (batch.length < API_PAGE_SIZE) break;
    }

    return all
      .filter(
        (event) =>
          event.contract === tokenContract && event.event_type === "Transfer",
      )
      .map(toTransferActivity)
      .filter((event): event is TransferActivity => event !== null);
  }, [tokenContract]);

  return useAsync<TransferActivity[]>(
    fetchActivity,
    [fetchActivity, refreshKey],
    enabled,
  );
}
