import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { IconCalendar, IconX } from '../icons';

const ALL_COMMITTEES = ['All', 'CPE', 'WICASA', 'GST', 'Direct Tax', 'Audit', 'IT', 'Branch'];

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

// Full-screen zoom of one photo with ← → keyboard nav. Lives nested inside
// the album lightbox so the user can browse the album without dismissing.
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

// Lightbox grid of real photos for an album. Lazy-loaded from /api on open.
function AlbumLightbox({ album, onClose }) {
  const [photos, setPhotos] = useState(null);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(null); // index into photos[]

  useEffect(() => {
    let cancelled = false;
    api(`/api/gallery-albums/${album.id}`)
      .then((j) => { if (!cancelled) setPhotos(j.photos || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [album.id]);

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
        maxWidth: '880px',
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
            <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setZoom(i)}
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
                  {p.thumb_url ? (
                    <img
                      src={p.thumb_url}
                      srcSet={`${p.thumb_url} 240w, ${p.medium_url} 800w`}
                      sizes="(max-width: 600px) 140px, 200px"
                      alt={p.alt || p.caption || ''}
                      loading="lazy"
                      width={p.width || undefined}
                      height={p.height || undefined}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Nested full-size zoom modal with ← → keyboard nav */}
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

export default function PhotoGalleryPage() {
  const [filter, setFilter] = useState('All');
  const [open, setOpen]     = useState(null);
  const [albums, setAlbums] = useState(null);
  const [err, setErr]       = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/api/gallery-albums')
      .then((j) => { if (!cancelled) setAlbums(j.items || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  const visible = (albums || []).filter(
    (a) => filter === 'All' || a.committee_tag === filter,
  );

  return (
    <>
      <PageHeader title="Photo Gallery" subtitle="Event photos from programmes organised by the Nagpur Branch" />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>

        <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: '2rem' }}>
          {ALL_COMMITTEES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={'btn ' + (filter === c ? 'btn-primary' : 'btn-outline')}
              style={{ padding: '.35rem .9rem', borderRadius: 999, fontSize: '.8125rem' }}
            >
              {c}
            </button>
          ))}
        </div>

        {err && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{err}</p>}

        {albums === null ? (
          <p className="muted-text">Loading albums…</p>
        ) : visible.length === 0 ? (
          <p className="muted-text">
            {albums.length === 0
              ? 'No albums published yet. Photos will appear here once the office uploads them.'
              : 'No albums found for this committee.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {visible.map((a) => {
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
                    {a.committee_tag && (
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
                        {a.committee_tag}
                      </span>
                    )}
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
        )}
      </section>

      {open && <AlbumLightbox album={open} onClose={() => setOpen(null)} />}
    </>
  );
}
