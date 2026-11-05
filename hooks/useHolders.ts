"use client";

import { compliance, assetToken } from "@/lib/contracts";
import { api } from "@/lib/api";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import { dedupeRequest } from "@/lib/requestCache";
import type { Network } from "@/types";

export interface Holder {
  address: string;
  balance: bigint;
}

export async function fetchOnChainHolders(
  network: Network,
  complianceId: string,
  tokenContract: string,
): Promise<Holder[]> {
  const addresses = await dedupeRequest(
    `allowlist:${network}:${complianceId}`,
    () => compliance.getAllowlist(network, complianceId),
  );
  const holders = await Promise.all(
    addresses.map(async (address) => ({
      address,
      balance: await assetToken.balance(network, tokenContract, address),
    })),
  );
  return holders
    .filter((holder) => holder.balance > 0n)
    .sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
}

/**
 * Derive an asset's holders. The token contract doesn't enumerate holders, so
 * we read the compliance allowlist (the only addresses that *can* hold it) and
 * keep those with a positive balance, sorted by size.
 * When the API is configured, reads the pre-aggregated holder list instead.
 */
/**
 * @param refreshKey Bump this (e.g. after a confirmed transfer) to force a
 * refetch even though `complianceId`/`tokenContract`/`network` didn't change.
 * @param assetId The numeric registry asset id. `GET /assets/:id/holders` is
 * keyed on the registry id (`Path<u64>`) — a contract address in that segment
 * is a 400. When omitted the API path is skipped and we read on-chain.
 */
export function useHolders(
  complianceId: string | null,
  tokenContract: string | null,
  refreshKey = 0,
  assetId: bigint | null = null,
) {
  const { network } = useWallet();
  return useAsync<Holder[]>(
    async () => {
      if (!complianceId || !tokenContract) return [];

      const fromApi = assetId ? await api.getHolders(assetId) : null;
      if (fromApi) {
        return fromApi
          .filter((h) => h.balance > 0n)
          .sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
      }

      // Dedupe allowlist reads across concurrent hooks
      return fetchOnChainHolders(network, complianceId, tokenContract);
    },
    [complianceId, tokenContract, network, refreshKey, assetId?.toString() ?? null],
    Boolean(complianceId && tokenContract),
  );
}
