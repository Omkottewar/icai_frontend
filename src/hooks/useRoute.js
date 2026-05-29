import { useState, useEffect } from 'react';

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

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}
