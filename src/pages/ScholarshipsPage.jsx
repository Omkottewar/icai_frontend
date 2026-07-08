import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { useAuth } from '../context/AuthContext';
import { renderMarkdown } from '../lib/markdown.jsx';
import { navigate } from '../hooks/useRoute';
import { cachedGet, apiWrite, invalidate } from '../lib/apiCache';
import { toast } from '../lib/notify';
import Button from '../components/ui/Button';
import { IconArrowRight, IconAward, IconX, IconCalendar } from '../icons';

// Public scholarships listing. Reads from /api/scholarships. Each card
// links to its detail modal; a signed-in student can apply from within
// the modal without leaving the page.

const FMT_INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const FMT_DATE = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
function fmtPaise(paise) {
  if (paise == null) return null;
  return FMT_INR.format(Number(paise) / 100);
}
function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return FMT_DATE.format(d);
}
function isPast(iso) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export default function ScholarshipsPage() {
  const header = useSiteContent('scholarships_page');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [detailSlug, setDetailSlug] = useState(null);

  useEffect(() => {
    // Deep link to a specific scholarship via /scholarships?slug=xyz.
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (slug) setDetailSlug(slug);
  }, []);

  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/scholarships', null, 60_000)
      .then((j) => { if (!cancelled) setItems(j.items || []); })
      .catch((e) => { if (!cancelled) { setError(e); setItems([]); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader
        title={header.title || 'Scholarships'}
        subtitle={header.subtitle || 'Financial support programs for students. Learn more, apply, and track your application.'}
      />

      <section className="container" style={{ padding: '2rem 1rem' }}>
        {items === null ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '2rem' }}>Loading scholarships…</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '3rem 1.5rem' }}>
            <IconAward size="lg" style={{ opacity: .5 }} />
            <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>No scholarships listed right now</h3>
            <p style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
              Check back here — the branch posts new programs each semester. For direct queries, <a href="/contact" style={{ color: 'var(--primary)' }}>contact WICASA</a>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {items.map((s) => {
              const deadlinePassed = isPast(s.deadline_at);
              const closed = !s.applications_open || deadlinePassed;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="card scholarship-card"
                  onClick={() => setDetailSlug(s.slug)}
                  style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  {s.cover_url && (
                    <div style={{ aspectRatio: '16 / 9', background: 'var(--muted)', backgroundImage: `url(${s.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  )}
                  <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <div className="icon-tile green" style={{ width: 32, height: 32 }}><IconAward size="sm" /></div>
                      {fmtPaise(s.award_amount_paise) && (
                        <span className="badge" style={{ background: 'oklch(0.94 0.05 145)', color: 'oklch(0.35 0.14 145)', fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 999, fontWeight: 600 }}>
                          {fmtPaise(s.award_amount_paise)}
                        </span>
                      )}
                      {closed && (
                        <span className="badge" style={{ background: 'oklch(0.94 0 0)', color: 'oklch(0.45 0 0)', fontSize: '.7rem', padding: '.15rem .5rem', borderRadius: 999 }}>
                          {deadlinePassed ? 'Deadline passed' : 'Applications closed'}
                        </span>
                      )}
                    </div>
                    <h3 style={{ marginTop: '.6rem', fontWeight: 600, fontSize: '1.05rem' }}>{s.title}</h3>
                    {s.summary && (
                      <p className="muted-text" style={{ marginTop: '.35rem', fontSize: '.875rem', lineHeight: 1.5 }}>{s.summary}</p>
                    )}
                    <div className="row gap-2" style={{ marginTop: 'auto', paddingTop: '.75rem', fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                      Details <IconArrowRight size="sm" />
                    </div>
                    {s.deadline_at && !deadlinePassed && (
                      <div className="muted-text row gap-1" style={{ fontSize: '.7rem', marginTop: '.35rem' }}>
                        <IconCalendar size="sm" /> Apply by {fmtDate(s.deadline_at)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginTop: '1rem' }}>
            {error.message || 'Could not load scholarships.'}
          </div>
        )}
      </section>

      {detailSlug && (
        <ScholarshipDetailDrawer
          slug={detailSlug}
          onClose={() => setDetailSlug(null)}
        />
      )}

      <style>{`
        .scholarship-card { transition: transform .12s, box-shadow .12s; }
        .scholarship-card:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.08); }
        .scholarship-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      `}</style>
    </>
  );
}

// ─── Scholarship detail drawer ────────────────────────────────────────────
function ScholarshipDetailDrawer({ slug, onClose }) {
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    cachedGet(`/api/scholarships/${slug}`, null, 30_000)
      .then((j) => { if (!cancelled) setItem(j.item); })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const deadlinePassed = isPast(item?.deadline_at);
  const applyDisabled = !item || !item.applications_open || deadlinePassed || item.external_url;

  function handleApply() {
    if (!item) return;
    if (!user) {
      navigate(`/login?next=/scholarships?slug=${encodeURIComponent(slug)}`);
      return;
    }
    if (user.primary_role !== 'student') {
      toast.warning('Scholarships are for students. If you\'re a member acting on behalf of a student, please contact WICASA.');
      return;
    }
    if (item.external_url) {
      window.open(item.external_url, '_blank', 'noopener,noreferrer');
      return;
    }
    setApplying(true);
  }

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(38rem, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">{item?.title || 'Loading…'}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto' }}>
          {error && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{error.message}</p>}
          {!item ? (
            <p className="muted-text" style={{ fontSize: '.875rem' }}>Loading…</p>
          ) : (
            <>
              {item.cover_url && (
                <div style={{ aspectRatio: '16 / 9', background: 'var(--muted)', backgroundImage: `url(${item.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '.5rem', marginBottom: '1rem' }} />
              )}
              <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: '.75rem' }}>
                {fmtPaise(item.award_amount_paise) && (
                  <span className="badge" style={{ background: 'oklch(0.94 0.05 145)', color: 'oklch(0.35 0.14 145)', fontSize: '.75rem', padding: '.2rem .55rem', borderRadius: 999, fontWeight: 600 }}>
                    Award: {fmtPaise(item.award_amount_paise)}
                  </span>
                )}
                {item.deadline_at && (
                  <span className="badge" style={{ background: 'oklch(0.94 0.05 60)', color: 'oklch(0.35 0.15 60)', fontSize: '.75rem', padding: '.2rem .55rem', borderRadius: 999, fontWeight: 600 }}>
                    {deadlinePassed ? 'Closed' : 'Deadline'}: {fmtDate(item.deadline_at)}
                  </span>
                )}
              </div>

              {item.summary && (
                <p style={{ fontSize: '.9375rem', lineHeight: 1.55 }}>{item.summary}</p>
              )}

              <div style={{ marginTop: '1rem', fontSize: '.875rem', lineHeight: 1.6 }}>
                {renderMarkdown(item.description)}
              </div>

              {item.eligibility && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '.8125rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)', fontWeight: 700 }}>Eligibility</h3>
                  <div style={{ marginTop: '.4rem', fontSize: '.875rem', lineHeight: 1.55 }}>
                    {renderMarkdown(item.eligibility)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {item && (
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
            {item.external_url ? (
              <a
                href={item.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >Apply on external site</a>
            ) : (
              <Button
                type="button"
                className="btn btn-primary"
                onClick={handleApply}
                disabled={!item.applications_open || deadlinePassed}
              >
                {deadlinePassed
                  ? 'Deadline passed'
                  : (!item.applications_open ? 'Applications closed' : 'Apply now')}
              </Button>
            )}
          </div>
        )}
      </div>

      {applying && item && (
        <ApplyModal
          scholarshipId={item.id}
          scholarshipTitle={item.title}
          onClose={() => setApplying(false)}
          onSubmitted={() => { setApplying(false); onClose?.(); }}
        />
      )}
    </div>
  );
}

// ─── Apply modal — full rich application ──────────────────────────────────
//
// Committees at ICAI Nagpur decide scholarships offline, so this form is
// intentionally comprehensive: academic details, family + financial context,
// category, statement, and supporting documents (mark sheet / income proof /
// other) all in one submission.
//
// Sections are visually grouped rather than wizard-paged so the student can
// scroll back and forth without losing progress. Only the declaration
// checkbox and "Why applying" are hard-required at the DB layer; everything
// else is strongly recommended, and empty fields just leave a blank in the
// committee's spreadsheet.

const CA_LEVELS = [
  { value: '',             label: 'Select…' },
  { value: 'foundation',   label: 'CA Foundation' },
  { value: 'intermediate', label: 'CA Intermediate' },
  { value: 'final',        label: 'CA Final' },
];
const EXAM_GROUPS = [
  { value: '',        label: 'Not attempted yet' },
  { value: 'group_1', label: 'Group I' },
  { value: 'group_2', label: 'Group II' },
  { value: 'both',    label: 'Both groups' },
];
const INCOME_BUCKETS = [
  { value: '',         label: 'Prefer not to say' },
  { value: '<2L',      label: 'Less than ₹2 lakh' },
  { value: '2-5L',     label: '₹2 – 5 lakh' },
  { value: '5-10L',    label: '₹5 – 10 lakh' },
  { value: '10L+',     label: 'More than ₹10 lakh' },
];
const CATEGORY_OPTIONS = [
  { value: '',         label: 'Prefer not to say' },
  { value: 'general',  label: 'General' },
  { value: 'obc',      label: 'OBC' },
  { value: 'sc',       label: 'SC' },
  { value: 'st',       label: 'ST' },
  { value: 'other',    label: 'Other' },
];

// Section wrapper — a lightly-tinted card with a small eyebrow label above
// each block. Purely visual, but breaks the ~20-field form into 5 mental
// chunks the student can attack one at a time.
function Section({ title, children, note }) {
  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: '.5rem', padding: '.85rem 1rem 1rem', margin: '0 0 .85rem', background: 'oklch(0.995 0 0)' }}>
      <legend style={{ padding: '0 .35rem', fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--muted-foreground)' }}>{title}</legend>
      {note && <p className="muted-text" style={{ fontSize: '.7rem', marginTop: 0, marginBottom: '.5rem' }}>{note}</p>}
      {children}
    </fieldset>
  );
}

function Row({ children, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gap: '.6rem', gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 3 ? '140px' : '180px'}, 1fr))`, marginTop: '.55rem' }}>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, disabled, placeholder, type = 'text', hint, required = false, max = 200 }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
        {label}{required ? ' *' : <span className="muted-text" style={{ fontWeight: 400 }}> (optional)</span>}
      </div>
      <input
        type={type}
        className="input-base"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
      />
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>{hint}</div>}
    </label>
  );
}

function SelectInput({ label, value, onChange, disabled, options, required = false, hint }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>
        {label}{required ? ' *' : ''}
      </div>
      <select
        className="input-base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>{hint}</div>}
    </label>
  );
}

function TextArea({ label, value, onChange, disabled, placeholder, rows = 3, required = false, max = 2000 }) {
  const remaining = max - (value?.length ?? 0);
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.25rem' }}>
        <span style={{ fontSize: '.8125rem', fontWeight: 600 }}>{label}{required ? ' *' : <span className="muted-text" style={{ fontWeight: 400 }}> (optional)</span>}</span>
        <span style={{ fontSize: '.7rem', color: remaining < 40 ? 'oklch(0.55 0.15 60)' : 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
          {remaining} left
        </span>
      </div>
      <textarea
        className="input-base"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        style={{ resize: 'vertical' }}
      />
    </label>
  );
}

// ─── Document uploader ─────────────────────────────────────────────────────
// Named slots keep the committee's spreadsheet coherent (they always know
// which file is which). Three slots is our whitelist: marksheet, income
// proof, and one free "other" slot. Each posts to /api/scholarships/uploads
// and stores the returned file ID on the parent form's state.
const DOC_SLOTS = [
  { key: 'marksheet',   label: 'Most recent marksheet / result',
    hint: 'PDF or JPG/PNG. If you have multiple pages, please combine into a single PDF.' },
  { key: 'income_proof', label: 'Income proof',
    hint: 'Salary slip, IT return acknowledgement, or Talathi/Tehsildar income certificate. PDF preferred.' },
  { key: 'other',        label: 'Any other supporting document',
    hint: 'Recommendation letter, articleship completion certificate, etc.' },
];

function DocumentUploader({ docs, onChange, disabled }) {
  const [uploading, setUploading] = useState(null); // slot key currently uploading
  const [error, setError] = useState('');

  async function uploadOne(slotKey, file) {
    if (!file) return;
    setError('');
    if (file.size > 8 * 1024 * 1024) {
      setError('File is larger than 8 MB. Compress or split into pages.');
      return;
    }
    const okMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!okMime) {
      setError('Please upload a PDF or an image (JPEG / PNG / WebP).');
      return;
    }
    setUploading(slotKey);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const resp = await apiWrite('/api/scholarships/uploads', {
        method: 'POST',
        body: { name: file.name, mime_type: file.type, data_base64: dataUrl },
      });
      onChange({ ...docs, [slotKey]: { id: resp.id, name: resp.name, url: resp.url, mime_type: resp.mime_type } });
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  }

  function removeSlot(slotKey) {
    // We don't hard-delete from storage — the file will be garbage-collected
    // if it's never attached to a submitted application. Simpler + safer than
    // a mid-form delete.
    const next = { ...docs };
    delete next[slotKey];
    onChange(next);
  }

  return (
    <div style={{ display: 'grid', gap: '.5rem' }}>
      {DOC_SLOTS.map((slot) => {
        const doc = docs[slot.key];
        const isBusy = uploading === slot.key;
        return (
          <div key={slot.key} style={{ border: '1px dashed var(--border)', borderRadius: '.5rem', padding: '.65rem .8rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '.75rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{slot.label}</div>
                <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.1rem' }}>{slot.hint}</div>
                {doc && (
                  <div className="row gap-2" style={{ marginTop: '.35rem', fontSize: '.75rem', color: 'var(--primary)' }}>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</a>
                    <span className="muted-text">· uploaded</span>
                  </div>
                )}
              </div>
              <div className="row gap-1" style={{ flexShrink: 0 }}>
                {doc ? (
                  <>
                    <label className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.35rem .6rem', cursor: 'pointer', margin: 0 }}>
                      Replace
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => uploadOne(slot.key, e.target.files?.[0])}
                        disabled={disabled || isBusy}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '.75rem', padding: '.35rem .6rem', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}
                      onClick={() => removeSlot(slot.key)}
                      disabled={disabled || isBusy}
                    >Remove</button>
                  </>
                ) : (
                  <label className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.35rem .6rem', cursor: 'pointer', margin: 0 }}>
                    {isBusy ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => uploadOne(slot.key, e.target.files?.[0])}
                      disabled={disabled || isBusy}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {error && <div style={{ color: 'var(--destructive)', fontSize: '.75rem', marginTop: '.25rem' }}>{error}</div>}
      <p className="muted-text" style={{ fontSize: '.7rem', margin: 0 }}>Max 8 MB per file. PDF, JPEG, PNG, and WebP accepted.</p>
    </div>
  );
}

function ApplyModal({ scholarshipId, scholarshipTitle, onClose, onSubmitted }) {
  // Structured detail state — grouped into blocks that mirror the sections
  // below so `submit()` can just spread them into `details`.
  const [academic, setAcademic] = useState({
    ca_level: '', srn: '', exam_group: '', exam_result: '',
    coaching_institute: '',
    twelfth_board: '', twelfth_percentage: '',
    graduation_details: '',
  });
  const [family, setFamily] = useState({
    father_name: '', father_occupation: '',
    mother_name: '', mother_occupation: '',
    annual_family_income_bucket: '',
    num_dependents: '', siblings_education: '',
    category: '',
  });
  const [otherSupport, setOtherSupport] = useState({
    other_scholarships_receiving: false,
    other_scholarships_details: '',
  });
  const [whyApplying, setWhy] = useState('');
  const [current, setCurrent] = useState('');
  const [phone, setPhone] = useState('');
  const [docs, setDocs] = useState({});   // { marksheet: {id,url,name,mime}, … }
  const [declaration, setDeclaration] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patchAcademic = (k, v) => setAcademic((s) => ({ ...s, [k]: v }));
  const patchFamily = (k, v) => setFamily((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const w = whyApplying.trim();
    if (!w) { toast.warning("Please tell us why you're applying."); return; }
    if (!declaration) { toast.warning('Please accept the declaration before submitting.'); return; }
    setBusy(true);
    try {
      await apiWrite(`/api/scholarships/${scholarshipId}/apply`, {
        method: 'POST',
        body: {
          why_applying: w,
          current_situation: current.trim(),
          contact_phone: phone.trim(),
          details: {
            ...academic,
            ...family,
            other_scholarships_receiving: otherSupport.other_scholarships_receiving,
            other_scholarships_details: otherSupport.other_scholarships_details.trim(),
            declaration_accepted: true,
            photo_consent: photoConsent,
          },
          document_file_ids: Object.values(docs).map((d) => d.id).filter(Boolean),
        },
      });
      invalidate('/api/scholarships/applications/my');
      toast.success('Application submitted. The committee will review offline.');
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
      <div className="dialog-shell" role="dialog" aria-modal="true"
           style={{ width: 'min(48rem, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">Apply · {scholarshipTitle}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="dialog-body" style={{ overflowY: 'auto' }}>
            <p className="muted-text" style={{ fontSize: '.8125rem', margin: '0 0 .75rem' }}>
              The committee reviews scholarships offline — the more you share here, the fewer follow-ups they'll need.
              Only the fields marked <strong>*</strong> are mandatory. You can only apply once per scholarship.
            </p>

            <Section title="Statement">
              <TextArea
                label="Why are you applying?"
                value={whyApplying}
                onChange={setWhy}
                disabled={busy}
                placeholder="Tell the committee about your goals, why this scholarship matters to you, and how you would use the support."
                rows={5}
                required
                max={4000}
              />
              <div style={{ marginTop: '.55rem' }}>
                <TextArea
                  label="Your current situation"
                  value={current}
                  onChange={setCurrent}
                  disabled={busy}
                  placeholder="e.g. CA Final Group 2 candidate, articleship at a small firm in Dhantoli, currently supporting a younger sibling's education."
                  rows={3}
                  max={4000}
                />
              </div>
            </Section>

            <Section title="Academic details" note="Helps the committee gauge merit + progress.">
              <Row>
                <SelectInput label="Current CA level" value={academic.ca_level} onChange={(v) => patchAcademic('ca_level', v)} disabled={busy} options={CA_LEVELS} />
                <TextInput   label="Student Registration Number (SRN)" value={academic.srn} onChange={(v) => patchAcademic('srn', v)} disabled={busy} placeholder="e.g. SRO0567890" max={40} />
              </Row>
              <Row>
                <SelectInput label="Last exam group attempted" value={academic.exam_group} onChange={(v) => patchAcademic('exam_group', v)} disabled={busy} options={EXAM_GROUPS} />
                <TextInput   label="Result" value={academic.exam_result} onChange={(v) => patchAcademic('exam_result', v)} disabled={busy} placeholder="e.g. Passed with 62% · Rank 12" max={200} />
              </Row>
              <div style={{ marginTop: '.55rem' }}>
                <TextInput label="Coaching institute (if any)" value={academic.coaching_institute} onChange={(v) => patchAcademic('coaching_institute', v)} disabled={busy} placeholder="e.g. Aldine Ventures Nagpur, or self-study" max={120} />
              </div>
              <Row>
                <TextInput label="12th standard board" value={academic.twelfth_board} onChange={(v) => patchAcademic('twelfth_board', v)} disabled={busy} placeholder="e.g. CBSE / MSBSHSE" max={60} />
                <TextInput label="12th percentage" value={academic.twelfth_percentage} onChange={(v) => patchAcademic('twelfth_percentage', v)} disabled={busy} placeholder="e.g. 84.6" max={10} />
              </Row>
              <div style={{ marginTop: '.55rem' }}>
                <TextInput label="Graduation (if completed)" value={academic.graduation_details} onChange={(v) => patchAcademic('graduation_details', v)} disabled={busy} placeholder="e.g. B.Com from Nagpur University, 74%" max={200} />
              </div>
            </Section>

            <Section title="Family + financial background" note="Optional — but scholarships based on financial need rely on this. All fields are confidential and shown only to the WICASA scholarship committee.">
              <Row>
                <TextInput label="Father's name" value={family.father_name} onChange={(v) => patchFamily('father_name', v)} disabled={busy} placeholder="e.g. Sh. Rajesh Kottewar" max={100} />
                <TextInput label="Father's occupation" value={family.father_occupation} onChange={(v) => patchFamily('father_occupation', v)} disabled={busy} placeholder="e.g. Small business owner" max={120} />
              </Row>
              <Row>
                <TextInput label="Mother's name" value={family.mother_name} onChange={(v) => patchFamily('mother_name', v)} disabled={busy} placeholder="e.g. Smt. Sushma Kottewar" max={100} />
                <TextInput label="Mother's occupation" value={family.mother_occupation} onChange={(v) => patchFamily('mother_occupation', v)} disabled={busy} placeholder="e.g. Homemaker / Teacher" max={120} />
              </Row>
              <Row>
                <SelectInput label="Annual family income" value={family.annual_family_income_bucket} onChange={(v) => patchFamily('annual_family_income_bucket', v)} disabled={busy} options={INCOME_BUCKETS} hint="Ranges only — a receipt/proof will be reviewed offline." />
                <TextInput label="Number of dependents" type="number" value={family.num_dependents} onChange={(v) => patchFamily('num_dependents', v)} disabled={busy} placeholder="e.g. 3" max={4} />
              </Row>
              <div style={{ marginTop: '.55rem' }}>
                <TextArea
                  label="Siblings' education"
                  value={family.siblings_education}
                  onChange={(v) => patchFamily('siblings_education', v)}
                  disabled={busy}
                  placeholder="e.g. One younger brother in Class 10, one elder sister completing MBBS."
                  rows={2}
                  max={1000}
                />
              </div>
              <div style={{ marginTop: '.55rem' }}>
                <SelectInput label="Category" value={family.category} onChange={(v) => patchFamily('category', v)} disabled={busy} options={CATEGORY_OPTIONS} hint="Needed for reservation-linked schemes." />
              </div>
            </Section>

            <Section title="Other scholarships">
              <label className="row gap-2" style={{ fontSize: '.875rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={otherSupport.other_scholarships_receiving}
                  onChange={(e) => setOtherSupport((s) => ({ ...s, other_scholarships_receiving: e.target.checked }))}
                  disabled={busy}
                />
                I am currently receiving another scholarship or financial aid.
              </label>
              {otherSupport.other_scholarships_receiving && (
                <div style={{ marginTop: '.55rem' }}>
                  <TextArea
                    label="Which one(s)?"
                    value={otherSupport.other_scholarships_details}
                    onChange={(v) => setOtherSupport((s) => ({ ...s, other_scholarships_details: v }))}
                    disabled={busy}
                    placeholder="e.g. State merit scholarship ₹5,000/year"
                    rows={2}
                    max={1000}
                  />
                </div>
              )}
            </Section>

            <Section title="Contact + documents">
              <TextInput
                label="Contact phone"
                value={phone}
                onChange={setPhone}
                disabled={busy}
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                max={20}
                hint="The committee may call for a quick verification. Optional but strongly recommended."
              />
              <div style={{ marginTop: '.7rem' }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.35rem' }}>
                  Supporting documents <span className="muted-text" style={{ fontWeight: 400 }}>(recommended)</span>
                </div>
                <DocumentUploader docs={docs} onChange={setDocs} disabled={busy} />
              </div>
            </Section>

            <Section title="Declaration">
              <label className="row gap-2" style={{ fontSize: '.8125rem', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                  disabled={busy}
                  style={{ marginTop: '.25rem' }}
                />
                <span>
                  <strong>I confirm</strong> that the information above is true to the best of my knowledge, and I understand that any material misrepresentation may disqualify me from this and future scholarship rounds. *
                </span>
              </label>
              <label className="row gap-2" style={{ fontSize: '.8125rem', alignItems: 'flex-start', marginTop: '.5rem' }}>
                <input
                  type="checkbox"
                  checked={photoConsent}
                  onChange={(e) => setPhotoConsent(e.target.checked)}
                  disabled={busy}
                  style={{ marginTop: '.25rem' }}
                />
                <span>
                  If I am awarded, I consent to my name and photo being featured on the branch's public "past awardees" list.
                </span>
              </label>
            </Section>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <Button
              type="submit"
              className="btn btn-primary"
              loading={busy}
              disabled={!whyApplying.trim() || !declaration}
            >
              {busy ? 'Submitting…' : 'Submit application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
