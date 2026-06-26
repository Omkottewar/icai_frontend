import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { cachedGet, invalidate } from '../lib/apiCache';

// Fetches /api/dashboard once auth resolves. Shape depends on user.primary_role:
//   member  → { role, profile, cpe, upcomingEvents, recentCertificates, ... }
//   student → { role, profile, eventsAttended, upcomingEvents }
//   other   → { role, upcomingEvents }
//
// Cached for 30s through the shared apiCache so navigating away and back is
// instant — and so two widgets that mount the same call only fetch once.
//
// Returns a `refresh()` callback so mutating components (e.g. the
// profile-edit drawer) can force a re-fetch after a save. Without it,
// invalidating the cache alone isn't enough — the component's local
// `data` state still holds the stale snapshot until its deps change,
// which is why "Save profile" used to leave the completeness percentage
// at its old value.
export function useDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumping this re-runs the effect → re-fetches.
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [user, authLoading, reloadKey]);

  const refresh = useCallback(() => {
    invalidate('/api/dashboard');
    setReloadKey((k) => k + 1);
  }, []);

  return { data, loading, error, refresh };
}
