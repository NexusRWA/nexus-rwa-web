# Environment Variables

App configuration uses `NEXT_PUBLIC_*` environment variables, making these
settings available to the browser. The complete set of app-configurable
variables in `.env.example` is listed here; the sections below document each
variable and its default. Build-provider variables mentioned under app metadata
are supplied by CI or hosting and do not need to be added to `.env.local`.

Copy [.env.example](../.env.example) to `.env.local` and edit as needed.

| Setting | Variables |
|---|---|
| App metadata | `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_APP_COMMIT` |
| Network | `NEXT_PUBLIC_DEFAULT_NETWORK` |
| Primary RPC endpoints | `NEXT_PUBLIC_TESTNET_RPC_URL`, `NEXT_PUBLIC_MAINNET_RPC_URL` |
| RPC failover endpoints | `NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK`, `NEXT_PUBLIC_MAINNET_RPC_URLS_FALLBACK` |
| Testnet contract IDs | `NEXT_PUBLIC_TESTNET_REGISTRY_ID`, `NEXT_PUBLIC_TESTNET_COMPLIANCE_ID`, `NEXT_PUBLIC_TESTNET_DIVIDEND_ID` |
| Mainnet contract IDs | `NEXT_PUBLIC_MAINNET_REGISTRY_ID`, `NEXT_PUBLIC_MAINNET_COMPLIANCE_ID`, `NEXT_PUBLIC_MAINNET_DIVIDEND_ID` |
| Optional read API | `NEXT_PUBLIC_API_URL` |

## Network & RPC Configuration

### `NEXT_PUBLIC_DEFAULT_NETWORK`

- **Purpose:** The Stellar network the app connects to by default when no wallet is connected (read-only browsing mode) or after a fresh page load.
- **Required:** No (defaults to `"testnet"`)
- **Format:** String: `"testnet"` or `"mainnet"`
- **Example:**
  ```
  NEXT_PUBLIC_DEFAULT_NETWORK=testnet
  ```

### `NEXT_PUBLIC_TESTNET_RPC_URL`

- **Purpose:** Primary Soroban RPC endpoint for Testnet reads and writes. This is tried first for all RPC operations.
- **Required:** No (defaults to `https://soroban-testnet.stellar.org`)
- **Format:** HTTPS URL
- **Example:**
  ```
  NEXT_PUBLIC_TESTNET_RPC_URL=https://soroban-testnet.stellar.org
  ```

### `NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK`

- **Purpose:** Comma-separated list of fallback Soroban RPC endpoints for Testnet. These are tried in order after the primary URL fails consecutively (see [custom RPC setup](./custom-rpc.md)).
- **Required:** No (defaults to empty; only the primary URL is used if not set)
- **Format:** Comma-separated HTTPS URLs
- **Example:**
  ```
  NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK=https://alternative-rpc-1.example.com,https://alternative-rpc-2.example.com
  ```

### `NEXT_PUBLIC_MAINNET_RPC_URL`

- **Purpose:** Primary Soroban RPC endpoint for Mainnet reads and writes.
- **Required:** No (defaults to `https://mainnet.sorobanrpc.com`)
- **Format:** HTTPS URL
- **Example:**
  ```
  NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet.sorobanrpc.com
  ```

### `NEXT_PUBLIC_MAINNET_RPC_URLS_FALLBACK`

- **Purpose:** Comma-separated list of fallback Soroban RPC endpoints for Mainnet, tried in order after the primary URL fails consecutively.
- **Required:** No (defaults to empty)
- **Format:** Comma-separated HTTPS URLs
- **Example:**
  ```
  NEXT_PUBLIC_MAINNET_RPC_URLS_FALLBACK=https://mainnet-alt-1.example.com,https://mainnet-alt-2.example.com
  ```

## Contract IDs

The app invokes four RWA contracts: **registry** (asset index), **compliance** (KYC gate), **dividend** (yield distribution), and individual **asset tokens** (discovered at runtime from the registry).

The first three are configured via environment variables and are network-specific; asset token IDs are not configurable—they are discovered at runtime.

### Testnet Contract IDs

All three Testnet contract IDs have hardcoded defaults that ship with the app, matching the official deployments. These can be overridden via environment variables.

#### `NEXT_PUBLIC_TESTNET_REGISTRY_ID`

- **Purpose:** Testnet registry contract ID — the authoritative index of tokenized assets and their total value locked.
- **Required:** No (defaults to the official Testnet deployment: `CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3`)
- **Format:** Stellar contract ID (starts with 'C', 56 characters)
- **Example:**
  ```
  NEXT_PUBLIC_TESTNET_REGISTRY_ID=CBX5SMLTXX6JP4HA5GQIO2V6QM7WCUGL2GZ6D4U773HMRI6RXISKPUR3
  ```

#### `NEXT_PUBLIC_TESTNET_COMPLIANCE_ID`

- **Purpose:** Testnet compliance contract ID — enforces KYC allowlists and jurisdiction rules, checked on every token transfer.
- **Required:** No (defaults to the official Testnet deployment: `CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU`)
- **Format:** Stellar contract ID (starts with 'C', 56 characters)
- **Example:**
  ```
  NEXT_PUBLIC_TESTNET_COMPLIANCE_ID=CBUERYDM7DXTZLLKDBRJKUBPFJ7M4OSUN4T7XKUARU345RLXNAIQD2IU
  ```

#### `NEXT_PUBLIC_TESTNET_DIVIDEND_ID`

- **Purpose:** Testnet dividend contract ID — creates and manages proportional dividend/yield distributions to token holders.
- **Required:** No (defaults to the official Testnet deployment: `CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX`)
- **Format:** Stellar contract ID (starts with 'C', 56 characters)
- **Example:**
  ```
  NEXT_PUBLIC_TESTNET_DIVIDEND_ID=CAR4XY3CEBQWFOL27JEWFW34KXSIZA7RFKDQMEIV7ZU723RWY37I2SYX
  ```

### Mainnet Contract IDs

All three Mainnet contract IDs default to empty strings, meaning the app **will not function** on Mainnet until these are explicitly set. This is intentional: it prevents accidentally pointing at undeployed contracts.

#### `NEXT_PUBLIC_MAINNET_REGISTRY_ID`

- **Purpose:** Mainnet registry contract ID.
- **Required:** No, but the app will not work on Mainnet without it (defaults to empty string)
- **Format:** Stellar contract ID (starts with 'C', 56 characters)
- **Example:**
  ```
  NEXT_PUBLIC_MAINNET_REGISTRY_ID=CBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  ```

#### `NEXT_PUBLIC_MAINNET_COMPLIANCE_ID`

- **Purpose:** Mainnet compliance contract ID.
- **Required:** No, but the app will not work on Mainnet without it (defaults to empty string)
- **Format:** Stellar contract ID (starts with 'C', 56 characters)
- **Example:**
  ```
  NEXT_PUBLIC_MAINNET_COMPLIANCE_ID=CBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  ```

#### `NEXT_PUBLIC_MAINNET_DIVIDEND_ID`

- **Purpose:** Mainnet dividend contract ID.
- **Required:** No, but the app will not work on Mainnet without it (defaults to empty string)
- **Format:** Stellar contract ID (starts with 'C', 56 characters)
- **Example:**
  ```
  NEXT_PUBLIC_MAINNET_DIVIDEND_ID=CBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  ```

## Read Aggregation API (Optional)

### `NEXT_PUBLIC_API_URL`

- **Purpose:** Optional base URL of the Nexus RWA indexing API. When configured, supported aggregate views (asset lists, platform statistics, holder lists/counts, and recent indexed contract events) are fetched from the API instead of being calculated through direct Soroban RPC simulations. **Writes (signing transactions) always use Soroban RPC regardless of this setting.**
- **Required:** No (defaults to empty; all reads fall back to direct RPC simulations)
- **Format:** HTTPS URL (base URL; the app automatically appends `/v1` and then route paths like `/assets`, `/stats`, `/holders`, `/events`)
- **Example:**
  ```
  NEXT_PUBLIC_API_URL=https://rwa-api.example.com
  ```
- **Note:** Do _not_ include `/v1` in this value — the app adds it automatically. The API server mounts all data routes under `/v1`; only health and meta routes (`/`, `/version`, `/health`, `/metrics`) are unversioned.
- **Benefits:** The indexer serves pre-aggregated data, reducing RPC requests and usually making list and statistics views faster.
- **Tradeoffs:** The app depends on the indexer's availability and freshness. A successful response may lag behind the latest on-chain state; the app does not compare API results with Soroban or detect stale data.
- **Fallback behavior:** If the URL is unset, or a request fails (including a non-success HTTP response or invalid JSON), the affected view falls back to direct Soroban RPC reads using `simulateTransaction`. Those reads do not require the indexing API but can be slower and make more RPC requests. A successful but stale API response does not trigger this fallback. Transfer history requires the indexer's `/events` feed; when the API is unconfigured, the asset page shows an empty activity state, and when a configured feed cannot be loaded it shows an unavailable state.

## App Metadata (Optional)

These are typically set automatically by the build system and are used only in the footer for version tracking and debugging.

### `NEXT_PUBLIC_APP_VERSION`

- **Purpose:** The semantic version of the app displayed in the footer.
- **Required:** No (defaults to the `version` field in `package.json` at build time)
- **Format:** Semantic version (e.g., `1.0.0`, `1.2.3-alpha`)
- **Example:**
  ```
  NEXT_PUBLIC_APP_VERSION=1.0.0
  ```
- **Note:** If not set, `next.config.mjs` reads the version from `package.json` during the build.

### `NEXT_PUBLIC_APP_COMMIT`

- **Purpose:** The git commit hash of the deployed build, displayed in the footer for correlating user-reported bugs with a specific code version.
- **Required:** No (defaults to resolution from environment, then `git rev-parse --short HEAD`)
- **Format:** Git commit hash (full or short; only the first 7 characters are displayed)
- **Example:**
  ```
  NEXT_PUBLIC_APP_COMMIT=abc1234
  ```
- **Resolution order at build time:**
  1. `NEXT_PUBLIC_APP_COMMIT` (explicit override)
  2. `VERCEL_GIT_COMMIT_SHA` (set by Vercel on deploy)
  3. `GIT_COMMIT_SHA` (set by some CI systems)
  4. `COMMIT_REF` (set by other CI systems)
  5. `git rev-parse --short HEAD` (local git history, if available)
  6. Undefined (if none of the above are available)
