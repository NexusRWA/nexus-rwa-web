import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompliance } from './useCompliance';

const mockGetCompliance = vi.fn();

vi.mock('@/lib/contracts', () => ({
  getCompliance: (...args: unknown[]) => mockGetCompliance(...args),
}));

describe('useCompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces a rejected compliance lookup as readable error state', async () => {
    mockGetCompliance.mockRejectedValueOnce(new Error('RPC unavailable'));

    const { result } = renderHook(() => useCompliance('GABC123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('RPC unavailable');
    expect(result.current.compliance).toBeNull();
  });
});
