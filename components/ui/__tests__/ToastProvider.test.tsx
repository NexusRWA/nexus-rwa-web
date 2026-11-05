import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "../ToastProvider";

function ToastHarness() {
  const { addToast } = useToast();

  return (
    <button onClick={() => addToast({ title: "Saved", description: "Your change is live." })}>
      Notify
    </button>
  );
}

describe("ToastProvider", () => {
  it("renders a toast and allows it to be dismissed", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /notify/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByText("Your change is live.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("announces info toasts politely and errors assertively without moving focus", () => {
    function Harness() {
      const { addToast } = useToast();
      return (
        <>
          <button onClick={() => addToast({ title: "Info toast" })}>Info</button>
          <button onClick={() => addToast({ title: "Boom", tone: "error" })}>Err</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Err" });
    trigger.focus();

    fireEvent.click(screen.getByRole("button", { name: "Info" }));
    fireEvent.click(trigger);

    const polite = screen.getByRole("status");
    const assertive = screen.getByRole("alert");
    expect(polite).toHaveAttribute("aria-live", "polite");
    expect(polite).toHaveTextContent("Info toast");
    expect(polite).not.toHaveTextContent("Boom");
    expect(assertive).toHaveAttribute("aria-live", "assertive");
    expect(assertive).toHaveTextContent("Boom");
    expect(document.activeElement).toBe(trigger);
  });
});
