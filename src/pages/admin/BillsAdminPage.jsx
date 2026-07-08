import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { IconPlus, IconEdit, IconTrash, IconX, IconCheck, IconArrowRight } from '../../icons';
import { apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';

// Post-event and standalone branch bills. Two roles share this page:
//   • Accountant  — creates drafts, submits them for approval
//   • Treasurer   — reviews submitted bills, approves / rejects / marks paid
//
// Status flow: draft → submitted → approved → paid
//                                └→ rejected
// The tabbed layout mirrors that flow so each role lands where their work is.

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
  { id: 'submitted', label: 'Awaiting approval' },
  { id: 'draft',     label: 'Drafts' },
  { id: 'approved',  label: 'Approved · to pay' },
  { id: 'paid',      label: 'Paid' },
  { id: 'rejected',  label: 'Rejected' },
];

const STATUS_PALETTE = {
  draft:     { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
  submitted: { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  approved:  { bg: 'oklch(0.90 0.10 210)', fg: 'oklch(0.35 0.13 210)' },
  rejected:  { bg: 'oklch(0.92 0.10 25)',  fg: 'oklch(0.45 0.20 25)' },
  paid:      { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
};

export default function BillsAdminPage() {
  const [tab, setTab] = useState('submitted');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [counts, setCounts] = useState({}); // { status: count } for tab badges

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = new URLSearchParams({ status: tab, pageSize: '50' });
      const r = await fetch('/api/admin/bills?' + params, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load bills');
      const j = await r.json();
      setRows(j.rows || []);
      setTotal(j.total || 0);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // Refresh per-tab counts without blocking the main list — fires once per
  // page open and after any status transition.
  const refreshCounts = useCallback(async () => {
    const next = {};
    await Promise.all(STATUS_TABS.map(async (t) => {
      try {
        const r = await fetch(`/api/admin/bills?status=${t.id}&pageSize=1`, { credentials: 'include' });
        if (!r.ok) return;
        const j = await r.json();
        next[t.id] = j.total || 0;
      } catch { /* ignore */ }
    }));
    setCounts(next);
  }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts, tab]);

  async function afterMutation() {
    await load();
    refreshCounts();
  }

  return (
    <AdminLayout
      title="Bills"
      subtitle="Vendor bills — accountants draft, treasurers approve, then mark as paid"
      actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus size="sm" /> New bill</button>}
    >
      <div className="row" role="tablist" style={{ borderBottom: '1px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap', gap: 0 }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={'bills-tab' + (tab === t.id ? ' is-active' : '')}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className="bills-tab-badge">{counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          <div style={{ fontSize: '2rem', opacity: .4 }}>💸</div>
          <h3 style={{ marginTop: '.5rem', fontWeight: 600 }}>Nothing here</h3>
          <p style={{ marginTop: '.4rem', fontSize: '.875rem' }}>
            {tab === 'submitted' && 'No bills waiting on the treasurer.'}
            {tab === 'draft'     && 'No drafts. Click "New bill" to record one.'}
            {tab === 'approved'  && 'No approved bills awaiting payment.'}
            {tab === 'paid'      && 'No paid bills yet.'}
            {tab === 'rejected'  && 'No rejected bills.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Vendor / Description</th>
                <th style={{ textAlign: 'left' }}>Bill date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'left' }}>Event / Committee</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = STATUS_PALETTE[r.status] || STATUS_PALETTE.draft;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.vendor_name}</div>
                      {r.description && <div className="muted-text" style={{ fontSize: '.75rem', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                      {r.bill_number && <div className="muted-text" style={{ fontSize: '.7rem' }}>Bill #{r.bill_number}</div>}
                    </td>
                    <td className="muted-text" style={{ fontSize: '.8125rem' }}>{fmtDate(r.bill_date)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmtPaise(r.amount_paise)}
                      {r.budget_paise != null && (
                        <div className="muted-text" style={{ fontSize: '.7rem', fontWeight: 400 }}>Budget: {fmtPaise(r.budget_paise)}</div>
                      )}
                    </td>
                    <td className="muted-text" style={{ fontSize: '.8125rem' }}>
                      {r.event_title || r.committee_name || '—'}
                    </td>
                    <td>
                      <span className="badge" style={{ background: p.bg, color: p.fg, fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 999, fontWeight: 600 }}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .55rem' }} onClick={() => setReviewing(r)}>Open</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <BillReviewDrawer
          bill={reviewing}
          onClose={() => setReviewing(null)}
          onChanged={() => { setReviewing(null); afterMutation(); }}
        />
      )}

      {creating && (
        <BillCreateModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); afterMutation(); }}
        />
      )}

      <style>{`
        .bills-tab {
          padding: .625rem .875rem; margin-bottom: -1px;
          background: none; border: 0; border-bottom: 2px solid transparent;
          font-size: .8125rem; font-weight: 600; cursor: pointer;
          color: var(--muted-foreground);
          display: inline-flex; align-items: center; gap: .35rem;
        }
        .bills-tab:hover { color: var(--foreground); }
        .bills-tab.is-active { color: var(--primary); border-bottom-color: var(--primary); }
        .bills-tab-badge {
          font-size: .7rem; font-weight: 700; line-height: 1;
          padding: .15rem .4rem; border-radius: 999px;
          background: rgba(54, 34, 255, .12); color: var(--primary);
        }
      `}</style>
    </AdminLayout>
  );
}

// ─── Bill review drawer ───────────────────────────────────────────────────
function BillReviewDrawer({ bill, onClose, onChanged }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function doAction(action, body) {
    if (busy) return;
    setBusy(true);
    try {
      await apiWrite(`/api/admin/bills/${bill.id}/${action}`, {
        method: 'POST',
        body: body || {},
      });
      toast.success(`Bill ${action === 'paid' ? 'marked paid' : action + 'd'}`);
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!confirm(`Delete this draft bill? This can only be done while it's still a draft.`)) return;
    setBusy(true);
    try {
      await apiWrite(`/api/admin/bills/${bill.id}`, { method: 'DELETE' });
      toast.success('Draft deleted');
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const variance = bill.budget_paise != null ? bill.amount_paise - bill.budget_paise : null;

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(38rem, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">Bill · {bill.vendor_name}</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>Status</div>
          <div>
            <span className="badge" style={{
              background: (STATUS_PALETTE[bill.status] || STATUS_PALETTE.draft).bg,
              color: (STATUS_PALETTE[bill.status] || STATUS_PALETTE.draft).fg,
              fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 999, fontWeight: 600,
            }}>{bill.status}</span>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '1rem', rowGap: '.35rem', margin: '1rem 0 0', fontSize: '.8125rem' }}>
            <dt style={{ color: 'var(--muted-foreground)' }}>Vendor</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>{bill.vendor_name}</dd>

            <dt style={{ color: 'var(--muted-foreground)' }}>Bill number</dt>
            <dd style={{ margin: 0 }}>{bill.bill_number || '—'}</dd>

            <dt style={{ color: 'var(--muted-foreground)' }}>Bill date</dt>
            <dd style={{ margin: 0 }}>{fmtDate(bill.bill_date)}</dd>

            <dt style={{ color: 'var(--muted-foreground)' }}>Amount</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{fmtPaise(bill.amount_paise)}</dd>

            {bill.budget_paise != null && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Budget</dt>
                <dd style={{ margin: 0 }}>{fmtPaise(bill.budget_paise)}</dd>
                <dt style={{ color: 'var(--muted-foreground)' }}>Variance</dt>
                <dd style={{ margin: 0, color: variance > 0 ? 'var(--destructive)' : 'oklch(0.45 0.15 145)', fontWeight: 600 }}>
                  {variance > 0 ? '+' : ''}{fmtPaise(variance)}
                </dd>
              </>
            )}

            <dt style={{ color: 'var(--muted-foreground)' }}>Event / Committee</dt>
            <dd style={{ margin: 0 }}>{bill.event_title || bill.committee_name || '—'}</dd>

            {bill.submitted_by_name && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Submitted by</dt>
                <dd style={{ margin: 0 }}>{bill.submitted_by_name}</dd>
              </>
            )}
            {bill.submitted_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Submitted at</dt>
                <dd style={{ margin: 0 }}>{fmtDate(bill.submitted_at)}</dd>
              </>
            )}
            {bill.approved_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Approved at</dt>
                <dd style={{ margin: 0 }}>{fmtDate(bill.approved_at)}</dd>
              </>
            )}
            {bill.paid_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Paid at</dt>
                <dd style={{ margin: 0 }}>{fmtDate(bill.paid_at)}</dd>
              </>
            )}
          </dl>

          {bill.description && (
            <div style={{ marginTop: '1rem' }}>
              <div className="muted-text" style={{ fontSize: '.75rem' }}>Description</div>
              <p style={{ marginTop: '.2rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{bill.description}</p>
            </div>
          )}

          {bill.rejection_reason && (
            <div style={{ marginTop: '1rem', background: 'oklch(0.97 0.02 25)', borderRadius: '.4rem', padding: '.6rem .75rem' }}>
              <div className="muted-text" style={{ fontSize: '.7rem', color: 'oklch(0.45 0.20 25)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Rejection reason</div>
              <p style={{ marginTop: '.15rem', fontSize: '.8125rem', color: 'oklch(0.35 0.20 25)', lineHeight: 1.5 }}>{bill.rejection_reason}</p>
            </div>
          )}

          {rejectMode && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Rejection reason *</div>
                <textarea className="input-base" rows={3} value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value.slice(0, 1000))}
                  placeholder="Why is this bill being rejected? The accountant will see this."
                  style={{ resize: 'vertical' }}
                />
              </label>
            </div>
          )}
        </div>
        <div className="dialog-footer" style={{ flexWrap: 'wrap', gap: '.4rem' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Close</button>

          {bill.status === 'draft' && (
            <>
              <button className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}
                onClick={doDelete} disabled={busy}>
                <IconTrash size="sm" /> Delete
              </button>
              <button className="btn btn-primary" onClick={() => doAction('submit')} disabled={busy}>
                <IconArrowRight size="sm" /> Submit to treasurer
              </button>
            </>
          )}

          {bill.status === 'submitted' && !rejectMode && (
            <>
              <button className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}
                onClick={() => setRejectMode(true)} disabled={busy}>
                <IconX size="sm" /> Reject
              </button>
              <button className="btn btn-primary" onClick={() => doAction('approve')} disabled={busy}>
                <IconCheck size="sm" /> Approve
              </button>
            </>
          )}

          {bill.status === 'submitted' && rejectMode && (
            <>
              <button className="btn btn-outline" onClick={() => { setRejectMode(false); setRejectReason(''); }} disabled={busy}>Cancel reject</button>
              <button className="btn btn-primary" style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }}
                onClick={() => doAction('reject', { reason: rejectReason })}
                disabled={busy || !rejectReason.trim()}
              >
                Confirm rejection
              </button>
            </>
          )}

          {bill.status === 'approved' && (
            <button className="btn btn-primary" onClick={() => doAction('paid')} disabled={busy}>
              <IconCheck size="sm" /> Mark as paid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bill create modal (accountant) ───────────────────────────────────────
function BillCreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    vendor_id: '', vendor_name: '', category_id: '',
    description: '', bill_date: new Date().toISOString().slice(0, 10),
    bill_number: '', _amount_rupees: '', _budget_rupees: '',
    event_id: '', committee_id: '',
  });
  const [busy, setBusy] = useState(false);
  const [committees, setCommittees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/committees', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/vendors?active=true', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/expense-categories', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([c, v, cat]) => {
      setCommittees(c.rows || []);
      setVendors(v.rows || []);
      setCategories((cat.rows || []).filter((r) => r.active));
    });
  }, []);

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // When the treasurer picks a directory vendor, autofill vendor_name (kept
  // for search + fallback) and default_category if the vendor has one.
  function selectVendor(vendorId) {
    if (!vendorId) { patch('vendor_id', ''); return; }
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) return;
    setForm((f) => ({
      ...f,
      vendor_id: v.id,
      vendor_name: v.name,
      category_id: f.category_id || v.default_category_id || '',
    }));
  }

  async function save(shouldSubmit) {
    if (busy) return;
    if (!form.vendor_name.trim()) { toast.warning('Vendor is required — pick from the directory or enter a one-off name'); return; }
    if (!form._amount_rupees) { toast.warning('Amount is required'); return; }
    setBusy(true);
    try {
      const body = {
        vendor_id: form.vendor_id || null,
        vendor_name: form.vendor_name.trim(),
        category_id: form.category_id || null,
        description: form.description.trim() || null,
        bill_date: form.bill_date,
        bill_number: form.bill_number.trim() || null,
        amount_paise: Math.round(Number(form._amount_rupees) * 100),
        budget_paise: form._budget_rupees ? Math.round(Number(form._budget_rupees) * 100) : null,
        event_id: form.event_id || null,
        committee_id: form.committee_id || null,
        submit: shouldSubmit,
      };
      await apiWrite('/api/admin/bills', { method: 'POST', body });
      toast.success(shouldSubmit ? 'Bill submitted to treasurer' : 'Draft saved');
      onCreated?.();
    } catch (e) {
      toast.error(e?.message || 'Could not save bill');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(38rem, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">New bill</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          <BillField label="Vendor (from directory)" hint="Pick a saved vendor to autofill GSTIN + default category. Leave blank for one-offs.">
            <select className="input-base" value={form.vendor_id} onChange={(e) => selectVendor(e.target.value)}>
              <option value="">— One-off vendor —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.gstin ? ` · ${v.gstin}` : ''}</option>)}
            </select>
          </BillField>

          <BillField label="Vendor name *" hint={form.vendor_id ? 'Locked to the directory entry above.' : 'Enter the vendor name for this one-off bill.'}>
            <input className="input-base" required value={form.vendor_name} disabled={!!form.vendor_id} onChange={(e) => patch('vendor_name', e.target.value.slice(0, 200))} placeholder="e.g. Silver Palate Caterers" />
          </BillField>

          <BillField label="Expense category" hint="Feeds the treasurer dashboard's expense-by-category chart">
            <select className="input-base" value={form.category_id} onChange={(e) => patch('category_id', e.target.value)}>
              <option value="">— Uncategorised —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </BillField>

          <BillField label="Description" hint="What was this bill for?">
            <textarea className="input-base" rows={3} value={form.description} onChange={(e) => patch('description', e.target.value.slice(0, 2000))} placeholder="e.g. Refreshments for GST workshop" style={{ resize: 'vertical' }} />
          </BillField>

          <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <BillField label="Bill date *">
              <input type="date" className="input-base" required value={form.bill_date} onChange={(e) => patch('bill_date', e.target.value)} />
            </BillField>
            <BillField label="Bill number">
              <input className="input-base" value={form.bill_number} onChange={(e) => patch('bill_number', e.target.value.slice(0, 60))} placeholder="e.g. INV-2027-042" />
            </BillField>
          </div>

          <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <BillField label="Amount (₹) *">
              <input type="number" min="0" step="0.01" className="input-base" required value={form._amount_rupees} onChange={(e) => patch('_amount_rupees', e.target.value)} placeholder="e.g. 12500" />
            </BillField>
            <BillField label="Budget (₹)" hint="Original budget for this line item (optional)">
              <input type="number" min="0" step="0.01" className="input-base" value={form._budget_rupees} onChange={(e) => patch('_budget_rupees', e.target.value)} placeholder="e.g. 10000" />
            </BillField>
          </div>

          <BillField label="Committee" hint="Which committee is this bill for?">
            <select className="input-base" value={form.committee_id} onChange={(e) => patch('committee_id', e.target.value)}>
              <option value="">— None —</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </BillField>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-outline" onClick={() => save(false)} disabled={busy}>Save as draft</button>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={busy}>
            {busy ? 'Saving…' : 'Submit for approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BillField({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginTop: '.6rem' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>{label}</div>
      {children}
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>{hint}</div>}
    </label>
  );
}
