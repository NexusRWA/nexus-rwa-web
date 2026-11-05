/**
 * Deduplicate in-flight requests to prevent refetch storms when multiple
 * components request the same data simultaneously.
 *
 * Entries are reusable for at most 5 seconds from the request's start time.
 * This is a deduplication window, not a response-freshness TTL: a settled
 * promise is removed on the next timer turn, and no response is kept for
 * later reads. If a request is still pending after 5 seconds, a new call
 * starts another request; the original request is not cancelled.
 */

type CacheKey = string;
type CacheEntry<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const inFlightRequests = new Map<CacheKey, CacheEntry<unknown>>();
const CACHE_DURATION_MS = 5000;

/**
 * Execute a factory function once, sharing its promise with calls that use
 * the same key within the 5-second deduplication window. Settlement schedules
 * the entry for removal on the next timer turn. This does not cache response
 * data or guarantee that a response is fresh for 5 seconds.
 */
export function dedupeRequest<T>(
  key: CacheKey,
  factory: () => Promise<T>
): Promise<T> {
  const cached = inFlightRequests.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    // The map stores Promise<unknown> since it's shared across callers with
    // different T; callers are responsible for using a key whose cached
    // value actually matches the T they ask for.
    return cached.promise as Promise<T>;
  }

  const promise = factory().finally(() => {
    // Clean up after a short delay to allow concurrent consumers to receive the result
    setTimeout(() => {
      if (inFlightRequests.get(key)?.promise === promise) {
        inFlightRequests.delete(key);
      }
    }, 0);
  });

  inFlightRequests.set(key, { promise, timestamp: Date.now() });
  return promise;
}

/**
 * Clear all cached requests (useful for testing).
 */
export function clearRequestCache(): void {
  inFlightRequests.clear();
}
