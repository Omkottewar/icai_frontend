import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX, IconDownload, IconTrash } from '../../icons';

// Read-only + soft-unsub view of job alert subscribers. CSV export goes
// through the backend so admins can filter before downloading.

const STATUS_LABEL = {
  active:      'Active',
  unconfirmed: 'Pending confirmation',
  unsub:       'Unsubscribed',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function JobSubscribersAdminPage() {
  const { showToast } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const qs = new URLSearchParams({ q, status, category, type, page: String(page), pageSize: '25' });
    try {
      const r = await fetch('/api/admin/job-subscribers?' + qs, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load subscribers');
      setData(await r.json());
    } catch (e) { setErr(e.message); }
  }, [q, status, category, type, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/admin/job-categories', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((j) => setCats(j.items || []));
  }, []);

  async function unsub(row) {
    if (!window.confirm(`Unsubscribe ${row.user_email} from "${row.category_name}" (${row.posting_type})?`)) return;
    try {
      const r = await fetch(`/api/admin/job-subscribers/${row.id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed');
      showToast?.('Unsubscribed', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  }

  function exportCsv() {
    const qs = new URLSearchParams({ status, category, type });
    window.open('/api/admin/job-subscribers/export?' + qs, '_blank');
  }

  const rows = data?.rows ?? null;
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;

  return (
    <AdminLayout
      title="Job alert subscribers"
      subtitle="Who's subscribed to which category. Read-only — use ✕ to unsubscribe on behalf of a user."
      actions={
        <button className="btn btn-primary" onClick={exportCsv} style={{ padding: '.5rem 1rem' }}>
          <IconDownload size="sm" /> Export CSV
        </button>
      }
    >
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          className="input-base" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search by name or email…"
          style={{ maxWidth: 260 }}
        />
        <select className="input-base" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 220 }}>
          <option value="">All statuses</option>
          <option value="active">{STATUS_LABEL.active}</option>
          <option value="unconfirmed">{STATUS_LABEL.unconfirmed}</option>
          <option value="unsub">{STATUS_LABEL.unsub}</option>
        </select>
        <select className="input-base" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} style={{ maxWidth: 220 }}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input-base" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
          <option value="">All types</option>
          <option value="job">Job</option>
          <option value="articleship">Articleship</option>
          <option value="assignment">Assignment</option>
        </select>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
          <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '.6rem' }}>Subscriber</th>
              <th style={{ textAlign: 'left', padding: '.6rem' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '.6rem' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '.6rem' }}>Frequency</th>
              <th style={{ textAlign: 'left', padding: '.6rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '.6rem' }}>Subscribed</th>
              <th style={{ padding: '.6rem' }} />
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center' }} className="muted-text">Loading…</td></tr>
            )}
            {rows && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center' }} className="muted-text">No subscribers match this filter.</td></tr>
            )}
            {rows && rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '.6rem' }}>
                  <div style={{ fontWeight: 600 }}>{r.user_name}</div>
                  <div className="muted-text" style={{ fontSize: '.72rem' }}>{r.user_email} · {r.user_role}</div>
                </td>
                <td style={{ padding: '.6rem' }}>{r.category_name}</td>
                <td style={{ padding: '.6rem', textTransform: 'capitalize' }}>{r.posting_type}</td>
                <td style={{ padding: '.6rem', textTransform: 'capitalize' }}>{r.frequency.replace('_', ' ')}</td>
                <td style={{ padding: '.6rem' }}>
                  {r.unsubscribed_at ? STATUS_LABEL.unsub
                    : r.confirmed_at ? STATUS_LABEL.active
                    : STATUS_LABEL.unconfirmed}
                </td>
                <td style={{ padding: '.6rem' }}>{fmtDate(r.created_at)}</td>
                <td style={{ padding: '.6rem', textAlign: 'right' }}>
                  {!r.unsubscribed_at && (
                    <button type="button" className="btn btn-ghost" onClick={() => unsub(r)} title="Unsubscribe on their behalf">
                      <IconTrash size="sm" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'flex-end', marginTop: '.75rem' }}>
          <button className="btn btn-outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Prev</button>
          <span className="muted-text" style={{ fontSize: '.85rem' }}>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
          <button className="btn btn-outline" onClick={() => setPage(page + 1)} disabled={page * pageSize >= total}>Next</button>
        </div>
      )}
    </AdminLayout>
  );
}
