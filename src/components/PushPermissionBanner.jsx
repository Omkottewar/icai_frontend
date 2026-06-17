import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePushSubscription } from '../hooks/usePushSubscription';

// Slim banner shown to signed-in users whose browser supports push but
// whose permission is still 'default'. Previously the only way to enable
// push was to dig into the dashboard settings card — most users never saw
// it, so server-side push attempts always landed on `skipped/no_subscription`.
//
// Dismissable per session via localStorage. We don't nag forever; if the
// user picked "Not now" we stop showing it for 7 days.
const DISMISS_KEY = 'push_banner_dismissed_at';
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export default function PushPermissionBanner() {
  const { user } = useAuth();
  const push = usePushSubscription({ enabled: !!user });
  const [dismissed, setDismissed] = useState(() => isDismissed());
  const [busy, setBusy] = useState(false);

  // If the user changes (logged out → in) re-read dismissal — different
  // users on the same device might have different preferences (rare but
  // cheap to handle).
  useEffect(() => {
    setDismissed(isDismissed());
  }, [user?.id]);

  if (!user) return null;
  if (dismissed) return null;
  if (!push.supported) return null;       // iOS Safari without home-screen install
  if (push.loading) return null;
  if (push.permission !== 'default') return null; // 'granted' or 'denied' → nothing to do
  if (push.subscribed) return null;

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await push.enable();
      // On success the banner disappears because permission flips to 'granted'.
    } catch {
      // Permission denied or some other error — fall through; the banner
      // will auto-hide if permission is no longer 'default'. Otherwise the
      // user can dismiss explicitly.
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* incognito etc. */ }
    setDismissed(true);
  };

  return (
    <div className="ppb-wrap" role="region" aria-label="Notification setup">
      <div className="ppb-inner">
        <div className="ppb-icon" aria-hidden>🔔</div>
        <div className="ppb-text">
          <strong>Turn on notifications</strong>
          <span className="ppb-sub">
            Get instant updates about events, checklist tasks, and grievance responses.
          </span>
        </div>
        <div className="ppb-actions">
          <button type="button" className="ppb-dismiss" onClick={dismiss} disabled={busy}>
            Not now
          </button>
          <button type="button" className="ppb-enable" onClick={enable} disabled={busy}>
            {busy ? 'Asking…' : 'Enable'}
          </button>
        </div>
      </div>

      <style>{`
        .ppb-wrap {
          background: linear-gradient(90deg, #1e40af, #2563eb);
          color: white;
          border-bottom: 1px solid rgba(255, 255, 255, .15);
        }
        .ppb-inner {
          max-width: 1280px; margin: 0 auto;
          display: flex; align-items: center; gap: 1rem;
          padding: .55rem 1rem;
        }
        .ppb-icon {
          font-size: 1.15rem; flex-shrink: 0;
        }
        .ppb-text {
          flex: 1; min-width: 0;
          display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
          font-size: .8125rem;
        }
        .ppb-text strong { font-weight: 700; }
        .ppb-sub { opacity: .85; }
        .ppb-actions {
          display: flex; gap: .4rem; align-items: center; flex-shrink: 0;
        }
        .ppb-dismiss {
          padding: .3rem .65rem;
          background: transparent;
          color: rgba(255, 255, 255, .85);
          border: 1px solid rgba(255, 255, 255, .3);
          border-radius: .35rem;
          font: inherit; font-size: .73rem; font-weight: 600;
          cursor: pointer;
        }
        .ppb-dismiss:hover { background: rgba(255, 255, 255, .08); color: white; }
        .ppb-dismiss:disabled { opacity: .5; cursor: not-allowed; }
        .ppb-enable {
          padding: .3rem .85rem;
          background: white; color: #1e40af;
          border: 0; border-radius: .35rem;
          font: inherit; font-size: .75rem; font-weight: 700;
          cursor: pointer;
        }
        .ppb-enable:hover { background: rgba(255, 255, 255, .92); }
        .ppb-enable:disabled { opacity: .65; cursor: wait; }

        @media (max-width: 640px) {
          .ppb-inner { gap: .65rem; padding: .55rem .75rem; }
          .ppb-sub { display: none; }
        }
      `}</style>
    </div>
  );
}

function isDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return (Date.now() - at) < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}
