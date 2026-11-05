import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";

// Next.js Link renders a plain <a> in the test environment.
jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "Link";
  return MockLink;
});

describe("SiteFooter", () => {
  beforeEach(() => {
    render(<SiteFooter />);
  });

  // ── Structure ────────────────────────────────────────────────────────────────

  it("renders a <footer> landmark", () => {
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  // ── Platform (internal) links ────────────────────────────────────────────────

  it("renders the 'Explore assets' internal link pointing to /explore", () => {
    const link = screen.getByRole("link", { name: /explore assets/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/explore");
  });

  it("renders the 'Tokenize an asset' internal link pointing to /asset/new", () => {
    const link = screen.getByRole("link", { name: /tokenize an asset/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/asset/new");
  });

  it("renders the 'Issuer dashboard' internal link pointing to /issuer", () => {
    const link = screen.getByRole("link", { name: /issuer dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/issuer");
  });

  it("renders the 'Portfolio' internal link pointing to /portfolio", () => {
    const link = screen.getByRole("link", { name: /portfolio/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/portfolio");
  });

  // ── Developer (external) links — must carry rel="noopener noreferrer" ────────

  it("renders the Contracts external link with rel=noopener noreferrer", () => {
    const link = screen.getByRole("link", { name: /contracts/i });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders the 'API & Docs' external link with rel=noopener noreferrer", () => {
    const link = screen.getByRole("link", { name: /api.*docs/i });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders the Soroban external link with rel=noopener noreferrer", () => {
    const link = screen.getByRole("link", { name: /soroban/i });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute(
      "href",
      "https://developers.stellar.org/docs/build/smart-contracts",
    );
  });

  // ── All external links carry the security attributes ─────────────────────────

  it("ensures every external link has rel=noopener noreferrer", () => {
    const allLinks = screen.getAllByRole("link");
    const externalLinks = allLinks.filter(
      (link) => link.getAttribute("target") === "_blank",
    );

    expect(externalLinks.length).toBeGreaterThan(0);

    externalLinks.forEach((link) => {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  // ── Footer copy ──────────────────────────────────────────────────────────────

  it("renders the compliance disclaimer text", () => {
    expect(
      screen.getByText(/KYC-approved addresses/i),
    ).toBeInTheDocument();
  });
});
