import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useContractErrors } from './contractErrors';

describe('useContractErrors unmount during in-flight async call', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('does not warn about state updates on an unmounted component', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => pending as Promise<Response>);

    const { unmount } = renderHook(() => useContractErrors('CTESTCONTRACT'));

    // Unmount while the async call is still in flight.
    unmount();

    // Resolve the in-flight call after unmount.
    resolveFetch({
      ok: true,
      json: async () => ({ errors: [] }),
    } as unknown as Response);

    // Allow any pending microtasks/effects to flush.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    await Promise.resolve();

    const unmountedWarning = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0]).includes('unmounted component'),
    );
    expect(unmountedWarning).toBeUndefined();
  });
});

describe('useContractErrors network switch mid-session', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not show stale-network data after switching networks', async () => {
    const testnetErrors = [{ code: 'TESTNET_ONLY', message: 'testnet error' }];
    const mainnetErrors = [{ code: 'MAINNET_ONLY', message: 'mainnet error' }];

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        const errors = url.includes('testnet') ? testnetErrors : mainnetErrors;
        return Promise.resolve({
          ok: true,
          json: async () => ({ errors }),
        } as unknown as Response);
      });

    const { result, rerender } = renderHook(
      ({ network }: { network: 'testnet' | 'mainnet' }) =>
        useContractErrors('CTESTCONTRACT', network),
      { initialProps: { network: 'testnet' as 'testnet' | 'mainnet' } },
    );

    // Wait for the testnet data to be cached.
    await waitFor(() => {
      expect(result.current).toEqual(testnetErrors);
    });

    // Switch the selected network mid-session.
    rerender({ network: 'mainnet' });

    // Stale testnet data must not be shown after the switch.
    expect(result.current).not.toEqual(testnetErrors);

    // Mainnet data should eventually replace it.
    await waitFor(() => {
      expect(result.current).toEqual(mainnetErrors);
    });

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('ignores an in-flight response from the previous network after switching', async () => {
    let resolveTestnet: (value: unknown) => void = () => {};
    const pendingTestnet = new Promise((resolve) => {
      resolveTestnet = resolve;
    });

    const mainnetErrors = [{ code: 'MAINNET_ONLY', message: 'mainnet error' }];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('testnet')) {
        return pendingTestnet as Promise<Response>;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ errors: mainnetErrors }),
      } as unknown as Response);
    });

    const { result, rerender } = renderHook(
      ({ network }: { network: 'testnet' | 'mainnet' }) =>
        useContractErrors('CTESTCONTRACT', network),
      { initialProps: { network: 'testnet' as 'testnet' | 'mainnet' } },
    );

    // Switch networks while the testnet request is still in flight.
    rerender({ network: 'mainnet' });

    await waitFor(() => {
      expect(result.current).toEqual(mainnetErrors);
    });

    // Resolve the stale testnet request after the switch.
    resolveTestnet({
      ok: true,
      json: async () => ({
        errors: [{ code: 'TESTNET_ONLY', message: 'testnet error' }],
      }),
    } as unknown as Response);
    await Promise.resolve();

    // Stale-network data must not leak into the UI.
    expect(result.current).toEqual(mainnetErrors);
  });
});
