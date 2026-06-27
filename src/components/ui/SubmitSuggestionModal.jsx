import { useEffect, useState } from 'react';
import { IconX } from '../../icons';
import { cachedGet, apiWrite, invalidate } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import Button from './Button';

// Modal for students to submit a new suggestion. Topics fetched live so
// admin-added topics show up without a frontend redeploy. The body is
// capped at 280 chars; the counter visually reddens past 250.
//
// On submit we POST and call `onSubmitted` — the parent can re-fetch
// the list (and show a "pending approval" hint). The new row arrives
// in the moderation queue, not the public list.

const MAX_BODY = 280;
const TOPICS_ENDPOINT = '/api/student-suggestions/topics';

export default function SubmitSuggestionModal({ onClose, onSubmitted }) {
  const [topics,  setTopics]  = useState(null);
  const [topicId, setTopicId] = useState('');
  const [body,    setBody]    = useState('');
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    cachedGet(TOPICS_ENDPOINT, null, 300_000)
      .then((j) => {
        const rows = j.rows || [];
        setTopics(rows);
        if (rows[0]) setTopicId(rows[0].id);
      })
      .catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const text = body.trim();
    if (!text)              { toast.warning('Tell us your suggestion before submitting.'); return; }
    if (text.length > MAX_BODY) { toast.warning(`Keep it under ${MAX_BODY} characters.`); return; }
    if (!topicId)           { toast.warning('Pick a topic.'); return; }
    setBusy(true);
    try {
      await apiWrite('/api/student-suggestions', {
        method: 'POST',
        body: { topic_id: topicId, body: text },
      });
      // Bust the cached lists so the user's "My suggestions" view picks
      // up the new pending row.
      invalidate('/api/student-suggestions/mine');
      onSubmitted?.();
    } catch (err) {
      toast.error(err?.message || 'Could not submit — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const remaining = MAX_BODY - body.length;
  const counterColor = remaining < 20
    ? (remaining < 0 ? 'var(--destructive)' : 'oklch(0.55 0.15 60)')
    : 'var(--muted-foreground)';

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" aria-labelledby="sugg-title"
           style={{ width: 'min(28rem, 100%)' }}>
        <div className="dialog-header">
          <h2 id="sugg-title" className="dialog-title">Submit a suggestion</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <form onSubmit={submit}>
          <div className="dialog-body">
            <p className="dialog-text" style={{ fontSize: '.875rem' }}>
              Share an idea to improve the branch. It'll be visible publicly once an admin approves it.
            </p>

            <label style={{ display: 'block', marginTop: '1rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Topic</div>
              {topics === null ? (
                <div className="input-base" style={{ color: 'var(--muted-foreground)' }}>Loading topics…</div>
              ) : (
                <select
                  className="input-base"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  required
                  disabled={busy}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </label>

            <label style={{ display: 'block', marginTop: '.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.25rem' }}>
                <span style={{ fontSize: '.8125rem', fontWeight: 600 }}>Your suggestion</span>
                <span style={{ fontSize: '.75rem', color: counterColor, fontVariantNumeric: 'tabular-nums' }}>
                  {remaining} left
                </span>
              </div>
              <textarea
                className="input-base"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY + 20))}
                placeholder="e.g. Add weekend revision classes before every exam attempt"
                required
                disabled={busy}
                maxLength={MAX_BODY + 20}
                style={{ resize: 'vertical' }}
              />
            </label>

            <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.5rem' }}>
              Limit: 3 submissions per week. Be specific — the most actionable suggestions get the most upvotes.
            </p>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <Button
              type="submit"
              className="btn btn-primary"
              loading={busy}
              disabled={!body.trim() || !topicId || body.length > MAX_BODY}
            >
              {busy ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
