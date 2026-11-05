import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "../useWallet";
import {
  connect as fConnect,
  getConnectedAddress,
  getWalletNetwork,
  isFreighterInstalled,
} from "@/lib/freighter";

jest.mock("@/lib/freighter", () => ({
  isFreighterInstalled: jest.fn(),
  getConnectedAddress: jest.fn(),
  getWalletNetwork: jest.fn(),
  connect: jest.fn(),
  signTx: jest.fn(),
  watchWallet: jest.fn(() => () => {}),
}));

describe("useWallet", () => {
  const STORAGE_KEY = "rwa.wallet.connected";

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("throws error when used outside WalletProvider", () => {
    // Suppress console error for expected throw
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used within a WalletProvider",
    );
    spy.mockRestore();
  });

  it("initializes with default disconnected state when no session stored", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(false);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.address).toBeNull();
    expect(result.current.connecting).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it("restores session on mount ONLY when account is still authorized", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (getConnectedAddress as jest.Mock).mockResolvedValue("GAUTHORIZED123");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(result.current.address).toBe("GAUTHORIZED123"));

    expect(result.current.installed).toBe(true);
    expect(result.current.network).toBe("testnet");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("clears storage key and does NOT restore address when account is unauthorized / revoked", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    // getConnectedAddress returns null because access was revoked in wallet extension
    (getConnectedAddress as jest.Mock).mockResolvedValue(null);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(isFreighterInstalled).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());

    expect(result.current.address).toBeNull();
  });

  it("clears state and local storage on disconnect", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (getConnectedAddress as jest.Mock).mockResolvedValue("GCONNECTED123");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(result.current.address).toBe("GCONNECTED123"));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.walletNetwork).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("connects wallet successfully and sets storage key", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (fConnect as jest.Mock).mockResolvedValue("GNEWLYCONNECTED");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe("GNEWLYCONNECTED");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});

/**
 * #520 — blocked / unavailable localStorage.
 *
 * Some browsers and embeds make every `Storage.prototype` member throw a
 * `SecurityError` (private browsing, site data blocked, sandboxed iframes).
 * The wallet must keep working: the persisted flag is only a convenience used
 * to probe for a prior session on mount.
 */
describe("useWallet with blocked localStorage (#520)", () => {
  const STORAGE_KEY = "rwa.wallet.connected";
  const SecurityError = () => new Error("SecurityError: storage is blocked");

  let getSpy: jest.SpyInstance;
  let setSpy: jest.SpyInstance;
  let removeSpy: jest.SpyInstance;
  const rejections: unknown[] = [];
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    rejections.length = 0;
    onUnhandled = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onUnhandled);

    getSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw SecurityError();
    });
    setSpy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw SecurityError();
    });
    removeSpy = jest
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw SecurityError();
      });
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    getSpy.mockRestore();
    setSpy.mockRestore();
    removeSpy.mockRestore();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WalletProvider>{children}</WalletProvider>
  );

  it("connect() resolves, sets the address and leaves error null", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (fConnect as jest.Mock).mockResolvedValue("GNEWLYCONNECTED");
    (getWalletNetwork as jest.Mock).mockResolvedValue("testnet");

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await expect(result.current.connect()).resolves.toBeUndefined();
    });

    expect(result.current.address).toBe("GNEWLYCONNECTED");
    expect(result.current.error).toBeNull();
    expect(result.current.connecting).toBe(false);
  });

  it("mounts without an unhandled rejection and without restoring a session", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(true);
    (getConnectedAddress as jest.Mock).mockResolvedValue("GSTORED");

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(result.current.installed).toBe(true));
    // Storage is unreadable, so we must not probe for or restore a session.
    await act(async () => {
      await Promise.resolve();
    });

    expect(getConnectedAddress).not.toHaveBeenCalled();
    expect(result.current.address).toBeNull();
    expect(rejections).toEqual([]);
  });

  it("disconnect() clears state and never throws", async () => {
    (isFreighterInstalled as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useWallet(), { wrapper });

    act(() => {
      expect(() => result.current.disconnect()).not.toThrow();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.walletNetwork).toBeNull();
  });
});
