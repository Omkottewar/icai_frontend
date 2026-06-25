import { useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import EventRow from '../components/ui/EventRow';
import CategoryCard from '../components/ui/CategoryCard';
import { useRoute, navigate } from '../hooks/useRoute';
import { IconArrowLeft } from '../icons';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { usePublicCommittees, committeeColor } from '../hooks/usePublicCommittees';
import { apiEventToCardEvent } from '../lib/eventAdapter';
import { useSiteContent } from '../hooks/useSiteContent';
import { useLang } from '../context/LanguageContext';
import { renderMarkdown } from '../lib/markdown.jsx';

const FALLBACK_COMMITTEE_IMG = 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=420&q=80&auto=format&fit=crop';

function CommitteeChairmanSection({ code, t }) {
  const content = useSiteContent(`event_committee_${code.toLowerCase()}`);
  if (!content.chairman_photo && !content.chairman_message && !content.chairman_name) return null;

  return (
    <>
      <div style={{
        margin: '.875rem 0', height: 1,
        background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
        filter: 'blur(2px)', opacity: 0.4,
      }} />
      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        {content.chairman_photo && (
          <img src={content.chairman_photo} alt="Committee Chairman"
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div className="tiny-eyebrow" style={{ marginBottom: '.2rem', fontSize: '.65rem' }}>{t('ui.events.chairman_eyebrow', 'From the Chairman')}</div>
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

function toCardInfo(committee) {
  if (!committee) return null;
  return {
    short: committee.code, fullName: committee.name,
    color: committeeColor(committee.code), description: committee.description || '',
  };
}

export default function EventsPage() {
  const { t } = useLang();
  const route = useRoute();
  const selectedCommittee = route.query.committee || null;
  const [audience, setAudience] = useState('All');

  const AUDIENCE_TABS = [
    { key: 'All',      label: t('ui.events.tab_all', 'All Events') },
    { key: 'Members',  label: t('ui.events.tab_members', 'For Members') },
    { key: 'Students', label: t('ui.events.tab_students', 'For Students') },
  ];

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

  if (selectedCommittee) {
    const committee = committees.find((c) => c.code === selectedCommittee);
    const info = toCardInfo(committee) || { short: selectedCommittee, fullName: selectedCommittee, color: committeeColor(selectedCommittee), description: '' };
    const events = allEvents.filter((e) => e.committee === selectedCommittee);

    return (
      <>
        <PageHeader title={info.fullName} subtitle={`Upcoming events from the ${info.short} committee`} />
        <section className="container" style={{ padding: '2rem 1rem' }}>
          <button onClick={() => navigate('/events')} className="btn btn-outline" style={{ padding: '.4rem .9rem', marginBottom: '1.5rem' }}>
            <IconArrowLeft size="sm" /> {t('ui.events.all_committees_btn', 'All committees')}
          </button>

          <div className="committee-panel" style={{ '--cat-accent': info.color }}>
            <img className="committee-panel-img" src={FALLBACK_COMMITTEE_IMG} alt={info.fullName} loading="lazy" />
            <div className="committee-panel-body">
              <span className="committee-panel-badge">{info.short}</span>
              <h2 className="committee-panel-title">{info.fullName}</h2>
              {info.description && <p className="committee-panel-desc">{info.description}</p>}
              <div className="committee-panel-stat">
                <span className="committee-panel-dot" aria-hidden="true" />
                {events.length} {events.length !== 1
                  ? t('ui.events.no_upcoming', '').includes('') && 'upcoming events'
                  : 'upcoming event'}
              </div>
              <CommitteeChairmanSection code={selectedCommittee} t={t} />
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '.5rem', marginTop: '1.5rem' }}>
            <div className="tiny-eyebrow">{info.short} · {t('ui.events.upcoming_eyebrow', 'UPCOMING EVENTS')}</div>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>{events.length} event{events.length !== 1 ? 's' : ''}</div>
          </div>

          {events.length > 0 ? (
            <div>{events.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p className="muted-text">{t('ui.events.no_upcoming', 'No upcoming events for this committee right now. Check back soon.')}</p>
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('ui.events.page_title', 'Events & CPE')}
        subtitle={t('ui.events.page_subtitle', 'Upcoming programmes across all committees')}
      />

      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 64, zIndex: 10 }}>
        <div className="container row gap-1" style={{ padding: '0 1rem' }}>
          {AUDIENCE_TABS.map((tab) => {
            const isActive = audience === tab.key;
            const count = allEvents.filter((e) =>
              tab.key === 'All' || e.audience === tab.key || e.audience === 'All'
            ).length;
            return (
              <button key={tab.key} onClick={() => setAudience(tab.key)} style={{
                padding: '.75rem 1.25rem', fontWeight: 600, fontSize: '.875rem',
                borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                background: 'transparent', transition: 'all .15s',
              }}>
                {tab.label}
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

      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        <div className="row" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="tiny-eyebrow">{t('ui.events.section_eyebrow', 'EVENTS')}</div>
            <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.375rem, 4.5vw, 1.875rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.01em' }}>{t('ui.events.section_heading', 'Upcoming programmes and committees')}</h2>
          </div>
          <div className="muted-text" style={{ fontSize: '.8125rem' }}>{audienceFiltered.length} programme{audienceFiltered.length !== 1 ? 's' : ''} scheduled</div>
        </div>

        <div className="tiny-eyebrow" style={{ marginBottom: '.75rem' }}>{t('ui.events.upcoming_eyebrow', 'UPCOMING EVENTS')}</div>
        {eventsLoading ? (
          <p className="muted-text">{t('ui.events.loading', 'Loading…')}</p>
        ) : audienceFiltered.length > 0 ? (
          <div>{audienceFiltered.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
        ) : (
          <p className="muted-text">{t('ui.events.no_events_audience', 'No upcoming events for this audience right now.')}</p>
        )}
      </section>

      <section className="container" style={{ padding: '0 1rem 4rem', borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '3rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">{t('ui.events.committee_eyebrow', 'BROWSE BY COMMITTEE')}</div>
          <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.375rem, 4.5vw, 1.875rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.01em' }}>{t('ui.events.committee_heading', 'Committee categories')}</h2>
          <p className="muted-text" style={{ marginTop: '.5rem', maxWidth: '40rem' }}>
            {t('ui.events.committee_desc', 'Select a committee to open its dedicated page with every upcoming event.')}
          </p>
        </div>

        {committees.length === 0 ? (
          <p className="muted-text">{t('ui.events.no_committees', 'No committees configured yet.')}</p>
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
