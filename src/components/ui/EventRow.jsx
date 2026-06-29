import { useState } from 'react';
import { IconChevronDown, IconClock, IconMapPin, IconArrowRight, IconCheck, IconCheckCircle, IconMessageSquare, IconCalendar, IconEye } from '../../icons';
import EventRegisterModal from '../events/EventRegisterModal';
import EventDetailsModal from '../events/EventDetailsModal';
import EventChat from '../events/EventChat';
import { useMyRegistrations } from '../../hooks/useMyRegistrations';
import { googleCalendarEventUrl } from '../../lib/googleCalendar';

function getMode(venue) {
  const v = (venue || '').toLowerCase();
  if (v.startsWith('online')) return 'Online';
  if (v.includes('hybrid')) return 'Hybrid';
  return 'Offline';
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Pool of CA-relevant event imagery (conferences, meetings, training)
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=480&h=320&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=480&h=320&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=480&h=320&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=480&h=320&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=480&h=320&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=480&h=320&q=80&auto=format&fit=crop',
];

function eventImg(title) {
  return EVENT_IMAGES[hash(title) % EVENT_IMAGES.length];
}

// Banner uploads can be image OR video — detect from the URL extension so
// we render the right element instead of a broken <img>.
function isVideoUrl(url) {
  if (typeof url !== 'string') return false;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

export default function EventRow({ event: e, href = '/events', detailed = false }) {
  const [open, setOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const mode = getMode(e.venue);
  const { eventIds, refresh: refreshMyRegistrations } = useMyRegistrations();
  const isRegistered = e.id && eventIds.has(e.id);

  // Capacity awareness — drives the seats-left meta and the waitlist UX.
  const cap = Number(e.capacity ?? 0);
  const reg = Number(e.registered_count ?? 0);
  const seatsLeft = cap > 0 ? Math.max(0, cap - reg) : null;
  const isFull = cap > 0 && reg >= cap;
  const isAlmostFull = cap > 0 && seatsLeft !== null && seatsLeft <= Math.max(5, Math.floor(cap * 0.1));

  // Tapping the row toggles the accordion for EVERYONE, registered or
  // not — users who've signed up still want to revisit event details
  // (time, venue, speaker, highlights) without being thrown straight
  // into chat. The "Open chat" button inside the accordion body remains
  // the explicit way for registered users to jump to chat.
  function handleHeaderClick() {
    setOpen((o) => !o);
  }

  return (
    <div className={'event-acc' + (open ? ' is-open' : '')}>
      <button
        type="button"
        className="event-acc-head"
        onClick={handleHeaderClick}
        aria-expanded={open}
      >
        <div className="event-acc-titleblock">
          <div className="event-acc-title">{e.title}</div>
          <div className="event-acc-committee">
            {e.committee}
            {e.cpe > 0 && (
              <span className="event-cpe-chip" title={`${e.cpe} CPE hours`}>
                {e.cpe} CPE hr{e.cpe === 1 ? '' : 's'}
              </span>
            )}
            {isFull && !isRegistered && (
              <span className="event-cap-chip event-cap-full">Waitlist only</span>
            )}
            {isAlmostFull && !isFull && !isRegistered && (
              <span className="event-cap-chip event-cap-almost">{seatsLeft} seats left</span>
            )}
          </div>
        </div>
        <div className="event-acc-right">
          {isRegistered ? (
            <span
              className="event-acc-chat-pill"
              aria-hidden="true"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                padding: '.25rem .65rem', borderRadius: 999,
                background: 'oklch(0.95 0.08 145)',
                color: 'oklch(0.32 0.16 145)',
                fontSize: '.75rem', fontWeight: 600,
                border: '1px solid oklch(0.82 0.13 145)',
              }}
            >
              <IconCheckCircle size="sm" /> Registered
            </span>
          ) : null}
          <span className="event-acc-date">{e.date}</span>
          <span className="event-acc-chevron" aria-hidden="true">
            <IconChevronDown size="sm" />
          </span>
        </div>
      </button>

      <div className="event-acc-panel">
        <div className="event-acc-panel-inner">
          {detailed ? (
            <div className="event-acc-detail">
              {isVideoUrl(e.bannerUrl) ? (
                <video
                  className="event-acc-img"
                  src={e.bannerUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onClick={(ev) => ev.stopPropagation()}
                  style={{ background: '#000' }}
                />
              ) : (
                <img
                  className="event-acc-img"
                  src={e.bannerUrl || eventImg(e.title)}
                  alt={e.title}
                  loading="lazy"
                  onError={(ev) => { ev.currentTarget.src = eventImg(e.title); }}
                />
              )}
              <div className="event-acc-detail-body">
                <div className="tiny-eyebrow">What to expect</div>
                <ul className="event-acc-highlights">
                  {(e.highlights || []).map((h) => (
                    <li key={h}>
                      <span className="event-acc-tick" aria-hidden="true"><IconCheck size="sm" /></span>
                      {h}
                    </li>
                  ))}
                </ul>

                <div className="event-acc-meta">
                  <span className="row gap-2"><IconClock size="sm" /> {e.time}</span>
                  <span className="row gap-2"><IconMapPin size="sm" /> {e.venue}</span>
                  <span className="event-acc-mode">{mode}</span>
                </div>

                <div className="event-acc-footer">
                  {(e.speakerName || e.speakerPhotoUrl) && (
                    <div className="event-acc-speaker">
                      {e.speakerPhotoUrl ? (
                        <img src={e.speakerPhotoUrl} alt={e.speakerName || 'Speaker'} loading="lazy" />
                      ) : (
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: 'var(--muted)', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, color: 'var(--muted-foreground)',
                        }}>
                          {(e.speakerName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="event-acc-speaker-name">{e.speakerName || 'Speaker TBA'}</div>
                        <div className="event-acc-speaker-role">Speaker</div>
                      </div>
                    </div>
                  )}
                  <div className="event-acc-actions">
                    {e.cpe > 0 && <span className="badge badge-accent">{e.cpe} CPE hrs</span>}
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '.45rem 1.1rem' }}
                      onClick={(ev) => { ev.stopPropagation(); setShowDetails(true); }}
                      aria-label={`View full details for ${e.title}`}
                    >
                      <IconEye size="sm" /> View full details
                    </button>
                    {/* Add to Google Calendar — opens calendar.google.com
                        with the event prefilled in a new tab. Avoids the
                        .ics download path (which triggers a Microsoft Store
                        prompt on Windows machines with no calendar app
                        installed). */}
                    {googleCalendarEventUrl(e) && (
                      <a
                        href={googleCalendarEventUrl(e)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                        style={{ padding: '.45rem 1.1rem' }}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label="Add this event to my Google Calendar"
                      >
                        <IconCalendar size="sm" /> Add to Google Calendar
                      </a>
                    )}
                    {isRegistered ? (
                      <>
                        <span
                          className="badge"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                            padding: '.45rem 1rem', borderRadius: '999px',
                            background: 'oklch(0.95 0.08 145)', color: 'oklch(0.42 0.18 145)',
                            fontWeight: 600, fontSize: '.8125rem',
                          }}
                        >
                          <IconCheckCircle size="sm" /> Registered
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '.45rem 1.1rem' }}
                          onClick={(ev) => { ev.stopPropagation(); setShowChat(true); }}
                        >
                          <IconMessageSquare size="sm" /> Open chat
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          padding: '.45rem 1.1rem',
                          background: isFull ? 'var(--muted-foreground, #64748b)' : undefined,
                        }}
                        onClick={(ev) => { ev.stopPropagation(); setShowRegister(true); }}
                        disabled={!e.slug}
                        title={isFull ? "We'll email you if a seat opens up" : undefined}
                      >
                        {isFull ? 'Join waitlist' : 'Register'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="event-acc-meta">
                <span className="row gap-2"><IconClock size="sm" /> {e.time}</span>
                <span className="row gap-2"><IconMapPin size="sm" /> {e.venue}</span>
                <span className="event-acc-mode">{mode}</span>
              </div>
              <a href={href} className="event-acc-cta">
                View details <IconArrowRight size="sm" />
              </a>
            </>
          )}
        </div>
      </div>

      {showRegister && (
        <EventRegisterModal
          event={e}
          onClose={() => setShowRegister(false)}
          onRegistered={refreshMyRegistrations}
        />
      )}
      {showChat && (
        <EventChat event={e} onClose={() => setShowChat(false)} />
      )}
      {showDetails && (
        <EventDetailsModal
          event={e}
          isRegistered={isRegistered}
          onClose={() => setShowDetails(false)}
          onRegister={() => setShowRegister(true)}
          onOpenChat={() => setShowChat(true)}
        />
      )}

      <style>{`
        .event-cpe-chip {
          display: inline-block;
          margin-left: .5rem;
          padding: .05rem .4rem;
          border-radius: 999px;
          background: oklch(0.92 0.08 250);
          color: oklch(0.32 0.18 250);
          font-size: .65rem; font-weight: 700;
          vertical-align: middle;
          letter-spacing: .02em;
        }
        .event-cap-chip {
          display: inline-block;
          margin-left: .35rem;
          padding: .05rem .4rem;
          border-radius: 999px;
          font-size: .65rem; font-weight: 600;
          vertical-align: middle;
        }
        .event-cap-almost { background: #fef3c7; color: #92400e; }
        .event-cap-full   { background: #fee2e2; color: #991b1b; }
      `}</style>
    </div>
  );
}
