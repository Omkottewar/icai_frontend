import { useCallback, useEffect, useState } from 'react';
import { cachedGet, revalidate, apiWrite, invalidate, subscribe } from '../lib/apiCache';

// Toggle in the browser console: `window.__ICAI_CACHE_DEBUG__ = true`. Same
// flag apiCache.js reads — a single switch turns on the whole trace.
function debug(...args) {
  if (typeof window !== 'undefined' && window.__ICAI_CACHE_DEBUG__) {
    // eslint-disable-next-line no-console
    console.log('[useAdminList]', ...args);
  }
}

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

    debug('effect run', endpoint, `key=${key}`, `tick=${tick}`);
    cachedGet(endpoint, JSON.parse(key), ttl)
      .then((j) => {
        if (!cancelled) {
          debug('setData', endpoint, `rows=${Array.isArray(j?.rows) ? j.rows.length : '?'}`);
          setData(j);
        } else {
          debug('setData suppressed (cancelled)', endpoint);
        }
      })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { debug('effect cleanup', endpoint, `tick=${tick}`); cancelled = true; };
  }, [endpoint, key, enabled, tick, ttl]);

  // Auto-refetch when any write invalidates our endpoint. Fires when the
  // admin saves from a sibling drawer, when another tab makes a change
  // (BroadcastChannel), or when a related public write happens. Bumping
  // tick reruns the data effect above, which pulls the fresh row from a
  // wiped cache.
  useEffect(() => {
    if (!enabled) return;
    return subscribe(endpoint, () => {
      debug('sub fired → tick++', endpoint);
      setTick((t) => t + 1);
    });
  }, [endpoint, enabled]);

  // Awaits the network round-trip and writes the result straight into
  // local state. Previously this fired revalidate() without awaiting and
  // relied on a tick bump to re-trigger the useEffect — that worked
  // *most* of the time but raced with consumers that closed a drawer
  // immediately after calling refresh(), so the list re-render landed
  // before the new row was in the cache. Returning the promise lets
  // callers `await refresh()` and be certain the new data is visible.
  const refresh = useCallback(async () => {
    debug('refresh() called', endpoint, `key=${key}`);
    try {
      const fresh = await revalidate(endpoint, JSON.parse(key), ttl);
      debug('refresh() setData', endpoint, `rows=${Array.isArray(fresh?.rows) ? fresh.rows.length : '?'}`);
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

  // Optimistic single-row update. When a save endpoint returns the
  // freshly-written row, callers pass it here and we splice it into
  // local state immediately — no refetch, no cache round-trip. React
  // reconciles just the card/row that changed. This is the fast path
  // for "user edits a slot → sees the new value the moment the drawer
  // closes." Matches on `id`, `slug`, or `code` (the three primary
  // keys in use across admin resources); unknown-shape rows are ignored.
  const mutateRow = useCallback((row) => {
    if (!row || typeof row !== 'object') return;
    const rowKey = row.id ?? row.slug ?? row.code;
    if (rowKey == null) return;
    setData((prev) => {
      if (!prev || !Array.isArray(prev.rows)) return prev;
      let found = false;
      const rows = prev.rows.map((r) => {
        if ((r.id ?? r.slug ?? r.code) === rowKey) { found = true; return { ...r, ...row }; }
        return r;
      });
      if (!found) rows.push(row);
      return { ...prev, rows };
    });
  }, []);

  return { data, loading, error, refresh, mutateRow };
}

// Mutation wrapper for non-GET admin requests. Automatically invalidates
// cache entries under the same endpoint family so the next list/detail read
// is fresh — AND the public counterpart, so the live site refetches too.
//
// Examples of resolved invalidation:
//   adminFetch('/api/admin/users/<id>', { method: 'PATCH', body })
//     → wipes every '/api/admin/users' key (no public counterpart).
//   adminFetch('/api/admin/site/content/<slug>', { method: 'PUT', body })
//     → wipes '/api/admin/site' AND '/api/site' (so useSiteContent /
//        useSiteSettings / useManagingCommittee all refetch instantly).
//   adminFetch('/api/admin/events/<id>/publish', { method: 'POST' })
//     → wipes '/api/admin/events', '/api/events' AND '/api/checklist-instances'
//        (publish may have affected the instance's row via the auto-publish
//         trigger).
export async function adminFetch(endpoint, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') return cachedGet(endpoint);

  // Derive invalidation prefixes from the endpoint:
  //   /api/admin/users/<id>/roles → admin prefix '/api/admin/users'
  //   /api/admin/site/content/... → admin '/api/admin/site' + public '/api/site'
  const match = endpoint.match(/^\/api\/admin\/([a-z0-9_-]+)/);
  const adminPrefix  = match ? `/api/admin/${match[1]}` : '/api';
  const publicPrefix = match ? `/api/${match[1]}`      : null;
  const extra = [];
  if (endpoint.includes('/publish') || endpoint.includes('/cancel')) {
    extra.push('/api/checklist-instances');
  }
  // Public counterpart may not exist for every resource (e.g. users, files),
  // but invalidating a non-existent prefix is a cheap no-op — it just makes
  // sure /api/site, /api/events, /api/committees etc. all stay in sync.
  if (publicPrefix) extra.push(publicPrefix);
  return apiWrite(endpoint, {
    method,
    body: opts.body,
    invalidates: [adminPrefix, ...extra],
  });
}

// Re-export the raw invalidator for callers that need finer control
// (e.g. invalidating /api/checklist-instances after creating one from /admin/events).
export { invalidate };
