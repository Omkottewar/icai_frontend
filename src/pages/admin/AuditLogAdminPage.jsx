import { useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import { useAdminList } from '../../hooks/useAdminList';

// Admin audit-log browser — the "who did what, when" firehose.
//
// Powered by /api/admin/audit-log which returns rows joined with `users`
// so we render actor name inline. Filters: entity_type, action, since,
// until. Row click opens a drawer with the full before/after diff so the
// admin can see exactly which fields flipped.
//
// See lib/audit.ts on the backend for the write side + list of entity_type
// values currently emitting audit events.

const ENTITY_LABEL = {
  articleship_matches: 'Articleship match',
  mentorship_requests: 'Mentorship request',
  job_postings:        'Job posting',
};

const ACTION_LABEL = {
  created:         'Created',
  updated:         'Updated',
  deleted:         'Deleted',
  status_changed:  'Status changed',
  reassigned:      'Reassigned',
};

const ACTION_TONE = {
  created:        { bg: 'oklch(0.94 0.10 145 / .5)', fg: 'oklch(0.30 0.14 145)' },
  updated:        { bg: 'oklch(0.94 0.06 255 / .5)', fg: 'oklch(0.30 0.13 255)' },
  deleted:        { bg: 'oklch(0.94 0.10 25 / .5)',  fg: 'oklch(0.35 0.14 25)' },
  status_changed: { bg: 'oklch(0.94 0.10 70 / .5)',  fg: 'oklch(0.35 0.15 60)' },
  reassigned:     { bg: 'oklch(0.94 0.10 300 / .5)', fg: 'oklch(0.30 0.13 300)' },
};

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function ActionPill({ action }) {
  const tone = ACTION_TONE[action] || { bg: 'var(--muted)', fg: 'var(--muted-foreground)' };
  const label = ACTION_LABEL[action] || action;
  return (
    <span style={{
      padding: '.15rem .55rem', borderRadius: 999,
      fontSize: '.68rem', fontWeight: 700,
      background: tone.bg, color: tone.fg,
    }}>{label}</span>
  );
}

export default function AuditLogAdminPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [since, setSince] = useState('');
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState(null);

  const params = useMemo(() => ({
    entity_type: entityType,
    action,
    since: since ? new Date(since).toISOString() : '',
    page,
    pageSize: 50,
  }), [entityType, action, since, page]);

  const { data, loading } = useAdminList('/api/admin/audit-log', params);

  const columns = useMemo(() => [
    { key: 'when', header: 'When', render: (r) => fmtDateTime(r.occurred_at), width: 170 },
    {
      key: 'actor', header: 'Actor', render: (r) => r.actor_name
        ? (
          <div>
            <div style={{ fontSize: '.85rem' }}>{r.actor_name}</div>
            <div className="muted-text" style={{ fontSize: '.7rem' }}>{r.actor_email}</div>
          </div>
        )
        : <span className="muted-text">system</span>,
      width: 200,
    },
    {
      key: 'action', header: 'Action', render: (r) => <ActionPill action={r.action} />, width: 140,
    },
    {
      key: 'entity', header: 'Entity', render: (r) => (
        <div>
          <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{ENTITY_LABEL[r.entity_type] ?? r.entity_type}</div>
          {r.entity_id && (
            <div className="muted-text" style={{ fontSize: '.7rem', fontFamily: 'monospace' }}>{r.entity_id.slice(0, 8)}…</div>
          )}
        </div>
      ),
    },
    {
      key: 'changed', header: 'Fields', render: (r) => {
        const fields = Array.isArray(r.changed_fields) ? r.changed_fields : [];
        if (fields.length === 0) return <span className="muted-text">—</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.2rem' }}>
            {fields.slice(0, 4).map((f) => (
              <span key={f} style={{ fontSize: '.65rem', padding: '.1rem .35rem', borderRadius: '.25rem', background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{f}</span>
            ))}
            {fields.length > 4 && <span className="muted-text" style={{ fontSize: '.7rem' }}>+{fields.length - 4}</span>}
          </div>
        );
      },
    },
  ], []);

  return (
    <AdminLayout
      title="Audit log"
      subtitle="Every write across the portal — who changed what, and when"
    >
      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={page}
        pageSize={data?.pageSize ?? 50}
        onPageChange={setPage}
        onRowClick={(r) => setOpenRow(r)}
        emptyMessage="No audit rows match those filters. Try clearing the entity or date filter."
        filters={
          <>
            <select className="input-base" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
              <option value="">All entity types</option>
              {Object.entries(ENTITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select className="input-base" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
              <option value="">All actions</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="date"
              className="input-base"
              value={since}
              onChange={(e) => { setSince(e.target.value); setPage(1); }}
              style={{ maxWidth: 180 }}
              title="Since (inclusive)"
            />
          </>
        }
      />

      <AuditDrawer row={openRow} onClose={() => setOpenRow(null)} />
    </AdminLayout>
  );
}

function AuditDrawer({ row, onClose }) {
  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      title={row ? `${ACTION_LABEL[row.action] ?? row.action} — ${ENTITY_LABEL[row.entity_type] ?? row.entity_type}` : 'Audit entry'}
      width={640}
    >
      {row && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
          <section className="card" style={{ padding: '.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.5rem' }}>
              <Meta label="When" value={fmtDateTime(row.occurred_at)} />
              <Meta label="Actor" value={row.actor_name || 'system'} />
              {row.actor_email && <Meta label="Actor email" value={row.actor_email} />}
              {row.actor_role_code && <Meta label="Actor role" value={row.actor_role_code} />}
              {row.actor_ip && <Meta label="IP" value={row.actor_ip} />}
            </div>
            {row.entity_id && (
              <div style={{ marginTop: '.4rem', fontSize: '.75rem', color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>
                Entity ID: {row.entity_id}
              </div>
            )}
            {row.note && (
              <div style={{ marginTop: '.55rem' }}>
                <div className="muted-text" style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>Note</div>
                <div style={{ fontSize: '.85rem', marginTop: '.15rem', whiteSpace: 'pre-wrap' }}>{row.note}</div>
              </div>
            )}
          </section>

          <DiffView before={row.before_json} after={row.after_json} changed={row.changed_fields} />
        </div>
      )}
    </Drawer>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="muted-text" style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '.85rem', marginTop: '.15rem' }}>{value}</div>
    </div>
  );
}

// Renders the before/after diff as three columns. Fields listed in
// `changed` are highlighted; the rest are shown collapsed.
export function DiffView({ before, after, changed }) {
  const changedSet = new Set(Array.isArray(changed) ? changed : []);
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  const rows = Array.from(keys).sort((a, b) => {
    // changed keys first
    const aC = changedSet.has(a); const bC = changedSet.has(b);
    if (aC !== bC) return aC ? -1 : 1;
    return a.localeCompare(b);
  });

  if (rows.length === 0) {
    return (
      <section className="card" style={{ padding: '.9rem' }}>
        <p className="muted-text" style={{ fontSize: '.85rem', margin: 0 }}>
          No before/after payload captured for this action.
        </p>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: '.9rem' }}>
      <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0, marginBottom: '.55rem' }}>
        Changes
      </h3>
      <div style={{ display: 'grid', gap: '.35rem' }}>
        {rows.map((k) => {
          const bv = before?.[k];
          const av = after?.[k];
          const isChanged = changedSet.has(k);
          return (
            <div
              key={k}
              style={{
                padding: '.4rem .55rem',
                borderRadius: '.3rem',
                background: isChanged ? 'oklch(0.94 0.10 60 / .5)' : 'transparent',
                border: '1px solid ' + (isChanged ? 'oklch(0.85 0.10 60 / .5)' : 'transparent'),
                fontSize: '.78rem',
              }}
            >
              <div style={{ fontWeight: 600, color: isChanged ? 'oklch(0.35 0.14 60)' : 'var(--foreground)' }}>{k}</div>
              {isChanged ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '.4rem', alignItems: 'baseline', marginTop: '.15rem' }}>
                  <code style={{ fontSize: '.72rem', wordBreak: 'break-all', background: '#fee2e2', color: '#991b1b', padding: '.15rem .35rem', borderRadius: '.2rem' }}>
                    {stringify(bv)}
                  </code>
                  <span aria-hidden style={{ color: 'var(--muted-foreground)' }}>→</span>
                  <code style={{ fontSize: '.72rem', wordBreak: 'break-all', background: '#dcfce7', color: '#065f46', padding: '.15rem .35rem', borderRadius: '.2rem' }}>
                    {stringify(av)}
                  </code>
                </div>
              ) : (
                <code style={{ fontSize: '.72rem', color: 'var(--muted-foreground)', wordBreak: 'break-all' }}>
                  {stringify(av ?? bv)}
                </code>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function stringify(v) {
  if (v === null) return 'null';
  if (v === undefined) return '(unset)';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 0);
  } catch {
    return String(v);
  }
}
