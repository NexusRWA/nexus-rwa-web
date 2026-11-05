# Running and Extending Tests

The project has Jest unit/component tests and Playwright browser tests. Both
use mocks: the suite does not need a funded Stellar account, a live Soroban
node, or an installed Freighter extension.

## Run the tests

Install dependencies, then run the Jest suite:

```bash
npm install
npm test
```

Useful Jest variants:

```bash
npm test -- hooks/__tests__/useAssets.test.ts  # run one test file
npm run test:watch                             # watch mode
npm run test:ci                                # CI run with coverage
```

Playwright runs the browser suite against a Next.js dev server. Its
configuration starts `npm run dev` on port 3000 when needed and reuses an
existing local server outside CI:

```bash
npx playwright install chromium  # one-time browser install, if needed
npm run test:e2e
npm run test:e2e -- e2e/transfer.spec.ts  # run one browser test file
```

No real RPC or REST service is required. The e2e fixtures intercept requests in
the browser and return canned responses; the wallet fixture injects a mock
Freighter message handler before the app loads.

## Add a Jest test

Jest runs in `jsdom`, uses `jest.setup.ts`, and discovers unit/component tests
through Jest's default test-file patterns. Tests are kept next to the code or
in a nearby `__tests__` directory. For a hook, use
`renderHook` from Testing Library and mock the hook's service dependencies,
then assert its returned data, loading state, and error state. For a component,
render it with Testing Library and interact with it through accessible
roles/labels.

For example, `hooks/__tests__/useAssets.test.ts` mocks `lib/api`,
`lib/contracts`, and `useWallet` to check both the API path and the direct
registry fallback without making network requests. Keep tests focused on
observable behavior rather than the implementation details of unrelated
hooks.

## Add a Playwright test

Place browser specs in `e2e/`. Import `test` and `expect` from
`@playwright/test`; use the shared helpers in `e2e/fixtures.ts`:

- `mockRpc(page, options)` intercepts Soroban RPC and read API calls. Options
  such as `balance`, `walletApproved`, and `claimable` let a test vary returned
  state.
- `mockFreighterWallet(page, options)` injects a mock wallet before app
  JavaScript runs. Pass `installed: false` to cover a missing extension.

Set up the mocks before `page.goto()`, then assert what a user sees and can do.
Use the transfer and claim specs as examples of page navigation, wallet setup,
and RPC response overrides. If a new feature calls another RPC method, extend
the shared mock with the smallest response needed by the test instead of
allowing a request to reach a live service.

## Useful configuration references

- `jest.config.js` and `jest.setup.ts`: Jest environment, transforms, and setup.
- `playwright.config.ts`: browser project, dev server, workers, and CI settings.
- `e2e/fixtures.ts`: mock wallet, RPC, and read API fixtures.
