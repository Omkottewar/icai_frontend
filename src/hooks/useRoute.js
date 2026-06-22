import { useState, useEffect, useTransition } from 'react';

export function parseHash(hash) {
  const clean = (hash || '').replace(/^#/, '') || '/';
  const [path, qs] = clean.split('?');
  const query = {};
  if (qs) {
    qs.split('&').forEach((p) => {
      const [k, v] = p.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { path: path.replace(/\/$/, '') || '/', query };
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

// Route hook. Returns `{ path, query }` for the current hash.
//
// We update the route state inside `startTransition` so React treats
// navigations as "non-urgent" work — the old page stays interactive
// while the new chunk loads. Without this, every navigation between
// lazy routes would immediately replace the current UI with the
// nearest Suspense fallback (the shimmer page), which feels like a
// full reload. With useTransition, the previous page keeps painting
// until the new content is ready, and only then does the swap happen.
//
// Side note on hash listeners: hashchange fires before React has any
// say in how to render the next state, so we *can't* delay the actual
// URL change. What we can delay is the React render that depends on
// the new URL — that's what wrapping the setRoute in startTransition
// achieves.
export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  // eslint-disable-next-line no-unused-vars
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handler = () => {
      const next = parseHash(window.location.hash);
      startTransition(() => setRoute(next));
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}
