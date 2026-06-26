import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate, useRoute } from '../hooks/useRoute';
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
      <PageHeader
        title="Mock tests"
        subtitle="WICASA-organised mock papers — register, download practice material, see results."
      />

      <section className="container" style={{ padding: '1.5rem 1rem 3rem' }}>
        {/* Filter row */}
        <div className="row gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '.8rem', fontWeight: 600 }}>Level:</label>
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
            <h2 className="mt-section-title">My mock tests</h2>
            <div className="mt-mine-grid">
              {my.map((r) => <MyMockTestCard key={r.registration_id} reg={r} onCancel={() => onCancel(r.mock_test.id)} />)}
            </div>
          </section>
        )}

        {/* Upcoming + open */}
        <h2 className="mt-section-title">Upcoming &amp; open</h2>
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
            <p className="muted-text" style={{ marginTop: '.5rem' }}>No mock tests scheduled for this level right now.</p>
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
            <h2 className="mt-section-title">Recent results</h2>
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
                href={`#/mock-tests/${test.id}/attempt`}
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
        <MockTestDiscussion testId={test.id} onCountChange={setDiscussCount} />
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

// ─── Per-mock-test discussion thread ────────────────────────────────────
// Lazy-mounts when the user expands "Discuss" on a card. Anyone can read;
// logged-in users can post (composer hidden for visitors with a sign-in
// prompt). Lives inline in the same card so peers can scroll between
// tests without losing context.
function MockTestDiscussion({ testId, onCountChange }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);  // null = loading, [] = empty
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);

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

  async function remove(postId) {
    const ok = await dialog.confirm({
      title: 'Delete comment?',
      message: 'Delete this comment?',
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
    <div className="mt-disc">
      <div className="mt-disc-head">
        <IconMessageSquare size="sm" /> <strong>Discussion</strong>
        <span className="muted-text" style={{ fontSize: '.72rem' }}>
          · Be respectful and helpful — moderators may remove off-topic or abusive comments.
        </span>
      </div>

      {posts === null && <ShimmerLines count={2} lastWidth="60%" />}

      {posts && posts.length === 0 && (
        <p className="muted-text" style={{ fontSize: '.78rem', margin: '.5rem 0' }}>
          No comments yet. {user ? 'Start the discussion below.' : 'Sign in to post the first comment.'}
        </p>
      )}

      {posts && posts.length > 0 && (
        <ul className="mt-disc-list">
          {posts.map((p) => {
            const mine = user && user.id === p.created_by;
            return (
              <li key={p.id} className="mt-disc-row">
                <div className="mt-disc-meta">
                  <strong className="mt-disc-author">{p.author_name || 'Member'}</strong>
                  <span className="muted-text">{fmtDt(p.created_at)}</span>
                  {mine && (
                    <button
                      type="button"
                      className="mt-disc-del"
                      onClick={() => remove(p.id)}
                      title="Delete this comment"
                      aria-label="Delete comment"
                    >
                      <IconTrash size="sm" />
                    </button>
                  )}
                </div>
                <div className="mt-disc-body">{p.body}</div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <form className="mt-disc-form" onSubmit={submit}>
          <textarea
            className="input-base"
            placeholder="Share a tip, ask a question, or compare your solution…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={2}
            style={{ width: '100%', fontSize: '.82rem', resize: 'vertical' }}
            disabled={busy}
          />
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '.4rem', gap: '.5rem' }}>
            <span className="muted-text" style={{ fontSize: '.7rem' }}>{body.length}/2000</span>
            <Button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '.3rem .8rem', fontSize: '.78rem' }}
              disabled={!body.trim()}
              loading={busy}
            >
              {busy ? 'Posting…' : 'Post comment'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="muted-text" style={{ fontSize: '.78rem', marginTop: '.5rem' }}>
          <a href="#/login">Sign in</a> to join the discussion.
        </p>
      )}

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '.75rem', marginTop: '.4rem' }}>{error}</p>
      )}

      <style>{`
        .mt-disc {
          margin-top: .65rem; padding-top: .65rem;
          border-top: 1px dashed var(--border);
          display: flex; flex-direction: column; gap: .4rem;
        }
        .mt-disc-head {
          display: flex; align-items: center; gap: .35rem; flex-wrap: wrap;
          font-size: .78rem;
        }
        .mt-disc-list {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: .55rem;
        }
        .mt-disc-row {
          padding: .5rem .65rem;
          background: var(--muted, #f8fafc);
          border-radius: .4rem;
        }
        .mt-disc-meta {
          display: flex; align-items: center; gap: .5rem;
          font-size: .72rem; margin-bottom: .25rem;
        }
        .mt-disc-author { color: var(--primary); }
        .mt-disc-body { font-size: .82rem; line-height: 1.4; white-space: pre-wrap; }
        .mt-disc-del {
          margin-left: auto; background: none; border: 0; cursor: pointer;
          color: var(--muted-foreground); padding: 0;
        }
        .mt-disc-del:hover { color: var(--destructive); }
        .mt-disc-form { margin-top: .25rem; }
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
