/**
 * Additional coverage for useAllowlist and useComplianceOverview.
 *
 * The existing useCompliance.test.ts covers the happy path for both hooks.
 * These tests pin down the cases that were previously uncovered:
 *
 *   useAllowlist
 *     - loading state while fetch is in flight
 *     - error state when getAllowlist throws
 *     - null records from getRecord are filtered out
 *
 *   useComplianceOverview
 *     - loading state while fetch is in flight
 *     - error state when getAllowlist throws
 *     - empty allowlist (no addresses → zero size, no jurisdictions)
 *     - null records from getRecord are silently excluded
 *     - duplicate jurisdiction codes are deduplicated (same code on two records)
 *     - jurisdictions are returned sorted alphabetically
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useAllowlist, useComplianceOverview } from "../useCompliance";
import { compliance } from "@/lib/contracts";

// ── mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/contracts", () => ({
  compliance: {
    getAllowlist: jest.fn(),
    getRecord: jest.fn(),
    isJurisdictionBlocked: jest.fn(),
  },
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

const mockGetAllowlist = compliance.getAllowlist as jest.Mock;
const mockGetRecord = compliance.getRecord as jest.Mock;
const mockIsJurisdictionBlocked = compliance.isJurisdictionBlocked as jest.Mock;

function makeRecord(address: string, jurisdiction: string) {
  return {
    address,
    status: "Approved" as const,
    jurisdiction,
    verifiedAt: 1000,
    expiresAt: 0,
  };
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ==============================================================================
// useAllowlist
// ==============================================================================

describe("useAllowlist", () => {
  // ── disabled state ──────────────────────────────────────────────────────────

  it("returns loading=false and data=null when complianceId is null", () => {
    const { result } = renderHook(() => useAllowlist(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetAllowlist).not.toHaveBeenCalled();
  });

  // ── loading state ───────────────────────────────────────────────────────────

  it("starts in loading=true when a complianceId is provided", () => {
    // Keep the promise unresolved so we can observe the loading state.
    mockGetAllowlist.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAllowlist("C_ID"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // ── error state ─────────────────────────────────────────────────────────────

  it("surfaces an error and clears loading when getAllowlist throws", async () => {
    mockGetAllowlist.mockRejectedValue(new Error("RPC timeout"));

    const { result } = renderHook(() => useAllowlist("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("RPC timeout");
    expect(result.current.data).toBeNull();
  });

  // ── empty allowlist ─────────────────────────────────────────────────────────

  it("returns an empty array when the allowlist has no addresses", async () => {
    mockGetAllowlist.mockResolvedValue([]);

    const { result } = renderHook(() => useAllowlist("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  // ── null-record filtering ────────────────────────────────────────────────────

  it("filters out null records returned by getRecord", async () => {
    const rec1 = makeRecord("G_ADDR_1", "US");
    // G_ADDR_2 has been removed from the contract — getRecord returns null.
    mockGetAllowlist.mockResolvedValue(["G_ADDR_1", "G_ADDR_2"]);
    mockGetRecord
      .mockResolvedValueOnce(rec1)
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAllowlist("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only the non-null record should be in the result.
    expect(result.current.data).toEqual([rec1]);
    expect(result.current.error).toBeNull();
  });

  // ── all-null records ────────────────────────────────────────────────────────

  it("returns an empty array when every getRecord returns null", async () => {
    mockGetAllowlist.mockResolvedValue(["G1", "G2", "G3"]);
    mockGetRecord.mockResolvedValue(null);

    const { result } = renderHook(() => useAllowlist("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // ── refetch ─────────────────────────────────────────────────────────────────

  it("re-fetches and updates the data when refetch is called", async () => {
    const rec1 = makeRecord("G1", "US");
    const rec2 = makeRecord("G2", "DE");
    mockGetAllowlist
      .mockResolvedValueOnce(["G1"])
      .mockResolvedValueOnce(["G1", "G2"]);
    mockGetRecord
      .mockResolvedValueOnce(rec1)
      .mockResolvedValueOnce(rec1)
      .mockResolvedValueOnce(rec2);

    const { result } = renderHook(() => useAllowlist("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data).toEqual([rec1, rec2]);
  });
});

// ==============================================================================
// useComplianceOverview
// ==============================================================================

describe("useComplianceOverview", () => {
  // ── disabled state ──────────────────────────────────────────────────────────

  it("returns loading=false and data=null when complianceId is null", () => {
    const { result } = renderHook(() => useComplianceOverview(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetAllowlist).not.toHaveBeenCalled();
  });

  // ── loading state ───────────────────────────────────────────────────────────

  it("starts in loading=true when a complianceId is provided", () => {
    mockGetAllowlist.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // ── error state ─────────────────────────────────────────────────────────────

  it("surfaces an error and clears loading when getAllowlist rejects", async () => {
    mockGetAllowlist.mockRejectedValue(new Error("Contract unavailable"));

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Contract unavailable");
    expect(result.current.data).toBeNull();
  });

  it("surfaces an error when isJurisdictionBlocked rejects mid-flight", async () => {
    mockGetAllowlist.mockResolvedValue(["G1"]);
    mockGetRecord.mockResolvedValue(makeRecord("G1", "US"));
    mockIsJurisdictionBlocked.mockRejectedValue(new Error("Jurisdiction check failed"));

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Jurisdiction check failed");
    expect(result.current.data).toBeNull();
  });

  // ── empty allowlist ─────────────────────────────────────────────────────────

  it("returns zero size and empty jurisdictions when the allowlist is empty", async () => {
    mockGetAllowlist.mockResolvedValue([]);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ allowlistSize: 0, jurisdictions: [] });
    expect(result.current.error).toBeNull();
    // Neither getRecord nor isJurisdictionBlocked should be called for an
    // empty list.
    expect(mockGetRecord).not.toHaveBeenCalled();
    expect(mockIsJurisdictionBlocked).not.toHaveBeenCalled();
  });

  // ── null-record filtering ────────────────────────────────────────────────────

  it("excludes null records from jurisdiction extraction", async () => {
    // G1 has a record; G2 was removed and returns null.
    // The overview should still count both addresses (allowlistSize=2) but
    // only US should appear in jurisdictions.
    mockGetAllowlist.mockResolvedValue(["G1", "G2"]);
    mockGetRecord
      .mockResolvedValueOnce(makeRecord("G1", "US"))
      .mockResolvedValueOnce(null);
    mockIsJurisdictionBlocked.mockResolvedValue(false);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.allowlistSize).toBe(2);
    expect(result.current.data?.jurisdictions).toEqual([
      { code: "US", blocked: false },
    ]);
  });

  it("returns empty jurisdictions when all records are null", async () => {
    mockGetAllowlist.mockResolvedValue(["G1", "G2"]);
    mockGetRecord.mockResolvedValue(null);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.allowlistSize).toBe(2);
    expect(result.current.data?.jurisdictions).toEqual([]);
    expect(mockIsJurisdictionBlocked).not.toHaveBeenCalled();
  });

  // ── jurisdiction deduplication ───────────────────────────────────────────────

  it("deduplicates jurisdiction codes when multiple addresses share the same code", async () => {
    // Three US addresses — should produce a single "US" entry, not three.
    mockGetAllowlist.mockResolvedValue(["G1", "G2", "G3"]);
    mockGetRecord
      .mockResolvedValueOnce(makeRecord("G1", "US"))
      .mockResolvedValueOnce(makeRecord("G2", "US"))
      .mockResolvedValueOnce(makeRecord("G3", "US"));
    mockIsJurisdictionBlocked.mockResolvedValue(false);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.jurisdictions).toHaveLength(1);
    expect(result.current.data?.jurisdictions.at(0)?.code).toBe("US");
    // isJurisdictionBlocked should have been called exactly once for "US".
    expect(mockIsJurisdictionBlocked).toHaveBeenCalledTimes(1);
    expect(mockIsJurisdictionBlocked).toHaveBeenCalledWith("testnet", "C_ID", "US");
  });

  it("deduplicates mixed jurisdictions and keeps each unique code once", async () => {
    // G1=US, G2=DE, G3=US  →  [DE, US] after dedup+sort
    mockGetAllowlist.mockResolvedValue(["G1", "G2", "G3"]);
    mockGetRecord
      .mockResolvedValueOnce(makeRecord("G1", "US"))
      .mockResolvedValueOnce(makeRecord("G2", "DE"))
      .mockResolvedValueOnce(makeRecord("G3", "US"));
    mockIsJurisdictionBlocked.mockResolvedValue(false);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.jurisdictions).toHaveLength(2);
    // isJurisdictionBlocked called once per unique code.
    expect(mockIsJurisdictionBlocked).toHaveBeenCalledTimes(2);
  });

  // ── alphabetical sort ────────────────────────────────────────────────────────

  it("returns jurisdictions sorted alphabetically by code", async () => {
    mockGetAllowlist.mockResolvedValue(["G1", "G2", "G3"]);
    mockGetRecord
      .mockResolvedValueOnce(makeRecord("G1", "NG"))
      .mockResolvedValueOnce(makeRecord("G2", "DE"))
      .mockResolvedValueOnce(makeRecord("G3", "US"));
    mockIsJurisdictionBlocked.mockResolvedValue(false);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const codes = result.current.data?.jurisdictions.map((j) => j.code);
    expect(codes).toEqual(["DE", "NG", "US"]);
  });

  // ── blocked status ───────────────────────────────────────────────────────────

  it("marks a jurisdiction as blocked when isJurisdictionBlocked returns true", async () => {
    mockGetAllowlist.mockResolvedValue(["G1", "G2"]);
    mockGetRecord
      .mockResolvedValueOnce(makeRecord("G1", "KP"))
      .mockResolvedValueOnce(makeRecord("G2", "US"));
    // KP is blocked, US is not.
    mockIsJurisdictionBlocked.mockImplementation(
      async (_net, _id, code) => code === "KP",
    );

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.jurisdictions).toEqual([
      { code: "KP", blocked: true },
      { code: "US", blocked: false },
    ]);
  });

  // ── allowlist size accuracy ──────────────────────────────────────────────────

  it("reports allowlistSize equal to the number of addresses, including those with null records", async () => {
    mockGetAllowlist.mockResolvedValue(["G1", "G2", "G3", "G4"]);
    mockGetRecord
      .mockResolvedValueOnce(makeRecord("G1", "US"))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeRecord("G3", "DE"))
      .mockResolvedValueOnce(null);
    mockIsJurisdictionBlocked.mockResolvedValue(false);

    const { result } = renderHook(() => useComplianceOverview("C_ID"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // All 4 addresses count towards the size even if some lack records.
    expect(result.current.data?.allowlistSize).toBe(4);
    expect(result.current.data?.jurisdictions).toHaveLength(2);
  });
});
