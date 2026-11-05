"use client";

import { useCallback } from "react";

import { api, type ApiEvent } from "@/lib/api";
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
  // Memoize the fetcher so it closes over the current tokenContract instead of
  // a stale value captured on an earlier render. useAsync re-runs when this
  // identity changes, so tokenContract must be in the dependency array.
  const fetchActivity = useCallback(async (): Promise<TransferActivity[]> => {
    if (!tokenContract) return [];

    const events = await api.getEvents();
    if (!events) {
      throw new Error(
        "Transfer history is unavailable. Configure the indexing API or try again later.",
      );
    }

    return events
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
    Boolean(tokenContract),
  );
}
