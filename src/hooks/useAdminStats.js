import { useEffect } from 'react';
import { useAdminList } from './useAdminList';

// Polls /api/admin/stats every 60s so the sidebar/landing tiles stay fresh
// without the user reloading. Pauses while the tab is hidden.
export function useAdminStats() {
  const { data, loading, error, refresh } = useAdminList('/api/admin/stats');

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
