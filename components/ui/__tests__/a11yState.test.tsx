import React from "react";
import { render, screen } from "@testing-library/react";
import { ErrorState } from "../ErrorState";
import { LoadingPanel, Spinner } from "../Spinner";
import { ToastProvider, useToast } from "../ToastProvider";

function TestToastTrigger() {
  const { addToast } = useToast();
  return (
    <button
      onClick={() =>
        addToast({ title: "Transfer completed", tone: "success" })
      }
    >
      Trigger Toast
    </button>
  );
}

describe("Screen Reader Accessibility (a11y) Live Regions", () => {
  it("announces loading state transitions with polite live region", () => {
    render(<LoadingPanel label="Fetching account records…" />);
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Fetching account records…")).toBeInTheDocument();
  });

  it("announces spinner status for visual and non-visual users", () => {
    render(<Spinner label="Loading compliance records" />);
    const spinnerEl = screen.getByRole("status");
    expect(spinnerEl).toHaveAttribute("aria-label", "Loading compliance records");
  });

  it("announces error state transitions with assertive live region", () => {
    render(
      <ErrorState
        title="Transaction failed"
        message="Insufficient balance for transfer."
      />,
    );
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("Transaction failed")).toBeInTheDocument();
    expect(screen.getByText("Insufficient balance for transfer.")).toBeInTheDocument();
  });

  it("ToastProvider contains polite live region container for toast announcements", () => {
    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>,
    );
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});
