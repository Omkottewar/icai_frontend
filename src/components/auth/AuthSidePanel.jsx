import { IconAward, IconCheckCircle } from '../../icons';

export default function AuthSidePanel({ mode }) {
  return (
    <div className="auth-side">
      <div style={{ position: 'relative', zIndex: 1 }}>
        <a href="#/" className="row gap-3" style={{ color: 'white' }}>
          <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '.5rem', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.25)' }}>CA</div>
          <div>
            <div style={{ fontSize: '.875rem', fontWeight: 700 }}>ICAI Nagpur Branch</div>
            <div style={{ fontSize: '.75rem', opacity: .8 }}>of WIRC of ICAI</div>
          </div>
        </a>
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '32rem' }}>
        <div className="row gap-2" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', padding: '.375rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, width: 'fit-content' }}>
          <IconAward size="sm" /> {mode === 'signup' ? 'Join the branch portal' : 'Welcome back'}
        </div>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.1, margin: '1rem 0 1rem' }}>
          {mode === 'signup'
            ? <>Your gateway to <span style={{ color: 'var(--accent)' }}>CPE, UDIN</span> and the Nagpur CA community.</>
            : <>Pick up where you <span style={{ color: 'var(--accent)' }}>left off</span>.</>}
        </h2>
        <p style={{ opacity: .85, lineHeight: 1.55 }}>
          {mode === 'signup'
            ? 'Track your CPE hours, register for events, generate UDINs, and access the full members directory — all in one place.'
            : 'Resume registrations, view your CPE tracker, and reconnect with the Nagpur Branch community.'}
        </p>

        <div className="col gap-3" style={{ marginTop: '2rem' }}>
          {[
            { Icon: IconCheckCircle, t: 'Self-service for members & students' },
            { Icon: IconCheckCircle, t: '150+ CPE events curated each year' },
            { Icon: IconCheckCircle, t: 'PrayGyaan AI assistant — built-in' },
          ].map((f, i) => (
            <div key={i} className="row gap-3" style={{ fontSize: '.875rem' }}>
              <span style={{ width: '1.5rem', height: '1.5rem', borderRadius: 999, background: 'rgba(255,255,255,.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <f.Icon size="sm" />
              </span>
              {f.t}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, fontSize: '.75rem', opacity: .7 }}>
        Demo mockup · Not connected to live ICAI services · Any credentials work
      </div>
    </div>
  );
}
