/**
 * Tests for the small exported helpers in lib/stellar.ts: explorer URL
 * builders, networkPassphrase and the scVal arg builders.
 */

import { Address, Networks, scValToNative } from "@stellar/stellar-sdk";
import {
  arg,
  explorerAccountUrl,
  explorerBase,
  explorerContractUrl,
  explorerTxUrl,
  networkPassphrase,
} from "@/lib/stellar";

const CONTRACT = "CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3";
const ACCOUNT = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";
const HASH = "a1b2c3d4e5f6";

const TESTNET_BASE = "https://stellar.expert/explorer/testnet";
const MAINNET_BASE = "https://stellar.expert/explorer/public";

describe("explorer URL helpers", () => {
  it.each([
    ["testnet", TESTNET_BASE],
    ["mainnet", MAINNET_BASE],
  ] as const)("explorerBase (%s)", (network, base) => {
    expect(explorerBase(network)).toBe(base);
  });

  it.each([
    ["testnet", TESTNET_BASE],
    ["mainnet", MAINNET_BASE],
  ] as const)("explorerContractUrl (%s)", (network, base) => {
    expect(explorerContractUrl(network, CONTRACT)).toBe(`${base}/contract/${CONTRACT}`);
  });

  it.each([
    ["testnet", TESTNET_BASE],
    ["mainnet", MAINNET_BASE],
  ] as const)("explorerTxUrl (%s)", (network, base) => {
    expect(explorerTxUrl(network, HASH)).toBe(`${base}/tx/${HASH}`);
  });

  it.each([
    ["testnet", TESTNET_BASE],
    ["mainnet", MAINNET_BASE],
  ] as const)("explorerAccountUrl (%s)", (network, base) => {
    expect(explorerAccountUrl(network, ACCOUNT)).toBe(`${base}/account/${ACCOUNT}`);
  });
});

describe("networkPassphrase", () => {
  it("returns the testnet passphrase", () => {
    expect(networkPassphrase("testnet")).toBe(Networks.TESTNET);
  });

  it("returns the public network passphrase for mainnet", () => {
    expect(networkPassphrase("mainnet")).toBe(Networks.PUBLIC);
  });

  it("differs between networks", () => {
    expect(networkPassphrase("testnet")).not.toBe(networkPassphrase("mainnet"));
  });
});

describe("arg builders", () => {
  it("address encodes a contract and an account address", () => {
    for (const addr of [CONTRACT, ACCOUNT]) {
      const v = arg.address(addr);
      expect(v.type).toBe("scvAddress");
      expect(Address.fromScVal(v).toString()).toBe(addr);
    }
  });

  it("address rejects a malformed address", () => {
    expect(() => arg.address("not-an-address")).toThrow();
  });

  it("string encodes as scvString", () => {
    const v = arg.string("Manhattan Office");
    expect(v.type).toBe("scvString");
    expect(scValToNative(v)).toBe("Manhattan Office");
  });

  it("symbol encodes as scvSymbol", () => {
    const v = arg.symbol("RealEstate");
    expect(v.type).toBe("scvSymbol");
    expect(scValToNative(v)).toBe("RealEstate");
  });

  it("bool encodes true and false as scvBool", () => {
    expect(arg.bool(true).type).toBe("scvBool");
    expect(scValToNative(arg.bool(true))).toBe(true);
    expect(scValToNative(arg.bool(false))).toBe(false);
  });

  it("u32 encodes as scvU32", () => {
    const v = arg.u32(7);
    expect(v.type).toBe("scvU32");
    expect(scValToNative(v)).toBe(7);
  });

  it("u64 accepts number and bigint and encodes as scvU64", () => {
    const fromNumber = arg.u64(42);
    const fromBigint = arg.u64(42n);
    expect(fromNumber.type).toBe("scvU64");
    expect(scValToNative(fromNumber)).toBe(42n);
    expect(fromBigint.toXDR("base64")).toBe(fromNumber.toXDR("base64"));
  });

  it("i128 encodes as scvI128 and round-trips large and negative values", () => {
    const big = 10n ** 30n;
    const v = arg.i128(big);
    expect(v.type).toBe("scvI128");
    expect(scValToNative(v)).toBe(big);
    expect(scValToNative(arg.i128(-5n))).toBe(-5n);
  });

  it("encodes eligible holders as a vector of address/i128 tuples", () => {
    const eligible: [string, bigint][] = [[ACCOUNT, 125n]];
    const value = arg.vecOfTuples(eligible);

    expect(value.type).toBe("scvVec");
    expect(scValToNative(value)).toEqual(eligible);
  });
});
