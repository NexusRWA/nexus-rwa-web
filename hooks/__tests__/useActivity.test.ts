import { renderHook, waitFor } from "@testing-library/react";
import { api, type ApiEvent } from "@/lib/api";
import { useActivity } from "../useActivity";

jest.mock("@/lib/api", () => ({
  API_MAX_PAGES: 50,
  API_PAGE_SIZE: 100,
  api: {
    getEvents: jest.fn(),
    isConfigured: jest.fn(),
  },
}));

const mockGetEvents = api.getEvents as jest.MockedFunction<typeof api.getEvents>;
const mockIsConfigured = api.isConfigured as jest.MockedFunction<
  typeof api.isConfigured
>;

function makeEvent(overrides: Partial<ApiEvent> = {}): ApiEvent {
  return {
    id: 1,
    contract: "CTOKEN_A",
    event_type: "Transfer",
    ledger: 100,
    timestamp: "2026-07-09T08:43:12.101Z",
    data: { from: "GFROM", to: "GTO", amount: "9007199254740993" },
    ...overrides,
  };
}

describe("useActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
  });

  it("filters the event feed to valid transfers for the requested token", async () => {
    mockGetEvents.mockResolvedValue([
      makeEvent(),
      makeEvent({ id: 2, contract: "CTOKEN_B" }),
      makeEvent({ id: 3, event_type: "Mint" }),
      makeEvent({ id: 4, data: { from: "GFROM", to: "GTO", amount: "not-an-integer" } }),
    ]);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([
      {
        id: 1,
        from: "GFROM",
        to: "GTO",
        amount: 9007199254740993n,
        ledger: 100,
        timestamp: "2026-07-09T08:43:12.101Z",
      },
    ]);
  });

  it("returns an explicit error when the indexing API is unavailable", async () => {
    mockGetEvents.mockResolvedValue(null);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/indexing API/i);
  });

  it("loads a long activity feed across pages without duplicates or gaps", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      makeEvent({ id: index + 1 }),
    );
    const secondPage = Array.from({ length: 100 }, (_, index) =>
      makeEvent({ id: index + 101 }),
    );
    const finalPage = [makeEvent({ id: 201 })];
    mockGetEvents
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)
      .mockResolvedValueOnce(finalPage);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetEvents).toHaveBeenNthCalledWith(1, { offset: 0, limit: 100 });
    expect(mockGetEvents).toHaveBeenNthCalledWith(2, { offset: 100, limit: 100 });
    expect(mockGetEvents).toHaveBeenNthCalledWith(3, { offset: 200, limit: 100 });
    expect(result.current.data?.map((event) => event.id)).toEqual(
      Array.from({ length: 201 }, (_, index) => index + 1),
    );
  });

  it("returns an empty disabled state when the indexing API is not configured", () => {
    mockIsConfigured.mockReturnValue(false);

    const { result } = renderHook(() => useActivity("CTOKEN_A"));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  it("does not request events when there is no token contract", () => {
    const { result } = renderHook(() => useActivity(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockGetEvents).not.toHaveBeenCalled();
  });
});
