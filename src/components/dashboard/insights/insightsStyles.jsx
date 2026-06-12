// All shared CSS for the branch chairman dashboard, mirroring the
// chairman-pulse-main design system pixel-for-pixel. Light theme,
// navy + green tokens, dense KPI grid, frosted topbar, dashed section
// dividers, stacked capacity bars.
export default function InsightsStyles() {
  return (
    <style>{`
      /* ─── Page surface ──────────────────────────────────────────────── */
      .insights-page {
        background: var(--background);
        min-height: 100vh;
      }
      .insights-page .container { max-width: 1280px; }
      .insights-page * { transition-timing-function: cubic-bezier(.32,.72,0,1); }
      .insights-page .tnum { font-variant-numeric: tabular-nums; letter-spacing: -.018em; }
      .insights-page .eyebrow-pill {
        display: inline-flex; align-items: center;
        font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
        font-size: 10px; padding: .15rem .5rem; border-radius: 999px;
        background: oklch(0.36 0.13 255 / .10); color: var(--primary);
      }

      /* ─── Top bar (sticky, frosted) ─────────────────────────────────── */
      .insights-topbar {
        position: sticky; top: 0; z-index: 40;
        height: 64px;
        margin: 0 -1rem 1.25rem;
        padding: 0 1rem;
        background: rgba(255,255,255,.78);
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        border-bottom: 1px solid var(--border);
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem;
      }
      .insights-topbar-title { display: flex; align-items: center; gap: .75rem; }
      .insights-topbar-logo {
        width: 34px; height: 34px; border-radius: 9px;
        display: grid; place-items: center; color: white;
        font-weight: 700; font-size: 12px; letter-spacing: -.02em;
        background: linear-gradient(135deg, #3622FF 0%, #1B0FA8 100%);
        box-shadow: 0 2px 8px -2px rgba(54,34,255,.40);
      }
      .insights-topbar h1 {
        margin: 0; font-size: 16px; font-weight: 700;
        color: var(--foreground); letter-spacing: -.01em; line-height: 1.15;
      }
      .insights-topbar-meta {
        font-size: 12px; color: var(--muted-foreground); margin-top: .05rem;
      }
      .insights-topbar-meta strong { color: var(--foreground); font-weight: 500; opacity: .8; }
      .insights-topbar-actions { display: flex; align-items: center; gap: .5rem; }

      /* ─── Live indicator pill (state-tinted) ────────────────────────── */
      .insights-live {
        display: inline-flex; align-items: center; gap: .375rem;
        height: 28px; padding: 0 .65rem; border-radius: 999px;
        font-size: 11px; font-weight: 600;
        font-variant-numeric: tabular-nums;
        background: oklch(0.50 0.16 145 / .10);
        color: oklch(0.40 0.14 145);
        border: 1px solid oklch(0.50 0.16 145 / .20);
      }
      .insights-live .dot {
        width: 6px; height: 6px; border-radius: 999px;
        background: oklch(0.50 0.16 145);
        animation: livePulse 1.6s ease-in-out infinite;
      }
      .insights-live[data-stale="true"] {
        background: oklch(0.78 0.15 75 / .15);
        color: oklch(0.45 0.12 75);
        border-color: oklch(0.78 0.15 75 / .30);
      }
      .insights-live[data-stale="true"] .dot { background: oklch(0.78 0.15 75); animation: none; }
      .insights-live[data-fetching="true"] {
        background: oklch(0.36 0.13 255 / .10);
        color: var(--primary);
        border-color: oklch(0.36 0.13 255 / .20);
      }
      .insights-live[data-fetching="true"] .dot { background: var(--primary); }
      @keyframes livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: .55; transform: scale(.85); }
      }

      /* ─── Action buttons in the topbar ──────────────────────────────── */
      .d-btn {
        display: inline-flex; align-items: center; gap: .375rem;
        height: 28px; padding: 0 .65rem; border-radius: 8px;
        background: #fff;
        border: 1px solid var(--border);
        color: var(--foreground);
        font-size: 12px; font-weight: 500; cursor: pointer;
        transition: background .18s, color .18s, border-color .18s, box-shadow .18s;
      }
      .d-btn:hover {
        background: var(--muted);
        border-color: oklch(0.36 0.13 255 / .40);
      }
      .d-btn:disabled { opacity: .55; cursor: not-allowed; }
      .d-btn .spin { animation: spin 1.1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .iframe-btn {
        display: inline-flex; align-items: center; gap: .25rem;
        height: 28px; padding: 0 .55rem; border-radius: 7px;
        background: #fff; border: 1px solid var(--border);
        color: var(--muted-foreground);
        font-size: 11px; font-weight: 500; cursor: pointer;
        transition: background .15s, color .15s, border-color .15s;
      }
      .iframe-btn:hover { color: var(--foreground); border-color: oklch(0.36 0.13 255 / .40); }

      /* ─── Layout: filter rail + main column ─────────────────────────── */
      .insights-layout {
        display: grid; gap: 1rem;
        grid-template-columns: 1fr;
        align-items: start;
      }
      @media (min-width: 980px) {
        .insights-layout { grid-template-columns: 220px 1fr; }
      }
      .insights-main {
        display: flex; flex-direction: column; gap: 1.75rem;
        min-width: 0;
      }

      /* ─── Filter rail ───────────────────────────────────────────────── */
      .filter-rail {
        position: sticky; top: 72px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 1rem;
        display: flex; flex-direction: column; gap: 1rem;
        box-shadow: 0 1px 2px rgba(15,23,42,.03);
        align-self: start;
      }
      .filter-rail-eyebrow { font-size: 10px; }
      .filter-block { display: flex; flex-direction: column; gap: .5rem; }
      .filter-label {
        font-size: 10px; text-transform: uppercase; letter-spacing: .07em;
        font-weight: 700; color: var(--muted-foreground);
      }
      .vpill {
        display: block; width: 100%; height: 32px;
        text-align: left; padding: 0 .75rem;
        border-radius: 999px;
        background: #fff; border: 1px solid var(--border);
        color: var(--foreground);
        font-size: 12px; font-weight: 500; cursor: pointer;
        transition: background .18s, color .18s, border-color .18s;
      }
      .vpill:hover { background: var(--muted); }
      .vpill.is-active {
        background: oklch(0.36 0.13 255 / .10);
        color: var(--primary);
        border-color: oklch(0.36 0.13 255 / .30);
      }
      .filter-rail .input-base {
        height: 32px; padding: 0 .625rem;
        border-radius: 8px; border: 1px solid var(--border);
        background: #fff;
        font-size: 12px; color: var(--foreground);
        outline: none;
      }
      .filter-rail .input-base:focus {
        border-color: oklch(0.36 0.13 255 / .40);
        box-shadow: 0 0 0 3px oklch(0.36 0.13 255 / .10);
      }
      .filter-reset {
        margin-top: .25rem; height: 36px;
        background: linear-gradient(135deg, #3622FF 0%, #1B0FA8 100%);
        color: white; font-weight: 600; font-size: 12px;
        border-radius: 9px; cursor: pointer;
        box-shadow: 0 6px 16px -8px rgba(54,34,255,.55);
        border: 0;
        transition: filter .18s, transform .18s;
      }
      .filter-reset:hover { filter: brightness(1.06); transform: translateY(-1px); }

      /* ─── Tabbed sections (view mode) ───────────────────────────────── */
      .insights-tabbed { display: flex; flex-direction: column; gap: 1rem; }
      .insights-tabs {
        position: sticky; top: 72px; z-index: 30;
        display: flex; gap: .25rem;
        padding: .25rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(15,23,42,.03);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .insights-tabs::-webkit-scrollbar { display: none; }
      .insights-tab {
        display: inline-flex; align-items: center; gap: .4rem;
        white-space: nowrap; cursor: pointer;
        height: 34px; padding: 0 .85rem;
        border: 0; border-radius: 9px;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 13px; font-weight: 600;
        transition: background .15s, color .15s;
      }
      .insights-tab:hover { color: var(--foreground); background: var(--muted); }
      .insights-tab.is-active {
        background: oklch(0.36 0.13 255 / .10);
        color: var(--primary);
      }
      .insights-tab-count {
        font-size: 10px; font-weight: 700; line-height: 1;
        padding: .15rem .4rem; border-radius: 999px;
        background: var(--muted); color: var(--muted-foreground);
        font-variant-numeric: tabular-nums;
      }
      .insights-tab.is-active .insights-tab-count {
        background: oklch(0.36 0.13 255 / .16); color: var(--primary);
      }

      /* ─── Section header (numbered, dashed bottom border) ───────────── */
      .insights-section {
        display: flex; align-items: center; justify-content: space-between;
        padding-bottom: .625rem;
        border-bottom: 1px dashed var(--border);
        gap: .75rem;
      }
      .insights-section-left { display: flex; align-items: center; gap: .75rem; }
      .insights-section-eyebrow {
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .07em;
        padding: .15rem .5rem; border-radius: 999px;
        background: oklch(0.36 0.13 255 / .10); color: var(--primary);
        font-variant-numeric: tabular-nums;
      }
      .insights-section-title {
        font-size: 16px; font-weight: 700; color: var(--foreground);
        letter-spacing: -.01em; margin: 0; line-height: 1.2;
      }
      .insights-section-sub {
        font-size: 12px; color: var(--muted-foreground);
        text-align: right;
      }

      /* ─── A "block" wraps each section's header + content ──────────── */
      .insights-block { display: flex; flex-direction: column; gap: .75rem; }

      /* ─── KPI grid ──────────────────────────────────────────────────── */
      .kpi-strip {
        display: grid; gap: .625rem;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }
      .kpi-tile {
        position: relative; text-align: left;
        height: 116px;
        padding: .75rem .75rem .75rem 1rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(15,23,42,.03);
        display: flex; flex-direction: column; justify-content: space-between;
        transition: transform .2s, box-shadow .2s, border-color .2s;
        overflow: hidden;
        color: var(--foreground);
      }
      .kpi-tile .kpi-strip-edge {
        position: absolute; top: 10px; bottom: 10px; left: 0; width: 3px;
        background: var(--accent-solid);
        border-radius: 0 999px 999px 0;
      }
      .kpi-tile.is-interactive { cursor: pointer; }
      .kpi-tile.is-interactive:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px -10px rgba(15,23,42,.16);
      }
      .kpi-tile.is-selected {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--primary);
      }
      .kpi-tile.is-highlight .kpi-value { color: oklch(0.78 0.15 75); }
      .kpi-top {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: .5rem;
      }
      .kpi-label {
        font-size: 10px; text-transform: uppercase; letter-spacing: .07em;
        color: var(--muted-foreground); font-weight: 700;
      }
      .kpi-icon {
        width: 26px; height: 26px; border-radius: 7px;
        display: grid; place-items: center;
        background: var(--accent-soft);
        color: var(--accent-solid);
        font-size: 13px; font-weight: 700;
      }
      .kpi-icon svg { width: 14px; height: 14px; }
      .kpi-value-row {
        display: flex; align-items: flex-end; justify-content: space-between;
        gap: .5rem;
      }
      .kpi-value {
        font-size: 25px; font-weight: 700; line-height: 1;
        letter-spacing: -.022em;
        color: var(--foreground);
        font-variant-numeric: tabular-nums;
      }
      .kpi-spark { display: inline-flex; height: 28px; width: 74px; }
      .kpi-bottom {
        display: flex; align-items: center; justify-content: space-between;
        gap: .5rem;
      }
      .kpi-sub { font-size: 12px; color: var(--muted-foreground); }
      .kpi-delta {
        display: inline-flex; align-items: center; gap: .15rem;
        padding: .1rem .375rem; border-radius: 999px;
        font-size: 11px; font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .kpi-delta[data-dir="up"]   { background: oklch(0.50 0.16 145 / .10); color: oklch(0.42 0.14 145); }
      .kpi-delta[data-dir="down"] { background: oklch(0.577 0.245 27.325 / .10); color: var(--destructive); }
      .kpi-delta[data-dir="flat"] { background: var(--muted); color: var(--muted-foreground); }

      /* ─── Chart frame (card with header bar + body) ─────────────────── */
      .insight-frame {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: 0 1px 2px rgba(15,23,42,.03);
        overflow: hidden;
        display: flex; flex-direction: column;
      }
      .insight-frame-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; padding: .75rem 1rem;
        border-bottom: 1px solid var(--border);
      }
      .insight-frame-titles { min-width: 0; flex: 1; line-height: 1.2; }
      .insight-frame-title {
        font-size: 13px; font-weight: 700; color: var(--foreground);
        letter-spacing: -.005em;
      }
      .insight-frame-subtitle {
        font-size: 11px; color: var(--muted-foreground); margin-top: .15rem;
      }
      .insight-frame-actions {
        display: inline-flex; align-items: center; gap: .35rem;
        flex-shrink: 0;
      }
      .insight-frame-body { padding: .75rem; }
      .insight-frame-skeleton {
        height: 200px; border-radius: 10px;
        background: linear-gradient(90deg,
          rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.03) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.4s ease-in-out infinite;
      }
      @keyframes shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      .insight-frame-empty {
        display: flex; align-items: center; justify-content: center;
        padding: 2rem 1rem;
        font-size: 12px; color: var(--muted-foreground);
      }

      /* ─── Layout grids inside the main column ──────────────────────── */
      .insights-row { display: grid; gap: .75rem; grid-template-columns: 1fr; }
      @media (min-width: 900px) {
        .insights-row.cols-2   { grid-template-columns: 1fr 1fr; }
        .insights-row.cols-3   { grid-template-columns: 1fr 1fr 1fr; }
        .insights-row.cols-2-1 { grid-template-columns: 2fr 1fr; }
      }

      /* ─── Tables ────────────────────────────────────────────────────── */
      .insight-table {
        width: 100%; border-collapse: separate; border-spacing: 0;
        font-size: 13px; color: var(--foreground);
      }
      .insight-table th {
        background: oklch(0.96 0.01 240 / .4);
        text-align: left; padding: .625rem 1rem;
        font-size: 10px; text-transform: uppercase; letter-spacing: .07em;
        font-weight: 700; color: var(--muted-foreground);
        border-bottom: 1px solid var(--border);
        user-select: none; white-space: nowrap;
      }
      .insight-table th.sortable { cursor: pointer; transition: color .15s; }
      .insight-table th.sortable:hover { color: var(--foreground); }
      .insight-table td {
        padding: .625rem 1rem; border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
      .insight-table tbody tr { position: relative; transition: background .15s; }
      .insight-table tbody tr:hover { background: oklch(0.36 0.13 255 / .03); }
      .insight-table tbody tr[data-selected="true"] {
        background: oklch(0.36 0.13 255 / .08);
      }
      .insight-table tbody tr[data-selected="true"] td:first-child::before {
        content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
        background: var(--primary);
      }
      .insight-table tr:last-child td { border-bottom: 0; }
      .insight-table .mono {
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 11px; font-weight: 600;
        background: var(--muted); padding: .12rem .375rem; border-radius: 6px;
        color: var(--foreground);
      }
      .insight-table .num { text-align: right; font-variant-numeric: tabular-nums; }

      .stacked-num {
        display: flex; flex-direction: column; align-items: flex-end; gap: .25rem;
      }
      .stacked-num .sn-value {
        font-size: 13px; font-weight: 600; color: var(--foreground);
        font-variant-numeric: tabular-nums;
      }
      .stacked-num .sn-bar {
        height: 6px; width: 96px; overflow: hidden;
        border-radius: 999px; background: var(--muted);
      }
      .stacked-num .sn-bar-fill {
        display: block; height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #3622FF, #0891B2);
      }

      /* ─── Status pills (with leading dot) ──────────────────────────── */
      .status-pill {
        display: inline-flex; align-items: center; gap: .375rem;
        padding: .1rem .5rem; border-radius: 999px;
        font-size: 11px; font-weight: 600;
        text-transform: lowercase; white-space: nowrap;
        background: var(--muted); color: var(--muted-foreground);
      }
      .status-pill::before {
        content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor;
      }
      .status-pill.s-published        { background: oklch(0.50 0.16 145 / .10); color: oklch(0.40 0.14 145); }
      .status-pill.s-draft            { background: var(--muted); color: var(--muted-foreground); }
      .status-pill.s-pending_approval { background: oklch(0.78 0.15 75 / .15); color: oklch(0.45 0.12 75); }
      .status-pill.s-cancelled        { background: oklch(0.577 0.245 27.325 / .10); color: var(--destructive); }
      .status-pill.s-completed        { background: oklch(0.36 0.13 255 / .10); color: var(--primary); }
      .status-pill.s-approved         { background: oklch(0.45 0.14 200 / .10); color: oklch(0.45 0.14 200); }

      /* ─── Drill-down panel ──────────────────────────────────────────── */
      .insights-drill {
        border: 1px solid oklch(0.36 0.13 255 / .20);
        background: oklch(0.36 0.13 255 / .03);
        border-radius: 14px; padding: 1rem;
        animation: drillIn .26s cubic-bezier(.32,.72,0,1);
      }
      @keyframes drillIn {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .insights-drill-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; margin-bottom: .75rem;
      }
      .insights-drill-title {
        font-size: 13px; font-weight: 700; color: var(--primary);
      }
      .insights-drill-close {
        display: grid; place-items: center;
        width: 28px; height: 28px; border-radius: 999px;
        background: #fff; border: 1px solid var(--border);
        color: var(--muted-foreground); cursor: pointer;
        transition: color .15s, border-color .15s;
      }
      .insights-drill-close:hover { color: var(--foreground); border-color: oklch(0.36 0.13 255 / .30); }
      .insights-drill-grid {
        display: grid; gap: .5rem;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      .insights-drill-item {
        display: flex; align-items: center; justify-content: space-between;
        gap: .75rem;
        background: #fff; border: 1px solid var(--border);
        border-radius: 10px; padding: .5rem .75rem;
      }
      .insights-drill-item .ditem-title {
        font-size: 12.5px; font-weight: 600; color: var(--foreground);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .insights-drill-item .ditem-sub {
        font-size: 11px; color: var(--muted-foreground);
      }
      .insights-drill-item .ditem-num {
        font-size: 12px; font-weight: 700; color: var(--foreground);
        font-variant-numeric: tabular-nums; white-space: nowrap;
      }

      /* ─── Recharts skin ─────────────────────────────────────────────── */
      .insights-tip {
        background: #fff;
        color: var(--foreground);
        padding: .5rem .625rem; border-radius: 8px;
        font-size: 11px;
        border: 1px solid var(--border);
        box-shadow: 0 10px 24px -10px rgba(15,23,42,.16);
        line-height: 1.4;
      }
      .insights-tip .tip-title {
        font-weight: 700; margin-bottom: .15rem;
        font-size: 10px; text-transform: uppercase; letter-spacing: .07em;
        color: var(--muted-foreground);
      }
      .insights-tip .tip-row { display: flex; align-items: center; gap: .375rem; color: var(--foreground); }
      .insights-tip .tip-dot { width: 6px; height: 6px; border-radius: 2px; }
      .insights-tip .tip-num { font-variant-numeric: tabular-nums; font-weight: 700; }

      .insights-page .recharts-cartesian-axis-tick-value { fill: oklch(0.45 0.04 250); font-size: 11px; }
      .insights-page .recharts-cartesian-grid line { stroke: var(--border); }

      /* ─── Approval queue list (right column) ───────────────────────── */
      .approvals-queue {
        display: flex; flex-direction: column; gap: .5rem;
        padding: .75rem;
      }
      .approval-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: .75rem;
        height: 56px; padding: 0 .75rem;
        background: #fff;
        border: 1px solid transparent;
        border-radius: 10px; cursor: pointer; text-align: left;
        transition: transform .18s, border-color .18s, box-shadow .18s;
        color: var(--foreground);
      }
      .approval-row:hover {
        transform: translateX(2px);
        border-color: oklch(0.36 0.13 255 / .30);
        box-shadow: 0 6px 16px -8px rgba(54,34,255,.45);
      }
      .approval-row .ar-title {
        font-size: 12.5px; font-weight: 600; color: var(--foreground);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .approval-row .ar-meta {
        font-size: 11px; color: var(--muted-foreground); margin-top: .1rem;
      }
      .approval-row .ar-arrow {
        color: var(--muted-foreground); flex-shrink: 0;
        transition: color .18s;
      }
      .approval-row:hover .ar-arrow { color: var(--primary); }
      .approval-empty {
        padding: 2.5rem 1rem; text-align: center;
        font-size: 12px; color: var(--muted-foreground);
      }
      .queue-badge {
        display: inline-flex; align-items: center;
        padding: .1rem .5rem; border-radius: 999px;
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .07em;
        background: oklch(0.78 0.15 75 / .15);
        color: oklch(0.45 0.12 75);
      }

      /* ─── Empty roadmap note (Coming soon block) ───────────────────── */
      .insights-roadmap {
        background: var(--card);
        border: 1px dashed var(--border);
        border-radius: 14px;
        padding: 1rem 1.25rem;
      }
      .insights-roadmap h4 {
        margin: 0 0 .25rem; font-size: 13px; font-weight: 700;
        color: var(--foreground);
      }
      .insights-roadmap ul {
        margin: .5rem 0 0; padding-left: 1.1rem;
        display: flex; flex-direction: column; gap: .25rem;
        font-size: 12px; color: var(--muted-foreground);
      }

      .insights-footer {
        margin-top: 1.25rem; padding: 1rem 0 .5rem;
        border-top: 1px dashed var(--border);
        font-size: 11px; color: var(--muted-foreground);
        text-align: left;
      }

      /* ─── Customizable widget grid ─────────────────────────────────── */
      .widget-grid {
        display: grid; gap: .75rem;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        align-items: stretch;
      }
      .widget-cell {
        position: relative; min-width: 0;
        display: flex; flex-direction: column;
        grid-column: span 12;
        transition: transform .2s ease, opacity .2s ease, box-shadow .2s ease;
      }
      .widget-cell.is-sm { grid-column: span 6; }   /* 2-up on small */
      .widget-cell.is-md { grid-column: span 12; }
      .widget-cell.is-lg { grid-column: span 12; }
      @media (min-width: 760px) {
        .widget-cell.is-sm { grid-column: span 4; }  /* 3-up on tablet */
        .widget-cell.is-md { grid-column: span 6; }
      }
      @media (min-width: 1100px) {
        .widget-cell.is-sm { grid-column: span 3; }  /* 4-up on desktop */
        .widget-cell.is-md { grid-column: span 6; }
        .widget-cell.is-lg { grid-column: span 12; }
      }
      .widget-cell .widget-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .widget-cell .widget-body > * { flex: 1; }

      /* In edit mode every widget gets dashed chrome to signal it's draggable */
      .widget-grid[data-editing="true"] .widget-cell {
        cursor: grab;
        outline: 2px dashed transparent;
        outline-offset: 4px;
        border-radius: 14px;
      }
      .widget-grid[data-editing="true"] .widget-cell:hover {
        outline-color: oklch(0.36 0.13 255 / .35);
      }
      .widget-cell.is-dragging {
        opacity: .35; cursor: grabbing;
      }
      .widget-cell.is-drop-target::before {
        content: ''; position: absolute; inset: -6px;
        border-radius: 16px;
        background: oklch(0.36 0.13 255 / .08);
        outline: 2px solid var(--primary);
        outline-offset: 0;
        pointer-events: none;
        z-index: 0;
      }
      /* Disable child interactivity while dragging so dropping doesn't accidentally
         trigger a click on a chart or KPI tile. */
      .widget-grid[data-editing="true"] .widget-cell .widget-body { pointer-events: none; }
      .widget-grid[data-editing="true"] .widget-cell .widget-body * { user-select: none; }

      .widget-chrome {
        display: flex; align-items: center; justify-content: space-between;
        gap: .5rem;
        padding: .35rem .5rem .5rem;
        margin-bottom: -.25rem;
        font-size: 11px;
      }
      .widget-chrome-left {
        display: inline-flex; align-items: center; gap: .4rem; min-width: 0;
      }
      .widget-handle {
        display: inline-grid; place-items: center;
        width: 18px; height: 18px; border-radius: 5px;
        background: oklch(0.36 0.13 255 / .12);
        color: var(--primary);
        font-size: 13px; line-height: 1; cursor: grab;
      }
      .widget-chrome-title {
        font-size: 10.5px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .07em;
        color: var(--muted-foreground);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .widget-chrome-right {
        display: inline-flex; align-items: center; gap: .35rem;
      }
      .size-toggle {
        display: inline-flex; align-items: center;
        background: var(--muted);
        border-radius: 7px;
        padding: 2px;
      }
      .size-toggle-btn {
        appearance: none; border: 0;
        background: transparent;
        height: 20px; padding: 0 .4rem;
        font-size: 10px; font-weight: 700;
        letter-spacing: .06em;
        color: var(--muted-foreground);
        cursor: pointer;
        border-radius: 5px;
        transition: background .15s, color .15s;
      }
      .size-toggle-btn:hover { color: var(--foreground); }
      .size-toggle-btn.is-active {
        background: #fff;
        color: var(--primary);
        box-shadow: 0 1px 2px rgba(15,23,42,.08);
      }
      .widget-remove {
        appearance: none; border: 0; cursor: pointer;
        width: 22px; height: 22px; border-radius: 6px;
        display: grid; place-items: center;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 13px; line-height: 1;
        transition: background .15s, color .15s;
      }
      .widget-remove:hover {
        background: oklch(0.577 0.245 27.325 / .10);
        color: var(--destructive);
      }

      /* ─── Edit-mode toolbar (floats at viewport bottom — Notion/Linear
             pattern; avoids fighting with the site Header for top:0) ────── */
      .edit-toolbar {
        position: fixed; left: 50%; bottom: 1.25rem;
        transform: translateX(-50%);
        z-index: 55;
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem;
        max-width: calc(100vw - 2rem); width: min(960px, calc(100vw - 2rem));
        padding: .55rem .8rem .55rem 1rem;
        background: linear-gradient(135deg, oklch(0.36 0.13 255 / .98), oklch(0.30 0.16 260 / .98));
        color: #fff;
        border-radius: 999px;
        box-shadow: 0 20px 40px -12px rgba(15,23,42,.45),
                    0 4px 12px -4px rgba(15,23,42,.25);
        animation: editToolbarIn .3s cubic-bezier(.32,.72,0,1);
      }
      @keyframes editToolbarIn {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }
      /* Add breathing room at the bottom of the page so the floating bar
         doesn't sit on top of the footer text. */
      .insights-page[data-editing="true"] .insights-footer { margin-bottom: 5rem; }
      .edit-toolbar-left { display: inline-flex; flex-direction: column; gap: .15rem; min-width: 0; }
      .edit-toolbar-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: .08em;
      }
      .edit-toolbar-hint {
        font-size: 11px; color: rgba(255,255,255,.78);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .edit-toolbar-right { display: inline-flex; align-items: center; gap: .4rem; }
      .edit-toolbar .d-btn {
        background: rgba(255,255,255,.14);
        color: #fff;
        border-color: rgba(255,255,255,.18);
      }
      .edit-toolbar .d-btn:hover {
        background: rgba(255,255,255,.22);
        border-color: rgba(255,255,255,.32);
      }
      .edit-toolbar .d-btn-ghost {
        background: transparent; border-color: rgba(255,255,255,.18);
      }
      .edit-toolbar .d-btn-primary {
        background: #fff; color: var(--primary);
        border-color: transparent;
        font-weight: 700;
      }
      .edit-toolbar .d-btn-primary:hover { background: oklch(0.96 0.01 240); }
      .edit-toolbar .d-btn-primary:disabled {
        background: rgba(255,255,255,.55); color: rgba(255,255,255,.85);
      }
      .edit-toolbar-pill {
        margin-left: .25rem;
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 .35rem;
        background: rgba(255,255,255,.22);
        border-radius: 999px;
        font-size: 10px; font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 720px) {
        .edit-toolbar-hint { display: none; }
        .edit-toolbar {
          padding: .55rem .75rem;
          width: calc(100vw - 1rem);
          bottom: .75rem;
          border-radius: 14px;
          gap: .5rem;
        }
        .edit-toolbar-eyebrow { font-size: 9px; }
      }

      /* ─── Add-widget picker overlay ────────────────────────────────── */
      .picker-overlay {
        position: fixed; inset: 0; z-index: 60;
        background: rgba(15,23,42,.45);
        backdrop-filter: blur(4px);
        display: flex; align-items: flex-start; justify-content: center;
        padding: 4rem 1rem 1rem;
        animation: pickerFadeIn .2s ease;
      }
      @keyframes pickerFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .picker-panel {
        width: 100%; max-width: 760px;
        background: var(--card);
        border-radius: 16px;
        box-shadow: 0 30px 60px -20px rgba(15,23,42,.4);
        overflow: hidden;
        animation: pickerSlideIn .25s cubic-bezier(.32,.72,0,1);
      }
      @keyframes pickerSlideIn {
        from { opacity: 0; transform: translateY(-12px) scale(.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .picker-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 1rem;
        padding: 1.1rem 1.25rem .8rem;
        border-bottom: 1px solid var(--border);
      }
      .picker-eyebrow {
        font-size: 10px; font-weight: 800; letter-spacing: .08em;
        color: var(--primary); text-transform: uppercase;
      }
      .picker-title { margin: .25rem 0 .15rem; font-size: 17px; font-weight: 700; }
      .picker-sub { margin: 0; font-size: 12px; color: var(--muted-foreground); }
      .picker-close {
        appearance: none; border: 0; cursor: pointer;
        width: 32px; height: 32px; border-radius: 999px;
        background: var(--muted);
        color: var(--muted-foreground);
        font-size: 14px; line-height: 1;
        display: grid; place-items: center;
        transition: background .15s, color .15s;
      }
      .picker-close:hover { background: oklch(0.577 0.245 27.325 / .10); color: var(--destructive); }
      .picker-empty {
        padding: 2rem; text-align: center;
        font-size: 13px; color: var(--muted-foreground);
        margin: 0;
      }
      .picker-groups {
        max-height: 60vh; overflow-y: auto;
        padding: 1rem 1.25rem 1.25rem;
        display: flex; flex-direction: column; gap: 1.25rem;
      }
      .picker-group-title {
        margin: 0 0 .5rem;
        font-size: 10px; font-weight: 800; letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--muted-foreground);
      }
      .picker-grid {
        display: grid; gap: .6rem;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }
      .picker-card {
        text-align: left; cursor: pointer;
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: .65rem .75rem;
        display: flex; flex-direction: column; gap: .25rem;
        transition: transform .18s, border-color .18s, box-shadow .18s;
        color: var(--foreground);
      }
      .picker-card:hover {
        transform: translateY(-2px);
        border-color: oklch(0.36 0.13 255 / .40);
        box-shadow: 0 8px 18px -10px rgba(54,34,255,.35);
      }
      .picker-card-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: .5rem;
      }
      .picker-card-title { font-size: 13px; font-weight: 700; }
      .picker-card-size {
        font-size: 9.5px; font-weight: 800; letter-spacing: .07em;
        padding: .1rem .35rem; border-radius: 999px;
        background: oklch(0.36 0.13 255 / .10);
        color: var(--primary);
      }
      .picker-card-desc {
        font-size: 11.5px; color: var(--muted-foreground);
        line-height: 1.35;
      }

      /* ─── Reduced motion ───────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        .kpi-tile, .insights-drill, .filter-reset, .insights-live .dot, .d-btn .spin, .approval-row,
        .picker-panel, .picker-overlay, .widget-cell {
          transition: none !important; animation: none !important;
        }
      }
    `}</style>
  );
}
