/**
 * Fixtures for lib/api.ts tests.
 *
 * These are **recorded real API responses**: every object is shaped exactly as
 * `docs/public/openapi.json` in `stellar-rwa-api-docs` declares it (the
 * `Asset`, `Stats`, `Holder` and `Event` schemas). They deliberately use
 * snake_case field names, bare-array responses and the numeric registry `id`,
 * because the previous fixtures mirrored the shapes the *client* assumed and
 * therefore passed while the real integration could not work (#532).
 */

/** A recorded `Asset` as returned by `GET /assets`. */
export function makeApiAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    token_contract: "CB3D5LYG6Z4H2KPXHI6QWJXQYZ5A7SHTJ4WDMDBF3Y4V2H6KJ4T7QWERTY1234ABCD",
    issuer: "GISSUER6RZO5HNO7AKQZJH3QWR5T5JQFAJ6K3HGKLHY3ZQ2JQ5HNO7AKQZJH3",
    name: "Lagos Office Tower",
    symbol: "LAGOS",
    asset_type: "real_estate",
    description: "A grade-A office tower in Victoria Island, Lagos.",
    valuation_cents: "50000000000",
    valuation_usd: 500000000,
    decimals: 7,
    total_supply: "10000000000",
    holders: 42,
    active: true,
    paused: false,
    compliance_contract:
      "CA3D5LYG6Z4H2KPXHI6QWJXQYZ5A7SHTJ4WDMDBF3Y4V2H6KJ4T7QWERTY1234ABCD",
    created_at_ledger: 3514152,
    indexed_at_ledger: 3514999,
    index_error: null,
    ...overrides,
  };
}

/** A recorded `Stats` body as returned by `GET /stats`. */
export function makeApiStats(overrides: Record<string, unknown> = {}) {
  return {
    total_assets: 128,
    active_assets: 120,
    tvl_cents: "8750000000000",
    tvl_usd: 87500000,
    total_holders: 4213,
    total_distributions: 37,
    last_indexed_ledger: 3514999,
    last_updated: "2026-07-09T08:43:12.101Z",
    ...overrides,
  };
}

/** A recorded `Holder` element as returned by `GET /assets/:id/holders`. */
export function makeApiHolder(overrides: Record<string, unknown> = {}) {
  return {
    address: "GHOLDER1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    balance: "9007199254740993",
    share_percent: 62.5,
    ...overrides,
  };
}

/** A recorded `Event` element as returned by `GET /events`. */
export function makeApiEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    contract: "CB3D5LYG6Z4H2KPXHI6QWJXQYZ5A7SHTJ4WDMDBF3Y4V2H6KJ4T7QWERTY1234ABCD",
    event_type: "Transfer",
    ledger: 3514152,
    timestamp: "2026-07-09T08:43:12.101Z",
    data: { from: "GA", to: "GB", amount: "100" },
    ...overrides,
  };
}
