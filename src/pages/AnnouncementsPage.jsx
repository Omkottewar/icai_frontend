import { useMemo } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useSiteContent } from '../hooks/useSiteContent';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import { IconCalendar, IconArrowRight } from '../icons';
import { renderMarkdown } from '../lib/markdown.jsx';

// Public announcements archive. Vertical numbered list — denser and more
// scannable than a card grid. Newest first (the API already sorts by
// display_order + created_at desc, so we just render what we get).

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium' });
}

function AnnouncementRow({ index, item }) {
  const startDate = fmtDate(item.starts_at);
  const endDate = fmtDate(item.ends_at);
  // Prefer the attached file (PDF) over a generic external link. If
  // neither is set the row stays passive — body has the detail.
  const targetUrl = item.file_url || item.link_url || null;
  const isPdf = !!item.file_url
    || (item.link_url || '').toLowerCase().endsWith('.pdf');
  const hasLink = !!targetUrl;
  const Wrapper = hasLink ? 'a' : 'article';
  const wrapperProps = hasLink
    ? { href: targetUrl, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper {...wrapperProps} className={'ann-row' + (hasLink ? ' ann-row-link' : '')}>
      <div className="ann-num" aria-hidden="true">{index}</div>
      <div className="ann-content">
        <div className="ann-meta">
          {startDate && (
            <span className="ann-date">
              <IconCalendar size="sm" /> {startDate}
              {endDate && endDate !== startDate ? ` – ${endDate}` : ''}
            </span>
          )}
          {item.file_url && (
            <span className="ann-pdf-tag" aria-label="Has PDF attachment">📎 PDF</span>
          )}
        </div>
        <h2 className="ann-title">{item.title}</h2>
        {item.body && <div className="ann-body">{renderMarkdown(item.body)}</div>}
        {hasLink && (
          <span className="ann-cta">
            {isPdf ? 'Open PDF' : 'Read more'} <IconArrowRight size="sm" />
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export default function AnnouncementsPage() {
  const { data, loading, error } = useAnnouncements();
  const header = useSiteContent('announcements_page_header');
  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <section className="container" style={{ padding: 'clamp(1.5rem, 4vw, 2.5rem) 1rem' }}>
        {loading && (
          <ol className="ann-list" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="ann-row" style={{ pointerEvents: 'none' }}>
                <div className="ann-num">{i + 1}</div>
                <div className="ann-content">
                  <Shimmer height=".75rem" width="8rem" />
                  <Shimmer height="1.125rem" width="65%" />
                  <ShimmerLines count={2} />
                </div>
              </li>
            ))}
          </ol>
        )}

        {!loading && error && (
          <div className="alert alert-error">
            Couldn't load announcements. Please refresh and try again.
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="ann-empty">
            <h2>{header.empty_state_heading}</h2>
            <div className="muted-text">
              {renderMarkdown(header.empty_state_body)}
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ol className="ann-list">
            {items.map((item, i) => (
              <li key={item.id}>
                <AnnouncementRow index={i + 1} item={item} />
              </li>
            ))}
          </ol>
        )}

        {!loading && items.length > 0 && (
          <p className="muted-text" style={{ marginTop: '1.25rem', fontSize: '.8125rem', textAlign: 'center' }}>
            Showing {items.length} active announcement{items.length === 1 ? '' : 's'}.
          </p>
        )}
      </section>

      <style>{`
        .ann-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: .625rem;
        }
        .ann-row {
          display: grid;
          grid-template-columns: 2.75rem 1fr;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .625rem;
          color: inherit;
          text-decoration: none;
          transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
        }
        .ann-row-link:hover,
        .ann-row-link:focus-visible {
          border-color: oklch(0.36 0.13 255 / 0.45);
          box-shadow: 0 6px 18px -10px oklch(0.18 0.05 250 / 0.25);
          transform: translateY(-1px);
          outline: none;
        }
        .ann-row-link:hover .ann-num,
        .ann-row-link:focus-visible .ann-num {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .ann-num {
          flex: 0 0 auto;
          width: 2.5rem;
          height: 2.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: oklch(0.93 0.04 255);
          color: var(--primary);
          font-weight: 700;
          font-size: .9375rem;
          font-variant-numeric: tabular-nums;
          transition: background .15s ease, color .15s ease;
        }
        .ann-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: .375rem;
        }
        .ann-meta {
          display: flex;
          align-items: center;
          gap: .75rem;
          flex-wrap: wrap;
          font-size: .75rem;
          color: var(--muted-foreground);
        }
        .ann-date {
          display: inline-flex;
          align-items: center;
          gap: .35rem;
        }
        .ann-pdf-tag {
          display: inline-flex;
          align-items: center;
          gap: .2rem;
          font-size: .6875rem;
          font-weight: 700;
          letter-spacing: .04em;
          padding: .1rem .4rem;
          border-radius: 999px;
          background: oklch(0.95 0.04 25);
          color: oklch(0.45 0.18 25);
        }
        .ann-title {
          margin: 0;
          font-size: 1.0625rem;
          font-weight: 700;
          line-height: 1.35;
          color: var(--foreground);
          letter-spacing: -.005em;
        }
        .ann-row-link:hover .ann-title,
        .ann-row-link:focus-visible .ann-title {
          color: var(--primary);
        }
        .ann-body {
          font-size: .9375rem;
          line-height: 1.55;
          color: var(--muted-foreground);
        }
        .ann-body p { margin: 0 0 .35rem; }
        .ann-body p:last-child { margin-bottom: 0; }
        .ann-cta {
          margin-top: .125rem;
          display: inline-flex;
          align-items: center;
          gap: .35rem;
          font-weight: 600;
          font-size: .8125rem;
          color: var(--primary);
        }
        .ann-empty {
          text-align: center;
          padding: 3rem 1rem;
          max-width: 32rem;
          margin: 0 auto;
        }
        .ann-empty h2 {
          margin: 0 0 .5rem;
          font-size: 1.125rem;
          font-weight: 600;
        }
        @media (max-width: 540px) {
          .ann-row {
            grid-template-columns: 2.25rem 1fr;
            gap: .75rem;
            padding: .875rem 1rem;
          }
          .ann-num { width: 2rem; height: 2rem; font-size: .875rem; }
          .ann-title { font-size: 1rem; }
        }
      `}</style>
    </>
  );
}
