import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { IconCalendar, IconX } from '../icons';

// Photo Gallery v2 — admin-curated layout.
//
// Page composition (top-to-bottom):
//   1. Featured hero strip — up to 4 admin-picked albums. Position 1 is
//      the big hero tile (60% of the row), 2-4 sit alongside as side
//      tiles. Falls back to chronological if nothing's featured.
//   2. Committee filter chips
//   3. Album grid (everything not in the hero, plus the featured ones
//      themselves — finding a pinned album by committee filter should
//      still work).
//
// Album detail lightbox respects the album's `layout` field:
//   • grid    — uniform thumbnails (the default; fast + scannable)
//   • masonry — waterfall that respects aspect ratios; `is_featured`
//               photos render at 2× width to break the rhythm
//   • story   — full-width single column with the caption rendered
//               between photos for narrative recap albums

const ALL_COMMITTEES = ['All', 'CPE', 'WICASA', 'GST', 'Direct Tax', 'Audit', 'IT', 'Branch'];

// Orthogonal to committees. Used by both photo albums and videos so members
// can filter "show only Sports" or "show only Press coverage" regardless of
// which committee organised it.
const ALL_EVENT_TYPES = ['All', 'Technical', 'Cultural', 'Sports', 'Press', 'Social', 'Visit', 'Other'];

const COMMITTEE_COLORS = {
  GST:          { color: '#16a34a', bg: '#f0fdf4' },
  'Direct Tax': { color: '#ea580c', bg: '#fff7ed' },
  IT:           { color: '#4f46e5', bg: '#eef2ff' },
  Audit:        { color: '#0891b2', bg: '#ecfeff' },
  CPE:          { color: '#2563eb', bg: '#eff6ff' },
  WICASA:       { color: '#7c3aed', bg: '#f5f3ff' },
  Branch:       { color: '#6b7280', bg: '#f9fafb' },
};

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Single-photo zoom modal (← → keyboard nav) ──────────────────────────

function ZoomLightbox({ photos, index, onClose, onIndex }) {
  const p = photos[index];
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      onClose();
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft'  && index > 0)                 onIndex(index - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onIndex]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 110, cursor: 'zoom-out', padding: '1rem', flexDirection: 'column',
      }}
    >
      <img
        src={p.url}
        srcSet={`${p.medium_url} 800w, ${p.url} 1600w`}
        sizes="100vw"
        alt={p.alt || p.caption || ''}
        style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
      />
      {(p.caption || p.alt) && (
        <div style={{ color: 'white', fontSize: '.85rem', marginTop: '.75rem', textAlign: 'center', maxWidth: '60ch' }}>
          {p.caption || p.alt}
        </div>
      )}
      <div style={{ color: 'rgba(255,255,255,.65)', fontSize: '.7rem', marginTop: '.5rem' }}>
        {index + 1} / {photos.length} · ← → to navigate, Esc to close
      </div>
    </div>
  );
}

// ─── Photo collection renderers per layout type ──────────────────────────
//
// Each takes the photos array + an onPick(index) handler. They're broken
// out so the AlbumLightbox stays a simple switch instead of three nested
// conditionals.

function GridPhotos({ photos, onPick }) {
  return (
    <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
      {photos.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onPick(i)}
          title={p.caption || p.alt || ''}
          style={{
            aspectRatio: '4/3',
            border: '1px solid var(--border)',
            borderRadius: '.375rem',
            overflow: 'hidden',
            cursor: 'zoom-in',
            padding: 0,
            background: 'var(--muted)',
          }}
        >
          {p.thumb_url && (
            <img
              src={p.thumb_url}
              srcSet={`${p.thumb_url} 240w, ${p.medium_url} 800w`}
              sizes="(max-width: 600px) 140px, 200px"
              alt={p.alt || p.caption || ''}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function MasonryPhotos({ photos, onPick }) {
  // CSS columns give us a real masonry without JS measurement. Avoid
  // breaking a photo across columns by setting `break-inside: avoid`.
  // Featured photos span two columns by being inside a separate full-row
  // strip so they don't break the column flow.
  //
  // We split the photos into "feature rows" (every featured photo is its
  // own row, 2× the column width) and "regular runs" (the unfeatured
  // photos between them flow through CSS columns).
  const rows = useMemo(() => {
    const out = [];
    let bucket = [];
    photos.forEach((p) => {
      if (p.is_featured) {
        if (bucket.length) { out.push({ kind: 'run', items: bucket }); bucket = []; }
        out.push({ kind: 'feature', item: p });
      } else {
        bucket.push(p);
      }
    });
    if (bucket.length) out.push({ kind: 'run', items: bucket });
    return out;
  }, [photos]);

  // The photos array is the ordered list shown in the zoom modal, but
  // pickIndex needs to match that order — which it does because we don't
  // reorder, just group. We can therefore look up the index by reference.
  const indexOf = (p) => photos.indexOf(p);

  return (
    <div className="gal-masonry">
      {rows.map((row, idx) => (
        row.kind === 'feature' ? (
          <button
            key={row.item.id}
            onClick={() => onPick(indexOf(row.item))}
            className="gal-mason-feature"
            title={row.item.caption || row.item.alt || ''}
          >
            <img
              src={row.item.medium_url || row.item.thumb_url}
              alt={row.item.alt || row.item.caption || ''}
              loading="lazy"
            />
            {row.item.caption && <div className="gal-mason-caption">{row.item.caption}</div>}
          </button>
        ) : (
          <div key={`run-${idx}`} className="gal-mason-cols">
            {row.items.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(indexOf(p))}
                className="gal-mason-item"
                title={p.caption || p.alt || ''}
              >
                <img
                  src={p.thumb_url || p.medium_url}
                  srcSet={`${p.thumb_url || p.medium_url} 240w, ${p.medium_url || p.url} 800w`}
                  sizes="(max-width: 600px) 50vw, 240px"
                  alt={p.alt || p.caption || ''}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )
      ))}
      <style>{`
        .gal-masonry { display: flex; flex-direction: column; gap: .75rem; }
        .gal-mason-cols {
          column-count: 3;
          column-gap: .5rem;
        }
        @media (max-width: 720px) { .gal-mason-cols { column-count: 2; } }
        .gal-mason-item {
          display: block; width: 100%;
          margin: 0 0 .5rem; padding: 0;
          background: transparent; border: 0; cursor: zoom-in;
          break-inside: avoid;
          border-radius: .375rem; overflow: hidden;
        }
        .gal-mason-item img { width: 100%; height: auto; display: block; }
        .gal-mason-feature {
          display: block; width: 100%;
          margin: 0; padding: 0;
          background: transparent; border: 0; cursor: zoom-in;
          border-radius: .5rem; overflow: hidden;
          position: relative;
        }
        .gal-mason-feature img { width: 100%; height: auto; display: block; }
        .gal-mason-caption {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 1rem .85rem .65rem;
          color: white; font-size: .875rem; text-align: left;
          background: linear-gradient(to top, rgba(0,0,0,.65), transparent);
        }
      `}</style>
    </div>
  );
}

function StoryPhotos({ photos, onPick }) {
  // Single-column narrative layout. Caption is rendered as a block under
  // each photo (not overlaid) so longer captions are readable. Best for
  // recap albums ("Year in review", "Branch milestones").
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {photos.map((p, i) => (
        <figure key={p.id} style={{ margin: 0 }}>
          <button
            onClick={() => onPick(i)}
            style={{
              display: 'block', width: '100%', padding: 0, margin: 0,
              background: 'transparent', border: 0, cursor: 'zoom-in',
              borderRadius: '.5rem', overflow: 'hidden',
            }}
          >
            <img
              src={p.medium_url || p.url}
              alt={p.alt || p.caption || ''}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '.5rem' }}
            />
          </button>
          {p.caption && (
            <figcaption style={{
              marginTop: '.55rem',
              fontSize: '.9rem',
              lineHeight: 1.55,
              color: 'var(--foreground)',
              fontStyle: 'italic',
              maxWidth: '60ch',
            }}>
              {p.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

// ─── Lightbox for an album ───────────────────────────────────────────────

function AlbumLightbox({ album, onClose }) {
  const [albumDetail, setAlbumDetail] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/gallery-albums/${album.id}`)
      .then((j) => {
        if (cancelled) return;
        setAlbumDetail(j.album);
        setPhotos(j.photos || []);
      })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [album.id]);

  // Detail's layout overrides the list-level value (list might be stale
  // by milliseconds after an admin edit). Fall back to the list copy if
  // the detail hasn't loaded yet — the layout is purely visual so a
  // transient mismatch is fine.
  const layout = (albumDetail?.layout || album.layout || 'grid');
  const meta = COMMITTEE_COLORS[album.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card)',
        borderRadius: '1rem',
        padding: '1.5rem',
        width: '100%',
        maxWidth: layout === 'story' ? '720px' : '960px',
        maxHeight: '92vh',
        overflowY: 'auto',
      }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            {album.committee_tag && (
              <span style={{
                display: 'inline-block',
                padding: '.1rem .45rem',
                borderRadius: '.25rem',
                fontSize: '.7rem',
                fontWeight: 600,
                background: meta.bg,
                color: meta.color,
                marginBottom: '.5rem',
              }}>
                {album.committee_tag}
              </span>
            )}
            <h2 style={{ fontWeight: 700, fontSize: '1.125rem' }}>{album.title}</h2>
            <div className="row gap-2 muted-text" style={{ marginTop: '.25rem', fontSize: '.8125rem' }}>
              <IconCalendar size="sm" />
              {fmtDate(album.occurred_on)}
              {album.photo_count != null && (
                <> · {album.photo_count} photo{album.photo_count === 1 ? '' : 's'}</>
              )}
            </div>
            {album.description && (
              <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.85rem' }}>{album.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '.375rem', borderRadius: '.375rem', flexShrink: 0 }}
          >
            <IconX size="sm" />
          </button>
        </div>

        {err && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{err}</p>}

        {photos === null ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>No photos uploaded for this album yet.</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.5rem' }}>
              <a
                href={`/api/gallery-albums/${album.id}/download.zip`}
                className="btn btn-outline"
                style={{ fontSize: '.8rem', padding: '.4rem .75rem' }}
              >
                Download album (.zip)
              </a>
            </div>
            {layout === 'masonry' ? (
              <MasonryPhotos photos={photos} onPick={setZoom} />
            ) : layout === 'story' ? (
              <StoryPhotos photos={photos} onPick={setZoom} />
            ) : (
              <GridPhotos photos={photos} onPick={setZoom} />
            )}
          </>
        )}

        {zoom !== null && photos && photos[zoom] && (
          <ZoomLightbox
            photos={photos}
            index={zoom}
            onClose={() => setZoom(null)}
            onIndex={setZoom}
          />
        )}
      </div>
    </div>
  );
}

// ─── Featured hero strip ─────────────────────────────────────────────────
// 1 big hero tile (position 1) + up to 3 sidekick tiles (positions 2-4).
// If the admin only set positions 1+2, the right column collapses to a
// single tall tile. If only position 1 is set, hero takes the full row.

function FeaturedHero({ albums, onOpen }) {
  if (!albums || albums.length === 0) return null;
  const hero  = albums.find((a) => a.featured_position === 1) || albums[0];
  const sides = albums.filter((a) => a !== hero).slice(0, 3);

  const tile = (a, opts = {}) => {
    const meta = COMMITTEE_COLORS[a.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };
    return (
      <button
        key={a.id}
        onClick={() => onOpen(a)}
        className="gal-feat-tile"
        style={{
          height: opts.tall ? '100%' : opts.short ? '11rem' : '23.5rem',
          background: `linear-gradient(135deg, ${meta.bg}, ${meta.color}22)`,
        }}
      >
        {(a.cover_medium_url || a.cover_url) && (
          <img
            src={a.cover_medium_url || a.cover_url}
            alt={a.cover_alt || a.title}
            loading="lazy"
            className="gal-feat-img"
          />
        )}
        <div className="gal-feat-overlay">
          {a.committee_tag && (
            <span className="gal-feat-chip" style={{ background: meta.bg, color: meta.color }}>
              {a.committee_tag}
            </span>
          )}
          <h3 className="gal-feat-title" style={opts.short ? { fontSize: '.95rem' } : null}>
            {a.title}
          </h3>
          <div className="gal-feat-meta">
            {fmtDate(a.occurred_on)}
            {a.photo_count != null && <> · {a.photo_count} photos</>}
          </div>
        </div>
      </button>
    );
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div className="gal-feat-grid">
        <div className="gal-feat-hero-col">{tile(hero, { short: false })}</div>
        {sides.length > 0 && (
          <div className="gal-feat-side-col">
            {sides.map((a) => tile(a, { short: true }))}
          </div>
        )}
      </div>
      <style>{`
        .gal-feat-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        @media (min-width: 768px) {
          .gal-feat-grid { grid-template-columns: 3fr 2fr; }
        }
        .gal-feat-side-col {
          display: grid; gap: 1rem;
          grid-auto-rows: 1fr;
        }
        .gal-feat-tile {
          position: relative; width: 100%;
          border: 1px solid var(--border); border-radius: .75rem;
          overflow: hidden; cursor: pointer; padding: 0;
          text-align: left; color: white;
          transition: transform .15s, box-shadow .15s;
        }
        .gal-feat-tile:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(15,23,42,.18); }
        .gal-feat-img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .gal-feat-overlay {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 1.1rem 1.1rem .85rem;
          background: linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.25) 60%, transparent 100%);
          color: white;
        }
        .gal-feat-chip {
          display: inline-block;
          padding: .1rem .5rem;
          border-radius: .3rem;
          font-size: .68rem;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
          margin-bottom: .35rem;
        }
        .gal-feat-title {
          font-weight: 700; font-size: 1.25rem; line-height: 1.25;
          margin: 0;
        }
        .gal-feat-meta {
          margin-top: .35rem;
          font-size: .78rem; opacity: .85;
        }
      `}</style>
    </section>
  );
}

// ─── Video Gallery ───────────────────────────────────────────────────────
// Each card renders a thumbnail (poster_url, or YouTube/Vimeo default).
// Click opens an inline player modal with the right embed URL for the
// provider. External providers fall back to opening the URL in a new tab.

function videoEmbedUrl(v) {
  if (v.provider === 'youtube') return `https://www.youtube.com/embed/${v.video_id}?autoplay=1&rel=0`;
  if (v.provider === 'vimeo')   return `https://player.vimeo.com/video/${v.video_id}?autoplay=1`;
  return null;
}

function videoThumbUrl(v) {
  if (v.poster_thumb_url) return v.poster_thumb_url;
  if (v.poster_url)       return v.poster_url;
  if (v.provider === 'youtube') return `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`;
  return null;
}

function VideoPlayerModal({ video, onClose }) {
  const url = videoEmbedUrl(video);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // External provider — no in-page embed, open in a new tab and dismiss.
  useEffect(() => {
    if (!url && video?.video_url) {
      window.open(video.video_url, '_blank', 'noopener,noreferrer');
      onClose();
    }
  }, [url, video, onClose]);

  if (!url) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 110, padding: '1rem', flexDirection: 'column',
      }}
    >
      <div style={{ width: '100%', maxWidth: '960px', aspectRatio: '16/9', background: '#000', borderRadius: '.75rem', overflow: 'hidden' }}>
        <iframe
          src={url}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>
      <div style={{ color: 'white', marginTop: '1rem', maxWidth: '960px', width: '100%' }}>
        <h3 style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>{video.title}</h3>
        {video.description && (
          <p style={{ marginTop: '.4rem', fontSize: '.875rem', opacity: .85, lineHeight: 1.5 }}>{video.description}</p>
        )}
        <div style={{ marginTop: '.4rem', fontSize: '.75rem', opacity: .7 }}>
          {fmtDate(video.occurred_on)} · Esc to close
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onPlay }) {
  const meta = COMMITTEE_COLORS[video.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };
  const thumb = videoThumbUrl(video);
  return (
    <button
      onClick={() => onPlay(video)}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '.75rem',
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
      }}
      className="hover-lift"
    >
      <div style={{ position: 'relative', height: '10rem', background: '#0f172a' }}>
        {thumb && (
          <img
            src={thumb}
            alt={video.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {/* Play overlay — always visible so the card reads as "video" */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.45) 100%)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,.4)',
          }}>
            <span style={{ marginLeft: 4, fontSize: 0, borderLeft: '18px solid #0f172a', borderTop: '12px solid transparent', borderBottom: '12px solid transparent' }} />
          </div>
        </div>
        {video.duration_secs > 0 && (
          <span style={{
            position: 'absolute', bottom: '.5rem', right: '.5rem',
            background: 'rgba(0,0,0,.75)', color: 'white',
            padding: '.15rem .4rem', borderRadius: '.25rem',
            fontSize: '.7rem', fontWeight: 600,
          }}>
            {Math.floor(video.duration_secs / 60)}:{String(video.duration_secs % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div style={{ padding: '1rem' }}>
        {video.committee_tag && (
          <span style={{
            display: 'inline-block',
            padding: '.1rem .45rem',
            borderRadius: '.25rem',
            fontSize: '.7rem',
            fontWeight: 600,
            background: meta.bg,
            color: meta.color,
            marginBottom: '.5rem',
          }}>
            {video.committee_tag}
          </span>
        )}
        <h3 style={{ fontWeight: 600, fontSize: '.9375rem', lineHeight: 1.3 }}>{video.title}</h3>
        <div className="row gap-2 muted-text" style={{ marginTop: '.5rem', fontSize: '.75rem' }}>
          <IconCalendar size="sm" />
          {fmtDate(video.occurred_on)}
        </div>
      </div>
    </button>
  );
}

// ─── Filter row ──────────────────────────────────────────────────────────
// Small reusable chip group. Used for committees, event types, and years.

function FilterChips({ label, options, value, onChange }) {
  if (!options || options.length <= 1) return null;
  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: '.85rem' }}>
      {label && (
        <span style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.04em', marginRight: '.25rem' }}>
          {label}
        </span>
      )}
      {options.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={'btn ' + (value === c ? 'btn-primary' : 'btn-outline')}
          style={{ padding: '.3rem .75rem', borderRadius: 999, fontSize: '.78rem' }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function PhotoGalleryPage() {
  const pageHeader = useSiteContent('photo_gallery_page_header');
  const [tab, setTab]                 = useState('photos');     // 'photos' | 'videos'
  const [committee, setCommittee]     = useState('All');
  const [eventType, setEventType]     = useState('All');
  const [year, setYear]               = useState('All');
  const [open, setOpen]               = useState(null);         // album for lightbox
  const [albums, setAlbums]           = useState(null);
  const [featured, setFeatured]       = useState([]);
  const [videos, setVideos]           = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [err, setErr]                 = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/api/gallery-albums')
      .then((j) => {
        if (cancelled) return;
        setAlbums(j.items || []);
        setFeatured(j.featured || []);
      })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  // Lazy-load videos on first Videos tab click — keeps the Photos tab a
  // single round-trip and avoids fetching the videos feed at all when
  // visitors never switch tabs.
  useEffect(() => {
    if (tab !== 'videos' || videos !== null) return;
    let cancelled = false;
    api('/api/gallery-videos')
      .then((j) => { if (!cancelled) setVideos(j.items || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [tab, videos]);

  // Year chips are derived from whichever feed is currently visible. We
  // recompute each render so an admin uploading a new album shows up in
  // the year list immediately after refetch.
  const yearsAvailable = useMemo(() => {
    const source = tab === 'videos' ? (videos || []) : (albums || []);
    const set = new Set();
    source.forEach((x) => {
      if (x.occurred_on) set.add(String(new Date(x.occurred_on).getFullYear()));
    });
    return ['All', ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, [tab, albums, videos]);

  // Reset year when switching tabs so a selection in Photos doesn't hide
  // every video on Videos when no video matches that year.
  useEffect(() => { setYear('All'); }, [tab]);

  function matches(x) {
    if (committee !== 'All' && x.committee_tag !== committee) return false;
    if (eventType !== 'All' && x.event_type    !== eventType) return false;
    if (year !== 'All') {
      const y = x.occurred_on ? String(new Date(x.occurred_on).getFullYear()) : '';
      if (y !== year) return false;
    }
    return true;
  }

  const visibleAlbums = (albums || []).filter(matches);
  const visibleVideos = (videos || []).filter(matches);

  return (
    <>
      <PageHeader title={pageHeader.title} subtitle={pageHeader.subtitle} />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        {/* Tabs — Photos / Videos */}
        <div className="row gap-2" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          {[
            { key: 'photos', label: 'Photo Gallery', count: albums?.length },
            { key: 'videos', label: 'Video Gallery', count: videos?.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'transparent',
                border: 0,
                padding: '.75rem 1.25rem',
                cursor: 'pointer',
                fontSize: '.95rem',
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--primary)' : 'var(--muted-foreground)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span style={{ marginLeft: '.4rem', fontSize: '.75rem', opacity: .7 }}>({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Hero strip only on the Photos tab and only if albums are featured. */}
        {tab === 'photos' && featured.length > 0 && (
          <FeaturedHero albums={featured} onOpen={setOpen} />
        )}

        {/* Filter rows — committee + event type + year, in that priority. */}
        <div style={{ marginBottom: '2rem' }}>
          <FilterChips label="Committee"  options={ALL_COMMITTEES}  value={committee} onChange={setCommittee} />
          <FilterChips label="Event type" options={ALL_EVENT_TYPES} value={eventType} onChange={setEventType} />
          <FilterChips label="Year"       options={yearsAvailable}  value={year}      onChange={setYear} />
        </div>

        {err && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{err}</p>}

        {/* Photos tab content */}
        {tab === 'photos' && (
          albums === null ? (
            <p className="muted-text">Loading albums…</p>
          ) : visibleAlbums.length === 0 ? (
            <p className="muted-text">
              {albums.length === 0
                ? 'No albums published yet. Photos will appear here once the office uploads them.'
                : 'No albums match the selected filters.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {visibleAlbums.map((a) => {
                const meta = COMMITTEE_COLORS[a.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };
                return (
                  <button
                    key={a.id}
                    onClick={() => setOpen(a)}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '.75rem',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'transform .15s, box-shadow .15s',
                      padding: 0,
                    }}
                    className="hover-lift"
                  >
                    <div style={{ height: '10rem', background: `linear-gradient(135deg, ${meta.bg}, ${meta.color}22)` }}>
                      {a.cover_thumb_url || a.cover_url ? (
                        <img
                          src={a.cover_thumb_url || a.cover_url}
                          srcSet={a.cover_medium_url ? `${a.cover_thumb_url || a.cover_url} 240w, ${a.cover_medium_url} 800w` : undefined}
                          sizes="(max-width: 600px) 280px, 400px"
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
                    <div style={{ padding: '1rem' }}>
                      <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: '.5rem' }}>
                        {a.committee_tag && (
                          <span style={{
                            display: 'inline-block',
                            padding: '.1rem .45rem',
                            borderRadius: '.25rem',
                            fontSize: '.7rem',
                            fontWeight: 600,
                            background: meta.bg,
                            color: meta.color,
                          }}>
                            {a.committee_tag}
                          </span>
                        )}
                        {a.event_type && (
                          <span style={{
                            display: 'inline-block',
                            padding: '.1rem .45rem',
                            borderRadius: '.25rem',
                            fontSize: '.7rem',
                            fontWeight: 600,
                            background: 'var(--muted)',
                            color: 'var(--foreground)',
                          }}>
                            {a.event_type}
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontWeight: 600, fontSize: '.9375rem', lineHeight: 1.3 }}>{a.title}</h3>
                      <div className="row gap-2 muted-text" style={{ marginTop: '.5rem', fontSize: '.75rem' }}>
                        <IconCalendar size="sm" />
                        {fmtDate(a.occurred_on)}
                        {a.photo_count != null && (
                          <> · {a.photo_count} photo{a.photo_count === 1 ? '' : 's'}</>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Videos tab content */}
        {tab === 'videos' && (
          videos === null ? (
            <p className="muted-text">Loading videos…</p>
          ) : visibleVideos.length === 0 ? (
            <p className="muted-text">
              {videos.length === 0
                ? 'No videos published yet. Recordings will appear here once the office uploads them.'
                : 'No videos match the selected filters.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {visibleVideos.map((v) => (
                <VideoCard key={v.id} video={v} onPlay={setPlayingVideo} />
              ))}
            </div>
          )
        )}
      </section>

      {open && <AlbumLightbox album={open} onClose={() => setOpen(null)} />}
      {playingVideo && <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />}
    </>
  );
}
