import CountUp from './CountUp';
import Sparkline from './Sparkline';
import { ACCENTS } from './theme';

// Single KPI tile, matching the chairman-pulse-main layout:
//   ┌─[colored left bar]─────────────────────────┐
//   │ LABEL (eyebrow)                  [icon □]  │
//   │ 25px value           [sparkline 74x28]    │
//   │ subtitle                       [▲ +12.4%] │
//   └───────────────────────────────────────────┘
// Clickable variant turns the whole card into a button so KPI selection
// opens a drill-down panel below the grid.
export default function KpiTile({
  label, value, sub, format, icon,
  delta, spark, accent = 'primary',
  selected = false, highlight = false,
  onClick,
}) {
  const isInteractive = typeof onClick === 'function';
  const a = ACCENTS[accent] || ACCENTS.primary;

  const deltaPill = (() => {
    if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
    const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '–';
    return (
      <span className="kpi-delta" data-dir={dir}>
        {arrow} {Math.abs(delta).toLocaleString('en-IN')}
      </span>
    );
  })();

  const inner = (
    <>
      <span className="kpi-strip-edge" aria-hidden="true" />

      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>

      <div className="kpi-value-row">
        <div className="kpi-value">
          {typeof value === 'number' ? <CountUp value={value} format={format} /> : (value ?? '—')}
        </div>
        {spark?.length > 1 && (
          <span className="kpi-spark">
            <Sparkline data={spark} color={a.solid} width={74} height={28} />
          </span>
        )}
      </div>

      <div className="kpi-bottom">
        {sub && <span className="kpi-sub">{sub}</span>}
        {deltaPill}
      </div>
    </>
  );

  const className = [
    'kpi-tile',
    isInteractive ? 'is-interactive' : '',
    selected ? 'is-selected' : '',
    highlight ? 'is-highlight' : '',
  ].filter(Boolean).join(' ');

  const styleVars = {
    '--accent-solid': a.solid,
    '--accent-soft':  a.soft,
  };

  if (isInteractive) {
    return (
      <button type="button" className={className} style={styleVars} onClick={onClick} aria-pressed={selected}>
        {inner}
      </button>
    );
  }
  return <div className={className} style={styleVars}>{inner}</div>;
}
