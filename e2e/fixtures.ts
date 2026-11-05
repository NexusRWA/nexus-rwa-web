/**
 * Shared fixtures and helpers for the e2e test suite.
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *
 * This app has two external dependencies that must be mocked in e2e tests:
 *
 * 1. Freighter wallet extension  — injected into the page via addInitScript
 *    by replacing window.freighter before React hydrates. The freighter-api
 *    package reads from window.freighter, so our mock is picked up
 *    transparently.
 *
 * 2. Soroban RPC + REST API      — intercepted via page.route() so that
 *    every simulateTransaction / getAccount / getLatestLedger call returns
 *    a canned response without touching a real blockchain node.
 *
 * ── Scoped mock identities ──────────────────────────────────────────────────
 *
 * Real-looking Stellar addresses are used. They must satisfy StrKey validation
 * or the UI rejects them as malformed and the SDK cannot encode them into a
 * simulation request — so they are checksum-valid, not merely plausible. They
 * are *not* real funded accounts; the mocked RPC returns everything needed.
 */

import type { Page, Route } from "@playwright/test";
import {
  Address,
  Keypair,
  Networks,
  SorobanDataBuilder,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

// ── Constants ─────────────────────────────────────────────────────────────────

export const WALLET_ADDRESS =
  "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR";

export const RECIPIENT_ADDRESS =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

export const TOKEN_CONTRACT =
  "CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU";

export const COMPLIANCE_CONTRACT =
  "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX";

export const PAYMENT_TOKEN =
  "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";

export const ASSET_ID = "1";

/** Minimal asset entry returned by the REST API. */
export const ASSET_ENTRY = {
  id: ASSET_ID,
  tokenContract: TOKEN_CONTRACT,
  issuer: WALLET_ADDRESS,
  name: "Lagos Office Tower",
  assetType: "real_estate",
  valuation: "500000000",
  createdAt: 100,
  active: true,
};

/** Minimal metadata returned by the get_metadata contract call. */
export const ASSET_METADATA = {
  name: "Lagos Office Tower",
  symbol: "LOT",
  asset_type: "real_estate",
  total_supply: 1_000_000n,
  decimals: 0,
  admin: WALLET_ADDRESS,
  compliance_contract: COMPLIANCE_CONTRACT,
  asset_description: "A commercial tower in Lagos, Nigeria.",
  valuation: 500_000_000n,
  paused: false,
};

// ── Contract-call simulation ─────────────────────────────────────────────────

/** Values the simulated contract reads resolve to, tunable per test. */
interface SimConfig {
  balance: number;
  allowance: number;
  walletApproved: boolean;
  recipientApproved: boolean;
  claimable: number;
  hasClaimed: boolean;
}

/** The invoked function name and arguments, read back out of the envelope. */
export function decodeInvocation(
  txXdr: string,
): { fn: string; args: unknown[] } | null {
  try {
    const tx = TransactionBuilder.fromXDR(txXdr, Networks.TESTNET);
    const op = "operations" in tx ? tx.operations[0] : undefined;
    if (!op || op.type !== "invokeHostFunction") return null;

    // `func` is the SDK's HostFunction wrapper: `invokeContract` is a plain
    // property holding { contractAddress, functionName, args }, not a method.
    const invocation = (
      op.func as unknown as {
        invokeContract?: { functionName: unknown; args: xdr.ScVal[] };
      }
    ).invokeContract;
    if (!invocation) return null;

    return {
      fn: String(invocation.functionName),
      args: invocation.args.map((a) => scValToNative(a)),
    };
  } catch {
    return null;
  }
}

const asset = () =>
  nativeToScVal(
    {
      id: BigInt(ASSET_ID),
      token_contract: new Address(TOKEN_CONTRACT),
      issuer: new Address(WALLET_ADDRESS),
      name: ASSET_ENTRY.name,
      asset_type: ASSET_ENTRY.assetType,
      valuation: BigInt(ASSET_ENTRY.valuation),
      created_at: ASSET_ENTRY.createdAt,
      active: ASSET_ENTRY.active,
    },
    {
      type: {
        id: ["symbol", "u64"],
        valuation: ["symbol", "i128"],
        created_at: ["symbol", "u32"],
        name: ["symbol", "string"],
        asset_type: ["symbol", "string"],
      },
    },
  );

const metadata = () =>
  nativeToScVal(
    {
      ...ASSET_METADATA,
      admin: new Address(ASSET_METADATA.admin),
      compliance_contract: new Address(ASSET_METADATA.compliance_contract),
    },
    {
      type: {
        name: ["symbol", "string"],
        symbol: ["symbol", "string"],
        asset_type: ["symbol", "string"],
        asset_description: ["symbol", "string"],
        total_supply: ["symbol", "i128"],
        decimals: ["symbol", "u32"],
        valuation: ["symbol", "i128"],
      },
    },
  );

const distribution = () =>
  nativeToScVal(
    {
      id: 1n,
      asset_token: new Address(TOKEN_CONTRACT),
      payment_token: new Address(PAYMENT_TOKEN),
      total_amount: 100_0000000n,
      distributed: 25_0000000n,
      created_at: 120,
      completed: false,
    },
    {
      type: {
        id: ["symbol", "u64"],
        total_amount: ["symbol", "i128"],
        distributed: ["symbol", "i128"],
        created_at: ["symbol", "u32"],
      },
    },
  );

const kycRecord = (address: string) =>
  nativeToScVal(
    {
      address: new Address(address),
      status: nativeToScVal("Approved", { type: "symbol" }),
      jurisdiction: "NG",
      verified_at: 100,
      expires_at: 9_999_999,
    },
    {
      type: {
        jurisdiction: ["symbol", "string"],
        verified_at: ["symbol", "u32"],
        expires_at: ["symbol", "u32"],
      },
    },
  );

/**
 * Map a contract read onto its return value.
 *
 * Every call used to resolve to the same `true`, so anything that decoded a
 * struct (get_asset, get_metadata) produced a boolean and the asset page fell
 * through to "Asset not found".
 */
function simulatedRetval(
  fn: string,
  args: unknown[],
  cfg: SimConfig,
): xdr.ScVal {
  /** Whether any decoded argument is the given address. */
  const addressed = (want: string) => args.some((a) => a === want);

  switch (fn) {
    case "get_asset":
      return asset();
    case "get_all_assets":
    case "get_assets_by_issuer":
    case "get_assets_by_type":
      return xdr.ScVal.scvVec([asset()]);
    case "get_metadata":
      return metadata();
    case "balance":
      return nativeToScVal(BigInt(cfg.balance), { type: "i128" });
    case "allowance":
      return nativeToScVal(BigInt(cfg.allowance), { type: "i128" });
    case "decimals":
      return nativeToScVal(0, { type: "u32" });
    case "total_supply":
      return nativeToScVal(ASSET_METADATA.total_supply, { type: "i128" });
    case "asset_count":
      return nativeToScVal(1n, { type: "u64" });
    case "total_value_locked":
      return nativeToScVal(BigInt(ASSET_ENTRY.valuation), { type: "i128" });
    case "is_allowed":
      return xdr.ScVal.scvBool(
        addressed(RECIPIENT_ADDRESS)
          ? cfg.recipientApproved
          : cfg.walletApproved,
      );
    case "get_record":
      return kycRecord(
        addressed(RECIPIENT_ADDRESS) ? RECIPIENT_ADDRESS : WALLET_ADDRESS,
      );
    case "get_allowlist":
      return xdr.ScVal.scvVec([
        nativeToScVal(new Address(WALLET_ADDRESS)),
        nativeToScVal(new Address(RECIPIENT_ADDRESS)),
      ]);
    case "is_jurisdiction_blocked":
      return xdr.ScVal.scvBool(false);
    case "get_distributions_for_asset":
      return xdr.ScVal.scvVec([distribution()]);
    case "get_distribution":
      return distribution();
    case "claimable":
      return nativeToScVal(BigInt(cfg.claimable), { type: "i128" });
    case "has_claimed":
      return xdr.ScVal.scvBool(cfg.hasClaimed);
    default:
      // Writes and anything unmodelled: a void return simulates fine.
      return xdr.ScVal.scvVoid();
  }
}

// ── Wallet mock ───────────────────────────────────────────────────────────────

/**
 * Inject a mock Freighter wallet into the page before any scripts run.
 *
 * @stellar/freighter-api reads from window.freighter. By overriding it before
 * the app loads we make the wallet context believe a real wallet is installed
 * and connected, without a browser extension.
 */
export async function mockFreighterWallet(
  page: Page,
  opts: {
    address?: string;
    /** Set false to simulate "wallet not installed". */
    installed?: boolean;
  } = {},
) {
  const address = opts.address ?? WALLET_ADDRESS;
  const installed = opts.installed ?? true;

  await page.addInitScript(
    ({ address, installed }: { address: string; installed: boolean }) => {
      if (!installed) return; // leave window.freighter undefined

      // freighter-api v6 only reads window.freighter as an "extension is
      // present" flag. Every actual call is a window.postMessage round-trip
      // with the extension's content script, so setting methods here does
      // nothing on its own — the message channel below is what answers them.
      (window as unknown as Record<string, unknown>).freighter = true;

      // The provider only probes for an existing connection when this flag is
      // set by a previous explicit connect, so without it the app stays on
      // "Connect Wallet" no matter what the wallet replies.
      try {
        localStorage.setItem("rwa.wallet.connected", "1");
      } catch {
        // storage unavailable — the connect button still works
      }

      const REQUEST = "FREIGHTER_EXTERNAL_MSG_REQUEST";
      const RESPONSE = "FREIGHTER_EXTERNAL_MSG_RESPONSE";
      const networkDetails = {
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
        sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      };

      window.addEventListener("message", (event: MessageEvent) => {
        const data = event.data as
          | { source?: string; messageId?: number; type?: string; transactionXdr?: string }
          | undefined;
        if (event.source !== window || data?.source !== REQUEST) return;

        // Field names mirror what the API destructures off each reply; the
        // response id is `messagedId`, which is not a typo on this side.
        const payloads: Record<string, Record<string, unknown>> = {
          REQUEST_CONNECTION_STATUS: { isConnected: true },
          REQUEST_ALLOWED_STATUS: { isAllowed: true },
          REQUEST_ACCESS: { publicKey: address },
          REQUEST_PUBLIC_KEY: { publicKey: address },
          REQUEST_NETWORK_DETAILS: { networkDetails },
          REQUEST_USER_INFO: { userInfo: { publicKey: address } },
          SUBMIT_TRANSACTION: {
            signedTransaction: data?.transactionXdr ?? "",
            signerAddress: address,
          },
        };

        window.postMessage(
          {
            source: RESPONSE,
            messagedId: data?.messageId,
            ...(payloads[data?.type ?? ""] ?? {}),
          },
          window.location.origin,
        );
      });
    },
    { address, installed },
  );
}

// ── Soroban RPC mock ──────────────────────────────────────────────────────────

/**
 * Intercept all Soroban RPC and REST API HTTP calls.
 *
 * The stellar-sdk sends JSON-RPC POSTs to the configured rpcUrl. We return
 * minimal responses that make the SDK resolve successfully without going to
 * the network.
 *
 * For read-only simulation (`simulateTransaction`), we return a success
 * envelope. The result XDR is empty (no retval), which causes readContract to
 * return undefined. The hooks then either short-circuit or render fallback
 * states — which is exactly what we want to test at the integration level.
 *
 * For the transfer and claim tests we need richer responses, which are
 * provided via the `opts` overrides.
 */
export async function mockRpc(
  page: Page,
  opts: {
    /** Fake balance for the connected wallet on the token contract. */
    balance?: number;
    /** Fake payment-token allowance for issuer distribution tests. */
    allowance?: number;
    /** Whether the wallet address is compliance-approved. */
    walletApproved?: boolean;
    /** Whether the recipient address is compliance-approved. */
    recipientApproved?: boolean;
    /** Claimable amount for distribution 1 (in raw payment token units). */
    claimable?: number;
    /** Whether the wallet has already claimed distribution 1. */
    hasClaimed?: boolean;
  } = {},
) {
  const {
    balance = 500,
    allowance = 0,
    walletApproved = true,
    recipientApproved = true,
    claimable = 10_0000000,
    hasClaimed = false,
  } = opts;

  // The most recent envelope submitted, echoed back by getTransaction.
  let lastSentTx = "";

  // Intercept Soroban RPC endpoint.
  await page.route(
    /soroban-testnet\.stellar\.org|soroban.*\.org|sorobanrpc/,
    async (route: Route) => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(route.request().postData() ?? "{}");
      } catch {
        // not JSON — pass through
      }

      const method = body.method as string | undefined;

      if (method === "getLatestLedger") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: { id: "abc", sequence: 1234, protocolVersion: "20" },
          }),
        });
      }

      if (method === "getAccount") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              id: WALLET_ADDRESS,
              sequence: "1000",
              balances: [{ asset_type: "native", balance: "100.0000000" }],
              flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
            },
          }),
        });
      }

      // SDK getAccount() is a getLedgerEntries lookup of the account entry.
      if (method === "getLedgerEntries") {
        const account = new xdr.AccountEntry({
          accountId: Keypair.fromPublicKey(WALLET_ADDRESS).xdrAccountId(),
          balance: xdr.Int64.fromString("1000000000"),
          seqNum: xdr.Int64.fromString("1000"),
          numSubEntries: 0,
          inflationDest: null,
          flags: 0,
          homeDomain: "",
          thresholds: Buffer.from([1, 0, 0, 0]),
          signers: [],
          ext: xdr.AccountEntryExt.fromXDR(Buffer.from([0, 0, 0, 0])),
        });
        const data = xdr.LedgerEntryData.account(account);
        const accountKey = xdr.LedgerKey.account(
          new xdr.LedgerKeyAccount({
            accountId: Keypair.fromPublicKey(WALLET_ADDRESS).xdrAccountId(),
          }),
        );
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              entries: [
                { key: accountKey.toXDR("base64"), xdr: data.toXDR("base64"), lastModifiedLedgerSeq: 1234 },
              ],
              latestLedger: 1234,
            },
          }),
        });
      }

      if (method === "simulateTransaction") {
        const params = body.params as { transaction?: string } | undefined;
        const invocation = decodeInvocation(params?.transaction ?? "");
        const retval = invocation
          ? simulatedRetval(invocation.fn, invocation.args, {
              balance,
              allowance,
              walletApproved,
              recipientApproved,
              claimable,
              hasClaimed,
            })
          : xdr.ScVal.scvVoid();

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              // Built by the SDK rather than pasted: a hard-coded blob here
              // carried a footprint the SDK could no longer parse, which
              // failed every read before it reached the hooks.
              transactionData: new SorobanDataBuilder().build().toXDR("base64"),
              events: [],
              minResourceFee: "100",
              results: [{ xdr: retval.toXDR("base64"), auth: [] }],
              latestLedger: 1234,
            },
          }),
        });
      }

      if (method === "sendTransaction") {
        lastSentTx =
          (body.params as { transaction?: string } | undefined)?.transaction ?? "";
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              hash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
              status: "PENDING",
              latestLedger: "1235",
              latestLedgerCloseTime: "1700000000",
            },
          }),
        });
      }

      if (method === "getTransaction") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              status: "SUCCESS",
              latestLedger: "1236",
              latestLedgerCloseTime: "1700000001",
              oldestLedger: "1",
              oldestLedgerCloseTime: "1600000000",
              ledger: 1235,
              createdAt: "1700000001",
              applicationOrder: 1,
              feeBump: false,
              // The SDK parses all three; the envelope is the one the app
              // just sent, the result is a successful tx, and the meta carries
              // a Soroban return value of u64 7 (the new registry asset id).
              envelopeXdr: lastSentTx,
              resultXdr: "AAAAAAAAAGQAAAAAAAAAAAAAAAA=",
              resultMetaXdr:
                "AAAAAwAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAFAAAAAAAAAAcAAAAA",
            },
          }),
        });
      }

      // Default: return an empty-success simulation for any other RPC call.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {},
        }),
      });
    },
  );

  // Intercept the REST API (NEXT_PUBLIC_API_URL — may be unset in dev, but
  // we still set up the handler so tests work whether the env var is set or not).
  await page.route(/\/api\//, async (route: Route) => {
    const url = route.request().url();
    if (url.match(/\/assets\/[^/?]+\/holders/)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { address: WALLET_ADDRESS, balance: String(balance) },
          { address: RECIPIENT_ADDRESS, balance: String(balance) },
        ]),
      });
    }
    if (url.match(/\/assets\/\d+$/)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ASSET_ENTRY),
      });
    }
    if (url.includes("/assets")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [ASSET_ENTRY],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
      });
    }
    if (url.includes("/stats")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalAssets: 1, tvl: "500000000", totalHolders: 1 }),
      });
    }
    return route.continue();
  });

  // Suppress unused variable warnings for opts we captured but don't use in
  // route handlers (they exist for documentation / future expansion).
  void walletApproved;
  void recipientApproved;
  void allowance;
  void claimable;
  void hasClaimed;
}
