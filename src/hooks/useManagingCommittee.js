import { useEffect, useState } from 'react';
import { cachedGet, subscribe } from '../lib/apiCache';

// Public roster for the About page. Derives from user_role_assignments on
// the server — no separate CMS data to maintain.
//
// Returns { rows, loading }. Each row: { user_id, name, role_code,
// role_name, avatar_url }. Already sorted server-side by role precedence
// (chairman → vice → secretary → treasurer → MCMs alphabetic).
export function useManagingCommittee() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Roster is derived from user_role_assignments — refetch when either
  // the site content bundle (which controls avatar overrides) or an
  // admin user/role write happens.
  useEffect(() => subscribe('/api/site/managing-committee', () => setNonce((n) => n + 1)), []);
  useEffect(() => subscribe('/api/site/content',           () => setNonce((n) => n + 1)), []);
  useEffect(() => subscribe('/api/users',                  () => setNonce((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/site/managing-committee', null, 300_000)
      .then((j) => { if (!cancelled) setRows(j?.rows ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nonce]);

  return { rows, loading };
}
