import { render, screen } from "@testing-library/react";
import { ActivityPanel } from "./ActivityPanel";
import type { TransferActivity } from "@/hooks/useActivity";

const event: TransferActivity = {
  id: 42,
  from: "G1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGH",
  to: "GABCDEFGH1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  amount: 125_500n,
  ledger: 3514152,
  timestamp: null,
};

describe("ActivityPanel", () => {
  it("shows the empty state when no activity is available", () => {
    render(
      <ActivityPanel
        events={null}
        loading={false}
        error={null}
        decimals={7}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText("No recent transfers")).toBeInTheDocument();
    expect(
      screen.getByText(/recent indexed transfers for this asset will appear here/i),
    ).toBeInTheDocument();
  });

  it("renders transfer amount, addresses, and ledger when no timestamp is available", () => {
    render(
      <ActivityPanel
        events={[event]}
        loading={false}
        error={null}
        decimals={2}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText("1,255")).toBeInTheDocument();
    expect(screen.getByTitle(event.from)).toBeInTheDocument();
    expect(screen.getByTitle(event.to)).toBeInTheDocument();
    expect(screen.getByText("Ledger 3514152")).toBeInTheDocument();
  });

  it("shows a retryable error when activity cannot be loaded", () => {
    const onRetry = jest.fn();
    render(
      <ActivityPanel
        events={null}
        loading={false}
        error="Indexing API unavailable"
        decimals={7}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Indexing API unavailable");
    screen.getByRole("button", { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
