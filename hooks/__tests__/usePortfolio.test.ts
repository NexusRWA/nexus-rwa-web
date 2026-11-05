import { renderHook, waitFor } from "@testing-library/react";
import { usePortfolio } from "../usePortfolio";
import { registry, assetToken, dividend } from "@/lib/contracts";
import { getCachedAssetEntries, loadAssetEntries } from "@/lib/assetCache";
import { useWallet } from "@/hooks/useWallet";
import type { AssetEntry, AssetMetadata, Distribution } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  registry: {
    getAllAssets: jest.fn(),
  },
  assetToken: {
    balance: jest.fn(),
    getMetadata: jest.fn(),
    decimals: jest.fn(),
  },
  dividend: {
    getDistributionsForAsset: jest.fn(),
    claimable: jest.fn(),
    hasClaimed: jest.fn(),
  },
}));

jest.mock("@/lib/assetCache", () => ({
  getCachedAssetEntries: jest.fn(),
  loadAssetEntries: jest.fn(),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.Mock;

function makeAsset(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: BigInt(1),
    tokenContract: "TOKEN_A",
    issuer: "GISSUER",
    name: "Asset A",
    assetType: "real_estate",
    valuation: BigInt(100_000_00),
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    name: "Asset A",
    symbol: "ASA",
    assetType: "real_estate",
    totalSupply: BigInt(1000),
    decimals: 7,
    admin: "GADMIN",
    complianceContract: "COMP_A",
    assetDescription: "Test asset",
    valuation: BigInt(100_000_00),
    paused: false,
    ...overrides,
  };
}

function makeDistribution(overrides: Partial<Distribution> = {}): Distribution {
  return {
    id: BigInt(1),
    assetToken: "TOKEN_A",
    paymentToken: "TOKEN_B",
    totalAmount: BigInt(500),
    distributed: BigInt(0),
    createdAt: 1000,
    completed: false,
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("usePortfolio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCachedAssetEntries as jest.Mock).mockReturnValue(null);
    (loadAssetEntries as jest.Mock).mockResolvedValue([]);
    mockUseWallet.mockReturnValue({ network: "testnet", address: "GUSER123" });
    (assetToken.decimals as jest.Mock).mockResolvedValue(7);
  });

  it("returns empty portfolio when wallet is disconnected", async () => {
    mockUseWallet.mockReturnValue({ network: "testnet", address: null });

    const { result } = renderHook(() => usePortfolio());

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(registry.getAllAssets).not.toHaveBeenCalled();
  });

  it("aggregates holdings across assets and calculates total value and claimables", async () => {
    const asset1 = makeAsset({ id: BigInt(1), tokenContract: "TOKEN_A", valuation: BigInt(10000) });
    const asset2 = makeAsset({ id: BigInt(2), tokenContract: "TOKEN_B", valuation: BigInt(20000) });

    const meta1 = makeMetadata({ totalSupply: BigInt(100) });
    const meta2 = makeMetadata({ totalSupply: BigInt(200) });

    const dist1 = makeDistribution({ id: BigInt(10), assetToken: "TOKEN_A" });

    (getCachedAssetEntries as jest.Mock).mockReturnValue([asset1, asset2]);

    (assetToken.balance as jest.Mock).mockImplementation((_net, token) => {
      if (token === "TOKEN_A") return Promise.resolve(50n); // 50% of supply -> 5000
      if (token === "TOKEN_B") return Promise.resolve(50n); // 25% of supply -> 5000
      return Promise.resolve(0n);
    });

    (assetToken.getMetadata as jest.Mock).mockImplementation((_net, token) => {
      if (token === "TOKEN_A") return Promise.resolve(meta1);
      if (token === "TOKEN_B") return Promise.resolve(meta2);
      return Promise.reject(new Error("Unknown token"));
    });

    (dividend.getDistributionsForAsset as jest.Mock).mockImplementation((_net, token) => {
      if (token === "TOKEN_A") return Promise.resolve([dist1]);
      return Promise.resolve([]);
    });

    (dividend.claimable as jest.Mock).mockResolvedValue(150n);
    (dividend.hasClaimed as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.holdings).toHaveLength(2);
    expect(result.current.data?.totalValueCents).toBe(10000n);
    expect(result.current.data?.totalClaimable).toEqual([
      { paymentToken: "TOKEN_B", decimals: 7, amount: 150n },
    ]);
  });

  it("keeps claimable amounts from different payment tokens in separate decimal scales", async () => {
    const asset = makeAsset({ tokenContract: "TOKEN_A" });
    const first = makeDistribution({ id: 1n, paymentToken: "PAYMENT_2" });
    const second = makeDistribution({ id: 2n, paymentToken: "PAYMENT_7" });
    (getCachedAssetEntries as jest.Mock).mockReturnValue([asset]);
    (assetToken.balance as jest.Mock).mockResolvedValue(100n);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(makeMetadata({ totalSupply: 100n }));
    (dividend.getDistributionsForAsset as jest.Mock).mockResolvedValue([first, second]);
    (dividend.claimable as jest.Mock).mockImplementation((_net, id) =>
      Promise.resolve(id === 1n ? 125n : 25_000_000n),
    );
    (dividend.hasClaimed as jest.Mock).mockResolvedValue(false);
    (assetToken.decimals as jest.Mock).mockImplementation((_net, token) =>
      Promise.resolve(token === "PAYMENT_2" ? 2 : 7),
    );

    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.totalClaimable).toEqual([
      { paymentToken: "PAYMENT_2", decimals: 2, amount: 125n },
      { paymentToken: "PAYMENT_7", decimals: 7, amount: 25_000_000n },
    ]);
  });

  it("returns empty holdings when user balance is 0 for all assets", async () => {
    const asset1 = makeAsset({ id: BigInt(1), tokenContract: "TOKEN_A" });
    (getCachedAssetEntries as jest.Mock).mockReturnValue([asset1]);
    (assetToken.balance as jest.Mock).mockResolvedValue(0n);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(makeMetadata());

    const { result } = renderHook(() => usePortfolio());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({
      holdings: [],
      totalValueCents: 0n,
      totalClaimable: [],
      failedAssetCount: 0,
      isIncomplete: false,
    });
  });

  it("uses the shared loader when there is no cached asset list", async () => {
    const asset = makeAsset();
    (loadAssetEntries as jest.Mock).mockResolvedValue([asset]);
    (assetToken.balance as jest.Mock).mockResolvedValue(0n);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(makeMetadata());

    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(loadAssetEntries).toHaveBeenCalledWith("testnet");
    expect(registry.getAllAssets).not.toHaveBeenCalled();
  });

  it("keeps healthy holdings when one asset balance read fails", async () => {
    const failingAsset = makeAsset({ id: 1n, tokenContract: "TOKEN_FAIL" });
    const healthyAsset = makeAsset({ id: 2n, tokenContract: "TOKEN_HEALTHY" });
    (getCachedAssetEntries as jest.Mock).mockReturnValue([failingAsset, healthyAsset]);
    (assetToken.balance as jest.Mock).mockImplementation((_network, token) =>
      token === "TOKEN_FAIL"
        ? Promise.reject(new Error("Token unavailable"))
        : Promise.resolve(50n),
    );
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(
      makeMetadata({ totalSupply: 100n }),
    );
    (dividend.getDistributionsForAsset as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.holdings.map(({ asset }) => asset.tokenContract)).toEqual([
      "TOKEN_HEALTHY",
    ]);
    expect(result.current.data?.failedAssetCount).toBe(1);
    expect(result.current.data?.isIncomplete).toBe(true);
  });

  it("excludes inactive cached assets from holdings and totals", async () => {
    const activeAsset = makeAsset({ id: 1n, tokenContract: "TOKEN_ACTIVE", valuation: 1000n });
    const inactiveAsset = makeAsset({
      id: 2n,
      tokenContract: "TOKEN_INACTIVE",
      active: false,
      valuation: 10_000n,
    });
    (getCachedAssetEntries as jest.Mock).mockReturnValue([activeAsset, inactiveAsset]);
    (assetToken.balance as jest.Mock).mockResolvedValue(100n);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue(
      makeMetadata({ totalSupply: 100n }),
    );
    (dividend.getDistributionsForAsset as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.holdings.map(({ asset }) => asset.tokenContract)).toEqual([
      "TOKEN_ACTIVE",
    ]);
    expect(assetToken.balance).toHaveBeenCalledTimes(1);
    expect(result.current.data?.totalValueCents).toBe(1000n);
  });
});
