import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkipLink } from "../SkipLink";

describe("SkipLink", () => {
  beforeEach(() => {
    // Clear DOM before each test
    document.body.innerHTML = "";
  });

  it("renders the skip link", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    expect(link).toBeInTheDocument();
  });

  it("is visually hidden by default with sr-only class", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    // sr-only class should apply visibility: hidden and other hiding styles
    expect(link).toHaveClass("sr-only");
  });

  it("has href pointing to main-content", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("becomes visible on focus with focus:not-sr-only class", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    // Verify focus styling classes are applied
    expect(link).toHaveClass("focus:not-sr-only");
    expect(link).toHaveClass("focus:fixed");
    expect(link).toHaveClass("focus:z-50");
  });

  it("has proper focus styling for brand colors and rings", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    expect(link).toHaveClass("focus:bg-brand-400");
    expect(link).toHaveClass("focus:ring-2");
    expect(link).toHaveClass("focus:ring-brand-600");
  });

  it("jumps to main-content element on click", async () => {
    const user = userEvent.setup();
    
    // Create a main element with id="main-content"
    const mainElement = document.createElement("main");
    mainElement.id = "main-content";
    mainElement.tabIndex = -1;
    document.body.appendChild(mainElement);

    // Mock focus and scrollIntoView (JSDOM doesn't implement scrollIntoView by default)
    const focusSpy = jest.spyOn(mainElement, "focus");
    mainElement.scrollIntoView = jest.fn();
    const scrollIntoViewSpy = jest.spyOn(mainElement, "scrollIntoView");

    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");

    await user.click(link);

    // Verify focus was called on the main element
    expect(focusSpy).toHaveBeenCalled();
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("handles Enter key press (default link behavior)", async () => {
    const user = userEvent.setup();
    
    const mainElement = document.createElement("main");
    mainElement.id = "main-content";
    mainElement.tabIndex = -1;
    document.body.appendChild(mainElement);

    const focusSpy = jest.spyOn(mainElement, "focus");
    mainElement.scrollIntoView = jest.fn();

    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");

    // Focus the link and press Enter
    await user.tab();
    await user.keyboard("{Enter}");

    expect(focusSpy).toHaveBeenCalled();
  });

  it("does not throw error if main-content element does not exist", async () => {
    const user = userEvent.setup();
    
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");

    // Should not throw when clicking without main-content element
    await expect(user.click(link)).resolves.toBeUndefined();
  });

  it("moves real focus to the focusable main landmark on activation", async () => {
    const user = userEvent.setup();
    const main = document.createElement("main");
    main.id = "main-content";
    main.tabIndex = -1;
    main.scrollIntoView = jest.fn();
    document.body.appendChild(main);

    render(<SkipLink />);
    await user.tab();
    expect(screen.getByText("Skip to main content")).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});
