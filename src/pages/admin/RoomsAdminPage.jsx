import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerLines } from '../../components/ui/Shimmer';
import { IconX } from '../../icons';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

// ─── /admin/rooms ───────────────────────────────────────────────────────────
// Manage bookable spaces (seminar halls, reading room, boardroom). Edit
// metadata + hourly fee + active flag. Booking lifecycle lives in
// /admin/bookings.

export default function RoomsAdminPage() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | row (edit)

  async function load() {
    setRows(null);
    const qs = new URLSearchParams();
    if (filter === 'active')   qs.set('active', 'true');
    if (filter === 'inactive') qs.set('active', 'false');
    try {
      const r = await fetch(`/api/admin/rooms?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function remove(id) {
    const ok = await dialog.confirm({
      title: 'Delete room?',
      message: 'Delete this room? Only possible if no bookings reference it.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/admin/rooms/${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.('Room deleted', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  }

  return (
    <AdminLayout
      title="Rooms"
      subtitle="Bookable spaces — seminar halls, reading room, boardroom"
      actions={<button className="btn btn-primary" onClick={() => setEditing({})}>+ Add room</button>}
    >
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {[['', 'All'], ['active', 'Active'], ['inactive', 'Retired']].map(([k, label]) => (
          <button key={k || 'all'} className="btn btn-ghost"
            style={{ borderBottom: filter === k ? '2px solid #0f172a' : '2px solid transparent' }}
            onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Location</th>
              <th style={th}>Capacity</th>
              <th style={th}>Fee / hr</th>
              <th style={th}>Status</th>
              <th style={th}>Upcoming bookings</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={7} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No rooms yet. Click <strong>+ Add room</strong> to create one.
              </td></tr>
            )}
            {rows && rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}><strong>{r.name}</strong></td>
                <td style={td}>{r.location || '—'}</td>
                <td style={td}>{r.capacity ?? '—'}</td>
                <td style={td}>{r.fee_paise_per_hour > 0 ? `₹${(r.fee_paise_per_hour / 100).toLocaleString('en-IN')}` : 'Free'}</td>
                <td style={td}>
                  <span style={{
                    padding: '.125rem .5rem',
                    borderRadius: 999,
                    fontSize: '.75rem',
                    background: r.active ? '#dcfce7' : '#fee2e2',
                    color: r.active ? '#065f46' : '#991b1b',
                  }}>{r.active ? 'Active' : 'Retired'}</span>
                </td>
                <td style={td}>{r.upcoming_bookings}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={btnSm} onClick={() => setEditing(r)}>Edit</button>
                  <button className="btn btn-ghost" style={{ ...btnSm, color: '#dc2626' }} onClick={() => remove(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <RoomEditor
          room={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </AdminLayout>
  );
}

function RoomEditor({ room, onClose, onSaved }) {
  const { showToast } = useAuth();
  const [form, setForm] = useState(room ? {
    name: room.name,
    location: room.location || '',
    capacity: room.capacity ?? '',
    fee_paise_per_hour: room.fee_paise_per_hour,
    active: room.active,
  } : {
    name: '',
    location: '',
    capacity: '',
    fee_paise_per_hour: 0,
    active: true,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy || !form.name.trim()) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        location: form.location || null,
        capacity: form.capacity === '' ? null : Number(form.capacity),
        fee_paise_per_hour: Number(form.fee_paise_per_hour) || 0,
        active: !!form.active,
      };
      const url = room ? `/api/admin/rooms/${room.id}` : '/api/admin/rooms';
      const method = room ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(room ? 'Room updated' : 'Room created', 'success');
      onSaved();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }

  // Helper: render rupee input on top of the paise-stored value.
  const feeRupees = (form.fee_paise_per_hour || 0) / 100;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
         onClick={onClose}
         role="dialog" aria-modal="true" aria-labelledby="room-editor-title">
      <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', width: 'min(520px, 95vw)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="room-editor-title" style={{ margin: 0, fontSize: '1.25rem' }}>{room ? 'Edit room' : 'Add a room'}</h2>
          <button className="btn btn-ghost" style={{ padding: '.25rem' }} onClick={onClose} aria-label="Close dialog"><IconX /></button>
        </div>

        <label style={fieldLbl}>Name *</label>
        <input className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Conference Hall A" />

        <label style={{ ...fieldLbl, marginTop: '.75rem' }}>Location</label>
        <input className="input-base" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. ICAI Bhawan, 2nd floor" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: '.75rem' }}>
          <div>
            <label style={fieldLbl}>Capacity</label>
            <input className="input-base" type="number" min="0" value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Seats" />
          </div>
          <div>
            <label style={fieldLbl}>Fee per hour (₹)</label>
            <input className="input-base" type="number" min="0" value={feeRupees}
              onChange={(e) => setForm({ ...form, fee_paise_per_hour: Math.round(Number(e.target.value) * 100) })}
              placeholder="0 for free" />
          </div>
        </div>

        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.75rem', fontSize: '.875rem' }}>
          <input type="checkbox" checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span>Active <span className="muted-text">(visible for booking; uncheck to retire)</span></span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <Button className="btn btn-primary" onClick={save} disabled={!form.name.trim()} loading={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
const btnSm = { padding: '.25rem .5rem', fontSize: '.75rem' };
const fieldLbl = { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.05em' };
