/**
 * Tests for components/ui/ConfirmDialog.tsx
 *
 * Verifies:
 *  1. Dialog is hidden when open=false
 *  2. Dialog renders title, description, and action buttons when open=true
 *  3. onConfirm is called when the confirm button is clicked
 *  4. onCancel is called when the cancel button is clicked
 *  5. onCancel is called when Escape is pressed
 *  6. onCancel is called when the backdrop is clicked
 *  7. Custom labels are respected
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

const baseProps = {
  title: "Pause all transfers?",
  description: "This action will block all holders from transferring.",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

afterEach(() => jest.clearAllMocks());

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    render(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog with title and description when open=true", () => {
    render(<ConfirmDialog {...baseProps} open={true} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Pause all transfers?")).toBeInTheDocument();
    expect(
      screen.getByText("This action will block all holders from transferring."),
    ).toBeInTheDocument();
  });

  it("renders default button labels", () => {
    render(<ConfirmDialog {...baseProps} open={true} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        {...baseProps}
        open={true}
        confirmLabel="Yes, pause transfers"
        cancelLabel="Go back"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Yes, pause transfers" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    render(<ConfirmDialog {...baseProps} open={true} confirmLabel="Yes, pause transfers" />);
    fireEvent.click(screen.getByRole("button", { name: "Yes, pause transfers" }));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    render(<ConfirmDialog {...baseProps} open={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed", () => {
    render(<ConfirmDialog {...baseProps} open={true} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop is clicked", () => {
    render(<ConfirmDialog {...baseProps} open={true} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss confirmation dialog" }),
    );
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onCancel when the dialog panel itself is clicked", () => {
    render(<ConfirmDialog {...baseProps} open={true} />);
    // The dialog panel is separate from the backdrop button.
    fireEvent.click(screen.getByRole("dialog"));
    expect(baseProps.onCancel).not.toHaveBeenCalled();
  });

  describe("focus management", () => {
    it("moves focus to Cancel on open and cycles Tab / Shift+Tab within the dialog", () => {
      render(<ConfirmDialog {...baseProps} open={true} />);
      const cancel = screen.getByRole("button", { name: "Cancel" });
      const confirm = screen.getByRole("button", { name: "Confirm" });
      expect(cancel).toHaveFocus();

      // Tab on the last control wraps to the first.
      confirm.focus();
      fireEvent.keyDown(window, { key: "Tab" });
      expect(cancel).toHaveFocus();

      // Shift+Tab on the first control wraps to the last.
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(confirm).toHaveFocus();
    });

    it("pulls focus back into the dialog if it escaped", () => {
      render(
        <>
          <button>outside</button>
          <ConfirmDialog {...baseProps} open={true} />
        </>,
      );
      screen.getByRole("button", { name: "outside" }).focus();
      fireEvent.keyDown(window, { key: "Tab" });
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("returns focus to the triggering element on close", () => {
      const { rerender } = render(
        <>
          <button>trigger</button>
          <ConfirmDialog {...baseProps} open={false} />
        </>,
      );
      const trigger = screen.getByRole("button", { name: "trigger" });
      trigger.focus();
      rerender(
        <>
          <button>trigger</button>
          <ConfirmDialog {...baseProps} open={true} />
        </>,
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
      rerender(
        <>
          <button>trigger</button>
          <ConfirmDialog {...baseProps} open={false} />
        </>,
      );
      expect(trigger).toHaveFocus();
    });
  });
});
