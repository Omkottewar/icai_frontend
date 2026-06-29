import { useEffect, useState } from 'react';
import { IconArrowRight, IconCalendar } from '../../icons';

// Recent Photos strip — surfaces the 4 most-recent gallery albums on the
// home page, drawing visitors into /gallery. Inspired by nagpuricai.org's
// homepage carousel, but using our committee-coloured album cards.
//
// Self-contained: fetches /api/gallery-albums on mount, picks the four
// chronologically newest, renders a horizontal strip. Hidden entirely if
// the gallery has no albums yet — no empty-state spam on the home page.

const COMMITTEE_COLORS = {
  GST:          { color: '#16a34a', bg: '#f0fdf4' },
  'Direct Tax': { color: '#ea580c', bg: '#fff7ed' },
  IT:           { color: '#4f46e5', bg: '#eef2ff' },
  Audit:        { color: '#0891b2', bg: '#ecfeff' },
  CPE:          { color: '#2563eb', bg: '#eff6ff' },
  WICASA:       { color: '#7c3aed', bg: '#f5f3ff' },
  Branch:       { color: '#6b7280', bg: '#f9fafb' },
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function RecentPhotosStrip({ limit = 4 }) {
  const [albums, setAlbums] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gallery-albums', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((j) => {
        if (cancelled) return;
        // Sort newest-first by occurred_on (fall back to created order from
        // the API, which is sort_order then occurred_on desc).
        const sorted = [...(j.items || [])].sort((a, b) => {
          const da = a.occurred_on ? new Date(a.occurred_on).getTime() : 0;
          const db = b.occurred_on ? new Date(b.occurred_on).getTime() : 0;
          return db - da;
        });
        setAlbums(sorted.slice(0, limit));
      })
      .catch(() => { if (!cancelled) setAlbums([]); });
    return () => { cancelled = true; };
  }, [limit]);

  // Hide entirely when there's nothing to show — no half-empty section on
  // home. Same is true while loading: avoids a flash of empty cards.
  if (albums === null || albums.length === 0) return null;

  return (
    <section className="container" style={{ padding: 'clamp(2.5rem, 6vw, 5rem) 1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'clamp(1.5rem, 3vw, 2rem)' }}>
        <div>
          <div className="tiny-eyebrow">From the gallery</div>
          <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>
            Recent events in pictures
          </h2>
        </div>
        <a href="/gallery" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '.9375rem', whiteSpace: 'nowrap' }}>
          View all <IconArrowRight size="sm" />
        </a>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {albums.map((a) => {
          const meta = COMMITTEE_COLORS[a.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };
          return (
            <a
              key={a.id}
              href="/gallery"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '.75rem',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'transform .15s, box-shadow .15s',
              }}
              className="hover-lift"
            >
              <div style={{ height: '9rem', background: `linear-gradient(135deg, ${meta.bg}, ${meta.color}22)` }}>
                {a.cover_thumb_url || a.cover_url ? (
                  <img
                    src={a.cover_thumb_url || a.cover_url}
                    srcSet={a.cover_medium_url ? `${a.cover_thumb_url || a.cover_url} 240w, ${a.cover_medium_url} 800w` : undefined}
                    sizes="(max-width: 600px) 220px, 300px"
                    alt={a.cover_alt || a.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, fontWeight: 700, fontSize: '.75rem' }}>
                    {a.photo_count ?? 0} photo{a.photo_count === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              <div style={{ padding: '.85rem 1rem 1rem' }}>
                {a.committee_tag && (
                  <span style={{
                    display: 'inline-block',
                    padding: '.1rem .45rem',
                    borderRadius: '.25rem',
                    fontSize: '.65rem',
                    fontWeight: 600,
                    background: meta.bg,
                    color: meta.color,
                    marginBottom: '.4rem',
                  }}>
                    {a.committee_tag}
                  </span>
                )}
                <h3 style={{ fontWeight: 600, fontSize: '.9rem', lineHeight: 1.3, margin: 0 }}>{a.title}</h3>
                <div className="row gap-1 muted-text" style={{ marginTop: '.4rem', fontSize: '.7rem', alignItems: 'center' }}>
                  <IconCalendar size="sm" />
                  {fmtDate(a.occurred_on)}
                  {a.photo_count != null && (
                    <> · {a.photo_count} photo{a.photo_count === 1 ? '' : 's'}</>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
