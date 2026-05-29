import { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import EventRow from '../components/ui/EventRow';
import CategoryCard from '../components/ui/CategoryCard';
import { useRoute, navigate } from '../hooks/useRoute';
import { IconArrowLeft } from '../icons';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { usePublicCommittees, committeeColor } from '../hooks/usePublicCommittees';
import { apiEventToCardEvent } from '../lib/eventAdapter';

// Single hero fallback when a committee row carries no admin-supplied image.
// Replace with a `committees.hero_image_url` column if admins should pick.
const FALLBACK_COMMITTEE_IMG = 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=420&q=80&auto=format&fit=crop';

const AUDIENCE_TABS = [
  { key: 'All',      label: 'All Events' },
  { key: 'Members',  label: 'For Members' },
  { key: 'Students', label: 'For Students' },
];

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
  const selectedCommittee = route.query.committee || null;
  const [audience, setAudience] = useState('All');

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
        <PageHeader title={info.fullName} subtitle={`Upcoming events from the ${info.short} committee`} />

        <section className="container" style={{ padding: '2rem 1rem' }}>
          <button
            onClick={() => navigate('/events')}
            className="btn btn-outline"
            style={{ padding: '.4rem .9rem', marginBottom: '1.5rem' }}
          >
            <IconArrowLeft size="sm" /> All committees
          </button>

          {/* Committee details panel */}
          <div className="committee-panel" style={{ '--cat-accent': info.color }}>
            <img
              className="committee-panel-img"
              src={FALLBACK_COMMITTEE_IMG}
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
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '.5rem' }}>
            <div className="tiny-eyebrow">{info.short} · UPCOMING EVENTS</div>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>{events.length} event{events.length !== 1 ? 's' : ''}</div>
          </div>

          {events.length > 0 ? (
            <div>{events.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p className="muted-text">No upcoming events for this committee right now. Check back soon.</p>
            </div>
          )}
        </section>
      </>
    );
  }

  // ── Default events landing view ─────────────────────────────────────────
  return (
    <>
      <PageHeader title="Events & CPE" subtitle="Upcoming programmes across all committees" />

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

      {/* Upcoming events list */}
      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        <div className="row" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="tiny-eyebrow">EVENTS</div>
            <h2 style={{ marginTop: '.25rem', fontSize: '1.875rem', fontWeight: 700 }}>Upcoming programmes and committees</h2>
          </div>
          <div className="muted-text" style={{ fontSize: '.8125rem' }}>{audienceFiltered.length} programme{audienceFiltered.length !== 1 ? 's' : ''} scheduled</div>
        </div>

        <div className="tiny-eyebrow" style={{ marginBottom: '.75rem' }}>UPCOMING EVENTS</div>
        {eventsLoading ? (
          <p className="muted-text">Loading…</p>
        ) : audienceFiltered.length > 0 ? (
          <div>{audienceFiltered.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
        ) : (
          <p className="muted-text">No upcoming events for this audience right now.</p>
        )}
      </section>

      {/* Committee categories */}
      <section className="container" style={{ padding: '0 1rem 4rem', borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '3rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">BROWSE BY COMMITTEE</div>
          <h2 style={{ marginTop: '.25rem', fontSize: '1.875rem', fontWeight: 700 }}>Committee categories</h2>
          <p className="muted-text" style={{ marginTop: '.5rem', maxWidth: '40rem' }}>
            Select a committee to open its dedicated page with every upcoming event.
          </p>
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
