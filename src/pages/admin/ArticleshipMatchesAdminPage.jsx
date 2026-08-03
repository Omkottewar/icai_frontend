import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import EntityHistorySection from '../../components/admin/EntityHistorySection';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

// WICASA admin surface for the articleship matching flow.
//
// Table lists every submission; click a row to open a drawer that shows
// the student's preferences and a smart firm picker. WICASA scores the
// active firms against the student's preferences, picks a shortlist, and
// hits "Recommend" — that fires a notification to the student and flips
// the row to status='matched'. Students then confirm/decline placement
// from their dashboard.
//
// Related endpoints (all mounted at /api/admin/articleship-matches):
//   GET  /                       — list with paging + status filter
//   GET  /firms/search           — smart-scored firm picker source
//   POST /:id/recommend          — set recommended_firm_ids, notify student
//   POST /:id/placed             — mark WICASA-recorded placement
//   POST /:id/cancel             — cancel the submission
//   GET  /export.csv             — CSV dump for offline WICASA meetings

const STATUS_LABEL = {
  submitted: 'Submitted',
  matched:   'Matched',
  placed:    'Placed',
  cancelled: 'Cancelled',
};

const STATUS_PILL_CLASS = {
  submitted: 'admin-pill-active',
  matched:   'admin-pill-filled',
  placed:    'admin-pill-active',
  cancelled: 'admin-pill-expired',
};

const FIRM_SIZE_LABEL = {
  sole_practitioner: 'Sole practitioner',
  small:             'Small firm (2–10)',
  medium:            'Mid-size (10–50)',
  large:             'Large (50+)',
  big4:              'Big 4',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function fmtStipend(paise) {
  if (paise == null) return '—';
  const rupees = Math.round(Number(paise) / 100);
  if (!Number.isFinite(rupees)) return '—';
  return `₹${rupees.toLocaleString('en-IN')}/mo`;
}

function StatusPill({ status }) {
  return <span className={'admin-pill ' + (STATUS_PILL_CLASS[status] ?? '')}>{STATUS_LABEL[status] ?? status}</span>;
}

export default function ArticleshipMatchesAdminPage() {
  const { showToast } = useAuth();
  const [status, setStatus] = useState('submitted');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const { data, loading, refresh } = useAdminList('/api/admin/articleship-matches', {
    status, page, pageSize: 20,
  });

  const columns = useMemo(() => [
    {
      key: 'student', header: 'Student', render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.student_name || '—'}</div>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.student_email || ''}</div>
        </div>
      ),
    },
    {
      key: 'specs', header: 'Specialisations', render: (r) => {
        const arr = Array.isArray(r.preferred_specialisations) ? r.preferred_specialisations : [];
        if (arr.length === 0) return <span className="muted-text">—</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.2rem' }}>
            {arr.slice(0, 3).map((s) => (
              <span key={s} style={{ fontSize: '.68rem', padding: '.1rem .4rem', borderRadius: '.25rem', background: 'oklch(0.55 0.14 155 / 0.12)', color: 'oklch(0.28 0.14 155)', fontWeight: 600 }}>{s}</span>
            ))}
            {arr.length > 3 && <span className="muted-text" style={{ fontSize: '.7rem' }}>+{arr.length - 3}</span>}
          </div>
        );
      },
    },
    {
      key: 'firm_size', header: 'Firm size',
      render: (r) => r.preferred_firm_size ? FIRM_SIZE_LABEL[r.preferred_firm_size] ?? r.preferred_firm_size : <span className="muted-text">Any</span>,
      width: 140,
    },
    { key: 'stipend', header: 'Stipend', render: (r) => fmtStipend(r.expected_stipend_paise), width: 100 },
    { key: 'created', header: 'Submitted', render: (r) => fmtDate(r.created_at), width: 120 },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} />, width: 110 },
  ], []);

  const openRow = data?.rows?.find((r) => r.id === openId) ?? null;

  const exportUrl = `/api/admin/articleship-matches/export.csv${status ? `?status=${encodeURIComponent(status)}` : ''}`;

  return (
    <AdminLayout
      title="Articleship matching"
      subtitle="Review student submissions, shortlist member firms, and track placement"
      actions={
        <a href={exportUrl} className="btn btn-outline" style={{ padding: '.5rem 1rem' }}>
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
        emptyMessage="No submissions in this state. Students file preferences from the Job Vacancies → Articleship page."
        filters={
          <select className="input-base" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
            <option value="">All statuses</option>
            <option value="submitted">Submitted (needs review)</option>
            <option value="matched">Matched (shortlist sent)</option>
            <option value="placed">Placed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      />

      <MatchDrawer
        row={openRow}
        onClose={() => setOpenId(null)}
        onSaved={refresh}
        showToast={showToast}
      />
    </AdminLayout>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────

function MatchDrawer({ row, onClose, onSaved, showToast }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Firm-picker state — reset every time a new row opens.
  const [pickedIds, setPickedIds] = useState(() => new Set());
  const [notes, setNotes] = useState('');
  const [pickerQuery, setPickerQuery] = useState('');
  const [onlyVerified, setOnlyVerified] = useState(false);

  useEffect(() => {
    if (!row) return;
    // Preload the existing recommendation list so the admin can edit
    // instead of starting fresh on a re-open.
    setPickedIds(new Set(Array.isArray(row.recommended_firm_ids) ? row.recommended_firm_ids : []));
    setNotes(row.notes ?? '');
    setPickerQuery('');
    setError(null);
  }, [row?.id]);

  const canRecommend = row?.status === 'submitted' || row?.status === 'matched';
  const specsCsv = Array.isArray(row?.preferred_specialisations) ? row.preferred_specialisations.join(',') : '';
  const size = row?.preferred_firm_size || '';

  // Fetch firms once we have a row + its prefs. useAdminList refetches when
  // key params change — that's exactly what we want when the admin filters.
  const firmParams = useMemo(() => ({
    specialisations: specsCsv,
    firm_size: size,
    q: pickerQuery,
    only_verified: onlyVerified ? '1' : '',
  }), [specsCsv, size, pickerQuery, onlyVerified]);
  const { data: firmSearch } = useAdminList(
    '/api/admin/articleship-matches/firms/search',
    firmParams,
    !!row,
  );
  const firms = firmSearch?.items ?? [];

  function togglePick(firmId) {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(firmId)) next.delete(firmId);
      else next.add(firmId);
      return next;
    });
  }

  async function recommend() {
    if (pickedIds.size === 0) { setError('Pick at least one firm to shortlist.'); return; }
    if (row.status !== 'submitted') {
      // Support re-recommending on a matched row too (rare — WICASA
      // occasionally revises the shortlist before the student decides).
      const ok = await dialog.confirm({
        title: 'Update the shortlist?',
        message: 'This will replace the previous shortlist and re-notify the student.',
        confirmText: 'Update shortlist',
      });
      if (!ok) return;
    }
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/articleship-matches/${row.id}/recommend`, {
        method: 'POST',
        body: {
          recommended_firm_ids: Array.from(pickedIds),
          notes: notes.trim() || null,
        },
      });
      showToast?.('Shortlist sent — student notified', 'success');
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function markPlaced() {
    if (pickedIds.size !== 1) { setError('Pick exactly one firm to mark this student placed.'); return; }
    const ok = await dialog.confirm({
      title: 'Mark this student as placed?',
      message: 'This closes the loop on WICASA\'s side. The student can also confirm placement themselves from their dashboard.',
      confirmText: 'Mark placed',
    });
    if (!ok) return;
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/articleship-matches/${row.id}/placed`, {
        method: 'POST',
        body: { placed_firm_id: Array.from(pickedIds)[0] },
      });
      showToast?.('Placement recorded', 'success');
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function cancel() {
    const ok = await dialog.confirm({
      title: 'Cancel this submission?',
      message: 'The student will see the submission as cancelled but the row is retained for audit.',
      confirmText: 'Cancel submission',
      danger: true,
    });
    if (!ok) return;
    setSaving(true); setError(null);
    try {
      await adminFetch(`/api/admin/articleship-matches/${row.id}/cancel`, {
        method: 'POST',
        body: { notes: notes.trim() || null },
      });
      showToast?.('Submission cancelled', 'info');
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
      title={row ? `${row.student_name || 'Submission'} — ${STATUS_LABEL[row.status]}` : 'Submission'}
      width={720}
    >
      {row && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div className="alert alert-error" style={{ background: '#fee2e2', color: '#991b1b', padding: '.5rem .75rem', borderRadius: '.375rem', fontSize: '.85rem' }}>{error}</div>}

          {/* Student panel */}
          <section className="card" style={{ padding: '.9rem' }}>
            <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
              Student
            </h3>
            <div style={{ marginTop: '.4rem', fontWeight: 600 }}>{row.student_name}</div>
            <div className="muted-text" style={{ fontSize: '.8rem' }}>{row.student_email}</div>
            {row.seminar_event_title && (
              <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                Seminar: {row.seminar_event_title}
              </div>
            )}
            {row.cv_url && (
              <a href={row.cv_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ marginTop: '.55rem', padding: '.3rem .75rem', fontSize: '.75rem' }}>
                📄 View CV ({row.cv_name || 'PDF'})
              </a>
            )}
          </section>

          {/* Preferences panel */}
          <section className="card" style={{ padding: '.9rem' }}>
            <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
              Preferences
            </h3>
            <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginTop: '.5rem' }}>
              <Detail label="Specialisations" value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem', marginTop: '.15rem' }}>
                  {(row.preferred_specialisations ?? []).map((s) => (
                    <span key={s} style={{ fontSize: '.68rem', padding: '.1rem .4rem', borderRadius: '.25rem', background: 'oklch(0.55 0.14 155 / 0.12)', color: 'oklch(0.28 0.14 155)', fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              } />
              <Detail label="Firm size" value={row.preferred_firm_size ? FIRM_SIZE_LABEL[row.preferred_firm_size] : 'Any'} />
              <Detail label="Expected stipend" value={fmtStipend(row.expected_stipend_paise)} />
            </div>
            {row.notes && (
              <div style={{ marginTop: '.5rem' }}>
                <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Student notes</div>
                <div style={{ fontSize: '.85rem', whiteSpace: 'pre-wrap', marginTop: '.15rem' }}>{row.notes}</div>
              </div>
            )}
          </section>

          {/* Firm picker */}
          {canRecommend ? (
            <section className="card" style={{ padding: '.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '.5rem' }}>
                <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
                  Recommend firms ({pickedIds.size} picked)
                </h3>
                <label style={{ fontSize: '.75rem', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                  <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
                  Verified only
                </label>
              </div>
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search firms by name, city, or registration no."
                className="input-base"
                style={{ marginTop: '.4rem' }}
              />
              <div style={{
                marginTop: '.5rem', maxHeight: 320, overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: '.375rem',
              }}>
                {firms.length === 0 && (
                  <div className="muted-text" style={{ padding: '1rem', textAlign: 'center', fontSize: '.85rem' }}>
                    No firms found. Add firms in the Firms admin, or clear the filters.
                  </div>
                )}
                {firms.map((f) => {
                  const picked = pickedIds.has(f.id);
                  return (
                    <label
                      key={f.id}
                      style={{
                        display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '.5rem',
                        padding: '.5rem .65rem', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: picked ? 'oklch(0.90 0.10 145 / 0.18)' : 'transparent',
                      }}
                    >
                      <input type="checkbox" checked={picked} onChange={() => togglePick(f.id)} style={{ marginTop: '.2rem' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.85rem' }}>
                          {f.name}
                          {f.verified && <span title="Verified" style={{ marginLeft: '.35rem', color: 'oklch(0.45 0.14 145)' }}>✓</span>}
                        </div>
                        <div className="muted-text" style={{ fontSize: '.72rem' }}>
                          {[
                            f.registration_no,
                            f.city,
                            f.partners_count != null ? `${f.partners_count} partner${f.partners_count === 1 ? '' : 's'}` : null,
                          ].filter(Boolean).join(' · ')}
                        </div>
                        {Array.isArray(f.areas_of_expertise) && f.areas_of_expertise.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.2rem', marginTop: '.2rem' }}>
                            {f.areas_of_expertise.slice(0, 4).map((a) => (
                              <span key={a} style={{ fontSize: '.65rem', padding: '.05rem .35rem', borderRadius: '.2rem', background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span style={{
                        alignSelf: 'flex-start',
                        fontSize: '.7rem', fontWeight: 700,
                        padding: '.15rem .45rem', borderRadius: '999px',
                        background: f.score >= 60 ? 'oklch(0.55 0.14 155 / 0.18)' : f.score > 0 ? 'oklch(0.36 0.13 255 / 0.10)' : 'var(--muted)',
                        color:      f.score >= 60 ? 'oklch(0.28 0.14 155)'      : f.score > 0 ? 'var(--primary)'                  : 'var(--muted-foreground)',
                      }} title="Match score based on specialisation overlap + firm-size fit + verification">
                        {f.score}
                      </span>
                    </label>
                  );
                })}
              </div>

              <label style={{ display: 'block', marginTop: '.6rem' }}>
                <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Notes to student (optional)</div>
                <textarea
                  className="input-base"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                  placeholder="Add context — e.g. 'These three firms have active openings and match your interest in GST.'"
                  style={{ marginTop: '.2rem', resize: 'vertical' }}
                />
              </label>

              <div style={{ marginTop: '.75rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  className="btn btn-primary"
                  onClick={recommend}
                  loading={saving}
                  disabled={pickedIds.size === 0}
                  style={{ padding: '.4rem 1rem', fontSize: '.85rem' }}
                >
                  {row.status === 'submitted' ? 'Send shortlist' : 'Update shortlist'}
                </Button>
                <Button
                  type="button"
                  className="btn btn-outline"
                  onClick={markPlaced}
                  loading={saving}
                  disabled={pickedIds.size !== 1}
                  title="Only enabled when exactly one firm is picked"
                  style={{ padding: '.4rem 1rem', fontSize: '.85rem' }}
                >
                  Mark placed
                </Button>
                <Button
                  type="button"
                  className="btn btn-outline"
                  onClick={cancel}
                  loading={saving}
                  style={{ padding: '.4rem 1rem', fontSize: '.85rem', color: '#991b1b' }}
                >
                  Cancel submission
                </Button>
              </div>
            </section>
          ) : (
            <section className="card" style={{ padding: '.9rem' }}>
              <h3 style={{ fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted-foreground)', margin: 0 }}>
                Outcome
              </h3>
              <p className="muted-text" style={{ fontSize: '.85rem', marginTop: '.35rem' }}>
                {row.status === 'placed'  && <>Student placed at <strong>{row.placed_firm_name || 'the recommended firm'}</strong>.</>}
                {row.status === 'cancelled' && <>Submission cancelled. No further action.</>}
              </p>
            </section>
          )}

          {/* Per-entity version history — see components/admin/EntityHistorySection.
              Every status transition on this row is captured by the audit lib
              on the backend (routes/admin/articleshipMatches.ts). */}
          <EntityHistorySection entityType="articleship_matches" entityId={row.id} />
        </div>
      )}
    </Drawer>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="muted-text" style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '.85rem', marginTop: '.15rem' }}>{value}</div>
    </div>
  );
}
