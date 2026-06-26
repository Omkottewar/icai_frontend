import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX, IconFileText } from '../../icons';
import { Shimmer } from '../../components/ui/Shimmer';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

function GalleryRowShimmer({ count = 5 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1rem' }}>
          <Shimmer width="3rem" height="3rem" radius=".375rem" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            <Shimmer height=".9rem" width={`${50 + ((i * 11) % 30)}%`} />
            <Shimmer height=".7rem" width="40%" />
          </div>
          <Shimmer height="1.1rem" width="4rem" radius="999px" />
        </div>
      ))}
    </div>
  );
}

// Photo gallery admin. Two responsibilities:
//   1. Album CRUD (title, committee, occurred_on, cover, hidden)
//   2. Per-album photo management (upload many, reorder, delete)
//
// Unlike the other branch-content admin pages, this one is bespoke rather
// than using the generic BranchContentAdmin — the nested photo list doesn't
// fit the single-table CRUD shape.

const COMMITTEES = ['', 'GST', 'Direct Tax', 'IT', 'Audit', 'CPE', 'WICASA', 'Branch'];
const VISIBILITIES = [
  { value: 'public',  label: 'Public — anyone' },
  { value: 'members', label: 'Members only — needs login' },
  { value: 'private', label: 'Private — admin only' },
];
const EMPTY_ALBUM = {
  title: '', committee_tag: '', occurred_on: '', description: '',
  cover_file_id: '', cover_url: '',
  visibility: 'public', hidden: false, sort_order: 0,
};

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

async function uploadFile(file, bucket = 'gallery') {
  const b64 = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return api('/api/admin/files', {
    method: 'POST',
    body: { name: file.name, mime_type: file.type, bucket, data_base64: b64 },
  });
}

export default function GalleryAlbumsAdminPage() {
  const { showToast } = useAuth();
  const [albums, setAlbums] = useState(null);
  const [editing, setEditing] = useState(null);   // null | 'new' | album row
  const [form, setForm] = useState(EMPTY_ALBUM);
  const [photosFor, setPhotosFor] = useState(null); // album whose photos panel is open
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const j = await api('/api/admin/gallery-albums');
      setAlbums(j.items ?? []);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(EMPTY_ALBUM);
    setEditing('new');
  };
  const openEdit = (row) => {
    setForm({
      title:         row.title || '',
      committee_tag: row.committee_tag || '',
      occurred_on:   row.occurred_on ? String(row.occurred_on).slice(0, 10) : '',
      description:   row.description || '',
      cover_file_id: row.cover_file_id || '',
      cover_url:     row.cover_url || '',
      visibility:    row.visibility || 'public',
      hidden:        !!row.hidden,
      sort_order:    row.sort_order ?? 0,
    });
    setEditing(row);
  };
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onCoverPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      showToast?.('Max 6 MB', 'error');
      return;
    }
    setBusy(true);
    try {
      const r = await uploadFile(file, 'gallery_covers');
      update('cover_file_id', r.id);
      update('cover_url', r.url);
      showToast?.('Cover uploaded', 'success');
    } catch (err) { showToast?.(err.message, 'error'); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const save = async () => {
    setBusy(true);
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/admin/gallery-albums' : `/api/admin/gallery-albums/${editing.id}`;
      const { cover_url, ...body } = form;
      await api(url, { method: isNew ? 'POST' : 'PATCH', body });
      showToast?.('Saved', 'success');
      setEditing(null);
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const del = async (row) => {
    const ok = await dialog.confirm({
      title: 'Delete album?',
      message: `Delete album "${row.title}"? All photos in it will also be deleted.`,
      confirmText: 'Delete album',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/gallery-albums/${row.id}`, { method: 'DELETE' });
      showToast?.('Deleted', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  return (
    <AdminLayout title="Photo gallery" subtitle="Albums and photos from past branch events">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New album</button>
      </div>

      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}
      {!albums && !err && <GalleryRowShimmer count={5} />}
      {albums && albums.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">No albums yet.</p>
        </div>
      )}

      {albums && albums.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Album</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Committee</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Visibility</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {albums.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                      {row.cover_url && (
                        <img src={row.cover_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '.25rem' }} />
                      )}
                      <strong>{row.title}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{row.committee_tag || '—'}</td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{fmt(row.occurred_on)}</td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{row.visibility || 'public'}</td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{row.hidden ? 'Hidden' : 'Live'}</td>
                  <td style={{ padding: '.75rem', textAlign: 'right' }}>
                    <button className="btn btn-ghost" onClick={() => setPhotosFor(row)}>
                      <IconFileText size="sm" /> Photos
                    </button>
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
        <div className="modal-backdrop"
          onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card"
            style={{ width: 'min(640px, 95vw)', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, marginBottom: '1rem' }}>
              {editing === 'new' ? 'New album' : 'Edit album'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              <div>
                <label className="field-label">Title *</label>
                <input className="input-base" value={form.title} onChange={(e) => update('title', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Committee</label>
                  <select className="input-base" value={form.committee_tag} onChange={(e) => update('committee_tag', e.target.value)}>
                    {COMMITTEES.map((c) => <option key={c} value={c}>{c || '— None —'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Occurred on</label>
                  <input className="input-base" type="date" value={form.occurred_on} onChange={(e) => update('occurred_on', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label">Description (optional)</label>
                <textarea className="input-base" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Cover image</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  {form.cover_url ? (
                    <img src={form.cover_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '.375rem', border: '1px solid var(--border)' }} />
                  ) : (
                    <span className="muted-text" style={{ fontSize: '.8rem' }}>No cover yet.</span>
                  )}
                  <label className="btn btn-outline" style={{ cursor: busy ? 'wait' : 'pointer', padding: '.4rem .8rem', fontSize: '.8rem' }}>
                    {busy ? 'Uploading…' : form.cover_file_id ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" onChange={onCoverPick} disabled={busy} style={{ display: 'none' }} />
                  </label>
                  {form.cover_file_id && (
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '.8rem', color: '#b91c1c' }}
                      onClick={() => { update('cover_file_id', ''); update('cover_url', ''); }}>Remove</button>
                  )}
                </div>
              </div>
              <div>
                <label className="field-label">Visibility</label>
                <select className="input-base" value={form.visibility} onChange={(e) => update('visibility', e.target.value)}>
                  {VISIBILITIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Sort order</label>
                  <input className="input-base" type="number" value={form.sort_order} onChange={(e) => update('sort_order', Number(e.target.value))} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '1.5rem', fontSize: '.875rem' }}>
                  <input type="checkbox" checked={form.hidden} onChange={(e) => update('hidden', e.target.checked)} />
                  Hide entirely (draft)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <Button className="btn btn-primary" onClick={save} loading={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {photosFor && (
        <PhotosPanel
          album={photosFor}
          onClose={() => setPhotosFor(null)}
          onChange={load}
        />
      )}
    </AdminLayout>
  );
}

// ─── Photo management panel ────────────────────────────────────────────────────
// Lists current photos + supports parallel multi-file upload, per-photo alt
// text + caption editing, drag-to-reorder, delete.
//
// Upload concurrency cap = 3 simultaneous POSTs. The /api/admin/files endpoint
// is CPU-bound (sharp runs on the API process), so more than 3-4 concurrent
// uploads just bottlenecks the server.
const UPLOAD_CONCURRENCY = 3;

function PhotosPanel({ album, onClose, onChange }) {
  const { showToast } = useAuth();
  const [photos, setPhotos] = useState(null);
  // Per-file upload state: name → { progress: 0..1, status: 'queued'|'uploading'|'done'|'error', error? }
  const [uploadState, setUploadState] = useState({});
  // Drag-and-drop state — id being dragged + id being hovered.
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const load = async () => {
    const j = await api(`/api/admin/gallery-albums/${album.id}`);
    setPhotos(j.photos ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [album.id]);

  // Run async tasks with bounded concurrency.
  async function pool(items, limit, runner) {
    const out = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await runner(items[i], i);
      }
    });
    await Promise.all(workers);
    return out;
  }

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Seed progress state — every selected file starts at queued.
    const state = {};
    files.forEach((f) => { state[f.name] = { progress: 0, status: 'queued' }; });
    setUploadState(state);

    const results = await pool(files, UPLOAD_CONCURRENCY, async (file) => {
      if (file.size > 6 * 1024 * 1024) {
        setUploadState((s) => ({ ...s, [file.name]: { progress: 1, status: 'error', error: 'Too large' }}));
        return null;
      }
      setUploadState((s) => ({ ...s, [file.name]: { progress: .1, status: 'uploading' }}));
      try {
        const u = await uploadFile(file, 'gallery_photos');
        setUploadState((s) => ({ ...s, [file.name]: { progress: 1, status: 'done' }}));
        return { file_id: u.id, caption: '', sort_order: 0 };
      } catch (err) {
        setUploadState((s) => ({ ...s, [file.name]: { progress: 1, status: 'error', error: err.message }}));
        return null;
      }
    });

    const ok = results.filter(Boolean);
    if (ok.length > 0) {
      // Append at the end — give each new photo a sort_order beyond the
      // current max so it doesn't shuffle existing rows.
      const base = (photos?.length ?? 0);
      const payload = ok.map((p, i) => ({ ...p, sort_order: base + i }));
      try {
        await api(`/api/admin/gallery-albums/${album.id}/photos`, {
          method: 'POST',
          body: { photos: payload },
        });
        showToast?.(`Uploaded ${ok.length} photo${ok.length === 1 ? '' : 's'}`, 'success');
        load();
        onChange?.();
      } catch (err) {
        showToast?.(err.message, 'error');
      }
    }

    // Clear the per-file progress strip after a moment so the user can read errors.
    setTimeout(() => setUploadState({}), 3500);
    e.target.value = '';
  };

  const del = async (p) => {
    const ok = await dialog.confirm({
      title: 'Delete photo?',
      message: 'Delete this photo?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/gallery-albums/${album.id}/photos/${p.id}`, { method: 'DELETE' });
      showToast?.('Photo deleted', 'success');
      load();
      onChange?.();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const editPhoto = async (p, patch) => {
    try {
      await api(`/api/admin/gallery-albums/${album.id}/photos/${p.id}`, {
        method: 'PATCH',
        body: { caption: patch.caption ?? p.caption, sort_order: p.sort_order },
      });
      // Alt text belongs to the underlying file row, not the photo row.
      if (patch.alt_text !== undefined && p.file_id) {
        await api(`/api/admin/files/${p.file_id}`, {
          method: 'PATCH',
          body: { alt_text: patch.alt_text },
        });
      }
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  // ─── Drag & drop reorder ─────────────────────────────────────────────────────
  // Native HTML5 DnD — no extra library. Visual cue: drop target gets a thicker
  // border. On drop we compute the new order and POST /photos/reorder.
  const onDragStart = (id) => setDragId(id);
  const onDragOver  = (e, id) => { e.preventDefault(); setOverId(id); };
  const onDragEnd   = () => { setDragId(null); setOverId(null); };
  const onDrop = async (targetId) => {
    if (!dragId || dragId === targetId) { onDragEnd(); return; }
    const fromIdx = photos.findIndex((x) => x.id === dragId);
    const toIdx   = photos.findIndex((x) => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const next = [...photos];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setPhotos(next);                                     // optimistic
    onDragEnd();
    try {
      await api(`/api/admin/gallery-albums/${album.id}/photos/reorder`, {
        method: 'POST',
        body: { photo_ids: next.map((x) => x.id) },
      });
    } catch (e) {
      showToast?.(e.message, 'error');
      load();                                            // revert
    }
  };

  const uploadEntries = Object.entries(uploadState);

  return (
    <div className="modal-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 105 }}>
      <div onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: 'min(920px, 95vw)', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Photos — {album.title}</h2>
            <p className="muted-text" style={{ fontSize: '.8rem', marginTop: '.25rem' }}>
              {photos === null ? 'Loading…' : `${photos.length} photo${photos.length === 1 ? '' : 's'} · drag to reorder`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              + Upload photos
              <input type="file" accept="image/*" multiple onChange={onPick} style={{ display: 'none' }} />
            </label>
            <button type="button" className="btn btn-ghost" onClick={onClose}><IconX size="sm" /></button>
          </div>
        </div>

        {uploadEntries.length > 0 && (
          <div style={{ marginBottom: '.75rem', border: '1px solid var(--border)', borderRadius: '.375rem', padding: '.5rem .75rem' }}>
            {uploadEntries.map(([name, s]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.75rem', padding: '.15rem 0' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                {s.status === 'done'   && <span style={{ color: '#15803d', fontWeight: 600 }}>✓ Done</span>}
                {s.status === 'error'  && <span style={{ color: '#b91c1c', fontWeight: 600 }}>✗ {s.error}</span>}
                {s.status === 'uploading' && <span className="muted-text">Uploading…</span>}
                {s.status === 'queued' && <span className="muted-text">Queued</span>}
              </div>
            ))}
          </div>
        )}

        {photos !== null && photos.length === 0 && uploadEntries.length === 0 && (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>No photos in this album yet.</p>
        )}

        {photos !== null && photos.length > 0 && (
          <div style={{ display: 'grid', gap: '.6rem', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {photos.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => onDragStart(p.id)}
                onDragOver={(e) => onDragOver(e, p.id)}
                onDragEnd={onDragEnd}
                onDrop={() => onDrop(p.id)}
                style={{
                  border: overId === p.id ? '2px dashed var(--primary)' : '1px solid var(--border)',
                  borderRadius: '.375rem',
                  overflow: 'hidden',
                  background: 'var(--muted)',
                  opacity: dragId === p.id ? 0.5 : 1,
                  cursor: 'grab',
                }}
              >
                {(p.thumb_url || p.url) && (
                  <img src={p.thumb_url || p.url} alt={p.alt || p.caption || ''} loading="lazy"
                       style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '.4rem .5rem', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                  <input
                    className="input-base"
                    style={{ fontSize: '.7rem', padding: '.2rem .35rem' }}
                    placeholder="Alt text (screen reader)"
                    defaultValue={p.alt || ''}
                    onBlur={(e) => { if (e.target.value !== (p.alt || '')) editPhoto(p, { alt_text: e.target.value }); }}
                  />
                  <input
                    className="input-base"
                    style={{ fontSize: '.7rem', padding: '.2rem .35rem' }}
                    placeholder="Caption (optional)"
                    defaultValue={p.caption || ''}
                    onBlur={(e) => { if (e.target.value !== (p.caption || '')) editPhoto(p, { caption: e.target.value }); }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.7rem' }}>
                    <span className="muted-text">#{p.sort_order ?? 0}</span>
                    <button type="button" className="btn btn-ghost"
                      style={{ color: '#b91c1c', fontSize: '.7rem', padding: '.15rem .35rem' }}
                      onClick={() => del(p)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
