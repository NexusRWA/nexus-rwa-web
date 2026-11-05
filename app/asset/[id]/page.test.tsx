import { api } from "@/lib/api";
import { registry } from "@/lib/contracts";
import { generateMetadata } from "./page";

jest.mock("@/lib/api", () => ({
  api: {
    getAsset: jest.fn(),
  },
}));

jest.mock("@/lib/contracts", () => ({
  registry: {
    getAsset: jest.fn(),
  },
}));

jest.mock("@/lib/stellar", () => ({
  DEFAULT_NETWORK: "testnet",
}));

describe("asset page metadata", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the indexed asset name and valuation for social metadata", async () => {
    (api.getAsset as jest.Mock).mockResolvedValue({
      id: 7n,
      name: "Lagos Office Tower",
      valuation: 500_000_000n,
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "7" }) });

    expect(metadata.title).toBe("Lagos Office Tower");
    expect(metadata.description).toContain("$5,000,000");
    expect(metadata.openGraph).toMatchObject({
      title: "Lagos Office Tower — Nexus RWA",
      description: expect.stringContaining("$5,000,000"),
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "Lagos Office Tower — Nexus RWA",
      description: expect.stringContaining("$5,000,000"),
    });
    expect(registry.getAsset).not.toHaveBeenCalled();
  });

  it("falls back to a registry read when the API index has no asset", async () => {
    (api.getAsset as jest.Mock).mockResolvedValue(null);
    (registry.getAsset as jest.Mock).mockResolvedValue({
      id: 7n,
      name: "Registry Asset",
      valuation: 125_000n,
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "7" }) });

    expect(registry.getAsset).toHaveBeenCalledWith("testnet", 7n);
    expect(metadata.title).toBe("Registry Asset");
    expect(metadata.description).toContain("$1,250");
  });

  it("uses safe generic metadata for invalid ids", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "not-an-id" }) });

    expect(metadata.title).toBe("Asset #not-an-id");
    expect(metadata.description).toContain("tokenized asset #not-an-id");
    expect(api.getAsset).not.toHaveBeenCalled();
    expect(registry.getAsset).not.toHaveBeenCalled();
  });
});
