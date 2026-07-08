import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../hooks/useSiteContent';
import { navigate } from '../hooks/useRoute';
import { cachedGet, apiWrite, invalidate } from '../lib/apiCache';
import { toast } from '../lib/notify';
import Button from '../components/ui/Button';
import { IconArrowRight, IconMessageSquare, IconX } from '../icons';

// Peer discussion board for students. Reuses the /api/forum backend by
// scoping to topic='student_general' — the same schema the event Q&A and
// mock-test discussions use, so search / soft-delete / audit already work.
//
// Access: login required. Only signed-in students (or admins) can create
// threads. Anyone signed in can read.

const TOPIC = 'student_general';
const TAGS = [
  { value: 'discussion',       label: 'Discussion' },
  { value: 'doubt',            label: 'Doubt' },
  { value: 'resource_request', label: 'Ask for resources' },
  { value: 'announcement',     label: 'Announcement' },
];

function fmtWhen(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d <= 0) {
    const h = Math.floor(ms / 3_600_000);
    if (h <= 0) return 'just now';
    return `${h}h ago`;
  }
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function StudentForumPage() {
  const header = useSiteContent('student_forum_page');
  const { user, loading: authLoading } = useAuth();

  const [threads, setThreads] = useState(null);
  const [error, setError] = useState(null);
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState(null);

  const query = useMemo(() => ({
    topic: TOPIC, page: 1, pageSize: 30,
    ...(tag ? { tag } : {}),
    ...(q ? { q } : {}),
  }), [tag, q]);

  useEffect(() => {
    let cancelled = false;
    setThreads(null);
    cachedGet('/api/forum/threads', query, 30_000)
      .then((j) => { if (!cancelled) setThreads(j.rows || []); })
      .catch((e) => { if (!cancelled) { setError(e); setThreads([]); } });
    return () => { cancelled = true; };
  }, [query]);

  function refresh() {
    invalidate('/api/forum/threads');
    cachedGet('/api/forum/threads', query, 30_000)
      .then((j) => setThreads(j.rows || []))
      .catch(() => {});
  }

  function handleNewThread() {
    if (!user) { navigate('/login?next=/student-forum'); return; }
    if (user.primary_role !== 'student') {
      toast.warning('Only students can start peer forum threads. Members — please use the event Q&A or committee forum instead.');
      return;
    }
    setComposerOpen(true);
  }

  return (
    <>
      <PageHeader title={header.title || 'Student peer forum'}
                  subtitle={header.subtitle || 'Ask, share, and help each other — moderated by WICASA.'} />

      <section className="container" style={{ padding: '2rem 1rem' }}>
        {!user && !authLoading && (
          <div className="card" style={{ background: 'oklch(0.97 0 0)', marginBottom: '1.5rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem' }}>
              <div style={{ fontSize: '.875rem' }}>
                <strong>Sign in to post.</strong> You can read threads without an account.
              </div>
              <a href="/login?next=/student-forum" className="btn btn-primary">Sign in</a>
            </div>
          </div>
        )}

        <div className="row" style={{ justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            <select className="input-base" value={tag} onChange={(e) => setTag(e.target.value)} style={{ padding: '.4rem .75rem', fontSize: '.8125rem' }}>
              <option value="">All types</option>
              {TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="search"
              className="input-base"
              placeholder="Search threads…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ padding: '.4rem .75rem', fontSize: '.8125rem', minWidth: 220 }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleNewThread}>
            <IconMessageSquare size="sm" /> New thread
          </button>
        </div>

        {threads === null ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '2rem' }}>Loading discussions…</div>
        ) : threads.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '2rem' }}>
            {q || tag
              ? <>No threads match this filter. <button className="btn-link" onClick={() => { setQ(''); setTag(''); }}>Clear filters</button></>
              : <>No threads yet. Be the first to start a discussion.</>}
          </div>
        ) : (
          <ul className="col" style={{ listStyle: 'none', padding: 0, margin: 0, gap: '.75rem' }}>
            {threads.map((t) => (
              <li key={t.id} className="card" style={{ padding: '1rem' }}>
                <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: 'oklch(0.95 0.02 250)', color: 'oklch(0.35 0.14 250)', fontSize: '.7rem', padding: '.15rem .5rem', borderRadius: 999 }}>
                    {t.tag?.replace(/_/g, ' ') || 'discussion'}
                  </span>
                  <span className="muted-text" style={{ fontSize: '.75rem' }}>
                    {t.author_name} · {fmtWhen(t.created_at)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  style={{ display: 'block', textAlign: 'left', marginTop: '.5rem', fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => setSelectedThreadId(t.id)}
                >
                  {t.title}
                </button>
                <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.35rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {t.body}
                </p>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: '.5rem' }}>
                  <span className="muted-text" style={{ fontSize: '.75rem' }}>
                    {t.reply_count === 0 ? 'No replies yet' : `${t.reply_count} ${t.reply_count === 1 ? 'reply' : 'replies'}`}
                  </span>
                  <button type="button" className="row gap-1" style={{ fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => setSelectedThreadId(t.id)}>
                    Open <IconArrowRight size="sm" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginTop: '1rem' }}>
            {error.message || 'Could not load the forum.'}
          </div>
        )}
      </section>

      {composerOpen && (
        <ComposeThreadModal
          onClose={() => setComposerOpen(false)}
          onCreated={() => { setComposerOpen(false); refresh(); }}
        />
      )}

      {selectedThreadId && (
        <ThreadDrawer
          threadId={selectedThreadId}
          onClose={() => setSelectedThreadId(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}

// ─── Composer modal ───────────────────────────────────────────────────────
function ComposeThreadModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [tag, setTag]     = useState('discussion');
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const t = title.trim(); const b = body.trim();
    if (!t) { toast.warning('Give your thread a title.'); return; }
    if (!b) { toast.warning('Add some detail to your post.'); return; }
    setBusy(true);
    try {
      await apiWrite('/api/forum/threads', {
        method: 'POST',
        body: { title: t, body: b, tag, topic: TOPIC },
        invalidates: '/api/forum/threads',
      });
      toast.success('Thread posted');
      onCreated?.();
    } catch (err) {
      toast.error(err?.message || 'Could not post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" style={{ width: 'min(34rem, 100%)' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">Start a discussion</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <form onSubmit={submit}>
          <div className="dialog-body">
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Title</div>
              <input
                type="text" className="input-base" required disabled={busy}
                value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                placeholder="e.g. Anyone else stuck on the SM paper last month?"
              />
            </label>

            <label style={{ display: 'block', marginTop: '.75rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Type</div>
              <select className="input-base" value={tag} onChange={(e) => setTag(e.target.value)} disabled={busy}>
                {TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            <label style={{ display: 'block', marginTop: '.75rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Details</div>
              <textarea
                className="input-base" rows={6} required disabled={busy}
                value={body} onChange={(e) => setBody(e.target.value.slice(0, 10_000))}
                placeholder="Share as much context as you can — the more specific, the better the help."
                style={{ resize: 'vertical' }}
              />
            </label>
            <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.5rem' }}>
              Keep it civil. Posts violating the code of conduct will be removed by WICASA moderators.
            </p>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <Button type="submit" className="btn btn-primary" loading={busy} disabled={!title.trim() || !body.trim()}>
              {busy ? 'Posting…' : 'Post thread'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Thread drawer (view + reply) ─────────────────────────────────────────
function ThreadDrawer({ threadId, onClose, onChanged }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    cachedGet(`/api/forum/threads/${threadId}`, null, 15_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [threadId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function postReply(e) {
    e.preventDefault();
    if (busy) return;
    const b = reply.trim();
    if (!b) { toast.warning('Type a reply before posting.'); return; }
    setBusy(true);
    try {
      await apiWrite(`/api/forum/threads/${threadId}/posts`, {
        method: 'POST',
        body: { body: b },
        invalidates: `/api/forum/threads/${threadId}`,
      });
      setReply('');
      // Reload the thread so the new reply lands.
      const j = await cachedGet(`/api/forum/threads/${threadId}`, null, 0);
      setData(j);
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || 'Could not post reply.');
    } finally {
      setBusy(false);
    }
  }

  const canReply = !!user;

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(42rem, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">{data?.thread?.title || 'Loading…'}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          {error && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{error.message}</p>}
          {!data ? (
            <p className="muted-text" style={{ fontSize: '.875rem' }}>Loading thread…</p>
          ) : (
            <>
              <div style={{ padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div className="muted-text" style={{ fontSize: '.75rem' }}>
                  {data.thread.author_name} · {fmtWhen(data.thread.created_at)}
                </div>
                <p style={{ marginTop: '.5rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {data.thread.body}
                </p>
              </div>
              <div style={{ marginTop: '.75rem' }}>
                <h3 style={{ fontSize: '.8125rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', fontWeight: 700 }}>
                  {data.posts.length === 0 ? 'No replies yet' : `${data.posts.length} ${data.posts.length === 1 ? 'reply' : 'replies'}`}
                </h3>
                <ul className="col" style={{ listStyle: 'none', padding: 0, margin: '.5rem 0 0', gap: '.5rem' }}>
                  {data.posts.map((p) => (
                    <li key={p.id} style={{ padding: '.5rem .75rem', background: 'var(--muted)', borderRadius: '.5rem' }}>
                      <div className="muted-text" style={{ fontSize: '.75rem' }}>
                        {p.author_name} · {fmtWhen(p.created_at)}
                      </div>
                      <p style={{ marginTop: '.25rem', fontSize: '.875rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {p.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        {canReply && data && (
          <form onSubmit={postReply} style={{ borderTop: '1px solid var(--border)', padding: '.75rem 1rem' }}>
            <textarea
              className="input-base"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, 10_000))}
              placeholder="Write a reply…"
              disabled={busy}
              style={{ resize: 'vertical' }}
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
              <Button type="submit" className="btn btn-primary" loading={busy} disabled={!reply.trim()}>
                {busy ? 'Posting…' : 'Reply'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
