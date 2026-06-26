import PageHeader from '../components/layout/PageHeader';
import { IconCheckCircle, IconArrowRight, IconUsers, IconBriefcase, IconShield, IconAward, IconBookOpen } from '../icons';

// Each card now declares a real destination. `href` = where the click goes;
// `external` = open in new tab + show ↗ marker + add ICAI-login-wall note;
// `comingSoon` = render a muted "Coming soon" pill; click still routes the
// user to /contact so they have a way to ask now instead of dead-ending.
const ITEMS = [
  {
    Icon: IconShield,
    t: 'COP Renewal · Restoration · Firm Registration',
    d: 'Self-service Certificate of Practice workflows on ICAI eServices.',
    href: 'https://eservices.icai.org/',
    external: true,
  },
  {
    Icon: IconCheckCircle,
    t: 'UDIN Generation & Verification',
    d: 'Generate and verify Unique Document Identification Numbers on the ICAI UDIN portal.',
    href: 'https://udin.icai.org/',
    external: true,
  },
  {
    Icon: IconAward,
    t: 'CPE Hours Tracker',
    d: 'Track structured / unstructured CPE hours against the 120-hours-in-3-years requirement.',
    href: '#/dashboard',
    note: 'Sign in to see your live tracker · official records on ICAI CPE portal',
  },
  {
    Icon: IconBookOpen,
    t: 'Newsletter Archive & Article Submission',
    d: 'Read past issues of the Nagpur Branch monthly newsletter — and submit your own article to be featured in an upcoming issue.',
    href: '#/resources',
    note: 'Submit an article → /resources/submit',
  },
];

export default function MembersPage() {
  return (
    <>
      <PageHeader title="For Members" subtitle="Services, CPE and resources for Chartered Accountants" />

      {/* ICAI.org link banner (per Web-Media Policy 5c) */}
      <div style={{ background: 'oklch(0.36 0.13 255 / 0.07)', borderBottom: '1px solid oklch(0.36 0.13 255 / 0.15)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconUsers size="sm" style={{ color: 'var(--primary)' }} />
            <span>All member services, UDIN, COP and CPE records are managed at the <strong>official ICAI portal</strong> (ICAI SSP sign-in required).</span>
          </div>
          <a
            href="https://www.icai.org/members"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '.4rem 1rem', flexShrink: 0 }}
          >
            Visit ICAI Members Portal <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>

        {/* Quick access row */}
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="#/members-directory" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconUsers size="sm" /> Members' Directory
          </a>
          <a href="#/job-vacancies" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> Job Vacancies
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ITEMS.map((s) => {
            const linkProps = s.external
              ? { href: s.href, target: '_blank', rel: 'noopener noreferrer' }
              : { href: s.href };
            return (
              <a
                key={s.t}
                {...linkProps}
                className="card members-svc-card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <s.Icon style={{ color: 'var(--secondary)' }} size="lg" />
                  {s.comingSoon && (
                    <span className="badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: '.7rem', padding: '.2rem .55rem', borderRadius: 999 }}>
                      Coming soon
                    </span>
                  )}
                  {s.external && (
                    <span aria-hidden style={{ color: 'var(--muted-foreground)', fontSize: '.85rem' }}>↗</span>
                  )}
                </div>
                <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.t}</h3>
                <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.d}</p>
                {s.note && (
                  <p className="muted-text" style={{ marginTop: '.55rem', fontSize: '.75rem', fontStyle: 'italic' }}>{s.note}</p>
                )}
                <div className="row gap-1" style={{ marginTop: '.75rem', fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {s.comingSoon ? 'Ask the branch' : (s.external ? 'Open on ICAI' : 'Open')}
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
