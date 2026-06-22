// Tiny per-tab GET cache with in-flight deduplication.
//
// Two problems we're solving:
//  1. Components mounting at the same time (dashboard widgets, header badge)
//     used to fire identical /api/checklists fetches in parallel.
//  2. Navigating away and back used to refetch even if the data is fresh.
//
// Cache rules:
//   • Keyed by full URL (path + querystring).
//   • TTL is per-key (default 30s). After TTL the next read still returns
//     cached data instantly, then revalidates in the background.
//   • In-flight requests are shared — N concurrent callers, one network hit.
//   • invalidate(url|/regex/) wipes matching entries (called after writes).
//
// Not a full SWR replacement. No focus-revalidation, no offline, no
// subscriptions across tabs. Just enough to stop wasteful refetches.

const CACHE = new Map();           // url → { data, ts, ttl }
const INFLIGHT = new Map();        // url → Promise

const DEFAULT_TTL = 30_000; // 30s

function buildUrl(path, qs) {
  if (!qs) return path;
  const params = Object.entries(qs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return params ? `${path}?${params}` : path;
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
  const r = await fetch(url, { credentials: 'include', ...opts });
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
    return cached.data;
  }

  // In-flight dedup
  const existing = INFLIGHT.get(url);
  if (existing) return existing;

  const p = rawFetch(url)
    .then((data) => {
      CACHE.set(url, { data, ts: Date.now(), ttl });
      INFLIGHT.delete(url);
      return data;
    })
    .catch((err) => {
      INFLIGHT.delete(url);
      throw err;
    });
  INFLIGHT.set(url, p);
  return p;
}

// Force a fresh fetch and replace the cache entry. Used by `refresh()`.
export async function revalidate(path, qs, ttl = DEFAULT_TTL) {
  const url = buildUrl(path, qs);
  INFLIGHT.delete(url);
  CACHE.delete(url);
  return cachedGet(path, qs, ttl);
}

// Wipe cache entries. Pass a string for exact prefix match, or a RegExp.
// Call this after a successful write so the next read is fresh.
export function invalidate(pattern) {
  for (const key of Array.from(CACHE.keys())) {
    if (typeof pattern === 'string') {
      if (key.startsWith(pattern)) CACHE.delete(key);
    } else if (pattern instanceof RegExp) {
      if (pattern.test(key)) CACHE.delete(key);
    }
  }
}

// Non-GET wrapper. Sends the body, parses the response, and invalidates
// cache entries matching `invalidates` (string or array).
export async function apiWrite(path, opts = {}) {
  const { method = 'POST', body, invalidates } = opts;
  const r = await fetch(path, {
    method,
    credentials: 'include',
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
