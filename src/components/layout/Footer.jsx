import { SOCIALS, ICAI_LINKS } from '../../data/constants';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { useLang } from '../../context/LanguageContext';

export default function Footer() {
  const { settings } = useSiteSettings();
  const { t } = useLang();

  return (
    <footer style={{ marginTop: '5rem', borderTop: '1px solid var(--border)', background: 'oklch(0.96 0.01 240 / 0.4)' }}>

      {/* Mandatory ICAI & WIRC links bar (per Web-Media Policy 5q) */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--primary)', padding: '.625rem 1rem' }}>
        <div className="container row gap-4" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem' }}>
          <a
            href="https://www.icai.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-toplink"
            style={{ color: 'white', fontSize: '.8125rem', fontWeight: 600, opacity: .9 }}
          >
            ICAI.org
          </a>
          <span style={{ color: 'rgba(255,255,255,.3)', fontSize: '.75rem' }}>|</span>
          <a
            href="https://www.wirc-icai.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-toplink"
            style={{ color: 'white', fontSize: '.8125rem', fontWeight: 600, opacity: .9 }}
          >
            WIRC of ICAI
          </a>
          <span style={{ color: 'rgba(255,255,255,.3)', fontSize: '.75rem', display: 'none' }} data-sep>|</span>
          {ICAI_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-toplink"
              style={{ color: 'rgba(255,255,255,.75)', fontSize: '.75rem' }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* Main footer grid */}
      <div
        className="container"
        style={{ display: 'grid', gap: '2rem', padding: '3rem 1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>{t('ui.footer.name', 'ICAI Nagpur Branch')}</div>
          <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
            {t('ui.footer.desc', 'Branch of WIRC of The Institute of Chartered Accountants of India.')}
          </p>
          {/* Official ICAI Social Media Links (per Web-Media Policy 5r) */}
          <div className="row gap-3" style={{ marginTop: '1rem' }}>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="muted-text"
              >
                <s.Icon />
              </a>
            ))}
          </div>
          <div className="col gap-1 muted-text" style={{ marginTop: '1rem', fontSize: '.8125rem' }}>
            <span>{settings.branch_address}</span>
            <span>{settings.branch_phone}</span>
            <span>{settings.branch_email}</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{t('ui.footer.quick_links', 'Quick Links')}</div>
          <ul className="col gap-2 muted-text" style={{ marginTop: '.75rem', padding: 0, listStyle: 'none', fontSize: '.875rem' }}>
            <li><a href="#/about">{t('ui.footer.link_about', 'About the Branch')}</a></li>
            <li><a href="#/events">{t('ui.footer.link_events', 'Events & CPE')}</a></li>
            <li><a href="#/members">{t('ui.footer.link_members', 'For Members')}</a></li>
            <li><a href="#/students">{t('ui.footer.link_students', 'For Students')}</a></li>
            <li><a href="#/gallery">{t('ui.footer.link_gallery', 'Photo Gallery')}</a></li>
            <li><a href="#/job-vacancies">{t('ui.footer.link_jobs', 'Job Vacancies')}</a></li>
            <li><a href="#/members-directory">{t('ui.footer.link_directory', "Members' Directory")}</a></li>
          </ul>
        </div>

        <div>
          <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{t('ui.footer.initiatives', 'Initiatives')}</div>
          <ul className="col gap-2 muted-text" style={{ marginTop: '.75rem', padding: 0, listStyle: 'none', fontSize: '.875rem' }}>
            <li><a href="#/benevolent-fund">{t('ui.footer.link_benevolent', 'CA Benevolent Fund')}</a></li>
            <li><a href="#/ca2-vision">{t('ui.footer.link_ca2', 'CA 2.0 Vision')}</a></li>
            <li><a href="#/investor-awareness">{t('ui.footer.link_investor', 'Investor Awareness')}</a></li>
            <li><a href="#/career-counselling">{t('ui.footer.link_counselling', 'Career Counselling')}</a></li>
          </ul>
        </div>

        <div>
          <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{t('ui.footer.icai_portals', 'ICAI Portals')}</div>
          <ul className="col gap-2 muted-text" style={{ marginTop: '.75rem', padding: 0, listStyle: 'none', fontSize: '.875rem' }}>
            {ICAI_LINKS.slice(0, 5).map((l) => (
              <li key={l.label}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '1rem',
          textAlign: 'center',
          fontSize: '.75rem',
          color: 'var(--muted-foreground)',
        }}
      >
        {settings.footer_disclaimer}
      </div>
    </footer>
  );
}
