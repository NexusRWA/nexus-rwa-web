/**
 * Unit tests for lib/requestCache.ts
 *
 * Scenarios covered:
 *
 * dedupeRequest
 *   - Calls the factory once when two concurrent callers use the same key
 *   - Calls the factory separately for different keys
 *   - Calls the factory again after the first promise settles (and the
 *     internal setTimeout(0) cleanup has run)
 *   - Shares a rejection with all concurrent callers
 *   - Does not re-use a rejected entry (next call invokes factory again)
 *   - Re-uses the same entry within the 5 s window even after settlement
 *
 * clearRequestCache
 *   - Resets all in-flight entries so the next call invokes the factory
 */

import { dedupeRequest, clearRequestCache } from "../requestCache";

// ─── tests ────────────────────────────────────────────────────────────────────

describe("dedupeRequest", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearRequestCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRequestCache();
  });

  // ── concurrent callers ─────────────────────────────────────────────────

  it("calls the factory once for concurrent callers sharing the same key", async () => {
    const factory = jest.fn().mockResolvedValue("result");

    const requests = Array.from({ length: 5 }, () =>
      dedupeRequest("key-a", factory),
    );

    expect(factory).toHaveBeenCalledTimes(1);
    requests.forEach((request) => expect(request).toBe(requests[0]));

    await expect(Promise.all(requests)).resolves.toEqual(
      Array(5).fill("result"),
    );
  });

  it("calls the factory separately for different keys", async () => {
    const factoryA = jest.fn().mockResolvedValue("a");
    const factoryB = jest.fn().mockResolvedValue("b");

    const pA = dedupeRequest("key-a", factoryA);
    const pB = dedupeRequest("key-b", factoryB);

    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
    expect(pA).not.toBe(pB);

    await expect(pA).resolves.toBe("a");
    await expect(pB).resolves.toBe("b");
  });

  // ── post-settlement refetch ────────────────────────────────────────────

  it("calls the factory again after settlement and the cleanup setTimeout(0) fires", async () => {
    const factory = jest.fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const p1 = dedupeRequest("key-a", factory);
    await p1; // settle the promise

    // Run the setTimeout(0) cleanup that requestCache registers internally
    jest.runAllTimers();

    const p2 = dedupeRequest("key-a", factory);
    expect(factory).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toBe("second");
  });

  // ── within the 5 s window ──────────────────────────────────────────────

  it("re-uses the same entry within the 5 s dedup window", () => {
    const factory = jest.fn().mockReturnValue(new Promise(() => {}));

    const p1 = dedupeRequest("key-a", factory);
    jest.advanceTimersByTime(4_999);
    const p2 = dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);
  });

  it("calls the factory again after the 5 s window expires", () => {
    const factory = jest.fn().mockReturnValue(new Promise(() => {}));

    dedupeRequest("key-a", factory);
    jest.advanceTimersByTime(5_001);
    dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(2);
  });

  // ── rejection handling ─────────────────────────────────────────────────

  it("shares a rejection with all concurrent callers for the same key", async () => {
    const err = new Error("network failure");
    const factory = jest.fn().mockRejectedValue(err);

    const p1 = dedupeRequest("key-a", factory);
    const p2 = dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);

    await expect(p1).rejects.toThrow("network failure");
    await expect(p2).rejects.toThrow("network failure");
  });

  it("does not cache a rejected entry — next call invokes factory again", async () => {
    const err = new Error("transient error");
    const factory = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce("recovered");

    const p1 = dedupeRequest("key-a", factory);
    await expect(p1).rejects.toThrow("transient error");

    // Flush the setTimeout(0) cleanup
    jest.runAllTimers();

    const p2 = dedupeRequest("key-a", factory);
    expect(factory).toHaveBeenCalledTimes(2);
    await expect(p2).resolves.toBe("recovered");
  });
});

// ─── clearRequestCache ─────────────────────────────────────────────────────────

describe("clearRequestCache", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearRequestCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRequestCache();
  });

  it("resets all entries so the next call invokes the factory", () => {
    const factory = jest.fn().mockReturnValue(new Promise(() => {}));

    dedupeRequest("key-a", factory);
    dedupeRequest("key-b", factory);
    expect(factory).toHaveBeenCalledTimes(2);

    clearRequestCache();

    dedupeRequest("key-a", factory);
    dedupeRequest("key-b", factory);
    expect(factory).toHaveBeenCalledTimes(4);
  });

  it("allows concurrent calls after clear to share a single factory invocation", async () => {
    const factory = jest.fn().mockResolvedValue("after-clear");

    dedupeRequest("key-a", factory);
    clearRequestCache();

    const p1 = dedupeRequest("key-a", factory);
    const p2 = dedupeRequest("key-a", factory);

    expect(factory).toHaveBeenCalledTimes(2); // 1 before clear + 1 after
    expect(p1).toBe(p2);
    await expect(p1).resolves.toBe("after-clear");
  });
});
