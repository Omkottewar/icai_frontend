import { useEffect, useState } from 'react';

// DPDP Act 2023 / GDPR-aligned cookie banner.
//
// Copy is taken verbatim from the client's filled requirements PDF section T.5.
// Consent is stored in localStorage with a timestamp and the policy version.
// Re-prompt fires when EITHER (a) >365 days have passed, OR (b) CONSENT_POLICY_VERSION
// is bumped (use this when the privacy policy text materially changes).
//
// Three choices:
//   - accept_all          → essentials + analytics on
//   - reject_non_essential → essentials only (analytics off)
//   - custom              → reserved for a future "Manage preferences" modal
//
// What's "essential": session cookie (icai_session), CSRF tokens, push
// subscription endpoints. Everything else is analytics-gated.
//
// Consumers can read the current state via `getCookieConsent()` to decide
// whether to load (e.g.) GA/PostHog/etc. There is currently no analytics
// vendor wired — this is the gate that will protect that future load.

const STORAGE_KEY = 'icai.cookie.consent.v1';
const CONSENT_POLICY_VERSION = 1;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_POLICY_VERSION) return null;
    if (Date.now() - new Date(parsed.timestamp).getTime() > ONE_YEAR_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setConsent(choice) {
  const payload = {
    version: CONSENT_POLICY_VERSION,
    choice,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage disabled — silently degrade. Banner will keep re-prompting
    // each visit but the rest of the site keeps working.
  }
  return payload;
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show only if no current consent exists.
    if (!getCookieConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const handle = (choice) => {
    setConsent(choice);
    setVisible(false);
    // Other parts of the app can listen for this if they need to react
    // (e.g. lazy-loading analytics after the user accepts).
    window.dispatchEvent(new CustomEvent('cookieconsentchange', { detail: { choice } }));
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9000,
        maxWidth: '720px',
        marginInline: 'auto',
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '.75rem',
        boxShadow: '0 12px 32px rgba(15, 23, 42, .18)',
        padding: '1rem 1.25rem',
        fontSize: '.875rem',
        lineHeight: 1.5,
        color: 'var(--foreground, #0f172a)',
      }}
    >
      <h2
        id="cookie-consent-title"
        style={{ fontSize: '1rem', fontWeight: 600, margin: 0, marginBottom: '.5rem' }}
      >
        We use cookies
      </h2>
      <p style={{ margin: 0, marginBottom: '.75rem' }}>
        We use cookies to keep this site secure, remember your preferences and understand how the
        portal is used. Essential cookies are always on; analytics cookies are set only with your
        consent. You can accept all, reject non-essential, or manage your choices anytime. See our{' '}
        <a href="#/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '.5rem',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => handle('reject_non_essential')}
          style={{ fontSize: '.8125rem' }}
        >
          Reject non-essential
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => handle('manage')}
          style={{ fontSize: '.8125rem' }}
          aria-label="Manage cookie preferences"
        >
          Manage preferences
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handle('accept_all')}
          style={{ fontSize: '.8125rem' }}
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
