import PageHeader from '../components/layout/PageHeader';
import { useLang } from '../context/LanguageContext';
import { IconCheckCircle, IconArrowRight, IconUsers, IconBriefcase } from '../icons';

export default function MembersPage() {
  const { t } = useLang();

  const ITEMS = [
    { key: 'cop',   title: t('ui.members.cop_title',   'COP Renewal / Restoration / Surrender / Firm Registration'), desc: t('ui.members.cop_desc',   'Self-service Certificate of Practice workflows via ICAI eServices.') },
    { key: 'udin',  title: t('ui.members.udin_title',  'UDIN Generation & Verification'),                           desc: t('ui.members.udin_desc',  'Generate and verify Unique Document Identification Numbers.') },
    { key: 'cpe',   title: t('ui.members.cpe_title',   'CPE Hours Tracker'),                                        desc: t('ui.members.cpe_desc',   'Track structured/unstructured CPE hours against the 120-hours-in-3-years requirement.') },
    { key: 'forum', title: t('ui.members.forum_title', 'Member Networking Forum'),                                  desc: t('ui.members.forum_desc', 'Members-only forum for peer discussion and assignment opportunities.') },
  ];

  return (
    <>
      <PageHeader
        title={t('ui.members.page_title', 'For Members')}
        subtitle={t('ui.members.page_subtitle', 'Services, CPE and resources for Chartered Accountants')}
      />

      <div style={{ background: 'oklch(0.36 0.13 255 / 0.07)', borderBottom: '1px solid oklch(0.36 0.13 255 / 0.15)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconUsers size="sm" style={{ color: 'var(--primary)' }} />
            <span>
              {t('ui.members.portal_before', 'All member services, UDIN, COP and CPE records are managed at the')}
              {' '}<strong>{t('ui.members.portal_name', 'official ICAI portal')}</strong>
              {t('ui.members.portal_after', '.')}
            </span>
          </div>
          <a href="https://www.icai.org/members" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '.4rem 1rem', flexShrink: 0 }}>
            {t('ui.members.portal_btn', 'Visit ICAI Members Portal')} <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="#/members-directory" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconUsers size="sm" /> {t('ui.members.directory_btn', "Members' Directory")}
          </a>
          <a href="#/job-vacancies" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> {t('ui.members.vacancies_btn', 'Job Vacancies')}
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ITEMS.map((s) => (
            <div key={s.key} className="card">
              <IconCheckCircle style={{ color: 'var(--secondary)' }} size="lg" />
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.title}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
