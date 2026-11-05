import { render, screen } from "@testing-library/react";
import { DataFreshness } from "./DataFreshness";

describe("DataFreshness", () => {
  it("does not render until a successful read has completed", () => {
    const { container } = render(<DataFreshness updatedAt={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows when figures were retrieved and warns about index lag", () => {
    const updatedAt = Date.UTC(2026, 8, 26, 19, 0);

    render(<DataFreshness updatedAt={updatedAt} />);

    expect(screen.getByText(/figures retrieved/i)).toBeInTheDocument();
    expect(screen.getByText(/api-indexed data may lag/i)).toBeInTheDocument();
    expect(screen.getByText(/figures retrieved/i).querySelector("time")).toHaveAttribute(
      "dateTime",
      new Date(updatedAt).toISOString(),
    );
  });
});
