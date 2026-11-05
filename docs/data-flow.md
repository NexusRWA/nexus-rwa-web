# Application Data Flow

The UI does not call Soroban RPC directly. Route components render feature
components, feature components use hooks for asynchronous state, and hooks call
typed bindings in `lib/contracts.ts`. Those bindings encode arguments and
normalize contract values before returning domain types.

## Read flow

```text
route/page
  → feature component
  → data hook (network from useWallet)
  → lib/api.ts (optional read aggregation)
      └─ no API result → lib/contracts.ts binding
                         → lib/stellar.ts readContract
                         → Soroban RPC simulateTransaction
```

For example, the explore page renders asset components using `useAssets`. The
hook tries the configured API's `/assets` endpoint first; if it is unset or
unavailable, it calls `registry.getAllAssets(network)`. That typed binding
resolves the registry ID, invokes `readContract`, and converts the returned
Soroban values to `AssetEntry` objects. `useAsync` exposes the result as
`data`, `loading`, `error`, and `refetch` for the component.

Not every read uses the aggregation API. The asset detail hook `useAsset(id)`
reads the registry entry, then reads token metadata from the token contract ID
in that entry. Balance and compliance hooks likewise read the relevant token
and compliance contracts directly. This means a list API response does not
replace the on-chain detail and wallet-specific reads.

`readContract` builds an invocation and simulates it; it does not need a
connected wallet or submit a transaction. Transient RPC rate-limit and network
errors are retried, and RPC failures are reported to the per-network failover
logic. The optional `NEXT_PUBLIC_API_URL` is for reads only; writes always use
Soroban RPC.

## Write flow

```text
feature component
  → useTx.run(action)
  → useWallet.writeCtx() (connected address + network + signer)
  → lib/contracts.ts typed write binding
  → lib/stellar.ts invokeContract
      → fetch account + build invocation
      → simulate and assemble footprint/fees
      → ask Freighter to sign
      → submit signed transaction
      → poll for confirmation
  → useTx phase/result/error → progress UI and toast
```

For a transfer, `TransferPanel` validates the recipient, amount, balance, and
compliance state before calling `useTx.run`. The callback calls
`assetToken.transfer(ctx, ...)`; the binding encodes the source, destination,
and amount, then delegates to `invokeContract`.

`useWallet.writeCtx()` refuses to create a write context if the user is
disconnected or the wallet network is unknown or mismatched. `invokeContract`
then builds the transaction using the connected account, simulates it before
asking for a signature, and assembles the simulation result so the transaction
contains the required footprint and fees. Freighter signs the prepared XDR;
the app submits that signed transaction and polls the same RPC server for
confirmation. `useTx` receives phase changes (`building`, `signing`,
`submitting`, `confirming`) and exposes success or failure to the component.

Simulation failures are surfaced before the signing prompt. Once submitted,
the app does not automatically resubmit a failed or timed-out write; check the
transaction status before manually retrying a timeout.

## Where to start tracing a feature

| Concern | Starting point |
|---|---|
| Asset list or platform stats | `components/asset/AssetExplorer.tsx`, `hooks/useAssets.ts` |
| Asset detail and balance | `components/asset/AssetDetailView.tsx`, `hooks/useAsset.ts` |
| Transfer form and write | `components/asset/TransferPanel.tsx`, `hooks/useTx.ts` |
| Typed contract methods and IDs | `lib/contracts.ts` |
| RPC simulation, transaction lifecycle, retry, and failover | `lib/stellar.ts` |
| Wallet connection and signing | `hooks/useWallet.tsx`, `lib/freighter.ts` |

## Registry pagination

The registry contract's `get_all_assets` method on the current contracts repo
(`main` branch) takes `(start_id: u64, limit: u32)` and returns a page of
entries rather than the entire list in one call.

`registry.getAllAssets` in `lib/contracts.ts` pages through the registry
automatically using a page size of 50 entries per call, concatenating results
until a page returns fewer entries than the page size (signalling end-of-list).
Start IDs are derived from the last entry's `id` field plus one.

**Backward compatibility:** The old no-argument `get_all_assets()` signature is
still supported via a fallback.  If the first paginated call returns a Soroban
argument-count error (`WrongNumberOfArguments` / `ArgsInvalid`), the function
retries with no arguments and emits a `console.warn` so operators know the
deployed registry needs updating.  Once all deployments are on the current
contracts, the fallback branch can be removed.
