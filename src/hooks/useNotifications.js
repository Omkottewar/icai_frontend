import { useCallback, useEffect, useRef, useState } from 'react';
import { apiWrite } from '../lib/apiCache';

// In-app notifications.
//
// Polls /api/notifications + /api/notifications/unread-count.
// Tab visible  → poll every 10s (snappy badge updates)
// Tab hidden   → suspend polling entirely (saves battery, server load)
// Tab focused  → immediate refresh (catches anything that fired while away)
//
// markRead / markAllRead optimistically update local state and reconcile
// against the server response.

const POLL_MS_ACTIVE = 10_000;

async function get(path) {
  const r = await fetch(path, { credentials: 'include' });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function useNotifications({ enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [listResp, countResp] = await Promise.all([
        get('/api/notifications?limit=50'),
        get('/api/notifications/unread-count'),
      ]);
      // 401 → user is not signed in; quietly clear state.
      if (listResp === null || countResp === null) {
        setItems([]); setUnread(0); setLoading(false); return;
      }
      setItems(listResp.items ?? []);
      setUnread(countResp.count ?? 0);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }

    const start = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(refresh, POLL_MS_ACTIVE);
    };
    const stop = () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };

    // Initial fetch + start polling immediately.
    refresh();
    start();

    // Pause when the tab is hidden so a left-open browser doesn't keep
    // hitting the API. Resume + force-refresh when the tab is visible
    // again — catches anything that fired while the user was away.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        refresh();
        start();
      }
    };
    const onFocus = () => { refresh(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refresh]);

  const markRead = useCallback(async (id) => {
    // Optimistic — flip the row to read, decrement count, then call API.
    setItems((rows) => rows.map((r) => r.id === id && !r.read_at ? { ...r, read_at: new Date().toISOString() } : r));
    setUnread((c) => Math.max(0, c - 1));
    try {
      await apiWrite(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch (err) {
      // Roll back the count if the call failed (item state is harder to roll
      // back precisely; refresh will reconcile).
      setUnread((c) => c + 1);
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const prevUnread = unread;
    setItems((rows) => rows.map((r) => r.read_at ? r : { ...r, read_at: new Date().toISOString() }));
    setUnread(0);
    try {
      await apiWrite('/api/notifications/read-all', { method: 'POST' });
    } catch (err) {
      setUnread(prevUnread);
      refresh();
    }
  }, [unread, refresh]);

  return { items, unread, loading, error, refresh, markRead, markAllRead };
}
