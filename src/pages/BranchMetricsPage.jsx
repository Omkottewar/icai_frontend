import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar,
} from 'recharts';

import { useAuth } from '../context/AuthContext';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { useBranchMetrics } from '../hooks/useBranchMetrics';
import { usePublicCommittees } from '../hooks/usePublicCommittees';
import { navigate } from '../hooks/useRoute';
import { IconArrowRight } from '../icons';

import InsightsStyles from '../components/dashboard/insights/insightsStyles';
import KpiTile from '../components/dashboard/insights/KpiTile';
import ChartFrame from '../components/dashboard/insights/ChartFrame';
import { useUrlState } from '../components/dashboard/insights/useUrlState';
import { downloadCsv } from '../components/dashboard/insights/exportCsv';
import { CHART_PALETTE } from '../components/dashboard/insights/theme';
import { mergeWithMock } from '../components/dashboard/insights/branchMetricsMock';

// ─── tiny inline lucide-style icons (KPI tiles, topbar) ──────────────────
const I = ({ children }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const Lu = {
  Calendar:      <I><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></I>,
  CalendarClock: <I><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" /><path d="M16 2v4M8 2v4M3 10h18" /><circle cx="18" cy="18" r="4" /><path d="M18 16.5V18l1 1" /></I>,
  Users:         <I><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></I>,
  UserPlus:      <I><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></I>,
  CheckCircle:   <I><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></I>,
  Clock:         <I><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></I>,
  Shield:        <I><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></I>,
  Activity:      <I><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></I>,
  Layers:        <I><path d="m12 2 9 5-9 5-9-5 9-5z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></I>,
  Gauge:         <I><path d="M12 14 21 5" /><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></I>,
  TrendingUp:    <I><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></I>,
  AlertTriangle: <I><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4M12 17h.01" /></I>,
  Share:         <I><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></I>,
  RefreshCw:     <I><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></I>,
  Check:         <I><path d="M20 6 9 17l-5-5" /></I>,
  Download:      <I><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></I>,
  X:             <I><path d="M18 6 6 18M6 6l12 12" /></I>,
  ArrowUpDown:   <I><path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" /></I>,
};

// ─── helpers ──────────────────────────────────────────────────────────────
const FMT_TIME = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });
const FMT_DATE = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function fmtDate(iso) { return iso ? FMT_DATE.format(new Date(iso)) : '—'; }
function fmtAge(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  return `${Math.max(1, hours)}h`;
}
function fmtMonth(yyyymm) {
  if (!yyyymm) return '—';
  const [y, m] = yyyymm.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
function liveAgeSec(updatedAt) {
  if (!updatedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
}

function presetRange(key) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const iso = (d) => d.toISOString().slice(0, 10);
  switch (key) {
    case 'this_month':     return { from: iso(new Date(yyyy, now.getMonth(), 1)), to: '' };
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { from: iso(new Date(yyyy, q * 3, 1)), to: '' };
    }
    case 'this_year':      return { from: iso(new Date(yyyy, 0, 1)), to: '' };
    case 'last_12_months': return { from: iso(new Date(yyyy - 1, now.getMonth(), 1)), to: '' };
    case 'all_time':
    default:               return { from: '', to: '' };
  }
}

const PRESETS = [
  ['this_month',     'This month'],
  ['this_quarter',   'This quarter'],
  ['this_year',      'This year'],
  ['last_12_months', 'Last 12 months'],
  ['all_time',       'All time'],
];

// ─── main page ───────────────────────────────────────────────────────────
export default function BranchMetricsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isBranchChairman, isAdmin } = useRoleFlags();

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user]);

  const [url, setUrl] = useUrlState({ preset: 'this_year', from: '', to: '', committee: '', drill: '' });

  useEffect(() => {
    if (url.preset && url.preset !== 'custom' && !url.from && !url.to) {
      const r = presetRange(url.preset);
      setUrl({ from: r.from, to: r.to });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: liveData, loading, fetching, error, updatedAt, refresh } = useBranchMetrics({
    from: url.from, to: url.to, committee_id: url.committee,
  });
  const { data: committeesData } = usePublicCommittees();

  const data = useMemo(() => mergeWithMock(liveData), [liveData]);

  // Tick once per second so the "Live · Ns ago" pill updates without a refetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    const tickInt = setInterval(() => setTick((t) => t + 1), 1_000);
    const pollInt = setInterval(() => { refresh(); }, 60_000);
    return () => { clearInterval(tickInt); clearInterval(pollInt); };
  }, [refresh]);

  function applyPreset(key) {
    const r = presetRange(key);
    setUrl({ preset: key, from: r.from, to: r.to });
  }
  function resetAll() {
    setUrl({ preset: 'this_year', from: presetRange('this_year').from, to: '', committee: '', drill: '' });
  }
  function setDrill(metric) { setUrl({ drill: url.drill === metric ? '' : metric }); }

  if (authLoading) {
    return <p className="muted-text" style={{ padding: '4rem 1rem', textAlign: 'center' }}>Loading…</p>;
  }
  if (!user) return null;

  if (!isBranchChairman && !isAdmin) {
    return (
      <section className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h2>Forbidden</h2>
        <p className="muted-text">This dashboard is for the branch chairman.</p>
      </section>
    );
  }

  const committees = committeesData?.rows ?? [];
  const liveCommittees = (data?.by_committee || []).map((r) => ({
    id: r.committee_id, code: r.committee_code, name: r.committee_name,
  }));
  // Merge live committees with what mock data has so the filter dropdown is
  // never empty before the live API responds.
  const dropdownCommittees = committees.length ? committees : liveCommittees;
  const selectedCommittee = dropdownCommittees.find((c) => c.id === url.committee);
  const ageSec = liveAgeSec(updatedAt);

  return (
    <div className="insights-page">
      <InsightsStyles />

      <section className="container" style={{ paddingBottom: '4rem' }}>
        {/* Sticky frosted topbar */}
        <div className="insights-topbar">
          <div className="insights-topbar-title">
            <div className="insights-topbar-logo">CA</div>
            <div>
              <h1>Branch chairman dashboard</h1>
              <div className="insights-topbar-meta">
                Last reload {updatedAt ? FMT_TIME.format(new Date(updatedAt)) : '—'}
                {' · '}scoped to <strong>{selectedCommittee?.name || 'all committees'}</strong>
              </div>
            </div>
          </div>
          <div className="insights-topbar-actions">
            <LivePill fetching={fetching} ageSec={ageSec} />
            <ShareButton />
            <button className="d-btn" onClick={refresh} disabled={fetching}>
              <span className={fetching ? 'spin' : ''}>{Lu.RefreshCw}</span>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="insight-frame" style={{ marginBottom: '1rem' }}>
            <div className="insight-frame-body" style={{ color: 'var(--destructive)', fontSize: 12 }}>
              {error.message || "Couldn't load metrics."} (showing sample data)
            </div>
          </div>
        )}

        <div className="insights-layout">
          <FilterRail
            url={url} setUrl={setUrl}
            committees={dropdownCommittees}
            onPreset={applyPreset}
            onReset={resetAll}
          />

          <div className="insights-main">
            <section className="insights-block">
              <SectionHeader number="01" title="Overview" sub="12 KPIs · click an outlined tile to drill in" />
              <KpiSection
                data={data} loading={loading && !liveData}
                drill={url.drill} onDrill={setDrill}
              />
            </section>

            <section className="insights-block">
              <SectionHeader number="02" title="Trends & composition" sub="how events and members evolve" />
              <div className="insights-row cols-2">
                <TrendChart
                  title="Events per month" subtitle="click a bar to filter the date range"
                  rows={data?.events_per_month}
                  color="#3622FF"
                  loading={loading && !liveData}
                  kind="bar"
                  onPickMonth={(month) => {
                    const [y, m] = month.split('-');
                    const from = `${y}-${m}-01`;
                    const lastDay = new Date(Number(y), Number(m), 0).getDate();
                    const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
                    setUrl({ preset: 'custom', from, to });
                  }}
                />
                <TrendChart
                  title="Registrations per month" subtitle="trailing 12 months"
                  rows={data?.registrations_per_month}
                  color="#16A34A"
                  loading={loading && !liveData}
                  kind="area"
                />
              </div>

              <div className="insights-row cols-3">
                <EventStatusDonut byStatus={data?.kpis?.events?.by_status} loading={loading && !liveData} />
                <MembersByRoleBar byRole={data?.kpis?.users?.by_primary_role} loading={loading && !liveData} />
                <AttendanceGauge
                  rate={data?.kpis?.registrations?.attendance_rate}
                  attended={data?.kpis?.registrations?.attended}
                  loading={loading && !liveData}
                />
              </div>
            </section>

            <section className="insights-block">
              <SectionHeader number="03" title="Committees" sub="click a row or bar to cross-filter the page" />
              <div className="insights-row cols-2">
                <CommitteeBar
                  title="Top committees · events" subtitle="click a bar to cross-filter"
                  rows={data?.by_committee || []}
                  metric="events_count"
                  color="#3622FF"
                  selectedId={url.committee}
                  onSelect={(id) => setUrl({ committee: id === url.committee ? '' : id })}
                  loading={loading && !liveData}
                />
                <CommitteeBar
                  title="Top committees · registrations" subtitle="click a bar to cross-filter"
                  rows={data?.by_committee || []}
                  metric="registrations_count"
                  color="#0891B2"
                  selectedId={url.committee}
                  onSelect={(id) => setUrl({ committee: id === url.committee ? '' : id })}
                  loading={loading && !liveData}
                />
              </div>
              <CommitteeLeaderboard
                rows={data?.by_committee || []}
                selectedId={url.committee}
                onSelect={(id) => setUrl({ committee: id === url.committee ? '' : id })}
                loading={loading && !liveData}
              />
            </section>

            <section className="insights-block">
              <SectionHeader number="04" title="Activity" sub="recent events & pending approvals" />
              <div className="insights-row cols-2-1">
                <RecentEventsTable rows={data?.recent_events || []} loading={loading && !liveData} />
                <PendingApprovalsCard rows={data?.pending_approvals || []} loading={loading && !liveData} />
              </div>
            </section>

            <ComingSoonMetrics />

            <footer className="insights-footer">
              ICAI Nagpur Branch · Chairman analytics · data refreshes every 60s
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Live pill (state-tinted) ────────────────────────────────────────────
function LivePill({ fetching, ageSec }) {
  const stale = ageSec > 120;
  return (
    <span
      className="insights-live"
      data-fetching={fetching ? 'true' : 'false'}
      data-stale={stale ? 'true' : 'false'}
    >
      <span className="dot" />
      {fetching ? 'Refreshing…' : `Live · ${ageSec}s ago`}
    </span>
  );
}

// ─── Section header ─────────────────────────────────────────────────────
function SectionHeader({ number, title, sub }) {
  return (
    <div className="insights-section">
      <div className="insights-section-left">
        <span className="insights-section-eyebrow">{number}</span>
        <h2 className="insights-section-title">{title}</h2>
      </div>
      {sub && <span className="insights-section-sub">{sub}</span>}
    </div>
  );
}

// ─── Filter rail (left sidebar) ──────────────────────────────────────────
function FilterRail({ url, setUrl, committees, onPreset, onReset }) {
  return (
    <aside className="filter-rail">
      <span className="eyebrow-pill filter-rail-eyebrow">▾ FILTERS</span>

      <div className="filter-block">
        <span className="filter-label">Date range</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRESETS.map(([k, label]) => (
            <button
              key={k}
              className={'vpill' + (url.preset === k ? ' is-active' : '')}
              onClick={() => onPreset(k)}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="filter-block">
        <span className="filter-label">Custom range</span>
        <input
          type="date" className="input-base"
          value={url.from || ''}
          onChange={(e) => setUrl({ from: e.target.value, preset: 'custom' })}
        />
        <input
          type="date" className="input-base"
          value={url.to || ''}
          onChange={(e) => setUrl({ to: e.target.value, preset: 'custom' })}
        />
      </div>

      <div className="filter-block">
        <span className="filter-label">Committee</span>
        <select
          className="input-base"
          value={url.committee || ''}
          onChange={(e) => setUrl({ committee: e.target.value })}
        >
          <option value="">All committees</option>
          {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <button className="filter-reset" onClick={onReset}>Reset filters</button>
    </aside>
  );
}

// ─── Share button (copies URL) ───────────────────────────────────────────
function ShareButton() {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    });
  }
  return (
    <button className="d-btn" onClick={copy} title="Copy a link to this filtered view">
      {done ? Lu.Check : Lu.Share}
      {done ? 'Copied' : 'Share'}
    </button>
  );
}

// ─── KPI section ─────────────────────────────────────────────────────────
const KPI_ICONS = {
  events:     { icon: Lu.Calendar,      color: '#3622FF' },
  upcoming:   { icon: Lu.CalendarClock, color: '#0891B2' },
  regs:       { icon: Lu.TrendingUp,    color: '#16A34A' },
  attendance: { icon: Lu.Shield,        color: '#16A34A' },
  pending:    { icon: Lu.AlertTriangle, color: '#F59E0B' },
  approved:   { icon: Lu.CheckCircle,   color: '#16A34A' },
  cycle:      { icon: Lu.Clock,         color: '#3622FF' },
  members:    { icon: Lu.Users,         color: '#3622FF' },
  newmembers: { icon: Lu.UserPlus,      color: '#16A34A' },
  mcm:        { icon: Lu.Activity,      color: '#7C3AED' },
  committees: { icon: Lu.Layers,        color: '#0891B2' },
  capacity:   { icon: Lu.Gauge,         color: '#F59E0B' },
};

function colorToAccent(hex) {
  const map = {
    '#3622FF': 'primary',
    '#16A34A': 'success',
    '#0891B2': 'teal',
    '#F59E0B': 'warning',
    '#7C3AED': 'violet',
    '#E11D48': 'danger',
    '#0EA5E9': 'sky',
  };
  return map[hex] || 'primary';
}

function buildSpark(rows) { return (rows || []).map((r) => Number(r.n || 0)); }
function buildDelta(rows) {
  const arr = rows || [];
  if (arr.length < 2) return null;
  return Number(arr[arr.length - 1]?.n || 0) - Number(arr[arr.length - 2]?.n || 0);
}

function KpiSection({ data, loading, drill, onDrill }) {
  if (loading && !data) {
    return (
      <div className="kpi-strip">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="kpi-tile" style={{ height: 116 }}>
            <div className="insight-frame-skeleton" style={{ height: '100%' }} />
          </div>
        ))}
      </div>
    );
  }
  if (!data) return null;

  const k = data.kpis;
  const eventsSpark = buildSpark(data.events_per_month);
  const regsSpark   = buildSpark(data.registrations_per_month);
  const eventsDelta = buildDelta(data.events_per_month);
  const regsDelta   = buildDelta(data.registrations_per_month);

  const capRows = (data.recent_events || []).filter((r) => r.capacity);
  const capUtil = capRows.length
    ? capRows.reduce((s, r) => s + Math.min(1, r.registered_count / r.capacity), 0) / capRows.length
    : null;

  const tiles = [
    {
      key: 'events',
      label: 'Events total', value: k.events.total,
      sub: `${k.events.this_month} this month`,
      delta: eventsDelta, spark: eventsSpark,
      ...KPI_ICONS.events,
      selected: drill === 'events', onClick: () => onDrill('events'),
    },
    { key: 'upcoming', label: 'Upcoming (30d)', value: k.events.upcoming_30d, sub: 'next month', ...KPI_ICONS.upcoming },
    {
      key: 'regs',
      label: 'Registrations', value: k.registrations.total,
      sub: `${k.registrations.this_month} this month`,
      delta: regsDelta, spark: regsSpark,
      ...KPI_ICONS.regs,
    },
    {
      key: 'attendance',
      label: 'Attendance rate',
      value: k.registrations.attendance_rate ?? 0,
      format: (n) => Math.round(n * 100) + '%',
      sub: `${k.registrations.attended} attended`,
      ...KPI_ICONS.attendance,
    },
    {
      key: 'pending',
      label: 'Pending approvals', value: k.approvals.pending,
      sub: `avg cycle ${k.approvals.avg_cycle_hours}h`,
      ...KPI_ICONS.pending,
      highlight: k.approvals.pending > 0,
      selected: drill === 'approvals', onClick: () => onDrill('approvals'),
    },
    { key: 'approved', label: 'Approved this month', value: k.approvals.approved_this_month, sub: 'events cleared', ...KPI_ICONS.approved },
    {
      key: 'cycle',
      label: 'Avg approval cycle',
      value: k.approvals.avg_cycle_hours,
      format: (n) => n.toFixed(1) + 'h',
      sub: 'submission → approval',
      ...KPI_ICONS.cycle,
    },
    { key: 'members', label: 'Total members', value: k.users.total, sub: `${k.users.new_this_month} new this month`, ...KPI_ICONS.members },
    { key: 'newmembers', label: 'New members', value: k.users.new_this_month, sub: 'this month', ...KPI_ICONS.newmembers },
    {
      key: 'mcm',
      label: 'Active MCMs', value: k.people.active_mcm,
      sub: `${k.people.active_committee_chair} committee chairs`,
      ...KPI_ICONS.mcm,
      selected: drill === 'committees', onClick: () => onDrill('committees'),
    },
    { key: 'committees', label: 'Active committees', value: k.people.active_committees, sub: 'branch-wide', ...KPI_ICONS.committees },
    {
      key: 'capacity',
      label: 'Capacity used',
      value: capUtil ?? 0,
      format: (n) => Math.round(n * 100) + '%',
      sub: capRows.length ? `${capRows.length} events with cap` : 'no capacity set',
      ...KPI_ICONS.capacity,
    },
  ];

  return (
    <>
      <div className="kpi-strip">
        {tiles.map((t) => (
          <KpiTile
            key={t.key}
            label={t.label}
            value={t.value}
            sub={t.sub}
            format={t.format}
            icon={t.icon}
            delta={t.delta}
            spark={t.spark}
            accent={colorToAccent(t.color)}
            selected={t.selected}
            highlight={t.highlight}
            onClick={t.onClick}
          />
        ))}
      </div>

      {drill === 'events' && <DrillEvents rows={data.recent_events} onClose={() => onDrill('')} />}
      {drill === 'approvals' && <DrillApprovals rows={data.pending_approvals} onClose={() => onDrill('')} />}
      {drill === 'committees' && <DrillCommittees rows={data.by_committee} onClose={() => onDrill('')} />}
    </>
  );
}

// ─── Drill-down panels ───────────────────────────────────────────────────
function DrillShell({ title, onClose, children }) {
  return (
    <div className="insights-drill">
      <div className="insights-drill-head">
        <span className="insights-drill-title">{title}</span>
        <button className="insights-drill-close" onClick={onClose} aria-label="Close drill">
          {Lu.X}
        </button>
      </div>
      {children}
    </div>
  );
}

function DrillEvents({ rows = [], onClose }) {
  return (
    <DrillShell title="All events — quick view" onClose={onClose}>
      <div className="insights-drill-grid">
        {rows.slice(0, 12).map((r) => (
          <div key={r.id} className="insights-drill-item">
            <div style={{ minWidth: 0 }}>
              <div className="ditem-title">{r.title}</div>
              <div className="ditem-sub">{r.committee_code || '—'} · {fmtDate(r.starts_at)}</div>
            </div>
            <div className="ditem-num">{r.registered_count}{r.capacity ? `/${r.capacity}` : ''}</div>
          </div>
        ))}
      </div>
    </DrillShell>
  );
}

function DrillApprovals({ rows = [], onClose }) {
  return (
    <DrillShell title="Approvals queue" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: 12, margin: 0 }}>Nothing waiting on you. 🎉</p>
      ) : (
        <div className="insights-drill-grid">
          {rows.map((r) => (
            <div key={r.id} className="insights-drill-item">
              <div style={{ minWidth: 0 }}>
                <div className="ditem-title">{r.event_title}</div>
                <div className="ditem-sub">{r.committee_name || r.committee_code || '—'} · waiting {fmtAge(r.updated_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DrillShell>
  );
}

function DrillCommittees({ rows = [], onClose }) {
  return (
    <DrillShell title="Active managing committee members" onClose={onClose}>
      <div className="insights-drill-grid">
        {rows.slice(0, 12).map((r, i) => (
          <div key={r.committee_id} className="insights-drill-item">
            <div style={{ minWidth: 0 }}>
              <div className="ditem-title">CA Member {i + 1}</div>
              <div className="ditem-sub">Chair · {r.committee_name}</div>
            </div>
            <div className="ditem-num"><span className="mono" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.committee_code}</span></div>
          </div>
        ))}
      </div>
    </DrillShell>
  );
}

// ─── Trend chart ─────────────────────────────────────────────────────────
function TrendChart({ title, subtitle, rows, color, loading, onPickMonth, kind = 'area' }) {
  const data = useMemo(() => (rows || []).map((r) => ({
    month: r.month, n: Number(r.n || 0), label: fmtMonth(r.month),
  })), [rows]);

  const total = data.reduce((s, r) => s + r.n, 0);
  const peak  = data.reduce((m, r) => (r.n > m.n ? r : m), { n: -1 });

  const handleClick = (state) => {
    if (!onPickMonth || !state?.activePayload?.length) return;
    const p = state.activePayload[0]?.payload;
    if (p?.month) onPickMonth(p.month);
  };

  const safeTitle = title.replace(/\s+/g, '');
  const single = data.length === 1 ? data[0] : null;

  return (
    <ChartFrame
      title={title}
      subtitle={data.length > 1
        ? `${total.toLocaleString('en-IN')} total · peak ${peak.n} in ${peak.label || '—'}`
        : subtitle}
      loading={loading && !rows}
      empty={!loading && data.length === 0}
    >
      {single ? (
        <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{single.n}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>in {single.label}</div>
        </div>
      ) : (
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'bar' ? (
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} onClick={handleClick}>
                <defs>
                  <linearGradient id={`bar-${safeTitle}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<TipBox color={color} unit=" events" />} cursor={{ fill: 'rgba(54,34,255,.04)' }} />
                <Bar dataKey="n" fill={`url(#bar-${safeTitle})`} radius={[6, 6, 0, 0]}
                  isAnimationActive animationDuration={650}
                  style={{ cursor: onPickMonth ? 'pointer' : 'default' }} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={`area-${safeTitle}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<TipBox color={color} />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="n" stroke={color} strokeWidth={2}
                  fill={`url(#area-${safeTitle})`}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
                  isAnimationActive animationDuration={650} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}

function TipBox({ active, payload, label, color, unit = '' }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="insights-tip">
      {label && <div className="tip-title">{label}</div>}
      <div className="tip-row">
        <span className="tip-dot" style={{ background: color || payload[0].color || payload[0].fill }} />
        <span className="tip-num">{Number(v).toLocaleString('en-IN')}{unit}</span>
      </div>
    </div>
  );
}

// ─── Donut: events by status ─────────────────────────────────────────────
function EventStatusDonut({ byStatus, loading }) {
  const data = useMemo(() => {
    if (!byStatus) return [];
    return Object.entries(byStatus).map(([k, v], i) => ({
      name: k.replace('_', ' '),
      value: Number(v),
      fill: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
  }, [byStatus]);

  const total = data.reduce((s, r) => s + r.value, 0);

  return (
    <ChartFrame title="Events by status" loading={loading && !byStatus} empty={!loading && data.length === 0}>
      <div style={{ height: 240, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name"
              innerRadius={56} outerRadius={86} paddingAngle={2}
              stroke="#fff" strokeWidth={3}
              isAnimationActive animationDuration={650}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<DonutTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{total}</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: 'var(--muted-foreground)', marginTop: 4 }}>events</div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 12px' }}>
          {data.map((d) => (
            <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: d.fill }} />
              {d.name}
            </span>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}

// ─── Members by role — horizontal bar ────────────────────────────────────
function MembersByRoleBar({ byRole, loading }) {
  const data = useMemo(() => {
    if (!byRole) return [];
    return Object.entries(byRole)
      .map(([k, v]) => ({
        name: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: Number(v),
      }))
      .sort((a, b) => b.value - a.value);
  }, [byRole]);

  return (
    <ChartFrame title="Members by role" loading={loading && !byRole} empty={!loading && data.length === 0}>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={88} interval={0} />
            <Tooltip content={<DonutTip />} cursor={{ fill: 'rgba(54,34,255,.04)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24} isAnimationActive animationDuration={650}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

function DonutTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="insights-tip">
      <div className="tip-row">
        <span className="tip-dot" style={{ background: p.payload.fill || p.color }} />
        <span>{p.name}</span>
        <span className="tip-num">{Number(p.value).toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}

// ─── Radial attendance gauge ─────────────────────────────────────────────
function AttendanceGauge({ rate, attended, loading }) {
  const pct = rate == null ? 0 : Math.round(rate * 100);
  const data = [{ name: 'attendance', value: pct, fill: '#16A34A' }];

  return (
    <ChartFrame title="Attendance rate" loading={loading} empty={!loading && rate == null} emptyText="No concluded registrations yet.">
      <div style={{ height: 240, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="68%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
            <RadialBar dataKey="value" cornerRadius={20}
              background={{ fill: 'oklch(0.94 0.01 250)' }}
              isAnimationActive animationDuration={650} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{pct}%</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: 'var(--muted-foreground)', marginTop: 4 }}>attended</div>
          {attended != null && (
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>{attended.toLocaleString('en-IN')} attended</div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}

// ─── Top committees · horizontal bar (code-only y-axis) ──────────────────
function CommitteeBar({ title, subtitle, rows, metric, color, selectedId, onSelect, loading }) {
  const sorted = useMemo(() => {
    return [...(rows || [])]
      .filter((r) => Number(r[metric] || 0) > 0)
      .sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0))
      .slice(0, 5)
      .map((r) => ({
        id: r.committee_id,
        code: r.committee_code,
        name: r.committee_name,
        value: Number(r[metric] || 0),
      }));
  }, [rows, metric]);

  return (
    <ChartFrame title={title} subtitle={subtitle} loading={loading && !rows} empty={!loading && sorted.length === 0} emptyText="No activity in this range.">
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
            onClick={(state) => {
              if (!state?.activePayload?.length) return;
              const p = state.activePayload[0]?.payload;
              if (p?.id) onSelect(p.id);
            }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="code" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} interval={0} />
            <Tooltip content={<TipBox color={color} />} cursor={{ fill: 'rgba(54,34,255,.04)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive animationDuration={650} style={{ cursor: 'pointer' }}>
              {sorted.map((d) => (
                <Cell key={d.id}
                  fill={selectedId === d.id ? '#3622FF' : color}
                  fillOpacity={selectedId && selectedId !== d.id ? 0.4 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ─── All-committees table (stacked num + bar per metric) ─────────────────
function CommitteeLeaderboard({ rows, selectedId, onSelect, loading }) {
  const [sortKey, setSortKey] = useState('events_count');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    return [...(rows || [])].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortDir]);

  const maxEvents = Math.max(1, ...sorted.map((r) => r.events_count || 0));
  const maxRegs   = Math.max(1, ...sorted.map((r) => r.registrations_count || 0));

  function H({ k, label, num }) {
    const sortable = k !== 'committee_code';
    return (
      <th
        className={[num ? 'num' : '', sortable ? 'sortable' : ''].filter(Boolean).join(' ')}
        onClick={() => {
          if (!sortable) return;
          if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
          else { setSortKey(k); setSortDir('desc'); }
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          {sortable && Lu.ArrowUpDown}
        </span>
      </th>
    );
  }

  if (loading && !rows) {
    return (
      <div className="insight-frame">
        <div className="insight-frame-header"><div className="insight-frame-titles"><div className="insight-frame-title">All committees</div></div></div>
        <div className="insight-frame-body"><div className="insight-frame-skeleton" /></div>
      </div>
    );
  }

  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">All committees</div>
          <div className="insight-frame-subtitle">{sorted.length} active</div>
        </div>
        <button
          className="iframe-btn"
          onClick={() => downloadCsv('committees.csv', sorted, ['committee_name', 'committee_code', 'events_count', 'registrations_count'])}
        >{Lu.Download} CSV</button>
      </div>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        <table className="insight-table">
          <thead>
            <tr>
              <H k="committee_name" label="Committee" />
              <H k="committee_code" label="Code" />
              <H k="events_count" label="Events" num />
              <H k="registrations_count" label="Registrations" num />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.committee_id}
                data-selected={selectedId === r.committee_id}
                onClick={() => onSelect(r.committee_id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontWeight: 500 }}>{r.committee_name}</td>
                <td><span className="mono">{r.committee_code}</span></td>
                <td className="num">
                  <div className="stacked-num">
                    <span className="sn-value">{r.events_count}</span>
                    <span className="sn-bar"><span className="sn-bar-fill" style={{ width: `${(r.events_count / maxEvents) * 100}%` }} /></span>
                  </div>
                </td>
                <td className="num">
                  <div className="stacked-num">
                    <span className="sn-value">{r.registrations_count.toLocaleString('en-IN')}</span>
                    <span className="sn-bar"><span className="sn-bar-fill" style={{ width: `${(r.registrations_count / maxRegs) * 100}%`, background: 'linear-gradient(90deg, #16A34A, #0891B2)' }} /></span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Recent events table (status pill + stacked capacity bar) ────────────
function RecentEventsTable({ rows, loading }) {
  const [sortKey, setSortKey] = useState('starts_at');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (sortKey === 'starts_at') {
        return sortDir === 'asc'
          ? new Date(av).getTime() - new Date(bv).getTime()
          : new Date(bv).getTime() - new Date(av).getTime();
      }
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortDir]);

  function H({ k, label, num }) {
    return (
      <th
        className={[num ? 'num' : '', 'sortable'].join(' ')}
        onClick={() => {
          if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
          else { setSortKey(k); setSortDir('desc'); }
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label}{Lu.ArrowUpDown}</span>
      </th>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="insight-frame">
        <div className="insight-frame-header"><div className="insight-frame-titles"><div className="insight-frame-title">Recent events</div></div></div>
        <div className="insight-frame-body"><div className="insight-frame-skeleton" /></div>
      </div>
    );
  }

  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">Recent events</div>
          <div className="insight-frame-subtitle">latest {rows.length} across all committees</div>
        </div>
        {rows.length > 0 && (
          <button
            className="iframe-btn"
            onClick={() => downloadCsv('recent-events.csv', sorted, ['title', 'committee_code', 'starts_at', 'status', 'registered_count', 'capacity'])}
          >{Lu.Download} CSV</button>
        )}
      </div>
      <div style={{ overflow: 'auto' }}>
        <table className="insight-table">
          <thead>
            <tr>
              <H k="title" label="Event title" />
              <H k="committee_code" label="Cmt" />
              <H k="starts_at" label="Date" />
              <H k="status" label="Status" />
              <H k="registered_count" label="Registered" num />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                <td><span className="mono">{r.committee_code || '—'}</span></td>
                <td style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.starts_at)}</td>
                <td><span className={`status-pill s-${r.status}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="num">
                  {r.capacity ? (
                    <div className="stacked-num">
                      <span className="sn-value">{r.registered_count}<span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}> / {r.capacity}</span></span>
                      <span className="sn-bar">
                        <span
                          className="sn-bar-fill"
                          style={{
                            width: `${Math.min(100, (r.registered_count / r.capacity) * 100)}%`,
                            background: r.registered_count / r.capacity >= 0.9
                              ? 'linear-gradient(90deg, #F59E0B, #E11D48)'
                              : 'linear-gradient(90deg, #3622FF, #0891B2)',
                          }}
                        />
                      </span>
                    </div>
                  ) : r.registered_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pending approvals (right column) ────────────────────────────────────
function PendingApprovalsCard({ rows, loading }) {
  if (loading && rows.length === 0) {
    return (
      <div className="insight-frame">
        <div className="insight-frame-header"><div className="insight-frame-titles"><div className="insight-frame-title">Pending approvals</div></div></div>
        <div className="insight-frame-body"><div className="insight-frame-skeleton" /></div>
      </div>
    );
  }

  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">Pending approvals</div>
          <div className="insight-frame-subtitle">{rows.length} awaiting</div>
        </div>
        <span className="queue-badge">queue</span>
      </div>
      {rows.length === 0 ? (
        <div className="approval-empty">Nothing waiting on you. 🎉</div>
      ) : (
        <div className="approvals-queue">
          {rows.map((r) => (
            <button
              key={r.id}
              className="approval-row"
              onClick={() => navigate('/checklists?id=' + r.id)}
            >
              <div style={{ minWidth: 0 }}>
                <div className="ar-title">{r.event_title}</div>
                <div className="ar-meta">{r.committee_name || r.committee_code || '—'} · waiting {fmtAge(r.updated_at)}</div>
              </div>
              <span className="ar-arrow"><IconArrowRight size="sm" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Roadmap / coming soon block ─────────────────────────────────────────
function ComingSoonMetrics() {
  return (
    <div className="insights-roadmap">
      <span className="eyebrow-pill">ROADMAP</span>
      <h4 style={{ marginTop: 8 }}>Coming soon</h4>
      <p className="muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
        These need new instrumentation we haven't built yet:
      </p>
      <ul>
        <li><strong>Daily website visits</strong> — needs page-view tracking or a third-party analytics integration.</li>
        <li><strong>Paper presentations</strong> — needs a real <code>paper_presentations</code> table + admin CRUD.</li>
        <li><strong>Revenue</strong> — payments table exists but isn't wired to events / CPE / room bookings.</li>
        <li><strong>CPE compliance</strong> — aggregated cpe_credits view + member-level drilldown.</li>
      </ul>
    </div>
  );
}
