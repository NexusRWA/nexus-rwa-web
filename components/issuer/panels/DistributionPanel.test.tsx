import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { DistributionPanel } from "./DistributionPanel";

// Mock the wallet so the panel renders without a funded account.
// `network` is a mutable binding so individual tests can switch it mid-session.
const walletState: { address: string | null; network: string } = {
  address: null,
  network: "testnet",
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ address: walletState.address, network: walletState.network }),
}));

// Mock the transaction hook so no RPC is touched.
vi.mock("@/hooks/useTx", () => ({
  useTx: () => ({
    run: vi.fn(),
    status: "idle",
    error: null,
    hash: null,
    reset: vi.fn(),
  }),
}));

// Empty holder set: the compliance/token contracts report no holders.
vi.mock("@/hooks/useHolders", () => ({
  useHolders: () => ({ data: [], loading: false, error: null }),
  fetchOnChainHolders: vi.fn(async () => []),
}));

// No existing distributions for the asset.
vi.mock("@/hooks/useDividends", () => ({
  useDividends: () => ({ data: [], loading: false, error: null }),
}));

// Avoid any network calls from the async balance/allowance/decimals lookups.
vi.mock("@/lib/contracts", () => ({
  assetToken: {
    balance: vi.fn(async () => 0n),
    allowance: vi.fn(async () => 0n),
    decimals: vi.fn(async () => 7),
  },
  contractIds: () => ({ dividend: "CDIVIDENDCONTRACT000000000000000000000000000000000000000000" }),
  dividend: {},
}));

vi.mock("@/lib/stellar", () => ({
  getLatestLedger: vi.fn(async () => 0),
  arg: vi.fn(),
}));

function makeAsset(overrides: Partial<AssetDetail> = {}): AssetDetail {
  return {
    tokenContract: "CTOKENCONTRACT00000000000000000000000000000000000000000000",
    metadata: {
      symbol: "",
      decimals: 0,
      complianceContract: "CCOMPLIANCECONTRACT0000000000000000000000000000000000000000",
    },
    ...overrides,
  } as AssetDetail;
}

describe("DistributionPanel empty/zero input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create form and empty distributions state without crashing when there are no holders and no existing distributions", () => {
    render(<DistributionPanel asset={makeAsset()} />);

    // The panel still renders its required-role notice and create form.
    expect(screen.getByText(/Required role:/i)).toBeInTheDocument();

    // With zero holders and zero existing distributions, the panel must not
    // throw and should surface an empty state rather than fabricated rows.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats an empty symbol and zero decimals as deliberate defaults (no crash, no NaN)", () => {
    render(<DistributionPanel asset={makeAsset()} />);

    // Empty symbol / zero decimals are valid inputs; the panel renders the
    // form without producing NaN or throwing on the zero-decimal parse path.
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe("DistributionPanel dependency arrays / stale closures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-runs the async balance/allowance/decimals lookups when the asset prop changes", async () => {
    const contracts = await import("@/lib/contracts");
    const balanceSpy = contracts.assetToken.balance as unknown as ReturnType<typeof vi.fn>;
    const allowanceSpy = contracts.assetToken.allowance as unknown as ReturnType<typeof vi.fn>;
    const decimalsSpy = contracts.assetToken.decimals as unknown as ReturnType<typeof vi.fn>;

    const { rerender } = render(<DistributionPanel asset={makeAsset()} />);

    // Let the initial effect settle.
    await screen.findByText(/Required role:/i);
    const initialBalanceCalls = balanceSpy.mock.calls.length;
    const initialAllowanceCalls = allowanceSpy.mock.calls.length;
    const initialDecimalsCalls = decimalsSpy.mock.calls.length;

    // Swap in a different asset (new token contract). If the effect's
    // dependency array is missing `asset`, the lookups would not re-run and
    // the panel would keep showing stale balances for the previous asset.
    rerender(
      <DistributionPanel
        asset={makeAsset({
          tokenContract: "CTOKENCONTRACT11111111111111111111111111111111111111111111",
        })}
      />,
    );

    await screen.findByText(/Required role:/i);

    expect(balanceSpy.mock.calls.length).toBeGreaterThan(initialBalanceCalls);
    expect(allowanceSpy.mock.calls.length).toBeGreaterThan(initialAllowanceCalls);
    expect(decimalsSpy.mock.calls.length).toBeGreaterThan(initialDecimalsCalls);
  });

  it("does not re-run the lookups when re-rendered with an equivalent asset", async () => {
    const contracts = await import("@/lib/contracts");
    const balanceSpy = contracts.assetToken.balance as unknown as ReturnType<typeof vi.fn>;

    const { rerender } = render(<DistributionPanel asset={makeAsset()} />);

    await screen.findByText(/Required role:/i);
    const initialBalanceCalls = balanceSpy.mock.calls.length;

    // Same token contract: the effect should not thrash on unrelated renders.
    rerender(<DistributionPanel asset={makeAsset()} />);

    await screen.findByText(/Required role:/i);

    expect(balanceSpy.mock.calls.length).toBe(initialBalanceCalls);
  });
});

describe("DistributionPanel unmount during in-flight async call", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("does not warn about state updates on an unmounted component when unmounted mid-flight", async () => {
    const contracts = await import("@/lib/contracts");

    // Make the async lookups hang until we resolve them manually, so the
    // component is guaranteed to be unmounted while the calls are in flight.
    let resolveBalance: (value: bigint) => void = () => {};
    let resolveAllowance: (value: bigint) => void = () => {};
    let resolveDecimals: (value: number) => void = () => {};

    const balanceSpy = contracts.assetToken.balance as unknown as ReturnType<typeof vi.fn>;
    const allowanceSpy = contracts.assetToken.allowance as unknown as ReturnType<typeof vi.fn>;
    const decimalsSpy = contracts.assetToken.decimals as unknown as ReturnType<typeof vi.fn>;

    balanceSpy.mockImplementation(
      () => new Promise<bigint>((resolve) => { resolveBalance = resolve; }),
    );
    allowanceSpy.mockImplementation(
      () => new Promise<bigint>((resolve) => { resolveAllowance = resolve; }),
    );
    decimalsSpy.mockImplementation(
      () => new Promise<number>((resolve) => { resolveDecimals = resolve; }),
    );

    const { unmount } = render(<DistributionPanel asset={makeAsset()} />);

    // The lookups have been kicked off but not resolved yet.
    expect(balanceSpy).toHaveBeenCalled();

    // Unmount while the async calls are still pending.
    unmount();

    // Now resolve the in-flight promises after unmount. A component that
    // updates state without an unmount guard would trigger React's
    // "state update on an unmounted component" warning here.
    resolveBalance(0n);
    resolveAllowance(0n);
    resolveDecimals(7);

    // Flush pending microtasks so any post-unmount state updates run.
    await Promise.resolve();
    await Promise.resolve();

    const allCalls = [...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .map((args) => args.map((a) => String(a)).join(" "))
      .join("\n");

    expect(allCalls).not.toMatch(/unmounted component/i);
    expect(allCalls).not.toMatch(/Can't perform a React state update/i);
  });
});

describe("DistributionPanel network switch mid-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState.address = null;
    walletState.network = "testnet";
  });

  afterEach(() => {
    walletState.network = "testnet";
  });

  it("does not leak stale-network data into the UI when the network switches while a lookup is in flight", async () => {
    const contracts = await import("@/lib/contracts");

    const balanceSpy = contracts.assetToken.balance as unknown as ReturnType<typeof vi.fn>;
    const allowanceSpy = contracts.assetToken.allowance as unknown as ReturnType<typeof vi.fn>;
    const decimalsSpy = contracts.assetToken.decimals as unknown as ReturnType<typeof vi.fn>;

    // First (testnet) lookup hangs so we can switch networks while it is in
    // flight; the second (mainnet) lookup resolves immediately.
    let resolveTestnetBalance: (value: bigint) => void = () => {};
    let callCount = 0;
    balanceSpy.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<bigint>((resolve) => { resolveTestnetBalance = resolve; });
      }
      return Promise.resolve(0n);
    });
    allowanceSpy.mockImplementation(async () => 0n);
    decimalsSpy.mockImplementation(async () => 7);

    const { rerender } = render(<DistributionPanel asset={makeAsset()} />);

    // The testnet lookup has been kicked off but not resolved yet.
    expect(balanceSpy).toHaveBeenCalled();

    // Switch the selected network mid-session (testnet -> mainnet).
    walletState.network = "mainnet";
    rerender(<DistributionPanel asset={makeAsset()} />);

    // Now resolve the stale testnet lookup after the switch. A panel that
    // does not guard against cross-network responses would apply this value
    // to the mainnet view.
    resolveTestnetBalance(123456789n);

    // Flush pending microtasks so any post-switch state updates run.
    await Promise.resolve();
    await Promise.resolve();

    // The stale testnet balance must not be rendered after the switch.
    expect(screen.queryByText(/123456789/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,234,567\.89/)).not.toBeInTheDocument();

    // The panel still renders its required-role notice and no error alert.
    expect(screen.getByText(/Required role:/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
