# Custom and Local RPC Setup

By default, the app connects to the public Stellar Soroban RPC endpoints. For development or testing against a local or custom RPC instance, you can override these endpoints via environment variables.

## Quick Start: Local Soroban Network

To run the app against a **local Soroban quickstart** (standalone network):

1. **Start your local Soroban network:**
   ```bash
   docker run --rm -it \
     -p 8000:8000 \
     stellar/quickstart:latest \
     --standalone
   ```
   This exposes a local Soroban RPC at `http://localhost:8000`.

2. **Set the environment variable in `.env.local`:**
   ```
   NEXT_PUBLIC_TESTNET_RPC_URL=http://localhost:8000
   NEXT_PUBLIC_DEFAULT_NETWORK=testnet
   ```

3. **Start the app:**
   ```bash
   npm run dev
   ```

The app now talks to your local network. Since the local network has no deployed contracts, you'll need to deploy the registry, compliance, and dividend contracts there first, then set their IDs:

```
NEXT_PUBLIC_TESTNET_REGISTRY_ID=<local-registry-id>
NEXT_PUBLIC_TESTNET_COMPLIANCE_ID=<local-compliance-id>
NEXT_PUBLIC_TESTNET_DIVIDEND_ID=<local-dividend-id>
```

## Custom Remote RPC Provider

To point the app at a different RPC provider (e.g., a private or alternative public endpoint):

```
NEXT_PUBLIC_TESTNET_RPC_URL=https://your-custom-rpc.example.com
```

## Failover / Multiple RPC URLs

RPC endpoints are configured independently for Testnet and Mainnet. For each
network, the app builds an ordered candidate list from the non-empty primary
URL, the comma-separated fallback URLs, and the built-in public RPC URL, which
is appended as the final candidate. The app does not remove duplicate URLs, so
avoid repeating an endpoint in the primary, fallback list, and built-in
position.

To configure multiple RPC URLs for redundancy:

```
NEXT_PUBLIC_TESTNET_RPC_URL=https://primary-rpc.example.com
NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK=https://fallback-1.example.com,https://fallback-2.example.com
```

The candidate order for this example is:
1. **Primary:** `https://primary-rpc.example.com`
2. **Fallback 1:** `https://fallback-1.example.com`
3. **Fallback 2:** `https://fallback-2.example.com`
4. **Built-in public candidate:** `https://soroban-testnet.stellar.org`

### How Failover Works

- A wrapped RPC failure increments that network's counter for the currently
  selected URL. A successful request does **not** clear the counter.
- After **3 reported failures** on the current URL, the cached client switches
  to the next candidate and the counter resets. The threshold is the fixed
  `FAILOVER_THRESHOLD = 3` in `lib/stellar.ts`; it is not an environment
  variable.
- Candidates are selected in order, then **wrap around to index 0** after the
  last candidate. The app does not permanently exhaust or remove an endpoint;
  repeated failures can cycle through the whole list.
- With no primary or fallback URL configured, the built-in public URL is the
  only candidate, so failover cannot move to another endpoint and errors
  surface to the UI.
- Counters and the selected candidate are independent per network and live
  only in the browser's in-memory session. Reloading the page starts from the
  first candidate with a fresh counter.
- Read simulations also retry transient rate-limit and network errors up to
  three attempts with backoff. Each failed attempt is reported to the failover
  counter; a switch updates the cached client for subsequent calls.

The `NEXT_PUBLIC_*` settings are included in the browser bundle. Treat RPC URLs
as public; do not put credentials or secrets in them. For a deployed app, set
these values in its build environment and rebuild/redeploy after changing them.

### Example: High-Availability Setup

```
NEXT_PUBLIC_TESTNET_RPC_URL=https://rpc-1.myinfra.com
NEXT_PUBLIC_TESTNET_RPC_URLS_FALLBACK=https://rpc-2.myinfra.com,https://rpc-3.myinfra.com,https://soroban-testnet.stellar.org
NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet-rpc-1.myinfra.com
NEXT_PUBLIC_MAINNET_RPC_URLS_FALLBACK=https://mainnet-rpc-2.myinfra.com,https://mainnet.sorobanrpc.com
```

## Mixed HTTP/HTTPS

The app allows unencrypted HTTP URLs **only** for localhost or testing (useful for local Docker networks). Public URLs must be HTTPS.

```
# Allowed (local testing)
NEXT_PUBLIC_TESTNET_RPC_URL=http://localhost:8000

# Rejected (insecure public URL)
# NEXT_PUBLIC_TESTNET_RPC_URL=http://example.com  <- This will fail
```

## Troubleshooting

### "ECONNREFUSED" or "No route to host"

- Verify the RPC URL is reachable: `curl -s https://your-rpc.example.com/health`
- Check firewall rules and DNS resolution.

### High latency on list views

- Check if `NEXT_PUBLIC_API_URL` is set and responsive. If missing or slow, list operations fall back to simulating every read against RPC, which is much slower.

### "The contract call could not be completed"

- This usually means the RPC is reachable but the contract ID doesn't exist there. Verify you've set the correct contract IDs for this network and that they're actually deployed.
