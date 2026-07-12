import { useEffect, useState } from 'react';
import { cachedGet, apiWrite, invalidate, subscribe } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import { IconClock, IconArrowRight } from '../../icons';

// Student's reading-room bookings. Pulls /api/rooms/my-bookings and
// surfaces upcoming slots with a Cancel button. Past bookings are
// collapsed under a "…N past" footer so the current view stays short.
//
// Refresh strategy mirrors StudentRequestsCard — subscribes to cache
// invalidations so cancelling a booking here (or from RoomBookingPage)
// updates both places without a reload.

const STATUS_PALETTE = {
  requested: { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  confirmed: { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  completed: { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
  cancelled: { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
};

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', day: '2-digit', month: 'short',
});
const TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit', minute: '2-digit', hour12: true,
});

function fmtSlot(startIso, endIso) {
  if (!startIso) return '';
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  const date = DATE_FMT.format(s);
  const time = e ? `${TIME_FMT.format(s)} – ${TIME_FMT.format(e)}` : TIME_FMT.format(s);
  return `${date} · ${time}`;
}

export default function MyRoomBookingsCard() {
  const [rows, setRows] = useState(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      cachedGet('/api/rooms/my-bookings', null, 30_000)
        .then((j) => { if (!cancelled) setRows(j?.rows || []); })
        .catch(() => { if (!cancelled) setRows([]); });
    };
    load();
    const unsub = subscribe('/api/rooms/my-bookings', load);
    return () => { cancelled = true; unsub(); };
  }, []);

  async function cancel(id) {
    try {
      await apiWrite(`/api/rooms/bookings/${id}/cancel`, { method: 'POST' });
      invalidate('/api/rooms/my-bookings');
      toast.success('Booking cancelled');
    } catch (err) {
      toast.error(err?.message || 'Could not cancel — try again in a bit.');
    }
  }

  if (rows === null) {
    return (
      <div className="card">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Reading room bookings</h2>
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>Loading…</p>
      </div>
    );
  }

  const now = Date.now();
  const upcoming = rows.filter((b) => new Date(b.slot_start).getTime() >= now && b.status !== 'cancelled');
  const past = rows.filter((b) => !(new Date(b.slot_start).getTime() >= now && b.status !== 'cancelled'));

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Reading room bookings</h2>
        <a href="/book-room" style={{ color: 'var(--primary)', fontSize: '.85rem', fontWeight: 600 }}>
          Book a slot →
        </a>
      </div>

      {upcoming.length === 0 ? (
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>
          No upcoming reading room bookings.{' '}
          <a href="/book-room" style={{ color: 'var(--primary)' }}>Reserve a slot →</a>
        </p>
      ) : (
        <ul className="col" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
          {upcoming.map((b) => {
            const palette = STATUS_PALETTE[b.status] || STATUS_PALETTE.requested;
            const canCancel = b.status === 'requested' || b.status === 'confirmed';
            return (
              <li key={b.id} style={{ padding: '.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row gap-2" style={{ alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{b.room_name || 'Reading room'}</span>
                      <span className="badge" style={{
                        background: palette.bg, color: palette.fg,
                        fontSize: '.68rem', padding: '.15rem .45rem', borderRadius: 999,
                        textTransform: 'capitalize',
                      }}>{b.status}</span>
                    </div>
                    <div className="row gap-1 muted-text" style={{ fontSize: '.75rem', marginTop: '.2rem' }}>
                      <IconClock size="sm" /> {fmtSlot(b.slot_start, b.slot_end)}
                    </div>
                    {b.purpose && (
                      <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.15rem' }}>
                        {b.purpose}
                      </div>
                    )}
                  </div>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => cancel(b.id)}
                      className="btn btn-outline"
                      style={{
                        fontSize: '.72rem', padding: '.3rem .55rem',
                        color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)',
                      }}
                      title="Cancel this booking"
                    >Cancel</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: '.6rem' }}>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              fontSize: '.75rem', color: 'var(--muted-foreground)', padding: 0,
            }}
          >
            {showPast
              ? `Hide ${past.length} past booking${past.length === 1 ? '' : 's'}`
              : `Show ${past.length} past booking${past.length === 1 ? '' : 's'}`}
          </button>
          {showPast && (
            <ul className="col" style={{ listStyle: 'none', padding: 0, margin: '.6rem 0 0', opacity: .8 }}>
              {past.map((b) => {
                const palette = STATUS_PALETTE[b.status] || STATUS_PALETTE.completed;
                return (
                  <li key={b.id} style={{ padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="row gap-2" style={{ alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: '.82rem' }}>{b.room_name || 'Reading room'}</span>
                      <span className="badge" style={{
                        background: palette.bg, color: palette.fg,
                        fontSize: '.65rem', padding: '.1rem .4rem', borderRadius: 999,
                        textTransform: 'capitalize',
                      }}>{b.status}</span>
                    </div>
                    <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.15rem' }}>
                      {fmtSlot(b.slot_start, b.slot_end)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
