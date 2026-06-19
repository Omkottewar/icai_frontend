import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch, invalidate } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoleFlags } from '../../hooks/useRoleFlags';
import { useRoute, navigate } from '../../hooks/useRoute';
import { Shimmer, ShimmerFormField, ShimmerLines } from '../../components/ui/Shimmer';
import { eventLabel, EVENT_STATUS, toneStyle } from '../../lib/eventStatus';
import EventTimeline from '../../components/admin/EventTimeline';
import ComparableEventsPanel from '../../components/admin/ComparableEventsPanel';
import EventQuickActions from '../../components/admin/EventQuickActions';
import DateTimePicker from '../../components/admin/DateTimePicker';
import { IconPlus, IconCheckCircle } from '../../icons';

// Programme types are a fixed list (no more free-text typos). Stays in sync
// with the dropdown options used in the Event Basics checklist preset.
const PROGRAM_TYPES = [
  { value: 'cpe_seminar',  label: 'CPE Seminar' },
  { value: 'workshop',     label: 'Workshop' },
  { value: 'study_circle', label: 'Study Circle Meet' },
  { value: 'conference',   label: 'Conference' },
  { value: 'mock_test',    label: 'Mock Test' },
  { value: 'revisionary',  label: 'Revisionary Batch' },
  { value: 'other',        label: 'Other' },
];

const EMPTY_FORM = {
  title: '',
  slug: '',
  description: '',
  committee_id: '',
  branch_id: '',
  audience: 'members',
  mode: 'in_person',
  venue: '',
  online_url: '',
  starts_at: '',
  ends_at: '',
  cpe_hours: '0',
  fee_rupees: '0',
  capacity: '',
  program_type: '',
  highlights: '',
  recurrence_rrule: '',
  banner_id: '',
  banner_url: '',
};

// Banner uploads can be image OR video. The file endpoint stores the
// original extension, so detecting from the URL is reliable enough to
// pick between <img> and <video>. We accept the same MIMEs server-side.
function isVideoUrl(url) {
  if (typeof url !== 'string') return false;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtPill(status) {
  const meta = EVENT_STATUS[status];
  const tone = meta?.tone ?? 'muted';
  const c = toneStyle(tone);
  return (
    <span
      title={meta?.long ?? status}
      style={{
        display: 'inline-block', padding: '.15rem .55rem', borderRadius: 999,
        background: c.bg, color: c.fg, fontSize: '.7rem', fontWeight: 600,
      }}
    >
      {eventLabel(status)}
    </span>
  );
}

export default function EventsAdminPage() {
  const { showToast } = useAuth();
  const route = useRoute();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [committee, setCommittee] = useState('');
  const [q, setQ] = useState('');

  const [editingId, setEditingId] = useState(null); // null | 'new' | uuid
  const drawerOpen = editingId !== null;

  // Only admin + branch_chairman can create / edit / publish / cancel events.
  // Everyone else (committee chairmen, treasurer, secretary, branch manager,
  // accountant, MCMs) sees the page read-only so they can still find their
  // checklist tasks.
  const { codes } = useRoleFlags();
  const canManageEvents = codes.has('admin') || codes.has('branch_chairman');

  // Open editor from ?edit=<id> hash query so deep links work.
  useEffect(() => {
    if (route.query.edit && editingId === null) setEditingId(route.query.edit);
    if (route.query.new === '1' && editingId === null) setEditingId('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.edit, route.query.new]);

  const { data, loading, refresh } = useAdminList('/api/admin/events', {
    page, pageSize: 20, status, committee_id: committee, q,
  });
  const { data: lookups } = useAdminList('/api/admin/events/_meta/lookups');

  const columns = useMemo(() => [
    { key: 'title', header: 'Title', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.title}</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.committee_name || '—'}</div>
      </div>
    )},
    { key: 'starts_at', header: 'When', render: (r) => fmtDate(r.starts_at), width: 180 },
    { key: 'audience', header: 'Audience', width: 110 },
    { key: 'mode', header: 'Mode', render: (r) => r.mode.replace('_', ' '), width: 110 },
    { key: 'registered_count', header: 'Reg.', render: (r) => (
      <span>{r.registered_count}{r.capacity ? <span className="muted-text"> / {r.capacity}</span> : ''}</span>
    ), width: 80 },
    { key: 'status', header: 'Status', render: (r) => fmtPill(r.status), width: 130 },
    { key: 'timeline', header: 'Progress', render: (r) => <EventTimeline event={r} compact />, width: 140 },
    { key: 'checklist', header: 'Approval', render: (r) => <ChecklistButton row={r} showToast={showToast} refresh={refresh} />, width: 220 },
    { key: 'actions',  header: '', render: (r) => <EventQuickActions row={r} showToast={showToast} onChanged={refresh} />, width: 100 },
  ], [showToast, refresh]);

  return (
    <AdminLayout
      title="Events"
      subtitle="Create and publish events to the public site"
      actions={
        canManageEvents ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditingId('new')}>
            <IconPlus size="sm" />
            <span>New event</span>
          </button>
        ) : null
      }
    >
      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={page}
        pageSize={data?.pageSize ?? 20}
        onPageChange={setPage}
        onSearch={(s) => { setQ(s); setPage(1); }}
        searchPlaceholder="Search by title…"
        onRowClick={(row) => setEditingId(row.id)}
        emptyMessage="No events match your filters. Create your first event to get started."
        filters={
          <>
            <select className="input-base" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
            <select className="input-base" value={committee} onChange={(e) => { setCommittee(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
              <option value="">All committees</option>
              {lookups?.committees?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        }
      />

      <EventDrawer
        open={drawerOpen}
        id={editingId}
        lookups={lookups}
        canManage={canManageEvents}
        onClose={() => { setEditingId(null); if (route.query.edit || route.query.new) navigate('/admin/events'); }}
        onSaved={() => { refresh(); }}
        showToast={showToast}
      />

      <style>{`
        .input-base {
          width: 100%; padding: .5rem .75rem;
          border: 1px solid var(--border); border-radius: .375rem;
          background: var(--background); font-size: .875rem; color: var(--foreground);
        }
        .input-base:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        .field-label { font-size: .75rem; font-weight: 600; color: var(--foreground); text-transform: uppercase; letter-spacing: .03em; }
        .admin-pill {
          padding: .125rem .5rem; border-radius: 999px;
          font-size: .6875rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-draft { background: #fef3c7; color: #92400e; }
        .admin-pill-pending_approval { background: #ddd6fe; color: #5b21b6; }
        .admin-pill-approved { background: #dbeafe; color: #1e40af; }
        .admin-pill-published { background: #d1fae5; color: #065f46; }
        .admin-pill-cancelled { background: #fee2e2; color: #991b1b; }
        .admin-pill-completed { background: #e5e7eb; color: #374151; }
      `}</style>
    </AdminLayout>
  );
}

// ─── Wizard step definitions ─────────────────────────────────────────────
// Editing reuses the same step layout but the user can jump freely. New-event
// creation enforces sequential progression so non-tech committee chairs are
// guided through the fields.
const WIZARD_STEPS = [
  { key: 'basics',    label: 'What & when',   hint: 'Title, committee, date, mode' },
  { key: 'audience',  label: 'Who & how much', hint: 'Audience, CPE, fee, capacity' },
  { key: 'promote',   label: 'Promote it',     hint: 'Banner, description, highlights' },
  { key: 'review',    label: 'Review',         hint: 'Confirm and submit' },
];

function EventDrawer({ open, id, lookups, canManage, onClose, onSaved, showToast }) {
  const isNew = id === 'new';
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // Only admin + branch_chairman can edit / publish / cancel / delete an
  // event. Other admin-shell roles see the drawer in read-only mode so they
  // can still inspect details while filling their checklist tasks.
  const readOnly = !canManage;

  // Reset to first step whenever the drawer opens (new or edit).
  useEffect(() => { if (open) setStepIdx(0); }, [open, id]);

  // Auto-default branch on new events. The Nagpur branch is the only one
  // configured today, so we transparently pick the first branch returned
  // by the lookups endpoint instead of asking the user to pick. This used
  // to be a visible dropdown that confused non-tech users.
  useEffect(() => {
    if (!open || !isNew) return;
    const defaultBranch = lookups?.branches?.[0]?.id;
    if (!defaultBranch) return;
    setForm((f) => f.branch_id ? f : { ...f, branch_id: defaultBranch });
  }, [open, isNew, lookups?.branches]);

  // Load existing event when editing.
  useEffect(() => {
    if (!open) return;
    if (isNew) {
      setForm(EMPTY_FORM);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    adminFetch(`/api/admin/events/${id}`)
      .then((row) => {
        setForm({
          title: row.title || '',
          slug: row.slug || '',
          description: row.description || '',
          committee_id: row.committee_id || '',
          branch_id: row.branch_id || '',
          audience: row.audience || 'members',
          mode: row.mode || 'in_person',
          venue: row.venue || '',
          online_url: row.online_url || '',
          starts_at: toLocalInput(row.starts_at),
          ends_at: toLocalInput(row.ends_at),
          cpe_hours: String(row.cpe_hours ?? '0'),
          fee_rupees: String((row.fee_paise ?? 0) / 100),
          capacity: row.capacity == null ? '' : String(row.capacity),
          program_type: row.program_type || '',
          highlights: Array.isArray(row.highlights) ? row.highlights.join('\n') : '',
          recurrence_rrule: row.recurrence_rrule || '',
          banner_id: row.banner_id || '',
          banner_url: row.banner_url || '',
          status: row.status,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, id, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onUpload = async (file) => {
    if (!file) return;
    // Per-type size cap mirrors the backend (admin/files.ts): images 6 MB,
    // videos 30 MB. Catching it client-side avoids a slow base64 + upload
    // round-trip just to be rejected.
    const isVideo = (file.type || '').startsWith('video/');
    const cap = isVideo ? 30 * 1024 * 1024 : 6 * 1024 * 1024;
    if (file.size > cap) {
      showToast?.(`File too large (max ${isVideo ? 30 : 6} MB)`, 'error');
      return;
    }
    setUploading(true);
    try {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const r = await adminFetch('/api/admin/files', {
        method: 'POST',
        body: { name: file.name, mime_type: file.type, bucket: 'banners', data_base64: b64 },
      });
      set('banner_id', r.id);
      set('banner_url', r.url);
      showToast?.(isVideo ? 'Video uploaded' : 'Image uploaded', 'success');
    } catch (e) {
      showToast?.(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        description: form.description || null,
        committee_id: form.committee_id,
        branch_id: form.branch_id || null,
        audience: form.audience,
        mode: form.mode,
        venue: form.mode === 'online' ? null : form.venue,
        online_url: form.mode === 'in_person' ? null : form.online_url,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        cpe_hours: form.cpe_hours,
        fee_paise: Math.round(Number(form.fee_rupees || 0) * 100),
        capacity: form.capacity === '' ? null : Number(form.capacity),
        program_type: form.program_type || null,
        highlights: form.highlights ? form.highlights.split('\n').map((s) => s.trim()).filter(Boolean) : null,
        banner_id: form.banner_id || null,
        recurrence_rrule: form.recurrence_rrule || null,
      };
      if (isNew) {
        const row = await adminFetch('/api/admin/events', { method: 'POST', body: payload });
        showToast?.('Event created', 'success');
        onSaved?.();
        onClose?.();
        return row;
      } else {
        await adminFetch(`/api/admin/events/${id}`, { method: 'PATCH', body: payload });
        showToast?.('Event updated', 'success');
        onSaved?.();
      }
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    // Two-step flow: first try without override. If the backend rejects
    // with "checklist not approved", offer the override path with a strong
    // confirm + reason capture (recorded in event_override_log).
    try {
      await adminFetch(`/api/admin/events/${id}/publish`, { method: 'POST' });
      showToast?.('Event published — visible on the public site', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('not fully approved') || msg.includes('override')) {
        const okay = confirm(
          "This event's checklist isn't fully approved.\n\n" +
          'Publishing now will be logged as a chairman override and shown in ' +
          'the audit trail. Continue?',
        );
        if (!okay) return;
        const reason = prompt('Reason for override? (recorded in the audit log)') || '';
        try {
          await adminFetch(
            `/api/admin/events/${id}/publish?override=true`,
            { method: 'POST', body: { reason: reason.trim() || null } },
          );
          showToast?.('Published with override — recorded in audit log', 'success');
          onSaved?.();
          onClose?.();
        } catch (e2) {
          showToast?.(e2.message || 'Override publish failed', 'error');
        }
        return;
      }
      showToast?.(msg, 'error');
    }
  };

  const onCancel = async () => {
    if (!confirm('Cancel this event? Registered attendees will no longer see it.')) return;
    try {
      await adminFetch(`/api/admin/events/${id}/cancel`, { method: 'POST' });
      showToast?.('Event cancelled', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const onDelete = async () => {
    if (!confirm('Delete this event permanently from the admin view? (Soft delete — data is kept.)')) return;
    try {
      await adminFetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      showToast?.('Event deleted', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  // Per-step validation for the wizard's Next button. Returns null when the
  // step is valid, or a sentence explaining what's missing.
  const stepError = (() => {
    if (stepIdx === 0) {
      if (!form.title?.trim()) return 'Please enter a title.';
      if (!form.committee_id)  return 'Please pick a committee.';
      if (!form.starts_at)     return 'Please pick a start date and time.';
      if (!form.ends_at)       return 'Please pick an end date and time.';
      if (form.mode !== 'online'    && !form.venue?.trim())      return 'In-person events need a venue.';
      if (form.mode !== 'in_person' && !form.online_url?.trim()) return 'Online / hybrid events need a joining URL.';
    }
    return null;
  })();

  const isLast = stepIdx === WIZARD_STEPS.length - 1;

  const onNext = () => {
    if (stepError) {
      showToast?.(stepError, 'error');
      return;
    }
    if (!isLast) setStepIdx((i) => i + 1);
  };
  const onBack = () => setStepIdx((i) => Math.max(0, i - 1));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={readOnly ? 'Event details' : (isNew ? 'Create event' : 'Edit event')}
      footer={
        <>
          {canManage && !isNew && form.status && form.status !== 'published' && form.status !== 'cancelled' && (
            <button type="button" className="btn btn-outline" onClick={onPublish} style={{ padding: '.5rem 1rem' }}>Publish</button>
          )}
          {canManage && !isNew && form.status && form.status !== 'cancelled' && (
            <button type="button" className="btn btn-outline" onClick={onCancel} style={{ padding: '.5rem 1rem', color: '#b91c1c' }}>Cancel event</button>
          )}
          {canManage && !isNew && (
            <button type="button" className="btn btn-outline" onClick={onDelete} style={{ padding: '.5rem 1rem', color: '#b91c1c' }}>Delete</button>
          )}

          {canManage && stepIdx > 0 && (
            <button type="button" className="btn btn-outline" onClick={onBack} style={{ padding: '.5rem 1rem' }}>← Back</button>
          )}
          {canManage && !isLast && (
            <button type="button" className="btn btn-primary" onClick={onNext} style={{ padding: '.5rem 1rem' }}>
              Next →
            </button>
          )}
          {canManage && isLast && (
            <button type="submit" form="event-form" disabled={saving} className="btn btn-primary" style={{ padding: '.5rem 1rem' }}>
              {saving ? 'Saving…' : (isNew ? 'Create event' : 'Save changes')}
            </button>
          )}
          {readOnly && (
            <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '.5rem 1rem' }}>Close</button>
          )}
        </>
      }
    >
      {loading ? (
        <DrawerFormSkeleton />
      ) : (
        <fieldset id="event-form-fieldset" disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 'auto' }}>
        <form id="event-form" onSubmit={onSubmit}>
          {readOnly && (
            <div style={{ background: '#eff6ff', color: '#1e3a8a', padding: '.625rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem', marginBottom: '1rem', border: '1px solid #bfdbfe' }}>
              Read-only view. Only the branch chairman or admin can change event details.
            </div>
          )}
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.625rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <WizardStepper steps={WIZARD_STEPS} activeIdx={stepIdx} onJump={isNew ? null : setStepIdx} />

          {stepIdx === 0 && (<>
          <Section title="Basics">
            <Grid>
              <FormField label="Title" required span={2}>
                <input className="input-base" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </FormField>
              <FormField label="Committee" required>
                <select className="input-base" value={form.committee_id} onChange={(e) => set('committee_id', e.target.value)} required>
                  <option value="">Select committee…</option>
                  {lookups?.committees?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Audience" required>
                <select className="input-base" value={form.audience} onChange={(e) => set('audience', e.target.value)}>
                  <option value="members">Members</option>
                  <option value="students">Students</option>
                  <option value="all">All</option>
                </select>
              </FormField>
              <FormField label="Mode" required>
                <select className="input-base" value={form.mode} onChange={(e) => set('mode', e.target.value)}>
                  <option value="in_person">In person</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </FormField>
              <FormField label="Programme type">
                <select className="input-base" value={form.program_type} onChange={(e) => set('program_type', e.target.value)}>
                  <option value="">— Pick a type —</option>
                  {PROGRAM_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </FormField>
              <FormField label="Description" span={2}>
                <textarea className="input-base" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </FormField>
            </Grid>
          </Section>

          <Section title="Schedule">
            <Grid>
              <FormField label="Starts at" required>
                <DateTimePicker value={form.starts_at} onChange={(v) => set('starts_at', v)} required />
              </FormField>
              <FormField label="Ends at" required>
                <DateTimePicker value={form.ends_at} onChange={(v) => set('ends_at', v)} required />
              </FormField>
            </Grid>
          </Section>

          <Section title="Venue & access">
            <Grid>
              {form.mode !== 'online' && (
                <FormField label="Venue" required={form.mode !== 'online'} span={2}>
                  <input className="input-base" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="ICAI Bhawan, Nagpur" />
                </FormField>
              )}
              {form.mode !== 'in_person' && (
                <FormField label="Online URL" required={form.mode === 'online'} span={2}>
                  <input className="input-base" value={form.online_url} onChange={(e) => set('online_url', e.target.value)} placeholder="https://…" />
                </FormField>
              )}
            </Grid>
          </Section>
          </>)}

          {stepIdx === 1 && (<>
          <Section title="Pricing & capacity">
            <Grid>
              <FormField label="CPE hours">
                <input type="number" step="0.5" min="0" className="input-base" value={form.cpe_hours} onChange={(e) => set('cpe_hours', e.target.value)} />
              </FormField>
              <FormField label="Registration fee (₹)">
                <input type="number" step="1" min="0" className="input-base" value={form.fee_rupees} onChange={(e) => set('fee_rupees', e.target.value)} />
              </FormField>
              <FormField label="Capacity" hint="Leave blank for unlimited" span={2}>
                <input type="number" step="1" min="0" className="input-base" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
              </FormField>
            </Grid>
          </Section>

          </>)}

          {stepIdx === 2 && (<>
          <Section title="Banner">
            <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              {form.banner_url && (isVideoUrl(form.banner_url) ? (
                <video
                  src={form.banner_url}
                  controls
                  muted
                  playsInline
                  style={{ width: 240, height: 135, objectFit: 'cover', borderRadius: '.375rem', border: '1px solid var(--border)', background: '#000' }}
                />
              ) : (
                <img src={form.banner_url} alt="banner" style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: '.375rem', border: '1px solid var(--border)' }} />
              ))}
              <label className="btn btn-outline" style={{ padding: '.5rem 1rem', cursor: uploading ? 'wait' : 'pointer' }}>
                {uploading ? 'Uploading…' : (form.banner_url ? 'Replace' : 'Upload image or video')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
                />
              </label>
              {form.banner_url && (
                <button type="button" className="btn btn-outline" onClick={() => { set('banner_id', ''); set('banner_url', ''); }} style={{ padding: '.5rem 1rem' }}>Remove</button>
              )}
            </div>
            <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
              Images (JPEG / PNG / WebP / GIF) up to 6 MB · Videos (MP4 / WebM / MOV) up to 30 MB.
            </div>
          </Section>

          <Section title="Highlights">
            <FormField label="One per line" hint="Shown as bullet points on the public page">
              <textarea className="input-base" rows={4} value={form.highlights} onChange={(e) => set('highlights', e.target.value)} placeholder="Live Q&A with industry experts&#10;Certificate of participation" />
            </FormField>
          </Section>
          </>)}

          {stepIdx === 3 && (
            <>
              <WizardReview form={form} lookups={lookups} onJumpToStep={setStepIdx} />
              {!isNew && (
                <div style={{ marginTop: '1.25rem' }}>
                  <ComparableEventsPanel
                    eventId={id}
                    currentFeePaise={Math.round(Number(form.fee_rupees || 0) * 100)}
                    currentCapacity={form.capacity ? Number(form.capacity) : null}
                  />
                </div>
              )}
            </>
          )}
        </form>
        </fieldset>
      )}
    </Drawer>
  );
}

// ─── Wizard stepper UI ───────────────────────────────────────────────────────
function WizardStepper({ steps, activeIdx, onJump }) {
  return (
    <div className="event-wiz-stepper">
      {steps.map((s, i) => {
        const past = i < activeIdx;
        const active = i === activeIdx;
        return (
          <button
            key={s.key}
            type="button"
            disabled={!onJump}
            onClick={() => onJump?.(i)}
            className={
              'event-wiz-step' +
              (active ? ' is-active' : '') +
              (past ? ' is-past' : '')
            }
            style={onJump ? { cursor: 'pointer' } : { cursor: 'default' }}
          >
            <span className="event-wiz-step-index">{past ? '✓' : i + 1}</span>
            <span className="event-wiz-step-text">
              <span className="event-wiz-step-label">{s.label}</span>
              <span className="event-wiz-step-hint">{s.hint}</span>
            </span>
          </button>
        );
      })}

      <style>{`
        .event-wiz-stepper {
          display: grid;
          grid-template-columns: repeat(${steps.length}, 1fr);
          gap: .5rem;
          margin-bottom: 1.25rem;
        }
        .event-wiz-step {
          display: flex; align-items: center; gap: .5rem;
          padding: .5rem .625rem;
          background: var(--muted, #f8fafc);
          border: 1px solid var(--border);
          border-radius: .375rem;
          text-align: left; width: 100%; min-width: 0;
        }
        .event-wiz-step.is-active {
          background: white;
          border-color: var(--primary, #1e40af);
          box-shadow: 0 0 0 2px rgba(30,64,175,.08);
        }
        .event-wiz-step.is-past .event-wiz-step-index {
          background: #16a34a; color: white;
        }
        .event-wiz-step.is-active .event-wiz-step-index {
          background: var(--primary, #1e40af); color: white;
        }
        .event-wiz-step-index {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.5rem; height: 1.5rem; border-radius: 999px;
          background: #cbd5e1; color: #475569;
          font-size: .75rem; font-weight: 700; flex-shrink: 0;
        }
        .event-wiz-step-text { display: flex; flex-direction: column; min-width: 0; }
        .event-wiz-step-label {
          font-size: .8125rem; font-weight: 600;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .event-wiz-step-hint {
          font-size: .6875rem; color: var(--muted-foreground);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        @media (max-width: 700px) {
          .event-wiz-step-hint { display: none; }
        }
      `}</style>
    </div>
  );
}

// ─── Step 4: Review pane ─────────────────────────────────────────────────────
function WizardReview({ form, lookups, onJumpToStep }) {
  const committee = lookups?.committees?.find((c) => c.id === form.committee_id);
  const programLabel = PROGRAM_TYPES.find((p) => p.value === form.program_type)?.label || '—';
  const rows = [
    { label: 'Title',         value: form.title || '—',                   step: 0 },
    { label: 'Committee',     value: committee?.name || '—',              step: 0 },
    { label: 'Programme type', value: programLabel,                        step: 0 },
    { label: 'When',          value: form.starts_at && form.ends_at ? `${fmtDate(form.starts_at)} → ${fmtDate(form.ends_at)}` : '—', step: 0 },
    { label: 'Mode',          value: form.mode?.replace('_', ' '),        step: 0 },
    { label: 'Venue / URL',   value: form.mode === 'online' ? (form.online_url || '—') : (form.venue || '—'), step: 0 },
    { label: 'Audience',      value: form.audience,                       step: 1 },
    { label: 'CPE hours',     value: form.cpe_hours || '0',                step: 1 },
    { label: 'Fee',           value: form.fee_rupees && Number(form.fee_rupees) > 0 ? `₹${form.fee_rupees}` : 'Free', step: 1 },
    { label: 'Capacity',      value: form.capacity || 'Unlimited',         step: 1 },
    { label: 'Banner',        value: form.banner_url ? 'Uploaded' : 'No banner',  step: 2 },
    { label: 'Highlights',    value: form.highlights ? `${form.highlights.split('\n').filter(Boolean).length} points` : 'None', step: 2 },
  ];

  return (
    <div className="event-wiz-review">
      <p style={{ fontSize: '.875rem', color: 'var(--muted-foreground)', margin: '0 0 1rem' }}>
        Confirm the details below. Click any row to jump back and edit.
      </p>
      <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '.5rem 1rem', margin: 0 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <dt style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
              {r.label}
            </dt>
            <dd style={{ margin: 0, fontSize: '.875rem' }}>
              <button
                type="button"
                onClick={() => onJumpToStep(r.step)}
                style={{
                  background: 'transparent', border: 0, padding: 0,
                  color: 'inherit', textAlign: 'left', cursor: 'pointer',
                  textDecoration: 'underline dotted', textDecorationColor: 'transparent',
                  transition: 'text-decoration-color .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'var(--muted-foreground)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
              >
                {r.value}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
      <legend style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: '.5rem' }}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>{children}</div>;
}

// Shimmer placeholder shown while the event detail loads. Mirrors the real
// form's section layout so the drawer doesn't jump on resolve.
function DrawerFormSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Shimmer height=".7rem" width="20%" style={{ marginBottom: '.75rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <ShimmerFormField span={2} />
          <ShimmerFormField />
          <ShimmerFormField />
        </div>
      </div>
      <div>
        <Shimmer height=".7rem" width="20%" style={{ marginBottom: '.75rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <ShimmerFormField />
          <ShimmerFormField />
          <ShimmerFormField span={2} />
        </div>
      </div>
      <div>
        <Shimmer height=".7rem" width="20%" style={{ marginBottom: '.75rem' }} />
        <ShimmerFormField span={2} />
      </div>
    </div>
  );
}

// Checklist column action. Two states:
//   • No checklist yet     → "+ Create checklist" opens template picker
//   • Instance exists      → status pill, jumps to /my-checklists?id=<id>
const CHECKLIST_STATUS_LABEL = {
  draft:           'Draft — release pending',
  awaiting_fill:   'With committee chair',
  awaiting_review: 'With branch chair',
  approved:        'Approved',
  rejected:        'Rejected — needs revisions',
};
const CHECKLIST_STATUS_STYLE = {
  draft:           { bg: '#f1f5f9', fg: '#475569' },
  awaiting_fill:   { bg: '#fef3c7', fg: '#92400e' },
  awaiting_review: { bg: '#dbeafe', fg: '#1e40af' },
  approved:        { bg: '#dcfce7', fg: '#166534' },
  rejected:        { bg: '#fee2e2', fg: '#991b1b' },
};

function ChecklistButton({ row, showToast, refresh }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (row.instance_id) {
    const c = CHECKLIST_STATUS_STYLE[row.instance_status] || { bg: '#f1f5f9', fg: '#475569' };
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); navigate('/my-checklists?id=' + row.instance_id); }}
        style={{
          padding: '.2rem .55rem', fontSize: '.7rem', fontWeight: 600,
          borderRadius: 999, border: 0, cursor: 'pointer',
          background: c.bg, color: c.fg,
        }}
      >
        {CHECKLIST_STATUS_LABEL[row.instance_status] ?? row.instance_status} →
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-outline"
        onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
        style={{ padding: '.3rem .6rem', fontSize: '.73rem', gap: '.3rem' }}
      >
        <IconCheckCircle size="xs" />
        <span>Create checklist</span>
      </button>
      {pickerOpen && (
        <TemplatePickerModal
          eventId={row.id}
          eventTitle={row.title}
          onClose={() => setPickerOpen(false)}
          onCreated={(id) => {
            setPickerOpen(false);
            refresh?.();
            navigate('/my-checklists?id=' + id);
          }}
          showToast={showToast}
        />
      )}
    </>
  );
}

// ─── Template picker + assignment (event approval flow) ─────────────────
//
// Two-step modal:
//   Step 1 — pick a published template.
//   Step 2 — review the template's sections + assign WHO fills each one
//            (chairman, treasurer, convener, etc.). Skipping a section
//            leaves it to the primary filler (auto-resolved committee
//            chairman). Optional override for primary filler + reviewer too.
//
// On Create, POSTs to /api/checklist-instances with section_assignments
// included. The fill UI is the new rich renderer (radio, dropdown, file,
// etc.). On approval, a DB trigger auto-publishes the event.

function TemplatePickerModal({ eventId, eventTitle, onClose, onCreated, showToast }) {
  // step: 'pick' | 'assign'
  const [step, setStep] = useState('pick');
  const [templates, setTemplates] = useState(null);
  const [pickedTemplate, setPickedTemplate] = useState(null);
  const [templateDetail, setTemplateDetail] = useState(null); // { questions, ... }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  // assignments: { [section_question_id]: user_id|null }
  const [assignments, setAssignments] = useState({});
  const [primaryFiller, setPrimaryFiller] = useState(''); // user_id
  const [primaryReviewer, setPrimaryReviewer] = useState(''); // user_id
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);

  // Load published templates on mount.
  useEffect(() => {
    let cancelled = false;
    adminFetch('/api/checklist-templates')
      .then((j) => { if (!cancelled) setTemplates((j.rows || []).filter((t) => t.is_published)); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  // Pre-fetch the user directory in the background — same call we'll use
  // for the per-section picker. Throttled by 250ms debounce on search.
  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    const q = userSearch.trim();
    const url = q
      ? `/api/admin/users?q=${encodeURIComponent(q)}&status=active&pageSize=25`
      : '/api/admin/users?status=active&pageSize=50';
    const t = setTimeout(() => {
      adminFetch(url)
        .then((j) => { if (!cancelled) setUsers(j.rows || []); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setUsersLoading(false); });
    }, q ? 250 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [userSearch]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Helper: friendly description of a role-code → label mapping. The
  // template's section_owner_role hints WHO REVIEWS this section; we mirror
  // that hint as a placeholder ("Suggested: Treasurer") on each picker so
  // the admin knows the recommended role before picking a user.
  const roleLabel = (code) => {
    if (!code) return null;
    const map = {
      committee_chairman: 'Committee Chairman',
      committee_convener: 'Committee Convener',
      committee_co_convener: 'Committee Co-Convener',
      committee_member: 'Committee Member',
      mcm: 'Managing Committee Member',
      branch_chairman: 'Branch Chairman',
      branch_vice_chairman: 'Branch Vice-Chairman',
      branch_secretary: 'Branch Secretary',
      branch_treasurer: 'Branch Treasurer',
      accountant: 'Accountant',
      branch_manager: 'Branch Manager',
    };
    return map[code] || code;
  };

  async function pickTemplate(template) {
    setPickedTemplate(template);
    setStep('assign');
    setLoadingDetail(true);
    try {
      const j = await adminFetch(`/api/checklist-templates/${template.id}`);
      setTemplateDetail(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function create() {
    if (creating || !pickedTemplate) return;
    setCreating(true);
    setErr('');
    try {
      // Convert the assignments map into the array shape the API expects.
      // Drop null/empty values — those mean "no override, let primary filler
      // cover this section".
      const section_assignments = Object.entries(assignments)
        .filter(([_, uid]) => !!uid)
        .map(([section_question_id, assignee_id]) => ({ section_question_id, assignee_id }));

      const body = {
        template_id: pickedTemplate.id,
        event_id: eventId,
        title: `${pickedTemplate.name} — ${eventTitle}`,
        section_assignments,
      };
      if (primaryFiller)   body.assigned_fill_user_id   = primaryFiller;
      if (primaryReviewer) body.assigned_review_user_id = primaryReviewer;

      const created = await adminFetch('/api/checklist-instances', { method: 'POST', body });
      invalidate('/api/admin/events');
      showToast?.(`Checklist created from "${pickedTemplate.name}"`, 'success');
      onCreated(created.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  // Sections to assign — derived from the template detail. Filters
  // questions[] down to type=section_heading rows, in template order.
  const sections = (templateDetail?.questions || [])
    .filter((q) => q.type === 'section_heading');

  // Total of currently-assigned sections (used for the assign button copy).
  const assignedCount = Object.values(assignments).filter(Boolean).length;

  return (
    <div className="tp-root" onClick={onClose}>
      <div className="tp-card" onClick={(e) => e.stopPropagation()}>
        <header className="tp-head">
          <div>
            <h2 className="tp-title">
              {step === 'pick' ? 'Pick a checklist template' : 'Who fills each section?'}
            </h2>
            <p className="tp-sub">For event: <strong>{eventTitle}</strong></p>
          </div>
          <button className="tp-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="tp-body">
          {err && <p style={{ color: 'var(--destructive)' }}>{err}</p>}

          {/* ─── Step 1: pick template ─── */}
          {step === 'pick' && (
            <>
              {templates === null && (
                <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1rem' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                        <Shimmer height=".9rem" width={`${45 + ((i * 11) % 30)}%`} />
                        <Shimmer height=".7rem" width="65%" />
                      </div>
                      <Shimmer height="1rem" width="2.5rem" />
                    </div>
                  ))}
                </div>
              )}
              {templates && templates.length === 0 && (
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <p className="muted-text" style={{ marginBottom: '.5rem' }}>
                    No active templates yet.
                  </p>
                  <a href="#/admin/checklist-templates" className="btn-primary" style={{ padding: '.375rem .75rem', display: 'inline-block', textDecoration: 'none', fontSize: '.8125rem' }}>
                    Build one →
                  </a>
                </div>
              )}
              {templates?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="tp-row"
                  onClick={() => pickTemplate(t)}
                >
                  <div>
                    <strong>{t.name}</strong>{' '}
                    <span className="muted-text" style={{ fontSize: '.75rem' }}>v{t.version}</span>
                    {t.category && (
                      <span className="tp-chip">{t.category}</span>
                    )}
                    {t.description && (
                      <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.15rem' }}>
                        {t.description}
                      </div>
                    )}
                  </div>
                  <span className="tp-cta">Next →</span>
                </button>
              ))}
            </>
          )}

          {/* ─── Step 2: assign fillers ─── */}
          {step === 'assign' && (
            <>
              {loadingDetail && (
                <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <Shimmer height="1.1rem" width="55%" />
                  <ShimmerLines count={3} lastWidth="60%" />
                  <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: '.5rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <ShimmerFormField key={i} />
                    ))}
                  </div>
                </div>
              )}
              {!loadingDetail && templateDetail && (
                <>
                  <div className="tp-banner">
                    <strong>{pickedTemplate.name}</strong>
                    <p>
                      Pick a person for each section, or leave it blank. Anyone you skip will be filled by the
                      <strong> primary filler</strong> below (auto-set to the committee chairman by default).
                    </p>
                  </div>

                  <div className="tp-search">
                    <input
                      type="search"
                      placeholder="Search users by name or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="tp-input"
                    />
                    {usersLoading && <span className="muted-text" style={{ fontSize: '.7rem' }}>Loading…</span>}
                  </div>

                  {sections.length === 0 && (
                    <p className="muted-text" style={{ fontSize: '.85rem' }}>
                      This template has no sections — the primary filler handles everything.
                    </p>
                  )}

                  {sections.map((s) => {
                    const value = assignments[s.id] || '';
                    const hint = roleLabel(s.section_owner_role);
                    return (
                      <div key={s.id} className="tp-section-row">
                        <div className="tp-section-info">
                          <strong>{s.label || '(unnamed section)'}</strong>
                          {hint && (
                            <span className="muted-text" style={{ fontSize: '.7rem' }}>
                              Reviewed by {hint}
                            </span>
                          )}
                        </div>
                        <UserPicker
                          users={users}
                          value={value}
                          placeholder="— Primary filler —"
                          onChange={(uid) => setAssignments((m) => ({ ...m, [s.id]: uid }))}
                        />
                      </div>
                    );
                  })}

                  <details className="tp-advanced">
                    <summary>Advanced: override primary filler / reviewer</summary>
                    <div className="tp-advanced-body">
                      <div className="tp-section-row">
                        <div className="tp-section-info">
                          <strong>Primary filler</strong>
                          <span className="muted-text" style={{ fontSize: '.7rem' }}>
                            Default: current Committee Chairman
                          </span>
                        </div>
                        <UserPicker
                          users={users}
                          value={primaryFiller}
                          placeholder="— Auto (Committee Chairman) —"
                          onChange={setPrimaryFiller}
                        />
                      </div>
                      <div className="tp-section-row">
                        <div className="tp-section-info">
                          <strong>Reviewer</strong>
                          <span className="muted-text" style={{ fontSize: '.7rem' }}>
                            Default: current Branch Chairman
                          </span>
                        </div>
                        <UserPicker
                          users={users}
                          value={primaryReviewer}
                          placeholder="— Auto (Branch Chairman) —"
                          onChange={setPrimaryReviewer}
                        />
                      </div>
                    </div>
                  </details>
                </>
              )}
            </>
          )}
        </div>

        <footer className="tp-foot">
          {step === 'assign' && (
            <button type="button" className="tp-back" onClick={() => { setStep('pick'); setPickedTemplate(null); setAssignments({}); }}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="tp-cancel" onClick={onClose}>Cancel</button>
          {step === 'assign' && (
            <button
              type="button"
              className="btn-primary"
              onClick={create}
              disabled={creating || loadingDetail}
              style={{ padding: '.45rem 1rem' }}
            >
              {creating ? 'Creating…' : `Create checklist${assignedCount > 0 ? ` (${assignedCount} assigned)` : ''}`}
            </button>
          )}
        </footer>

        <style>{`
          .tp-root {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(15,23,42,.45);
            display: flex; align-items: flex-start; justify-content: center;
            padding: 5vh 1rem; overflow-y: auto;
          }
          .tp-card {
            width: 100%; max-width: 640px;
            background: var(--card); border-radius: .5rem;
            box-shadow: 0 20px 50px rgba(0,0,0,.25);
            display: flex; flex-direction: column; max-height: 90vh;
          }
          .tp-head {
            display: flex; align-items: flex-start; justify-content: space-between;
            padding: 1rem 1.25rem; border-bottom: 1px solid var(--border);
          }
          .tp-title { margin: 0; font-size: 1rem; font-weight: 700; }
          .tp-sub { margin: .15rem 0 0; font-size: .8125rem; color: var(--muted-foreground); }
          .tp-x {
            background: transparent; border: 0; font-size: 1.5rem; line-height: 1;
            cursor: pointer; color: var(--muted-foreground); padding: 0 .5rem;
          }
          .tp-body { padding: 1rem 1.25rem; overflow-y: auto; }
          .tp-row {
            display: flex; align-items: center; justify-content: space-between; gap: 1rem;
            width: 100%; padding: .75rem .875rem;
            background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
            cursor: pointer; margin-bottom: .5rem; text-align: left; font: inherit; color: inherit;
            transition: border-color .12s, background .12s;
          }
          .tp-row:hover:not(:disabled) { border-color: var(--primary); background: var(--background); }
          .tp-row:disabled { opacity: .5; cursor: wait; }
          .tp-row-empty { background: var(--background); border-style: dashed; }
          .tp-cta { font-size: .8125rem; font-weight: 600; color: var(--primary); white-space: nowrap; }
          .tp-divider {
            text-align: center; font-size: .7rem; color: var(--muted-foreground);
            margin: .5rem 0; letter-spacing: .06em; text-transform: uppercase;
          }
          .tp-chip {
            display: inline-block; margin-left: .5rem; padding: .05rem .4rem;
            background: var(--background); border: 1px solid var(--border);
            border-radius: 999px; font-size: .65rem; color: var(--muted-foreground);
          }
          .tp-foot {
            display: flex; gap: .5rem; align-items: center;
            padding: .75rem 1rem;
            border-top: 1px solid var(--border);
            background: var(--background, #fafbfc);
          }
          .tp-back, .tp-cancel {
            background: transparent; border: 1px solid var(--border);
            border-radius: .375rem; padding: .4rem .75rem;
            font: inherit; font-size: .8125rem; cursor: pointer;
            color: var(--muted-foreground);
          }
          .tp-back:hover, .tp-cancel:hover { color: var(--foreground); }
          .tp-banner {
            padding: .65rem .875rem; margin-bottom: .75rem;
            background: rgba(37, 99, 235, .06);
            border: 1px solid rgba(37, 99, 235, .15);
            border-radius: .375rem;
            font-size: .8125rem;
          }
          .tp-banner strong { display: block; font-size: .9rem; margin-bottom: .15rem; }
          .tp-banner p { margin: 0; color: var(--muted-foreground); }
          .tp-search {
            display: flex; align-items: center; gap: .5rem;
            margin-bottom: .65rem;
          }
          .tp-input {
            flex: 1; padding: .4rem .55rem;
            border: 1px solid var(--border); border-radius: .375rem;
            background: var(--card); font: inherit; color: inherit;
          }
          .tp-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
          .tp-section-row {
            display: flex; gap: .75rem; align-items: center;
            padding: .55rem .65rem;
            background: var(--card); border: 1px solid var(--border);
            border-radius: .375rem; margin-bottom: .35rem;
          }
          .tp-section-info {
            flex: 1; min-width: 0;
            display: flex; flex-direction: column; gap: .1rem;
          }
          .tp-section-info strong { font-size: .85rem; }
          .tp-advanced {
            margin-top: 1rem; padding: .5rem .75rem;
            background: var(--background, #fafbfc);
            border: 1px solid var(--border); border-radius: .375rem;
            font-size: .8125rem;
          }
          .tp-advanced summary {
            cursor: pointer; font-weight: 600;
            color: var(--muted-foreground);
          }
          .tp-advanced summary:hover { color: var(--foreground); }
          .tp-advanced-body { margin-top: .5rem; }
          .up-wrap {
            position: relative; min-width: 220px; max-width: 260px;
            flex-shrink: 0;
          }
          .up-trigger {
            width: 100%; padding: .35rem .55rem;
            background: var(--card); border: 1px solid var(--border);
            border-radius: .375rem;
            font: inherit; font-size: .8125rem; text-align: left;
            display: flex; align-items: center; justify-content: space-between;
            cursor: pointer;
          }
          .up-trigger:hover { border-color: var(--primary); }
          .up-trigger.is-empty { color: var(--muted-foreground); }
          .up-chev { font-size: .65rem; opacity: .6; margin-left: .3rem; }
          .up-menu {
            position: absolute; top: calc(100% + .25rem); right: 0;
            z-index: 6; min-width: 280px;
            background: white; border: 1px solid var(--border);
            border-radius: .5rem; box-shadow: 0 6px 22px rgba(0,0,0,.12);
            padding: .35rem;
            display: flex; flex-direction: column;
            max-height: 280px; overflow-y: auto;
          }
          .up-item {
            display: flex; align-items: center; gap: .5rem;
            width: 100%; padding: .4rem .55rem;
            text-align: left; background: transparent; border: 0; cursor: pointer;
            font: inherit; font-size: .8125rem; color: var(--foreground);
            border-radius: .3rem;
          }
          .up-item:hover { background: var(--background, #f8fafc); }
          .up-item.is-active {
            background: rgba(37, 99, 235, .08);
            color: var(--primary, #1e40af);
            font-weight: 600;
          }
          .up-item-empty {
            color: var(--muted-foreground); padding: .5rem .55rem; font-size: .8rem;
          }
          .up-item-clear {
            border-top: 1px solid var(--border); margin-top: .2rem;
            color: var(--muted-foreground);
          }
        `}</style>
      </div>
    </div>
  );
}

// ─── User picker (used in TemplatePickerModal) ────────────────────────────
// Click-to-open dropdown. Doesn't filter `users` — the parent already
// debounced its server-side ?q= search — but does show "no users found"
// when empty so the admin understands what's going on. The empty value
// `''` is treated as "no override" and renders the placeholder text.
function UserPicker({ users, value, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const picked = value ? users.find((u) => u.id === value) : null;
  const label = picked ? `${picked.name}` : placeholder;

  return (
    <div ref={wrapRef} className="up-wrap">
      <button
        type="button"
        className={'up-trigger' + (picked ? '' : ' is-empty')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span className="up-chev">▾</span>
      </button>
      {open && (
        <div className="up-menu" role="menu">
          {users.length === 0 ? (
            <div className="up-item-empty">No users in that search</div>
          ) : (
            users.map((u) => {
              const active = u.id === value;
              return (
                <button
                  key={u.id}
                  type="button"
                  className={'up-item' + (active ? ' is-active' : '')}
                  onClick={() => { onChange(u.id); setOpen(false); }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong style={{ fontWeight: 600 }}>{u.name}</strong>
                    <span style={{ marginLeft: '.4rem', color: 'var(--muted-foreground)', fontSize: '.75rem' }}>
                      {u.email}
                    </span>
                  </span>
                  {active && <span style={{ color: 'var(--primary, #1e40af)' }}>✓</span>}
                </button>
              );
            })
          )}
          {value && (
            <button
              type="button"
              className="up-item up-item-clear"
              onClick={() => { onChange(''); setOpen(false); }}
            >
              Clear (use default)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
