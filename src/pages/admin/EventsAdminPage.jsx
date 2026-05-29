import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoute, navigate } from '../../hooks/useRoute';
import { Shimmer, ShimmerFormField } from '../../components/ui/Shimmer';

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
  return <span className={'admin-pill admin-pill-' + status}>{status.replace('_', ' ')}</span>;
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
    { key: 'checklist', header: 'Approval', render: (r) => <ChecklistButton row={r} showToast={showToast} refresh={refresh} />, width: 220 },
  ], [showToast, refresh]);

  return (
    <AdminLayout
      title="Events"
      subtitle="Create and publish events to the public site"
      actions={
        <button className="btn btn-primary" onClick={() => setEditingId('new')} style={{ padding: '.5rem 1rem' }}>
          + New event
        </button>
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

function EventDrawer({ open, id, lookups, onClose, onSaved, showToast }) {
  const isNew = id === 'new';
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

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
    try {
      await adminFetch(`/api/admin/events/${id}/publish`, { method: 'POST' });
      showToast?.('Event published — visible on the public site', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) { showToast?.(e.message, 'error'); }
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

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isNew ? 'Create event' : 'Edit event'}
      footer={
        <>
          {!isNew && form.status && form.status !== 'published' && form.status !== 'cancelled' && (
            <button type="button" className="btn btn-outline" onClick={onPublish} style={{ padding: '.5rem 1rem' }}>Publish</button>
          )}
          {!isNew && form.status && form.status !== 'cancelled' && (
            <button type="button" className="btn btn-outline" onClick={onCancel} style={{ padding: '.5rem 1rem', color: '#b91c1c' }}>Cancel event</button>
          )}
          {!isNew && (
            <button type="button" className="btn btn-outline" onClick={onDelete} style={{ padding: '.5rem 1rem', color: '#b91c1c' }}>Delete</button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '.5rem 1rem' }}>Close</button>
          <button type="submit" form="event-form" disabled={saving} className="btn btn-primary" style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : (isNew ? 'Create' : 'Save')}
          </button>
        </>
      }
    >
      {loading ? (
        <DrawerFormSkeleton />
      ) : (
        <form id="event-form" onSubmit={onSubmit}>
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.625rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

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
        </form>
      )}
    </Drawer>
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

// Checklist column action. Either:
//  - shows current approval status (clickable, jumps to /checklists?id=<id>)
//  - shows "Create checklist" button (creates a new one, then jumps in)
const CHECKLIST_STATUS_LABEL = {
  awaiting_committee:     'With committee',
  awaiting_branch_review: 'With branch chair',
  approved:               'Approved',
};
const CHECKLIST_STATUS_STYLE = {
  awaiting_committee:     { bg: '#fef3c7', fg: '#92400e' },
  awaiting_branch_review: { bg: '#dbeafe', fg: '#1e40af' },
  approved:               { bg: '#dcfce7', fg: '#166534' },
};

function ChecklistButton({ row, showToast, refresh }) {
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const created = await adminFetch('/api/checklists', { method: 'POST', body: { event_id: row.id } });
      showToast?.('Checklist created — add items', 'success');
      refresh?.();
      navigate('/checklists?id=' + created.id);
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function open(e) {
    e.stopPropagation();
    navigate('/checklists?id=' + row.checklist_id);
  }

  if (!row.checklist_id) {
    return (
      <button type="button" className="btn btn-outline" onClick={create} disabled={busy}
              style={{ padding: '.25rem .55rem', fontSize: '.75rem' }}>
        {busy ? 'Creating…' : '+ Create checklist'}
      </button>
    );
  }

  const c = CHECKLIST_STATUS_STYLE[row.checklist_status] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <button type="button" onClick={open}
            style={{
              padding: '.2rem .55rem', fontSize: '.7rem', fontWeight: 600,
              borderRadius: 999, border: 0, cursor: 'pointer',
              background: c.bg, color: c.fg,
            }}>
      {CHECKLIST_STATUS_LABEL[row.checklist_status] ?? row.checklist_status} →
    </button>
  );
}
