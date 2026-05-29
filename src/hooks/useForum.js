import { useCallback, useEffect, useState } from 'react';
import { cachedGet, revalidate, apiWrite } from '../lib/apiCache';

// Mutation wrapper that invalidates list/detail caches after a write.
export async function forumFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') return cachedGet(url);
  return apiWrite(url, {
    method,
    body: opts.body,
    invalidates: ['/api/forum/threads'],
  });
}

// List threads with filters. Cache key includes the querystring so different
// filter combos are cached separately.
export function useForumThreads(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // Stringify the filter set for a stable effect dep — recomputing on every
  // render would cause a fetch storm.
  const key = JSON.stringify({
    event_id: params.event_id || '',
    committee_id: params.committee_id || '',
    tag: params.tag || '',
    q: params.q || '',
    mine: params.mine || '',
    sort: params.sort || '',
    page: params.page || '',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/forum/threads', JSON.parse(key))
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, tick]);

  const refresh = useCallback(() => {
    revalidate('/api/forum/threads', JSON.parse(key)).catch(() => {});
    setTick((t) => t + 1);
  }, [key]);
  return { data, loading, error, refresh };
}

// Single thread + posts.
export function useForumThread(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet(`/api/forum/threads/${id}`)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  const refresh = useCallback(() => {
    if (id) revalidate(`/api/forum/threads/${id}`).catch(() => {});
    setTick((t) => t + 1);
  }, [id]);
  return { data, loading, error, refresh };
}

// Composer lookups — cached for 5 minutes since events/committees rarely
// change while a user is on the page.
export function useForumLookups() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/forum/lookups', null, 300_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return data;
}
