"use client";

import { useMemo } from "react";
import { registry } from "@/lib/contracts";
import { api } from "@/lib/api";
import { loadAssetEntries } from "@/lib/assetCache";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import type { AssetEntry, Network } from "@/types";

export function useAssets(opts?: { includeInactive?: boolean }) {
  const { network } = useWallet();
  const includeInactive = opts?.includeInactive ?? false;
  const state = useAsync<AssetEntry[]>(
    () => loadAssetEntries(network, includeInactive),
    [network, includeInactive],
  );
  return { ...state, assets: state.data ?? [] };
}

export interface PlatformStatsData {
  totalAssets: number;
  tvl: bigint;
  totalHolders: number | null;
  assets: AssetEntry[] | null;
}

export function usePlatformStats() {
  const { network } = useWallet();
  return useAsync<PlatformStatsData>(
    async () => {
      const fromApi = await api.getStats();
      if (fromApi) {
        return {
          totalAssets: fromApi.totalAssets,
          tvl: BigInt(fromApi.tvl),
          totalHolders: fromApi.totalHolders ?? null,
          assets: null,
        };
      }
      const [assets, tvl] = await Promise.all([
        registry.getAllAssets(network),
        registry.totalValueLocked(network),
      ]);
      const active = assets.filter((a) => a.active);
      return { totalAssets: active.length, tvl, totalHolders: null, assets: active };
    },
    [network],
  );
}

export function useIssuerAssets(issuer: string | null, network: Network) {
  return useAsync<AssetEntry[]>(
    async () => {
      if (!issuer) return [];
      const fromApi = await api.getAssetsByIssuer(issuer);
      if (fromApi) return fromApi;
      return registry.getAssetsByIssuer(network, issuer);
    },
    [issuer, network],
    Boolean(issuer),
  );
}
