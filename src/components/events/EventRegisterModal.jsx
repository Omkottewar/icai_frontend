import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEventRegistration } from '../../hooks/useEventRegistration';
import { navigate } from '../../hooks/useRoute';
import { IconX, IconCheckCircle, IconCalendar, IconMapPin } from '../../icons';
import Button from '../ui/Button';

function rupees(paise) {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDateTime(starts_at) {
  if (!starts_at) return '';
  const d = new Date(starts_at);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// Two-step registration modal:
//   Free events: single "Confirm" click.
//   Paid events: fill phone → server returns SabPaisa init payload →
//     auto-submit an invisible form to SabPaisa's hosted checkout →
//     SabPaisa redirects back to /payments/result → PaymentResultPage
//     handles success/failure/pending display and the "back to event" link.
export default function EventRegisterModal({ event, onClose, onRegistered }) {
  const { user, showToast } = useAuth();
  const { startRegister, loading } = useEventRegistration();

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [step, setStep] = useState('form');  // 'form' | 'redirecting' | 'submitted'
  const [sabpaisa, setSabpaisa] = useState(null);  // { action, clientCode, encData } from /register
  const [err, setErr] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const formRef = useRef(null);

  useEffect(() => { setPhone(user?.phone ?? ''); }, [user]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !loading && step !== 'redirecting') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, loading, step]);

  // When SabPaisa payload arrives, auto-submit the invisible form to
  // SabPaisa's hosted checkout. Browser leaves the page — no further UI
  // state in this modal after submit. If the user clicks back from
  // SabPaisa, the modal will have unmounted; they'll land on /events.
  useEffect(() => {
    if (step !== 'redirecting') return;
    if (!sabpaisa || !formRef.current) return;
    // One tick so the "Redirecting..." paint lands before the browser
    // navigates away — otherwise users see a blank modal flash.
    const t = setTimeout(() => formRef.current?.submit(), 150);
    return () => clearTimeout(t);
  }, [step, sabpaisa]);

  const isPaid = Number(event?.fee_paise || 0) > 0;
  const capacityFull = event?.capacity != null && Number(event.registered_count || 0) >= Number(event.capacity);

  const handleStart = async (e) => {
    e.preventDefault();
    setErr(null);

    if (!event?.slug) { setErr('This event is missing a slug — cannot register.'); return; }
    if (!/^\+?\d[\d\s-]{7,}$/.test(phone.trim())) {
      setErr('Please enter a valid phone number so we can reach you about this event.');
      return;
    }

    const result = await startRegister({
      slug: event.slug,
      phone: phone.trim(),
      attendee_user_ids: attendees.map((a) => a.id),
    });
    if (!result.ok) {
      setErr(result.error?.message || 'Something went wrong. Please try again.');
      return;
    }

    if (!result.paid) {
      // Free event — already registered.
      setStep('submitted');
      onRegistered?.();
      showToast?.('You are registered!', 'success');
      return;
    }

    // Paid event — kick off the SabPaisa redirect.
    if (!result.sabpaisa?.action || !result.sabpaisa?.encData) {
      setErr('Payment gateway not configured yet. Please contact the branch office.');
      return;
    }
    setSabpaisa(result.sabpaisa);
    setStep('redirecting');
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !loading && step !== 'redirecting') onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-modal-title"
        style={{
          background: 'var(--card)',
          borderRadius: '.75rem',
          width: '100%',
          maxWidth: '32rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px oklch(0.18 0.05 250 / 0.4)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tiny-eyebrow">{isPaid ? 'PAID REGISTRATION' : 'FREE REGISTRATION'}</div>
            <h3 id="reg-modal-title" style={{
              fontSize: '1.125rem', fontWeight: 700, marginTop: '.25rem',
              lineHeight: 1.3, color: 'var(--foreground)',
            }}>
              {event?.title || 'Register for event'}
            </h3>
            <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.35rem', display: 'flex', gap: '.85rem', flexWrap: 'wrap' }}>
              {event?.starts_at && (
                <span className="row gap-1"><IconCalendar size="sm" /> {formatDateTime(event.starts_at)}</span>
              )}
              {event?.venue && (
                <span className="row gap-1"><IconMapPin size="sm" /> {event.venue}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => (!loading && step !== 'redirecting') && onClose?.()}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none',
              cursor: (loading || step === 'redirecting') ? 'not-allowed' : 'pointer',
              padding: '.25rem', marginLeft: '.75rem', color: 'var(--muted-foreground)',
              opacity: (loading || step === 'redirecting') ? 0.4 : 1,
            }}
          >
            <IconX size="sm" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {!user ? (
            <SignInPrompt onClose={onClose} />
          ) : step === 'submitted' ? (
            <SuccessState isPaid={isPaid} onClose={onClose} />
          ) : step === 'redirecting' && sabpaisa ? (
            <RedirectingState sabpaisa={sabpaisa} formRef={formRef} />
          ) : capacityFull ? (
            <CapacityFullState onClose={onClose} />
          ) : (
            <form onSubmit={handleStart}>
              <ReadOnlyField label="Name"  value={user.name}  />
              <ReadOnlyField label="Email" value={user.email} />

              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.375rem', color: 'var(--foreground)' }}>
                  Phone number
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  required
                  disabled={loading}
                  style={{
                    width: '100%', padding: '.55rem .75rem',
                    border: '1px solid var(--border)', borderRadius: '.375rem',
                    fontSize: '.9375rem', background: 'var(--background)', color: 'var(--foreground)',
                  }}
                />
                <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                  We use this only to contact you about this event.
                </div>
              </label>

              {isPaid && (
                <AttendeePicker
                  attendees={attendees}
                  onChange={setAttendees}
                  disabled={loading}
                />
              )}

              <div style={{
                background: 'var(--muted)', borderRadius: '.5rem',
                padding: '.85rem 1rem', marginBottom: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: '.8125rem', color: 'var(--muted-foreground)' }}>
                  {isPaid
                    ? attendees.length > 0
                      ? `${1 + attendees.length} seats × ${rupees(event.fee_paise)}`
                      : 'Registration fee'
                    : 'Registration'}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {isPaid ? rupees(event.fee_paise * (1 + attendees.length)) : 'Free'}
                </div>
              </div>

              {err && (
                <div style={{
                  background: 'oklch(0.96 0.04 25)', color: 'oklch(0.35 0.18 25)',
                  border: '1px solid oklch(0.85 0.1 25)', padding: '.6rem .8rem',
                  borderRadius: '.375rem', fontSize: '.8125rem', marginBottom: '.875rem',
                }}>
                  {err}
                </div>
              )}

              <Button
                type="submit"
                className="btn btn-primary"
                loading={loading}
                style={{ width: '100%', padding: '.7rem 1rem', fontWeight: 600 }}
              >
                {loading
                  ? (isPaid ? 'Preparing payment…' : 'Registering…')
                  : (isPaid ? `Continue to pay ${rupees(event.fee_paise * (1 + attendees.length))}` : 'Confirm Registration')}
              </Button>

              {isPaid && (
                <div className="muted-text" style={{ fontSize: '.7125rem', marginTop: '.6rem', textAlign: 'center' }}>
                  You'll be redirected to SabPaisa's secure payment page. Card, UPI and netbanking accepted.
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Redirecting-to-SabPaisa panel ────────────────────────────────────────
// Renders a message + an invisible <form> that auto-submits to SabPaisa's
// hosted checkout via a useEffect in the parent. Using a POST form (not
// window.location) because SabPaisa's init endpoint requires the three
// fields in the request body, not the URL.
function RedirectingState({ sabpaisa, formRef }) {
  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '3.5rem', height: '3.5rem', borderRadius: '999px',
        background: 'oklch(0.95 0.05 240)', color: 'oklch(0.35 0.14 240)',
        marginBottom: '.85rem',
      }}>
        <Spinner />
      </div>
      <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '.35rem' }}>
        Redirecting to secure payment…
      </h4>
      <div className="muted-text" style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
        If you aren't redirected automatically, click the button below.
      </div>
      <form ref={formRef} action={sabpaisa.action} method="POST" style={{ display: 'inline-block' }}>
        <input type="hidden" name="clientCode" value={sabpaisa.clientCode} />
        <input type="hidden" name="encData"    value={sabpaisa.encData}    />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '.55rem 1.25rem', fontWeight: 600 }}
        >
          Continue to SabPaisa
        </button>
      </form>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="22" height="22" viewBox="0 0 44 44" aria-label="Loading">
      <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="80 40" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={{ marginBottom: '.875rem' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.375rem', color: 'var(--foreground)' }}>
        {label}
      </div>
      <div style={{
        padding: '.55rem .75rem', border: '1px solid var(--border)',
        borderRadius: '.375rem', fontSize: '.9375rem',
        background: 'var(--muted)', color: 'var(--muted-foreground)',
      }}>
        {value}
      </div>
    </div>
  );
}

function SignInPrompt({ onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '.5rem 0 1rem' }}>
      <div className="muted-text" style={{ marginBottom: '1rem' }}>
        Please sign in to register for this event.
      </div>
      <div className="row gap-2" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { onClose?.(); navigate('/login'); }}
          style={{ padding: '.55rem 1.25rem' }}
        >
          Sign in
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => { onClose?.(); navigate('/signup'); }}
          style={{ padding: '.55rem 1.25rem' }}
        >
          Create account
        </button>
      </div>
    </div>
  );
}

function SuccessState({ isPaid, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '.5rem 0' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '3.5rem', height: '3.5rem', borderRadius: '999px',
        background: 'oklch(0.95 0.08 145)', color: 'oklch(0.42 0.18 145)',
        marginBottom: '.85rem',
      }}>
        <IconCheckCircle />
      </div>
      <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '.35rem' }}>
        {isPaid ? 'Payment submitted' : 'You\'re registered!'}
      </h4>
      <div className="muted-text" style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
        We'll send the joining details to your email.
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onClose}
        style={{ padding: '.55rem 1.5rem' }}
      >
        Done
      </button>
    </div>
  );
}

// ─── AttendeePicker ──────────────────────────────────────────────────────
// Search-and-pick UI for group bookings. Booker types 2+ characters, we
// hit /api/members/search (portal users only, capped at 15 results), they
// click a result to add it as an attendee. Selected attendees appear as
// removable chips above the search input. The picker never lets the
// booker add themselves — the API also enforces that guard server-side.
function AttendeePicker({ attendees, onChange, disabled }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const cleaned = q.trim();
    if (cleaned.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/members/search?q=${encodeURIComponent(cleaned)}`, { credentials: 'include' });
        const j = await r.json();
        if (!cancelled && r.ok) setResults(j.rows || []);
      } catch { /* swallow */ }
      finally { if (!cancelled) setSearching(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const alreadyPicked = new Set(attendees.map((a) => a.id));
  const filteredResults = results.filter((r) => !alreadyPicked.has(r.id));

  const add = (row) => {
    onChange([...attendees, row]);
    setQ('');
    setResults([]);
    setOpen(false);
  };
  const remove = (id) => onChange(attendees.filter((a) => a.id !== id));

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.375rem' }}>
        Book seats for others (optional)
      </div>
      <div className="muted-text" style={{ fontSize: '.72rem', marginBottom: '.5rem' }}>
        Search by name or email to add fellow members. Each additional seat is charged separately and the person will see the event on their own dashboard once your payment is confirmed.
      </div>

      {attendees.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '.5rem' }}>
          {attendees.map((a) => (
            <span key={a.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '.35rem',
              background: 'oklch(0.94 0.03 250)', color: 'oklch(0.28 0.09 250)',
              padding: '.25rem .55rem', borderRadius: 999, fontSize: '.78rem',
            }}>
              {a.name}
              <button
                type="button"
                onClick={() => remove(a.id)}
                disabled={disabled}
                aria-label={`Remove ${a.name}`}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: 0, marginLeft: '.15rem', color: 'inherit', lineHeight: 1,
                }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search by name or email…"
          disabled={disabled}
          style={{
            width: '100%', padding: '.5rem .7rem',
            border: '1px solid var(--border)', borderRadius: '.375rem',
            fontSize: '.875rem', background: 'var(--background)', color: 'var(--foreground)',
          }}
        />
        {open && q.trim().length >= 2 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '.2rem',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '.375rem', boxShadow: '0 10px 20px oklch(0.2 0.05 250 / 0.15)',
            maxHeight: 240, overflowY: 'auto', zIndex: 10,
          }}>
            {searching && (
              <div className="muted-text" style={{ padding: '.5rem .7rem', fontSize: '.78rem' }}>Searching…</div>
            )}
            {!searching && filteredResults.length === 0 && (
              <div className="muted-text" style={{ padding: '.5rem .7rem', fontSize: '.78rem' }}>
                No matching members. They need a portal account to be added as an attendee.
              </div>
            )}
            {!searching && filteredResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '.5rem .7rem', background: 'transparent', border: 'none',
                  borderTop: '1px solid var(--border)', cursor: 'pointer',
                  fontSize: '.85rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="muted-text" style={{ fontSize: '.72rem' }}>{r.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CapacityFullState({ onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '.5rem 0 1rem' }}>
      <div className="muted-text" style={{ marginBottom: '1rem' }}>
        Sorry, this event is at full capacity. Check back later in case seats open up.
      </div>
      <button
        type="button"
        className="btn btn-outline"
        onClick={onClose}
        style={{ padding: '.55rem 1.25rem' }}
      >
        Close
      </button>
    </div>
  );
}
