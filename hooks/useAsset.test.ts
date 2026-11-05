import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAsset } from './useAsset';

// Mock the network context so we can switch networks mid-session.
const networkState = vi.hoisted(() => ({
  network: 'testnet' as 'testnet' | 'mainnet',
}));

vi.mock('@/context/NetworkContext', () => ({
  useNetwork: () => ({ network: networkState.network }),
}));

// Mock the RPC layer so each network returns distinct data.
const fetchAsset = vi.hoisted(() => vi.fn());

vi.mock('@/lib/rpc', () => ({
  fetchAsset,
}));

describe('useAsset network switch', () => {
  beforeEach(() => {
    networkState.network = 'testnet';
    fetchAsset.mockReset();
  });

  it('does not show stale-network data after switching networks', async () => {
    fetchAsset.mockImplementation(async (network: string) => ({
      network,
      symbol: network === 'testnet' ? 'TST' : 'MAIN',
    }));

    const { result, rerender } = renderHook(() => useAsset('native'));

    await waitFor(() => {
      expect(result.current.asset?.symbol).toBe('TST');
    });

    // Switch network mid-session.
    networkState.network = 'mainnet';
    rerender();

    // Stale testnet data must not leak into the UI after the switch.
    expect(result.current.asset?.symbol).not.toBe('TST');

    await waitFor(() => {
      expect(result.current.asset?.symbol).toBe('MAIN');
    });
  });

  it('ignores in-flight responses from the previous network', async () => {
    let resolveTestnet: (value: unknown) => void = () => {};
    const testnetPromise = new Promise((resolve) => {
      resolveTestnet = resolve;
    });

    fetchAsset.mockImplementation((network: string) => {
      if (network === 'testnet') return testnetPromise;
      return Promise.resolve({ network, symbol: 'MAIN' });
    });

    const { result, rerender } = renderHook(() => useAsset('native'));

    // Switch network while the testnet request is still in flight.
    networkState.network = 'mainnet';
    rerender();

    await waitFor(() => {
      expect(result.current.asset?.symbol).toBe('MAIN');
    });

    // Resolve the stale testnet request after the switch.
    resolveTestnet({ network: 'testnet', symbol: 'TST' });

    await waitFor(() => {
      expect(result.current.asset?.symbol).toBe('MAIN');
    });
  });
});
