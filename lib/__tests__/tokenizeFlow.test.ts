import {
  validateTokenContract,
  registerAsset,
  type TokenizeFormData,
  type ValidatedToken,
} from "@/lib/tokenizeFlow";
import { assetToken, registry, type WriteCtx } from "@/lib/contracts";
import type { AssetMetadata } from "@/types";

// Mock the contracts module
jest.mock("@/lib/contracts", () => ({
  assetToken: {
    getMetadata: jest.fn(),
  },
  registry: {
    registerAsset: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Issue #256 — tokenizeFlow step validation and failure attribution
// ---------------------------------------------------------------------------
describe("tokenizeFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Step 1: validateTokenContract
  // =========================================================================
  describe("validateTokenContract (step 1)", () => {
    const mockValidMetadata: AssetMetadata = {
      name: "Test Asset",
      symbol: "TST",
      assetType: "RealWorldAsset",
      totalSupply: 1000000n,
      decimals: 6,
      admin: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      complianceContract: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      assetDescription: "A test RWA",
      valuation: 100000000n,
      paused: false,
    };

    describe("valid inputs", () => {
      it("passes when token contract is reachable and has valid metadata", async () => {
        jest.mocked(assetToken.getMetadata).mockResolvedValue(mockValidMetadata);

        const result = await validateTokenContract(
          "testnet",
          "CTEST_TOKEN_ID"
        );

        expect(result).toEqual({
          tokenContract: "CTEST_TOKEN_ID",
          metadata: mockValidMetadata,
        });
        expect(assetToken.getMetadata).toHaveBeenCalledWith(
          "testnet",
          "CTEST_TOKEN_ID"
        );
      });

      it("passes when token contract has name and symbol", async () => {
        const metadata: AssetMetadata = {
          ...mockValidMetadata,
          name: "MyAsset",
          symbol: "MYA",
        };

        jest.mocked(assetToken.getMetadata).mockResolvedValue(metadata);

        const result = await validateTokenContract("testnet", "CTEST_ID");
        expect(result.metadata.name).toBe("MyAsset");
        expect(result.metadata.symbol).toBe("MYA");
      });
    });

    describe("invalid inputs", () => {
      it("throws when token contract is unreachable or doesn't exist", async () => {
        jest.mocked(assetToken.getMetadata).mockRejectedValue(
          new Error("Network error")
        );

        await expect(validateTokenContract("testnet", "CINVALID_TOKEN_ID")).rejects.toThrow("Could not read the token contract");
        await expect(validateTokenContract("testnet", "CINVALID_TOKEN_ID")).rejects.toThrow("Make sure the address is correct");
      });

      it("throws when getMetadata call fails with simulation error", async () => {
        jest.mocked(assetToken.getMetadata).mockRejectedValue(
          new Error("Simulation failed: contract not found")
        );

        await expect(validateTokenContract("testnet", "CNONEXISTENT")).rejects.toThrow("Could not read the token contract");
      });

      it("throws when metadata is missing name", async () => {
        const incompleteMetadata = {
          ...mockValidMetadata,
          name: "", // Empty name
        };

        jest.mocked(assetToken.getMetadata).mockResolvedValue(
          incompleteMetadata
        );

        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("doesn't look like a valid asset-token");
        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("missing name or symbol");
      });

      it("throws when metadata is missing symbol", async () => {
        const incompleteMetadata = {
          ...mockValidMetadata,
          symbol: "", // Empty symbol
        };

        jest.mocked(assetToken.getMetadata).mockResolvedValue(
          incompleteMetadata
        );

        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("doesn't look like a valid asset-token");
        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("missing name or symbol");
      });

      it("throws when both name and symbol are missing", async () => {
        const incompleteMetadata = {
          ...mockValidMetadata,
          name: "",
          symbol: "",
        };

        jest.mocked(assetToken.getMetadata).mockResolvedValue(
          incompleteMetadata
        );

        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("doesn't look like a valid asset-token");
      });

      it("throws when metadata name is falsy (null or undefined)", async () => {
        const metadata = {
          ...mockValidMetadata,
          name: null as unknown as string,
        };

        jest.mocked(assetToken.getMetadata).mockResolvedValue(metadata);

        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("doesn't look like a valid asset-token");
      });

      it("throws when metadata symbol is falsy (null or undefined)", async () => {
        const metadata = {
          ...mockValidMetadata,
          symbol: undefined as unknown as string,
        };

        jest.mocked(assetToken.getMetadata).mockResolvedValue(metadata);

        await expect(validateTokenContract("testnet", "CTEST_ID")).rejects.toThrow("doesn't look like a valid asset-token");
      });
    });

    describe("error messaging", () => {
      it("reports validation error specifically (doesn't mention registry or registration)", async () => {
        jest.mocked(assetToken.getMetadata).mockResolvedValue({
          ...mockValidMetadata,
          name: "",
        });

        await expect(
          validateTokenContract("testnet", "CTEST_ID"),
        ).rejects.toThrow(/asset-token/);

        await expect(
          validateTokenContract("testnet", "CTEST_ID"),
        ).rejects.not.toThrow(/registr/i);
      });
    });
  });

  // =========================================================================
  // Step 2: registerAsset
  // =========================================================================
  describe("registerAsset (step 2)", () => {
    const mockWriteCtx: WriteCtx = {
      network: "testnet",
      source: "GTEST_ISSUER",
      sign: jest.fn(),
    };

    const mockFormData: TokenizeFormData = {
      tokenContract: "CTEST_TOKEN_ID",
      name: "Test Asset",
      assetType: "RealWorldAsset",
      valuation: 100000000n,
    };

    describe("valid inputs", () => {
      it("calls registry.registerAsset with correct parameters", async () => {
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: 123n,
        });

        await registerAsset(mockWriteCtx, mockFormData);

        expect(registry.registerAsset).toHaveBeenCalledWith(
          mockWriteCtx,
          {
            issuer: mockWriteCtx.source,
            tokenContract: mockFormData.tokenContract,
            name: mockFormData.name,
            assetType: mockFormData.assetType,
            valuation: mockFormData.valuation,
          }
        );
      });

      it("returns the asset ID from the transaction return value", async () => {
        const assetId = 42n;
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: assetId,
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(assetId);
      });

      it("returns null when transaction has no return value", async () => {
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: undefined,
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBeNull();
      });

      it("returns null when return value is null", async () => {
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: null,
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBeNull();
      });

      it("converts various return value types to BigInt", async () => {
        // Test with string return value
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: "999" as unknown,
        });

        let result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(999n);

        // Test with number return value
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: 888,
        });

        result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(888n);

        // Test with bigint return value
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: 777n,
        });

        result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBe(777n);
      });
    });

    describe("error handling", () => {
      it("returns null if return value cannot be converted to BigInt", async () => {
        jest.mocked(registry.registerAsset).mockResolvedValue({
          hash: "test_hash",
          returnValue: "not_a_number",
        });

        const result = await registerAsset(mockWriteCtx, mockFormData);
        expect(result).toBeNull();
      });

      it("propagates registry.registerAsset errors", async () => {
        const error = new Error("Registry write failed");
        jest.mocked(registry.registerAsset).mockRejectedValue(error);

        await expect(registerAsset(mockWriteCtx, mockFormData)).rejects.toBe(
          error,
        );
      });
    });
  });

  // =========================================================================
  // Multi-step flow
  // =========================================================================
  describe("multi-step tokenization flow", () => {
    const mockValidMetadata: AssetMetadata = {
      name: "RWA Token",
      symbol: "RWA",
      assetType: "RealWorldAsset",
      totalSupply: 1000000n,
      decimals: 6,
      admin: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      complianceContract: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      assetDescription: "Real world asset",
      valuation: 500000000n,
      paused: false,
    };

    const mockWriteCtx: WriteCtx = {
      network: "testnet",
      source: "GISSUER",
      sign: jest.fn(),
    };

    const mockFormData: TokenizeFormData = {
      tokenContract: "CTOKEN",
      name: "Asset Name",
      assetType: "Bond",
      valuation: 250000000n,
    };

    it("step 1 failure prevents step 2 from running", async () => {
      // Step 1 fails: token contract validation
      jest.mocked(assetToken.getMetadata).mockRejectedValue(
        new Error("Contract not found")
      );

      await expect(validateTokenContract("testnet", mockFormData.tokenContract)).rejects.toThrow("Could not read");

      // Step 2 should not be called
      expect(registry.registerAsset).not.toHaveBeenCalled();
    });

    it("can complete both steps successfully in sequence", async () => {
      // Step 1: Validate token contract
      jest.mocked(assetToken.getMetadata).mockResolvedValue(mockValidMetadata);

      const validated = await validateTokenContract(
        "testnet",
        mockFormData.tokenContract
      );
      expect(validated.metadata.name).toBe(mockValidMetadata.name);

      // Step 2: Register asset
      jest.mocked(registry.registerAsset).mockResolvedValue({
        hash: "tx_hash",
        returnValue: 100n,
      });

      const assetId = await registerAsset(mockWriteCtx, mockFormData);
      expect(assetId).toBe(100n);

      // Verify both were called
      expect(assetToken.getMetadata).toHaveBeenCalledWith(
        "testnet",
        mockFormData.tokenContract
      );
      expect(registry.registerAsset).toHaveBeenCalled();
    });

    it("step 1 validation with missing symbol fails before step 2", async () => {
      const invalidMetadata = { ...mockValidMetadata, symbol: "" };
      jest.mocked(assetToken.getMetadata).mockResolvedValue(invalidMetadata);

      await expect(validateTokenContract("testnet", mockFormData.tokenContract)).rejects.toThrow("asset-token");
        await expect(validateTokenContract("testnet", mockFormData.tokenContract)).rejects.toThrow("symbol");

      expect(registry.registerAsset).not.toHaveBeenCalled();
    });
  });

  describe("step-level failure attribution", () => {
    it("validateTokenContract errors mention step 1 context", async () => {
      jest.mocked(assetToken.getMetadata).mockRejectedValue(
        new Error("RPC error")
      );

      // The message must point at the token contract (step 1), not the
      // registry or registration.
      await expect(
        validateTokenContract("testnet", "CTEST"),
      ).rejects.toThrow("token contract");
    });

    it("registerAsset can distinguish failures from step 2 context", async () => {
      const ctx: WriteCtx = {
        network: "testnet",
        source: "GISSUER",
        sign: jest.fn(),
      };

      const data: TokenizeFormData = {
        tokenContract: "CTOKEN",
        name: "Asset",
        assetType: "RWA",
        valuation: 100000000n,
      };

      jest.mocked(registry.registerAsset).mockRejectedValue(
        new Error("Authorization failed")
      );

      // Propagates directly from registry.registerAsset (step 2).
      await expect(registerAsset(ctx, data)).rejects.toThrow("Authorization");
    });
  });
  // =========================================================================
  // #610: switching network mid-session
  // =========================================================================
  describe("network switch mid-session (#610)", () => {
    const metaFor = (name: string): AssetMetadata => ({
      name,
      symbol: "NET",
      assetType: "RealWorldAsset",
      totalSupply: 1n,
      decimals: 6,
      admin: "GADMIN",
      complianceContract: "CCOMP",
      assetDescription: "",
      valuation: 1n,
      paused: false,
    });

    it("never serves data from the previous network after a switch", async () => {
      jest
        .mocked(assetToken.getMetadata)
        .mockImplementation(async (network) =>
          metaFor(network === "testnet" ? "Testnet Asset" : "Mainnet Asset"),
        );

      const first = await validateTokenContract("testnet", "CTOKEN");
      const second = await validateTokenContract("mainnet", "CTOKEN");

      expect(first.metadata.name).toBe("Testnet Asset");
      expect(second.metadata.name).toBe("Mainnet Asset");
      expect(assetToken.getMetadata).toHaveBeenNthCalledWith(1, "testnet", "CTOKEN");
      expect(assetToken.getMetadata).toHaveBeenNthCalledWith(2, "mainnet", "CTOKEN");
    });

    it("keeps an in-flight request bound to the network it started on", async () => {
      let resolveTestnet!: (m: AssetMetadata) => void;
      jest
        .mocked(assetToken.getMetadata)
        .mockImplementationOnce(
          () => new Promise<AssetMetadata>((r) => (resolveTestnet = r)),
        )
        .mockResolvedValueOnce(metaFor("Mainnet Asset"));

      const inFlight = validateTokenContract("testnet", "CTOKEN");
      const afterSwitch = await validateTokenContract("mainnet", "CTOKEN");
      resolveTestnet(metaFor("Testnet Asset"));

      expect(afterSwitch.metadata.name).toBe("Mainnet Asset");
      // The late testnet result stays attributable to testnet only.
      expect((await inFlight).metadata.name).toBe("Testnet Asset");
      expect(assetToken.getMetadata).toHaveBeenCalledTimes(2);
    });

    it("does not reuse a successful testnet result when mainnet fails", async () => {
      jest
        .mocked(assetToken.getMetadata)
        .mockResolvedValueOnce(metaFor("Testnet Asset"))
        .mockRejectedValueOnce(new Error("not found"));

      await validateTokenContract("testnet", "CTOKEN");
      await expect(validateTokenContract("mainnet", "CTOKEN")).rejects.toThrow(
        "Could not read the token contract",
      );
    });
  });
});
