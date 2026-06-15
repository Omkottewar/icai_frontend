import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX } from '../../icons';

const EMPTY = { subject: '', label: '', route_email: '', active: true };

export default function GrievanceRoutesAdminPage() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/admin/grievance-routes', { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load routes');
      const j = await r.json();
      setItems(j.items);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (row) => {
    setForm({ subject: row.subject, label: row.label, route_email: row.route_email, active: row.active });
    setEditing(row);
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const isNew = editing === 'new';
      const url    = isNew ? '/api/admin/grievance-routes' : `/api/admin/grievance-routes/${editing.subject}`;
      const method = isNew ? 'POST' : 'PATCH';
      // On PATCH we don't send subject (it's the URL key).
      const body = isNew ? form : { label: form.label, route_email: form.route_email, active: form.active };
      const r = await fetch(url, {
        method, credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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
    if (row.subject === 'other') {
      showToast?.('The "other" fallback route cannot be deleted', 'error');
      return;
    }
    if (!confirm(`Delete the "${row.label}" route?`)) return;
    const r = await fetch(`/api/admin/grievance-routes/${row.subject}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { showToast?.('Deleted', 'success'); load(); }
    else      { showToast?.('Could not delete', 'error'); }
  };

  return (
    <AdminLayout title="Grievance routing" subtitle="Map each Contact-form subject to the email inbox that handles it.">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New route</button>
      </div>

      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {!items && !err && <p className="muted-text">Loading…</p>}

      {items && items.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">No routes configured yet. Submissions will be rejected until at least an "other" fallback exists.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Subject key</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Label</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Route email</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Active</th>
                <th style={{ textAlign: 'right', padding: '.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.subject} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '.75rem', fontFamily: 'ui-monospace, monospace', fontSize: '.8rem' }}>{row.subject}</td>
                  <td style={{ padding: '.75rem' }}>{row.label}</td>
                  <td style={{ padding: '.75rem' }}>{row.route_email}</td>
                  <td style={{ padding: '.75rem' }}>{row.active ? 'Yes' : 'No'}</td>
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
            style={{ width: 'min(520px, 95vw)', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, marginBottom: '1rem' }}>
              {editing === 'new' ? 'New route' : `Edit "${editing.label}"`}
            </h2>

            <div className="col gap-3">
              <div>
                <label className="field-label">Subject key *</label>
                <input className="input-base" value={form.subject} maxLength={64}
                  disabled={editing !== 'new'}
                  onChange={(e) => update('subject', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
                <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>
                  Lowercase, alphanumeric + underscores. e.g. <code>events</code>, <code>membership_updation</code>. Cannot be changed once set.
                </div>
              </div>
              <div>
                <label className="field-label">Label *</label>
                <input className="input-base" value={form.label} maxLength={120}
                  onChange={(e) => update('label', e.target.value)}
                  placeholder="Shown in the dropdown — e.g. Events" />
              </div>
              <div>
                <label className="field-label">Route email *</label>
                <input className="input-base" type="email" value={form.route_email}
                  onChange={(e) => update('route_email', e.target.value)} />
              </div>
              <label className="row gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
                <span>Show in the public form</span>
              </label>
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
