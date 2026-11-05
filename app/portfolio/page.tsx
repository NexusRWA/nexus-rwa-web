import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Your tokenized asset holdings and claimable dividends on Stellar.",
};

export default function PortfolioPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-base-100">Portfolio</h1>
        <p className="mt-2 max-w-2xl text-base-100/55">
          Your tokenized asset balances and claimable dividend distributions,
          aggregated across all registered assets on this network.
        </p>
      </div>
      <PortfolioView />
    </div>
  );
}
