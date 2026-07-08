import { useEffect, useState } from 'react';
import { IconX } from '../../icons';
import { apiWrite, invalidate } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import Button from '../ui/Button';

// Articleship matchmaking preferences form (Section N.9). WICASA reviews
// submissions and returns recommended firms.
//
// We keep the form to specialisation checkboxes + location + firm-size +
// stipend. CV upload is deferred to a follow-up (backend accepts cv_file_id
// but the upload flow needs the files router glue that's not shipped for
// student-scoped uploads yet).

const SPECIALISATIONS = [
  'Audit', 'Direct Tax', 'Indirect Tax (GST)',
  'Company Law', 'Statutory Audit', 'Internal Audit',
  'Corporate Finance', 'Forensic Audit', 'Management Consulting',
  'International Taxation', 'Insolvency & Bankruptcy',
];
const FIRM_SIZES = [
  { value: 'sole_practitioner', label: 'Sole practitioner' },
  { value: 'small',             label: 'Small firm (2–10 CAs)' },
  { value: 'medium',            label: 'Mid-size firm (10–50 CAs)' },
  { value: 'large',             label: 'Large firm (50+ CAs)' },
  { value: 'big4',              label: 'Big 4' },
];

export default function RequestArticleshipModal({ onClose, onSubmitted }) {
  const [selected, setSelected] = useState(new Set());
  const [location, setLocation] = useState('');
  const [firmSize, setFirmSize] = useState('');
  const [stipend,  setStipend]  = useState('');
  const [notes,    setNotes]    = useState('');
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleSpec(s) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (selected.size === 0) { toast.warning('Pick at least one area you want articleship experience in.'); return; }
    setBusy(true);
    try {
      // Stipend is captured in rupees on the form for readability, then
      // converted to paise for the DB (all money on the server is paise).
      const stipendPaise = stipend.trim()
        ? Math.round(Number(stipend) * 100)
        : null;
      await apiWrite('/api/articleship-matches', {
        method: 'POST',
        body: {
          preferred_specialisations: Array.from(selected),
          preferred_location: location.trim(),
          preferred_firm_size: firmSize || null,
          expected_stipend_paise: stipendPaise,
          notes: notes.trim(),
        },
      });
      invalidate('/api/articleship-matches/my');
      toast.success('Articleship preferences submitted. WICASA will share recommendations soon.');
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
      <div className="dialog-shell" role="dialog" aria-modal="true" aria-labelledby="articleship-title"
           style={{ width: 'min(34rem, 100%)' }}>
        <div className="dialog-header">
          <h2 id="articleship-title" className="dialog-title">Articleship preferences</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <form onSubmit={submit}>
          <div className="dialog-body">
            <p className="dialog-text" style={{ fontSize: '.875rem' }}>
              Tell us what you're looking for in your articleship. WICASA reviews these and shares
              matched firms from the branch's employer network.
            </p>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.4rem' }}>
                Areas of interest <span className="muted-text" style={{ fontWeight: 400 }}>(pick 1+)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                {SPECIALISATIONS.map((s) => {
                  const on = selected.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpec(s)}
                      disabled={busy}
                      className={'spec-pill' + (on ? ' is-on' : '')}
                    >{s}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: '.875rem' }}>
              <label>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Preferred location</div>
                <input
                  type="text"
                  className="input-base"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.slice(0, 120))}
                  placeholder="e.g. Nagpur / Mumbai"
                  disabled={busy}
                />
              </label>

              <label>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Firm size</div>
                <select
                  className="input-base"
                  value={firmSize}
                  onChange={(e) => setFirmSize(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Any</option>
                  {FIRM_SIZES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
                  Expected stipend <span className="muted-text" style={{ fontWeight: 400 }}>(₹, optional)</span>
                </div>
                <input
                  type="number"
                  min="0"
                  className="input-base"
                  value={stipend}
                  onChange={(e) => setStipend(e.target.value)}
                  placeholder="e.g. 8000"
                  disabled={busy}
                />
              </label>
            </div>

            <label style={{ display: 'block', marginTop: '.875rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
                Anything else? <span className="muted-text" style={{ fontWeight: 400 }}>(optional)</span>
              </div>
              <textarea
                className="input-base"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                placeholder="Link to your CV, other constraints, availability window, etc."
                disabled={busy}
                style={{ resize: 'vertical' }}
              />
            </label>

            <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.75rem' }}>
              Limit: 2 submissions per hour. Update the same submission via the branch WICASA desk if your preferences change.
            </p>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <Button
              type="submit"
              className="btn btn-primary"
              loading={busy}
              disabled={selected.size === 0}
            >
              {busy ? 'Submitting…' : 'Submit preferences'}
            </Button>
          </div>
        </form>

        <style>{`
          .spec-pill {
            border: 1px solid var(--border);
            background: white;
            color: var(--foreground);
            padding: .3rem .7rem;
            border-radius: 999px;
            font-size: .8125rem;
            cursor: pointer;
            transition: background .12s, border-color .12s, color .12s;
          }
          .spec-pill:hover { background: var(--muted); }
          .spec-pill.is-on {
            background: var(--primary);
            border-color: var(--primary);
            color: white;
          }
          .spec-pill:disabled { opacity: .5; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
