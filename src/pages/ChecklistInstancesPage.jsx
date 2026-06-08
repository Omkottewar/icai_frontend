import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import QuestionRenderer from '../components/checklists/QuestionRenderer';
import { hasAnswer } from '../lib/checklistQuestions';
import { IconX } from '../icons';

const STATUS_LABEL = {
  draft:           'Draft (not released)',
  awaiting_fill:   'Awaiting fill',
  awaiting_review: 'Awaiting review',
  approved:        'Approved',
  rejected:        'Rejected',
};
const STATUS_PILL = {
  draft:           { bg: '#f1f5f9', fg: '#475569' },
  awaiting_fill:   { bg: '#fef3c7', fg: '#92400e' },
  awaiting_review: { bg: '#dbeafe', fg: '#1e40af' },
  approved:        { bg: '#dcfce7', fg: '#166534' },
  rejected:        { bg: '#fee2e2', fg: '#991b1b' },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ChecklistInstancesPage() {
  const route = useRoute();
  const openId = route.query.id || null;

  return (
    <>
      <PageHeader title="My checklists" subtitle="Fill or review checklists assigned to you" />
      <section className="container" style={{ padding: '2rem 1rem' }}>
        <InstancesList onOpen={(id) => navigate('/my-checklists?id=' + id)} />
      </section>
      {openId && <InstanceDrawer id={openId} onClose={() => navigate('/my-checklists')} />}
    </>
  );
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

function InstancesList({ onOpen }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/api/checklist-instances')
      .then((j) => { if (!cancelled) setRows(j.rows || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (err)        return <p className="muted-text" style={{ color: 'var(--destructive)' }}>{err}</p>;
  if (rows === null) return <p className="muted-text">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p className="muted-text">Nothing assigned to you right now.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
      {rows.map((r) => (
        <button key={r.id} onClick={() => onOpen(r.id)} className="ci-row">
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>
              {r.template_name} v{r.template_version}
              {r.event_title ? ` · ${r.event_title}` : ''}
              {' · '}Updated {fmt(r.updated_at)}
            </div>
          </div>
          <StatusPill status={r.status} />
          <style>{`
            .ci-row {
              display: flex; align-items: center; gap: 1rem;
              width: 100%; padding: 1rem 1.25rem;
              background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
              cursor: pointer; transition: border-color .12s, background .12s;
            }
            .ci-row:hover { border-color: var(--primary); background: var(--muted, #fafaf9); }
          `}</style>
        </button>
      ))}
    </div>
  );
}

function InstanceDrawer({ id, onClose }) {
  const { showToast } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const j = await api(`/api/checklist-instances/${id}`);
      setData(j);
      setDraft(j.responses || {});
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [id]);

  if (err) return <FullDrawer onClose={onClose}><p style={{ color: 'var(--destructive)' }}>{err}</p></FullDrawer>;
  if (!data) return <FullDrawer onClose={onClose}><p className="muted-text">Loading…</p></FullDrawer>;

  const { instance, template, questions, reviews, perms, assignees } = data;
  const editable = perms.canFill && (instance.status === 'awaiting_fill' || instance.status === 'rejected');
  const reviewable = perms.canReview && instance.status === 'awaiting_review';
  const releaseable = perms.canRelease;  // admin + status='draft'

  const setVal = (qid, v) => setDraft((d) => ({ ...d, [qid]: v }));

  const saveProgress = async () => {
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/responses`, {
        method: 'PUT',
        body: { responses: draft },
      });
      showToast?.('Saved', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/responses`, { method: 'PUT', body: { responses: draft } });
      await api(`/api/checklist-instances/${id}/submit`, { method: 'POST' });
      showToast?.('Submitted for review', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!confirm('Approve this checklist?')) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/approve`, { method: 'POST' });
      showToast?.('Approved', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const reject = async () => {
    const note = prompt('Reason for rejection?');
    if (!note?.trim()) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/reject`, { method: 'POST', body: { note } });
      showToast?.('Rejected', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const release = async () => {
    if (!assignees?.filler) {
      if (!confirm('No filler is assigned yet. Releasing now will rely on role-based fallback. Continue?')) return;
    } else {
      if (!confirm(`Release this checklist to ${assignees.filler.name}? After release they can fill it.`)) return;
    }
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/release`, { method: 'POST' });
      showToast?.('Released — chairman can now fill it.', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const missing = questions.filter((q) => q.required && q.type !== 'section_heading' && !hasAnswer(q.type, draft[q.id])).length;

  return (
    <FullDrawer onClose={onClose}>
      <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{instance.title}</h2>
            <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
              {template.name} v{template.version} · Updated {fmt(instance.updated_at)}
            </p>
          </div>
          <StatusPill status={instance.status} />
        </div>

        {/* Assignee summary — surfaced for everyone but most useful to admin
            who needs to confirm the auto-assignment before releasing. */}
        {(assignees?.filler || assignees?.reviewer || instance.status === 'draft') && (
          <div style={{
            marginTop: '.75rem', padding: '.625rem .875rem',
            background: 'var(--background)', border: '1px solid var(--border)',
            borderRadius: '.375rem', fontSize: '.8125rem',
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '.4rem 1rem',
          }}>
            <strong>Filler:</strong>
            <span>
              {assignees?.filler
                ? <>{assignees.filler.name} <span className="muted-text">· {assignees.filler.email}</span></>
                : <em className="muted-text">— not assigned —</em>}
            </span>
            <strong>Reviewer:</strong>
            <span>
              {assignees?.reviewer
                ? <>{assignees.reviewer.name} <span className="muted-text">· {assignees.reviewer.email}</span></>
                : <em className="muted-text">— not assigned —</em>}
            </span>
          </div>
        )}

        {missing > 0 && editable && (
          <p style={{ marginTop: '.5rem', fontSize: '.8125rem', color: '#92400e' }}>
            {missing} required question{missing !== 1 ? 's' : ''} still need an answer.
          </p>
        )}

        {/* Status-specific context messages. */}
        {instance.status === 'draft' && releaseable && (
          <div style={{
            marginTop: '.75rem', padding: '.625rem .875rem',
            background: '#fef3c7', border: '1px solid #fcd34d',
            color: '#92400e', borderRadius: '.375rem', fontSize: '.8125rem',
          }}>
            <strong>Draft — not released yet.</strong>{' '}
            The filler can't see this until you click <em>Release to filler</em> below.
            Review the assignees first, and reassign via the events admin if needed.
          </div>
        )}

        {!perms.canFill && !perms.canReview && !releaseable && (
          <div style={{
            marginTop: '.75rem', padding: '.625rem .875rem',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            color: '#1e3a8a', borderRadius: '.375rem', fontSize: '.8125rem',
          }}>
            <strong>View only.</strong>{' '}
            {instance.status === 'awaiting_fill' || instance.status === 'rejected'
              ? 'The committee chairman fills this in. As admin, you can monitor progress but cannot enter answers.'
              : instance.status === 'awaiting_review'
                ? 'The branch chairman reviews this. As admin, you can monitor but cannot approve or reject.'
                : 'You can view this record but cannot make changes.'}
          </div>
        )}
      </header>

      <div>
        {questions.map((q) => (
          <QuestionRenderer
            key={q.id}
            question={q}
            value={draft[q.id]}
            onChange={(v) => setVal(q.id, v)}
            mode={editable ? 'fill' : 'readonly'}
          />
        ))}
      </div>

      {reviews.length > 0 && (
        <section style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '.875rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)' }}>Activity</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {reviews.map((r) => (
              <li key={r.id} style={{ padding: '.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                <strong>{r.actor_name || '—'}</strong>{' '}
                <span className="muted-text">{r.action.replace(/_/g, ' ')}</span>
                <span className="muted-text" style={{ marginLeft: '.5rem' }}>{fmt(r.created_at)}</span>
                {r.note && <div style={{ fontSize: '.875rem' }}>{r.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ position: 'sticky', bottom: 0, background: 'var(--card)', borderTop: '1px solid var(--border)', padding: '.75rem 0', marginTop: '1.5rem', display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
        {releaseable && (
          <button className="btn-primary" onClick={release} disabled={busy}>
            Release to filler →
          </button>
        )}
        {editable && (
          <>
            <button onClick={saveProgress} disabled={busy}>Save progress</button>
            <button className="btn-primary" onClick={submit} disabled={busy || missing > 0}>Submit for review</button>
          </>
        )}
        {reviewable && (
          <>
            <button onClick={reject} disabled={busy} style={{ color: 'var(--destructive)' }}>Reject</button>
            <button className="btn-primary" onClick={approve} disabled={busy}>Approve</button>
          </>
        )}
      </footer>
    </FullDrawer>
  );
}

function FullDrawer({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }} />
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(720px, 100vw)',
        background: 'var(--card)', boxShadow: '-8px 0 30px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '.75rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
            <IconX />
          </button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>{children}</div>
      </aside>
    </div>
  );
}
