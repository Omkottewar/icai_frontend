import { useEffect, useState } from 'react';
import { cachedGet, subscribe } from '../lib/apiCache';

// Public GET /api/committees. Cached for 5 minutes — committees rarely
// change during a session.
export function usePublicCommittees() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => subscribe('/api/committees', () => setNonce((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/committees', null, 300_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nonce]);

  return { data, loading, error };
}

// Deterministic accent colour from a committee code. Hash → palette index.
// Keeps every committee visually distinct without hardcoding per-committee
// metadata. Replace with a DB column later if admins need to pick colours.
const PALETTE = [
  '#2563eb', // blue
  '#7c3aed', // violet
  '#ea580c', // orange
  '#16a34a', // green
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#be185d', // pink
  '#0f766e', // teal
  '#d97706', // amber
  '#9333ea', // purple
];
export function committeeColor(code) {
  if (!code) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
