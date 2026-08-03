// Service worker for ICAI Nagpur PWA.
//
// Two responsibilities:
//   1. Precache the Vite-built shell (HTML/JS/CSS/icons) so the app launches
//      offline and instantly on flaky connections. The `self.__WB_MANIFEST`
//      placeholder is replaced at build time with the actual asset list.
//   2. Receive Web Push messages from the backend and display them as OS
//      notifications, then route clicks back into the running PWA.
//
// Built via `vite-plugin-pwa` with strategies: 'injectManifest', so this file
// is the literal SW that ships — no auto-generation magic on top.

import { precacheAndRoute } from 'workbox-precaching';
import { setDefaultHandler } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);

// ─── Explicit passthrough for /api and /uploads ──────────────────────────
//
// This raw fetch listener runs BEFORE Workbox's Router listener (which is
// installed later via `setDefaultHandler`). We inspect the URL and, for
// backend / upload paths, call `event.respondWith` with a straight
// `fetch(event.request)` — no Workbox wrapping. That's important because
// Workbox's `NetworkOnly` strategy has a subtle bug for navigation-mode
// requests to file-download URLs (Content-Disposition: attachment): the
// underlying fetch throws `TypeError: Failed to fetch` before the response
// ever reaches the browser, and the user sees a broken CSV / PDF export.
//
// By responding with a raw fetch, we bypass that codepath entirely. The
// browser gets the response with all download headers intact and handles
// the save-as as if there were no SW at all.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(event.request));
  }
});

// Fallback for navigation requests not in the precache (e.g. SPA deep
// links like /dashboard) — go straight to the network. Without this, an
// old Workbox install can swallow same-origin GETs into a "cache or 503"
// strategy. The server returns index.html for any unknown path (SPA
// fallback), so the navigation succeeds and the SPA boots.
//
// Wrapped so a network failure (Vite HMR restart, aborted navigation,
// offline) resolves to Response.error() instead of throwing a workbox
// `no-response` rejection — that would spam the console without changing
// what the browser ultimately shows the user.
setDefaultHandler(async ({ request }) => {
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
});

// Activate the new SW immediately on update so users see fresh notifications
// without a manual refresh.
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push handler ─────────────────────────────────────────────────────────
// Backend sends { title, body, url, tag, data } as a JSON string. We feed
// it straight into showNotification — the OS owns the rendering after that.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Malformed payload — still surface *something* so the user knows a
    // notification arrived (the push service won't redeliver on parse fail).
    payload = { title: 'ICAI Nagpur', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ICAI Nagpur';
  const options = {
    body:  payload.body || '',
    // Large coloured icon on the right of the notification — the full CA logo.
    icon:  payload.icon  || '/pwa-192.png',
    // Tiny status-bar / app-row badge — Android renders this monochrome by
    // tinting whatever pixels you give it. Must be white on transparent OR
    // a clean silhouette; full-colour PNGs come out as a black square.
    // notification-badge.png is a 96x96 silhouette of the CA India mark
    // (generated from frontend/src/assets/CA India Logo.png via sharp).
    badge: payload.badge || '/notification-badge.png',
    // tag dedupes — if a second push with the same tag arrives (e.g. two
    // "event reminder" pushes for the same event), it replaces the first
    // instead of stacking.
    tag:   payload.tag || undefined,
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    // requireInteraction keeps the notification on screen until the user
    // dismisses it — useful for things like grievance updates the user
    // probably wants to act on, less useful for chatty digests.
    // Default off; templates can opt in by setting payload.requireInteraction.
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Click handler ────────────────────────────────────────────────────────
// If a tab is already open at our origin, focus it and navigate to the
// notification's target URL. Otherwise open a new tab.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      // Same origin? Focus + navigate via postMessage so React-Router can
      // handle the hash change without a full reload.
      try {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(target, self.location.origin);
        if (clientUrl.origin === targetUrl.origin) {
          await client.focus();
          client.postMessage({ type: 'navigate', url: target });
          return;
        }
      } catch {
        /* malformed url — fall through to openWindow */
      }
    }
    await self.clients.openWindow(target);
  })());
});
