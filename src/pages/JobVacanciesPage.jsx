import PageHeader from '../components/layout/PageHeader';
import { useRoute } from '../hooks/useRoute';
import { ARTICLE_VACANCIES, MEMBER_VACANCIES } from '../data/constants';
import { IconGraduationCap, IconMapPin, IconCalendar, IconMail } from '../icons';

const NOTICE = (
  <div style={{
    background: 'oklch(0.36 0.13 255 / 0.06)',
    border: '1px solid oklch(0.36 0.13 255 / 0.15)',
    borderRadius: '.5rem',
    padding: '.875rem 1rem',
    marginBottom: '2rem',
    fontSize: '.8125rem',
    color: 'var(--foreground)',
  }}>
    <strong>Notice:</strong> These vacancies are posted by member firms and organisations in Nagpur / Vidarbha region.
    The branch does not verify or endorse any posting. Contact the respective firm directly for enquiries.
  </div>
);

export default function JobVacanciesPage() {
  const route = useRoute();
  const isArticleship = route.query.type === 'articleship';

  if (isArticleship) {
    return (
      <>
        <PageHeader
          title="Articleship Vacancies"
          subtitle="Articleship openings posted by member firms in Nagpur / Vidarbha"
        />
        <section className="container" style={{ padding: '2.5rem 1rem' }}>
          {NOTICE}
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="tiny-eyebrow">For CA Students</div>
            <h2 style={{ marginTop: '.25rem', fontSize: '1.5rem', fontWeight: 700 }}>Articleship Vacancies</h2>
            <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
              Member firms in Nagpur seeking articles for practical training.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {ARTICLE_VACANCIES.map((v) => (
              <div key={v.firm} className="card" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '1.25rem' }}>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{v.firm}</h3>
                  <div className="row gap-4" style={{ marginTop: '.5rem', flexWrap: 'wrap' }}>
                    <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
                      <IconMapPin size="sm" /> {v.location}
                    </span>
                    <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
                      <IconGraduationCap size="sm" /> {v.seats} seat{v.seats !== 1 ? 's' : ''} available
                    </span>
                    <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
                      <IconCalendar size="sm" /> Posted {v.posted}
                    </span>
                  </div>
                </div>
                <a
                  href={`mailto:${v.contact}`}
                  className="btn btn-primary"
                  style={{ padding: '.4rem .9rem', fontSize: '.8125rem', flexShrink: 0 }}
                >
                  <IconMail size="sm" /> Apply
                </a>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  // Members job portal — member vacancies only
  return (
    <>
      <PageHeader
        title="Job Vacancies"
        subtitle="Member job opportunities in Nagpur / Vidarbha region"
      />
      <section className="container" style={{ padding: '2.5rem 1rem' }}>
        {NOTICE}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">For CA Members</div>
          <h2 style={{ marginTop: '.25rem', fontSize: '1.5rem', fontWeight: 700 }}>Member Job Vacancies</h2>
          <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
            Positions in industry, corporates and practice firms seeking qualified Chartered Accountants.
          </p>
        </div>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {MEMBER_VACANCIES.map((v) => (
            <div key={v.role + v.firm} className="card" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '1.25rem' }}>
              <div>
                <div className="row gap-2" style={{ marginBottom: '.25rem' }}>
                  <span style={{
                    padding: '.1rem .45rem',
                    borderRadius: '.25rem',
                    fontSize: '.7rem',
                    fontWeight: 600,
                    background: 'oklch(0.36 0.13 255 / 0.1)',
                    color: 'var(--primary)',
                  }}>
                    {v.exp} exp.
                  </span>
                </div>
                <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{v.role}</h3>
                <div style={{ fontSize: '.875rem', color: 'var(--muted-foreground)', marginTop: '.2rem' }}>{v.firm}</div>
                <div className="row gap-4" style={{ marginTop: '.5rem', flexWrap: 'wrap' }}>
                  <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
                    <IconMapPin size="sm" /> {v.location}
                  </span>
                  <span className="row gap-1 muted-text" style={{ fontSize: '.8125rem' }}>
                    <IconCalendar size="sm" /> Posted {v.posted}
                  </span>
                </div>
              </div>
              <a
                href="#/contact"
                className="btn btn-primary"
                style={{ padding: '.4rem .9rem', fontSize: '.8125rem', flexShrink: 0 }}
              >
                <IconMail size="sm" /> Enquire
              </a>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
