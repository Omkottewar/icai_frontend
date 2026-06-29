import { useCallback, useEffect, useState } from 'react';

// Two-way sync between component state and the URL query string — so the
// chairman can copy/paste the URL and the recipient lands on the exact same
// filtered view. Uses history.replaceState so we don't trigger popstate
// (which would scroll the page back to top).
//
// Reads on mount (so direct links work), writes on change. Empty values are
// stripped to keep URLs clean.

function readQuery() {
  const out = {};
  const params = new URLSearchParams(window.location.search);
  params.forEach((v, k) => { out[k] = v; });
  return out;
}

function writeQuery(next) {
  const entries = Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const target = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (target !== current) {
    history.replaceState(null, '', target);
  }
}

export function useUrlState(initial) {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return initial;
    return { ...initial, ...readQuery() };
  });

  useEffect(() => { writeQuery(state); }, [state]);

  const update = useCallback((patch) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  return [state, update];
}
