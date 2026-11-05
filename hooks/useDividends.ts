"use client";

import { assetToken as tokenContract, dividend } from "@/lib/contracts";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { Distribution } from "@/types";

export interface DistributionWithClaim extends Distribution {
  /** Amount the connected wallet can still claim from this distribution. */
  claimable: bigint;
  claimed: boolean;
  /** Decimal scale reported by this distribution's payment token. */
  paymentTokenDecimals: number;
}

/**
 * All distributions for an asset token, annotated with the connected wallet's
 * claimable amount and claimed status where a wallet is connected.
 *
 * Callers should invoke the returned `refetch` after a successful claim
 * (see ClaimButton's `onClaimed`) so a distribution's row flips to
 * "claimed" without requiring a manual page refresh.
 *
 * Failures (e.g. a rejected RPC call) are surfaced through the returned
 * `error` state by `useAsync` rather than thrown into the component.
 *
 * Empty/zero input: when `assetTokenId` is `null` or an empty string the hook
 * is disabled (`useAsync`'s `enabled` flag is false) and resolves to an empty
 * list without touching the network. This is deliberate — callers can render
 * the hook unconditionally before an asset is selected.
 */
export function useDividends(assetTokenId: string | null) {
  const { network, address } = useWallet();
  return useAsync<DistributionWithClaim[]>(
    async () => {
      if (!assetTokenId) return [];
      const dists = await dividend.getDistributionsForAsset(network, assetTokenId);
      const annotated = await Promise.all(
        dists.map(async (d) => {
          const paymentTokenDecimals = await tokenContract.decimals(network, d.paymentToken);
          if (!address) {
            return { ...d, paymentTokenDecimals, claimable: 0n, claimed: false };
          }
          const [claimable, claimed] = await Promise.all([
            dividend.claimable(network, d.id, address),
            dividend.hasClaimed(network, d.id, address),
          ]);
          return { ...d, paymentTokenDecimals, claimable, claimed };
        }),
      );
      return annotated;
    },
    // Every value the async callback closes over is listed here so the hook
    // never reads a stale assetTokenId/address/network. `assetTokenId` is
    // normalized to `null` for empty strings so a `""` -> `null` transition
    // doesn't trigger a redundant refetch (both are disabled states).
    [assetTokenId || null, address, network],
    Boolean(assetTokenId),
  );
}
