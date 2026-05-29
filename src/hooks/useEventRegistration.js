import { useState, useCallback } from 'react';
import { apiWrite } from '../lib/apiCache';
import { loadRazorpay } from '../lib/razorpay';

// Orchestrates the full registration flow for a single event:
//
//   register({ slug, phone })
//     1. POST /api/events/:slug/register
//        a. paid=false → done, return { ok: true, paid: false }
//        b. paid=true  → open Razorpay Checkout
//     2. On Razorpay success:
//        POST /api/events/:slug/verify-payment with the signed handles
//        → return { ok: true, paid: true }
//     3. On dismiss/cancel/failure: return { ok: false, error }
//
// The component owns the form + UI; this hook owns the network + checkout
// dance and exposes loading state so the button can show a spinner.
export function useEventRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const register = useCallback(async ({ slug, phone }) => {
    setLoading(true);
    setError(null);
    try {
      const startResp = await apiWrite(`/api/events/${encodeURIComponent(slug)}/register`, {
        body: { phone },
        invalidates: '/api/events',
      });

      if (!startResp.paid) {
        return { ok: true, paid: false, registration: startResp.registration };
      }

      const Razorpay = await loadRazorpay();

      const verifyResult = await new Promise((resolve) => {
        const rzp = new Razorpay({
          key:        startResp.key_id,
          amount:     startResp.amount_paise,
          currency:   startResp.currency || 'INR',
          order_id:   startResp.order_id,
          name:       'ICAI Nagpur Branch',
          description: startResp.event?.title || 'Event registration',
          prefill:    startResp.prefill || {},
          theme:      { color: '#0b3d91' },
          modal: {
            ondismiss: () => resolve({ ok: false, error: new Error('Payment cancelled') }),
          },
          handler: async (rzpResp) => {
            try {
              const verified = await apiWrite(
                `/api/events/${encodeURIComponent(slug)}/verify-payment`,
                {
                  body: {
                    payment_id: startResp.payment_id,
                    razorpay_order_id: rzpResp.razorpay_order_id,
                    razorpay_payment_id: rzpResp.razorpay_payment_id,
                    razorpay_signature: rzpResp.razorpay_signature,
                  },
                  invalidates: '/api/events',
                },
              );
              resolve({ ok: true, paid: true, registration: verified.registration });
            } catch (e) {
              resolve({ ok: false, error: e });
            }
          },
        });

        // Razorpay surfaces card-decline / network errors as `payment.failed`.
        // We forward those into the same promise so the caller can show a toast.
        rzp.on?.('payment.failed', (ev) => {
          const reason = ev?.error?.description || 'Payment failed';
          resolve({ ok: false, error: new Error(reason) });
        });

        rzp.open();
      });

      if (!verifyResult.ok) setError(verifyResult.error);
      return verifyResult;
    } catch (e) {
      setError(e);
      return { ok: false, error: e };
    } finally {
      setLoading(false);
    }
  }, []);

  return { register, loading, error };
}
