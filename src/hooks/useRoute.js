import { useState, useEffect, useTransition } from 'react';

// History-API based routing. URLs look like /events?committee=DT, NOT
// /#/events?committee=DT. Single source of truth is window.location.pathname
// + window.location.search.
//
// A delegated click listener (installLinkClickInterceptor below) catches
// any <a href="/foo"> click and turns it into history.pushState +
// dispatch('routechange') so React re-renders without a full page reload.
// Direct deep-links work too — the dev server (Vite) and production
// Express catch-all both serve index.html for unknown paths, so the SPA
// boots and useRoute() reads the right path on first render.
//
// Back-compat: anyone landing on a legacy hash URL like /#/events gets
// a one-time history.replaceState into /events on app boot — handled in
// main.jsx so it happens before React mounts.

export function parseLocation(loc = window.location) {
  const path = loc.pathname || '/';
  const qs = (loc.search || '').replace(/^\?/, '');
  const query = {};
  if (qs) {
    qs.split('&').forEach((p) => {
      if (!p) return;
      const [k, v] = p.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { path: path.replace(/\/$/, '') || '/', query };
}

// `navigate('/events?committee=DT')` — pushes a new history entry and
// notifies useRoute listeners. Use replace=true for redirects so the
// previous URL isn't left in the history stack (sign-in → dashboard).
export function navigate(path, opts = {}) {
  if (!path) return;
  // External / mailto / tel — bail and let the browser handle it.
  if (/^([a-z]+:)?\/\//i.test(path) || /^(mailto|tel|sms):/i.test(path)) {
    window.location.href = path;
    return;
  }
  const target = path.startsWith('/') ? path : `/${path}`;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (target === current) return;
  if (opts.replace) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }
  window.dispatchEvent(new Event('routechange'));
}

// Route hook. Returns `{ path, query }` for the current URL.
//
// Updates the route state inside `startTransition` so React treats
// navigations as "non-urgent" work — the old page stays interactive
// while the new chunk loads. Without this, every navigation between
// lazy routes would immediately replace the current UI with the
// nearest Suspense fallback (the shimmer page), which feels like a
// full reload. With useTransition, the previous page keeps painting
// until the new content is ready, and only then does the swap happen.
export function useRoute() {
  const [route, setRoute] = useState(() => parseLocation());
  // eslint-disable-next-line no-unused-vars
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handler = () => {
      const next = parseLocation();
      startTransition(() => setRoute(next));
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    // popstate fires on back/forward. routechange is our custom event
    // dispatched by navigate() and the link-click interceptor.
    window.addEventListener('popstate', handler);
    window.addEventListener('routechange', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('routechange', handler);
    };
  }, []);

  return route;
}

// Delegated click interceptor — installed once from main.jsx. Catches
// every <a> click that points to a same-origin path and routes it
// through navigate() instead of letting the browser do a full reload.
//
// Skips: external links, target="_blank", modifier-keys (cmd/ctrl
// click should open in a new tab), download, hash-only links (so
// fragment scrolling still works), and anchors with data-native-link.
export function installLinkClickInterceptor() {
  if (typeof window === 'undefined' || window.__linkClickInstalled) return;
  window.__linkClickInstalled = true;

  document.addEventListener('click', (event) => {
    // Modifier keys → respect "open in new tab" intent.
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    let el = event.target;
    for (let hop = 0; el && hop < 4; hop += 1, el = el.parentElement) {
      if (el.tagName === 'A') break;
    }
    if (!el || el.tagName !== 'A') return;
    if (el.hasAttribute('download')) return;
    if (el.target && el.target !== '' && el.target !== '_self') return;
    if (el.dataset.nativeLink !== undefined) return;

    const href = el.getAttribute('href');
    if (!href) return;
    // Pure hash anchor on the same page — let the browser scroll.
    if (href.startsWith('#')) return;
    // External (different origin) or scheme-prefixed — let the browser handle.
    if (/^([a-z]+:)?\/\//i.test(href) || /^(mailto|tel|sms):/i.test(href)) return;

    // Same-origin path. Resolve relative hrefs against the current URL.
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    const target = url.pathname + url.search + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (target === current) {
      // Same URL — at least scroll to top to match navigate() behaviour.
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    window.history.pushState(null, '', target);
    window.dispatchEvent(new Event('routechange'));
  });
}
