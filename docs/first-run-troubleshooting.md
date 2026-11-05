# First-Run Troubleshooting

Use this guide when the app loads but you cannot connect a wallet, browse the
expected network, or reach deployed contracts. The app can browse in read-only
mode without Freighter; a wallet is needed only for writes.

## Freighter is not detected

Install and enable the [Freighter browser extension](https://freighter.app),
then reload the app. The wallet button should change from **Get Freighter** to
**Connect Wallet**. You can still browse while disconnected. For connection
errors, locked wallets, and rejected requests, see the
[Freighter troubleshooting guide](freighter-troubleshooting.md).

## The wallet is on the wrong network

When connected, the app follows the network reported by Freighter. Choose the
intended network in Freighter and give the app a few seconds to detect the
change. Writes are blocked if the wallet network is unknown or does not match
the app's active network; reconnect if the network state does not recover.
Disconnected users can select a network in the app for read-only browsing.

## RPC requests are rate-limited or unavailable

Read simulations retry transient rate-limit and network errors up to three
times with backoff. Configured RPC candidates are also rotated after repeated
failures. Wait briefly and retry; for a self-hosted deployment, configure
provider URLs using the
[custom RPC setup](custom-rpc.md#failover--multiple-rpc-urls). Writes are not
automatically resubmitted after a failure. If a write times out while
confirming, check the transaction in the explorer before trying again.

## Contract calls fail because an ID is empty or invalid

Testnet registry, compliance, and dividend IDs have working defaults. Mainnet
IDs intentionally default to empty, so Mainnet contract calls will fail until
the deployment's real IDs are configured. Set
`NEXT_PUBLIC_MAINNET_REGISTRY_ID`, `NEXT_PUBLIC_MAINNET_COMPLIANCE_ID`, and
`NEXT_PUBLIC_MAINNET_DIVIDEND_ID` in `.env.local` for local development, or in
the deployment's build environment. Restart the dev server after changing local
environment variables; for a deployed app, rebuild and redeploy because
`NEXT_PUBLIC_*` values are embedded in the client bundle.

Use real contract IDs deployed on the selected network, not placeholders or
IDs from another network. Asset-token IDs are discovered from the registry at
runtime and are not set with these variables. See
[contract ID configuration](environment-variables.md#contract-ids) for details.

## Still stuck?

- [Freighter connection and signing errors](freighter-troubleshooting.md)
- [Environment variable reference](environment-variables.md)
- [Custom and local RPC setup](custom-rpc.md)
