import { useEffect, useState } from 'react';
import { IconX } from '../../icons';
import { apiWrite, invalidate } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import Button from '../ui/Button';

// Student-facing modal: submits a mentorship request. Backing endpoint is
// POST /api/mentorship. WICASA sees new rows in their admin queue.
//
// Kept intentionally short — a topic line + optional preferred window is
// what the schema captures. Anything longer is out of scope for MVP.

const MAX_TOPIC = 200;
const MAX_WINDOW = 500;

export default function RequestMentorshipModal({ onClose, onSubmitted }) {
  const [topic, setTopic] = useState('');
  const [preferredWindow, setPreferredWindow] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const t = topic.trim();
    if (!t) { toast.warning('Add a topic before submitting.'); return; }
    if (t.length > MAX_TOPIC) { toast.warning(`Keep the topic under ${MAX_TOPIC} characters.`); return; }
    setBusy(true);
    try {
      await apiWrite('/api/mentorship', {
        method: 'POST',
        body: { topic: t, preferred_window: preferredWindow.trim() },
      });
      invalidate('/api/mentorship/my');
      toast.success('Mentorship request sent. WICASA will match you with a mentor soon.');
      onSubmitted?.();
    } catch (err) {
      toast.error(err?.message || 'Could not submit — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" aria-labelledby="mentorship-title"
           style={{ width: 'min(30rem, 100%)' }}>
        <div className="dialog-header">
          <h2 id="mentorship-title" className="dialog-title">Request a mentor</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <form onSubmit={submit}>
          <div className="dialog-body">
            <p className="dialog-text" style={{ fontSize: '.875rem' }}>
              Tell us what you want help with. WICASA will pair you with a senior CA who's a good fit and
              get in touch to schedule the first session. Mentorship is free.
            </p>

            <label style={{ display: 'block', marginTop: '1rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
                What do you want to be mentored on?
              </div>
              <input
                type="text"
                className="input-base"
                value={topic}
                onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC + 20))}
                placeholder="e.g. Preparing for CA Final Group 2, or navigating GST practice"
                required
                disabled={busy}
                maxLength={MAX_TOPIC + 20}
              />
            </label>

            <label style={{ display: 'block', marginTop: '.875rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
                When are you usually free? <span className="muted-text" style={{ fontWeight: 400 }}>(optional)</span>
              </div>
              <textarea
                className="input-base"
                rows={3}
                value={preferredWindow}
                onChange={(e) => setPreferredWindow(e.target.value.slice(0, MAX_WINDOW + 20))}
                placeholder="e.g. Weekday evenings after 7 PM, or Sunday afternoons"
                disabled={busy}
                maxLength={MAX_WINDOW + 20}
                style={{ resize: 'vertical' }}
              />
            </label>

            <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.75rem' }}>
              Limit: 3 requests per hour. WICASA typically responds within a week.
            </p>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <Button
              type="submit"
              className="btn btn-primary"
              loading={busy}
              disabled={!topic.trim() || topic.length > MAX_TOPIC}
            >
              {busy ? 'Submitting…' : 'Send request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
