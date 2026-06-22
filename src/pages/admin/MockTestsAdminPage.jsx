import { useEffect, useMemo, useState } from 'react'; // eslint-disable-line no-unused-vars
import AdminLayout from '../../components/admin/AdminLayout';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import DataTable from '../../components/admin/DataTable';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { IconArrowRight, IconCheckCircle, IconAward, IconFileText, IconX } from '../../icons';
import { Shimmer, ShimmerFormField } from '../../components/ui/Shimmer';

// WICASA-side mock-test admin. Lists scheduled / open / completed tests,
// lets WICASA create new ones, edit metadata, attach a practice paper +
// answer key PDF, and (most importantly) enter marks per registration
// and publish results so students can see their scores.
//
// The hybrid model means the actual test is sat on paper at the branch
// venue — this page only manages the digital scaffolding around it.

const LEVELS = [
  { value: '',             label: 'All levels' },
  { value: 'foundation',   label: 'Foundation' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'final',        label: 'Final' },
];

const STATUSES = [
  { value: 'scheduled',             label: 'Scheduled' },
  { value: 'open_for_registration', label: 'Open for registration' },
  { value: 'closed',                label: 'Registration closed' },
  { value: 'completed',             label: 'Completed' },
  { value: 'cancelled',             label: 'Cancelled' },
];

const STATUS_TONE = {
  scheduled:             { bg: '#f1f5f9', fg: '#475569' },
  open_for_registration: { bg: '#dbeafe', fg: '#1d4ed8' },
  closed:                { bg: '#fef3c7', fg: '#92400e' },
  completed:             { bg: '#dcfce7', fg: '#166534' },
  cancelled:             { bg: '#fee2e2', fg: '#991b1b' },
};

const DT_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
function fmtDt(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : DT_FMT.format(d);
}
// Re-shape a Date for the `datetime-local` input value.
function toLocalInputValue(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const EMPTY_FORM = {
  id: null,
  title: '',
  description: '',
  series_name: '',
  level: 'intermediate',
  group_no: '',
  paper_no: '',
  scheduled_at: '',
  registration_close_at: '',
  duration_mins: 180,
  venue: '',
  capacity: '',
  fee_paise: 0,
  max_score: 100,
  status: 'scheduled',
  practice_paper_file_id: null,
  practice_paper_url: null,
  answer_key_file_id: null,
  answer_key_url: null,
  result_published_at: null,
};

export default function MockTestsAdminPage() {
  const [filterLevel,  setFilterLevel]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editing, setEditing] = useState(null); // null | EMPTY_FORM | existing row

  const { data, loading, refresh } = useAdminList('/api/admin/mock-tests', {
    status: filterStatus, upcoming: '0',
  });
  const rows = data?.rows ?? [];

  const filteredRows = useMemo(
    () => rows.filter((r) => !filterLevel || r.level === filterLevel),
    [rows, filterLevel],
  );

  function openNew() { setEditing({ ...EMPTY_FORM }); }
  function openEdit(row) {
    setEditing({
      ...EMPTY_FORM,
      ...row,
      scheduled_at: toLocalInputValue(row.scheduled_at),
      registration_close_at: toLocalInputValue(row.registration_close_at),
      group_no: row.group_no ?? '',
      paper_no: row.paper_no ?? '',
      capacity: row.capacity ?? '',
    });
  }
  function closeDrawer() { setEditing(null); }

  return (
    <AdminLayout
      title="Mock tests"
      subtitle="WICASA — schedule, manage registrations, enter marks, release results"
      actions={
        <button className="btn btn-primary" onClick={openNew} style={{ padding: '.5rem 1rem' }}>
          + New mock test
        </button>
      }
    >
      <div className="row gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select className="input-base" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
          {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select className="input-base" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <DataTable
        loading={loading}
        rows={filteredRows}
        onRowClick={openEdit}
        columns={[
          { key: 'title', header: 'Title', render: (r) => <strong>{r.title}</strong> },
          { key: 'level', header: 'Level', render: (r) => `${r.level}${r.paper_no ? ` · Paper ${r.paper_no}` : ''}` },
          { key: 'scheduled_at', header: 'Scheduled', render: (r) => fmtDt(r.scheduled_at) },
          { key: 'registered_count', header: 'Registered', render: (r) => `${r.registered_count ?? 0}${r.capacity ? ` / ${r.capacity}` : ''}` },
          { key: 'status', header: 'Status', render: (r) => {
            const t = STATUS_TONE[r.status] ?? STATUS_TONE.scheduled;
            return <span style={{ background: t.bg, color: t.fg, padding: '.15rem .5rem', borderRadius: 999, fontSize: '.72rem', fontWeight: 600 }}>{r.status}</span>;
          }},
        ]}
        emptyMessage="No mock tests yet. Click '+ New mock test' to schedule one."
      />

      {editing && (
        <MockTestDrawer
          initial={editing}
          onClose={closeDrawer}
          onSaved={() => { closeDrawer(); refresh(); }}
        />
      )}
    </AdminLayout>
  );
}

// ─── Drawer — create or edit a mock test ────────────────────────────────
function MockTestDrawer({ initial, onClose, onSaved }) {
  const { showToast } = useAuth();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const isNew = !form.id;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function payload() {
    return {
      title: form.title,
      description: form.description || null,
      series_name: form.series_name || null,
      level: form.level,
      group_no: form.group_no === '' ? null : Number(form.group_no),
      paper_no: form.paper_no === '' ? null : Number(form.paper_no),
      scheduled_at: form.scheduled_at,
      registration_close_at: form.registration_close_at || null,
      duration_mins: Number(form.duration_mins) || 180,
      venue: form.venue || null,
      capacity: form.capacity === '' ? null : Number(form.capacity),
      fee_paise: Number(form.fee_paise) || 0,
      max_score: Number(form.max_score) || 100,
      status: form.status,
      practice_paper_file_id: form.practice_paper_file_id ?? null,
      answer_key_file_id: form.answer_key_file_id ?? null,
    };
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const body = payload();
      if (!body.title)        throw new Error('Title is required');
      if (!body.scheduled_at) throw new Error('Schedule date is required');
      const url = isNew ? '/api/admin/mock-tests' : `/api/admin/mock-tests/${form.id}`;
      const r = await adminFetch(url, { method: isNew ? 'POST' : 'PATCH', body });
      showToast?.(isNew ? 'Mock test created' : 'Saved', 'success');
      setForm((f) => ({ ...f, ...r.item, scheduled_at: toLocalInputValue(r.item.scheduled_at) }));
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function softDelete() {
    if (!confirm('Delete this mock test? Registrations will be retained for audit.')) return;
    setDeleting(true); setError('');
    try {
      await adminFetch(`/api/admin/mock-tests/${form.id}`, { method: 'DELETE' });
      showToast?.('Mock test deleted', 'success');
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function uploadFile(field, file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast?.('File too large (max 10 MB)', 'error');
      return;
    }
    try {
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const r = await adminFetch('/api/admin/files', {
        method: 'POST',
        body: { name: file.name, mime_type: file.type || 'application/pdf', bucket: 'mock_tests', data_base64: b64 },
      });
      set(field + '_file_id', r.id);
      set(field + '_url', r.url);
      showToast?.('Uploaded', 'success');
    } catch (e) {
      showToast?.(e.message || 'Upload failed', 'error');
    }
  }

  async function publishResults() {
    if (!form.id) return;
    if (!confirm('Publish results? Students will be able to see their scores immediately.')) return;
    try {
      const r = await adminFetch(`/api/admin/mock-tests/${form.id}/publish-results`, { method: 'POST' });
      set('result_published_at', r.item.result_published_at);
      set('status', r.item.status);
      showToast?.('Results published', 'success');
      onSaved?.();
    } catch (e) {
      showToast?.(e.message || 'Publish failed', 'error');
    }
  }

  async function unpublishResults() {
    if (!form.id) return;
    if (!confirm('Unpublish results? Students will no longer see their scores.')) return;
    try {
      await adminFetch(`/api/admin/mock-tests/${form.id}/unpublish-results`, { method: 'POST' });
      set('result_published_at', null);
      showToast?.('Results unpublished', 'success');
      onSaved?.();
    } catch (e) {
      showToast?.(e.message || 'Unpublish failed', 'error');
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'New mock test' : (form.title || 'Edit mock test')}
      width={720}
      footer={
        <>
          {error && <span style={{ color: 'var(--destructive)', marginRight: 'auto', fontSize: '.85rem' }}>{error}</span>}
          {!isNew && (
            <button type="button" className="btn btn-ghost" onClick={softDelete} disabled={saving || deleting} style={{ color: 'var(--destructive)' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : (isNew ? 'Create' : 'Save changes')}
          </button>
        </>
      }
    >
      <div className="mt-admin-form">
        {/* Status + publish banner */}
        {!isNew && (
          <div className={'mt-status-banner mt-status-' + (form.result_published_at ? 'published' : 'draft')}>
            {form.result_published_at ? (
              <>
                <IconCheckCircle size="sm" />
                <div style={{ flex: 1 }}>
                  <strong>Results published</strong> · {fmtDt(form.result_published_at)} · Students can see their scores.
                </div>
                <button type="button" className="btn btn-ghost" onClick={unpublishResults} style={{ padding: '.3rem .65rem', fontSize: '.78rem' }}>
                  Unpublish
                </button>
              </>
            ) : (
              <>
                <IconAward size="sm" />
                <div style={{ flex: 1 }}>
                  <strong>Results not published yet.</strong> Enter marks below, then publish to release scores to students.
                </div>
                <button type="button" className="btn btn-primary" onClick={publishResults} style={{ padding: '.3rem .65rem', fontSize: '.78rem' }}>
                  Publish results
                </button>
              </>
            )}
          </div>
        )}

        {/* Basics */}
        <div className="admin-form-grid">
          <FormField label="Title" required span={2}>
            <input className="input-base" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. May 2026 Mock — Paper 4 (Cost & Management)" />
          </FormField>
          <FormField label="Series name (optional)" span={2}>
            <input className="input-base" value={form.series_name} onChange={(e) => set('series_name', e.target.value)} placeholder="May 2026 Final mock series" />
          </FormField>
          <FormField label="Description (optional)" span={2}>
            <textarea className="input-base" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Instructions, syllabus coverage, what to bring…" />
          </FormField>

          <FormField label="Level" required>
            <select className="input-base" value={form.level} onChange={(e) => set('level', e.target.value)}>
              <option value="foundation">Foundation</option>
              <option value="intermediate">Intermediate</option>
              <option value="final">Final</option>
            </select>
          </FormField>
          <FormField label="Group (1 / 2)">
            <select className="input-base" value={form.group_no} onChange={(e) => set('group_no', e.target.value)}>
              <option value="">— Not applicable —</option>
              <option value="1">Group 1</option>
              <option value="2">Group 2</option>
            </select>
          </FormField>
          <FormField label="Paper number (1–8)">
            <input className="input-base" type="number" min="1" max="8" value={form.paper_no} onChange={(e) => set('paper_no', e.target.value)} placeholder="e.g. 4" />
          </FormField>
          <FormField label="Status">
            <select className="input-base" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>

          {/* Schedule + venue */}
          <FormField label="Scheduled at" required>
            <input className="input-base" type="datetime-local" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
          </FormField>
          <FormField label="Registration closes at (optional)">
            <input className="input-base" type="datetime-local" value={form.registration_close_at} onChange={(e) => set('registration_close_at', e.target.value)} />
          </FormField>
          <FormField label="Duration (minutes)">
            <input className="input-base" type="number" min="30" max="240" value={form.duration_mins} onChange={(e) => set('duration_mins', e.target.value)} />
          </FormField>
          <FormField label="Venue">
            <input className="input-base" value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="ICAI Bhawan, Nagpur" />
          </FormField>
          <FormField label="Capacity">
            <input className="input-base" type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="Leave blank for unlimited" />
          </FormField>
          <FormField label="Fee (₹)">
            <input className="input-base" type="number" min="0" value={form.fee_paise / 100} onChange={(e) => set('fee_paise', Math.round(Number(e.target.value || 0) * 100))} />
          </FormField>
          <FormField label="Max score">
            <input className="input-base" type="number" min="1" value={form.max_score} onChange={(e) => set('max_score', e.target.value)} />
          </FormField>
          <FormField label="" />

          {/* PDF uploads */}
          <FormField label="Practice paper PDF (visible from the moment registration opens)" span={2}>
            <FilePicker
              fileId={form.practice_paper_file_id}
              fileUrl={form.practice_paper_url}
              onPick={(f) => uploadFile('practice_paper', f)}
              onClear={() => { set('practice_paper_file_id', null); set('practice_paper_url', null); }}
            />
          </FormField>
          <FormField label="Answer key PDF (visible to students after you publish results)" span={2}>
            <FilePicker
              fileId={form.answer_key_file_id}
              fileUrl={form.answer_key_url}
              onPick={(f) => uploadFile('answer_key', f)}
              onClear={() => { set('answer_key_file_id', null); set('answer_key_url', null); }}
            />
          </FormField>
        </div>

        {/* Registrations + marks entry */}
        {!isNew && <RegistrationsSection mockTestId={form.id} maxScore={Number(form.max_score) || 100} />}
      </div>

      <style>{`
        .mt-admin-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .admin-form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: .875rem 1rem;
        }
        .mt-status-banner {
          display: flex; align-items: center; gap: .65rem;
          padding: .6rem .9rem; border-radius: 10px; border: 1px solid; font-size: .85rem;
        }
        .mt-status-banner > svg { flex-shrink: 0; }
        .mt-status-draft {
          background: oklch(0.85 0.16 90 / .12);
          border-color: oklch(0.85 0.16 90 / .45);
          color: #92400e;
        }
        .mt-status-published {
          background: oklch(0.55 0.14 155 / .10);
          border-color: oklch(0.55 0.14 155 / .35);
          color: var(--secondary);
        }
      `}</style>
    </Drawer>
  );
}

// ─── Small inline PDF picker (admin-side) ───────────────────────────────
function FilePicker({ fileId, fileUrl, onPick, onClear }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
      {fileUrl ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
           className="row gap-1"
           style={{ padding: '.4rem .7rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '.8rem', textDecoration: 'none', color: 'var(--primary)' }}>
          <IconFileText size="sm" /> View uploaded PDF
        </a>
      ) : fileId ? (
        <span className="muted-text" style={{ fontSize: '.8rem' }}>File saved · refresh to load the link.</span>
      ) : (
        <span className="muted-text" style={{ fontSize: '.8rem' }}>No PDF uploaded yet.</span>
      )}
      <label className="btn btn-outline" style={{ cursor: 'pointer', padding: '.4rem .75rem', fontSize: '.8rem' }}>
        {fileId ? 'Replace' : 'Upload PDF'}
        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => onPick(e.target.files?.[0])} />
      </label>
      {fileId && (
        <button type="button" className="btn btn-ghost" onClick={onClear} style={{ padding: '.4rem .65rem', fontSize: '.78rem', color: 'var(--destructive)' }}>
          <IconX size="sm" /> Remove
        </button>
      )}
    </div>
  );
}

// ─── Registrations + marks entry table ──────────────────────────────────
//
// Lists everyone who registered, with status + score columns. Admin
// edits inline, then "Save marks" pushes the batch in one round-trip.
function RegistrationsSection({ mockTestId, maxScore }) {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [edits, setEdits] = useState({}); // regId → { score, status }
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const r = await adminFetch(`/api/admin/mock-tests/${mockTestId}/registrations`);
      setRows(r.rows || []);
      setEdits({});
    } catch (e) {
      setErr(e.message || 'Could not load registrations');
      setRows([]);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mockTestId]);

  function setEdit(regId, patch) {
    setEdits((cur) => ({ ...cur, [regId]: { ...cur[regId], ...patch } }));
  }

  async function saveMarks() {
    const entries = Object.entries(edits).map(([registration_id, e]) => ({ registration_id, ...e }));
    if (entries.length === 0) {
      showToast?.('No changes to save', 'info');
      return;
    }
    setSaving(true); setErr('');
    try {
      const r = await adminFetch(`/api/admin/mock-tests/${mockTestId}/marks`, {
        method: 'POST',
        body: { entries },
      });
      showToast?.(`Updated ${r.updated} row${r.updated === 1 ? '' : 's'}`, 'success');
      await load();
    } catch (e) {
      setErr(e.message || 'Save marks failed');
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = Object.keys(edits).length;

  return (
    <section style={{ marginTop: '.5rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700 }}>Registrations &amp; marks</h3>
          <p className="muted-text" style={{ margin: '.15rem 0 0', fontSize: '.75rem' }}>
            {rows == null ? 'Loading…' : `${rows.length} registration${rows.length === 1 ? '' : 's'}`} · max score {maxScore}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveMarks} disabled={saving || dirtyCount === 0} style={{ padding: '.4rem .8rem', fontSize: '.8rem' }}>
          {saving ? 'Saving…' : `Save marks${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </button>
      </div>
      {err && <p style={{ color: 'var(--destructive)', fontSize: '.78rem' }}>{err}</p>}
      {rows == null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} height="2rem" width="100%" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="muted-text" style={{ fontSize: '.85rem' }}>No one has registered yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', textAlign: 'left' }}>
              <tr>
                <th style={th}>Student</th>
                <th style={th}>Status</th>
                <th style={th}>Score</th>
                <th style={th}>%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cur = edits[r.id] ?? {};
                const scoreVal  = cur.score  ?? r.score ?? '';
                const statusVal = cur.status ?? r.status;
                const pct = scoreVal !== '' && Number.isFinite(Number(scoreVal))
                  ? Math.round((Number(scoreVal) / maxScore) * 100)
                  : null;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.user_name || '—'}</div>
                      <div className="muted-text" style={{ fontSize: '.72rem' }}>{r.user_email}</div>
                    </td>
                    <td style={td}>
                      <select className="input-base" value={statusVal} onChange={(e) => setEdit(r.id, { status: e.target.value })} style={{ padding: '.25rem .4rem', fontSize: '.78rem' }}>
                        <option value="registered">registered</option>
                        <option value="attended">attended</option>
                        <option value="absent">absent</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td style={td}>
                      <input
                        className="input-base"
                        type="number"
                        min="0"
                        max={maxScore}
                        value={scoreVal}
                        onChange={(e) => setEdit(r.id, { score: e.target.value === '' ? null : Number(e.target.value) })}
                        style={{ width: '6rem', padding: '.25rem .4rem', fontSize: '.85rem' }}
                        placeholder="—"
                      />
                    </td>
                    <td style={td}>{pct == null ? '—' : `${pct}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const th = { padding: '.5rem .65rem', fontWeight: 700, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)' };
const td = { padding: '.45rem .65rem', verticalAlign: 'middle' };
