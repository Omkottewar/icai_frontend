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
      // 1. Get the active service worker.
      const reg = await navigator.serviceWorker.ready;

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

      // 3. Fetch the server's VAPID public key.
      const keyResp = await fetch('/api/push/public-key', { credentials: 'include' });
      if (!keyResp.ok) throw new Error('Server push is not configured.');
      const { key } = await keyResp.json();

      // 4. Subscribe through the browser's PushManager. userVisibleOnly is
      //    mandatory on Chromium browsers — silent pushes are not allowed.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
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
