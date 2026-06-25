import PageHeader from '../components/layout/PageHeader';
import { useLang } from '../context/LanguageContext';
import { IconGraduationCap, IconArrowRight, IconBriefcase } from '../icons';

export default function StudentsPage() {
  const { t } = useLang();

  const ITEMS = [
    { key: 'wicasa',       title: t('ui.students.wicasa_title',       'WICASA Events & Mock Tests'),    desc: t('ui.students.wicasa_desc',       'Foundation, Inter and Final mock tests, GMCS, ITT, orientation programmes.') },
    { key: 'articleship',  title: t('ui.students.articleship_title',  'Articleship Vacancies'),          desc: t('ui.students.articleship_desc',  'Browse openings posted by member firms across Nagpur and Vidarbha.') },
    { key: 'counselling',  title: t('ui.students.counselling_title',  'Career Counselling'),             desc: t('ui.students.counselling_desc',  '1-on-1 sessions with practising CAs and alma mater mentors.') },
    { key: 'study',        title: t('ui.students.study_title',        'Study Material & Resources'),     desc: t('ui.students.study_desc',        'Past papers, RTPs, MTPs and curated study notes.') },
    { key: 'scholarships', title: t('ui.students.scholarships_title', 'Scholarships & Awards'),          desc: t('ui.students.scholarships_desc', 'Information on merit-cum-need scholarships from CABF and the branch.') },
    { key: 'forum',        title: t('ui.students.forum_title',        'Student Forum'),                  desc: t('ui.students.forum_desc',        'Connect with peers, study groups and event volunteers.') },
  ];

  return (
    <>
      <PageHeader
        title={t('ui.students.page_title', 'For Students')}
        subtitle={t('ui.students.page_subtitle', 'Everything CA students of Nagpur need — in one place.')}
      />

      <div style={{ background: 'oklch(0.50 0.16 145 / 0.07)', borderBottom: '1px solid oklch(0.50 0.16 145 / 0.18)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconGraduationCap size="sm" style={{ color: 'var(--secondary)' }} />
            <span>
              {t('ui.students.portal_before', 'Registration, exam forms, results and study material are on the')}
              {' '}<strong>{t('ui.students.portal_name', 'official ICAI portal')}</strong>
              {t('ui.students.portal_after', '.')}
            </span>
          </div>
          <a href="https://www.icai.org/students" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '.4rem 1rem', flexShrink: 0 }}>
            {t('ui.students.portal_btn', 'Visit ICAI Students Portal')} <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="#/job-vacancies?type=articleship" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> {t('ui.students.articleship_btn', 'Articleship Vacancies')}
          </a>
          <a href="#/events" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> {t('ui.students.events_btn', 'Student Events')}
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ITEMS.map((s) => (
            <div key={s.key} className="card">
              <div className="icon-tile green"><IconGraduationCap size="lg" /></div>
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.title}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
