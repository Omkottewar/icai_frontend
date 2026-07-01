import { useCallback, useEffect, useState } from 'react';
import { cachedGet, revalidate, subscribe } from '../lib/apiCache';

// Generic checklist-instance engine (templates + instances). The legacy
// event_checklists hooks (useChecklistList, useChecklist, checklistFetch)
// were removed alongside migration 0024 — there's now one system.

// List instances the current user can act on. Backend already scopes by
// role + assignment + hides drafts from non-admins.
export function useChecklistInstanceList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/checklist-instances')
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) { setError(e); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  // Auto-refetch when a checklist write happens anywhere — publish,
  // approval, section save. Otherwise the badge/list keeps its old
  // snapshot until the user re-navigates.
  useEffect(() => subscribe('/api/checklist-instances', () => setTick((t) => t + 1)), []);

  const refresh = useCallback(() => {
    revalidate('/api/checklist-instances').catch(() => {});
    setTick((t) => t + 1);
  }, []);
  return { data, loading, error, refresh };
}
