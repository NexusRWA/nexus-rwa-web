/**
 * Tests for app/error.tsx
 *
 * Strategy: mock Next.js Link so we don't need routing setup. The Error component
 * is a client-side error boundary that:
 *   1. Logs the error to console.error
 *   2. Renders error UI with a description
 *   3. Provides "Try again" button (calls reset())
 *   4. Provides "Go home" link (navigates to /)
 *
 * States covered:
 *   1. Renders error UI with icon, title, description
 *   2. "Try again" button calls reset() callback
 *   3. "Go home" link points to "/"
 *   4. Error is logged to console.error
 */

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

describe("app/error.tsx", () => {
  const mockReset = jest.fn();
  const testError = new Error("Test error message");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("renders the error icon, hidden from assistive technology", () => {
    const { container } = render(
      <ErrorPage error={testError} reset={mockReset} />,
    );

    // Decorative: the heading already carries the meaning, so the icon is
    // aria-hidden and has no role to query by.
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the error title", () => {
    render(<ErrorPage error={testError} reset={mockReset} />);

    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
  });

  it("renders the error description", () => {
    render(<ErrorPage error={testError} reset={mockReset} />);

    expect(screen.getByText(/an unexpected error interrupted this page/i)).toBeInTheDocument();
  });

  it("renders a 'Try again' button", () => {
    render(<ErrorPage error={testError} reset={mockReset} />);

    const button = screen.getByRole("button", { name: /try again/i });
    expect(button).toBeInTheDocument();
  });

  it("renders a 'Go home' link", () => {
    render(<ErrorPage error={testError} reset={mockReset} />);

    const link = screen.getByRole("link", { name: /go home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("calls reset() when 'Try again' button is clicked", () => {
    render(<ErrorPage error={testError} reset={mockReset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error in useEffect", () => {
    const consoleErrorSpy = console.error as jest.Mock;
    render(<ErrorPage error={testError} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });

  it("logs the error again when error prop changes", () => {
    const consoleErrorSpy = console.error as jest.Mock;
    const { rerender } = render(<ErrorPage error={testError} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const newError = new Error("Different error");
    rerender(<ErrorPage error={newError} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith(newError);
  });

  it("renders with the correct layout classes for centering", () => {
    const { container } = render(<ErrorPage error={testError} reset={mockReset} />);

    const mainDiv = container.querySelector(".mx-auto.flex.max-w-2xl");
    expect(mainDiv).toBeInTheDocument();
  });
});
