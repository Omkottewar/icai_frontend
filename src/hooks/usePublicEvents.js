import { useEffect, useState } from 'react';
import { cachedGet, subscribe } from '../lib/apiCache';

// Public GET /api/events. Cached for 60s — public events update infrequently
// and the home + events pages can share the same cached payload.
//
// params:
//   audience  — 'members' | 'students' | 'all'  (filter; default = all)
//   committee — committee code                    (filter; default = none)
//   past      — true → return past events instead of upcoming. Past events
//               sort newest-first; upcoming sort soonest-first.
export function usePublicEvents(params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped by the invalidation subscription so admin publishes/edits
  // appear immediately without a page reload.
  const [nonce, setNonce] = useState(0);

  const key = JSON.stringify({
    audience: params.audience || '',
    committee: params.committee || '',
    past: params.past ? '1' : '',
  });

  useEffect(() => subscribe('/api/events', () => setNonce((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/events', JSON.parse(key), 60_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, nonce]);

  return { data, loading, error };
}
