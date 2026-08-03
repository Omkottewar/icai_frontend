import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import { cachedGet } from '../lib/apiCache';
import { formatSalary } from '../lib/salary';
import SaveButton from '../components/jobs/SaveButton';
import ApplyModal from '../components/jobs/ApplyModal';
import {
  IconMapPin, IconCalendar, IconMail, IconBriefcase, IconArrowRight, IconCheckCircle,
} from '../icons';

// Public detail page for a single job posting — reached via /jobs/<id>. Kept
// public (no auth wall) so a subscriber can open the deep-link from a job-
// alert email even if their session lapsed; the apply-CTA prompts login
// only when they act on it.

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function orgName(v) {
  return v.firm_name || v.employer_name || 'ICAI Nagpur';
}

const TYPE_META = {
  job:         { label: 'Job',         eyebrow: 'For CA Members',   backHref: '/job-vacancies?type=job' },
  articleship: { label: 'Articleship', eyebrow: 'For CA Students',  backHref: '/job-vacancies?type=articleship' },
  assignment:  { label: 'Assignment',  eyebrow: 'For CA Members',   backHref: '/job-vacancies?type=assignment' },
};

export default function JobDetailPage() {
  const route = useRoute();
  const { user } = useAuth();
  // /jobs/<id> — id is whatever follows the prefix. Guard against a
  // trailing slash by stripping it, and 404 client-side if empty.
  const id = route.path.replace(/^\/jobs\//, '').replace(/\/$/, '');

  const [item, setItem] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    if (!id) { setError('Missing posting id'); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet(`/api/jobs/${encodeURIComponent(id)}`, undefined, 30_000)
      .then((data) => {
        if (cancelled) return;
        setItem(data.item);
        setRelated(data.related || []);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Loading posting…" />
        <section className="container" style={{ padding: '2.5rem 1rem' }}>
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="muted-text">Fetching posting details…</p>
          </div>
        </section>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <PageHeader title="Posting not found" />
        <section className="container" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
          <p className="muted-text" style={{ marginBottom: '1rem' }}>
            {error || 'This posting may have been filled, closed, or removed.'}
          </p>
          <a href="/job-vacancies?type=job" className="btn btn-outline">Browse open postings</a>
        </section>
      </>
    );
  }

  const meta = TYPE_META[item.type] ?? TYPE_META.job;
  const isArticleship = item.type === 'articleship';
  const isAssignment  = item.type === 'assignment';
  const salary = formatSalary(item);

  // Who's allowed to apply through the site vs. use the enquiry fallback.
  // Same policy as JobVacanciesPage's applyModal path.
  const canApply = user && (user.primary_role === 'member' || user.primary_role === 'student');
  const alreadyApplied = !!item.application_status;
  const ctaLabel = isArticleship ? 'Apply for articleship' : isAssignment ? 'Take assignment' : 'Apply';

  const handleApplyClick = () => {
    if (!user) {
      const returnTo = `/jobs/${id}`;
      navigate('/login?next=' + encodeURIComponent(returnTo));
      return;
    }
    if (!canApply) {
      // Guests / employers fall back to enquiry — send them to the list
      // page which has the enquiry modal wired up.
      navigate(meta.backHref);
      return;
    }
    setApplyOpen(true);
  };

  return (
    <>
      <PageHeader title={item.title} subtitle={orgName(item)} />
      <section className="container" style={{ padding: '2rem 1rem', maxWidth: '58rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <a href={meta.backHref} className="muted-text" style={{ fontSize: '.85rem', textDecoration: 'none' }}>
            ← Back to {meta.label.toLowerCase()}s
          </a>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny-eyebrow">{meta.eyebrow}</div>
              <h1 style={{ margin: '.25rem 0 0', fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', fontWeight: 700, lineHeight: 1.25 }}>
                {item.title}
              </h1>
              <div className="muted-text" style={{ marginTop: '.2rem', fontSize: '.9rem' }}>
                <IconBriefcase size="sm" /> {orgName(item)}
                {item.category_name && (
                  <span> · <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.category_name}</span></span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              <SaveButton postingId={item.id} saved={item.saved} />
              {alreadyApplied ? (
                <span className="badge" style={{
                  padding: '.45rem .75rem', background: 'oklch(0.9 0.05 145 / 0.4)',
                  color: 'oklch(0.35 0.14 145)', borderRadius: '.375rem',
                  fontSize: '.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                }}>
                  <IconCheckCircle size="sm" /> Applied
                </span>
              ) : (
                <button type="button" onClick={handleApplyClick} className="btn btn-primary"
                  style={{ padding: '.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                  <IconMail size="sm" /> {ctaLabel}
                </button>
              )}
            </div>
          </div>

          {/* Highlight bar — the "at-a-glance" chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '1rem' }}>
            {salary && (
              <Chip tone="salary">💰 {salary}</Chip>
            )}
            {item.experience_required && (
              <Chip tone="primary">🧑‍💼 {item.experience_required}</Chip>
            )}
            {item.seat_count > 1 && (
              <Chip tone="neutral">👥 {item.seat_count} seats</Chip>
            )}
            {item.location && (
              <Chip tone="neutral"><IconMapPin size="sm" /> {item.location}</Chip>
            )}
            <Chip tone="neutral"><IconCalendar size="sm" /> Posted {fmtDate(item.created_at)}</Chip>
            {item.expires_at && (
              <Chip tone="warn">Apply by {fmtDate(item.expires_at)}</Chip>
            )}
          </div>

          {/* Description */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.5rem' }}>About this role</h2>
            <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.65, color: 'var(--foreground)' }}>
              {item.description}
            </p>
          </div>

          {/* Apply CTA (repeated at bottom for long descriptions) */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {alreadyApplied ? (
              <p className="muted-text" style={{ fontSize: '.875rem', margin: 0 }}>
                You've already applied to this posting. Check your dashboard for status updates.
              </p>
            ) : (
              <button type="button" onClick={handleApplyClick} className="btn btn-primary"
                style={{ padding: '.55rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                <IconMail size="sm" /> {ctaLabel} <IconArrowRight size="sm" />
              </button>
            )}
            <a href={meta.backHref} className="btn btn-outline" style={{ padding: '.55rem 1rem' }}>
              See all {meta.label.toLowerCase()}s
            </a>
          </div>
        </div>

        {/* Related postings */}
        {related.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.75rem' }}>
              Related {meta.label.toLowerCase()}s
            </h2>
            <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {related.map((r) => (
                <RelatedCard key={r.id} row={r} />
              ))}
            </div>
          </div>
        )}
      </section>

      {applyOpen && (
        <ApplyModal
          posting={item}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setApplyOpen(false);
            // Refresh the detail view so "Already applied" appears
            // immediately without needing a manual reload.
            setItem((x) => x ? { ...x, application_status: 'applied' } : x);
          }}
        />
      )}
    </>
  );
}

function Chip({ children, tone }) {
  const styles = {
    salary:  { background: 'oklch(0.55 0.14 155 / 0.15)', color: 'oklch(0.30 0.14 155)' },
    primary: { background: 'oklch(0.36 0.13 255 / 0.10)', color: 'var(--primary)' },
    warn:    { background: 'oklch(0.90 0.10 70 / 0.35)',  color: 'oklch(0.35 0.15 60)' },
    neutral: { background: 'var(--muted)',                color: 'var(--muted-foreground)' },
  }[tone] || {};
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '.35rem',
      padding: '.3rem .65rem', borderRadius: '999px',
      fontSize: '.78rem', fontWeight: 600,
      ...styles,
    }}>
      {children}
    </span>
  );
}

function RelatedCard({ row }) {
  const salary = formatSalary(row);
  return (
    <a href={`/jobs/${row.id}`} className="card" style={{
      textDecoration: 'none', color: 'inherit',
      padding: '.9rem 1rem', display: 'block',
      transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
    }}>
      <div style={{ fontSize: '.95rem', fontWeight: 700, lineHeight: 1.3 }}>{row.title}</div>
      <div className="muted-text" style={{ fontSize: '.8rem', marginTop: '.2rem' }}>
        {orgName(row)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem', marginTop: '.55rem' }}>
        {salary && (
          <span style={{ padding: '.1rem .4rem', borderRadius: '.25rem', fontSize: '.68rem', fontWeight: 700, background: 'oklch(0.55 0.14 155 / 0.15)', color: 'oklch(0.30 0.14 155)' }}>
            {salary}
          </span>
        )}
        {row.experience_required && (
          <span style={{ padding: '.1rem .4rem', borderRadius: '.25rem', fontSize: '.68rem', fontWeight: 600, background: 'oklch(0.36 0.13 255 / 0.1)', color: 'var(--primary)' }}>
            {row.experience_required}
          </span>
        )}
      </div>
    </a>
  );
}
