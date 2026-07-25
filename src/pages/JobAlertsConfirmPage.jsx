import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconCheckCircle, IconX } from '../icons';

// GET /job-alerts/confirm?token=... — hits the backend once, flips
// confirmed_at, and shows the success or error copy from site content.

export default function JobAlertsConfirmPage() {
  const route = useRoute();
  const copy = useSiteContent('job_alerts_confirm');
  const [state, setState] = useState('loading'); // loading | ok | error
  const [email, setEmail] = useState(null);

  useEffect(() => {
    const token = route.query.token;
    if (!token) { setState('error'); return; }
    fetch('/api/job-alerts/confirm?token=' + encodeURIComponent(token), { credentials: 'include' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'confirm failed');
        setEmail(j.email || null);
        setState('ok');
      })
      .catch(() => setState('error'));
  }, [route.query.token]);

  return (
    <>
      <PageHeader
        title={state === 'error' ? copy.error_title : copy.success_title}
        subtitle={state === 'loading' ? 'Confirming…' : undefined}
      />
      <section className="container" style={{ padding: '2.5rem 1rem', maxWidth: '46rem' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          {state === 'loading' && (
            <div className="muted-text" style={{ fontSize: '.9rem' }}>Please wait…</div>
          )}
          {state === 'ok' && (
            <>
              <div style={{ color: 'oklch(0.52 0.15 145)', marginBottom: '.5rem' }}>
                <IconCheckCircle size="xl" />
              </div>
              <div style={{ fontSize: '.95rem', lineHeight: 1.65 }}>
                {renderMarkdown(copy.success_body)}
              </div>
              {email && (
                <div className="muted-text" style={{ marginTop: '.75rem', fontSize: '.8rem' }}>
                  Alerts will be delivered to <strong>{email}</strong>.
                </div>
              )}
              <div style={{ marginTop: '1.25rem' }}>
                <button onClick={() => navigate('/dashboard#jobs')} className="btn btn-primary" style={{ padding: '.5rem 1.25rem' }}>
                  Manage my alerts
                </button>
              </div>
            </>
          )}
          {state === 'error' && (
            <>
              <div style={{ color: '#991b1b', marginBottom: '.5rem' }}><IconX /></div>
              <div style={{ fontSize: '.95rem', lineHeight: 1.65 }}>
                {renderMarkdown(copy.error_body)}
              </div>
              <div style={{ marginTop: '1.25rem' }}>
                <button onClick={() => navigate('/job-alerts/subscribe')} className="btn btn-primary" style={{ padding: '.5rem 1.25rem' }}>
                  Go to subscribe page
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
