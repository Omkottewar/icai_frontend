import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { cachedGet } from '../lib/apiCache';

// Fetches /api/dashboard once auth resolves. Shape depends on user.primary_role:
//   member  → { role, profile, cpe, upcomingEvents, recentUdins }
//   student → { role, profile, eventsAttended, upcomingEvents }
//   other   → { role, upcomingEvents }
//
// Cached for 30s through the shared apiCache so navigating away and back is
// instant — and so two widgets that mount the same call only fetch once.
export function useDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    cachedGet('/api/dashboard', null, 30_000)
      .then((json) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { data, loading, error };
}
