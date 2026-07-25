import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { toast } from '../lib/notify';
import { IconBell, IconCheckCircle } from '../icons';

// Preference-centre page reached from the "manage / unsubscribe" link in
// every alert email. Works without a session — mutations go through the
// token-based endpoints so a user opening the link on their phone (no
// session) can still unsubscribe.

export default function JobAlertsManagePage() {
  const route = useRoute();
  const copy = useSiteContent('job_alerts_manage');
  const token = route.query.token;

  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    if (!token) { setState('error'); return; }
    fetch('/api/job-alerts/manage?token=' + encodeURIComponent(token))
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'manage failed');
        setUser(j.user);
        setSubs(j.subs || []);
        setState('ok');
      })
      .catch(() => setState('error'));
  };

  useEffect(() => { reload(); }, [token]);

  async function unsubscribeIds(ids, allMode = false) {
    setBusy(true);
    try {
      const r = await fetch('/api/job-alerts/manage-unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, subscription_ids: allMode ? [] : ids }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'unsubscribe failed');
      toast?.success?.(allMode ? 'Unsubscribed from all alerts' : 'Removed');
      reload();
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  const active = subs.filter((s) => !s.unsubscribed_at);

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <section className="container" style={{ padding: '2.5rem 1rem', maxWidth: '46rem' }}>
        {state === 'loading' && (
          <div className="muted-text" style={{ fontSize: '.9rem' }}>Loading your preferences…</div>
        )}
        {state === 'error' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '.9rem', lineHeight: 1.55 }}>
              This link is invalid or has expired. Sign in and open <strong>Dashboard → Jobs</strong> to manage your alerts.
            </div>
          </div>
        )}
        {state === 'ok' && (
          <>
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '.85rem' }}>
                Managing alerts for <strong>{user?.email}</strong>
              </div>
            </div>

            {active.length === 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '.9rem', lineHeight: 1.65 }}>
                  {renderMarkdown(copy.empty)}
                </div>
              </div>
            )}

            {active.length > 0 && (
              <>
                <div className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'grid', gap: '.4rem' }}>
                    {active.map((s) => (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '.55rem .75rem', border: '1px solid var(--border)', borderRadius: '.375rem',
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{s.category_name}</div>
                          <div className="muted-text" style={{ fontSize: '.72rem', textTransform: 'capitalize' }}>
                            {s.posting_type} · {s.frequency.replace('_', ' ')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => unsubscribeIds([s.id])}
                          disabled={busy}
                          className="btn btn-outline"
                          style={{ padding: '.3rem .65rem', fontSize: '.75rem', color: '#991b1b' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => unsubscribeIds([], true)}
                    disabled={busy}
                    className="btn btn-outline"
                    style={{ padding: '.45rem 1rem', color: '#991b1b' }}
                  >
                    Unsubscribe from everything
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
