import { fireEvent, render, screen } from "@testing-library/react";
import { TxProgress } from "./TxProgress";

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/stellar", () => ({
  explorerTxUrl: (_network: string, hash: string) => `https://stellar.expert/tx/${hash}`,
}));

describe("TxProgress", () => {
  it("renders nothing when phase is idle", () => {
    const { container } = render(
      <TxProgress phase="idle" hash={null} error={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["building", /Preparing transaction…/],
    ["submitting", /Submitting to the network…/],
    ["confirming", /Confirming on-chain…/],
  ])("shows pending text for %s phase with polite live region", (phase, expected) => {
    render(<TxProgress phase={phase as any} hash={null} error={null} />);
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("shows signing phase without fee estimate when fee is not available", () => {
    render(<TxProgress phase="signing" hash={null} error={null} />);
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(screen.getByText(/Awaiting signature in Freighter…/)).toBeInTheDocument();
    expect(screen.queryByText(/Estimated fee/i)).not.toBeInTheDocument();
  });

  it("shows estimated fee during signing phase when available", () => {
    render(
      <TxProgress
        phase="signing"
        hash={null}
        error={null}
        estimatedFee={100_000n}
      />,
    );
    expect(screen.getByText(/Awaiting signature in Freighter…/)).toBeInTheDocument();
    expect(screen.getByText("Estimated fee:")).toBeInTheDocument();
    expect(screen.getByText("0.01 XLM")).toBeInTheDocument();
  });

  it("renders error state with message, dismiss button, and assertive live region", () => {
    const onDismiss = jest.fn();
    render(
      <TxProgress
        phase="error"
        hash={null}
        error="Network issue"
        onDismiss={onDismiss}
      />,
    );
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toHaveTextContent("Network issue");
    expect(alertEl).toHaveAttribute("aria-live", "assertive");
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders timeout state with distinct styling and explorer link", () => {
    const onDismiss = jest.fn();
    render(
      <TxProgress
        phase="timeout"
        hash="tx123"
        error={null}
        onDismiss={onDismiss}
      />,
    );
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText(/Confirmation timed out/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check transaction on stellar expert/i })).toHaveAttribute(
      "href",
      expect.stringContaining("tx123"),
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders timeout state without link when hash is null", () => {
    render(
      <TxProgress
        phase="timeout"
        hash={null}
        error="Custom timeout message"
      />,
    );
    expect(screen.getByText(/Custom timeout message/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders success state with explorer link when hash exists and polite live region", () => {
    render(
      <TxProgress
        phase="success"
        hash="abc123"
        error={null}
        successMessage="Done"
      />,
    );
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Done")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view on stellar expert/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("abc123"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders success state without link when hash is null", () => {
    render(
      <TxProgress
        phase="success"
        hash={null}
        error={null}
        successMessage="Done"
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
