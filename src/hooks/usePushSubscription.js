import { useCallback, useEffect, useState } from 'react';

// Browser Push API bridge.
//
// Responsibilities:
//   • Read current state — is the browser capable, has the user granted
//     permission, is there already a live subscription on this device?
//   • enable() — ask the SW for the registration, prompt for permission,
//     call PushManager.subscribe with the server's VAPID key, POST the
//     PushSubscription to /api/push/subscribe.
//   • disable() — unsubscribe locally + POST /api/push/unsubscribe so the
//     server stops sending and prunes the row.
//
// Push only works once a service worker has fully activated, so calls to
// enable() before that resolve via navigator.serviceWorker.ready.
//
// iOS Safari quirk: push requires the PWA to be installed to home screen
// (16.4+). In a regular Safari tab, PushManager is undefined and
// state.supported stays false. We surface that as a friendly hint in the UI.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

const initialState = {
  supported: typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window,
  permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
  subscribed: false,
  loading: true,
  error: null,
};

export function usePushSubscription({ enabled = true } = {}) {
  const [state, setState] = useState(initialState);

  // Probe current subscription state. Cheap — no network unless we need
  // to call /api/push/subscribe afterwards.
  const refresh = useCallback(async () => {
    if (!enabled || !initialState.supported) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState({
        supported:  true,
        permission: Notification.permission,
        subscribed: !!sub,
        loading:    false,
        error:      null,
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    if (!initialState.supported) {
      throw new Error('Push notifications are not supported in this browser. On iPhone, install this site to the Home Screen first.');
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // 1. Get a stable, active service worker. Three things matter here:
      //
      //   (a) navigator.serviceWorker.ready can hang forever if no SW has
      //       been registered for the scope (dev server not serving sw.js).
      //       Race it against a 5-second timeout for a useful error.
      //
      //   (b) On mobile (and after every frontend deploy) there's a race:
      //       the OLD service worker is about to be replaced by a NEW one
      //       via skipWaiting() + clients.claim(). If we capture the OLD
      //       registration via .ready and then call subscribe() on it after
      //       the swap has happened, the browser throws
      //       "Subscription failed - no active Service Worker" because the
      //       captured registration is now `redundant`.
      //
      //   (c) The fix: after .ready resolves, also wait for a controller to
      //       exist (or a controllerchange to finish), then re-fetch the
      //       current registration via getRegistration() so we hand
      //       pushManager.subscribe() a worker the browser still considers
      //       authoritative.
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(
          () => reject(new Error('Service worker did not activate within 5 seconds. In dev, make sure VitePWA devOptions.enabled is true and refresh the page.')),
          5000,
        )),
      ]);

      // Wait for a controller to claim this page. On a freshly installed SW,
      // .ready resolves before the SW is the page's controller; subscribe()
      // requires an active controller-bound worker. controllerchange fires
      // when the new SW takes over via clients.claim().
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          const onChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange);
            resolve();
          };
          navigator.serviceWorker.addEventListener('controllerchange', onChange);
          // Fallback so we never hang forever — if controllerchange never
          // fires, just proceed and let subscribe() surface its own error.
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange);
            resolve();
          }, 2500);
        });
      }

      // Always re-fetch the registration right before subscribe(). The
      // previous reference may be stale (`redundant`) after the activation
      // race resolved.
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        // Extremely rare — getRegistration returns null when the SW was
        // unregistered out from under us. Falling back to .ready picks up
        // whichever new SW is registering now.
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg.active) {
        throw new Error(
          'Service worker is still installing. Please reload the page and try again. ' +
          '(If this keeps happening, fully close the tab, clear site data for icainagpur.in, then reopen.)'
        );
      }

      // 2. Ask the user. permission can only be requested from a user gesture
      //    — this hook expects to be called from a click handler.
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        setState((s) => ({ ...s, loading: false, permission, subscribed: false }));
        throw new Error('Notification permission was not granted.');
      }

      // 3. Fetch the server's VAPID public key. Surface the actual HTTP
      //    status + response body so the user sees WHY this failed instead
      //    of the old "Server push is not configured" catch-all.
      const keyResp = await fetch('/api/push/public-key', { credentials: 'include' });
      if (!keyResp.ok) {
        const bodyText = await keyResp.text().catch(() => '');
        throw new Error(
          `Could not fetch VAPID key — server returned ${keyResp.status}` +
          (bodyText ? `: ${bodyText.slice(0, 200)}` : '. Check that the backend is running and VAPID_PUBLIC_KEY is set in backend/.env.')
        );
      }
      const { key } = await keyResp.json();
      if (!key) throw new Error('Backend returned an empty VAPID key. Check VAPID_PUBLIC_KEY in backend/.env.');

      // 4. Subscribe through the browser's PushManager. userVisibleOnly is
      //    mandatory on Chromium browsers — silent pushes are not allowed.
      //
      // If a stale cached subscription exists (e.g. registered under a
      // previous VAPID key), we unsubscribe it first so the fresh subscribe
      // doesn't conflict. Without this, Chrome can throw
      // "InvalidStateError: applicationServerKey of subscribe() call does
      // not match the original" or, in rarer cases, "push service error".
      const existing = await reg.pushManager.getSubscription();
      let sub = existing;
      if (existing) {
        // Cheap heuristic: if the cached sub's applicationServerKey matches
        // our current VAPID key, keep it. Otherwise, drop and re-subscribe.
        const cachedKey = existing.options?.applicationServerKey;
        const expected  = urlBase64ToUint8Array(key);
        const matches   = cachedKey && cachedKey.byteLength === expected.byteLength
          && new Uint8Array(cachedKey).every((b, i) => b === expected[i]);
        if (!matches) {
          try { await existing.unsubscribe(); } catch { /* swallow */ }
          sub = null;
        }
      }
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        } catch (subErr) {
          // Surface the actual DOMException name so the UI shows something
          // diagnosable instead of just the generic outer error message.
          // Common names: AbortError, InvalidStateError, NotAllowedError,
          // NotSupportedError, InvalidAccessError.
          const name = subErr?.name || 'Error';
          const msg  = subErr?.message || String(subErr);
          throw new Error(`Subscribe failed (${name}): ${msg}`);
        }
      }

      // 5. Hand the subscription to our backend so it can target this device.
      const json = sub.toJSON();
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Subscription failed');

      setState({ supported: true, permission: 'granted', subscribed: true, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
      throw err;
    }
  }, []);

  const disable = useCallback(async () => {
    if (!initialState.supported) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Tell the server first; if it fails we still un-subscribe locally
        // so the device stops trying. Server prune will catch the orphan
        // on next 410.
        try {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        } catch { /* swallow — local unsubscribe still runs */ }
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, loading: false, subscribed: false }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  return { ...state, enable, disable, refresh };
}
