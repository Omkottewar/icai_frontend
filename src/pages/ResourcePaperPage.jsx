import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useRoute, navigate } from '../hooks/useRoute';
import {
  IconDownload, IconCalendar, IconUsers, IconArrowRight,
  IconBookOpen, IconCheckCircle, IconStar,
} from '../icons';
import { Shimmer, ShimmerLines, ShimmerPageBody } from '../components/ui/Shimmer';

// Single paper detail page. Renders:
//   • Title + abstract + author byline
//   • PDF download CTA
//   • Topic chips (link back to filtered listing)
//   • Speaker profile link
//   • WhatsApp / link share buttons
//   • Bookmark toggle (signed-in only)
//   • Quiz CTA when an active quiz is attached
//   • Comments thread (signed-in members can post)
//   • Disclaimer at the bottom

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ResourcePaperPage() {
  const { user } = useAuth();
  const route = useRoute();
  // Path looks like "/resources/papers/<slug>"
  const slug = route.path.split('/').pop();

  const [paper, setPaper] = useState(null);
  const [err, setErr] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [quizMeta, setQuizMeta] = useState(null);   // null until probed

  useEffect(() => {
    if (!slug) return;
    api(`/api/resources/papers/${slug}`)
      .then((r) => setPaper(r?.paper || null))
      .catch((e) => setErr(e.message));
  }, [slug]);

  // Probe whether a quiz exists for this paper — drives the "Take quiz to
  // earn CPE" CTA. Public endpoint requires sign-in but we still poke it
  // for signed-in users only.
  useEffect(() => {
    if (!slug || !user) return;
    api(`/api/resources/papers/${slug}/quiz`)
      .then((r) => setQuizMeta(r))
      .catch(() => setQuizMeta(null));
  }, [slug, user?.id]);

  // Probe initial bookmark state — query my-library and look for this id.
  useEffect(() => {
    if (!user || !paper) return;
    api('/api/resources/bookmarks/my')
      .then((r) => {
        const found = (r?.items || []).some((x) => x.resource_type === 'paper' && x.slug === paper.slug);
        setBookmarked(found);
      })
      .catch(() => {});
  }, [user?.id, paper?.id]);

  const toggleBookmark = async () => {
    if (!user) { navigate('/login'); return; }
    setBookmarked((b) => !b);
    try {
      await api('/api/resources/bookmarks', {
        method: 'POST',
        body: { resource_type: 'paper', resource_id: paper.id },
      });
    } catch { setBookmarked((b) => !b); /* rollback */ }
  };

  const shareWhatsApp = () => {
    const text = `${paper.title} — by ${paper.speaker_name}\n${window.location.origin}/#/resources/papers/${paper.slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/#/resources/papers/${paper.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      // tiny toast — keep self-contained
      const el = document.createElement('div');
      el.textContent = 'Link copied';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e40af;color:white;padding:.5rem 1rem;border-radius:.5rem;font-size:.85rem;z-index:9999';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1800);
    } catch { /* clipboard might fail in iframe */ }
  };

  if (err) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--destructive)' }}>{err}</p>
        <a href="#/resources">← Back to Resources</a>
      </section>
    );
  }
  if (!paper) {
    return <ShimmerPageBody cards={3} />;
  }

  const dateLabel = paper.presented_on
    ? new Date(paper.presented_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const speakerSlug = paper.author?.id || paper.speaker_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <>
      <PageHeader title="Paper Presentation" />

      <section className="container" style={{ padding: '1.5rem 1rem 3rem', maxWidth: '900px' }}>
        <div className="pp-back">
          <a href="#/resources">← All resources</a>
        </div>

        {/* Topics + view count strip */}
        <div className="pp-topstrip">
          {paper.topics.map((t) => (
            <a
              key={t.code}
              href={`#/resources?topic=${t.code}`}
              className="pp-topic-pill"
              onClick={(e) => { e.preventDefault(); navigate(`/resources?topic=${t.code}`); }}
            >{t.name}</a>
          ))}
          {paper.view_count > 0 && <span className="pp-views">👁 {paper.view_count} reads</span>}
        </div>

        <h1 className="pp-title">{paper.title}</h1>

        {/* Author byline */}
        <div className="pp-author">
          <a href={`#/resources/speakers/${speakerSlug}`} className="pp-author-link">
            <span className="pp-author-avatar">
              {paper.speaker_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
            <div>
              <strong>{paper.speaker_name}</strong>
              {paper.author_designation && <span className="muted-text"> · {paper.author_designation}</span>}
            </div>
          </a>
          <div className="pp-meta">
            {dateLabel && <span><IconCalendar size="sm" /> {dateLabel}</span>}
            {paper.event && (
              <a href={`#/events/${paper.event.slug}`}>
                <IconUsers size="sm" /> {paper.event.title}
              </a>
            )}
            {paper.committee && <span>· {paper.committee.name}</span>}
          </div>
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <div className="pp-abstract">
            <strong>Abstract</strong>
            <p>{paper.abstract}</p>
          </div>
        )}

        {/* Action bar — read in app, download, bookmark, share */}
        <div className="pp-actions">
          {paper.pdf_url && (
            <a href={`#/resources/papers/${paper.slug}/read`} className="btn btn-primary">
              <IconBookOpen size="sm" /> <span>Read in app</span>
            </a>
          )}
          {paper.pdf_url && (
            <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <IconDownload size="sm" /> <span>Download PDF</span>
            </a>
          )}
          <button type="button" className={'btn btn-outline pp-bookmark' + (bookmarked ? ' is-on' : '')} onClick={toggleBookmark}>
            {bookmarked ? '★ Saved' : '☆ Save to library'}
          </button>
          <button type="button" className="btn btn-outline pp-share-wa" onClick={shareWhatsApp}>
            <span className="pp-wa-icon">💬</span> WhatsApp
          </button>
          <button type="button" className="btn btn-outline" onClick={copyLink}>
            🔗 Copy link
          </button>
        </div>

        {/* Description — long-form body if provided */}
        {paper.description && (
          <div className="pp-description">
            {paper.description.split('\n').map((line, i) => <p key={i}>{line}</p>)}
          </div>
        )}

        {/* CPE quiz CTA */}
        {quizMeta?.quiz && (
          <QuizCTA quiz={quizMeta} slug={paper.slug} />
        )}

        {/* Comments thread */}
        <CommentsThread paper={paper} user={user} />

        {/* Disclaimer */}
        <p className="pp-disclaimer">
          ⚠ {paper.disclaimer_text}
        </p>
      </section>

      <style>{STYLES}</style>
    </>
  );
}

function QuizCTA({ quiz, slug }) {
  if (quiz.already_passed) {
    return (
      <div className="pp-quiz-cta pp-quiz-done">
        <IconCheckCircle />
        <div>
          <strong>You've already passed this quiz</strong>
          <p className="muted-text" style={{ margin: '.15rem 0 0', fontSize: '.85rem' }}>
            {quiz.quiz.cpe_credit_minutes} min unstructured CPE credit recorded.
          </p>
        </div>
      </div>
    );
  }
  if (quiz.cooldown_until) {
    return (
      <div className="pp-quiz-cta pp-quiz-cooldown">
        <span style={{ fontSize: '1.5rem' }}>⏳</span>
        <div>
          <strong>Quiz available in {Math.ceil((new Date(quiz.cooldown_until) - new Date()) / 3600 / 1000)} hour(s)</strong>
          <p className="muted-text" style={{ margin: '.15rem 0 0', fontSize: '.85rem' }}>
            You can retake after the cooldown period.
          </p>
        </div>
      </div>
    );
  }
  return (
    <a href={`#/resources/papers/${slug}/quiz`} className="pp-quiz-cta pp-quiz-open">
      <span style={{ fontSize: '1.75rem' }}>🎓</span>
      <div style={{ flex: 1 }}>
        <strong>Take the quiz · earn {quiz.quiz.cpe_credit_minutes} min CPE</strong>
        <p className="muted-text" style={{ margin: '.15rem 0 0', fontSize: '.85rem' }}>
          {quiz.questions?.length || quiz.quiz.question_count} questions · pass {quiz.quiz.pass_threshold} to earn unstructured CPE credit
        </p>
      </div>
      <IconArrowRight />
    </a>
  );
}

function CommentsThread({ paper, user }) {
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const load = () => {
    api(`/api/resources/comments?resource_type=paper&resource_id=${paper.id}`)
      .then((r) => setComments(r?.items || []))
      .catch(() => setComments([]));
  };
  useEffect(load, [paper.id]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await api('/api/resources/comments', {
        method: 'POST',
        body: {
          resource_type: 'paper',
          resource_id: paper.id,
          body: draft.trim(),
          parent_comment_id: replyTo,
        },
      });
      setDraft('');
      setReplyTo(null);
      load();
    } catch (e2) {
      alert(e2.message);
    } finally {
      setPosting(false);
    }
  };

  // Group root comments + their replies into a flat threaded list.
  const grouped = (() => {
    if (!Array.isArray(comments)) return [];
    const byParent = new Map();
    for (const c of comments) {
      if (c.parent_comment_id) {
        const list = byParent.get(c.parent_comment_id) ?? [];
        list.push(c);
        byParent.set(c.parent_comment_id, list);
      }
    }
    return comments
      .filter((c) => !c.parent_comment_id)
      .map((c) => ({ ...c, replies: byParent.get(c.id) ?? [] }));
  })();

  return (
    <div className="pp-comments">
      <h2 className="pp-section-title">Questions & Comments ({Array.isArray(comments) ? comments.length : 0})</h2>

      {user ? (
        <form onSubmit={submit} className="pp-comment-form">
          {replyTo && (
            <div className="pp-reply-hint">
              Replying to a comment.
              <button type="button" onClick={() => setReplyTo(null)}>Cancel reply</button>
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the author a question or share a thought…"
            rows={3}
            maxLength={5000}
          />
          <div className="pp-comment-form-foot">
            <span className="muted-text" style={{ fontSize: '.72rem' }}>Comments appear immediately; admins moderate.</span>
            <button type="submit" className="btn btn-primary" disabled={posting || !draft.trim()}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <div className="pp-comments-signin">
          <a href="#/login">Sign in</a> to post questions or comments.
        </div>
      )}

      {comments === null && (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              <Shimmer height=".8rem" width="35%" />
              <ShimmerLines count={2} lastWidth="60%" />
            </div>
          ))}
        </div>
      )}
      {comments && comments.length === 0 && <p className="muted-text">No questions yet — be the first to ask.</p>}
      {grouped.map((c) => (
        <div key={c.id} className="pp-comment">
          <div className="pp-comment-head">
            <strong>{c.user.name}</strong>
            <span className="muted-text">· {new Date(c.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <p className="pp-comment-body">{c.body}</p>
          {user && (
            <button type="button" className="pp-comment-reply" onClick={() => setReplyTo(c.id)}>Reply</button>
          )}
          {c.replies.map((r) => (
            <div key={r.id} className="pp-comment pp-comment-reply-row">
              <div className="pp-comment-head">
                <strong>{r.user.name}</strong>
                <span className="muted-text">· {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <p className="pp-comment-body">{r.body}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const STYLES = `
  .pp-back { margin-bottom: 1rem; font-size: .8125rem; }
  .pp-back a { color: var(--primary); }
  .pp-topstrip { display: flex; gap: .35rem; flex-wrap: wrap; margin-bottom: .5rem; align-items: center; }
  .pp-topic-pill {
    padding: .15rem .55rem; background: rgba(37, 99, 235, .08);
    color: var(--primary); border-radius: 999px;
    font-size: .7rem; font-weight: 700; text-decoration: none;
  }
  .pp-topic-pill:hover { background: rgba(37, 99, 235, .14); }
  .pp-views { margin-left: auto; font-size: .72rem; color: var(--muted-foreground); }

  .pp-title { font-size: 2rem; line-height: 1.2; margin: .5rem 0 1rem; color: var(--foreground); }

  .pp-author {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
    padding: .75rem 0 1rem; border-bottom: 1px solid var(--border); flex-wrap: wrap;
  }
  .pp-author-link { display: flex; align-items: center; gap: .6rem; color: var(--foreground); text-decoration: none; }
  .pp-author-link:hover strong { color: var(--primary); }
  .pp-author-avatar {
    width: 2.4rem; height: 2.4rem; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--primary); color: white;
    font-weight: 700; font-size: .85rem;
  }
  .pp-meta { display: flex; gap: .65rem; align-items: center; font-size: .8rem; color: var(--muted-foreground); flex-wrap: wrap; }
  .pp-meta span, .pp-meta a { display: inline-flex; align-items: center; gap: .25rem; color: inherit; text-decoration: none; }
  .pp-meta a:hover { color: var(--primary); }

  .pp-abstract {
    margin: 1.25rem 0;
    padding: .85rem 1rem;
    background: var(--background, #f8fafc); border-left: 3px solid var(--primary);
    border-radius: .35rem;
  }
  .pp-abstract strong { display: block; font-size: .7rem; text-transform: uppercase; color: var(--muted-foreground); letter-spacing: .04em; margin-bottom: .25rem; }
  .pp-abstract p { margin: 0; font-size: .95rem; line-height: 1.55; color: var(--foreground); }

  .pp-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin: 1.25rem 0; }
  .pp-bookmark.is-on { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
  .pp-share-wa { background: #25d366 !important; color: white !important; border-color: #25d366 !important; }
  .pp-share-wa:hover { background: #1da851 !important; }
  .pp-wa-icon { font-size: 1rem; }

  .pp-description { margin: 1.5rem 0; line-height: 1.65; }
  .pp-description p { margin: 0 0 .85rem; }

  .pp-quiz-cta {
    display: flex; align-items: center; gap: 1rem;
    padding: 1rem 1.25rem; border-radius: .55rem;
    margin: 1.75rem 0;
    text-decoration: none; color: inherit;
    transition: all .12s;
  }
  .pp-quiz-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.06); }
  .pp-quiz-open { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #f59e0b; }
  .pp-quiz-done { background: #dcfce7; border: 1px solid #86efac; }
  .pp-quiz-cooldown { background: #fef3c7; border: 1px solid #fcd34d; }
  .pp-quiz-cta strong { display: block; font-size: 1rem; }

  .pp-section-title { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 .75rem; }
  .pp-comments { margin-top: 2rem; }
  .pp-comment-form { background: var(--card); border: 1px solid var(--border); border-radius: .5rem; padding: .75rem; margin-bottom: 1rem; }
  .pp-comment-form textarea { width: 100%; border: 0; resize: vertical; font: inherit; outline: none; padding: .25rem; background: transparent; color: var(--foreground); }
  .pp-comment-form-foot { display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding-top: .5rem; border-top: 1px solid var(--border); }
  .pp-reply-hint { font-size: .75rem; color: var(--muted-foreground); margin-bottom: .35rem; display: flex; justify-content: space-between; }
  .pp-reply-hint button { background: transparent; border: 0; color: var(--primary); cursor: pointer; font-size: .75rem; }
  .pp-comments-signin { padding: 1rem; background: var(--background); border: 1px dashed var(--border); border-radius: .4rem; text-align: center; font-size: .875rem; color: var(--muted-foreground); margin-bottom: 1rem; }
  .pp-comments-signin a { color: var(--primary); font-weight: 600; }
  .pp-comment { padding: .85rem 0; border-bottom: 1px solid var(--border); }
  .pp-comment-reply-row { margin-left: 1.5rem; padding-left: .85rem; border-left: 2px solid var(--border); border-bottom: 0; padding-bottom: 0; padding-top: .75rem; }
  .pp-comment-head { display: flex; gap: .4rem; align-items: baseline; font-size: .8rem; }
  .pp-comment-body { margin: .25rem 0; font-size: .9rem; line-height: 1.5; color: var(--foreground); white-space: pre-wrap; }
  .pp-comment-reply { background: transparent; border: 0; color: var(--primary); cursor: pointer; font-size: .75rem; padding: 0; }

  .pp-disclaimer {
    margin-top: 2.5rem; padding: .65rem .85rem;
    background: #fef3c7; border-left: 3px solid #f59e0b;
    border-radius: .35rem;
    font-size: .8rem; color: #78350f;
  }
`;
