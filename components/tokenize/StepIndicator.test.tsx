import { render, screen, within } from "@testing-library/react";
import { StepIndicator } from "./StepIndicator";

const steps = [
  { id: 1, label: "Token contract" },
  { id: 2, label: "Asset details" },
  { id: 3, label: "Confirm" },
];

describe("StepIndicator", () => {
  it("marks completed, current, and upcoming steps", () => {
    render(<StepIndicator steps={steps} current={2} />);

    const progress = screen.getByRole("navigation", { name: /wizard progress/i });
    const stepItems = within(progress).getAllByRole("listitem");

    expect(stepItems).toHaveLength(3);
    const completedStep = stepItems[0];
    const currentStep = stepItems[1];
    const upcomingStep = stepItems[2];
    if (!completedStep || !currentStep || !upcomingStep) {
      throw new Error("Expected three wizard steps");
    }

    expect(completedStep).toHaveTextContent("Token contract");
    expect(completedStep.querySelector("svg")).toBeInTheDocument();
    expect(completedStep.querySelector('[aria-current="step"]')).not.toBeInTheDocument();

    expect(currentStep).toHaveTextContent("Asset details");
    expect(currentStep.querySelector('[aria-current="step"]')).toBeInTheDocument();

    expect(upcomingStep).toHaveTextContent("Confirm");
    expect(within(upcomingStep).getByText("3")).toBeInTheDocument();
    expect(upcomingStep.querySelector('[aria-current="step"]')).not.toBeInTheDocument();
  });
});