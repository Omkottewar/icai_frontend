import { IconAward, IconCheckCircle } from '../../icons';

// Marketing / brand panel on the left half of the auth screen. Content
// is constant per `mode` ('signup' | 'login') and does NOT change when
// the user picks a role in the right column — the whole panel is
// position:sticky in CSS so it doesn't visually shift as the right
// column grows / shrinks with the selected role.
export default function AuthSidePanel({ mode }) {
  const isSignup = mode === 'signup';
  return (
    <aside className="auth-side">
      {/* Brand — pinned top-left */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <a href="/" className="row gap-3" style={{ color: 'white', textDecoration: 'none' }}>
          <div style={{
            width: '2.75rem', height: '2.75rem', borderRadius: '.55rem',
            background: 'rgba(255,255,255,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.25)',
          }}>CA</div>
          <div>
            <div style={{ fontSize: '.9rem', fontWeight: 700, letterSpacing: '-.005em' }}>ICAI Nagpur Branch</div>
            <div style={{ fontSize: '.72rem', opacity: .8 }}>of WIRC of ICAI</div>
          </div>
        </a>
      </div>

      {/* Headline block — pinned bottom-left via .auth-side-body { margin-top: auto } */}
      <div className="auth-side-body">
        <div className="row gap-2" style={{
          background: 'rgba(255,255,255,.12)',
          border: '1px solid rgba(255,255,255,.2)',
          padding: '.375rem .8rem',
          borderRadius: 999,
          fontSize: '.72rem', fontWeight: 600,
          width: 'fit-content',
          letterSpacing: '.02em',
        }}>
          <IconAward size="sm" /> {isSignup ? 'Join the branch portal' : 'Welcome back'}
        </div>
        <h2 style={{
          fontSize: 'clamp(1.75rem, 3.5vw, 2.6rem)',
          fontWeight: 700, lineHeight: 1.1,
          margin: '1rem 0 1rem',
          letterSpacing: '-.02em',
        }}>
          {isSignup
            ? <>Your gateway to <span style={{ color: 'var(--accent)' }}>events, UDIN</span> and the Nagpur CA community.</>
            : <>Pick up where you <span style={{ color: 'var(--accent)' }}>left off</span>.</>}
        </h2>
        <p style={{ opacity: .85, lineHeight: 1.55, fontSize: '.95rem', maxWidth: '30rem' }}>
          {isSignup
            ? 'Register for events, generate UDINs, and access the full members directory — all in one place.'
            : 'Resume registrations and reconnect with the Nagpur Branch community.'}
        </p>

        <div className="col gap-3" style={{ marginTop: '2rem' }}>
          {[
            'Self-service for members, students & employers',
            'Curated branch events with online registration',
            'PrayGyaan AI assistant — built into every page',
          ].map((t, i) => (
            <div key={i} className="row gap-3" style={{ fontSize: '.875rem', opacity: .95 }}>
              <span style={{
                width: '1.5rem', height: '1.5rem', borderRadius: 999,
                background: 'rgba(255,255,255,.18)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconCheckCircle size="sm" />
              </span>
              {t}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
