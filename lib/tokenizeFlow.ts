/**
 * Orchestration for the tokenize wizard.
 *
 * The web app cannot deploy new Soroban contracts — that requires uploading
 * WASM bytecode and creating contract instances, which needs a funded Stellar
 * account and tools like the Stellar CLI or a deploy script. This flow
 * therefore assumes the issuer has already deployed and initialised their
 * asset-token and compliance contracts (e.g. via the stellar-rwa-contracts
 * deploy scripts), and guides them through registering that token with the
 * on-chain registry.
 *
 * Steps performed:
 *   1. Validate the token contract — call get_metadata to confirm it exists
 *      and is reachable.
 *   2. Register the asset — call registry.register_asset with the supplied
 *      metadata, linking the token contract and its issuer.
 */

import { assetToken, registry } from "@/lib/contracts";
import type { AssetMetadata, Network } from "@/types";
import type { WriteCtx } from "@/lib/contracts";

export interface TokenizeFormData {
  /** The already-deployed asset-token contract address. */
  tokenContract: string;
  /** Display name for the asset (stored in the registry). */
  name: string;
  /** Asset class. */
  assetType: string;
  /** Valuation in USD cents (bigint). */
  valuation: bigint;
}

export interface ValidatedToken {
  tokenContract: string;
  metadata: AssetMetadata;
}

/**
 * Validate that the token contract is reachable and return its on-chain
 * metadata. Throws a user-friendly error if the contract isn't found or isn't
 * an asset-token contract.
 */
export async function validateTokenContract(
  network: Network,
  tokenContract: string,
): Promise<ValidatedToken> {
  let metadata: AssetMetadata;
  try {
    metadata = await assetToken.getMetadata(network, tokenContract);
  } catch (e) {
    throw new Error(
      "Could not read the token contract. Make sure the address is correct and the contract is deployed on this network.",
    );
  }

  if (!metadata.name || !metadata.symbol) {
    throw new Error(
      "The contract responded but doesn't look like a valid asset-token (missing name or symbol).",
    );
  }

  return { tokenContract, metadata };
}

/**
 * Register an already-deployed asset token with the registry contract.
 * Returns the registry's asset id from the transaction return value.
 */
export async function registerAsset(
  ctx: WriteCtx,
  data: TokenizeFormData,
): Promise<bigint | null> {
  const result = await registry.registerAsset(ctx, {
    issuer: ctx.source,
    tokenContract: data.tokenContract,
    name: data.name,
    assetType: data.assetType,
    valuation: data.valuation,
  });
  // The registry returns the new asset id as u64; decode it.
  if (result.returnValue !== undefined && result.returnValue !== null) {
    try {
      return BigInt(result.returnValue as string | number | bigint);
    } catch {
      return null;
    }
  }
  return null;
}
