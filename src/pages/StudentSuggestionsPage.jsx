import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate, useRoute } from '../hooks/useRoute';
import { cachedGet, apiWrite, invalidate } from '../lib/apiCache';
import { toast } from '../lib/notify';
import SubmitSuggestionModal from '../components/ui/SubmitSuggestionModal';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import {
  IconChevronDown, IconPlus, IconSearch, IconClock, IconCheckCircle, IconX, IconAward,
} from '../icons';

// Full public browse for student suggestions. Two views:
//   • All — filter chips by topic + sort toggle (Most upvoted / Most recent),
//     paginated, with the same upvote pill used on the home WICASA card.
//   • Mine — the signed-in user's own submissions across statuses, so they
//     can see which are still pending or got rejected (and why).
//
// The route lives at /student-suggestions and is reachable from the
// "See all →" link on the WICASA card and the more-sheet in the mobile
// bottom nav.

const PAGE_SIZE = 20;

function fmtAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return <span className="ss-badge ss-badge-ok"><IconCheckCircle size="sm" /> Approved</span>;
  if (s === 'rejected') return <span className="ss-badge ss-badge-err"><IconX size="sm" /> Rejected</span>;
  if (s === 'archived') return <span className="ss-badge ss-badge-muted">Archived</span>;
  return <span className="ss-badge ss-badge-pending"><IconClock size="sm" /> Pending</span>;
}

function SuggestionRow({ s, busyVote, onVote, signedIn }) {
  const isUp = !!s.my_vote;
  return (
    <li className="ss-row">
      <div className="ss-row-main">
        {s.topic_name && <span className="ss-topic-chip">{s.topic_name}</span>}
        <p className="ss-body">{s.body}</p>
        <div className="ss-meta">
          <span>{fmtAgo(s.created_at)}</span>
          {s.author_name && <span>· {s.author_name}</span>}
        </div>
      </div>
      <button
        type="button"
        className={'wicasa-upvote-pill ss-upvote' + (isUp ? ' is-active' : '')}
        onClick={() => onVote(s)}
        disabled={busyVote === s.id}
        aria-pressed={isUp}
        aria-label={`Upvote: ${s.body}`}
        title={signedIn ? (isUp ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
      >
        <span className="wicasa-upvote-arrow" aria-hidden="true">
          <IconChevronDown size="sm" />
        </span>
        <span className="wicasa-upvote-count">{s.vote_count ?? 0}</span>
      </button>
    </li>
  );
}

export default function StudentSuggestionsPage() {
  const { user } = useAuth();
  const { query } = useRoute();

  const [tab, setTab] = useState(query.tab === 'mine' ? 'mine' : 'all');
  useEffect(() => { if (!user && tab === 'mine') setTab('all'); }, [user, tab]);

  // Topic filter state (chips). 'all' = no filter.
  const [topics, setTopics] = useState([]);
  const [topicCode, setTopicCode] = useState(query.topic || 'all');
  const [sortKey, setSortKey] = useState(query.sort === 'recent' ? 'recent' : 'votes');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);

  // Suggestion list state.
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [busyVote, setBusyVote] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);

  // "My suggestions" tab state.
  const [mine, setMine] = useState(null);

  // Debounce the search box so a typing burst doesn't fire one fetch per keystroke.
  useEffect(() => {
    const id = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [qInput]);

  // Reset to page 1 whenever filters change.
  useEffect(() => { setPage(1); }, [topicCode, sortKey]);

  // Load topics once.
  useEffect(() => {
    cachedGet('/api/student-suggestions/topics', null, 300_000)
      .then((j) => setTopics(j.rows || []))
      .catch(() => setTopics([]));
  }, []);

  const loadAll = useCallback(() => {
    const qs = new URLSearchParams();
    if (topicCode && topicCode !== 'all') qs.set('topic', topicCode);
    if (sortKey) qs.set('sort', sortKey);
    if (q) qs.set('q', q);
    qs.set('page', String(page));
    qs.set('pageSize', String(PAGE_SIZE));
    setRows(null);
    cachedGet(`/api/student-suggestions?${qs.toString()}`, null, 30_000)
      .then((j) => { setRows(j.rows || []); setTotal(j.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [topicCode, sortKey, q, page]);

  const loadMine = useCallback(() => {
    if (!user) return;
    setMine(null);
    cachedGet('/api/student-suggestions/mine', null, 30_000)
      .then((j) => setMine(j.rows || []))
      .catch(() => setMine([]));
  }, [user]);

  useEffect(() => { if (tab === 'all')  loadAll();  }, [tab, loadAll]);
  useEffect(() => { if (tab === 'mine') loadMine(); }, [tab, loadMine]);

  async function toggleVote(s) {
    if (!user) { navigate('/login'); return; }
    if (busyVote === s.id) return;
    setBusyVote(s.id);
    const wasVoted = !!s.my_vote;
    setRows((prev) => prev.map((row) => row.id === s.id
      ? { ...row, my_vote: !wasVoted, vote_count: row.vote_count + (wasVoted ? -1 : 1) }
      : row));
    try {
      const url = `/api/student-suggestions/${s.id}/vote`;
      const res = await apiWrite(url, { method: wasVoted ? 'DELETE' : 'POST' });
      setRows((prev) => prev.map((row) => row.id === s.id
        ? { ...row, my_vote: res.voted, vote_count: res.vote_count }
        : row));
      invalidate('/api/student-suggestions');
    } catch (e) {
      // Roll the optimistic update back if the server rejected us.
      setRows((prev) => prev.map((row) => row.id === s.id
        ? { ...row, my_vote: wasVoted, vote_count: row.vote_count + (wasVoted ? 1 : -1) }
        : row));
      toast.error(e?.message || 'Could not register your vote');
    } finally {
      setBusyVote(null);
    }
  }

  const onSubmitClick = () => {
    if (!user) { navigate('/login'); return; }
    setShowSubmit(true);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="Student Suggestions"
        subtitle="Share an idea to improve the branch — and upvote the ones you agree with. Approved suggestions are visible to the branch leadership."
      />

      <section className="container" style={{ padding: 'clamp(1.5rem, 4vw, 2.5rem) 1rem' }}>
        {/* Tab switcher + Submit CTA */}
        <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div className="ss-tabs" role="tablist" aria-label="View">
            <button
              type="button" role="tab" aria-selected={tab === 'all'}
              className={'ss-tab' + (tab === 'all' ? ' is-active' : '')}
              onClick={() => setTab('all')}
            >
              All suggestions
            </button>
            {user && (
              <button
                type="button" role="tab" aria-selected={tab === 'mine'}
                className={'ss-tab' + (tab === 'mine' ? ' is-active' : '')}
                onClick={() => setTab('mine')}
              >
                My suggestions
              </button>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={onSubmitClick}>
            <IconPlus size="sm" /> Submit a suggestion
          </button>
        </div>

        {tab === 'all' && (
          <>
            {/* Filter row: topic chips, sort, search */}
            <div className="ss-filters">
              <div className="ss-chips" role="tablist" aria-label="Filter by topic">
                <button
                  type="button"
                  className={'ss-chip' + (topicCode === 'all' ? ' is-active' : '')}
                  onClick={() => setTopicCode('all')}
                >
                  All topics
                </button>
                {topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={'ss-chip' + (topicCode === t.code ? ' is-active' : '')}
                    onClick={() => setTopicCode(t.code)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="ss-controls">
                <label className="ss-search">
                  <IconSearch size="sm" />
                  <input
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder="Search suggestions…"
                    aria-label="Search suggestions"
                  />
                </label>
                <div className="ss-sort" role="group" aria-label="Sort by">
                  <button
                    type="button"
                    className={'ss-sort-btn' + (sortKey === 'votes' ? ' is-active' : '')}
                    onClick={() => setSortKey('votes')}
                  >
                    <IconAward size="sm" /> Most upvoted
                  </button>
                  <button
                    type="button"
                    className={'ss-sort-btn' + (sortKey === 'recent' ? ' is-active' : '')}
                    onClick={() => setSortKey('recent')}
                  >
                    <IconClock size="sm" /> Most recent
                  </button>
                </div>
              </div>
            </div>

            {/* Result list */}
            {rows === null ? (
              <ul className="ss-list" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="ss-row">
                    <div className="ss-row-main">
                      <Shimmer height=".75rem" width="5rem" radius="999px" />
                      <ShimmerLines count={2} />
                      <Shimmer height=".7rem" width="40%" />
                    </div>
                    <Shimmer height="2rem" width="3.5rem" radius="999px" />
                  </li>
                ))}
              </ul>
            ) : rows.length === 0 ? (
              <div className="ss-empty">
                <h2>No suggestions match your filters</h2>
                <p className="muted-text">Try clearing the topic filter, or be the first to submit one in this topic.</p>
              </div>
            ) : (
              <ul className="ss-list">
                {rows.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    s={s}
                    busyVote={busyVote}
                    onVote={toggleVote}
                    signedIn={!!user}
                  />
                ))}
              </ul>
            )}

            {/* Pagination */}
            {rows && rows.length > 0 && pageCount > 1 && (
              <div className="ss-pager">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="muted-text" style={{ fontSize: '.8125rem' }}>
                  Showing {showingFrom}–{showingTo} of {total}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'mine' && user && (
          <>
            {mine === null ? (
              <ul className="ss-list" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="ss-row">
                    <div className="ss-row-main">
                      <Shimmer height=".75rem" width="6rem" radius="999px" />
                      <ShimmerLines count={2} />
                    </div>
                    <Shimmer height="1.5rem" width="5rem" radius="999px" />
                  </li>
                ))}
              </ul>
            ) : mine.length === 0 ? (
              <div className="ss-empty">
                <h2>You haven't submitted any suggestions yet</h2>
                <p className="muted-text">Tap "Submit a suggestion" above to share your first idea.</p>
              </div>
            ) : (
              <ul className="ss-list">
                {mine.map((s) => (
                  <li key={s.id} className="ss-row">
                    <div className="ss-row-main">
                      {s.topic_name && <span className="ss-topic-chip">{s.topic_name}</span>}
                      <p className="ss-body">{s.body}</p>
                      <div className="ss-meta">
                        <span>{fmtAgo(s.created_at)}</span>
                        {s.status === 'approved' && <span>· {s.vote_count ?? 0} upvotes</span>}
                      </div>
                      {s.status === 'rejected' && s.reject_reason && (
                        <p className="ss-reject-reason">
                          <strong>Reason:</strong> {s.reject_reason}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {showSubmit && (
        <SubmitSuggestionModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => {
            setShowSubmit(false);
            toast.success('Submitted — visible once an admin approves it.');
            // Bust the "all" cache so the new pending row shows up immediately
            // in the user's "Mine" tab when they switch to it.
            invalidate('/api/student-suggestions');
          }}
        />
      )}

      <style>{`
        .ss-tabs {
          display: inline-flex;
          gap: .25rem;
          padding: .25rem;
          background: var(--muted, #f1f5f9);
          border-radius: .6rem;
        }
        .ss-tab {
          padding: .45rem .9rem;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          font-weight: 600;
          font-size: .875rem;
          border-radius: .45rem;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }
        .ss-tab:hover { color: var(--foreground); }
        .ss-tab.is-active {
          background: var(--card, #fff);
          color: var(--primary);
          box-shadow: 0 1px 2px rgba(0,0,0,.05);
        }

        .ss-filters {
          display: flex;
          flex-direction: column;
          gap: .75rem;
          margin-bottom: 1.25rem;
        }
        .ss-chips {
          display: flex;
          flex-wrap: wrap;
          gap: .4rem;
        }
        .ss-chip {
          padding: .35rem .8rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--card);
          color: var(--foreground);
          font-size: .8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: background .15s ease, border-color .15s ease, color .15s ease;
        }
        .ss-chip:hover { border-color: oklch(0.55 0.16 145 / 0.55); }
        .ss-chip.is-active {
          background: var(--secondary);
          border-color: var(--secondary);
          color: white;
        }
        .ss-controls {
          display: flex;
          gap: .75rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .ss-search {
          display: inline-flex;
          align-items: center;
          gap: .4rem;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .5rem;
          padding: .35rem .65rem;
          color: var(--muted-foreground);
          flex: 1;
          min-width: 12rem;
          max-width: 22rem;
        }
        .ss-search input {
          border: none;
          outline: none;
          background: transparent;
          width: 100%;
          font-size: .875rem;
          color: var(--foreground);
        }
        .ss-sort {
          display: inline-flex;
          gap: .25rem;
          background: var(--muted, #f1f5f9);
          padding: .2rem;
          border-radius: .45rem;
        }
        .ss-sort-btn {
          display: inline-flex;
          align-items: center;
          gap: .3rem;
          padding: .35rem .65rem;
          border: none;
          background: transparent;
          color: var(--muted-foreground);
          font-size: .8125rem;
          font-weight: 600;
          border-radius: .35rem;
          cursor: pointer;
        }
        .ss-sort-btn.is-active {
          background: var(--card, #fff);
          color: var(--primary);
          box-shadow: 0 1px 2px rgba(0,0,0,.05);
        }

        .ss-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: .65rem;
        }
        .ss-row {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem 1.1rem;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .65rem;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .ss-row:hover {
          border-color: oklch(0.55 0.16 145 / 0.45);
          box-shadow: 0 6px 18px -10px rgba(31, 122, 73, .25);
        }
        .ss-row-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: .35rem;
        }
        .ss-topic-chip {
          align-self: flex-start;
          font-size: .68rem;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
          padding: .15rem .55rem;
          border-radius: 999px;
          background: oklch(0.55 0.14 155 / 0.12);
          color: var(--secondary);
        }
        .ss-body {
          margin: 0;
          font-size: .9375rem;
          line-height: 1.5;
          color: var(--foreground);
          word-break: break-word;
        }
        .ss-meta {
          display: flex;
          gap: .35rem;
          font-size: .75rem;
          color: var(--muted-foreground);
        }
        .ss-reject-reason {
          margin: .4rem 0 0;
          padding: .5rem .65rem;
          background: oklch(0.95 0.05 25);
          border-left: 3px solid oklch(0.6 0.18 25);
          border-radius: .25rem;
          font-size: .8125rem;
          color: oklch(0.35 0.13 25);
        }
        .ss-upvote { flex-shrink: 0; }

        .ss-badge {
          display: inline-flex;
          align-items: center;
          gap: .25rem;
          font-size: .7rem;
          font-weight: 700;
          letter-spacing: .03em;
          padding: .2rem .55rem;
          border-radius: 999px;
          flex-shrink: 0;
          align-self: flex-start;
        }
        .ss-badge-ok      { background: oklch(0.92 0.07 145); color: oklch(0.35 0.14 145); }
        .ss-badge-err     { background: oklch(0.93 0.06 25);  color: oklch(0.42 0.16 25); }
        .ss-badge-pending { background: oklch(0.93 0.05 80);  color: oklch(0.4 0.14 75); }
        .ss-badge-muted   { background: var(--muted, #f1f5f9); color: var(--muted-foreground); }

        .ss-empty {
          text-align: center;
          padding: 3rem 1rem;
          max-width: 32rem;
          margin: 0 auto;
        }
        .ss-empty h2 {
          margin: 0 0 .5rem;
          font-size: 1.0625rem;
          font-weight: 600;
        }

        .ss-pager {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        @media (max-width: 540px) {
          .ss-row { padding: .85rem .9rem; gap: .65rem; }
          .ss-body { font-size: .875rem; }
          .ss-controls { flex-direction: column; align-items: stretch; }
          .ss-search { max-width: none; }
          .ss-sort { align-self: flex-start; }
        }
      `}</style>
    </>
  );
}
