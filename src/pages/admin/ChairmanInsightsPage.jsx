import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerStatTile } from '../../components/ui/Shimmer';
import AlertsWidget from '../../components/admin/AlertsWidget';

// ─── /admin/insights ───────────────────────────────────────────────────────
// Chairman insights dashboard. Six sections in one page:
//   1. Smart alerts (top)
//   2. Financial cockpit
//   3. Growth pulse
//   4. Event portfolio (last 90d)
//   5. Committee leaderboard (+ idle committees)
//   6. Speaker performance
//   7. Retention cohort
// Plus a Weekly Digest print button.

const rupees = (paise) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
const rupeesShort = (paise) => {
  const rs = paise / 100;
  if (rs >= 1e7) return `₹${(rs / 1e7).toFixed(1)}Cr`;
  if (rs >= 1e5) return `₹${(rs / 1e5).toFixed(1)}L`;
  if (rs >= 1e3) return `₹${(rs / 1e3).toFixed(1)}k`;
  return `₹${Math.round(rs)}`;
};
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ChairmanInsightsPage() {
  const { showToast } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/insights/chairman', { credentials: 'include' })
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
      title="Chairman insights"
      subtitle="Portfolio analytics, speaker performance, committee leaderboard, growth, retention, financial cockpit"
      actions={
        <button className="btn btn-outline" onClick={() => window.print()} style={{ padding: '.4rem .8rem' }}>
          🖨 Print weekly digest
        </button>
      }
    >
      <AlertsWidget />

      {!data ? (
        <div className="ins-grid">
          {Array.from({ length: 8 }).map((_, i) => <ShimmerStatTile key={i} />)}
        </div>
      ) : (
        <>
          <FinancialCockpit fin={data.financial} />
          <GrowthPulse growth={data.growth} />
          <EventPortfolio rows={data.portfolio || []} />
          <div className="ins-two-col">
            <CommitteeLeaderboard rows={data.committees || []} idle={data.idle_committees || []} />
            <SpeakerBoard rows={data.top_speakers || []} />
          </div>
          <RetentionCohort rows={data.retention_cohort || []} />
        </>
      )}

      <style>{STYLES}</style>
    </AdminLayout>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────

function FinancialCockpit({ fin }) {
  if (!fin) return null;
  const inflow = Number(fin.cash_inflow_30d_paise || 0);
  const outflow = Number(fin.cash_outflow_committed_paise || 0);
  const net = inflow - outflow;
  return (
    <section className="ins-section">
      <h3 className="ins-h">💰 Financial cockpit</h3>
      <div className="ins-grid">
        <StatTile label="Expected inflow (next 30d)"
                  value={rupeesShort(inflow)}
                  sub={`${fin.cash_inflow_events} paid events`}
                  ok />
        <StatTile label="Committed outflow"
                  value={rupeesShort(outflow)}
                  sub={`${fin.cash_outflow_bills} approved bills`} />
        <StatTile label="Net position"
                  value={rupeesShort(net)}
                  ok={net >= 0} highlight={net < 0} />
        <StatTile label="Bills pending approval"
                  value={fin.bills_pending_approval ?? 0}
                  highlight={(fin.bills_pending_approval ?? 0) > 5} />
        <StatTile label="Refunds pending"
                  value={fin.refunds_pending ?? 0}
                  highlight={(fin.refunds_pending ?? 0) > 3} />
      </div>
    </section>
  );
}

function GrowthPulse({ growth }) {
  if (!growth) return null;
  const g = growth;
  const trend = g.signups_this_month - g.signups_prev_month;
  return (
    <section className="ins-section">
      <h3 className="ins-h">📈 Growth pulse</h3>
      <div className="ins-grid">
        <StatTile label="Signups this month"    value={g.signups_this_month ?? 0}
                  sub={trend >= 0 ? `▲ ${trend} vs prev` : `▼ ${Math.abs(trend)} vs prev`}
                  ok={trend > 0} highlight={trend < 0} />
        <StatTile label="Signups prev month"    value={g.signups_prev_month ?? 0} />
      </div>
      <div className="ins-two-col">
        <div className="ins-card">
          <div className="ins-card-head">
            <div className="ins-card-title">Signups by month (last 12 months)</div>
            <div className="ins-card-sub">Blue = members · Orange = students</div>
          </div>
          <StackedBarChart
            data={(g.signups_monthly || []).map((r) => ({
              label: monthLabel(r.month),
              members: r.members ?? 0,
              students: r.students ?? 0,
            }))}
          />
        </div>
        <div className="ins-card">
          <div className="ins-card-head">
            <div className="ins-card-title">Event registrations by month</div>
            <div className="ins-card-sub">Volume of confirmed seats booked</div>
          </div>
          <BarChart
            data={(g.registrations_monthly || []).map((r) => ({
              label: monthLabel(r.month), value: r.registrations ?? 0,
            }))}
          />
        </div>
      </div>
    </section>
  );
}

function EventPortfolio({ rows }) {
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const committees = useMemo(() => Array.from(new Set(rows.map((r) => r.committee_name).filter(Boolean))), [rows]);
  const filtered = selectedCommittee ? rows.filter((r) => r.committee_name === selectedCommittee) : rows;
  const totalRevenue = filtered.reduce((s, r) => s + Number(r.revenue_paise || 0), 0);
  const totalRegistered = filtered.reduce((s, r) => s + Number(r.total_registered || 0), 0);
  const totalEvents = filtered.reduce((s, r) => s + Number(r.event_count || 0), 0);

  return (
    <section className="ins-section">
      <div className="ins-h-row">
        <h3 className="ins-h">🎯 Event portfolio (last 90d)</h3>
        <select value={selectedCommittee} onChange={(e) => setSelectedCommittee(e.target.value)} className="ins-filter">
          <option value="">All committees</option>
          {committees.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="ins-grid">
        <StatTile label="Events" value={totalEvents} />
        <StatTile label="Total registrations" value={totalRegistered} />
        <StatTile label="Revenue" value={rupeesShort(totalRevenue)} ok={totalRevenue > 0} />
      </div>
      <div className="ins-card" style={{ overflowX: 'auto' }}>
        <table className="ins-table">
          <thead>
            <tr>
              <th>Committee</th>
              <th>Program type</th>
              <th style={{ textAlign: 'right' }}>Events</th>
              <th style={{ textAlign: 'right' }}>Registered</th>
              <th style={{ textAlign: 'right' }}>Avg fill</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="muted-text" style={{ textAlign: 'center', padding: '1rem' }}>No events in the last 90 days.</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.committee_name || '—'}</td>
                <td className="muted-text">{r.program_type || '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.event_count}</td>
                <td style={{ textAlign: 'right' }}>{r.total_registered}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: r.avg_fill >= 70 ? '#16a34a' : r.avg_fill < 40 ? '#ef4444' : 'var(--foreground)' }}>
                  {r.avg_fill}%
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{rupees(Number(r.revenue_paise))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommitteeLeaderboard({ rows, idle }) {
  const active = rows.filter((r) => (r.events_held ?? 0) > 0);
  return (
    <section className="ins-section">
      <h3 className="ins-h">🏆 Committee leaderboard</h3>
      <div className="ins-card" style={{ overflowX: 'auto' }}>
        <table className="ins-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Committee</th>
              <th style={{ textAlign: 'right' }}>Events</th>
              <th style={{ textAlign: 'right' }}>Registered</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr><td colSpan={5} className="muted-text" style={{ textAlign: 'center', padding: '1rem' }}>No committee activity in the last 90 days.</td></tr>
            ) : active.map((r, i) => (
              <tr key={r.id}>
                <td style={{ color: i < 3 ? '#eab308' : 'var(--muted-foreground)', fontWeight: 700 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td style={{ textAlign: 'right' }}>{r.events_held ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{r.total_registered ?? 0}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{rupeesShort(Number(r.revenue_paise))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {idle.length > 0 && (
        <div className="ins-card" style={{ background: 'oklch(0.97 0.05 25 / .3)', borderColor: 'oklch(0.75 0.15 25 / .4)', marginTop: '.5rem' }}>
          <div className="ins-card-head">
            <div className="ins-card-title" style={{ color: '#991b1b' }}>💤 Idle committees</div>
            <div className="ins-card-sub">No event in the last 60 days</div>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '.85rem' }}>
            {idle.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span className="muted-text" style={{ marginLeft: '.5rem', fontSize: '.75rem' }}>
                  {c.last_event_at ? `last event ${new Date(c.last_event_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : 'never'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SpeakerBoard({ rows }) {
  return (
    <section className="ins-section">
      <h3 className="ins-h">🎤 Speaker performance</h3>
      <div className="ins-card" style={{ overflowX: 'auto' }}>
        <table className="ins-table">
          <thead>
            <tr>
              <th>Speaker</th>
              <th style={{ textAlign: 'right' }}>Sessions</th>
              <th style={{ textAlign: 'right' }}>Reach</th>
              <th style={{ textAlign: 'right' }}>Last session</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="muted-text" style={{ textAlign: 'center', padding: '1rem' }}>No speakers recorded in the last year.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.sessions}</td>
                <td style={{ textAlign: 'right' }}>{r.total_reach}</td>
                <td style={{ textAlign: 'right', fontSize: '.78rem', color: 'var(--muted-foreground)' }}>
                  {r.latest_session ? new Date(r.latest_session).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RetentionCohort({ rows }) {
  return (
    <section className="ins-section">
      <h3 className="ins-h">🔄 Member retention cohort</h3>
      <div className="ins-card" style={{ overflowX: 'auto' }}>
        <table className="ins-table">
          <thead>
            <tr>
              <th>Signup cohort</th>
              <th style={{ textAlign: 'right' }}>Size</th>
              <th style={{ textAlign: 'right' }}>M+0 active</th>
              <th style={{ textAlign: 'right' }}>M+1 active</th>
              <th style={{ textAlign: 'right' }}>M+2 active</th>
              <th style={{ textAlign: 'right' }}>M+3 active</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="muted-text" style={{ textAlign: 'center', padding: '1rem' }}>No cohort data yet.</td></tr>
            ) : rows.map((r) => {
              const size = r.cohort_size || 1;
              return (
                <tr key={r.cohort}>
                  <td style={{ fontWeight: 600 }}>{monthLabel(r.cohort)}</td>
                  <td style={{ textAlign: 'right' }}>{r.cohort_size}</td>
                  <RetentionCell v={r.m0} size={size} />
                  <RetentionCell v={r.m1} size={size} />
                  <RetentionCell v={r.m2} size={size} />
                  <RetentionCell v={r.m3} size={size} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RetentionCell({ v, size }) {
  const p = pct(v, size);
  const color = p >= 40 ? '#16a34a' : p >= 20 ? '#eab308' : p > 0 ? '#f97316' : 'var(--muted-foreground)';
  return (
    <td style={{ textAlign: 'right', color, fontWeight: 600 }}>
      {v}{p > 0 ? ` · ${p}%` : ''}
    </td>
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

function StackedBarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => (d.members || 0) + (d.students || 0)));
  return (
    <div className="ins-bars">
      {data.map((d, i) => {
        const total = (d.members || 0) + (d.students || 0);
        const h = (total / max) * 100;
        const memH = total > 0 ? (d.members / total) * h : 0;
        const stuH = total > 0 ? (d.students / total) * h : 0;
        return (
          <div key={i} className="ins-bar-col">
            <div style={{ width: '100%', height: `${h}%`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ height: `${stuH}%`, background: 'oklch(0.65 0.15 55)' }} title={`Students: ${d.students}`} />
              <div style={{ height: `${memH}%`, background: 'oklch(0.55 0.17 255)', borderRadius: '3px 3px 0 0' }} title={`Members: ${d.members}`} />
            </div>
            <div className="ins-bar-num">{total}</div>
            <div className="ins-bar-lbl">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MONTH_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

const STYLES = `
  .ins-section { margin-bottom: 1.5rem; }
  .ins-h { margin: 0 0 .75rem; font-size: 1.05rem; font-weight: 700; }
  .ins-h-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
  .ins-filter { padding: .35rem .55rem; border: 1px solid var(--border); border-radius: .35rem; font-size: .85rem; background: var(--card); color: var(--foreground); }

  .ins-grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: .75rem; }
  .ins-two-col { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); margin-bottom: 1.5rem; }

  .ins-tile { padding: .85rem 1rem; background: var(--card); border: 1px solid var(--border); border-radius: .55rem; }
  .ins-tile-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted-foreground); }
  .ins-tile-value { font-size: 1.35rem; font-weight: 700; margin-top: .25rem; }
  .ins-tile-value.ok { color: #16a34a; }
  .ins-tile-value.danger { color: #ef4444; }
  .ins-tile-sub { font-size: .72rem; color: var(--muted-foreground); margin-top: .15rem; }

  .ins-card { padding: 1rem 1.1rem; background: var(--card); border: 1px solid var(--border); border-radius: .55rem; margin-bottom: .75rem; }
  .ins-card-head { margin-bottom: .75rem; }
  .ins-card-title { font-weight: 700; font-size: .95rem; }
  .ins-card-sub { font-size: .75rem; color: var(--muted-foreground); margin-top: .1rem; }

  .ins-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  .ins-table th { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--border); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted-foreground); }
  .ins-table td { padding: .5rem .5rem; border-bottom: 1px solid var(--border); }

  .ins-bars { display: flex; gap: 4px; align-items: end; height: 130px; padding-top: 4px; }
  .ins-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 24px; }
  .ins-bar-fill { width: 100%; min-height: 2px; background: linear-gradient(180deg, oklch(0.55 0.17 255) 0%, oklch(0.65 0.14 255) 100%); border-radius: 3px 3px 0 0; }
  .ins-bar-num { font-size: .65rem; color: var(--muted-foreground); margin-top: .2rem; }
  .ins-bar-lbl { font-size: .62rem; color: var(--muted-foreground); }

  @media print {
    button, .ins-filter { display: none !important; }
    .ins-section { break-inside: avoid; }
  }
`;
