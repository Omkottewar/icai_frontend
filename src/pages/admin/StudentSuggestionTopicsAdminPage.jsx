import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { Shimmer } from '../../components/ui/Shimmer';
import { IconPlus, IconEdit, IconTrash, IconX, IconCheck } from '../../icons';

// CRUD for the topic buckets students pick from when submitting a
// suggestion. Topics ship with five defaults (Curriculum / Events /
// Facilities / Mentorship / Other) but the admin can rename, reorder,
// disable, or add new ones here.
//
// Codes are lowercase ascii (used as filter query params on the public
// page) — the form generates one from the name if the admin doesn't
// supply one. Disabled topics stop appearing in the submit dropdown but
// keep showing on existing approved suggestions so historical data
// stays intact.

function codeFromName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
}

export default function StudentSuggestionTopicsAdminPage() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);    // row being edited, or {new:true} for new
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch('/api/admin/student-suggestion-topics', { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load topics');
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); setRows([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setBusy(true);
    try {
      const isNew = !!form.new;
      const url = isNew
        ? '/api/admin/student-suggestion-topics'
        : `/api/admin/student-suggestion-topics/${form.id}`;
      const payload = isNew
        ? { code: form.code, name: form.name, description: form.description, sort_order: form.sort_order }
        : { name: form.name, description: form.description, active: form.active, sort_order: form.sort_order };
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Save failed');
      showToast?.(isNew ? 'Topic created' : 'Topic updated', 'success');
      setEditing(null);
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const del = async (row) => {
    if (!window.confirm(`Delete topic "${row.name}"?\n\nOnly possible if no suggestions still reference it.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/student-suggestion-topics/${row.id}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Delete failed');
      showToast?.('Topic deleted', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const toggleActive = async (row) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/student-suggestion-topics/${row.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !row.active }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Update failed');
      showToast?.(row.active ? 'Topic disabled' : 'Topic enabled', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const headerActions = (
    <button type="button" className="btn btn-primary"
      onClick={() => setEditing({ new: true, code: '', name: '', description: '', sort_order: (rows?.length ?? 0) * 10 })}
      style={{ fontSize: '.8125rem' }}>
      <IconPlus size="sm" /> New topic
    </button>
  );

  return (
    <AdminLayout
      title="Suggestion topics"
      subtitle="Buckets students pick from when submitting a suggestion. Disable instead of delete to preserve history."
      actions={headerActions}
    >
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {rows === null && !err && (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: '1rem', padding: '.85rem 1rem', alignItems: 'center' }}>
              <Shimmer height="1rem" width="40%" />
              <Shimmer height=".75rem" width="20%" />
              <div style={{ marginLeft: 'auto' }}><Shimmer height="1.5rem" width="4rem" radius="999px" /></div>
            </div>
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">No topics configured. Create one with the button above.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Sort</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Uses</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Status</th>
                <th style={{ padding: '.75rem' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                    {row.description && (
                      <div className="muted-text" style={{ fontSize: '.75rem' }}>{row.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '.75rem', fontFamily: 'ui-monospace, monospace', fontSize: '.8125rem' }}>
                    {row.code}
                  </td>
                  <td style={{ padding: '.75rem', fontVariantNumeric: 'tabular-nums' }}>{row.sort_order}</td>
                  <td style={{ padding: '.75rem', fontVariantNumeric: 'tabular-nums' }}>{row.suggestions_count ?? 0}</td>
                  <td style={{ padding: '.75rem' }}>
                    <button type="button" className="btn btn-ghost"
                      onClick={() => toggleActive(row)}
                      disabled={busy}
                      style={{
                        fontSize: '.75rem', padding: '.25rem .55rem',
                        background: row.active ? 'oklch(0.92 0.07 145)' : 'var(--muted)',
                        color: row.active ? 'oklch(0.35 0.14 145)' : 'var(--muted-foreground)',
                        fontWeight: 700,
                      }}>
                      {row.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td style={{ padding: '.75rem', textAlign: 'right' }}>
                    <button type="button" className="btn btn-ghost"
                      onClick={() => setEditing({ ...row })}
                      title="Edit"
                      style={{ fontSize: '.8125rem' }}>
                      <IconEdit size="sm" />
                    </button>
                    <button type="button" className="btn btn-ghost"
                      onClick={() => del(row)}
                      disabled={busy || (row.suggestions_count ?? 0) > 0}
                      title={(row.suggestions_count ?? 0) > 0 ? 'In use — disable instead' : 'Delete'}
                      style={{ fontSize: '.8125rem', opacity: (row.suggestions_count ?? 0) > 0 ? .35 : 1 }}>
                      <IconTrash size="sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TopicEditorModal
          row={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </AdminLayout>
  );
}

function TopicEditorModal({ row, busy, onClose, onSave }) {
  const isNew = !!row.new;
  const [name, setName] = useState(row.name || '');
  const [code, setCode] = useState(row.code || '');
  const [description, setDescription] = useState(row.description || '');
  const [sortOrder, setSortOrder] = useState(Number.isFinite(row.sort_order) ? row.sort_order : 0);
  const [active, setActive] = useState(row.active ?? true);

  // For new topics, auto-derive the code as the admin types the name —
  // until they edit the code field manually.
  const [codeTouched, setCodeTouched] = useState(false);
  useEffect(() => {
    if (isNew && !codeTouched) setCode(codeFromName(name));
  }, [isNew, name, codeTouched]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...row,
      name: name.trim(),
      code: code.trim(),
      description: description.trim(),
      sort_order: Number(sortOrder) || 0,
      active,
    });
  };

  return (
    <div className="dialog-overlay" role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" style={{ width: 'min(30rem, 100%)' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">{isNew ? 'New topic' : 'Edit topic'}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <form onSubmit={submit}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
            <label>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Name</div>
              <input className="input-base" value={name}
                onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            </label>
            <label>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Code</div>
              <input className="input-base" value={code}
                onChange={(e) => { setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setCodeTouched(true); }}
                maxLength={32}
                disabled={!isNew}
                title={isNew ? '' : "Codes are immutable to preserve URL filter stability"} />
              <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>
                Used in URL filters. Lowercase letters, digits, underscore.
              </div>
            </label>
            <label>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Description (optional)</div>
              <textarea className="input-base" rows={2} value={description}
                onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </label>
            <label>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Sort order</div>
              <input className="input-base" type="number" value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)} style={{ width: '8rem' }} />
              <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>
                Lower numbers appear first. Use steps of 10 so you can squeeze new topics in later.
              </div>
            </label>
            {!isNew && (
              <label className="row gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Active (visible in the submit dropdown)</span>
              </label>
            )}
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !code.trim()}>
              <IconCheck size="sm" /> {busy ? 'Saving…' : (isNew ? 'Create' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
