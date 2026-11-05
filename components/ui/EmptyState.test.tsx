import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title always", () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(
      <EmptyState title="No results" description="Try another filter." />,
    );
    expect(screen.getByText("Try another filter.")).toBeInTheDocument();
  });

  it("renders custom icon and action elements", () => {
    render(
      <EmptyState
        title="No items"
        icon={<span data-testid="icon">icon</span>}
        action={<button>Retry</button>}
      />,
    );
    expect(screen.getByTestId("icon")).toHaveTextContent("icon");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("does not render description or action when they are omitted", () => {
    render(<EmptyState title="No results" />);
    expect(screen.queryByText("Try another filter.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
