# Contributing

Thanks for helping improve Nexus RWA Web.

## Workflow

1. Create a feature branch from `main`.
2. Keep changes focused on one issue or improvement at a time.
3. Run the relevant tests and type checks before opening a PR.

## Local setup

- Copy [.env.example](.env.example) to `.env.local`.
- The project currently targets Stellar Testnet. Mainnet contract IDs are intentionally empty in the example env file.
- Install dependencies with `npm install` and start the app with `npm run dev`.

## Issuer dashboard: on-chain roles and failure behaviour

The three tabs in the issuer dashboard call privileged contract methods. Each
requires the connected wallet to be the asset's on-chain admin (the address
stored in `AssetMetadata.admin`, set at token deployment). All three tabs share
the same requirement — there is currently no finer-grained role separation
between them.

| Tab | Methods called | Required role |
|---|---|---|
| Token | `mint`, `pause`, `unpause` | asset-token `admin` |
| Compliance | `add_to_allowlist`, `suspend`, `remove`, `block_jurisdiction`, `unblock_jurisdiction` | compliance contract `admin` (set to the same address as the asset-token admin at deployment) |
| Distributions | `create_distribution` | dividend contract caller must be the asset-token address's registered issuer; in practice this is the same wallet that deployed the token |

### What happens when a non-admin wallet submits

The Soroban contract enforces the admin check and reverts the transaction with
an `Auth` error. `useTx` catches the revert, maps it to a human-readable
message, and surfaces it via the `TxProgress` component as a generic
"Transaction failed" toast. The UI does not currently distinguish an
authorisation failure from any other contract error — the issuer dashboard
assumes the connected wallet *is* the admin, and no warning is shown upfront if
it is not.

Planned improvement: compare `AssetMetadata.admin` against `useWallet().address`
on the client side before enabling the action buttons, and show a clear
"You are not the admin of this asset" notice instead of letting the transaction
fail on-chain.

## Verification

Run these commands before submitting:

```bash
npm run test
npm run typecheck
```

For request deduplication timing and cache staleness behavior, see
[Request cache behavior](docs/request-cache.md).

### Coverage floor and bundle budget

CI fails when unit-test coverage drops below the floor in `jest.config.js`
(`coverageThreshold`): **80% statements, 70% branches, 68% functions, 81%
lines** — about two points under the measured 82.0 / 71.8 / 70.6 / 83.2. Check
locally with `npm run test:ci`. Raise the floor when coverage rises; do not
lower it to get a PR through.

`npm run size` enforces the gzip budgets in `.size-limit.json` (440 kB for all
JS chunks, 48 kB for the framework chunk), set ~7% above the measured
411.8 kB / 44.8 kB. If a change legitimately grows the bundle, raise the budget
in the same PR and explain why.

If you add UI changes, prefer updating or adding a focused component test alongside the implementation.

### Testing network switches

`useAsset` keys its cached and in-flight data by the selected network. When you
touch the hook, add or update a test in `hooks/useAsset.test.ts` that switches
the selected network (Testnet ↔ Mainnet) while data is cached or in flight, and
asserts that stale-network data is never shown after the switch. The test suite
mocks RPC and the wallet, so no keys or funded account are needed.
