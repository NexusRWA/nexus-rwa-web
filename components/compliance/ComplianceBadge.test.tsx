import { render, screen } from "@testing-library/react";
import { ComplianceBadge } from "./ComplianceBadge";

describe("ComplianceBadge", () => {
  it.each([
    ["Approved", "Approved"],
    ["Pending", "Pending"],
    ["Rejected", "Rejected"],
    ["Suspended", "Suspended"],
  ] as const)("renders the %s badge", (status, accessibleName) => {
    render(<ComplianceBadge status={status} />);

    expect(screen.getByRole("status", { name: accessibleName })).toBeInTheDocument();
  });
});