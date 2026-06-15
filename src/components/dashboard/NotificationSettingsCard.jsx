import { useState } from 'react';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { IconBell } from '../../icons';

// Notification preferences card for the dashboard side column.
//
// Today this is single-purpose: enable or disable web push on the current
// device. We deliberately scope the toggle to *this device* rather than the
// account — a user can have push on their phone and not their laptop, and
// the PushManager API is per-browser-installation anyway.
//
// iOS Safari needs the PWA installed to home screen before PushManager is
// defined; when state.supported is false we show a friendly hint instead of
// a dead-looking switch.

export default function NotificationSettingsCard() {
  const { supported, permission, subscribed, loading, enable, disable } = usePushSubscription();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const blocked = permission === 'denied';

  const onToggle = async () => {
    setMsg(null);
    setBusy(true);
    try {
      if (subscribed) {
        await disable();
        setMsg({ kind: 'info', text: 'Push notifications turned off for this device.' });
      } else {
        await enable();
        setMsg({ kind: 'success', text: 'You\'ll now receive push notifications on this device.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || 'Could not update push settings.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <IconBell />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Push notifications</h3>
      </div>

      <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.5rem' }}>
        Get event reminders, approvals, and grievance updates on this device — even when the site is closed.
      </p>

      {!supported && (
        <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
          This browser doesn't support push notifications. On iPhone, install this site to your Home Screen first.
        </p>
      )}

      {supported && blocked && (
        <p style={{ fontSize: '.75rem', marginTop: '.5rem', color: 'var(--destructive)' }}>
          Notifications are blocked in your browser settings. Allow them for this site and reload.
        </p>
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

      {msg && (
        <p style={{
          fontSize: '.75rem', marginTop: '.5rem',
          color: msg.kind === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)',
        }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
