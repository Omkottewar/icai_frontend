import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useRoute, navigate } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import { cachedGet, invalidate } from '../lib/apiCache';
import {
  IconUsers, IconCheck, IconCheckCircle, IconClock, IconArrowRight, IconMapPin,
} from '../icons';
import Button from '../components/ui/Button';

// Fixed 2-hour slots — keeps the booking surface predictable. The backend
// stores explicit start/end timestamps so we can switch to an admin-defined
// slot table later without breaking historical bookings.
const SLOTS = [
  { label: '10:00 – 12:00', startH: 10, endH: 12 },
  { label: '12:00 – 14:00', startH: 12, endH: 14 },
  { label: '14:00 – 16:00', startH: 14, endH: 16 },
  { label: '16:00 – 18:00', startH: 16, endH: 18 },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Date strip — today + next 6 days. Booking can happen up to a week out.
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return d;
});

// YYYY-MM-DD in the local zone (the API normalises to UTC; we don't want
// timezone drift on the picker).
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Build a full ISO timestamp from a date + hour-of-day. Treated as the
// user's local zone — the backend stores UTC, ranges still match.
function isoAt(date, hour) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// Two intervals [aStart,aEnd) and [bStart,bEnd) overlap iff
// aStart < bEnd AND bStart < aEnd. The backend's EXCLUDE constraint enforces
// this server-side; we also check client-side so we can disable booked slots
// in the UI before the user clicks.
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export default function RoomBookingPage() {
  const route = useRoute();
  const { user } = useAuth();
  const header = useSiteContent('room_booking_page_header');

  const [rooms, setRooms] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [dateIdx, setDateIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [availability, setAvailability] = useState([]);   // bookings on the selected day
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);       // booking row after success
  const [error, setError] = useState('');

  // Load the room list once on mount. Rooms are admin-managed and rarely
  // change — 5min TTL is fine; if an admin edits a room, invalidate
  // explicitly from the admin save handler.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await cachedGet('/api/rooms', undefined, 300_000);
        if (cancelled) return;
        setRooms(j.rows);
        const preferred = j.rows.find((r2) => r2.id === route.query?.room || r2.name === route.query?.room);
        setRoomId(preferred?.id ?? j.rows[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) { setError(e.message); setRooms([]); }
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Whenever room or date changes, refetch availability for that day.
  // Short TTL (15s) so a successful booking by another user shows up
  // when the picker is reopened. We also invalidate after our own POST.
  useEffect(() => {
    if (!roomId) { setAvailability([]); return; }
    setLoadingAvail(true);
    setSlotIdx(null);
    let cancelled = false;
    (async () => {
      try {
        const date = ymd(DATES[dateIdx]);
        const j = await cachedGet(`/api/rooms/${roomId}/availability?date=${date}`, undefined, 15_000);
        if (cancelled) return;
        setAvailability(j.bookings ?? []);
      } catch (e) {
        if (!cancelled) { setError(e.message); setAvailability([]); }
      } finally {
        if (!cancelled) setLoadingAvail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, dateIdx]);

  const room = useMemo(() => rooms?.find((r) => r.id === roomId) ?? null, [rooms, roomId]);
  const date = DATES[dateIdx];
  const dateLabel = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

  // Compute per-slot status from the bookings we got back.
  const slotIsBooked = (slot) => {
    const start = new Date(isoAt(date, slot.startH));
    const end   = new Date(isoAt(date, slot.endH));
    return availability.some((b) => overlaps(start, end, new Date(b.slot_start), new Date(b.slot_end)));
  };

  // Also disable slots that have already started today (no past bookings).
  const slotIsPast = (slot) => {
    if (dateIdx > 0) return false;
    return new Date().getHours() >= slot.endH;
  };

  const freeCount = SLOTS.filter((s) => !slotIsBooked(s) && !slotIsPast(s)).length;
  const canConfirm = !!user && slotIdx !== null && !!room && !submitting;

  async function submit(e) {
    e?.preventDefault?.();
    if (!canConfirm) return;
    setError('');
    setSubmitting(true);
    try {
      const slot = SLOTS[slotIdx];
      const r = await fetch(`/api/rooms/${roomId}/book`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_start: isoAt(date, slot.startH),
          slot_end:   isoAt(date, slot.endH),
          purpose: purpose || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Booking failed');
      // Bust the availability cache for this room so anyone who reopens
      // the picker sees the new slot as taken.
      invalidate(`/api/rooms/${roomId}/availability`);
      setConfirmed({
        room: j.room.name,
        date: dateLabel,
        slot: slot.label,
        status: j.booking.status,
        id: j.booking.id,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setConfirmed(null);
    setSlotIdx(null);
    setPurpose('');
    setError('');
  }

  // ────────────────────────────────────────────────────────────────────

  // Logged-out users hit a clear CTA instead of a non-functional form.
  if (!user) {
    return (
      <>
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <section className="container" style={{ padding: '2.5rem 1rem' }}>
          <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Please sign in to book a room</h2>
            <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.5rem' }}>
              Bookings are confirmed against your branch profile so we can contact you
              and apply the right fee category (member / student).
            </p>
            <button className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => navigate('/login?next=/book-room')}>
              Sign in to continue
            </button>
          </div>
        </section>
      </>
    );
  }

  if (rooms === null) {
    return (
      <>
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <section className="container" style={{ padding: '2.5rem 1rem' }}>
          <ShimmerLines count={8} />
        </section>
      </>
    );
  }

  if (rooms.length === 0) {
    return (
      <>
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <section className="container" style={{ padding: '2.5rem 1rem' }}>
          <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No rooms available yet</h2>
            <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.5rem' }}>
              The branch hasn't published any bookable rooms. Check back soon or contact the office.
            </p>
            <a href="/contact" className="btn btn-outline" style={{ marginTop: '1.25rem' }}>Open the contact form</a>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        <div className="room-booking-grid">
          {/* ── Main column ── */}
          <div>
            {/* Step 1 — room */}
            <div className="tiny-eyebrow">Step 1 · Choose a room</div>
            <div className="room-grid" style={{ marginTop: '.75rem', marginBottom: '2rem' }}>
              {rooms.map((r) => {
                const active = r.id === roomId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRoomId(r.id); setSlotIdx(null); }}
                    className={'room-card' + (active ? ' is-active' : '')}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                      {active && <span className="room-card-check"><IconCheck size="sm" /></span>}
                    </div>
                    <div className="row gap-3 muted-text" style={{ fontSize: '.8125rem', marginTop: '.3rem', flexWrap: 'wrap' }}>
                      {r.capacity != null && <span className="row gap-1"><IconUsers size="sm" /> {r.capacity} seats</span>}
                      {r.location && <span className="row gap-1"><IconMapPin size="sm" /> {r.location}</span>}
                    </div>
                    {r.fee_paise_per_hour > 0 && (
                      <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.5rem' }}>
                        ₹{(r.fee_paise_per_hour / 100).toLocaleString('en-IN')} / hour
                      </p>
                    )}
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
                    onClick={() => { setDateIdx(i); setSlotIdx(null); }}
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

            {/* Step 3 — slots */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '.5rem' }}>
              <div className="tiny-eyebrow">Step 3 · Pick a time slot</div>
              <div className="row gap-3" style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>
                <span className="row gap-1"><span className="avail-dot avail-free" /> Available</span>
                <span className="row gap-1"><span className="avail-dot avail-booked" /> Booked</span>
              </div>
            </div>
            <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.4rem' }}>
              {room?.name} · {dateLabel} ·{' '}
              {loadingAvail
                ? <Shimmer width="6rem" height=".85rem" />
                : <strong style={{ color: 'var(--secondary)' }}>{freeCount} of {SLOTS.length} slots free</strong>}
            </div>
            <div className="slot-grid" style={{ marginTop: '.85rem' }}>
              {SLOTS.map((s, i) => {
                const booked = slotIsBooked(s);
                const past   = slotIsPast(s);
                const disabled = booked || past;
                const active = i === slotIdx;
                return (
                  <button
                    key={s.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlotIdx(i)}
                    className={'slot-chip' + (disabled ? ' is-booked' : '') + (active ? ' is-active' : '')}
                    title={past ? 'This slot is in the past' : (booked ? 'Already booked' : undefined)}
                  >
                    <IconClock size="sm" />
                    <span style={{ fontWeight: 700 }}>{s.label}</span>
                    <span style={{ fontSize: '.6875rem' }}>
                      {past ? 'Past' : booked ? 'Booked' : 'Available'}
                    </span>
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
                  <h3 style={{ marginTop: '.75rem', fontSize: '1.125rem', fontWeight: 700 }}>Request submitted</h3>
                  <p className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.35rem' }}>
                    The branch will review and confirm your booking shortly. You can track its status from your dashboard.
                  </p>
                  <div style={{ marginTop: '1rem', textAlign: 'left', fontSize: '.875rem', display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Room</span><strong>{confirmed.room}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Date</span><strong>{confirmed.date}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Time</span><strong>{confirmed.slot}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Status</span><strong style={{ textTransform: 'capitalize' }}>{confirmed.status}</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem' }}>
                    <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={reset}>
                      Book another
                    </button>
                    <a href="/dashboard" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                      Open dashboard
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Booking summary</h3>
                  <div style={{ marginTop: '.75rem', display: 'flex', flexDirection: 'column', gap: '.45rem', fontSize: '.875rem' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Room</span><strong>{room?.name || '—'}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted-text">Date</span><strong>{dateLabel}</strong></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted-text">Time</span>
                      <strong style={{ color: slotIdx === null ? 'var(--muted-foreground)' : 'inherit' }}>
                        {slotIdx === null ? 'Select a slot' : SLOTS[slotIdx].label}
                      </strong>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
                  <label className="field-label" htmlFor="rb-purpose">Purpose (optional)</label>
                  <input
                    id="rb-purpose"
                    className="input-base"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Study circle meeting"
                    maxLength={200}
                  />
                  {error && (
                    <p style={{ color: 'var(--destructive)', fontSize: '.8125rem', marginTop: '.5rem' }}>{error}</p>
                  )}
                  <Button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canConfirm}
                    loading={submitting}
                    style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center', opacity: canConfirm ? 1 : .55 }}
                  >
                    {submitting ? 'Submitting…' : 'Request Booking'} {!submitting && <IconArrowRight size="sm" />}
                  </Button>
                  <p className="muted-text" style={{ fontSize: '.6875rem', marginTop: '.6rem', textAlign: 'center', lineHeight: 1.45 }}>
                    A ₹500 refundable deposit is collected after the branch confirms your booking.
                    Bookings auto-cancel if absent for more than 7 days.
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
