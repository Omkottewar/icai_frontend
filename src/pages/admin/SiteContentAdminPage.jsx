import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { apiWrite } from '../../lib/apiCache';
import { SITE_SLOTS, SLOT_SLUGS } from '../../lib/siteContentSlots';
import { SITE_CONTENT_DEFAULTS } from '../../hooks/useSiteContent';
import { renderMarkdown } from '../../lib/markdown.jsx';
import Button from '../../components/ui/Button';
import ImageCropper from '../../components/ui/ImageCropper';
import FlipMenu from '../../components/ui/FlipMenu';

function formatWhen(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Admin index of all editable site-content slots. Pages are arranged as
// a tab bar at the top — each tab holds the slot cards for that page so
// the admin only sees what's relevant. Clicking a slot card opens the
// per-slot drawer form.
export default function SiteContentAdminPage() {
  const { showToast } = useAuth();
  const [editingSlug, setEditingSlug] = useState(null);
  const [editingCommittee, setEditingCommittee] = useState(false);
  const [editingCommitteeContent, setEditingCommitteeContent] = useState(null); // committee code

  const { data, refresh, mutateRow } = useAdminList('/api/admin/site/content', {});
  const rowsBySlug = new Map((data?.rows ?? []).map((r) => [r.slug, r]));

  const { data: committeesData } = useAdminList('/api/admin/committees', {});
  const committees = committeesData?.rows ?? [];

  // Group slots by `page` (Home, About, …) so each tab only shows the
  // slots the admin would expect to find on that page.
  const slotsByPage = SLOT_SLUGS.reduce((acc, slug) => {
    const def = SITE_SLOTS[slug];
    (acc[def.page] ||= []).push(slug);
    return acc;
  }, {});

  // The "Events" page tab is special — it has no static slots (its
  // contents are dynamic per-committee), so we add it manually to the tab
  // list whenever committees exist.
  const pages = Object.keys(slotsByPage);
  if (committees.length > 0 && !pages.includes('Events')) pages.push('Events');

  const [activePage, setActivePage] = useState(pages[0] || 'Home');

  // If the active page disappears from the data (e.g. a fresh install
  // where committees haven't loaded yet), snap back to the first page so
  // we don't render an empty tab body.
  useEffect(() => {
    if (!pages.includes(activePage) && pages[0]) setActivePage(pages[0]);
  }, [pages, activePage]);

  const committeeRow = rowsBySlug.get('about_committee_members');

  const pageSlugs = slotsByPage[activePage] || [];

  return (
    <AdminLayout
      title="Site content"
      subtitle="Edit every text and image on the public site. Pick a page tab below."
    >
      {/* Tab bar — one tab per public page that has editable content. */}
      <div role="tablist" aria-label="Page" className="site-content-tabs">
        {pages.map((page) => {
          const isActive = page === activePage;
          // Slot count badge so the admin can see at a glance which page
          // has the most editable surface.
          const slotCount = (slotsByPage[page] || []).length
            + (page === 'About' ? 1 : 0)              // committee-members card
            + (page === 'Events' ? committees.length : 0);
          return (
            <button
              key={page}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePage(page)}
              className={'site-content-tab' + (isActive ? ' is-active' : '')}
            >
              {page}
              <span className="site-content-tab-count">{slotCount}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        .site-content-tabs {
          display: flex;
          gap: .25rem;
          flex-wrap: wrap;
          padding: .25rem;
          background: var(--muted, #f1f5f9);
          border-radius: .6rem;
          margin-bottom: 1.5rem;
        }
        .site-content-tab {
          display: inline-flex;
          align-items: center;
          gap: .5rem;
          padding: .55rem 1rem;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          font-weight: 600;
          font-size: .875rem;
          border-radius: .45rem;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }
        .site-content-tab:hover { color: var(--foreground); }
        .site-content-tab.is-active {
          background: var(--card, #fff);
          color: var(--primary);
          box-shadow: 0 1px 2px rgba(0,0,0,.06);
        }
        .site-content-tab-count {
          font-size: .7rem;
          font-weight: 700;
          padding: .1rem .45rem;
          border-radius: 999px;
          background: var(--muted, #f1f5f9);
          color: var(--muted-foreground);
        }
        .site-content-tab.is-active .site-content-tab-count {
          background: oklch(0.93 0.06 255);
          color: var(--primary);
        }
      `}</style>

      {/* Body for the currently-selected page tab. */}
      <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {pageSlugs.map((slug) => {
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

        {activePage === 'About' && (
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

        {activePage === 'Events' && committees.map((c) => {
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
                About body, leadership trio & chairman message · last edited {formatWhen(row?.updated_at)}
              </div>
              {!row && (
                <div style={{ marginTop: '.5rem', fontSize: '.7rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                  Not configured
                </div>
              )}
            </button>
          );
        })}

        {pageSlugs.length === 0 && activePage !== 'About' && activePage !== 'Events' && (
          <div className="muted-text" style={{ fontSize: '.85rem', fontStyle: 'italic' }}>
            No editable content on this page yet.
          </div>
        )}
      </div>

      {editingSlug && (
        <SlotDrawer
          slug={editingSlug}
          initial={rowsBySlug.get(editingSlug)?.data || {}}
          onClose={() => setEditingSlug(null)}
          // Optimistic splice using the server's own PUT response as the
          // source of truth. No refetch here — a follow-up GET would race
          // against the write and can revert the row.
          onSaved={mutateRow}
          showToast={showToast}
        />
      )}

      {editingCommittee && (
        <CommitteeMembersDrawer
          initial={committeeRow?.data || {}}
          onClose={() => setEditingCommittee(false)}
          onSaved={mutateRow}
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
            onSaved={mutateRow}
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
      const saved = await adminFetch(`/api/admin/site/content/${slug}`, {
        method: 'PUT',
        body: { data: form },
      });
      // Push the freshly-saved row back to the parent so its rowsBySlug
      // reflects the write in the same commit as the drawer close. This
      // is React reconciliation doing its job — the parent's state
      // changes, and only the cards that actually depend on this row
      // re-render. No full page reload.
      onSaved?.(saved);
      showToast?.('Saved', 'success');
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
          <Button className="btn btn-primary" onClick={save} loading={saving} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="col gap-3">
        {def.fields.map((field) => (
          <FieldEditor
            key={field.key}
            field={field}
            value={form[field.key]}
            defaultValue={defaults[field.key]}
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

function FieldEditor({ field, value, defaultValue, onChange, previewing, onTogglePreview, showToast }) {
  // Every text/markdown field is optional. The admin can clear it to fall
  // back to whatever the page renders for an empty slot (often nothing).
  // We surface the bundled default as a placeholder so the admin can see
  // what's being overridden, and never gate the save on a non-empty value.
  const placeholder = typeof defaultValue === 'string' && defaultValue ? defaultValue : '';
  const isEmpty = !value;

  if (field.kind === 'text') {
    return (
      <FormField label={field.label} hint={field.hint}>
        <input
          className="input-base"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {placeholder && (
          <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>
            {isEmpty
              ? <>Optional — leave empty to hide this on the live site.</>
              : <button type="button" onClick={() => onChange('')} style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--primary)', cursor: 'pointer', font: 'inherit', fontSize: '.7rem', textDecoration: 'underline' }}>Clear (leave empty)</button>}
          </div>
        )}
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
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem', display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
          <span>{field.hint || (placeholder ? 'Optional — leave empty to hide this on the live site.' : '')}</span>
          {!isEmpty && placeholder && (
            <button type="button" onClick={() => onChange('')} style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--primary)', cursor: 'pointer', font: 'inherit', fontSize: '.7rem', textDecoration: 'underline' }}>Clear</button>
          )}
        </div>
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
  // A picked-but-not-yet-cropped file. While this is set the ImageCropper
  // modal is rendered; the admin confirms or cancels.
  const [pendingFile, setPendingFile] = useState(null);

  function onFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';           // allow picking the same file again later
    if (!file) return;
    setPendingFile(file);
  }

  async function uploadCropped(cropped) {
    setUploading(true);
    try {
      const resp = await apiWrite('/api/admin/files', {
        method: 'POST',
        body: {
          name:        cropped.name,
          mime_type:   cropped.mime_type,
          bucket:      'site',
          data_base64: cropped.data_base64,
        },
      });
      onChange(resp.url);
      showToast?.('Image uploaded', 'success');
      setPendingFile(null);
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
          <label className="btn btn-outline" style={{ padding: '.45rem .85rem', cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : (value ? 'Replace' : 'Choose image')}
            <input type="file" accept="image/*" onChange={onFilePicked} disabled={uploading} style={{ display: 'none' }} />
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
        <div className="muted-text" style={{ fontSize: '.7rem' }}>
          You'll be able to crop the image after picking it.
        </div>
      </div>
      {pendingFile && (
        <ImageCropper
          file={pendingFile}
          onConfirm={uploadCropped}
          onCancel={() => setPendingFile(null)}
          minWidth={field.minWidth || 0}
          minHeight={field.minHeight || 0}
        />
      )}
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
      const saved = await adminFetch('/api/admin/site/content/about_committee_members', {
        method: 'PUT',
        body: { data: { members } },
      });
      onSaved?.(saved);
      showToast?.('Saved', 'success');
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
          <Button className="btn btn-primary" onClick={save} loading={saving} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
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
  // Picked-but-not-yet-cropped file. When set, the ImageCropper modal
  // renders over the page so the admin can frame the photo square (matches
  // the round avatar on /about) before it uploads.
  const [pendingFile, setPendingFile] = useState(null);
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

  // Pick a file → open ImageCropper. The crop step lets the admin frame
  // the face square so the /about round avatar is centred well.
  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';  // let admin re-pick the same file later
    if (!file) return;
    setPendingFile(file);
  }

  // Receives the cropped payload from ImageCropper. The base64 is already
  // a full data URL; /api/admin/files strips the prefix server-side.
  async function uploadCropped(cropped) {
    setUploading(true);
    try {
      const resp = await apiWrite('/api/admin/files', {
        method: 'POST',
        body: {
          name: cropped.name,
          mime_type: cropped.mime_type,
          bucket: 'site',
          data_base64: cropped.data_base64,
        },
      });
      onChange('photo_url', resp.url);
      showToast?.('Photo uploaded', 'success');
      setPendingFile(null);
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
          {pendingFile && (
            <ImageCropper
              file={pendingFile}
              onConfirm={uploadCropped}
              onCancel={() => setPendingFile(null)}
              minWidth={300}
              minHeight={300}
            />
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
            <UserSearchDropdown
              query={query}
              setQuery={setQuery}
              open={open}
              setOpen={setOpen}
              results={results}
              searching={searching}
              selectUser={selectUser}
            />
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
    about_md: '',
    chairman_name: chairmanName ?? '',
    chairman_photo: null,
    chairman_message: '',
    convenor_name: '',
    convenor_photo: null,
    dy_convenor_name: '',
    dy_convenor_photo: null,
    ...initial,
    // Pre-fill chairman name from DB role assignment only when no name has been saved yet
    ...(initial.chairman_name ? {} : { chairman_name: chairmanName ?? '' }),
  });
  const [saving, setSaving] = useState(false);
  const [previewingAbout, setPreviewingAbout] = useState(false);
  const [previewingMessage, setPreviewingMessage] = useState(false);
  // Track which photo field is currently uploading so buttons show state
  // per-slot instead of a global "uploading" flag.
  const [uploadingField, setUploadingField] = useState(null);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function uploadPhoto(field, file) {
    if (!file) return;
    setUploadingField(field);
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
      setField(field, resp.url);
      showToast?.('Photo uploaded', 'success');
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setUploadingField(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await adminFetch(`/api/admin/site/content/event_committee_${code.toLowerCase()}`, {
        method: 'PUT',
        body: { data: form },
      });
      onSaved?.(saved);
      showToast?.('Saved', 'success');
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
      title={`${name} — Committee content`}
      width={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <Button className="btn btn-primary" onClick={save} loading={saving} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="col gap-4">
        {/* About the committee — long-form markdown body */}
        <div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="field-label">About the committee</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPreviewingAbout((p) => !p)}
              style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
            >
              {previewingAbout ? 'Edit' : 'Preview'}
            </button>
          </div>
          {previewingAbout ? (
            <div
              className="muted-text"
              style={{
                border: '1px solid var(--border)', borderRadius: '.375rem',
                padding: '.6rem .75rem', minHeight: '8rem', background: 'var(--muted)',
              }}
            >
              {renderMarkdown(form.about_md) || <span style={{ fontStyle: 'italic' }}>Nothing to preview</span>}
            </div>
          ) : (
            <textarea
              className="input-base"
              rows={10}
              value={form.about_md ?? ''}
              onChange={(e) => setField('about_md', e.target.value)}
              placeholder="Long-form description shown on the committee detail page…"
            />
          )}
          <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>
            Supports markdown — blank lines for new paragraphs, **bold**, *italic*, [links](url)
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div className="tiny-eyebrow" style={{ marginBottom: '.75rem' }}>Committee leadership</div>

          {/* Chairman */}
          <LeadershipRow
            label="Chairman"
            nameValue={form.chairman_name ?? ''}
            photoValue={form.chairman_photo}
            uploading={uploadingField === 'chairman_photo'}
            onName={(v) => setField('chairman_name', v)}
            onPhoto={(f) => uploadPhoto('chairman_photo', f)}
            onClearPhoto={() => setField('chairman_photo', null)}
          />

          {/* Convenor */}
          <LeadershipRow
            label="Convenor"
            nameValue={form.convenor_name ?? ''}
            photoValue={form.convenor_photo}
            uploading={uploadingField === 'convenor_photo'}
            onName={(v) => setField('convenor_name', v)}
            onPhoto={(f) => uploadPhoto('convenor_photo', f)}
            onClearPhoto={() => setField('convenor_photo', null)}
          />

          {/* Dy. Convenor */}
          <LeadershipRow
            label="Dy. Convenor"
            nameValue={form.dy_convenor_name ?? ''}
            photoValue={form.dy_convenor_photo}
            uploading={uploadingField === 'dy_convenor_photo'}
            onName={(v) => setField('dy_convenor_name', v)}
            onPhoto={(f) => uploadPhoto('dy_convenor_photo', f)}
            onClearPhoto={() => setField('dy_convenor_photo', null)}
          />
        </div>

        {/* Chairman message (optional) */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="field-label">Message from the Chairman (optional)</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPreviewingMessage((p) => !p)}
              style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
            >
              {previewingMessage ? 'Edit' : 'Preview'}
            </button>
          </div>
          {previewingMessage ? (
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
              placeholder="Optional welcome / vision note shown inside the header panel"
            />
          )}
          <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>
            Shown as a highlighted quote block beside the chairman's photo.
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// Compact row for editing one leadership role — label, name input,
// photo upload button, remove-photo button. Reused for Chairman /
// Convenor / Dy. Convenor so the drawer stays symmetric.
function LeadershipRow({ label, nameValue, photoValue, uploading, onName, onPhoto, onClearPhoto }) {
  return (
    <div className="row gap-3" style={{ alignItems: 'center', marginBottom: '.75rem', flexWrap: 'wrap' }}>
      <div style={{ width: 56, height: 56, flexShrink: 0 }}>
        {photoValue ? (
          <img
            src={photoValue}
            alt=""
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '1px dashed var(--border)', background: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '.65rem', color: 'var(--muted-foreground)', textAlign: 'center', padding: '.25rem',
          }}>No photo</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="tiny-eyebrow" style={{ fontSize: '.65rem', marginBottom: '.25rem' }}>{label}</div>
        <input
          className="input-base"
          placeholder={`${label} name (e.g. CA Someone)`}
          value={nameValue}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="row gap-1" style={{ flexShrink: 0 }}>
        <label className="btn btn-outline" style={{ padding: '.35rem .7rem', cursor: 'pointer', fontSize: '.8125rem' }}>
          {uploading ? 'Uploading…' : photoValue ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPhoto(e.target.files?.[0])}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        {photoValue && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClearPhoto}
            style={{ padding: '.35rem .55rem', color: 'var(--destructive)', fontSize: '.8125rem' }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ─── User search dropdown — wraps the input + FlipMenu autocomplete. ────
// Extracted so the input has a stable ref the portal can anchor against.
// Used inside the Committee Members drawer to pick a user by name / email.
function UserSearchDropdown({ query, setQuery, open, setOpen, results, searching, selectUser }) {
  const inputRef = useRef(null);
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="input-base"
        placeholder="Search user by name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        // 150ms delay lets a mouseDown on a result fire before the input
        // blurs and closes the menu.
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
      <FlipMenu
        open={open && results.length > 0}
        triggerRef={inputRef}
        onClose={() => setOpen(false)}
        align="stretch"
        offset={4}
        maxHeight={240}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '.375rem',
          boxShadow: '0 4px 12px rgba(0,0,0,.12)',
        }}
      >
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
      </FlipMenu>
    </div>
  );
}
