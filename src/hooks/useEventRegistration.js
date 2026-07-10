import { useState, useCallback } from 'react';
import { apiWrite } from '../lib/apiCache';

// Orchestrates the two-step UPI QR registration flow:
//
//   startRegister({ slug, phone })
//     POST /api/events/:slug/register
//       → paid=false → registration created immediately, done
//       → paid=true  → returns { payment_id, upi_uri, amount_paise, ...}
//                       so the modal can render the QR + UTR form
//
//   submitUtr({ slug, payment_id, utr, screenshot_file_id? })
//     POST /api/events/:slug/submit-utr
//     Flips payment status to 'pending_verification' — no registration
//     row created yet, that happens on admin approve.
//
// Compared to the old Razorpay flow, we no longer own an interactive
// checkout — the user leaves the browser to pay in their UPI app. On
// return they type the UTR into our form.
export function useEventRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startRegister = useCallback(async ({ slug, phone }) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiWrite(`/api/events/${encodeURIComponent(slug)}/register`, {
        body: { phone },
        invalidates: '/api/events',
      });
      return { ok: true, ...resp };
    } catch (e) {
      setError(e);
      return { ok: false, error: e };
    } finally {
      setLoading(false);
    }
  }, []);

  const submitUtr = useCallback(async ({ slug, payment_id, utr, screenshot_file_id }) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiWrite(`/api/events/${encodeURIComponent(slug)}/submit-utr`, {
        body: { payment_id, utr, screenshot_file_id: screenshot_file_id || null },
        invalidates: '/api/events',
      });
      return { ok: true, ...resp };
    } catch (e) {
      setError(e);
      return { ok: false, error: e };
    } finally {
      setLoading(false);
    }
  }, []);

  return { startRegister, submitUtr, loading, error };
}
