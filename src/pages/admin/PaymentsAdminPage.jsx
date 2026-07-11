import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerLines } from '../../components/ui/Shimmer';
import { IconX } from '../../icons';
import { dialog } from '../../lib/dialog';

// ─── /admin/payments ───────────────────────────────────────────────────────
// Two surfaces on one page:
//   1. Pending UPI verifications — action queue at the top. Every row is a
//      user waiting for the branch to confirm their UTR against the bank
//      statement. Approve → creates the event registration + fires the
//      confirmation email. Reject → notifies the user with a reason.
//   2. All payments — historical listing with filters, unchanged.
// Razorpay refs still surface in the history for old rows; new rows show
// UPI UTR instead.

const STATUSES = ['', 'success', 'failed', 'created', 'pending', 'pending_verification', 'refunded', 'partially_refunded'];
const PURPOSES = ['', 'event_registration', 'cop_renewal', 'firm_registration', 'job_posting',
  'assignment_posting', 'cabf_donation', 'consultation', 'room_booking', 'other'];

export default function PaymentsAdminPage() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', purpose: '', q: '' });
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pending, setPending] = useState(null);
  const [pendingBusyId, setPendingBusyId] = useState(null);

  async function loadPending() {
    try {
      const r = await fetch('/api/admin/payments/pending-verification', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setPending(j.rows || []);
    } catch (e) {
      showToast?.(e.message, 'error');
      setPending([]);
    }
  }

  async function approve(row) {
    const ok = await dialog.confirm({
      title: 'Approve payment?',
      message: `Confirm that ₹${(row.amount_paise / 100).toLocaleString('en-IN')} from ${row.payer_name || row.payer_email} (UTR ${row.upi_utr}) has landed in the bank account. This creates the event registration and emails the confirmation.`,
      confirmText: 'Approve',
    });
    if (!ok) return;
    setPendingBusyId(row.payment_id);
    try {
      const r = await fetch(`/api/admin/payments/${row.payment_id}/approve`, { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(j.waitlisted ? 'Approved — event was full, user is on waitlist.' : 'Payment approved. Registration confirmed.', 'success');
      await Promise.all([loadPending(), load(), loadSummary()]);
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setPendingBusyId(null); }
  }

  async function reject(row) {
    const reason = await dialog.prompt({
      title: 'Reject payment',
      message: `Why is this being rejected? The user will be emailed the reason and can retry.`,
      placeholder: 'e.g. UTR not found in bank statement',
      okText: 'Reject',
      required: true,
    });
    if (!reason) return;
    setPendingBusyId(row.payment_id);
    try {
      const r = await fetch(`/api/admin/payments/${row.payment_id}/reject`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.('Payment rejected. User has been notified.', 'success');
      await Promise.all([loadPending(), load(), loadSummary()]);
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setPendingBusyId(null); }
  }

  async function load() {
    setRows(null);
    const qs = new URLSearchParams();
    if (filters.status)  qs.set('status', filters.status);
    if (filters.purpose) qs.set('purpose', filters.purpose);
    if (filters.q)       qs.set('q', filters.q);
    qs.set('page', String(page));
    qs.set('pageSize', '50');
    try {
      const r = await fetch(`/api/admin/payments?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
      setTotal(j.total);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  }

  async function loadSummary() {
    try {
      const r = await fetch('/api/admin/payments/summary?days=30', { credentials: 'include' });
      const j = await r.json();
      if (r.ok) setSummary(j);
    } catch { /* silent */ }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, filters.status, filters.purpose]);
  useEffect(() => { loadSummary(); loadPending(); /* eslint-disable-next-line */ }, []);

  return (
    <AdminLayout
      title="Payments"
      subtitle="UPI verifications up top — approve or reject each submitted UTR. Full history below."
    >
      <PendingVerificationSection
        rows={pending}
        busyId={pendingBusyId}
        onApprove={approve}
        onReject={reject}
      />

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.75rem', marginBottom: '1.25rem' }}>
          <StatCard label={`Success (${summary.window_days}d)`} value={`₹${(summary.success_paise / 100).toLocaleString('en-IN')}`} sub={`${summary.success_count} txns`} />
          <StatCard label="Refunded" value={`₹${(summary.refunded_paise / 100).toLocaleString('en-IN')}`} tone={summary.refunded_paise > 0 ? 'warn' : null} />
          <StatCard label="Failed" value={`₹${(summary.failed_paise / 100).toLocaleString('en-IN')}`} sub={`${summary.failed_count} txns`} tone={summary.failed_count > 5 ? 'warn' : null} />
          <StatCard label="Total transactions" value={summary.total_count} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <select className="input-base" value={filters.status}
          onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s : 'All statuses'}</option>)}
        </select>
        <select className="input-base" value={filters.purpose}
          onChange={(e) => { setPage(1); setFilters({ ...filters, purpose: e.target.value }); }}>
          {PURPOSES.map((p) => <option key={p} value={p}>{p ? p : 'All purposes'}</option>)}
        </select>
        <input className="input-base" placeholder="Search by UTR or payment id…" style={{ flex: 1, minWidth: 220 }}
          value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Created</th>
              <th style={th}>Payer</th>
              <th style={th}>Purpose</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Reference</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={7} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No payments match your filters.
              </td></tr>
            )}
            {rows && rows.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}>{formatDate(p.created_at)}</td>
                <td style={td}>
                  <div>{p.payer_name || <span className="muted-text">—</span>}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>{p.payer_email}</div>
                </td>
                <td style={td}>{p.purpose}</td>
                <td style={td}>
                  <strong>₹{(p.amount_paise / 100).toLocaleString('en-IN')}</strong>
                  {p.refunded_paise > 0 && (
                    <div className="muted-text" style={{ fontSize: '.75rem', color: '#dc2626' }}>
                      − ₹{(p.refunded_paise / 100).toLocaleString('en-IN')} refunded
                    </div>
                  )}
                </td>
                <td style={td}><StatusPill status={p.status} /></td>
                <td style={td}>
                  {p.upi_utr && (
                    <div style={{ fontFamily: 'monospace', fontSize: '.75rem' }} title="UPI UTR">{p.upi_utr}</div>
                  )}
                  {!p.upi_utr && p.razorpay_payment_id && (
                    <div style={{ fontFamily: 'monospace', fontSize: '.75rem' }} title="Razorpay payment">{p.razorpay_payment_id}</div>
                  )}
                  {!p.upi_utr && !p.razorpay_payment_id && p.razorpay_order_id && (
                    <div style={{ fontFamily: 'monospace', fontSize: '.75rem' }} className="muted-text" title="Razorpay order">{p.razorpay_order_id}</div>
                  )}
                  {!p.upi_utr && !p.razorpay_order_id && <span className="muted-text">—</span>}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={btnSm} onClick={() => setDetail(p)}>Detail</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageSize={50} total={total} onChange={setPage} />

      {detail && <DetailDrawer payment={detail} onClose={() => setDetail(null)} />}
    </AdminLayout>
  );
}

// Action queue for UPI payments awaiting verification. Renders zero rows
// as a friendly empty state rather than being hidden — admins should see
// at a glance that the queue is clear (or that there's nothing to do).
function PendingVerificationSection({ rows, busyId, onApprove, onReject }) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.5rem' }}>
        Pending UPI verifications {rows && rows.length > 0 && <span style={{
          background: '#fef3c7', color: '#92400e', padding: '.1rem .5rem',
          borderRadius: 999, fontSize: '.72rem', marginLeft: '.4rem',
        }}>{rows.length}</span>}
      </h2>
      {rows === null && <ShimmerLines count={2} />}
      {rows !== null && rows.length === 0 && (
        <p className="muted-text" style={{ fontSize: '.85rem', margin: 0 }}>
          No payments waiting for verification.
        </p>
      )}
      {(rows ?? []).map((r) => {
        const busy = busyId === r.payment_id;
        return (
          <div key={r.payment_id} className="card" style={{
            padding: '.85rem 1rem', marginBottom: '.5rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: '.75rem', alignItems: 'center',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '.95rem' }}>{r.payer_name || r.payer_email}</strong>
                <span className="muted-text" style={{ fontSize: '.72rem' }}>{r.payer_email}</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{(r.amount_paise / 100).toLocaleString('en-IN')}</span>
              </div>
              <div className="muted-text" style={{ fontSize: '.78rem', marginTop: '.15rem' }}>
                {r.event_title || <em>Unknown event</em>}
                {r.event_starts_at && ` · ${formatDate(r.event_starts_at)}`}
              </div>
              <div style={{ fontSize: '.78rem', marginTop: '.35rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted-text">UTR</span>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.upi_utr}</span>
                {r.screenshot_url && (
                  <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: '.72rem', color: '#0b3d91', textDecoration: 'underline',
                  }}>View screenshot</a>
                )}
                <span className="muted-text">· submitted {formatDate(r.submitted_at)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onApprove(r)}
                style={{ padding: '.35rem .8rem', fontSize: '.8rem' }}
              >
                {busy ? '…' : 'Approve'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => onReject(r)}
                style={{ padding: '.35rem .8rem', fontSize: '.8rem', color: '#dc2626' }}
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DetailDrawer({ payment, onClose }) {
  const { showToast } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/payments/${payment.id}`, { credentials: 'include' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed');
        setData(j);
      } catch (e) { showToast?.(e.message, 'error'); }
    })();
  }, [payment.id]); // eslint-disable-line

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 100 }}
         onClick={onClose}
         role="dialog" aria-modal="true" aria-labelledby="payment-detail-title">
      <div style={{ background: 'white', height: '100%', width: 'min(560px, 95vw)', padding: '1.5rem', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="payment-detail-title" style={{ margin: 0, fontSize: '1.25rem' }}>Payment detail</h2>
          <button className="btn btn-ghost" style={{ padding: '.25rem' }} onClick={onClose} aria-label="Close details"><IconX /></button>
        </div>

        {!data && <ShimmerLines count={6} />}
        {data && (
          <>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '.5rem 1rem', fontSize: '.875rem' }}>
                <span className="muted-text">Amount</span><strong>₹{(data.payment.amount_paise / 100).toLocaleString('en-IN')}</strong>
                <span className="muted-text">Status</span><StatusPill status={data.payment.status} />
                <span className="muted-text">Purpose</span><span>{data.payment.purpose}</span>
                <span className="muted-text">Payer</span><span>{data.payment.payer_name || '—'} <span className="muted-text">· {data.payment.payer_email}</span></span>
                <span className="muted-text">Ref</span><span>{data.payment.ref_type ? `${data.payment.ref_type} · ${data.payment.ref_id}` : '—'}</span>
                <span className="muted-text">Razorpay order</span><span style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{data.payment.razorpay_order_id || '—'}</span>
                <span className="muted-text">Razorpay payment</span><span style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{data.payment.razorpay_payment_id || '—'}</span>
                <span className="muted-text">Created</span><span>{formatDate(data.payment.created_at)}</span>
              </div>
            </div>

            <h3 style={{ marginTop: '1.25rem', marginBottom: '.5rem', fontSize: '1rem' }}>Refunds</h3>
            {data.refunds.length === 0 && <p className="muted-text">No refunds.</p>}
            {data.refunds.length > 0 && (
              <div className="card" style={{ padding: 0 }}>
                {data.refunds.map((r) => (
                  <div key={r.id} style={{ padding: '.75rem 1rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>₹{(r.amount_paise / 100).toLocaleString('en-IN')}</strong>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.reason}</div>
                    <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                      Requested {formatDate(r.requested_at)}
                      {r.processed_at ? ` · Processed ${formatDate(r.processed_at)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.payment.metadata && Object.keys(data.payment.metadata).length > 0 && (
              <>
                <h3 style={{ marginTop: '1.25rem', marginBottom: '.5rem', fontSize: '1rem' }}>Metadata</h3>
                <pre className="card" style={{ padding: '.75rem 1rem', fontSize: '.75rem', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(data.payment.metadata, null, 2)}
                </pre>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Pager({ page, pageSize, total, onChange }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.75rem', fontSize: '.875rem' }}>
      <span className="muted-text">{total} payments</span>
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
        <span style={{ alignSelf: 'center' }}>{page} / {last}</span>
        <button className="btn btn-ghost" disabled={page >= last} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const colours = {
    success:            { bg: '#dcfce7', fg: '#065f46' },
    failed:             { bg: '#fee2e2', fg: '#991b1b' },
    created:            { bg: '#fef3c7', fg: '#92400e' },
    pending:            { bg: '#fef3c7', fg: '#92400e' },
    refunded:           { bg: '#f3e8ff', fg: '#6b21a8' },
    partially_refunded: { bg: '#f3e8ff', fg: '#6b21a8' },
    requested:          { bg: '#fef3c7', fg: '#92400e' },
    approved:           { bg: '#dbeafe', fg: '#1e3a8a' },
    processed:          { bg: '#dcfce7', fg: '#065f46' },
    rejected:           { bg: '#fee2e2', fg: '#991b1b' },
  }[status] ?? { bg: '#f1f5f9', fg: '#334155' };
  return (
    <span style={{ background: colours.bg, color: colours.fg, padding: '.125rem .5rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 500 }}>{status}</span>
  );
}

function StatCard({ label, value, sub, tone }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div className="muted-text" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{
        fontSize: '1.5rem', fontWeight: 600, marginTop: '.25rem',
        color: tone === 'warn' ? '#d97706' : '#0f172a',
      }}>{value}</div>
      {sub && <div className="muted-text" style={{ fontSize: '.75rem' }}>{sub}</div>}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(d); }
}

const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
const btnSm = { padding: '.25rem .5rem', fontSize: '.75rem' };
