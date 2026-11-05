# Transaction Telemetry

`useTx` exposes two mechanisms for plugging in analytics or error-monitoring
tools without modifying the hook itself. Both are entirely optional — the hook
works correctly with neither present.

## The `TxTelemetry` interface

```ts
interface TxTelemetry {
  /** Called at every phase transition, including "success" and "error". */
  onPhase?: (phase: TxPhase, detail?: string) => void;
  /** Called once when the transaction lands on-chain. */
  onSuccess?: (hash: string, result: TxResult) => void;
  /**
   * Called when the transaction fails.
   * @param error  User-facing error message.
   * @param phase  Always "error" — included so the signature is consistent
   *               with onPhase.
   */
  onError?: (error: string, phase: TxPhase) => void;
}
```

All three callbacks are optional — only provide the ones you care about.
Callbacks are fire-and-forget: they never block the transaction flow, and any
exception thrown inside them is not caught by the hook.

### Phase sequence

A successful transaction emits phases in this order:

```
building → signing → submitting → confirming → success
```

A failed transaction emits:

```
building → (signing?) → error
```

The `detail` parameter of `onPhase` is only populated for the `"error"` phase
and carries the same user-facing message that `onError` receives.

---

## Method 1 — pass telemetry directly to `useTx`

Pass a `TxTelemetry` object as the first argument to `useTx`. This is the
preferred approach for component-level instrumentation because the callbacks are
scoped to a single hook instance.

```tsx
import { useTx } from "@/hooks/useTx";
import type { AssetDetail } from "@/types";

export function TransferForm({ asset }: { asset: AssetDetail }) {
  const tx = useTx({
    onPhase(phase, detail) {
      analytics.track("tx_phase", { phase, detail });
    },
    onSuccess(hash) {
      analytics.track("tx_success", { hash });
    },
    onError(error) {
      analytics.track("tx_error", { error });
    },
  });

  // ...use tx.run(), tx.phase, tx.error, etc.
}
```

---

## Method 2 — the `window.__rwaTxTelemetry` global

For app-wide instrumentation (e.g. wiring Sentry at startup without touching
every call site), assign a `TxTelemetry` object to `window.__rwaTxTelemetry`.
Every `useTx` instance checks for this global at runtime and merges it with any
per-instance telemetry that was passed directly.

> **Note:** When both are set, **both** fire independently for each event —
> the global does not override the per-instance callbacks.

### TypeScript declaration

Add the following to a `.d.ts` file in your project (e.g. `types/globals.d.ts`)
so TypeScript knows about the global:

```ts
import type { TxTelemetry } from "@/types";

declare global {
  interface Window {
    __rwaTxTelemetry?: TxTelemetry;
  }
}
```

### Wiring Sentry at app startup

Set the global once inside your root layout or a top-level `_app` file, before
any components render:

```ts
// app/layout.tsx  (or pages/_app.tsx)
import * as Sentry from "@sentry/nextjs";

if (typeof window !== "undefined") {
  window.__rwaTxTelemetry = {
    onError(error, _phase) {
      Sentry.captureMessage(error, {
        level: "error",
        tags: { source: "useTx" },
      });
    },
    onSuccess(hash) {
      Sentry.addBreadcrumb({
        category: "transaction",
        message: `tx confirmed: ${hash}`,
        level: "info",
      });
    },
    onPhase(phase, detail) {
      Sentry.addBreadcrumb({
        category: "transaction",
        message: detail ? `${phase}: ${detail}` : phase,
        level: phase === "error" ? "warning" : "info",
      });
    },
  };
}
```

### Wiring a generic analytics tool

```ts
if (typeof window !== "undefined") {
  window.__rwaTxTelemetry = {
    onPhase(phase) {
      myAnalytics.track("stellar_tx_phase", { phase });
    },
    onSuccess(hash) {
      myAnalytics.track("stellar_tx_success", { hash });
    },
    onError(error) {
      myAnalytics.track("stellar_tx_error", { error });
    },
  };
}
```

---

## Precedence and merging

| Priority | Source |
|----------|--------|
| 1 (fires first) | Per-instance — `useTx(telemetry)` |
| 2 (fires second) | Global — `window.__rwaTxTelemetry` |

Both callbacks fire for every event — there is no overriding. This lets you
have app-wide Sentry capture and component-level analytics running side by side
without either interfering with the other.

---

## Relationship to the retry affordance

`onError` fires on every failure, including retries. If you want to distinguish
a first failure from a retry, track attempt count in your own closure:

```tsx
let attempts = 0;

const tx = useTx({
  onError(error) {
    attempts += 1;
    analytics.track("tx_error", { error, attempt: attempts });
  },
  onSuccess() {
    attempts = 0; // reset on success
  },
});
```

See [wallet-connection.md](./wallet-connection.md) for how `useTx` integrates
with the wallet context, and [environment-variables.md](./environment-variables.md)
for RPC configuration that affects how transactions are submitted.
