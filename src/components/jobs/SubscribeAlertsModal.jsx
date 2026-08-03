import { useEffect, useRef, useState } from 'react';
import { cachedGet, apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { IconX, IconBell, IconCheckCircle } from '../../icons';

// Modal that lets a signed-in member/student pick categories + posting types
// + frequency + optional filters, and POSTs them to /api/job-alerts/subscribe.
// Callers open it from the JobVacanciesPage banner or the dedicated
// /job-alerts/subscribe page.

const FREQUENCY_OPTIONS = [
  { value: 'instant',        label: 'Instant',       hint: 'Email me the moment a matching posting is added.' },
  { value: 'daily_digest',   label: 'Daily digest',  hint: 'One email at 07:00 IST summarising the last 24 h.' },
  { value: 'weekly_digest',  label: 'Weekly digest', hint: 'One email every Monday morning.' },
];

const POSTING_TYPES = [
  { value: 'job',         label: 'Full-time / permanent jobs' },
  { value: 'articleship', label: 'Articleship (students)' },
  { value: 'assignment',  label: 'Short-term / assignment work' },
];

export default function SubscribeAlertsModal({ onClose, initialCategoryId }) {
  const overlayRef = useRef(null);
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmedInline, setConfirmedInline] = useState(false);
  const [form, setForm] = useState({
    category_ids: initialCategoryId ? [initialCategoryId] : [],
    posting_types: ['job'],
    frequency: 'instant',
    // Location filter is intentionally omitted — every posting is
    // Nagpur-branch scoped, so filtering by city adds no value.
    filter_experience: '',
  });

  useEffect(() => {
    cachedGet('/api/job-alerts/categories', undefined, 300_000)
      .then((j) => setCategories(j.items || []))
      .catch((e) => setError(e.message));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k, v) => setForm((f) => {
    const cur = new Set(f[k]);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    return { ...f, [k]: [...cur] };
  });

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  async function submit(e) {
    e.preventDefault();
    if (form.category_ids.length === 0) { setError('Pick at least one category'); return; }
    if (form.posting_types.length === 0) { setError('Pick at least one posting type'); return; }
    setSaving(true); setError(null);
    try {
      const j = await apiWrite('/api/job-alerts/subscribe', {
        body: {
          category_ids: form.category_ids,
          posting_types: form.posting_types,
          frequency: form.frequency,
          filter_experience: form.filter_experience.trim() || null,
        },
        invalidates: ['/api/job-alerts'],
      });
      setSaved(true);
      setConfirmedInline(Boolean(j.confirmed));
      toast?.success?.('Alerts saved');
    } catch (err) {
      setError(err.message || 'Could not save your subscription');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', overflowY: 'auto',
      }}
    >
      <div style={{
        background: 'var(--card)', borderRadius: '.75rem',
        boxShadow: '0 24px 64px rgba(0,0,0,.25)',
        width: '100%', maxWidth: 620, maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '.875rem 1.25rem', borderBottom: '1px solid var(--border)',
          background: 'var(--muted)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', fontWeight: 700 }}>
            <IconBell size="sm" />
            {saved ? 'Alerts saved' : 'Subscribe to job alerts'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <IconX />
          </button>
        </div>

        {saved ? (
          <div style={{ padding: '1.75rem 1.5rem', textAlign: 'center', overflowY: 'auto' }}>
            <div style={{ color: 'oklch(0.52 0.15 145)', marginBottom: '.5rem' }}>
              <IconCheckCircle size="lg" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '.5rem' }}>
              You're subscribed
            </div>
            <p className="muted-text" style={{ fontSize: '.875rem', maxWidth: 440, margin: '0 auto' }}>
              {confirmedInline
                ? "You'll start receiving matching openings by email straight away. Manage your preferences anytime from your dashboard."
                : "We've emailed you a confirmation link. Click it to activate the alerts — this only happens once per email address."}
            </p>
            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: '1.25rem', padding: '.5rem 1.25rem' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.55rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem' }}>
                {error}
              </div>
            )}

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: '.5rem' }}>
                Categories
              </legend>
              {!categories && <div className="muted-text" style={{ fontSize: '.85rem' }}>Loading…</div>}
              {categories && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.5rem' }}>
                  {categories.map((c) => {
                    const on = form.category_ids.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggle('category_ids', c.id)}
                        aria-pressed={on}
                        style={{
                          textAlign: 'left', padding: '.55rem .75rem', borderRadius: '.375rem',
                          border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                          background: on ? 'oklch(0.36 0.13 255 / 0.06)' : 'var(--card)',
                          color: on ? 'var(--primary)' : 'var(--foreground)',
                          fontSize: '.8125rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: '.5rem' }}>
                Posting types
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                {POSTING_TYPES.map((t) => {
                  const on = form.posting_types.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggle('posting_types', t.value)}
                      style={{
                        padding: '.35rem .75rem', borderRadius: '999px',
                        border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                        background: on ? 'oklch(0.36 0.13 255 / 0.08)' : 'var(--card)',
                        color: on ? 'var(--primary)' : 'var(--foreground)',
                        fontSize: '.8125rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: '.5rem' }}>
                How often?
              </legend>
              <div style={{ display: 'grid', gap: '.4rem' }}>
                {FREQUENCY_OPTIONS.map((f) => (
                  <label
                    key={f.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '.6rem',
                      padding: '.55rem .75rem', borderRadius: '.375rem',
                      border: '1px solid ' + (form.frequency === f.value ? 'var(--primary)' : 'var(--border)'),
                      cursor: 'pointer', background: form.frequency === f.value ? 'oklch(0.36 0.13 255 / 0.05)' : 'var(--card)',
                    }}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={f.value}
                      checked={form.frequency === f.value}
                      onChange={() => set('frequency', f.value)}
                      style={{ marginTop: '.15rem' }}
                    />
                    <span>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{f.label}</div>
                      <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.1rem' }}>{f.hint}</div>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <PushEnablePrompt frequency={form.frequency} />

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: '.5rem' }}>
                Optional experience filter
              </legend>
              <input
                placeholder="Experience contains… e.g. Fresher, 2+ years"
                value={form.filter_experience}
                onChange={(e) => set('filter_experience', e.target.value)}
                style={{ width: '100%', padding: '.5rem .65rem', border: '1px solid var(--border)', borderRadius: '.375rem', fontSize: '.8125rem' }}
              />
              <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.3rem' }}>
                Leave blank to receive every matching posting. Case-insensitive substring match against the posting's experience field.
              </div>
            </fieldset>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '.5rem 1rem' }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '.5rem 1.25rem' }}>
                {saving ? 'Saving…' : 'Subscribe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Inline nudge shown inside the subscribe modal — a user asking to be
// alerted is the highest-intent audience for browser push. Only appears
// when push is supported, not already granted, and the user picked the
// "instant" frequency (digests don't benefit from push).
function PushEnablePrompt({ frequency }) {
  const push = usePushSubscription({ enabled: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (frequency !== 'instant') return null;
  if (!push.supported) return null;
  if (push.loading) return null;
  if (push.permission === 'granted' && push.subscribed) return null;

  const enable = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await push.enable();
    } catch (err) {
      setError(err?.message || 'Could not enable push notifications');
    } finally {
      setBusy(false);
    }
  };

  const denied = push.permission === 'denied';

  return (
    <div style={{
      display: 'flex', gap: '.65rem', alignItems: 'flex-start',
      padding: '.7rem .85rem',
      background: 'oklch(0.95 0.04 255)',
      border: '1px solid oklch(0.85 0.05 255)',
      borderRadius: '.4rem',
      fontSize: '.8rem',
    }}>
      <span aria-hidden style={{ fontSize: '1.1rem', lineHeight: 1 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: '.15rem' }}>Get instant push alerts</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>
          {denied
            ? 'Notifications are blocked in your browser. Enable them from the site permissions to get instant push alerts on your desktop and phone.'
            : 'A tap-to-open notification the moment a matching posting is added — before the email lands. Works on your desktop and phone.'}
        </div>
        {error && <div style={{ color: '#991b1b', fontSize: '.72rem', marginTop: '.3rem' }}>{error}</div>}
      </div>
      {!denied && (
        <button type="button" onClick={enable} disabled={busy} className="btn btn-primary" style={{ padding: '.35rem .8rem', fontSize: '.75rem', flexShrink: 0 }}>
          {busy ? 'Enabling…' : 'Enable'}
        </button>
      )}
    </div>
  );
}
