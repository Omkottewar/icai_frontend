import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoute, navigate } from '../../hooks/useRoute';
import { Shimmer, ShimmerFormField } from '../../components/ui/Shimmer';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

const EMPTY_FORM = {
  type: 'job',
  title: '',
  description: '',
  firm_id: '',
  employer_id: '',
  seat_count: '1',
  experience_required: '',
  location: '',
  expires_at: '',
};

// Fee constants mirror the backend FEE_PAISE map.
const FEE_RUPEES = { job: 1000, articleship: 500, assignment: 1000 };

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function toLocalDateInput(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

const PILL_CLASS = {
  draft: 'admin-pill-draft',
  pending_payment: 'admin-pill-pending_payment',
  active: 'admin-pill-active',
  filled: 'admin-pill-filled',
  expired: 'admin-pill-expired',
  closed: 'admin-pill-closed',
};

function StatusPill({ status }) {
  return <span className={'admin-pill ' + (PILL_CLASS[status] ?? '')}>{status.replace('_', ' ')}</span>;
}

const TYPE_LABEL = { job: 'Job', articleship: 'Articleship', assignment: 'Assignment' };
const TYPE_AUDIENCE = { job: 'Members', articleship: 'Students' };

export default function JobPostingsAdminPage() {
  const { showToast } = useAuth();
  const route = useRoute();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');

  const [editingId, setEditingId] = useState(null);
  const drawerOpen = editingId !== null;

  useEffect(() => {
    if (route.query.edit && editingId === null) setEditingId(route.query.edit);
    if (route.query.new === '1' && editingId === null) setEditingId('new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.edit, route.query.new]);

  const { data, loading, refresh } = useAdminList('/api/admin/jobs', {
    page, pageSize: 20, status, type, q,
  });
  const { data: lookups } = useAdminList('/api/admin/jobs/_meta/lookups');

  const columns = useMemo(() => [
    {
      key: 'title', header: 'Posting', render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.title}</div>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>
            {r.firm_name || r.employer_name || '—'}
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => TYPE_LABEL[r.type] ?? r.type, width: 110 },
    { key: 'audience', header: 'Audience', render: (r) => TYPE_AUDIENCE[r.type] ?? '—', width: 100 },
    { key: 'location', header: 'Location', render: (r) => r.location || '—', width: 130 },
    {
      key: 'seat_count', header: 'Seats', render: (r) => r.seat_count, width: 70,
    },
    { key: 'expires_at', header: 'Expires', render: (r) => fmtDate(r.expires_at), width: 120 },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} />, width: 130 },
  ], []);

  return (
    <AdminLayout
      title="Job Postings"
      subtitle="Create and publish vacancies visible to members and students"
      actions={
        <button className="btn btn-primary" onClick={() => setEditingId('new')} style={{ padding: '.5rem 1rem' }}>
          + New posting
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
        emptyMessage="No postings yet. Create your first posting to publish it on the vacancies page."
        filters={
          <>
            <select className="input-base" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="filled">Filled</option>
              <option value="expired">Expired</option>
              <option value="closed">Closed</option>
            </select>
            <select className="input-base" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
              <option value="">All types</option>
              <option value="job">Job</option>
              <option value="articleship">Articleship</option>
              <option value="assignment">Assignment</option>
            </select>
          </>
        }
      />

      <JobDrawer
        open={drawerOpen}
        id={editingId}
        lookups={lookups}
        onClose={() => { setEditingId(null); if (route.query.edit || route.query.new) navigate('/admin/jobs'); }}
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
        .admin-pill {
          padding: .125rem .5rem; border-radius: 999px;
          font-size: .6875rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-draft { background: #fef3c7; color: #92400e; }
        .admin-pill-pending_payment { background: #ddd6fe; color: #5b21b6; }
        .admin-pill-active { background: #d1fae5; color: #065f46; }
        .admin-pill-filled { background: #dbeafe; color: #1e40af; }
        .admin-pill-expired { background: #e5e7eb; color: #374151; }
        .admin-pill-closed { background: #fee2e2; color: #991b1b; }
      `}</style>
    </AdminLayout>
  );
}

function JobDrawer({ open, id, lookups, onClose, onSaved, showToast }) {
  const isNew = id === 'new';
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-select ICAI Nagpur as the default firm for new postings once lookups arrive.
  useEffect(() => {
    if (!isNew || !lookups?.firms?.length) return;
    const nagpur = lookups.firms.find((f) =>
      f.name.toLowerCase().includes('nagpur') || f.name.toLowerCase().includes('icai')
    );
    if (nagpur) setForm((f) => f.firm_id ? f : { ...f, firm_id: nagpur.id });
  }, [isNew, lookups]);

  useEffect(() => {
    if (!open) return;
    if (isNew) { setForm(EMPTY_FORM); setError(null); return; }
    setLoading(true); setError(null);
    adminFetch(`/api/admin/jobs/${id}`)
      .then((row) => {
        setForm({
          type: row.type || 'job',
          title: row.title || '',
          description: row.description || '',
          firm_id: row.firm_id || '',
          employer_id: row.employer_id || '',
          seat_count: String(row.seat_count ?? 1),
          experience_required: row.experience_required || '',
          location: row.location || '',
          expires_at: toLocalDateInput(row.expires_at),
          status: row.status,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, id, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        description: form.description,
        firm_id: form.firm_id || null,
        employer_id: form.employer_id || null,
        seat_count: Number(form.seat_count) || 1,
        experience_required: form.experience_required || null,
        location: form.location || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        ...(!isNew && { status: form.status }),
      };
      if (isNew) {
        await adminFetch('/api/admin/jobs', { method: 'POST', body: payload });
        showToast?.('Posting created', 'success');
      } else {
        await adminFetch(`/api/admin/jobs/${id}`, { method: 'PATCH', body: payload });
        showToast?.('Posting updated', 'success');
      }
      onSaved?.();
      if (isNew) onClose?.();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Delete posting?',
      message: 'Delete this posting permanently? (Soft delete — data is kept.)',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/jobs/${id}`, { method: 'DELETE' });
      showToast?.('Posting deleted', 'success');
      onSaved?.(); onClose?.();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const feeRupees = FEE_RUPEES[form.type] ?? 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isNew ? 'Create posting' : 'Edit posting'}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn btn-outline" onClick={onDelete} style={{ padding: '.5rem 1rem', color: '#b91c1c' }}>
              Delete
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '.5rem 1rem' }}>Close</button>
          <Button type="submit" form="job-form" loading={saving} className="btn btn-primary" style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : (isNew ? 'Create' : 'Save')}
          </Button>
        </>
      }
    >
      {loading ? <DrawerSkeleton /> : (
        <form id="job-form" onSubmit={onSubmit}>
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.625rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {!isNew && form.status && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label" style={{ display: 'block', marginBottom: '.375rem' }}>Status</label>
              <select className="input-base" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active — visible on vacancies page</option>
                <option value="filled">Filled</option>
                <option value="expired">Expired</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}

          <Section title="Basics">
            <Grid>
              <FormField label="Type" required>
                <select className="input-base" value={form.type} onChange={(e) => set('type', e.target.value)} required>
                  <option value="job">Job — visible to Members</option>
                  <option value="articleship">Articleship — visible to Students</option>
                  <option value="assignment">Assignment — short-term / freelance for Members</option>
                </select>
              </FormField>
              <FormField label={form.type === 'assignment' ? 'Openings available' : 'Seats available'} required>
                <input type="number" min="1" step="1" className="input-base" value={form.seat_count}
                  onChange={(e) => set('seat_count', e.target.value)} required />
              </FormField>
              <FormField label="Title" required span={2}>
                <input className="input-base" value={form.title}
                  onChange={(e) => set('title', e.target.value)} required
                  placeholder={
                    form.type === 'articleship' ? 'e.g. Articleship opening — Tax & Audit' :
                    form.type === 'assignment'  ? 'e.g. GST audit assistance — Oct-Nov engagement' :
                                                  'e.g. Senior Auditor'
                  } />
              </FormField>
              <FormField label="Description" required span={2} hint="Role details, eligibility, how to apply">
                <textarea className="input-base" rows={5} value={form.description}
                  onChange={(e) => set('description', e.target.value)} required />
              </FormField>
            </Grid>
          </Section>

          <Section title="Organisation">
            <Grid>
              <FormField label="CA Firm" hint="For articleship / CA firm postings">
                <select className="input-base" value={form.firm_id} onChange={(e) => set('firm_id', e.target.value)}>
                  <option value="">ICAI Nagpur (no firm)</option>
                  {lookups?.firms?.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Employer" hint="For industry / corporate jobs">
                <select className="input-base" value={form.employer_id} onChange={(e) => set('employer_id', e.target.value)}>
                  <option value="">ICAI Nagpur (no employer)</option>
                  {lookups?.employers?.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </FormField>
            </Grid>
          </Section>

          <Section title="Requirements">
            <Grid>
              <FormField label="Experience required" hint="e.g. 3–5 years, Freshers welcome">
                <input className="input-base" value={form.experience_required}
                  onChange={(e) => set('experience_required', e.target.value)}
                  placeholder="e.g. 3–5 years" />
              </FormField>
              <FormField label="Location">
                <input className="input-base" value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. Nagpur" />
              </FormField>
            </Grid>
          </Section>

          <Section title="Posting fee">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.75rem', background: 'var(--muted)', borderRadius: '.375rem' }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  ₹{feeRupees.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)', marginTop: '.125rem' }}>
                  Standard fee for {TYPE_LABEL[form.type].toLowerCase()} postings — payment collection coming soon
                </div>
              </div>
            </div>
          </Section>

          <Section title="Expiry">
            <FormField label="Expires on" hint="Leave blank for no expiry">
              <input type="date" className="input-base" value={form.expires_at}
                onChange={(e) => set('expires_at', e.target.value)} />
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

function DrawerSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Shimmer height=".7rem" width="20%" style={{ marginBottom: '.75rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <ShimmerFormField />
          <ShimmerFormField />
          <ShimmerFormField span={2} />
          <ShimmerFormField span={2} />
        </div>
      </div>
      <div>
        <Shimmer height=".7rem" width="20%" style={{ marginBottom: '.75rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <ShimmerFormField />
          <ShimmerFormField />
        </div>
      </div>
    </div>
  );
}
