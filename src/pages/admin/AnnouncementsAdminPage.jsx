import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX } from '../../icons';

const AUDIENCES = ['all', 'members', 'students', 'employers'];
const EMPTY = {
  title: '', body: '', link_url: '',
  audience: 'all',
  starts_at: '', ends_at: '',
  display_order: 0,
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AnnouncementsAdminPage() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | {...row}
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/admin/announcements', { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load');
      const j = await r.json();
      setItems(j.items);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(EMPTY);
    setEditing('new');
  };
  const openEdit = (row) => {
    setForm({
      title: row.title,
      body: row.body ?? '',
      link_url: row.link_url ?? '',
      audience: row.audience ?? 'all',
      starts_at: row.starts_at ? row.starts_at.slice(0, 16) : '',
      ends_at:   row.ends_at   ? row.ends_at.slice(0, 16)   : '',
      display_order: row.display_order ?? 0,
    });
    setEditing(row);
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const isNew = editing === 'new';
      const url    = isNew ? '/api/admin/announcements' : `/api/admin/announcements/${editing.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      showToast?.('Saved', 'success');
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const del = async (row) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    const r = await fetch(`/api/admin/announcements/${row.id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { showToast?.('Deleted', 'success'); load(); }
    else      { showToast?.('Could not delete', 'error'); }
  };

  return (
    <AdminLayout title="Announcements" subtitle="Homepage ticker items">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New announcement</button>
      </div>

      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {!items && !err && <p className="muted-text">Loading…</p>}

      {items && items.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">No announcements yet.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Title</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Audience</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Window</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Order</th>
                <th style={{ textAlign: 'right', padding: '.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{row.title}</div>
                    {row.link_url && <a href={row.link_url} className="muted-text" style={{ fontSize: '.75rem' }} target="_blank" rel="noreferrer">{row.link_url}</a>}
                  </td>
                  <td style={{ padding: '.75rem' }}>{row.audience}</td>
                  <td style={{ padding: '.75rem', fontSize: '.8rem' }}>
                    {fmt(row.starts_at)} → {fmt(row.ends_at)}
                  </td>
                  <td style={{ padding: '.75rem' }}>{row.display_order}</td>
                  <td style={{ padding: '.75rem', textAlign: 'right' }}>
                    <button className="btn btn-ghost" onClick={() => openEdit(row)}>Edit</button>
                    <button className="btn btn-ghost" style={{ color: '#b91c1c' }} onClick={() => del(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card"
            style={{ width: 'min(600px, 95vw)', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, marginBottom: '1rem' }}>
              {editing === 'new' ? 'New announcement' : 'Edit announcement'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              <div>
                <label className="field-label">Title *</label>
                <input className="input-base" value={form.title} maxLength={200}
                  onChange={(e) => update('title', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Body (optional, for detail page)</label>
                <textarea className="input-base" rows={3} value={form.body}
                  onChange={(e) => update('body', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Link URL (optional)</label>
                <input className="input-base" type="url" value={form.link_url}
                  onChange={(e) => update('link_url', e.target.value)}
                  placeholder="https://…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Audience</label>
                  <select className="input-base" value={form.audience} onChange={(e) => update('audience', e.target.value)}>
                    {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Display order</label>
                  <input className="input-base" type="number" value={form.display_order}
                    onChange={(e) => update('display_order', Number(e.target.value))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Starts at</label>
                  <input className="input-base" type="datetime-local" value={form.starts_at}
                    onChange={(e) => update('starts_at', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Ends at (blank = open-ended)</label>
                  <input className="input-base" type="datetime-local" value={form.ends_at}
                    onChange={(e) => update('ends_at', e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
