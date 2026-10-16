import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { dialog } from '../../lib/dialog';
import { IconCalendar, IconUser, IconMessageSquare, IconCheck, IconX } from '../../icons';

// Admin review queue for event-registration cancellation requests. Members
// no longer self-cancel — they file a request + reason here that an admin
// reviews. Approving triggers the actual cancellation (seat release, waitlist
// promotion, refund flag for paid rows). Rejecting leaves the registration
// active and emails the user with the admin's reason.

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    method: opts.method || 'GET',
    credentials: 'include',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || j.message || `HTTP ${r.status}`);
  return j;
}

export default function CancellationRequestsAdminPage() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const j = await api('/api/admin/events/cancellation-requests');
      setRows(j.rows || []);
    } catch (e) {
      setErr(e.message || 'Could not load');
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(row) {
    const ok = await dialog.confirm({
      title: 'Approve cancellation?',
      message: `Approve ${row.member_name}'s cancellation request for "${row.event_title}"?\n\nThis will release their seat, auto-promote the oldest waitlisted member (if any), and ${row.payment_id ? 'flag the payment for treasurer refund' : 'no refund is needed (free event)'}.`,
      confirmText: 'Approve cancellation',
      cancelText: 'Not now',
    });
    if (!ok) return;
    setBusyId(row.registration_id);
    try {
      const r = await api(`/api/admin/events/registrations/${row.registration_id}/approve-cancellation`, { method: 'POST' });
      showToast?.(r.promoted ? 'Approved — a waitlisted member was promoted.' : 'Approved — seat released.', 'success');
      await load();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row) {
    const reason = await dialog.prompt({
      title: 'Decline cancellation?',
      message: `Reason for declining ${row.member_name}'s cancellation request for "${row.event_title}". The member will see this in the rejection email.`,
      placeholder: 'e.g. event starts in less than 24 hours; cancellation window has closed; please contact branch for exceptions…',
      confirmText: 'Decline request',
      cancelText: 'Not now',
      multiline: true,
      required: true,
      requiredMessage: 'Please share a short reason (at least 5 characters).',
    });
    if (!reason) return;
    setBusyId(row.registration_id);
    try {
      await api(`/api/admin/events/registrations/${row.registration_id}/reject-cancellation`, {
        method: 'POST',
        body: { reject_reason: reason },
      });
      showToast?.('Request declined — member has been notified.', 'success');
      await load();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout
      title="Cancellation requests"
      subtitle="Members request to cancel their event registration; approve to release the seat, decline to keep them registered."
    >
      {err && (
        <div className="card" style={{ padding: '1rem', borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b', marginBottom: '1rem' }}>
          {err}
        </div>
      )}

      {rows === null ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <IconMessageSquare />
          <p className="muted-text" style={{ marginTop: '.5rem' }}>No pending cancellation requests.</p>
          <p className="muted-text" style={{ fontSize: '.8rem' }}>
            When a member files a cancellation request from their dashboard, it will show up here for your review.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.75rem' }}>
          {rows.map((row) => (
            <div key={row.registration_id} className="card" style={{ padding: '1rem 1.1rem' }}>
              <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{row.event_title}</div>
                  <div className="row gap-3" style={{ marginTop: '.3rem', fontSize: '.8rem', color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                    <span className="row gap-1"><IconCalendar size="sm" /> {fmtDate(row.event_starts_at)}</span>
                    {row.committee_name && <span>· {row.committee_name}</span>}
                    {row.payment_id && (
                      <span style={{ background: 'oklch(0.95 0.07 70)', color: 'oklch(0.42 0.14 70)', padding: '.1rem .4rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 600 }}>
                        Paid — refund required
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: '.6rem', padding: '.55rem .7rem', background: 'var(--muted)', borderRadius: '.4rem' }}>
                    <div className="row gap-1" style={{ fontSize: '.75rem', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '.2rem' }}>
                      <IconUser size="sm" /> {row.member_name} ({row.member_email}) · requested {fmtDate(row.requested_at)}
                    </div>
                    <div style={{ fontSize: '.875rem', whiteSpace: 'pre-wrap' }}>{row.reason}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busyId === row.registration_id}
                    onClick={() => reject(row)}
                    style={{ padding: '.4rem .75rem', fontSize: '.8125rem', color: '#dc2626', borderColor: 'rgba(220,38,38,.3)' }}
                  >
                    <IconX size="sm" /> Decline
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === row.registration_id}
                    onClick={() => approve(row)}
                    style={{ padding: '.4rem .75rem', fontSize: '.8125rem' }}
                  >
                    <IconCheck size="sm" /> Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
