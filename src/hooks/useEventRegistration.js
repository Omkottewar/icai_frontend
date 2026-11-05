import { useState, useCallback } from 'react';
import { apiWrite } from '../lib/apiCache';

// Orchestrates the two-step Razorpay registration flow:
//
//   startRegister({ slug, phone, attendee_user_ids })
//     POST /api/events/:slug/register
//       → paid=false → registration created immediately, done
//       → paid=true  → returns { payment_id, razorpay: { key_id, order_id,
//                       amount_paise, currency, prefill }, amount_paise,
//                       ... } so the modal can open Razorpay Checkout.
//
// After the user pays in the Razorpay modal, the handler POSTs the
// signature to /api/payments/verify, we confirm server-side, and the
// SPA navigates to /payments/result for the status page. Nothing to do
// in this hook post-payment.
export function useEventRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startRegister = useCallback(async ({ slug, phone, attendee_user_ids }) => {
    setLoading(true);
    setError(null);
    try {
      // No cache invalidation here — paid /register does NOT create an
      // event_registrations row (razorpay/confirm.ts does). Refetching the
      // events listing would find no change.
      const resp = await apiWrite(`/api/events/${encodeURIComponent(slug)}/register`, {
        body: {
          phone,
          attendee_user_ids: Array.isArray(attendee_user_ids) ? attendee_user_ids : [],
        },
      });
      return { ok: true, ...resp };
    } catch (e) {
      setError(e);
      return { ok: false, error: e };
    } finally {
      setLoading(false);
    }
  }, []);

  return { startRegister, loading, error };
}
