import type { AssetEntry, Network } from "@/types";

const BASE = typeof process !== "undefined"
  ? process.env.NEXT_PUBLIC_API_URL
  : undefined;

/**
 * The indexing API caps `limit` at 100 on every paginated endpoint, so a
 * "give me everything" read has to walk the pages itself.
 */
export const API_PAGE_SIZE = 100;

/** Guard against a server that keeps returning full pages forever. */
export const API_MAX_PAGES = 50;

const MAX_LIMIT = API_PAGE_SIZE;

/**
 * Build a full API URL for `path`.
 *
 * The stellar-rwa-api server mounts all data routes under `/v1`:
 *   /v1/assets, /v1/stats, /v1/events, /v1/assets/:id/holders
 * Only health/meta routes (/, /version, /health, /metrics) are unversioned.
 *
 * `NEXT_PUBLIC_API_URL` is documented as the bare server origin
 * (e.g. https://rwa-api.example.com), so the `/v1` prefix is added here
 * rather than requiring every operator to append it manually.  If the env
 * var already ends with `/v1` we do not double-append it, so operators who
 * worked around the old bug are not broken.
 */
function apiUrl(path: string): string {
  if (!BASE) return "";
  const base = BASE.replace(/\/+$/, "");
  // Avoid double-appending /v1 if the operator already included it.
  const versioned = /\/v\d+$/.test(base) ? base : `${base}/v1`;
  return `${versioned}${path}`;
}

/**
 * How long a single API request may take before we give up and treat the
 * indexing API as unavailable.
 *
 * Without this, `fetch` waits for the platform default (minutes) when the API
 * is slow or black-holed. The "API first, RPC fallback" design only falls back
 * once `fetchJson` returns `null`, so a hung API would stall every list and
 * stat view instead of degrading to RPC, and no loading state would ever end.
 * On the server the same call is awaited by `generateMetadata` before the
 * asset page can stream, delaying it for every visitor and crawler.
 */
export const API_TIMEOUT_MS = 5_000;

async function fetchJson<T>(url: string): Promise<T | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // A timeout aborts the request and lands here, which is exactly the
    // "API unavailable" signal callers use to fall back to RPC.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire types
//
// These mirror `docs/public/openapi.json` in `stellar-rwa-api-docs`: the
// `Asset`, `Stats`, `Holder` and `Event` schemas. The API speaks snake_case and
// returns bare JSON arrays rather than an envelope, so every field below is
// named exactly as the server sends it — anything else here is a guess that
// silently breaks against the real API.
// ─────────────────────────────────────────────────────────────────────────────

/** `GET /assets` element and `GET /assets/:id` body. */
export interface ApiAsset {
  id: number;
  token_contract: string;
  issuer: string;
  name: string;
  symbol: string;
  asset_type: string;
  description: string;
  /** USD cents, as a decimal string to preserve 64-bit precision. */
  valuation_cents: string;
  valuation_usd: number;
  decimals: number;
  total_supply: string;
  holders: number;
  active: boolean;
  paused: boolean;
  compliance_contract: string;
  /** Ledger sequence at registration. */
  created_at_ledger: number;
  indexed_at_ledger: number;
  index_error: string | null;
}

/** `GET /stats` body, in the app's camelCase shape. */
export interface ApiStatsResult {
  totalAssets: number;
  /** USD cents, as a decimal string to preserve 64-bit precision. */
  tvl: string;
  totalHolders: number | null;
}

/** `GET /assets/:id/holders` element. */
export interface ApiHolder {
  address: string;
  /** Raw token amount, as a decimal string to preserve 64-bit precision. */
  balance: string;
  share_percent: number;
}

export interface ApiEvent {
  id: number;
  contract: string;
  event_type: string;
  ledger: number;
  timestamp: string | null;
  data: Record<string, unknown>;
}

/** Raised when a payload does not match the OpenAPI schema. */
export class ApiShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiShapeError";
  }
}

/** Parse an integer-ish wire value into a bigint without precision loss. */
function toBigInt(value: string | number | null | undefined, field: string): bigint {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new ApiShapeError(`${field} is not an integer: ${value}`);
    }
    return BigInt(value);
  }
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) {
    throw new ApiShapeError(`${field} is not an integer: ${String(value)}`);
  }
  return BigInt(value);
}

/**
 * Map a wire `Asset` to the app's `AssetEntry`.
 *
 * Throws `ApiShapeError` when a required field is missing or malformed. That
 * is caught and turned into "API unavailable" by `mapOrNull` below, so a shape
 * mismatch degrades to RPC instead of surfacing as a hard load error.
 */
export function toAssetEntry(a: ApiAsset): AssetEntry {
  if (!a || typeof a !== "object") {
    throw new ApiShapeError("asset payload is not an object");
  }
  if (typeof a.token_contract !== "string" || !a.token_contract) {
    throw new ApiShapeError("asset.token_contract is missing");
  }
  if (typeof a.issuer !== "string") {
    throw new ApiShapeError("asset.issuer is missing");
  }
  if (typeof a.name !== "string") {
    throw new ApiShapeError("asset.name is missing");
  }
  if (typeof a.asset_type !== "string") {
    throw new ApiShapeError("asset.asset_type is missing");
  }
  return {
    id: toBigInt(a.id, "asset.id"),
    tokenContract: a.token_contract,
    issuer: a.issuer,
    name: a.name,
    assetType: a.asset_type,
    valuation: toBigInt(a.valuation_cents, "asset.valuation_cents"),
    createdAt: typeof a.created_at_ledger === "number" ? a.created_at_ledger : 0,
    active: a.active === true,
  };
}

/** Map a wire `Stats` body to the camelCase shape the hooks consume. */
export function toStatsResult(raw: {
  total_assets?: unknown;
  tvl_cents?: unknown;
  total_holders?: unknown;
}): ApiStatsResult {
  if (!raw || typeof raw !== "object") {
    throw new ApiShapeError("stats payload is not an object");
  }
  if (typeof raw.total_assets !== "number") {
    throw new ApiShapeError("stats.total_assets is missing");
  }
  return {
    totalAssets: raw.total_assets,
    tvl: toBigInt(raw.tvl_cents as string, "stats.tvl_cents").toString(),
    totalHolders:
      typeof raw.total_holders === "number" ? raw.total_holders : null,
  };
}

/**
 * Run a mapping that can throw, degrading to "API unavailable" on a shape
 * mismatch. `BigInt("abc")` in the middle of a list would otherwise throw out
 * of the hook as a load error instead of falling back to RPC.
 */
function mapOrNull<T>(map: () => T, context: string): T | null {
  try {
    return map();
  } catch (e) {
    console.warn(
      `[api] Ignoring unusable ${context} response from the indexing API:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** Query params supported by `GET /assets`. */
export interface GetAssetsParams {
  assetType?: string;
  active?: boolean;
  offset?: number;
  limit?: number;
}

export const api = {
  /**
   * One page of `GET /assets`. The endpoint returns a **bare array** with
   * `offset`/`limit` paging (default 50, max 100) — it is not enveloped, and
   * it has no `page`/`pageSize`/`sort` parameters.
   */
  async getAssetsPage(params: GetAssetsParams = {}): Promise<ApiAsset[] | null> {
    const query = new URLSearchParams();
    if (params.assetType) query.set("asset_type", params.assetType);
    if (params.active !== undefined) query.set("active", String(params.active));
    query.set("offset", String(params.offset ?? 0));
    query.set("limit", String(Math.min(params.limit ?? MAX_LIMIT, MAX_LIMIT)));
    const raw = await fetchJson<ApiAsset[]>(apiUrl(`/assets?${query}`));
    return Array.isArray(raw) ? raw : null;
  },

  /**
   * Walk every page of `GET /assets` and return the mapped entries.
   *
   * The API caps `limit` at 100 and ignores the `pageSize=500` this client
   * used to send, so a single request silently truncated the list at 50.
   */
  async getAllAssets(): Promise<AssetEntry[] | null> {
    const all: AssetEntry[] = [];
    for (let page = 0; page < API_MAX_PAGES; page++) {
      const batch = await api.getAssetsPage({ offset: page * MAX_LIMIT });
      if (!batch) return null;
      const mapped = mapOrNull(() => batch.map(toAssetEntry), "assets");
      if (!mapped) return null;
      all.push(...mapped);
      // A short page means we have reached the end.
      if (batch.length < MAX_LIMIT) break;
    }
    return all;
  },

  /** `GET /assets/:id` — the path segment is the numeric registry asset id. */
  async getAsset(id: bigint): Promise<AssetEntry | null> {
    const raw = await fetchJson<ApiAsset>(apiUrl(`/assets/${id.toString()}`));
    if (!raw) return null;
    return mapOrNull(() => toAssetEntry(raw), "asset");
  },

  /**
   * Assets issued by `issuer`.
   *
   * The API has no `issuer` query filter — unknown params are silently
   * ignored, so sending one used to return the *unfiltered* list. Filter
   * client-side instead.
   */
  async getAssetsByIssuer(issuer: string): Promise<AssetEntry[] | null> {
    const all = await api.getAllAssets();
    if (!all) return null;
    return all.filter((asset) => asset.issuer === issuer);
  },

  getStats(): Promise<ApiStatsResult | null> {
    return fetchJson<{ total_assets?: unknown; tvl_cents?: unknown; total_holders?: unknown }>(
      apiUrl("/stats"),
    ).then((raw) => (raw ? mapOrNull(() => toStatsResult(raw), "stats") : null));
  },

  getEvents(params: { offset?: number; limit?: number } = {}): Promise<ApiEvent[] | null> {
    const query = new URLSearchParams();
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    if (params.limit !== undefined) {
      query.set("limit", String(Math.min(params.limit, MAX_LIMIT)));
    }
    const search = query.toString();
    const path = search ? `/events?${search}` : "/events";
    return fetchJson<ApiEvent[]>(apiUrl(path)).then((raw) =>
      Array.isArray(raw) ? raw : null,
    );
  },

  isConfigured(): boolean {
    return Boolean(BASE);
  },

  /**
   * Holders of an asset.
   *
   * `GET /assets/{id}/holders` takes the **numeric registry asset id**
   * (`Path<u64>`) — a contract address in that segment is a 400.
   */
  async getHolders(assetId: bigint): Promise<{ address: string; balance: bigint }[] | null> {
    const raw = await fetchJson<ApiHolder[]>(
      apiUrl(`/assets/${assetId.toString()}/holders?offset=0&limit=${MAX_LIMIT}`),
    );
    if (!Array.isArray(raw)) return null;
    return mapOrNull(
      () =>
        raw.map((h) => ({
          address: h.address,
          balance: toBigInt(h.balance, "holder.balance"),
        })),
      "holders",
    );
  },
};
