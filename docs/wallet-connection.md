# Wallet Connection Flow

The app integrates with the **Freighter wallet** browser extension for transaction signing and account management. This document describes the connection flow, all the states the app handles, and what happens in each failure mode.

## Overview

Wallet connection is optional—the app can be used in **read-only mode** to browse assets without signing in. When the user clicks "Connect Wallet" or performs an action that requires signing (transferring a token, creating a distribution, etc.), the app attempts to establish a connection to Freighter.

```
Disconnected (read-only) ──► [Connect Wallet] ──► Freighter prompt ──► Connected
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    │                   │                   │
                            Not installed          User rejects       Wrong network
                                    │                   │                   │
                                Error msg          Error msg          Connected*
                                (retry)            (retry)         (*sync required)
```

## Initial State: Freighter Detection (Mount)

When the app loads, it **asynchronously checks** whether Freighter is installed. This check is non-blocking—the app renders immediately even if Freighter detection is slow.

- **If Freighter is installed:**
  - The "Connect Wallet" button changes to show "Connect Wallet" (prompting an explicit connection).
  - If the user previously connected to this app (flag stored in localStorage), the app attempts to silently restore the prior session—checking if the app still has permission and the account is still available. This requires no user interaction.
  
- **If Freighter is not installed:**
  - The "Connect Wallet" button changes to "Get Freighter" and links to https://www.freighter.app.
  - The app operates in read-only mode.

## Connection Flow

When the user clicks "Connect Wallet" or "Get Freighter":

### 1. Check Freighter Installation
```typescript
const installed = await isFreighterInstalled()
```
Returns `true` if the Freighter extension responds; `false` otherwise or on error.

**Outcome:** 
- ✅ Installed → proceed to step 2
- ❌ Not installed → show "Get Freighter" link and button

### 2. Prompt for Account Access
```typescript
const address = await connect()  // Shows Freighter popup
```
Freighter displays a popup asking the user to:
- Select which account to connect
- Grant this app permission to read the account and sign transactions

**Possible outcomes:**
- ✅ **User approves** → Account address returned, proceed to step 3
- ❌ **User rejects** → `WalletError("user rejected")` thrown, show error message
- ❌ **Freighter not responding** → `WalletError` thrown (network/extension issue), show error message

### 3. Determine Wallet Network
```typescript
const walletNetwork = await getWalletNetwork()
```
Checks which Stellar network Freighter is currently pointed at (Testnet or Mainnet).

**Possible outcomes:**
- ✅ **Network is known** (testnet or mainnet) → Connected ✓
- ⚠️ **Network is unknown** (unfamiliar passphrase) → Connected but with a warning; writes are blocked until sync succeeds

### 4. Sync App Network to Wallet Network (Connected)
Once connected, the app's network **follows Freighter's network** so reads and writes always agree. If the user switches networks inside the Freighter extension, the app detects it and updates automatically (polling every ~8 seconds).

## Failure Modes

All four failure modes the app handles are described below.

### ❌ Freighter Not Installed

**When this happens:** User clicks "Connect Wallet" and Freighter is not detected.

**What the user sees:**
- Connection button changes to "Get Freighter" with a link to https://www.freighter.app
- Error message appears: *"Freighter wallet not detected. Install it from freighter.app to continue."*

**What a developer should know:**
- Detection is attempted at mount (non-blocking).
- The app continues to function in read-only mode while Freighter is not installed.
- Installing Freighter and reloading the page resolves this.

**Code path:** `lib/freighter.ts` → `isFreighterInstalled()` returns `false`, caught in `components/wallet/ConnectButton.tsx` and shows "Get Freighter" button.

### ❌ Freighter Locked

**When this happens:** Freighter is installed but locked (user hasn't unlocked it yet, or it's been locked by the browser).

**What the user sees:**
- Connection button shows spinner briefly, then error message appears: *"Freighter wallet locked."* or *"User rejected the connection."*
- A "Try again" button appears to retry the connection.

**What a developer should know:**
- This is reported by Freighter as a rejected request (same error as if the user explicitly rejected).
- The user must unlock Freighter in their browser extension UI and retry.
- The app does not retry automatically—the user must click "Try again".

**Code path:** `lib/freighter.ts` → `connect()` → `fRequestAccess()` returns `{ error: "..." }`, caught in `hooks/useWallet.tsx` and displayed as an error message.

### ❌ Wrong Network

**When this happens:** User connects successfully, but Freighter is pointed at a different network than the app expects.

**Example scenario:**
- App default is Testnet.
- User points Freighter at Mainnet.
- User clicks "Connect Wallet".
- Connection succeeds, but the network check detects a mismatch.

**What the user sees:**
- Connection succeeds (address shown).
- **However**, writes are disabled and show: *"Can't verify your wallet's network. Reconnect and try again."*
- The UI displays a state `networkUnknown: true` and hides write-requiring actions.

**What a developer should know:**
- Connected does NOT mean ready to sign. A connected state with `networkUnknown === true` is a warning state.
- The app polls Freighter every ~8 seconds to detect network changes. If the user switches Freighter to the correct network, writes automatically become available (no reconnection needed).
- If the app's active network is Testnet but Freighter is on Mainnet, the write will fail with "Can't verify your wallet's network."
- This is a safeguard to prevent accidentally signing transactions on the wrong network.

**Possible causes:**
- Freighter's network identity cannot be determined (unfamiliar passphrase or API failure).
- Freighter's network doesn't match the app's current network.

**Code path:** `lib/freighter.ts` → `getWalletNetwork()` returns `null`, captured in `hooks/useWallet.tsx` as `networkUnknown: true`. Write context throws in `lib/contracts.ts` when `writeCtx()` is called.

### ❌ User Rejected

**When this happens:** User clicks "Reject" on the Freighter account access prompt.

**What the user sees:**
- Connection is cancelled.
- Error message appears: *"User rejected the connection request."* or similar.
- A "Try again" button appears.

**What a developer should know:**
- Freighter returns an error (not an exception), captured and re-thrown as a `WalletError`.
- The app does not retry automatically—the user must click "Try again".
- If the user repeatedly rejects, they must dismiss the error and try again or reload the page to be prompted once more.

**Code path:** `lib/freighter.ts` → `connect()` → `fRequestAccess()` returns `{ error: "..." }`, thrown as `WalletError`, caught in `hooks/useWallet.tsx`.

## Error Boundary

If the Freighter API throws an uncaught exception during wallet initialization (e.g., a rare extension crash), the **error boundary** `WalletErrorBoundary` catches it:

- The entire app tree still renders in read-only mode (no blank screen).
- A banner appears at the bottom: *"Wallet failed to load — browsing in read-only mode."* with a "Retry" button.
- Clicking "Retry" attempts to re-initialize the wallet context.

**Code path:** `hooks/useWallet.tsx` → `WalletErrorBoundary` component.

## Polling & Background Updates

The app **actively polls Freighter** to detect wallet state changes (account/network switches) made inside the Freighter extension while the app is open:

- **Poll interval:** ~8 seconds
- **Frequency:** Active only when the tab is visible (paused when the tab is hidden to conserve battery/CPU).
- **Trigger:** On every network change, the app updates the `walletNetwork` state. If connected, the app's active network follows the wallet. If disconnected, the app's active network remains user-selectable for read-only browsing.

**Code path:** `hooks/useWallet.tsx` → `watchWallet()` → `lib/freighter.ts` → `WatchWalletChanges`.

## Session Persistence

When the user connects, the app stores a flag in `localStorage` (`rwa.wallet.connected`). On the next page load:

1. If the flag exists, the app silently checks if the prior account is still available (`getConnectedAddress()`).
2. If available and still permitted, the session is restored without a prompt.
3. If not available or permission was revoked, the flag is cleared and the user must reconnect.

**Code path:** `hooks/useWallet.tsx` → effect at line 143.

## Summary Table

| State | User Sees | Writes Allowed | Action |
|-------|-----------|---|---------|
| **Disconnected** | "Connect Wallet" button | ❌ No | Read-only browsing; click button to connect |
| **Freighter not installed** | "Get Freighter" link | ❌ No | Install extension from freighter.app and reload |
| **Connecting** | Spinner in button | ❌ No (pending) | Waiting for Freighter response |
| **Connected (network known)** | Address + dropdown menu | ✅ Yes | Can read and write |
| **Connected (network unknown)** | Address + error message | ❌ No | Network mismatch; switch Freighter's network or reconnect |
| **Connection rejected** | Error message + retry button | ❌ No | User rejected in Freighter; click "Try again" to retry |
| **Error boundary active** | Read-only mode + retry banner | ❌ No | Wallet crashed; click "Retry" button to reinitialize |

## Testing Connection States Locally

To test various states without a real wallet:

1. **Not installed:** Uninstall Freighter, reload the app.
2. **Locked:** Lock Freighter in your browser, click "Connect Wallet".
3. **User rejected:** Click "Connect Wallet", then click "Reject" in the Freighter prompt.
4. **Wrong network:** Connect to Testnet, then switch Freighter to Mainnet. The app detects this within ~8 seconds and blocks writes.
5. **Error boundary:** Open browser dev tools, set a breakpoint in the Freighter API call, and throw an exception—this triggers the error boundary.

---

*For a full list of every error message a holder or issuer may see during
wallet connection and transaction signing — including what each message means
and step-by-step remediation — see [Freighter Signing Errors — Troubleshooting Guide](freighter-troubleshooting.md).*
