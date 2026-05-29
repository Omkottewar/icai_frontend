import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEventRegistration } from '../../hooks/useEventRegistration';
import { navigate } from '../../hooks/useRoute';
import { IconX, IconCheckCircle, IconLock, IconCalendar, IconMapPin } from '../../icons';

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

// Modal launched from EventRow when a user clicks Register. Two flows:
//   • fee_paise === 0 → "Confirm Registration"
//   • fee_paise  >  0 → "Pay ₹X & Register" → opens Razorpay Checkout
// The hook owns the network + Razorpay dance; this component owns the UI state.
export default function EventRegisterModal({ event, onClose, onRegistered }) {
  const { user, showToast } = useAuth();
  const { register, loading } = useEventRegistration();

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { setPhone(user?.phone ?? ''); }, [user]);

  // Esc to close. Skip while a payment is in flight — closing the modal
  // mid-checkout would orphan the Razorpay popup.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, loading]);

  const isPaid = Number(event?.fee_paise || 0) > 0;
  const capacityFull = event?.capacity != null && Number(event.registered_count || 0) >= Number(event.capacity);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);

    if (!event?.slug) { setErr('This event is missing a slug — cannot register.'); return; }
    if (!/^\+?\d[\d\s-]{7,}$/.test(phone.trim())) {
      setErr('Please enter a valid phone number so we can reach you about this event.');
      return;
    }

    const result = await register({ slug: event.slug, phone: phone.trim() });
    if (result.ok) {
      setDone(true);
      onRegistered?.();
      showToast?.(isPaid ? 'Payment successful — you are registered!' : 'You are registered!', 'success');
    } else {
      setErr(result.error?.message || 'Something went wrong. Please try again.');
    }
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
          ) : done ? (
            <SuccessState isPaid={isPaid} onClose={onClose} />
          ) : capacityFull ? (
            <CapacityFullState onClose={onClose} />
          ) : (
            <form onSubmit={handleSubmit}>
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

              {/* Fee summary box */}
              <div style={{
                background: 'var(--muted)', borderRadius: '.5rem',
                padding: '.85rem 1rem', marginBottom: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: '.8125rem', color: 'var(--muted-foreground)' }}>
                  {isPaid ? 'Registration fee' : 'Registration'}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {isPaid ? rupees(event.fee_paise) : 'Free'}
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

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '.7rem 1rem', fontWeight: 600 }}
              >
                {loading
                  ? (isPaid ? 'Opening payment…' : 'Registering…')
                  : (isPaid ? `Pay ${rupees(event.fee_paise)} & Register` : 'Confirm Registration')}
              </button>

              {isPaid && (
                <div className="muted-text" style={{ fontSize: '.7125rem', marginTop: '.6rem', textAlign: 'center' }}>
                  <span className="row gap-1" style={{ justifyContent: 'center' }}>
                    <IconLock size="sm" /> Secured by Razorpay
                  </span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
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
        You're registered!
      </h4>
      <div className="muted-text" style={{ fontSize: '.875rem', marginBottom: '1.25rem' }}>
        {isPaid
          ? 'Payment confirmed. We\'ll send the joining details to your email.'
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
