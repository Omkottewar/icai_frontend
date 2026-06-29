import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconGraduationCap, IconArrowRight, IconBriefcase, IconBookOpen, IconUsers, IconAward, IconMessageSquare } from '../icons';

// All copy is admin-editable via /admin/site-content → Students tab.
// Icons + href targets stay structural (they map to internal routes / icon
// components), but the title and description on each of the 6 service tiles
// pulls from the `students_services` slot, so the admin can rename or
// rewrite any card without touching code.

// Fixed structural data for each card — the icon + destination + the
// optional "Coming soon" pill. Title and description are filled in from
// site content at render time using the keys below.
const CARD_FRAMES = [
  { Icon: IconGraduationCap, href: '/mock-tests',                        comingSoon: false },
  { Icon: IconBriefcase,     href: '/job-vacancies?type=articleship',    comingSoon: false },
  { Icon: IconUsers,         href: '/career-counselling',                comingSoon: true  },
  { Icon: IconBookOpen,      href: '/resources',                          comingSoon: false },
  { Icon: IconAward,         href: '/contact',                            comingSoon: true  },
  { Icon: IconMessageSquare, href: '/mock-tests',                        comingSoon: false },
];

export default function StudentsPage() {
  const header      = useSiteContent('students_page_header');
  const banner      = useSiteContent('students_icai_banner');
  const quickAccess = useSiteContent('students_quick_access');
  const services    = useSiteContent('students_services');

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      {/* ICAI.org link banner (per Web-Media Policy 5d) */}
      <div style={{ background: 'oklch(0.50 0.16 145 / 0.07)', borderBottom: '1px solid oklch(0.50 0.16 145 / 0.18)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconGraduationCap size="sm" style={{ color: 'var(--secondary)' }} />
            <span>{renderMarkdown(banner.body)}</span>
          </div>
          <a
            href={banner.button_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '.4rem 1rem', flexShrink: 0 }}
          >
            {banner.button_label} <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>

        {/* Quick access row */}
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="/mock-tests" className="btn btn-primary" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> {quickAccess.mock_tests_label}
          </a>
          <a href="/job-vacancies?type=articleship" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> {quickAccess.articleship_label}
          </a>
          <a href="/events?audience=Students" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> {quickAccess.events_label}
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {CARD_FRAMES.map((frame, i) => {
            const n = i + 1;
            const title = services[`card_${n}_title`];
            const desc  = services[`card_${n}_desc`];
            // Skip the tile entirely if the admin has blanked out the title —
            // lets them shrink the grid from 6 → fewer cards without code.
            if (!title) return null;
            return (
              <a
                key={n}
                href={frame.href}
                className="card students-svc-card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="icon-tile green"><frame.Icon size="lg" /></div>
                  {frame.comingSoon && (
                    <span className="badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: '.7rem', padding: '.2rem .55rem', borderRadius: 999 }}>
                      Coming soon
                    </span>
                  )}
                </div>
                <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{title}</h3>
                <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{desc}</p>
                <div className="row gap-1" style={{ marginTop: '.75rem', fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {frame.comingSoon ? 'Ask the branch' : 'Open'}
                  <IconArrowRight size="sm" />
                </div>
              </a>
            );
          })}
        </div>
      </section>
      <style>{`
        .students-svc-card { transition: transform .12s, box-shadow .12s; }
        .students-svc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,.08); }
        .students-svc-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      `}</style>
    </>
  );
}
