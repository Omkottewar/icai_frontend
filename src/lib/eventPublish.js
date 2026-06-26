import { adminFetch } from '../hooks/useAdminList';
import { dialog } from './dialog';

// Single source of truth for the "publish event" UX.
//
// The backend exposes ONE publish endpoint with optional `?override=true`.
// If the linked checklist isn't fully approved, the first attempt fails
// with a recognisable message. We catch that, ask the chairman to confirm
// the override + capture an audit reason, then retry.
//
// Two screens trigger this flow (EventQuickActions in the list, and the
// event detail drawer in EventsAdminPage). They used to copy-paste this
// logic, with the obvious risk that one would drift out of sync with
// the other — and that the override-detection string-match would silently
// break if the backend error wording ever changed.
//
// Behaviour:
//   • Returns { ok: true } on success.
//   • Returns { ok: false, reason: 'cancelled' } if the user dismissed the
//     override confirmation.
//   • Returns { ok: false, reason: 'error', message } on any other failure.
//
// `onSuccess` and `onError` callbacks are invoked with a human-readable
// message so callers can drive their own toast / state. Errors surfaced
// to onError are the raw message from the server (already user-friendly).

const NEEDS_OVERRIDE_MARKERS = [
  'not fully approved',
  'override',
];

function needsOverride(message) {
  const m = String(message || '').toLowerCase();
  return NEEDS_OVERRIDE_MARKERS.some((needle) => m.includes(needle));
}

export async function publishEventWithOverride(eventId, {
  onSuccess,
  onError,
  successMessage = 'Published — visible on the public site',
  overrideMessage = 'Published with override — recorded in audit log',
} = {}) {
  try {
    await adminFetch(`/api/admin/events/${eventId}/publish`, { method: 'POST' });
    onSuccess?.(successMessage);
    return { ok: true };
  } catch (err) {
    const msg = err?.message || '';
    if (!needsOverride(msg)) {
      onError?.(msg || 'Could not publish');
      return { ok: false, reason: 'error', message: msg };
    }

    const okay = await dialog.confirm({
      title: 'Override publish?',
      message:
        "This event's checklist isn't fully approved.\n\n"
        + 'Publishing now will be logged as a chairman override and visible '
        + 'in the audit trail. Continue?',
      confirmText: 'Override & publish',
      danger: true,
    });
    if (!okay) return { ok: false, reason: 'cancelled' };

    const reason = (await dialog.prompt({
      title: 'Override reason',
      message: 'Reason for override? (recorded in the audit log)',
      placeholder: 'Why is this override needed?',
      confirmText: 'Publish',
    })) || '';

    try {
      await adminFetch(
        `/api/admin/events/${eventId}/publish?override=true`,
        { method: 'POST', body: { reason: reason.trim() || null } },
      );
      onSuccess?.(overrideMessage);
      return { ok: true };
    } catch (err2) {
      const m = err2?.message || 'Override publish failed';
      onError?.(m);
      return { ok: false, reason: 'error', message: m };
    }
  }
}
