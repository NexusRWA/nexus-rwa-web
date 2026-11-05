// ---------------------------------------------------------------------------
// Issue #255 — RPC failover logic
// ---------------------------------------------------------------------------
//
// NETWORKS (and the server cache keyed off it) is built once at module load
// from NEXT_PUBLIC_* env vars, so each test re-imports lib/stellar with the
// env it needs. Without that, every test shares one cache and the suite
// becomes order-dependent.
//
// Failover is also a no-op when only one URL is configured
// (`cfg.rpcUrls.length <= 1`), so these tests supply fallbacks explicitly.

const PRIMARY = "https://rpc-primary.test";
const FALLBACKS = "https://rpc-second.test,https://rpc-third.test";

function loadStellar(rpcUrls = { primary: PRIMARY, fallbacks: FALLBACKS }) {
  jest.resetModules();
  process.env.NEXT_PUBLIC_TESTNET_RPC_URL = rpcUrls.primary;
  process.env.NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK = rpcUrls.fallbacks;
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL = rpcUrls.primary;
  process.env.NEXT_PUBLIC_MAINNET_RPC_URLS_FALLBACK = rpcUrls.fallbacks;
  return require("@/lib/stellar") as typeof import("@/lib/stellar");
}

/** Report `n` failures, the unit that drives the failover counter. */
function fail(
  stellar: ReturnType<typeof loadStellar>,
  network: "testnet" | "mainnet",
  n: number,
) {
  for (let i = 0; i < n; i++) stellar.reportServerFailure(network);
}

describe("RPC failover logic", () => {
  describe("FAILOVER_THRESHOLD boundary", () => {
    it("does NOT advance to next URL after fewer than FAILOVER_THRESHOLD (3) failures", () => {
      const stellar = loadStellar();
      const before = stellar.getServer("testnet");

      fail(stellar, "testnet", 2);

      expect(stellar.getServer("testnet")).toBe(before);
    });

    it("advances to next URL after exactly FAILOVER_THRESHOLD (3) consecutive failures", () => {
      const stellar = loadStellar();
      const before = stellar.getServer("testnet");

      fail(stellar, "testnet", 3);

      expect(stellar.getServer("testnet")).not.toBe(before);
    });

    it("does NOT advance when only a single RPC URL is configured", () => {
      // NETWORKS always appends one hard-coded URL, so clearing both env vars
      // is what leaves exactly one entry in the list.
      const stellar = loadStellar({ primary: "", fallbacks: "" });
      const before = stellar.getServer("testnet");

      fail(stellar, "testnet", 6);

      expect(stellar.getServer("testnet")).toBe(before);
    });
  });

  describe("wraparound behavior", () => {
    it("uses modulo wraparound to return to index 0 after the last URL", () => {
      const stellar = loadStellar();
      const first = stellar.getServer("testnet");

      // Four URLs are configured here: the primary, two fallbacks, and the
      // hard-coded one NETWORKS always appends. Each advance costs three
      // failures, so a full cycle is four advances.
      const URL_COUNT = 4;
      for (let advance = 1; advance < URL_COUNT; advance++) {
        fail(stellar, "testnet", 3);
        expect(stellar.getServer("testnet").serverURL.toString()).not.toBe(
          first.serverURL.toString(),
        );
      }

      // Wrapping rebuilds the client, so identity is not a useful signal —
      // the URL is what must come back around.
      fail(stellar, "testnet", 3);
      expect(stellar.getServer("testnet").serverURL.toString()).toBe(
        first.serverURL.toString(),
      );
    });
  });

  describe("counter behavior", () => {
    it("does not reset the failure counter except when advancing", () => {
      const stellar = loadStellar();
      const before = stellar.getServer("testnet");

      // The counter is not reset by intervening successes, so the third
      // failure still trips the threshold.
      fail(stellar, "testnet", 2);
      expect(stellar.getServer("testnet")).toBe(before);

      fail(stellar, "testnet", 1);
      expect(stellar.getServer("testnet")).not.toBe(before);
    });

    it("resets the counter to 0 when advancing to the next URL", () => {
      const stellar = loadStellar();

      fail(stellar, "testnet", 3);
      const advanced = stellar.getServer("testnet");

      // Two more failures is below the threshold measured from the reset.
      fail(stellar, "testnet", 2);
      expect(stellar.getServer("testnet")).toBe(advanced);

      fail(stellar, "testnet", 1);
      expect(stellar.getServer("testnet")).not.toBe(advanced);
    });
  });

  describe("per-network isolation", () => {
    it("maintains separate failure counters per network", () => {
      const stellar = loadStellar();
      const testnetBefore = stellar.getServer("testnet");
      const mainnetBefore = stellar.getServer("mainnet");

      fail(stellar, "testnet", 3);

      expect(stellar.getServer("testnet")).not.toBe(testnetBefore);
      expect(stellar.getServer("mainnet")).toBe(mainnetBefore);
    });
  });
});
