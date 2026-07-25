import { useEffect, useState } from 'react';
import { navigate } from '../../hooks/useRoute';

// Real-time smart-alerts strip. Polls /api/admin/insights/alerts on mount
// and again every 90s. Renders a compact banner-per-alert; each alert has
// a severity, a one-line detail, and a link to the admin page that
// resolves it. Empty alert list → the widget hides itself, so there's no
// visual noise on a happy-path day.

const SEVERITY = {
  critical: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', icon: '⚠' },
  warn:     { bg: '#fef3c7', border: '#fcd34d', color: '#92400e', icon: '⚡' },
  info:     { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', icon: 'ⓘ' },
};

export default function AlertsWidget({ filter }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('admin-alerts-dismissed') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    const load = () => {
      fetch('/api/admin/insights/alerts', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => setAlerts(Array.isArray(j.alerts) ? j.alerts : []))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, []);

  const dismiss = (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try { sessionStorage.setItem('admin-alerts-dismissed', JSON.stringify(Array.from(next))); } catch {}
  };

  const shown = alerts
    .filter((a) => !dismissed.has(a.id))
    .filter((a) => (filter ? filter(a) : true));

  if (shown.length === 0) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '.5rem',
      marginBottom: '1.25rem',
    }}>
      {shown.map((a) => {
        const s = SEVERITY[a.severity] || SEVERITY.info;
        return (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: '.75rem',
            padding: '.55rem .85rem',
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: '.5rem', color: s.color, fontSize: '.88rem',
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }} aria-hidden="true">{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div style={{ fontSize: '.78rem', opacity: 0.85 }}>{a.detail}</div>
            </div>
            {a.href && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); navigate(a.href); }}
                style={{
                  padding: '.3rem .7rem', fontSize: '.78rem', fontWeight: 600,
                  background: 'transparent', color: s.color, border: `1px solid ${s.border}`,
                  borderRadius: '.35rem', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >Open</button>
            )}
            <button
              type="button" onClick={() => dismiss(a.id)}
              style={{
                background: 'transparent', color: s.color, border: 0,
                cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1,
                padding: '.15rem .3rem', opacity: 0.6,
              }}
              aria-label="Dismiss"
            >×</button>
          </div>
        );
      })}
    </div>
  );
}
