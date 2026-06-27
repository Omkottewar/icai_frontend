import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX } from '../../icons';
import { Shimmer } from '../../components/ui/Shimmer';
import { dialog } from '../../lib/dialog';

// Video Gallery admin. Same shape as the album admin but the "item" is a
// single embeddable video (YouTube / Vimeo / external URL) rather than a
// folder of photos. Admins paste any common YouTube share URL and the
// backend extracts the video ID; the public page builds the iframe embed.

const PROVIDERS = [
  { value: 'youtube',  label: 'YouTube' },
  { value: 'vimeo',    label: 'Vimeo' },
  { value: 'external', label: 'External (opens in new tab)' },
];
const COMMITTEES   = ['', 'GST', 'Direct Tax', 'IT', 'Audit', 'CPE', 'WICASA', 'Branch'];
const EVENT_TYPES  = ['', 'Technical', 'Cultural', 'Sports', 'Press', 'Social', 'Visit', 'Other'];
const VISIBILITIES = [
  { value: 'public',  label: 'Public — anyone' },
  { value: 'members', label: 'Members only — needs login' },
  { value: 'private', label: 'Private — admin only' },
];

const EMPTY = {
  title: '', description: '',
  provider: 'youtube',
  video_url: '',   // admin pastes here; backend extracts video_id
  video_id: '',
  committee_tag: '', event_type: '',
  occurred_on: '', duration_secs: '',
  visibility: 'public', hidden: false, is_featured: false, sort_order: 0,
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

function thumbFor(v) {
  if (v.provider === 'youtube' && v.video_id) {
    return `https://i.ytimg.com/vi/${v.video_id}/default.jpg`;
  }
  return null;
}

function RowShimmer({ count = 4 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1rem' }}>
          <Shimmer width="3.5rem" height="2.25rem" radius=".25rem" />
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

export default function GalleryVideosAdminPage() {
  const { showToast } = useAuth();
  const [videos, setVideos] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const j = await api('/api/admin/gallery-videos');
      setVideos(j.items ?? []);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (row) => {
    setForm({
      title:         row.title || '',
      description:   row.description || '',
      provider:      row.provider || 'youtube',
      video_url:     row.video_url || '',
      video_id:      row.video_id || '',
      committee_tag: row.committee_tag || '',
      event_type:    row.event_type || '',
      occurred_on:   row.occurred_on ? String(row.occurred_on).slice(0, 10) : '',
      duration_secs: row.duration_secs ?? '',
      visibility:    row.visibility || 'public',
      hidden:        !!row.hidden,
      is_featured:   !!row.is_featured,
      sort_order:    row.sort_order ?? 0,
    });
    setEditing(row);
  };
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/admin/gallery-videos' : `/api/admin/gallery-videos/${editing.id}`;
      // Send `video_url` if the admin pasted a URL; backend extracts the
      // bare ID. Either field alone is accepted.
      const body = { ...form };
      if (form.duration_secs === '') body.duration_secs = null;
      await api(url, { method: isNew ? 'POST' : 'PATCH', body });
      showToast?.('Saved', 'success');
      setEditing(null);
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const del = async (row) => {
    const ok = await dialog.confirm({
      title: 'Delete video?',
      message: `Delete video "${row.title}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/gallery-videos/${row.id}`, { method: 'DELETE' });
      showToast?.('Deleted', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  return (
    <AdminLayout title="Video gallery" subtitle="Embedded YouTube / Vimeo recordings of past events and seminars">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New video</button>
      </div>

      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}
      {!videos && !err && <RowShimmer count={4} />}
      {videos && videos.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">No videos yet. Paste a YouTube link to add one.</p>
        </div>
      )}

      {videos && videos.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Video</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Provider</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Committee</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Date</th>
                <th style={{ textAlign: 'left',  padding: '.75rem' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                      {thumbFor(row) && (
                        <img src={thumbFor(row)} alt="" style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: '.25rem' }} />
                      )}
                      <div>
                        <strong>{row.title}</strong>
                        {row.is_featured && (
                          <span style={{ marginLeft: '.5rem', fontSize: '.65rem', fontWeight: 700, color: '#3622FF' }}>★ FEATURED</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{row.provider}</td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{row.committee_tag || '—'}</td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{fmt(row.occurred_on)}</td>
                  <td style={{ padding: '.75rem', fontSize: '.875rem' }}>{row.hidden ? 'Hidden' : 'Live'}</td>
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
        <div className="modal-backdrop"
          onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card"
            style={{ width: 'min(640px, 95vw)', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem', background: 'var(--card, #fff)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, marginBottom: '1rem' }}>
              {editing === 'new' ? 'New video' : 'Edit video'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              <div>
                <label className="field-label">Title *</label>
                <input className="input-base" value={form.title} onChange={(e) => update('title', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Description (optional)</label>
                <textarea className="input-base" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Provider *</label>
                  <select className="input-base" value={form.provider} onChange={(e) => update('provider', e.target.value)}>
                    {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Video URL or ID *</label>
                  <input
                    className="input-base"
                    value={form.video_url || form.video_id}
                    onChange={(e) => update('video_url', e.target.value)}
                    placeholder={
                      form.provider === 'youtube' ? 'https://www.youtube.com/watch?v=...' :
                      form.provider === 'vimeo'   ? 'https://vimeo.com/...' :
                                                    'https://...'
                    }
                  />
                  <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.7rem' }}>
                    Paste any share URL — the system extracts the video ID automatically.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Committee</label>
                  <select className="input-base" value={form.committee_tag} onChange={(e) => update('committee_tag', e.target.value)}>
                    {COMMITTEES.map((c) => <option key={c} value={c}>{c || '— None —'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Event type</label>
                  <select className="input-base" value={form.event_type} onChange={(e) => update('event_type', e.target.value)}>
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t || '— None —'}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Occurred on</label>
                  <input className="input-base" type="date" value={form.occurred_on} onChange={(e) => update('occurred_on', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Duration (seconds, optional)</label>
                  <input className="input-base" type="number" min="0" value={form.duration_secs} onChange={(e) => update('duration_secs', e.target.value)} />
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
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
                    <input type="checkbox" checked={form.is_featured} onChange={(e) => update('is_featured', e.target.checked)} />
                    Featured — pin near top
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
                    <input type="checkbox" checked={form.hidden} onChange={(e) => update('hidden', e.target.checked)} />
                    Hidden (draft — not shown publicly)
                  </label>
                </div>
              </div>

              <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
                <button className="btn btn-outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={busy || !form.title.trim() || !(form.video_url || form.video_id).trim()}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
