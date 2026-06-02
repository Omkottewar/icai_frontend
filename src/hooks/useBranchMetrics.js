import { useCallback, useEffect, useState } from 'react';
import { cachedGet, revalidate } from '../lib/apiCache';

// Fetch /api/branch/metrics with optional filters. Results are cached for
// 60s — branch metrics don't change minute-to-minute. Exposes `refresh()`
// so the dashboard can re-pull on demand (manual button or polling).
export function useBranchMetrics(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const key = JSON.stringify({
    from: params.from || '',
    to: params.to || '',
    committee_id: params.committee_id || '',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/branch/metrics', JSON.parse(key), 60_000)
      .then((j) => { if (!cancelled) { setData(j); setUpdatedAt(Date.now()); } })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  const refresh = useCallback(async () => {
    setFetching(true); setError(null);
    try {
      const j = await revalidate('/api/branch/metrics', JSON.parse(key), 60_000);
      setData(j);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e);
    } finally {
      setFetching(false);
    }
  }, [key]);

  return { data, loading, fetching, error, updatedAt, refresh };
}
