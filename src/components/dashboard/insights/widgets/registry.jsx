import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar,
} from 'recharts';

import KpiTile from '../KpiTile';
import ChartFrame from '../ChartFrame';
import { CHART_PALETTE } from '../theme';
import { downloadCsv } from '../exportCsv';
import { navigate } from '../../../../hooks/useRoute';
import { IconArrowRight } from '../../../../icons';

// ─── Icon set re-used from BranchMetricsPage (kept self-contained here so
// the registry can stand on its own). ───────────────────────────────────────
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
  Download:      <I><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></I>,
  ArrowUpDown:   <I><path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" /></I>,
};

// ─── Shared helpers ──────────────────────────────────────────────────────
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
function buildSpark(rows) { return (rows || []).map((r) => Number(r.n || 0)); }
function buildDelta(rows) {
  const arr = rows || [];
  if (arr.length < 2) return null;
  return Number(arr[arr.length - 1]?.n || 0) - Number(arr[arr.length - 2]?.n || 0);
}
function colorToAccent(hex) {
  return ({
    '#3622FF': 'primary', '#16A34A': 'success', '#0891B2': 'teal',
    '#F59E0B': 'warning', '#7C3AED': 'violet',  '#E11D48': 'danger',
    '#0EA5E9': 'sky',
  })[hex] || 'primary';
}

// ─── KPI render helper ───────────────────────────────────────────────────
function renderKpi({ label, value, sub, format, icon, color, delta, spark, highlight, onClick, selected }) {
  return (
    <KpiTile
      label={label}
      value={value}
      sub={sub}
      format={format}
      icon={icon}
      delta={delta}
      spark={spark}
      accent={colorToAccent(color)}
      highlight={highlight}
      selected={selected}
      onClick={onClick}
    />
  );
}

// ─── Tooltip primitives ──────────────────────────────────────────────────
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

// ─── Trend chart (events/registrations per month) ────────────────────────
function TrendChart({ title, subtitle, rows, color, kind = 'area', onPickMonth }) {
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
      empty={data.length === 0}
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

// ─── Donut: events by status ─────────────────────────────────────────────
function EventStatusDonut({ byStatus }) {
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
    <ChartFrame title="Events by status" empty={data.length === 0}>
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

// ─── Members by role bar ─────────────────────────────────────────────────
function MembersByRoleBar({ byRole }) {
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
    <ChartFrame title="Members by role" empty={data.length === 0}>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={88} interval={0} />
            <Tooltip content={<DonutTip />} cursor={{ fill: 'rgba(54,34,255,.04)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24} isAnimationActive animationDuration={650}>
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ─── Attendance radial gauge ─────────────────────────────────────────────
function AttendanceGauge({ rate, attended }) {
  const pct = rate == null ? 0 : Math.round(rate * 100);
  const data = [{ name: 'attendance', value: pct, fill: '#16A34A' }];

  return (
    <ChartFrame title="Attendance rate" empty={rate == null} emptyText="No concluded registrations yet.">
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

// ─── Top committees horizontal bar ───────────────────────────────────────
function CommitteeBar({ title, subtitle, rows, metric, color, selectedId, onSelect }) {
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
    <ChartFrame title={title} subtitle={subtitle} empty={sorted.length === 0} emptyText="No activity in this range.">
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
            onClick={(state) => {
              if (!state?.activePayload?.length || !onSelect) return;
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

// ─── Committee leaderboard table ─────────────────────────────────────────
function CommitteeLeaderboard({ rows, selectedId, onSelect }) {
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
                onClick={() => onSelect?.(r.committee_id)}
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

// ─── Recent events table ─────────────────────────────────────────────────
function RecentEventsTable({ rows }) {
  const [sortKey, setSortKey] = useState('starts_at');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    return [...(rows || [])].sort((a, b) => {
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

  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">Recent events</div>
          <div className="insight-frame-subtitle">latest {sorted.length} across all committees</div>
        </div>
        {sorted.length > 0 && (
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

// ─── Pending approvals queue ─────────────────────────────────────────────
function PendingApprovalsCard({ rows }) {
  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">Pending approvals</div>
          <div className="insight-frame-subtitle">{(rows || []).length} awaiting</div>
        </div>
        <span className="queue-badge">queue</span>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="approval-empty">Nothing waiting on you. 🎉</div>
      ) : (
        <div className="approvals-queue">
          {rows.map((r) => (
            <button
              key={r.id}
              className="approval-row"
              onClick={() => navigate('/my-checklists?id=' + r.id)}
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

// ─── Capacity helper (derived KPI) ───────────────────────────────────────
function capacityUtil(recentEvents) {
  const rows = (recentEvents || []).filter((r) => r.capacity);
  if (!rows.length) return { value: 0, sub: 'no capacity set' };
  const avg = rows.reduce((s, r) => s + Math.min(1, r.registered_count / r.capacity), 0) / rows.length;
  return { value: avg, sub: `${rows.length} events with cap` };
}

// ─── Registry ────────────────────────────────────────────────────────────
// Each widget:
//   id           — stable, snake_case key persisted to the DB
//   title        — shown in the add-widget picker
//   description  — one-liner for the picker
//   group        — 'KPI' | 'Trend' | 'Composition' | 'Committee' | 'Activity'
//   defaultSize  — 'sm' | 'md' | 'lg'
//   allowedSizes — subset of ['sm','md','lg']; smaller = more tiles per row
//   render({ data, ctx, size }) — returns JSX. `ctx` carries cross-widget
//                   state (filters, drill, setUrl, etc.).
export const WIDGET_REGISTRY = [
  // ─── KPIs ────────────────────────────────────────────────────────────
  {
    id: 'kpi_events_total', title: 'Events total', description: 'All events ever, with monthly delta.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => {
      const k = data?.kpis;
      return renderKpi({
        label: 'Events total', value: k?.events.total ?? 0,
        sub: `${k?.events.this_month ?? 0} this month`,
        delta: buildDelta(data?.events_per_month),
        spark: buildSpark(data?.events_per_month),
        color: '#3622FF', icon: Lu.Calendar,
        onClick: () => ctx.setDrill('events'),
        selected: ctx.drill === 'events',
      });
    },
  },
  {
    id: 'kpi_events_upcoming', title: 'Upcoming events (30d)', description: 'Events starting in the next 30 days.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Upcoming (30d)', value: data?.kpis?.events.upcoming_30d ?? 0,
      sub: 'next month', color: '#0891B2', icon: Lu.CalendarClock,
    }),
  },
  {
    id: 'kpi_registrations_total', title: 'Registrations total', description: 'All-time registrations with trend.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Registrations', value: data?.kpis?.registrations.total ?? 0,
      sub: `${data?.kpis?.registrations.this_month ?? 0} this month`,
      delta: buildDelta(data?.registrations_per_month),
      spark: buildSpark(data?.registrations_per_month),
      color: '#16A34A', icon: Lu.TrendingUp,
    }),
  },
  {
    id: 'kpi_attendance_rate', title: 'Attendance rate', description: 'Attended / (attended + no-show).',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => {
      const k = data?.kpis;
      return renderKpi({
        label: 'Attendance rate', value: k?.registrations.attendance_rate ?? 0,
        format: (n) => Math.round(n * 100) + '%',
        sub: `${k?.registrations.attended ?? 0} attended`,
        color: '#16A34A', icon: Lu.Shield,
      });
    },
  },
  {
    id: 'kpi_pending_approvals', title: 'Pending approvals', description: 'Checklists waiting on the chairman.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => {
      const k = data?.kpis;
      return renderKpi({
        label: 'Pending approvals', value: k?.approvals.pending ?? 0,
        sub: `avg cycle ${k?.approvals.avg_cycle_hours ?? 0}h`,
        color: '#F59E0B', icon: Lu.AlertTriangle,
        highlight: (k?.approvals.pending ?? 0) > 0,
        onClick: () => ctx.setDrill('approvals'),
        selected: ctx.drill === 'approvals',
      });
    },
  },
  {
    id: 'kpi_approved_month', title: 'Approved this month', description: 'Checklists cleared so far this month.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Approved this month', value: data?.kpis?.approvals.approved_this_month ?? 0,
      sub: 'events cleared', color: '#16A34A', icon: Lu.CheckCircle,
    }),
  },
  {
    id: 'kpi_avg_cycle', title: 'Average approval cycle', description: 'Time from submission to approval.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Avg approval cycle', value: data?.kpis?.approvals.avg_cycle_hours ?? 0,
      format: (n) => n.toFixed(1) + 'h',
      sub: 'submission → approval', color: '#3622FF', icon: Lu.Clock,
    }),
  },
  {
    id: 'kpi_members_total', title: 'Total members', description: 'All members in this branch.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Total members', value: data?.kpis?.users.total ?? 0,
      sub: `${data?.kpis?.users.new_this_month ?? 0} new this month`,
      color: '#3622FF', icon: Lu.Users,
    }),
  },
  {
    id: 'kpi_new_members', title: 'New members this month', description: 'Sign-ups in the current calendar month.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'New members', value: data?.kpis?.users.new_this_month ?? 0,
      sub: 'this month', color: '#16A34A', icon: Lu.UserPlus,
    }),
  },
  {
    id: 'kpi_active_mcm', title: 'Active MC members', description: 'Currently-serving managing committee members.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => {
      const k = data?.kpis;
      return renderKpi({
        label: 'Active MCMs', value: k?.people.active_mcm ?? 0,
        sub: `${k?.people.active_committee_chair ?? 0} committee chairs`,
        color: '#7C3AED', icon: Lu.Activity,
        onClick: () => ctx.setDrill('committees'),
        selected: ctx.drill === 'committees',
      });
    },
  },
  {
    id: 'kpi_active_committees', title: 'Active committees', description: 'Committees with status=active.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Active committees', value: data?.kpis?.people.active_committees ?? 0,
      sub: 'branch-wide', color: '#0891B2', icon: Lu.Layers,
    }),
  },
  {
    id: 'kpi_capacity', title: 'Capacity utilisation', description: 'Average fill rate of capacity-bounded events.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => {
      const c = capacityUtil(data?.recent_events);
      return renderKpi({
        label: 'Capacity used', value: c.value,
        format: (n) => Math.round(n * 100) + '%',
        sub: c.sub, color: '#F59E0B', icon: Lu.Gauge,
      });
    },
  },

  // ─── Trend charts ────────────────────────────────────────────────────
  {
    id: 'chart_events_per_month', title: 'Events per month', description: 'Bar chart, last 12 months — click a bar to filter.',
    group: 'Trend', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data, ctx }) => (
      <TrendChart
        title="Events per month" subtitle="click a bar to filter the date range"
        rows={data?.events_per_month} color="#3622FF" kind="bar"
        onPickMonth={(month) => {
          const [y, m] = month.split('-');
          const from = `${y}-${m}-01`;
          const lastDay = new Date(Number(y), Number(m), 0).getDate();
          const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
          ctx.setUrl({ preset: 'custom', from, to });
        }}
      />
    ),
  },
  {
    id: 'chart_registrations_per_month', title: 'Registrations per month', description: 'Area chart, last 12 months.',
    group: 'Trend', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <TrendChart
        title="Registrations per month" subtitle="trailing 12 months"
        rows={data?.registrations_per_month} color="#16A34A" kind="area"
      />
    ),
  },

  // ─── Composition ─────────────────────────────────────────────────────
  {
    id: 'chart_events_by_status', title: 'Events by status', description: 'Donut of event statuses (published, draft, etc).',
    group: 'Composition', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <EventStatusDonut byStatus={data?.kpis?.events?.by_status} />,
  },
  {
    id: 'chart_members_by_role', title: 'Members by role', description: 'Horizontal bar of users by primary role.',
    group: 'Composition', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <MembersByRoleBar byRole={data?.kpis?.users?.by_primary_role} />,
  },
  {
    id: 'chart_attendance_gauge', title: 'Attendance gauge', description: 'Radial gauge with attended count.',
    group: 'Composition', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <AttendanceGauge
        rate={data?.kpis?.registrations?.attendance_rate}
        attended={data?.kpis?.registrations?.attended}
      />
    ),
  },

  // ─── Committee analysis ──────────────────────────────────────────────
  {
    id: 'chart_top_committees_events', title: 'Top committees · events', description: 'Top 5 committees by event count.',
    group: 'Committee', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data, ctx }) => (
      <CommitteeBar
        title="Top committees · events" subtitle="click a bar to cross-filter"
        rows={data?.by_committee} metric="events_count" color="#3622FF"
        selectedId={ctx.url.committee}
        onSelect={(id) => ctx.setUrl({ committee: id === ctx.url.committee ? '' : id })}
      />
    ),
  },
  {
    id: 'chart_top_committees_regs', title: 'Top committees · registrations', description: 'Top 5 by registrations count.',
    group: 'Committee', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data, ctx }) => (
      <CommitteeBar
        title="Top committees · registrations" subtitle="click a bar to cross-filter"
        rows={data?.by_committee} metric="registrations_count" color="#0891B2"
        selectedId={ctx.url.committee}
        onSelect={(id) => ctx.setUrl({ committee: id === ctx.url.committee ? '' : id })}
      />
    ),
  },
  {
    id: 'table_committees', title: 'All committees table', description: 'Full sortable leaderboard with CSV export.',
    group: 'Committee', defaultSize: 'lg', allowedSizes: ['lg'],
    render: ({ data, ctx }) => (
      <CommitteeLeaderboard
        rows={data?.by_committee}
        selectedId={ctx.url.committee}
        onSelect={(id) => ctx.setUrl({ committee: id === ctx.url.committee ? '' : id })}
      />
    ),
  },

  // ─── Activity ────────────────────────────────────────────────────────
  {
    id: 'table_recent_events', title: 'Recent events', description: 'Sortable table with capacity bars.',
    group: 'Activity', defaultSize: 'lg', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <RecentEventsTable rows={data?.recent_events} />,
  },
  {
    id: 'card_pending_approvals', title: 'Pending approvals queue', description: 'Tap-through queue of waiting checklists.',
    group: 'Activity', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <PendingApprovalsCard rows={data?.pending_approvals} />,
  },
];

export const WIDGET_BY_ID = Object.fromEntries(WIDGET_REGISTRY.map((w) => [w.id, w]));

// Default layout — what a chairman sees the first time, before they customize.
// Matches the order of the legacy fixed dashboard so existing users feel at home.
export const DEFAULT_LAYOUT = [
  { id: 'kpi_events_total',           size: 'sm' },
  { id: 'kpi_events_upcoming',        size: 'sm' },
  { id: 'kpi_registrations_total',   size: 'sm' },
  { id: 'kpi_attendance_rate',       size: 'sm' },
  { id: 'kpi_pending_approvals',     size: 'sm' },
  { id: 'kpi_approved_month',        size: 'sm' },
  { id: 'kpi_avg_cycle',             size: 'sm' },
  { id: 'kpi_members_total',         size: 'sm' },
  { id: 'kpi_new_members',           size: 'sm' },
  { id: 'kpi_active_mcm',            size: 'sm' },
  { id: 'kpi_active_committees',     size: 'sm' },
  { id: 'kpi_capacity',              size: 'sm' },
  { id: 'chart_events_per_month',    size: 'md' },
  { id: 'chart_registrations_per_month', size: 'md' },
  { id: 'chart_events_by_status',    size: 'md' },
  { id: 'chart_members_by_role',     size: 'md' },
  { id: 'chart_attendance_gauge',    size: 'md' },
  { id: 'chart_top_committees_events', size: 'md' },
  { id: 'chart_top_committees_regs',   size: 'md' },
  { id: 'table_committees',          size: 'lg' },
  { id: 'table_recent_events',       size: 'lg' },
  { id: 'card_pending_approvals',    size: 'md' },
];
