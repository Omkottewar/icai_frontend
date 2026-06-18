import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAnalytics } from '../../../lib/pragyaanAdmin';

// Analytics dashboard for the Pragyaan assistant over a rolling window
// (7 / 30 / 90 days). Summary cards (total, answered, no-answer rate,
// citation coverage, avg top similarity), a top-questions list, and a CSS
// bar chart of daily volume with the no-answer portion shaded. Empty-safe:
// every field is guarded so a fresh/empty backend renders cleanly.

const DAY_OPTIONS = [7, 30, 90];

// `value` may be a 0..1 ratio; render as a whole-number percent.
function pct(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function num(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-IN');
}

function sim(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(3);
}

function fmtDay(day) {
  if (!day) return '';
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function PragyaanAnalytics() {
  const { showToast } = useAuth();

  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getAnalytics({ days });
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
      showToast?.(e.message || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [days, showToast]);

  useEffect(() => { load(); }, [load]);

  const byDay = data?.by_day ?? [];
  const topQuestions = data?.top_questions ?? [];
  // Tallest bar in the window — used to scale every bar's height. Guard the
  // empty case so we never divide by zero.
  const maxCount = byDay.reduce((m, d) => Math.max(m, d.count ?? 0), 0) || 1;

  const cards = [
    { label: 'Total questions', value: num(data?.total) },
    { label: 'Answered', value: num(data?.answered) },
    { label: 'No-answer rate', value: pct(data?.no_answer_rate), sub: data ? `${num(data.no_answer_count)} unanswered` : null },
    { label: 'Citation coverage', value: pct(data?.citation_coverage) },
    { label: 'Avg top similarity', value: sim(data?.avg_top_similarity) },
  ];

  return (
    <div>
      <div className="row gap-2" style={{ justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <p className="muted-text" style={{ margin: 0, fontSize: '.8125rem' }}>
          {data ? `Last ${data.window_days ?? days} days` : `Last ${days} days`}
        </p>
        <select
          className="input-base"
          style={{ padding: '.375rem .5rem', maxWidth: 140 }}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          disabled={loading}
        >
          {DAY_OPTIONS.map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Summary cards */}
      <div className="pa-cards">
        {cards.map((c) => (
          <div key={c.label} className="card pa-card">
            <div className="pa-card-label">{c.label}</div>
            <div className="pa-card-value">{loading ? '…' : c.value}</div>
            {c.sub && !loading && <div className="pa-card-sub muted-text">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="pa-grid">
        {/* Daily volume bar chart */}
        <div className="card pa-panel">
          <h3 className="pa-panel-title">Daily volume</h3>
          {!loading && byDay.length === 0 && (
            <p className="muted-text" style={{ fontSize: '.8125rem', margin: 0 }}>No activity in this window.</p>
          )}
          {byDay.length > 0 && (
            <>
              <div className="pa-bars">
                {byDay.map((d) => {
                  const count = d.count ?? 0;
                  const noAns = d.no_answer ?? 0;
                  const h = Math.round((count / maxCount) * 100);
                  // Portion of the bar that was unanswered (shaded darker).
                  const noAnsH = count > 0 ? Math.round((noAns / count) * 100) : 0;
                  return (
                    <div
                      key={d.day}
                      className="pa-bar-col"
                      title={`${fmtDay(d.day)} · ${count} question${count === 1 ? '' : 's'}, ${noAns} unanswered`}
                    >
                      <div className="pa-bar" style={{ height: `${Math.max(h, 2)}%` }}>
                        {noAnsH > 0 && <div className="pa-bar-noans" style={{ height: `${noAnsH}%` }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: '.4rem' }}>
                <span className="muted-text" style={{ fontSize: '.68rem' }}>{fmtDay(byDay[0]?.day)}</span>
                <span className="muted-text" style={{ fontSize: '.68rem' }}>{fmtDay(byDay[byDay.length - 1]?.day)}</span>
              </div>
              <div className="row gap-3" style={{ marginTop: '.6rem' }}>
                <span className="pa-legend"><i className="pa-swatch pa-swatch-base" /> Questions</span>
                <span className="pa-legend"><i className="pa-swatch pa-swatch-noans" /> No answer</span>
              </div>
            </>
          )}
        </div>

        {/* Top questions */}
        <div className="card pa-panel">
          <h3 className="pa-panel-title">Top questions</h3>
          {!loading && topQuestions.length === 0 && (
            <p className="muted-text" style={{ fontSize: '.8125rem', margin: 0 }}>No questions recorded yet.</p>
          )}
          {topQuestions.length > 0 && (
            <ol className="pa-q-list">
              {topQuestions.map((q, i) => (
                <li key={i}>
                  <span className="pa-q-text" title={q.question}>{q.question}</span>
                  <span className="badge badge-secondary pa-q-count">{num(q.count)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <style>{`
        .pa-cards {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: .75rem; margin-bottom: 1rem;
        }
        .pa-card { padding: .875rem 1rem; }
        .pa-card-label {
          font-size: .72rem; color: var(--muted-foreground); font-weight: 600;
          text-transform: uppercase; letter-spacing: .04em;
        }
        .pa-card-value { font-size: 1.5rem; font-weight: 700; margin-top: .25rem; line-height: 1.1; }
        .pa-card-sub { font-size: .72rem; margin-top: .15rem; }
        .pa-grid {
          display: grid; grid-template-columns: 1.4fr 1fr; gap: 1rem;
        }
        @media (max-width: 720px) { .pa-grid { grid-template-columns: 1fr; } }
        .pa-panel { padding: 1rem 1.125rem; }
        .pa-panel-title { font-size: .9rem; font-weight: 700; margin: 0 0 .875rem; }
        .pa-bars {
          display: flex; align-items: flex-end; gap: 2px; height: 140px;
          border-bottom: 1px solid var(--border);
        }
        .pa-bar-col { flex: 1; min-width: 0; display: flex; align-items: flex-end; height: 100%; }
        .pa-bar {
          width: 100%; background: var(--primary); border-radius: 2px 2px 0 0;
          position: relative; min-height: 2px; display: flex; flex-direction: column;
          justify-content: flex-start;
        }
        .pa-bar-noans { width: 100%; background: var(--destructive); border-radius: 2px 2px 0 0; }
        .pa-legend { display: inline-flex; align-items: center; gap: .35rem; font-size: .72rem; color: var(--muted-foreground); }
        .pa-swatch { display: inline-block; width: .7rem; height: .7rem; border-radius: 2px; }
        .pa-swatch-base { background: var(--primary); }
        .pa-swatch-noans { background: var(--destructive); }
        .pa-q-list { list-style: none; counter-reset: q; padding: 0; margin: 0; }
        .pa-q-list li {
          display: flex; align-items: center; gap: .6rem;
          padding: .5rem 0; border-bottom: 1px solid var(--border); font-size: .8125rem;
        }
        .pa-q-list li:last-child { border-bottom: 0; }
        .pa-q-list li::before {
          counter-increment: q; content: counter(q);
          flex: 0 0 auto; width: 1.4rem; height: 1.4rem; border-radius: 999px;
          background: var(--muted, #f5f5f4); color: var(--muted-foreground);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: .7rem; font-weight: 700;
        }
        .pa-q-text {
          flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pa-q-count { flex: 0 0 auto; }
        .admin-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: .625rem .875rem; border-radius: .375rem; font-size: .8125rem;
        }
      `}</style>
    </div>
  );
}
