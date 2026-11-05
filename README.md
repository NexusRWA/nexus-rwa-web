# Nexus RWA Web

A Next.js web app for tokenizing **real-world assets** on Stellar. Asset issuers
tokenize real estate, invoices and commodities as **compliance-gated tokens**,
manage KYC allowlists, and distribute dividends; investors browse and hold
compliant asset tokens.

Every asset token enforces compliance on-chain — only KYC-approved addresses can
hold or transfer it, checked via a cross-contract call into the compliance
contract on each transfer.

## Tech stack

- **Next.js 14** (app router) + **TypeScript**
- **Tailwind CSS** — dark-first design system
- **@stellar/stellar-sdk** — Soroban RPC (simulate for reads, sign + submit for writes)
- **@stellar/freighter-api** — wallet connection & signing
- **Recharts**, **date-fns**

## Sister repositories

- **Contracts:** https://github.com/pauljacobb/nexus-rwa-contracts
- **API + Docs:** https://github.com/pauljacobb/nexus-rwa-api-docs

## Stellar integration

The app is a pure client of Soroban smart contracts — there is no backend of its
own. It talks to Stellar in two ways:

- **Reads** are Soroban RPC `simulateTransaction` calls against deployed contract
  methods (`get_all_assets`, `get_metadata`, `balance`, `is_allowed`, …). No
  wallet, no fees, no signing — see `lib/stellar.ts` → `readContract`.
- **Writes** are real transactions: build → simulate → assemble footprint & fees
  → **sign with Freighter** → submit → poll to confirmation. See
  `lib/stellar.ts` → `invokeContract` and `hooks/useTx.ts`.

The four Soroban contracts it invokes:

| Contract    | Role                                               |
|-------------|----------------------------------------------------|
| registry    | Index of tokenized assets + total value locked     |
| asset-token | Compliant RWA token; transfers gated by compliance |
| compliance  | KYC allowlist + jurisdiction rules (the gate)      |
| dividend    | Proportional yield/dividend distribution           |

### The on-chain compliance gate

Asset transfers are enforced by the contract, not the UI. On every `transfer`,
the asset-token contract makes cross-contract calls into the compliance contract
for **both** parties:

```
transfer(from, to, amount)
  ├─ compliance.is_allowed(from)   ── cross-contract call ──▶ compliance contract
  ├─ compliance.is_allowed(to)     ── cross-contract call ──▶ compliance contract
  └─ move balances
```

If either party isn't KYC-approved the transaction reverts. The transfer form in
`/asset/[id]` reads this status up front and disables the action with a clear
reason when the connected wallet can't transfer.

### Networks & deployed contracts

**Testnet** · Network passphrase: `Test SDF Network ; September 2015` · Default RPC: `https://soroban-testnet.stellar.org`

| Contract    | Contract ID | Explorer |
|-------------|-------------|----------|
| registry    | `CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3` | [view](https://stellar.expert/explorer/testnet/contract/CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3) |
| compliance  | `CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU` | [view](https://stellar.expert/explorer/testnet/contract/CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU) |
| dividend    | `CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX` | [view](https://stellar.expert/explorer/testnet/contract/CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX) |
| asset-token (sample) | `CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ` | [view](https://stellar.expert/explorer/testnet/contract/CBMCWLSQSWUTLUJFCNBHNBSXMUM3XU7NAQ5TSNERW4HA4ZZBYHLG4ECZ) |

Registry, compliance and dividend contract IDs are configured via environment variables (see [Environment Variables](docs/environment-variables.md#contract-ids)). Per-asset token IDs are discovered at runtime from the registry.

To point the app at different deployments (e.g., local, alternative RPC, or Mainnet), see [Environment Variables](docs/environment-variables.md) and [Custom RPC Setup](docs/custom-rpc.md).

## Getting started

> This project is currently configured for Stellar Testnet only. Mainnet contract IDs are intentionally left blank in [.env.example](.env.example), so the app will not expose fully working mainnet routes until those values are populated.

Use Node.js 20 for local development, matching CI. The repository pins this
major in `.nvmrc` and npm rejects unsupported Node versions during install.

```bash
cp .env.example .env.local   # Testnet contract ids are pre-filled
npm install
npm run dev                  # http://localhost:3000
```

Install the [Freighter](https://freighter.app) browser extension and point it at
**Testnet** to interact with the deployed contracts.

### Scripts

| Script            | Purpose                          |
|-------------------|----------------------------------|
| `npm run dev`     | Local dev server                 |
| `npm run build`   | Production build                 |
| `npm run start`   | Serve the production build       |
| `npm run lint`    | Next.js ESLint                   |
| `npm run typecheck` | `tsc --noEmit`                 |
| `npm run size`    | Check the configured bundle-size budgets |

The CI build also generates module-level Webpack Bundle Analyzer reports and
uploads them as the `bundle-analysis` artifact, including when the size-budget
check fails. To generate them locally, run `ANALYZE=true npm run build`; the
reports are written to `.next/analyze/`.
| `npm test`        | Jest unit and component tests   |
| `npm run test:e2e` | Playwright browser tests       |

## Configuration

All configuration is via `NEXT_PUBLIC_*` env vars (see `.env.example`): the
default network, Soroban RPC URLs, and the registry / compliance / dividend
contract ids per network. Asset-token contract ids are discovered at runtime
from the registry.

For help with wallet errors, see [Freighter Troubleshooting](docs/freighter-troubleshooting.md).
For common first-run issues—including network selection, RPC rate limits, and
missing contract IDs—see [First-Run Troubleshooting](docs/first-run-troubleshooting.md).
For test commands, mock setup, and guidance on adding tests, see
[Running and Extending Tests](docs/testing.md).

## Architecture

```
app/            Route segments (landing, explore, asset/[id], …)
components/     UI, wallet, asset, compliance, dividend, layout components
hooks/          Wallet context + async data hooks (assets, asset, compliance, dividends, holders)
lib/            stellar.ts (RPC engine), contracts.ts (typed bindings),
                freighter.ts (wallet), format.ts (USD cents / token amounts)
types/          Domain types mirroring the contracts
```

- **Reads** simulate a contract invocation via Soroban RPC — no wallet, no fees.
- Data views show when their figures were last retrieved; values served by the
  API index may lag behind the latest Stellar ledger while the index catches up.
- **Writes** build → simulate → assemble → sign (Freighter) → submit → poll,
  surfacing each phase to the UI and mapping contract errors to friendly text.
- Monetary valuations are stored on-chain as **USD cents** (`i128`); token
  amounts are integers in each token's own `decimals` base. Dividend payment
  amounts use the payment token's on-chain decimals and portfolio totals remain
  grouped by token so different units are never added together.
  amounts are integers in each token's own `decimals` base.
- For concrete component → hook → API/RPC read paths and the simulate → sign →
  submit write path, see [Application Data Flow](docs/data-flow.md).
- For the complete contract validation, registry registration, and four-step
  wizard flow, see [Tokenizing an asset](docs/tokenizing-an-asset.md).

### Issuer dashboard roles

The `/issuer` dashboard exposes three tabs that call privileged contract
methods. All three require the connected wallet to match the asset's on-chain
`admin` address (recorded in `AssetMetadata.admin` at token deployment).

| Tab | Contract methods | Required on-chain role |
|---|---|---|
| Token | `mint`, `pause`, `unpause` | asset-token `admin` |
| Compliance | `add_to_allowlist`, `suspend`, `remove`, `block_jurisdiction`, `unblock_jurisdiction` | compliance contract `admin` (same address as the token admin) |
| Distributions | `create_distribution` | asset-token `admin` / registered issuer |

When a non-admin wallet submits any of these actions, the Soroban contract
reverts with an `Auth` error. `useTx` catches the revert and surfaces it as a
generic "Transaction failed" toast via `TxProgress`. The UI does not currently
distinguish an authorisation failure from other contract errors — it assumes the
connected wallet is the admin. A future improvement is to compare
`AssetMetadata.admin` against the connected address in the client and show an
explicit "you are not the admin" notice before letting an action be attempted.

## Pages

| Route          | Status | Description                                            |
|----------------|--------|--------------------------------------------------------|
| `/`            | ✅     | Landing: live platform stats, featured assets, how-it-works |
| `/explore`     | ✅     | Browse assets — filter by type, sort, paginate         |
| `/asset/[id]`  | ✅     | Asset detail: stats, holders, dividends, gated transfer |
| `/asset/new`   | ✅     | Tokenize a new asset (four-step registration wizard)   |
| `/issuer`      | ✅     | Issuer dashboard: token, compliance, and distributions |
| `/portfolio`   | ✅     | Investor holdings                                      |

Compliance and distribution management are tabs in the `/issuer` dashboard,
not separate `/issuer/compliance` or `/issuer/dividends` URL routes.
