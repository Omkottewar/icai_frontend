import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { IconPlus, IconX, IconCheck, IconArrowRight } from '../../icons';
import { apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';

// Inter-Unit Transfers — money moving between branch accounts (e.g. from
// operating account to CABF corpus, or from savings to FD). Workflow:
//   requested → approved → executed (bank transfer complete, ref captured)
//              └→ rejected

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
  { id: 'requested', label: 'Pending approval' },
  { id: 'approved',  label: 'Approved · to execute' },
  { id: 'executed',  label: 'Executed' },
  { id: 'rejected',  label: 'Rejected' },
];

const STATUS_PALETTE = {
  requested: { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  approved:  { bg: 'oklch(0.90 0.10 210)', fg: 'oklch(0.35 0.13 210)' },
  executed:  { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  rejected:  { bg: 'oklch(0.92 0.10 25)',  fg: 'oklch(0.45 0.20 25)' },
};

export default function IutTransfersAdminPage() {
  const [tab, setTab] = useState('requested');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [counts, setCounts] = useState({});

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = new URLSearchParams({ status: tab, pageSize: '50' });
      const r = await fetch('/api/admin/iut-transfers?' + params, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load transfers');
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const refreshCounts = useCallback(async () => {
    const next = {};
    await Promise.all(STATUS_TABS.map(async (t) => {
      try {
        const r = await fetch(`/api/admin/iut-transfers?status=${t.id}&pageSize=1`, { credentials: 'include' });
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
      title="IUT transfers"
      subtitle="Inter-unit transfers between branch accounts — approve then record the bank reference on execution"
      actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus size="sm" /> New transfer</button>}
    >
      <div className="row" role="tablist" style={{ borderBottom: '1px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap', gap: 0 }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={'iut-tab' + (tab === t.id ? ' is-active' : '')}
          >
            {t.label}
            {counts[t.id] > 0 && <span className="iut-tab-badge">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          <div style={{ fontSize: '2rem', opacity: .4 }}>🔀</div>
          <h3 style={{ marginTop: '.5rem', fontWeight: 600 }}>Nothing here</h3>
          <p style={{ marginTop: '.4rem', fontSize: '.875rem' }}>
            {tab === 'requested' && 'No transfers awaiting approval.'}
            {tab === 'approved'  && 'No approved transfers waiting to be executed at the bank.'}
            {tab === 'executed'  && 'No transfers have been executed yet.'}
            {tab === 'rejected'  && 'No rejected transfers.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>From → To</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'left' }}>Purpose</th>
                <th style={{ textAlign: 'left' }}>Transfer date</th>
                <th style={{ textAlign: 'left' }}>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.8125rem' }}>
                      {r.from_account} <span className="muted-text" style={{ fontFamily: 'inherit' }}>→</span> {r.to_account}
                    </div>
                    {r.reference_number && <div className="muted-text" style={{ fontSize: '.7rem' }}>Ref: {r.reference_number}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtPaise(r.amount_paise)}</td>
                  <td className="muted-text" style={{ fontSize: '.8125rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.purpose}</td>
                  <td className="muted-text" style={{ fontSize: '.8125rem' }}>{fmtDate(r.transfer_date)}</td>
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
        <IutDrawer transfer={reviewing} onClose={() => setReviewing(null)} onChanged={() => { setReviewing(null); afterMutation(); }} />
      )}

      {creating && (
        <IutCreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); afterMutation(); }} />
      )}

      <style>{`
        .iut-tab {
          padding: .625rem .875rem; margin-bottom: -1px;
          background: none; border: 0; border-bottom: 2px solid transparent;
          font-size: .8125rem; font-weight: 600; cursor: pointer;
          color: var(--muted-foreground);
          display: inline-flex; align-items: center; gap: .35rem;
        }
        .iut-tab:hover { color: var(--foreground); }
        .iut-tab.is-active { color: var(--primary); border-bottom-color: var(--primary); }
        .iut-tab-badge {
          font-size: .7rem; font-weight: 700; line-height: 1;
          padding: .15rem .4rem; border-radius: 999px;
          background: rgba(54, 34, 255, .12); color: var(--primary);
        }
      `}</style>
    </AdminLayout>
  );
}

function IutDrawer({ transfer, onClose, onChanged }) {
  const [action, setAction] = useState(null); // 'reject' | 'execute' | null
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState(transfer.reference_number || '');
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
      await apiWrite(`/api/admin/iut-transfers/${transfer.id}/${kind}`, { method: 'POST', body: body || {} });
      toast.success(kind === 'executed' ? 'Marked as executed' : `Transfer ${kind}d`);
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
          <h2 className="dialog-title">Transfer · {fmtPaise(transfer.amount_paise)}</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>Status</div>
          <div>
            <span className="badge" style={{
              background: (STATUS_PALETTE[transfer.status] || {}).bg,
              color: (STATUS_PALETTE[transfer.status] || {}).fg,
              fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 999, fontWeight: 600,
            }}>{transfer.status}</span>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '1rem', rowGap: '.35rem', margin: '1rem 0 0', fontSize: '.8125rem' }}>
            <dt style={{ color: 'var(--muted-foreground)' }}>From</dt>
            <dd style={{ margin: 0, fontWeight: 500, fontFamily: 'ui-monospace, Menlo, monospace' }}>{transfer.from_account}</dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>To</dt>
            <dd style={{ margin: 0, fontWeight: 500, fontFamily: 'ui-monospace, Menlo, monospace' }}>{transfer.to_account}</dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>Amount</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{fmtPaise(transfer.amount_paise)}</dd>
            <dt style={{ color: 'var(--muted-foreground)' }}>Transfer date</dt>
            <dd style={{ margin: 0 }}>{fmtDate(transfer.transfer_date)}</dd>
            {transfer.reference_number && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Reference</dt>
                <dd style={{ margin: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.75rem' }}>{transfer.reference_number}</dd>
              </>
            )}
            {transfer.requested_by_name && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Requested by</dt>
                <dd style={{ margin: 0 }}>{transfer.requested_by_name}</dd>
              </>
            )}
            <dt style={{ color: 'var(--muted-foreground)' }}>Requested at</dt>
            <dd style={{ margin: 0 }}>{fmtDate(transfer.requested_at)}</dd>
            {transfer.approved_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Approved</dt>
                <dd style={{ margin: 0 }}>{fmtDate(transfer.approved_at)}</dd>
              </>
            )}
            {transfer.executed_at && (
              <>
                <dt style={{ color: 'var(--muted-foreground)' }}>Executed</dt>
                <dd style={{ margin: 0 }}>{fmtDate(transfer.executed_at)}</dd>
              </>
            )}
          </dl>

          <div style={{ marginTop: '1rem' }}>
            <div className="muted-text" style={{ fontSize: '.75rem' }}>Purpose</div>
            <p style={{ marginTop: '.2rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{transfer.purpose}</p>
          </div>

          {transfer.notes && (
            <div style={{ marginTop: '1rem' }}>
              <div className="muted-text" style={{ fontSize: '.75rem' }}>Notes</div>
              <p style={{ marginTop: '.2rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{transfer.notes}</p>
            </div>
          )}

          {transfer.rejection_reason && (
            <div style={{ marginTop: '1rem', background: 'oklch(0.97 0.02 25)', borderRadius: '.4rem', padding: '.6rem .75rem' }}>
              <div className="muted-text" style={{ fontSize: '.7rem', color: 'oklch(0.45 0.20 25)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Rejection reason</div>
              <p style={{ marginTop: '.15rem', fontSize: '.8125rem', color: 'oklch(0.35 0.20 25)', lineHeight: 1.5 }}>{transfer.rejection_reason}</p>
            </div>
          )}

          {action === 'reject' && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Rejection reason *</div>
                <textarea className="input-base" rows={3} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 1000))} style={{ resize: 'vertical' }} />
              </label>
            </div>
          )}

          {action === 'execute' && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Bank reference number <span className="muted-text" style={{ fontWeight: 400 }}>(optional)</span></div>
                <input className="input-base" value={reference} onChange={(e) => setReference(e.target.value.slice(0, 120))} placeholder="e.g. NEFT/2027/2938471" />
                <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>Recommended — keeps the bank statement traceable back to this row.</div>
              </label>
            </div>
          )}
        </div>
        <div className="dialog-footer" style={{ flexWrap: 'wrap', gap: '.4rem' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Close</button>

          {transfer.status === 'requested' && !action && (
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

          {transfer.status === 'requested' && action === 'reject' && (
            <>
              <button className="btn btn-outline" onClick={() => { setAction(null); setReason(''); }} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }}
                onClick={() => callAction('reject', { reason })} disabled={busy || !reason.trim()}
              >Confirm rejection</button>
            </>
          )}

          {transfer.status === 'approved' && !action && (
            <button className="btn btn-primary" onClick={() => setAction('execute')} disabled={busy}>
              <IconArrowRight size="sm" /> Mark as executed
            </button>
          )}

          {transfer.status === 'approved' && action === 'execute' && (
            <>
              <button className="btn btn-outline" onClick={() => setAction(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={() => callAction('executed', { reference_number: reference })} disabled={busy}>Confirm executed</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IutCreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    from_account: '', to_account: '', _amount_rupees: '',
    transfer_date: new Date().toISOString().slice(0, 10),
    purpose: '', reference_number: '', notes: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (busy) return;
    if (!form.from_account.trim() || !form.to_account.trim()) { toast.warning('From + To accounts are required'); return; }
    if (form.from_account.trim() === form.to_account.trim()) { toast.warning('From and To accounts must differ'); return; }
    if (!form._amount_rupees) { toast.warning('Amount is required'); return; }
    if (!form.purpose.trim()) { toast.warning('Purpose is required'); return; }
    setBusy(true);
    try {
      await apiWrite('/api/admin/iut-transfers', {
        method: 'POST',
        body: {
          from_account: form.from_account.trim(),
          to_account: form.to_account.trim(),
          amount_paise: Math.round(Number(form._amount_rupees) * 100),
          transfer_date: form.transfer_date,
          purpose: form.purpose.trim(),
          reference_number: form.reference_number.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      toast.success('Transfer request created');
      onCreated?.();
    } catch (e) {
      toast.error(e?.message || 'Could not create transfer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(36rem, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">New transfer</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          <IutField label="From account *" hint="e.g. HDFC-Operations-4271">
            <input className="input-base" required value={form.from_account} onChange={(e) => patch('from_account', e.target.value.slice(0, 120))} />
          </IutField>
          <IutField label="To account *" hint="Must be a different account than 'From'">
            <input className="input-base" required value={form.to_account} onChange={(e) => patch('to_account', e.target.value.slice(0, 120))} />
          </IutField>
          <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <IutField label="Amount (₹) *">
              <input type="number" min="0" step="0.01" className="input-base" required value={form._amount_rupees} onChange={(e) => patch('_amount_rupees', e.target.value)} />
            </IutField>
            <IutField label="Transfer date *">
              <input type="date" className="input-base" required value={form.transfer_date} onChange={(e) => patch('transfer_date', e.target.value)} />
            </IutField>
          </div>
          <IutField label="Purpose *" hint="Why is this money being moved?">
            <textarea className="input-base" rows={2} required value={form.purpose} onChange={(e) => patch('purpose', e.target.value.slice(0, 500))} placeholder="e.g. Quarterly CABF corpus transfer" style={{ resize: 'vertical' }} />
          </IutField>
          <IutField label="Reference number" hint="Fill this in later on execution if you don't have it yet">
            <input className="input-base" value={form.reference_number} onChange={(e) => patch('reference_number', e.target.value.slice(0, 120))} />
          </IutField>
          <IutField label="Notes">
            <textarea className="input-base" rows={2} value={form.notes} onChange={(e) => patch('notes', e.target.value.slice(0, 1000))} style={{ resize: 'vertical' }} />
          </IutField>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function IutField({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginTop: '.6rem' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>{label}</div>
      {children}
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>{hint}</div>}
    </label>
  );
}
