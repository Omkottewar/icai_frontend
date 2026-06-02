import { useState } from 'react';
import { IconChevronDown, IconClock, IconMapPin, IconArrowRight, IconCheck, IconCheckCircle, IconMessageSquare } from '../../icons';
import EventRegisterModal from '../events/EventRegisterModal';
import EventChat from '../events/EventChat';
import { useMyRegistrations } from '../../hooks/useMyRegistrations';

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

function speakerImg(name) {
  // pravatar.cc: 1..70 professional-looking placeholder portraits, deterministic per name
  const id = (hash(name) % 70) + 1;
  return `https://i.pravatar.cc/96?img=${id}`;
}

export default function EventRow({ event: e, href = '#/events', detailed = false }) {
  const [open, setOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const mode = getMode(e.venue);
  const { eventIds, refresh: refreshMyRegistrations } = useMyRegistrations();
  const isRegistered = e.id && eventIds.has(e.id);

  // Registered users: clicking the row jumps straight to the WhatsApp-style
  // event chat. Unregistered users still get the accordion + Register CTA.
  function handleHeaderClick() {
    if (isRegistered) setShowChat(true);
    else setOpen((o) => !o);
  }

  return (
    <div className={'event-acc' + (open ? ' is-open' : '')}>
      <button
        type="button"
        className="event-acc-head"
        onClick={handleHeaderClick}
        aria-expanded={isRegistered ? undefined : open}
      >
        <div className="event-acc-titleblock">
          <div className="event-acc-title">{e.title}</div>
          <div className="event-acc-committee">{e.committee}</div>
        </div>
        <div className="event-acc-right">
          {isRegistered && (
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
              <IconMessageSquare size="sm" /> Chat
            </span>
          )}
          <span className="event-acc-date">{e.date}</span>
          {!isRegistered && (
            <span className="event-acc-chevron" aria-hidden="true">
              <IconChevronDown size="sm" />
            </span>
          )}
        </div>
      </button>

      <div className="event-acc-panel">
        <div className="event-acc-panel-inner">
          {detailed ? (
            <div className="event-acc-detail">
              <img
                className="event-acc-img"
                src={eventImg(e.title)}
                alt={e.title}
                loading="lazy"
              />
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
                  {e.speaker && (
                    <div className="event-acc-speaker">
                      <img
                        src={speakerImg(e.speaker)}
                        alt={e.speaker}
                        loading="lazy"
                      />
                      <div>
                        <div className="event-acc-speaker-name">{e.speaker}</div>
                        <div className="event-acc-speaker-role">Speaker</div>
                      </div>
                    </div>
                  )}
                  <div className="event-acc-actions">
                    {e.cpe > 0 && <span className="badge badge-accent">{e.cpe} CPE hrs</span>}
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
                        style={{ padding: '.45rem 1.1rem' }}
                        onClick={(ev) => { ev.stopPropagation(); setShowRegister(true); }}
                        disabled={!e.slug}
                      >
                        Register
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
    </div>
  );
}
