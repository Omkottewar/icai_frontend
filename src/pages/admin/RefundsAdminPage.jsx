import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { IconX, IconCheck, IconArrowRight } from '../../icons';
import { apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';

// Refund workflow (treasurer facing):
//   requested → approved  → processed (Razorpay refund fired)
//              └→ rejected
// A refund is always tied to a successful payment; only the amount and
// reason are decisions the treasurer makes.

const FMT_INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function fmtPaise(paise) {
  if (paise == null) return '—';
  return FMT_INR.format(Number(paise) / 100);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TABS = [
  { id: 'requested', label: 'Pending' },
  { id: 'approved',  label: 'Approved · to process' },
  { id: 'processed', label: 'Processed' },
  { id: 'rejected',  label: 'Rejected' },
];

const STATUS_PALETTE = {
  requested: { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  approved:  { bg: 'oklch(0.90 0.10 210)', fg: 'oklch(0.35 0.13 210)' },
  processed: { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  rejected:  { bg: 'oklch(0.92 0.10 25)',  fg: 'oklch(0.45 0.20 25)' },
};

export default function RefundsAdminPage() {
  const [tab, setTab] = useState('requested');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [counts, setCounts] = useState({});

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = new URLSearchParams({ status: tab, pageSize: '50' });
      const r = await fetch('/api/admin/refunds?' + params, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load refunds');
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const refreshCounts = useCallback(async () => {
    const next = {};
    await Promise.all(STATUS_TABS.map(async (t) => {
      try {
        const r = await fetch(`/api/admin/refunds?status=${t.id}&pageSize=1`, { credentials: 'include' });
        if (!r.ok) return;
        const j = await r.json();
        next[t.id] = j.total || 0;
      } catch { /* ignore */ }
    }));
    setCounts(next);
  }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts, tab]);

  async function afterMutation() { await load(); refreshCounts(); }

  return (
    <AdminLayout
      title="Refunds"
      subtitle="Approve refunds against successful payments and mark them processed"
      actions={
        <a
          href={`/api/admin/refunds/export.csv?status=${tab}`}
          className="btn btn-outline"
          style={{ padding: '.5rem 1rem', textDecoration: 'none' }}
        >
          ⬇ Export CSV
        </a>
      }
    >
      <div className="row" role="tablist" style={{ borderBottom: '1px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap', gap: 0 }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={'refunds-tab' + (tab === t.id ? ' is-active' : '')}
          >
            {t.label}
            {counts[t.id] > 0 && <span className="refunds-tab-badge">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          <div style={{ fontSize: '2rem', opacity: .4 }}>↩️</div>
          <h3 style={{ marginTop: '.5rem', fontWeight: 600 }}>Nothing here</h3>
          <p style={{ marginTop: '.4rem', fontSize: '.875rem' }}>
            {tab === 'requested' && 'No refund requests waiting on you.'}
            {tab === 'approved'  && 'No approved refunds waiting to be processed.'}
            {tab === 'processed' && 'No refunds have been processed yet.'}
            {tab === 'rejected'  && 'No rejected refunds.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Payer</th>
                <th style={{ textAlign: 'left' }}>Purpose</th>
                <th style={{ textAlign: 'right' }}>Refund / Payment</th>
                <th style={{ textAlign: 'left' }}>Reason</th>
                <th style={{ textAlign: 'left' }}>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.payer_name || 'Unknown'}</div>
                    <div className="muted-text" style={{ fontSize: '.7rem' }}>{r.payer_email || ''}</div>
                  </td>
                  <td className="muted-text" style={{ fontSize: '.8125rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.payment_purpose || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ fontWeight: 600 }}>{fmtPaise(r.amount_paise)}</div>
                    {r.payment_amount_paise && r.payment_amount_paise !== r.amount_paise && (
                      <div className="muted-text" style={{ fontSize: '.7rem' }}>of {fmtPaise(r.payment_amount_paise)}</div>
                    )}
                  </td>
                  <td className="muted-text" style={{ fontSize: '.8125rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                  <td className="muted-text" style={{ fontSize: '.8125rem' }}>{fmtDate(r.requested_at)}</td>
                  <td>
                    <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .55rem' }} onClick={() => setReviewing(r)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <RefundDrawer refund={reviewing} onClose={() => setReviewing(null)} onChanged={() => { setReviewing(null); afterMutation(); }} />
      )}

      <style>{`
        .refunds-tab {
          padding: .625rem .875rem; margin-bottom: -1px;
          background: none; border: 0; border-bottom: 2px solid transparent;
          font-size: .8125rem; font-weight: 600; cursor: pointer;
          color: var(--muted-foreground);
          display: inline-flex; align-items: center; gap: .35rem;
        }
        .refunds-tab:hover { color: var(--foreground); }
        .refunds-tab.is-active { color: var(--primary); border-bottom-color: var(--primary); }
        .refunds-tab-badge {
          font-size: .7rem; font-weight: 700; line-height: 1;
          padding: .15rem .4rem; border-radius: 999px;
          background: rgba(54, 34, 255, .12); color: var(--primary);
        }
      `}</style>
    </AdminLayout>
  );
}

function RefundDrawer({ refund, onClose, onChanged }) {
  const [action, setAction] = useState(null); // 'reject' | 'processed' | null
  const [note, setNote] = useState('');
  const [razorpayId, setRazorpayId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function callAction(kind, body) {
    if (busy) return;
    setBusy(true);
    try {
      await apiWrite(`/api/admin/refunds/${refund.id}/${kind}`, { method: 'POST', body: body || {} });
      toast.success(kind === 'processed' ? 'Marked as processed' : `Refund ${kind}d`);
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(36rem, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">Refund · {fmtPaise(refund.amount_paise)}</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>Status</div>
          <div>
            <span className="badge" style={{
              background: (STATUS_PALETTE[refund.status] || {}).bg,
              color: (STATUS_PALETTE[refund.status] || {}).fg,
              fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 999, fontWeight: 600,
            }}>{refund.status}</span>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '1rem', rowGap: '.35rem', margin: '1rem 0 0', fontSize: '.8125rem' }}>
            <dt style={{ color: 'var(--muted-foreground)' }}>Payer</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{refund.payer_name || '—'}</dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>Email</dt>
            <dd style={{ margin: 0 }}>{refund.payer_email || '—'}</dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>Refund amount</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{fmtPaise(refund.amount_paise)}</dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>Original payment</dt>
            <dd style={{ margin: 0 }}>{fmtPaise(refund.payment_amount_paise)}</dd>
            {refund.payment_purpose && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Purpose</dt>
                <dd style={{ margin: 0 }}>{refund.payment_purpose}</dd>
              </>
            )}
            <dt style={{ color: 'var(--muted-foreground)' }}>Requested</dt>
            <dd style={{ margin: 0 }}>{fmtDate(refund.requested_at)}</dd>
            {refund.approved_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Approved</dt>
                <dd style={{ margin: 0 }}>{fmtDate(refund.approved_at)}</dd>
              </>
            )}
            {refund.processed_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Processed</dt>
                <dd style={{ margin: 0 }}>{fmtDate(refund.processed_at)}</dd>
              </>
            )}
            {refund.razorpay_refund_id && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Refund ref</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.75rem' }}>{refund.razorpay_refund_id}</dd>
              </>
            )}
          </dl>

          <div style={{ marginTop: '1rem' }}>
            <div className="muted-text" style={{ fontSize: '.75rem' }}>Reason</div>
            <p style={{ marginTop: '.2rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{refund.reason || '—'}</p>
          </div>

          {refund.notes && (
            <div style={{ marginTop: '1rem' }}>
              <div className="muted-text" style={{ fontSize: '.75rem' }}>Treasurer note</div>
              <p style={{ marginTop: '.2rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{refund.notes}</p>
            </div>
          )}

          {action === 'reject' && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Rejection note *</div>
                <textarea className="input-base" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} placeholder="Why is this refund being rejected? The payer will see this." style={{ resize: 'vertical' }} />
              </label>
            </div>
          )}

          {action === 'processed' && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Refund reference <span className="muted-text" style={{ fontWeight: 400 }}>(optional)</span></div>
                <input className="input-base" value={razorpayId} onChange={(e) => setRazorpayId(e.target.value.slice(0, 120))} placeholder="Bank UTR or transaction ID" />
                <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>UTR / txn ID from the manual UPI reversal — kept for the audit trail.</div>
              </label>
            </div>
          )}
        </div>
        <div className="dialog-footer" style={{ flexWrap: 'wrap', gap: '.4rem' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Close</button>

          {refund.status === 'requested' && !action && (
            <>
              <button className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}
                onClick={() => setAction('reject')} disabled={busy}>
                <IconX size="sm" /> Reject
              </button>
              <button className="btn btn-primary" onClick={() => callAction('approve')} disabled={busy}>
                <IconCheck size="sm" /> Approve
              </button>
            </>
          )}

          {refund.status === 'requested' && action === 'reject' && (
            <>
              <button className="btn btn-outline" onClick={() => { setAction(null); setNote(''); }} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }}
                onClick={() => callAction('reject', { notes: note })} disabled={busy || !note.trim()}
              >Confirm rejection</button>
            </>
          )}

          {refund.status === 'approved' && !action && (
            <button className="btn btn-primary" onClick={() => setAction('processed')} disabled={busy}>
              <IconArrowRight size="sm" /> Mark as processed
            </button>
          )}

          {refund.status === 'approved' && action === 'processed' && (
            <>
              <button className="btn btn-outline" onClick={() => { setAction(null); setRazorpayId(''); }} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={() => callAction('processed', { razorpay_refund_id: razorpayId })} disabled={busy}>Confirm processed</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
