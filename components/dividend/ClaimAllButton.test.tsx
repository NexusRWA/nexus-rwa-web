import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DistributionWithClaim } from "@/hooks/useDividends";
import { ClaimAllButton } from "./ClaimAllButton";
import { dividend } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import type { WriteCtx } from "@/lib/contracts";

jest.mock("@/hooks/useWallet", () => ({ useWallet: jest.fn() }));
jest.mock("@/hooks/useTx", () => ({ useTx: jest.fn() }));
jest.mock("@/lib/contracts", () => ({ dividend: { claim: jest.fn() } }));
jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: () => <div data-testid="tx-progress" />,
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;
const mockClaim = dividend.claim as jest.MockedFunction<typeof dividend.claim>;

const ctx: WriteCtx = {
  network: "testnet" as const,
  source: "GWALLET",
  sign: jest.fn(),
};

const distributions: DistributionWithClaim[] = [1n, 2n, 3n].map((id) => ({
  id,
  assetToken: "CTOKEN",
  paymentToken: "CPAYMENT",
  totalAmount: 1000n,
  distributed: 0n,
  createdAt: 100,
  completed: false,
  paymentTokenDecimals: 7,
  claimable: 100n,
  claimed: false,
}));

function setup(
  run: ReturnType<typeof useTx>["run"] = jest.fn((action) => action(ctx)),
) {
  mockUseWallet.mockReturnValue({
    address: "GWALLET",
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    connecting: false,
    installed: true,
    network: "testnet",
    walletNetwork: null,
    networkUnknown: false,
    error: null,
    setNetwork: jest.fn(),
    sign: jest.fn(),
    writeCtx: jest.fn(),
  });
  mockUseTx.mockReturnValue({
    phase: "idle",
    hash: null,
    error: null,
    errorType: "generic",
    pending: false,
    estimatedFee: null,
    run,
    retryable: false,
    retry: jest.fn(),
    reset: jest.fn(),
  });
  return run;
}

describe("ClaimAllButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaim.mockResolvedValue({ hash: "tx-hash" });
  });

  it("submits each claim in sequence and refreshes after completion", async () => {
    const run = setup();
    const onClaimed = jest.fn();
    render(
      <ClaimAllButton distributions={distributions} onClaimed={onClaimed} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Claim all 3 distributions" }),
    );

    await waitFor(() => expect(onClaimed).toHaveBeenCalledTimes(1));
    expect(run).toHaveBeenCalledTimes(3);
    expect(mockClaim.mock.calls.map(([, id]) => id)).toEqual([1n, 2n, 3n]);
    expect(
      screen.getByRole("button", { name: "Claim all 3 distributions" }),
    ).toBeInTheDocument();
  });

  it("stops after a failed claim and refreshes successful partial claims", async () => {
    const run: ReturnType<typeof useTx>["run"] = jest.fn(async (action) => {
      try {
        return await action(ctx);
      } catch {
        return null;
      }
    });
    setup(run);
    mockClaim
      .mockResolvedValueOnce({ hash: "tx-1" })
      .mockRejectedValueOnce(new Error("Claim failed"));
    const onClaimed = jest.fn();

    render(
      <ClaimAllButton distributions={distributions} onClaimed={onClaimed} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Claim all 3 distributions" }),
    );

    await waitFor(() => expect(onClaimed).toHaveBeenCalledTimes(1));
    expect(mockClaim).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Claimed 1 of 3; remaining claims were not submitted.",
    );
  });

  it("does not show a bulk action for fewer than two claimable distributions", () => {
    setup();
    render(
      <ClaimAllButton
        distributions={[{ ...distributions[0]!, claimed: true }, distributions[1]!]}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
