import { useCallback, useEffect, useState } from 'react';
import { cachedGet, revalidate, apiWrite, invalidate } from '../lib/apiCache';

// Generic fetcher for admin GET endpoints. Backed by the shared apiCache so
// that mounting the same page twice (or two widgets calling the same URL)
// doesn't fire duplicate requests.
//
// `params` is a plain object of query-string params (skipped if value is falsy).
// `enabled` defaults to true; pass false to suspend fetching (e.g. while a
// drawer is filling out lookups before the parent query is meaningful).
// `ttl` overrides the cache TTL (default 30s from apiCache).
export function useAdminList(endpoint, params, enabled = true, ttl) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // Stable serialised key for the effect dep — recomputing on every render
  // would defeat the cache.
  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true); setError(null);

    cachedGet(endpoint, JSON.parse(key), ttl)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [endpoint, key, enabled, tick, ttl]);

  // Awaits the network round-trip and writes the result straight into
  // local state. Previously this fired revalidate() without awaiting and
  // relied on a tick bump to re-trigger the useEffect — that worked
  // *most* of the time but raced with consumers that closed a drawer
  // immediately after calling refresh(), so the list re-render landed
  // before the new row was in the cache. Returning the promise lets
  // callers `await refresh()` and be certain the new data is visible.
  const refresh = useCallback(async () => {
    try {
      const fresh = await revalidate(endpoint, JSON.parse(key), ttl);
      setData(fresh);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      // Bump tick too — covers the corner case where a consumer depends
      // on a separate effect keyed off it.
      setTick((t) => t + 1);
    }
  }, [endpoint, key, ttl]);

  return { data, loading, error, refresh };
}

// Mutation wrapper for non-GET admin requests. Automatically invalidates
// cache entries under the same endpoint family so the next list/detail read
// is fresh.
//
// Examples of resolved invalidation:
//   adminFetch('/api/admin/users/<id>', { method: 'PATCH', body })
//     → wipes every '/api/admin/users' key (list views + details).
//   adminFetch('/api/admin/events/<id>/publish', { method: 'POST' })
//     → wipes '/api/admin/events' AND '/api/checklist-instances' (publish
//        may have affected the instance's row via the auto-publish trigger).
export async function adminFetch(endpoint, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') return cachedGet(endpoint);

  // Derive an invalidation prefix from the endpoint:
  //   /api/admin/users/<id>/roles → /api/admin/users
  //   /api/admin/events/<id>/publish → /api/admin/events (+ checklist-instances)
  const match = endpoint.match(/^(\/api\/admin\/[a-z0-9_-]+)/);
  const prefix = match ? match[1] : '/api';
  const extra = [];
  if (endpoint.includes('/publish') || endpoint.includes('/cancel')) {
    extra.push('/api/checklist-instances');
  }
  return apiWrite(endpoint, {
    method,
    body: opts.body,
    invalidates: [prefix, ...extra],
  });
}

// Re-export the raw invalidator for callers that need finer control
// (e.g. invalidating /api/checklist-instances after creating one from /admin/events).
export { invalidate };
