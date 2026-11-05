/**
 * Tests for app/global-error.tsx
 *
 * Strategy: GlobalError is the last-resort boundary that renders when the root
 * layout itself throws. It must render its own <html>/<body> tags and provide
 * a usable fallback UI. Unlike app/error.tsx, this is the ultimate error defense.
 *
 * States covered:
 *   1. Renders <html> and <body> tags (required for root-level errors)
 *   2. Renders error title and description
 *   3. Renders "Try again" button that calls reset()
 *   4. Error is logged to console.error via useEffect
 *   5. Dark theme classes are applied
 */

// Mock globals.css import
jest.mock("./globals.css", () => {});

import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import GlobalError from "./global-error";

describe("app/global-error.tsx", () => {
  const mockReset = jest.fn();
  const testError = new Error("Root layout crashed");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  // GlobalError renders its own <html>/<body>. A plain `render()` mounts into
  // a detached <div>, where those tags aren't valid children, so React drops
  // them and their attributes are lost to a DOM query. `renderToStaticMarkup`
  // serializes the markup as Next.js itself would, without that constraint.
  it("renders the html and body elements", () => {
    const html = renderToStaticMarkup(<GlobalError error={testError} reset={mockReset} />);

    expect(html).toMatch(/^<html[^>]*>/);
    expect(html).toContain("<body");
  });

  it("sets the html lang attribute to 'en'", () => {
    const html = renderToStaticMarkup(<GlobalError error={testError} reset={mockReset} />);

    expect(html).toMatch(/<html[^>]*\blang="en"/);
  });

  it("applies the dark theme class to html", () => {
    const html = renderToStaticMarkup(<GlobalError error={testError} reset={mockReset} />);

    expect(html).toMatch(/<html[^>]*\bclass="dark"/);
  });

  it("renders the error title", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
  });

  it("renders the error description", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    expect(
      screen.getByText(/the app hit an unexpected error and couldn't render/i)
    ).toBeInTheDocument();
  });

  it("renders a 'Try again' button", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    const button = screen.getByRole("button", { name: /try again/i });
    expect(button).toBeInTheDocument();
  });

  it("calls reset() when 'Try again' button is clicked", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error in useEffect", () => {
    const consoleErrorSpy = console.error as jest.Mock;
    render(<GlobalError error={testError} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });

  it("logs the error again when error prop changes", () => {
    const consoleErrorSpy = console.error as jest.Mock;
    const { rerender } = render(<GlobalError error={testError} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const newError = new Error("Different root error");
    rerender(<GlobalError error={newError} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith(newError);
  });

  it("applies centering layout classes to body", () => {
    const html = renderToStaticMarkup(<GlobalError error={testError} reset={mockReset} />);
    const bodyMatch = html.match(/<body class="([^"]*)"/);

    for (const cls of ["flex", "min-h-screen", "flex-col", "items-center", "justify-center"]) {
      expect(bodyMatch?.[1]).toContain(cls);
    }
  });

  it("renders button with primary styling", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    const button = screen.getByRole("button", { name: /try again/i });
    expect(button).toHaveClass("btn-primary");
  });

  it("handles errors with digest property", () => {
    const errorWithDigest: Error & { digest?: string } = new Error("Error with digest");
    errorWithDigest.digest = "abc123xyz";

    const consoleErrorSpy = console.error as jest.Mock;
    render(<GlobalError error={errorWithDigest} reset={mockReset} />);

    expect(consoleErrorSpy).toHaveBeenCalledWith(errorWithDigest);
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
  });
});
