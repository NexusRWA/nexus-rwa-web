# Request cache behavior

`dedupeRequest` in [`lib/requestCache.ts`](../lib/requestCache.ts) shares a
request promise between calls with the same key. Its 5-second window starts
when the first call creates the entry.

The 5 seconds is a **deduplication window**, not a response-freshness TTL.
When a request settles, its entry is scheduled for removal on the next timer
turn, so later calls can fetch fresh data. No settled response is retained as
a cache of fresh data.

If a request is still pending after 5 seconds, a later call with the same key
starts another request; the original request continues and is not cancelled.
Use keys that identify the request and its relevant inputs, so callers only
share promises for equivalent work.
