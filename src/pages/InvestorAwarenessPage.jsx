import GenericPage from '../components/ui/GenericPage';
import { useLang } from '../context/LanguageContext';

export default function InvestorAwarenessPage() {
  const { t } = useLang();

  const SESSIONS = [
    { key: 's1', title: t('ui.investor.session1_title', 'Financial Planning for Young Professionals'), meta: '12 May · ICAI Bhawan' },
    { key: 's2', title: t('ui.investor.session2_title', 'Beware of Online Investment Frauds'),         meta: '19 May · Online' },
    { key: 's3', title: t('ui.investor.session3_title', "Senior Citizens' Money Health"),              meta: '26 May · Chitnavis Centre' },
  ];

  return (
    <GenericPage
      title={t('ui.investor.page_title', 'Investor Awareness')}
      subtitle={t('ui.investor.page_subtitle', 'Free programmes promoting financial literacy and safe investing.')}
      body={
        <div className="col gap-5">
          <p className="muted-text" style={{ lineHeight: 1.6 }}>
            {t('ui.investor.body', 'The branch conducts public investor awareness programmes in association with regulators and industry bodies to promote financial literacy, safe investing, fraud awareness and basic personal finance for students, salaried individuals and senior citizens.')}
          </p>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>{t('ui.investor.sessions_heading', 'Upcoming sessions')}</h3>
            <ul className="col gap-3" style={{ marginTop: '.75rem', padding: 0, listStyle: 'none' }}>
              {SESSIONS.map((s) => (
                <li key={s.key} className="row" style={{ justifyContent: 'space-between', padding: '.75rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{s.title}</div>
                    <div className="muted-text" style={{ fontSize: '.75rem' }}>{s.meta}</div>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '.4rem .9rem' }}>
                    {t('ui.investor.reserve_btn', 'Reserve')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
    />
  );
}
