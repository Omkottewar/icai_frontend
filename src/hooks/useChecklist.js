import { useCallback, useEffect, useState } from 'react';
import { cachedGet, revalidate, apiWrite, invalidate } from '../lib/apiCache';

// List instances from the NEW generic engine. Same shape contract as
// useChecklistList but hits /api/checklist-instances. Backend already
// returns only what the user can act on (scoped by role + assignment +
// drafts hidden from non-admins).
export function useChecklistInstanceList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/checklist-instances')
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = useCallback(() => {
    revalidate('/api/checklist-instances').catch(() => {});
    setTick((t) => t + 1);
  }, []);
  return { data, loading, error, refresh };
}

// List checklists the current user can act on. Shared cache across the
// dashboard widgets + /checklists page so they don't all re-fetch.
export function useChecklistList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/checklists')
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = useCallback(() => {
    revalidate('/api/checklists').catch(() => {});
    setTick((t) => t + 1);
  }, []);
  return { data, loading, error, refresh };
}

// Single checklist by id.
export function useChecklist(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet(`/api/checklists/${id}`)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  const refresh = useCallback(() => {
    if (id) revalidate(`/api/checklists/${id}`).catch(() => {});
    invalidate('/api/checklists'); // list view counts may have changed
    setTick((t) => t + 1);
  }, [id]);
  return { data, loading, error, refresh };
}

// Mutation wrapper — automatically invalidates list + detail caches.
export async function checklistFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') {
    return cachedGet(url);
  }
  return apiWrite(url, {
    method,
    body: opts.body,
    invalidates: ['/api/checklists'],
  });
}
