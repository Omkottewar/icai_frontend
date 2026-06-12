import { useEffect, useState } from 'react';

// "How does this event compare to similar past events from the same committee?"
// Used by the EventDrawer's review pane and by chairmen approving events.
//
// Shows:
//   - Summary line: "Avg X registrations / Y attended at avg ₹Z fee from N similar events"
//   - 5-row table of past comparable events with attendance + fee
//   - Optional callout when the current draft is markedly different (e.g. fee
//     2x previous events) so the approver can make an informed decision
//
// Lives on the public `/api/admin/events/:id/comparables` endpoint. Hidden
// when the event has no committee or no past comparables yet.

function fmtRupees(paise) {
  if (paise == null) return '—';
  if (paise === 0)   return 'Free';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pct(a, b) {
  if (!b || b === 0) return null;
  return Math.round((a / b) * 100);
}

export default function ComparableEventsPanel({ eventId, currentFeePaise, currentCapacity }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!eventId || eventId === 'new') { setLoading(false); return; }
    fetch(`/api/admin/events/${eventId}/comparables`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { rows: [], summary: null })
      .then((j) => { if (!cancelled) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData({ rows: [], summary: null }); setLoading(false); } });
    return () => { cancelled = true; };
  }, [eventId]);

  if (loading) return null;
  if (!data || data.rows.length === 0) {
    return (
      <div className="event-cmp-panel event-cmp-empty">
        <div className="event-cmp-title">Comparable past events</div>
        <div className="event-cmp-empty-text">No prior events from this committee to compare against yet.</div>
        {emptyStyles()}
      </div>
    );
  }

  const s = data.summary;
  const feeVsAvg = pct(currentFeePaise, s.avg_fee_paise);
  const showFeeDelta = feeVsAvg !== null && Math.abs(feeVsAvg - 100) > 25;

  return (
    <div className="event-cmp-panel">
      <div className="event-cmp-title">
        Comparable past events
        <span className="event-cmp-sample">based on the last {s.sample_size}</span>
      </div>

      <div className="event-cmp-summary">
        <div className="event-cmp-stat">
          <div className="event-cmp-stat-value">{s.avg_registered}</div>
          <div className="event-cmp-stat-label">avg registered</div>
        </div>
        <div className="event-cmp-stat">
          <div className="event-cmp-stat-value">{s.avg_attended}</div>
          <div className="event-cmp-stat-label">avg attended</div>
        </div>
        <div className="event-cmp-stat">
          <div className="event-cmp-stat-value">{fmtRupees(s.avg_fee_paise)}</div>
          <div className="event-cmp-stat-label">avg fee</div>
        </div>
      </div>

      {showFeeDelta && (
        <div className="event-cmp-flag">
          <strong>Note:</strong> the fee on this event is {feeVsAvg}% of the committee average. Worth a sanity-check before approving.
        </div>
      )}

      <table className="event-cmp-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>When</th>
            <th>Registered</th>
            <th>Attended</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.id}>
              <td className="event-cmp-event">{r.title}</td>
              <td>{fmtDate(r.starts_at)}</td>
              <td>{r.registered_count}{r.capacity ? <span className="event-cmp-mute"> / {r.capacity}</span> : ''}</td>
              <td>{r.attended_count}</td>
              <td>{fmtRupees(r.fee_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {fullStyles()}
    </div>
  );
}

function emptyStyles() {
  return (
    <style>{`
      .event-cmp-panel {
        background: var(--muted, #f8fafc);
        border: 1px solid var(--border);
        border-radius: .5rem;
        padding: .875rem 1rem;
      }
      .event-cmp-title {
        font-size: .8125rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: .04em;
        color: var(--muted-foreground);
        margin-bottom: .5rem;
      }
      .event-cmp-empty-text {
        font-size: .8125rem; color: var(--muted-foreground);
      }
    `}</style>
  );
}

function fullStyles() {
  return (
    <style>{`
      .event-cmp-panel {
        background: var(--muted, #f8fafc);
        border: 1px solid var(--border);
        border-radius: .5rem;
        padding: .875rem 1rem;
        display: flex; flex-direction: column; gap: .75rem;
      }
      .event-cmp-title {
        font-size: .8125rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: .04em;
        color: var(--muted-foreground);
        display: flex; gap: .5rem; align-items: center;
      }
      .event-cmp-sample {
        font-size: .65rem; text-transform: none; letter-spacing: 0;
        color: var(--muted-foreground); font-weight: 500;
      }
      .event-cmp-summary {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem;
      }
      .event-cmp-stat {
        background: white; border: 1px solid var(--border);
        border-radius: .375rem; padding: .5rem;
        text-align: center;
      }
      .event-cmp-stat-value { font-size: 1.1rem; font-weight: 700; line-height: 1; }
      .event-cmp-stat-label {
        font-size: .65rem; text-transform: uppercase; letter-spacing: .04em;
        color: var(--muted-foreground); margin-top: .25rem;
      }
      .event-cmp-flag {
        background: #fef3c7; color: #92400e;
        border: 1px solid #fde68a;
        border-radius: .375rem;
        padding: .5rem .625rem;
        font-size: .8125rem;
      }
      .event-cmp-table {
        width: 100%; border-collapse: collapse;
        font-size: .8125rem;
      }
      .event-cmp-table th, .event-cmp-table td {
        text-align: left;
        padding: .375rem .5rem;
        border-bottom: 1px solid var(--border);
      }
      .event-cmp-table th {
        font-size: .7rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: .04em;
        color: var(--muted-foreground);
      }
      .event-cmp-event {
        font-weight: 600;
        max-width: 240px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .event-cmp-mute { color: var(--muted-foreground); }
      .event-cmp-table tr:last-child td { border-bottom: 0; }
    `}</style>
  );
}
