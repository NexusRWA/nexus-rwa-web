/**
 * Soroban contract error codes and their user-friendly messages.
 *
 * This is the single source of truth for mapping contract error codes to messages.
 * Error codes are shared across the four RWA contracts (registry, asset-token,
 * compliance, dividend), so messages are written to be context-agnostic.
 *
 * Reference: https://github.com/pauljacobb/nexus-rwa-contracts/blob/main/contracts/asset-token/src/error.rs
 *
 * When adding new codes:
 * - Add the code-to-message mapping below with documentation
 * - Update the contracts repo error enum
 * - Add test coverage in lib/__tests__/contractErrors.test.ts
 *
 * Note on stale closures / dependency arrays: this module is a pure utility
 * with no React hooks, props, or state. Its exported functions are
 * deterministic and depend only on their arguments (plus the module-level
 * constant `CONTRACT_ERROR_CODES`), so there are no dependency arrays to
 * audit and no stale-closure risk. Keep it that way: do not introduce
 * component state or hooks here.
 */

/**
 * Centralized mapping of Soroban contract error codes to user-facing messages.
 * Codes 1-9 are shared across the RWA contracts.
 * Unknown codes fall back to a generic message in `parseContractError()`.
 */
export const CONTRACT_ERROR_CODES: Record<number, string> = {
  1: "Already initialized.",
  2: "Contract is not initialized.",
  3: "You are not authorized to perform this action.",
  4: "The requested record was not found.",
  5: "Invalid amount or valuation.",
  6: "This asset is currently paused.",
  7: "The sender is not KYC-approved for this asset.",
  8: "The recipient is not KYC-approved for this asset.",
  9: "Amount overflow.",
};

/** The contract error code meaning "caller not authorised" (see code 3 above). */
const AUTH_ERROR_CODE = 3;

/**
 * Whether a raw Soroban error string is an authorisation failure, so callers
 * can present it differently from other contract errors.
 *
 * Empty/zero input is deliberate: an empty string (or any string without a
 * `Error(Contract, #N)` match) is not an auth error, so this returns `false`.
 */
export function isAuthError(raw: string): boolean {
  const codeMatch = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  return codeMatch !== null && Number(codeMatch[1]) === AUTH_ERROR_CODE;
}

/**
 * Parse a Soroban error string and return a user-friendly message.
 * Contract errors surface as `Error(Contract, #N)`; unknown codes produce a sane fallback.
 *
 * Empty/zero input is deliberate: an empty string (or `"0"`) contains no
 * contract error code and no known heuristic, so it falls through to the
 * generic fallback message rather than throwing.
 *
 * @param raw The raw error string from Soroban RPC
 * @returns A user-friendly error message
 */
export function parseContractError(raw: string): string {
  // First, try to match the standard contract error format: Error(Contract, #N)
  const codeMatch = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (codeMatch) {
    const code = Number(codeMatch[1]);
    return CONTRACT_ERROR_CODES[code] ?? `Contract rejected the call (code ${code}).`;
  }

  // Fall back to heuristic patterns for common failures
  if (/trustline|insufficient/i.test(raw)) {
    return "Insufficient balance or a missing trustline for the payment token.";
  }

  // Generic fallback for unmapped errors
  return "The contract call could not be completed.";
}
