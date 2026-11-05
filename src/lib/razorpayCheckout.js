// Razorpay Checkout helper — loads the hosted Checkout.js script on first
// use, opens the modal with a given order, and verifies the handler
// payload against our backend before navigating to /payments/result.
//
// Used by all three paid surfaces:
//   • EventRegisterModal           — paid event registration
//   • EmployerPostingFormPage      — new job posting fee
//   • EmployerPostingsPage         — retry pay on a pending_payment posting
//   • admin PaymentsAdminPage      — admin test launcher
//
// Returns a Promise that resolves once the modal closes (success or
// cancel). On cancel, calls opts.onCancel and then resolves with
// { cancelled: true }. On success, posts to /api/payments/verify and then
// calls navigate('/payments/result?...') so the user lands on the status
// screen — the caller doesn't need to handle success routing.

import { navigate } from '../hooks/useRoute';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoadPromise = null;

function loadRazorpayScript() {
  // One <script> tag per SPA session. Cached so repeat opens don't re-fetch.
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = SCRIPT_URL;
    tag.async = true;
    tag.onload  = () => resolve();
    tag.onerror = () => {
      // Clear the cached promise so a retry can re-attempt (mobile
      // networks sometimes drop the first script fetch).
      scriptLoadPromise = null;
      reject(new Error('Could not load Razorpay. Check your internet connection and try again.'));
    };
    document.body.appendChild(tag);
  });
  return scriptLoadPromise;
}

// opts:
//   razorpay:     { key_id, order_id, amount_paise, currency, prefill }
//                 as returned by /api/events/:slug/register,
//                 /api/employer/postings, etc.
//   payment_id:   our payment row id (for the /verify POST + result URL)
//   name:         merchant display name shown in the modal header
//   description:  one-line description shown under the amount
//   onCancel:     optional callback fired when the user closes the modal
//                 without paying. Also resolves the returned Promise with
//                 { cancelled: true } so awaiting callers can branch.
//   resultBase:   override the /payments/result URL (default is the SPA's
//                 /payments/result route).
export async function openRazorpayCheckout({
  razorpay,
  payment_id,
  name = 'ICAI Nagpur Branch',
  description = 'Payment',
  onCancel,
  resultBase = '/payments/result',
} = {}) {
  if (!razorpay?.key_id || !razorpay?.order_id) {
    throw new Error('Razorpay checkout payload is missing key_id or order_id');
  }
  if (!payment_id) {
    throw new Error('payment_id is required so the verify + result steps can locate the row');
  }

  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key:         razorpay.key_id,
      amount:      razorpay.amount_paise,  // paise
      currency:    razorpay.currency || 'INR',
      order_id:    razorpay.order_id,
      name,
      description,
      prefill: {
        name:    razorpay.prefill?.name ?? '',
        email:   razorpay.prefill?.email ?? '',
        contact: razorpay.prefill?.contact ?? '',
      },
      notes: {
        payment_id,
      },
      theme: {
        // Match the branch's primary brand token so the modal header
        // doesn't clash. Swap this for a site-content slot later if we
        // want admin-tunable branding.
        color: '#0b3d91',
      },
      modal: {
        // escape dismisses, backdrop dismisses. Both fire ondismiss.
        escape: true,
        ondismiss: () => {
          // User closed the modal without paying. Tell the server so the
          // row flips to failed (otherwise it sits in `pending` until the
          // 15-min stale-sweep hides it). Fire-and-forget — don't block
          // UX on this.
          fetch('/api/payments/cancelled', {
            method:      'POST',
            credentials: 'include',
            headers:     { 'content-type': 'application/json' },
            body:        JSON.stringify({ payment_id }),
          }).catch(() => { /* swallow */ });
          onCancel?.();
          resolve({ cancelled: true });
        },
      },
      handler: async (response) => {
        // Razorpay fires this with the three fields on successful capture.
        // Verify the signature on our backend before showing the success
        // UI — a client-only "trust" is a known pentest finding on
        // Razorpay integrations.
        try {
          const r = await fetch('/api/payments/verify', {
            method:      'POST',
            credentials: 'include',
            headers:     { 'content-type': 'application/json' },
            body:        JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error ?? 'Could not confirm payment');

          // Navigate to the result page with status hint from the verify
          // response. If verify came back pending (confirm threw server-
          // side), the result page polls /status and will flip to
          // success/failed once the reconciliation or webhook catches up.
          const status = j.status === 'success' ? 'success' : 'pending';
          navigate(`${resultBase}?status=${status}&payment_id=${encodeURIComponent(payment_id)}`);
          resolve({ ok: true, status });
        } catch (err) {
          // Money landed on Razorpay but our /verify failed. Route the
          // user to the pending page — the webhook + reconciliation cron
          // will resolve the row.
          navigate(`${resultBase}?status=pending&payment_id=${encodeURIComponent(payment_id)}`);
          reject(err);
        }
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        // Non-fatal from the modal's POV (Razorpay keeps the modal open
        // so the user can retry). We just route to the failed result
        // page if the modal is ultimately dismissed; the ondismiss
        // handler covers that path.
        // eslint-disable-next-line no-console
        console.warn('[razorpay] payment.failed', resp?.error);
      });
      rzp.open();
    } catch (err) {
      reject(err);
    }
  });
}
