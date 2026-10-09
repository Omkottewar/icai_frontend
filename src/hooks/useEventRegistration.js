import { useState, useCallback } from 'react';
import { apiWrite } from '../lib/apiCache';

// Orchestrates the two-step SabPaisa registration flow:
//
//   startRegister({ slug, phone, attendee_user_ids })
//     POST /api/events/:slug/register
//       → paid=false → registration created immediately, done
//       → paid=true  → returns { payment_id, sabpaisa: { action, clientCode,
//                       encData }, amount_paise, ... } so the modal can
//                       auto-POST a form to SabPaisa's hosted checkout.
//
// After the user pays on SabPaisa's page, SabPaisa redirects back to our
// /api/payments/return endpoint which then 302s the browser to the SPA's
// /payments/result page. Nothing to do in this hook post-redirect — the
// result page handles status display and the "back to event" link.
//
// Compared to the UPI-manual flow we removed in migration 0100, there is
// no `submitUtr` step anymore — SabPaisa confirms payment server-to-server.
export function useEventRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startRegister = useCallback(async ({ slug, phone, attendee_user_ids }) => {
    setLoading(true);
    setError(null);
    try {
      // No cache invalidation here — paid /register does NOT create an
      // event_registrations row (SabPaisa's callback does). Refetching the
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
