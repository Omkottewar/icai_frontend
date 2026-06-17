import { useEffect, useState } from 'react';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { IconBell } from '../../icons';

// Notification preferences + diagnostics card for the dashboard.
//
// Originally this was just an on/off toggle for web push on the current
// device. The page now also runs as a self-diagnostic — a user can verify
// in 5 seconds whether they'll actually receive push:
//
//   ✓ Browser supports push        (Notification API + ServiceWorker + PushManager)
//   ✓ Permission granted            (Notification.permission === 'granted')
//   ✓ Subscribed on this device     (PushManager.getSubscription())
//   ✓ Backend has my subscription   (GET /api/push/status returns count > 0)
//   ✓ Account-level push enabled    (users.notify_push === true)
//
// Plus a "Send me a test push" button that fires an immediate notification
// so the user can confirm the chain end-to-end.

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function NotificationSettingsCard() {
  const { supported, permission, subscribed, loading, enable, disable, refresh } = usePushSubscription();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Pull server-side status so we know whether the backend has THIS device's
  // subscription too (catches the "user clicked enable but POST failed" case).
  const loadStatus = async () => {
    try {
      const s = await api('/api/push/status');
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };
  useEffect(() => { loadStatus(); }, []);

  const blocked = permission === 'denied';
  const granted = permission === 'granted';

  const onToggle = async () => {
    setMsg(null);
    setBusy(true);
    try {
      if (subscribed) {
        await disable();
        setMsg({ kind: 'info', text: 'Push notifications turned off for this device.' });
      } else {
        await enable();
        setMsg({ kind: 'success', text: "You'll now receive push notifications on this device." });
      }
      await loadStatus();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || 'Could not update push settings.' });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api('/api/push/test', { method: 'POST' });
      setTestResult({
        kind: r.ok ? 'success' : 'error',
        text: r.ok
          ? `Test sent to ${r.sent_to} device${r.sent_to === 1 ? '' : 's'}. Check for the popup — it may take a few seconds.`
          : `Failed to send: ${(r.results?.[0]?.error) || 'unknown error'}.`,
        details: r.results,
      });
    } catch (err) {
      setTestResult({ kind: 'error', text: err.message || 'Could not send test push.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card ns-card">
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <IconBell />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Push notifications</h3>
      </div>

      <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.5rem' }}>
        Get event reminders, checklist tasks, and grievance updates on this device — even when the site is closed.
      </p>

      {/* Diagnostic checklist — visible once we know the state */}
      {!loading && (
        <div className="ns-diag">
          <DiagRow ok={supported}>
            <span>Browser supports push</span>
            {!supported && <span className="ns-hint">On iPhone, install this site to the Home Screen first.</span>}
          </DiagRow>
          <DiagRow ok={granted} bad={blocked}>
            <span>Permission granted</span>
            {blocked && <span className="ns-hint">Blocked — open browser site settings and allow notifications.</span>}
            {permission === 'default' && <span className="ns-hint">Click "Enable" below to ask the browser.</span>}
          </DiagRow>
          <DiagRow ok={subscribed}>
            <span>Subscribed on this device</span>
          </DiagRow>
          {status && (
            <>
              <DiagRow ok={status.server_configured}>
                <span>Server has VAPID keys</span>
                {!status.server_configured && <span className="ns-hint">Contact admin — push not configured.</span>}
              </DiagRow>
              <DiagRow ok={status.user_opted_in}>
                <span>Account-level push enabled</span>
              </DiagRow>
              <DiagRow ok={status.subscription_count > 0}>
                <span>{status.subscription_count} device{status.subscription_count === 1 ? '' : 's'} registered on the server</span>
              </DiagRow>
            </>
          )}
        </div>
      )}

      {supported && !blocked && (
        <button
          type="button"
          onClick={onToggle}
          disabled={loading || busy}
          className={`btn ${subscribed ? 'btn-outline' : 'btn-primary'}`}
          style={{ marginTop: '.75rem', width: '100%', justifyContent: 'center' }}
        >
          {busy ? 'Working…'
            : subscribed ? 'Turn off on this device'
            : 'Enable push notifications'}
        </button>
      )}

      {/* Test button — only useful once subscribed. Bypasses the full notify()
          pipeline (no delivery audit row) so the test stays cheap and doesn't
          pollute the admin Notifications log. */}
      {subscribed && (
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className="btn btn-outline"
          style={{ marginTop: '.5rem', width: '100%', justifyContent: 'center' }}
        >
          {testing ? 'Sending…' : '🔔 Send me a test push'}
        </button>
      )}

      {msg && (
        <p style={{
          fontSize: '.75rem', marginTop: '.5rem',
          color: msg.kind === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)',
        }}>
          {msg.text}
        </p>
      )}

      {testResult && (
        <div
          className="ns-test-result"
          style={{
            background: testResult.kind === 'success' ? '#dcfce7' : '#fee2e2',
            color: testResult.kind === 'success' ? '#166534' : '#991b1b',
            borderColor: testResult.kind === 'success' ? '#86efac' : '#fca5a5',
          }}
        >
          <strong>{testResult.text}</strong>
          {testResult.details && testResult.details.length > 0 && (
            <ul style={{ margin: '.35rem 0 0', paddingLeft: '1.1rem', fontSize: '.72rem' }}>
              {testResult.details.map((d, i) => (
                <li key={i}>
                  <code>{d.status}</code>
                  {d.error && <> — {d.error}</>}
                  {d.device && <span className="muted-text"> · {d.device.slice(0, 60)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style>{`
        .ns-card { display: flex; flex-direction: column; }
        .ns-diag {
          margin-top: .65rem;
          padding: .55rem .65rem;
          background: var(--background, #f8fafc);
          border: 1px solid var(--border);
          border-radius: .35rem;
          display: flex; flex-direction: column; gap: .35rem;
          font-size: .8125rem;
        }
        .ns-hint {
          display: block; margin-top: .15rem;
          color: var(--muted-foreground);
          font-size: .7rem;
        }
        .ns-test-result {
          margin-top: .5rem;
          padding: .55rem .65rem;
          border: 1px solid;
          border-radius: .35rem;
          font-size: .8rem;
        }
        .ns-test-result strong { display: block; }
      `}</style>
    </div>
  );
}

function DiagRow({ ok, bad, children }) {
  // `bad` overrides ok=false → renders red instead of grey for "actively
  // blocked" states (e.g. permission='denied' is worse than just 'default').
  const tone = ok ? 'ok' : bad ? 'bad' : 'pending';
  return (
    <div className={`dr dr-${tone}`}>
      <span className="dr-mark" aria-hidden>
        {ok ? '✓' : bad ? '✗' : '○'}
      </span>
      <span className="dr-body">{children}</span>
      <style>{`
        .dr {
          display: flex; gap: .5rem; align-items: flex-start;
        }
        .dr-mark {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.05rem; height: 1.05rem;
          border-radius: 999px;
          font-size: .68rem; font-weight: 800;
          line-height: 1; flex-shrink: 0;
          margin-top: .1rem;
        }
        .dr-ok      .dr-mark { background: #dcfce7; color: #166534; }
        .dr-pending .dr-mark { background: #fef3c7; color: #92400e; }
        .dr-bad     .dr-mark { background: #fee2e2; color: #991b1b; }
        .dr-body { flex: 1; min-width: 0; }
        .dr-ok      .dr-body { color: var(--foreground); }
        .dr-pending .dr-body { color: var(--muted-foreground); }
        .dr-bad     .dr-body { color: var(--destructive, #991b1b); }
      `}</style>
    </div>
  );
}
