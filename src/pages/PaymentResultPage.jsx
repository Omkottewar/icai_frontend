import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconCheckCircle, IconX } from '../icons';

// GET /payments/result?status=success|failed|aborted|pending&payment_id=...
//
// Landing page after SabPaisa redirects the user back to the SPA via our
// /api/payments/return handler. The URL query carries the server's
// verified outcome, but we re-fetch /api/payments/:id/status so the UI
// reflects the latest row state (webhook may have arrived between
// redirect and this page's mount).
//
// Pending status polls every 3 seconds for up to 60s — long enough that
// SabPaisa's webhook almost always resolves the row before the user has
// to refresh manually.

const STATUS_COPY_FALLBACK = {
  success: {
    heading: 'Payment successful',
    body: "Thank you — we've received your payment. A confirmation email with your registration details is on its way.",
  },
  failed: {
    heading: 'Payment failed',
    body: 'Your payment could not be completed. No amount has been charged. Please try again, or contact the branch office if your bank shows a successful debit.',
  },
  aborted: {
    heading: 'Payment cancelled',
    body: "You cancelled the payment before it was completed. No amount has been charged. You can try again whenever you're ready.",
  },
  pending: {
    heading: 'Payment is being confirmed',
    body: 'Your bank has not yet confirmed the payment outcome to us. This usually resolves within a minute — the page will update automatically. If it stays here for more than a few minutes, your bank may send the confirmation via email instead; contact the branch office if debited but still not confirmed.',
  },
};

export default function PaymentResultPage() {
  const route = useRoute();
  const copy = useSiteContent('payment_result_screens');
  const initialStatus = (route.query.status || 'pending').toLowerCase();
  const paymentId = route.query.payment_id || null;
  const eventSlug = route.query.event_slug || null;

  const [status, setStatus] = useState(initialStatus);
  const [payment, setPayment] = useState(null);
  const [event, setEvent] = useState(null);
  const [attempts, setAttempts] = useState(0);

  // Fetch /status once on mount, then poll while pending.
  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;

    const loadOnce = async () => {
      try {
        const r = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/status`, { credentials: 'include' });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        if (j.payment?.status === 'success')  setStatus('success');
        else if (j.payment?.status === 'failed') setStatus('failed');
        // Otherwise keep current status; row might still be 'pending'.
        setPayment(j.payment || null);
        setEvent(j.event || null);
      } catch { /* swallow */ }
    };

    loadOnce();

    if (status === 'pending') {
      const t = setInterval(() => {
        setAttempts((a) => a + 1);
        loadOnce();
      }, 3000);
      // 20 attempts × 3s = 60s window. After that the user is on their
      // own — the webhook will still land eventually and the row updates
      // in the DB; refresh will show the final state.
      const stopAt = setTimeout(() => clearInterval(t), 60_000);
      return () => { cancelled = true; clearInterval(t); clearTimeout(stopAt); };
    }

    return () => { cancelled = true; };
  }, [paymentId, status]);

  const key = status in STATUS_COPY_FALLBACK ? status : 'pending';
  const fallback = STATUS_COPY_FALLBACK[key];
  const heading = copy[`${key}_heading`] || fallback.heading;
  const body    = copy[`${key}_body`]    || fallback.body;

  const isSuccess = key === 'success';
  const isPendingPoll = key === 'pending';
  const amount = payment?.amount_paise ? `₹${(payment.amount_paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : null;

  return (
    <>
      <PageHeader
        title={heading}
        subtitle={isPendingPoll && attempts > 0 ? `Checking with the bank… (${attempts})` : undefined}
      />
      <section className="container" style={{ padding: '2.5rem 1rem', maxWidth: '46rem' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '3.5rem', height: '3.5rem', borderRadius: '999px',
            marginBottom: '.85rem',
            background: isSuccess
              ? 'oklch(0.95 0.08 145)'
              : key === 'failed' || key === 'aborted'
                ? 'oklch(0.96 0.04 25)'
                : 'oklch(0.95 0.05 240)',
            color: isSuccess
              ? 'oklch(0.42 0.18 145)'
              : key === 'failed' || key === 'aborted'
                ? 'oklch(0.42 0.2 25)'
                : 'oklch(0.35 0.14 240)',
          }}>
            {isSuccess ? <IconCheckCircle /> : key === 'failed' || key === 'aborted' ? <IconX /> : <Spinner />}
          </div>

          <div style={{ fontSize: '.95rem', lineHeight: 1.65, textAlign: 'left', maxWidth: '34rem', margin: '0 auto' }}>
            {renderMarkdown(body)}
          </div>

          {payment && amount && (
            <div className="muted-text" style={{
              marginTop: '1.25rem', fontSize: '.78rem',
              display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center',
            }}>
              <span>Amount: <strong>{amount}</strong></span>
              {payment.sabpaisa_txn_id && (
                <span>Txn ID: <code style={{ fontSize: '.72rem' }}>{payment.sabpaisa_txn_id}</code></span>
              )}
              {payment.sabpaisa_payment_mode && (
                <span>Mode: {payment.sabpaisa_payment_mode}</span>
              )}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {isSuccess && (
              <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ padding: '.5rem 1.25rem' }}>
                View my dashboard
              </button>
            )}
            {(key === 'failed' || key === 'aborted') && eventSlug && (
              <button onClick={() => navigate(`/events?event=${encodeURIComponent(eventSlug)}`)} className="btn btn-primary" style={{ padding: '.5rem 1.25rem' }}>
                Try again
              </button>
            )}
            <button onClick={() => navigate('/events')} className="btn btn-outline" style={{ padding: '.5rem 1.25rem' }}>
              {event?.title ? `Back to ${event.title}` : 'Back to events'}
            </button>
          </div>
        </div>
      </section>
    </>
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
