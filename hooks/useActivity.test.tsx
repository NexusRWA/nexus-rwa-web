import { renderHook, waitFor } from '@testing-library/react';
import { useActivity } from './useActivity';

// Mock the RPC / wallet layer so no keys or funded account are needed.
const mockFetchActivity = jest.fn();

jest.mock('./useActivity', () => {
  const actual = jest.requireActual('./useActivity');
  return {
    ...actual,
    __esModule: true,
  };
});

describe('useActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not warn about state updates when unmounted during an in-flight async call', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    mockFetchActivity.mockReturnValue(pending);

    const { unmount } = renderHook(() => useActivity('GABC123'));

    // Unmount while the async call is still in flight.
    unmount();

    // Resolve the in-flight call after unmount.
    resolveFetch({ data: [] });

    // Allow any pending microtasks / effects to flush.
    await waitFor(() => {
      expect(mockFetchActivity).toHaveBeenCalled();
    });

    const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('unmounted component')
    );
    expect(stateUpdateWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });
});
