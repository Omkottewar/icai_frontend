import { useEffect, useState } from 'react';
import EmployerLayout from '../../components/employer/EmployerLayout';
import { navigate } from '../../hooks/useRoute';
import { cachedGet } from '../../lib/apiCache';
import { IconBriefcase, IconArrowRight } from '../../icons';

export default function EmployerDashboardPage() {
  const [me, setMe] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    // 30s TTL — keeps the dashboard snappy across navigations within the
    // employer area while still reflecting profile/stat updates promptly.
    cachedGet('/api/employer/me')
      .then((j) => { if (!cancelled) setMe(j); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    cachedGet('/api/employer/postings/_analytics', undefined, 30_000)
      .then((j) => { if (!cancelled) setAnalytics(j.items || []); })
      .catch(() => { /* analytics failures are non-fatal — just hide the section */ });
    return () => { cancelled = true; };
  }, []);

  const e = me?.employer;
  const funnel = me?.stats?.funnel;
  const applications = funnel?.total ?? 0;
  const views = me?.stats?.views ?? 0;
  // Views-to-application conversion — a headline Naukri-style number.
  // Guard against divide-by-zero and swallow the ratio when there's no
  // signal yet.
  const conversion = views > 0 && applications > 0
    ? ((applications / views) * 100).toFixed(1) + '%'
    : '—';

  return (
    <EmployerLayout
      title={e ? e.company_name : 'Loading…'}
      subtitle={me ? `Signed in as ${me.user_role}` : ''}
      actions={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/employer/postings/new')}
        >
          <IconBriefcase size="sm" /> Post a job
        </button>
      }
    >
      {err && <div className="alert alert-error">{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.875rem' }}>
        <StatTile label="Active postings"  value={me?.stats?.active ?? '—'} />
        <StatTile label="Total postings"   value={me?.stats?.total  ?? '—'} />
        <StatTile label="Total views"      value={views.toLocaleString('en-IN')} hint="Members opening your postings" />
        <StatTile label="Applications"     value={applications.toLocaleString('en-IN')} hint={conversion !== '—' ? `${conversion} of views apply` : 'No applications yet'} />
        <StatTile label="Company verified" value={e?.verified ? 'Yes' : 'Pending'} />
      </div>

      {/* Application funnel — only show once there's at least one application to summarise. */}
      {funnel && applications > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '.75rem' }}>Application funnel</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '.5rem' }}>
            <FunnelCell label="Received"    n={funnel.applied}     colour="oklch(0.55 0.14 255)" />
            <FunnelCell label="Shortlisted" n={funnel.shortlisted} colour="oklch(0.50 0.14 275)" />
            <FunnelCell label="Interview"   n={funnel.interview}   colour="oklch(0.60 0.14 70)" />
            <FunnelCell label="Offered"     n={funnel.offered}     colour="oklch(0.55 0.14 155)" />
            <FunnelCell label="Hired"       n={funnel.hired}       colour="oklch(0.45 0.16 155)" />
            <FunnelCell label="Not selected" n={funnel.rejected}   colour="oklch(0.55 0.12 25)" />
          </div>
        </div>
      )}

      {/* Per-posting analytics — top 5 by views. */}
      {analytics && analytics.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '.75rem' }}>Posting performance</h2>
          <div style={{ display: 'grid', gap: '.4rem' }}>
            {analytics.slice(0, 5).map((r) => (
              <div key={r.posting_id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
                gap: '.75rem', alignItems: 'center',
                padding: '.55rem .75rem', border: '1px solid var(--border)', borderRadius: '.375rem',
              }}>
                <a href={`/jobs/${r.posting_id}`} style={{ color: 'inherit', textDecoration: 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '.875rem' }}>
                  {r.title}
                </a>
                <span className="muted-text" style={{ fontSize: '.75rem' }} title="Views">
                  👁 {r.view_count}
                </span>
                <span className="muted-text" style={{ fontSize: '.75rem' }} title="Applications">
                  📥 {r.total_apps}
                </span>
                <span style={{ fontSize: '.72rem', color: 'oklch(0.45 0.16 155)', fontWeight: 600 }} title="Hired">
                  ✓ {r.hired}
                </span>
              </div>
            ))}
          </div>
          {analytics.length > 5 && (
            <a href="/employer/postings" className="muted-text" style={{ fontSize: '.8rem', marginTop: '.6rem', display: 'inline-block' }}>
              See all {analytics.length} postings →
            </a>
          )}
        </div>
      )}

      <div className="card" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '.5rem' }}>Quick actions</h2>
        <div style={{ display: 'grid', gap: '.5rem' }}>
          <a href="/employer/postings" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
            Manage postings <IconArrowRight size="sm" />
          </a>
          <a href="/employer/profile" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
            Edit company details <IconArrowRight size="sm" />
          </a>
        </div>
      </div>
    </EmployerLayout>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div className="muted-text" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '.25rem' }}>{value}</div>
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.1rem' }}>{hint}</div>}
    </div>
  );
}

function FunnelCell({ label, n, colour }) {
  return (
    <div style={{ borderLeft: `3px solid ${colour}`, padding: '.35rem .55rem' }}>
      <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '.1rem' }}>{n}</div>
    </div>
  );
}
