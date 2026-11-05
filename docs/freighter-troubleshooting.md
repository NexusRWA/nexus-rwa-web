# Freighter Signing Errors — Troubleshooting Guide

This page catalogues every wallet error message a holder or issuer may encounter
while using the Nexus RWA platform, explains what caused it, and tells you
exactly what to do. Error normalisation lives in `lib/freighter.ts` and
`hooks/useTx.ts`; the messages below are what actually appear in the UI.

---

## Table of Contents

1. [Freighter Not Installed](#1-freighter-not-installed)
2. [Freighter Locked / User Rejected](#2-freighter-locked--user-rejected)
3. [No Account Returned](#3-no-account-returned)
4. [Wrong Network / Network Unknown](#4-wrong-network--network-unknown)
5. [No Signature Returned](#5-no-signature-returned)
6. [Transaction Failed (generic)](#6-transaction-failed-generic)
7. [Contract-Specific Errors](#7-contract-specific-errors)
8. [Rate-Limit / Network Errors](#8-rate-limit--network-errors)
9. [Error Boundary: Wallet Failed to Load](#9-error-boundary-wallet-failed-to-load)

---

## 1. Freighter Not Installed

**Message you see:**
> *"Freighter wallet not detected. Install it from freighter.app to continue."*

**What happened:**
The app checked for the Freighter browser extension at startup (`isFreighterInstalled()`)
and the extension did not respond. Either it is not installed or the browser
blocked its injection.

**What to do:**

| Step | Action |
|------|--------|
| 1 | Visit [freighter.app](https://www.freighter.app) and install the extension for your browser. |
| 2 | Reload the page. The "Get Freighter" button changes to "Connect Wallet" once the extension is detected. |
| 3 | If you just installed it, a browser restart may be needed in some browsers. |

**Code path:** `lib/freighter.ts` → `isFreighterInstalled()` → `connect()` throws
`WalletError("Freighter wallet not detected…")` → `ConnectButton.tsx` renders the
"Get Freighter" link.

---

## 2. Freighter Locked / User Rejected

**Messages you may see:**
> *"User rejected the connection request."*
>
> *"Freighter wallet locked."*

**What happened:**
Freighter showed a connection prompt and the user clicked **Reject**, or Freighter
is currently locked (password not entered). Both cases surface as an error in the
`fRequestAccess()` response.

**What to do:**

| Step | Action |
|------|--------|
| 1 | If Freighter is locked, click the Freighter extension icon in your browser toolbar, enter your password, and unlock it. |
| 2 | Click **"Try again"** (or "Connect Wallet") to re-trigger the connection prompt. |
| 3 | In the Freighter popup, choose the account you want to use and click **Connect**. |

**Note:** The app never retries automatically — you must click the retry button.

**Code path:** `lib/freighter.ts` → `connect()` → `fRequestAccess()` returns
`{ error: "…" }` → re-thrown as `WalletError` → caught in `hooks/useWallet.tsx`.

---

## 3. No Account Returned

**Message you see:**
> *"No account returned by Freighter."*

**What happened:**
The Freighter extension responded without an error but also did not return an
account address. This is rare and usually means the extension is in a degraded
state (e.g., it has no accounts configured yet).

**What to do:**

| Step | Action |
|------|--------|
| 1 | Open Freighter, create or import at least one account, then retry. |
| 2 | If you already have accounts, try locking and unlocking Freighter, then retry. |
| 3 | If the problem persists, reload the page and try connecting again. |

**Code path:** `lib/freighter.ts` → `connect()` → `res.address` is empty →
throws `WalletError("No account returned by Freighter.")`.

---

## 4. Wrong Network / Network Unknown

**Messages you may see:**
> *"Can't verify your wallet's network. Reconnect and try again."*

Or, write actions (Transfer, Create Distribution, etc.) are disabled with no
explicit error text — only the wallet status indicator shows an issue.

**What happened:**
The app detected that Freighter is pointing at a different network than the one
the app is currently using, or could not read Freighter's network passphrase at
all. Writes are blocked when this happens to prevent accidentally signing a
transaction on the wrong network (e.g., a Mainnet transaction sent to Testnet).

**What to do:**

| Step | Action |
|------|--------|
| 1 | Click the Freighter extension icon. |
| 2 | In the top-right network selector, switch to **Testnet** (or Mainnet, matching the app's active network shown in the top navigation). |
| 3 | The app polls every ~8 seconds; it will automatically re-enable writes once it detects the network switch. No reconnect is needed. |
| 4 | If the app does not recover within ~30 seconds, disconnect and reconnect your wallet. |

**Code path:** `lib/freighter.ts` → `getWalletNetwork()` returns `null` →
`hooks/useWallet.tsx` sets `networkUnknown: true` → `writeCtx()` in
`lib/contracts.ts` throws before the user is asked to sign.

---

## 5. No Signature Returned

**Message you see:**
> *"Freighter returned no signature."*

**What happened:**
The signing step completed but the resulting `signedTxXdr` field was missing or
empty. This is very uncommon and typically indicates a Freighter extension bug or
a very unusual extension state.

**What to do:**

| Step | Action |
|------|--------|
| 1 | Reload the page. |
| 2 | Lock and unlock Freighter, then retry the action. |
| 3 | If it recurs, update Freighter to the latest version from your browser's extension store. |
| 4 | If the problem persists, report it with the browser console log attached. |

**Code path:** `lib/freighter.ts` → `signTx()` → `res.signedTxXdr` is falsy →
throws `WalletError("Freighter returned no signature.")`.

---

## 6. Transaction Failed (generic)

**Message you see (toast notification):**
> *"Transaction failed"*
> — with a description specific to the failure.

**What happened:**
The transaction was submitted on-chain or was rejected before submission
(simulation failure). This catch-all appears in the bottom-right toast when
`useTx`'s `run()` method catches any error not matched by a more specific
message.

**Common sub-causes:**

| Description shown | Meaning |
|-------------------|---------|
| *"The network rejected the transaction."* | The Soroban RPC received the transaction but immediately returned an `ERROR` status. Often a fee or sequence number issue. Retry. |
| *"The transaction failed on-chain."* | The transaction landed in a block but the contract execution reverted. See [Contract-Specific Errors](#7-contract-specific-errors). |
| *"Timed out waiting for confirmation…"* | The RPC stopped seeing the transaction after 30 s. The transaction may still land — check the explorer link provided in the progress indicator. |

**What to do:**

| Step | Action |
|------|--------|
| 1 | Read the description in the toast carefully. |
| 2 | For "network rejected": wait a few seconds and retry. |
| 3 | For "failed on-chain": check [Contract-Specific Errors](#7-contract-specific-errors) below. |
| 4 | For "timed out": follow the explorer link in the TxProgress bar to check whether the transaction landed. Do not re-submit before confirming, to avoid double-spend. |

**Code path:** `hooks/useTx.ts` → `run()` catch block → `addToast(…, tone: "error")`.

---

## 7. Contract-Specific Errors

The contracts surface numeric error codes. The app translates known codes into
these messages:

| Code | Message | Common cause & fix |
|------|---------|-------------------|
| 1 | *"Already initialized."* | You tried to call an init-once method twice. No action needed; the contract is already set up. |
| 2 | *"Contract is not initialized."* | The contract was never set up. Contact the deployment team. |
| 3 | *"You are not authorized to perform this action."* | Your connected wallet is not the admin of this asset. Switch to the issuer/admin wallet and retry. |
| 4 | *"The requested record was not found."* | The address or distribution ID does not exist on-chain. Double-check the value you entered. |
| 5 | *"Invalid amount or valuation."* | The amount entered is zero, negative, or otherwise rejected by the contract. Enter a valid positive amount. |
| 6 | *"This asset is currently paused."* | The asset-token contract is paused. The issuer must unpause it before transfers or mints are allowed. |
| 7 | *"The sender is not KYC-approved for this asset."* | Your wallet is not on the compliance allowlist. Contact the asset issuer to complete KYC onboarding. |
| 8 | *"The recipient is not KYC-approved for this asset."* | The destination address is not on the compliance allowlist. The recipient must complete KYC before receiving this token. |
| 9 | *"Amount overflow."* | The requested amount exceeds the contract's integer limits. Use a smaller amount. |
| — | *"Insufficient balance or a missing trustline for the payment token."* | Your wallet lacks sufficient balance or a Stellar trustline for the payment token. Add the trustline and/or fund the account. |
| — | *"The contract call could not be completed."* (unknown code) | An unrecognised contract error. Open the browser console for the raw contract error detail logged there. |

---

## 8. Rate-Limit / Network Errors

**Messages you may see in the progress indicator:**
> *(The TxProgress bar stalls at "Building…" or "Confirming…" then fails with a generic error.)*

**What happened:**
The Soroban RPC node returned an HTTP 429 (rate limit), a timeout, or a
connection reset. The app retries reads automatically (up to 3 attempts with
exponential backoff) and fails over to backup RPC URLs if configured. Writes are
not retried automatically (to prevent double-submission).

**What to do:**

| Step | Action |
|------|--------|
| 1 | Wait 10–30 seconds, then retry the action. |
| 2 | If failures persist on Testnet, the public Soroban Testnet RPC may be under load. Try again later. |
| 3 | For self-hosted or staging deployments, configure additional RPC failover URLs via `NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK`. See [Custom RPC Setup](custom-rpc.md). |

**Code path:** `lib/stellar.ts` → `withRetry()` / `withFailover()` → error
propagates to `invokeContract()` → `useTx` → toast.

---

## 9. Error Boundary: Wallet Failed to Load

**Banner you see:**
> *"Wallet failed to load — browsing in read-only mode."* with a **Retry** button.

**What happened:**
An uncaught exception escaped Freighter API initialisation (e.g., a rare extension
crash or a very old Freighter version with an incompatible API). The `WalletErrorBoundary`
in `hooks/useWallet.tsx` caught it, keeping the app usable in read-only mode.

**What to do:**

| Step | Action |
|------|--------|
| 1 | Click the **Retry** button in the banner. |
| 2 | If that does not help, update Freighter from your browser's extension store. |
| 3 | Reload the page. |
| 4 | If the problem persists, disable all other browser extensions temporarily (some extensions conflict with Freighter's page injection). |

**Code path:** `hooks/useWallet.tsx` → `WalletErrorBoundary` component.

---

## Quick-Reference Summary

| Error message | First thing to try |
|---|---|
| Freighter wallet not detected | Install Freighter, reload |
| User rejected / Freighter locked | Unlock Freighter, click "Try again" |
| No account returned | Create/import an account in Freighter |
| Can't verify wallet's network | Switch Freighter's network to match the app |
| Freighter returned no signature | Reload, update Freighter |
| Transaction failed — network rejected | Wait and retry |
| Transaction failed — on-chain | See contract error table above |
| Transaction timed out | Check explorer before retrying |
| Wallet failed to load | Click Retry, update/reload |

---

*See also: [Wallet Connection Flow](wallet-connection.md) for a full description
of every connection state and the polling/session-restore behaviour.*
