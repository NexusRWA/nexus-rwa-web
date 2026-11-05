/**
 * Thin, defensive wrapper over @stellar/freighter-api.
 *
 * The Freighter API returns `{ ..., error }` objects rather than throwing; we
 * normalise those into thrown Errors so callers can use plain try/catch, and
 * translate the wallet's network identity into our `Network` union.
 */

import {
  isConnected as fIsConnected,
  isAllowed as fIsAllowed,
  requestAccess as fRequestAccess,
  getAddress as fGetAddress,
  getNetwork as fGetNetwork,
  signTransaction as fSignTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";
import type { Network } from "@/types";

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Thrown when the user explicitly rejects a signing prompt in Freighter.
 * This is distinct from a WalletError (actual failure) and should be handled
 * as a normal, neutral user choice rather than an error.
 */
export class UserRejectedError extends Error {
  constructor(message: string = "User rejected the request") {
    super(message);
    this.name = "UserRejectedError";
  }
}

/** Specialized error for when the Freighter wallet is locked. */
export class LockedWalletError extends WalletError {
  constructor() {
    super(
      "Wallet is locked. Please unlock Freighter and try again.",
    );
    this.name = "LockedWalletError";
  }
}

export function normalizeFreighterError(
  error: unknown,
): { message: string; code?: number } {
  if (typeof error === "string") return { message: error };
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return {
      message: error.message,
      ...(typeof code === "number" ? { code } : {}),
    };
  }
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown };
    return {
      message:
        typeof value.message === "string" && value.message.length > 0
          ? value.message
          : "Freighter returned an unknown error.",
      ...(typeof value.code === "number" ? { code: value.code } : {}),
    };
  }
  return { message: error == null ? "Freighter returned an unknown error." : String(error) };
}

/** Whether the Freighter extension is installed and reachable. */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await fIsConnected();
    return Boolean(res && (res as { isConnected?: boolean }).isConnected);
  } catch {
    return false;
  }
}

/** Whether this app has already been granted access (no popup). */
export async function isAppAllowed(): Promise<boolean> {
  try {
    const res = await fIsAllowed();
    return Boolean(res && (res as { isAllowed?: boolean }).isAllowed);
  } catch {
    return false;
  }
}

/** Prompt the user to connect and return the selected address. */
export async function connect(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new WalletError(
      "Freighter wallet not detected. Install it from freighter.app to continue.",
    );
  }
  const res = await fRequestAccess();
  if (res.error) throw new WalletError(normalizeFreighterError(res.error).message);
  if (!res.address) throw new WalletError("No account returned by Freighter.");
  return res.address;
}

/** Return the currently selected address without prompting, or null. */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    if (!(await isAppAllowed())) return null;
    const res = await fGetAddress();
    if (res.error || !res.address) return null;
    return res.address;
  } catch {
    return null;
  }
}

/** The network Freighter is currently pointed at, mapped to our union. */
export async function getWalletNetwork(): Promise<Network | null> {
  try {
    const res = await fGetNetwork();
    if (res.error) return null;
    if (res.networkPassphrase === Networks.PUBLIC) return "mainnet";
    if (res.networkPassphrase === Networks.TESTNET) return "testnet";
    // Fall back to the coarse label if the passphrase is unfamiliar.
    return res.network?.toUpperCase() === "PUBLIC" ? "mainnet" : "testnet";
  } catch {
    return null;
  }
}

/** Sign a transaction XDR for the given network, returning the signed XDR. */
export async function signTx(
  xdrBase64: string,
  networkPassphrase: string,
  address: string,
): Promise<string> {
  const res = await fSignTransaction(xdrBase64, {
    networkPassphrase,
    address,
  });
  if (res.error) {
    const { message } = normalizeFreighterError(res.error);
    const errorMsg = message.toLowerCase();
    if (
      errorMsg.includes("locked") ||
      errorMsg.includes("unlock") ||
      errorMsg.includes("not connected")
    ) {
      throw new LockedWalletError();
    }
    if (errorMsg.includes("not allowed")) {
      throw new WalletError("Freighter has not granted this app access");
    }
    // Detect user rejection: Freighter uses "rejected" or "user denied".
    if (
      errorMsg.includes("reject") ||
      errorMsg.includes("cancel") ||
      errorMsg.includes("denied")
    ) {
      throw new UserRejectedError(message);
    }
    throw new WalletError(message);
  }
  if (!res.signedTxXdr) throw new WalletError("Freighter returned no signature.");
  return res.signedTxXdr;
}

/**
 * Default poll interval for {@link watchWallet}. Freighter has no
 * push-based change events, so this is a tradeoff between responsiveness and
 * battery/CPU drain from a background timer; the caller also pauses the
 * watcher entirely while the tab is hidden (see hooks/useWallet.tsx).
 */
export const DEFAULT_WATCH_INTERVAL_MS = 8000;

/**
 * Subscribe to Freighter account/network changes. Returns an unsubscribe fn.
 * Used by the wallet context to keep UI in sync when the user switches
 * accounts or networks inside the extension.
 */
export function watchWallet(
  onChange: (info: { address: string; network: string }) => void,
  intervalMs: number = DEFAULT_WATCH_INTERVAL_MS,
): () => void {
  try {
    const watcher = new WatchWalletChanges(intervalMs);
    watcher.watch(onChange);
    return () => watcher.stop();
  } catch {
    return () => {};
  }
}
