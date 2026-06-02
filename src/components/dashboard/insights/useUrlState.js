import { useCallback, useEffect, useState } from 'react';

// Two-way sync between component state and the URL hash query — so the
// chairman can copy/paste the URL and the recipient lands on the exact same
// filtered view. Uses history.replaceState so we don't trigger hashchange
// (which would scroll the page back to top).
//
// Reads on mount (so direct links work), writes on change. Empty values are
// stripped to keep URLs clean.

function readHashQuery() {
  const raw = window.location.hash.replace(/^#/, '');
  const [, qs] = raw.split('?');
  const out = {};
  if (qs) {
    qs.split('&').forEach((p) => {
      const [k, v] = p.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return out;
}

function writeHashQuery(next) {
  const raw = window.location.hash.replace(/^#/, '');
  const [path] = raw.split('?');
  const entries = Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const target = '#' + (path || '/') + (qs ? `?${qs}` : '');
  if (target !== window.location.hash) {
    history.replaceState(null, '', target);
  }
}

export function useUrlState(initial) {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return initial;
    const q = readHashQuery();
    return { ...initial, ...q };
  });

  useEffect(() => { writeHashQuery(state); }, [state]);

  const update = useCallback((patch) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  return [state, update];
}
