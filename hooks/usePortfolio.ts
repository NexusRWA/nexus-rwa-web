"use client";

import { assetToken, dividend } from "@/lib/contracts";
import { getCachedAssetEntries, loadAssetEntries } from "@/lib/assetCache";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry, AssetMetadata, Distribution } from "@/types";
import type { DistributionWithClaim } from "@/hooks/useDividends";

export interface ClaimableTotal {
  paymentToken: string;
  decimals: number;
  amount: bigint;
}

export interface Holding {
  asset: AssetEntry;
  metadata: AssetMetadata;
  balance: bigint;
  /** Distributions for this asset that the connected wallet can still claim. */
  claimableDistributions: DistributionWithClaim[];
  /** Claimable totals grouped by payment token and decimal scale. */
  totalClaimable: ClaimableTotal[];
}

export interface PortfolioData {
  holdings: Holding[];
  /** Total estimated USD value across holdings (valuation × share of supply). */
  totalValueCents: bigint;
  /** Claimable totals grouped by payment token and decimal scale. */
  totalClaimable: ClaimableTotal[];
  /** Count of assets with failed balance, metadata, or distribution reads. */
  failedAssetCount: number;
  /** Whether the portfolio totals are incomplete due to read failures. */
  isIncomplete: boolean;
}

/**
 * Aggregates the connected wallet's token balances and claimable dividends
 * across all registered assets. Returns only assets where balance > 0.
 */
export function usePortfolio() {
  const { network, address } = useWallet();

  return useAsync<PortfolioData>(
    async () => {
      if (!address) {
        return { holdings: [], totalValueCents: 0n, totalClaimable: [], failedAssetCount: 0, isIncomplete: false };
      }

      // Reuse the shared asset list when available; otherwise use its API-first loader.
      const cachedAssets = getCachedAssetEntries(network);
      const allAssets = (cachedAssets ?? await loadAssetEntries(network)).filter(
        (asset) => asset.active,
      );

      if (allAssets.length === 0) {
        return { holdings: [], totalValueCents: 0n, totalClaimable: [], failedAssetCount: 0, isIncomplete: false };
      }

      // 2. Isolate balance/metadata failures so other holdings remain visible.
      const assetResults = await Promise.allSettled(
        allAssets.map(async (asset) => {
          const [balance, metadata] = await Promise.all([
            assetToken.balance(network, asset.tokenContract, address),
            assetToken.getMetadata(network, asset.tokenContract),
          ]);
          return { asset, metadata, balance };
        }),
      );
      let failedAssetCount = 0;
      const enriched: { asset: AssetEntry; metadata: AssetMetadata; balance: bigint }[] = [];
      for (const result of assetResults) {
        if (result.status === "fulfilled") {
          enriched.push(result.value);
        } else {
          failedAssetCount++;
        }
      }

      // 3. Filter down to assets the wallet actually holds
      const held = enriched.filter(({ balance }) => balance > 0n);

      if (held.length === 0) {
        return {
          holdings: [],
          totalValueCents: 0n,
          totalClaimable: [],
          failedAssetCount,
          isIncomplete: failedAssetCount > 0,
        };
      }

      // 4. For held assets, fetch distributions and annotate with claimable
      // Use Promise.allSettled to track per-asset failures instead of swallowing them
      const holdingResults = await Promise.allSettled(
        held.map(async ({ asset, metadata, balance }) => {
          let distributions: Distribution[] = [];
          try {
            distributions = await dividend.getDistributionsForAsset(network, asset.tokenContract);
          } catch (error) {
            // Log the error but continue with empty distributions
            console.warn(`Failed to fetch distributions for asset ${asset.id.toString()}:`, error);
            // Re-throw to be caught by allSettled
            throw error;
          }

          const claimableDistributions: DistributionWithClaim[] = await Promise.all(
            distributions.map(async (d) => {
              const [claimable, claimed, paymentTokenDecimals] = await Promise.all([
                dividend.claimable(network, d.id, address),
                dividend.hasClaimed(network, d.id, address),
                assetToken.decimals(network, d.paymentToken),
              ]);
              return { ...d, claimable, claimed, paymentTokenDecimals };
            }),
          );

          const totalClaimable = sumClaimableByToken(claimableDistributions);

          return { asset, metadata, balance, claimableDistributions, totalClaimable };
        }),
      );

      // Count failures and build holdings list
      const holdings: Holding[] = [];

      for (const result of holdingResults) {
        if (result.status === 'fulfilled') {
          holdings.push(result.value);
        } else {
          failedAssetCount++;
        }
      }

      // 5. Compute portfolio-level totals
      const totalValueCents = holdings.reduce((sum, { asset, metadata, balance }) => {
        if (metadata.totalSupply === 0n) return sum;
        // proportional share: valuation × (balance / totalSupply)
        // use integer math: (valuation * balance) / totalSupply
        return sum + (asset.valuation * balance) / metadata.totalSupply;
      }, 0n);

      const totalClaimable = sumClaimableByToken(
        holdings.flatMap((holding) =>
          holding.totalClaimable.map(({ paymentToken, decimals, amount }) => ({
            paymentToken,
            paymentTokenDecimals: decimals,
            claimable: amount,
            claimed: false,
          })),
        ),
      );

      return {
        holdings,
        totalValueCents,
        totalClaimable,
        failedAssetCount,
        isIncomplete: failedAssetCount > 0
      };
    },
    [address, network],
    Boolean(address),
  );
}

function sumClaimableByToken(
  distributions: Pick<
    DistributionWithClaim,
    "paymentToken" | "paymentTokenDecimals" | "claimable" | "claimed"
  >[],
): ClaimableTotal[] {
  const totals = new Map<string, ClaimableTotal>();
  for (const distribution of distributions) {
    if (distribution.claimed || distribution.claimable <= 0n) continue;
    const key = `${distribution.paymentToken}:${distribution.paymentTokenDecimals}`;
    const total = totals.get(key);
    if (total) {
      total.amount += distribution.claimable;
    } else {
      totals.set(key, {
        paymentToken: distribution.paymentToken,
        decimals: distribution.paymentTokenDecimals,
        amount: distribution.claimable,
      });
    }
  }
  return Array.from(totals.values());
}
