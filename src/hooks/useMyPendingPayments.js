import { useEffect, useState, useCallback } from 'react';
import { cachedGet, invalidate, subscribe } from '../lib/apiCache';
import { useAuth } from '../context/AuthContext';

// Returns the caller's UPI payments still in flight — status is either
// 'pending' (registration started, UTR not yet submitted) or
// 'pending_verification' (UTR submitted, admin hasn't verified). Used by:
//   • EventRow — swap the Register button for a "Payment under review" pill
//     so the user doesn't accidentally start a second payment for the same
//     event.
//   • DashboardPage — show a small "Awaiting verification" section so the
//     user always knows the status at a glance.
export function useMyPendingPayments() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setData({ rows: [] }); return; }
    setLoading(true);
    try {
      const j = await cachedGet('/api/events/my-pending-payments', null, 60_000);
      setData(j);
    } catch {
      setData({ rows: [] });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribe('/api/events/my-pending-payments', load), [load]);

  const refresh = useCallback(() => {
    invalidate('/api/events/my-pending-payments');
    return load();
  }, [load]);

  const rows = data?.rows ?? [];
  const eventIds = new Set(rows.map((r) => r.event_id));
  return { rows, eventIds, loading, refresh };
}
