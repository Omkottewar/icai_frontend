import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { useBranchMetrics } from '../hooks/useBranchMetrics';
import { usePublicCommittees } from '../hooks/usePublicCommittees';
import { navigate } from '../hooks/useRoute';
import { IconArrowRight } from '../icons';

// ─── helpers ──────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return Math.round(v * 100) + '%';
}
function fmtAge(iso) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return `${Math.max(1, hours)}h`;
}

function presetRange(key) {
  const now = new Date();
  const yyyy = now.getFullYear();
  switch (key) {
    case 'this_month': return { from: new Date(yyyy, now.getMonth(), 1).toISOString().slice(0, 10), to: '' };
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(yyyy, q * 3, 1).toISOString().slice(0, 10), to: '' };
    }
    case 'this_year': return { from: new Date(yyyy, 0, 1).toISOString().slice(0, 10), to: '' };
    case 'last_12_months': return { from: new Date(yyyy - 1, now.getMonth(), 1).toISOString().slice(0, 10), to: '' };
    case 'all_time': default: return { from: '', to: '' };
  }
}

// ─── main page ───────────────────────────────────────────────────────────
export default function BranchMetricsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isBranchChairman, isAdmin } = useRoleFlags();

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user]);

  const [preset, setPreset] = useState('this_year');
  const [from, setFrom] = useState(() => presetRange('this_year').from);
  const [to, setTo] = useState('');
  const [committeeId, setCommitteeId] = useState('');

  function applyPreset(key) {
    setPreset(key);
    const { from: f, to: t } = presetRange(key);
    setFrom(f); setTo(t);
  }

  const { data, loading, error } = useBranchMetrics({ from, to, committee_id: committeeId });
  const { data: committeesData } = usePublicCommittees();

  if (authLoading) return <p className="muted-text" style={{ padding: '4rem 1rem', textAlign: 'center' }}>Loading…</p>;
  if (!user) return null;

  if (!isBranchChairman && !isAdmin) {
    return (
      <section className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h2>Forbidden</h2>
        <p className="muted-text">This dashboard is for the branch chairman.</p>
      </section>
    );
  }

  return (
    <>
      <PageHeader title="Branch insights" subtitle="Metrics across events, registrations, members and approvals" />

      <section className="container" style={{ padding: '1.5rem 1rem 4rem' }}>
        {/* Filter bar */}
        <div className="filters">
          <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
            {[
              ['this_month', 'This month'],
              ['this_quarter', 'This quarter'],
              ['this_year', 'This year'],
              ['last_12_months', 'Last 12 months'],
              ['all_time', 'All time'],
            ].map(([k, label]) => (
              <button key={k} onClick={() => applyPreset(k)}
                      className={'filter-pill' + (preset === k ? ' active' : '')}>
                {label}
              </button>
            ))}
          </div>
          <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" className="input-base" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} style={{ maxWidth: 160 }} />
            <span className="muted-text">→</span>
            <input type="date" className="input-base" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} style={{ maxWidth: 160 }} />
            <select className="input-base" value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">All committees</option>
              {(committeesData?.rows ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error-banner">{error.message}</div>}
        {loading && !data && <p className="muted-text">Loading metrics…</p>}

        {data && (
          <>
            {/* KPI grid */}
            <KpiGrid k={data.kpis} />

            {/* Charts row */}
            <div className="charts-row">
              <ChartCard title="Events per month" rows={data.events_per_month} />
              <ChartCard title="Registrations per month" rows={data.registrations_per_month} accent="#16a34a" />
            </div>

            {/* By-committee table */}
            <CommitteeTable rows={data.by_committee} />

            {/* Recent events + Pending approvals */}
            <div className="two-col">
              <RecentEventsTable rows={data.recent_events} />
              <PendingApprovalsCard rows={data.pending_approvals} />
            </div>

            {/* Coming-soon section for metrics that need new instrumentation */}
            <ComingSoonMetrics />
          </>
        )}
      </section>

      <style>{`
        .filters {
          display: flex; gap: 1rem; align-items: center; justify-content: space-between;
          flex-wrap: wrap; padding: .875rem 1rem; margin-bottom: 1.5rem;
          background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
        }
        .filter-pill {
          padding: .35rem .85rem; border-radius: 999px;
          border: 1px solid var(--border); background: transparent;
          font-size: .8125rem; cursor: pointer; transition: background .12s, color .12s;
        }
        .filter-pill:hover { background: var(--muted, #fafaf9); }
        .filter-pill.active { background: var(--primary); color: white; border-color: var(--primary); }
        .error-banner {
          padding: .75rem 1rem; background: #fef2f2; border: 1px solid #fecaca;
          color: #991b1b; border-radius: .375rem; margin-bottom: 1rem;
        }
        .charts-row {
          display: grid; gap: 1rem; grid-template-columns: 1fr; margin-top: 1.5rem;
        }
        @media (min-width: 900px) {
          .charts-row { grid-template-columns: 1fr 1fr; }
        }
        .two-col {
          display: grid; gap: 1rem; grid-template-columns: 1fr; margin-top: 1.5rem;
        }
        @media (min-width: 900px) {
          .two-col { grid-template-columns: 2fr 1fr; }
        }
      `}</style>
    </>
  );
}

// ─── KPI grid ────────────────────────────────────────────────────────────
function KpiGrid({ k }) {
  return (
    <div className="kpi-grid">
      <Kpi label="Events total"        value={k.events.total}        sub={`${k.events.this_month} this month`} />
      <Kpi label="Upcoming (30d)"      value={k.events.upcoming_30d} sub="Published & ahead" />
      <Kpi label="Registrations"       value={k.registrations.total} sub={`${k.registrations.this_month} this month`} />
      <Kpi label="Attendance rate"     value={fmtPct(k.registrations.attendance_rate)} sub={`${k.registrations.attended} attended`} />
      <Kpi label="Pending approvals"   value={k.approvals.pending}   sub={`Avg cycle ${k.approvals.avg_cycle_hours}h`} highlight={k.approvals.pending > 0} />
      <Kpi label="Approved this month" value={k.approvals.approved_this_month} sub="Checklists finalised" />
      <Kpi label="Total members"       value={k.users.total}         sub={`${k.users.new_this_month} new this month`} />
      <Kpi label="Active MCMs"         value={k.people.active_mcm}   sub={`${k.people.active_committee_chair} committee chairs`} />
      <Kpi label="Active committees"   value={k.people.active_committees} sub="Visible on public site" />

      <style>{`
        .kpi-grid {
          display: grid; gap: .75rem;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }) {
  return (
    <div className="kpi" style={highlight ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 2px rgba(54,34,255,.08)' } : undefined}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <style>{`
        .kpi {
          padding: .875rem 1rem; background: var(--card);
          border: 1px solid var(--border); border-radius: .5rem;
          transition: border-color .12s;
        }
        .kpi-label {
          font-size: .7rem; text-transform: uppercase; letter-spacing: .06em;
          color: var(--muted-foreground); font-weight: 700;
        }
        .kpi-value {
          font-size: 1.75rem; font-weight: 700; margin-top: .25rem; line-height: 1.1;
        }
        .kpi-sub {
          font-size: .75rem; color: var(--muted-foreground); margin-top: .25rem;
        }
      `}</style>
    </div>
  );
}

// ─── Bar-list "chart" (CSS, no chart lib) ─────────────────────────────────
function ChartCard({ title, rows, accent = '#2563eb' }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.n)));
  return (
    <div className="card-block">
      <h3 className="card-block-title">{title}</h3>
      {rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: '.8125rem' }}>No data in this range.</p>
      ) : (
        <ul className="bar-list">
          {rows.map((r) => (
            <li key={r.month}>
              <span className="bar-label">{formatMonth(r.month)}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: ((r.n / max) * 100) + '%', background: accent }} />
              </span>
              <span className="bar-value">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .card-block {
          padding: 1rem; background: var(--card);
          border: 1px solid var(--border); border-radius: .5rem;
        }
        .card-block-title { font-size: .9375rem; font-weight: 700; margin: 0 0 .75rem; }
        .bar-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .25rem; }
        .bar-list li {
          display: grid; grid-template-columns: 70px 1fr 40px;
          align-items: center; gap: .5rem; font-size: .8125rem;
        }
        .bar-label { color: var(--muted-foreground); }
        .bar-track { height: 8px; background: var(--muted, #f5f5f4); border-radius: 999px; overflow: hidden; }
        .bar-fill  { display: block; height: 100%; border-radius: 999px; transition: width .2s; }
        .bar-value { text-align: right; font-weight: 600; color: var(--foreground); }
      `}</style>
    </div>
  );
}

function formatMonth(yyyymm) {
  if (!yyyymm) return '—';
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

// ─── By-committee sortable table ─────────────────────────────────────────
function CommitteeTable({ rows }) {
  const [sortKey, setSortKey] = useState('events_count');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  function header(key, label, width) {
    const arrow = sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return (
      <th style={{ width, cursor: 'pointer' }} onClick={() => {
        if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
      }}>{label}{arrow}</th>
    );
  }

  return (
    <div className="card-block" style={{ marginTop: '1.5rem' }}>
      <h3 className="card-block-title">Committees · activity breakdown</h3>
      <table className="metrics-table">
        <thead>
          <tr>
            {header('committee_name', 'Committee')}
            {header('committee_code', 'Code', 100)}
            {header('events_count', 'Events', 100)}
            {header('registrations_count', 'Registrations', 140)}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={4} className="empty-row">No committees yet.</td></tr>}
          {sorted.map((r) => (
            <tr key={r.committee_id}>
              <td>{r.committee_name}</td>
              <td><span className="mono">{r.committee_code}</span></td>
              <td>{r.events_count}</td>
              <td>{r.registrations_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .metrics-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
        .metrics-table th {
          text-align: left; padding: .5rem .625rem; background: var(--muted, #f5f5f4);
          font-size: .7rem; text-transform: uppercase; letter-spacing: .04em;
          font-weight: 700; color: var(--muted-foreground); border-bottom: 1px solid var(--border);
          user-select: none;
        }
        .metrics-table td {
          padding: .625rem; border-bottom: 1px solid var(--border);
        }
        .metrics-table tr:last-child td { border-bottom: 0; }
        .empty-row { text-align: center; color: var(--muted-foreground); padding: 1.5rem; }
        .mono { font-family: ui-monospace, monospace; font-size: .8125rem; background: var(--muted, #f5f5f4); padding: .1rem .35rem; border-radius: .25rem; }
      `}</style>
    </div>
  );
}

// ─── Recent events table (sortable) ──────────────────────────────────────
function RecentEventsTable({ rows }) {
  const [sortKey, setSortKey] = useState('starts_at');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (sortKey === 'starts_at') {
        const ax = new Date(av).getTime(); const bx = new Date(bv).getTime();
        return sortDir === 'asc' ? ax - bx : bx - ax;
      }
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortDir]);

  function H({ k, label, width }) {
    const arrow = sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return (
      <th style={{ width, cursor: 'pointer' }} onClick={() => {
        if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('desc'); }
      }}>{label}{arrow}</th>
    );
  }

  return (
    <div className="card-block">
      <h3 className="card-block-title">Recent events</h3>
      <table className="metrics-table">
        <thead>
          <tr>
            <H k="title" label="Event" />
            <H k="committee_code" label="Committee" width={120} />
            <H k="starts_at" label="Date" width={130} />
            <H k="status" label="Status" width={110} />
            <H k="registered_count" label="Registered" width={100} />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={5} className="empty-row">No events in this range.</td></tr>}
          {sorted.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600 }}>{r.title}</td>
              <td><span className="mono">{r.committee_code || '—'}</span></td>
              <td>{fmtDate(r.starts_at)}</td>
              <td><span className={'status-pill status-' + r.status}>{r.status.replace('_', ' ')}</span></td>
              <td>{r.registered_count}{r.capacity ? ` / ${r.capacity}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .status-pill {
          padding: .1rem .5rem; border-radius: 999px; font-size: .7rem; font-weight: 600; text-transform: capitalize;
        }
        .status-published { background: #dcfce7; color: #166534; }
        .status-draft     { background: #f1f5f9; color: #475569; }
        .status-pending_approval { background: #fef3c7; color: #92400e; }
        .status-cancelled { background: #fee2e2; color: #991b1b; }
        .status-completed { background: #e0e7ff; color: #3730a3; }
        .status-approved  { background: #dbeafe; color: #1e40af; }
      `}</style>
    </div>
  );
}

// ─── Pending approvals side card ─────────────────────────────────────────
function PendingApprovalsCard({ rows }) {
  return (
    <div className="card-block">
      <h3 className="card-block-title">Pending approvals (oldest 5)</h3>
      {rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: '.8125rem' }}>Nothing waiting on you. 🎉</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {rows.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => navigate('/checklists?id=' + r.id)}
                className="row gap-2"
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '.5rem .75rem',
                  border: '1px solid var(--border)', borderRadius: '.375rem',
                  background: 'var(--background)', cursor: 'pointer', alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event_title}</div>
                  <div className="muted-text" style={{ fontSize: '.7rem' }}>{r.committee_name || r.committee_code || '—'} · waiting {fmtAge(r.updated_at)}</div>
                </div>
                <IconArrowRight size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Honest "coming soon" section ────────────────────────────────────────
function ComingSoonMetrics() {
  return (
    <div className="card-block" style={{ marginTop: '1.5rem', borderStyle: 'dashed' }}>
      <h3 className="card-block-title">Coming soon</h3>
      <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: 0 }}>
        These need new instrumentation we haven't built yet:
      </p>
      <ul style={{ fontSize: '.8125rem', color: 'var(--muted-foreground)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
        <li><strong>Daily website visits</strong> — needs page-view tracking middleware or a third-party analytics integration (Plausible / PostHog).</li>
        <li><strong>Paper presentations</strong> — currently only hardcoded sample data; needs a real <code>paper_presentations</code> table + admin CRUD.</li>
        <li><strong>Revenue</strong> — payments table exists but isn't wired to events / CPE / room bookings. Needs payment-status reconciliation.</li>
        <li><strong>CPE compliance overview</strong> — aggregated cpe_credits view + member-level drilldown.</li>
      </ul>
    </div>
  );
}
