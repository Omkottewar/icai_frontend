import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useRoute, navigate } from '../hooks/useRoute';
import { useForumThreads, useForumThread, useForumLookups, forumFetch } from '../hooks/useForum';
import { Shimmer, ShimmerStyles } from '../components/ui/Shimmer';
import { IconArrowLeft, IconX } from '../icons';

// ─── tag presets ──────────────────────────────────────────────────────────
const TAGS = [
  { code: 'discussion',       label: 'Discussion',       color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { code: 'doubt',            label: 'Doubt',            color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  { code: 'suggestion',       label: 'Suggestion',       color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  { code: 'announcement',     label: 'Announcement',     color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  { code: 'resource_request', label: 'Resource request', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
];
const TAG_BY_CODE = Object.fromEntries(TAGS.map((t) => [t.code, t]));

function TagPill({ code, size = 'sm' }) {
  const t = TAG_BY_CODE[code] ?? { label: code, color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
  const padding = size === 'lg' ? '.25rem .65rem' : '.15rem .55rem';
  const fontSize = size === 'lg' ? '.75rem' : '.6875rem';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '.35rem',
      padding, borderRadius: 999,
      background: t.bg, color: t.color, fontSize, fontWeight: 600,
      border: `1px solid ${t.border}`, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '.4rem', height: '.4rem', borderRadius: '50%',
        background: t.color, flexShrink: 0,
      }} />
      {t.label}
    </span>
  );
}

function fmtAge(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// Deterministic gradient for an avatar based on the user's name. Keeps avatars
// visually distinct without storing per-user colour preferences.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #10b981, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #f43f5e)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #14b8a6, #84cc16)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #f97316, #ef4444)',
  'linear-gradient(135deg, #84cc16, #22c55e)',
];
function avatarGradient(name) {
  if (!name) return AVATAR_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

// Truncated preview of the body for thread cards.
function preview(body, max = 160) {
  if (!body) return '';
  const trimmed = body.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + '…' : trimmed;
}

// ─── page root ────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const route = useRoute();

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user]);

  const openId = route.query.id || null;
  const composing = route.query.new === '1';

  if (authLoading) return <p className="muted-text" style={{ padding: '4rem 1rem', textAlign: 'center' }}>Loading…</p>;
  if (!user) return null;

  return (
    <>
      <ShimmerStyles />
      <PageHeader title="Community" subtitle="Ask, share, discuss — across events and committees" />

      <section className="container" style={{ padding: '1.5rem 1rem 4rem' }}>
        <ThreadsList onOpen={(id) => navigate('/community?id=' + id)} onNew={() => navigate('/community?new=1')} />
      </section>

      {openId && <ThreadDetail id={openId} onClose={() => navigate('/community')} />}
      {composing && <ComposeDrawer onClose={() => navigate('/community')} />}
    </>
  );
}

// ─── threads list ────────────────────────────────────────────────────────
function ThreadsList({ onOpen, onNew }) {
  const [tag, setTag] = useState('');
  const [scope, setScope] = useState(''); // '', 'event:<id>', 'committee:<id>'
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [mine, setMine] = useState(false);

  const lookups = useForumLookups();

  // Debounce the search box — without this, every keystroke fires a network
  // request and a re-render.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = { tag, q: debouncedQ, mine: mine ? '1' : '' };
  if (scope.startsWith('event:'))     params.event_id = scope.slice(6);
  if (scope.startsWith('committee:')) params.committee_id = scope.slice(10);
  const { data, loading } = useForumThreads(params);

  const activeFilters = (tag ? 1 : 0) + (scope ? 1 : 0) + (debouncedQ ? 1 : 0) + (mine ? 1 : 0);

  return (
    <>
      {/* ─── Filter bar (sticky on scroll) ─── */}
      <div className="filter-bar">
        <div className="filter-bar-top">
          <div className="search-group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input placeholder="Search threads, doubts, suggestions…"
                   value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
                <IconX size="sm" />
              </button>
            )}
          </div>
          <button className="new-thread-btn" onClick={onNew}>
            <span aria-hidden>＋</span> New thread
          </button>
        </div>

        <div className="filter-bar-bottom">
          <div className="chip-group" role="tablist" aria-label="Filter by tag">
            <button className={'chip' + (tag === '' ? ' chip-active' : '')} onClick={() => setTag('')}>
              All
            </button>
            {TAGS.map((t) => (
              <button key={t.code} className={'chip' + (tag === t.code ? ' chip-active' : '')}
                      onClick={() => setTag(t.code === tag ? '' : t.code)}
                      style={tag === t.code ? { background: t.bg, color: t.color, borderColor: t.border } : undefined}>
                <span className="chip-dot" style={{ background: t.color }} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="filter-controls">
            <select className="select-input" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">All scopes</option>
              <optgroup label="Committee">
                {(lookups?.committees ?? []).map((c) => (
                  <option key={'c:' + c.id} value={'committee:' + c.id}>{c.name}</option>
                ))}
              </optgroup>
              <optgroup label="Event">
                {(lookups?.events ?? []).slice(0, 20).map((e) => (
                  <option key={'e:' + e.id} value={'event:' + e.id}>{e.title}</option>
                ))}
              </optgroup>
            </select>
            <label className="my-threads-toggle">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
              My threads
            </label>
            {activeFilters > 0 && (
              <button className="clear-filters" onClick={() => { setTag(''); setScope(''); setQ(''); setMine(false); }}>
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Results meta ─── */}
      {data && (
        <div className="results-meta">
          <span>{data.total ?? data.rows.length} {(data.total ?? data.rows.length) === 1 ? 'thread' : 'threads'}</span>
          {activeFilters > 0 && <span className="results-meta-filter-count">· {activeFilters} filter{activeFilters !== 1 ? 's' : ''} active</span>}
        </div>
      )}

      {/* ─── List / empty state ─── */}
      {loading && !data && (
        <ul className="thread-list">
          {Array.from({ length: 4 }).map((_, i) => <ThreadRowSkeleton key={i} />)}
        </ul>
      )}

      {data && data.rows.length === 0 && <EmptyState onNew={onNew} hasFilters={activeFilters > 0}
        onClearFilters={() => { setTag(''); setScope(''); setQ(''); setMine(false); }} />}

      {data && data.rows.length > 0 && (
        <ul className="thread-list">
          {data.rows.map((t) => (
            <li key={t.id}>
              <button onClick={() => onOpen(t.id)} className="thread-card">
                <span className="avatar" aria-hidden style={{ background: avatarGradient(t.author_name) }}>
                  {initials(t.author_name)}
                </span>
                <div className="thread-card-body">
                  <div className="thread-card-head">
                    <h3 className="thread-card-title">{t.title}</h3>
                    <TagPill code={t.tag} />
                  </div>
                  {t.body && <p className="thread-card-preview">{preview(t.body)}</p>}
                  <div className="thread-card-meta">
                    <span className="meta-author">{t.author_name}</span>
                    <span className="meta-sep">·</span>
                    <span className="meta-scope">{t.committee_name || t.event_title || 'General'}</span>
                    <span className="meta-sep">·</span>
                    <span className="meta-age">{fmtAge(t.updated_at)}</span>
                  </div>
                </div>
                <div className="thread-card-replies">
                  <div className="reply-pill">
                    <span className="reply-pill-num">{t.reply_count}</span>
                    <span className="reply-pill-label">{t.reply_count === 1 ? 'reply' : 'replies'}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        /* ─── filter bar ─── */
        .filter-bar {
          position: sticky; top: 64px; z-index: 5;
          margin-bottom: 1.25rem; padding: 1rem 1.125rem;
          background: var(--card);
          border: 1px solid var(--border); border-radius: .75rem;
          box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.03);
          backdrop-filter: saturate(180%) blur(8px);
        }
        .filter-bar-top {
          display: flex; gap: .75rem; align-items: center;
          padding-bottom: .875rem; border-bottom: 1px solid var(--border);
        }
        .filter-bar-bottom {
          display: flex; gap: 1rem; align-items: center; justify-content: space-between;
          flex-wrap: wrap; padding-top: .875rem;
        }
        .search-group {
          display: flex; align-items: center; gap: .55rem;
          flex: 1; min-width: 0; padding: .55rem .8rem;
          background: var(--background); border: 1px solid var(--border);
          border-radius: .5rem; transition: border-color .15s, box-shadow .15s;
        }
        .search-group:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent);
        }
        .search-group svg { color: var(--muted-foreground); flex-shrink: 0; }
        .search-group input {
          flex: 1; background: transparent; border: 0; outline: 0;
          font-size: .875rem; color: var(--foreground); min-width: 0;
        }
        .search-clear {
          background: transparent; border: 0; padding: .15rem; cursor: pointer;
          color: var(--muted-foreground); border-radius: .25rem;
        }
        .search-clear:hover { background: var(--muted, #f5f5f4); color: var(--foreground); }
        .new-thread-btn {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .55rem 1.05rem; border-radius: .5rem;
          background: linear-gradient(180deg, var(--primary), color-mix(in oklch, var(--primary) 85%, black));
          color: white; font-size: .875rem; font-weight: 600;
          border: 0; cursor: pointer; white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 2px 6px rgba(54,34,255,.15);
          transition: transform .12s, box-shadow .12s;
        }
        .new-thread-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,.08), 0 4px 12px rgba(54,34,255,.2); }
        .new-thread-btn:active { transform: translateY(0); }
        .new-thread-btn span { font-size: 1.1em; line-height: 1; }

        .chip-group {
          display: flex; gap: .375rem; flex-wrap: wrap; align-items: center;
        }
        .chip {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .35rem .75rem; border-radius: 999px;
          border: 1px solid var(--border); background: var(--background);
          font-size: .75rem; font-weight: 500; color: var(--foreground);
          cursor: pointer; transition: background .15s, border-color .15s, transform .12s;
          white-space: nowrap;
        }
        .chip:hover { background: var(--muted, #f5f5f4); }
        .chip:active { transform: scale(.97); }
        .chip-active { background: #0f172a !important; color: white !important; border-color: #0f172a !important; }
        .chip-active .chip-dot { background: white !important; }
        .chip-dot { width: .375rem; height: .375rem; border-radius: 50%; background: var(--muted-foreground); flex-shrink: 0; }

        .filter-controls { display: flex; gap: .65rem; align-items: center; flex-wrap: wrap; }
        .select-input {
          padding: .4rem .65rem; border-radius: .375rem;
          border: 1px solid var(--border); background: var(--background);
          font-size: .8125rem; color: var(--foreground); cursor: pointer;
          max-width: 200px;
        }
        .select-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        .my-threads-toggle {
          display: inline-flex; align-items: center; gap: .4rem;
          font-size: .8125rem; color: var(--muted-foreground);
          cursor: pointer; user-select: none;
        }
        .my-threads-toggle input { cursor: pointer; }
        .clear-filters {
          background: transparent; border: 0; padding: .25rem .5rem;
          font-size: .75rem; color: var(--primary); font-weight: 600;
          cursor: pointer; border-radius: .25rem;
        }
        .clear-filters:hover { background: color-mix(in oklch, var(--primary) 8%, transparent); }

        /* ─── results meta ─── */
        .results-meta {
          font-size: .75rem; color: var(--muted-foreground); margin-bottom: .75rem;
          padding-left: .25rem; display: flex; gap: .35rem; align-items: center;
          font-weight: 500;
        }
        .results-meta-filter-count { opacity: .85; }

        /* ─── thread cards ─── */
        .thread-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .625rem; }
        .thread-card {
          display: flex; gap: 1rem; align-items: stretch;
          width: 100%; padding: 1.125rem 1.25rem;
          background: var(--card); border: 1px solid var(--border); border-radius: .75rem;
          cursor: pointer; text-align: left;
          transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,.03);
        }
        .thread-card:hover {
          transform: translateY(-1px);
          border-color: color-mix(in oklch, var(--primary) 40%, var(--border));
          box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 6px 16px rgba(15,23,42,.06);
        }
        .thread-card:active { transform: translateY(0); }
        .avatar {
          width: 2.5rem; height: 2.5rem; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: .8125rem;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(0,0,0,.1), inset 0 -1px 1px rgba(0,0,0,.08);
        }
        .thread-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .35rem; }
        .thread-card-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: .75rem;
        }
        .thread-card-title {
          margin: 0; font-size: 1rem; font-weight: 600;
          line-height: 1.35; letter-spacing: -.005em; color: var(--foreground);
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .thread-card-preview {
          margin: 0; font-size: .8125rem; line-height: 1.5;
          color: var(--muted-foreground);
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .thread-card-meta {
          display: flex; gap: .375rem; flex-wrap: wrap; align-items: center;
          font-size: .75rem; color: var(--muted-foreground);
        }
        .meta-author { font-weight: 600; color: var(--foreground); }
        .meta-scope { font-weight: 500; }
        .meta-sep { opacity: .5; }
        .meta-age { font-variant-numeric: tabular-nums; }
        .thread-card-replies {
          display: flex; align-items: center; flex-shrink: 0;
        }
        .reply-pill {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-width: 3.5rem; padding: .5rem .65rem;
          background: var(--muted, #f5f5f4); border-radius: .5rem;
          transition: background .15s;
        }
        .thread-card:hover .reply-pill {
          background: color-mix(in oklch, var(--primary) 8%, var(--muted, #f5f5f4));
        }
        .reply-pill-num {
          font-size: 1.1rem; font-weight: 700; line-height: 1;
          color: var(--foreground); font-variant-numeric: tabular-nums;
        }
        .reply-pill-label {
          font-size: .65rem; color: var(--muted-foreground);
          text-transform: uppercase; letter-spacing: .04em; margin-top: .15rem; font-weight: 600;
        }

        @media (max-width: 640px) {
          .thread-card { padding: 1rem; gap: .75rem; }
          .avatar { width: 2.25rem; height: 2.25rem; }
          .thread-card-title { font-size: .9375rem; }
          .filter-bar { padding: .75rem; }
          .filter-bar-top { padding-bottom: .75rem; }
          .filter-bar-bottom { padding-top: .75rem; }
        }
      `}</style>
    </>
  );
}

// ─── Premium empty state ─────────────────────────────────────────────────
function EmptyState({ onNew, hasFilters, onClearFilters }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      </div>
      <h3 className="empty-title">
        {hasFilters ? 'No threads match these filters' : 'No threads yet'}
      </h3>
      <p className="empty-desc">
        {hasFilters
          ? 'Try clearing some filters, or be the first to start a thread on this topic.'
          : 'Start a discussion — ask a doubt, share a suggestion, or post a resource request.'}
      </p>
      <div className="empty-actions">
        {hasFilters && (
          <button className="btn btn-ghost" onClick={onClearFilters} style={{ padding: '.5rem 1rem' }}>
            Clear filters
          </button>
        )}
        <button className="new-thread-btn" onClick={onNew}>
          <span aria-hidden>＋</span> New thread
        </button>
      </div>
      <style>{`
        .empty-state {
          padding: 3.5rem 1.5rem; text-align: center;
          background: var(--card); border: 1px dashed var(--border); border-radius: .75rem;
        }
        .empty-icon {
          width: 4rem; height: 4rem; margin: 0 auto 1rem;
          display: flex; align-items: center; justify-content: center;
          background: var(--muted, #f5f5f4); border-radius: 50%;
          color: var(--muted-foreground);
        }
        .empty-title { margin: 0 0 .5rem; font-size: 1.125rem; font-weight: 700; }
        .empty-desc { margin: 0 0 1.25rem; font-size: .875rem; color: var(--muted-foreground); max-width: 28rem; margin-inline: auto; }
        .empty-actions { display: inline-flex; gap: .5rem; }
      `}</style>
    </div>
  );
}

// ─── thread detail drawer ────────────────────────────────────────────────
function ThreadDetail({ id, onClose }) {
  const { user, showToast } = useAuth();
  const { data, loading, error, refresh } = useForumThread(id);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function postReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await forumFetch(`/api/forum/threads/${id}/posts`, { method: 'POST', body: { body: reply } });
      setReply('');
      refresh();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread() {
    if (!confirm('Delete this thread? Replies stay but the thread is hidden.')) return;
    setBusy(true);
    try {
      await forumFetch(`/api/forum/threads/${id}`, { method: 'DELETE' });
      showToast?.('Thread deleted', 'success');
      onClose();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(postId) {
    if (!confirm('Delete this reply?')) return;
    try {
      await forumFetch(`/api/forum/posts/${postId}`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      showToast?.(e.message, 'error');
    }
  }

  return (
    <Drawer onClose={onClose}>
      {loading && <ThreadDetailSkeleton />}
      {error && <p style={{ color: 'var(--destructive)' }}>{error.message}</p>}
      {data && (
        <>
          <header className="thread-head">
            <div className="thread-head-meta-row">
              <TagPill code={data.thread.tag} size="lg" />
              {(data.thread.committee_name || data.thread.event_title) && (
                <span className="thread-scope">
                  in <strong>{data.thread.committee_name || data.thread.event_title}</strong>
                </span>
              )}
            </div>
            <h2 className="thread-title-h">{data.thread.title}</h2>
            <div className="thread-byline">
              <span className="avatar avatar-md" style={{ background: avatarGradient(data.thread.author_name) }}>
                {initials(data.thread.author_name)}
              </span>
              <div>
                <div className="byline-name">{data.thread.author_name}</div>
                <div className="byline-time">{fmtAge(data.thread.created_at)}</div>
              </div>
              {data.perms.canDeleteThread && (
                <button onClick={deleteThread} disabled={busy} className="thread-delete-btn"
                        title="Delete thread">
                  Delete
                </button>
              )}
            </div>
          </header>

          <div className="thread-body">{renderBody(data.thread.body)}</div>

          <div className="reply-divider">
            <span className="reply-divider-line" />
            <span className="reply-divider-label">
              {data.posts.length} {data.posts.length === 1 ? 'reply' : 'replies'}
            </span>
            <span className="reply-divider-line" />
          </div>

          {data.posts.length === 0 && (
            <p className="no-replies">No replies yet. Be the first to chime in.</p>
          )}

          <ul className="post-list">
            {data.posts.map((p) => (
              <li key={p.id} className="post">
                <span className="avatar avatar-sm" style={{ background: avatarGradient(p.author_name) }}>
                  {initials(p.author_name)}
                </span>
                <div className="post-bubble">
                  <div className="post-meta">
                    <strong className="post-author">{p.author_name}</strong>
                    <span className="post-time">{fmtAge(p.created_at)}</span>
                    {p.created_by === user?.id && (
                      <button onClick={() => deletePost(p.id)} className="post-delete">Delete</button>
                    )}
                  </div>
                  <div className="post-body">{renderBody(p.body)}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="reply-composer">
            <div className="reply-composer-head">
              <span className="avatar avatar-sm" style={{ background: avatarGradient(user?.name) }}>
                {initials(user?.name)}
              </span>
              <span className="reply-composer-label">Reply as {user?.name?.split(' ')[0] || 'you'}</span>
            </div>
            <textarea
              className="reply-textarea"
              rows={3}
              placeholder="Share your thoughts… use @name to tag someone."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              disabled={busy}
            />
            <div className="reply-composer-foot">
              <span className="reply-hint">{reply.length}/10000</span>
              <button className="reply-submit" onClick={postReply} disabled={busy || !reply.trim()}>
                {busy ? 'Posting…' : 'Post reply'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .thread-head { margin-bottom: 1.25rem; }
        .thread-head-meta-row {
          display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
          margin-bottom: .65rem;
        }
        .thread-scope { font-size: .8125rem; color: var(--muted-foreground); }
        .thread-scope strong { color: var(--foreground); font-weight: 600; }
        .thread-title-h {
          margin: 0 0 .85rem; font-size: 1.5rem; font-weight: 700;
          line-height: 1.25; letter-spacing: -.01em; color: var(--foreground);
        }
        .thread-byline { display: flex; align-items: center; gap: .65rem; }
        .byline-name { font-size: .8125rem; font-weight: 600; color: var(--foreground); line-height: 1.1; }
        .byline-time { font-size: .75rem; color: var(--muted-foreground); margin-top: .15rem; }
        .thread-delete-btn {
          margin-left: auto; padding: .35rem .7rem; border-radius: .375rem;
          background: transparent; border: 1px solid var(--border);
          color: var(--destructive); font-size: .75rem; font-weight: 500; cursor: pointer;
          transition: background .12s, border-color .12s;
        }
        .thread-delete-btn:hover { background: #fef2f2; border-color: #fecaca; }

        .thread-body {
          white-space: pre-wrap; font-size: .9375rem; line-height: 1.65;
          color: var(--foreground);
          padding: 1rem 1.125rem; background: var(--muted, #fafafa);
          border-radius: .5rem; border: 1px solid var(--border);
        }

        .reply-divider {
          display: flex; align-items: center; gap: .75rem;
          margin: 1.75rem 0 1.25rem;
        }
        .reply-divider-line { flex: 1; height: 1px; background: var(--border); }
        .reply-divider-label {
          font-size: .7rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .08em; color: var(--muted-foreground);
        }
        .no-replies {
          text-align: center; padding: 1.5rem 1rem; color: var(--muted-foreground);
          font-size: .875rem; margin: 0 0 1.5rem;
        }

        .post-list { list-style: none; padding: 0; margin: 0 0 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .post { display: flex; gap: .75rem; align-items: flex-start; }
        .post-bubble {
          flex: 1; min-width: 0; padding: .75rem .875rem;
          background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
        }
        .avatar-sm { width: 2rem; height: 2rem; font-size: .7rem; }
        .avatar-md { width: 2.25rem; height: 2.25rem; font-size: .75rem; }
        .post-meta {
          display: flex; align-items: center; gap: .5rem;
          font-size: .8125rem; margin-bottom: .35rem;
        }
        .post-author { font-weight: 600; color: var(--foreground); }
        .post-time { font-size: .75rem; color: var(--muted-foreground); }
        .post-delete {
          margin-left: auto; background: transparent; border: 0;
          color: var(--destructive); font-size: .7rem; cursor: pointer;
          font-weight: 500; padding: .15rem .35rem; border-radius: .25rem;
        }
        .post-delete:hover { background: #fef2f2; }
        .post-body { font-size: .875rem; line-height: 1.6; white-space: pre-wrap; color: var(--foreground); }

        .reply-composer {
          margin-top: 1rem; padding: 1rem 1.125rem;
          background: var(--card); border: 1px solid var(--border); border-radius: .625rem;
          box-shadow: 0 1px 2px rgba(0,0,0,.03);
        }
        .reply-composer-head {
          display: flex; align-items: center; gap: .5rem; margin-bottom: .625rem;
        }
        .reply-composer-label { font-size: .75rem; color: var(--muted-foreground); font-weight: 500; }
        .reply-textarea {
          width: 100%; min-height: 4.5rem; padding: .65rem .75rem;
          font-family: inherit; font-size: .875rem; line-height: 1.55;
          color: var(--foreground); background: var(--background);
          border: 1px solid var(--border); border-radius: .375rem;
          resize: vertical; outline: 0;
          transition: border-color .15s, box-shadow .15s;
        }
        .reply-textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent);
        }
        .reply-textarea:disabled { opacity: .6; cursor: wait; }
        .reply-composer-foot {
          display: flex; align-items: center; justify-content: space-between; margin-top: .65rem;
        }
        .reply-hint { font-size: .7rem; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
        .reply-submit {
          padding: .5rem 1.05rem; border-radius: .375rem;
          background: linear-gradient(180deg, var(--primary), color-mix(in oklch, var(--primary) 85%, black));
          color: white; font-size: .8125rem; font-weight: 600;
          border: 0; cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,.08);
          transition: transform .12s, box-shadow .12s, opacity .12s;
        }
        .reply-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(54,34,255,.15); }
        .reply-submit:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </Drawer>
  );
}

// Renders plain text body with @mention highlighting (no notification yet).
function renderBody(text) {
  if (!text) return null;
  const parts = text.split(/(@[A-Za-z][A-Za-z0-9_]*)/g);
  return parts.map((p, i) =>
    p.startsWith('@')
      ? <span key={i} style={{ color: 'var(--primary)', fontWeight: 600 }}>{p}</span>
      : <span key={i}>{p}</span>
  );
}

// ─── compose drawer ──────────────────────────────────────────────────────
function ComposeDrawer({ onClose }) {
  const { showToast } = useAuth();
  const lookups = useForumLookups();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('discussion');
  const [scope, setScope] = useState(''); // 'event:<id>' or 'committee:<id>'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function submit() {
    if (!title.trim() || !body.trim()) { showToast?.('Title and body are required', 'error'); return; }
    if (!scope) { showToast?.('Attach to an event or committee', 'error'); return; }
    setBusy(true);
    try {
      const body_ = { title, body, tag };
      if (scope.startsWith('event:'))     body_.event_id = scope.slice(6);
      if (scope.startsWith('committee:')) body_.committee_id = scope.slice(10);
      const created = await forumFetch('/api/forum/threads', { method: 'POST', body: body_ });
      showToast?.('Thread posted', 'success');
      navigate('/community?id=' + created.id);
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = title.trim() && body.trim() && scope && !busy;

  return (
    <Drawer onClose={onClose} title="Start a new thread">
      <div className="compose-stack">
        <div className="compose-section">
          <span className="compose-label">What kind of post?</span>
          <div className="compose-tag-grid">
            {TAGS.map((t) => (
              <button key={t.code} type="button" onClick={() => setTag(t.code)}
                      className={'compose-tag-card' + (tag === t.code ? ' compose-tag-card-active' : '')}
                      style={tag === t.code ? { background: t.bg, borderColor: t.color, color: t.color } : undefined}>
                <span className="compose-tag-dot" style={{ background: t.color }} />
                <span className="compose-tag-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="compose-section">
          <span className="compose-label">Attach to <span className="req">*</span></span>
          <select className="compose-select" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">— Pick an event or committee —</option>
            <optgroup label="Committee">
              {(lookups?.committees ?? []).map((c) => (
                <option key={c.id} value={'committee:' + c.id}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="Event">
              {(lookups?.events ?? []).map((e) => (
                <option key={e.id} value={'event:' + e.id}>{e.title}</option>
              ))}
            </optgroup>
          </select>
          <span className="compose-hint">Threads are scoped — they appear under the selected event or committee.</span>
        </div>

        <div className="compose-section">
          <span className="compose-label">Title <span className="req">*</span></span>
          <input className="compose-input" placeholder="Short, specific — e.g. 'Doubt about Section 54 exemption'"
                 value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <span className="compose-hint">{title.length}/200</span>
        </div>

        <div className="compose-section">
          <span className="compose-label">Details <span className="req">*</span></span>
          <textarea className="compose-textarea" rows={9}
                    placeholder="Give enough context — what you've tried, what you're stuck on, references to existing material. Use @name to tag someone."
                    value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} />
          <span className="compose-hint">{body.length}/10,000 · Plain text · @mentions render in primary colour</span>
        </div>

        <div className="compose-footer">
          <button className="compose-cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="compose-submit" onClick={submit} disabled={!canSubmit}>
            {busy ? 'Posting…' : 'Post thread'}
          </button>
        </div>
      </div>

      <style>{`
        .compose-stack { display: flex; flex-direction: column; gap: 1.5rem; }
        .compose-section { display: flex; flex-direction: column; gap: .5rem; }
        .compose-label {
          font-size: .75rem; font-weight: 700; color: var(--foreground);
          text-transform: uppercase; letter-spacing: .04em;
        }
        .compose-label .req { color: var(--destructive); margin-left: .15rem; }
        .compose-hint {
          font-size: .7rem; color: var(--muted-foreground);
          font-variant-numeric: tabular-nums;
        }

        .compose-tag-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: .5rem;
        }
        .compose-tag-card {
          display: flex; align-items: center; gap: .5rem;
          padding: .65rem .8rem; border-radius: .5rem;
          background: var(--card); border: 1px solid var(--border);
          font-size: .8125rem; font-weight: 500; color: var(--foreground);
          cursor: pointer; text-align: left;
          transition: background .15s, border-color .15s, transform .12s;
        }
        .compose-tag-card:hover { background: var(--muted, #fafaf9); }
        .compose-tag-card:active { transform: scale(.98); }
        .compose-tag-card-active { font-weight: 600; }
        .compose-tag-dot { width: .55rem; height: .55rem; border-radius: 50%; flex-shrink: 0; }
        .compose-tag-label { flex: 1; }

        .compose-input,
        .compose-textarea,
        .compose-select {
          width: 100%; padding: .65rem .8rem;
          font-family: inherit; font-size: .9375rem; line-height: 1.5;
          color: var(--foreground); background: var(--background);
          border: 1px solid var(--border); border-radius: .5rem; outline: 0;
          transition: border-color .15s, box-shadow .15s;
        }
        .compose-input:focus,
        .compose-textarea:focus,
        .compose-select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent);
        }
        .compose-textarea { resize: vertical; min-height: 9rem; }

        .compose-footer {
          display: flex; justify-content: flex-end; gap: .5rem;
          padding-top: 1rem; border-top: 1px solid var(--border);
          position: sticky; bottom: 0; background: var(--background);
        }
        .compose-cancel {
          padding: .55rem 1rem; border-radius: .5rem;
          background: transparent; border: 1px solid var(--border);
          color: var(--foreground); font-size: .875rem; font-weight: 500; cursor: pointer;
          transition: background .12s;
        }
        .compose-cancel:hover:not(:disabled) { background: var(--muted, #fafaf9); }
        .compose-submit {
          padding: .55rem 1.25rem; border-radius: .5rem;
          background: linear-gradient(180deg, var(--primary), color-mix(in oklch, var(--primary) 85%, black));
          color: white; font-size: .875rem; font-weight: 600;
          border: 0; cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 2px 6px rgba(54,34,255,.15);
          transition: transform .12s, box-shadow .12s, opacity .12s;
        }
        .compose-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,.08), 0 4px 12px rgba(54,34,255,.2); }
        .compose-submit:disabled { opacity: .45; cursor: not-allowed; }
      `}</style>
    </Drawer>
  );
}

// ─── shared drawer chrome ────────────────────────────────────────────────
function Drawer({ onClose, title, children }) {
  return (
    <div className="d-root" role="dialog" aria-modal="true">
      <div className="d-back" onClick={onClose} />
      <aside className="d-panel">
        <div className="d-head">
          <button onClick={onClose} className="d-back-btn"><IconArrowLeft size="sm" /> Back</button>
          {title && <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h2>}
          <button onClick={onClose} className="d-close" aria-label="Close"><IconX size="sm" /></button>
        </div>
        <div className="d-body">{children}</div>
      </aside>
      <style>{`
        .d-root { position: fixed; inset: 0; z-index: 100; }
        .d-back { position: absolute; inset: 0; background: rgba(15,23,42,.45); }
        .d-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: min(720px, 100vw); background: var(--background);
          display: flex; flex-direction: column;
          box-shadow: -8px 0 30px rgba(0,0,0,.15);
          animation: d-slide-in .18s ease-out;
        }
        .d-head {
          display: flex; align-items: center; gap: 1rem;
          padding: .875rem 1.25rem; border-bottom: 1px solid var(--border);
          background: var(--card);
        }
        .d-back-btn {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .35rem .65rem; background: transparent; border: 1px solid var(--border);
          border-radius: .375rem; cursor: pointer; font-size: .8125rem;
        }
        .d-close {
          margin-left: auto; background: transparent; border: 0; cursor: pointer;
          padding: .35rem; color: var(--muted-foreground);
        }
        .d-close:hover { color: var(--foreground); }
        .d-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
        @keyframes d-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

// ─── shimmer skeletons ───────────────────────────────────────────────────
// One card in the thread list. Same layout as a real .thread-card so the
// page doesn't jump when data resolves.
function ThreadRowSkeleton() {
  return (
    <li>
      <div className="thread-card" aria-hidden="true" style={{ cursor: 'default' }}>
        <Shimmer width="2.5rem" height="2.5rem" radius="999px" />
        <div className="thread-card-body" style={{ gap: '.5rem' }}>
          <div className="thread-card-head">
            <Shimmer height="1rem" width="60%" />
            <Shimmer height="1.1rem" width="5rem" radius="999px" />
          </div>
          <Shimmer height=".75rem" width="95%" />
          <Shimmer height=".75rem" width="80%" />
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem' }}>
            <Shimmer height=".7rem" width="5rem" />
            <Shimmer height=".7rem" width="6rem" />
            <Shimmer height=".7rem" width="3.5rem" />
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minWidth: '3.5rem', padding: '.5rem .65rem',
          background: 'var(--muted, #f5f5f4)', borderRadius: '.5rem', gap: '.2rem',
        }}>
          <Shimmer height="1.1rem" width="1.5rem" />
          <Shimmer height=".55rem" width="2.5rem" />
        </div>
      </div>
    </li>
  );
}

// Full thread detail mock — tag pill, title, byline, body, replies, composer.
function ThreadDetailSkeleton() {
  return (
    <div aria-hidden="true">
      {/* Header */}
      <Shimmer height="1.35rem" width="6.5rem" radius="999px" />
      <Shimmer height="1.85rem" width="80%" style={{ marginTop: '.85rem' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginTop: '.85rem' }}>
        <Shimmer width="2.25rem" height="2.25rem" radius="999px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
          <Shimmer height=".75rem" width="9rem" />
          <Shimmer height=".65rem" width="6rem" />
        </div>
      </div>

      {/* Body block */}
      <div style={{
        marginTop: '1.25rem', padding: '1rem 1.125rem',
        background: 'var(--muted, #fafafa)', border: '1px solid var(--border)',
        borderRadius: '.5rem', display: 'flex', flexDirection: 'column', gap: '.45rem',
      }}>
        <Shimmer height=".85rem" width="100%" />
        <Shimmer height=".85rem" width="96%" />
        <Shimmer height=".85rem" width="88%" />
        <Shimmer height=".85rem" width="60%" />
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', margin: '1.75rem 0 1.25rem' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <Shimmer height=".7rem" width="5rem" />
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Replies */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
            <Shimmer width="2rem" height="2rem" radius="999px" />
            <div style={{
              flex: 1, padding: '.75rem .875rem',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '.5rem', display: 'flex', flexDirection: 'column', gap: '.35rem',
            }}>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <Shimmer height=".75rem" width="6rem" />
                <Shimmer height=".75rem" width="3rem" />
              </div>
              <Shimmer height=".75rem" width="92%" />
              <Shimmer height=".75rem" width={i === 2 ? '50%' : '72%'} />
            </div>
          </li>
        ))}
      </ul>

      {/* Composer */}
      <div style={{
        padding: '1rem 1.125rem', background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: '.625rem',
        display: 'flex', flexDirection: 'column', gap: '.6rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <Shimmer width="2rem" height="2rem" radius="999px" />
          <Shimmer height=".7rem" width="8rem" />
        </div>
        <Shimmer height="4rem" width="100%" radius=".375rem" />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Shimmer height=".7rem" width="4rem" />
          <Shimmer height="2rem" width="6.5rem" radius=".375rem" />
        </div>
      </div>
    </div>
  );
}
