import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerStatTile } from '../../components/ui/Shimmer';
import AlertsWidget from '../../components/admin/AlertsWidget';

// ─── /admin/wicasa-insights ────────────────────────────────────────────────
// Deep-dive dashboard for the WICASA head. Combines student engagement,
// mock-test analytics, articleship + scholarship funnels, student services
// SLA, and reading-room utilization in one page.

const rupees = (paise) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function WicasaInsightsPage() {
  const { showToast } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/insights/wicasa', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error.message || 'Failed');
        setData(j);
      })
      .catch((e) => { showToast?.(e.message, 'error'); setData({}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout
      title="WICASA insights"
      subtitle="Student pulse, mock-test analytics, articleship funnel, scholarship + service SLA"
    >
      <AlertsWidget filter={(a) => /grievance|reading|scholar|articleship|utr/i.test(a.id) || true} />

      {!data ? (
        <div className="ins-grid">
          {Array.from({ length: 6 }).map((_, i) => <ShimmerStatTile key={i} />)}
        </div>
      ) : (
        <>
          <StudentPulse data={data.student_pulse} signups={data.new_signups_12m} />
          <div className="ins-two-col">
            <EventsSection events={data.events} />
            <MockTestsSection mock={data.mock_tests} />
          </div>
          <div className="ins-two-col">
            <FunnelSection
              title="Articleship funnel"
              subtitle="Students matched to CA firms — status distribution"
              rows={data.articleship?.funnel || []}
              statusColors={{
                submitted: '#eab308', shortlisted: '#3b82f6',
                confirmed: '#10b981', in_progress: '#6366f1',
                completed: '#16a34a', withdrawn: '#94a3b8', rejected: '#ef4444',
              }}
            />
            <FunnelSection
              title="Scholarship funnel"
              subtitle="Applications by review stage"
              rows={data.scholarship?.funnel || []}
              statusColors={{
                submitted: '#eab308', under_review: '#3b82f6',
                shortlisted: '#6366f1', awarded: '#16a34a',
                rejected: '#ef4444', withdrawn: '#94a3b8',
              }}
            />
          </div>
          <ServicesRow data={data.services} readingRoom={data.reading_room} />
        </>
      )}

      <style>{STYLES}</style>
    </AdminLayout>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────

function StudentPulse({ data, signups }) {
  const p = data || {};
  return (
    <section className="ins-section">
      <h3 className="ins-h">Student pulse</h3>
      <div className="ins-grid">
        <StatTile label="Total students"       value={p.total_students ?? 0} />
        <StatTile label="Active (last 30d)"    value={p.active_30d ?? 0}
                  sub={p.total_students ? `${pct(p.active_30d ?? 0, p.total_students)}% engagement` : ''} />
        <StatTile label="New in last 30d"      value={p.new_30d ?? 0} ok={p.new_30d > 0} />
      </div>
      <div className="ins-card">
        <div className="ins-card-head">
          <div className="ins-card-title">Signups — last 12 months</div>
          <div className="ins-card-sub">Student-role registrations by month</div>
        </div>
        <BarChart data={(signups || []).map((r) => ({ label: MONTH_SHORT[Number(r.month.slice(5)) - 1], value: r.n }))} />
      </div>
    </section>
  );
}

function EventsSection({ events }) {
  const s = events?.last_90d || {};
  const upcoming = events?.upcoming || [];
  return (
    <section className="ins-section">
      <h3 className="ins-h">Student events</h3>
      <div className="ins-grid">
        <StatTile label="Events (last 90d)"    value={s.events_count ?? 0} />
        <StatTile label="Registrations"        value={s.total_registrations ?? 0} />
        <StatTile label="Avg fill rate"        value={`${s.avg_fill ?? 0}%`}
                  ok={(s.avg_fill ?? 0) >= 60} highlight={(s.avg_fill ?? 0) < 40} />
      </div>
      <div className="ins-card">
        <div className="ins-card-head">
          <div className="ins-card-title">Upcoming — next 30 days</div>
        </div>
        {upcoming.length === 0 ? (
          <p className="muted-text" style={{ margin: '.5rem 0 0' }}>No upcoming student events.</p>
        ) : (
          <table className="ins-table">
            <thead><tr><th>Event</th><th>Committee</th><th>Starts</th><th style={{ textAlign: 'right' }}>Filled</th></tr></thead>
            <tbody>
              {upcoming.map((e) => {
                const filled = e.capacity ? pct(e.registered_count, e.capacity) : null;
                return (
                  <tr key={e.id}>
                    <td>{e.title}</td>
                    <td className="muted-text">{e.committee_name || '—'}</td>
                    <td className="muted-text">{new Date(e.starts_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: filled == null ? 'var(--muted-foreground)' : filled < 40 ? '#ef4444' : filled >= 80 ? '#16a34a' : 'var(--foreground)' }}>
                      {filled == null ? '—' : `${e.registered_count}/${e.capacity} · ${filled}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function MockTestsSection({ mock }) {
  const s = mock?.summary || {};
  const a = mock?.attempts_last_90d || {};
  const submitted = a.submitted ?? 0;
  const passRate = submitted > 0 ? pct(a.passed ?? 0, submitted) : 0;
  const avgScore = a.avg_score != null ? Math.round(Number(a.avg_score)) : null;

  return (
    <section className="ins-section">
      <h3 className="ins-h">Mock tests</h3>
      <div className="ins-grid">
        <StatTile label="Tests total"         value={s.total ?? 0} />
        <StatTile label="Upcoming"            value={s.upcoming ?? 0} />
        <StatTile label="Attempts (90d)"      value={a.attempts ?? 0} />
      </div>
      <div className="ins-card">
        <div className="ins-card-head">
          <div className="ins-card-title">Attempt performance — last 90 days</div>
          <div className="ins-card-sub">{submitted} submitted attempts · avg score {avgScore ?? '—'}</div>
        </div>
        {submitted > 0 ? (
          <div className="ins-splitbar">
            <div style={{ width: `${passRate}%`, background: '#16a34a' }} title={`Passed — ${a.passed}`} />
            <div style={{ width: `${100 - passRate}%`, background: '#ef4444' }} title={`Failed — ${a.failed}`} />
          </div>
        ) : (
          <p className="muted-text" style={{ margin: '.5rem 0 0' }}>No submitted attempts in the last 90 days.</p>
        )}
        {submitted > 0 && (
          <div className="ins-splitlabel">
            <span><span className="dot" style={{ background: '#16a34a' }} /> Passed · {a.passed ?? 0} ({passRate}%)</span>
            <span><span className="dot" style={{ background: '#ef4444' }} /> Failed · {a.failed ?? 0} ({100 - passRate}%)</span>
          </div>
        )}
      </div>
    </section>
  );
}

function FunnelSection({ title, subtitle, rows, statusColors }) {
  const total = rows.reduce((sum, r) => sum + Number(r.n), 0) || 1;
  return (
    <section className="ins-section">
      <h3 className="ins-h">{title}</h3>
      <div className="ins-card">
        <div className="ins-card-head">
          <div className="ins-card-title">{subtitle}</div>
          <div className="ins-card-sub">{total} total</div>
        </div>
        {rows.length === 0 ? (
          <p className="muted-text" style={{ margin: '.5rem 0 0' }}>No applications yet.</p>
        ) : (
          <div className="ins-funnel">
            {rows.map((r) => {
              const p = Math.max(3, Math.round((Number(r.n) / total) * 100));
              return (
                <div key={r.status} className="ins-funnel-row">
                  <div className="ins-funnel-label">{r.status.replace(/_/g, ' ')}</div>
                  <div className="ins-funnel-track">
                    <div
                      className="ins-funnel-fill"
                      style={{ width: `${p}%`, background: statusColors[r.status] || '#94a3b8' }}
                    />
                  </div>
                  <div className="ins-funnel-num">{r.n}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesRow({ data, readingRoom }) {
  const c = data?.counselling || {};
  return (
    <section className="ins-section">
      <h3 className="ins-h">Student services & reading room</h3>
      <div className="ins-grid">
        <StatTile label="Counselling — pending"    value={c.pending ?? 0} highlight={(c.pending ?? 0) > 5} />
        <StatTile label="Counselling — total"      value={c.total ?? 0} />
        <StatTile label="Suggestions — open"       value={data?.suggestions_open ?? 0} />
        <StatTile label="Reading room deposits — pending"
                  value={readingRoom?.pending_deposits ?? 0}
                  highlight={(readingRoom?.pending_deposits ?? 0) > 0} />
      </div>
      {readingRoom?.usage_monthly?.length > 0 && (
        <div className="ins-card">
          <div className="ins-card-head">
            <div className="ins-card-title">Reading room bookings — last 6 months</div>
          </div>
          <BarChart data={readingRoom.usage_monthly.map((r) => ({ label: r.ym.slice(5) + '/' + r.ym.slice(2, 4), value: r.bookings }))} />
        </div>
      )}
    </section>
  );
}

// ─── Primitives ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, ok, highlight }) {
  return (
    <div className="ins-tile">
      <div className="ins-tile-label">{label}</div>
      <div className={'ins-tile-value' + (ok ? ' ok' : '') + (highlight ? ' danger' : '')}>{value}</div>
      {sub && <div className="ins-tile-sub">{sub}</div>}
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="ins-bars">
      {data.map((d, i) => (
        <div key={i} className="ins-bar-col">
          <div className="ins-bar-fill" style={{ height: `${(d.value / max) * 100}%` }} title={`${d.label}: ${d.value}`} />
          <div className="ins-bar-num">{d.value}</div>
          <div className="ins-bar-lbl">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

const STYLES = `
  .ins-section { margin-bottom: 1.5rem; }
  .ins-h { margin: 0 0 .75rem; font-size: 1.05rem; font-weight: 700; }

  .ins-grid {
    display: grid; gap: .75rem;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    margin-bottom: .75rem;
  }
  .ins-two-col {
    display: grid; gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    margin-bottom: 1.5rem;
  }

  .ins-tile {
    padding: .85rem 1rem;
    background: var(--card); border: 1px solid var(--border);
    border-radius: .55rem;
  }
  .ins-tile-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted-foreground); }
  .ins-tile-value { font-size: 1.35rem; font-weight: 700; margin-top: .25rem; }
  .ins-tile-value.ok { color: #16a34a; }
  .ins-tile-value.danger { color: #ef4444; }
  .ins-tile-sub { font-size: .72rem; color: var(--muted-foreground); margin-top: .15rem; }

  .ins-card {
    padding: 1rem 1.1rem;
    background: var(--card); border: 1px solid var(--border);
    border-radius: .55rem;
    margin-bottom: .75rem;
  }
  .ins-card-head { margin-bottom: .75rem; }
  .ins-card-title { font-weight: 700; font-size: .95rem; }
  .ins-card-sub { font-size: .75rem; color: var(--muted-foreground); margin-top: .1rem; }

  .ins-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  .ins-table th { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--border); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted-foreground); }
  .ins-table td { padding: .5rem .5rem; border-bottom: 1px solid var(--border); }

  .ins-splitbar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; }
  .ins-splitlabel { display: flex; justify-content: space-between; margin-top: .5rem; font-size: .78rem; color: var(--foreground); }
  .ins-splitlabel .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: .3rem; vertical-align: middle; }

  .ins-funnel { display: flex; flex-direction: column; gap: .55rem; }
  .ins-funnel-row { display: grid; grid-template-columns: 100px 1fr 40px; align-items: center; gap: .5rem; font-size: .85rem; }
  .ins-funnel-label { text-transform: capitalize; color: var(--muted-foreground); font-size: .78rem; }
  .ins-funnel-track { height: 8px; background: var(--muted); border-radius: 999px; overflow: hidden; }
  .ins-funnel-fill { height: 100%; transition: width .3s; }
  .ins-funnel-num { text-align: right; font-weight: 600; }

  .ins-bars { display: flex; gap: 4px; align-items: end; height: 120px; padding-top: 4px; }
  .ins-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 22px; }
  .ins-bar-fill { width: 100%; min-height: 2px; background: linear-gradient(180deg, oklch(0.55 0.17 255) 0%, oklch(0.65 0.14 255) 100%); border-radius: 3px 3px 0 0; }
  .ins-bar-num { font-size: .65rem; color: var(--muted-foreground); margin-top: .2rem; }
  .ins-bar-lbl { font-size: .62rem; color: var(--muted-foreground); }
`;
