import PageHeader from '../components/layout/PageHeader';
import { IconGraduationCap, IconArrowRight, IconBriefcase, IconBookOpen, IconUsers, IconAward, IconMessageSquare } from '../icons';

// Each card has a real destination now. `comingSoon` cards stay visible
// (we don't want to over-promise launch scope) but route the user to
// /contact so they can ask the branch directly instead of dead-ending.
const ITEMS = [
  {
    Icon: IconGraduationCap,
    t: 'WICASA Events & Mock Tests',
    d: 'Foundation, Inter and Final mock tests, GMCS, ITT, orientation programmes.',
    href: '#/mock-tests',
  },
  {
    Icon: IconBriefcase,
    t: 'Articleship Vacancies',
    d: 'Browse openings posted by member firms across Nagpur and Vidarbha.',
    href: '#/job-vacancies?type=articleship',
  },
  {
    Icon: IconUsers,
    t: 'Career Counselling',
    d: '1-on-1 sessions with practising CAs and alma mater mentors.',
    href: '#/career-counselling',
    comingSoon: true,
  },
  {
    Icon: IconBookOpen,
    t: 'Study Material & Resources',
    d: 'Past papers, RTPs, MTPs and curated study notes.',
    href: '#/resources',
  },
  {
    Icon: IconAward,
    t: 'Scholarships & Awards',
    d: 'Information on merit-cum-need scholarships from CABF and the branch.',
    href: '#/contact',
    comingSoon: true,
  },
  {
    Icon: IconMessageSquare,
    t: 'Mock-Test Discussions',
    d: 'Discuss questions, solutions and strategies with other students for every Foundation / Inter / Final mock test.',
    href: '#/mock-tests',
  },
];

export default function StudentsPage() {
  return (
    <>
      <PageHeader title="For Students" subtitle="Everything CA students of Nagpur need — in one place." />

      {/* ICAI.org link banner (per Web-Media Policy 5d) */}
      <div style={{ background: 'oklch(0.50 0.16 145 / 0.07)', borderBottom: '1px solid oklch(0.50 0.16 145 / 0.18)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconGraduationCap size="sm" style={{ color: 'var(--secondary)' }} />
            <span>Registration, exam forms, results and study material are on the <strong>official ICAI portal</strong>.</span>
          </div>
          <a
            href="https://www.icai.org/students"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '.4rem 1rem', flexShrink: 0 }}
          >
            Visit ICAI Students Portal <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>

        {/* Quick access row */}
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="#/mock-tests" className="btn btn-primary" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> Mock tests
          </a>
          <a href="#/job-vacancies?type=articleship" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> Articleship Vacancies
          </a>
          <a href="#/events?audience=Students" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> Student Events
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ITEMS.map((s) => (
            <a
              key={s.t}
              href={s.href}
              className="card students-svc-card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="icon-tile green"><s.Icon size="lg" /></div>
                {s.comingSoon && (
                  <span className="badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: '.7rem', padding: '.2rem .55rem', borderRadius: 999 }}>
                    Coming soon
                  </span>
                )}
              </div>
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.t}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.d}</p>
              <div className="row gap-1" style={{ marginTop: '.75rem', fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                {s.comingSoon ? 'Ask the branch' : 'Open'}
                <IconArrowRight size="sm" />
              </div>
            </a>
          ))}
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
