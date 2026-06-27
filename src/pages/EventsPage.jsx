import { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import EventRow from '../components/ui/EventRow';
import CategoryCard from '../components/ui/CategoryCard';
import EventMonthCalendar from '../components/events/EventMonthCalendar';
import { useRoute, navigate } from '../hooks/useRoute';
import { IconArrowLeft } from '../icons';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { usePublicCommittees, committeeColor } from '../hooks/usePublicCommittees';
import { apiEventToCardEvent } from '../lib/eventAdapter';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';

function EventRowsShimmer({ count = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', gap: '1rem', padding: '1rem', marginBottom: '.75rem' }}>
          <Shimmer width="5rem" height="5rem" radius=".5rem" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
            <Shimmer height="1rem" width={`${55 + ((i * 9) % 30)}%`} />
            <Shimmer height=".75rem" width="40%" />
            <ShimmerLines count={2} lastWidth="60%" />
          </div>
          <Shimmer width="5rem" height="2rem" radius=".375rem" />
        </div>
      ))}
    </div>
  );
}

// Audience tab keys are structural (they have to match the `audience` value
// on events). The actual labels are admin-editable via the
// `events_audience_tabs` slot.
const AUDIENCE_KEYS = ['All', 'Members', 'Students'];

function CommitteeChairmanSection({ code }) {
  const content = useSiteContent(`event_committee_${code.toLowerCase()}`);
  if (!content.chairman_photo && !content.chairman_message && !content.chairman_name) return null;

  return (
    <>
      {/* Blurred gradient divider inside the card */}
      <div style={{
        margin: '.875rem 0',
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
        filter: 'blur(2px)',
        opacity: 0.4,
      }} />

      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        {content.chairman_photo && (
          <img
            src={content.chairman_photo}
            alt="Committee Chairman"
            style={{
              width: 48, height: 48, borderRadius: '50%',
              objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div className="tiny-eyebrow" style={{ marginBottom: '.2rem', fontSize: '.65rem' }}>From the Chairman</div>
          {content.chairman_name && (
            <div style={{ fontWeight: 600, fontSize: '.875rem', marginBottom: '.3rem' }}>{content.chairman_name}</div>
          )}
          {content.chairman_message && (
            <div className="muted-text" style={{ fontSize: '.8125rem', lineHeight: 1.6 }}>
              {renderMarkdown(content.chairman_message)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Adapts a DB committee row into the {short, fullName, color, description}
// shape the CategoryCard and detail panel already expect.
function toCardInfo(committee) {
  if (!committee) return null;
  return {
    short: committee.code,
    fullName: committee.name,
    color: committeeColor(committee.code),
    description: committee.description || '',
  };
}

export default function EventsPage() {
  const route = useRoute();
  const header        = useSiteContent('events_page_header');
  const tabs          = useSiteContent('events_audience_tabs');
  const sections      = useSiteContent('events_sections');
  const committeeImg  = useSiteContent('events_committee_fallback');

  const AUDIENCE_TABS = useMemo(() => ([
    { key: 'All',      label: tabs.all_label },
    { key: 'Members',  label: tabs.members_label },
    { key: 'Students', label: tabs.students_label },
  ]), [tabs]);

  const selectedCommittee = route.query.committee || null;
  // Seed audience from ?audience= so deep-links from the public Students /
  // Members pages land pre-filtered. Falls back to 'All' for stray values.
  const initialAudience = AUDIENCE_KEYS.includes(route.query.audience) ? route.query.audience : 'All';
  const [audience, setAudience] = useState(initialAudience);
  const [view, setView] = useState('list'); // 'list' | 'month'

  const { data: eventsData, loading: eventsLoading } = usePublicEvents();
  const { data: committeesData } = usePublicCommittees();

  const allEvents = useMemo(
    () => (eventsData?.rows ?? []).map(apiEventToCardEvent),
    [eventsData],
  );
  const committees = committeesData?.rows ?? [];

  const audienceFiltered = allEvents.filter((e) =>
    audience === 'All' || e.audience === audience || e.audience === 'All'
  );

  // ── Committee detail view ───────────────────────────────────────────────
  if (selectedCommittee) {
    const committee = committees.find((c) => c.code === selectedCommittee);
    const info = toCardInfo(committee) || { short: selectedCommittee, fullName: selectedCommittee, color: committeeColor(selectedCommittee), description: '' };
    const events = allEvents.filter((e) => e.committee === selectedCommittee);

    return (
      <>
        <PageHeader
          title={info.fullName}
          subtitle={(header.committee_subtitle_template || '').replace(/\{short\}/g, info.short)}
        />

        <section className="container" style={{ padding: '2rem 1rem' }}>
          <button
            onClick={() => navigate('/events')}
            className="btn btn-outline"
            style={{ padding: '.4rem .9rem', marginBottom: '1.5rem' }}
          >
            <IconArrowLeft size="sm" /> {sections.all_committees_btn}
          </button>

          {/* Committee details panel — fallback image admin-editable via events_committee_fallback */}
          <div className="committee-panel" style={{ '--cat-accent': info.color }}>
            <img
              className="committee-panel-img"
              src={committeeImg.image_url}
              alt={info.fullName}
              loading="lazy"
            />
            <div className="committee-panel-body">
              <span className="committee-panel-badge">{info.short}</span>
              <h2 className="committee-panel-title">{info.fullName}</h2>
              {info.description && <p className="committee-panel-desc">{info.description}</p>}
              <div className="committee-panel-stat">
                <span className="committee-panel-dot" aria-hidden="true" />
                {events.length} upcoming event{events.length !== 1 ? 's' : ''}
              </div>
              <CommitteeChairmanSection code={selectedCommittee} />
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '.5rem', marginTop: '1.5rem' }}>
            <div className="tiny-eyebrow">{info.short} · UPCOMING EVENTS</div>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>{events.length} event{events.length !== 1 ? 's' : ''}</div>
          </div>

          {events.length > 0 ? (
            <div>{events.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p className="muted-text">{sections.empty_committee_msg}</p>
            </div>
          )}
        </section>
      </>
    );
  }

  // ── Default events landing view ─────────────────────────────────────────
  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      {/* Audience tab bar */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 64, zIndex: 10 }}>
        <div className="container row gap-1" style={{ padding: '0 1rem' }}>
          {AUDIENCE_TABS.map((t) => {
            const isActive = audience === t.key;
            const count = allEvents.filter((e) =>
              t.key === 'All' || e.audience === t.key || e.audience === 'All'
            ).length;
            return (
              <button
                key={t.key}
                onClick={() => setAudience(t.key)}
                style={{
                  padding: '.75rem 1.25rem',
                  fontWeight: 600,
                  fontSize: '.875rem',
                  borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                  color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                  background: 'transparent',
                  transition: 'all .15s',
                }}
              >
                {t.label}
                <span style={{
                  marginLeft: '.5rem', fontSize: '.75rem',
                  background: isActive ? 'var(--primary)' : 'var(--muted)',
                  color: isActive ? 'white' : 'var(--muted-foreground)',
                  padding: '.1rem .4rem', borderRadius: 999,
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming events — list / month toggle */}
      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        <div className="row" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="tiny-eyebrow">{sections.events_eyebrow}</div>
            <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.375rem, 4.5vw, 1.875rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.01em' }}>{sections.events_title}</h2>
          </div>
          <div className="muted-text" style={{ fontSize: '.8125rem' }}>{audienceFiltered.length} programme{audienceFiltered.length !== 1 ? 's' : ''} scheduled</div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', flexWrap: 'wrap', gap: '.5rem' }}>
          <div className="tiny-eyebrow">{sections.upcoming_eyebrow}</div>
          <div role="tablist" aria-label="View as" className="row" style={{ background: 'var(--muted)', borderRadius: '.4rem', padding: '.2rem' }}>
            {[
              { key: 'list',  label: sections.view_list_label },
              { key: 'month', label: sections.view_month_label },
            ].map((v) => {
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v.key)}
                  style={{
                    padding: '.35rem .85rem',
                    fontSize: '.8125rem',
                    fontWeight: 600,
                    background: active ? 'var(--card)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                    border: 0,
                    borderRadius: '.3rem',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all .12s',
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {view === 'month' ? (
          <EventMonthCalendar events={audienceFiltered} loading={eventsLoading} />
        ) : eventsLoading ? (
          <EventRowsShimmer count={4} />
        ) : audienceFiltered.length > 0 ? (
          <div>{audienceFiltered.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
        ) : (
          <p className="muted-text">{sections.empty_audience_msg}</p>
        )}
      </section>

      {/* Committee categories */}
      <section className="container" style={{ padding: '0 1rem 4rem', borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '3rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">{sections.committees_eyebrow}</div>
          <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.375rem, 4.5vw, 1.875rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.01em' }}>{sections.committees_title}</h2>
          <div className="muted-text" style={{ marginTop: '.5rem', maxWidth: '40rem' }}>
            {renderMarkdown(sections.committees_subtitle)}
          </div>
        </div>

        {committees.length === 0 ? (
          <p className="muted-text">No committees configured yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {committees.map((c) => {
              const info = toCardInfo(c);
              const events = audienceFiltered.filter((ev) => ev.committee === c.code);
              return <CategoryCard key={c.id} committee={c.code} info={info} count={events.length} nextEvent={events[0]} />;
            })}
          </div>
        )}
      </section>
    </>
  );
}
