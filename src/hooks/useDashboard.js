import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Fetches /api/dashboard once auth resolves. Shape depends on user.primary_role:
//   member  → { role, profile, cpe, upcomingEvents, recentUdins }
//   student → { role, profile, eventsAttended, upcomingEvents }
//   other   → { role, upcomingEvents }
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

    fetch('/api/dashboard', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { data, loading, error };
}
