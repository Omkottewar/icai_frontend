import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { useBranchMetrics } from '../hooks/useBranchMetrics';
import { usePublicCommittees } from '../hooks/usePublicCommittees';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { navigate } from '../hooks/useRoute';
import { IconArrowRight } from '../icons';

import InsightsStyles from '../components/dashboard/insights/insightsStyles';
import { ShimmerPageBody, Shimmer } from '../components/ui/Shimmer';
import { useUrlState } from '../components/dashboard/insights/useUrlState';
import { mergeWithMock, MOCK_KPIS, MOCK_EVENTS_PER_MONTH, MOCK_REGS_PER_MONTH, MOCK_BY_COMMITTEE, MOCK_RECENT_EVENTS, MOCK_PENDING_APPROVALS } from '../components/dashboard/insights/branchMetricsMock';
import {
  WIDGET_REGISTRY, WIDGET_BY_ID, DEFAULT_LAYOUT,
} from '../components/dashboard/insights/widgets/registry';
import WidgetGrid from '../components/dashboard/insights/widgets/WidgetGrid';
import { CustomizeButton, EditToolbar } from '../components/dashboard/insights/widgets/EditControls';

// ─── tiny inline lucide-style icons (topbar) ────────────────────────────
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
};

// ─── helpers ────────────────────────────────────────────────────────────
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

const KNOWN_WIDGET_IDS = WIDGET_REGISTRY.map((w) => w.id);

// Tab definitions for the view-mode tabbed layout. Each tab maps to a widget
// `group` (see registry). Order here is the order tabs appear; only groups
// actually present in the current layout get a tab. First present = default.
const WIDGET_GROUPS = [
  ['KPI',         'KPIs'],
  ['Trend',       'Trends'],
  ['Composition', 'Composition'],
  ['Committee',   'Committees'],
  ['Activity',    'Activity'],
];

// ─── main page ──────────────────────────────────────────────────────────
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

  // TEMP — dev/preview toggle. 'demo' = pure mock dataset (great for QA-ing
  // widget visuals); 'live' = real API data with mock falling back per-field
  // where the API hasn't filled in yet. Persisted to localStorage so it
  // survives reloads. Remove this block + the DataModeToggle button when
  // the real backend is fully wired.
  const [dataMode, setDataMode] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('dashDataMode')) || 'live'
  );
  useEffect(() => {
    try { localStorage.setItem('dashDataMode', dataMode); } catch { /* private mode */ }
  }, [dataMode]);

  const data = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        kpis: MOCK_KPIS,
        events_per_month: MOCK_EVENTS_PER_MONTH,
        registrations_per_month: MOCK_REGS_PER_MONTH,
        by_committee: MOCK_BY_COMMITTEE,
        recent_events: MOCK_RECENT_EVENTS,
        pending_approvals: MOCK_PENDING_APPROVALS,
      };
    }
    return mergeWithMock(liveData);
  }, [dataMode, liveData]);

  // Layout state — per-user, persisted in DB.
  const {
    layout, isEditing, loading: layoutLoading, saving,
    startEditing, cancelEditing, editLayout, save, reset,
  } = useDashboardLayout({ defaultLayout: DEFAULT_LAYOUT, knownIds: KNOWN_WIDGET_IDS });

  // Track the persisted layout (used to compute isDirty for the Save button).
  // We re-compute on every edit; cheap because the array is small.
  const [snapshotJson, setSnapshotJson] = useState(null);
  useEffect(() => {
    if (!isEditing && !layoutLoading) setSnapshotJson(JSON.stringify(layout));
  }, [isEditing, layoutLoading, layout]);
  const isDirty = isEditing && snapshotJson !== null && JSON.stringify(layout) !== snapshotJson;

  // ─── Tabbed navigation (view mode only) ─────────────────────────────
  // Slice the dashboard into one tab per widget group so the chairman sees a
  // focused, near-zero-scroll surface instead of one long scroll. Edit mode
  // intentionally keeps the full flat grid (below) so drag / resize / add /
  // remove still operate across the whole layout in one place.
  const [activeTab, setActiveTab] = useState(null);
  const tabsInLayout = useMemo(() => {
    const present = new Set(layout.map((it) => WIDGET_BY_ID[it.id]?.group).filter(Boolean));
    return WIDGET_GROUPS.filter(([g]) => present.has(g));
  }, [layout]);
  // Resolve the active group: the user's pick if it still exists, else the
  // first available tab (the default on load / after layout changes).
  const activeGroup =
    activeTab && tabsInLayout.some(([g]) => g === activeTab)
      ? activeTab
      : (tabsInLayout[0]?.[0] ?? null);
  const showTabs = !isEditing && tabsInLayout.length > 1;
  const visibleLayout = showTabs
    ? layout.filter((it) => WIDGET_BY_ID[it.id]?.group === activeGroup)
    : layout;

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

  // ─── edit-mode handlers ────────────────────────────────────────────
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
    if (!window.confirm('Restore the default layout? Your customisations will be lost.')) return;
    try { await reset(); } catch { /* error already surfaced via hook */ }
  }

  if (authLoading) {
    return <ShimmerPageBody cards={4} />;
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
  const dropdownCommittees = committees.length ? committees : liveCommittees;
  const selectedCommittee = dropdownCommittees.find((c) => c.id === url.committee);
  const ageSec = liveAgeSec(updatedAt);

  const ctx = { url, setUrl, drill: url.drill, setDrill };
  const renderArgs = { data, ctx, loading: loading && !liveData };

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
        />
      )}

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
                {' · '}<span className="muted-text">{layout.length} widget{layout.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div className="insights-topbar-actions">
            <LivePill fetching={fetching} ageSec={ageSec} />
            <DataModeToggle mode={dataMode} onChange={setDataMode} />
            {!isEditing && <CustomizeButton onClick={startEditing} disabled={layoutLoading} />}
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
                  <div className="insights-tabs" role="tablist" aria-label="Dashboard sections">
                    {tabsInLayout.map(([group, label]) => {
                      const selected = group === activeGroup;
                      const count = layout.filter((it) => WIDGET_BY_ID[it.id]?.group === group).length;
                      return (
                        <button
                          key={group}
                          type="button"
                          role="tab"
                          id={`insights-tab-${group}`}
                          aria-selected={selected}
                          aria-controls="insights-tabpanel"
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
                  id="insights-tabpanel"
                  role={showTabs ? 'tabpanel' : undefined}
                  aria-labelledby={showTabs ? `insights-tab-${activeGroup}` : undefined}
                >
                  <WidgetGrid
                    layout={visibleLayout}
                    isEditing={isEditing}
                    onChange={editLayout}
                    onRemove={handleRemoveWidget}
                    renderArgs={renderArgs}
                  />
                </div>
              </div>
            )}

            {/* Drill panels stay outside the grid — they're transient, not widgets */}
            {url.drill && !isEditing && (
              <div style={{ marginTop: '1rem' }}>
                {url.drill === 'events' && (
                  <DrillEvents rows={data?.recent_events || []} onClose={() => setUrl({ drill: '' })} />
                )}
                {url.drill === 'approvals' && (
                  <DrillApprovals rows={data?.pending_approvals || []} onClose={() => setUrl({ drill: '' })} />
                )}
                {url.drill === 'committees' && (
                  <DrillCommittees rows={data?.by_committee || []} onClose={() => setUrl({ drill: '' })} />
                )}
              </div>
            )}

            <footer className="insights-footer">
              ICAI Nagpur Branch · Chairman analytics · data refreshes every 60s · layout saved per user
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
        You've removed every widget. Click below to start adding KPIs, charts, and tables.
      </p>
      <button className="d-btn d-btn-primary" style={{ marginTop: '1rem' }} onClick={onStart}>
        Customize dashboard
      </button>
    </div>
  );
}

// ─── Live pill (state-tinted) ───────────────────────────────────────────
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

// ─── Filter rail (left sidebar) ─────────────────────────────────────────
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

// ─── TEMP: Demo / Live data toggle for QA. Remove with the dataMode block. ─
function DataModeToggle({ mode, onChange }) {
  const isDemo = mode === 'demo';
  return (
    <button
      className="d-btn"
      onClick={() => onChange(isDemo ? 'live' : 'demo')}
      title={isDemo ? 'Showing sample data — click to switch to live API' : 'Showing live API data — click to switch to sample'}
      style={{
        background: isDemo ? 'oklch(0.78 0.15 75 / .15)' : undefined,
        borderColor: isDemo ? 'oklch(0.78 0.15 75 / .35)' : undefined,
        color: isDemo ? 'oklch(0.45 0.12 75)' : undefined,
        fontWeight: 700,
      }}
    >
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: 999,
        background: isDemo ? 'oklch(0.78 0.15 75)' : 'var(--secondary)',
      }} />
      {isDemo ? 'Demo data' : 'Live data'}
    </button>
  );
}

// ─── Share button (copies URL) ──────────────────────────────────────────
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

// ─── Drill panels (triggered by KPI click — not widgets themselves) ─────
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
