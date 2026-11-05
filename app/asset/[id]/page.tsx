import type { Metadata } from "next";
import Link from "next/link";
import { AssetDetailView } from "@/components/asset/AssetDetailView";
import { api } from "@/lib/api";
import { registry } from "@/lib/contracts";
import { DEFAULT_NETWORK } from "@/lib/stellar";
import { formatUsdCents } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  const asset = id === null ? null : await getAssetForMetadata(id);
  const name = asset?.name ?? `Asset #${rawId}`;
  const description = asset
    ? `${name} is valued at ${formatUsdCents(asset.valuation)}. Explore its holders and dividend history on Nexus RWA.`
    : `Details, holders and dividend history for tokenized asset #${rawId} on Stellar.`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} — Nexus RWA`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name} — Nexus RWA`,
      description,
    },
  };
}

async function getAssetForMetadata(id: bigint) {
  try {
    const indexed = await api.getAsset(id);
    if (indexed) return indexed;
  } catch (error) {
    console.warn(`Unable to load indexed metadata for asset ${id.toString()}:`, error);
  }

  try {
    return await registry.getAsset(DEFAULT_NETWORK, id);
  } catch (error) {
    console.warn(`Unable to load registry metadata for asset ${id.toString()}:`, error);
    return null;
  }
}

function parseId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    const v = BigInt(raw);
    return v >= 0n ? v : null;
  } catch {
    return null;
  }
}

export default async function AssetPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (id === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-base-100">Invalid asset id</h1>
        <p className="mt-2 text-base-100/55">“{rawId}” is not a valid asset id.</p>
        <Link href="/explore" className="btn-secondary mt-6">← Back to Explore</Link>
      </div>
    );
  }

  return <AssetDetailView id={id} />;
}
