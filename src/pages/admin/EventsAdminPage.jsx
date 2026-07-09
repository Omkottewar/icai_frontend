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
import { MCM_ROLE_CODES, ROLE_CODE_LABEL, FILLER_ROLE_CODES, APPROVER_ROLE_CODES } from '../../lib/checklistQuestions';
import EventTimeline from '../../components/admin/EventTimeline';
import ComparableEventsPanel from '../../components/admin/ComparableEventsPanel';
import EventQuickActions from '../../components/admin/EventQuickActions';
import { dialog } from '../../lib/dialog';
import { publishEventWithOverride } from '../../lib/eventPublish';
import Button from '../../components/ui/Button';
import DateTimePicker from '../../components/admin/DateTimePicker';
import FlipMenu from '../../components/ui/FlipMenu';
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
  gst_applicable: false,
  gst_percent: '18',
  capacity: '',
  program_type: '',
  highlights: '',
  recurrence_rrule: '',
  banner_id: '',
  banner_url: '',
  speaker_name: '',
  speaker_bio: '',
  speaker_photo_id: '',
  speaker_photo_url: '',
  // Recurrence (used on CREATE only — series expansion runs server-side
  // after the seed event is created via /repeat). Editing an existing
  // series happens through the dedicated "Series" view, not this form.
  recurring_enabled: false,
  recurring_freq: 'WEEKLY',
  recurring_interval: 1,
  recurring_count: 4,
  recurring_until: '',
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
        onSaved={refresh}
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
          gst_applicable: Boolean(row.gst_applicable),
          gst_percent: String(row.gst_percent ?? '18'),
          capacity: row.capacity == null ? '' : String(row.capacity),
          program_type: row.program_type || '',
          highlights: Array.isArray(row.highlights) ? row.highlights.join('\n') : '',
          recurrence_rrule: row.recurrence_rrule || '',
          banner_id: row.banner_id || '',
          banner_url: row.banner_url || '',
          speaker_name: row.speaker_name || '',
          speaker_bio: row.speaker_bio || '',
          speaker_photo_id: row.speaker_photo_id || '',
          speaker_photo_url: row.speaker_photo_url || '',
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
    // videos 100 MB. Catching it client-side avoids a slow base64 + upload
    // round-trip just to be rejected.
    const isVideo = (file.type || '').startsWith('video/');
    const cap = isVideo ? 100 * 1024 * 1024 : 6 * 1024 * 1024;
    if (file.size > cap) {
      showToast?.(`File too large (max ${isVideo ? 100 : 6} MB)`, 'error');
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

  // Speaker photo upload — images only. Reuses the same files endpoint as
  // the banner upload; a separate bucket ('speakers') keeps the two
  // logically separated for storage cleanup / retention rules.
  const onSpeakerPhotoUpload = async (file) => {
    if (!file) return;
    if (!(file.type || '').startsWith('image/')) {
      showToast?.('Speaker photo must be an image', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast?.('Speaker photo too large (max 4 MB)', 'error');
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
        body: { name: file.name, mime_type: file.type, bucket: 'speakers', data_base64: b64 },
      });
      set('speaker_photo_id', r.id);
      set('speaker_photo_url', r.url);
      showToast?.('Speaker photo uploaded', 'success');
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
        gst_applicable: Boolean(form.gst_applicable),
        gst_percent: form.gst_applicable ? Number(form.gst_percent || 18) : 0,
        capacity: form.capacity === '' ? null : Number(form.capacity),
        program_type: form.program_type || null,
        highlights: form.highlights ? form.highlights.split('\n').map((s) => s.trim()).filter(Boolean) : null,
        banner_id: form.banner_id || null,
        recurrence_rrule: form.recurrence_rrule || null,
        speaker_name: form.speaker_name || null,
        speaker_bio: form.speaker_bio || null,
        speaker_photo_id: form.speaker_photo_id || null,
      };
      if (isNew) {
        const row = await adminFetch('/api/admin/events', { method: 'POST', body: payload });
        // Expand the recurrence after the seed is created. We fire this
        // separately (vs cramming it into POST) so admins can see exactly
        // which event was the seed and how many children got built.
        if (form.recurring_enabled && row?.id) {
          try {
            const result = await adminFetch(`/api/admin/events/${row.id}/repeat`, {
              method: 'POST',
              body: {
                freq: form.recurring_freq,
                interval: Number(form.recurring_interval) || 1,
                count: form.recurring_count ? Number(form.recurring_count) : undefined,
                until: form.recurring_until ? new Date(form.recurring_until).toISOString() : undefined,
              },
            });
            showToast?.(`Event series created — ${result.created + 1} occurrences total`, 'success');
          } catch (e3) {
            // Seed succeeded; only the expansion failed. Surface the error
            // but keep the seed event so the admin can retry from the
            // (now-existing) event's Series view.
            showToast?.(`Seed event created but recurrence expansion failed: ${e3.message}`, 'error');
          }
        } else {
          showToast?.('Event created', 'success');
        }
        // Await the parent's refresh so the list reflects the new event
        // before the drawer closes — otherwise the drawer disappears
        // while the list is mid-revalidate and the user sees stale data
        // until the next tick.
        await onSaved?.();
        onClose?.();
        return row;
      } else {
        await adminFetch(`/api/admin/events/${id}`, { method: 'PATCH', body: payload });
        showToast?.('Event updated', 'success');
        await onSaved?.();
      }
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    const result = await publishEventWithOverride(id, {
      onSuccess: (m) => showToast?.(m, 'success'),
      onError:   (m) => showToast?.(m, 'error'),
      successMessage: 'Event published — visible on the public site',
    });
    if (result.ok) {
      await onSaved?.();
      onClose?.();
    }
  };

  const onCancel = async () => {
    const ok = await dialog.confirm({
      title: 'Cancel event?',
      message: 'Cancel this event? Registered attendees will no longer see it.',
      confirmText: 'Cancel event',
      cancelText: 'Back',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/events/${id}/cancel`, { method: 'POST' });
      showToast?.('Event cancelled', 'success');
      await onSaved?.();
      onClose?.();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const onDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Delete event?',
      message: 'Delete this event permanently from the admin view? (Soft delete — data is kept.)',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      showToast?.('Event deleted', 'success');
      await onSaved?.();
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
      if (form.mode !== 'online'    && !form.venue?.trim())      return 'Offline events need a venue.';
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
            <Button type="submit" form="event-form" loading={saving} className="btn btn-primary" style={{ padding: '.5rem 1rem' }}>
              {saving ? 'Saving…' : (isNew ? 'Create event' : 'Save changes')}
            </Button>
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
        <form
          id="event-form"
          onSubmit={onSubmit}
          // Stop Enter inside a numeric input (CPE hours, fee, capacity, …)
          // from submitting the half-filled form. The user gets a failed
          // validation error and assumes the input rejected their keypress.
          // Submission still works via the explicit footer buttons.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
              e.preventDefault();
            }
          }}
        >
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

          {/* Tab navigation is clickable in BOTH new and edit modes — the
              earlier `isNew ? null : setStepIdx` guard made the tabs inert
              while creating a new event, which made the wizard feel
              broken when the user wanted to jump between steps to fill
              fields out of order. */}
          <WizardStepper steps={WIZARD_STEPS} activeIdx={stepIdx} onJump={setStepIdx} />

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
                  <option value="in_person">Offline</option>
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
              <FormField label="GST applicable?" hint="Adds tax to the displayed fee and invoice (H.20)">
                <label className="row gap-2" style={{ alignItems: 'center', marginTop: '.35rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.gst_applicable)}
                    onChange={(e) => set('gst_applicable', e.target.checked)}
                  />
                  <span style={{ fontSize: '.875rem' }}>Apply GST on this event's fee</span>
                </label>
              </FormField>
              {form.gst_applicable && (
                <FormField label="GST %" hint="Default 18% — change only if a different slab applies">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="28"
                    className="input-base"
                    value={form.gst_percent}
                    onChange={(e) => set('gst_percent', e.target.value)}
                  />
                </FormField>
              )}
              <FormField label="Capacity" hint="Leave blank for unlimited" span={2}>
                <input type="number" step="1" min="0" className="input-base" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
              </FormField>
            </Grid>
          </Section>

          {/* Recurrence — only visible while creating a new event. Editing
              an existing series is done through the per-event Series view
              (PATCH /admin/events/:id/series), not this form. */}
          {isNew && (
            <Section title="Recurrence">
              <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.9rem', cursor: 'pointer', marginBottom: form.recurring_enabled ? '.75rem' : 0 }}>
                <input
                  type="checkbox"
                  checked={form.recurring_enabled}
                  onChange={(e) => set('recurring_enabled', e.target.checked)}
                />
                <span>This is a recurring event <span className="muted-text">(creates child events automatically)</span></span>
              </label>
              {form.recurring_enabled && (
                <>
                  <Grid>
                    <FormField label="Frequency">
                      <select className="input-base" value={form.recurring_freq} onChange={(e) => set('recurring_freq', e.target.value)}>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </FormField>
                    <FormField label="Repeat every" hint={`${form.recurring_freq === 'DAILY' ? 'days' : form.recurring_freq === 'WEEKLY' ? 'weeks' : 'months'}`}>
                      <input
                        type="number" min="1" max="12" step="1"
                        className="input-base"
                        value={form.recurring_interval}
                        onChange={(e) => set('recurring_interval', e.target.value)}
                      />
                    </FormField>
                    <FormField label="Number of occurrences" hint="Including this seed event (max 52)" span={1}>
                      <input
                        type="number" min="2" max="52" step="1"
                        className="input-base"
                        value={form.recurring_count}
                        onChange={(e) => set('recurring_count', e.target.value)}
                        placeholder="e.g. 8"
                      />
                    </FormField>
                    <FormField label="Or repeat until" hint="Optional end date" span={1}>
                      <input
                        type="date"
                        className="input-base"
                        value={form.recurring_until}
                        onChange={(e) => set('recurring_until', e.target.value)}
                      />
                    </FormField>
                  </Grid>
                  <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
                    Provide either "Number of occurrences" or "Repeat until". Each child event inherits this event's metadata (committee, audience, mode, fee, capacity, banner) and can be edited individually later.
                  </p>
                </>
              )}
            </Section>
          )}

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
              Images (JPEG / PNG / WebP / GIF) up to 6 MB · Videos (MP4 / WebM / MOV) up to 100 MB. For longer recordings, use the Video Gallery (YouTube/Vimeo embed).
            </div>
          </Section>

          <Section title="Highlights">
            <FormField label="One per line" hint="Shown as bullet points on the public page">
              <textarea className="input-base" rows={4} value={form.highlights} onChange={(e) => set('highlights', e.target.value)} placeholder="Live Q&A with industry experts&#10;Certificate of participation" />
            </FormField>
          </Section>

          {/* Speaker — surfaces in the public event-details modal as a
              photo + name + bio block. All three fields are optional; if
              none are set, the speaker section is hidden on the public
              side. */}
          <Section title="Speaker">
            <div className="row gap-3" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {form.speaker_photo_url && (
                <img
                  src={form.speaker_photo_url}
                  alt="speaker"
                  style={{
                    width: 96, height: 96, borderRadius: '50%',
                    objectFit: 'cover', border: '1px solid var(--border)',
                  }}
                />
              )}
              <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn btn-outline" style={{ padding: '.5rem 1rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? 'Uploading…' : (form.speaker_photo_url ? 'Replace photo' : 'Upload speaker photo')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onSpeakerPhotoUpload(f); e.target.value = ''; }}
                  />
                </label>
                {form.speaker_photo_url && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { set('speaker_photo_id', ''); set('speaker_photo_url', ''); }}
                    style={{ padding: '.5rem 1rem' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.4rem', marginBottom: '.85rem' }}>
              JPEG / PNG / WebP up to 4 MB. Square images render best (shown as a circular avatar).
            </div>

            <FormField label="Speaker name" hint="e.g. CA Rajesh Sharma">
              <input
                className="input-base"
                type="text"
                value={form.speaker_name}
                onChange={(e) => set('speaker_name', e.target.value)}
                placeholder="Full name"
                maxLength={120}
              />
            </FormField>

            <FormField label="Speaker bio" hint="A short bio shown alongside the name. Markdown supported.">
              <textarea
                className="input-base"
                rows={4}
                value={form.speaker_bio}
                onChange={(e) => set('speaker_bio', e.target.value)}
                placeholder="Partner at ABC & Co., 20+ years experience in indirect taxation. Frequent ICAI speaker on GST."
              />
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
    { label: 'Speaker',       value: form.speaker_name || '—',                    step: 2 },
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
  // Whole-checklist filler + approver. Used when the template has no
  // section headings — the entire checklist is one unit of work and we
  // still need to know who fills/approves it.
  // ONE filler for the whole checklist (branch model: one committee
  // chairman fills, multiple approvers may review different sections).
  const [primaryFiller, setPrimaryFiller] = useState('');
  // Optional whole-checklist fallback reviewer. Used when a section has
  // no per-section approver assigned — that section's sign-off falls
  // back to this person.
  const [primaryReviewer, setPrimaryReviewer] = useState('');
  // Per-section approver, keyed by section_question_id. Non-blank entries
  // override the fallback reviewer for that section.
  const [sectionApprovers, setSectionApprovers] = useState({});
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

  // Fetch the MCM-eligible user directory once on mount. Each picker has
  // its own client-side search box so we don't need a debounced server
  // round-trip per keystroke. role_codes filter scopes the dropdown to
  // MCM users only — a checklist for an event is filled / reviewed by a
  // member of the managing committee, never a student or generic member.
  useEffect(() => {
    let cancelled = false;
    // Fetch ALL active users — no role filter here. We do the FILLER /
    // APPROVER split on the client so each picker can independently fall
    // back to "show everyone" when its role-scoped subset is empty (which
    // happens whenever user_role_assignments isn't fully seeded yet).
    // Previously we fetched only the union of scoped roles, which meant
    // the fallback list was also limited to that union — defeating the
    // point of the fallback.
    adminFetch('/api/admin/users?status=active&pageSize=200')
      .then((j) => { if (!cancelled) setUsers(j.rows || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Restrict both pickers to Managing Committee Members — anyone whose
  // active roles include one of MCM_ROLE_CODES (mcm, committee_chairman /
  // convener / co-convener, branch chairman / VC / secretary / treasurer).
  // Non-MCM users like generic members and employers are hidden.
  const mcmUsers      = users.filter((u) => (u.active_roles ?? []).some((r) => MCM_ROLE_CODES.includes(r.role_code)));
  const fillerUsers   = mcmUsers;
  const approverUsers = mcmUsers;

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
      // TEMP: verify what the DB actually holds for this template.
      // eslint-disable-next-line no-console
      console.log('[picker] template detail', {
        name: j?.template?.name,
        version: j?.template?.version,
        questionCount: j?.questions?.length,
        types: (j?.questions ?? []).map((q) => ({ type: q.type, label: q.label })),
      });
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
      const body = {
        template_id: pickedTemplate.id,
        event_id: eventId,
        title: `${pickedTemplate.name} — ${eventTitle}`,
      };

      // One primary filler for the entire checklist. The fallback
      // reviewer applies to any section that doesn't have its own per-
      // section approver picked.
      if (primaryFiller)   body.assigned_fill_user_id   = primaryFiller;
      if (primaryReviewer) body.assigned_review_user_id = primaryReviewer;

      // Per-section approvers only — filler is unified now. Sections left
      // blank fall through to the fallback reviewer (or the auto-resolved
      // default when that's also blank).
      const sectionAssignments = sections
        .map((s) => ({
          section_question_id: s.id,
          approver_id: sectionApprovers[s.id] || null,
        }))
        .filter((a) => a.approver_id);
      if (sectionAssignments.length > 0) body.section_assignments = sectionAssignments;

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

  // Count how many section-level approver overrides are set — shown in
  // the button copy so the admin can confirm their picks landed.
  const assignedCount = sections.reduce(
    (n, s) => n + (sectionApprovers[s.id] ? 1 : 0),
    0,
  );

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
                  <a href="/admin/checklist-templates" className="btn-primary" style={{ padding: '.375rem .75rem', display: 'inline-block', textDecoration: 'none', fontSize: '.8125rem' }}>
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
                  {/* ─── Single filler for the whole checklist ─── */}
                  <div className="tp-section-block">
                    <div className="tp-section-title">Filler</div>
                    <p className="muted-text" style={{ fontSize: '.72rem', margin: '0 0 .35rem' }}>
                      One person fills the entire checklist.
                    </p>
                    <UserPicker
                      users={fillerUsers}
                      value={primaryFiller}
                      placeholder="— Pick filler —"
                      onChange={setPrimaryFiller}
                    />
                  </div>

                  {sections.length === 0 && (
                    <div className="tp-section-block">
                      <div className="tp-section-title">Approver</div>
                      <p className="muted-text" style={{ fontSize: '.72rem', margin: '0 0 .35rem' }}>
                        Approves the whole checklist once filled.
                      </p>
                      <UserPicker
                        users={approverUsers}
                        value={primaryReviewer}
                        placeholder="— Pick approver —"
                        onChange={setPrimaryReviewer}
                      />
                    </div>
                  )}

                  {sections.length > 0 && (
                    <>
                      <div className="tp-section-title" style={{ marginTop: '.75rem' }}>
                        Approvers by section
                      </div>
                      <p className="muted-text" style={{ fontSize: '.72rem', margin: '0 0 .35rem' }}>
                        Pick who approves each section. Leave blank to use the fallback approver at the bottom.
                      </p>
                      {sections.map((s) => {
                        const suggested = s.section_owner_role ? roleLabel(s.section_owner_role) : null;
                        return (
                          <div key={s.id} className="tp-section-block">
                            <div className="tp-section-title">{s.label}</div>
                            <div className="tp-section-cell">
                              <span className="tp-section-cell-label">
                                Approver
                                {suggested && (
                                  <span className="muted-text" style={{ fontSize: '.65rem', fontWeight: 400, marginLeft: '.35rem' }}>
                                    · suggested: {suggested}
                                  </span>
                                )}
                              </span>
                              <UserPicker
                                users={approverUsers}
                                value={sectionApprovers[s.id] || ''}
                                placeholder="— Fallback approver —"
                                onChange={(v) => setSectionApprovers((prev) => ({ ...prev, [s.id]: v }))}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Fallback whole-checklist approver — kicks in for any
                          section that doesn't have its own approver above. */}
                      <div className="tp-section-block">
                        <div className="tp-section-title">Fallback approver</div>
                        <p className="muted-text" style={{ fontSize: '.72rem', margin: '0 0 .35rem' }}>
                          Approves any section left blank above. Optional — the branch chairman is used automatically if you skip this.
                        </p>
                        <UserPicker
                          users={approverUsers}
                          value={primaryReviewer}
                          placeholder="— Auto (Branch Chairman) —"
                          onChange={setPrimaryReviewer}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <footer className="tp-foot">
          {step === 'assign' && (
            <button type="button" className="tp-back" onClick={() => {
              setStep('pick');
              setPickedTemplate(null);
              setPrimaryFiller('');
              setPrimaryReviewer('');
              setSectionApprovers({});
            }}>
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
          .tp-section-heading {
            margin-top: 1rem; margin-bottom: .5rem;
            font-size: .8rem; font-weight: 600;
            color: var(--foreground);
          }
          .tp-section-block {
            padding: .6rem .7rem;
            background: var(--card); border: 1px solid var(--border);
            border-radius: .375rem; margin-bottom: .4rem;
          }
          .tp-section-title {
            font-size: .85rem; font-weight: 600; margin-bottom: .4rem;
          }
          .tp-section-grid {
            display: grid; gap: .5rem;
            grid-template-columns: 1fr 1fr;
          }
          @media (max-width: 560px) {
            .tp-section-grid { grid-template-columns: 1fr; }
          }
          .tp-section-cell { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
          .tp-section-cell-label {
            font-size: .7rem; color: var(--muted-foreground);
            font-weight: 500;
          }
          /* Let the picker fill the cell in per-section rows so both cells
             are equal width in the two-column grid. */
          .tp-section-cell .up-wrap { max-width: none; width: 100%; min-width: 0; }
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
          /* FlipMenu owns position + portal + max-height; we only style. */
          .up-menu {
            background: white; border: 1px solid var(--border);
            border-radius: .5rem; box-shadow: 0 6px 22px rgba(0,0,0,.12);
            padding: .35rem;
            display: flex; flex-direction: column;
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
// Picks the best human-readable role label from a user's `active_roles`
// array (returned by /api/admin/users). Prefers the MCM-eligible codes
// in the order they appear in MCM_ROLE_CODES so "Branch Chairman" beats
// "MCM" when a user holds both.
function pickRoleBadge(activeRoles) {
  if (!Array.isArray(activeRoles) || activeRoles.length === 0) return null;
  const codes = activeRoles.map((r) => r.role_code);
  for (const c of MCM_ROLE_CODES) {
    if (codes.includes(c)) return ROLE_CODE_LABEL[c] || c;
  }
  // No MCM-role match → fall back to whatever role they do have.
  return activeRoles[0]?.role_name || ROLE_CODE_LABEL[activeRoles[0]?.role_code] || null;
}

function UserPicker({ users, value, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  // Per-dropdown search box so the admin doesn't have to scroll through
  // dozens of names. Filters client-side over the `users` prop, which is
  // already scoped to MCM-eligible users by the parent.
  const [search, setSearch] = useState('');
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  // FlipMenu owns click-outside + position. Auto-focus the search input
  // when the menu opens; clear when it closes.
  useEffect(() => {
    if (open) {
      setSearch('');
      // TEMP diagnostic — verify each picker has the same users array.
      // eslint-disable-next-line no-console
      console.log('[UserPicker] opened', {
        placeholder,
        usersLen: Array.isArray(users) ? users.length : 'not-array',
        sampleName: users?.[0]?.name,
      });
      // Defer to give the input a chance to mount.
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, users, placeholder]);

  const picked = value ? users.find((u) => u.id === value) : null;
  const label = picked ? `${picked.name}` : placeholder;

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (Array.isArray(u.active_roles) && u.active_roles.some((r) =>
        (r.role_name || '').toLowerCase().includes(q)
        || (ROLE_CODE_LABEL[r.role_code] || '').toLowerCase().includes(q)
      )),
    );
  })();

  return (
    <div className="up-wrap">
      <button
        ref={triggerRef}
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
      <FlipMenu
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        align="stretch"
        minWidth={280}
        maxHeight={320}
        zIndex={2500}
        className="up-menu"
      >
        <div role="menu">
          <div style={{
            position: 'sticky', top: 0, background: 'var(--card)',
            padding: '.4rem .5rem', borderBottom: '1px solid var(--border)',
            zIndex: 1,
          }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              style={{
                width: '100%', padding: '.35rem .55rem',
                border: '1px solid var(--border)', borderRadius: '.3rem',
                fontSize: '.8rem', boxSizing: 'border-box',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="up-item-empty">
              {search ? 'No matches' : 'No users available'}
            </div>
          ) : (
            filtered.map((u) => {
              const active = u.id === value;
              const roleBadge = pickRoleBadge(u.active_roles);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={'up-item' + (active ? ' is-active' : '')}
                  onClick={() => { onChange(u.id); setOpen(false); }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong style={{ fontWeight: 600 }}>{u.name}</strong>
                    {roleBadge && (
                      <span style={{
                        marginLeft: '.4rem', fontSize: '.65rem', fontWeight: 600,
                        padding: '.05rem .35rem', borderRadius: 999,
                        background: 'rgba(30,58,138,.08)', color: 'var(--primary, #1e40af)',
                      }}>
                        {roleBadge}
                      </span>
                    )}
                    <span style={{ marginLeft: '.4rem', color: 'var(--muted-foreground)', fontSize: '.7rem' }}>
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
      </FlipMenu>
    </div>
  );
}
