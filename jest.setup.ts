import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom ships neither TextEncoder nor TextDecoder, but @stellar/stellar-sdk
// reaches for them at import time (via uint8array-extras) and throws before a
// single test runs.
Object.assign(globalThis, {
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
});
