import { act, renderHook, waitFor } from "@testing-library/react";
import { useHolderTotals } from "../useHolderTotals";
import { assetToken, compliance } from "@/lib/contracts";
import { api } from "@/lib/api";
import type { AssetEntry } from "@/types";

/** AssetEntry fixture; these tests only vary id, tokenContract and issuer. */
function makeAsset(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: 1n,
    tokenContract: "T1",
    issuer: "G1",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: 0n,
    createdAt: 0,
    active: true,
    ...overrides,
  };
}


jest.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: jest.fn(),
  },
  compliance: {
    getAllowlist: jest.fn(),
  },
}));

jest.mock("@/lib/api", () => ({
  api: {
    getStats: jest.fn(),
  },
}));

let mockNetwork = "testnet";
jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockNetwork }),
}));

describe("useHolderTotals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = "testnet";
  });

  it("returns null when assets is null, and 0 for an empty array", async () => {
    const { result: res1 } = renderHook(() => useHolderTotals(null));
    expect(res1.current.data).toBeNull();
    expect(res1.current.loading).toBe(false);

    const { result: res2 } = renderHook(() => useHolderTotals([]));
    await waitFor(() => expect(res2.current.loading).toBe(false));
    expect(res2.current.data).toBe(0);
  });

  it("returns totalHolders from api.getStats when stats are available", async () => {
    (api.getStats as jest.Mock).mockResolvedValue({ totalHolders: 42 });

    const dummyAsset = makeAsset({ id: 1n, tokenContract: "T1", issuer: "G1" });

    const { result } = renderHook(() => useHolderTotals([dummyAsset]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.getStats).toHaveBeenCalled();
    expect(result.current.data).toBe(42);
    expect(assetToken.getMetadata).not.toHaveBeenCalled();
  });

  it("deduplicates compliance contract reads across assets and counts unique holders when api stats are null", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);

    const assets: AssetEntry[] = [
      makeAsset({ id: 1n, tokenContract: "T1", issuer: "G1" }),
      makeAsset({ id: 2n, tokenContract: "T2", issuer: "G1" }),
      makeAsset({ id: 3n, tokenContract: "T3", issuer: "G2" }),
    ];

    // T1 and T2 share compliance contract C1, while T3 uses compliance contract C2
    (assetToken.getMetadata as jest.Mock).mockImplementation(async (_net, tokenContract) => {
      if (tokenContract === "T1" || tokenContract === "T2") {
        return { complianceContract: "C1" };
      }
      return { complianceContract: "C2" };
    });

    (compliance.getAllowlist as jest.Mock).mockImplementation(async (_net, complianceContract) => {
      if (complianceContract === "C1") {
        return ["addr1", "addr2"];
      }
      if (complianceContract === "C2") {
        return ["addr2", "addr3"];
      }
      return [];
    });

    const { result } = renderHook(() => useHolderTotals(assets));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify metadata fetched for all 3 assets
    expect(assetToken.getMetadata).toHaveBeenCalledTimes(3);

    // Assert deduplication: compliance.getAllowlist was called ONLY twice (once for C1, once for C2)
    expect(compliance.getAllowlist).toHaveBeenCalledTimes(2);
    expect(compliance.getAllowlist).toHaveBeenCalledWith("testnet", "C1");
    expect(compliance.getAllowlist).toHaveBeenCalledWith("testnet", "C2");

    // Total unique addresses: addr1, addr2, addr3 = 3
    expect(result.current.data).toBe(3);
  });

  it("handles contract read failure gracefully", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (assetToken.getMetadata as jest.Mock).mockRejectedValue(new Error("Failed to read metadata"));

    const assets: AssetEntry[] = [
      makeAsset({ id: 1n, tokenContract: "T1", issuer: "G1" }),
    ];

    const { result } = renderHook(() => useHolderTotals(assets));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to read metadata");
    expect(result.current.data).toBeNull();
  });

  it("returns 0 without any network call for an empty asset list", async () => {
    const { result } = renderHook(() => useHolderTotals([]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Deliberate: no assets means no holders, so we skip the API and RPC reads.
    expect(result.current.data).toBe(0);
    expect(result.current.error).toBeNull();
    expect(api.getStats).not.toHaveBeenCalled();
    expect(assetToken.getMetadata).not.toHaveBeenCalled();
    expect(compliance.getAllowlist).not.toHaveBeenCalled();
  });

  it("returns 0 when the allowlists are empty", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue({ complianceContract: "C1" });
    (compliance.getAllowlist as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useHolderTotals([makeAsset()]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("re-runs the loader when an asset keeps its id but changes tokenContract", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (assetToken.getMetadata as jest.Mock).mockImplementation(async (_net, tokenContract) => ({
      complianceContract: `C-${tokenContract}`,
    }));
    (compliance.getAllowlist as jest.Mock).mockImplementation(async (_net, c) =>
      c === "C-T1" ? ["a"] : ["a", "b"],
    );

    const { result, rerender } = renderHook(
      ({ assets }) => useHolderTotals(assets),
      { initialProps: { assets: [makeAsset({ id: 1n, tokenContract: "T1" })] } },
    );
    await waitFor(() => expect(result.current.data).toBe(1));

    rerender({ assets: [makeAsset({ id: 1n, tokenContract: "T2" })] });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(assetToken.getMetadata).toHaveBeenLastCalledWith("testnet", "T2");
  });

  it("does not warn or throw when unmounted during an in-flight call", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    let resolveStats: (v: unknown) => void = () => {};
    (api.getStats as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useHolderTotals([makeAsset()]));
    expect(result.current.loading).toBe(true);

    unmount();
    await act(async () => {
      resolveStats({ totalHolders: 7 });
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not expose previous-network data after switching networks", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue({ complianceContract: "C1" });
    (compliance.getAllowlist as jest.Mock).mockImplementation(async (net) =>
      net === "testnet" ? ["a", "b"] : ["a", "b", "c", "d", "e"],
    );
    const assets = [makeAsset()];

    const { result, rerender } = renderHook(() => useHolderTotals(assets));
    await waitFor(() => expect(result.current.data).toBe(2));

    mockNetwork = "mainnet";
    rerender();

    // Testnet data must be dropped immediately, never shown for mainnet.
    expect(result.current.data).not.toBe(2);
    await waitFor(() => expect(result.current.data).toBe(5));
    expect(compliance.getAllowlist).toHaveBeenLastCalledWith("mainnet", "C1");
  });

  it("ignores an in-flight testnet response that resolves after switching to mainnet", async () => {
    (api.getStats as jest.Mock).mockResolvedValue(null);
    (assetToken.getMetadata as jest.Mock).mockResolvedValue({ complianceContract: "C1" });
    let resolveTestnet: (v: string[]) => void = () => {};
    (compliance.getAllowlist as jest.Mock).mockImplementation((net) =>
      net === "testnet"
        ? new Promise<string[]>((resolve) => {
            resolveTestnet = resolve;
          })
        : Promise.resolve(["x", "y", "z"]),
    );
    const assets = [makeAsset()];

    const { result, rerender } = renderHook(() => useHolderTotals(assets));
    await waitFor(() => expect(compliance.getAllowlist).toHaveBeenCalledWith("testnet", "C1"));

    mockNetwork = "mainnet";
    rerender();
    await waitFor(() => expect(result.current.data).toBe(3));

    await act(async () => {
      resolveTestnet(["a"]);
    });
    expect(result.current.data).toBe(3);
  });
});
