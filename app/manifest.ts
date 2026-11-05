import type { MetadataRoute } from "next";

/** Web app manifest, so the site can be installed / added to a home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexus RWA",
    short_name: "Nexus RWA",
    description:
      "Tokenize real-world assets on Stellar. Issue compliant asset tokens, manage KYC allowlists, and distribute dividends — all on-chain via Soroban.",
    start_url: "/",
    display: "standalone",
    background_color: "#08090c",
    theme_color: "#08090c",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
