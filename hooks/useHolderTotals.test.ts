import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useHolderTotals } from "./useHolderTotals";

describe("useHolderTotals", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces a rejected fetch as readable error state instead of throwing", async () => {
    const failure = new Error("RPC unavailable");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(failure);

    const { result } = renderHook(() => useHolderTotals());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("RPC unavailable");
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("does not throw an unhandled exception when the request rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

    let renderError: unknown;
    try {
      const { result } = renderHook(() => useHolderTotals());
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    } catch (err) {
      renderError = err;
    }

    expect(renderError).toBeUndefined();
  });
});
