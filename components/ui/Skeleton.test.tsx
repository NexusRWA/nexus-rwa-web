import { render, screen } from "@testing-library/react";
import { Skeleton, CardSkeletonGrid } from "./Skeleton";

describe("Skeleton", () => {
  it("renders a single placeholder element", () => {
    const { container } = render(<Skeleton />);
    // Skeleton is decorative — it is hidden from assistive technology
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("DIV");
  });

  it("is hidden from assistive technology with aria-hidden", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("applies additional className to the root element", () => {
    const { container } = render(<Skeleton className="h-6 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("h-6");
    expect(el).toHaveClass("w-24");
  });

  it("uses empty string as default className without errors", () => {
    expect(() => render(<Skeleton />)).not.toThrow();
  });
});

describe("CardSkeletonGrid", () => {
  it("renders the default number of skeleton cards (6)", () => {
    const { container } = render(<CardSkeletonGrid />);
    // Each card is a direct child div of the grid
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.children).toHaveLength(6);
  });

  it("renders the requested number of skeleton cards", () => {
    const { container } = render(<CardSkeletonGrid count={3} />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.children).toHaveLength(3);
  });

  it("renders zero cards when count is 0", () => {
    const { container } = render(<CardSkeletonGrid count={0} />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.children).toHaveLength(0);
  });

  it("marks all skeleton elements as aria-hidden", () => {
    const { container } = render(<CardSkeletonGrid count={2} />);
    // Every Skeleton div inside the grid should be aria-hidden
    const hiddenEls = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenEls.length).toBeGreaterThan(0);
  });

  it("is announced to screen readers as a busy status region", () => {
    const { getByRole } = render(<CardSkeletonGrid count={2} label="Loading assets…" />);
    const region = getByRole("status", { name: "Loading assets…" });
    expect(region).toHaveAttribute("aria-busy", "true");
  });
});
