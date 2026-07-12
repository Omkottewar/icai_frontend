import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { dialog } from '../../lib/dialog';

// ─── /admin/reading-room ────────────────────────────────────────────────────
// Two tabs:
//   • Deposits — verify UTRs, reject, refund, delete
//   • Roster   — month view of who's booked; also downloadable as CSV

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

export default function ReadingRoomAdminPage() {
  const { showToast } = useAuth();
  const [tab, setTab] = useState('rooms');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetch('/api/admin/reading-room/summary', { credentials: 'include' })
      .then((r) => r.json()).then(setSummary).catch(() => {});
  }, []);

  return (
    <AdminLayout title="Reading Room" subtitle="Monthly-pass enrolment and roster">
      {summary && (
        <div style={{
          display: 'grid', gap: '.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          marginBottom: '1.25rem',
        }}>
          <SummaryTile label={`${summary.room_count ?? 0} rooms`} value={`${summary.capacity} seats`} />
          <SummaryTile label="Pending deposits" value={summary.pending_deposits} highlight={summary.pending_deposits > 0} />
          <SummaryTile label="Verified students" value={summary.verified_students} />
          <SummaryTile
            label={`${MONTH_NAMES[summary.current_month.month - 1]} ${summary.current_month.year}`}
            value={`${summary.current_month.booked} / ${summary.capacity}`}
          />
          <SummaryTile
            label={`${MONTH_NAMES[summary.next_month.month - 1]} ${summary.next_month.year}`}
            value={`${summary.next_month.booked} / ${summary.capacity}`}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        <TabButton active={tab === 'rooms'}    onClick={() => setTab('rooms')}>Rooms</TabButton>
        <TabButton active={tab === 'deposits'} onClick={() => setTab('deposits')}>Deposits</TabButton>
        <TabButton active={tab === 'roster'}   onClick={() => setTab('roster')}>Monthly roster</TabButton>
      </div>

      {tab === 'rooms' ? (
        <RoomsPanel showToast={showToast} />
      ) : tab === 'deposits' ? (
        <DepositsPanel showToast={showToast} onChange={() => {
          fetch('/api/admin/reading-room/summary', { credentials: 'include' })
            .then((r) => r.json()).then(setSummary).catch(() => {});
        }} />
      ) : (
        <RosterPanel showToast={showToast} />
      )}
    </AdminLayout>
  );
}

function SummaryTile({ label, value, highlight }) {
  return (
    <div className="card" style={{ padding: '.85rem 1rem' }}>
      <div style={{ fontSize: '.72rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{
        fontSize: '1.1rem', fontWeight: 700, marginTop: '.25rem',
        color: highlight ? 'var(--destructive)' : 'var(--foreground)',
      }}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick} className="btn btn-ghost"
      style={{
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        borderRadius: 0, padding: '.5rem .9rem', fontWeight: 600,
        color: active ? 'var(--primary)' : 'var(--foreground)',
      }}
    >{children}</button>
  );
}

// ─── Deposits tab ──────────────────────────────────────────────────────────
function DepositsPanel({ showToast, onChange }) {
  const [status, setStatus] = useState('pending_verification');
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setRows(null);
    try {
      const r = await fetch(`/api/admin/reading-room/deposits?status=${status}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Failed');
      setRows(j.rows);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function act(id, action, opts = {}) {
    setBusyId(id);
    try {
      let body;
      const headers = { 'Content-Type': 'application/json' };
      if (action === 'reject') {
        const reason = await dialog.prompt({
          title: 'Reject deposit',
          message: 'Reason for rejection (shown to the student)?',
          confirmText: 'Reject',
          cancelText: 'Back',
        });
        if (!reason) { setBusyId(null); return; }
        body = JSON.stringify({ reason });
      } else if (action === 'refund') {
        const note = await dialog.prompt({
          title: 'Refund deposit',
          message: 'Optional note (mode, ref no. — kept in audit log)',
          placeholder: 'e.g. NEFT 42314 on 2026-07-12',
          confirmText: 'Mark refunded',
          cancelText: 'Back',
        });
        if (note === null) { setBusyId(null); return; }
        body = JSON.stringify({ note });
      } else if (action === 'delete') {
        if (!window.confirm('Hard-delete this deposit row? Any future bookings by this student will be cancelled. This cannot be undone.')) {
          setBusyId(null); return;
        }
      }
      const r = await fetch(`/api/admin/reading-room/deposits/${id}/${action === 'delete' ? '' : action}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: body ? headers : undefined,
        body,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || 'Failed');
      showToast?.(`Deposit ${action}${action === 'delete' ? 'd' : 'ed'}`, 'success');
      await load();
      onChange?.();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          ['pending_verification', 'Pending'],
          ['verified',             'Verified'],
          ['rejected',             'Rejected'],
          ['refunded',             'Refunded'],
        ].map(([k, label]) => (
          <button key={k} className="btn btn-ghost"
            style={{
              background: status === k ? 'var(--muted)' : 'transparent',
              fontWeight: status === k ? 700 : 500,
            }}
            onClick={() => setStatus(k)}
          >{label}</button>
        ))}
      </div>

      {rows === null ? (
        <p className="muted-text">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted-text">No deposits in this bucket.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '.6rem .5rem' }}>Student</th>
                <th style={{ padding: '.6rem .5rem' }}>Amount</th>
                <th style={{ padding: '.6rem .5rem' }}>UTR</th>
                <th style={{ padding: '.6rem .5rem' }}>Submitted</th>
                <th style={{ padding: '.6rem .5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.55rem .5rem' }}>
                    <div style={{ fontWeight: 600 }}>{d.user_name || '—'}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>{d.user_email}</div>
                  </td>
                  <td style={{ padding: '.55rem .5rem' }}>{rupees(d.amount_paise)}</td>
                  <td style={{ padding: '.55rem .5rem', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.85rem' }}>
                    {d.utr || <span className="muted-text">—</span>}
                  </td>
                  <td style={{ padding: '.55rem .5rem', fontSize: '.85rem' }}>
                    {d.submitted_at ? new Date(d.submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '.55rem .5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {d.status === 'pending_verification' && (
                        <>
                          <button className="btn btn-primary" disabled={busyId === d.id} onClick={() => act(d.id, 'verify')}>Verify</button>
                          <button className="btn btn-ghost" disabled={busyId === d.id} onClick={() => act(d.id, 'reject')}>Reject</button>
                        </>
                      )}
                      {d.status === 'verified' && (
                        <button className="btn btn-ghost" disabled={busyId === d.id} onClick={() => act(d.id, 'refund')}>Refund</button>
                      )}
                      {(d.status === 'rejected' || d.status === 'refunded') && (
                        <button className="btn btn-ghost" disabled={busyId === d.id} style={{ color: 'var(--destructive)' }} onClick={() => act(d.id, 'delete')}>Delete</button>
                      )}
                    </div>
                    {d.rejection_reason && <div style={{ fontSize: '.72rem', color: 'var(--destructive)', marginTop: '.15rem', textAlign: 'right' }}>{d.rejection_reason}</div>}
                    {d.refund_note && <div style={{ fontSize: '.72rem', color: 'var(--muted-foreground)', marginTop: '.15rem', textAlign: 'right' }}>{d.refund_note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Rooms tab ─────────────────────────────────────────────────────────────
function RoomsPanel({ showToast }) {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null); // { room? } or null (closed)

  const load = async () => {
    setRows(null);
    try {
      const r = await fetch('/api/admin/reading-room/rooms', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Failed');
      setRows(j.rows);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function del(id) {
    if (!window.confirm('Delete this room? Only rooms with zero historical bookings can be deleted.')) return;
    try {
      const r = await fetch(`/api/admin/reading-room/rooms/${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Failed');
      showToast?.('Room deleted', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
        <span className="muted-text" style={{ fontSize: '.85rem' }}>
          Each room has its own capacity. Students pick a room when they book — deposit still gates entry.
        </span>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add room</button>
      </div>

      {rows === null ? (
        <p className="muted-text">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted-text">No rooms yet. Add one to open bookings.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '.6rem .5rem', width: '3rem' }}>#</th>
                <th style={{ padding: '.6rem .5rem' }}>Name</th>
                <th style={{ padding: '.6rem .5rem' }}>Location</th>
                <th style={{ padding: '.6rem .5rem', textAlign: 'right' }}>Capacity</th>
                <th style={{ padding: '.6rem .5rem' }}>Status</th>
                <th style={{ padding: '.6rem .5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', opacity: r.active ? 1 : 0.6 }}>
                  <td style={{ padding: '.55rem .5rem', color: 'var(--muted-foreground)' }}>{r.sort_order}</td>
                  <td style={{ padding: '.55rem .5rem' }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    {r.description && (
                      <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>{r.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '.55rem .5rem', fontSize: '.85rem' }}>{r.location || <span className="muted-text">—</span>}</td>
                  <td style={{ padding: '.55rem .5rem', textAlign: 'right' }}>{r.capacity}</td>
                  <td style={{ padding: '.55rem .5rem', fontSize: '.85rem' }}>
                    {r.active
                      ? <span style={{ color: 'oklch(0.35 0.15 145)' }}>Active</span>
                      : <span className="muted-text">Inactive</span>}
                  </td>
                  <td style={{ padding: '.55rem .5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '.35rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => setEditing({ room: r })}>Edit</button>
                      <button className="btn btn-ghost" style={{ color: 'var(--destructive)' }} onClick={() => del(r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RoomEditor
          room={editing.room}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          showToast={showToast}
        />
      )}
    </>
  );
}

function RoomEditor({ room, onClose, onSaved, showToast }) {
  const isNew = !room;
  const [form, setForm] = useState({
    name:        room?.name        ?? '',
    description: room?.description ?? '',
    location:    room?.location    ?? '',
    capacity:    room?.capacity    ?? 40,
    active:      room?.active      ?? true,
    sort_order:  room?.sort_order  ?? 0,
  });
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const url = isNew ? '/api/admin/reading-room/rooms' : `/api/admin/reading-room/rooms/${room.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, capacity: Number(form.capacity), sort_order: Number(form.sort_order) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Save failed');
      showToast?.(isNew ? 'Room created' : 'Room updated', 'success');
      onSaved?.();
    } catch (err) { showToast?.(err.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}
    >
      <form
        onSubmit={save} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', color: 'var(--foreground)', borderRadius: '.75rem', width: '100%', maxWidth: '32rem', padding: '1.5rem' }}
      >
        <h3 style={{ marginTop: 0 }}>{isNew ? 'Add room' : `Edit — ${room.name}`}</h3>

        <label style={{ display: 'block', marginBottom: '.75rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>Name</div>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle} placeholder="e.g. Main Reading Room" />
        </label>

        <label style={{ display: 'block', marginBottom: '.75rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>Description (optional)</div>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }} placeholder="Silence enforced · air-conditioned · WiFi" />
        </label>

        <label style={{ display: 'block', marginBottom: '.75rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>Location (optional)</div>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            style={inputStyle} placeholder="ICAI Bhawan · Ground floor" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '.75rem' }}>
          <label>
            <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>Capacity</div>
            <input required type="number" min={1} value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              style={inputStyle} />
          </label>
          <label>
            <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.3rem' }}>Sort order</div>
            <input type="number" value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              style={inputStyle} />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span>Active — students can book this room</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{isNew ? 'Create room' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '.5rem .7rem', border: '1px solid var(--border)',
  borderRadius: '.35rem', background: 'var(--background)', color: 'var(--foreground)',
  fontSize: '.9rem',
};

// ─── Roster tab ────────────────────────────────────────────────────────────
function RosterPanel({ showToast }) {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms]   = useState([]);
  const [data, setData]     = useState(null);

  useEffect(() => {
    fetch('/api/admin/reading-room/rooms', { credentials: 'include' })
      .then((r) => r.json()).then((j) => setRooms(j.rows || [])).catch(() => {});
  }, []);

  const load = async () => {
    setData(null);
    try {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (roomId) qs.set('room_id', roomId);
      const r = await fetch(`/api/admin/reading-room/roster?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Failed');
      setData(j);
    } catch (e) { showToast?.(e.message, 'error'); setData({ rows: [], count: 0 }); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month, roomId]);

  const downloadCsv = () => {
    if (!data || !data.rows.length) return;
    const header = ['Name', 'Email', 'Room', 'Booked on'];
    const lines = [header.join(',')].concat(
      data.rows.map((r) => [
        (r.user_name || '').replace(/,/g, ' '),
        (r.user_email || '').replace(/,/g, ' '),
        (r.room_name || '').replace(/,/g, ' '),
        new Date(r.created_at).toISOString(),
      ].join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-room-roster-${year}-${String(month).padStart(2, '0')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '.4rem .55rem', border: '1px solid var(--border)', borderRadius: '.35rem' }}>
          {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '.4rem .55rem', border: '1px solid var(--border)', borderRadius: '.35rem' }}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ padding: '.4rem .55rem', border: '1px solid var(--border)', borderRadius: '.35rem' }}>
          <option value="">All rooms</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={downloadCsv} disabled={!data?.rows?.length}>Download CSV</button>
        {data && (
          <span className="muted-text" style={{ marginLeft: 'auto' }}>
            {data.count} / {data.capacity} seats booked
          </span>
        )}
      </div>

      {data === null ? (
        <p className="muted-text">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="muted-text">No bookings for this month yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '.6rem .5rem', width: '3rem' }}>#</th>
                <th style={{ padding: '.6rem .5rem' }}>Student</th>
                <th style={{ padding: '.6rem .5rem' }}>Email</th>
                <th style={{ padding: '.6rem .5rem' }}>Room</th>
                <th style={{ padding: '.6rem .5rem' }}>Booked at</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.55rem .5rem', color: 'var(--muted-foreground)' }}>{i + 1}</td>
                  <td style={{ padding: '.55rem .5rem', fontWeight: 600 }}>{r.user_name || '—'}</td>
                  <td style={{ padding: '.55rem .5rem' }}>{r.user_email}</td>
                  <td style={{ padding: '.55rem .5rem', fontSize: '.85rem' }}>{r.room_name || <span className="muted-text">—</span>}</td>
                  <td style={{ padding: '.55rem .5rem', fontSize: '.85rem' }}>
                    {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
