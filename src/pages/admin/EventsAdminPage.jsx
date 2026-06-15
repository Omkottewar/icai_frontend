import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch, invalidate } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoleFlags } from '../../hooks/useRoleFlags';
import { useRoute, navigate } from '../../hooks/useRoute';
import { Shimmer, ShimmerFormField } from '../../components/ui/Shimmer';
import { eventLabel, EVENT_STATUS, toneStyle } from '../../lib/eventStatus';
import EventTimeline from '../../components/admin/EventTimeline';
import ComparableEventsPanel from '../../components/admin/ComparableEventsPanel';
import EventQuickActions from '../../components/admin/EventQuickActions';

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
          <button className="btn btn-primary" onClick={() => setEditingId('new')} style={{ padding: '.5rem 1rem' }}>
            + New event
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
    if (file.size > 6 * 1024 * 1024) {
      showToast?.('File too large (max 6 MB)', 'error');
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
      showToast?.('Banner uploaded', 'success');
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
              <FormField label="URL slug" hint="Leave blank to auto-generate from title">
                <input className="input-base" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="auto-generated" />
              </FormField>
              <FormField label="Committee" required>
                <select className="input-base" value={form.committee_id} onChange={(e) => set('committee_id', e.target.value)} required>
                  <option value="">Select committee…</option>
                  {lookups?.committees?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Branch" hint="Leave blank for branch-agnostic events">
                <select className="input-base" value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                  <option value="">Not branch-specific</option>
                  {lookups?.branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
              <FormField label="Programme type" hint="e.g. Seminar, Workshop, Mock test" span={2}>
                <input className="input-base" value={form.program_type} onChange={(e) => set('program_type', e.target.value)} />
              </FormField>
              <FormField label="Description" hint="Markdown supported" span={2}>
                <textarea className="input-base" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </FormField>
            </Grid>
          </Section>

          <Section title="Schedule">
            <Grid>
              <FormField label="Starts at" required>
                <input type="datetime-local" className="input-base" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} required />
              </FormField>
              <FormField label="Ends at" required>
                <input type="datetime-local" className="input-base" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} required />
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
              {form.banner_url && (
                <img src={form.banner_url} alt="banner" style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: '.375rem', border: '1px solid var(--border)' }} />
              )}
              <label className="btn btn-outline" style={{ padding: '.5rem 1rem', cursor: uploading ? 'wait' : 'pointer' }}>
                {uploading ? 'Uploading…' : (form.banner_url ? 'Replace banner' : 'Upload banner')}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
                />
              </label>
              {form.banner_url && (
                <button type="button" className="btn btn-outline" onClick={() => { set('banner_id', ''); set('banner_url', ''); }} style={{ padding: '.5rem 1rem' }}>Remove</button>
              )}
            </div>
            <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>JPEG / PNG / WebP. Max 6 MB.</div>
          </Section>

          <Section title="Highlights">
            <FormField label="One per line" hint="Shown as bullet points on the public page">
              <textarea className="input-base" rows={4} value={form.highlights} onChange={(e) => set('highlights', e.target.value)} placeholder="Live Q&A with industry experts&#10;Certificate of participation" />
            </FormField>
          </Section>

          <Section title="Recurrence (optional)">
            <FormField label="RRULE" hint="RFC 5545 recurrence rule, e.g. FREQ=WEEKLY;BYDAY=MO">
              <input className="input-base" value={form.recurrence_rrule} onChange={(e) => set('recurrence_rrule', e.target.value)} />
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
  const branch    = lookups?.branches?.find((b) => b.id === form.branch_id);
  const rows = [
    { label: 'Title',         value: form.title || '—',                   step: 0 },
    { label: 'Committee',     value: committee?.name || '—',              step: 0 },
    { label: 'Branch',        value: branch?.name || 'Not branch-specific', step: 0 },
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
        style={{ padding: '.25rem .55rem', fontSize: '.75rem' }}
      >
        + Create checklist
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

// ─── Template picker (event approval flow) ──────────────────────────────
//
// Creates a checklist_instances row bound to the event. Backend auto-assigns
// the current committee chairman (filler) and branch chairman (reviewer)
// when the template's fill_role/review_role reference those role codes —
// see findActiveRoleHolder() in routes/checklistInstances.ts.
//
// The fill UI is the new rich renderer (radio, dropdown, file, etc.). On
// approval, a DB trigger auto-publishes the event (mirror of the legacy
// trigger on event_checklists).

function TemplatePickerModal({ eventId, eventTitle, onClose, onCreated, showToast }) {
  const [templates, setTemplates] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch('/api/checklist-templates')
      .then((j) => { if (!cancelled) setTemplates((j.rows || []).filter((t) => t.is_published)); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function pick(template) {
    if (busyId) return;
    setBusyId(template.id);
    try {
      const created = await adminFetch('/api/checklist-instances', {
        method: 'POST',
        body: {
          template_id: template.id,
          event_id: eventId,
          title: `${template.name} — ${eventTitle}`,
        },
      });
      // adminFetch only auto-invalidates by '/api/admin/...' prefix; bust the
      // events list manually so the new instance_id column updates.
      invalidate('/api/admin/events');
      showToast?.(`Checklist created from "${template.name}"`, 'success');
      onCreated(created.id);
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="tp-root" onClick={onClose}>
      <div className="tp-card" onClick={(e) => e.stopPropagation()}>
        <header className="tp-head">
          <div>
            <h2 className="tp-title">Pick a checklist template</h2>
            <p className="tp-sub">For event: <strong>{eventTitle}</strong></p>
          </div>
          <button className="tp-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="tp-body">
          {err && <p style={{ color: 'var(--destructive)' }}>{err}</p>}

          {templates === null && <p className="muted-text">Loading templates…</p>}
          {templates && templates.length === 0 && (
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <p className="muted-text" style={{ marginBottom: '.5rem' }}>
                No published templates yet.
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
              onClick={() => pick(t)}
              disabled={busyId !== null}
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
              <span className="tp-cta">{busyId === t.id ? 'Creating…' : 'Use →'}</span>
            </button>
          ))}
        </div>

        <style>{`
          .tp-root {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(15,23,42,.45);
            display: flex; align-items: flex-start; justify-content: center;
            padding: 5vh 1rem; overflow-y: auto;
          }
          .tp-card {
            width: 100%; max-width: 560px;
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
        `}</style>
      </div>
    </div>
  );
}
