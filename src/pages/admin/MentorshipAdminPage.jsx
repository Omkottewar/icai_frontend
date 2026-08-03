import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

// WICASA admin surface for mentorship pairings.
//
// Table lists every mentorship request; row click opens a drawer with the
// student's ask and a mentor picker sourced from the WICASA mentor pool
// (members who've opted into `users.willing_to_mentor`). WICASA hits
// "Assign mentor" → both parties are notified via email + push + in-app,
// and the row moves to status='matched'. Later transitions (schedule /
// complete / cancel) also happen from this same drawer.
//
// Endpoints (all mounted at /api/admin/mentorship):
//   GET  /                          — list with paging + status filter
//   GET  /mentors/search            — willing-pool source for the picker
//   POST /:id/assign-mentor         — assign + notify
//   POST /:id/schedule              — matched → scheduled with datetime
//   POST /:id/complete              — → completed
//   POST /:id/cancel                — cancel from any state

const STATUS_LABEL = {
  pending:   'Pending',
  matched:   'Matched',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_PILL_CLASS = {
  pending:   'admin-pill-active',
  matched:   'admin-pill-filled',
  scheduled: 'admin-pill-filled',
  completed: 'admin-pill-active',
  cancelled: 'admin-pill-expired',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function toLocalDateTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusPill({ status }) {
  return <span className={'admin-pill ' + (STATUS_PILL_CLASS[status] ?? '')}>{STATUS_LABEL[status] ?? status}</span>;
}

export default function MentorshipAdminPage() {
  const { showToast } = useAuth();
  const [status, setStatus] = useState('pending');
  const [queryInput, setQueryInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(queryInput.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  const { data, loading, refresh } = useAdminList('/api/admin/mentorship', {
    status, q, page, pageSize: 20,
  });

  const exportUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (q)      qs.set('q', q);
    const s = qs.toString();
    return `/api/admin/mentorship/export.csv${s ? '?' + s : ''}`;
  }, [status, q]);

  const columns = useMemo(() => [
    {
      key: 'student', header: 'Student', render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.student_name || '—'}</div>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.student_email || ''}</div>
        </div>
      ),
    },
    { key: 'topic', header: 'Topic', render: (r) => r.topic, },
    {
      key: 'mentor', header: 'Mentor', render: (r) => r.mentor_name
        ? <div style={{ fontSize: '.85rem' }}>{r.mentor_name}</div>
        : <span className="muted-text">—</span>,
      width: 160,
    },
    { key: 'created', header: 'Requested', render: (r) => fmtDate(r.created_at), width: 120 },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} />, width: 110 },
  ], []);

  const openRow = data?.rows?.find((r) => r.id === openId) ?? null;

  return (
    <AdminLayout
      title="Mentorship"
      subtitle="Pair students with member mentors, schedule sessions, and track outcomes"
      actions={
        <a href={exportUrl} className="btn btn-outline" style={{ padding: '.5rem 1rem', textDecoration: 'none' }}>
          ⬇ Export CSV
        </a>
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
        onRowClick={(r) => setOpenId(r.id)}
        onSearch={(s) => { setQueryInput(s); }}
        searchPlaceholder="Search by student, email, or topic…"
        emptyMessage="No requests in this state. Students file mentorship requests from their dashboard."
        filters={
          <select className="input-base" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 220 }}>
            <option value="">All statuses</option>
            <option value="pending">Pending (needs mentor)</option>
            <option value="matched">Matched (mentor assigned)</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      />

      <MentorshipDrawer
        row={openRow}
        onClose={() => setOpenId(null)}
        onSaved={refresh}
        showToast={showToast}
      />
    </AdminLayout>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────

function MentorshipDrawer({ row, onClose, onSaved, showToast }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [mentorQuery, setMentorQuery] = useState('');
  const [pickedMentorId, setPickedMentorId] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    if (!row) return;
    setPickedMentorId(row.mentor_user_id || '');
    setAdminNotes(row.notes || '');
    setScheduledAt(toLocalDateTimeInput(row.scheduled_at));
    setMentorQuery('');
    setError(null);
  }, [row?.id]);

  const canAssign = row?.status === 'pending';
  const canSchedule = row?.status === 'matched';
  const canComplete = row?.status === 'scheduled' || row?.status === 'matched';

  // Load mentor pool via the admin-list hook — refetches when the query
  // changes, cache-shared across drawer opens.
  const { data: mentorSearch } = useAdminList(
    '/api/admin/mentorship/mentors/search',
    { q: mentorQuery },
    !!row && canAssign,
  );
  const mentors = mentorSearch?.items ?? [];

  async function assignMentor() {
    if (!pickedMentorId) { setError('Pick a mentor from the pool.'); return; }
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/mentorship/${row.id}/assign-mentor`, {
        method: 'POST',
        body: { mentor_user_id: pickedMentorId, notes: adminNotes.trim() || null },
      });
      showToast?.('Mentor assigned — both parties notified', 'success');
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function schedule() {
    if (!scheduledAt) { setError('Pick a date + time for the first session.'); return; }
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/mentorship/${row.id}/schedule`, {
        method: 'POST',
        body: { scheduled_at: new Date(scheduledAt).toISOString() },
      });
      showToast?.('Session scheduled', 'success');
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function complete() {
    const ok = await dialog.confirm({
      title: 'Mark this mentorship as completed?',
      message: 'This closes the loop. WICASA can still see the row for reporting.',
      confirmText: 'Mark completed',
    });
    if (!ok) return;
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/mentorship/${row.id}/complete`, {
        method: 'POST',
        body: { notes: adminNotes.trim() || null },
      });
      showToast?.('Marked completed', 'success');
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function cancel() {
    const ok = await dialog.confirm({
      title: 'Cancel this request?',
      message: 'The student will see the request as cancelled. Row is retained for audit.',
      confirmText: 'Cancel request',
      danger: true,
    });
    if (!ok) return;
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/mentorship/${row.id}/cancel`, {
        method: 'POST',
        body: { notes: adminNotes.trim() || null },
      });
      showToast?.('Request cancelled', 'info');
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      title={row ? `${row.student_name || 'Request'} — ${STATUS_LABEL[row.status]}` : 'Request'}
      width={640}
    >
      {row && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.5rem .75rem', borderRadius: '.375rem', fontSize: '.85rem' }}>{error}</div>}

          {/* Student panel */}
          <section className="card" style={{ padding: '.9rem' }}>
            <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
              Student
            </h3>
            <div style={{ marginTop: '.4rem', fontWeight: 600 }}>{row.student_name}</div>
            <div className="muted-text" style={{ fontSize: '.8rem' }}>{row.student_email}</div>
            <div style={{ marginTop: '.55rem' }}>
              <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>Topic</div>
              <div style={{ fontSize: '.9rem', marginTop: '.15rem', whiteSpace: 'pre-wrap' }}>{row.topic}</div>
            </div>
            {row.preferred_window && (
              <div style={{ marginTop: '.4rem' }}>
                <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>Preferred session window</div>
                <div style={{ fontSize: '.85rem', marginTop: '.15rem', whiteSpace: 'pre-wrap' }}>{row.preferred_window}</div>
              </div>
            )}
          </section>

          {/* Mentor panel — either the picker (pending) or read-only (matched+) */}
          {canAssign ? (
            <section className="card" style={{ padding: '.9rem' }}>
              <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
                Assign a mentor
              </h3>
              <input
                type="search"
                value={mentorQuery}
                onChange={(e) => setMentorQuery(e.target.value)}
                placeholder="Search the mentor pool by name or email"
                className="input-base"
                style={{ marginTop: '.4rem' }}
              />
              <div style={{
                marginTop: '.5rem', maxHeight: 260, overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: '.375rem',
              }}>
                {mentors.length === 0 && (
                  <div className="muted-text" style={{ padding: '1rem', textAlign: 'center', fontSize: '.85rem' }}>
                    No mentors in the pool yet. Members opt in from their dashboard&apos;s &quot;Become a mentor&quot; card.
                  </div>
                )}
                {mentors.map((m) => {
                  const picked = pickedMentorId === m.id;
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '.5rem',
                        padding: '.5rem .65rem', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: picked ? 'oklch(0.90 0.10 145 / 0.18)' : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="mentor"
                        checked={picked}
                        onChange={() => setPickedMentorId(m.id)}
                        style={{ marginTop: '.15rem' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{m.name}</div>
                        <div className="muted-text" style={{ fontSize: '.72rem' }}>
                          {[m.email, m.phone].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <label style={{ display: 'block', marginTop: '.6rem' }}>
                <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>Notes for the mentor (optional)</div>
                <textarea
                  className="input-base"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value.slice(0, 2000))}
                  placeholder="e.g. 'This student is preparing for CA Final, needs help with GST practice areas.'"
                  style={{ marginTop: '.2rem', resize: 'vertical' }}
                />
              </label>

              <div style={{ marginTop: '.75rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  className="btn btn-primary"
                  onClick={assignMentor}
                  loading={saving}
                  disabled={!pickedMentorId}
                  style={{ padding: '.4rem 1rem', fontSize: '.85rem' }}
                >
                  Assign mentor
                </Button>
                <Button
                  type="button"
                  className="btn btn-outline"
                  onClick={cancel}
                  loading={saving}
                  style={{ padding: '.4rem 1rem', fontSize: '.85rem', color: '#991b1b' }}
                >
                  Cancel request
                </Button>
              </div>
            </section>
          ) : (
            <section className="card" style={{ padding: '.9rem' }}>
              <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
                Mentor
              </h3>
              <div style={{ marginTop: '.4rem', fontWeight: 600 }}>{row.mentor_name || '—'}</div>
              <div className="muted-text" style={{ fontSize: '.8rem' }}>{row.mentor_email || ''}</div>
              {row.matched_at && (
                <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.35rem' }}>
                  Assigned {fmtDate(row.matched_at)}
                </div>
              )}
              {row.scheduled_at && (
                <div style={{ fontSize: '.85rem', marginTop: '.35rem' }}>
                  📅 <strong>First session:</strong> {fmtDateTime(row.scheduled_at)}
                </div>
              )}
              {row.completed_at && (
                <div style={{ fontSize: '.85rem', marginTop: '.35rem', color: 'oklch(0.40 0.14 145)' }}>
                  ✓ Completed {fmtDate(row.completed_at)}
                </div>
              )}
              {row.notes && (
                <div style={{ marginTop: '.5rem' }}>
                  <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>WICASA notes</div>
                  <div style={{ fontSize: '.85rem', whiteSpace: 'pre-wrap', marginTop: '.15rem' }}>{row.notes}</div>
                </div>
              )}
            </section>
          )}

          {/* Schedule + complete + cancel for matched/scheduled rows */}
          {(canSchedule || canComplete) && (
            <section className="card" style={{ padding: '.9rem' }}>
              <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
                Next step
              </h3>

              {canSchedule && (
                <div style={{ marginTop: '.4rem' }}>
                  <label style={{ display: 'block' }}>
                    <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>First session date + time</div>
                    <input
                      type="datetime-local"
                      className="input-base"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      style={{ marginTop: '.2rem' }}
                    />
                  </label>
                  <div style={{ marginTop: '.5rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      className="btn btn-primary"
                      onClick={schedule}
                      loading={saving}
                      style={{ padding: '.4rem 1rem', fontSize: '.85rem' }}
                    >
                      Confirm schedule
                    </Button>
                  </div>
                </div>
              )}

              {canComplete && (
                <div style={{ marginTop: canSchedule ? '.75rem' : '.4rem' }}>
                  <Button
                    type="button"
                    className="btn btn-outline"
                    onClick={complete}
                    loading={saving}
                    style={{ padding: '.4rem 1rem', fontSize: '.85rem' }}
                  >
                    Mark completed
                  </Button>
                  <Button
                    type="button"
                    className="btn btn-outline"
                    onClick={cancel}
                    loading={saving}
                    style={{ padding: '.4rem 1rem', fontSize: '.85rem', color: '#991b1b', marginLeft: '.4rem' }}
                  >
                    Cancel request
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
