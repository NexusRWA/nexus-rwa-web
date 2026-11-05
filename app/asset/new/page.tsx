import type { Metadata } from "next";
import { TokenizeWizard } from "@/components/tokenize/TokenizeWizard";

export const metadata: Metadata = {
  title: "Tokenize an Asset",
  description: "Register a tokenized real-world asset on Stellar — connect your deployed token contract and list it on the platform.",
};

export default function NewAssetPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-base-100">Tokenize an asset</h1>
        <p className="mt-2 max-w-2xl text-base-100/55">
          Register your deployed asset-token contract with the on-chain registry
          to make it visible and tradeable on the platform.
        </p>
      </div>
      <TokenizeWizard />
    </div>
  );
}
