import { act, fireEvent, render, screen } from "@testing-library/react";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("renders correctly with default icon-only mode", () => {
    render(<CopyButton value="GABC123456789" />);

    const button = screen.getByRole("button", { name: "Copy GABC123456789" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Copy");
  });

  it("renders with a custom label when provided", () => {
    render(<CopyButton value="GABC123456789" label="Wallet Address" />);

    const button = screen.getByRole("button", { name: "Copy Wallet Address" });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Wallet Address")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<CopyButton value="test" className="my-custom-class" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-class");
  });

  it("copies value to clipboard on click and temporarily displays confirmation state", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="GABC123456789" label="Copy Key" />);

    const button = screen.getByRole("button", { name: "Copy Copy Key" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith("GABC123456789");
    // Name keeps identifying the value; success is announced via the live region.
    expect(screen.getByRole("button", { name: "Copy Copy Key" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
    expect(screen.getByText("Copied")).toBeInTheDocument();

    // Advance timer past 1400ms feedback timeout
    act(() => {
      jest.advanceTimersByTime(1400);
    });

    expect(screen.getByRole("button", { name: "Copy Copy Key" })).toBeInTheDocument();
    expect(screen.getByText("Copy Key")).toBeInTheDocument();
  });

  it("surfaces a failed state when clipboard API rejects and the fallback also fails", async () => {
    const writeTextMock = jest.fn().mockRejectedValue(new Error("Clipboard forbidden"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="GABC123456789" />);

    const button = screen.getByRole("button", { name: "Copy GABC123456789" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith("GABC123456789");
    // The rejection is caught and retried via legacyCopy, which also fails
    // under jsdom (no document.execCommand), so the button reports the
    // failure rather than silently pretending the copy succeeded.
    expect(screen.getByRole("status")).toHaveTextContent("Copy failed");
    expect(screen.queryByText("Copied to clipboard")).not.toBeInTheDocument();

    // ...and recovers to the idle label once the feedback window elapses.
    act(() => {
      jest.advanceTimersByTime(1400);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
