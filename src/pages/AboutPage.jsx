import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { useManagingCommittee } from '../hooks/useManagingCommittee';
import { useLang } from '../context/LanguageContext';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconDownload } from '../icons';

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'CA';
}

export default function AboutPage() {
  const { t } = useLang();

  const ROLE_KEYS = {
    branch_chairman:      'ui.about.role_chairperson',
    branch_vice_chairman: 'ui.about.role_vice_chairperson',
    branch_secretary:     'ui.about.role_secretary',
    branch_treasurer:     'ui.about.role_treasurer',
    mcm:                  'ui.about.role_mcm',
  };
  const ROLE_FALLBACKS = {
    branch_chairman:      'Chairperson',
    branch_vice_chairman: 'Vice Chairperson',
    branch_secretary:     'Secretary',
    branch_treasurer:     'Treasurer',
    mcm:                  'Managing Committee Member',
  };

  const vision    = useSiteContent('about_vision');
  const mission   = useSiteContent('about_mission');
  const history   = useSiteContent('about_history');
  const committee = useSiteContent('about_committee_members');
  const { rows: profileRoster } = useManagingCommittee();

  const [chairmen, setChairmen] = useState([]);
  const [reports, setReports]   = useState([]);
  useEffect(() => {
    Promise.all([
      api('/api/office-bearers?view=chairmen').catch(() => ({ items: [] })),
      api('/api/annual-reports').catch(() => ({ items: [] })),
    ]).then(([c, r]) => {
      setChairmen(c.items || []);
      setReports(r.items || []);
    });
  }, []);

  const roster = Array.isArray(committee.members) && committee.members.length > 0
    ? committee.members.map((m) => ({ user_id: m.user_id, name: m.name, avatar_url: m.photo_url, role_name: m.designation }))
    : profileRoster;

  return (
    <>
      <PageHeader
        title={t('ui.about.page_title', 'About the Branch')}
        subtitle={t('ui.about.page_subtitle', 'Established 1962 · Branch of WIRC of ICAI')}
      />
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <div className="tiny-eyebrow">{t('ui.about.vision_eyebrow', 'Vision')}</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{t('ui.about.vision_heading', 'A model branch of ICAI')}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(vision.body)}
            </div>
          </div>
          <div className="card">
            <div className="tiny-eyebrow">{t('ui.about.mission_eyebrow', 'Mission')}</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{t('ui.about.mission_heading', 'Service to the profession')}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(mission.body)}
            </div>
          </div>
          <div className="card">
            <div className="tiny-eyebrow">{t('ui.about.history_eyebrow', 'History')}</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{t('ui.about.history_heading', 'Six decades of service')}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(history.body)}
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 700 }}>{t('ui.about.committee_heading', 'Managing Committee')}</h2>
        {roster.length === 0 ? (
          <p className="muted-text" style={{ marginTop: '1rem' }}>
            {t('ui.about.committee_empty', 'The roster will appear here once committee members are assigned.')}
          </p>
        ) : (
          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {roster.map((p) => (
              <div key={p.user_id} className="card" style={{ textAlign: 'center' }}>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} loading="lazy"
                    style={{ width: '4.5rem', height: '4.5rem', borderRadius: 999, margin: '0 auto', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: 999, margin: '0 auto', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {initials(p.name)}
                  </div>
                )}
                <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{p.name}</div>
                <div className="muted-text" style={{ fontSize: '.8125rem' }}>
                  {ROLE_KEYS[p.role_code] ? t(ROLE_KEYS[p.role_code], ROLE_FALLBACKS[p.role_code]) : p.role_name}
                </div>
              </div>
            ))}
          </div>
        )}

        {chairmen.length > 0 && (
          <>
            <h2 style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 700 }}>{t('ui.about.chairmen_heading', 'Past Chairmen')}</h2>
            <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem', maxWidth: '44rem' }}>
              {t('ui.about.chairmen_desc', 'Members who have led the Nagpur Branch over the decades.')}
            </p>
            <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {chairmen.map((c) => (
                <div key={c.id} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  {c.photo_url ? (
                    <img src={c.photo_url} alt={c.person_name} loading="lazy"
                         style={{ width: '4rem', height: '4rem', borderRadius: 999, margin: '0 auto', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '4rem', height: '4rem', borderRadius: 999, margin: '0 auto', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.85rem' }}>
                      {initials(c.person_name)}
                    </div>
                  )}
                  <div style={{ marginTop: '.75rem', fontWeight: 600, fontSize: '.9rem' }}>{c.person_name}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>{c.term_label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {reports.length > 0 && (
          <>
            <h2 style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 700 }}>{t('ui.about.reports_heading', 'Annual Reports')}</h2>
            <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem', maxWidth: '44rem' }}>
              {t('ui.about.reports_desc', 'Year-on-year reports of branch activities, finances and member services.')}
            </p>
            <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {reports.map((r) => (
                <a
                  key={r.id}
                  href={r.pdf_url || '#'}
                  target={r.pdf_url ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="card hover-lift"
                  style={{ padding: '1rem', textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="tiny-eyebrow">{t('ui.about.fy_label', 'FY')} {r.fy_label}</div>
                  <div style={{ fontWeight: 600, marginTop: '.25rem' }}>{r.title || `Annual Report ${r.fy_label}`}</div>
                  {r.summary && (
                    <p className="muted-text" style={{ marginTop: '.35rem', fontSize: '.8rem' }}>{r.summary}</p>
                  )}
                  {r.pdf_url ? (
                    <div className="row gap-1" style={{ marginTop: '.65rem', color: 'var(--primary)', fontSize: '.8rem', fontWeight: 600 }}>
                      <IconDownload size="sm" /> {t('ui.about.download_pdf', 'Download PDF')}
                    </div>
                  ) : (
                    <div className="muted-text" style={{ marginTop: '.65rem', fontSize: '.75rem' }}>{t('ui.about.pdf_not_uploaded', 'PDF not uploaded')}</div>
                  )}
                </a>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
