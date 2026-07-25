import { useState } from 'react';
import { apiWrite } from '../../lib/apiCache';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import { toast } from '../../lib/notify';
import { IconHeart } from '../../icons';

// Save/unsave a job posting for the current user. Guests get bounced to
// login with a return hint so they land back on the vacancies page after
// signing in. Kept small (icon + optional label) so it fits inside a card
// header without wrapping.
export default function SaveButton({ postingId, saved: initialSaved, size = 'sm', showLabel = false }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(Boolean(initialSaved));
  const [busy, setBusy] = useState(false);

  async function onToggle(e) {
    e?.stopPropagation?.();
    if (!user) {
      navigate('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const j = await apiWrite(`/api/saved-jobs/${postingId}/toggle`, {
        invalidates: ['/api/saved-jobs', '/api/jobs'],
      });
      setSaved(Boolean(j.saved));
    } catch (err) {
      toast?.error?.(err.message || 'Could not update saved state');
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? 'Saved' : 'Save';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={saved}
      title={saved ? 'Remove from saved' : 'Save this posting'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '.35rem',
        background: saved ? 'oklch(0.36 0.13 255 / 0.1)' : 'transparent',
        border: '1px solid ' + (saved ? 'oklch(0.36 0.13 255 / 0.35)' : 'var(--border)'),
        color: saved ? 'var(--primary)' : 'var(--muted-foreground)',
        padding: showLabel ? '.35rem .65rem' : '.35rem',
        borderRadius: '.375rem', cursor: busy ? 'wait' : 'pointer',
        fontSize: '.75rem', fontWeight: 600,
      }}
    >
      <IconHeart size={size} style={saved ? { fill: 'currentColor' } : undefined} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
