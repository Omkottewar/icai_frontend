import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX } from '../../icons';
import { Shimmer } from '../ui/Shimmer';
import { dialog } from '../../lib/dialog';
import Button from '../ui/Button';
import ImageCropper from '../ui/ImageCropper';

// Generic admin CRUD page used by the 5 branch-content entities
// (paper-presentations, gallery-albums, newsletters, office-bearers,
// annual-reports). All five do the same thing: list rows, edit-in-drawer,
// delete. The differences are which columns to show + which form fields
// to render, and those are passed in as `columns` + `fields`.
//
// `fields` is a flat list. Each entry is one of:
//   { name, label, type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox' | 'file' }
//   { name, label, type: 'select', options: [{value, label}] }
//   { name, label, type: 'file', bucket, accept: 'application/pdf' | 'image/*',
//     crop?: boolean,  // when true (image fields only): opens ImageCropper after pick
//     minWidth?, minHeight?: number,  // refuses sources smaller than this
//   }
//   { name, label, type: 'group', children: [field, field] }   // horizontal row
//
// File-type fields produce TWO form keys:
//   - <name>             → the file ID (stored on the row)
//   - <name>__url        → preview URL (local-only, not sent to API)

const EMPTY_FORM = {};

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

// Walks the `fields` config and returns the cleared (new-row) form state.
function buildEmptyForm(fields) {
  const out = {};
  const walk = (list) => list.forEach((f) => {
    if (f.type === 'group') return walk(f.children);
    if (f.type === 'checkbox') out[f.name] = !!f.default;
    else if (f.type === 'number') out[f.name] = f.default ?? 0;
    else out[f.name] = f.default ?? '';
    if (f.type === 'file') out[f.name + '__url'] = '';
  });
  walk(fields);
  return out;
}

// Picks the row → form mapping. Falls back to a passthrough for fields whose
// name matches a row key exactly. Date/datetime fields trim the ISO string so
// <input type="date"> / type="datetime-local" don't render junk.
function rowToForm(row, fields) {
  const out = {};
  const walk = (list) => list.forEach((f) => {
    if (f.type === 'group') return walk(f.children);
    const v = row[f.name];
    if (v == null) {
      out[f.name] = f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '';
    } else if (f.type === 'date') {
      out[f.name] = String(v).slice(0, 10);
    } else if (f.type === 'datetime') {
      out[f.name] = String(v).slice(0, 16);
    } else {
      out[f.name] = v;
    }
    if (f.type === 'file') {
      // Try common naming: pdf_file_id → pdf_url, photo_file_id → photo_url.
      const urlKey = f.name.replace(/_file_id$/, '_url');
      out[f.name + '__url'] = row[urlKey] || '';
    }
  });
  walk(fields);
  return out;
}

export default function BranchContentAdmin({
  title,
  subtitle,
  endpoint,           // e.g. '/api/admin/paper-presentations'
  columns,            // [{key, label, render?, width?}]
  fields,             // form spec, see top of file
  rowKey = 'id',
  emptyMessage = 'No items yet.',
  newButtonLabel = '+ New item',
  drawerTitle = 'Edit',
}) {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);    // null | 'new' | row
  const [form, setForm] = useState(EMPTY_FORM);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const j = await api(endpoint);
      setItems(j.items ?? []);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [endpoint]);

  const openNew = () => {
    setForm(buildEmptyForm(fields));
    setEditing('new');
    setErr('');
  };
  const openEdit = (row) => {
    setForm(rowToForm(row, fields));
    setEditing(row);
    setErr('');
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const isNew = editing === 'new';
      const url = isNew ? endpoint : `${endpoint}/${editing[rowKey]}`;
      // Strip the __url helper keys before sending — backend doesn't need them.
      const body = {};
      for (const [k, v] of Object.entries(form)) {
        if (!k.endsWith('__url')) body[k] = v;
      }
      await api(url, { method: isNew ? 'POST' : 'PATCH', body });
      showToast?.('Saved', 'success');
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const del = async (row) => {
    const label = row.title || row.person_name || row.fy_label || 'this item';
    const ok = await dialog.confirm({
      title: 'Delete item?',
      message: `Delete "${label}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`${endpoint}/${row[rowKey]}`, { method: 'DELETE' });
      showToast?.('Deleted', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  return (
    <AdminLayout title={title} subtitle={subtitle}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={openNew}>{newButtonLabel}</button>
      </div>

      {err && !editing && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {!items && !err && (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                <Shimmer height=".9rem" width={`${45 + ((i * 11) % 35)}%`} />
                <Shimmer height=".7rem" width="55%" />
              </div>
              <Shimmer height="1.1rem" width="3.5rem" radius="999px" />
            </div>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">{emptyMessage}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '.75rem', width: c.width }}>{c.label}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row[rowKey]} style={{ borderTop: '1px solid var(--border)' }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ padding: '.75rem', fontSize: '.875rem' }}>
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
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
        <Drawer
          title={editing === 'new' ? `New ${drawerTitle}` : `Edit ${drawerTitle}`}
          fields={fields}
          form={form}
          set={set}
          err={err}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </AdminLayout>
  );
}

function Drawer({ title, fields, form, set, err, saving, onClose, onSave }) {
  return (
    <div className="modal-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: 'min(680px, 95vw)', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, marginBottom: '1rem' }}>{title}</h2>

        {err && <div className="alert alert-error" style={{ marginBottom: '.75rem' }}><IconX size="sm" /> {err}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
          {fields.map((f, i) => <Field key={f.name || `g-${i}`} field={f} form={form} set={set} />)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <Button className="btn btn-primary" onClick={onSave} loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ field, form, set }) {
  if (field.type === 'group') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${field.children.length}, 1fr)`, gap: '.75rem' }}>
        {field.children.map((c) => <Field key={c.name} field={c} form={form} set={set} />)}
      </div>
    );
  }

  const v = form[field.name];

  if (field.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.875rem' }}>
        <input type="checkbox" checked={!!v} onChange={(e) => set(field.name, e.target.checked)} />
        {field.label}
        {field.help && <span className="muted-text" style={{ fontSize: '.75rem' }}>({field.help})</span>}
      </label>
    );
  }

  return (
    <div>
      <label className="field-label">
        {field.label}{field.required && ' *'}
      </label>
      {field.help && (
        <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '-.15rem', marginBottom: '.25rem' }}>{field.help}</div>
      )}
      {field.type === 'textarea' && (
        <textarea className="input-base" rows={field.rows ?? 3} value={v ?? ''}
          onChange={(e) => set(field.name, e.target.value)} />
      )}
      {field.type === 'number' && (
        <input className="input-base" type="number" value={v ?? 0}
          onChange={(e) => set(field.name, Number(e.target.value))} />
      )}
      {field.type === 'date' && (
        <input className="input-base" type="date" value={v ?? ''}
          onChange={(e) => set(field.name, e.target.value)} />
      )}
      {field.type === 'datetime' && (
        <input className="input-base" type="datetime-local" value={v ?? ''}
          onChange={(e) => set(field.name, e.target.value)} />
      )}
      {field.type === 'select' && (
        <select className="input-base" value={v ?? ''} onChange={(e) => set(field.name, e.target.value)}>
          <option value="">— Select —</option>
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {field.type === 'text' && (
        <input className="input-base" type="text" value={v ?? ''} maxLength={field.maxLength}
          onChange={(e) => set(field.name, e.target.value)} placeholder={field.placeholder} />
      )}
      {field.type === 'email' && (
        <input className="input-base" type="email" value={v ?? ''}
          onChange={(e) => set(field.name, e.target.value)} />
      )}
      {field.type === 'file' && (
        <FileUpload
          field={field}
          form={form}
          set={set}
        />
      )}
    </div>
  );
}

// File upload — base64 POST to /api/admin/files. Stores `id` on form[name]
// and the preview URL on form[name + '__url'].
//
// When `field.crop === true` (only valid for image accepts), the picked
// file goes through the ImageCropper modal first. The cropper resolves
// with the cropped base64 + mime, which we then upload — so what lands in
// storage is exactly what the admin chose, at the requested aspect.
function FileUpload({ field, form, set }) {
  const { showToast } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const id  = form[field.name];
  const url = form[field.name + '__url'];
  const isImage   = (field.accept || '').includes('image');
  const useCrop   = isImage && !!field.crop;

  // Direct (no-crop) flow — original behaviour, kept for non-image fields
  // and image fields that don't opt into cropping.
  const uploadDirect = async (file) => {
    if (file.size > 6 * 1024 * 1024) {
      showToast?.('File too large (max 6 MB)', 'error');
      return;
    }
    setBusy(true);
    try {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload  = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const r = await api('/api/admin/files', {
        method: 'POST',
        body: { name: file.name, mime_type: file.type, bucket: field.bucket || 'branch_content', data_base64: b64 },
      });
      set(field.name, r.id);
      set(field.name + '__url', r.url);
      showToast?.('Uploaded', 'success');
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Crop-then-upload flow — receives the cropped payload from ImageCropper
  // (already a data URL + mime) and forwards to the same /api/admin/files
  // endpoint. The backend strips the `data:…;base64,` prefix server-side.
  const uploadCropped = async (cropped) => {
    setBusy(true);
    try {
      const r = await api('/api/admin/files', {
        method: 'POST',
        body: {
          name: cropped.name,
          mime_type: cropped.mime_type,
          bucket: field.bucket || 'branch_content',
          data_base64: cropped.data_base64,
        },
      });
      set(field.name, r.id);
      set(field.name + '__url', r.url);
      showToast?.('Uploaded', 'success');
      setPendingFile(null);
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';     // let admin re-pick the same file later
    if (!file) return;
    if (useCrop) {
      setPendingFile(file);  // ImageCropper modal opens
      return;
    }
    await uploadDirect(file);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
      {url ? (
        isImage ? (
          <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '.375rem', border: '1px solid var(--border)' }} />
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer"
             style={{ padding: '.45rem .75rem', border: '1px solid var(--border)', borderRadius: '.375rem', fontSize: '.8rem', textDecoration: 'none', color: 'var(--primary)' }}>
            ✓ Open uploaded file
          </a>
        )
      ) : (
        <span className="muted-text" style={{ fontSize: '.8rem' }}>No file uploaded yet.</span>
      )}
      <label className="btn btn-outline" style={{ cursor: busy ? 'wait' : 'pointer', padding: '.4rem .8rem', fontSize: '.8rem' }}>
        {busy ? 'Uploading…' : (id ? 'Replace' : 'Upload')}
        <input type="file" accept={field.accept} onChange={onPick} disabled={busy} style={{ display: 'none' }} />
      </label>
      {id && (
        <button type="button" className="btn btn-ghost" style={{ fontSize: '.8rem', color: '#b91c1c' }}
          onClick={() => { set(field.name, ''); set(field.name + '__url', ''); }}>Remove</button>
      )}
      {useCrop && pendingFile && (
        <ImageCropper
          file={pendingFile}
          onConfirm={uploadCropped}
          onCancel={() => setPendingFile(null)}
          minWidth={field.minWidth || 0}
          minHeight={field.minHeight || 0}
        />
      )}
    </div>
  );
}

// Re-exported for caller convenience — used to format date columns in `columns`.
export { fmt };
