/**
 * Unit tests for lib/assetCache.ts
 *
 * Scenarios covered:
 *
 * cacheAssetEntries / getCachedAsset
 *   - Returns null before any entry is cached
 *   - Returns the matching entry after caching
 *   - Replacing a network's map does not affect other networks
 *   - cacheAssetEntries replaces (not merges) the map for a network
 *
 * prefetchAssetMetadata
 *   - Calls the factory exactly once within the TTL window (dedup)
 *   - Returns a fresh promise after the TTL expires
 *   - Evicts the entry on rejection so the next call retries
 *   - Concurrent callers share the same in-flight promise
 *
 * takePrefetchedAssetMetadata
 *   - Returns the cached promise and removes it (one-shot)
 *   - Returns null when nothing is cached for the key
 *   - Returns null after the TTL has expired
 */

import {
  cacheAssetEntries,
  getCachedAsset,
  prefetchAssetMetadata,
  takePrefetchedAssetMetadata,
} from "../assetCache";
import { assetToken } from "@/lib/contracts";
import type { AssetEntry, AssetMetadata } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: jest.fn(),
  },
}));

const mockGetMetadata = assetToken.getMetadata as jest.Mock;

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: BigInt(1),
    tokenContract: "CTOKEN_A",
    issuer: "GISSUER",
    name: "Test Asset",
    assetType: "real_estate",
    valuation: BigInt(500_000_00),
    createdAt: 1000,
    active: true,
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    name: "Test Asset",
    symbol: "TST",
    assetType: "real_estate",
    totalSupply: BigInt(1_000_000),
    decimals: 7,
    admin: "GADMIN",
    complianceContract: "COMPLIANCE",
    assetDescription: "A test asset",
    valuation: BigInt(500_000_00),
    paused: false,
    ...overrides,
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Reset the module-level Maps between tests by re-importing the module with
 * a fresh registry.  We use jest.resetModules() so the module-level Maps are
 * recreated on each import.
 */

// ─── tests ────────────────────────────────────────────────────────────────────

describe("cacheAssetEntries / getCachedAsset", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMetadata.mockReset();
    // Seed an empty map for testnet and mainnet to start clean
    cacheAssetEntries("testnet", []);
    cacheAssetEntries("mainnet", []);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null before any entry has been cached for a network", () => {
    expect(getCachedAsset("testnet", BigInt(99))).toBeNull();
  });

  it("returns the matching entry after caching", () => {
    const entry = makeEntry({ id: BigInt(1) });
    cacheAssetEntries("testnet", [entry]);
    expect(getCachedAsset("testnet", BigInt(1))).toEqual(entry);
  });

  it("returns null for an id not in the cached list", () => {
    const entry = makeEntry({ id: BigInt(1) });
    cacheAssetEntries("testnet", [entry]);
    expect(getCachedAsset("testnet", BigInt(2))).toBeNull();
  });

  it("cacheAssetEntries replaces (not merges) the network map", () => {
    const entryA = makeEntry({ id: BigInt(1), name: "Asset A" });
    const entryB = makeEntry({ id: BigInt(2), name: "Asset B" });
    cacheAssetEntries("testnet", [entryA]);
    // Replace with a map that only contains entryB; entryA should be gone
    cacheAssetEntries("testnet", [entryB]);
    expect(getCachedAsset("testnet", BigInt(1))).toBeNull();
    expect(getCachedAsset("testnet", BigInt(2))).toEqual(entryB);
  });

  it("caching for one network does not affect another network", () => {
    const testnetEntry = makeEntry({ id: BigInt(1), name: "Testnet Asset" });
    const mainnetEntry = makeEntry({ id: BigInt(1), name: "Mainnet Asset" });
    cacheAssetEntries("testnet", [testnetEntry]);
    cacheAssetEntries("mainnet", [mainnetEntry]);
    expect(getCachedAsset("testnet", BigInt(1))?.name).toBe("Testnet Asset");
    expect(getCachedAsset("mainnet", BigInt(1))?.name).toBe("Mainnet Asset");
  });
});

describe("prefetchAssetMetadata", () => {
  const TOKEN = "CTOKEN_PREFETCH";

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMetadata.mockReset();
    // Consume any prior cached entry so each test starts fresh
    takePrefetchedAssetMetadata("testnet", TOKEN);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls getMetadata once and returns the same promise on repeated calls within TTL", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    const p1 = prefetchAssetMetadata("testnet", TOKEN);
    const p2 = prefetchAssetMetadata("testnet", TOKEN);

    expect(p1).toBe(p2);
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
    await expect(p1).resolves.toEqual(metadata);
  });

  it("makes a fresh call after the 15 s TTL expires", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    const p1 = prefetchAssetMetadata("testnet", TOKEN);
    await p1;

    // Consume the entry so it leaves the prefetch map (simulating take)
    takePrefetchedAssetMetadata("testnet", TOKEN);

    // Advance time past the 15 s TTL
    jest.advanceTimersByTime(15_001);

    mockGetMetadata.mockResolvedValue({ ...metadata, name: "Fresh" });
    const p2 = prefetchAssetMetadata("testnet", TOKEN);

    expect(p2).not.toBe(p1);
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toMatchObject({ name: "Fresh" });
  });

  it("evicts the entry on rejection so the next call retries", async () => {
    const err = new Error("RPC down");
    mockGetMetadata.mockRejectedValueOnce(err);

    const p1 = prefetchAssetMetadata("testnet", TOKEN);
    // Wait for the rejection handler to run
    await expect(p1).rejects.toThrow("RPC down");

    // Allow microtasks / promise chains to flush
    await Promise.resolve();

    // After rejection the entry must be gone; a new call should invoke factory again
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);
    const p2 = prefetchAssetMetadata("testnet", TOKEN);
    expect(p2).not.toBe(p1);
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toEqual(metadata);
  });

  it("concurrent callers all receive the same in-flight promise", () => {
    mockGetMetadata.mockReturnValue(new Promise(() => {})); // never resolves

    const calls = [
      prefetchAssetMetadata("testnet", TOKEN),
      prefetchAssetMetadata("testnet", TOKEN),
      prefetchAssetMetadata("testnet", TOKEN),
    ];

    expect(calls[0]).toBe(calls[1]);
    expect(calls[1]).toBe(calls[2]);
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
  });

  it("uses separate cache entries for different (network, contract) keys", async () => {
    const metaA = makeMetadata({ name: "A" });
    const metaB = makeMetadata({ name: "B" });
    mockGetMetadata
      .mockResolvedValueOnce(metaA)
      .mockResolvedValueOnce(metaB);

    const pA = prefetchAssetMetadata("testnet", "TOKEN_A");
    const pB = prefetchAssetMetadata("testnet", "TOKEN_B");

    expect(pA).not.toBe(pB);
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);

    await expect(pA).resolves.toMatchObject({ name: "A" });
    await expect(pB).resolves.toMatchObject({ name: "B" });

    // Clean up
    takePrefetchedAssetMetadata("testnet", "TOKEN_A");
    takePrefetchedAssetMetadata("testnet", "TOKEN_B");
  });
});

describe("takePrefetchedAssetMetadata", () => {
  const TOKEN = "CTOKEN_TAKE";

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMetadata.mockReset();
    // Drain any leftover entry
    takePrefetchedAssetMetadata("testnet", TOKEN);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when nothing is cached", () => {
    expect(takePrefetchedAssetMetadata("testnet", TOKEN)).toBeNull();
  });

  it("returns the cached promise and removes it (one-shot semantics)", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    const prefetched = prefetchAssetMetadata("testnet", TOKEN);
    const taken = takePrefetchedAssetMetadata("testnet", TOKEN);

    expect(taken).toBe(prefetched);
    await expect(taken).resolves.toEqual(metadata);

    // Second take must return null — it's been removed
    expect(takePrefetchedAssetMetadata("testnet", TOKEN)).toBeNull();
  });

  it("returns null after the TTL has expired", async () => {
    const metadata = makeMetadata();
    mockGetMetadata.mockResolvedValue(metadata);

    prefetchAssetMetadata("testnet", TOKEN);
    await Promise.resolve(); // let promise settle

    // Advance time past the 15 s TTL without consuming it
    jest.advanceTimersByTime(15_001);

    const taken = takePrefetchedAssetMetadata("testnet", TOKEN);
    expect(taken).toBeNull();
  });
});
