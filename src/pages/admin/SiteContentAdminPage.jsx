import { useState, useEffect } from 'react';
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
  const [editingCommittee, setEditingCommittee] = useState(false);
  const [editingCommitteeContent, setEditingCommitteeContent] = useState(null); // committee code

  const { data, refresh } = useAdminList('/api/admin/site/content', {});
  const rowsBySlug = new Map((data?.rows ?? []).map((r) => [r.slug, r]));

  const { data: committeesData } = useAdminList('/api/admin/committees', {});
  const committees = committeesData?.rows ?? [];

  // Group slots by `page` (Home, About, …) so the admin can navigate the
  // sections that match what they see on the live site.
  const slotsByPage = SLOT_SLUGS.reduce((acc, slug) => {
    const def = SITE_SLOTS[slug];
    (acc[def.page] ||= []).push(slug);
    return acc;
  }, {});

  const committeeRow = rowsBySlug.get('about_committee_members');

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

            {page === 'About' && (
              <button
                type="button"
                className="card"
                onClick={() => setEditingCommittee(true)}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--card)',
                  padding: '1rem', width: '100%',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '.9375rem' }}>Committee Members</div>
                <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                  {committeeRow
                    ? `${(committeeRow.data?.members ?? []).length} member${(committeeRow.data?.members ?? []).length !== 1 ? 's' : ''} · last edited ${formatWhen(committeeRow.updated_at)}`
                    : 'Managing committee roster for the About page'}
                </div>
                {!committeeRow && (
                  <div style={{ marginTop: '.5rem', fontSize: '.7rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                    Not configured
                  </div>
                )}
              </button>
            )}
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

      {/* Events — per-committee chairman content */}
      {committees.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <div className="tiny-eyebrow" style={{ marginBottom: '.75rem' }}>Events page</div>
          <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {committees.map((c) => {
              const slug = `event_committee_${c.code.toLowerCase()}`;
              const row = rowsBySlug.get(slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="card"
                  onClick={() => setEditingCommitteeContent(c.code)}
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--card)',
                    padding: '1rem', width: '100%',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '.9375rem' }}>{c.name}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                    Chairman photo & message · last edited {formatWhen(row?.updated_at)}
                  </div>
                  {!row && (
                    <div style={{ marginTop: '.5rem', fontSize: '.7rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                      Not configured
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {editingCommittee && (
        <CommitteeMembersDrawer
          initial={committeeRow?.data || {}}
          onClose={() => setEditingCommittee(false)}
          onSaved={() => { refresh(); invalidate('/api/site/content'); }}
          showToast={showToast}
        />
      )}

      {editingCommitteeContent && (() => {
        const c = committees.find((c) => c.code === editingCommitteeContent);
        return (
          <CommitteeContentDrawer
            code={editingCommitteeContent}
            name={c?.name ?? editingCommitteeContent}
            chairmanName={c?.chairman_name ?? null}
            initial={rowsBySlug.get(`event_committee_${editingCommitteeContent.toLowerCase()}`)?.data || {}}
            onClose={() => setEditingCommitteeContent(null)}
            onSaved={() => { refresh(); invalidate('/api/site/content'); }}
            showToast={showToast}
          />
        );
      })()}
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

// ─── Committee Members Drawer ──────────────────────────────────────────────────

const COMMITTEE_ROLE_LABELS = {
  branch_chairman:      'Chairperson',
  branch_vice_chairman: 'Vice Chairperson',
  branch_secretary:     'Secretary',
  branch_treasurer:     'Treasurer',
  mcm:                  'Managing Committee Member',
};

// Specific officer roles take precedence over the generic MCM role.
const ROLE_PRIORITY = [
  'branch_chairman',
  'branch_vice_chairman',
  'branch_secretary',
  'branch_treasurer',
  'mcm',
];


function CommitteeMembersDrawer({ initial, onClose, onSaved, showToast }) {
  const [members, setMembers] = useState(() => initial?.members ?? []);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await adminFetch('/api/admin/site/content/about_committee_members', {
        method: 'PUT',
        body: { data: { members } },
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
      title="Committee Members"
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <CommitteeMembersList members={members} onChange={setMembers} showToast={showToast} />
    </Drawer>
  );
}

function CommitteeMembersList({ members, onChange, showToast }) {
  // Atomic update for a single field on one member
  function update(i, key, v) {
    onChange((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], [key]: v };
      return next;
    });
  }
  // Atomic select: sets user_id, name, designation, and available committee_roles
  function selectMember(i, user) {
    // Build the user's committee roles in priority order so the picker is sorted
    const committeeRoles = ROLE_PRIORITY
      .filter((code) => (user.active_roles ?? []).some((r) => r.role_code === code))
      .map((code) => ({ code, label: COMMITTEE_ROLE_LABELS[code] }));

    onChange((prev) => {
      const next = prev.slice();
      next[i] = {
        ...next[i],
        user_id: user.id,
        name: user.name,
        designation: committeeRoles[0]?.label ?? '',
        committee_roles: committeeRoles,
      };
      return next;
    });
  }
  function add() { onChange((prev) => [...prev, { user_id: null, name: '', designation: '', photo_url: null }]); }
  function remove(i) { onChange((prev) => prev.filter((_, idx) => idx !== i)); }
  function move(i, dir) {
    onChange((prev) => {
      const next = prev.slice();
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="col gap-3">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="field-label">Members ({members.length})</span>
        <button type="button" className="btn btn-outline" onClick={add} style={{ padding: '.35rem .75rem', fontSize: '.8rem' }}>
          + Add member
        </button>
      </div>

      {members.length === 0 && (
        <div className="muted-text" style={{ fontSize: '.8rem', fontStyle: 'italic', padding: '.5rem 0' }}>
          No members added yet. Click "Add member" to start.
        </div>
      )}

      {members.map((m, i) => (
        <CommitteeMemberRow
          key={m.user_id ?? i}
          index={i}
          member={m}
          isFirst={i === 0}
          isLast={i === members.length - 1}
          onChange={(key, v) => update(i, key, v)}
          onSelectUser={(user) => selectMember(i, user)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onRemove={() => remove(i)}
          showToast={showToast}
        />
      ))}
    </div>
  );
}

function CommitteeMemberRow({ index, member, isFirst, isLast, onChange, onSelectUser, onMoveUp, onMoveDown, onRemove, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [roleError, setRoleError] = useState(null);

  // Debounced user search — only fires when no user is locked in yet
  useEffect(() => {
    if (!query.trim() || member.user_id) { setResults([]); setOpen(false); return; }
    setRoleError(null);
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await adminFetch(`/api/admin/users?q=${encodeURIComponent(query)}&pageSize=8&status=active`);
        setResults(data?.rows ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, member.user_id]);

  function selectUser(user) {
    const hasRole = (user.active_roles ?? []).some((r) => COMMITTEE_ROLE_LABELS[r.role_code]);
    if (!hasRole) {
      setRoleError(`${user.name} has no managing committee role and cannot be added.`);
      setOpen(false);
      return;
    }
    setRoleError(null);
    onSelectUser(user);
    setQuery(''); setResults([]); setOpen(false);
  }

  function clearUser() {
    onChange('user_id', null);
    onChange('name', '');
  }

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
        body: { name: file.name, mime_type: file.type, bucket: 'site', data_base64 },
      });
      onChange('photo_url', resp.url);
      showToast?.('Photo uploaded', 'success');
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '.5rem',
      padding: '.875rem', background: 'var(--card)',
    }}>
      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        {/* Photo */}
        <div style={{ flexShrink: 0 }}>
          {member.photo_url ? (
            <img
              src={member.photo_url}
              alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--muted)', border: '1px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.7rem', color: 'var(--muted-foreground)', textAlign: 'center',
            }}>
              No photo
            </div>
          )}
          <label className="btn btn-ghost" style={{ display: 'block', textAlign: 'center', fontSize: '.7rem', padding: '.25rem .3rem', marginTop: '.3rem', cursor: 'pointer' }}>
            {uploading ? '…' : member.photo_url ? 'Replace' : 'Upload'}
            <input type="file" accept="image/*" onChange={onFile} disabled={uploading} style={{ display: 'none' }} />
          </label>
          {member.photo_url && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onChange('photo_url', null)}
              style={{ display: 'block', width: '100%', fontSize: '.7rem', padding: '.2rem .3rem', color: 'var(--destructive)' }}
            >
              Remove
            </button>
          )}
        </div>

        {/* Fields */}
        <div className="col gap-2" style={{ flex: 1 }}>
          <div className="muted-text" style={{ fontSize: '.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Member {index + 1}
          </div>

          {/* User selector — locked display once a valid user is chosen */}
          {member.user_id ? (
            <div className="row gap-2" style={{
              alignItems: 'center', padding: '.45rem .65rem',
              border: '1px solid var(--border)', borderRadius: '.375rem', background: 'var(--muted)',
            }}>
              <span style={{ flex: 1, fontSize: '.875rem', fontWeight: 500 }}>{member.name}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearUser}
                style={{ fontSize: '.75rem', padding: '.2rem .45rem' }}
              >
                Change
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                className="input-base"
                placeholder="Search user by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              />
              {searching && (
                <span style={{
                  position: 'absolute', right: '.65rem', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '.72rem', color: 'var(--muted-foreground)', pointerEvents: 'none',
                }}>
                  Searching…
                </span>
              )}
              {open && results.length > 0 && (
                <div style={{
                  position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '.375rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
                }}>
                  {results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => selectUser(u)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '.5rem .75rem', background: 'transparent', border: 'none',
                        cursor: 'pointer', fontSize: '.875rem',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div className="muted-text" style={{ fontSize: '.75rem' }}>{u.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {roleError && (
            <div style={{ fontSize: '.75rem', color: 'var(--destructive)', marginTop: '-.25rem' }}>
              {roleError}
            </div>
          )}

          {member.user_id && (member.committee_roles?.length ?? 0) > 1 ? (
            <div>
              <div className="muted-text" style={{ fontSize: '.7rem', marginBottom: '.25rem' }}>Role to display</div>
              <select
                className="input-base"
                value={member.committee_roles.find((r) => r.label === member.designation)?.code ?? ''}
                onChange={(e) => {
                  const r = member.committee_roles.find((cr) => cr.code === e.target.value);
                  if (r) onChange('designation', r.label);
                }}
              >
                {member.committee_roles.map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <input
              className="input-base"
              placeholder="Designation (e.g. Chairman, Secretary)"
              value={member.designation ?? ''}
              onChange={(e) => onChange('designation', e.target.value)}
            />
          )}
        </div>

        {/* Order + remove controls */}
        <div className="col gap-1" style={{ flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move up"
            style={{ padding: '.25rem .4rem', fontSize: '.75rem', opacity: isFirst ? 0.3 : 1 }}
          >
            ▲
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move down"
            style={{ padding: '.25rem .4rem', fontSize: '.75rem', opacity: isLast ? 0.3 : 1 }}
          >
            ▼
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRemove}
            title="Remove"
            style={{ padding: '.25rem .4rem', color: 'var(--destructive)' }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Committee Content Drawer (Events page) ────────────────────────────────────

function CommitteeContentDrawer({ code, name, chairmanName, initial, onClose, onSaved, showToast }) {
  const [form, setForm]     = useState({
    chairman_name: chairmanName ?? '',
    chairman_photo: null,
    chairman_message: '',
    ...initial,
    // Pre-fill name from DB role assignment only when no name has been saved yet
    ...(initial.chairman_name ? {} : { chairman_name: chairmanName ?? '' }),
  });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading]   = useState(false);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

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
        body: { name: file.name, mime_type: file.type, bucket: 'site', data_base64 },
      });
      setField('chairman_photo', resp.url);
      showToast?.('Photo uploaded', 'success');
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/site/content/event_committee_${code.toLowerCase()}`, {
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
      title={`${name} — Chairman content`}
      width={600}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="col gap-4">
        {/* Chairman name */}
        <FormField label="Chairman name">
          <input
            className="input-base"
            placeholder="e.g. CA. Swaroopa Wazalwar"
            value={form.chairman_name ?? ''}
            onChange={(e) => setField('chairman_name', e.target.value)}
          />
        </FormField>

        {/* Chairman photo */}
        <FormField label="Chairman photo" hint="Displayed as a circle beside the message">
          <div className="col gap-2">
            {form.chairman_photo && (
              <img
                src={form.chairman_photo}
                alt=""
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
              />
            )}
            <div className="row gap-2">
              <label className="btn btn-outline" style={{ padding: '.45rem .85rem', cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : form.chairman_photo ? 'Replace' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={onFile} disabled={uploading} style={{ display: 'none' }} />
              </label>
              {form.chairman_photo && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setField('chairman_photo', null)}
                  style={{ padding: '.45rem .85rem', color: 'var(--destructive)' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </FormField>

        {/* Chairman message */}
        <div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="field-label">Chairman message</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPreviewing((p) => !p)}
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
                padding: '.6rem .75rem', minHeight: '6rem', background: 'var(--muted)',
              }}
            >
              {renderMarkdown(form.chairman_message) || <span style={{ fontStyle: 'italic' }}>Nothing to preview</span>}
            </div>
          ) : (
            <textarea
              className="input-base"
              rows={5}
              value={form.chairman_message ?? ''}
              onChange={(e) => setField('chairman_message', e.target.value)}
              placeholder="Write a message from the chairman…"
            />
          )}
          <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>
            Supports **bold**, *italic*, [links](url)
          </div>
        </div>
      </div>
    </Drawer>
  );
}
