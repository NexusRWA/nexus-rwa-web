"use client";

import { registry, assetToken } from "@/lib/contracts";
import { getCachedAsset, takePrefetchedAssetMetadata } from "@/lib/assetCache";
import { useWallet } from "@/hooks/useWallet";
import { useAsync, type AsyncState } from "@/hooks/useAsync";
import { isNotFoundError } from "@/lib/stellar";
import type { AssetDetail } from "@/types";

export interface AssetState extends AsyncState<AssetDetail> {
  /** The registry has no asset with this id (a bad link, not worth retrying). */
  notFound: boolean;
}

/**
 * A single asset joined with its on-chain token metadata. Reads the registry
 * entry first, then the token contract it points at. A missing id resolves to
 * `notFound` with no error; any other failure surfaces as `error` so it can be
 * retried.
 */
export function useAsset(id: bigint | null): AssetState {
  const { network } = useWallet();
  const state = useAsync<AssetDetail | null>(
    async () => {
      if (id === null) return null;
      let entry;
      try {
        entry =
          getCachedAsset(network, id) ?? (await registry.getAsset(network, id));
      } catch (e) {
        if (isNotFoundError(e)) return null;
        throw e;
      }
      const metadata = await (takePrefetchedAssetMetadata(
        network,
        entry.tokenContract,
      ) ?? assetToken.getMetadata(network, entry.tokenContract));
      return { ...entry, metadata };
    },
    [id?.toString(), network],
    id !== null,
  );
  return {
    ...state,
    notFound: id !== null && !state.loading && !state.error && state.data === null,
  };
}

/** The connected wallet's balance of a given asset token, or 0n. */
export function useBalance(tokenContract: string | null) {
  const { network, address } = useWallet();
  return useAsync<bigint>(
    () =>
      tokenContract && address
        ? assetToken.balance(network, tokenContract, address)
        : Promise.resolve(0n),
    [tokenContract, address, network],
    Boolean(tokenContract && address),
  );
}
