import { render, screen } from "@testing-library/react";
import { Spinner, LoadingPanel } from "./Spinner";

// ─── Spinner ──────────────────────────────────────────────────────────────────

describe("Spinner", () => {
  it('has role="status" so assistive technology announces it', () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it('has default accessible name "Loading" when no label is supplied', () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("uses the custom label as the accessible name when provided", () => {
    render(<Spinner label="Fetching assets" />);
    expect(
      screen.getByRole("status", { name: "Fetching assets" }),
    ).toBeInTheDocument();
  });

  it("does not fall back to 'Loading' when a custom label is given", () => {
    render(<Spinner label="Please wait" />);
    expect(
      screen.queryByRole("status", { name: "Loading" }),
    ).not.toBeInTheDocument();
  });

  it("renders at the default size of 20px when size is omitted", () => {
    render(<Spinner />);
    const el = screen.getByRole("status");
    expect(el).toHaveStyle({ width: "20px", height: "20px" });
  });

  it("renders at a custom size when size prop is supplied", () => {
    render(<Spinner size={40} />);
    const el = screen.getByRole("status");
    expect(el).toHaveStyle({ width: "40px", height: "40px" });
  });

  it("merges additional className onto the root element", () => {
    render(<Spinner className="extra-class" />);
    expect(screen.getByRole("status")).toHaveClass("extra-class");
  });
});

// ─── LoadingPanel ─────────────────────────────────────────────────────────────

describe("LoadingPanel", () => {
  it('renders at least one element with role="status"', () => {
    render(<LoadingPanel />);
    // Both the outer div and the inner Spinner carry role="status"
    const statusEls = screen.getAllByRole("status");
    expect(statusEls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows default label text "Loading…"', () => {
    render(<LoadingPanel />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a custom label when provided", () => {
    render(<LoadingPanel label="Fetching portfolio…" />);
    expect(screen.getByText("Fetching portfolio…")).toBeInTheDocument();
  });

  it("exposes the panel as the single live region, with the spinner hidden", () => {
    render(<LoadingPanel />);
    // The panel already announces the label, so the nested spinner is
    // decorative — a second nested live region would double-announce.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it('has aria-live="polite" on the panel for non-intrusive announcements', () => {
    render(<LoadingPanel />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
