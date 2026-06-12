import { useState } from 'react';
import { adminFetch } from '../../hooks/useAdminList';
import { useRoleFlags } from '../../hooks/useRoleFlags';

// Inline approve / publish / cancel buttons that live on each row of the
// EventsAdminPage table. Saves the chairman from having to open the full
// drawer to perform a one-click action.
//
// Decision rules:
//   - status='draft' or 'pending_approval' or 'approved' → "Approve & publish"
//   - status='published' → "Cancel" (less prominent, requires confirm)
//   - status='cancelled' / 'completed' → nothing
//
// "Approve & publish" is the chairman's override path (Section R.5 in the
// requirements). For events that went through the checklist properly, the
// auto-publish trigger has already fired; this button is there for events
// that don't need a checklist OR for chairmen who want to short-circuit.
//
// Visibility: matches the backend gate exactly — only branch leadership
// (admin / chairman / VC) can publish or cancel. Committee chairmen,
// treasurers, accountants etc. don't see these buttons even though they
// might land on this page for other reasons.

export default function EventQuickActions({ row, onChanged, showToast }) {
  const [busy, setBusy] = useState(false);
  const { codes } = useRoleFlags();
  const canPublishCancel = codes.has('admin')
    || codes.has('branch_chairman')
    || codes.has('branch_vice_chairman');
  const s = row.status;

  const onPublish = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      // First attempt: no override. Backend returns 400 if the linked
      // checklist isn't fully approved.
      await adminFetch(`/api/admin/events/${row.id}/publish`, { method: 'POST' });
      showToast?.('Published — visible on the public site', 'success');
      onChanged?.();
    } catch (err) {
      const msg = err?.message || '';
      // Specific error shape from backend means "checklist not approved".
      // Offer the override path with a strong confirm; otherwise just toast.
      if (msg.includes('not fully approved') || msg.includes('override')) {
        const okay = confirm(
          "This event's checklist isn't fully approved.\n\n" +
          'Publishing now will be logged as a chairman override and visible ' +
          'in the audit trail. Continue?',
        );
        if (!okay) { setBusy(false); return; }
        const reason = prompt('Reason for override? (recorded in the audit log)') || '';
        try {
          await adminFetch(
            `/api/admin/events/${row.id}/publish?override=true`,
            { method: 'POST', body: { reason: reason.trim() || null } },
          );
          showToast?.('Published with override — recorded in audit log', 'success');
          onChanged?.();
        } catch (err2) {
          showToast?.(err2.message || 'Override publish failed', 'error');
        }
      } else {
        showToast?.(msg || 'Could not publish', 'error');
      }
    } finally { setBusy(false); }
  };

  const onCancel = async (e) => {
    e.stopPropagation();
    if (!confirm('Cancel this event? Registered attendees will no longer see it.')) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/events/${row.id}/cancel`, { method: 'POST' });
      showToast?.('Event cancelled', 'success');
      onChanged?.();
    } catch (err) {
      showToast?.(err.message || 'Could not cancel', 'error');
    } finally { setBusy(false); }
  };

  if (s === 'cancelled' || s === 'completed') return null;
  if (!canPublishCancel) return null;

  return (
    <div className="event-qa-cell">
      {(s === 'draft' || s === 'pending_approval' || s === 'approved') && (
        <button
          type="button"
          onClick={onPublish}
          disabled={busy}
          className="event-qa-btn event-qa-publish"
          title="Approve and publish to the public site"
        >
          {busy ? '…' : 'Publish'}
        </button>
      )}
      {s === 'published' && (
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="event-qa-btn event-qa-cancel"
          title="Cancel this event"
        >
          {busy ? '…' : 'Cancel'}
        </button>
      )}

      <style>{`
        .event-qa-cell { display: flex; gap: .25rem; }
        .event-qa-btn {
          padding: .2rem .55rem;
          font-size: .7rem; font-weight: 600;
          border-radius: .25rem; border: 1px solid transparent;
          cursor: pointer;
          transition: opacity .15s, background .15s;
        }
        .event-qa-btn:disabled { opacity: .5; cursor: wait; }
        .event-qa-publish {
          background: #16a34a; color: white;
        }
        .event-qa-publish:hover:not(:disabled) { background: #15803d; }
        .event-qa-cancel {
          background: transparent; color: #b91c1c;
          border-color: #fecaca;
        }
        .event-qa-cancel:hover:not(:disabled) { background: #fee2e2; }
      `}</style>
    </div>
  );
}
