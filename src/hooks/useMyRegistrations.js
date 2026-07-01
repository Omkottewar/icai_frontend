import { useEffect, useState, useCallback } from 'react';
import { cachedGet, invalidate, subscribe } from '../lib/apiCache';
import { useAuth } from '../context/AuthContext';

// Returns the set of event IDs the logged-in user is registered for. Used by
// EventRow + EventsPage to swap the "Register" button for a "Registered ✓"
// badge once the user is already in. Returns an empty set when no user is
// logged in so consumers can render unconditionally.
export function useMyRegistrations() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setData({ rows: [] }); return; }
    setLoading(true);
    try {
      const j = await cachedGet('/api/events/my-registrations', null, 60_000);
      setData(j);
    } catch {
      setData({ rows: [] });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Refetch on any invalidation of the registrations endpoint (or the
  // broader /api/events tree — e.g. an event was cancelled/deleted).
  useEffect(() => subscribe('/api/events', load), [load]);

  const refresh = useCallback(() => {
    invalidate('/api/events/my-registrations');
    return load();
  }, [load]);

  const eventIds = new Set((data?.rows ?? []).map((r) => r.event_id));
  return { eventIds, loading, refresh };
}
