/**
 * Formatting helpers. All monetary valuations are stored on-chain as USD cents
 * (i128); token amounts are integers in the token's own `decimals` base.
 */

import type { AssetType, ComplianceStatus } from "@/types";
import { ASSET_TYPE_LABELS } from "@/types";

/**
 * Format XLM (in stroops, the atomic unit: 1 XLM = 10,000,000 stroops)
 * as a currency string, e.g. 1000000n -> "0.1 XLM".
 * Used for displaying network fees estimated during transaction simulation.
 */
export function formatStroopsToXLM(stroops: bigint | number): string {
  const base = 10_000_000; // Stroops per XLM
  const xlm = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  const whole = xlm / BigInt(base);
  const remainder = xlm % BigInt(base);

  if (remainder === 0n) {
    return `${whole.toString()} XLM`;
  }

  // Format fractional part with trailing zeros removed
  const fracStr = remainder.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} XLM`;
}

/**
 * Format USD cents (bigint) as a currency string, e.g. 500000000n -> "$5,000,000".
 * Stays in bigint until the final string conversion so valuations above
 * Number.MAX_SAFE_INTEGER (2^53-1 cents) keep full precision — mirror of how
 * formatTokenAmount already scales raw token amounts.
 */
export function formatUsdCents(cents: bigint, opts?: { compact?: boolean }): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const dollars = abs / 100n;
  const remainder = abs % 100n;
  const sign = negative ? "-" : "";

  if (opts?.compact && dollars >= 1_000_000n) {
    return `${sign}$${compactBigint(dollars)}`;
  }

  const wholeStr = dollars.toLocaleString("en-US");
  if (remainder === 0n) {
    return `${sign}$${wholeStr}`;
  }
  const fracStr = remainder.toString().padStart(2, "0");
  return `${sign}$${wholeStr}.${fracStr}`;
}

/** Compact large numbers: 5_000_000 -> "5M", 12_300 -> "12.3K". */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return trimZero(n / 1_000_000_000) + "B";
  if (abs >= 1_000_000) return trimZero(n / 1_000_000) + "M";
  if (abs >= 1_000) return trimZero(n / 1_000) + "K";
  return String(n);
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Compact a whole-dollar bigint for the `compact` display path. The magnitude is
 * divided in bigint (so it never rounds away precision the way `Number()` on a
 * large cents value would), then the small quotient is formatted.
 */
function compactBigint(n: bigint): string {
  const units = [
    { threshold: 1_000_000_000n, divisor: 1_000_000_000n, suffix: "B" },
    { threshold: 1_000_000n, divisor: 1_000_000n, suffix: "M" },
    { threshold: 1_000n, divisor: 1_000n, suffix: "K" },
  ];
  let unitIndex = units.findIndex(({ threshold }) => n >= threshold);
  if (unitIndex < 0) return n.toString();

  let { divisor, suffix } = units[unitIndex]!;
  let tenths = (n * 10n + divisor / 2n) / divisor;
  while (tenths >= 10_000n && unitIndex > 0) {
    ({ divisor, suffix } = units[--unitIndex]!);
    tenths = (n * 10n + divisor / 2n) / divisor;
  }
  const whole = (tenths / 10n).toLocaleString("en-US");
  const fraction = tenths % 10n;
  return `${whole}${fraction === 0n ? "" : `.${fraction}`}${suffix}`;
}

/**
 * Convert a raw token amount (bigint, in base units) to a human string using
 * the token's decimals. 100000n @ 2 decimals -> "1,000".
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const wholeStr = whole.toLocaleString("en-US");
  if (decimals === 0 || frac === 0n) {
    return (negative ? "-" : "") + wholeStr;
  }
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return (negative ? "-" : "") + wholeStr + "." + fracStr;
}

/**
 * Convert a raw token amount to a plain (un-grouped) decimal string, suitable
 * for pre-filling an editable input. Unlike `formatTokenAmount`, this never
 * inserts thousands separators, so it round-trips through `parseTokenAmount`
 * exactly instead of needing a format → strip-commas → re-parse dance.
 * 100050n @ 2 decimals -> "1000.5".
 */
export function formatRawPlain(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const sign = negative ? "-" : "";
  if (decimals === 0 || frac === 0n) {
    return sign + whole.toString();
  }
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return sign + whole.toString() + "." + fracStr;
}

/**
 * Parse a human-entered decimal string into raw base units for a token.
 * "1,000.5" @ 2 decimals -> 100050n. Throws on malformed input.
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const cleaned = input.replace(/,/g, "").trim();
  // Requires at least one digit on one side of an optional single dot:
  // "5", "5.5", ".5" are valid; "", ".", "5.", "-5", "1e5" are not.
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) {
    throw new Error("Enter a valid number");
  }
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > decimals) {
    throw new Error(`Maximum ${decimals} decimal places`);
  }
  const paddedFrac = frac.padEnd(decimals, "0");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(paddedFrac || "0");
}

/** Parse a USD dollar string into i128 cents. "5,000,000" -> 500000000n. */
export function parseUsdToCents(input: string): bigint {
  return parseTokenAmount(input, 2);
}

/**
 * Build the detail-page href for an asset id. Asset ids are `bigint`
 * on-chain; interpolating a bigint directly into a template string or URL
 * works today but is easy to get wrong (e.g. mixing bigint and string keys
 * across components). Route all id -> string conversions through here so
 * links and React keys stay consistent.
 */
export function assetHref(id: bigint): string {
  return `/asset/${id.toString()}`;
}

/** Truncate a Stellar address for display: G/C... + last 4. */
export function truncateAddress(addr: string, lead = 4, tail = 4): string {
  if (!addr || addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type as AssetType] ?? titleCase(type);
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function complianceStatusLabel(status: ComplianceStatus): string {
  return status;
}

/**
 * A percentage 0–100 with one decimal, clamped.
 * `part` is clamped to `[0, whole]` before the bigint math so the
 * intermediate `* 10000n` product — and the resulting quotient passed to
 * `Number()` — stays bounded regardless of how large the raw operands are.
 * `part > whole` (or negative `part`) is treated as 100% / 0% respectively.
 */
export function percent(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0;
  const clamped = part < 0n ? 0n : part > whole ? whole : part;
  const pct = Number((clamped * 10000n) / whole) / 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Allocate percentage shares across holder rows using largest remainders.
 * The decimal precision grows as needed so every positive balance remains
 * visible, while displayed shares add up to the represented share of supply.
 */
export function holderSharePercentages(balances: bigint[], supply: bigint): string[] {
  if (supply <= 0n) return balances.map(() => "0.00");

  const positive = balances
    .map((balance, index) => ({ balance, index }))
    .filter(({ balance }) => balance > 0n);
  if (positive.length === 0) return balances.map(() => "0.00");

  const totalBalance = positive.reduce((sum, holder) => sum + holder.balance, 0n);
  let decimals = 2;
  let scale = 100n * 10n ** BigInt(decimals);
  let totalUnits = (totalBalance * scale + supply / 2n) / supply;
  while (totalUnits < BigInt(positive.length)) {
    decimals += 1;
    scale *= 10n;
    totalUnits = (totalBalance * scale + supply / 2n) / supply;
  }

  const remainingUnits = totalUnits - BigInt(positive.length);
  const allocations = positive.map(({ balance, index }) => {
    const weighted = remainingUnits * balance;
    return {
      index,
      units: 1n + weighted / totalBalance,
      remainder: weighted % totalBalance,
    };
  });
  let undistributed = totalUnits - allocations.reduce((sum, item) => sum + item.units, 0n);
  const remainderOrder = [...allocations].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (let i = 0; undistributed > 0n; i += 1) {
    const item = remainderOrder[i];
    if (!item) break;
    item.units += 1n;
    undistributed -= 1n;
  }

  const shares = balances.map(() => "0.00");
  const fractionScale = 10n ** BigInt(decimals);
  for (const allocation of allocations) {
    const whole = allocation.units / fractionScale;
    const fraction = (allocation.units % fractionScale).toString().padStart(decimals, "0");
    shares[allocation.index] =
      `${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
  }
  return shares;
}

/** Average Stellar ledger close time. The network's actual close time drifts
 * (historically ~5-6s), so this is a best-effort constant, not a guarantee. */
const AVG_LEDGER_CLOSE_SECONDS = 5.5;

/**
 * Rough wall-clock estimate for a ledger sequence. Error compounds with the
 * distance from `currentLedger`, so the result's precision is clamped to
 * roughly match how much it can be trusted: exact-ish under an hour out,
 * rounded to the hour under a month out, and to the day beyond that. Callers
 * should still label the result as approximate in the UI.
 * Returns null when `ledger` is 0 (used to mean "never expires").
 */
export function ledgerToApproxDate(
  targetLedger: number,
  currentLedger: number,
): Date | null {
  if (!targetLedger) return null;
  const deltaSeconds = (targetLedger - currentLedger) * AVG_LEDGER_CLOSE_SECONDS;
  const estimateMs = Date.now() + deltaSeconds * 1000;
  return new Date(clampPrecision(estimateMs, Math.abs(deltaSeconds)));
}

/** Round `epochMs` so its displayed precision doesn't overstate the estimate's accuracy. */
function clampPrecision(epochMs: number, horizonSeconds: number): number {
  if (horizonSeconds < 3600) return epochMs;
  const roundToMs = horizonSeconds < 30 * 86400 ? 3_600_000 : 86_400_000;
  return Math.round(epochMs / roundToMs) * roundToMs;
}
