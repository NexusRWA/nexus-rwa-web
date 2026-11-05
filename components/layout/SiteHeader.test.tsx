import { fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";

// ── Module mocks ──────────────────────────────────────────────────────────────

// next/link → plain <a> so RTL can query by role/name without a Next.js router.
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

// usePathname — default to "/" so we can override per-test.
const mockUsePathname = jest.fn(() => "/");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

// Wallet components — lightweight stubs so the header renders without a
// WalletProvider context in every test.
jest.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

jest.mock("@/components/wallet/NetworkSelector", () => ({
  NetworkSelector: () => (
    <div role="group" aria-label="Select network">
      <button aria-pressed="true">Testnet</button>
      <button aria-pressed="false">Mainnet</button>
    </div>
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderHeader(pathname = "/") {
  mockUsePathname.mockReturnValue(pathname);
  return render(<SiteHeader />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SiteHeader", () => {
  afterEach(() => {
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/");
  });

  // ── Structure ──────────────────────────────────────────────────────────────

  it("renders a <header> landmark", () => {
    renderHeader();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders the NexusRWA home link", () => {
    renderHeader();
    // The logo link contains two text nodes: "Stellar" + "RWA" → accessible
    // name is computed as "Nexus RWA" by the browser / jsdom.
    expect(screen.getByRole("link", { name: /stellar\s*rwa/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  // ── Desktop navigation links ───────────────────────────────────────────────

  it("renders all four desktop nav links", () => {
    renderHeader();
    // getAllByRole returns both the desktop and mobile instances; we only need
    // to confirm the links are present — at least one per label is enough.
    expect(
      screen.getAllByRole("link", { name: /explore/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /tokenize/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /issuer/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /portfolio/i }).length,
    ).toBeGreaterThan(0);
  });

  // ── Active nav item ────────────────────────────────────────────────────────

  it("applies the active style class to the current route's nav link", () => {
    renderHeader("/explore");
    // Both desktop and mobile nav links for /explore are rendered. At least
    // one must carry the active indicator class.
    const exploreLinks = screen.getAllByRole("link", { name: /explore/i });
    const hasActiveClass = exploreLinks.some((el) =>
      el.className.includes("bg-white/5"),
    );
    expect(hasActiveClass).toBe(true);
  });

  it("does not apply the active class to a non-current nav link", () => {
    renderHeader("/explore");
    const portfolioLinks = screen.getAllByRole("link", { name: /portfolio/i });
    portfolioLinks.forEach((el) => {
      expect(el.className).not.toContain("bg-white/5");
    });
  });

  it("treats a sub-path as active for its parent segment", () => {
    renderHeader("/issuer/compliance");
    const issuerLinks = screen.getAllByRole("link", { name: /issuer/i });
    const hasActiveClass = issuerLinks.some((el) =>
      el.className.includes("bg-white/5"),
    );
    expect(hasActiveClass).toBe(true);
  });

  // ── Wallet controls ────────────────────────────────────────────────────────

  it("renders the ConnectButton wallet control", () => {
    renderHeader();
    expect(
      screen.getByRole("button", { name: /connect wallet/i }),
    ).toBeInTheDocument();
  });

  it("renders the NetworkSelector control", () => {
    renderHeader();
    expect(
      screen.getByRole("group", { name: /select network/i }),
    ).toBeInTheDocument();
  });

  // ── Mobile menu toggle ─────────────────────────────────────────────────────

  it("renders the mobile menu toggle button with accessible label", () => {
    renderHeader();
    expect(
      screen.getByRole("button", { name: /toggle navigation/i }),
    ).toBeInTheDocument();
  });

  it("sets aria-expanded=false on the toggle button initially", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the mobile menu and sets aria-expanded=true when toggle is clicked", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the mobile menu when the toggle is clicked a second time", () => {
    renderHeader();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
