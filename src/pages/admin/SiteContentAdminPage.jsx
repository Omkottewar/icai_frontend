import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { invalidate, apiWrite } from '../../lib/apiCache';
import { SITE_SLOTS, SLOT_SLUGS } from '../../lib/siteContentSlots';
import { SITE_CONTENT_DEFAULTS } from '../../hooks/useSiteContent';
import { renderMarkdown } from '../../lib/markdown.jsx';

function formatWhen(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Admin index of all editable site-content slots. Each slot is a card with
// its current "last edited" stamp; clicking opens the per-slot drawer form.
export default function SiteContentAdminPage() {
  const { showToast } = useAuth();
  const [editingSlug, setEditingSlug] = useState(null);

  const { data, refresh } = useAdminList('/api/admin/site/content', {});
  const rowsBySlug = new Map((data?.rows ?? []).map((r) => [r.slug, r]));

  // Group slots by `page` (Home, About, …) so the admin can navigate the
  // sections that match what they see on the live site.
  const slotsByPage = SLOT_SLUGS.reduce((acc, slug) => {
    const def = SITE_SLOTS[slug];
    (acc[def.page] ||= []).push(slug);
    return acc;
  }, {});

  return (
    <AdminLayout
      title="Site content"
      subtitle="Editable text and images on the public site"
    >
      {Object.entries(slotsByPage).map(([page, slugs]) => (
        <section key={page} style={{ marginBottom: '2rem' }}>
          <div className="tiny-eyebrow" style={{ marginBottom: '.75rem' }}>{page} page</div>
          <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {slugs.map((slug) => {
              const def = SITE_SLOTS[slug];
              const row = rowsBySlug.get(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  className="card"
                  onClick={() => setEditingSlug(slug)}
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--card)',
                    padding: '1rem', width: '100%',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '.9375rem' }}>{def.label}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                    {def.fields.length} field{def.fields.length !== 1 ? 's' : ''} · last edited {formatWhen(row?.updated_at)}
                  </div>
                  {!row && (
                    <div style={{ marginTop: '.5rem', fontSize: '.7rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                      Using default content
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {editingSlug && (
        <SlotDrawer
          slug={editingSlug}
          initial={rowsBySlug.get(editingSlug)?.data || {}}
          onClose={() => setEditingSlug(null)}
          onSaved={() => { refresh(); invalidate('/api/site/content'); }}
          showToast={showToast}
        />
      )}
    </AdminLayout>
  );
}

function SlotDrawer({ slug, initial, onClose, onSaved, showToast }) {
  const def = SITE_SLOTS[slug];
  const defaults = SITE_CONTENT_DEFAULTS[slug] || {};

  // Form state starts from current DB row, falling back to bundled defaults
  // so the editor sees what the page currently renders.
  const [form, setForm] = useState(() => ({ ...defaults, ...initial }));
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(new Set());

  const togglePreview = (key) => {
    setPreview((p) => {
      const next = new Set(p);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/site/content/${slug}`, {
        method: 'PUT',
        body: { data: form },
      });
      showToast?.('Saved', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      showToast?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={def.label}
      width={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="col gap-3">
        {def.fields.map((field) => (
          <FieldEditor
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={(v) => setField(field.key, v)}
            previewing={preview.has(field.key)}
            onTogglePreview={() => togglePreview(field.key)}
            showToast={showToast}
          />
        ))}
      </div>
    </Drawer>
  );
}

function FieldEditor({ field, value, onChange, previewing, onTogglePreview, showToast }) {
  if (field.kind === 'text') {
    return (
      <FormField label={field.label} hint={field.hint}>
        <input
          className="input-base"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>
    );
  }

  if (field.kind === 'markdown') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="field-label">{field.label}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onTogglePreview}
            style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
          >
            {previewing ? 'Edit' : 'Preview'}
          </button>
        </div>
        {previewing ? (
          <div
            className="muted-text"
            style={{
              border: '1px solid var(--border)', borderRadius: '.375rem',
              padding: '.6rem .75rem', minHeight: '6rem',
              background: 'var(--muted)',
            }}
          >
            {renderMarkdown(value) || <span className="muted-text" style={{ fontStyle: 'italic' }}>Nothing to preview</span>}
          </div>
        ) : (
          <textarea
            className="input-base"
            rows={5}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {field.hint && (
          <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>{field.hint}</div>
        )}
      </div>
    );
  }

  if (field.kind === 'image') {
    return <ImageField field={field} value={value} onChange={onChange} showToast={showToast} />;
  }

  if (field.kind === 'stats') {
    return <StatsField field={field} value={value} onChange={onChange} />;
  }

  return null;
}

function ImageField({ field, value, onChange, showToast }) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data_base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const resp = await apiWrite('/api/admin/files', {
        method: 'POST',
        body: {
          name: file.name,
          mime_type: file.type,
          bucket: 'site',
          data_base64,
        },
      });
      onChange(resp.url);
      showToast?.('Image uploaded', 'success');
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <FormField label={field.label} hint={field.hint}>
      <div className="col gap-2">
        {value && (
          <img
            src={value}
            alt=""
            style={{ maxWidth: 200, maxHeight: 200, borderRadius: '.5rem', display: 'block', border: '1px solid var(--border)' }}
          />
        )}
        <div className="row gap-2">
          <label className="btn btn-outline" style={{ padding: '.45rem .85rem', cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : (value ? 'Replace' : 'Upload image')}
            <input type="file" accept="image/*" onChange={onFile} disabled={uploading} style={{ display: 'none' }} />
          </label>
          {value && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onChange(null)}
              style={{ padding: '.45rem .85rem', color: 'var(--destructive)' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </FormField>
  );
}

function StatsField({ field, value, onChange }) {
  const list = Array.isArray(value) ? value : [];

  function update(i, key, v) {
    const next = list.slice();
    next[i] = { ...next[i], [key]: v };
    onChange(next);
  }
  function add() { onChange([...list, { k: '', v: '' }]); }
  function remove(i) { onChange(list.filter((_, idx) => idx !== i)); }

  return (
    <FormField label={field.label} hint={field.hint}>
      <div className="col gap-2">
        {list.map((s, i) => (
          <div key={i} className="row gap-2" style={{ alignItems: 'center' }}>
            <input
              className="input-base"
              placeholder="Value (e.g. 5,000+)"
              value={s.k ?? ''}
              onChange={(e) => update(i, 'k', e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="input-base"
              placeholder="Label (e.g. Members)"
              value={s.v ?? ''}
              onChange={(e) => update(i, 'v', e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => remove(i)}
              style={{ padding: '.3rem .6rem', color: 'var(--destructive)' }}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={add} style={{ padding: '.4rem .85rem', alignSelf: 'flex-start' }}>
          + Add row
        </button>
      </div>
    </FormField>
  );
}
