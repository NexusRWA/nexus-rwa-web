/**
 * Tests for hooks/useAsync.ts — out-of-order response guard and the
 * enabled=false deferral path. Loaders are controlled deferred promises, so no
 * real timers are involved.
 */

import { act, renderHook } from "@testing-library/react";
import { useAsync } from "@/hooks/useAsync";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsync out-of-order guard", () => {
  it("ignores a slow earlier response that resolves after a newer one", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const loader = jest
      .fn<Promise<string>, [number]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ id }) => useAsync(() => loader(id), [id]),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });
    expect(loader).toHaveBeenCalledTimes(2);

    // Newer request resolves first...
    await act(async () => {
      second.resolve("new");
    });
    expect(result.current.data).toBe("new");
    expect(result.current.loading).toBe(false);

    // ...then the stale one lands and must not overwrite it.
    await act(async () => {
      first.resolve("stale");
    });
    expect(result.current.data).toBe("new");
    expect(result.current.loading).toBe(false);
  });

  it("does not let a stale rejection clobber a newer result", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const loader = jest
      .fn<Promise<string>, [number]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ id }) => useAsync(() => loader(id), [id]),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });

    await act(async () => {
      second.resolve("new");
    });
    await act(async () => {
      first.reject(new Error("stale failure"));
    });

    expect(result.current.data).toBe("new");
    expect(result.current.error).toBeNull();
  });
});

describe("useAsync enabled=false", () => {
  it("does not call the loader and is not loading while disabled", () => {
    const loader = jest.fn().mockResolvedValue("x");
    const { result } = renderHook(() => useAsync(loader, [], false));

    expect(loader).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("fetches exactly once when enabled flips to true", async () => {
    const loader = jest.fn().mockResolvedValue("ready");
    const { result, rerender } = renderHook(
      ({ enabled }) => useAsync(loader, [], enabled),
      { initialProps: { enabled: false } },
    );
    expect(loader).not.toHaveBeenCalled();

    await act(async () => {
      rerender({ enabled: true });
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("ready");
    expect(result.current.loading).toBe(false);
  });
});
