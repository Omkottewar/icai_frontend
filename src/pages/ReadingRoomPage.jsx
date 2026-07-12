import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import Button from '../components/ui/Button';
import {
  IconCheck, IconClock, IconUsers, IconArrowRight, IconMapPin,
} from '../icons';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

// Feature gate — flip to `false` to bring back the full deposit + booking
// flow. Kept as a single-line switch so the rest of the page (state, deposit
// modal, cancel handlers, styles) stays intact and re-enabling is a one-line
// change instead of a re-implementation. Everything below the early-return
// is dead code while this is on.
const READING_ROOM_COMING_SOON = true;

// ─── /reading-room ─────────────────────────────────────────────────────────
// One-page flow: fetch status → render one of {sign-in, not-student,
// no-deposit, pending, verified}. Verified state shows the next-month
// booking card with a live capacity counter and a countdown to the 25th.
export default function ReadingRoomPage() {
  const { user } = useAuth();
  const copy = useSiteContent('reading_room_page');

  if (READING_ROOM_COMING_SOON) {
    return (
      <>
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <section className="container" style={{ padding: '4rem 1rem', maxWidth: '42rem' }}>
          <div style={{
            padding: '2.5rem 1.75rem',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '.75rem',
            textAlign: 'center',
            boxShadow: '0 6px 20px -12px rgba(15,23,42,.12)',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '.4rem',
              padding: '.35rem .8rem', marginBottom: '1rem',
              background: 'oklch(0.85 0.16 90 / 0.22)',
              color: 'oklch(0.35 0.14 65)',
              borderRadius: 999,
              fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em',
              textTransform: 'uppercase',
            }}>
              <IconClock size="sm" /> Coming soon
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              Reading room enrolment opens shortly
            </h2>
            <p className="muted-text" style={{ marginTop: '.75rem', fontSize: '.95rem', lineHeight: 1.55 }}>
              We're finalising the monthly pass system for the 40-seat reading room
              at ICAI Bhawan. Once open you'll be able to enrol with a refundable
              deposit and reserve your seat for the coming month right here.
            </p>
            <div className="row gap-2" style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <a href="/events" className="btn btn-primary" style={{ gap: '.4rem' }}>
                Browse events <IconArrowRight size="sm" />
              </a>
              <a href="/contact" className="btn btn-outline">Contact the branch</a>
            </div>
            <p className="muted-text" style={{ marginTop: '1.25rem', fontSize: '.75rem' }}>
              <IconMapPin size="sm" /> {copy.location_hint}
            </p>
          </div>
        </section>
      </>
    );
  }

  const [state, setState] = useState(null);   // full /status payload
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Which room card the user is actively confirming a booking on — used
  // to disable the other cards while the request is in flight.
  const [pendingRoomId, setPendingRoomId] = useState(null);

  // Deposit-modal state.
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState(null);       // { upi_uri, upi_id, upi_payee_name, note, deposit }
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [utr, setUtr] = useState('');

  const reload = async () => {
    setErr('');
    try {
      const r = await fetch('/api/reading-room/status', { credentials: 'include' });
      if (r.status === 401) { navigate('/login?next=' + encodeURIComponent('/reading-room')); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState(await r.json());
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { reload(); }, []);

  // ── Deposit → open UPI QR modal ─────────────────────────────────────────
  const startDeposit = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/reading-room/deposit/start', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Could not start deposit');
      setPay(j); setPayOpen(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  // Render QR whenever a fresh upi_uri lands.
  useEffect(() => {
    if (!pay?.upi_uri) { setQrDataUrl(''); return; }
    let cancelled = false;
    QRCode.toDataURL(pay.upi_uri, {
      width: 240, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#0b3d91', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pay?.upi_uri]);

  const submitUtr = async (e) => {
    e.preventDefault();
    setErr('');
    const cleaned = utr.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{6,40}$/.test(cleaned)) {
      setErr('UTR should be 6–40 alphanumeric characters — check your UPI app.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/reading-room/deposit/utr', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr: cleaned }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Could not submit UTR');
      setPayOpen(false); setUtr(''); await reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const book = async (roomId, year, month) => {
    setPendingRoomId(roomId); setErr('');
    try {
      const r = await fetch('/api/reading-room/book', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, year, month }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Could not book');
      await reload();
    } catch (e) { setErr(e.message); }
    setPendingRoomId(null);
  };

  const cancelBooking = async (bookingId) => {
    if (!bookingId) return;
    if (!window.confirm('Cancel this reading room booking? The seat is freed immediately.')) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/reading-room/cancel', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Could not cancel');
      await reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <section className="container" style={{ padding: '3rem 1rem', maxWidth: '42rem' }}>
          <p className="muted-text">Please sign in to enrol for the reading room.</p>
          <Button variant="primary" onClick={() => navigate('/login?next=' + encodeURIComponent('/reading-room'))}>
            Sign in
          </Button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <section className="container" style={{ padding: '2.5rem 1rem 4rem', maxWidth: '56rem' }}>
        {err && (
          <div style={{
            padding: '.75rem 1rem', border: '1px solid oklch(0.72 0.18 25)',
            background: 'oklch(0.97 0.05 25 / .3)', borderRadius: '.5rem',
            marginBottom: '1rem', fontSize: '.9rem',
          }}>
            <span aria-hidden="true">⚠</span> {err}
          </div>
        )}

        {state === null ? (
          <div className="muted-text">Loading…</div>
        ) : !state.is_student ? (
          <NotStudentCard copy={copy} />
        ) : (
          <>
            {/* Overview strip — only shown while the student is still on
                the deposit / pending / refunded steps. Once verified, the
                new status bar + room cards below give a much richer view
                of capacity and their booking. */}
            {state.deposit?.status !== 'verified' && (
              <OverviewStrip state={state} copy={copy} />
            )}

            {/* Main state card */}
            {(() => {
              const dep = state.deposit;
              if (!dep || dep.status === 'rejected') {
                return <NeedDepositCard dep={dep} state={state} copy={copy} onPay={startDeposit} busy={busy} />;
              }
              if (dep.status === 'pending_verification') {
                return <PendingVerificationCard dep={dep} copy={copy} onPay={startDeposit} />;
              }
              if (dep.status === 'refunded') {
                return <RefundedCard dep={dep} copy={copy} onRestart={startDeposit} busy={busy} />;
              }
              return (
                <VerifiedView
                  state={state} copy={copy}
                  onBook={book} onCancel={cancelBooking}
                  pendingRoomId={pendingRoomId}
                />
              );
            })()}

            {/* House rules */}
            <HouseRulesCard copy={copy} />
          </>
        )}
      </section>

      {payOpen && pay && (
        <PayModal
          pay={pay} qrDataUrl={qrDataUrl}
          utr={utr} setUtr={setUtr}
          submit={submitUtr} onClose={() => setPayOpen(false)}
          busy={busy} copy={copy}
        />
      )}
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function OverviewStrip({ state, copy }) {
  const months = state.months || [];
  const cur = months.find((m) => m.kind === 'current');
  const nxt = months.find((m) => m.kind === 'next');

  const totalRooms = cur?.rooms?.length || 0;
  const totalCapacity = (cur?.rooms || []).reduce((a, r) => a + r.capacity, 0);

  const curUsed = (cur?.rooms || []).reduce((a, r) => a + r.used, 0);
  const nxtUsed = (nxt?.rooms || []).reduce((a, r) => a + r.used, 0);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '.75rem', marginBottom: '1.5rem',
    }}>
      <StatTile
        label={totalRooms > 0 ? `${totalRooms} room${totalRooms === 1 ? '' : 's'}` : 'No rooms yet'}
        value={totalCapacity ? `${totalCapacity} seats` : '—'}
        sub={copy.location_hint}
      />
      {cur && (
        <StatTile
          label={`${MONTH_NAMES[cur.month - 1]} ${cur.year} · this month`}
          value={totalCapacity ? `${curUsed} / ${totalCapacity}` : '—'}
          sub={cur.my_booking ? `you: ${cur.my_booking.room_name}` : 'you: not booked'}
          ok={!!cur.my_booking}
        />
      )}
      {nxt && (
        <StatTile
          label={`${MONTH_NAMES[nxt.month - 1]} ${nxt.year} · next month`}
          value={totalCapacity ? `${nxtUsed} / ${totalCapacity}` : '—'}
          sub={nxt.my_booking
            ? `you: ${nxt.my_booking.room_name}`
            : nxt.window.open ? 'window open' : 'opens 25th'}
          ok={!!nxt.my_booking}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, sub, ok, highlight }) {
  return (
    <div className="card" style={{ padding: '.9rem 1rem' }}>
      <div style={{ fontSize: '.72rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{
        fontSize: '1.15rem', fontWeight: 700, marginTop: '.25rem',
        color: highlight ? 'var(--destructive)' : ok ? 'var(--primary)' : 'var(--foreground)',
      }}>{value}</div>
      {sub && <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.15rem' }}>{sub}</div>}
    </div>
  );
}

function NotStudentCard({ copy }) {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <IconUsers size="lg" />
      <h3 style={{ marginTop: '.75rem' }}>Students only</h3>
      <p className="muted-text" style={{ maxWidth: '32rem', margin: '.5rem auto 0' }}>
        {copy.non_student_msg}
      </p>
    </div>
  );
}

function NeedDepositCard({ dep, state, copy, onPay, busy }) {
  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '.5rem' }}>
        {dep?.status === 'rejected' ? 'Deposit rejected — try again' : copy.deposit_heading}
      </h3>
      {dep?.status === 'rejected' && dep.rejection_reason && (
        <p style={{ color: 'var(--destructive)', fontSize: '.875rem', marginTop: 0 }}>
          Reason: {dep.rejection_reason}
        </p>
      )}
      <p className="muted-text" style={{ marginTop: 0 }}>{copy.deposit_body}</p>

      <div style={{
        display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
        marginTop: '1.25rem', padding: '1rem',
        background: 'var(--muted)', borderRadius: '.55rem',
      }}>
        <div>
          <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>Amount</div>
          <div style={{ fontWeight: 700, fontSize: '1.35rem' }}>{rupees(state.config.deposit_paise)}</div>
        </div>
        <div>
          <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>Nature</div>
          <div style={{ fontWeight: 600 }}>One-time, refundable</div>
        </div>
        <div>
          <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>Verification</div>
          <div style={{ fontWeight: 600 }}>Within 1 working day</div>
        </div>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Button variant="primary" onClick={onPay} disabled={busy}>
          Pay ₹500 refundable deposit <IconArrowRight size="sm" />
        </Button>
      </div>
    </div>
  );
}

function PendingVerificationCard({ dep, copy, onPay }) {
  return (
    <div className="card" style={{ padding: '1.5rem', borderColor: 'oklch(0.85 0.16 90 / 0.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
        <IconClock size="md" />
        <h3 style={{ margin: 0 }}>Awaiting verification</h3>
      </div>
      <p className="muted-text" style={{ marginTop: 0 }}>
        Your deposit was received on {new Date(dep.submitted_at || dep.created_at).toLocaleString('en-IN', { dateStyle: 'medium' })}
        {' '}(UTR: <code>{dep.utr}</code>).
        The branch verifies deposits within one working day — you'll get an email once it clears.
      </p>
      <p className="muted-text" style={{ fontSize: '.85rem' }}>
        Paid the wrong UTR? <button className="btn btn-ghost" style={{ padding: '.15rem .35rem' }} onClick={onPay}>Update it</button>
      </p>
    </div>
  );
}

function RefundedCard({ dep, copy, onRestart, busy }) {
  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ marginTop: 0 }}>Your deposit was refunded</h3>
      <p className="muted-text">
        Refunded on {new Date(dep.refunded_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}.
        {dep.refund_note ? ` Note: ${dep.refund_note}` : ''}
      </p>
      <p>You can enrol again by paying the deposit fresh.</p>
      <Button variant="primary" onClick={onRestart} disabled={busy}>
        Enrol again — pay ₹500 deposit
      </Button>
    </div>
  );
}

// Verified state: single status bar + one section per bookable month
// (current + next). Rooms browse freely; the actual book fires only when
// the student clicks the "Book this room" button on a specific card.
function VerifiedView({ state, copy, onBook, onCancel, pendingRoomId }) {
  const months = state.months || [];
  const anyBooking = months.some((m) => m.my_booking);

  return (
    <>
      {/* Status bar — deposit + booking count summary */}
      <div className="rr-status-bar">
        <div className="rr-status-left">
          <span style={verifiedBadgeStyle}>DEPOSIT VERIFIED</span>
          {anyBooking && <span style={bookedBadgeStyle}>SEAT BOOKED</span>}
        </div>
        <div className="rr-status-right">
          <span>You can hold one seat per month — book each month separately.</span>
        </div>
      </div>

      {/* One section per bookable month */}
      {months.map((m) => (
        <MonthSection
          key={`${m.year}-${m.month}`}
          month={m}
          onBook={onBook}
          onCancel={onCancel}
          pendingRoomId={pendingRoomId}
        />
      ))}

      <style>{ROOM_STYLES}</style>
    </>
  );
}

// One heading + room grid for a single month. Handles the "next month
// hasn't opened yet" state internally (cards still render, but the book
// button shows a countdown label).
function MonthSection({ month, onBook, onCancel, pendingRoomId }) {
  const monthLabel = `${MONTH_FULL[month.month - 1]} ${month.year}`;
  const isCurrent = month.kind === 'current';
  const windowOpen = month.window.open;
  const rooms = month.rooms || [];
  const booking = month.my_booking;

  return (
    <div className="rr-month-block">
      <div className="rr-month-head">
        <div>
          <div className="rr-month-eyebrow">
            {isCurrent ? 'THIS MONTH' : 'NEXT MONTH'}
            {isCurrent && <span className="rr-open-dot" title="Bookings open" />}
          </div>
          <h3 className="rr-month-title">{monthLabel}</h3>
        </div>
        <div className="rr-month-meta">
          {booking ? (
            <span className="rr-month-mine">
              <IconCheck size="sm" /> Your seat: {booking.room_name || 'booked'}
            </span>
          ) : !windowOpen ? (
            <span className="rr-month-locked">
              <IconClock size="sm" /> Opens 25th
              <CountdownInline to={month.window.opens_at} />
            </span>
          ) : (
            <span className="muted-text" style={{ fontSize: '.85rem' }}>
              Bookings open · pick a room below
            </span>
          )}
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="rr-empty">
          <p className="muted-text" style={{ margin: 0 }}>
            No rooms are open for booking — the branch will publish the room list soon.
          </p>
        </div>
      ) : (
        <div className="rr-room-grid">
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              windowOpen={windowOpen}
              opensAt={month.window.opens_at}
              alreadyBookedRoomId={booking?.room_id}
              bookingId={booking?.id}
              targetYear={month.year}
              targetMonth={month.month}
              onBook={onBook}
              onCancel={onCancel}
              pendingRoomId={pendingRoomId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Rich room card — location, description, seat visualisation, book action.
// Three visual states: default / your-booking / full. Book button is
// disabled with an inline explanation whenever the action would fail.
function RoomCard({ room, windowOpen, alreadyBookedRoomId, bookingId, targetYear, targetMonth, onBook, onCancel, pendingRoomId }) {
  const full = room.available <= 0;
  const pct = room.capacity > 0 ? Math.min(100, Math.round((room.used / room.capacity) * 100)) : 0;
  const isMine = alreadyBookedRoomId === room.id;
  const isBusy = pendingRoomId === room.id;
  const anyBusy = pendingRoomId !== null;
  const otherBooked = alreadyBookedRoomId && !isMine;

  // Seat dots — a small visual so the availability is legible at a
  // glance. Capped at 40 dots so a 100-seat room doesn't wrap the card.
  const totalDots = Math.min(40, room.capacity);
  const usedDots  = Math.round((room.used / room.capacity) * totalDots) || (room.used > 0 ? 1 : 0);

  let variant = 'default';
  if (isMine)   variant = 'mine';
  else if (full) variant = 'full';

  return (
    <div className={`rr-card rr-card--${variant}`}>
      <div className="rr-card-head">
        <div>
          <div className="rr-card-title">{room.name}</div>
          {room.location && (
            <div className="rr-card-loc">
              <IconMapPin size="sm" /> {room.location}
            </div>
          )}
        </div>
        <span className="rr-card-badge">
          {isMine ? 'YOUR SEAT' : full ? 'FULL' : `${room.available} left`}
        </span>
      </div>

      {room.description && (
        <p className="rr-card-desc">{room.description}</p>
      )}

      {/* Seat dots + counter */}
      <div className="rr-seats">
        {Array.from({ length: totalDots }).map((_, i) => (
          <span
            key={i}
            className={'rr-seat' + (i < usedDots ? ' rr-seat--used' : '')}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="rr-seat-count">
        <span className="rr-count-num">{room.used} / {room.capacity}</span>
        <span className="muted-text">seats booked</span>
      </div>

      {/* Progress bar */}
      <div className="rr-bar-wrap">
        <div className="rr-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="rr-card-foot">
        {isMine ? (
          <>
            <span className="rr-mine-msg"><IconCheck size="sm" /> Your seat</span>
            <Button variant="ghost" onClick={() => onCancel?.(bookingId)} disabled={anyBusy}>Cancel</Button>
          </>
        ) : (
          <Button
            variant={full || otherBooked || !windowOpen ? 'ghost' : 'primary'}
            onClick={() => onBook?.(room.id, targetYear, targetMonth)}
            disabled={full || otherBooked || !windowOpen || anyBusy}
          >
            {full
              ? 'Room full'
              : otherBooked
                ? 'You already have a seat'
                : !windowOpen
                  ? 'Opens on the 25th'
                  : isBusy
                    ? 'Booking…'
                    : 'Book this room'}
            {!full && !otherBooked && windowOpen && !isBusy && <IconArrowRight size="sm" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function CountdownInline({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const remaining = new Date(to).getTime() - now;
  if (remaining <= 0) return null;
  const d = Math.floor(remaining / 86_400_000);
  const h = Math.floor((remaining / 3_600_000) % 24);
  return <span className="muted-text" style={{ fontSize: '.85rem' }}>· opens in {d}d {h}h</span>;
}

const verifiedBadgeStyle = {
  fontSize: '.7rem', fontWeight: 700, padding: '.15rem .55rem',
  borderRadius: '999px', background: 'oklch(0.94 0.05 145)', color: 'oklch(0.35 0.15 145)',
  letterSpacing: '.03em',
};
const bookedBadgeStyle = {
  fontSize: '.7rem', fontWeight: 700, padding: '.15rem .55rem',
  borderRadius: '999px', background: 'oklch(0.94 0.05 255)', color: 'oklch(0.35 0.15 255)',
  letterSpacing: '.03em',
};

const ROOM_STYLES = `
  .rr-status-bar {
    display: flex; flex-wrap: wrap; gap: .75rem 1rem;
    align-items: center; justify-content: space-between;
    padding: .85rem 1.1rem;
    border: 1px solid var(--border);
    border-radius: .75rem;
    background: var(--card);
    margin-bottom: 1.5rem;
  }
  .rr-status-left, .rr-status-right {
    display: flex; align-items: center; gap: .5rem;
    flex-wrap: wrap;
  }
  .rr-status-right { font-size: .9rem; color: var(--foreground); }
  .rr-cancel-btn { padding: .3rem .7rem; font-size: .8rem; }

  .rr-month-block { margin-bottom: 2rem; }
  .rr-month-block:last-child { margin-bottom: 0; }
  .rr-month-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    padding-bottom: .65rem;
  }
  .rr-month-eyebrow {
    font-size: .68rem; font-weight: 700; letter-spacing: .08em;
    color: var(--muted-foreground);
    display: inline-flex; align-items: center; gap: .4rem;
  }
  .rr-open-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: oklch(0.55 0.17 145);
    box-shadow: 0 0 0 3px oklch(0.55 0.17 145 / .18);
    display: inline-block;
  }
  .rr-month-title { margin: .25rem 0 0; font-size: 1.3rem; font-weight: 700; }
  .rr-month-meta { display: flex; align-items: center; gap: .5rem; }
  .rr-month-mine {
    display: inline-flex; align-items: center; gap: .35rem;
    font-size: .85rem; font-weight: 600; color: oklch(0.4 0.18 255);
  }
  .rr-month-locked {
    display: inline-flex; align-items: center; gap: .35rem;
    font-size: .85rem; color: var(--muted-foreground);
  }

  .rr-room-grid {
    display: grid; gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .rr-card {
    display: flex; flex-direction: column; gap: .65rem;
    padding: 1.1rem 1.15rem 1.05rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: .75rem;
    transition: box-shadow .15s, border-color .15s, transform .15s;
  }
  .rr-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,.06); transform: translateY(-1px); }
  .rr-card--mine  { border-color: oklch(0.6 0.16 255 / .7); background: oklch(0.98 0.02 255); }
  .rr-card--full  { border-color: oklch(0.85 0.16 25 / .5); background: oklch(0.98 0.02 25 / .4); }

  .rr-card-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: .6rem;
  }
  .rr-card-title { font-weight: 700; font-size: 1.02rem; line-height: 1.25; }
  .rr-card-loc {
    display: flex; align-items: center; gap: .3rem;
    font-size: .78rem; color: var(--muted-foreground); margin-top: .2rem;
  }
  .rr-card-badge {
    font-size: .68rem; font-weight: 700; letter-spacing: .04em;
    padding: .2rem .5rem; border-radius: 999px; white-space: nowrap;
    background: oklch(0.94 0.05 145); color: oklch(0.35 0.15 145);
  }
  .rr-card--full .rr-card-badge { background: oklch(0.94 0.05 25);  color: oklch(0.4 0.18 25); }
  .rr-card--mine .rr-card-badge { background: oklch(0.94 0.05 255); color: oklch(0.35 0.15 255); }

  .rr-card-desc {
    font-size: .82rem; color: var(--muted-foreground);
    margin: 0; line-height: 1.4;
  }

  .rr-seats {
    display: grid; gap: 3px;
    grid-template-columns: repeat(auto-fill, minmax(11px, 1fr));
    margin-top: .3rem;
  }
  .rr-seat {
    display: block; width: 11px; height: 11px;
    border-radius: 2px;
    background: oklch(0.9 0.03 145);
    border: 1px solid oklch(0.85 0.05 145);
  }
  .rr-seat--used {
    background: oklch(0.55 0.17 25);
    border-color: oklch(0.5 0.18 25);
  }
  .rr-card--mine .rr-seat--used { background: oklch(0.5 0.18 255); border-color: oklch(0.45 0.18 255); }

  .rr-seat-count {
    display: flex; align-items: baseline; gap: .35rem;
    font-size: .78rem;
  }
  .rr-count-num { font-weight: 700; color: var(--foreground); }

  .rr-bar-wrap {
    height: 4px; background: var(--muted);
    border-radius: 999px; overflow: hidden;
  }
  .rr-bar-fill {
    height: 100%; background: oklch(0.55 0.15 145);
    transition: width .2s;
  }
  .rr-card--full .rr-bar-fill { background: oklch(0.6 0.17 25); }
  .rr-card--mine .rr-bar-fill { background: oklch(0.5 0.18 255); }

  .rr-card-foot {
    display: flex; align-items: center; justify-content: space-between;
    gap: .5rem; margin-top: .35rem;
  }
  .rr-mine-msg {
    display: inline-flex; align-items: center; gap: .35rem;
    font-size: .82rem; font-weight: 600; color: oklch(0.4 0.18 255);
  }

  .rr-empty {
    padding: 2rem 1rem; text-align: center;
    background: var(--card); border: 1px dashed var(--border);
    border-radius: .55rem;
  }

  @media (max-width: 640px) {
    .rr-status-bar { padding: .75rem .85rem; }
    .rr-room-grid { grid-template-columns: 1fr; }
  }
`;

function HouseRulesCard({ copy }) {
  if (!copy.house_rules) return null;
  return (
    <div className="card" style={{ padding: '1.25rem 1.5rem', marginTop: '1.25rem' }}>
      <h4 style={{ marginTop: 0 }}>House rules</h4>
      <div className="muted-text" style={{ whiteSpace: 'pre-line', fontSize: '.9rem' }}>
        {copy.house_rules}
      </div>
    </div>
  );
}

// ─── UPI QR modal ──────────────────────────────────────────────────────────
function PayModal({ pay, qrDataUrl, utr, setUtr, submit, onClose, busy, copy }) {
  const dep = pay.deposit;
  const amountPaise = dep?.amount_paise ?? 50000;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', color: 'var(--foreground)',
          borderRadius: '.75rem', width: '100%', maxWidth: '30rem',
          padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Pay {rupees(amountPaise)} refundable deposit</h3>
        <p className="muted-text" style={{ marginTop: 0, fontSize: '.85rem' }}>
          Scan the QR with any UPI app. Once paid, come back to this window and enter the transaction reference (UTR) below.
        </p>

        <div style={{
          background: 'oklch(0.97 0.02 250)', border: '1px solid var(--border)',
          borderRadius: '.5rem', padding: '1rem', margin: '1rem 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem',
        }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="UPI payment QR" width={240} height={240} style={{ background: '#fff' }} />
          ) : (
            <div style={{ width: 240, height: 240, background: '#fff' }} />
          )}
          <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>
            GPay · PhonePe · Paytm · BHIM — all UPI apps
          </div>
        </div>

        <div style={{
          background: 'var(--muted)', borderRadius: '.5rem', padding: '.6rem .8rem',
          marginBottom: '.75rem', fontSize: '.85rem',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '.4rem .8rem',
        }}>
          <span style={{ color: 'var(--muted-foreground)' }}>Pay to</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{pay.upi_id}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>Note</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{pay.note}</span>
        </div>

        <form onSubmit={submit}>
          <label style={{ display: 'block', marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.375rem' }}>
              UTR / UPI transaction reference
            </div>
            <input
              type="text"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 431223948712"
              maxLength={30}
              required
              style={{
                width: '100%', padding: '.55rem .75rem',
                border: '1px solid var(--border)', borderRadius: '.375rem',
                fontSize: '.9375rem', background: 'var(--background)', color: 'var(--foreground)',
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
            <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>Close</Button>
            <Button variant="primary" type="submit" disabled={busy}>Submit UTR</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
