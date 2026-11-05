import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import bundleAnalyzer from "@next/bundle-analyzer";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/**
 * Best-effort short commit hash so a deploy can be correlated with a
 * user-reported issue from the footer. Falls back gracefully in
 * environments without git history (e.g. some CI checkouts).
 */
function resolveCommitSha() {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_REF;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return undefined;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: resolveCommitSha(),
  },
  webpack: (config) => {
    // stellar-sdk pulls in optional node deps that are irrelevant in the browser.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
