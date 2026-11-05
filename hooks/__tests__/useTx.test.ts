import { renderHook, act } from "@testing-library/react";
import { useTx } from "../useTx";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/components/ui/ToastProvider";
import type { WriteCtx } from "@/lib/contracts";
import type { TxPhase } from "@/types";
import { LockedWalletError, UserRejectedError } from "@/lib/freighter";
import { TransactionTimeoutError } from "@/lib/stellar";

// ─── mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/components/ui/ToastProvider", () => ({
  useToast: jest.fn(),
}));

const mockUseWallet = useWallet as jest.Mock;
const mockUseToast = useToast as jest.Mock;

// ─── tests ────────────────────────────────────────────────────────────────────

describe("useTx", () => {
  let mockAddToast: jest.Mock;
  let mockWriteCtx: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddToast = jest.fn();
    mockUseToast.mockReturnValue({ addToast: mockAddToast });
    mockWriteCtx = jest.fn((onPhase?: (phase: TxPhase) => void) => ({
      network: "testnet",
      address: "GUSER123",
      onPhase,
    }));
    mockUseWallet.mockReturnValue({ writeCtx: mockWriteCtx });
  });

  it("initializes with idle phase, null hash, null error, and pending=false", () => {
    const { result } = renderHook(() => useTx());

    expect(result.current.phase).toBe("idle");
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });

  it("transitions through submitting and success states and exposes tx hash", async () => {
    const { result } = renderHook(() => useTx());

    let resolveAction: (val: any) => void = () => {};
    const actionPromise = new Promise((resolve) => {
      resolveAction = resolve;
    });

    let runPromise: Promise<any>;
    act(() => {
      runPromise = result.current.run(async (ctx: WriteCtx) => {
        ctx.onPhase?.("signing");
        ctx.onPhase?.("submitting");
        return actionPromise as any;
      });
    });

    expect(result.current.pending).toBe(true);

    await act(async () => {
      resolveAction({ hash: "0x123abc", status: "SUCCESS" });
      await runPromise;
    });

    expect(result.current.phase).toBe("success");
    expect(result.current.hash).toBe("0x123abc");
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
  });

  it("transitions to error state and triggers toast when action fails", async () => {
    const { result } = renderHook(() => useTx());

    await act(async () => {
      const res = await result.current.run(async () => {
        throw new Error("Execution reverted");
      });
      expect(res).toBeNull();
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBe("Execution reverted");
    expect(result.current.pending).toBe(false);
    expect(mockAddToast).toHaveBeenCalledWith({
      title: "Transaction failed",
      description: "Execution reverted",
      tone: "error",
    });
  });

  it("resets to idle when user rejects the signing prompt, without showing an error", async () => {
    const { result } = renderHook(() => useTx());

    await act(async () => {
      const res = await result.current.run(async () => {
        throw new UserRejectedError("User rejected the signing prompt");
      });
      expect(res).toBeNull();
    });

    // Should be idle, not error
    expect(result.current.phase).toBe("idle");
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.pending).toBe(false);
    // Should not show a toast for user rejection
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it("resets state when reset is called", async () => {
    const { result } = renderHook(() => useTx());

    await act(async () => {
      await result.current.run(async () => {
        return { hash: "0x123", status: "SUCCESS" } as any;
      });
    });

    expect(result.current.phase).toBe("success");
    expect(result.current.hash).toBe("0x123");

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe("idle");
    expect(result.current.hash).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("emits telemetry callbacks during lifecycle", async () => {
    const onPhase = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useTx({ onPhase, onSuccess }));

    await act(async () => {
      await result.current.run(async (ctx) => {
        ctx.onPhase?.("signing");
        return { hash: "0xHASH", status: "SUCCESS" } as any;
      });
    });

    expect(onPhase).toHaveBeenCalledWith("building");
    expect(onPhase).toHaveBeenCalledWith("signing");
    expect(onPhase).toHaveBeenCalledWith("success");
    expect(onSuccess).toHaveBeenCalledWith("0xHASH", { hash: "0xHASH", status: "SUCCESS" });
  });

  it("detects locked wallet errors and calls onError with 'locked-wallet' phase", async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useTx({ onError }));

    await act(async () => {
      const res = await result.current.run(async () => {
        throw new LockedWalletError();
      });
      expect(res).toBeNull();
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toContain("locked");
    expect(mockAddToast).toHaveBeenCalledWith({
      title: "Transaction failed",
      description: expect.stringContaining("locked"),
      tone: "error",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("locked"),
      "locked-wallet",
    );
  });

  it("detects transaction timeout and sets phase to 'timeout' with hash preserved", async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useTx({ onError }));

    const txHash = "0xabcd1234";

    await act(async () => {
      const res = await result.current.run(async () => {
        throw new TransactionTimeoutError(txHash);
      });
      expect(res).toBeNull();
    });

    expect(result.current.phase).toBe("timeout");
    expect(result.current.hash).toBe(txHash); // Hash preserved for explorer link
    expect(result.current.error).toContain("timed out");
    expect(mockAddToast).toHaveBeenCalledWith({
      title: "Transaction failed",
      description: expect.stringContaining("timed out"),
      tone: "error",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("timed out"),
      "timeout",
    );
  });
});
