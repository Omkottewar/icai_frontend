import { useEffect, useState } from 'react';
import { adminFetch } from '../../hooks/useAdminList';
import { DiffView } from '../../pages/admin/AuditLogAdminPage';

// Reusable "History" section for admin drawers. Given an entity_type +
// entity_id, fetches the version list from
// /api/admin/audit-log/versions/:entity_type/:entity_id and renders a
// collapsible per-version block with the snapshot's changed fields.
//
// Use it wherever you want a per-entity history panel — one component,
// works for every entity_type that opts into saveVersion() on the
// backend.

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function EntityHistorySection({ entityType, entityId }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!entityType || !entityId) { setItems([]); return; }
    let cancelled = false;
    setItems(null); setError(null);
    adminFetch(`/api/admin/audit-log/versions/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
      .then((j) => { if (!cancelled) setItems(j.items || []); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  if (!entityType || !entityId) return null;

  return (
    <section className="card" style={{ padding: '.9rem' }}>
      <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
        History
      </h3>

      {error && <p className="muted-text" style={{ fontSize: '.8rem', color: '#991b1b', margin: '.4rem 0 0' }}>{error}</p>}
      {items === null && !error && (
        <p className="muted-text" style={{ fontSize: '.85rem', margin: '.4rem 0 0' }}>Loading…</p>
      )}
      {items && items.length === 0 && (
        <p className="muted-text" style={{ fontSize: '.85rem', margin: '.4rem 0 0' }}>
          No versioned changes recorded yet. History rows are captured on status transitions and reassignments.
        </p>
      )}
      {items && items.length > 0 && (
        <div style={{ marginTop: '.5rem', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
          {items.map((v, i) => {
            const isOpen = openId === v.id;
            const prev = items[i + 1]; // next in the newest-first list = the previous version
            return (
              <div key={v.id} style={{
                border: '1px solid var(--border)', borderRadius: '.35rem',
              }}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : v.id)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent',
                    border: 0, cursor: 'pointer', padding: '.5rem .65rem',
                    display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '.5rem', alignItems: 'center',
                  }}
                >
                  <span style={{
                    fontSize: '.7rem', fontWeight: 700, padding: '.15rem .45rem',
                    borderRadius: 999, background: 'oklch(0.36 0.13 255 / 0.10)', color: 'var(--primary)',
                  }}>v{v.version_number}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 600 }}>
                      {v.change_note || 'Snapshot'}
                    </div>
                    <div className="muted-text" style={{ fontSize: '.7rem' }}>
                      {v.saved_by_name || 'system'} · {fmtDateTime(v.saved_at)}
                    </div>
                  </div>
                  <span aria-hidden style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '.4rem .65rem .65rem', borderTop: '1px solid var(--border)' }}>
                    <DiffView
                      before={prev?.snapshot_json ?? null}
                      after={v.snapshot_json}
                      changed={diffKeys(prev?.snapshot_json, v.snapshot_json)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Shallow-diff — same convention as backend/lib/audit.ts. Deep values are
// JSON-compared, which is good enough for the flat row snapshots we're
// storing.
function diffKeys(before, after) {
  if (!before || !after) return Object.keys(after ?? before ?? {});
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}
