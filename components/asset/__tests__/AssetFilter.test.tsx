/**
 * Tests for components/asset/AssetFilter.tsx
 *
 * Strategy: render the component with a controlled value and a jest spy for
 * onChange, then fire click/change events and assert the spy receives the
 * correct updated FilterValue. Covers:
 *   - type chip selection (emits the selected asset type)
 *   - active/pressed state (aria-pressed reflects current value.type)
 *   - clearing back to the unfiltered default ("all")
 *   - sort select emits the correct sort key
 *   - optional counts rendered inside chip labels
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssetFilter, type FilterValue } from "../AssetFilter";

// ── helpers ────────────────────────────────────────────────────────────────

const DEFAULT_VALUE: FilterValue = { type: "all", sort: "valuation" };

function renderFilter(
  value: FilterValue = DEFAULT_VALUE,
  onChange = jest.fn(),
  counts?: Record<string, number>,
) {
  render(
    <AssetFilter
      value={value}
      onChange={onChange}
      search=""
      onSearchChange={jest.fn()}
      {...(counts !== undefined ? { counts } : {})}
    />,
  );
  return { onChange };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("AssetFilter", () => {
  // ── type chips rendered ──────────────────────────────────────────────

  it("chips are real, keyboard-reachable buttons inside a named group", () => {
    renderFilter();
    const group = screen.getByRole("group", { name: /filter by asset type/i });
    const chips = group.querySelectorAll("button");
    expect(chips.length).toBeGreaterThan(1);
    chips.forEach((chip) => {
      expect(chip).toHaveAttribute("type", "button");
      expect(chip).toHaveAttribute("aria-pressed");
      expect(chip).not.toHaveAttribute("tabindex", "-1");
    });
  });

  it("renders all type filter chips", () => {
    renderFilter();
    expect(screen.getByRole("button", { name: /all assets/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /real estate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /commodity/i })).toBeInTheDocument();
  });

  // ── aria-pressed active state ────────────────────────────────────────

  it("marks the active type chip as pressed", () => {
    renderFilter({ type: "real_estate", sort: "valuation" });
    expect(
      screen.getByRole("button", { name: /real estate/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("marks all other chips as not pressed when one is active", () => {
    renderFilter({ type: "real_estate", sort: "valuation" });
    expect(
      screen.getByRole("button", { name: /all assets/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /invoice/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /commodity/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  // ── clicking a type chip calls onChange ──────────────────────────────

  it("calls onChange with the selected type when a chip is clicked", () => {
    const { onChange } = renderFilter();
    fireEvent.click(screen.getByRole("button", { name: /real estate/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ type: "real_estate", sort: "valuation" });
  });

  it("calls onChange with type 'invoice' when the Invoice chip is clicked", () => {
    const { onChange } = renderFilter();
    fireEvent.click(screen.getByRole("button", { name: /invoice/i }));
    expect(onChange).toHaveBeenCalledWith({ type: "invoice", sort: "valuation" });
  });

  it("calls onChange with type 'commodity' when the Commodity chip is clicked", () => {
    const { onChange } = renderFilter();
    fireEvent.click(screen.getByRole("button", { name: /commodity/i }));
    expect(onChange).toHaveBeenCalledWith({ type: "commodity", sort: "valuation" });
  });

  // ── clearing back to the unfiltered default ──────────────────────────

  it("calls onChange with type 'all' when 'All Assets' is clicked (clears filter)", () => {
    const onChange = jest.fn();
    renderFilter({ type: "real_estate", sort: "valuation" }, onChange);
    fireEvent.click(screen.getByRole("button", { name: /all assets/i }));
    expect(onChange).toHaveBeenCalledWith({ type: "all", sort: "valuation" });
  });

  // ── sort select ──────────────────────────────────────────────────────

  it("renders the sort select with 'Highest valuation' and 'Newest' options", () => {
    renderFilter();
    const select = screen.getByRole("combobox", { name: /sort assets/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Highest valuation" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Newest" })).toBeInTheDocument();
  });

  it("calls onChange with updated sort when the select changes to 'newest'", () => {
    const { onChange } = renderFilter();
    const select = screen.getByRole("combobox", { name: /sort assets/i });
    fireEvent.change(select, { target: { value: "newest" } });
    expect(onChange).toHaveBeenCalledWith({ type: "all", sort: "newest" });
  });

  it("calls onChange with sort 'valuation' when changed back from 'newest'", () => {
    const onChange = jest.fn();
    renderFilter({ type: "all", sort: "newest" }, onChange);
    const select = screen.getByRole("combobox", { name: /sort assets/i });
    fireEvent.change(select, { target: { value: "valuation" } });
    expect(onChange).toHaveBeenCalledWith({ type: "all", sort: "valuation" });
  });

  // ── optional counts ──────────────────────────────────────────────────

  it("renders a count badge inside the chip when counts are provided", () => {
    renderFilter(DEFAULT_VALUE, jest.fn(), {
      all: 10,
      real_estate: 5,
      invoice: 3,
      commodity: 2,
    });
    // The count is rendered as a separate aria-hidden span but the accessible
    // label includes the count (e.g. "Real Estate, 5 assets"). Verify the
    // visible text node for the count exists in the document.
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
