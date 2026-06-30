import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { cachedGet } from '../lib/apiCache';
import { IconMapPin, IconCalendar, IconMail, IconBriefcase, IconX, IconGraduationCap } from '../icons';

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function orgName(v) {
  return v.firm_name || v.employer_name || 'ICAI Nagpur';
}

function usePostings(type) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    // 60s TTL — postings change at most a few times per day; this makes
    // toggling between Jobs / Articleships tabs feel instant.
    cachedGet(`/api/jobs?type=${type}`, undefined, 60_000)
      .then((data) => { if (!cancelled) setRows(data.rows); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type]);

  return { rows, loading, error };
}

// Three modes the page can show — picked via ?type= query string. Each
// resolves the page header copy from site-content with a per-type fallback,
// so editors can override individual strings via /admin/site-content
// without changing the URL contract. New `assignment` mode surfaces
// short-term / freelance engagements for Members.
const MODE_CONFIG = {
  job: {
    type: 'job',
    eyebrow: 'For CA Members',
    defaultHeading: 'Member Job Vacancies',
    defaultLead: 'Positions in industry, corporates and practice firms seeking qualified Chartered Accountants.',
    defaultEmpty: 'No job vacancies at the moment. Check back soon.',
    headerKey: { title: 'job_title', subtitle: 'job_subtitle' },
  },
  articleship: {
    type: 'articleship',
    eyebrow: 'For CA Students',
    defaultHeading: 'Articleship Vacancies',
    defaultLead: 'Member firms in Nagpur seeking articles for practical training.',
    defaultEmpty: 'No articleship vacancies at the moment. Check back soon.',
    headerKey: { title: 'articleship_title', subtitle: 'articleship_subtitle' },
  },
  assignment: {
    type: 'assignment',
    eyebrow: 'For CA Members',
    defaultHeading: 'Assignment Openings',
    defaultLead: 'Short-term and freelance engagements — audit assistance, due-diligence, GST/tax projects and other consulting work picked up by firms looking for member support.',
    defaultEmpty: 'No assignment openings at the moment. Check back soon.',
    headerKey: { title: 'assignment_title', subtitle: 'assignment_subtitle' },
  },
};

export default function JobVacanciesPage() {
  const route = useRoute();
  const header = useSiteContent('job_vacancies_page_header');
  const mode = MODE_CONFIG[route.query.type] ?? MODE_CONFIG.job;
  const { rows, loading, error } = usePostings(mode.type);
  const [enquiryTarget, setEnquiryTarget] = useState(null);

  const notice = (
    <div style={{
      background: 'oklch(0.36 0.13 255 / 0.06)',
      border: '1px solid oklch(0.36 0.13 255 / 0.15)',
      borderRadius: '.5rem',
      padding: '.875rem 1rem',
      marginBottom: '2rem',
      fontSize: '.8125rem',
      color: 'var(--foreground)',
    }}>
      {renderMarkdown(header.notice)}
    </div>
  );

  return (
    <>
      <PageHeader
        title={header[mode.headerKey.title] || mode.defaultHeading}
        subtitle={header[mode.headerKey.subtitle] || mode.defaultLead}
      />
      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        {notice}

        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">{mode.eyebrow}</div>
          <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, lineHeight: 1.2 }}>
            {mode.defaultHeading}
          </h2>
          <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
            {mode.defaultLead}
          </p>
        </div>

        {loading && <LoadingGrid count={3} />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && rows?.length === 0 && (
          <EmptyState message={mode.defaultEmpty} />
        )}
        {!loading && !error && rows?.length > 0 && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {rows.map((v) => (
              <PostingCard
                key={v.id}
                posting={v}
                mode={mode}
                onEnquire={() => setEnquiryTarget(v)}
              />
            ))}
          </div>
        )}
      </section>

      {enquiryTarget && (
        <EnquiryModal posting={enquiryTarget} onClose={() => setEnquiryTarget(null)} />
      )}
    </>
  );
}

function PostingCard({ posting: v, mode, onEnquire }) {
  const isArticleship = mode.type === 'articleship';
  const isAssignment  = mode.type === 'assignment';
  const ctaLabel = isArticleship ? 'Apply' : isAssignment ? 'Express interest' : 'Enquire';
  const seatLine = isArticleship
    ? <><IconGraduationCap size="sm" /> {v.seat_count} seat{v.seat_count !== 1 ? 's' : ''} available</>
    : isAssignment
      ? <><IconBriefcase size="sm" /> {v.seat_count} opening{v.seat_count !== 1 ? 's' : ''}</>
      : <><IconBriefcase size="sm" /> {v.seat_count} position{v.seat_count !== 1 ? 's' : ''}</>;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {/* Org name */}
          <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '.25rem' }}>
            {orgName(v)}
          </div>
          {/* Title */}
          <h3 style={{ fontWeight: 700, fontSize: '1.0625rem', margin: 0 }}>{v.title}</h3>
          {/* Meta chips */}
          <div className="row gap-3" style={{ marginTop: '.625rem', flexWrap: 'wrap' }}>
            {isAssignment && (
              <span style={{
                padding: '.15rem .5rem', borderRadius: '.25rem',
                fontSize: '.7rem', fontWeight: 700,
                background: 'oklch(0.7 0.16 60 / 0.18)', color: 'oklch(0.42 0.16 60)',
                textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                Short-term
              </span>
            )}
            {v.experience_required && (
              <span style={{
                padding: '.15rem .5rem', borderRadius: '.25rem',
                fontSize: '.7rem', fontWeight: 600,
                background: 'oklch(0.36 0.13 255 / 0.1)', color: 'var(--primary)',
              }}>
                {v.experience_required}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEnquire}
          className="btn btn-primary"
          style={{ padding: '.45rem 1rem', fontSize: '.8125rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '.375rem' }}
        >
          <IconMail size="sm" /> {ctaLabel}
        </button>
      </div>

      {/* Description */}
      {v.description && (
        <p style={{ margin: '.875rem 0 0', fontSize: '.875rem', color: 'var(--muted-foreground)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {v.description}
        </p>
      )}

      {/* Footer meta */}
      <div className="row gap-4" style={{ marginTop: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '.875rem' }}>
        {v.location && (
          <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
            <IconMapPin size="sm" /> {v.location}
          </span>
        )}
        <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
          {seatLine}
        </span>
        <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
          <IconCalendar size="sm" /> Posted {fmtDate(v.created_at)}
        </span>
        {v.expires_at && (
          <span className="muted-text" style={{ fontSize: '.8125rem' }}>
            Expires {fmtDate(v.expires_at)}
          </span>
        )}
      </div>
    </div>
  );
}

function EnquiryModal({ posting, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [resumeFile, setResumeFile] = useState(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef(null);
  const overlayRef = useRef(null);

  const org = orgName(posting);
  const subject = `Enquiry: ${posting.title}`;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  // Until a backend enquiry endpoint exists (POST /api/jobs/:id/enquire
  // with email-routing to the firm/employer), hand off to the user's mail
  // client so the message isn't silently discarded. The branch inbox is
  // the safe destination — admin staff route enquiries from there.
  function handleSend(e) {
    e.preventDefault();
    const body = [
      `Posting: ${posting.title}`,
      `Organisation: ${org}`,
      '',
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      form.phone ? `Phone: ${form.phone}` : '',
      '',
      form.message,
      '',
      resumeFile ? '(Please attach your resume to this email before sending.)' : '',
    ].filter(Boolean).join('\n');
    const href =
      `mailto:nagpur@icai.org` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSent(true);
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--card)',
        borderRadius: '.75rem',
        boxShadow: '0 24px 64px rgba(0,0,0,.25)',
        width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Titlebar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '.875rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--muted)',
          borderRadius: '.75rem .75rem 0 0',
        }}>
          <span style={{ fontWeight: 700, fontSize: '.9375rem' }}>
            {sent ? 'Enquiry sent' : 'New Enquiry'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)', padding: '.25rem', borderRadius: '.25rem', display: 'flex' }}>
            <IconX />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '2rem', marginBottom: '.75rem' }}>✉</div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: '.375rem' }}>Email draft opened</div>
            <div className="muted-text" style={{ fontSize: '.875rem' }}>
              Your message for <strong>{posting.title}</strong> has been prepared in your email client.
              {resumeFile && <> Please attach <strong>{resumeFile.name}</strong> before hitting Send.</>}
            </div>
            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: '1.5rem', padding: '.5rem 1.5rem' }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Email header fields */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <EmailRow label="To">
                <span style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>{org}</span>
              </EmailRow>
              <EmailRow label="Subject">
                <span style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>{subject}</span>
              </EmailRow>
              <EmailRow label="From">
                <div style={{ display: 'flex', gap: '.625rem', flex: 1, flexWrap: 'wrap' }}>
                  <input
                    required
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    required type="email"
                    placeholder="Your email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </EmailRow>
              <EmailRow label="Phone">
                <input
                  type="tel"
                  placeholder="Your phone number"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  style={{ ...inputStyle, maxWidth: 220 }}
                />
              </EmailRow>
            </div>

            {/* Message body */}
            <textarea
              required
              placeholder={`Write your message to ${org}…`}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              style={{
                flex: 1, resize: 'none', border: 0, outline: 'none',
                padding: '1rem 1.25rem', fontSize: '.875rem',
                color: 'var(--foreground)', background: 'var(--card)',
                minHeight: 140, lineHeight: 1.6, fontFamily: 'inherit',
              }}
            />

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '.75rem',
              padding: '.875rem 1.25rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--muted)',
              borderRadius: '0 0 .75rem .75rem',
              flexWrap: 'wrap',
            }}>
              {/* Attach resume */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '.375rem', cursor: 'pointer', fontSize: '.8125rem', color: 'var(--muted-foreground)', padding: '.375rem .625rem', borderRadius: '.375rem', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <span>📎</span>
                <span>{resumeFile ? resumeFile.name : 'Attach resume'}</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {resumeFile && (
                <button type="button" onClick={() => { setResumeFile(null); fileRef.current.value = ''; }}
                  style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '.75rem' }}>
                  ✕
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '.4rem .875rem', fontSize: '.8125rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '.4rem .875rem', fontSize: '.8125rem', display: 'flex', alignItems: 'center', gap: '.375rem' }}>
                  <IconMail size="sm" /> Send
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EmailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '.625rem 1.25rem', gap: '.75rem', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--muted-foreground)', width: 52, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

const inputStyle = {
  flex: 1, minWidth: 120,
  border: 0, outline: 'none',
  fontSize: '.875rem', color: 'var(--foreground)',
  background: 'transparent', fontFamily: 'inherit',
};

function LoadingGrid({ count }) {
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
          <div style={{ height: '.75rem', width: '25%', background: 'var(--muted)', borderRadius: '.25rem', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ height: '1rem', width: '50%', background: 'var(--muted)', borderRadius: '.25rem', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ height: '.75rem', width: '80%', background: 'var(--muted)', borderRadius: '.25rem', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ height: '.75rem', width: '65%', background: 'var(--muted)', borderRadius: '.25rem', animation: 'shimmer 1.5s infinite' }} />
          <style>{`@keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)', fontSize: '.9375rem' }}>
      {message}
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '.5rem', fontSize: '.875rem' }}>
      Could not load postings — {message}
    </div>
  );
}
