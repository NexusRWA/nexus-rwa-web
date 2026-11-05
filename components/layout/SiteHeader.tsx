"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { NetworkSelector } from "@/components/wallet/NetworkSelector";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/asset/new", label: "Tokenize" },
  { href: "/issuer", label: "Issuer" },
  { href: "/portfolio", label: "Portfolio" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950">
            <Logo />
            <span className="text-sm font-bold tracking-tight text-base-100">
              Stellar<span className="text-brand-400">RWA</span>
            </span>
          </Link>
          {/* #215 a11y: focus-visible ring added; #218 a11y: inactive nav text
              bumped from /55 to /65 to reach ≥4.5:1 contrast on base-950. */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ${
                  isActive(item.href)
                    ? "bg-white/5 text-base-100"
                    : "text-base-100/65 hover:text-base-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <NetworkSelector />
          </div>
          <ConnectButton />
          <button
            className="btn-ghost p-2 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-white/5 bg-base-950/95 px-4 py-3 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ${
                isActive(item.href) ? "bg-white/5 text-base-100" : "text-base-100/65"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-white/5 pt-3">
            <NetworkSelector />
          </div>
        </nav>
      )}
    </header>
  );
}

function Logo() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-base-950">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Z" strokeLinejoin="round" />
        <path d="M12 8v8M8 10v4M16 10v4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
