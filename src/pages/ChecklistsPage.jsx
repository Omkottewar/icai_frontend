import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import { useChecklistList, useChecklist, checklistFetch } from '../hooks/useChecklist';
import { IconArrowLeft, IconX } from '../icons';

const STATUS_LABEL = {
  awaiting_committee:     'Awaiting committee chairman',
  awaiting_branch_review: 'Awaiting branch chairman review',
  approved:               'Approved',
};

const STATUS_PILL = {
  awaiting_committee:     { bg: '#fef3c7', fg: '#92400e' },
  awaiting_branch_review: { bg: '#dbeafe', fg: '#1e40af' },
  approved:               { bg: '#dcfce7', fg: '#166534' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusPill({ status }) {
  const c = STATUS_PILL[status] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '.15rem .55rem', borderRadius: 999,
      background: c.bg, color: c.fg, fontSize: '.7rem', fontWeight: 600,
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function ChecklistsPage() {
  const route = useRoute();
  const openId = route.query.id || null;

  return (
    <>
      <PageHeader title="Event checklists" subtitle="Approve, fill or build event checklists" />
      <section className="container" style={{ padding: '2rem 1rem' }}>
        <ChecklistList onOpen={(id) => navigate('/checklists?id=' + id)} />
      </section>

      {openId && <ChecklistDrawer id={openId} onClose={() => navigate('/checklists')} />}
    </>
  );
}

function ChecklistList({ onOpen }) {
  const { data, loading, error } = useChecklistList();

  if (loading) return <p className="muted-text">Loading…</p>;
  if (error)   return <p className="muted-text" style={{ color: 'var(--destructive)' }}>{error.message}</p>;

  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p className="muted-text">No checklists awaiting your action right now.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
      {rows.map((r) => (
        <button key={r.id} className="checklist-row" onClick={() => onOpen(r.id)}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>{r.event_title}</div>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>
              {r.committee_name || r.committee_code || '—'}
              {' · Last activity '}{fmtDate(r.updated_at)}
            </div>
          </div>
          <StatusPill status={r.status} />
        </button>
      ))}

      <style>{`
        .checklist-row {
          display: flex; align-items: center; gap: 1rem;
          width: 100%; padding: 1rem 1.25rem;
          background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
          cursor: pointer; transition: border-color .12s, background .12s;
        }
        .checklist-row:hover { border-color: var(--primary); background: var(--muted, #fafaf9); }
      `}</style>
    </div>
  );
}

// ─── Detail drawer (full-page slide-over) ────────────────────────────────
function ChecklistDrawer({ id, onClose }) {
  const { showToast } = useAuth();
  const { data, loading, error, refresh } = useChecklist(id);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', kind: 'text', required: true });

  async function run(fn, successMsg) {
    setBusy(true);
    try { await fn(); if (successMsg) showToast?.(successMsg, 'success'); refresh(); }
    catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }

  if (loading) {
    return (
      <DrawerShell onClose={onClose} title="Loading…"><p className="muted-text">Loading checklist…</p></DrawerShell>
    );
  }
  if (error) {
    return (
      <DrawerShell onClose={onClose} title="Error">
        <p style={{ color: 'var(--destructive)' }}>{error.message}</p>
      </DrawerShell>
    );
  }
  if (!data) return null;

  const { checklist, event, items, reviews, perms } = data;
  const isAwaitingCommittee = checklist.status === 'awaiting_committee';
  const isAwaitingReview    = checklist.status === 'awaiting_branch_review';
  const isApproved          = checklist.status === 'approved';

  const lastRejection = reviews.find((r) => r.action === 'rejected');

  function updateItemValue(itemId, value) {
    return run(
      () => checklistFetch(`/api/checklists/${id}/items/${itemId}`, { method: 'PATCH', body: { value } }),
    );
  }

  function addItem() {
    if (!newItem.label.trim()) { showToast?.('Label is required', 'error'); return; }
    return run(
      () => checklistFetch(`/api/checklists/${id}/items`, { method: 'POST', body: newItem }),
      'Item added',
    ).then(() => setNewItem({ label: '', kind: 'text', required: true }));
  }

  function deleteItem(itemId) {
    if (!confirm('Remove this item?')) return;
    return run(
      () => checklistFetch(`/api/checklists/${id}/items/${itemId}`, { method: 'DELETE' }),
      'Item removed',
    );
  }

  function submitForReview() {
    return run(
      () => checklistFetch(`/api/checklists/${id}/submit`, { method: 'POST', body: {} }),
      'Sent to branch chairman for review',
    );
  }

  function approve() {
    if (!confirm('Approve this checklist? The event will be auto-published.')) return;
    return run(
      () => checklistFetch(`/api/checklists/${id}/approve`, { method: 'POST', body: {} }),
      'Approved — event is now published',
    );
  }

  function reject() {
    if (!rejectNote.trim()) { showToast?.('Add a reason for rejection', 'error'); return; }
    return run(
      () => checklistFetch(`/api/checklists/${id}/reject`, { method: 'POST', body: { note: rejectNote } }),
      'Rejected — sent back to committee chairman',
    ).then(() => { setShowReject(false); setRejectNote(''); });
  }

  return (
    <DrawerShell
      onClose={onClose}
      title={event.title}
      subtitle={`${event.committee_name || event.committee_code || '—'} · ${STATUS_LABEL[checklist.status]}`}
      pill={<StatusPill status={checklist.status} />}
    >
      {/* Last rejection note if currently in committee step */}
      {isAwaitingCommittee && lastRejection && (
        <div className="callout callout-warning">
          <strong>Revisions requested</strong>
          <div style={{ fontSize: '.875rem', marginTop: '.25rem' }}>{lastRejection.note}</div>
          <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
            — {lastRejection.actor_name || 'Branch chairman'}, {fmtDate(lastRejection.created_at)}
          </div>
        </div>
      )}

      {/* Items */}
      <h3 className="drawer-section-title">Checklist items</h3>
      {items.length === 0 && <p className="muted-text" style={{ fontSize: '.875rem' }}>No items yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
        {items.map((it) => (
          <ChecklistItemRow
            key={it.id}
            item={it}
            canFill={perms.canFill && !isApproved}
            canEdit={perms.canEdit}
            onChangeValue={(v) => updateItemValue(it.id, v)}
            onDelete={() => deleteItem(it.id)}
            disabled={busy}
          />
        ))}
      </div>

      {/* Add item (admin only) */}
      {perms.canEdit && !isApproved && (
        <div className="add-item">
          <input className="input-base" placeholder="Label, e.g. Speaker fee"
                 value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} />
          <select className="input-base" value={newItem.kind}
                  onChange={(e) => setNewItem({ ...newItem, kind: e.target.value })} style={{ maxWidth: 140 }}>
            <option value="text">Text</option>
            <option value="money">Money (₹)</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
          <label className="row gap-1" style={{ fontSize: '.8125rem' }}>
            <input type="checkbox" checked={newItem.required}
                   onChange={(e) => setNewItem({ ...newItem, required: e.target.checked })} />
            Required
          </label>
          <button className="btn btn-primary" onClick={addItem} disabled={busy} style={{ padding: '.4rem .85rem' }}>
            + Add item
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="action-bar">
        {isAwaitingCommittee && perms.canSubmitForReview && (
          <button className="btn btn-primary" onClick={submitForReview} disabled={busy || items.length === 0}>
            Submit for branch review
          </button>
        )}
        {isAwaitingReview && perms.canReview && !showReject && (
          <>
            <button className="btn btn-ghost" onClick={() => setShowReject(true)} disabled={busy} style={{ color: 'var(--destructive)' }}>
              Reject with note
            </button>
            <button className="btn btn-primary" onClick={approve} disabled={busy}>
              Approve & publish event
            </button>
          </>
        )}
        {isAwaitingReview && perms.canReview && showReject && (
          <>
            <textarea className="input-base" rows={2} placeholder="Why is this being rejected?"
                      value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                      style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => { setShowReject(false); setRejectNote(''); }} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={reject} disabled={busy} style={{ background: 'var(--destructive)' }}>
              Send back
            </button>
          </>
        )}
        {isApproved && <div className="muted-text">This checklist is approved and the event is published.</div>}
      </div>

      {/* Review history */}
      <h3 className="drawer-section-title" style={{ marginTop: '2rem' }}>History</h3>
      <ul className="history">
        {reviews.length === 0 && <li className="muted-text">No activity yet.</li>}
        {reviews.map((r) => (
          <li key={r.id}>
            <strong>{labelForAction(r.action)}</strong>
            {' '}by {r.actor_name || 'system'} · {fmtDate(r.created_at)}
            {r.note && <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.2rem' }}>{r.note}</div>}
          </li>
        ))}
      </ul>

      <style>{`
        .drawer-section-title {
          font-size: .75rem; text-transform: uppercase; letter-spacing: .06em;
          color: var(--muted-foreground); font-weight: 700;
          margin: 1.5rem 0 .75rem;
        }
        .callout {
          padding: .75rem .875rem; border-radius: .375rem; margin-bottom: 1rem;
          font-size: .875rem;
        }
        .callout-warning { background: #fef3c7; color: #78350f; border: 1px solid #fde68a; }
        .add-item {
          display: flex; align-items: center; gap: .625rem; flex-wrap: wrap;
          margin-top: 1rem; padding: .875rem;
          background: var(--muted, #f5f5f4); border-radius: .5rem; border: 1px dashed var(--border);
        }
        .add-item input.input-base { flex: 1; min-width: 200px; }
        .action-bar {
          display: flex; gap: .625rem; align-items: center; flex-wrap: wrap;
          margin-top: 1.5rem; padding: 1rem; border-radius: .5rem;
          background: var(--muted, #f5f5f4);
        }
        .action-bar .btn { padding: .55rem 1rem; }
        .history { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .5rem; font-size: .875rem; }
        .history li { padding: .625rem .75rem; border: 1px solid var(--border); border-radius: .375rem; background: var(--card); }
      `}</style>
    </DrawerShell>
  );
}

function labelForAction(a) {
  return {
    created:              'Created',
    sent_to_committee:    'Sent to committee chairman',
    submitted_for_review: 'Submitted for branch review',
    approved:             'Approved',
    rejected:             'Rejected',
  }[a] ?? a;
}

function ChecklistItemRow({ item, canFill, canEdit, onChangeValue, onDelete, disabled }) {
  const [local, setLocal] = useState(item.value ?? '');
  useEffect(() => setLocal(item.value ?? ''), [item.value]);

  const inputType = item.kind === 'date' ? 'date' : (item.kind === 'number' || item.kind === 'money' ? 'number' : 'text');
  const placeholder = item.kind === 'money' ? '₹ amount in rupees' : '';

  return (
    <div className="item-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>
          {item.label}
          {item.required && <span style={{ color: 'var(--destructive)' }}> *</span>}
        </div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>{item.kind}</div>
      </div>
      <input
        className="input-base"
        type={inputType}
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== (item.value ?? '')) onChangeValue(local); }}
        disabled={!canFill || disabled}
        style={{ maxWidth: 220 }}
      />
      {canEdit && (
        <button type="button" className="btn btn-ghost" onClick={onDelete} disabled={disabled}
                style={{ padding: '.3rem', color: 'var(--destructive)' }} title="Remove item">
          <IconX size="sm" />
        </button>
      )}

      <style>{`
        .item-row {
          display: flex; align-items: center; gap: .75rem;
          padding: .75rem .875rem; border: 1px solid var(--border);
          border-radius: .375rem; background: var(--card);
        }
      `}</style>
    </div>
  );
}

function DrawerShell({ onClose, title, subtitle, pill, children }) {
  return (
    <div className="drawer-root" role="dialog" aria-modal="true">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer-panel">
        <div className="drawer-head">
          <button type="button" className="back-btn" onClick={onClose} aria-label="Back">
            <IconArrowLeft size="sm" /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0, marginLeft: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
            {subtitle && <div className="muted-text" style={{ fontSize: '.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
          {pill}
        </div>
        <div className="drawer-body">{children}</div>
      </aside>

      <style>{`
        .drawer-root { position: fixed; inset: 0; z-index: 100; }
        .drawer-backdrop {
          position: absolute; inset: 0; background: rgba(15,23,42,.45);
        }
        .drawer-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: min(760px, 100vw); background: var(--background);
          display: flex; flex-direction: column;
          box-shadow: -8px 0 30px rgba(0,0,0,.15);
          animation: drawer-slide-in .18s ease-out;
        }
        .drawer-head {
          display: flex; align-items: center;
          padding: 1rem 1.25rem; border-bottom: 1px solid var(--border);
          background: var(--card);
        }
        .back-btn {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .35rem .65rem; background: transparent; border: 1px solid var(--border);
          border-radius: .375rem; cursor: pointer; font-size: .8125rem;
        }
        .drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
        @keyframes drawer-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
