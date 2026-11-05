import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider, WalletErrorBoundary } from "@/hooks/useWallet";
import { SkipLink } from "@/components/layout/SkipLink";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: {
    default: "Nexus RWA — Tokenize real-world assets on Stellar",
    template: "%s · Nexus RWA",
  },
  description:
    "Tokenize real-world assets on Stellar. Issue compliant asset tokens, manage KYC allowlists, and distribute dividends — all on-chain via Soroban.",
  keywords: ["Stellar", "Soroban", "RWA", "tokenization", "real-world assets", "compliance", "DeFi"],
  openGraph: {
    title: "Nexus RWA",
    description: "Tokenize real-world assets on Stellar with on-chain compliance.",
    type: "website",
  },
  appleWebApp: {
    title: "Nexus RWA",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SkipLink />
      <SiteHeader />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </ToastProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col">
        <WalletErrorBoundary fallback={<AppShell>{children}</AppShell>}>
          <WalletProvider>
            <AppShell>{children}</AppShell>
          </WalletProvider>
        </WalletErrorBoundary>
      </body>
    </html>
  );
}
