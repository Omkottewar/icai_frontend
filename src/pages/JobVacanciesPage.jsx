import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { useAuth } from '../context/AuthContext';
import { renderMarkdown } from '../lib/markdown.jsx';
import { cachedGet, subscribe } from '../lib/apiCache';
import { formatSalary } from '../lib/salary';
import RequestArticleshipModal from '../components/student/RequestArticleshipModal';
import SubscribeAlertsModal from '../components/jobs/SubscribeAlertsModal';
import ApplyModal from '../components/jobs/ApplyModal';
import SaveButton from '../components/jobs/SaveButton';
import { IconMapPin, IconCalendar, IconMail, IconBriefcase, IconX, IconGraduationCap, IconHandshake, IconBell, IconCheckCircle } from '../icons';

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function orgName(v) {
  return v.firm_name || v.employer_name || 'ICAI Nagpur';
}

function usePostings(type, category, q, experience) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ type });
    if (category)   qs.set('category',   category);
    if (q)          qs.set('q',          q);
    if (experience) qs.set('experience', experience);
    // 60s TTL — postings change at most a few times per day; this makes
    // toggling between Jobs / Articleships tabs feel instant. Each unique
    // (type, category, q, experience) combo gets its own cache key.
    cachedGet('/api/jobs?' + qs.toString(), undefined, 60_000)
      .then((data) => { if (!cancelled) setRows(data.rows); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, category, q, experience]);

  return { rows, loading, error };
}

function useCategories() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    cachedGet('/api/job-alerts/categories', undefined, 300_000)
      .then((j) => setCats(j.items || []))
      .catch(() => setCats([]));
  }, []);
  return cats;
}

// Three modes the page can show — picked via ?type= query string.
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
  const { user } = useAuth();
  const header = useSiteContent('job_vacancies_page_header');
  const mode = MODE_CONFIG[route.query.type] ?? MODE_CONFIG.job;
  const categories = useCategories();
  const [categoryFilter, setCategoryFilter] = useState('');
  // Keyword search + experience filter. `query` is what the user is typing;
  // `q` is the debounced value we actually send to the API. 250ms feels
  // instant but is enough to avoid hammering the server on each keystroke.
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const [experienceFilter, setExperienceFilter] = useState('');
  const { rows, loading, error } = usePostings(mode.type, categoryFilter, q, experienceFilter);

  // "Recommended for you" strip — fetched only for signed-in members /
  // students. Returns an empty array for guests or users with no active
  // alert subscriptions, so the strip silently disappears in those cases.
  const [recs, setRecs] = useState([]);
  useEffect(() => {
    if (!user) { setRecs([]); return; }
    let cancelled = false;
    cachedGet(`/api/jobs/recommended?type=${encodeURIComponent(mode.type)}`, undefined, 60_000)
      .then((j) => { if (!cancelled) setRecs(j.rows || []); })
      .catch(() => { if (!cancelled) setRecs([]); });
    return () => { cancelled = true; };
  }, [user, mode.type]);

  // Active job-alert subscriptions for the signed-in caller. Powers the
  // "You're subscribed to alerts" banner state (replaces the generic
  // "Don't miss the next opening" CTA once they've already subscribed).
  // Subscribes to /api/job-alerts invalidations so the banner flips the
  // moment the SubscribeAlertsModal saves.
  const [mySubs, setMySubs] = useState(null);
  useEffect(() => {
    if (!user) { setMySubs(null); return; }
    let cancelled = false;
    const load = () => {
      cachedGet('/api/job-alerts/me', null, 60_000)
        .then((j) => {
          if (cancelled) return;
          const active = (j?.items || []).filter((r) => !r.unsubscribed_at);
          setMySubs(active);
        })
        .catch(() => { if (!cancelled) setMySubs([]); });
    };
    load();
    const unsub = subscribe('/api/job-alerts', load);
    return () => { cancelled = true; unsub(); };
  }, [user]);
  const activeSubCount = mySubs?.length ?? 0;
  const hasActiveSubs = activeSubCount > 0;
  const hasUnconfirmedSub = mySubs?.some((r) => !r.confirmed_at);
  const [enquiryTarget, setEnquiryTarget] = useState(null);
  const [applyTarget, setApplyTarget] = useState(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const isArticleshipView = mode.type === 'articleship';

  // Latest active articleship submission for this student — powers the
  // "already submitted" state on the CTA + info banner and pre-fills the
  // modal when the student re-opens it. Only relevant for signed-in
  // students on the articleship view; everyone else gets `null` and sees
  // the original "Submit your preferences" copy.
  const shouldFetchPrefs = isArticleshipView && user?.primary_role === 'student';
  const [existingPref, setExistingPref] = useState(null);
  useEffect(() => {
    if (!shouldFetchPrefs) { setExistingPref(null); return; }
    let cancelled = false;
    const load = () => {
      cachedGet('/api/articleship-matches/my', null, 30_000)
        .then((j) => {
          if (cancelled) return;
          const rows = j?.rows || [];
          // Pick the most recent non-cancelled row — "submitted", "matched"
          // and "placed" all count as an active preference on file.
          const active = rows.find((r) => r.status !== 'cancelled');
          setExistingPref(active || null);
        })
        .catch(() => { if (!cancelled) setExistingPref(null); });
    };
    load();
    const unsub = subscribe('/api/articleship-matches/my', load);
    return () => { cancelled = true; unsub(); };
  }, [shouldFetchPrefs]);

  const hasExistingPref = !!existingPref;

  // Restrict the category chips to those that actually appear in the current
  // result set — clutter avoidance while still leaving the "All" chip.
  const visibleCategories = useMemo(() => {
    if (!rows || rows.length === 0) return categories;
    const codes = new Set(rows.map((r) => r.category_code).filter(Boolean));
    return categories.filter((c) => codes.has(c.code) || c.id === categoryFilter);
  }, [rows, categories, categoryFilter]);

  const openPreferences = () => {
    if (!user) {
      navigate('/login?next=' + encodeURIComponent('/job-vacancies?type=articleship'));
      return;
    }
    setPrefsOpen(true);
  };

  const openApply = (posting) => {
    if (!user) {
      navigate('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    if (user.primary_role !== 'member' && user.primary_role !== 'student') {
      setEnquiryTarget(posting); // fallback for guests/employers — email path
      return;
    }
    setApplyTarget(posting);
  };

  const openSubscribe = () => {
    if (!user) {
      navigate('/login?next=' + encodeURIComponent('/job-alerts/subscribe'));
      return;
    }
    setSubscribeOpen(true);
  };

  const notice = (
    <div style={{
      background: 'oklch(0.36 0.13 255 / 0.06)',
      border: '1px solid oklch(0.36 0.13 255 / 0.15)',
      borderRadius: '.5rem',
      padding: '.875rem 1rem',
      marginBottom: '1rem',
      fontSize: '.8125rem',
      color: 'var(--foreground)',
    }}>
      {renderMarkdown(header.notice)}
    </div>
  );

  // Banner flips state based on the caller's active subscriptions:
  //   • signed-out / no subs → CTA "Subscribe to alerts" (site-content copy)
  //   • has active subs → confirmation "You're subscribed to N alerts" with
  //     "Manage preferences" (deep-linked to Dashboard → Jobs tab) and
  //     "Add more" (opens the subscribe modal again)
  //   • has unconfirmed subs → warning tint reminding to click confirm email
  const subscribeBanner = hasActiveSubs ? (
    <div style={{
      background: hasUnconfirmedSub
        ? 'linear-gradient(90deg, oklch(0.96 0.06 90), oklch(0.97 0.03 100))'
        : 'linear-gradient(90deg, oklch(0.95 0.05 145), oklch(0.97 0.03 155))',
      border: '1px solid ' + (hasUnconfirmedSub ? 'oklch(0.75 0.15 80)' : 'oklch(0.60 0.13 150 / 0.35)'),
      borderRadius: '.5rem',
      padding: '.875rem 1rem',
      marginBottom: '1.5rem',
      display: 'flex', gap: '.75rem', flexWrap: 'wrap',
      alignItems: 'center', justifyContent: 'space-between',
      fontSize: '.85rem',
    }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', minWidth: 0 }}>
        <IconCheckCircle />
        <div>
          {hasUnconfirmedSub ? (
            <>
              <strong>Almost there —</strong> check your inbox for the confirmation email
              {activeSubCount > 1 ? ` (${activeSubCount} alerts pending).` : ' to activate your alert.'}
            </>
          ) : (
            <>
              <strong>You're subscribed to {activeSubCount} alert{activeSubCount === 1 ? '' : 's'}.</strong>{' '}
              We'll email you as soon as a matching posting goes live.
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <button type="button" onClick={openSubscribe} className="btn btn-outline" style={{ padding: '.4rem .9rem', fontSize: '.8rem', background: 'white' }}>
          Add more
        </button>
        <a href="/dashboard#jobs" className="btn btn-primary" style={{ padding: '.4rem .9rem', fontSize: '.8rem', textDecoration: 'none' }}>
          Manage preferences
        </a>
      </div>
    </div>
  ) : (
    <div style={{
      background: 'linear-gradient(90deg, oklch(0.94 0.05 255), oklch(0.96 0.03 145))',
      border: '1px solid oklch(0.36 0.13 255 / 0.2)',
      borderRadius: '.5rem',
      padding: '.875rem 1rem',
      marginBottom: '1.5rem',
      display: 'flex', gap: '.75rem', flexWrap: 'wrap',
      alignItems: 'center', justifyContent: 'space-between',
      fontSize: '.85rem',
    }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', minWidth: 0 }}>
        <IconBell />
        <div>{renderMarkdown(header.subscribe_banner)}</div>
      </div>
      <button type="button" onClick={openSubscribe} className="btn btn-primary" style={{ padding: '.4rem .9rem', fontSize: '.8rem', flexShrink: 0 }}>
        Subscribe to alerts
      </button>
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
        {subscribeBanner}

        <div style={{
          display: 'flex', gap: '1rem', flexWrap: 'wrap',
          alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}>
          <div>
            <div className="tiny-eyebrow">{mode.eyebrow}</div>
            <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, lineHeight: 1.2 }}>
              {mode.defaultHeading}
            </h2>
            <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem', maxWidth: '48rem' }}>
              {mode.defaultLead}
            </p>
          </div>

          {isArticleshipView && (
            <button
              type="button"
              onClick={openPreferences}
              className="btn btn-primary"
              style={{ padding: '.6rem 1.1rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}
              title={hasExistingPref
                ? 'You already submitted preferences — open the form to edit them'
                : 'Fill your preferences — WICASA matches you to firms'}
            >
              <IconHandshake size="sm" />
              {hasExistingPref ? 'Update your preferences' : 'Submit your preferences'}
            </button>
          )}
        </div>

        {/* Recommended for you — only renders when the signed-in caller has
             at least one matching alert subscription. Hidden while the user
             is actively searching so recs don't compete with results. */}
        {recs.length > 0 && !q && !experienceFilter && !categoryFilter && (
          <RecommendedStrip recs={recs} />
        )}

        {/* Search + experience filter row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 220px)', gap: '.5rem', marginBottom: '.75rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 120))}
              placeholder={`Search ${mode.type === 'articleship' ? 'articleships' : mode.type === 'assignment' ? 'assignments' : 'jobs'} — title, firm, GST, audit…`}
              style={{
                width: '100%', padding: '.55rem .8rem .55rem 2.15rem',
                border: '1px solid var(--border)', borderRadius: '.5rem',
                fontSize: '.875rem', background: 'var(--card)',
              }}
            />
            <span aria-hidden style={{ position: 'absolute', left: '.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', fontSize: '.95rem', pointerEvents: 'none' }}>🔎</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute', right: '.4rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)',
                  padding: '.2rem', lineHeight: 1, fontSize: '1rem',
                }}
              >×</button>
            )}
          </div>
          <input
            type="text"
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value.slice(0, 60))}
            placeholder="Experience — e.g. Fresher"
            style={{
              width: '100%', padding: '.55rem .8rem',
              border: '1px solid var(--border)', borderRadius: '.5rem',
              fontSize: '.875rem', background: 'var(--card)',
            }}
          />
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              style={{
                padding: '.3rem .75rem', borderRadius: '999px',
                border: '1px solid ' + (categoryFilter === '' ? 'var(--primary)' : 'var(--border)'),
                background: categoryFilter === '' ? 'oklch(0.36 0.13 255 / 0.1)' : 'var(--card)',
                color: categoryFilter === '' ? 'var(--primary)' : 'var(--foreground)',
                fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              All
            </button>
            {visibleCategories.map((c) => {
              const on = categoryFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(on ? '' : c.id)}
                  style={{
                    padding: '.3rem .75rem', borderRadius: '999px',
                    border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                    background: on ? 'oklch(0.36 0.13 255 / 0.1)' : 'var(--card)',
                    color: on ? 'var(--primary)' : 'var(--foreground)',
                    fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {isArticleshipView && (
          <div
            style={{
              background: hasExistingPref ? 'oklch(0.95 0.04 145)' : 'oklch(0.94 0.03 250)',
              border: '1px solid ' + (hasExistingPref ? 'oklch(0.80 0.10 145)' : 'oklch(0.85 0.05 250)'),
              borderRadius: '.5rem',
              padding: '.85rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '.85rem',
              color: hasExistingPref ? 'oklch(0.28 0.10 145)' : 'oklch(0.28 0.09 250)',
              display: 'flex', flexWrap: 'wrap', gap: '.75rem',
              alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            {hasExistingPref ? (
              <span>
                <strong>Your preferences are on file.</strong> WICASA is reviewing them — you'll hear back with matched firms. Use the <em>Update your preferences</em> button above to edit anything (specialisations, firm size, stipend, CV) until they finalise recommendations.
              </span>
            ) : (
              <span>
                <strong>Not sure which firm suits you?</strong> Fill out your specialisation, firm-size, and stipend preferences once — WICASA will match you to member firms in Nagpur and recommend openings that fit. Use the <em>Submit your preferences</em> button above to get started.
              </span>
            )}
          </div>
        )}

        {loading && <LoadingGrid count={3} />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && rows?.length === 0 && (
          <EmptyState message={(q || experienceFilter || categoryFilter)
            ? 'No postings match those filters. Try clearing the search or picking a different category.'
            : mode.defaultEmpty} />
        )}
        {!loading && !error && rows?.length > 0 && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {rows.map((v) => (
              <PostingCard
                key={v.id}
                posting={v}
                mode={mode}
                user={user}
                onApply={() => openApply(v)}
                onEnquire={() => setEnquiryTarget(v)}
              />
            ))}
          </div>
        )}
      </section>

      {enquiryTarget && (
        <EnquiryModal posting={enquiryTarget} onClose={() => setEnquiryTarget(null)} />
      )}

      {applyTarget && (
        <ApplyModal
          posting={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={() => {/* card status updates on next fetch */}}
        />
      )}

      {subscribeOpen && (
        <SubscribeAlertsModal onClose={() => setSubscribeOpen(false)} initialCategoryId={categoryFilter || undefined} />
      )}

      {prefsOpen && (
        <RequestArticleshipModal
          initial={existingPref}
          onClose={() => setPrefsOpen(false)}
          onSubmitted={() => setPrefsOpen(false)}
        />
      )}
    </>
  );
}

function PostingCard({ posting: v, mode, user, onApply, onEnquire }) {
  const isArticleship = mode.type === 'articleship';
  const isAssignment  = mode.type === 'assignment';
  const ctaLabel = isArticleship ? 'Apply' : isAssignment ? 'Express interest' : 'Apply';
  const seatLine = isArticleship
    ? <><IconGraduationCap size="sm" /> {v.seat_count} seat{v.seat_count !== 1 ? 's' : ''} available</>
    : isAssignment
      ? <><IconBriefcase size="sm" /> {v.seat_count} opening{v.seat_count !== 1 ? 's' : ''}</>
      : <><IconBriefcase size="sm" /> {v.seat_count} position{v.seat_count !== 1 ? 's' : ''}</>;
  const canApply = user && (user.primary_role === 'member' || user.primary_role === 'student');

  return (
    <div className="card" id={`p-${v.id}`} style={{ padding: '1.5rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '.25rem' }}>
            {orgName(v)}
          </div>
          <h3 style={{ fontWeight: 700, fontSize: '1.0625rem', margin: 0 }}>
            <a href={`/jobs/${v.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
               onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
               onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}>
              {v.title}
            </a>
          </h3>
          <div className="row gap-3" style={{ marginTop: '.625rem', flexWrap: 'wrap' }}>
            {v.category_name && (
              <span style={{
                padding: '.15rem .5rem', borderRadius: '.25rem',
                fontSize: '.7rem', fontWeight: 600,
                background: 'oklch(0.9 0.05 145 / 0.6)', color: 'oklch(0.32 0.13 145)',
              }}>
                {v.category_name}
              </span>
            )}
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
            {formatSalary(v) && (
              <span style={{
                padding: '.15rem .5rem', borderRadius: '.25rem',
                fontSize: '.7rem', fontWeight: 700,
                background: 'oklch(0.55 0.14 155 / 0.15)', color: 'oklch(0.30 0.14 155)',
              }} title="Salary / stipend range">
                {formatSalary(v)}
              </span>
            )}
            {v.application_status && (
              <span style={{
                padding: '.15rem .5rem', borderRadius: '.25rem',
                fontSize: '.7rem', fontWeight: 700,
                background: 'oklch(0.9 0.05 145 / 0.4)', color: 'oklch(0.35 0.14 145)',
                textTransform: 'uppercase', letterSpacing: '.04em',
                display: 'inline-flex', alignItems: 'center', gap: '.25rem',
              }}>
                <IconCheckCircle size="sm" /> Applied
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <SaveButton postingId={v.id} saved={v.saved} />
          {canApply && !v.application_status ? (
            <button onClick={onApply} className="btn btn-primary" style={{ padding: '.45rem 1rem', fontSize: '.8125rem', display: 'flex', alignItems: 'center', gap: '.375rem' }}>
              <IconMail size="sm" /> {ctaLabel}
            </button>
          ) : v.application_status ? (
            <span className="muted-text" style={{ fontSize: '.75rem', padding: '.45rem .75rem', border: '1px dashed var(--border)', borderRadius: '.375rem' }}>
              Already applied
            </span>
          ) : (
            <button onClick={onEnquire} className="btn btn-primary" style={{ padding: '.45rem 1rem', fontSize: '.8125rem', display: 'flex', alignItems: 'center', gap: '.375rem' }}>
              <IconMail size="sm" /> Enquire
            </button>
          )}
        </div>
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

// ─── Legacy enquiry-by-email modal ──────────────────────────────────────
// Kept as a fallback for non-authenticated users and non-member/student
// roles who tap "Enquire" instead of "Apply". Sends via the user's mail
// client until a dedicated /api/jobs/:id/enquire endpoint lands.
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
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <EmailRow label="To">
                <span style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>{org}</span>
              </EmailRow>
              <EmailRow label="Subject">
                <span style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>{subject}</span>
              </EmailRow>
              <EmailRow label="From">
                <div style={{ display: 'flex', gap: '.625rem', flex: 1, flexWrap: 'wrap' }}>
                  <input required placeholder="Your name" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} />
                  <input required type="email" placeholder="Your email" value={form.email} onChange={(e) => set('email', e.target.value)} style={inputStyle} />
                </div>
              </EmailRow>
              <EmailRow label="Phone">
                <input type="tel" placeholder="Your phone number" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={{ ...inputStyle, maxWidth: 220 }} />
              </EmailRow>
            </div>
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: '.75rem',
              padding: '.875rem 1.25rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--muted)',
              borderRadius: '0 0 .75rem .75rem',
              flexWrap: 'wrap',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.375rem', cursor: 'pointer', fontSize: '.8125rem', color: 'var(--muted-foreground)', padding: '.375rem .625rem', borderRadius: '.375rem', border: '1px solid var(--border)', background: 'var(--card)' }}>
                <span>📎</span>
                <span>{resumeFile ? resumeFile.name : 'Attach resume'}</span>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)} />
              </label>
              {resumeFile && (
                <button type="button" onClick={() => { setResumeFile(null); fileRef.current.value = ''; }}
                  style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '.75rem' }}>
                  ✕
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '.4rem .875rem', fontSize: '.8125rem' }}>Cancel</button>
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
      <span style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--muted-foreground)', width: 52, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle = {
  flex: 1, minWidth: 120, border: 0, outline: 'none',
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

// "Recommended for you" — horizontally-scrolling strip of postings that
// match the signed-in member's alert subscriptions. Rendered above the
// full listing and hidden while the user is filtering (so recs don't fight
// with the results the user just asked for). Falls back gracefully — the
// endpoint returns [] for guests and users without subscriptions.
function RecommendedStrip({ recs }) {
  return (
    <div style={{
      marginBottom: '1rem',
      padding: '.85rem 1rem',
      background: 'linear-gradient(135deg, oklch(0.96 0.04 145 / .5), oklch(0.96 0.04 250 / .5))',
      border: '1px solid oklch(0.85 0.05 200)',
      borderRadius: '.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.55rem', gap: '.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontWeight: 700, fontSize: '.9rem' }}>
          <span aria-hidden>✨</span> Recommended for you
        </div>
        <div className="muted-text" style={{ fontSize: '.72rem' }}>
          Based on your job alert preferences
        </div>
      </div>
      <div style={{
        display: 'grid',
        gap: '.55rem',
        gridAutoFlow: 'column',
        gridAutoColumns: 'minmax(240px, 1fr)',
        overflowX: 'auto',
        paddingBottom: '.25rem',
      }}>
        {recs.map((r) => {
          const salary = formatSalary(r);
          const org = r.firm_name || r.employer_name || 'ICAI Nagpur';
          return (
            <a
              key={r.id}
              href={`/jobs/${r.id}`}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '.4rem',
                padding: '.6rem .75rem',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex', flexDirection: 'column', gap: '.25rem',
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '.85rem', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {r.title}
              </div>
              <div className="muted-text" style={{ fontSize: '.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {org}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem', marginTop: '.15rem' }}>
                {r.category_name && (
                  <span style={{ fontSize: '.65rem', padding: '.1rem .4rem', borderRadius: '.25rem', background: 'oklch(0.9 0.05 145 / 0.6)', color: 'oklch(0.32 0.13 145)', fontWeight: 600 }}>
                    {r.category_name}
                  </span>
                )}
                {salary && (
                  <span style={{ fontSize: '.65rem', padding: '.1rem .4rem', borderRadius: '.25rem', background: 'oklch(0.55 0.14 155 / 0.15)', color: 'oklch(0.30 0.14 155)', fontWeight: 700 }}>
                    💰 {salary}
                  </span>
                )}
                {r.experience_required && (
                  <span style={{ fontSize: '.65rem', padding: '.1rem .4rem', borderRadius: '.25rem', background: 'oklch(0.36 0.13 255 / 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                    {r.experience_required}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
