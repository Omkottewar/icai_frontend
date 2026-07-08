import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

import KpiTile from '../KpiTile';
import ChartFrame from '../ChartFrame';
import { downloadCsv } from '../exportCsv';
import { navigate } from '../../../../hooks/useRoute';
import { IconArrowRight } from '../../../../icons';

// Palette used by the expense-by-category donut. Ordered high-contrast so
// small slices are still legible when the top category dominates.
const CATEGORY_PALETTE = [
  '#3622FF', '#0891B2', '#16A34A', '#7C3AED',
  '#E11D48', '#F59E0B', '#EA580C', '#0EA5E9',
  '#6366F1', '#DB2777', '#059669', '#B45309',
];

// ─── Icons (self-contained lucide-style) ────────────────────────────────
const I = ({ children }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const Lu = {
  IndianRupee:  <I><path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10" /></I>,
  Receipt:      <I><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2" /><path d="M9 8h6M9 12h6M9 16h4" /></I>,
  RotateCcw:    <I><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></I>,
  ArrowLeftRight: <I><path d="m3 7 4-4 4 4" /><path d="M7 3v18" /><path d="m21 17-4 4-4-4" /><path d="M17 21V3" /></I>,
  Heart:        <I><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></I>,
  Inbox:        <I><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></I>,
  TrendingUp:   <I><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></I>,
  Activity:     <I><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></I>,
  Download:     <I><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></I>,
  ArrowUpDown:  <I><path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" /></I>,
  AlertTriangle: <I><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4M12 17h.01" /></I>,
  CheckCircle:  <I><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></I>,
};

// ─── Formatting helpers ─────────────────────────────────────────────────
const FMT_INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});
function fmtPaise(paise) {
  if (paise == null) return '—';
  return FMT_INR.format(Number(paise) / 100);
}
// Compact rupees used inside KPI tiles where the number needs to stay short.
function fmtPaiseCompact(paise) {
  if (paise == null) return '—';
  const rupees = Number(paise) / 100;
  if (Math.abs(rupees) >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (Math.abs(rupees) >= 100_000)    return `₹${(rupees / 100_000).toFixed(2)}L`;
  if (Math.abs(rupees) >= 1_000)      return `₹${(rupees / 1_000).toFixed(1)}k`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
function fmtMonth(yyyymm) {
  if (!yyyymm) return '—';
  const [y, m] = yyyymm.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
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
function colorToAccent(hex) {
  return ({
    '#3622FF': 'primary', '#16A34A': 'success', '#0891B2': 'teal',
    '#F59E0B': 'warning', '#7C3AED': 'violet',  '#E11D48': 'danger',
    '#0EA5E9': 'sky',
  })[hex] || 'primary';
}
function sumPaise(rows) {
  return (rows || []).reduce((s, r) => s + Number(r.total_paise || 0), 0);
}

// ─── KPI render helper ──────────────────────────────────────────────────
function renderKpi({ label, value, sub, format, icon, color, highlight, onClick, selected }) {
  return (
    <KpiTile
      label={label}
      value={value}
      sub={sub}
      format={format}
      icon={icon}
      accent={colorToAccent(color)}
      highlight={highlight}
      selected={selected}
      onClick={onClick}
    />
  );
}

// ─── Tooltip primitives ─────────────────────────────────────────────────
function TipBox({ active, payload, label, color }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const p = payload[0].payload;
  const isPaise = p && 'total_paise' in p;
  return (
    <div className="insights-tip">
      {label && <div className="tip-title">{label}</div>}
      <div className="tip-row">
        <span className="tip-dot" style={{ background: color || payload[0].color || payload[0].fill }} />
        <span className="tip-num">
          {isPaise ? fmtPaise(v) : Number(v).toLocaleString('en-IN')}
        </span>
      </div>
      {p?.transaction_count != null && (
        <div className="tip-row" style={{ marginTop: 2, opacity: .75, fontSize: 11 }}>
          <span>{p.transaction_count} txns</span>
        </div>
      )}
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

// ─── Revenue-per-month chart (bar) ──────────────────────────────────────
function RevenueChart({ rows, color, kind }) {
  const data = useMemo(() => (rows || []).map((r) => ({
    month: r.month,
    total_paise: Number(r.total_paise || 0),
    transaction_count: Number(r.transaction_count || 0),
    label: fmtMonth(r.month),
    // Rupees value drives the bar height; paise stays on the row so the
    // tooltip can format it consistently with the rest of the surface.
    n: Number(r.total_paise || 0) / 100,
  })), [rows]);

  const total = sumPaise(rows);
  const peak  = data.reduce((m, r) => (r.n > m.n ? r : m), { n: -1, label: '—' });

  return (
    <ChartFrame
      title="Revenue per month"
      subtitle={data.length > 0
        ? `${fmtPaiseCompact(total)} total · peak ${fmtPaiseCompact((peak.total_paise ?? 0))} in ${peak.label}`
        : 'no revenue in range'}
      empty={data.every((d) => d.n === 0)}
      emptyText="No revenue recorded yet."
    >
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'area' ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="area-treasurer-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtPaiseCompact(v * 100)} />
              <Tooltip content={<TipBox color={color} />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="n" stroke={color} strokeWidth={2}
                fill="url(#area-treasurer-revenue)"
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
                isAnimationActive animationDuration={650} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="bar-treasurer-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtPaiseCompact(v * 100)} />
              <Tooltip content={<TipBox color={color} />} cursor={{ fill: 'rgba(54,34,255,.04)' }} />
              <Bar dataKey="n" fill="url(#bar-treasurer-revenue)" radius={[6, 6, 0, 0]}
                isAnimationActive animationDuration={650} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ─── Transaction-volume chart ───────────────────────────────────────────
function TransactionsChart({ rows, color }) {
  const data = useMemo(() => (rows || []).map((r) => ({
    month: r.month,
    n: Number(r.transaction_count || 0),
    label: fmtMonth(r.month),
  })), [rows]);
  const total = data.reduce((s, r) => s + r.n, 0);
  const peak  = data.reduce((m, r) => (r.n > m.n ? r : m), { n: -1, label: '—' });

  return (
    <ChartFrame
      title="Transaction volume"
      subtitle={data.length > 0
        ? `${total.toLocaleString('en-IN')} txns · peak ${peak.n} in ${peak.label}`
        : 'no transactions yet'}
      empty={data.every((d) => d.n === 0)}
      emptyText="No transactions recorded yet."
    >
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="area-treasurer-txns" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<TipBox color={color} />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="n" stroke={color} strokeWidth={2}
              fill="url(#area-treasurer-txns)"
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
              isAnimationActive animationDuration={650} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ─── Approval-mix donut (refunds / bills / IUTs / CABF) ─────────────────
function ApprovalMixDonut({ counts }) {
  const data = useMemo(() => {
    const c = counts || {};
    const rows = [
      { name: 'Refunds',     value: Number(c.refunds ?? 0),  fill: '#E11D48' },
      { name: 'Bills',       value: Number(c.bills ?? 0),    fill: '#F59E0B' },
      { name: 'IUTs',        value: Number(c.iuts ?? 0),     fill: '#0891B2' },
      { name: 'CABF',        value: Number(c.cabf ?? 0),     fill: '#7C3AED' },
    ];
    return rows.filter((r) => r.value > 0);
  }, [counts]);

  const total = data.reduce((s, r) => s + r.value, 0);

  return (
    <ChartFrame title="Decisions by kind" subtitle="pending items awaiting you" empty={data.length === 0} emptyText="Nothing waiting on you. 🎉">
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
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: 'var(--muted-foreground)', marginTop: 4 }}>pending</div>
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

// ─── Sortable table primitive (used by refunds / bills / IUTs) ──────────
function SortableTable({ title, subtitle, rows, columns, exportName, exportCols, onRowClick, emptyText }) {
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? null);
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...(rows || [])].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === 'asc' ? -1 : 1;
      if (bv == null) return sortDir === 'asc' ?  1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      // Date columns come through as ISO strings
      const ad = Date.parse(av); const bd = Date.parse(bv);
      if (!Number.isNaN(ad) && !Number.isNaN(bd)) return sortDir === 'asc' ? ad - bd : bd - ad;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">{title}</div>
          <div className="insight-frame-subtitle">{sorted.length === 0 ? subtitle : `${sorted.length} ${subtitle}`}</div>
        </div>
        {sorted.length > 0 && exportName && (
          <button
            className="iframe-btn"
            onClick={() => downloadCsv(exportName, sorted, exportCols)}
          >{Lu.Download} CSV</button>
        )}
      </div>
      {sorted.length === 0 ? (
        <div className="approval-empty">{emptyText || 'Nothing waiting on you. 🎉'}</div>
      ) : (
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <table className="insight-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={[c.num ? 'num' : '', 'sortable'].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (sortKey === c.key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(c.key); setSortDir('desc'); }
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {Lu.ArrowUpDown}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.id ?? i}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.num ? 'num' : ''}>
                      {c.render ? c.render(r) : (r[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Finance inbox (mirrors admin/home inbox with a table-of-approvals feel) ─
function FinanceInboxCard({ inbox }) {
  const rows = inbox || [];
  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">Decisions waiting on you</div>
          <div className="insight-frame-subtitle">{rows.length} pending across refunds, bills, IUTs, checklists</div>
        </div>
        <span className="queue-badge">queue</span>
      </div>
      {rows.length === 0 ? (
        <div className="approval-empty">Branch finances are up to date. 🎉</div>
      ) : (
        <div className="approvals-queue">
          {rows.map((r) => (
            <button
              key={r.id}
              className="approval-row"
              onClick={() => navigate(r.action_href)}
            >
              <div style={{ minWidth: 0 }}>
                <div className="ar-title">{r.title}</div>
                <div className="ar-meta">
                  {r.subtitle ? `${r.subtitle} · ` : ''}waiting {fmtAge(r.pending_since)}
                </div>
              </div>
              <span className="ar-arrow"><IconArrowRight size="sm" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Budget vs actuals card ───────────────────────────────────────────────
function BudgetVsActualsCard({ rollup }) {
  if (!rollup) {
    return (
      <ChartFrame title="Budget vs actuals" empty emptyText="Loading budget rollup…"><div /></ChartFrame>
    );
  }
  const rows = rollup.rows || [];
  const totals = rollup.totals || {};
  const util = totals.utilisation;
  const over = util != null && util > 1;

  if (rows.length === 0) {
    return (
      <ChartFrame title="Budget vs actuals" subtitle={`FY ${rollup.fy_start_year}-${String(((rollup.fy_start_year || 0) + 1) % 100).padStart(2, '0')}`}
        empty emptyText={"No budget planned for this FY yet. Open /admin/budgets to add one."}>
        <div />
      </ChartFrame>
    );
  }

  // Top 5 rows by planned amount, so the widget stays readable regardless
  // of how many budget lines the treasurer has planned.
  const top = [...rows].sort((a, b) => b.planned_paise - a.planned_paise).slice(0, 5);

  return (
    <ChartFrame
      title="Budget vs actuals"
      subtitle={`FY ${rollup.fy_start_year}-${String(((rollup.fy_start_year || 0) + 1) % 100).padStart(2, '0')} · ${fmtPaiseCompact(totals.actual_paise)} of ${fmtPaiseCompact(totals.planned_paise)} spent${util != null ? ` (${Math.round(util * 100)}%)` : ''}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', padding: '.25rem 0' }}>
        {/* Overall bar */}
        <div style={{ padding: '.35rem .5rem .5rem', borderRadius: '.35rem', background: over ? 'oklch(0.97 0.02 25)' : 'oklch(0.97 0.02 145)' }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--muted-foreground)' }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Overall</span>
            <span style={{ color: over ? 'var(--destructive)' : 'oklch(0.45 0.15 145)', fontWeight: 700 }}>
              {util == null ? '—' : `${Math.round(util * 100)}%`}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'oklch(0.92 0 0)', overflow: 'hidden', marginTop: '.35rem' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (util || 0) * 100)}%`,
              background: over ? 'linear-gradient(90deg, #F59E0B, #E11D48)' : 'linear-gradient(90deg, #16A34A, #0891B2)',
            }} />
          </div>
        </div>

        {top.map((r) => {
          const u = r.utilisation;
          const rowOver = u != null && u > 1;
          return (
            <div key={`${r.committee_id ?? '_'}::${r.category_id}`}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: '.75rem' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>{r.category_label}</strong>
                  {r.committee_name && <span className="muted-text"> · {r.committee_name}</span>}
                </span>
                <span className="muted-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPaiseCompact(r.actual_paise)} / {fmtPaiseCompact(r.planned_paise)}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: 'oklch(0.94 0 0)', overflow: 'hidden', marginTop: '.2rem' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (u || 0) * 100)}%`,
                  background: rowOver ? '#E11D48' : '#16A34A',
                }} />
              </div>
            </div>
          );
        })}

        {rows.length > 5 && (
          <a href="/admin/budgets" style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600, textAlign: 'right', textDecoration: 'none' }}>
            View all {rows.length} lines →
          </a>
        )}
      </div>
    </ChartFrame>
  );
}

// ─── Cash-flow forecast card ──────────────────────────────────────────────
function CashFlowCard({ cash }) {
  if (!cash) {
    return <ChartFrame title="Cash-flow forecast · 30 days" empty emptyText="Loading…"><div /></ChartFrame>;
  }
  const outflow = cash.committed_outflow_paise || 0;
  const inflow = cash.expected_inflow_paise || 0;
  const net = inflow - outflow;
  const positive = net >= 0;
  return (
    <ChartFrame
      title="Cash-flow forecast · 30 days"
      subtitle={`Approved bills unpaid + expected event fee inflows in the next ${cash.forecast_window_days || 30} days`}
    >
      <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: '1fr 1fr', padding: '.5rem 0' }}>
        <div style={{ padding: '.75rem', borderRadius: '.5rem', background: 'oklch(0.97 0.02 25)', border: '1px solid oklch(0.90 0.05 25)' }}>
          <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'oklch(0.45 0.20 25)' }}>Committed outflow</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'oklch(0.45 0.20 25)', marginTop: '.2rem', fontVariantNumeric: 'tabular-nums' }}>{fmtPaiseCompact(outflow)}</div>
          <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>{cash.committed_bill_count || 0} approved {cash.committed_bill_count === 1 ? 'bill' : 'bills'}</div>
        </div>
        <div style={{ padding: '.75rem', borderRadius: '.5rem', background: 'oklch(0.97 0.02 145)', border: '1px solid oklch(0.90 0.05 145)' }}>
          <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'oklch(0.35 0.14 145)' }}>Expected inflow</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'oklch(0.35 0.14 145)', marginTop: '.2rem', fontVariantNumeric: 'tabular-nums' }}>{fmtPaiseCompact(inflow)}</div>
          <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>{cash.expected_registrations || 0} registrations on upcoming events</div>
        </div>
      </div>
      <div style={{
        marginTop: '.5rem', padding: '.7rem 1rem',
        borderRadius: '.5rem',
        background: positive ? 'oklch(0.95 0.03 145)' : 'oklch(0.95 0.03 25)',
        border: `1px solid ${positive ? 'oklch(0.85 0.05 145)' : 'oklch(0.85 0.05 25)'}`,
      }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '.8125rem', fontWeight: 700 }}>Net position</span>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: positive ? 'oklch(0.35 0.14 145)' : 'oklch(0.45 0.20 25)', fontVariantNumeric: 'tabular-nums' }}>
            {net >= 0 ? '+' : ''}{fmtPaiseCompact(net)}
          </span>
        </div>
        <p className="muted-text" style={{ fontSize: '.7rem', margin: '.15rem 0 0' }}>
          {positive
            ? 'Expected income exceeds committed outflows in the next 30 days.'
            : 'Committed outflows exceed expected inflows — plan cash reserves.'}
        </p>
      </div>
    </ChartFrame>
  );
}

// ─── YTD vs LY card ───────────────────────────────────────────────────────
function YtdVsLyCard({ ytd }) {
  if (!ytd) return <ChartFrame title="YTD vs last year" empty emptyText="Loading…"><div /></ChartFrame>;
  function delta(cur, prev) {
    if (prev === 0) return cur === 0 ? { pct: null, direction: 'flat' } : { pct: null, direction: 'up' };
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return { pct, direction: pct >= 0 ? 'up' : 'down' };
  }
  const rev = delta(ytd.revenue.current_paise, ytd.revenue.last_year_paise);
  const exp = delta(ytd.expense.current_paise, ytd.expense.last_year_paise);
  return (
    <ChartFrame title="YTD vs last year" subtitle="Same window (Apr 1 to today) compared year-on-year">
      <div style={{ display: 'grid', gap: '.75rem', padding: '.5rem 0' }}>
        <MetricRow
          label="Revenue"
          value={fmtPaiseCompact(ytd.revenue.current_paise)}
          prev={fmtPaiseCompact(ytd.revenue.last_year_paise)}
          delta={rev}
          betterWhen="up"
        />
        <MetricRow
          label="Expense"
          value={fmtPaiseCompact(ytd.expense.current_paise)}
          prev={fmtPaiseCompact(ytd.expense.last_year_paise)}
          delta={exp}
          betterWhen="down"
        />
      </div>
    </ChartFrame>
  );
}

function MetricRow({ label, value, prev, delta, betterWhen }) {
  const isGood = delta.direction === 'flat'
    ? true
    : (betterWhen === 'up' ? delta.direction === 'up' : delta.direction === 'down');
  const color = delta.direction === 'flat'
    ? 'var(--muted-foreground)'
    : (isGood ? 'oklch(0.45 0.15 145)' : 'oklch(0.45 0.20 25)');
  const arrow = delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '–';
  return (
    <div style={{ padding: '.6rem .8rem', border: '1px solid var(--border)', borderRadius: '.5rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '.8125rem', fontWeight: 600 }}>{label}</span>
        {delta.pct != null && (
          <span style={{ fontSize: '.75rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
            {arrow} {Math.abs(delta.pct).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginTop: '.25rem' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span className="muted-text" style={{ fontSize: '.75rem' }}>vs {prev} last year</span>
      </div>
    </div>
  );
}

// ─── Expense-by-category donut ────────────────────────────────────────────
function ExpenseByCategoryDonut({ rows }) {
  const data = useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((r) => Number(r.total_paise || 0) > 0)
      .map((r, i) => ({
        name: r.label || 'Uncategorised',
        value: Number(r.total_paise || 0) / 100, // rupees for the tooltip
        paise: Number(r.total_paise || 0),
        fill: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      }))
      .sort((a, b) => b.paise - a.paise);
  }, [rows]);
  const total = data.reduce((s, d) => s + d.paise, 0);
  return (
    <ChartFrame
      title="Expenses by category · YTD"
      subtitle={data.length === 0 ? 'no approved bills yet' : `${fmtPaiseCompact(total)} across ${data.length} categories`}
      empty={data.length === 0}
      emptyText="No approved bills in this FY yet."
    >
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
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtPaiseCompact(total)}</div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: 'var(--muted-foreground)', marginTop: 4 }}>total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem .65rem', marginTop: '.5rem' }}>
        {data.slice(0, 6).map((d) => (
          <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.fill }} />
            {d.name} · {fmtPaiseCompact(d.paise)}
          </span>
        ))}
      </div>
    </ChartFrame>
  );
}

// ─── MIS export card ──────────────────────────────────────────────────────
function MisExportCard() {
  // Default to the previous month, since that's what a chairman-facing MIS
  // usually reports on (current month is still in flight).
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const defaultMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const label = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <ChartFrame title="Monthly MIS export" subtitle="One-click CSV summary for chairman review meetings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', padding: '.5rem 0' }}>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Month</div>
          <input type="month" className="input-base" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <p className="muted-text" style={{ fontSize: '.75rem', margin: 0 }}>
          The export bundles revenue + expense totals + per-category spend for <strong>{label}</strong>.
        </p>
        <a
          className="btn btn-primary"
          href={`/api/admin/treasurer-analytics/mis-export?month=${encodeURIComponent(month)}`}
          style={{ justifyContent: 'center' }}
        >
          {Lu.Download} Download {label} MIS
        </a>
      </div>
    </ChartFrame>
  );
}

// ─── Registry ────────────────────────────────────────────────────────────
// Same schema as the chairman WIDGET_REGISTRY. All ids are prefixed `t_`
// so a user's persisted layout can hold both surfaces without ID collisions.
export const TREASURER_WIDGET_REGISTRY = [
  // ─── KPIs ───────────────────────────────────────────────────────────
  {
    id: 't_kpi_revenue_month', title: 'Revenue · this month',
    description: 'Successful payments captured in the current calendar month.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Revenue · month', value: data?.stats?.revenue_month_paise ?? 0,
      format: (n) => fmtPaiseCompact(n),
      sub: 'successful payments only', color: '#16A34A', icon: Lu.IndianRupee,
    }),
  },
  {
    id: 't_kpi_revenue_12mo', title: 'Revenue · trailing 12 months',
    description: 'Total across the last 12 calendar months.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Revenue · 12mo', value: sumPaise(data?.lists?.revenue_by_month),
      format: (n) => fmtPaiseCompact(n),
      sub: 'trailing 12 months', color: '#3622FF', icon: Lu.TrendingUp,
    }),
  },
  {
    id: 't_kpi_refunds_pending', title: 'Refunds pending',
    description: 'Payment refund requests awaiting your approval.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => renderKpi({
      label: 'Refunds pending', value: data?.stats?.refunds_pending ?? 0,
      sub: 'awaiting review', color: '#E11D48', icon: Lu.RotateCcw,
      highlight: (data?.stats?.refunds_pending ?? 0) > 0,
      onClick: () => ctx.setDrill('refunds'),
      selected: ctx.drill === 'refunds',
    }),
  },
  {
    id: 't_kpi_bills_pending', title: 'Bills awaiting approval',
    description: 'Vendor bills submitted by accountant, awaiting your sign-off.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => renderKpi({
      label: 'Bills · approval', value: data?.stats?.bills_pending_approval ?? 0,
      sub: 'submitted, unpaid', color: '#F59E0B', icon: Lu.Receipt,
      highlight: (data?.stats?.bills_pending_approval ?? 0) > 0,
      onClick: () => ctx.setDrill('bills'),
      selected: ctx.drill === 'bills',
    }),
  },
  {
    id: 't_kpi_iuts_pending', title: 'IUT transfers pending',
    description: 'Inter-unit transfer requests awaiting your approval.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => {
      const iuts = data?.lists?.pending_iuts ?? [];
      return renderKpi({
        label: 'IUTs pending', value: iuts.length,
        sub: 'requested, un-approved', color: '#0891B2', icon: Lu.ArrowLeftRight,
        highlight: iuts.length > 0,
        onClick: () => ctx.setDrill('iuts'),
        selected: ctx.drill === 'iuts',
      });
    },
  },
  {
    id: 't_kpi_cabf_month', title: 'CABF receipts · this month',
    description: 'Contributions received into the Chartered Accountants Benevolent Fund.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'CABF · month', value: data?.stats?.cabf_receipts_month_paise ?? 0,
      format: (n) => fmtPaiseCompact(n),
      sub: `${data?.stats?.cabf_receipts_month_count ?? 0} receipts`,
      color: '#7C3AED', icon: Lu.Heart,
    }),
  },
  {
    id: 't_kpi_cabf_requests', title: 'CABF requests pending',
    description: 'Assistance requests awaiting review or disbursement.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data, ctx }) => renderKpi({
      label: 'CABF requests', value: data?.stats?.cabf_requests_pending ?? 0,
      sub: 'review + disbursement', color: '#7C3AED', icon: Lu.AlertTriangle,
      highlight: (data?.stats?.cabf_requests_pending ?? 0) > 0,
      onClick: () => ctx.setDrill('cabf'),
      selected: ctx.drill === 'cabf',
    }),
  },
  {
    id: 't_kpi_inbox_total', title: 'Decisions in inbox',
    description: 'Total items currently waiting on you across all queues.',
    group: 'KPI', defaultSize: 'sm', allowedSizes: ['sm', 'md'],
    render: ({ data }) => renderKpi({
      label: 'Inbox total', value: data?.stats?.inbox_count ?? (data?.inbox?.length ?? 0),
      sub: 'across all queues', color: '#3622FF', icon: Lu.Inbox,
    }),
  },

  // ─── Trend charts ────────────────────────────────────────────────────
  {
    id: 't_chart_revenue_per_month', title: 'Revenue per month',
    description: 'Bar chart of successful payments per calendar month.',
    group: 'Trend', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <RevenueChart rows={data?.lists?.revenue_by_month} color="#16A34A" kind="bar" />
    ),
  },
  {
    id: 't_chart_revenue_area', title: 'Revenue — area view',
    description: 'Area chart alternative for the same 12-month series.',
    group: 'Trend', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <RevenueChart rows={data?.lists?.revenue_by_month} color="#3622FF" kind="area" />
    ),
  },
  {
    id: 't_chart_transactions_per_month', title: 'Transactions per month',
    description: 'Number of successful payments per month.',
    group: 'Trend', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <TransactionsChart rows={data?.lists?.revenue_by_month} color="#0891B2" />
    ),
  },

  // ─── Composition ─────────────────────────────────────────────────────
  {
    id: 't_chart_approval_mix', title: 'Pending decisions by kind',
    description: 'Donut split of refunds / bills / IUTs / CABF awaiting you.',
    group: 'Composition', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <ApprovalMixDonut counts={{
        refunds: data?.stats?.refunds_pending ?? 0,
        bills:   data?.stats?.bills_pending_approval ?? 0,
        iuts:    (data?.lists?.pending_iuts ?? []).length,
        cabf:    data?.stats?.cabf_requests_pending ?? 0,
      }} />
    ),
  },

  // ─── Activity ────────────────────────────────────────────────────────
  {
    id: 't_card_finance_inbox', title: 'Finance inbox',
    description: 'Tap-through queue of everything waiting on the treasurer.',
    group: 'Activity', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <FinanceInboxCard inbox={data?.inbox} />,
  },
  {
    id: 't_table_pending_refunds', title: 'Refund requests table',
    description: 'Sortable list of refund requests currently pending.',
    group: 'Activity', defaultSize: 'lg', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <SortableTable
        title="Refunds pending"
        subtitle="awaiting review"
        rows={data?.lists?.pending_refunds || []}
        emptyText="No refund requests waiting."
        onRowClick={(r) => navigate(`/admin/refunds?id=${r.id}`)}
        exportName="refunds-pending.csv"
        exportCols={['id', 'payer_name', 'amount_paise', 'reason', 'requested_at']}
        columns={[
          { key: 'payer_name',   label: 'Payer',   render: (r) => r.payer_name || '—' },
          { key: 'amount_paise', label: 'Amount',  num: true, render: (r) => fmtPaise(r.amount_paise) },
          { key: 'reason',       label: 'Reason',  render: (r) => (
              <span style={{
                display: 'inline-block', maxWidth: 220,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }} title={r.reason || ''}>{r.reason || '—'}</span>
            ) },
          { key: 'requested_at', label: 'Requested', num: true, render: (r) => (
              <span style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.requested_at)}</span>
            ) },
        ]}
      />
    ),
  },
  {
    id: 't_table_pending_bills', title: 'Bills table',
    description: 'Sortable list of vendor bills submitted for approval.',
    group: 'Activity', defaultSize: 'lg', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <SortableTable
        title="Bills awaiting approval"
        subtitle="submitted, unpaid"
        rows={data?.lists?.pending_bills || []}
        emptyText="No bills waiting on your approval."
        onRowClick={(r) => navigate(`/admin/bills?id=${r.id}`)}
        exportName="bills-pending.csv"
        exportCols={['id', 'vendor_name', 'description', 'amount_paise', 'bill_date', 'status', 'submitted_at']}
        columns={[
          { key: 'vendor_name',  label: 'Vendor',  render: (r) => <span style={{ fontWeight: 500 }}>{r.vendor_name}</span> },
          { key: 'description',  label: 'Description', render: (r) => (
              <span style={{
                display: 'inline-block', maxWidth: 260,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                verticalAlign: 'bottom', color: 'var(--muted-foreground)',
              }} title={r.description || ''}>{r.description || '—'}</span>
            ) },
          { key: 'amount_paise', label: 'Amount',  num: true, render: (r) => fmtPaise(r.amount_paise) },
          { key: 'bill_date',    label: 'Bill date', num: true, render: (r) => (
              <span style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.bill_date)}</span>
            ) },
        ]}
      />
    ),
  },
  // ─── Budget vs actuals ───────────────────────────────────────────────
  {
    id: 't_widget_budget_vs_actuals',
    title: 'Budget vs actuals',
    description: 'Planned FY spend vs approved+paid bills to date, by committee × category.',
    group: 'Composition', defaultSize: 'lg', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <BudgetVsActualsCard rollup={data?.analytics?.budget_rollup} />,
  },

  // ─── Cash-flow forecast ──────────────────────────────────────────────
  {
    id: 't_widget_cash_flow',
    title: 'Cash-flow forecast · 30 days',
    description: 'Committed outflows (approved bills) vs expected inflows (upcoming event fees).',
    group: 'KPI', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <CashFlowCard cash={data?.analytics?.cash_flow} />,
  },

  // ─── YTD vs LY ───────────────────────────────────────────────────────
  {
    id: 't_widget_ytd_vs_ly',
    title: 'YTD vs last year',
    description: 'Revenue + expense this financial year vs the same window last year.',
    group: 'Trend', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <YtdVsLyCard ytd={data?.analytics?.ytd_vs_ly} />,
  },

  // ─── Expense by category ─────────────────────────────────────────────
  {
    id: 't_widget_expense_by_category',
    title: 'Expenses by category · YTD',
    description: 'Donut of approved+paid bills grouped by expense category this FY.',
    group: 'Composition', defaultSize: 'md', allowedSizes: ['md', 'lg'],
    render: ({ data }) => <ExpenseByCategoryDonut rows={data?.analytics?.expenses_by_category} />,
  },

  // ─── Monthly MIS export ──────────────────────────────────────────────
  {
    id: 't_widget_mis_export',
    title: 'Monthly MIS export',
    description: 'One-click download of the current month\'s revenue + expense + category summary as CSV.',
    group: 'Activity', defaultSize: 'md', allowedSizes: ['sm', 'md'],
    render: () => <MisExportCard />,
  },

  {
    id: 't_table_pending_iuts', title: 'IUT transfers table',
    description: 'Sortable list of inter-unit transfer requests.',
    group: 'Activity', defaultSize: 'lg', allowedSizes: ['md', 'lg'],
    render: ({ data }) => (
      <SortableTable
        title="IUT transfers pending"
        subtitle="requested, un-approved"
        rows={data?.lists?.pending_iuts || []}
        emptyText="No inter-unit transfers pending."
        onRowClick={(r) => navigate(`/admin/iut-transfers?id=${r.id}`)}
        exportName="iuts-pending.csv"
        exportCols={['id', 'from_account', 'to_account', 'amount_paise', 'purpose', 'transfer_date', 'requested_at']}
        columns={[
          { key: 'from_account', label: 'From',    render: (r) => <span className="mono">{r.from_account}</span> },
          { key: 'to_account',   label: 'To',      render: (r) => <span className="mono">{r.to_account}</span> },
          { key: 'amount_paise', label: 'Amount',  num: true, render: (r) => fmtPaise(r.amount_paise) },
          { key: 'purpose',      label: 'Purpose', render: (r) => (
              <span style={{
                display: 'inline-block', maxWidth: 220,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                verticalAlign: 'bottom', color: 'var(--muted-foreground)',
              }} title={r.purpose || ''}>{r.purpose || '—'}</span>
            ) },
          { key: 'transfer_date', label: 'Transfer date', num: true, render: (r) => (
              <span style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.transfer_date)}</span>
            ) },
        ]}
      />
    ),
  },
];

export const TREASURER_WIDGET_BY_ID = Object.fromEntries(
  TREASURER_WIDGET_REGISTRY.map((w) => [w.id, w])
);

// Default layout — what a treasurer sees on first visit, before customising.
// Mirrors the flow of the legacy TreasurerHome (inbox → stats → chart → tables)
// so existing users don't lose their bearings.
export const DEFAULT_TREASURER_LAYOUT = [
  { id: 't_kpi_revenue_month',       size: 'sm' },
  { id: 't_kpi_revenue_12mo',        size: 'sm' },
  { id: 't_kpi_refunds_pending',     size: 'sm' },
  { id: 't_kpi_bills_pending',       size: 'sm' },
  { id: 't_kpi_iuts_pending',        size: 'sm' },
  { id: 't_kpi_cabf_month',          size: 'sm' },
  { id: 't_kpi_cabf_requests',       size: 'sm' },
  { id: 't_kpi_inbox_total',         size: 'sm' },
  { id: 't_widget_cash_flow',        size: 'md' },
  { id: 't_widget_ytd_vs_ly',        size: 'md' },
  { id: 't_chart_revenue_per_month', size: 'md' },
  { id: 't_chart_transactions_per_month', size: 'md' },
  { id: 't_widget_budget_vs_actuals', size: 'lg' },
  { id: 't_widget_expense_by_category', size: 'md' },
  { id: 't_chart_approval_mix',      size: 'md' },
  { id: 't_card_finance_inbox',      size: 'md' },
  { id: 't_widget_mis_export',       size: 'md' },
  { id: 't_table_pending_refunds',   size: 'lg' },
  { id: 't_table_pending_bills',     size: 'lg' },
  { id: 't_table_pending_iuts',      size: 'lg' },
];
