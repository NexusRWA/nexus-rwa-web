import {
  CONTRACT_ERROR_CODES,
  isAuthError,
  parseContractError,
} from "@/lib/contractErrors";

describe("CONTRACT_ERROR_CODES", () => {
  it("should contain all documented error codes", () => {
    const codes = Object.keys(CONTRACT_ERROR_CODES).map(Number);
    expect(codes).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it("should have a message for each code", () => {
    Object.entries(CONTRACT_ERROR_CODES).forEach(([code, message]) => {
      expect(message).toBeTruthy();
      expect(typeof message).toBe("string");
      expect(Number(code)).toBeGreaterThan(0);
    });
  });
});

describe("parseContractError", () => {
  describe("known contract error codes", () => {
    it("should map Error(Contract, #1) to the correct message", () => {
      expect(parseContractError("Error(Contract, #1)")).toBe("Already initialized.");
    });

    it("should map Error(Contract, #2) to the correct message", () => {
      expect(parseContractError("Error(Contract, #2)")).toBe("Contract is not initialized.");
    });

    it("should map Error(Contract, #3) to the correct message", () => {
      expect(parseContractError("Error(Contract, #3)")).toBe(
        "You are not authorized to perform this action."
      );
    });

    it("should map Error(Contract, #7) to KYC-approval message for sender", () => {
      expect(parseContractError("Error(Contract, #7)")).toBe(
        "The sender is not KYC-approved for this asset."
      );
    });

    it("should map Error(Contract, #8) to KYC-approval message for recipient", () => {
      expect(parseContractError("Error(Contract, #8)")).toBe(
        "The recipient is not KYC-approved for this asset."
      );
    });

    it("should handle whitespace variations in error format", () => {
      expect(parseContractError("Error(Contract,#5)")).toBe("Invalid amount or valuation.");
      expect(parseContractError("Error(Contract,  #5)")).toBe("Invalid amount or valuation.");
    });
  });

  describe("unknown error codes", () => {
    it("should produce a generic fallback for unknown codes", () => {
      expect(parseContractError("Error(Contract, #999)")).toBe(
        "Contract rejected the call (code 999)."
      );
    });
  });

  describe("trustline and balance errors", () => {
    it("should detect trustline errors", () => {
      expect(parseContractError("No trustline")).toContain("trustline");
    });

    it("should detect insufficient balance errors", () => {
      expect(parseContractError("Insufficient balance")).toContain("balance");
    });

    it("should map to the same trustline message", () => {
      const msg = "Insufficient balance or a missing trustline for the payment token.";
      expect(parseContractError("No trustline")).toBe(msg);
      expect(parseContractError("Insufficient balance")).toBe(msg);
    });

    it("should be case-insensitive", () => {
      const msg = "Insufficient balance or a missing trustline for the payment token.";
      expect(parseContractError("TRUSTLINE")).toBe(msg);
      expect(parseContractError("INSUFFICIENT")).toBe(msg);
    });
  });

  describe("unmapped errors", () => {
    it("should produce a generic message for unmapped errors", () => {
      expect(parseContractError("Some random error")).toBe(
        "The contract call could not be completed."
      );
    });

    it("should produce a generic message for empty strings", () => {
      expect(parseContractError("")).toBe("The contract call could not be completed.");
    });
  });

  describe("edge cases", () => {
    it("should extract code from multi-line error messages", () => {
      const multiLine = `Error occurred:
        Error(Contract, #4)
        Details: record not found`;
      expect(parseContractError(multiLine)).toBe("The requested record was not found.");
    });

    it("should handle negative numbers gracefully", () => {
      // Negative numbers won't match our regex, so they fall through
      expect(parseContractError("Error(Contract, #-1)")).toBe(
        "The contract call could not be completed."
      );
    });
  });
});

describe("isAuthError", () => {
  it("has an explicit auth classification for every contract error code", () => {
    const expectedAuthBehavior: Record<number, boolean> = {
      1: false,
      2: false,
      3: true,
      4: false,
      5: false,
      6: false,
      7: false,
      8: false,
      9: false,
    };
    const contractCodes = Object.keys(CONTRACT_ERROR_CODES).map(Number).sort();
    const classifiedCodes = Object.keys(expectedAuthBehavior).map(Number).sort();

    expect(classifiedCodes).toEqual(contractCodes);
    for (const code of contractCodes) {
      const raw = `Error(Contract, #${code})`;
      expect(parseContractError(raw)).toBe(CONTRACT_ERROR_CODES[code]);
      expect(isAuthError(raw)).toBe(expectedAuthBehavior[code]);
    }
  });
});
