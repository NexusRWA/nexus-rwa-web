import { readContract, ContractError } from "@/lib/stellar";

// readContract reaches the network through getServer() -> new rpc.Server(),
// so the RPC client itself is the interception point. Stubbing a `getServer`
// global (as an earlier version of this file did) never intercepted anything,
// because getServer is a module binding rather than a global.
const mockSimulateTransaction = jest.fn();

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: (...args: unknown[]) =>
          mockSimulateTransaction(...args),
      })),
    },
  };
});

// Must be a checksum-valid contract id: readContract builds a real
// `new Contract(contractId)` before it ever reaches the RPC layer.
const CONTRACT_ID = "CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX";

// The real rpc.Api.isSimulationError just checks for an `error` field, so
// these fixtures drive it without stubbing it out.
const simulationError = (error: string) => ({ error });
const simulationOk = (retval: unknown = null) => ({ result: { retval } });

// ---------------------------------------------------------------------------
// Issue #254 — readContract error handling
// ---------------------------------------------------------------------------
describe("readContract", () => {
  beforeEach(() => {
    mockSimulateTransaction.mockReset();
  });

  describe("simulation failure error handling", () => {
    it("throws a typed ContractError when simulation returns an error", async () => {
      mockSimulateTransaction.mockResolvedValue(
        simulationError("Error(Contract, #3)"),
      );

      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).rejects.toMatchObject({
        message: "You are not authorized to perform this action.",
        detail: "Error(Contract, #3)",
      });
    });

    it("throws ContractError with parsed message for known contract error codes", async () => {
      mockSimulateTransaction.mockResolvedValue(
        simulationError("Error(Contract, #2)"),
      );

      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).rejects.toThrow("Contract is not initialized.");
    });

    it("throws ContractError with generic message for unknown error codes", async () => {
      mockSimulateTransaction.mockResolvedValue(
        simulationError("Error(Contract, #999)"),
      );

      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).rejects.toThrow(/code 999/);
    });

    it("throws ContractError for trustline/insufficient balance errors", async () => {
      mockSimulateTransaction.mockResolvedValue(
        simulationError("insufficient balance for trustline"),
      );

      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).rejects.toThrow(/Insufficient balance or a missing trustline/);
    });

    it("returns undefined when simulation succeeds but has no return value", async () => {
      mockSimulateTransaction.mockResolvedValue(simulationOk());

      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).resolves.toBeUndefined();
    });

    it("distinguishes simulation failure (throws) from successful call with no data (returns undefined)", async () => {
      mockSimulateTransaction.mockResolvedValueOnce(
        simulationError("Error(Contract, #4)"),
      );
      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).rejects.toBeInstanceOf(ContractError);

      mockSimulateTransaction.mockResolvedValueOnce(simulationOk());
      await expect(
        readContract("testnet", CONTRACT_ID, "test_method"),
      ).resolves.toBeUndefined();
    });
  });
});
