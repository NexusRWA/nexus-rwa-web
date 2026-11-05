/**
 * Skip link to bypass header navigation and jump directly to main content.
 * WCAG 2.1 AA 2.4.1 Bypass Blocks (Level A)
 *
 * This link is visually hidden by default but becomes visible and interactive
 * when focused via keyboard. It allows keyboard users to skip repetitive
 * navigation elements and go directly to the page's main content.
 */
"use client";

export function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-block focus:rounded-lg focus:bg-brand-400 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-base-950 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 focus:ring-offset-base-950"
    >
      Skip to main content
    </a>
  );
}
