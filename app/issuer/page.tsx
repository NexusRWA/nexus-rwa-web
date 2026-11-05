import type { Metadata } from "next";
import { IssuerDashboard } from "@/components/issuer/IssuerDashboard";

export const metadata: Metadata = {
  title: "Issuer Dashboard",
  description: "Manage your tokenized assets: mint, pause, KYC compliance, and dividend distributions.",
};

export default function IssuerPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-base-100">Issuer Dashboard</h1>
        <p className="mt-2 max-w-2xl text-base-100/55">
          Manage your registered assets: mint supply, control compliance allowlists,
          block jurisdictions, and create dividend distributions — all on-chain.
        </p>
      </div>
      <IssuerDashboard />
    </div>
  );
}
