import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerLines } from '../../components/ui/Shimmer';
import { IconX } from '../../icons';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

// ─── /admin/cabf ────────────────────────────────────────────────────────────
// CABF (CA Benevolent Fund) assistance request inbox + monthly CSV export
// for the chairman.

const STATUSES = [
  { key: 'submitted', label: 'New' },
  { key: 'reviewing', label: 'Under review' },
  { key: 'approved', label: 'Approved' },
  { key: 'disbursed', label: 'Disbursed' },
  { key: 'rejected', label: 'Rejected' },
];

export default function CabfAdminPage() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('submitted');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  async function load() {
    setRows(null);
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    qs.set('pageSize', '100');
    try {
      const r = await fetch(`/api/admin/cabf?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function exportCsv() {
    const now = new Date();
    const year = await dialog.prompt({
      title: 'Export monthly CSV',
      message: 'Year (YYYY)?',
      defaultValue: String(now.getFullYear()),
      placeholder: 'e.g. 2026',
      confirmText: 'Next',
    });
    if (!year) return;
    const month = await dialog.prompt({
      title: 'Export monthly CSV',
      message: 'Month (1–12)?',
      defaultValue: String(now.getMonth() + 1),
      placeholder: 'e.g. 6',
      confirmText: 'Download',
    });
    if (!month) return;
    window.location.href = `/api/admin/cabf/export.csv?year=${year}&month=${month}`;
  }

  return (
    <AdminLayout
      title="CABF requests"
      subtitle="Review benevolent fund assistance requests and download the monthly chairman report"
      actions={<button className="btn btn-ghost" onClick={exportCsv}>Download monthly CSV</button>}
    >
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s.key} className="btn btn-ghost"
            style={{ borderBottom: status === s.key ? '2px solid #0f172a' : '2px solid transparent', fontWeight: status === s.key ? 600 : 400 }}
            onClick={() => setStatus(s.key)}>{s.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <input className="input-base" placeholder="Search member name/email…" style={{ maxWidth: 240 }}
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Member</th>
              <th style={th}>PAN</th>
              <th style={th}>Category</th>
              <th style={th}>Requested</th>
              <th style={th}>Disbursed</th>
              <th style={th}>Submitted</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}><td colSpan={7} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No requests in this state.
              </td></tr>
            )}
            {rows && rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{r.member_name || '—'}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>
                    {r.member_email}{r.member_mrn ? ` · MRN ${r.member_mrn}` : ''}
                  </div>
                </td>
                <td style={td}>
                  {r.member_pan || <span className="muted-text">Not on file</span>}
                </td>
                <td style={td}>{r.category}</td>
                <td style={td}>₹{(r.amount_requested_paise / 100).toLocaleString('en-IN')}</td>
                <td style={td}>
                  {r.disbursed_amount_paise != null
                    ? `₹${(r.disbursed_amount_paise / 100).toLocaleString('en-IN')}`
                    : <span className="muted-text">—</span>}
                </td>
                <td style={td}>{formatDate(r.created_at)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={btnSm} onClick={() => setEditing(r)}>Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ReviewModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </AdminLayout>
  );
}

function ReviewModal({ row, onClose, onSaved }) {
  const { showToast } = useAuth();
  const [status, setStatus] = useState(row.status);
  const [note, setNote] = useState(row.decision_note || '');
  const [disbursed, setDisbursed] = useState(
    row.disbursed_amount_paise != null ? (row.disbursed_amount_paise / 100) : (row.amount_requested_paise / 100)
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const body = {
        status,
        decision_note: note || null,
      };
      if (status === 'disbursed') {
        body.disbursed_amount_paise = Math.round(Number(disbursed) * 100);
      }
      const r = await fetch(`/api/admin/cabf/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(`Status updated to ${status}`, 'success');
      onSaved();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
         onClick={onClose}
         role="dialog" aria-modal="true" aria-labelledby="cabf-review-title">
      <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', width: 'min(560px, 95vw)', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="cabf-review-title" style={{ margin: 0, fontSize: '1.25rem' }}>Review CABF request</h2>
          <button className="btn btn-ghost" style={{ padding: '.25rem' }} onClick={onClose} aria-label="Close dialog"><IconX /></button>
        </div>

        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: '#f8fafc' }}>
          <div style={{ fontWeight: 500 }}>{row.member_name}</div>
          <div className="muted-text" style={{ fontSize: '.875rem' }}>{row.member_email}</div>
          <div style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
            <strong>Category:</strong> {row.category}<br />
            <strong>Amount requested:</strong> ₹{(row.amount_requested_paise / 100).toLocaleString('en-IN')}<br />
            <strong>PAN on file:</strong> {row.member_pan || <span className="muted-text">none — request via grievance form</span>}
          </div>
        </div>

        <label style={fieldLbl}>Status</label>
        <select className="input-base" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        {status === 'disbursed' && (
          <>
            <label style={{ ...fieldLbl, marginTop: '.75rem' }}>Amount disbursed (₹)</label>
            <input className="input-base" type="number" min="0" value={disbursed}
              onChange={(e) => setDisbursed(e.target.value)} />
            <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
              The 80G receipt is mailed by ICAI HO directly to the member. No certificate is issued from this portal.
            </p>
          </>
        )}

        <label style={{ ...fieldLbl, marginTop: '.75rem' }}>Decision note</label>
        <textarea className="input-base" rows="3" value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="Internal note — visible to admin only" />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <Button className="btn btn-primary" onClick={save} loading={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
}

const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
const btnSm = { padding: '.25rem .5rem', fontSize: '.75rem' };
const fieldLbl = { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.05em' };
