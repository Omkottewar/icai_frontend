import { useAuth } from '../context/AuthContext';
import EventRow from '../components/ui/EventRow';
import CategoryCard from '../components/ui/CategoryCard';
import WicasaCard from '../components/ui/WicasaCard';
import HeroCarousel from '../components/ui/HeroCarousel';
import heroImage from '../assets/icai.png';
import swaroopa from '../assets/swaroopa.png';

// TODO: replace with branch photos in src/assets/ once available
const LEADERSHIP_SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=720&h=480&q=80&auto=format&fit=crop',
    alt: 'Professional gathering of chartered accountants',
    caption: 'Branch leadership',
  },
  {
    src: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=720&h=480&q=80&auto=format&fit=crop',
    alt: 'CPE seminar audience',
    caption: 'CPE programmes',
  },
  {
    src: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=720&h=480&q=80&auto=format&fit=crop',
    alt: 'CA professionals collaborating around a meeting table',
    caption: 'Member community',
  },
  {
    src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=720&h=480&q=80&auto=format&fit=crop',
    alt: 'CA students in training session',
    caption: 'Student community',
  },
];
import { SERVICES } from '../data/constants';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { useLocalizedAnnouncements } from '../hooks/useAnnouncements';
import { usePublicCommittees, committeeColor } from '../hooks/usePublicCommittees';
import { apiEventToCardEvent } from '../lib/eventAdapter';
import { useMemo } from 'react';
import {
  IconAward, IconArrowRight, IconCalendar,
  IconFileText, IconBookOpen, IconDownload, IconBot,
} from '../icons';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown, renderInlineMarkdown } from '../lib/markdown.jsx';
import { useLang } from '../context/LanguageContext';

const toSlug = (to) => to.replace(/\//g, '').replace(/-/g, '_') || 'home';

export default function HomePage() {
  const { user } = useAuth();
  const { localeData, t } = useLang();

  const { data: eventsData } = usePublicEvents();
  const { data: committeesData } = usePublicCommittees();
  const SORTED_EVENTS = useMemo(
    () => (eventsData?.rows ?? []).map(apiEventToCardEvent),
    [eventsData],
  );
  const upcoming = SORTED_EVENTS.slice(0, 5);
  const committees = committeesData?.rows ?? [];

  const { data: annData } = useLocalizedAnnouncements(localeData);
  const tickerItems = (annData?.items ?? []).map((a) => a.title);

  const hero       = useSiteContent('home_hero');
  const heroStats  = useSiteContent('home_hero_stats');
  const leadership = useSiteContent('home_leadership_banner');
  const chairman   = useSiteContent('chairman_message');
  const premises   = useSiteContent('home_branch_premises');

  const KNOWLEDGE_CARDS = [
    { Icon: IconFileText, tKey: 'circulars', title: 'Latest Circulars',   desc: 'ICAI announcements, notifications and council decisions.' },
    { Icon: IconBookOpen, tKey: 'standards', title: 'Standards (AS / SA)', desc: 'Accounting Standards, Ind AS and Standards on Auditing.' },
    { Icon: IconDownload, tKey: 'ejournal',  title: 'e-Journal Archive',   desc: 'Browse The Chartered Accountant journal archives.' },
  ];

  return (
    <>
      {/* Ticker */}
      {tickerItems.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'oklch(0.85 0.16 90 / 0.4)' }}>
          <div className="container row gap-3" style={{ padding: '.5rem 1rem', fontSize: '.875rem' }}>
            <span className="badge badge-primary" style={{ flexShrink: 0 }}>{t('ui.ticker.latest', 'LATEST')}</span>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="ticker-track">
                {[...tickerItems, ...tickerItems].map((a, i) => (
                  <span key={i} style={{ color: 'rgba(0,0,0,.7)' }}>• {a}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        color: 'var(--foreground)', background: 'white',
        minHeight: 'calc(100vh - var(--header-h, 104px))',
        display: 'flex', alignItems: 'center',
        padding: 'clamp(2rem, 6vw, 3rem) 0',
      }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img src={heroImage} alt="ICAI Bhawan, Nagpur" loading="eager"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(100deg, rgba(255,255,255,.97) 0%, rgba(255,255,255,.94) 35%, rgba(255,255,255,.78) 65%, rgba(255,255,255,.60) 100%)',
          }} />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1, width: '100%', display: 'grid', gap: '2.5rem', gridTemplateColumns: '1fr', alignItems: 'center' }} data-hero-grid>
          <div>
            <div className="row gap-2" style={{ width: 'fit-content', padding: '.25rem .75rem', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(54,34,255,.06)', fontSize: '.75rem', fontWeight: 500, color: 'var(--primary)' }}>
              <IconAward size="sm" /> {t('ui.home.hero_badge', 'Branch of WIRC of ICAI')}
            </div>
            <h1 style={{ marginTop: '1rem', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, lineHeight: 1.1 }}>
              Nagpur Branch of <span style={{ color: 'var(--accent)' }}>ICAI</span>
            </h1>
            <div style={{ marginTop: '1rem', maxWidth: '32rem', color: 'rgba(0,0,0,.7)' }}>
              {renderMarkdown(hero.tagline)}
            </div>
            <div className="row gap-3" style={{ marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <a href="#/events" className="btn btn-primary">{t('ui.home.hero_events_btn', 'Upcoming Events')} <IconArrowRight size="sm" /></a>
              <a href="#/praygyaan" className="btn btn-outline"><IconBot size="sm" /> {t('ui.home.hero_praygyaan_btn', 'Ask PrayGyaan AI')}</a>
              {!user && <a href="#/signup" className="btn btn-outline">{t('ui.home.hero_signup_btn', 'Create account')} <IconArrowRight size="sm" /></a>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(.6rem, 2vw, 1rem)' }}>
            {(heroStats.stats || []).map((s, i) => (
              <div key={s.v || i} style={{ padding: 'clamp(.9rem, 3vw, 1.5rem)', border: '1px solid var(--border)', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderRadius: '.75rem', boxShadow: '0 10px 24px -16px rgba(11,61,145,.25)' }}>
                <div style={{ fontSize: 'clamp(1.25rem, 4vw, 1.875rem)', fontWeight: 700, lineHeight: 1.1 }}>{s.k}</div>
                <div style={{ marginTop: '.25rem', fontSize: 'clamp(.75rem, 2vw, .875rem)', opacity: .75, lineHeight: 1.35 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@media (min-width: 768px) { [data-hero-grid] { grid-template-columns: 1fr 1fr !important; } }`}</style>
      </section>

      {/* Leadership banner */}
      <section className="container" style={{ padding: 'clamp(3rem, 8vw, 7rem) 1rem' }}>
        <div style={{ display: 'grid', gap: 'clamp(2rem, 5vw, 3.5rem)', gridTemplateColumns: '1fr', alignItems: 'center' }} data-leadership-grid>
          <div>
            <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>{leadership.eyebrow}</div>
            <h2 style={{ marginTop: '1rem', fontSize: 'clamp(2.125rem, 4.5vw, 3rem)', fontWeight: 700, lineHeight: 1.05, color: 'var(--primary)', letterSpacing: '-.01em', whiteSpace: 'pre-line' }}>
              {leadership.headline}
            </h2>
            <div className="muted-text" style={{ marginTop: '1.25rem', maxWidth: '34rem', lineHeight: 1.65, fontSize: '1.0625rem' }}>
              {renderMarkdown(leadership.body)}
            </div>
            <div className="row gap-3" style={{ marginTop: '1.75rem', flexWrap: 'wrap' }}>
              <a href="#/events" className="btn btn-primary"><IconCalendar size="sm" /> {t('ui.home.book_cpe', 'Book CPE Event')}</a>
              <a href="#/resources" className="btn btn-outline"><IconDownload size="sm" /> {t('ui.home.download_circulars', 'Download Circulars')}</a>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <HeroCarousel slides={LEADERSHIP_SLIDES} />
            <div style={{ position: 'absolute', bottom: '-1rem', left: '-1rem', padding: '.75rem 1rem', background: 'white', border: '1px solid var(--border)', borderRadius: '.75rem', boxShadow: '0 8px 24px -10px rgba(0,0,0,.15)', display: 'none', zIndex: 3 }} className="show-md">
              <div className="tiny-eyebrow">{t('ui.home.since_eyebrow', 'SINCE')}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>1962</div>
            </div>
          </div>
        </div>
        <style>{`
          @media (min-width: 768px) {
            [data-leadership-grid] { grid-template-columns: 1fr 1fr !important; }
            .show-md { display: block !important; }
          }
        `}</style>
      </section>

      {/* Chairperson */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'oklch(0.98 0.005 240)' }}>
        <div className="container" style={{ padding: 'clamp(3rem, 8vw, 7rem) 1rem' }}>
          <div style={{ display: 'grid', gap: 'clamp(1.75rem, 5vw, 3rem)', gridTemplateColumns: '1fr', alignItems: 'center' }} data-chair-grid>
            <img
              src={chairman.photo_url || swaroopa}
              alt={chairman.name || 'Chairperson, Nagpur Branch'}
              loading="lazy"
              style={{ width: '100%', maxWidth: 320, margin: '0 auto', borderRadius: '1rem', display: 'block', boxShadow: '0 18px 40px -16px rgba(0,0,0,.25)' }}
            />
            <div>
              <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>{t('ui.home.chairman_eyebrow', "FROM THE CHAIRMAN'S DESK")}</div>
              <div aria-hidden="true" style={{ marginTop: '1rem', fontSize: '3rem', color: 'var(--accent)', lineHeight: .5, fontFamily: 'Georgia, serif' }}>"</div>
              <p style={{ marginTop: '.75rem', fontSize: 'clamp(1.0625rem, 2.6vw, 1.625rem)', fontWeight: 600, lineHeight: 1.5, color: 'var(--foreground)', maxWidth: '36rem' }}>
                {renderInlineMarkdown(chairman.quote)}
              </p>
              <div style={{ marginTop: '2rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{chairman.name}</div>
                <div style={{ fontSize: '.875rem', color: 'var(--primary)', marginTop: '.125rem' }}>{chairman.role_line}</div>
              </div>
            </div>
          </div>
          <style>{`@media (min-width: 768px) { [data-chair-grid] { grid-template-columns: 320px 1fr !important; gap: 4rem !important; } }`}</style>
        </div>
      </section>

      {/* Services grid */}
      <section className="container" style={{ padding: 'clamp(3rem, 8vw, 7rem) 1rem' }}>
        <div style={{ marginBottom: 'clamp(1.75rem, 4vw, 3rem)', maxWidth: '40rem' }}>
          <div className="tiny-eyebrow">{t('ui.home.services_eyebrow', 'SERVICES')}</div>
          <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{t('ui.home.services_heading', 'Explore the Branch')}</h2>
          <p className="muted-text" style={{ marginTop: '1rem', fontSize: '1rem', lineHeight: 1.65 }}>
            {t('ui.home.services_desc', 'Everything the Nagpur Branch offers — from CPE programmes and student mentorship to career counselling and member welfare initiatives.')}
          </p>
        </div>
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {SERVICES.map((s) => {
            const slug = toSlug(s.to);
            return (
              <a key={s.title} href={'#' + s.to} className="card feature-card" style={{ display: 'block', padding: '1.75rem' }}>
                <div className="icon-tile"><s.Icon size="lg" /></div>
                <h3 style={{ marginTop: '1.25rem', fontSize: '1.1875rem', fontWeight: 700 }}>{t(`ui.service.${slug}.title`, s.title)}</h3>
                <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.9rem', lineHeight: 1.6 }}>{t(`ui.service.${slug}.desc`, s.desc)}</p>
                <div className="row gap-1 feature-cta" style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>
                  {t('ui.service.cta', 'Explore')} <IconArrowRight size="sm" />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Events */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'oklch(0.96 0.01 240 / 0.3)', padding: 'clamp(3rem, 8vw, 7rem) 0' }}>
        <div className="container" style={{ padding: '0 1rem' }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
            <div style={{ maxWidth: '40rem' }}>
              <div className="tiny-eyebrow">{t('ui.home.events_eyebrow', 'EVENTS')}</div>
              <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{t('ui.home.events_heading', 'Upcoming programmes and committees')}</h2>
            </div>
            <a href="#/events" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '.9375rem' }}>{t('ui.home.view_calendar', 'View full calendar →')}</a>
          </div>

          <div className="tiny-eyebrow" style={{ marginBottom: '1rem' }}>{t('ui.home.upcoming_eyebrow', 'UPCOMING EVENTS')}</div>
          <div>
            {upcoming.map((e) => <EventRow key={e.title} event={e} />)}
          </div>

          <div style={{ marginTop: 'clamp(2.5rem, 6vw, 5rem)' }}>
            <div className="tiny-eyebrow">{t('ui.home.committee_eyebrow', 'BROWSE BY COMMITTEE')}</div>
            <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em', marginBottom: '2rem' }}>{t('ui.home.committee_heading', 'Committee categories')}</h2>
            {committees.length === 0 ? (
              <p className="muted-text">{t('ui.home.no_committees', 'No committees configured yet.')}</p>
            ) : (
              <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {committees.map((c) => {
                  const info = {
                    short: c.code, fullName: c.name,
                    color: committeeColor(c.code), description: c.description || '',
                  };
                  const events = SORTED_EVENTS.filter((ev) => ev.committee === c.code);
                  return <CategoryCard key={c.id} committee={c.code} info={info} count={events.length} nextEvent={events[0]} />;
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Branch Premises + NICASA */}
      <section className="container" style={{ padding: 'clamp(3rem, 8vw, 7rem) 1rem' }}>
        <div style={{ marginBottom: 'clamp(1.75rem, 4vw, 3rem)', maxWidth: '40rem' }}>
          <div className="tiny-eyebrow">{t('ui.home.premises_eyebrow', 'OUR HOME')}</div>
          <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{t('ui.home.premises_heading', 'Branch premises & student wing')}</h2>
        </div>
        <div style={{ display: 'grid', gap: '1.75rem', gridTemplateColumns: '1fr' }} data-premises-grid>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <img
              src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=960&h=440&q=80&auto=format&fit=crop"
              alt="ICAI Bhawan, Dhantoli — Nagpur Branch premises"
              loading="lazy"
              style={{ width: '100%', display: 'block', aspectRatio: '16/7', objectFit: 'cover' }}
            />
            <div style={{ padding: '1.5rem' }}>
              <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>{t('ui.home.premises_badge', 'BRANCH PREMISES')}</div>
              <h3 style={{ marginTop: '.25rem', fontSize: 'clamp(1.125rem, 3.2vw, 1.5rem)', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{t('ui.home.premises_name', 'ICAI Bhawan, Dhantoli')}</h3>
              <div className="muted-text" style={{ marginTop: '.5rem', lineHeight: 1.6 }}>
                {renderMarkdown(premises.body)}
              </div>
              <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '1.25rem' }}>
                {(premises.stats || []).map((s, i) => (
                  <div key={s.v || i} style={{ padding: '.75rem .9rem', background: 'var(--muted)', borderRadius: '.5rem' }}>
                    <div className="tiny-eyebrow" style={{ fontSize: '.65rem' }}>{s.v}</div>
                    <div style={{ marginTop: '.25rem', fontWeight: 700, fontSize: '.95rem' }}>{s.k}</div>
                  </div>
                ))}
              </div>
              <a href="#/book-room?room=reading-room" className="btn btn-primary" style={{ marginTop: '.85rem' }}>
                {t('ui.home.book_reading_room', 'Book the Reading Room')} <IconArrowRight size="sm" />
              </a>
            </div>
          </div>
          <WicasaCard />
        </div>
        <style>{`@media (min-width: 900px) { [data-premises-grid] { grid-template-columns: 2fr 1fr !important; } }`}</style>
      </section>

      {/* Knowledge hub */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'oklch(0.96 0.01 240 / 0.3)', padding: 'clamp(3rem, 8vw, 7rem) 0' }}>
        <div className="container" style={{ padding: '0 1rem' }}>
          <div className="row" style={{ marginBottom: 'clamp(1.75rem, 4vw, 3rem)', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ maxWidth: '40rem' }}>
              <div className="tiny-eyebrow">{t('ui.home.knowledge_eyebrow', 'KNOWLEDGE HUB')}</div>
              <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{t('ui.home.knowledge_heading', 'Circulars, standards & e-Journal')}</h2>
            </div>
            <a href="#/resources" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '.9375rem' }}>{t('ui.home.all_resources', 'All resources →')}</a>
          </div>
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {KNOWLEDGE_CARDS.map((k) => (
              <a key={k.tKey} href="#/resources" className="card feature-card" style={{ padding: '1.75rem' }}>
                <div className="icon-tile"><k.Icon size="lg" /></div>
                <h3 style={{ marginTop: '1.25rem', fontSize: '1.1875rem', fontWeight: 700 }}>{t(`ui.home.knowledge.${k.tKey}_title`, k.title)}</h3>
                <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.9rem', lineHeight: 1.6 }}>{t(`ui.home.knowledge.${k.tKey}_desc`, k.desc)}</p>
                <div className="row gap-1 feature-cta" style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>
                  {t('ui.home.open', 'Open')} <IconArrowRight size="sm" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
