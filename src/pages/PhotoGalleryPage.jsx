import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { GALLERY_EVENTS } from '../data/constants';
import { IconCalendar, IconX } from '../icons';

const ALL_COMMITTEES = ['All', 'CPE', 'WICASA', 'GST', 'Direct Tax', 'Audit', 'IT', 'Branch'];

// Dummy photo placeholders for the lightbox grid
function PhotoPlaceholders({ count, color, bg }) {
  return (
    <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {Array.from({ length: Math.min(count, 12) }).map((_, i) => (
        <div
          key={i}
          style={{
            aspectRatio: '4/3',
            background: `linear-gradient(135deg, ${bg}, ${color}22)`,
            border: `1px solid ${color}33`,
            borderRadius: '.375rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '.625rem',
            color: color,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Photo {i + 1}
        </div>
      ))}
      {count > 12 && (
        <div style={{
          aspectRatio: '4/3',
          background: `${color}15`,
          border: `1px solid ${color}33`,
          borderRadius: '.375rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '.75rem',
          color: color,
          fontWeight: 700,
          cursor: 'pointer',
        }}>
          +{count - 12} more
        </div>
      )}
    </div>
  );
}

export default function PhotoGalleryPage() {
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(null); // selected album

  const visible = filter === 'All'
    ? GALLERY_EVENTS
    : GALLERY_EVENTS.filter((g) => g.committee === filter);

  return (
    <>
      <PageHeader title="Photo Gallery" subtitle="Event photos from programmes organised by the Nagpur Branch" />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>

        {/* Committee filter */}
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

        {/* Gallery grid */}
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {visible.map((g) => (
            <button
              key={g.title}
              onClick={() => setOpen(g)}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '.75rem',
                overflow: 'hidden',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'transform .15s, box-shadow .15s',
              }}
              className="hover-lift"
            >
              {/* Thumbnail strip */}
              <div style={{
                height: '10rem',
                background: `linear-gradient(135deg, ${g.bg}, ${g.color}22)`,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2px',
                padding: '2px',
              }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    background: i === 0
                      ? `linear-gradient(135deg, ${g.color}55, ${g.color}22)`
                      : `${g.color}${i === 1 ? '18' : '10'}`,
                    borderRadius: i === 0 ? '.25rem 0 0 .25rem' : i === 2 ? '0 .25rem .25rem 0' : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '.65rem',
                    color: g.color,
                    fontWeight: 700,
                    opacity: 1 - i * 0.25,
                  }}>
                    {i === 0 ? 'Photos' : ''}
                  </div>
                ))}
              </div>

              {/* Caption */}
              <div style={{ padding: '1rem' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '.1rem .45rem',
                  borderRadius: '.25rem',
                  fontSize: '.7rem',
                  fontWeight: 600,
                  background: g.bg,
                  color: g.color,
                  marginBottom: '.5rem',
                }}>
                  {g.committee}
                </span>
                <h3 style={{ fontWeight: 600, fontSize: '.9375rem', lineHeight: 1.3 }}>{g.title}</h3>
                <div className="row gap-2 muted-text" style={{ marginTop: '.5rem', fontSize: '.75rem' }}>
                  <IconCalendar size="sm" /> {g.date} · {g.photos} photos
                </div>
              </div>
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="muted-text">No albums found for this committee.</p>
        )}
      </section>

      {/* Album lightbox modal */}
      {open && (
        <div
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}
        >
          <div style={{
            background: 'var(--card)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '.1rem .45rem',
                  borderRadius: '.25rem',
                  fontSize: '.7rem',
                  fontWeight: 600,
                  background: open.bg,
                  color: open.color,
                  marginBottom: '.5rem',
                }}>
                  {open.committee}
                </span>
                <h2 style={{ fontWeight: 700, fontSize: '1.125rem' }}>{open.title}</h2>
                <div className="row gap-2 muted-text" style={{ marginTop: '.25rem', fontSize: '.8125rem' }}>
                  <IconCalendar size="sm" /> {open.date} · {open.photos} photos
                </div>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="btn btn-outline"
                style={{ padding: '.375rem', borderRadius: '.375rem', flexShrink: 0 }}
              >
                <IconX size="sm" />
              </button>
            </div>
            <PhotoPlaceholders count={open.photos} color={open.color} bg={open.bg} />
            <p className="muted-text" style={{ marginTop: '1rem', fontSize: '.75rem' }}>
              Showing {Math.min(open.photos, 12)} of {open.photos} photos. Full gallery accessible to logged-in members.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
