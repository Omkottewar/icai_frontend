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

  const refresh = useCallback(() => {
    revalidate(endpoint, JSON.parse(key), ttl).catch(() => {});
    setTick((t) => t + 1);
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
//     → wipes '/api/admin/events' AND '/api/checklists' (publish may have
//        affected the checklist's row).
export async function adminFetch(endpoint, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') return cachedGet(endpoint);

  // Derive an invalidation prefix from the endpoint:
  //   /api/admin/users/<id>/roles → /api/admin/users
  //   /api/admin/events/<id>/publish → /api/admin/events  (and /api/checklists)
  const match = endpoint.match(/^(\/api\/admin\/[a-z_]+)/);
  const prefix = match ? match[1] : '/api';
  const extra = [];
  if (endpoint.includes('/publish') || endpoint.includes('/cancel')) {
    extra.push('/api/checklists');
  }
  return apiWrite(endpoint, {
    method,
    body: opts.body,
    invalidates: [prefix, ...extra],
  });
}

// Re-export the raw invalidator for callers that need finer control
// (e.g. invalidating /api/checklists after creating one from /admin/events).
export { invalidate };
