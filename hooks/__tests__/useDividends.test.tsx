import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDividends } from '../useDividends';

// Mock the RPC / contract layer so no keys or funded account are needed.
const getDividendsMock = vi.fn();

vi.mock('../../lib/contracts', () => ({
  getDividends: (...args: unknown[]) => getDividendsMock(...args),
}));

describe('useDividends', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getDividendsMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('does not warn about state updates when unmounted during an in-flight call', async () => {
    let resolveDividends: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveDividends = resolve;
    });
    getDividendsMock.mockReturnValue(pending);

    const { unmount } = renderHook(() => useDividends('GTEST'));

    // Unmount while the async call is still pending.
    unmount();

    // Resolve the in-flight call after unmount.
    resolveDividends({ total: '0', claimed: '0', claimable: '0' });

    // Flush any pending microtasks / effects.
    await waitFor(() => {
      expect(getDividendsMock).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('unmounted component'),
    );
    expect(stateUpdateWarnings).toHaveLength(0);
  });
});
