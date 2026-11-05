import Link from "next/link";
import { PlatformStats } from "@/components/home/PlatformStats";
import { FeaturedAssets } from "@/components/home/FeaturedAssets";

const STEPS = [
  {
    title: "Tokenize",
    body: "Describe your real-world asset — real estate, an invoice, or a commodity — set its valuation, and mint a compliant token.",
    icon: (
      <path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z M12 3v18 M3 8l9 5 9-5" strokeLinejoin="round" />
    ),
  },
  {
    title: "Set compliance",
    body: "Approve KYC'd addresses, assign jurisdictions, and block regions. The allowlist is the on-chain gate for every transfer.",
    icon: (
      <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7l7-4Z M9 12l2 2 4-4" strokeLinejoin="round" strokeLinecap="round" />
    ),
  },
  {
    title: "Issue",
    body: "Distribute tokens to approved holders. Transfers to non-approved addresses are rejected by the contract, automatically.",
    icon: (
      <path d="M4 12h13 M12 5l7 7-7 7 M4 6v12" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Distribute dividends",
    body: "Fund a distribution with any payment token; holders claim their proportional share directly from escrow.",
    icon: (
      <path d="M12 2v20 M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="chip mx-auto border border-brand-500/25 bg-brand-500/10 text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Compliant RWA tokenization on Stellar
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-base-100 sm:text-6xl">
            Tokenize real-world assets
            <span className="block bg-gradient-to-r from-brand-300 to-gold-300 bg-clip-text text-transparent">
              on Stellar
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-base-100/60">
            Bring real estate, invoices and commodities on-chain as compliance-gated
            tokens. Manage KYC allowlists, control transfers, and distribute
            dividends — enforced by Soroban smart contracts.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/asset/new" className="btn-primary px-6 py-3 text-base">
              Tokenize an Asset
            </Link>
            <Link href="/explore" className="btn-secondary px-6 py-3 text-base">
              Explore Assets
            </Link>
          </div>
        </div>
      </section>

      {/* Platform stats */}
      <section className="pb-6">
        <PlatformStats />
      </section>

      {/* Featured assets */}
      <section className="py-16">
        <FeaturedAssets />
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-base-100 sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-base-100/55">
            From a real-world asset to on-chain dividends in four steps.
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card card-hover relative p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {step.icon}
                </svg>
              </div>
              <span className="absolute right-5 top-5 text-sm font-bold text-base-100/20">
                0{i + 1}
              </span>
              <h3 className="text-base font-semibold text-base-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-base-100/55">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="my-16">
        <div className="card relative overflow-hidden p-10 text-center sm:p-14">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.08] via-transparent to-gold-500/[0.06]" />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight text-base-100 sm:text-3xl">
              Bring your asset on-chain
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base-100/60">
              Deploy a compliant token, its compliance allowlist, and register it —
              all from your browser with Freighter.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/asset/new" className="btn-primary px-6 py-3 text-base">
                Get started
              </Link>
              <Link href="/issuer" className="btn-ghost px-6 py-3 text-base">
                Go to issuer dashboard →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
