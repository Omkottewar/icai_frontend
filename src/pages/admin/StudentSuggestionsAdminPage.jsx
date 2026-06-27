import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { Shimmer } from '../../components/ui/Shimmer';
import { IconCheck, IconX, IconTrash } from '../../icons';

// Admin moderation queue for student-submitted suggestions.
//   • Pending tab — approve / reject (with reason)
//   • Approved — what's live on the home card / public page
//   • Rejected — history with the reason the admin entered
//   • Archived — soft-archived items
// Soft-delete is on the row menu; it doesn't ever hard-delete (we want the
// audit trail to survive).

const TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'archived', label: 'Archived' },
];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function ago(d) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StudentSuggestionsAdminPage() {
  const { showToast } = useAuth();
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState(null);
  const [counts, setCounts] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);     // id of the row currently being mutated
  const [rejecting, setRejecting] = useState(null); // { id, body } when reject modal open
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`/api/admin/student-suggestions?status=${tab}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load suggestions');
      const j = await r.json();
      setItems(j.rows || []);
      setCounts(j.counts || {});
    } catch (e) { setErr(e.message); setItems([]); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/student-suggestions/${id}/approve`, {
        method: 'POST', credentials: 'include',
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Approve failed');
      showToast?.('Approved — now visible publicly', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const reject = async () => {
    if (!rejecting) return;
    const reason = rejectReason.trim();
    if (!reason) { showToast?.('Enter a reason so the author knows why', 'warning'); return; }
    setBusy(rejecting.id);
    try {
      const r = await fetch(`/api/admin/student-suggestions/${rejecting.id}/reject`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Reject failed');
      showToast?.('Rejected — author will see the reason', 'success');
      setRejecting(null);
      setRejectReason('');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const softDelete = async (id) => {
    if (!window.confirm('Soft-delete this suggestion? It will be hidden from all views but the row is preserved for audit.')) return;
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/student-suggestions/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error('Delete failed');
      showToast?.('Removed', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const headerActions = useMemo(() => (
    <a href="#/admin/student-suggestion-topics" className="btn btn-outline" style={{ fontSize: '.8125rem' }}>
      Manage topics
    </a>
  ), []);

  return (
    <AdminLayout
      title="Student Suggestions"
      subtitle="Moderate submissions from students and members. Approved items appear on the home WICASA card and the public /student-suggestions page."
      actions={headerActions}
    >
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {/* Status tabs with count badges */}
      <div className="row gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={active ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ paddingInline: '.9rem' }}>
              {t.label}
              <span style={{
                marginLeft: '.5rem', fontSize: '.75rem', fontWeight: 700,
                background: active ? 'rgba(255,255,255,.25)' : 'var(--muted, #f1f5f9)',
                padding: '.1rem .45rem', borderRadius: '999px',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {items === null && !err && (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                <Shimmer height=".75rem" width="6rem" />
                <Shimmer height=".9rem" width="80%" />
                <Shimmer height=".7rem" width="40%" />
              </div>
              <Shimmer height="2rem" width="6rem" radius=".4rem" />
            </div>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">Nothing in this queue.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {items.map((row) => (
            <li key={row.id} className="card" style={{ padding: '1rem 1.1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: '16rem' }}>
                  <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: '.4rem' }}>
                    {row.topic_name && (
                      <span style={{
                        fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
                        padding: '.15rem .55rem', borderRadius: 999,
                        background: 'oklch(0.55 0.14 155 / 0.12)', color: 'var(--secondary)',
                      }}>{row.topic_name}</span>
                    )}
                    <span className="muted-text" style={{ fontSize: '.75rem' }}>{ago(row.created_at)}</span>
                    {tab === 'approved' && (
                      <span className="muted-text" style={{ fontSize: '.75rem' }}>
                        · {row.vote_count ?? 0} upvotes
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '.95rem', lineHeight: 1.5 }}>{row.body}</p>
                  <div className="muted-text" style={{ marginTop: '.4rem', fontSize: '.75rem' }}>
                    {row.author_name || 'Anonymous'}
                    {row.author_email ? ` · ${row.author_email}` : ''}
                    {row.reviewed_at && ` · reviewed ${fmt(row.reviewed_at)}`}
                  </div>
                  {row.status === 'rejected' && row.reject_reason && (
                    <p style={{
                      marginTop: '.5rem', padding: '.5rem .65rem',
                      background: 'oklch(0.95 0.05 25)', borderLeft: '3px solid oklch(0.6 0.18 25)',
                      borderRadius: '.25rem', fontSize: '.8125rem', color: 'oklch(0.35 0.13 25)',
                    }}>
                      <strong>Rejection reason:</strong> {row.reject_reason}
                    </p>
                  )}
                </div>

                <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                  {tab === 'pending' && (
                    <>
                      <button type="button" className="btn btn-primary"
                        onClick={() => approve(row.id)}
                        disabled={busy === row.id}
                        style={{ fontSize: '.8125rem' }}>
                        <IconCheck size="sm" /> Approve
                      </button>
                      <button type="button" className="btn btn-outline"
                        onClick={() => { setRejecting(row); setRejectReason(''); }}
                        disabled={busy === row.id}
                        style={{ fontSize: '.8125rem' }}>
                        <IconX size="sm" /> Reject
                      </button>
                    </>
                  )}
                  {tab === 'approved' && (
                    <button type="button" className="btn btn-outline"
                      onClick={() => { setRejecting(row); setRejectReason(''); }}
                      disabled={busy === row.id}
                      style={{ fontSize: '.8125rem' }}>
                      <IconX size="sm" /> Take down
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost"
                    onClick={() => softDelete(row.id)}
                    disabled={busy === row.id}
                    title="Soft-delete (hide from all views)"
                    style={{ fontSize: '.8125rem' }}>
                    <IconTrash size="sm" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Reject reason modal */}
      {rejecting && (
        <div className="dialog-overlay" role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRejecting(null); }}>
          <div className="dialog-shell" role="dialog" aria-modal="true"
            style={{ width: 'min(28rem, 100%)' }}>
            <div className="dialog-header">
              <h2 className="dialog-title">
                {rejecting.status === 'approved' ? 'Take down suggestion' : 'Reject suggestion'}
              </h2>
              <button type="button" className="dialog-close" onClick={() => setRejecting(null)} aria-label="Close">
                <IconX />
              </button>
            </div>
            <div className="dialog-body">
              <p className="muted-text" style={{ fontSize: '.85rem', marginBottom: '.75rem' }}>
                The author will see this reason in their "My suggestions" tab.
              </p>
              <blockquote style={{
                margin: '0 0 .75rem', padding: '.6rem .75rem',
                background: 'var(--muted, #f1f5f9)', borderRadius: '.4rem',
                fontSize: '.85rem', fontStyle: 'italic',
              }}>"{rejecting.body}"</blockquote>
              <label>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Reason</div>
                <textarea
                  className="input-base" rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Off-topic / not actionable / duplicates another item"
                  maxLength={500}
                  autoFocus
                />
              </label>
            </div>
            <div className="dialog-footer">
              <button type="button" className="btn btn-outline" onClick={() => setRejecting(null)}>Cancel</button>
              <button type="button" className="btn btn-primary"
                onClick={reject}
                disabled={!rejectReason.trim() || busy === rejecting.id}>
                {busy === rejecting.id ? 'Saving…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
