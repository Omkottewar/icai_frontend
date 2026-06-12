import { useEffect, useState } from 'react';

// Lightweight install banner. Chrome / Edge / Android Chrome fire
// `beforeinstallprompt`; we capture the event, hold it, and surface a banner
// the first time a user opens the site. They can install or dismiss; we
// remember the dismissal in localStorage so we don't pester them.
//
// iOS Safari does NOT fire beforeinstallprompt — Apple wants users to add
// to home screen via the share sheet. We detect iOS Safari separately and
// show a one-time hint with the share-sheet instructions.

const DISMISSED_KEY = 'pwa-install-dismissed-at';
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && safari;
}

function recentlyDismissed() {
  const ts = Number(localStorage.getItem(DISMISSED_KEY));
  if (!ts) return false;
  return Date.now() - ts < DISMISS_DURATION_MS;
}

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    if (isIosSafari()) {
      setShowIosHint(true);
      return;
    }

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDeferred(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred && !showIosHint) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '1rem', left: '1rem', right: '1rem',
      maxWidth: 520, margin: '0 auto', zIndex: 1000,
      background: 'white', border: '1px solid var(--border)', borderRadius: '.625rem',
      boxShadow: '0 8px 30px rgba(0,0,0,.18)',
      padding: '.875rem 1rem',
      display: 'flex', gap: '.75rem', alignItems: 'center',
    }}>
      <img src="/pwa-192.png" alt="" width={44} height={44} style={{ borderRadius: '.5rem', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem' }}>Install ICAI Nagpur</div>
        <div style={{ fontSize: '.8rem', color: 'var(--muted-foreground)', marginTop: '.1rem' }}>
          {showIosHint
            ? <>Tap <strong>Share</strong> in Safari, then <strong>"Add to Home Screen"</strong>.</>
            : <>Add to your home screen for one-tap access.</>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
        {deferred && (
          <button onClick={install} style={{
            padding: '.4rem .8rem', background: 'var(--primary, #1e40af)',
            color: 'white', border: 0, borderRadius: '.375rem',
            fontWeight: 600, fontSize: '.8rem', cursor: 'pointer',
          }}>Install</button>
        )}
        <button onClick={dismiss} style={{
          padding: '.4rem .55rem', background: 'transparent',
          color: 'var(--muted-foreground)', border: 0,
          fontSize: '.8rem', cursor: 'pointer',
        }}>Not now</button>
      </div>
    </div>
  );
}
