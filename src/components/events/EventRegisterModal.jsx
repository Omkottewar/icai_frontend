import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { useEventRegistration } from '../../hooks/useEventRegistration';
import { navigate } from '../../hooks/useRoute';
import { IconX, IconCheckCircle, IconCalendar, IconMapPin, IconCopy } from '../../icons';
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
//   Paid events: fill phone → server returns UPI URI → render QR + amount →
//     user pays in their UPI app → user pastes UTR + optional screenshot →
//     server marks payment 'pending_verification' → admin approves off-band.
export default function EventRegisterModal({ event, onClose, onRegistered }) {
  const { user, showToast } = useAuth();
  const { startRegister, submitUtr, loading } = useEventRegistration();

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [step, setStep] = useState('form');  // 'form' | 'pay' | 'submitted'
  const [payment, setPayment] = useState(null);  // response from /register when paid
  const [err, setErr] = useState(null);
  // Group booking: attendees the booker wants to pay for. Each is
  // { id, name, email }. Booker is always seat 1 and does NOT appear here.
  const [attendees, setAttendees] = useState([]);

  useEffect(() => { setPhone(user?.phone ?? ''); }, [user]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, loading]);

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

    // Paid event — show QR panel.
    setPayment(result);
    setStep('pay');
  };

  const handleUtrSubmitted = () => {
    setStep('submitted');
    onRegistered?.();
    showToast?.('Payment details submitted — we\'ll email you once verified.', 'success');
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose?.(); }}
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
            onClick={() => !loading && onClose?.()}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              padding: '.25rem', marginLeft: '.75rem', color: 'var(--muted-foreground)',
              opacity: loading ? 0.4 : 1,
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
          ) : step === 'pay' && payment ? (
            <QrPayPanel
              payment={payment}
              slug={event.slug}
              loading={loading}
              submitUtr={submitUtr}
              onSubmitted={handleUtrSubmitted}
              onCancel={() => setStep('form')}
            />
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
                  You'll pay via UPI QR on the next step.
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── QR payment + UTR submission panel ───────────────────────────────────
function QrPayPanel({ payment, slug, loading, submitUtr, onSubmitted, onCancel }) {
  const [utr, setUtr] = useState('');
  const [err, setErr] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Render the UPI intent URI as a data-URL PNG, then render it via <img>.
  // This is more robust than QRCode.toCanvas — the img keeps its src across
  // re-renders even if the parent invalidates a cache. Async but resolves
  // in tens of milliseconds so the visual lag is imperceptible.
  useEffect(() => {
    if (!payment?.upi_uri) { setQrDataUrl(''); return; }
    let cancelled = false;
    QRCode.toDataURL(payment.upi_uri, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b3d91', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { /* browser can't render — user still has UPI ID as text */ });
    return () => { cancelled = true; };
  }, [payment?.upi_uri]);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setErr(null);
    } catch {
      // Fallthrough — user can select manually. No toast wired in this component.
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    const cleaned = utr.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{8,30}$/.test(cleaned)) {
      setErr('Enter the 12-digit UPI reference (UTR) from your payment app.');
      return;
    }
    const r = await submitUtr({
      slug,
      payment_id: payment.payment_id,
      utr: cleaned,
    });
    if (!r.ok) {
      setErr(r.error?.message || 'Could not submit UTR. Please try again.');
      return;
    }
    onSubmitted?.();
  };

  return (
    <div>
      <div style={{
        background: 'oklch(0.97 0.02 250)', border: '1px solid var(--border)',
        borderRadius: '.5rem', padding: '1rem', marginBottom: '1rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem',
      }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="UPI payment QR"
            width={240}
            height={240}
            style={{ borderRadius: '.35rem', background: '#fff', display: 'block' }}
          />
        ) : (
          <div style={{ width: 240, height: 240, background: '#fff', borderRadius: '.35rem' }} aria-label="Loading QR" />
        )}
        <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>
          Scan with any UPI app (GPay, PhonePe, Paytm, BHIM…)
        </div>
      </div>

      <div style={{
        background: 'var(--muted)', borderRadius: '.5rem', padding: '.75rem 1rem', marginBottom: '.75rem',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '.5rem', alignItems: 'center',
        fontSize: '.85rem',
      }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Amount</span>
        <span style={{ fontWeight: 700 }}>
          {rupees(payment.amount_paise)}
          {payment.seat_count > 1 && (
            <span className="muted-text" style={{ fontWeight: 400, marginLeft: '.4rem' }}>
              ({payment.seat_count} seats × {rupees(payment.per_seat_paise)})
            </span>
          )}
        </span>
        <span />

        {Array.isArray(payment.attendees) && payment.attendees.length > 0 && (
          <>
            <span style={{ color: 'var(--muted-foreground)', alignSelf: 'start', paddingTop: '.2rem' }}>Also booking for</span>
            <span style={{ fontSize: '.8rem' }}>
              {payment.attendees.map((a) => a.name).join(', ')}
            </span>
            <span />
          </>
        )}

        <span style={{ color: 'var(--muted-foreground)' }}>Pay to</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>
          {payment.upi_id}
        </span>
        <button
          type="button"
          onClick={() => copy(payment.upi_id, 'UPI ID')}
          className="btn btn-ghost"
          style={{ padding: '.2rem .5rem', fontSize: '.75rem' }}
          aria-label="Copy UPI ID"
        >
          <IconCopy size="sm" /> Copy
        </button>
      </div>

      <p className="muted-text" style={{ fontSize: '.8rem', marginTop: 0, marginBottom: '1rem' }}>
        After paying, enter the UTR (transaction reference) below. Your registration is confirmed once the branch verifies the payment (usually within 24 hours).
      </p>

      <form onSubmit={handleSubmit}>
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
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
          <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
            Find it in your UPI app's transaction history — labelled "UPI Ref No" or "UTR".
          </div>
        </label>

        {err && (
          <div style={{
            background: 'oklch(0.96 0.04 25)', color: 'oklch(0.35 0.18 25)',
            border: '1px solid oklch(0.85 0.1 25)', padding: '.6rem .8rem',
            borderRadius: '.375rem', fontSize: '.8125rem', marginBottom: '.875rem',
          }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
            style={{ flex: 1 }}
          >
            Back
          </button>
          <Button
            type="submit"
            className="btn btn-primary"
            loading={loading}
            style={{ flex: 2, padding: '.6rem 1rem', fontWeight: 600 }}
          >
            {loading ? 'Submitting…' : 'I\'ve paid — submit UTR'}
          </Button>
        </div>
      </form>
    </div>
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
        {isPaid
          ? 'We\'ll verify your payment against the bank statement and email you the joining details — usually within 24 hours.'
          : 'We\'ll send the joining details to your email.'}
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

  // Debounced search — waits 250ms after typing stops before hitting the
  // API so hammering the keyboard doesn't spawn a request per keystroke.
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
        Search by name or email to add fellow members. Each additional seat is charged separately and the person will see the event on their own dashboard once your payment is verified.
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
                onMouseDown={(e) => e.preventDefault()}  /* keep focus so add() runs before blur */
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
