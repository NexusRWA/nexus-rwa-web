module.exports = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^.+\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/e2e/"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { "tsconfig": "tsconfig.jest.json" }],
    // @stellar/stellar-sdk's CJS build require()s several ESM-only packages.
    // Node can require() ESM natively but Jest's module registry cannot, so
    // those are transformed down to CJS here instead.
    "^.+\\.m?js$": ["ts-jest", {
      tsconfig: { allowJs: true, module: "commonjs", target: "es2020" }
    }]
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(?:uint8array-extras|eventsource|eventsource-parser|@exodus|@noble|@stellar)/)"
  ],
  // Coverage floor, enforced by `npm run test:ci` (and so by CI). Measured at
  // 82.03% statements / 71.77% branches / 70.57% functions / 83.17% lines; the
  // floor sits ~2 points below so normal churn passes but real drift fails.
  // Raise it when coverage rises; never lower it to make a PR pass.
  coverageThreshold: {
    global: { statements: 80, branches: 70, functions: 68, lines: 81 }
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "json", "node"]
};
