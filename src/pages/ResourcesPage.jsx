import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import {
  IconArrowRight, IconFileText, IconBookOpen, IconDownload, IconAward, IconShield,
  IconCalendar, IconUsers, IconPlus, IconSearch,
} from '../icons';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';

// Structural frames for the top category tiles — icon is built-in; title /
// description / URL come from the `resources_categories` slot.
const CATEGORY_ICONS = [IconFileText, IconBookOpen, IconAward, IconShield];

// Renders a cover image with a graceful gradient fallback when the URL is
// missing OR when the image fails to load (404, mock data, etc.). The
// fallback uses the same look as the "no cover" placeholder so cards stay
// visually consistent across the grid. Pre-fix the listings showed broken
// alt-text where mock cover_file_id rows pointed to files that didn't
// actually exist on disk — that's what made the page look unfinished.
function CoverImage({ src, alt, label }) {
  const [failed, setFailed] = useState(!src);

  const fallback = (
    <div style={{
      width: '100%', aspectRatio: '4/3',
      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1rem', fontWeight: 700, textAlign: 'center', padding: '1rem',
      letterSpacing: '.02em',
    }}>
      {label}
    </div>
  );

  if (failed || !src) return fallback;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: '#f1f5f9' }}
    />
  );
}

function NewsletterShimmerGrid({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Shimmer width="100%" height="0" style={{ aspectRatio: '4/3', display: 'block', borderRadius: 0 }} />
          <div style={{ padding: '.875rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <Shimmer height=".6rem" width="40%" />
            <Shimmer height=".95rem" width="80%" />
            <Shimmer height=".75rem" width="50%" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaperShimmerGrid({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '.6rem' }}>
          <Shimmer height="1rem" width="3rem" radius="999px" />
          <ShimmerLines count={2} lastWidth="65%" />
          <div style={{ marginTop: '.4rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
            <Shimmer height=".7rem" width="45%" />
            <Shimmer height=".7rem" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}


const COMMITTEE_COLORS = {
  GST:          { color: '#16a34a', bg: '#f0fdf4' },
  'Direct Tax': { color: '#ea580c', bg: '#fff7ed' },
  IT:           { color: '#4f46e5', bg: '#eef2ff' },
  Audit:        { color: '#0891b2', bg: '#ecfeff' },
  CPE:          { color: '#2563eb', bg: '#eff6ff' },
  WICASA:       { color: '#7c3aed', bg: '#f5f3ff' },
  Branch:       { color: '#6b7280', bg: '#f9fafb' },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Read URL query string ("/resources?q=foo&topic=gst") so a filtered view
// is shareable + back/forward friendly.
function readHashQuery() {
  return new URLSearchParams(window.location.search);
}
function writeHashQuery(params) {
  const qs = params.toString();
  const next = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next !== current) {
    window.history.replaceState(null, '', next);
  }
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const header     = useSiteContent('resources_page_header');
  const categories = useSiteContent('resources_categories');
  const sections   = useSiteContent('resources_sections');
  const [newsletters, setNewsletters] = useState(null);
  const [ejournalIssues, setEjournalIssues] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api('/api/newsletters'),
      api('/api/resources/ejournal-issues?pageSize=12').catch(() => ({ items: [] })),
    ])
      .then(([n, j]) => {
        if (cancelled) return;
        setNewsletters(n.items || []);
        setEjournalIssues(j.items || []);
      })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      {/* Resource categories — admin-editable via the resources_categories slot */}
      <section className="container" style={{ padding: '3rem 1rem 2rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {[1, 2, 3, 4].map((n) => {
            const Icon = CATEGORY_ICONS[n - 1];
            const t = categories[`card_${n}_title`];
            const d = categories[`card_${n}_desc`];
            const href = categories[`card_${n}_url`];
            if (!t) return null;
            return (
              <a
                key={n}
                href={href || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="card hover-lift"
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
              >
                <div className="icon-tile"><Icon size="lg" /></div>
                <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{t}</h3>
                <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{d}</p>
                <div className="row gap-1" style={{ marginTop: 'auto', paddingTop: '1rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 500 }}>
                  Open <IconArrowRight size="sm" />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Branch Newsletter — dynamic, sorted by issue year/month desc */}
      <section className="container" style={{ padding: '2rem 1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">{sections.newsletter_eyebrow}</div>
          <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.3rem, 4.2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.15 }}>{sections.newsletter_heading}</h2>
          <div className="muted-text" style={{ marginTop: '.5rem', maxWidth: '44rem', fontSize: '.875rem' }}>
            {renderMarkdown(sections.newsletter_subtitle)}
          </div>
        </div>

        {newsletters === null ? (
          <NewsletterShimmerGrid count={4} />
        ) : newsletters.length === 0 ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>{sections.newsletter_empty_msg}</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {newsletters.map((n) => (
              <a
                key={n.id}
                href={n.pdf_url || '#'}
                target={n.pdf_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="card hover-lift"
                style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}
              >
                <CoverImage
                  src={n.cover_url}
                  alt={n.title}
                  label={`${MONTH_NAMES[n.issue_month - 1]} ${n.issue_year}`}
                />
                <div style={{ padding: '.75rem .9rem .9rem' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {MONTH_NAMES[n.issue_month - 1]} {n.issue_year}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem', marginTop: '.15rem', lineHeight: 1.3 }}>{n.title}</div>
                  {n.pdf_url && (
                    <div className="row gap-1" style={{ marginTop: '.45rem', color: 'var(--primary)', fontSize: '.78rem', fontWeight: 600 }}>
                      <IconDownload size="sm" /> Download PDF
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* E-Journal Archive — same visual treatment as Branch Newsletter. */}
      {ejournalIssues && ejournalIssues.length > 0 && (
        <section className="container" style={{ padding: '2rem 1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="tiny-eyebrow">{sections.ejournal_eyebrow}</div>
            <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.3rem, 4.2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.15 }}>{sections.ejournal_heading}</h2>
            <div className="muted-text" style={{ marginTop: '.5rem', maxWidth: '44rem', fontSize: '.875rem' }}>
              {renderMarkdown(sections.ejournal_subtitle)}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {ejournalIssues.map((j) => (
              <a
                key={j.id}
                href={`/resources/journal/${j.slug}`}
                className="card hover-lift"
                style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}
              >
                <CoverImage
                  src={j.cover_url}
                  alt={j.title}
                  label={j.issue_label}
                />
                <div style={{ padding: '.75rem .9rem .9rem' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {j.issue_label}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem', marginTop: '.15rem', lineHeight: 1.3 }}>{j.title}</div>
                  <div className="row gap-1" style={{ marginTop: '.45rem', color: 'var(--primary)', fontSize: '.78rem', fontWeight: 600 }}>
                    Read issue <IconArrowRight size="sm" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Paper Presentations — own section with its own search/filter state */}
      <PapersSection user={user} initialErr={err} sections={sections} />
    </>
  );
}

// ─── Paper Presentations section ───────────────────────────────────────────
// Lives outside the parent so a search keystroke doesn't re-render the four
// link tiles or the newsletter grid.
function PapersSection({ user, initialErr, sections }) {
  // Filter state — seeded from URL hash so a filtered URL is shareable.
  const initialQuery = readHashQuery();
  const [q,        setQ]        = useState(initialQuery.get('q') || '');
  const [topicSel, setTopicSel] = useState(() => new Set((initialQuery.get('topic') || '').split(',').filter(Boolean)));
  const [year,     setYear]     = useState(initialQuery.get('year') || '');
  const [sort,     setSort]     = useState(initialQuery.get('sort') === 'popular' ? 'popular' : 'recent');

  const [topics, setTopics] = useState([]);     // catalogue of all topics (with paper_count)
  const [papers, setPapers] = useState(null);
  const [total,  setTotal]  = useState(0);
  const [err,    setErr]    = useState(initialErr || '');
  const [loading, setLoading] = useState(false);

  // Debounce the search input — only fire the request 280ms after the last
  // keystroke. The user can keep typing without spamming the API.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(t);
  }, [q]);

  // Year picker — the simplest deterministic range. Spans the launch year
  // (2018) to the current year. Cheaper than a /min-max-year endpoint.
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const out = [];
    for (let y = now; y >= 2018; y--) out.push(y);
    return out;
  }, []);

  // Topic catalogue — load once. The endpoint returns paper_count per topic
  // so we can sort by relevance and hide topics with zero papers.
  useEffect(() => {
    api('/api/resources/topics')
      .then((r) => setTopics((r.items || []).filter((t) => t.paper_count > 0)))
      .catch(() => setTopics([]));
  }, []);

  // Fetch papers whenever filters change.
  const abortRef = useRef(null);
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const params = new URLSearchParams();
    if (debouncedQ)      params.set('q', debouncedQ);
    if (topicSel.size)   params.set('topic', Array.from(topicSel).join(','));
    if (year)            params.set('year', year);
    if (sort !== 'recent') params.set('sort', sort);
    params.set('pageSize', '24');

    // Mirror to URL hash (without the pageSize bit) — share-friendly.
    const mirror = new URLSearchParams(params);
    mirror.delete('pageSize');
    writeHashQuery(mirror);

    setLoading(true);
    fetch(`/api/resources/papers?${params}`, { credentials: 'include', signal: ac.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j) => { setPapers(j.items || []); setTotal(j.total || 0); setErr(''); })
      .catch((e) => { if (e.name !== 'AbortError') setErr(e.message); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });

    return () => ac.abort();
  }, [debouncedQ, topicSel, year, sort]);

  const toggleTopic = (code) => {
    setTopicSel((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };
  const clearFilters = () => {
    setQ(''); setTopicSel(new Set()); setYear(''); setSort('recent');
  };
  const hasFilters = !!debouncedQ || topicSel.size > 0 || !!year || sort !== 'recent';

  return (
    <section className="container" style={{ padding: '2rem 1rem 4rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="tiny-eyebrow">{sections.papers_eyebrow}</div>
        <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.3rem, 4.2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.15 }}>{sections.papers_heading}</h2>
        <div className="muted-text" style={{ marginTop: '.5rem', maxWidth: '44rem', fontSize: '.875rem' }}>
          {renderMarkdown(sections.papers_subtitle)}
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="res-filter-bar">
        <div className="res-search">
          <IconSearch size="sm" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={sections.papers_search_placeholder || 'Search title, abstract or speaker…'}
            aria-label="Search papers"
          />
        </div>
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="res-sort">
          <button
            type="button"
            className={'res-sort-btn' + (sort === 'recent'  ? ' is-active' : '')}
            onClick={() => setSort('recent')}
          >Recent</button>
          <button
            type="button"
            className={'res-sort-btn' + (sort === 'popular' ? ' is-active' : '')}
            onClick={() => setSort('popular')}
          >Popular</button>
        </div>
      </div>

      {topics.length > 0 && (
        <div className="res-topic-row">
          {topics.map((t) => (
            <button
              key={t.code}
              type="button"
              className={'res-topic-chip' + (topicSel.has(t.code) ? ' is-active' : '')}
              onClick={() => toggleTopic(t.code)}
            >
              {t.name} <span className="res-topic-n">{t.paper_count}</span>
            </button>
          ))}
          {hasFilters && (
            <button type="button" className="res-clear-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      )}

      {/* Mandatory disclaimer per Web-Media Policy 5p — admin-editable */}
      <div className="res-disclaimer">
        {renderMarkdown(sections.papers_disclaimer)}
      </div>

      {err && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{err}</p>}

      {/* Result count + active-filter context */}
      {papers !== null && (
        <div className="res-result-meta">
          {loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
          {hasFilters && !loading && (
            <button type="button" className="res-inline-clear" onClick={clearFilters}>· Clear</button>
          )}
        </div>
      )}

      {papers === null ? (
        <PaperShimmerGrid count={6} />
      ) : papers.length === 0 ? (
        <div className="res-empty">
          <p>No presentations match your filters.</p>
          {hasFilters && <button type="button" className="btn btn-outline" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
          {papers.map((p) => {
            const meta = COMMITTEE_COLORS[p.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };
            // Whole card opens the reader directly — that's the primary
            // action members want. A small "Details" link in the footer
            // still lets them reach the abstract/comments/quiz page.
            return (
              <a
                key={p.id}
                href={p.slug ? `/resources/papers/${p.slug}/read` : '#'}
                className="card hover-lift"
                style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
              >
                {p.committee_tag && (
                  <div className="row gap-2" style={{ marginBottom: '.75rem' }}>
                    <span style={{
                      padding: '.125rem .5rem', borderRadius: '.25rem', fontSize: '.7rem', fontWeight: 600,
                      background: meta.bg, color: meta.color,
                    }}>{p.committee_tag}</span>
                  </div>
                )}
                <h3 style={{ fontWeight: 600, fontSize: '.9375rem', lineHeight: 1.4, flex: 1 }}>{p.title}</h3>
                <div className="col gap-1 muted-text" style={{ marginTop: '.75rem', fontSize: '.75rem' }}>
                  <div className="row gap-2"><IconUsers size="sm" /> {p.speaker_name}</div>
                  {(p.event_title || p.event?.title || p.presented_on) && (
                    <div className="row gap-2">
                      <IconCalendar size="sm" />
                      {(p.event?.title || p.event_title) && <span>{p.event?.title || p.event_title}</span>}
                      {(p.event?.title || p.event_title) && p.presented_on && <span> · </span>}
                      {p.presented_on && <span>{new Date(p.presented_on).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>}
                    </div>
                  )}
                </div>
                <div className="row gap-2" style={{ marginTop: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="row gap-1" style={{ color: 'var(--primary)', fontSize: '.85rem', fontWeight: 600 }}>
                    <IconBookOpen size="sm" /> Read
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="pp-details-link"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/resources/papers/${p.slug}`); }}
                  >Details →</span>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Member CTAs */}
      {user && (
        <div className="row gap-2" style={{ marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/my-library" className="btn btn-outline">
            <IconBookOpen size="sm" /> My Library
          </a>
          <a href="/resources/submit" className="btn btn-outline">
            <IconPlus size="sm" /> Submit a paper
          </a>
        </div>
      )}

      <style>{FILTER_STYLES}</style>
    </section>
  );
}

const FILTER_STYLES = `
  .res-filter-bar {
    display: flex; flex-wrap: wrap; gap: .6rem;
    align-items: center; margin-bottom: .85rem;
  }
  .res-search {
    flex: 1 1 240px;
    display: flex; align-items: center; gap: .5rem;
    padding: .55rem .75rem;
    background: var(--card); border: 1px solid var(--border);
    border-radius: .5rem;
    color: var(--muted-foreground);
    transition: border-color .12s, box-shadow .12s;
  }
  .res-search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.36 0.13 255 / .12); }
  .res-search input {
    flex: 1; border: 0; background: transparent; outline: none;
    font: inherit; font-size: .9rem; color: var(--foreground);
  }
  .res-filter-bar select {
    padding: .5rem .65rem;
    background: var(--card); border: 1px solid var(--border);
    border-radius: .5rem; font: inherit; font-size: .85rem;
    color: var(--foreground); cursor: pointer;
  }
  .res-sort {
    display: inline-flex; padding: 2px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: .5rem;
  }
  .res-sort-btn {
    padding: .35rem .8rem; font-size: .8rem; font-weight: 600;
    background: transparent; border: 0; color: var(--muted-foreground);
    border-radius: .35rem; cursor: pointer;
  }
  .res-sort-btn.is-active {
    background: var(--primary); color: white;
  }

  .res-topic-row {
    display: flex; flex-wrap: wrap; gap: .35rem;
    align-items: center;
    margin-bottom: 1rem;
  }
  .res-topic-chip {
    padding: .25rem .65rem;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 999px; cursor: pointer;
    font-size: .76rem; font-weight: 600; color: var(--foreground);
    display: inline-flex; align-items: center; gap: .35rem;
    transition: all .12s;
  }
  .res-topic-chip:hover { border-color: var(--primary); color: var(--primary); }
  .res-topic-chip.is-active {
    background: var(--primary); border-color: var(--primary); color: white;
  }
  .res-topic-n {
    font-size: .65rem; padding: 1px 5px;
    background: rgba(255,255,255,.22); border-radius: 999px;
  }
  .res-topic-chip:not(.is-active) .res-topic-n {
    background: var(--background); color: var(--muted-foreground);
  }
  .res-clear-btn {
    margin-left: auto; background: transparent; border: 0;
    color: var(--primary); font-size: .78rem; font-weight: 600;
    cursor: pointer; padding: .25rem .5rem;
  }

  .res-result-meta {
    font-size: .78rem; color: var(--muted-foreground);
    margin-bottom: .85rem; display: flex; gap: .35rem; align-items: center;
  }
  .res-inline-clear {
    background: transparent; border: 0; color: var(--primary);
    font: inherit; font-size: .78rem; cursor: pointer; padding: 0;
  }

  .res-disclaimer {
    background: oklch(0.85 0.16 90 / 0.3);
    border: 1px solid oklch(0.85 0.16 90 / 0.6);
    border-radius: .5rem;
    padding: .75rem .9rem;
    margin: .25rem 0 1rem;
    font-size: .78rem;
    color: var(--foreground);
  }

  .res-empty {
    padding: 2.5rem 1rem; text-align: center;
    background: var(--card); border: 1px dashed var(--border);
    border-radius: .55rem;
    display: flex; flex-direction: column; gap: .85rem; align-items: center;
  }
  .res-empty p { margin: 0; color: var(--muted-foreground); font-size: .9rem; }

  .pp-details-link {
    font-size: .76rem; color: var(--muted-foreground);
    cursor: pointer; padding: .25rem .35rem; border-radius: .3rem;
    transition: color .12s, background .12s;
  }
  .pp-details-link:hover { color: var(--primary); background: var(--background); }
`;
