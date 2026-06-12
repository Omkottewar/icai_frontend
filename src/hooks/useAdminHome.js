import { useEffect } from 'react';
import { useAdminList } from './useAdminList';

// Polls /api/admin/home every 60s so the inbox / stats stay fresh without
// the user reloading. Pauses while the tab is hidden — there's no point
// refreshing for an off-screen window.
//
// Returns the role-aware payload that drives the admin landing page:
//   {
//     variant: 'chairman' | 'treasurer' | 'committee_chairman' | 'sysadmin',
//     roles: { is_admin, is_branch_chairman, ... },
//     inbox: [...],
//     lists: { my_committee_events: [...] },
//     stats: { upcoming_events, registrations_month, members, inbox_count },
//   }
export function useAdminHome() {
  const { data, loading, error, refresh } = useAdminList('/api/admin/home');

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
