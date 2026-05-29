import PageHeader from '../components/layout/PageHeader';
import { IconGraduationCap, IconArrowRight, IconBriefcase } from '../icons';

const ITEMS = [
  { t: 'WICASA Events & Mock Tests', d: 'Foundation, Inter and Final mock tests, GMCS, ITT, orientation programmes.' },
  { t: 'Articleship Vacancies', d: 'Browse openings posted by member firms across Nagpur and Vidarbha.' },
  { t: 'Career Counselling', d: '1-on-1 sessions with practising CAs and alma mater mentors.' },
  { t: 'Study Material & Resources', d: 'Past papers, RTPs, MTPs and curated study notes.' },
  { t: 'Scholarships & Awards', d: 'Information on merit-cum-need scholarships from CABF and the branch.' },
  { t: 'Student Forum', d: 'Connect with peers, study groups and event volunteers.' },
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
          <a href="#/job-vacancies?type=articleship" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> Articleship Vacancies
          </a>
          <a href="#/events" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> Student Events
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ITEMS.map((s) => (
            <div key={s.t} className="card">
              <div className="icon-tile green"><IconGraduationCap size="lg" /></div>
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.t}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
