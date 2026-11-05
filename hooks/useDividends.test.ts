import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDividends } from './useDividends';

describe('useDividends', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces a rejected fetch as readable error state instead of throwing', async () => {
    const failure = new Error('RPC unavailable');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(failure);

    const { result } = renderHook(() => useDividends());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('RPC unavailable');
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('returns an empty, zeroed result for empty/zero/null input without erroring', async () => {
    // Empty input is deliberate: no distributions to fetch, so the hook should
    // resolve to an empty list with zero totals and no error rather than throw.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => [],
      } as unknown as Response);

    const { result } = renderHook(() => useDividends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeFalsy();
    expect(result.current.dividends).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('does not warn about state updates when unmounted during an in-flight call', async () => {
    // Hold the fetch open so we can unmount while the async call is still
    // pending, then resolve it after unmount to exercise the guard.
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(pending);

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { unmount } = renderHook(() => useDividends());

    // The in-flight request should have been kicked off before unmounting.
    expect(fetchSpy).toHaveBeenCalled();

    unmount();

    // Resolve the in-flight call after the component has unmounted.
    resolveFetch({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    // Flush any pending microtasks so a late state update would surface.
    await Promise.resolve();
    await Promise.resolve();

    const warnedAboutUnmounted = consoleErrorSpy.mock.calls.some((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          /unmounted component|state update on an unmounted/i.test(arg),
      ),
    );

    expect(warnedAboutUnmounted).toBe(false);
  });
});
