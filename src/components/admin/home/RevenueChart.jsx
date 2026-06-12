// Compact sparkline-style bar chart of monthly revenue. Reads
// `data.lists.revenue_by_month` which the home endpoint already fills with
// 12 months (zero rows included so the chart is dense).
//
// Deliberately not using a charting library — the data is shallow, the
// visualisation is simple, and a 60-line component beats a 60kB dependency.

function fmtRupees(paise) {
  if (paise == null) return '₹0';
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)} L`;
  if (rupees >= 1000)   return `₹${(rupees / 1000).toFixed(0)}K`;
  return `₹${rupees.toFixed(0)}`;
}

function monthLabel(ym) {
  // ym = 'YYYY-MM'
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short', year: '2-digit', timeZone: 'UTC',
  });
}

export default function RevenueChart({ rows }) {
  const data = Array.isArray(rows) ? rows : [];
  if (data.length === 0) {
    return (
      <div className="home-card">
        <div className="home-card-head">
          <h2 className="home-card-title">Revenue by month</h2>
        </div>
        <div className="rev-empty">No revenue recorded yet.</div>
        <style>{revChartStyles}</style>
      </div>
    );
  }

  const max = Math.max(1, ...data.map((r) => r.total_paise ?? 0));
  const total = data.reduce((s, r) => s + (r.total_paise ?? 0), 0);

  return (
    <div className="home-card">
      <div className="home-card-head">
        <div>
          <h2 className="home-card-title">Revenue by month</h2>
          <div className="home-card-sub">Last 12 months · {fmtRupees(total)} total</div>
        </div>
      </div>

      <div className="rev-chart">
        {data.map((r) => {
          const pct = ((r.total_paise ?? 0) / max) * 100;
          const isCurrentMonth = data[data.length - 1]?.month === r.month;
          return (
            <div key={r.month} className="rev-col" title={`${monthLabel(r.month)} — ${fmtRupees(r.total_paise)}`}>
              <div className="rev-col-bar-wrap">
                <div
                  className={'rev-col-bar' + (isCurrentMonth ? ' rev-col-bar-current' : '')}
                  style={{ height: `${Math.max(2, pct)}%` }}
                />
              </div>
              <div className="rev-col-label">{monthLabel(r.month).split(' ')[0]}</div>
            </div>
          );
        })}
      </div>

      <style>{revChartStyles}</style>
    </div>
  );
}

const revChartStyles = `
  .rev-empty { padding: 2rem; text-align: center; color: var(--muted-foreground); font-size: .875rem; }
  .rev-chart {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: .375rem;
    padding: 1rem 1.125rem 1.125rem;
    height: 140px;
    align-items: end;
  }
  .rev-col {
    display: flex; flex-direction: column; align-items: center; height: 100%;
    gap: .375rem; min-width: 0;
  }
  .rev-col-bar-wrap {
    flex: 1; width: 100%; display: flex; align-items: flex-end;
  }
  .rev-col-bar {
    width: 100%;
    background: var(--primary, #1e40af);
    border-radius: .25rem .25rem 0 0;
    opacity: .85;
    transition: opacity .15s;
  }
  .rev-col-bar-current { opacity: 1; box-shadow: 0 0 0 1px var(--primary); }
  .rev-col:hover .rev-col-bar { opacity: 1; }
  .rev-col-label {
    font-size: .65rem; color: var(--muted-foreground);
    text-transform: uppercase; letter-spacing: .04em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
  }
`;
