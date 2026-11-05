import { Account, rpc } from "@stellar/stellar-sdk";
import { invokeContract } from "@/lib/stellar";

const mockGetAccount = jest.fn();
const mockSimulateTransaction = jest.fn();
const mockSendTransaction = jest.fn();
const mockGetTransaction = jest.fn();

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  const transaction = { toXDR: () => "signed-xdr" };
  class MockTransactionBuilder {
    constructor() {}
    addOperation() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return transaction;
    }
    static fromXDR() {
      return transaction;
    }
  }

  return {
    ...actual,
    TransactionBuilder: MockTransactionBuilder,
    rpc: {
      ...actual.rpc,
      Server: jest.fn().mockImplementation(() => ({
        getAccount: (...args: unknown[]) => mockGetAccount(...args),
        simulateTransaction: (...args: unknown[]) =>
          mockSimulateTransaction(...args),
        sendTransaction: (...args: unknown[]) => mockSendTransaction(...args),
        getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
      })),
      assembleTransaction: jest.fn().mockImplementation((transaction) => ({
        build: () => transaction,
      })),
    },
  };
});

const SOURCE = "GAIQGTOBTTLLDJ4SWGGESM7UWJ2DI4K3ZNHUSHPDKJL2IE5FKY3BSRAA";
const CONTRACT_ID = "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX";
const HASH = "a1b2c3d4e5f6";

describe("invokeContract RPC retries", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockGetAccount.mockReset().mockResolvedValue(new Account(SOURCE, "1"));
    mockSimulateTransaction.mockReset().mockResolvedValue({ minResourceFee: "0" });
    mockSendTransaction.mockReset().mockResolvedValue({ status: "PENDING", hash: HASH });
    mockGetTransaction.mockReset().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
    });
  });

  it("retries transient simulation failures before signing", async () => {
    jest.useFakeTimers();
    mockSimulateTransaction
      .mockRejectedValueOnce(new Error("HTTP 429 too many requests"))
      .mockResolvedValueOnce({ minResourceFee: "0" });

    const invocation = invokeContract(
      "testnet",
      SOURCE,
      CONTRACT_ID,
      "test_method",
      [],
      async (transactionXdr) => transactionXdr,
    );
    await jest.runAllTimersAsync();
    await expect(invocation).resolves.toMatchObject({ hash: HASH });

    expect(mockSimulateTransaction).toHaveBeenCalledTimes(2);
    expect(mockSendTransaction).toHaveBeenCalledTimes(1);
  });

  it("keeps polling after a transient getTransaction failure", async () => {
    jest.useFakeTimers();
    mockGetTransaction
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ status: rpc.Api.GetTransactionStatus.SUCCESS });

    const invocation = invokeContract(
      "testnet",
      SOURCE,
      CONTRACT_ID,
      "test_method",
      [],
      async (transactionXdr) => transactionXdr,
    );
    await jest.runAllTimersAsync();
    await expect(invocation).resolves.toMatchObject({ hash: HASH });

    expect(mockGetTransaction).toHaveBeenCalledTimes(2);
    expect(mockSendTransaction).toHaveBeenCalledTimes(1);
  });
});