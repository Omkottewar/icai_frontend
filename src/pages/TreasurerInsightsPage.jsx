import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { useAdminHome } from '../hooks/useAdminHome';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useUrlState } from '../components/dashboard/insights/useUrlState';
import { navigate } from '../hooks/useRoute';
import { cachedGet, revalidate } from '../lib/apiCache';

import InsightsStyles from '../components/dashboard/insights/insightsStyles';
import { ShimmerPageBody, Shimmer } from '../components/ui/Shimmer';
import { dialog } from '../lib/dialog';
import {
  TREASURER_WIDGET_REGISTRY,
  TREASURER_WIDGET_BY_ID,
  DEFAULT_TREASURER_LAYOUT,
} from '../components/dashboard/insights/widgets/treasurerRegistry';
import WidgetGrid from '../components/dashboard/insights/widgets/WidgetGrid';
import { CustomizeButton, EditToolbar } from '../components/dashboard/insights/widgets/EditControls';

// Mirror of BranchMetricsPage — same visual chrome, tabs, filter rail,
// customize/edit mode, live pill, share/refresh — but the data source is
// /api/admin/home (treasurer variant) and the widget catalogue is the
// finance-specific one from `treasurerRegistry`.

// ─── tiny inline lucide icons (topbar) ──────────────────────────────────
const I = ({ children }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const Lu = {
  Share:     <I><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" /></I>,
  RefreshCw: <I><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></I>,
  Check:     <I><path d="M20 6 9 17l-5-5" /></I>,
  X:         <I><path d="M18 6 6 18M6 6l12 12" /></I>,
  Download:  <I><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></I>,
};

// ─── formatting ─────────────────────────────────────────────────────────
const FMT_TIME = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });
const FMT_DATE = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const FMT_INR  = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function fmtDate(iso) { return iso ? FMT_DATE.format(new Date(iso)) : '—'; }
function fmtPaise(p) { return p == null ? '—' : FMT_INR.format(Number(p) / 100); }
function fmtAge(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  return `${Math.max(1, hours)}h`;
}
function liveAgeSec(updatedAt) {
  if (!updatedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
}

// ─── FY helpers ─────────────────────────────────────────────────────────
// Indian fiscal year: Apr 1 – Mar 31. We derive labels client-side so the
// FY selector can list the last 3 FYs without a round-trip.
function currentFyStartYear(now = new Date()) {
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}
function fyLabel(startYear) {
  const end = String((startYear + 1) % 100).padStart(2, '0');
  return `FY ${startYear}-${end}`;
}
function fyBounds(startYear) {
  return {
    start: new Date(Date.UTC(startYear, 3, 1)),         // Apr 1 UTC
    end:   new Date(Date.UTC(startYear + 1, 3, 1)),     // next Apr 1 UTC
  };
}

// ─── tab groups (widget.group → tab label) ──────────────────────────────
const WIDGET_GROUPS = [
  ['KPI',         'KPIs'],
  ['Trend',       'Trends'],
  ['Composition', 'Composition'],
  ['Activity',    'Queues'],
];

const KNOWN_WIDGET_IDS = TREASURER_WIDGET_REGISTRY.map((w) => w.id);

// ═══════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════
export default function TreasurerInsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isTreasurer, isAdmin } = useRoleFlags();

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user]);

  // URL-persisted filters — user can share a link that lands on the same view.
  const currentFy = currentFyStartYear();
  const [url, setUrl] = useUrlState({ fy: String(currentFy), drill: '' });

  // Data — /api/admin/home already returns the treasurer variant when the
  // caller is a branch_treasurer. Filters below are applied client-side.
  const { data: rawData, loading, error, refresh } = useAdminHome();
  const [fetching, setFetching] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => { if (rawData) setUpdatedAt(Date.now()); }, [rawData]);

  // Analytics endpoint powers the budget/cash-flow/YTD widgets. Kept as a
  // separate fetch (rather than folded into /api/admin/home) because it
  // does heavier joins and only the treasurer insights page needs it.
  const [analytics, setAnalytics] = useState(null);
  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/admin/treasurer-analytics', null, 60_000)
      .then((j) => { if (!cancelled) setAnalytics(j); })
      .catch(() => { if (!cancelled) setAnalytics(null); });
    return () => { cancelled = true; };
  }, []);

  // Budget rollup for the currently-selected FY (defaults to current FY).
  const [budgetRollup, setBudgetRollup] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const fy = Number(url.fy) || currentFyStartYear();
    cachedGet('/api/admin/budgets/rollup', { fy }, 60_000)
      .then((j) => { if (!cancelled) setBudgetRollup(j); })
      .catch(() => { if (!cancelled) setBudgetRollup(null); });
    return () => { cancelled = true; };
  }, [url.fy]);

  // Apply FY filter client-side to the revenue series + splice analytics
  // into the render args so widgets can read `data.analytics.*`.
  const data = useMemo(() => {
    if (!rawData) return null;
    const fyStart = Number(url.fy) || currentFyStartYear();
    const { start, end } = fyBounds(fyStart);
    const rev = (rawData?.lists?.revenue_by_month ?? []).filter((r) => {
      if (!r?.month) return false;
      const [y, m] = r.month.split('-');
      const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
      return d >= start && d < end;
    });
    return {
      ...rawData,
      lists: {
        ...(rawData?.lists ?? {}),
        revenue_by_month: rev,
      },
      analytics: {
        cash_flow:            analytics?.cash_flow,
        ytd_vs_ly:            analytics?.ytd_vs_ly,
        expenses_by_category: analytics?.expenses_by_category,
        budget_rollup:        budgetRollup,
      },
    };
  }, [rawData, url.fy, analytics, budgetRollup]);

  // Per-user layout — namespaced to the 'treasurer' scope so it doesn't
  // collide with the chairman's saved layout for the same user.
  const {
    layout, isEditing, loading: layoutLoading, saving,
    startEditing, cancelEditing, editLayout, save, reset,
  } = useDashboardLayout({
    defaultLayout: DEFAULT_TREASURER_LAYOUT,
    knownIds: KNOWN_WIDGET_IDS,
    scope: 'treasurer',
  });

  // Track the persisted layout so we can enable Save only when dirty.
  const [snapshotJson, setSnapshotJson] = useState(null);
  useEffect(() => {
    if (!isEditing && !layoutLoading) setSnapshotJson(JSON.stringify(layout));
  }, [isEditing, layoutLoading, layout]);
  const isDirty = isEditing && snapshotJson !== null && JSON.stringify(layout) !== snapshotJson;

  // Tabs slice the dashboard into one group per widget category so the
  // treasurer picks a lens and sees only that. Edit mode drops the tabs so
  // drag/resize/add operate across the whole layout in one place.
  const [activeTab, setActiveTab] = useState(null);
  const tabsInLayout = useMemo(() => {
    const present = new Set(layout.map((it) => TREASURER_WIDGET_BY_ID[it.id]?.group).filter(Boolean));
    return WIDGET_GROUPS.filter(([g]) => present.has(g));
  }, [layout]);
  const activeGroup =
    activeTab && tabsInLayout.some(([g]) => g === activeTab)
      ? activeTab
      : (tabsInLayout[0]?.[0] ?? null);
  const showTabs = !isEditing && tabsInLayout.length > 1;
  const visibleLayout = showTabs
    ? layout.filter((it) => TREASURER_WIDGET_BY_ID[it.id]?.group === activeGroup)
    : layout;

  // Tick per second for the "Live · Ns ago" pill; poll every 60s.
  const [, setTick] = useState(0);
  useEffect(() => {
    const tickInt = setInterval(() => setTick((t) => t + 1), 1_000);
    const pollInt = setInterval(() => { doRefresh(); }, 60_000);
    return () => { clearInterval(tickInt); clearInterval(pollInt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doRefresh() {
    setFetching(true);
    try {
      const fy = Number(url.fy) || currentFyStartYear();
      const [_, freshAnalytics, freshRollup] = await Promise.all([
        refresh(),
        revalidate('/api/admin/treasurer-analytics', null, 60_000).catch(() => null),
        revalidate('/api/admin/budgets/rollup', { fy }, 60_000).catch(() => null),
      ]);
      if (freshAnalytics) setAnalytics(freshAnalytics);
      if (freshRollup) setBudgetRollup(freshRollup);
      setUpdatedAt(Date.now());
    } finally { setFetching(false); }
  }

  function resetFilters() {
    setUrl({ fy: String(currentFy), drill: '' });
  }
  function setDrill(metric) { setUrl({ drill: url.drill === metric ? '' : metric }); }

  // ─── edit-mode handlers ───────────────────────────────────────────
  function handleAddWidget(widget) {
    editLayout((current) => [...current, { id: widget.id, size: widget.defaultSize }]);
  }
  function handleRemoveWidget(idx) {
    editLayout((current) => current.filter((_, i) => i !== idx));
  }
  async function handleSave() {
    try { await save(); } catch { /* error already surfaced via hook */ }
  }
  async function handleReset() {
    const ok = await dialog.confirm({
      title: 'Restore default layout?',
      message: 'Restore the default layout? Your customisations will be lost.',
      confirmText: 'Restore',
      danger: true,
    });
    if (!ok) return;
    try { await reset(); } catch { /* error already surfaced via hook */ }
  }

  if (authLoading) {
    return <ShimmerPageBody cards={4} />;
  }
  if (!user) return null;

  if (!isTreasurer && !isAdmin) {
    return (
      <section className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h2>Forbidden</h2>
        <p className="muted-text">This dashboard is for the branch treasurer.</p>
      </section>
    );
  }

  const ageSec = liveAgeSec(updatedAt);
  const ctx = { url, setUrl, drill: url.drill, setDrill };
  const renderArgs = { data, ctx, loading: loading && !rawData };

  return (
    <div className="insights-page" data-editing={isEditing ? 'true' : 'false'}>
      <InsightsStyles />

      {isEditing && (
        <EditToolbar
          layout={layout}
          isDirty={isDirty}
          saving={saving}
          onAddWidget={handleAddWidget}
          onSave={handleSave}
          onCancel={cancelEditing}
          onReset={handleReset}
          registry={TREASURER_WIDGET_REGISTRY}
        />
      )}

      <section className="container" style={{ paddingBottom: '4rem' }}>
        {/* Sticky frosted topbar */}
        <div className="insights-topbar">
          <div className="insights-topbar-title">
            <div className="insights-topbar-logo">₹</div>
            <div>
              <h1>Branch treasurer dashboard</h1>
              <div className="insights-topbar-meta">
                Last reload {updatedAt ? FMT_TIME.format(new Date(updatedAt)) : '—'}
                {' · '}scoped to <strong>{fyLabel(Number(url.fy) || currentFy)}</strong>
                {' · '}<span className="muted-text">{layout.length} widget{layout.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div className="insights-topbar-actions">
            <LivePill fetching={fetching} ageSec={ageSec} />
            {!isEditing && <CustomizeButton onClick={startEditing} disabled={layoutLoading} />}
            <ShareButton />
            <ExportButton />
            <button className="d-btn" onClick={doRefresh} disabled={fetching}>
              <span className={fetching ? 'spin' : ''}>{Lu.RefreshCw}</span>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="insight-frame" style={{ marginBottom: '1rem' }}>
            <div className="insight-frame-body" style={{ color: 'var(--destructive)', fontSize: 12 }}>
              {error.message || "Couldn't load treasurer metrics."}
            </div>
          </div>
        )}

        <div className="insights-layout">
          <FilterRail
            url={url} setUrl={setUrl}
            currentFy={currentFy}
            onReset={resetFilters}
          />

          <div className="insights-main">
            {layoutLoading ? (
              <div aria-hidden="true" style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', padding: '.5rem 0' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Shimmer key={i} height="170px" width="100%" radius="14px" />
                ))}
              </div>
            ) : layout.length === 0 ? (
              <EmptyLayoutPrompt onStart={startEditing} />
            ) : (
              <div className="insights-tabbed">
                {showTabs && (
                  <div className="insights-tabs" role="tablist" aria-label="Treasurer dashboard sections">
                    {tabsInLayout.map(([group, label]) => {
                      const selected = group === activeGroup;
                      const count = layout.filter((it) => TREASURER_WIDGET_BY_ID[it.id]?.group === group).length;
                      return (
                        <button
                          key={group}
                          type="button"
                          role="tab"
                          id={`t-insights-tab-${group}`}
                          aria-selected={selected}
                          aria-controls="t-insights-tabpanel"
                          tabIndex={selected ? 0 : -1}
                          className={'insights-tab' + (selected ? ' is-active' : '')}
                          onClick={() => setActiveTab(group)}
                        >
                          {label}
                          <span className="insights-tab-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div
                  id="t-insights-tabpanel"
                  role={showTabs ? 'tabpanel' : undefined}
                  aria-labelledby={showTabs ? `t-insights-tab-${activeGroup}` : undefined}
                >
                  <WidgetGrid
                    layout={visibleLayout}
                    isEditing={isEditing}
                    onChange={editLayout}
                    onRemove={handleRemoveWidget}
                    renderArgs={renderArgs}
                    widgetById={TREASURER_WIDGET_BY_ID}
                  />
                </div>
              </div>
            )}

            {/* Drill panels for the interactive KPI tiles */}
            {url.drill && !isEditing && (
              <div style={{ marginTop: '1rem' }}>
                {url.drill === 'refunds' && (
                  <DrillRefunds rows={data?.lists?.pending_refunds || []} onClose={() => setUrl({ drill: '' })} />
                )}
                {url.drill === 'bills' && (
                  <DrillBills rows={data?.lists?.pending_bills || []} onClose={() => setUrl({ drill: '' })} />
                )}
                {url.drill === 'iuts' && (
                  <DrillIuts rows={data?.lists?.pending_iuts || []} onClose={() => setUrl({ drill: '' })} />
                )}
                {url.drill === 'cabf' && (
                  <DrillCabf
                    pending={data?.stats?.cabf_requests_pending ?? 0}
                    receiptsMonth={data?.stats?.cabf_receipts_month_paise ?? 0}
                    receiptsCount={data?.stats?.cabf_receipts_month_count ?? 0}
                    onClose={() => setUrl({ drill: '' })}
                  />
                )}
              </div>
            )}

            <footer className="insights-footer">
              ICAI Nagpur Branch · Treasurer analytics · data refreshes every 60s · layout saved per user
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Empty layout prompt ────────────────────────────────────────────────
function EmptyLayoutPrompt({ onStart }) {
  return (
    <div className="insight-frame" style={{ padding: '2rem', textAlign: 'center' }}>
      <h3 style={{ margin: 0 }}>Your dashboard is empty</h3>
      <p className="muted-text" style={{ marginTop: '.5rem', fontSize: 13 }}>
        You've removed every widget. Click below to start adding KPIs, charts, and queues.
      </p>
      <button className="d-btn d-btn-primary" style={{ marginTop: '1rem' }} onClick={onStart}>
        Customize dashboard
      </button>
    </div>
  );
}

// ─── Live pill ──────────────────────────────────────────────────────────
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

// ─── Filter rail — FY selector (only meaningful filter for finance today) ─
function FilterRail({ url, setUrl, currentFy, onReset }) {
  const fys = [currentFy, currentFy - 1, currentFy - 2];
  return (
    <aside className="filter-rail">
      <span className="eyebrow-pill filter-rail-eyebrow">▾ FILTERS</span>

      <div className="filter-block">
        <span className="filter-label">Financial year</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fys.map((y) => (
            <button
              key={y}
              className={'vpill' + (String(url.fy) === String(y) ? ' is-active' : '')}
              onClick={() => setUrl({ fy: String(y) })}
            >{fyLabel(y)}</button>
          ))}
        </div>
      </div>

      <div className="filter-block">
        <span className="filter-label">Shortcuts</span>
        <a className="vpill" href="/admin/exports/fy.csv">Export FY report (CSV)</a>
        <a className="vpill" href="/admin/refunds">Open refunds inbox</a>
        <a className="vpill" href="/admin/bills">Open bills inbox</a>
        <a className="vpill" href="/admin/cabf">Open CABF queue</a>
      </div>

      <button className="filter-reset" onClick={onReset}>Reset filters</button>
    </aside>
  );
}

// ─── Share (copies URL) + Export ────────────────────────────────────────
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

function ExportButton() {
  return (
    <a className="d-btn" href="/api/admin/exports/fy.csv" title="Download the consolidated FY export">
      {Lu.Download}
      Export FY
    </a>
  );
}

// ─── Drill panels ───────────────────────────────────────────────────────
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

function DrillRefunds({ rows = [], onClose }) {
  return (
    <DrillShell title="Refunds pending — quick view" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: 12, margin: 0 }}>No refunds waiting on you. 🎉</p>
      ) : (
        <div className="insights-drill-grid">
          {rows.slice(0, 12).map((r) => (
            <div key={r.id} className="insights-drill-item">
              <div style={{ minWidth: 0 }}>
                <div className="ditem-title">{r.payer_name || 'Anonymous'}</div>
                <div className="ditem-sub">{r.reason || '—'} · waiting {fmtAge(r.requested_at)}</div>
              </div>
              <div className="ditem-num">{fmtPaise(r.amount_paise)}</div>
            </div>
          ))}
        </div>
      )}
    </DrillShell>
  );
}

function DrillBills({ rows = [], onClose }) {
  return (
    <DrillShell title="Bills awaiting approval" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: 12, margin: 0 }}>No bills waiting on your approval. 🎉</p>
      ) : (
        <div className="insights-drill-grid">
          {rows.slice(0, 12).map((r) => (
            <div key={r.id} className="insights-drill-item">
              <div style={{ minWidth: 0 }}>
                <div className="ditem-title">{r.vendor_name}</div>
                <div className="ditem-sub">{r.description || '—'} · dated {fmtDate(r.bill_date)}</div>
              </div>
              <div className="ditem-num">{fmtPaise(r.amount_paise)}</div>
            </div>
          ))}
        </div>
      )}
    </DrillShell>
  );
}

function DrillIuts({ rows = [], onClose }) {
  return (
    <DrillShell title="IUT transfers pending" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: 12, margin: 0 }}>No IUT transfers pending. 🎉</p>
      ) : (
        <div className="insights-drill-grid">
          {rows.slice(0, 12).map((r) => (
            <div key={r.id} className="insights-drill-item">
              <div style={{ minWidth: 0 }}>
                <div className="ditem-title">{r.from_account} → {r.to_account}</div>
                <div className="ditem-sub">{r.purpose || '—'} · transfer date {fmtDate(r.transfer_date)}</div>
              </div>
              <div className="ditem-num">{fmtPaise(r.amount_paise)}</div>
            </div>
          ))}
        </div>
      )}
    </DrillShell>
  );
}

function DrillCabf({ pending, receiptsMonth, receiptsCount, onClose }) {
  return (
    <DrillShell title="CABF summary" onClose={onClose}>
      <div className="insights-drill-grid">
        <div className="insights-drill-item">
          <div style={{ minWidth: 0 }}>
            <div className="ditem-title">Requests awaiting action</div>
            <div className="ditem-sub">review + disbursement queue</div>
          </div>
          <div className="ditem-num">{pending}</div>
        </div>
        <div className="insights-drill-item">
          <div style={{ minWidth: 0 }}>
            <div className="ditem-title">Receipts this month</div>
            <div className="ditem-sub">{receiptsCount} contributions</div>
          </div>
          <div className="ditem-num">{fmtPaise(receiptsMonth)}</div>
        </div>
        <div className="insights-drill-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/cabf')}>
          <div style={{ minWidth: 0 }}>
            <div className="ditem-title">Open CABF admin console</div>
            <div className="ditem-sub">approve / disburse / issue receipts</div>
          </div>
          <div className="ditem-num" style={{ opacity: .6 }}>→</div>
        </div>
      </div>
    </DrillShell>
  );
}
