import { useEffect, useState } from 'react';
import { cachedGet } from '../lib/apiCache';

// Public roster for the About page. Derives from user_role_assignments on
// the server — no separate CMS data to maintain.
//
// Returns { rows, loading }. Each row: { user_id, name, role_code,
// role_name, avatar_url }. Already sorted server-side by role precedence
// (chairman → vice → secretary → treasurer → MCMs alphabetic).
export function useManagingCommittee() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/site/managing-committee', null, 300_000)
      .then((j) => { if (!cancelled) setRows(j?.rows ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { rows, loading };
}
