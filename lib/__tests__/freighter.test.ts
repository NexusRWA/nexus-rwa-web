/**
 * Tests for lib/freighter.ts
 *
 * Strategy: mock @stellar/freighter-api so no real extension or browser API
 * is needed, and mock @stellar/stellar-sdk/Networks so passphrase comparisons
 * use known constants. Each exported function is tested for both its success
 * shape and its { ..., error } normalisation path.
 *
 * Scenarios covered:
 *   - isFreighterInstalled: installed, not installed, API throws
 *   - isAppAllowed: allowed, not allowed, API throws
 *   - connect: success, error shape, no address, not installed
 *   - getConnectedAddress: success, error shape, not allowed, API throws
 *   - getWalletNetwork: mainnet passphrase, testnet passphrase,
 *                       unknown passphrase with PUBLIC label,
 *                       unknown passphrase with other label,
 *                       error shape, API throws
 *   - signTx: success, error shape, no signedTxXdr
 *   - watchWallet: watcher started, unsubscribe calls stop, constructor throws
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference the modules
// ---------------------------------------------------------------------------

const mockIsConnected = jest.fn();
const mockIsAllowed = jest.fn();
const mockRequestAccess = jest.fn();
const mockGetAddress = jest.fn();
const mockGetNetwork = jest.fn();
const mockSignTransaction = jest.fn();
const mockWatcherWatch = jest.fn();
const mockWatcherStop = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
  isAllowed: (...args: unknown[]) => mockIsAllowed(...args),
  requestAccess: (...args: unknown[]) => mockRequestAccess(...args),
  getAddress: (...args: unknown[]) => mockGetAddress(...args),
  getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
  WatchWalletChanges: jest.fn().mockImplementation(() => ({
    watch: mockWatcherWatch,
    stop: mockWatcherStop,
  })),
}));

jest.mock("@stellar/stellar-sdk", () => ({
  Networks: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015",
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  WalletError,
  LockedWalletError,
  UserRejectedError,
  normalizeFreighterError,
  isFreighterInstalled,
  isAppAllowed,
  connect,
  getConnectedAddress,
  getWalletNetwork,
  signTx,
  watchWallet,
  DEFAULT_WATCH_INTERVAL_MS,
} from "@/lib/freighter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

// ---------------------------------------------------------------------------
// Issue #386 — isFreighterInstalled
// ---------------------------------------------------------------------------

describe("isFreighterInstalled", () => {
  beforeEach(() => mockIsConnected.mockReset());

  it("returns true when isConnected resolves with { isConnected: true }", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    await expect(isFreighterInstalled()).resolves.toBe(true);
  });

  it("returns false when isConnected resolves with { isConnected: false }", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    await expect(isFreighterInstalled()).resolves.toBe(false);
  });

  it("returns false when isConnected resolves with null (extension absent)", async () => {
    mockIsConnected.mockResolvedValue(null);
    await expect(isFreighterInstalled()).resolves.toBe(false);
  });

  it("returns false when isConnected throws (defensive catch)", async () => {
    mockIsConnected.mockRejectedValue(new Error("Extension not found"));
    await expect(isFreighterInstalled()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — isAppAllowed
// ---------------------------------------------------------------------------

describe("isAppAllowed", () => {
  beforeEach(() => mockIsAllowed.mockReset());

  it("returns true when isAllowed resolves with { isAllowed: true }", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    await expect(isAppAllowed()).resolves.toBe(true);
  });

  it("returns false when isAllowed resolves with { isAllowed: false }", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: false });
    await expect(isAppAllowed()).resolves.toBe(false);
  });

  it("returns false when isAllowed throws (defensive catch)", async () => {
    mockIsAllowed.mockRejectedValue(new Error("Timeout"));
    await expect(isAppAllowed()).resolves.toBe(false);
  });
});

describe("normalizeFreighterError", () => {
  it("preserves the message and code from FreighterApiError objects", () => {
    expect(normalizeFreighterError({ code: 4001, message: "User denied" })).toEqual({
      message: "User denied",
      code: 4001,
    });
  });

  it("normalizes objects without a code and Error instances", () => {
    expect(normalizeFreighterError({ message: "Wallet locked" })).toEqual({
      message: "Wallet locked",
    });
    expect(normalizeFreighterError(new Error("Simulation failed"))).toEqual({
      message: "Simulation failed",
    });
  });

  it("preserves strings and never stringifies an unknown object", () => {
    expect(normalizeFreighterError("User denied")).toEqual({
      message: "User denied",
    });
    expect(normalizeFreighterError({})).toEqual({
      message: "Freighter returned an unknown error.",
    });
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — connect
// ---------------------------------------------------------------------------

describe("connect", () => {
  beforeEach(() => {
    mockIsConnected.mockReset();
    mockRequestAccess.mockReset();
  });

  it("returns the address on success", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockRequestAccess.mockResolvedValue({ address: "GABCDEF", error: null });
    await expect(connect()).resolves.toBe("GABCDEF");
  });

  it("throws WalletError when Freighter is not installed", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    await expect(connect()).rejects.toThrow(WalletError);
    await expect(connect()).rejects.toThrow(/not detected/i);
  });

  it("throws WalletError when requestAccess returns an error shape", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockRequestAccess.mockResolvedValue({
      error: { code: 4001, message: "User rejected" },
    });
    await expect(connect()).rejects.toThrow(WalletError);
    await expect(connect()).rejects.toThrow("User rejected");
  });

  it("throws WalletError when requestAccess returns no address", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockRequestAccess.mockResolvedValue({ address: "", error: null });
    await expect(connect()).rejects.toThrow(WalletError);
    await expect(connect()).rejects.toThrow(/no account returned/i);
  });

  it("the thrown error is an instance of WalletError (not a plain Error)", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    const err = await connect().catch((e) => e);
    expect(err).toBeInstanceOf(WalletError);
    expect(err.name).toBe("WalletError");
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — getConnectedAddress
// ---------------------------------------------------------------------------

describe("getConnectedAddress", () => {
  beforeEach(() => {
    mockIsAllowed.mockReset();
    mockGetAddress.mockReset();
  });

  it("returns the address when allowed and getAddress succeeds", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ address: "GTEST123", error: null });
    await expect(getConnectedAddress()).resolves.toBe("GTEST123");
  });

  it("returns null when the app is not allowed (no popup triggered)", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: false });
    await expect(getConnectedAddress()).resolves.toBeNull();
    expect(mockGetAddress).not.toHaveBeenCalled();
  });

  it("returns null when getAddress returns an error shape", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ error: "Wallet locked", address: null });
    await expect(getConnectedAddress()).resolves.toBeNull();
  });

  it("returns null when getAddress returns an empty address", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({ error: null, address: "" });
    await expect(getConnectedAddress()).resolves.toBeNull();
  });

  it("returns null when getAddress throws (defensive catch)", async () => {
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockRejectedValue(new Error("Extension crashed"));
    await expect(getConnectedAddress()).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — getWalletNetwork (network translation)
// ---------------------------------------------------------------------------

describe("getWalletNetwork", () => {
  beforeEach(() => mockGetNetwork.mockReset());

  it("returns 'mainnet' when networkPassphrase matches PUBLIC", async () => {
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: MAINNET_PASSPHRASE,
      network: "PUBLIC",
      error: null,
    });
    await expect(getWalletNetwork()).resolves.toBe("mainnet");
  });

  it("returns 'testnet' when networkPassphrase matches TESTNET", async () => {
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: TESTNET_PASSPHRASE,
      network: "TESTNET",
      error: null,
    });
    await expect(getWalletNetwork()).resolves.toBe("testnet");
  });

  it("falls back to 'mainnet' for an unknown passphrase when network label is 'PUBLIC'", async () => {
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: "Some custom network",
      network: "public",   // case-insensitive match
      error: null,
    });
    await expect(getWalletNetwork()).resolves.toBe("mainnet");
  });

  it("falls back to 'testnet' for an unknown passphrase with any non-PUBLIC label", async () => {
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: "Futurenet ; April 2023",
      network: "FUTURENET",
      error: null,
    });
    await expect(getWalletNetwork()).resolves.toBe("testnet");
  });

  it("falls back to 'testnet' when network label is undefined and passphrase is unknown", async () => {
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: "Unknown passphrase",
      network: undefined,
      error: null,
    });
    await expect(getWalletNetwork()).resolves.toBe("testnet");
  });

  it("returns null when getNetwork returns an error shape", async () => {
    mockGetNetwork.mockResolvedValue({ error: "Not connected" });
    await expect(getWalletNetwork()).resolves.toBeNull();
  });

  it("returns null when getNetwork throws (defensive catch)", async () => {
    mockGetNetwork.mockRejectedValue(new Error("RPC unavailable"));
    await expect(getWalletNetwork()).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — signTx
// ---------------------------------------------------------------------------

describe("signTx", () => {
  beforeEach(() => mockSignTransaction.mockReset());

  it("returns the signed XDR on success", async () => {
    mockSignTransaction.mockResolvedValue({
      signedTxXdr: "SIGNED_XDR_BASE64",
      error: null,
    });
    await expect(
      signTx("UNSIGNED_XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).resolves.toBe("SIGNED_XDR_BASE64");
  });

  it("passes xdrBase64, networkPassphrase and address to the underlying API", async () => {
    mockSignTransaction.mockResolvedValue({
      signedTxXdr: "SIGNED",
      error: null,
    });
    await signTx("MY_XDR", MAINNET_PASSPHRASE, "GMYADDRESS");
    expect(mockSignTransaction).toHaveBeenCalledWith("MY_XDR", {
      networkPassphrase: MAINNET_PASSPHRASE,
      address: "GMYADDRESS",
    });
  });

  it("throws UserRejectedError when signTransaction reports the user declined", async () => {
    mockSignTransaction.mockResolvedValue({
      error: { code: 4001, message: "User denied" },
    });
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toThrow(UserRejectedError);
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toThrow("User denied");
  });

  it("throws WalletError when signTransaction returns an error shape unrelated to rejection or a locked wallet", async () => {
    mockSignTransaction.mockResolvedValue({
      error: { code: 9999, message: "Simulation failed" },
    });
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toThrow(WalletError);
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toThrow("Simulation failed");
  });

  it("throws WalletError when signedTxXdr is missing from the response", async () => {
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "", error: null });
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toThrow(WalletError);
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toThrow(/no signature/i);
  });

  it("the thrown error is a WalletError with the correct name", async () => {
    mockSignTransaction.mockResolvedValue({ error: "Simulation failed" });
    const err = await signTx("XDR", TESTNET_PASSPHRASE, "G").catch((e) => e);
    expect(err).toBeInstanceOf(WalletError);
    expect(err.name).toBe("WalletError");
  });

  it("the thrown error is a UserRejectedError with the correct name when the user rejects", async () => {
    mockSignTransaction.mockResolvedValue({ error: "Rejected" });
    const err = await signTx("XDR", TESTNET_PASSPHRASE, "G").catch((e) => e);
    expect(err).toBeInstanceOf(UserRejectedError);
    expect(err.name).toBe("UserRejectedError");
  });

  it.each([
    "Freighter is locked. Please unlock it.",
    "Please unlock your Freighter wallet",
    "Wallet is not connected",
    "LOCKED: Please try again",
  ])("throws LockedWalletError for %j", async (errorMsg) => {
    mockSignTransaction.mockResolvedValue({ error: errorMsg });
    await expect(
      signTx("XDR", TESTNET_PASSPHRASE, "GTEST"),
    ).rejects.toBeInstanceOf(LockedWalletError);
  });

  it("classifies an object error without a code as a locked wallet", async () => {
    mockSignTransaction.mockResolvedValue({
      error: { message: "Freighter wallet is locked" },
    });
    await expect(signTx("XDR", TESTNET_PASSPHRASE, "GTEST")).rejects.toBeInstanceOf(
      LockedWalletError,
    );
  });

  it("gives app access errors a distinct message", async () => {
    mockSignTransaction.mockResolvedValue({
      error: { code: 1001, message: "This app is not allowed to access your wallet" },
    });
    await expect(signTx("XDR", TESTNET_PASSPHRASE, "GTEST")).rejects.toThrow(
      "Freighter has not granted this app access",
    );
  });

  it("does not classify an unrelated message containing user as a rejection", async () => {
    mockSignTransaction.mockResolvedValue({
      error: { code: 9999, message: "The user profile could not be loaded" },
    });
    await expect(signTx("XDR", TESTNET_PASSPHRASE, "GTEST")).rejects.toBeInstanceOf(
      WalletError,
    );
    await expect(signTx("XDR", TESTNET_PASSPHRASE, "GTEST")).rejects.toThrow(
      "The user profile could not be loaded",
    );
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — watchWallet
// ---------------------------------------------------------------------------

describe("watchWallet", () => {
  const { WatchWalletChanges } = jest.requireMock("@stellar/freighter-api");

  beforeEach(() => {
    WatchWalletChanges.mockClear();
    mockWatcherWatch.mockClear();
    mockWatcherStop.mockClear();
  });

  it("creates a WatchWalletChanges instance with the default interval", () => {
    const onChange = jest.fn();
    watchWallet(onChange);
    expect(WatchWalletChanges).toHaveBeenCalledWith(DEFAULT_WATCH_INTERVAL_MS);
  });

  it("creates a WatchWalletChanges instance with a custom interval", () => {
    const onChange = jest.fn();
    watchWallet(onChange, 2000);
    expect(WatchWalletChanges).toHaveBeenCalledWith(2000);
  });

  it("calls watcher.watch with the provided onChange callback", () => {
    const onChange = jest.fn();
    watchWallet(onChange);
    expect(mockWatcherWatch).toHaveBeenCalledWith(onChange);
  });

  it("returns an unsubscribe function that calls watcher.stop", () => {
    const onChange = jest.fn();
    const unsubscribe = watchWallet(onChange);
    unsubscribe();
    expect(mockWatcherStop).toHaveBeenCalledTimes(1);
  });

  it("returns a no-op unsubscribe function when WatchWalletChanges throws", () => {
    WatchWalletChanges.mockImplementationOnce(() => {
      throw new Error("Extension not available");
    });
    const onChange = jest.fn();
    const unsubscribe = watchWallet(onChange);
    // Should not throw
    expect(() => unsubscribe()).not.toThrow();
    expect(mockWatcherStop).not.toHaveBeenCalled();
  });

  it("DEFAULT_WATCH_INTERVAL_MS is 8000", () => {
    expect(DEFAULT_WATCH_INTERVAL_MS).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// Issue #386 — WalletError class
// ---------------------------------------------------------------------------

describe("WalletError", () => {
  it("is an instance of Error", () => {
    expect(new WalletError("test")).toBeInstanceOf(Error);
  });

  it("has name 'WalletError'", () => {
    expect(new WalletError("test").name).toBe("WalletError");
  });

  it("carries the provided message", () => {
    expect(new WalletError("something went wrong").message).toBe(
      "something went wrong",
    );
  });
});

describe("LockedWalletError", () => {
  it("has correct name and message", () => {
    const error = new LockedWalletError();
    expect(error.name).toBe("LockedWalletError");
    expect(error.message).toContain("locked");
    expect(error.message).toContain("unlock");
  });

  it("is an instance of WalletError", () => {
    expect(new LockedWalletError()).toBeInstanceOf(WalletError);
  });
});
