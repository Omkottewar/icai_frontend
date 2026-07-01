import { useEffect, useState } from 'react';
import { cachedGet, subscribe } from '../lib/apiCache';

// Public GET /api/announcements. Returns currently-active announcements
// (server filters by starts_at ≤ now ≤ ends_at). 60s shared cache.
export function useAnnouncements() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => subscribe('/api/announcements', () => setNonce((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/announcements', {}, 60_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nonce]);

  return { data, loading, error };
}
