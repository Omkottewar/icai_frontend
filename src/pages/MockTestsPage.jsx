import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate, useRoute } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import {
  IconCalendar, IconClock, IconMapPin, IconAward, IconArrowRight,
  IconCheckCircle, IconDownload, IconGraduationCap, IconBookOpen, IconX,
  IconMessageSquare, IconTrash,
} from '../icons';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import { dialog } from '../lib/dialog';
import Button from '../components/ui/Button';

// Public, student-facing mock-tests page.
//   /mock-tests              — list of upcoming + recently-completed tests
//   /mock-tests?id=<id>      — same list, with the detail panel scrolled into view
//
// Register / cancel use authenticated POST/DELETE on /api/mock-tests/:id/register.
// Scores are intentionally hidden until WICASA publishes results.

const DT_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});

function fmtDt(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : DT_FMT.format(d);
}

const LEVELS = [
  { value: '',             label: 'All levels' },
  { value: 'foundation',   label: 'Foundation' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'final',        label: 'Final' },
];

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

export default function MockTestsPage() {
  const { user, showToast } = useAuth();
  const route = useRoute();
  const header = useSiteContent('mock_tests_page_header');
  const [level, setLevel] = useState('');
  const [rows, setRows]   = useState(null);
  const [my, setMy]       = useState([]);
  const [err, setErr]     = useState('');

  // Mock tests are a CA-student feature (catalogue §1.3). Anyone can browse
  // the upcoming-tests list (the page is public) but only signed-in students
  // can register or take an attempt. Admin is included so WICASA staff can
  // dry-run a test before publishing it.
  const canTakeMockTest = user?.primary_role === 'student' || user?.primary_role === 'admin';

  async function load() {
    setErr('');
    try {
      const qs = level ? `?level=${level}` : '';
      const [list, mine] = await Promise.all([
        api(`/api/mock-tests${qs}`),
        user ? api('/api/mock-tests/my').catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
      ]);
      setRows(list.rows || []);
      setMy(mine.rows || []);
    } catch (e) {
      setErr(e.message || 'Could not load mock tests');
      setRows([]);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [level, user?.id]);

  // Map mock_test_id → my registration row so the cards can show status.
  const myByTest = useMemo(() => {
    const m = new Map();
    for (const r of my) m.set(r.mock_test.id, r);
    return m;
  }, [my]);

  async function onRegister(id) {
    if (!user) { navigate('/login'); return; }
    try {
      await api(`/api/mock-tests/${id}/register`, { method: 'POST' });
      showToast?.('Registered — best of luck!', 'success');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Could not register', 'error');
    }
  }
  async function onCancel(id) {
    const ok = await dialog.confirm({
      title: 'Cancel registration?',
      message: 'Cancel your registration for this mock test?',
      confirmText: 'Cancel registration',
      cancelText: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/mock-tests/${id}/register`, { method: 'DELETE' });
      showToast?.('Registration cancelled', 'info');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Could not cancel', 'error');
    }
  }

  const openId = route.query.id || null;
  const upcoming = (rows || []).filter((r) => new Date(r.scheduled_at) > new Date() || r.status === 'open_for_registration');
  const completed = (rows || []).filter((r) => r.status === 'completed' || r.result_published_at);

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      <section className="container" style={{ padding: '1.5rem 1rem 3rem' }}>
        {/* Filter row */}
        <div className="row gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '.8rem', fontWeight: 600 }}>{header.level_label}</label>
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLevel(l.value)}
              className={'mt-chip' + (level === l.value ? ' is-active' : '')}
            >
              {l.label}
            </button>
          ))}
        </div>

        {err && <p style={{ color: 'var(--destructive)', fontSize: '.85rem' }}>{err}</p>}

        {/* My registrations strip — only shown when the user has any */}
        {user && my.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <h2 className="mt-section-title">{header.my_section_heading}</h2>
            <div className="mt-mine-grid">
              {my.map((r) => <MyMockTestCard key={r.registration_id} reg={r} onCancel={() => onCancel(r.mock_test.id)} />)}
            </div>
          </section>
        )}

        {/* Upcoming + open */}
        <h2 className="mt-section-title">{header.upcoming_heading}</h2>
        {rows === null ? (
          <div className="mt-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', padding: '1.1rem' }}>
                <Shimmer height="1.05rem" width={`${55 + ((i * 11) % 30)}%`} />
                <Shimmer height=".75rem" width="40%" />
                <ShimmerLines count={2} lastWidth="55%" />
                <Shimmer height="2.25rem" width="9rem" radius=".375rem" />
              </div>
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="card" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <IconGraduationCap />
            <p className="muted-text" style={{ marginTop: '.5rem' }}>{header.empty_msg}</p>
          </div>
        ) : (
          <div className="mt-grid">
            {upcoming.map((t) => (
              <MockTestCard
                key={t.id}
                test={t}
                openExpanded={openId === t.id}
                myReg={myByTest.get(t.id)}
                canTake={canTakeMockTest}
                onRegister={() => onRegister(t.id)}
                onCancel={() => onCancel(t.id)}
              />
            ))}
          </div>
        )}

        {/* Recently completed */}
        {completed.length > 0 && (
          <section style={{ marginTop: '2.5rem' }}>
            <h2 className="mt-section-title">{header.results_heading}</h2>
            <div className="mt-grid">
              {completed.map((t) => (
                <MockTestCard
                  key={t.id}
                  test={t}
                  openExpanded={openId === t.id}
                  myReg={myByTest.get(t.id)}
                  canTake={canTakeMockTest}
                  onRegister={() => onRegister(t.id)}
                  onCancel={() => onCancel(t.id)}
                />
              ))}
            </div>
          </section>
        )}
      </section>

      <style>{`
        .mt-chip {
          padding: .35rem .8rem; border-radius: 999px;
          background: var(--card); border: 1px solid var(--border);
          font-size: .78rem; font-weight: 600; color: var(--foreground);
          cursor: pointer; transition: background .12s, border-color .12s, color .12s;
        }
        .mt-chip:hover { border-color: var(--primary); color: var(--primary); }
        .mt-chip.is-active { background: var(--primary); color: white; border-color: var(--primary); }
        .mt-section-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 .85rem; letter-spacing: -.01em; }

        .mt-grid {
          display: grid; gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }
        .mt-mine-grid {
          display: grid; gap: .75rem;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
      `}</style>
    </>
  );
}

// ─── Card for one mock test ─────────────────────────────────────────────
function MockTestCard({ test, myReg, openExpanded, canTake, onRegister, onCancel }) {
  const [open, setOpen] = useState(!!openExpanded);
  const [discussOpen, setDiscussOpen] = useState(false);
  const [discussCount, setDiscussCount] = useState(test.comment_count || 0);
  const now = Date.now();
  const closesAt = test.registration_close_at || test.scheduled_at;
  const closed = closesAt && new Date(closesAt).getTime() <= now;
  const isOpen = test.status === 'open_for_registration' && !closed;
  const capacityFull = test.capacity && test.registered_count >= test.capacity;
  const myStatus = myReg?.status;
  const completed = test.status === 'completed' || !!test.result_published_at;

  return (
    <article className="card mt-card" style={{ padding: '1.1rem' }}>
      <div className="mt-card-head">
        <div className="mt-card-level">
          <IconGraduationCap size="sm" />
          <span>{test.level}{test.paper_no ? ` · Paper ${test.paper_no}` : ''}{test.group_no ? ` · Gr ${test.group_no}` : ''}</span>
        </div>
        <StatusPill status={test.status} resultPublished={!!test.result_published_at} />
      </div>
      <h3 className="mt-card-title">{test.title}</h3>
      {test.series_name && <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.1rem' }}>{test.series_name}</div>}

      <ul className="mt-card-meta">
        <li><IconCalendar size="sm" /> {fmtDt(test.scheduled_at)}</li>
        <li><IconClock size="sm" /> {test.duration_mins} min</li>
        {test.venue && <li><IconMapPin size="sm" /> {test.venue}</li>}
        <li><IconAward size="sm" /> Max {test.max_score}</li>
      </ul>

      {test.capacity && (
        <div className="mt-cap">
          <div className="mt-cap-track">
            <div className="mt-cap-fill" style={{ width: `${Math.min(100, (test.registered_count / test.capacity) * 100)}%` }} />
          </div>
          <span className="muted-text" style={{ fontSize: '.7rem' }}>
            {test.registered_count} / {test.capacity} seats
          </span>
        </div>
      )}

      {/* Expanded body — description + practice paper + answer key */}
      {open && (
        <div className="mt-card-detail">
          {test.description && (
            <p style={{ fontSize: '.82rem', margin: '0 0 .6rem', whiteSpace: 'pre-wrap' }}>{test.description}</p>
          )}
          <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
            {test.practice_paper_url && (
              <a href={test.practice_paper_url} target="_blank" rel="noopener noreferrer"
                 className="btn btn-outline" style={{ padding: '.35rem .65rem', fontSize: '.78rem' }}>
                <IconDownload size="sm" /> Practice paper
              </a>
            )}
            {test.answer_key_url && (
              <a href={test.answer_key_url} target="_blank" rel="noopener noreferrer"
                 className="btn btn-outline" style={{ padding: '.35rem .65rem', fontSize: '.78rem' }}>
                <IconBookOpen size="sm" /> Answer key
              </a>
            )}
          </div>
        </div>
      )}

      {/* CTA row */}
      <div className="mt-card-cta">
        {/* For non-students we still show the test details but hide every
            action — there's no Register, no Take test online, no Cancel.
            Catalogue §1.3 scopes mock tests to CA students; members /
            employers / visitors see the listing as informational only. */}
        {!canTake && !myStatus && (
          <span className="mt-pill mt-pill-muted" title="Mock tests are a CA-student feature">
            For CA students
          </span>
        )}
        {canTake && myStatus === 'registered' && !completed && (
          <>
            <span className="mt-pill mt-pill-success"><IconCheckCircle size="sm" /> Registered</span>
            {test.supports_online && (
              <a
                href={`/mock-tests/${test.id}/attempt`}
                className="btn btn-primary"
                style={{ padding: '.35rem .8rem', fontSize: '.82rem' }}
              >
                Take test online <IconArrowRight size="sm" />
              </a>
            )}
            <Button className="btn btn-ghost" onClick={onCancel} style={{ padding: '.3rem .55rem', fontSize: '.76rem', color: 'var(--destructive)' }}>
              <IconX size="sm" /> Cancel
            </Button>
          </>
        )}
        {myStatus === 'attended' && (
          <span className="mt-pill mt-pill-success"><IconCheckCircle size="sm" /> Attended</span>
        )}
        {myStatus === 'absent' && (
          <span className="mt-pill mt-pill-warn">Marked absent</span>
        )}
        {canTake && !myStatus && isOpen && !capacityFull && (
          <Button className="btn btn-primary" onClick={onRegister} style={{ padding: '.35rem .8rem', fontSize: '.82rem' }}>
            Register <IconArrowRight size="sm" />
          </Button>
        )}
        {canTake && !myStatus && capacityFull && (
          <span className="mt-pill mt-pill-warn">Full</span>
        )}
        {canTake && !myStatus && !isOpen && !completed && (
          <span className="mt-pill mt-pill-muted">Registration {closed ? 'closed' : 'not yet open'}</span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setDiscussOpen((o) => !o)}
          style={{ padding: '.3rem .55rem', fontSize: '.76rem', marginLeft: 'auto' }}
          aria-expanded={discussOpen}
        >
          <IconMessageSquare size="sm" /> Discuss
          {discussCount > 0 && (
            <span style={{
              marginLeft: '.3rem', fontSize: '.7rem', fontWeight: 700,
              background: 'var(--primary)', color: 'white',
              padding: '.05rem .35rem', borderRadius: 999,
            }}>{discussCount}</span>
          )}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen((o) => !o)} style={{ padding: '.3rem .55rem', fontSize: '.76rem' }}>
          {open ? 'Hide details' : 'Details'}
        </button>
      </div>

      {discussOpen && (
        <MockTestDiscussion
          testId={test.id}
          testTitle={test.title}
          onCountChange={setDiscussCount}
          onClose={() => setDiscussOpen(false)}
        />
      )}

      <style>{`
        .mt-card { display: flex; flex-direction: column; gap: .55rem; }
        .mt-card-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
        .mt-card-level {
          display: inline-flex; align-items: center; gap: .3rem;
          padding: .15rem .5rem; border-radius: 999px;
          background: oklch(0.36 0.13 255 / .08); color: var(--primary);
          font-size: .68rem; font-weight: 700; text-transform: capitalize;
        }
        .mt-card-title {
          font-size: 1rem; font-weight: 700; margin: .15rem 0 0;
          line-height: 1.25; letter-spacing: -.005em;
        }
        .mt-card-meta {
          list-style: none; padding: 0; margin: .5rem 0 0;
          display: flex; flex-wrap: wrap; gap: .5rem .85rem;
          font-size: .72rem; color: var(--muted-foreground);
        }
        .mt-card-meta li { display: inline-flex; align-items: center; gap: .25rem; }
        .mt-cap { display: flex; align-items: center; gap: .5rem; margin-top: .35rem; }
        .mt-cap-track {
          flex: 1; height: 4px; border-radius: 999px;
          background: var(--muted, #f1f5f9); overflow: hidden;
        }
        .mt-cap-fill { height: 100%; background: var(--primary); }
        .mt-card-detail {
          margin-top: .35rem; padding-top: .55rem;
          border-top: 1px solid var(--border);
        }
        .mt-card-cta {
          margin-top: .55rem; display: flex; align-items: center; gap: .35rem;
          flex-wrap: wrap;
        }

        .mt-pill {
          display: inline-flex; align-items: center; gap: .25rem;
          padding: .2rem .55rem; border-radius: 999px;
          font-size: .72rem; font-weight: 600;
        }
        .mt-pill-success { background: oklch(0.55 0.14 155 / .12); color: var(--secondary); }
        .mt-pill-warn    { background: oklch(0.85 0.16 90 / .25); color: #92400e; }
        .mt-pill-muted   { background: var(--muted, #f1f5f9); color: var(--muted-foreground); }
      `}</style>
    </article>
  );
}

// ─── Per-mock-test discussion — chat-style modal ────────────────────────
// Opens as a right-side chat panel (mobile: full-screen sheet) so peers
// can hold a real conversation about the test without the card scrolling
// underneath. Anyone can read; logged-in users can post. Auto-scrolls to
// the newest message on load and after every send. Backdrop click / Esc
// closes. Messages render as chat bubbles — mine on the right in primary,
// others on the left in muted.
function MockTestDiscussion({ testId, testTitle, onCountChange, onClose }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);  // null = loading, [] = empty
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setPosts(null); setError(null);
    api(`/api/mock-tests/${testId}/thread`)
      .then((d) => {
        if (cancelled) return;
        setPosts(d.posts || []);
        if (typeof onCountChange === 'function') onCountChange((d.posts || []).length);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [testId]);

  // Esc-to-close + focus the composer once messages are loaded.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Auto-scroll to bottom on load + whenever a new message arrives.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [posts]);

  // Focus the composer once the modal is mounted and messages are ready
  // (small delay so the transform-in animation settles before the caret
  // moves — otherwise Chrome refuses to focus a mid-animation textarea).
  useEffect(() => {
    if (!user || !composerRef.current) return;
    const t = setTimeout(() => composerRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true); setError(null);
    try {
      const d = await api(`/api/mock-tests/${testId}/thread/posts`, {
        method: 'POST',
        body: { body: text },
      });
      setPosts((prev) => {
        const next = [...(prev || []), d.post];
        if (typeof onCountChange === 'function') onCountChange(next.length);
        return next;
      });
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Enter to send, Shift+Enter for newline — matches every modern chat UX.
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(e);
    }
  }

  async function remove(postId) {
    const ok = await dialog.confirm({
      title: 'Delete message?',
      message: 'Delete this message from the discussion?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/mock-tests/thread/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => {
        const next = (prev || []).filter((p) => p.id !== postId);
        if (typeof onCountChange === 'function') onCountChange(next.length);
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div
      className="mt-chat-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Discussion for ${testTitle}`}
    >
      <div className="mt-chat-panel">
        {/* Header */}
        <div className="mt-chat-head">
          <div className="mt-chat-head-icon"><IconMessageSquare size="sm" /></div>
          <div className="mt-chat-head-body">
            <div className="mt-chat-title">Discussion</div>
            <div className="mt-chat-subtitle">{testTitle}</div>
          </div>
          <button
            type="button"
            className="mt-chat-close"
            onClick={onClose}
            aria-label="Close discussion"
          >
            <IconX size="sm" />
          </button>
        </div>

        <div className="mt-chat-hint">
          Be respectful and helpful — moderators may remove off-topic or abusive messages.
        </div>

        {/* Messages */}
        <div className="mt-chat-scroll" ref={scrollRef}>
          {posts === null && (
            <div style={{ padding: '1rem' }}>
              <ShimmerLines count={3} lastWidth="60%" />
            </div>
          )}

          {posts && posts.length === 0 && (
            <div className="mt-chat-empty">
              <div className="mt-chat-empty-icon"><IconMessageSquare /></div>
              <div className="mt-chat-empty-title">No messages yet</div>
              <div className="mt-chat-empty-sub">
                {user ? 'Say hello — ask a doubt, share a tip, or start a solution walkthrough.' : 'Sign in to send the first message.'}
              </div>
            </div>
          )}

          {posts && posts.length > 0 && (
            <ul className="mt-chat-list">
              {posts.map((p, i) => {
                const mine = user && user.id === p.created_by;
                const prev = posts[i - 1];
                // Squash the avatar/name header when the previous message is
                // from the same author within 5 min — reads like a natural
                // burst of messages instead of a boring repeat.
                const sameAuthorRun = prev
                  && prev.created_by === p.created_by
                  && (new Date(p.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000;
                return (
                  <li key={p.id} className={'mt-chat-msg ' + (mine ? 'mt-chat-mine' : 'mt-chat-other')}>
                    {!sameAuthorRun && !mine && (
                      <div className="mt-chat-avatar" aria-hidden="true">
                        {(p.author_name || 'M').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {sameAuthorRun && !mine && <div className="mt-chat-avatar-spacer" aria-hidden="true" />}
                    <div className="mt-chat-bubble-wrap">
                      {!sameAuthorRun && (
                        <div className="mt-chat-meta">
                          <span className="mt-chat-author">{mine ? 'You' : (p.author_name || 'Member')}</span>
                          <span className="mt-chat-time">{fmtDt(p.created_at)}</span>
                        </div>
                      )}
                      <div className="mt-chat-bubble">
                        {p.body}
                        {mine && (
                          <button
                            type="button"
                            className="mt-chat-del"
                            onClick={() => remove(p.id)}
                            title="Delete message"
                            aria-label="Delete message"
                          >
                            <IconTrash size="sm" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Composer */}
        {user ? (
          <form className="mt-chat-composer" onSubmit={submit}>
            <textarea
              ref={composerRef}
              placeholder="Type a message… (Shift+Enter for newline)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={2000}
              rows={1}
              disabled={busy}
            />
            <Button
              type="submit"
              className="btn btn-primary mt-chat-send"
              disabled={!body.trim()}
              loading={busy}
              aria-label="Send message"
            >
              {busy ? '…' : <IconArrowRight size="sm" />}
            </Button>
          </form>
        ) : (
          <div className="mt-chat-signin">
            <a href="/login">Sign in</a> to join the discussion.
          </div>
        )}

        {error && <div className="mt-chat-error">{error}</div>}
      </div>

      <style>{`
        .mt-chat-backdrop {
          position: fixed; inset: 0; z-index: 900;
          background: oklch(0.18 0.05 250 / 0.55);
          backdrop-filter: blur(3px);
          display: flex; justify-content: flex-end;
          animation: mtchat-fade .18s ease-out;
        }
        @keyframes mtchat-fade { from { opacity: 0; } to { opacity: 1; } }

        .mt-chat-panel {
          background: var(--card);
          width: 100%;
          max-width: 34rem;
          height: 100%;
          display: flex; flex-direction: column;
          box-shadow: -20px 0 48px oklch(0.2 0.05 250 / 0.25);
          animation: mtchat-slide .22s cubic-bezier(.2, .8, .2, 1);
        }
        @keyframes mtchat-slide { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        @media (max-width: 640px) {
          .mt-chat-backdrop { justify-content: stretch; }
          .mt-chat-panel { max-width: 100%; }
        }

        .mt-chat-head {
          display: flex; align-items: center; gap: .65rem;
          padding: 1rem 1.1rem .75rem;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, oklch(0.94 0.03 250), var(--card));
        }
        .mt-chat-head-icon {
          width: 2.2rem; height: 2.2rem; border-radius: 999px;
          background: var(--primary); color: white;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .mt-chat-head-body { flex: 1; min-width: 0; }
        .mt-chat-title { font-weight: 700; font-size: .95rem; line-height: 1.2; }
        .mt-chat-subtitle {
          font-size: .75rem; color: var(--muted-foreground);
          margin-top: .1rem;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mt-chat-close {
          background: transparent; border: none; cursor: pointer;
          color: var(--muted-foreground);
          padding: .35rem; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          transition: background .12s;
        }
        .mt-chat-close:hover { background: rgba(0,0,0,.06); color: var(--foreground); }

        .mt-chat-hint {
          padding: .55rem 1.1rem;
          font-size: .7rem; color: var(--muted-foreground);
          background: oklch(0.97 0.01 250);
          border-bottom: 1px solid var(--border);
        }

        .mt-chat-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 1rem .9rem;
          background: oklch(0.98 0.005 250);
        }
        .mt-chat-list {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: .35rem;
        }
        .mt-chat-msg {
          display: flex; gap: .5rem;
          align-items: flex-end;
        }
        .mt-chat-mine { justify-content: flex-end; }
        .mt-chat-other { justify-content: flex-start; }

        .mt-chat-avatar {
          width: 1.75rem; height: 1.75rem;
          border-radius: 999px;
          background: oklch(0.72 0.16 90);
          color: white; font-size: .78rem; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          margin-bottom: .1rem;
        }
        .mt-chat-avatar-spacer { width: 1.75rem; flex-shrink: 0; }

        .mt-chat-bubble-wrap { max-width: 82%; display: flex; flex-direction: column; }
        .mt-chat-mine .mt-chat-bubble-wrap { align-items: flex-end; }

        .mt-chat-meta {
          display: flex; align-items: center; gap: .4rem;
          margin-bottom: .15rem;
          font-size: .68rem;
          padding: 0 .3rem;
        }
        .mt-chat-author { font-weight: 700; color: var(--foreground); }
        .mt-chat-mine .mt-chat-author { color: var(--primary); }
        .mt-chat-time { color: var(--muted-foreground); }

        .mt-chat-bubble {
          padding: .55rem .8rem;
          border-radius: 1rem;
          font-size: .87rem;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-word;
          position: relative;
        }
        .mt-chat-other .mt-chat-bubble {
          background: var(--card);
          border: 1px solid var(--border);
          border-bottom-left-radius: .35rem;
        }
        .mt-chat-mine .mt-chat-bubble {
          background: var(--primary);
          color: white;
          border-bottom-right-radius: .35rem;
        }
        .mt-chat-del {
          margin-left: .5rem;
          background: transparent; border: none; cursor: pointer;
          color: rgba(255,255,255,.6);
          padding: 0;
          vertical-align: middle;
          transition: color .12s;
        }
        .mt-chat-del:hover { color: white; }

        .mt-chat-empty {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--muted-foreground);
        }
        .mt-chat-empty-icon {
          width: 3rem; height: 3rem; border-radius: 999px;
          background: var(--muted);
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: .65rem;
        }
        .mt-chat-empty-title { font-weight: 700; color: var(--foreground); margin-bottom: .25rem; }
        .mt-chat-empty-sub { font-size: .82rem; max-width: 22rem; margin: 0 auto; line-height: 1.4; }

        .mt-chat-composer {
          display: flex; gap: .5rem;
          padding: .75rem 1rem;
          border-top: 1px solid var(--border);
          background: var(--card);
          align-items: flex-end;
        }
        .mt-chat-composer textarea {
          flex: 1;
          border: 1px solid var(--border);
          border-radius: 1.1rem;
          padding: .55rem .9rem;
          font-size: .87rem;
          font-family: inherit;
          resize: none;
          max-height: 8rem;
          background: var(--background);
          color: var(--foreground);
          outline: none;
        }
        .mt-chat-composer textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px oklch(0.36 0.13 255 / 0.15);
        }
        .mt-chat-send {
          width: 2.5rem; height: 2.5rem; border-radius: 999px;
          padding: 0;
          display: inline-flex; align-items: center; justify-content: center;
        }

        .mt-chat-signin {
          padding: 1rem;
          text-align: center;
          font-size: .82rem;
          color: var(--muted-foreground);
          border-top: 1px solid var(--border);
          background: var(--card);
        }
        .mt-chat-signin a { color: var(--primary); font-weight: 600; text-decoration: none; }
        .mt-chat-signin a:hover { text-decoration: underline; }

        .mt-chat-error {
          padding: .55rem 1rem;
          background: oklch(0.96 0.04 25);
          color: oklch(0.35 0.18 25);
          font-size: .78rem;
          border-top: 1px solid oklch(0.85 0.1 25);
        }
      `}</style>
    </div>
  );
}

// ─── Status pill (top-right of each card) ───────────────────────────────
function StatusPill({ status, resultPublished }) {
  if (resultPublished) {
    return <span className="mt-status mt-status-completed"><IconCheckCircle size="sm" /> Results out</span>;
  }
  const map = {
    scheduled:             { cls: 'scheduled',   label: 'Scheduled' },
    open_for_registration: { cls: 'open',        label: 'Open' },
    closed:                { cls: 'closed',      label: 'Reg closed' },
    completed:             { cls: 'completed',   label: 'Completed' },
    cancelled:             { cls: 'cancelled',   label: 'Cancelled' },
  };
  const meta = map[status] ?? map.scheduled;
  return (
    <>
      <span className={'mt-status mt-status-' + meta.cls}>{meta.label}</span>
      <style>{`
        .mt-status {
          font-size: .65rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; padding: .2rem .55rem; border-radius: 999px;
          display: inline-flex; align-items: center; gap: .25rem;
        }
        .mt-status-open       { background: #dbeafe; color: #1d4ed8; }
        .mt-status-scheduled  { background: #f1f5f9; color: #475569; }
        .mt-status-closed     { background: #fef3c7; color: #92400e; }
        .mt-status-completed  { background: #dcfce7; color: #166534; }
        .mt-status-cancelled  { background: #fee2e2; color: #991b1b; }
      `}</style>
    </>
  );
}

// ─── "My mock tests" mini card ──────────────────────────────────────────
function MyMockTestCard({ reg, onCancel }) {
  const t = reg.mock_test;
  const score = reg.score;
  const pct = score != null && t.max_score ? Math.round((score / t.max_score) * 100) : null;
  return (
    <div className="card" style={{ padding: '.85rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.title}
          </div>
          <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'capitalize' }}>
            {t.level}{t.paper_no ? ` · Paper ${t.paper_no}` : ''} · {fmtDt(t.scheduled_at)}
          </div>
        </div>
        <span className={'mt-pill mt-pill-' + (reg.status === 'attended' ? 'success' : reg.status === 'absent' ? 'warn' : 'muted')}>
          {reg.status}
        </span>
      </div>
      {t.result_published_at && score != null ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.4rem' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{score}</span>
          <span className="muted-text" style={{ fontSize: '.72rem' }}>/ {t.max_score} · {pct}%</span>
        </div>
      ) : t.result_published_at ? (
        <span className="muted-text" style={{ fontSize: '.78rem' }}>No score recorded.</span>
      ) : (
        <span className="muted-text" style={{ fontSize: '.78rem' }}>Awaiting result release.</span>
      )}
      {t.answer_key_url && (
        <a href={t.answer_key_url} target="_blank" rel="noopener noreferrer"
           className="row gap-1" style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
          <IconDownload size="sm" /> Answer key
        </a>
      )}
      {reg.status === 'registered' && (
        <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ padding: '.25rem .55rem', fontSize: '.72rem', color: 'var(--destructive)', alignSelf: 'flex-start' }}>
          <IconX size="sm" /> Cancel registration
        </button>
      )}
    </div>
  );
}
