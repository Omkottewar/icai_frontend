import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';
import EventRow from '../components/ui/EventRow';
import CategoryCard from '../components/ui/CategoryCard';
import WicasaCard from '../components/ui/WicasaCard';
import HeroCarousel from '../components/ui/HeroCarousel';
import RecentPhotosStrip from '../components/home/RecentPhotosStrip';
import BestPaperPopup from '../components/home/BestPaperPopup';
// Bundled fallbacks used only when the admin hasn't uploaded a custom
// hero image / watermark via /admin/site-content. Once a site-content row
// exists with bg_image_url / watermark_url set, those URLs win.
import heroImage from '../assets/heroImage.png';
import heroLogo from '../assets/heroLogo.png';
import swaroopa from '../assets/swaroopa.png';
import { SERVICES } from '../data/constants';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { usePublicCommittees, committeeColor } from '../hooks/usePublicCommittees';
import { apiEventToCardEvent } from '../lib/eventAdapter';
import { useMemo } from 'react';
import {
  IconAward, IconArrowRight, IconSearch, IconBot,
  IconFileText, IconBookOpen, IconDownload, IconCalendar,
} from '../icons';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown, renderInlineMarkdown } from '../lib/markdown.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [heroQ, setHeroQ] = useState('');

  const { data: eventsData } = usePublicEvents();
  const { data: committeesData } = usePublicCommittees();
  const SORTED_EVENTS = useMemo(
    () => (eventsData?.rows ?? []).map(apiEventToCardEvent),
    [eventsData],
  );
  const upcoming = SORTED_EVENTS.slice(0, 5);
  const committees = committeesData?.rows ?? [];

  // Live announcements from /api/announcements. When the list is empty
  // (no active rows in the window) the entire ticker bar is hidden — see
  // the conditional render below. We keep the full row (id, title, link)
  // so each ticker pill can route to the announcement's link or to the
  // archive page.
  const { data: annData } = useAnnouncements();
  const tickerItems = annData?.items ?? [];

  // Admin-editable site content (defaults baked in so a fresh DB still renders).
  const hero            = useSiteContent('home_hero');
  const heroStats       = useSiteContent('home_hero_stats');
  const leadership      = useSiteContent('home_leadership_banner');
  const chairman        = useSiteContent('chairman_message');
  const premises        = useSiteContent('home_branch_premises');
  // New section-text slots — every label/heading/CTA on the home page
  // is now driven from these so admins can rephrase anything.
  const heroText        = useSiteContent('home_hero_text');
  const leadershipExtra = useSiteContent('home_leadership_extras');
  const servicesText    = useSiteContent('home_services_section');
  const eventsText      = useSiteContent('home_events_section');
  const premisesText    = useSiteContent('home_premises_section');
  const knowledgeText   = useSiteContent('home_knowledge_section');
  const bestPaperText   = useSiteContent('home_best_paper');
  const carousel        = useSiteContent('home_leadership_carousel');

  // Build the leadership carousel from site-content slots. A slide is
  // skipped if its url is blank — lets the admin shrink the carousel from
  // 4 slides to 3/2/1 without touching code.
  const leadershipSlides = useMemo(() => (
    [1, 2, 3, 4]
      .map((n) => ({
        src:     carousel[`slide_${n}_url`],
        caption: carousel[`slide_${n}_caption`] || '',
        alt:     carousel[`slide_${n}_alt`] || '',
      }))
      .filter((s) => !!s.src)
  ), [carousel]);

  // Hero background + watermark: admin uploads via site content; otherwise
  // we keep using the bundled assets shipped with the build.
  const heroBgSrc        = heroText.bg_image_url || heroImage;
  const heroWatermarkSrc = heroText.watermark_url || heroLogo;

  return (
    <>
      {/* Announcement ticker — industry-standard pattern:
            • Slow, continuous marquee (90s/cycle for readability)
            • Pause on hover OR keyboard focus so users can read + click
            • Every item is a real link — to its `link_url` (opens in a
              new tab) if set, else to the /announcements archive
            • Hidden when there are no active announcements
            • Respects prefers-reduced-motion (CSS) and is announced once
              via aria-live="polite" on mount */}
      {tickerItems.length > 0 && (
        <div className="ticker-bar" aria-label="Branch announcements" role="region">
          <div className="container ticker-row">
            <a href="/announcements" className="ticker-label" aria-label="View all announcements">
              LATEST
            </a>
            <div className="ticker-viewport" aria-live="polite">
              {/* Duplicating the list lets the keyframe scroll seamlessly
                  by translating exactly -50% before wrapping. */}
              <div className="ticker-track">
                {[...tickerItems, ...tickerItems].map((a, i) => {
                  // Prefer the uploaded PDF over an external link. If both
                  // are absent, fall through to the announcements archive.
                  const targetUrl = a.file_url || a.link_url;
                  const isExternal = !!targetUrl;
                  const href = isExternal ? targetUrl : '/announcements';
                  return (
                    <a
                      key={`${a.id}-${i}`}
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="ticker-item"
                      // Items after the first set are visual duplicates for
                      // the seamless loop — hide them from the a11y tree to
                      // avoid screen-reader echoes.
                      aria-hidden={i >= tickerItems.length ? 'true' : undefined}
                      tabIndex={i >= tickerItems.length ? -1 : 0}
                    >
                      <span className="ticker-dot" aria-hidden="true">•</span>
                      <span className="ticker-title">{a.title}</span>
                      {a.file_url && <span className="ticker-pdf" aria-hidden="true">PDF</span>}
                    </a>
                  );
                })}
              </div>
            </div>
            <a href="/announcements" className="ticker-viewall">
              View all <IconArrowRight size="sm" />
            </a>
          </div>
        </div>
      )}

      {/* Hero — capped height on phones so users see something below the
          fold immediately. Desktop keeps the full-viewport feel. */}
      <section className="home-hero-section" style={{
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--foreground)',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        padding: 'clamp(2rem, 6vw, 3rem) 0',
      }}>
        {/* Background — three stacked layers (paint order, bottom up):
            1. heroImage as a full-cover photo
            2. A soft white gradient so hero text stays legible
            3. heroLogo centered as a watermark — painted ABOVE the
              gradient so the white wash doesn't double-fade it */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          <img
            src={heroBgSrc}
            alt=""
            loading="eager"
            className="home-hero-photo"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Readability gradient — keeps the left-side text crisp while
              letting the photo show through on the right. On mobile the
              CSS below replaces this with a cleaner near-solid wash. */}
          <div className="home-hero-overlay" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(100deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.88) 35%, rgba(255,255,255,.62) 65%, rgba(255,255,255,.45) 100%)',
          }} />
          {/* Centered watermark logo. Sized via clamp() so it scales with
              the viewport (small on phones, generous on desktops) without
              ever overflowing its container. Pointer-events off so it
              never blocks clicks on the hero CTAs. */}
          <img
            src={heroWatermarkSrc}
            alt=""
            aria-hidden="true"
            className="home-hero-watermark"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'clamp(220px, 45vw, 560px)',
              maxHeight: '70%',
              objectFit: 'contain',
              opacity: 0.6,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1, width: '100%', display: 'grid', gap: '2.5rem', gridTemplateColumns: '1fr', alignItems: 'center' }} data-hero-grid>
          <div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, lineHeight: 1.1 }}>
              {heroText.title_prefix} <span className="home-hero-icai">{heroText.title_highlight}</span>
            </h1>
            <div style={{ marginTop: '1rem', maxWidth: '32rem', color: 'rgba(0,0,0,.7)' }}>
              {renderMarkdown(hero.tagline)}
            </div>
            {/* <form
              onSubmit={(e) => { e.preventDefault(); navigate('/search?q=' + encodeURIComponent(heroQ)); }}
              className="row gap-2"
              style={{ marginTop: '1.5rem', padding: '.75rem', border: '1px solid var(--border)', background: 'var(--muted)', borderRadius: '.75rem' }}
            >
              <IconSearch size="sm" />
              <input
                value={heroQ}
                onChange={(e) => setHeroQ(e.target.value)}
                placeholder="Search events, services, resources…"
                style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', padding: '.375rem', color: 'var(--foreground)' }}
              />
              <button className="btn btn-primary" style={{ padding: '.4rem 1rem' }}>Search</button>
            </form> */}
            <div className="row gap-3" style={{ marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <a href="/events" className="btn btn-primary">{heroText.cta_events_label} <IconArrowRight size="sm" /></a>
              <a href="/praygyaan" className="btn btn-outline"><IconBot size="sm" /> {heroText.cta_ai_label}</a>
              {!user && <a href="/signup" className="btn btn-outline">{heroText.cta_signup_label} <IconArrowRight size="sm" /></a>}
            </div>
          </div>
          {/* Hero stat tiles (Members / Students / Events / Established) —
              hidden per client request. The data is still admin-editable
              under home_hero_stats so this can be uncommented later. */}
          {/*
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(.6rem, 2vw, 1rem)' }}>
            {(heroStats.stats || []).map((s, i) => (
              <div key={s.v || i} style={{ padding: 'clamp(.9rem, 3vw, 1.5rem)', border: '1px solid var(--border)', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', borderRadius: '.75rem', boxShadow: '0 10px 24px -16px rgba(11,61,145,.25)' }}>
                <div style={{ fontSize: 'clamp(1.25rem, 4vw, 1.875rem)', fontWeight: 700, lineHeight: 1.1 }}>{s.k}</div>
                <div style={{ marginTop: '.25rem', fontSize: 'clamp(.75rem, 2vw, .875rem)', opacity: .75, lineHeight: 1.35 }}>{s.v}</div>
              </div>
            ))}
          </div>
          */}
        </div>
        <style>{`@media (min-width: 768px) { [data-hero-grid] { grid-template-columns: 1fr 1fr !important; } }`}</style>
      </section>

      {/* Leadership banner — "Nurturing excellence" */}
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
              <a href="/events" className="btn btn-primary"><IconCalendar size="sm" /> {leadershipExtra.cta_book_label}</a>
              <a href="/resources" className="btn btn-outline"><IconDownload size="sm" /> {leadershipExtra.cta_download_label}</a>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <HeroCarousel slides={leadershipSlides} />
            <div style={{ position: 'absolute', bottom: '-1rem', left: '-1rem', padding: '.75rem 1rem', background: 'white', border: '1px solid var(--border)', borderRadius: '.75rem', boxShadow: '0 8px 24px -10px rgba(0,0,0,.15)', display: 'none', zIndex: 3 }} className="show-md">
              <div className="tiny-eyebrow">{leadershipExtra.since_label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{leadershipExtra.since_year}</div>
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

      {/* Chairperson — "From the Chairman's Desk" */}
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
              <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>FROM THE CHAIRMAN'S DESK</div>
              <div aria-hidden="true" style={{ marginTop: '1rem', fontSize: '3rem', color: 'var(--accent)', lineHeight: .5, fontFamily: 'Georgia, serif' }}>“</div>
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
          <div className="tiny-eyebrow">{servicesText.eyebrow}</div>
          <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{servicesText.title}</h2>
          <div className="muted-text" style={{ marginTop: '1rem', fontSize: '1rem', lineHeight: 1.65 }}>
            {renderMarkdown(servicesText.body)}
          </div>
        </div>
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {SERVICES.map((s) => (
            <a key={s.title} href={s.to} className="card feature-card" style={{ display: 'block', padding: '1.75rem' }}>
              <div className="icon-tile"><s.Icon size="lg" /></div>
              <h3 style={{ marginTop: '1.25rem', fontSize: '1.1875rem', fontWeight: 700 }}>{s.title}</h3>
              <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.9rem', lineHeight: 1.6 }}>{s.desc}</p>
              <div className="row gap-1 feature-cta" style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>
                Explore <IconArrowRight size="sm" />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Events */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'oklch(0.96 0.01 240 / 0.3)', padding: 'clamp(3rem, 8vw, 7rem) 0' }}>
        <div className="container" style={{ padding: '0 1rem' }}>
          {/* Upcoming list */}
          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
            <div style={{ maxWidth: '40rem' }}>
              <div className="tiny-eyebrow">{eventsText.events_eyebrow}</div>
              <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{eventsText.events_title}</h2>
            </div>
            <a href="/events" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '.9375rem' }}>{eventsText.events_view_all_label}</a>
          </div>

          <div className="tiny-eyebrow" style={{ marginBottom: '1rem' }}>{eventsText.upcoming_eyebrow}</div>
          <div>
            {upcoming.length > 0 ? (
              upcoming.map((e) => <EventRow key={e.title} event={e} />)
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <p className="muted-text" style={{ margin: 0 }}>
                  No upcoming events for now — check back soon.
                </p>
              </div>
            )}
          </div>

          {/* Committee categories */}
          <div style={{ marginTop: 'clamp(2.5rem, 6vw, 5rem)' }}>
            <div className="tiny-eyebrow">{eventsText.committees_eyebrow}</div>
            <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em', marginBottom: '2rem' }}>{eventsText.committees_title}</h2>
            {committees.length === 0 ? (
              <p className="muted-text">No committees configured yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {committees.map((c) => {
                  const info = {
                    short: c.code,
                    fullName: c.name,
                    color: committeeColor(c.code),
                    description: c.description || '',
                  };
                  const events = SORTED_EVENTS.filter((ev) => ev.committee === c.code);
                  return <CategoryCard key={c.id} committee={c.code} info={info} count={events.length} nextEvent={events[0]} />;
                })}
              </div>
            )}
          </div>
        </div>
      </section>


      {/* Recent Photos strip — surfaces the 4 newest gallery albums between
          the Events block and Premises section. Self-hides when no albums
          exist so a freshly bootstrapped site doesn't show an empty band. */}
      <RecentPhotosStrip limit={4} />

      {/* Branch Premises + NICASA */}
      <section className="container" style={{ padding: 'clamp(3rem, 8vw, 7rem) 1rem' }}>
        <div style={{ marginBottom: 'clamp(1.75rem, 4vw, 3rem)', maxWidth: '40rem' }}>
          <div className="tiny-eyebrow">{premisesText.outer_eyebrow}</div>
          <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{premisesText.outer_title}</h2>
        </div>
        <div style={{ display: 'grid', gap: '1.75rem', gridTemplateColumns: '1fr' }} data-premises-grid>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Admin-editable via /admin/site-content → Home tab →
                "Branch premises section". Default is a generic exterior
                photo until the branch uploads the real Bhawan shot. */}
            {premises.image_url && (
              <img
                src={premises.image_url}
                alt={premisesText.inner_title || 'Branch premises'}
                loading="lazy"
                style={{ width: '100%', display: 'block', aspectRatio: '16/7', objectFit: 'cover' }}
              />
            )}
            <div style={{ padding: '1.5rem' }}>
              <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>{premisesText.inner_eyebrow}</div>
              <h3 style={{ marginTop: '.25rem', fontSize: 'clamp(1.125rem, 3.2vw, 1.5rem)', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>{premisesText.inner_title}</h3>
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
              <a
                href="/book-room?room=reading-room"
                className="btn btn-primary"
                style={{ marginTop: '.85rem' }}
              >
                {premisesText.reading_room_label} <IconArrowRight size="sm" />
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
              <div className="tiny-eyebrow">{knowledgeText.eyebrow}</div>
              <h2 style={{ marginTop: '.5rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>{knowledgeText.title}</h2>
            </div>
            <a href="/resources" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '.9375rem' }}>{knowledgeText.view_all_label}</a>
          </div>
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {[
              { Icon: IconFileText, t: 'Latest Circulars', d: 'ICAI announcements, notifications and council decisions.' },
              { Icon: IconBookOpen, t: 'Standards (AS / SA)', d: 'Accounting Standards, Ind AS and Standards on Auditing.' },
              { Icon: IconDownload, t: 'e-Journal Archive', d: 'Browse The Chartered Accountant journal archives.' },
            ].map((k) => (
              <a key={k.t} href="/resources" className="card feature-card" style={{ padding: '1.75rem' }}>
                <div className="icon-tile"><k.Icon size="lg" /></div>
                <h3 style={{ marginTop: '1.25rem', fontSize: '1.1875rem', fontWeight: 700 }}>{k.t}</h3>
                <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.9rem', lineHeight: 1.6 }}>{k.d}</p>
                <div className="row gap-1 feature-cta" style={{ marginTop: '1.25rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>
                  Open <IconArrowRight size="sm" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Best Paper Presentation — promotion popup that fires ~1.4s after
          the homepage lands. Self-hides if no winner is flagged, and
          remembers dismissal per award year so it doesn't nag on every visit. */}
      <BestPaperPopup text={bestPaperText} />
    </>
  );
}
