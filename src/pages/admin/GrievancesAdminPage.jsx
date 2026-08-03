import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import { IconX, IconCheckCircle } from '../../icons';
import { Shimmer } from '../../components/ui/Shimmer';

const TABS = [
  { key: 'open',      label: 'Open' },
  { key: 'in_review', label: 'In review' },
  { key: 'resolved',  label: 'Resolved' },
  { key: 'closed',    label: 'Closed' },
  { key: 'all',       label: 'All' },
];

const STATUS_OPTIONS = [
  { value: 'open',      label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved',  label: 'Resolved' },
  { value: 'closed',    label: 'Closed' },
];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function ago(d) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function GrievancesAdminPage() {
  const { showToast } = useAuth();
  const { query } = useRoute();
  const [tab, setTab] = useState('open');
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState({ open: 0, in_review: 0, resolved: 0, closed: 0 });
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);
  // Search + pagination (backend supports both since F28).
  const [queryInput, setQueryInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  // Debounced search — reset to page 1 when query changes.
  useEffect(() => {
    const t = setTimeout(() => { setQ(queryInput.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      if (query.ticket_no) params.set('ticket_no', query.ticket_no);
      if (q) params.set('q', q);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/admin/grievances?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/admin/grievances/stats',                 { credentials: 'include' }),
      ]);
      if (!listRes.ok) throw new Error('Could not load grievances');
      const list = await listRes.json();
      setItems(list.items);
      setTotal(list.total ?? list.items?.length ?? 0);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, query.ticket_no, q, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    if (q) params.set('q', q);
    const s = params.toString();
    return `/api/admin/grievances/export.csv${s ? '?' + s : ''}`;
  }, [tab, q]);

  // Auto-open the deep-linked ticket once the list arrives.
  useEffect(() => {
    if (!items || !query.ticket_no) return;
    const hit = items.find((i) => i.ticket_no === query.ticket_no);
    if (hit) setEditing(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const save = async (patch) => {
    if (!editing) return;
    try {
      const r = await fetch(`/api/admin/grievances/${editing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      showToast?.('Saved', 'success');
      setEditing(j.item);
      load();
    } catch (e) {
      showToast?.(e.message, 'error');
    }
  };

  return (
    <AdminLayout
      title="Grievances"
      subtitle="Contact, grievance and suggestion submissions from the public form"
      actions={
        <a href={exportUrl} className="btn btn-outline" style={{ padding: '.5rem 1rem', textDecoration: 'none' }}>
          ⬇ Export CSV
        </a>
      }
    >
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      <div className="row gap-2" style={{ marginBottom: '.75rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const count = t.key === 'all'
            ? Object.values(stats).reduce((a, b) => a + b, 0)
            : stats[t.key] ?? 0;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={active ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ paddingInline: '.9rem' }}>
              {t.label}
              <span style={{
                marginLeft: '.5rem', fontSize: '.75rem', fontWeight: 600,
                background: active ? 'rgba(255,255,255,.25)' : 'var(--muted, #f1f5f9)',
                padding: '.1rem .45rem', borderRadius: '999px',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.75rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value.slice(0, 120))}
          placeholder="Search by name, email, or ticket…"
          className="input-base"
          style={{ maxWidth: 340, fontSize: '.85rem' }}
        />
        <span className="muted-text" style={{ fontSize: '.75rem', marginLeft: 'auto' }}>
          {total} result{total === 1 ? '' : 's'}
        </span>
      </div>

      {!items && !err && (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                <Shimmer height=".9rem" width={`${50 + ((i * 11) % 30)}%`} />
                <Shimmer height=".7rem" width="50%" />
              </div>
              <Shimmer height="1.1rem" width="4rem" radius="999px" />
            </div>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">Nothing here yet.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Ticket</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>From</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Subject</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Against</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Age</th>
                <th style={{ padding: '.75rem' }}>{/* newsletter flag */}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setEditing(row)}>
                  <td style={{ padding: '.75rem', fontFamily: 'ui-monospace, monospace', fontSize: '.8rem' }}>{row.ticket_no}</td>
                  <td style={{ padding: '.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                    <div className="muted-text" style={{ fontSize: '.75rem' }}>{row.email}</div>
                  </td>
                  <td style={{ padding: '.75rem' }}>{row.subject}</td>
                  <td style={{ padding: '.75rem' }}>
                    {row.against_type}{row.against_ref ? ` · ${row.against_ref}` : ''}
                  </td>
                  <td style={{ padding: '.75rem' }}>{row.status}</td>
                  <td style={{ padding: '.75rem', fontSize: '.8rem' }}>{ago(row.created_at)}</td>
                  <td style={{ padding: '.75rem', textAlign: 'center' }}>
                    {row.feature_in_newsletter ? <IconCheckCircle size="sm" /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items && items.length > 0 && totalPages > 1 && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '.9rem', fontSize: '.8rem' }}>
          <button type="button" className="btn btn-outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}>← Previous</button>
          <span className="muted-text">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}>Next →</button>
        </div>
      )}

      {editing && (
        <GrievanceDrawer item={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </AdminLayout>
  );
}

function GrievanceDrawer({ item, onClose, onSave }) {
  const [status, setStatus] = useState(item.status);
  const [note, setNote]     = useState(item.resolution_note ?? '');
  const [featured, setFeatured] = useState(item.feature_in_newsletter ?? false);

  // Keep the local form state in sync if the parent refreshes the row after a save.
  useEffect(() => {
    setStatus(item.status);
    setNote(item.resolution_note ?? '');
    setFeatured(item.feature_in_newsletter ?? false);
  }, [item.id, item.status, item.resolution_note, item.feature_in_newsletter]);

  const dirty = useMemo(() => (
    status !== item.status
    || (note || '') !== (item.resolution_note || '')
    || featured !== item.feature_in_newsletter
  ), [status, note, featured, item]);

  return (
    <div className="modal-backdrop" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: 'min(560px, 95vw)', height: '100vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)', borderRadius: 0 }}>
        <div className="row" style={{ alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
            {item.ticket_no}
          </h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
            <IconX size="sm" />
          </button>
        </div>

        <dl className="muted-text" style={{ fontSize: '.85rem', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '.35rem .75rem' }}>
          <dt>From</dt><dd>{item.name} &lt;{item.email}&gt;{item.phone ? ` · ${item.phone}` : ''}</dd>
          <dt>Subject</dt><dd>{item.subject}</dd>
          <dt>Against</dt><dd>{item.against_type}{item.against_ref ? ` · ${item.against_ref}` : ''}</dd>
          <dt>Filed</dt><dd>{fmt(item.created_at)}</dd>
          {item.resolved_at && <><dt>Resolved</dt><dd>{fmt(item.resolved_at)}</dd></>}
        </dl>

        <div style={{ marginTop: '1.25rem', padding: '.75rem', background: 'var(--muted, #f1f5f9)', borderRadius: '.4rem', whiteSpace: 'pre-wrap', fontSize: '.875rem' }}>
          {item.message}
        </div>

        <div className="col gap-3" style={{ marginTop: '1.5rem' }}>
          <div>
            <label className="field-label">Status</label>
            <select className="input-base" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Resolution note (visible on track page)</label>
            <textarea className="input-base" rows={4} value={note} maxLength={5000}
              onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="row gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <span>Feature this case in the newsletter (chairperson's discretion)</span>
          </label>

          <div className="row gap-2" style={{ marginTop: '.5rem' }}>
            <button className="btn btn-primary" disabled={!dirty}
              onClick={() => onSave({ status, resolution_note: note, feature_in_newsletter: featured })}>
              Save changes
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
