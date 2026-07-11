import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import { useSiteContent } from '../../hooks/useSiteContent';
import { renderMarkdown } from '../../lib/markdown.jsx';
import { apiWrite, cachedGet, invalidate } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import { IconArrowRight, IconChevronDown, IconPlus } from '../../icons';
import SubmitSuggestionModal from './SubmitSuggestionModal';

// Home-card sidebar:
//   1. Editable copy (eyebrow / title / body / headings)
//   2. WICASA updates — admin-edited list in the home_wicasa_card slot
//   3. Top-3 approved student suggestions (live from /api/student-suggestions/top)
//      + upvote toggle hitting the real API + "Submit a suggestion" button
//      that opens the modal (signed-in users) or routes to /login (anonymous).

const TOP_ENDPOINT = '/api/student-suggestions/top?limit=3';

export default function WicasaCard() {
  const { user } = useAuth();
  const t = useSiteContent('home_wicasa_card');
  const updates = (t.updates || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // ─── Suggestions (live) ────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState(null);   // null = loading
  const [busyVote, setBusyVote] = useState(null);          // id currently mid-vote
  const [showSubmit, setShowSubmit] = useState(false);

  const load = useCallback(() => {
    cachedGet(TOP_ENDPOINT, null, 60_000)
      .then((j) => setSuggestions(j.rows || []))
      .catch(() => setSuggestions([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const onSubmitClick = () => {
    if (!user) { navigate('/login'); return; }
    setShowSubmit(true);
  };

  async function toggleVote(s) {
    if (!user) { navigate('/login'); return; }
    if (busyVote === s.id) return;
    setBusyVote(s.id);
    // Optimistic update so the pill feels instant.
    const wasVoted = !!s.my_vote;
    setSuggestions((prev) => prev.map((row) => row.id === s.id
      ? { ...row, my_vote: !wasVoted, vote_count: row.vote_count + (wasVoted ? -1 : 1) }
      : row));
    try {
      const url = `/api/student-suggestions/${s.id}/vote`;
      const res = await apiWrite(url, { method: wasVoted ? 'DELETE' : 'POST' });
      // Sync to the server's authoritative count in case other voters
      // moved the number while our request was in flight.
      setSuggestions((prev) => prev.map((row) => row.id === s.id
        ? { ...row, my_vote: res.voted, vote_count: res.vote_count }
        : row));
      invalidate(TOP_ENDPOINT);
    } catch (e) {
      // Roll back the optimistic update on failure.
      setSuggestions((prev) => prev.map((row) => row.id === s.id
        ? { ...row, my_vote: wasVoted, vote_count: row.vote_count + (wasVoted ? 1 : -1) }
        : row));
      toast.error(e?.message || 'Could not register your vote');
    } finally {
      setBusyVote(null);
    }
  }

  return (
    <div className="card wicasa-card">
      <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>{t.eyebrow}</div>
      <h3 style={{ marginTop: '.25rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
        {t.title}
      </h3>
      <div className="muted-text" style={{ marginTop: '.5rem', lineHeight: 1.6 }}>
        {renderMarkdown(t.body)}
      </div>

      {/* New updates — admin-driven list */}
      {updates.length > 0 && (
        <>
          <div className="wicasa-subhead">{t.updates_heading}</div>
          <ul className="wicasa-updates">
            {updates.map((u, i) => (
              <li key={`${i}-${u.slice(0, 24)}`}>
                <span className="wicasa-new">NEW</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Student suggestions — live, upvote-only */}
      <div className="wicasa-subhead">
        <span>{t.suggestions_heading}</span>
        {!user && <span className="wicasa-signin-hint">{t.signin_hint}</span>}
      </div>
      {suggestions === null ? (
        <ul className="wicasa-suggestions" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <span className="wicasa-sugg-text" style={{ background: 'var(--muted)', borderRadius: 4, height: '.85rem', width: '85%' }}>&nbsp;</span>
              <span className="wicasa-upvote-pill" style={{ opacity: .5 }}>
                <span className="wicasa-upvote-arrow"><IconChevronDown size="sm" /></span>
                <span className="wicasa-upvote-count">—</span>
              </span>
            </li>
          ))}
        </ul>
      ) : suggestions.length === 0 ? (
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.5rem' }}>
          No suggestions yet. Be the first!
        </p>
      ) : (
        <ul className="wicasa-suggestions">
          {suggestions.map((s) => {
            const isUp = !!s.my_vote;
            return (
              <li key={s.id}>
                <span className="wicasa-sugg-text">{s.body}</span>
                <button
                  type="button"
                  className={'wicasa-upvote-pill' + (isUp ? ' is-active' : '')}
                  onClick={() => toggleVote(s)}
                  disabled={busyVote === s.id}
                  aria-pressed={isUp}
                  aria-label={`Upvote: ${s.body}`}
                  title={user ? (isUp ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
                >
                  <span className="wicasa-upvote-arrow" aria-hidden="true">
                    <IconChevronDown size="sm" />
                  </span>
                  <span className="wicasa-upvote-count">{s.vote_count ?? 0}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="row gap-2" style={{ marginTop: '.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onSubmitClick}
          style={{ padding: '.4rem .85rem', fontSize: '.8rem' }}
        >
          <IconPlus size="sm" /> Submit a suggestion
        </button>
        <a href="/student-suggestions" className="btn btn-ghost" style={{ padding: '.4rem .85rem', fontSize: '.8rem' }}>
          See all →
        </a>
      </div>

      <a href="/students" className="wicasa-resources" style={{ marginTop: '1rem' }}>
        {t.resources_label} <IconArrowRight size="sm" />
      </a>

      {showSubmit && (
        <SubmitSuggestionModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => {
            setShowSubmit(false);
            toast.success('Submitted — visible once an admin approves it.');
            // invalidate() only clears the cache; the local state won't refresh
            // until load() actually re-runs. Fresh submissions are pending and
            // won't appear here (which is approved-only), but this catches the
            // case where another suggestion got approved while the modal was
            // open — the list still updates without a reload.
            invalidate(TOP_ENDPOINT);
            load();
          }}
        />
      )}
    </div>
  );
}
