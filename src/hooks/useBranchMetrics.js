import { useEffect, useState } from 'react';
import { cachedGet } from '../lib/apiCache';

// Fetch /api/branch/metrics with optional filters. Results are cached for
// 60s — branch metrics don't change minute-to-minute.
export function useBranchMetrics(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const key = JSON.stringify({
    from: params.from || '',
    to: params.to || '',
    committee_id: params.committee_id || '',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/branch/metrics', JSON.parse(key), 60_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return { data, loading, error };
}
