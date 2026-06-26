import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerLines } from '../../components/ui/Shimmer';
import { dialog } from '../../lib/dialog';

// ─── /admin/bookings ────────────────────────────────────────────────────────
// Room-booking approval inbox. FIFO listing of requested bookings, plus
// tabs for confirmed / completed / cancelled history.

export default function BookingsAdminPage() {
  const { showToast } = useAuth();
  const [tab, setTab] = useState('requested');
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function loadCounts() {
    try {
      const r = await fetch('/api/admin/bookings/_meta/counts', { credentials: 'include' });
      const j = await r.json();
      if (r.ok) setCounts(j);
    } catch { /* silent */ }
  }

  async function load() {
    setRows(null);
    try {
      const r = await fetch(`/api/admin/bookings?status=${tab}&pageSize=100`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  }
  useEffect(() => { load(); loadCounts(); /* eslint-disable-next-line */ }, [tab]);

  async function act(id, action, label) {
    let body;
    if (action === 'cancel') {
      const reason = await dialog.prompt({
        title: 'Cancel booking',
        message: 'Reason for cancellation?',
        placeholder: 'Reason (visible in audit log)',
        confirmText: 'Cancel booking',
        cancelText: 'Back',
      });
      if (reason === null) return;
      body = JSON.stringify({ reason });
    }
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/bookings/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(`Booking ${label}`, 'success');
      load(); loadCounts();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <AdminLayout
      title="Room bookings"
      subtitle="FIFO approval queue + booking history"
    >
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {[
          ['requested', 'Requested', counts.requested],
          ['confirmed', 'Confirmed', counts.confirmed],
          ['completed', 'Completed', counts.completed],
          ['cancelled', 'Cancelled', counts.cancelled],
        ].map(([k, label, n]) => (
          <button key={k} className="btn btn-ghost"
            style={{
              borderBottom: tab === k ? '2px solid #0f172a' : '2px solid transparent',
              fontWeight: tab === k ? 600 : 400,
            }}
            onClick={() => setTab(k)}>
            {label} {n != null && <span className="muted-text">· {n}</span>}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Room</th>
              <th style={th}>Requested by</th>
              <th style={th}>Slot</th>
              <th style={th}>Purpose</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}><td colSpan={5} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No {tab} bookings.
              </td></tr>
            )}
            {rows && rows.map((b) => (
              <tr key={b.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}>
                  <strong>{b.room_name || '—'}</strong>
                </td>
                <td style={td}>
                  <div>{b.user_name || '—'}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>{b.user_email}</div>
                </td>
                <td style={td}>
                  <div>{formatDate(b.slot_start)}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>
                    {formatTime(b.slot_start)} – {formatTime(b.slot_end)} · {durationHours(b.slot_start, b.slot_end)}h
                  </div>
                </td>
                <td style={{ ...td, maxWidth: 280, whiteSpace: 'pre-wrap' }}>{b.purpose || '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {tab === 'requested' && (
                    <>
                      <button className="btn btn-primary" style={btnSm} disabled={busyId === b.id} onClick={() => act(b.id, 'confirm', 'confirmed')}>Confirm</button>
                      <button className="btn btn-ghost" style={{ ...btnSm, color: '#dc2626' }} disabled={busyId === b.id} onClick={() => act(b.id, 'cancel', 'cancelled')}>Reject</button>
                    </>
                  )}
                  {tab === 'confirmed' && (
                    <>
                      <button className="btn btn-ghost" style={btnSm} disabled={busyId === b.id} onClick={() => act(b.id, 'complete', 'completed')}>Mark complete</button>
                      <button className="btn btn-ghost" style={{ ...btnSm, color: '#dc2626' }} disabled={busyId === b.id} onClick={() => act(b.id, 'cancel', 'cancelled')}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(d); }
}
function formatTime(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function durationHours(a, b) {
  const ms = new Date(b) - new Date(a);
  return (ms / 3600000).toFixed(1);
}

const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
const btnSm = { padding: '.25rem .5rem', fontSize: '.75rem' };
