import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute } from '../hooks/useRoute';
import {
  IconUsers, IconCheck, IconCheckCircle, IconClock, IconArrowRight,
} from '../icons';

const ROOMS = [
  { id: 'reading-room', name: 'Reading Room', capacity: 80, blurb: 'Quiet study space with individual desks, Wi-Fi and reference material.', amenities: ['Wi-Fi', 'Air-conditioned', 'Power sockets', 'Reference desk'] },
  { id: 'seminar-hall', name: 'Seminar Hall', capacity: 40, blurb: 'Flexible room for workshops, study circles and committee meetings.', amenities: ['Projector', 'Whiteboard', 'Wi-Fi', 'Air-conditioned'] },
  { id: 'discussion-pod', name: 'Discussion Pod', capacity: 8, blurb: 'Compact room for small-group articleship discussions and interviews.', amenities: ['Wi-Fi', 'Whiteboard', 'Air-conditioned'] },
];

const SLOTS = ['10:00 – 12:00', '12:00 – 14:00', '14:00 – 16:00', '16:00 – 18:00'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATES = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return d;
});

// Deterministic mock availability — reads as "live" but is static.
function slotStatus(roomId, dateIdx, slotIdx) {
  const seed = [...roomId].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (seed + dateIdx * 5 + slotIdx * 3) % 4 === 0 ? 'booked' : 'available';
}

export default function RoomBookingPage() {
  const route = useRoute();
  const initialRoom = ROOMS.find((r) => r.id === route.query.room)?.id || 'reading-room';

  const [roomId, setRoomId] = useState(initialRoom);
  const [dateIdx, setDateIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', purpose: '' });
  const [confirmed, setConfirmed] = useState(null);

  const room = ROOMS.find((r) => r.id === roomId);
  const date = DATES[dateIdx];
  const dateLabel = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const availableCount = SLOTS.filter((_, i) => slotStatus(roomId, dateIdx, i) === 'available').length;
  const canConfirm = slotIdx !== null && form.name.trim() && form.email.trim();

  const onSelectRoom = (id) => { setRoomId(id); setSlotIdx(null); };
  const onSelectDate = (i) => { setDateIdx(i); setSlotIdx(null); };

  const onConfirm = (e) => {
    e.preventDefault();
    if (!canConfirm) return;
    setConfirmed({
      room: room.name,
      date: dateLabel,
      slot: SLOTS[slotIdx],
      name: form.name,
      ref: 'NB-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    });
  };

  const reset = () => {
    setConfirmed(null);
    setSlotIdx(null);
    setForm({ name: '', email: '', purpose: '' });
  };

  return (
    <>
      <PageHeader title="Room Booking" subtitle="Reserve a room at ICAI Bhawan, Nagpur" />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        <div className="room-booking-grid">
          {/* ── Main column ── */}
          <div>
            {/* Step 1 — room */}
            <div className="tiny-eyebrow">Step 1 · Choose a room</div>
            <div className="room-grid" style={{ marginTop: '.75rem', marginBottom: '2rem' }}>
              {ROOMS.map((r) => {
                const active = r.id === roomId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectRoom(r.id)}
                    className={'room-card' + (active ? ' is-active' : '')}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                      {active && <span className="room-card-check"><IconCheck size="sm" /></span>}
                    </div>
                    <div className="row gap-1 muted-text" style={{ fontSize: '.8125rem', marginTop: '.3rem' }}>
                      <IconUsers size="sm" /> {r.capacity} seats
                    </div>
                    <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.5rem', lineHeight: 1.5 }}>{r.blurb}</p>
                    <div className="room-amenities">
                      {r.amenities.map((a) => <span key={a} className="room-amenity">{a}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Step 2 — date */}
            <div className="tiny-eyebrow">Step 2 · Pick a date</div>
            <div className="row gap-2" style={{ marginTop: '.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              {DATES.map((d, i) => {
                const active = i === dateIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectDate(i)}
                    className={'date-chip' + (active ? ' is-active' : '')}
                  >
                    <span style={{ fontSize: '.6875rem', fontWeight: 700, opacity: .8 }}>
                      {i === 0 ? 'TODAY' : WEEKDAYS[d.getDay()].toUpperCase()}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{d.getDate()}</span>
                    <span style={{ fontSize: '.6875rem', opacity: .8 }}>{MONTHS[d.getMonth()]}</span>
                  </button>
                );
              })}
            </div>

            {/* Step 3 — live availability */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '.5rem' }}>
              <div className="tiny-eyebrow">Step 3 · Available time slots</div>
              <div className="row gap-3" style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>
                <span className="row gap-1"><span className="avail-dot avail-free" /> Available</span>
                <span className="row gap-1"><span className="avail-dot avail-booked" /> Booked</span>
              </div>
            </div>
            <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.4rem' }}>
              {room.name} · {dateLabel} ·{' '}
              <strong style={{ color: 'var(--secondary)' }}>{availableCount} of {SLOTS.length} slots free</strong>
            </div>
            <div className="slot-grid" style={{ marginTop: '.85rem' }}>
              {SLOTS.map((s, i) => {
                const booked = slotStatus(roomId, dateIdx, i) === 'booked';
                const active = i === slotIdx;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={booked}
                    onClick={() => setSlotIdx(i)}
                    className={'slot-chip' + (booked ? ' is-booked' : '') + (active ? ' is-active' : '')}
                  >
                    <IconClock size="sm" />
                    <span style={{ fontWeight: 700 }}>{s}</span>
                    <span style={{ fontSize: '.6875rem' }}>{booked ? 'Booked' : 'Available'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Sidebar — summary / form ── */}
          <aside>
            <div className="card booking-summary">
              {confirmed ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="booking-success-icon"><IconCheckCircle size="lg" /></div>
                  <h3 style={{ marginTop: '.75rem', fontSize: '1.125rem', fontWeight: 700 }}>Booking confirmed</h3>
                  <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.35rem' }}>
                    A confirmation has been sent to {confirmed.name}.
                  </p>
                  <div style={{ marginTop: '1rem', textAlign: 'left', fontSize: '.875rem', display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Room</span><strong>{confirmed.room}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Date</span><strong>{confirmed.date}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Time</span><strong>{confirmed.slot}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Reference</span><strong>{confirmed.ref}</strong></div>
                  </div>
                  <button className="btn btn-outline" style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center' }} onClick={reset}>
                    Book another room
                  </button>
                </div>
              ) : (
                <form onSubmit={onConfirm}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Booking summary</h3>
                  <div style={{ marginTop: '.75rem', display: 'flex', flexDirection: 'column', gap: '.45rem', fontSize: '.875rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Room</span><strong>{room.name}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Date</span><strong>{dateLabel}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted-text">Time</span>
                      <strong style={{ color: slotIdx === null ? 'var(--muted-foreground)' : 'inherit' }}>
                        {slotIdx === null ? 'Select a slot' : SLOTS[slotIdx]}
                      </strong>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
                  <label className="field-label">Full name</label>
                  <input className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                  <label className="field-label" style={{ marginTop: '.75rem' }}>Email</label>
                  <input className="input-base" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                  <label className="field-label" style={{ marginTop: '.75rem' }}>Purpose (optional)</label>
                  <input className="input-base" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Study circle meeting" />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canConfirm}
                    style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center', opacity: canConfirm ? 1 : .55 }}
                  >
                    Confirm Booking <IconArrowRight size="sm" />
                  </button>
                  <p className="muted-text" style={{ fontSize: '.6875rem', marginTop: '.6rem', textAlign: 'center' }}>
                    Demo booking — no real reservation is made.
                  </p>
                </form>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
