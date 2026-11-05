import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useActivity } from './useActivity';

describe('useActivity', () => {
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

    const { result } = renderHook(() => useActivity('GABC123'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('RPC unavailable');
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('surfaces a non-ok response as readable error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useActivity('GABC123'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
  });

  // Empty/zero/null input: the hook must not fetch and must settle into a
  // deliberate empty state (no data, no error, not loading) rather than
  // firing a request for a missing account.
  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('does not fetch and returns an empty state for %s input', async (_label, input) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() =>
      useActivity(input as unknown as string),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.error).toBeFalsy();
    expect(result.current.data ?? []).toEqual([]);
  });

  // Stale closure / dependency array coverage: when the account argument
  // changes, the hook must re-run its effect against the *new* value rather
  // than reusing a closure captured on the first render.
  it('refetches with the new account when the argument changes', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

    const { rerender } = renderHook(
      ({ account }: { account: string }) => useActivity(account),
      { initialProps: { account: 'GABC123' } },
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    rerender({ account: 'GDEF456' });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // The second request must target the updated account, proving the effect
    // is not closing over the stale initial value.
    const secondCallUrl = String(fetchSpy.mock.calls[1][0]);
    expect(secondCallUrl).toContain('GDEF456');
    expect(secondCallUrl).not.toContain('GABC123');
  });

  it('does not refetch when the account argument is unchanged across rerenders', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

    const { rerender } = renderHook(
      ({ account }: { account: string }) => useActivity(account),
      { initialProps: { account: 'GABC123' } },
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    rerender({ account: 'GABC123' });

    // Give any stray effect a chance to fire before asserting stability.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // Unmount during an in-flight async call: the hook must not attempt to set
  // state after the component has unmounted, which would trigger React's
  // "state update on an unmounted component" warning.
  it('does not warn when unmounted while a fetch is in flight', async () => {
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

    const { unmount } = renderHook(() => useActivity('GABC123'));

    // The request is in flight; unmount before it settles.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Now let the in-flight request resolve after unmount.
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);

    // Flush pending microtasks so any post-unmount state update would surface.
    await Promise.resolve();
    await Promise.resolve();

    const unmountedWarning = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0]).includes('unmounted component'),
    );
    expect(unmountedWarning).toBeUndefined();
  });
});
