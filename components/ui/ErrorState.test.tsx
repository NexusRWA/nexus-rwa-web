import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders with default title and given message", () => {
    render(<ErrorState message="Failed to fetch data." />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Failed to fetch data.")).toBeInTheDocument();
  });

  it("renders with a custom title", () => {
    render(<ErrorState title="Custom Error Title" message="Something specific broke." />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Custom Error Title");
    expect(screen.getByText("Something specific broke.")).toBeInTheDocument();
  });

  it("renders retry button and calls onRetry handler when clicked", () => {
    const handleRetry = jest.fn();
    render(<ErrorState message="Error occurred" onRetry={handleRetry} />);

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is omitted", () => {
    render(<ErrorState message="Error without retry" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies additional className when provided", () => {
    render(<ErrorState message="Styled error" className="custom-test-class" />);

    const alertElement = screen.getByRole("alert");
    expect(alertElement).toHaveClass("custom-test-class");
  });
});
