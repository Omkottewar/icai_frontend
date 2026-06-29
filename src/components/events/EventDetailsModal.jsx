import { useEffect } from 'react';
import {
  IconX, IconCalendar, IconClock, IconMapPin, IconUsers,
  IconAward, IconCheck, IconCheckCircle, IconMessageSquare,
} from '../../icons';
import { renderMarkdown } from '../../lib/markdown.jsx';
import { googleCalendarEventUrl } from '../../lib/googleCalendar';

function getMode(venue) {
  const v = (venue || '').toLowerCase();
  if (v.startsWith('online')) return 'Online';
  if (v.includes('hybrid')) return 'Hybrid';
  return 'Offline';
}

function rupees(paise) {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatRange(starts_at, ends_at) {
  if (!starts_at) return '';
  const s = new Date(starts_at);
  const dateStr = s.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const startTime = s.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (!ends_at) return `${dateStr} · ${startTime}`;
  const e = new Date(ends_at);
  const endTime = e.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const FALLBACK_BANNERS = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=960&h=480&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=960&h=480&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=960&h=480&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=960&h=480&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=960&h=480&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=960&h=480&q=80&auto=format&fit=crop',
];

// Banner uploads can be image OR video — mirrors the admin upload form
// which accepts both (mp4/webm/mov for video, jpeg/png/webp/gif for image).
function isVideoUrl(url) {
  if (typeof url !== 'string') return false;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function fallbackBanner(event) {
  return FALLBACK_BANNERS[hash(event?.title || '') % FALLBACK_BANNERS.length];
}

export default function EventDetailsModal({
  event,
  isRegistered = false,
  onClose,
  onRegister,
  onOpenChat,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Body scroll lock + scroll-chain containment are handled centrally
    // in styles/index.css via `body:has(.modal-backdrop)` and
    // `overscroll-behavior: contain` on .modal-backdrop — no per-modal JS.
  }, [onClose]);

  if (!event) return null;

  const mode = getMode(event.venue);
  const cap = Number(event.capacity ?? 0);
  const reg = Number(event.registered_count ?? 0);
  const seatsLeft = cap > 0 ? Math.max(0, cap - reg) : null;
  const isFull = cap > 0 && reg >= cap;
  const isPaid = Number(event.fee_paise || 0) > 0;
  const gcalUrl = googleCalendarEventUrl(event);

  return (
    <div
      className="modal-backdrop"
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
        style={{
          background: 'var(--card)',
          borderRadius: '.85rem',
          width: '100%',
          maxWidth: '44rem',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px oklch(0.18 0.05 250 / 0.4)',
          border: '1px solid var(--border)',
          position: 'relative',
        }}
      >
        {/* Banner — uses the uploaded image OR video from event creation.
            Videos render with native controls so users can play before
            registering. Falls back to a stock photo only when nothing was
            uploaded. */}
        <div style={{ position: 'relative' }}>
          {isVideoUrl(event.bannerUrl) ? (
            <video
              src={event.bannerUrl}
              controls
              playsInline
              preload="metadata"
              style={{
                width: '100%',
                height: 'clamp(180px, 32vw, 280px)',
                objectFit: 'cover',
                display: 'block',
                background: '#000',
                borderTopLeftRadius: '.85rem',
                borderTopRightRadius: '.85rem',
              }}
            />
          ) : (
            <img
              src={event.bannerUrl || fallbackBanner(event)}
              alt={event.title}
              loading="lazy"
              onError={(ev) => { ev.currentTarget.src = fallbackBanner(event); }}
              style={{
                width: '100%',
                height: 'clamp(140px, 28vw, 220px)',
                objectFit: 'cover',
                display: 'block',
                borderTopLeftRadius: '.85rem',
                borderTopRightRadius: '.85rem',
              }}
            />
          )}
          {/* Gradient overlay only on images — would obscure video controls. */}
          {!isVideoUrl(event.bannerUrl) && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.55) 100%)',
              borderTopLeftRadius: '.85rem',
              borderTopRightRadius: '.85rem',
              pointerEvents: 'none',
            }} />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: '.75rem', right: '.75rem',
              background: 'rgba(255,255,255,.92)', border: 'none',
              borderRadius: '999px', padding: '.4rem',
              cursor: 'pointer', color: 'var(--foreground)',
              boxShadow: '0 2px 6px rgba(0,0,0,.2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconX size="sm" />
          </button>
          {/* Title overlay only works on images — on a <video> it would
              cover the play/scrubber controls. For videos the title is
              rendered below the banner instead. */}
          {!isVideoUrl(event.bannerUrl) && (
          <div style={{
            position: 'absolute', left: '1.25rem', right: '1.25rem', bottom: '.85rem',
            color: 'white',
          }}>
            <div style={{
              display: 'inline-block', padding: '.15rem .55rem', borderRadius: 999,
              background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(4px)',
              fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em',
              textTransform: 'uppercase', marginBottom: '.4rem',
            }}>
              {event.committee || 'Event'}
            </div>
            <h2 id="event-details-title" style={{
              margin: 0, fontSize: 'clamp(1.125rem, 3.5vw, 1.5rem)',
              fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.01em',
              textShadow: '0 2px 8px rgba(0,0,0,.4)',
            }}>
              {event.title}
            </h2>
          </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          {/* Title block shown outside the banner for video uploads, so the
              video controls aren't obscured. */}
          {isVideoUrl(event.bannerUrl) && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="tiny-eyebrow" style={{ marginBottom: '.3rem' }}>
                {event.committee || 'Event'}
              </div>
              <h2 id="event-details-title" style={{
                margin: 0, fontSize: 'clamp(1.125rem, 3.5vw, 1.5rem)',
                fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.01em',
                color: 'var(--foreground)',
              }}>
                {event.title}
              </h2>
            </div>
          )}

          {/* Quick facts row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '.6rem .9rem',
            padding: '.85rem 1rem',
            background: 'var(--muted)',
            borderRadius: '.6rem',
            marginBottom: '1.1rem',
            fontSize: '.85rem',
          }}>
            <span className="row gap-2" style={{ color: 'var(--foreground)' }}>
              <IconCalendar size="sm" /> {formatRange(event.starts_at, event.ends_at)}
            </span>
            {event.time && !event.ends_at && (
              <span className="row gap-2" style={{ color: 'var(--foreground)' }}>
                <IconClock size="sm" /> {event.time}
              </span>
            )}
            <span className="row gap-2" style={{ color: 'var(--foreground)' }}>
              <IconMapPin size="sm" /> {event.venue || 'TBA'} · <em style={{ fontStyle: 'normal', opacity: .75 }}>{mode}</em>
            </span>
            {event.cpe > 0 && (
              <span className="row gap-2" style={{ color: 'var(--foreground)' }}>
                <IconAward size="sm" /> {event.cpe} CPE hr{event.cpe === 1 ? '' : 's'}
              </span>
            )}
            {cap > 0 && (
              <span className="row gap-2" style={{ color: 'var(--foreground)' }}>
                <IconUsers size="sm" />
                {isFull ? 'Full · waitlist open' : `${seatsLeft} of ${cap} seats left`}
              </span>
            )}
            <span className="row gap-2" style={{ color: 'var(--foreground)' }}>
              <strong style={{ fontWeight: 700 }}>{isPaid ? rupees(event.fee_paise) : 'Free'}</strong>
            </span>
          </div>

          {/* Description (markdown) */}
          {event.description ? (
            <section style={{ marginBottom: '1.25rem' }}>
              <div className="tiny-eyebrow" style={{ marginBottom: '.45rem' }}>About this event</div>
              <div style={{ fontSize: '.9375rem', lineHeight: 1.65, color: 'var(--foreground)' }}>
                {renderMarkdown(event.description)}
              </div>
            </section>
          ) : (
            <section style={{ marginBottom: '1.25rem' }}>
              <div className="tiny-eyebrow" style={{ marginBottom: '.45rem' }}>About this event</div>
              <p className="muted-text" style={{ margin: 0, fontSize: '.9375rem' }}>
                Detailed write-up will be shared closer to the date.
              </p>
            </section>
          )}

          {/* Highlights */}
          {Array.isArray(event.highlights) && event.highlights.length > 0 && (
            <section style={{ marginBottom: '1.25rem' }}>
              <div className="tiny-eyebrow" style={{ marginBottom: '.45rem' }}>What to expect</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '.4rem' }}>
                {event.highlights.map((h) => (
                  <li key={h} className="row gap-2" style={{ alignItems: 'flex-start', fontSize: '.9rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '1.1rem', height: '1.1rem', borderRadius: '50%',
                      background: 'oklch(0.95 0.08 145)', color: 'oklch(0.42 0.18 145)',
                      flexShrink: 0, marginTop: '.15rem',
                    }}>
                      <IconCheck size="sm" />
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Speaker — only renders if at least one of name/bio/photo is
              present. Photo is a circular avatar; bio supports markdown. */}
          {(event.speakerName || event.speakerBio || event.speakerPhotoUrl) && (
            <section style={{
              marginBottom: '1.25rem',
              padding: '.95rem 1rem',
              background: 'var(--muted)',
              borderRadius: '.6rem',
              border: '1px solid var(--border)',
            }}>
              <div className="tiny-eyebrow" style={{ marginBottom: '.55rem' }}>Speaker</div>
              <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                {event.speakerPhotoUrl && (
                  <img
                    src={event.speakerPhotoUrl}
                    alt={event.speakerName || 'Speaker'}
                    loading="lazy"
                    style={{
                      width: 64, height: 64, borderRadius: '50%',
                      objectFit: 'cover', flexShrink: 0,
                      border: '2px solid var(--card)',
                      boxShadow: '0 2px 6px rgba(0,0,0,.08)',
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {event.speakerName && (
                    <div style={{ fontWeight: 600, fontSize: '.9375rem', marginBottom: event.speakerBio ? '.25rem' : 0 }}>
                      {event.speakerName}
                    </div>
                  )}
                  {event.speakerBio && (
                    <div className="muted-text" style={{ fontSize: '.8625rem', lineHeight: 1.55 }}>
                      {renderMarkdown(event.speakerBio)}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="row" style={{ gap: '.6rem', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            {gcalUrl && (
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ padding: '.5rem 1rem' }}
              >
                <IconCalendar size="sm" /> Add to Google Calendar
              </a>
            )}
            {isRegistered ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '.5rem 1.1rem' }}
                onClick={() => { onClose?.(); onOpenChat?.(); }}
              >
                <IconMessageSquare size="sm" /> Open chat
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  padding: '.5rem 1.1rem',
                  background: isFull ? 'var(--muted-foreground, #64748b)' : undefined,
                }}
                disabled={!event.slug}
                onClick={() => { onClose?.(); onRegister?.(); }}
              >
                {isRegistered
                  ? (<><IconCheckCircle size="sm" /> Registered</>)
                  : isFull ? 'Join waitlist' : 'Register'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
