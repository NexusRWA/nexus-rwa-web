import { Suspense } from "react";
import type { Metadata } from "next";
import { AssetExplorer } from "@/components/asset/AssetExplorer";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Explore Assets",
  description: "Browse tokenized real-world assets on Stellar — real estate, invoices and commodities.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-base-100">Explore Assets</h1>
        <p className="mt-2 max-w-2xl text-base-100/50">
          Every asset here is a compliance-gated token on Stellar. Search by name,
          ID, issuer or token, browse by class, sort by valuation, and open any
          asset to view its supply, holders and dividend history.
        </p>
      </div>
      <Suspense fallback={<CardSkeletonGrid count={9} />}>
        <AssetExplorer />
      </Suspense>
    </div>
  );
}
