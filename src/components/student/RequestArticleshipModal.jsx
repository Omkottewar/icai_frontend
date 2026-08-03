import { useEffect, useState } from 'react';
import { IconX } from '../../icons';
import { apiWrite, invalidate } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import Button from '../ui/Button';

// Articleship matchmaking preferences form (Section N.9). WICASA reviews
// submissions and returns recommended firms.
//
// Fields: specialisation checkboxes + firm-size + stipend + CV. All postings
// are Nagpur-branch scoped, so we don't ask the student for a location.
// CV is a student-scoped PDF upload (max 5 MB) — the id is attached to the
// submission so WICASA can download it from the admin view.

const CV_MAX_BYTES = 5 * 1024 * 1024;

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

export default function RequestArticleshipModal({ onClose, onSubmitted, initial = null }) {
  // When `initial` is a previous submission (from GET /api/articleship-matches/my),
  // the modal opens in "update" mode with every field pre-filled — the student
  // edits rather than re-enters from scratch. The CV is treated as attached
  // if the previous submission had one; the student can Remove + re-upload.
  const isUpdate = !!initial;

  const initialSpecs = Array.isArray(initial?.preferred_specialisations)
    ? initial.preferred_specialisations
    : [];
  const initialStipendRupees = initial?.expected_stipend_paise != null
    ? String(Math.round(Number(initial.expected_stipend_paise) / 100))
    : '';

  const [selected, setSelected] = useState(new Set(initialSpecs));
  const [firmSize, setFirmSize] = useState(initial?.preferred_firm_size || '');
  const [stipend,  setStipend]  = useState(initialStipendRupees);
  const [notes,    setNotes]    = useState(initial?.notes || '');
  const [busy,     setBusy]     = useState(false);
  const [cvFileId,   setCvFileId]   = useState(initial?.cv_file_id || '');
  const [cvName,     setCvName]     = useState(initial?.cv_file_name || (initial?.cv_file_id ? 'Attached CV' : ''));
  const [cvSize,     setCvSize]     = useState(initial?.cv_file_size || 0);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvError,    setCvError]    = useState('');

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

  async function handleCvFile(file) {
    setCvError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setCvError('Only PDF files are accepted.');
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      setCvError(`PDF is too big (max ${Math.round(CV_MAX_BYTES / (1024 * 1024))} MB).`);
      return;
    }
    setCvUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error('Could not read the file'));
        fr.readAsDataURL(file);
      });
      const data_base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      const r = await fetch('/api/articleship-matches/upload-cv', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mime_type: 'application/pdf',
          data_base64,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      setCvFileId(j.id);
      setCvName(file.name);
      setCvSize(file.size);
    } catch (err) {
      setCvError(err.message || 'Upload failed');
    } finally {
      setCvUploading(false);
    }
  }

  function clearCv() {
    setCvFileId('');
    setCvName('');
    setCvSize(0);
    setCvError('');
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
          preferred_location: 'Nagpur',
          preferred_firm_size: firmSize || null,
          expected_stipend_paise: stipendPaise,
          cv_file_id: cvFileId || null,
          notes: notes.trim(),
        },
      });
      invalidate('/api/articleship-matches/my');
      toast.success(isUpdate
        ? 'Articleship preferences updated. WICASA will use the latest details.'
        : 'Articleship preferences submitted. WICASA will share recommendations soon.');
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
          <h2 id="articleship-title" className="dialog-title">
            {isUpdate ? 'Update articleship preferences' : 'Articleship preferences'}
          </h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
          <div className="dialog-body">
            <p className="dialog-text" style={{ fontSize: '.875rem' }}>
              {isUpdate
                ? "We've loaded your last submission. Edit anything that's changed and re-submit — WICASA will use the latest details when they match you to firms."
                : "Tell us what you're looking for in your articleship. WICASA reviews these and shares matched firms from the branch's employer network."}
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

            <div style={{ marginTop: '.875rem' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
                CV / Résumé <span className="muted-text" style={{ fontWeight: 400 }}>(PDF, max 5 MB — optional)</span>
              </div>
              {cvFileId && cvName ? (
                <div className="art-cv-done">
                  <span aria-hidden style={{ fontSize: '1.35rem', lineHeight: 1 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#065f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cvName}</div>
                    <div className="muted-text" style={{ fontSize: '.7rem' }}>
                      {(cvSize / (1024 * 1024)).toFixed(2)} MB · uploaded ✓
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCv}
                    disabled={busy || cvUploading}
                    className="art-cv-remove"
                  >Remove</button>
                </div>
              ) : (
                <>
                  <label className={'art-cv-drop' + (cvUploading ? ' is-busy' : '')}>
                    {cvUploading ? (
                      <>
                        <span className="art-cv-spinner" />
                        <strong>Uploading…</strong>
                      </>
                    ) : (
                      <>
                        <span aria-hidden style={{ fontSize: '1.6rem', lineHeight: 1 }}>📄</span>
                        <strong>Click to attach your CV (PDF)</strong>
                        <span className="muted-text" style={{ fontSize: '.7rem' }}>Max 5 MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      style={{ display: 'none' }}
                      disabled={busy || cvUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCvFile(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {cvError && <div className="art-cv-err">{cvError}</div>}
                </>
              )}
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
                placeholder="Other constraints, availability window, etc."
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
              {busy
                ? (isUpdate ? 'Updating…' : 'Submitting…')
                : (isUpdate ? 'Update preferences' : 'Submit preferences')}
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

          .art-cv-drop {
            display: flex; flex-direction: column; align-items: center; gap: .35rem;
            padding: 1.1rem 1rem; text-align: center;
            border: 2px dashed var(--border); border-radius: .5rem;
            background: var(--card); cursor: pointer;
            transition: border-color .12s, background .12s;
          }
          .art-cv-drop:hover { border-color: var(--primary); background: rgba(37, 99, 235, .04); }
          .art-cv-drop.is-busy { cursor: wait; opacity: .85; }
          .art-cv-drop strong { font-size: .85rem; }
          .art-cv-spinner {
            width: 1.4rem; height: 1.4rem;
            border: 2px solid rgba(30, 64, 175, .15);
            border-top-color: var(--primary, #1e40af);
            border-radius: 50%;
            animation: art-cv-spin .8s linear infinite;
          }
          @keyframes art-cv-spin { to { transform: rotate(360deg); } }
          .art-cv-done {
            display: flex; align-items: center; gap: .65rem;
            padding: .65rem .8rem;
            background: #ecfdf5; border: 1px solid #6ee7b7;
            border-radius: .5rem;
          }
          .art-cv-remove {
            background: transparent; border: 1px solid #6ee7b7; color: #065f46;
            border-radius: .35rem; padding: .25rem .6rem;
            font: inherit; font-size: .72rem; font-weight: 600;
            cursor: pointer;
          }
          .art-cv-remove:hover:not(:disabled) { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
          .art-cv-remove:disabled { opacity: .5; cursor: not-allowed; }
          .art-cv-err {
            margin-top: .35rem; padding: .4rem .55rem;
            background: #fee2e2; color: #991b1b;
            border-radius: .35rem;
            font-size: .75rem;
          }
        `}</style>
      </div>
    </div>
  );
}
