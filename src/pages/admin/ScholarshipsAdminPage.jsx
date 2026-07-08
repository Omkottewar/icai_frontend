import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { IconPlus, IconEdit, IconTrash, IconX } from '../../icons';

// Admin scholarships: catalog CRUD (left) + applications queue (right).
//
// Kept in one page rather than two so the branch admin can flip between
// "what programs are we running?" and "who's applied?" without moving
// through the sidebar.
//
// Publishing rules:
//   • active=true + no cover_url is fine — the card just shows without an image.
//   • external_url overrides the internal apply form; students see an
//     "Apply on external site" CTA that opens in a new tab.
//   • deadline_at in the past ⇒ card shows "Deadline passed" and the apply
//     button is disabled (server enforces too).

const FMT_INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function fmtPaise(paise) {
  if (paise == null || paise === '') return '—';
  return FMT_INR.format(Number(paise) / 100);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS = [
  { value: 'submitted',    label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'shortlisted',  label: 'Shortlisted' },
  { value: 'awarded',      label: 'Awarded' },
  { value: 'rejected',     label: 'Rejected' },
  { value: 'withdrawn',    label: 'Withdrawn' },
];
const STATUS_PALETTE = {
  submitted:    { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  under_review: { bg: 'oklch(0.90 0.10 250)', fg: 'oklch(0.35 0.13 250)' },
  shortlisted:  { bg: 'oklch(0.90 0.10 210)', fg: 'oklch(0.35 0.13 210)' },
  awarded:      { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  rejected:     { bg: 'oklch(0.92 0.10 25)',  fg: 'oklch(0.45 0.20 25)' },
  withdrawn:    { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
};

export default function ScholarshipsAdminPage() {
  const [tab, setTab] = useState('catalog');
  return (
    <AdminLayout
      title="Scholarships"
      subtitle="Publish scholarship programs and review applications"
      actions={null}
    >
      <div className="row gap-1" role="tablist" style={{ borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        {[
          { id: 'catalog',      label: 'Programs' },
          { id: 'applications', label: 'Applications' },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={'ss-tab' + (tab === t.id ? ' is-active' : '')}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'catalog' ? <CatalogPanel /> : <ApplicationsPanel />}

      <style>{`
        .ss-tab {
          padding: .625rem .875rem; margin-bottom: -1px;
          background: none; border: 0; border-bottom: 2px solid transparent;
          font-size: .875rem; font-weight: 600; cursor: pointer;
          color: var(--muted-foreground);
        }
        .ss-tab:hover { color: var(--foreground); }
        .ss-tab.is-active { color: var(--primary); border-bottom-color: var(--primary); }
      `}</style>
    </AdminLayout>
  );
}

// ─── Catalog panel ────────────────────────────────────────────────────────
function CatalogPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch('/api/admin/scholarships', { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load scholarships');
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); setRows([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(row) {
    const isNew = row.new;
    const url = isNew ? '/api/admin/scholarships' : `/api/admin/scholarships/${row.id}`;
    const method = isNew ? 'POST' : 'PATCH';
    // Convert rupees → paise for the server.
    const payload = { ...row };
    delete payload.new;
    if (payload._award_rupees !== undefined) {
      payload.award_amount_paise = payload._award_rupees === '' ? null : Math.round(Number(payload._award_rupees) * 100);
      delete payload._award_rupees;
    }
    const r = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${r.status}`);
    }
    setEditing(null);
    load();
  }

  async function remove(row) {
    if (!confirm(`Delete "${row.title}"? Applications remain but the program disappears from the public listing.`)) return;
    const r = await fetch(`/api/admin/scholarships/${row.id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) { alert('Delete failed'); return; }
    load();
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <div className="muted-text" style={{ fontSize: '.875rem' }}>
          {rows === null ? 'Loading…' : `${rows.length} scholarship${rows.length === 1 ? '' : 's'}`}
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ new: true, applications_open: true, active: true, sort_order: 0 })}>
          <IconPlus size="sm" /> Add program
        </button>
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          No scholarships posted yet. Click <strong>Add program</strong> to publish the first one.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Title</th>
                <th style={{ textAlign: 'left' }}>Award</th>
                <th style={{ textAlign: 'left' }}>Deadline</th>
                <th style={{ textAlign: 'left' }}>Applications</th>
                <th style={{ textAlign: 'left' }}>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className="muted-text" style={{ fontSize: '.75rem' }}>/{r.slug}</div>
                  </td>
                  <td>{fmtPaise(r.award_amount_paise)}</td>
                  <td>{fmtDate(r.deadline_at)}</td>
                  <td>{r.applications_count ?? 0}</td>
                  <td>
                    <div className="col gap-1" style={{ fontSize: '.75rem' }}>
                      <span>{r.active ? '✓ Active' : '— Hidden'}</span>
                      <span className="muted-text">{r.applications_open ? 'Open' : 'Closed'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="row gap-2">
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem' }} onClick={() => setEditing({ ...r, _award_rupees: r.award_amount_paise != null ? (r.award_amount_paise / 100) : '' })}>
                        <IconEdit size="sm" /> Edit
                      </button>
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }} onClick={() => remove(r)}>
                        <IconTrash size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

// ─── Edit modal (create + edit) ───────────────────────────────────────────
function EditModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...initial,
    _award_rupees: initial._award_rupees ?? (initial.award_amount_paise != null ? initial.award_amount_paise / 100 : ''),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function patch(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      await onSave(form);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(38rem, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">{form.new ? 'Add scholarship' : 'Edit scholarship'}</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="dialog-body" style={{ overflowY: 'auto' }}>
            {err && <div style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '.75rem' }}>{err}</div>}

            <Field label="Title *">
              <input className="input-base" required value={form.title || ''} onChange={(e) => patch('title', e.target.value)} />
            </Field>

            <Field label="Slug (URL path)" hint="Leave blank to auto-generate from the title">
              <input className="input-base" value={form.slug || ''} onChange={(e) => patch('slug', e.target.value)} placeholder="e.g. wicasa-2027-merit" />
            </Field>

            <Field label="Short summary" hint="One-line teaser on the listing card">
              <input className="input-base" value={form.summary || ''} onChange={(e) => patch('summary', e.target.value)} />
            </Field>

            <Field label="Full description (markdown supported) *">
              <textarea className="input-base" rows={5} required value={form.description || ''} onChange={(e) => patch('description', e.target.value)} style={{ resize: 'vertical' }} />
            </Field>

            <Field label="Eligibility (markdown supported)">
              <textarea className="input-base" rows={3} value={form.eligibility || ''} onChange={(e) => patch('eligibility', e.target.value)} style={{ resize: 'vertical' }} />
            </Field>

            <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <Field label="Award (₹)">
                <input type="number" min="0" className="input-base" value={form._award_rupees ?? ''} onChange={(e) => patch('_award_rupees', e.target.value)} />
              </Field>
              <Field label="Deadline">
                <input type="datetime-local" className="input-base" value={toLocalDT(form.deadline_at)} onChange={(e) => patch('deadline_at', e.target.value)} />
              </Field>
              <Field label="Sort order">
                <input type="number" className="input-base" value={form.sort_order ?? 0} onChange={(e) => patch('sort_order', Number(e.target.value) || 0)} />
              </Field>
            </div>

            <Field label="External application URL" hint="If set, students click through to this URL instead of applying in-portal">
              <input type="url" className="input-base" value={form.external_url || ''} onChange={(e) => patch('external_url', e.target.value)} placeholder="https://…" />
            </Field>

            <div className="row gap-3" style={{ marginTop: '.75rem' }}>
              <label className="row gap-2" style={{ fontSize: '.8125rem' }}>
                <input type="checkbox" checked={!!form.active} onChange={(e) => patch('active', e.target.checked)} />
                Active (visible on the public listing)
              </label>
              <label className="row gap-2" style={{ fontSize: '.8125rem' }}>
                <input type="checkbox" checked={!!form.applications_open} onChange={(e) => patch('applications_open', e.target.checked)} />
                Applications open
              </label>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginTop: '.75rem' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>{label}</div>
      {children}
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>{hint}</div>}
    </label>
  );
}

// ─── Applications review panel ────────────────────────────────────────────
function ApplicationsPanel() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [scholarships, setScholarships] = useState([]);
  const [scholarshipFilter, setScholarshipFilter] = useState('');
  const [err, setErr] = useState('');
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (scholarshipFilter) params.set('scholarship_id', scholarshipFilter);
      params.set('pageSize', '50');
      const r = await fetch('/api/admin/scholarship-applications?' + params.toString(), { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load applications');
      const j = await r.json();
      setRows(j.rows || []);
      setTotal(j.total || 0);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [statusFilter, scholarshipFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Populate the scholarship-filter dropdown once.
    fetch('/api/admin/scholarships', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setScholarships(j.rows || []))
      .catch(() => {});
  }, []);

  async function updateStatus(id, patch) {
    const r = await fetch(`/api/admin/scholarship-applications/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || 'Update failed');
      return;
    }
    setReviewing(null);
    load();
  }

  return (
    <>
      <div className="row gap-2" style={{ marginBottom: '.75rem', flexWrap: 'wrap' }}>
        <select className="input-base" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '.35rem .6rem', fontSize: '.8125rem' }}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input-base" value={scholarshipFilter} onChange={(e) => setScholarshipFilter(e.target.value)} style={{ padding: '.35rem .6rem', fontSize: '.8125rem' }}>
          <option value="">All programs</option>
          {scholarships.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <span className="muted-text" style={{ fontSize: '.8125rem', alignSelf: 'center' }}>{rows === null ? '' : `${total} total`}</span>
        <a
          className="btn btn-outline"
          href={'/api/admin/scholarship-applications/export.csv' + (() => {
            const p = new URLSearchParams();
            if (statusFilter) p.set('status', statusFilter);
            if (scholarshipFilter) p.set('scholarship_id', scholarshipFilter);
            const s = p.toString();
            return s ? '?' + s : '';
          })()}
          style={{ marginLeft: 'auto', fontSize: '.8125rem', padding: '.35rem .75rem' }}
          title="Download the current filter as CSV — same rows the committee reviews offline"
        >Export CSV</a>
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          No applications match this filter.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Student</th>
                <th style={{ textAlign: 'left' }}>Scholarship</th>
                <th style={{ textAlign: 'left' }}>Submitted</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = STATUS_PALETTE[r.status] || STATUS_PALETTE.submitted;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                      <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.student_email}</div>
                    </td>
                    <td>{r.scholarship_title}</td>
                    <td className="muted-text" style={{ fontSize: '.8125rem' }}>{fmtDate(r.created_at)}</td>
                    <td>
                      <span className="badge" style={{ background: p.bg, color: p.fg, fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 999, fontWeight: 600 }}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .55rem' }} onClick={() => setReviewing(r)}>Review</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <ReviewDrawer application={reviewing} onClose={() => setReviewing(null)} onUpdate={updateStatus} />
      )}
    </>
  );
}

// ─── Human-readable labels for detail fields ──────────────────────────────
// Kept close to the review UI (not exported) so the ordering here is the
// order fields appear in the drawer. Empty details fall through silently.
const CA_LEVEL_LABEL = { foundation: 'CA Foundation', intermediate: 'CA Intermediate', final: 'CA Final' };
const EXAM_GROUP_LABEL = { group_1: 'Group I', group_2: 'Group II', both: 'Both groups' };
const INCOME_LABEL = { '<2L': 'Less than ₹2L', '2-5L': '₹2 – 5L', '5-10L': '₹5 – 10L', '10L+': 'More than ₹10L' };
const CATEGORY_LABEL = { general: 'General', obc: 'OBC', sc: 'SC', st: 'ST', other: 'Other' };

const ACADEMIC_FIELDS = [
  { key: 'ca_level',           label: 'CA level',       map: CA_LEVEL_LABEL },
  { key: 'srn',                label: 'SRN' },
  { key: 'exam_group',         label: 'Last group attempted', map: EXAM_GROUP_LABEL },
  { key: 'exam_result',        label: 'Result' },
  { key: 'coaching_institute', label: 'Coaching institute' },
  { key: 'twelfth_board',      label: '12th board' },
  { key: 'twelfth_percentage', label: '12th %', suffix: '%' },
  { key: 'graduation_details', label: 'Graduation' },
];
const FAMILY_FIELDS = [
  { key: 'father_name',        label: 'Father' },
  { key: 'father_occupation',  label: 'Father\'s occupation' },
  { key: 'mother_name',        label: 'Mother' },
  { key: 'mother_occupation',  label: 'Mother\'s occupation' },
  { key: 'annual_family_income_bucket', label: 'Family income', map: INCOME_LABEL },
  { key: 'num_dependents',     label: 'Dependents' },
  { key: 'category',           label: 'Category', map: CATEGORY_LABEL },
];

function dv(d, spec) {
  const raw = d?.[spec.key];
  if (raw === undefined || raw === null || raw === '') return null;
  if (spec.map && spec.map[raw]) return spec.map[raw];
  return String(raw) + (spec.suffix || '');
}

function DetailGrid({ rows }) {
  const populated = rows.filter((r) => r.value != null);
  if (populated.length === 0) {
    return <p className="muted-text" style={{ fontSize: '.8125rem', margin: 0 }}>Not provided.</p>;
  }
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '1rem', rowGap: '.35rem', margin: 0, fontSize: '.8125rem' }}>
      {populated.map((r) => (
        <div key={r.label} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--muted-foreground)' }}>{r.label}</dt>
          <dd style={{ margin: 0, fontWeight: 500 }}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionHeader({ children }) {
  return (
    <h3 style={{ fontSize: '.8125rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', fontWeight: 700, margin: '1.25rem 0 .4rem' }}>
      {children}
    </h3>
  );
}

// ─── Review drawer ────────────────────────────────────────────────────────
// Shows every field the applicant filled in a printable "application packet"
// layout: identity → statement → academic → family/financial → other-support
// → documents → committee decision. Ctrl+P produces a clean print sheet
// thanks to the `.scholarship-print` scoped stylesheet at the bottom.
function ReviewDrawer({ application, onClose, onUpdate }) {
  const [status, setStatus] = useState(application.status);
  const [note, setNote] = useState(application.reviewer_note || '');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const details = application.details || {};
  const academicRows = ACADEMIC_FIELDS.map((f) => ({ label: f.label, value: dv(details, f) }));
  const familyRows = FAMILY_FIELDS.map((f) => ({ label: f.label, value: dv(details, f) }));
  const documents = application.documents || [];

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell scholarship-print" role="dialog" aria-modal="true"
           style={{ width: 'min(52rem, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header no-print">
          <h2 className="dialog-title">Review · {application.scholarship_title}</h2>
          <div className="row gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => window.print()}
              style={{ fontSize: '.75rem', padding: '.25rem .55rem' }}
              title="Open the browser print dialog with a clean packet layout"
            >Print / PDF</button>
            <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
          </div>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          {/* Print-only header — shows on paper, hidden in the modal */}
          <div className="print-only" style={{ marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Scholarship Application</h1>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>{application.scholarship_title}</div>
          </div>

          {/* Identity */}
          <SectionHeader>Applicant</SectionHeader>
          <DetailGrid rows={[
            { label: 'Name',           value: application.student_name },
            { label: 'Email',          value: application.student_email },
            { label: 'Phone',          value: application.contact_phone },
            { label: 'Submitted',      value: fmtDate(application.created_at) },
            { label: 'Application ID', value: application.id },
          ]} />

          {/* Statement */}
          <SectionHeader>Why applying</SectionHeader>
          <p style={{ marginTop: 0, fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {application.why_applying}
          </p>

          {application.current_situation && (
            <>
              <SectionHeader>Current situation</SectionHeader>
              <p style={{ marginTop: 0, fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                {application.current_situation}
              </p>
            </>
          )}

          {/* Academic */}
          <SectionHeader>Academic details</SectionHeader>
          <DetailGrid rows={academicRows} />

          {/* Family + financial */}
          <SectionHeader>Family + financial background</SectionHeader>
          <DetailGrid rows={familyRows} />
          {details.siblings_education && (
            <p style={{ marginTop: '.4rem', fontSize: '.8125rem', color: 'var(--muted-foreground)' }}>
              <strong style={{ color: 'var(--foreground)' }}>Siblings' education:</strong> {details.siblings_education}
            </p>
          )}

          {/* Other scholarships */}
          <SectionHeader>Other scholarships</SectionHeader>
          {details.other_scholarships_receiving ? (
            <p style={{ margin: 0, fontSize: '.8125rem' }}>
              <strong>Yes.</strong> {details.other_scholarships_details || <span className="muted-text">No details provided.</span>}
            </p>
          ) : (
            <p className="muted-text" style={{ margin: 0, fontSize: '.8125rem' }}>Not receiving any other scholarship.</p>
          )}

          {/* Documents */}
          <SectionHeader>Supporting documents</SectionHeader>
          {documents.length === 0 ? (
            <p className="muted-text" style={{ margin: 0, fontSize: '.8125rem' }}>No documents attached.</p>
          ) : (
            <ul className="col" style={{ listStyle: 'none', padding: 0, margin: 0, gap: '.35rem' }}>
              {documents.map((d) => (
                <li key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '.35rem .5rem', border: '1px solid var(--border)', borderRadius: '.35rem' }}>
                  <span style={{ fontSize: '.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                    View →
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Consent flags */}
          <SectionHeader>Declaration</SectionHeader>
          <div style={{ fontSize: '.8125rem' }}>
            <div>Truthfulness declaration accepted: <strong>{details.declaration_accepted ? 'Yes' : 'No'}</strong></div>
            <div>Name/photo public-list consent: <strong>{details.photo_consent ? 'Yes' : 'No'}</strong></div>
          </div>

          {/* Committee decision — hidden from print by default so the paper
              packet stays neutral until the committee decides. */}
          <div className="no-print" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
            <Field label="Status">
              <select className="input-base" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Reviewer note (visible to the student)">
              <textarea className="input-base" rows={4} value={note} onChange={(e) => setNote(e.target.value.slice(0, 4000))} style={{ resize: 'vertical' }} />
            </Field>
          </div>
        </div>
        <div className="dialog-footer no-print">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => onUpdate(application.id, { status, reviewer_note: note })}>Save decision</button>
        </div>
      </div>

      {/* Print stylesheet — Ctrl+P produces a paper-friendly application
          packet. Chrome renders the modal overlay + shell white with black
          text and hides everything outside the `.scholarship-print` root. */}
      <style>{`
        .print-only { display: none; }
        @media print {
          @page { margin: 18mm; }
          body * { visibility: hidden !important; }
          .scholarship-print, .scholarship-print * { visibility: visible !important; }
          .scholarship-print .no-print, .scholarship-print .no-print * { display: none !important; }
          .scholarship-print { position: absolute; top: 0; left: 0; width: 100%; max-height: none !important; box-shadow: none !important; border: none !important; }
          .scholarship-print .dialog-body { overflow: visible !important; max-height: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
    </div>
  );
}
