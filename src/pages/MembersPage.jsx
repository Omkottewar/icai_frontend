import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconCheckCircle, IconArrowRight, IconUsers, IconBriefcase, IconShield, IconAward, IconBookOpen } from '../icons';

// All copy is admin-editable via /admin/site-content → Members tab. Each
// card declares its destination + icon here (structural); title and
// description come from the `members_services` slot at render time.

const CARD_FRAMES = [
  { Icon: IconShield,       href: 'https://eservices.icai.org/', external: true,                                 },
  { Icon: IconCheckCircle,  href: 'https://udin.icai.org/',      external: true,                                 },
  { Icon: IconAward,        href: '/dashboard',                 note: 'Sign in to see your live tracker · official records on ICAI CPE portal' },
  { Icon: IconBookOpen,     href: '/resources',                 note: 'Submit an article → /resources/submit' },
];

export default function MembersPage() {
  const header      = useSiteContent('members_page_header');
  const banner      = useSiteContent('members_icai_banner');
  const quickAccess = useSiteContent('members_quick_access');
  const services    = useSiteContent('members_services');

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      {/* ICAI.org link banner (per Web-Media Policy 5c) */}
      <div style={{ background: 'oklch(0.36 0.13 255 / 0.07)', borderBottom: '1px solid oklch(0.36 0.13 255 / 0.15)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconUsers size="sm" style={{ color: 'var(--primary)' }} />
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
          <a href="/members-directory" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconUsers size="sm" /> {quickAccess.directory_label}
          </a>
          <a href="/job-vacancies" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> {quickAccess.jobs_label}
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {CARD_FRAMES.map((frame, i) => {
            const n = i + 1;
            const title = services[`card_${n}_title`];
            const desc  = services[`card_${n}_desc`];
            if (!title) return null;
            const linkProps = frame.external
              ? { href: frame.href, target: '_blank', rel: 'noopener noreferrer' }
              : { href: frame.href };
            return (
              <a
                key={n}
                {...linkProps}
                className="card members-svc-card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <frame.Icon style={{ color: 'var(--secondary)' }} size="lg" />
                  {frame.external && (
                    <span aria-hidden style={{ color: 'var(--muted-foreground)', fontSize: '.85rem' }}>↗</span>
                  )}
                </div>
                <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{title}</h3>
                <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{desc}</p>
                {frame.note && (
                  <p className="muted-text" style={{ marginTop: '.55rem', fontSize: '.75rem', fontStyle: 'italic' }}>{frame.note}</p>
                )}
                <div className="row gap-1" style={{ marginTop: '.75rem', fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {frame.external ? 'Open on ICAI' : 'Open'}
                  <IconArrowRight size="sm" />
                </div>
              </a>
            );
          })}
        </div>
      </section>
      <style>{`
        .members-svc-card { transition: transform .12s, box-shadow .12s; }
        .members-svc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,.08); }
        .members-svc-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      `}</style>
    </>
  );
}
