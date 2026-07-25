import { useEffect, useState } from 'react';
import { cachedGet, apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import { IconX, IconFileText, IconDownload } from '../../icons';

// Slide-over showing every applicant for a posting from the employer side.
// The employer can flip status and download the snapshotted resume.
// Opens from EmployerPostingsPage.

const STATUS_ORDER = ['applied', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];
const STATUS_STYLE = {
  applied:     { bg: '#dbeafe', fg: '#1e40af', label: 'Received' },
  shortlisted: { bg: '#e0e7ff', fg: '#3730a3', label: 'Shortlisted' },
  interview:   { bg: '#fef3c7', fg: '#92400e', label: 'Interview' },
  offered:     { bg: '#d1fae5', fg: '#065f46', label: 'Offered' },
  hired:       { bg: '#d1fae5', fg: '#047857', label: 'Hired' },
  rejected:    { bg: '#fee2e2', fg: '#991b1b', label: 'Not selected' },
  withdrawn:   { bg: '#e5e7eb', fg: '#374151', label: 'Withdrawn' },
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function PostingApplicantsPanel({ posting, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    cachedGet(`/api/employer/postings/${posting.id}/applicants`)
      .then((j) => setRows(j.items || []))
      .catch((e) => setError(e.message));
  };
  useEffect(() => { reload(); }, [posting.id]);

  async function updateStatus(appId, status) {
    setBusyId(appId);
    try {
      await apiWrite(`/api/employer/applications/${appId}`, {
        method: 'PATCH',
        body: { status },
        invalidates: [`/api/employer/postings/${posting.id}/applicants`],
      });
      toast?.success?.('Status updated');
      reload();
    } catch (err) {
      toast?.error?.(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadResume(appId) {
    try {
      const j = await cachedGet(`/api/employer/applications/${appId}/resume`, undefined, 0);
      if (!j?.url) throw new Error('Resume no longer available');
      window.open(j.url, '_blank', 'noopener,noreferrer');
    } catch (err) { toast?.error?.(err.message); }
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const header = ['name', 'email', 'phone', 'role', 'status', 'applied_at', 'cover_message'];
    const escape = (v) => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const lines = rows.map((r) => [
      r.applicant_name, r.applicant_email, r.applicant_phone || '',
      r.applicant_role, r.status, r.created_at, r.cover_message || '',
    ].map(escape).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applicants-${posting.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 'min(720px, 100vw)', background: 'var(--card)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-16px 0 32px rgba(0,0,0,.15)',
      }}>
        <header style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <div className="muted-text" style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Applicants
            </div>
            <div style={{ fontWeight: 700, fontSize: '.95rem', marginTop: '.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {posting.title}
            </div>
          </div>
          <div style={{ display: 'inline-flex', gap: '.4rem' }}>
            <button onClick={exportCsv} className="btn btn-outline" style={{ padding: '.35rem .7rem', fontSize: '.75rem' }} disabled={!rows || rows.length === 0}>
              Export CSV
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)' }}>
              <IconX />
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {error && <div style={{ color: '#991b1b', fontSize: '.85rem' }}>{error}</div>}
          {!error && rows === null && <div className="muted-text" style={{ fontSize: '.85rem' }}>Loading…</div>}
          {rows && rows.length === 0 && (
            <div className="muted-text" style={{ fontSize: '.85rem' }}>
              No applicants yet. This will populate as members/students apply.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div style={{ display: 'grid', gap: '.75rem' }}>
              {rows.map((r) => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.applied;
                return (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: '.5rem', padding: '.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{r.applicant_name}</div>
                        <div className="muted-text" style={{ fontSize: '.78rem', marginTop: '.2rem' }}>
                          <a href={`mailto:${r.applicant_email}`} style={{ color: 'var(--primary)' }}>{r.applicant_email}</a>
                          {r.applicant_phone && <> · <a href={`tel:${r.applicant_phone}`} style={{ color: 'var(--primary)' }}>{r.applicant_phone}</a></>}
                          {' · '}{r.applicant_role} · applied {fmtDate(r.created_at)}
                        </div>
                      </div>
                      <span style={{
                        padding: '.15rem .55rem', borderRadius: '999px',
                        fontSize: '.7rem', fontWeight: 700,
                        background: s.bg, color: s.fg,
                        textTransform: 'uppercase', letterSpacing: '.03em',
                      }}>{s.label}</span>
                    </div>

                    {r.cover_message && (
                      <div style={{ marginTop: '.55rem', padding: '.5rem .65rem', background: 'var(--muted)', borderRadius: '.375rem', fontSize: '.8125rem', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                        {r.cover_message}
                      </div>
                    )}

                    <div style={{ marginTop: '.65rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                      {r.resume_file_id && (
                        <button onClick={() => downloadResume(r.id)} className="btn btn-outline" style={{ padding: '.3rem .65rem', fontSize: '.75rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                          <IconFileText size="sm" /> View resume
                        </button>
                      )}
                      {r.status !== 'withdrawn' && STATUS_ORDER.filter((s2) => s2 !== r.status).map((s2) => {
                        const label = STATUS_STYLE[s2].label;
                        return (
                          <button
                            key={s2}
                            onClick={() => updateStatus(r.id, s2)}
                            disabled={busyId === r.id}
                            className="btn btn-outline"
                            style={{ padding: '.3rem .65rem', fontSize: '.72rem' }}
                          >
                            Mark {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
