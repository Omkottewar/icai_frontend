import { useEffect, useState } from 'react';
import { cachedGet, apiWrite, invalidate, subscribe } from '../../lib/apiCache';
import { toast } from '../../lib/notify';

// Two small member-dashboard cards driving the WICASA mentorship loop:
//
//   • MentorAvailabilityCard — toggles users.willing_to_mentor. Members
//     opt themselves in so WICASA can pick them from the mentor pool.
//     Hidden for non-members (the /mentor-availability endpoint returns
//     eligible=false for students/employers/admins).
//
//   • MyMenteesCard — lists the caller's active mentee assignments
//     (matched + scheduled + completed). Renders nothing when there are
//     none, so the card silently disappears for members who aren't
//     currently mentoring anyone.

// ─── Availability toggle ─────────────────────────────────────────────────

export function MentorAvailabilityCard() {
  const [state, setState] = useState(null); // { willing, eligible } | null
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      cachedGet('/api/me/mentor-availability', null, 60_000)
        .then((j) => { if (!cancelled) setState(j); })
        .catch(() => { if (!cancelled) setState({ willing: false, eligible: false }); });
    };
    load();
    const unsub = subscribe('/api/me/mentor-availability', load);
    return () => { cancelled = true; unsub(); };
  }, []);

  if (!state) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <p className="muted-text" style={{ fontSize: '.85rem', margin: 0 }}>Loading…</p>
      </div>
    );
  }
  // Non-members don't get to see the toggle at all — the endpoint returns
  // eligible=false for them. Silent no-op keeps the settings tab tidy.
  if (!state.eligible) return null;

  async function toggle() {
    if (saving) return;
    setSaving(true);
    const next = !state.willing;
    try {
      await apiWrite('/api/me/mentor-availability', {
        method: 'POST',
        body: { willing: next },
      });
      invalidate('/api/me/mentor-availability');
      setState({ ...state, willing: next });
      toast.success(next
        ? "You're in the mentor pool. WICASA may pair you with a student soon."
        : "You've opted out of the mentor pool.");
    } catch (err) {
      toast.error(err?.message || 'Could not update — try again shortly.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
        <span aria-hidden style={{ fontSize: '1.35rem', lineHeight: 1 }}>🎓</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700 }}>
            {state.willing ? "You're in the mentor pool" : 'Become a mentor'}
          </h3>
          <p className="muted-text" style={{ fontSize: '.8rem', marginTop: '.25rem', lineHeight: 1.45 }}>
            {state.willing
              ? "WICASA can pair you with a CA student who's asked for guidance. You'll be emailed when assigned."
              : "Opt in and WICASA can pair you with a CA student who's asked for guidance. Free to opt out anytime."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={state.willing ? 'btn btn-outline' : 'btn btn-primary'}
          style={{ padding: '.4rem .85rem', fontSize: '.78rem', flexShrink: 0 }}
        >
          {saving ? 'Saving…' : state.willing ? 'Opt out' : 'Opt in'}
        </button>
      </div>
    </div>
  );
}

// ─── Mentees list ─────────────────────────────────────────────────────────

const STATUS_LABEL = {
  matched:   'Matched',
  scheduled: 'Scheduled',
  completed: 'Completed',
};

const STATUS_STYLE = {
  matched:   { bg: 'oklch(0.90 0.10 250 / .35)', fg: 'oklch(0.30 0.13 250)' },
  scheduled: { bg: 'oklch(0.90 0.10 90 / .35)',  fg: 'oklch(0.35 0.14 60)' },
  completed: { bg: 'oklch(0.94 0.10 145 / .5)',  fg: 'oklch(0.30 0.14 145)' },
};

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function MyMenteesCard() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      cachedGet('/api/me/my-mentees', null, 30_000)
        .then((j) => { if (!cancelled) setItems(j?.items || []); })
        .catch(() => { if (!cancelled) setItems([]); });
    };
    load();
    const unsub = subscribe('/api/me/my-mentees', load);
    return () => { cancelled = true; unsub(); };
  }, []);

  // Silently hide the whole card when there are no mentees — this is a
  // "surface only when actionable" pattern used elsewhere on the dashboard
  // (SuggestedEventsCard, RecentCertificatesCard, etc.).
  if (items === null) return null;
  if (items.length === 0) return null;

  const active = items.filter((r) => r.status !== 'completed');
  const done = items.filter((r) => r.status === 'completed');

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.65rem' }}>
        <span aria-hidden style={{ fontSize: '1.1rem' }}>🎓</span>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>My mentees</h3>
        <span className="muted-text" style={{ fontSize: '.7rem' }}>
          — WICASA paired you with {items.length} student{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
        {active.map((r) => {
          const s = STATUS_STYLE[r.status] || STATUS_STYLE.matched;
          const student = r.student;
          const contact = student
            ? [student.phone, student.email].filter(Boolean).join(' · ')
            : 'Contact via WICASA';
          return (
            <div key={r.id} style={{
              padding: '.6rem .75rem', border: '1px solid var(--border)', borderRadius: '.4rem',
              display: 'flex', flexDirection: 'column', gap: '.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 600 }}>{student?.name || 'Student'}</div>
                  <div className="muted-text" style={{ fontSize: '.72rem' }}>{contact}</div>
                </div>
                <span style={{
                  padding: '.15rem .5rem', borderRadius: 999,
                  fontSize: '.68rem', fontWeight: 700,
                  background: s.bg, color: s.fg,
                }}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
              <div style={{ fontSize: '.82rem', marginTop: '.15rem' }}>
                <strong>Topic:</strong> {r.topic}
              </div>
              {r.preferred_window && r.status === 'matched' && (
                <div className="muted-text" style={{ fontSize: '.72rem' }}>
                  Preferred window: {r.preferred_window}
                </div>
              )}
              {r.scheduled_at && (
                <div style={{ fontSize: '.78rem', marginTop: '.1rem' }}>
                  📅 First session: <strong>{fmtDateTime(r.scheduled_at)}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <details style={{ marginTop: '.6rem', fontSize: '.75rem' }}>
          <summary className="muted-text" style={{ cursor: 'pointer' }}>
            {done.length} completed mentee{done.length === 1 ? '' : 's'}
          </summary>
          <div style={{ marginTop: '.35rem', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
            {done.map((r) => (
              <div key={r.id} className="muted-text" style={{ fontSize: '.75rem' }}>
                {r.student?.name || 'Student'} — {r.topic}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
