import { useEffect, useState } from 'react';
import { cachedGet } from '../lib/apiCache';

// Public GET /api/events. Cached for 60s — public events update infrequently
// and the home + events pages can share the same cached payload.
export function usePublicEvents(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const key = JSON.stringify({
    audience: params.audience || '',
    committee: params.committee || '',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/events', JSON.parse(key), 60_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return { data, loading, error };
}
