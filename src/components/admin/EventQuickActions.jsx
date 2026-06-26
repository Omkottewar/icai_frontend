import { useState } from 'react';
import { adminFetch } from '../../hooks/useAdminList';
import { useRoleFlags } from '../../hooks/useRoleFlags';
import { dialog } from '../../lib/dialog';
import { publishEventWithOverride } from '../../lib/eventPublish';

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
// Visibility: matches the backend gate exactly — only admin + branch_chairman
// can publish or cancel. Vice-chairman, committee chairmen, treasurers,
// accountants etc. don't see these buttons even though they might land on
// this page for other reasons (e.g. filling a checklist).

export default function EventQuickActions({ row, onChanged, showToast }) {
  const [busy, setBusy] = useState(false);
  const { codes } = useRoleFlags();
  const canManageEvents = codes.has('admin') || codes.has('branch_chairman');
  const s = row.status;

  const onPublish = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const result = await publishEventWithOverride(row.id, {
        onSuccess: (m) => showToast?.(m, 'success'),
        onError:   (m) => showToast?.(m, 'error'),
      });
      if (result.ok) onChanged?.();
    } finally { setBusy(false); }
  };

  const onCancel = async (e) => {
    e.stopPropagation();
    const ok = await dialog.confirm({
      title: 'Cancel event?',
      message: 'Cancel this event? Registered attendees will no longer see it.',
      confirmText: 'Cancel event',
      cancelText: 'Back',
      danger: true,
    });
    if (!ok) return;
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
  if (!canManageEvents) return null;

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
