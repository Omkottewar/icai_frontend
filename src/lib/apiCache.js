// Tiny per-tab GET cache with in-flight deduplication + subscription bus.
//
// Three problems we're solving:
//  1. Components mounting at the same time (dashboard widgets, header badge)
//     used to fire identical /api/checklists fetches in parallel.
//  2. Navigating away and back used to refetch even if the data is fresh.
//  3. When one component invalidates a URL, other components already
//     rendering the same URL used to keep their stale local state until
//     they unmounted / remounted. That's why admin edits to site content,
//     events and checklists needed a full reload to reflect on the public
//     site. Consumers now subscribe() to their URL prefix, and invalidate
//     both wipes the cache AND fires their callback so they refetch in
//     place. A BroadcastChannel mirrors invalidations across tabs.
//
// Cache rules:
//   • Keyed by full URL (path + querystring).
//   • TTL is per-key (default 30s). After TTL the next read still returns
//     cached data instantly, then revalidates in the background.
//   • In-flight requests are shared — N concurrent callers, one network hit.
//   • invalidate(url|/regex/) wipes matching entries AND notifies matching
//     subscribers (called after writes).

const CACHE = new Map();           // url → { data, ts, ttl }
const INFLIGHT = new Map();        // url → Promise
const SUBSCRIBERS = new Set();     // { pattern, callback }

const DEFAULT_TTL = 30_000; // 30s

// Tracing — flip on in the browser console with `window.__ICAI_CACHE_DEBUG__ = true`.
// Every cache event logs a single line so we can see whether writes fire invalidate,
// whether invalidate wakes subscribers, and whether the next GET refetches. Off by
// default so production and normal dev sessions stay quiet.
function debug(...args) {
  if (typeof window !== 'undefined' && window.__ICAI_CACHE_DEBUG__) {
    // eslint-disable-next-line no-console
    console.log('[cache]', ...args);
  }
}

export function buildUrl(path, qs) {
  if (!qs) return path;
  const params = Object.entries(qs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return params ? `${path}?${params}` : path;
}

// Seed the cache with a value we already know is authoritative — used by
// `useAdminList.mutateRow` right after a write, so the subscribe-triggered
// re-fetch that follows returns from cache (fresh mutation result) instead
// of racing against DB replication or a slow read-after-write path.
export function primeCache(path, qs, data, ttl = DEFAULT_TTL) {
  const url = buildUrl(path, qs);
  CACHE.set(url, { data, ts: Date.now(), ttl });
  // Any in-flight request for this URL is now stale relative to what we
  // just wrote — drop it so its late-arriving response can't overwrite.
  INFLIGHT.delete(url);
  debug('primeCache', url);
}

// Fires when any cached/written request comes back with a forbidden
// response — typically because a role assignment was revoked between
// page loads. AuthContext listens and re-fetches /api/auth/me, which
// causes role-gated components (RequireAdmin, RequireEmployer, the
// dashboard's office-bearer CTA) to re-evaluate.
function signalRoleChange() {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new Event('auth:revalidate')); } catch { /* old browser */ }
}

async function rawFetch(url, opts = {}) {
  // `cache: 'no-store'` — the browser HTTP cache is a layer below this
  // module's own JS cache. Without it, a same-URL GET fired right after
  // a write can still return the pre-write body because the browser
  // served its cached copy on an ETag revalidation. We control freshness
  // via our own invalidate() bus, so opting out of the browser cache
  // guarantees that when we say "revalidate," the network is actually hit.
  const r = await fetch(url, { credentials: 'include', cache: 'no-store', ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 403 from any endpoint is a strong "your roles changed" signal —
    // the user's session is still valid (else we'd get 401), but they
    // no longer have permission for this resource. Bust any cached
    // entries for this URL so we don't keep serving stale 200s from
    // before the role change, and ask AuthContext to re-read /me.
    if (r.status === 403) {
      CACHE.delete(url);
      signalRoleChange();
    }
    const err = new Error(j.error || j.message || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return j;
}

// Get with cache. Returns cached data immediately when fresh; otherwise
// awaits the network. Concurrent calls for the same URL share one promise.
export async function cachedGet(path, qs, ttl = DEFAULT_TTL) {
  const url = buildUrl(path, qs);
  const cached = CACHE.get(url);

  // Fresh hit
  if (cached && Date.now() - cached.ts < cached.ttl) {
    debug('GET hit', url, `age=${Date.now() - cached.ts}ms`);
    return cached.data;
  }

  // In-flight dedup
  const existing = INFLIGHT.get(url);
  if (existing) { debug('GET dedup', url); return existing; }
  debug('GET fetch', url);

  // Capture the promise reference so the .then can check whether it's
  // still the "current" in-flight fetch. If invalidate() ran mid-flight,
  // this promise's response is stale — it reflects state from *before*
  // the write. We must not write it into CACHE, and we must not clear
  // INFLIGHT (which may now belong to a newer fetch triggered by an
  // invalidation subscriber).
  let p;
  p = rawFetch(url)
    .then((data) => {
      if (INFLIGHT.get(url) === p) {
        CACHE.set(url, { data, ts: Date.now(), ttl });
        INFLIGHT.delete(url);
      }
      return data;
    })
    .catch((err) => {
      if (INFLIGHT.get(url) === p) INFLIGHT.delete(url);
      throw err;
    });
  INFLIGHT.set(url, p);
  return p;
}

// Force a fresh fetch and replace the cache entry. Used by `refresh()`.
export async function revalidate(path, qs, ttl = DEFAULT_TTL) {
  const url = buildUrl(path, qs);
  debug('revalidate', url);
  INFLIGHT.delete(url);
  CACHE.delete(url);
  return cachedGet(path, qs, ttl);
}

// Wipe cache entries. Pass a string for exact prefix match, or a RegExp.
// Call this after a successful write so the next read is fresh — and so
// any mounted subscribers refetch in place.
export function invalidate(pattern) {
  const matches = (key) => (
    typeof pattern === 'string' ? key.startsWith(pattern) :
    pattern instanceof RegExp   ? pattern.test(key)       :
    false
  );
  let wiped = 0, inflightDropped = 0;
  for (const key of Array.from(CACHE.keys()))    if (matches(key)) { CACHE.delete(key); wiped++; }
  // Also abandon any in-flight fetches for matching keys. Their responses
  // reflect state from before this write; if we let them sit in INFLIGHT
  // a subscriber's refetch would dedup onto the stale promise and see the
  // OLD payload. Dropping them from INFLIGHT forces a fresh network hit.
  // The stray promise's .then now checks INFLIGHT.get(url) === p before
  // writing to CACHE, so it silently discards its own response.
  for (const key of Array.from(INFLIGHT.keys())) if (matches(key)) { INFLIGHT.delete(key); inflightDropped++; }
  debug('invalidate', pattern, `wiped=${wiped}`, `inflight-dropped=${inflightDropped}`);
  notify(pattern);
  broadcastInvalidation(pattern);
}

// Two subscriber patterns "intersect" if either could touch keys covered
// by the other. In practice: a subscriber on '/api/site/content' should
// fire when invalidate('/api/site') runs (broader wipe) OR when
// invalidate('/api/site/content/foo') runs (child wipe). String
// comparisons are cheap; RegExp patterns fall back to testing against the
// string pattern.
function patternsIntersect(a, b) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.startsWith(b) || b.startsWith(a);
  }
  if (a instanceof RegExp && typeof b === 'string') return a.test(b);
  if (b instanceof RegExp && typeof a === 'string') return b.test(a);
  return false;
}

function notify(pattern) {
  // Snapshot before iterating — a callback that unsubscribes shouldn't
  // skip its siblings.
  let matched = 0, total = 0;
  for (const entry of Array.from(SUBSCRIBERS)) {
    total++;
    if (patternsIntersect(entry.pattern, pattern)) {
      matched++;
      try { entry.callback(pattern); } catch { /* subscriber threw — ignore */ }
    }
  }
  debug('notify', pattern, `matched=${matched}/${total} subscribers`);
}

// subscribe(pattern, cb) → unsubscribe(). Called by consumer hooks so they
// can refetch when their URL is invalidated. Pattern is a URL prefix
// string (recommended) or a RegExp.
export function subscribe(pattern, callback) {
  const entry = { pattern, callback };
  SUBSCRIBERS.add(entry);
  debug('subscribe', pattern, `total=${SUBSCRIBERS.size}`);
  return () => {
    SUBSCRIBERS.delete(entry);
    debug('unsubscribe', pattern, `total=${SUBSCRIBERS.size}`);
  };
}

// Cross-tab: broadcast invalidations so a public tab that was open
// before the admin edit still refetches. Lazy-init so SSR / test
// environments without BroadcastChannel still work. Sentinel value
// `null` means "we tried and it isn't supported."
let _channel;   // undefined = untried, BroadcastChannel = live, null = unsupported
function getBroadcastChannel() {
  if (_channel !== undefined) return _channel;
  if (typeof BroadcastChannel === 'undefined') { _channel = null; return null; }
  try {
    const ch = new BroadcastChannel('icai-api-cache');
    ch.onmessage = (e) => {
      const p = e?.data?.pattern;
      if (typeof p !== 'string') return;
      // Wipe local cache + inflight to match the other tab, then notify
      // local subscribers so mounted components refetch.
      for (const key of Array.from(CACHE.keys()))    if (key.startsWith(p)) CACHE.delete(key);
      for (const key of Array.from(INFLIGHT.keys())) if (key.startsWith(p)) INFLIGHT.delete(key);
      notify(p);
    };
    _channel = ch;
    return ch;
  } catch { _channel = null; return null; }
}
function broadcastInvalidation(pattern) {
  if (typeof pattern !== 'string') return;   // don't ship RegExps across tabs
  const ch = getBroadcastChannel();
  if (ch) try { ch.postMessage({ pattern }); } catch { /* ignore */ }
}

// Non-GET wrapper. Sends the body, parses the response, and invalidates
// cache entries matching `invalidates` (string or array).
export async function apiWrite(path, opts = {}) {
  const { method = 'POST', body, invalidates } = opts;
  debug('write', method, path, `invalidates=${JSON.stringify(invalidates)}`);
  const r = await fetch(path, {
    method,
    credentials: 'include',
    // Match rawFetch — writes shouldn't touch the browser HTTP cache
    // either, so the response ETag can't be used to satisfy a follow-up
    // GET from the browser's own cache.
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 403) signalRoleChange();
    const err = new Error(j.error || j.message || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  if (invalidates) {
    const list = Array.isArray(invalidates) ? invalidates : [invalidates];
    for (const p of list) invalidate(p);
  }
  return j;
}
