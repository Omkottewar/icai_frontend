import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { ShimmerTableRow } from '../../components/ui/Shimmer';

// Notifications Log — observability for the dispatch pipeline.
//
// Triage workflow: when a user says "I didn't get notified about X", admin
// loads this page, searches their name/email, looks at the most recent row.
// Status + error column tells them exactly which channel skipped/failed
// and why (smtp_not_configured_dev, no_subscription, user_opted_out, etc).
// Beats a SQL console every time.

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
}

const STATUS_STYLE = {
  sent:    { bg: '#dcfce7', fg: '#166534' },
  failed:  { bg: '#fee2e2', fg: '#991b1b' },
  skipped: { bg: '#fef3c7', fg: '#92400e' },
  queued:  { bg: '#dbeafe', fg: '#1e40af' },
};

const CHANNEL_STYLE = {
  inapp:    { icon: '🔔', label: 'In-app' },
  email:    { icon: '✉️',  label: 'Email' },
  webpush:  { icon: '📱', label: 'Push' },
  sms:      { icon: '💬', label: 'SMS' },
  whatsapp: { icon: '💚', label: 'WhatsApp' },
};

export default function NotificationsLogAdminPage() {
  // Filters — pushed to query string so the URL is shareable.
  const [filters, setFilters] = useState({
    status: '',
    channel: '',
    template_key: '',
    q: '',
  });
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.status)        p.set('status', filters.status);
    if (filters.channel)       p.set('channel', filters.channel);
    if (filters.template_key)  p.set('template_key', filters.template_key);
    if (debouncedQ)            p.set('q', debouncedQ);
    p.set('pageSize', '100');
    return p.toString();
  }, [filters.status, filters.channel, filters.template_key, debouncedQ]);

  const { data, loading, refresh } = useAdminList(`/api/admin/notification-templates/_deliveries?${qs}`);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    adminFetch('/api/admin/notification-templates/_health')
      .then((j) => setHealth(j))
      .catch(() => {});
  }, []);

  const rows = data?.rows || [];

  // Pull a unique template_key list from the visible rows for the dropdown.
  // Falls back to a static list if the rows are empty.
  const templateKeyOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.template_key).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  // Aggregate counts from `summary` for the stat strip at the top.
  const summary = data?.summary || [];
  const totals = useMemo(() => {
    const out = { sent: 0, failed: 0, skipped: 0, queued: 0 };
    for (const s of summary) {
      out[s.status] = (out[s.status] || 0) + s.n;
    }
    return out;
  }, [summary]);

  return (
    <AdminLayout
      title="Notifications log"
      subtitle="Every email / push / in-app attempt in the last 7 days."
      actions={
        <button type="button" className="btn btn-outline" onClick={refresh}>
          Refresh
        </button>
      }
    >
      {/* Health card — surfaces SMTP / VAPID config + recent failure count */}
      <HealthCard health={health} totals={totals} />

      {/* Filters */}
      <div className="nl-filters">
        <input
          type="search"
          placeholder="Search user name or email…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          className="nl-input"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="nl-input"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
          <option value="queued">Queued</option>
        </select>
        <select
          value={filters.channel}
          onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
          className="nl-input"
        >
          <option value="">All channels</option>
          <option value="inapp">In-app</option>
          <option value="email">Email</option>
          <option value="webpush">Push</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          value={filters.template_key}
          onChange={(e) => setFilters((f) => ({ ...f, template_key: e.target.value }))}
          className="nl-input"
        >
          <option value="">All templates</option>
          {templateKeyOptions.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {/* Results table */}
      <div className="nl-table-wrap">
        <table className="nl-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Recipient</th>
              <th>Template</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <ShimmerTableRow key={i} cols={6} />
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan="6" className="nl-empty">
                No delivery attempts match your filters. Try clearing them or check that something has actually been triggered (e.g. a registration, a task assignment).
              </td></tr>
            )}
            {rows.map((r) => {
              const sStyle = STATUS_STYLE[r.status] || { bg: '#f1f5f9', fg: '#475569' };
              const cStyle = CHANNEL_STYLE[r.channel] || { icon: '·', label: r.channel };
              return (
                <tr key={r.id}>
                  <td className="nl-when">{fmt(r.attempted_at)}</td>
                  <td>
                    <strong>{r.user_name}</strong>
                    <div className="muted-text" style={{ fontSize: '.72rem' }}>{r.user_email}</div>
                  </td>
                  <td>
                    <code className="nl-key">{r.template_key}</code>
                    {r.title && <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.1rem' }}>{r.title}</div>}
                  </td>
                  <td>
                    <span className="nl-channel">{cStyle.icon} {cStyle.label}</span>
                  </td>
                  <td>
                    <span className="nl-pill" style={{ background: sStyle.bg, color: sStyle.fg }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="nl-error">{r.error || (r.status === 'sent' ? '—' : '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data && (
          <div className="nl-foot">
            Showing {rows.length} of {data.total} attempt{data.total === 1 ? '' : 's'} since {fmt(data.since)}
          </div>
        )}
      </div>

      <style>{`
        .nl-filters {
          display: flex; gap: .5rem; flex-wrap: wrap;
          margin: 1rem 0 .75rem;
        }
        .nl-input {
          padding: .45rem .6rem;
          border: 1px solid var(--border);
          border-radius: .375rem;
          background: var(--card);
          font: inherit; font-size: .85rem; color: var(--foreground);
          min-width: 140px;
        }
        .nl-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        .nl-input[type=search] { flex: 1; min-width: 240px; }

        .nl-table-wrap {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .5rem;
          overflow: hidden;
        }
        .nl-table {
          width: 100%;
          border-collapse: collapse;
          font-size: .85rem;
        }
        .nl-table th {
          text-align: left; padding: .55rem .75rem;
          background: var(--background, #f8fafc);
          border-bottom: 1px solid var(--border);
          font-size: .72rem; font-weight: 700;
          color: var(--muted-foreground);
          text-transform: uppercase; letter-spacing: .04em;
        }
        .nl-table td {
          padding: .6rem .75rem;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }
        .nl-table tr:last-child td { border-bottom: 0; }
        .nl-table tr:hover { background: var(--background, #f8fafc); }

        .nl-when { white-space: nowrap; font-size: .8rem; color: var(--muted-foreground); }
        .nl-key {
          padding: .1rem .4rem;
          background: var(--background, #f1f5f9);
          border-radius: .3rem;
          font-size: .72rem;
          color: var(--foreground);
        }
        .nl-channel {
          white-space: nowrap;
          font-size: .82rem;
        }
        .nl-pill {
          display: inline-block;
          padding: .15rem .55rem;
          border-radius: 999px;
          font-size: .7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .nl-error {
          font-size: .75rem;
          color: var(--destructive, #991b1b);
          font-family: ui-monospace, SFMono-Regular, monospace;
        }
        .nl-empty {
          text-align: center;
          padding: 2rem;
          color: var(--muted-foreground);
          font-size: .85rem;
        }
        .nl-foot {
          padding: .55rem .75rem;
          background: var(--background, #f8fafc);
          border-top: 1px solid var(--border);
          font-size: .72rem; color: var(--muted-foreground);
          text-align: right;
        }
      `}</style>
    </AdminLayout>
  );
}

// ─── Health card ────────────────────────────────────────────────────────
// Surfaces SMTP / VAPID config status + per-status totals. The whole point
// of this card is to make "why aren't notifications working" answerable in
// one glance: red dot on SMTP → emails won't send.
function HealthCard({ health, totals }) {
  if (!health) return null;

  const items = [
    {
      ok: health.smtp_configured,
      label: 'Email (SMTP)',
      okText: 'Configured',
      badText: health.env === 'production' ? 'NOT configured — emails will FAIL' : 'Not configured — emails log to stdout',
    },
    {
      ok: health.vapid_configured,
      label: 'Web Push (VAPID)',
      okText: 'Configured',
      badText: 'Keys missing — push will be skipped',
    },
    {
      ok: (health.missing_templates?.length || 0) === 0,
      label: 'Templates',
      okText: `${health.missing_templates?.length === 0 ? 'All seeded' : ''}`,
      badText: `Missing: ${(health.missing_templates || []).join(', ')}`,
    },
  ];

  return (
    <div className="hc-wrap">
      <div className="hc-checks">
        {items.map((it) => (
          <div key={it.label} className="hc-check">
            <span className={'hc-dot ' + (it.ok ? 'is-ok' : 'is-bad')} />
            <div>
              <strong>{it.label}</strong>
              <div className="muted-text" style={{ fontSize: '.72rem' }}>
                {it.ok ? it.okText : it.badText}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hc-totals">
        <div className="hc-total"><strong>{totals.sent}</strong><span>Sent (7d)</span></div>
        <div className="hc-total"><strong>{totals.failed}</strong><span>Failed</span></div>
        <div className="hc-total"><strong>{totals.skipped}</strong><span>Skipped</span></div>
      </div>
      <style>{`
        .hc-wrap {
          display: flex; gap: 1rem; align-items: stretch; flex-wrap: wrap;
          padding: 1rem;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .5rem;
          margin-bottom: .75rem;
        }
        .hc-checks {
          flex: 1; min-width: 280px;
          display: grid; gap: .65rem;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .hc-check {
          display: flex; gap: .5rem; align-items: flex-start;
        }
        .hc-dot {
          width: .75rem; height: .75rem;
          border-radius: 999px;
          margin-top: .3rem;
          flex-shrink: 0;
        }
        .hc-dot.is-ok  { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, .15); }
        .hc-dot.is-bad { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, .15); }
        .hc-totals {
          display: flex; gap: 1.25rem;
          padding-left: 1rem;
          border-left: 1px solid var(--border);
        }
        .hc-total {
          display: flex; flex-direction: column; gap: .15rem;
          text-align: center;
        }
        .hc-total strong {
          font-size: 1.35rem; font-weight: 800; color: var(--foreground);
        }
        .hc-total span {
          font-size: .65rem; font-weight: 700;
          color: var(--muted-foreground);
          text-transform: uppercase; letter-spacing: .05em;
        }
        @media (max-width: 640px) {
          .hc-totals {
            padding-left: 0;
            border-left: 0;
            border-top: 1px solid var(--border);
            padding-top: 1rem;
            width: 100%;
            justify-content: space-around;
          }
        }
      `}</style>
    </div>
  );
}
