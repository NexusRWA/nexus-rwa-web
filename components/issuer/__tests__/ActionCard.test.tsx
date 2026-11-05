/**
 * Tests for components/issuer/ActionCard.tsx
 *
 * Strategy: render with title/description/icon/children and assert they all
 * appear, the default brand accent is applied to the icon wrapper, and a custom
 * `accent` overrides it.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ActionCard } from "../ActionCard";

describe("ActionCard", () => {
  const icon = <span data-testid="icon">⚡</span>;
  const children = <p>Form content goes here</p>;

  it("renders the title, description, icon and children", () => {
    render(
      <ActionCard title="Mint dividends" description="Pay holders." icon={icon}>
        {children}
      </ActionCard>,
    );

    expect(screen.getByText("Mint dividends")).toBeInTheDocument();
    expect(screen.getByText("Pay holders.")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Form content goes here")).toBeInTheDocument();
  });

  it("applies the default brand accent to the icon wrapper", () => {
    render(
      <ActionCard title="T" description="D" icon={icon}>
        {children}
      </ActionCard>,
    );
    const wrapper = screen.getByTestId("icon").parentElement;
    expect(wrapper).toHaveClass("bg-brand-500/10", "text-brand-400");
  });

  it("uses a custom accent when provided, dropping the default", () => {
    render(
      <ActionCard title="T" description="D" icon={icon} accent="bg-red-500/10 text-red-400">
        {children}
      </ActionCard>,
    );
    const wrapper = screen.getByTestId("icon").parentElement;
    expect(wrapper).toHaveClass("bg-red-500/10", "text-red-400");
    expect(wrapper).not.toHaveClass("bg-brand-500/10");
  });
});
