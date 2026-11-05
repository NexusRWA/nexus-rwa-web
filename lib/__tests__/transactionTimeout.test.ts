import { TransactionTimeoutError, ContractError } from "@/lib/stellar";

describe("TransactionTimeoutError", () => {
  it("has correct name and message", () => {
    const hash = "0xabcd1234";
    const error = new TransactionTimeoutError(hash);
    expect(error.name).toBe("TransactionTimeoutError");
    expect(error.message).toContain("timed out");
    expect(error.message).toContain("explorer");
  });

  it("stores the transaction hash for explorer lookup", () => {
    const hash = "0xabcd1234";
    const error = new TransactionTimeoutError(hash);
    expect(error.hash).toBe(hash);
    expect(error.detail).toBe(hash);
  });

  it("is an instance of ContractError", () => {
    const error = new TransactionTimeoutError("0x123");
    expect(error).toBeInstanceOf(ContractError);
  });

  it("provides actionable message to the user", () => {
    const error = new TransactionTimeoutError("somehash");
    const msg = error.message;
    expect(msg.toLowerCase()).toContain("transaction");
    expect(msg.toLowerCase()).toContain("may still land");
  });
});
