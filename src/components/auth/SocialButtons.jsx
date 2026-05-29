// Social IdP buttons. Clicking one redirects to /api/auth/social/:provider,
// which bounces through Auth0 (the only flow Auth0 supports for social).
// Email/password stays embedded — only these buttons leave the site.

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.96H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022"/>
      <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00"/>
      <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF"/>
      <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900"/>
    </svg>
  );
}

// Each entry's `id` must match a key in SOCIAL_CONNECTIONS in
// server/routes/auth.ts AND a configured Social Connection in Auth0.
const PROVIDERS = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
];

export default function SocialButtons({ mode = 'login', onPick }) {
  const verb = mode === 'signup' ? 'Sign up' : 'Continue';

  return (
    <div className="col gap-2" style={{ marginTop: '1rem' }}>
      <div className="row" style={{ alignItems: 'center', gap: '.75rem', margin: '.25rem 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span className="muted-text" style={{ fontSize: '.75rem' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className="btn"
          style={{
            width: '100%', justifyContent: 'center', padding: '.625rem',
            background: 'white', color: 'var(--foreground)',
            border: '1px solid var(--border)', gap: '.5rem',
          }}
        >
          <Icon /> {verb} with {label}
        </button>
      ))}
    </div>
  );
}
