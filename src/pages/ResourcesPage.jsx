import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useLang } from '../context/LanguageContext';
import { IconArrowRight, IconFileText, IconBookOpen, IconDownload, IconAward, IconShield, IconCalendar, IconUsers } from '../icons';

const COMMITTEE_COLORS = {
  GST:          { color: '#16a34a', bg: '#f0fdf4' },
  'Direct Tax': { color: '#ea580c', bg: '#fff7ed' },
  IT:           { color: '#4f46e5', bg: '#eef2ff' },
  Audit:        { color: '#0891b2', bg: '#ecfeff' },
  CPE:          { color: '#2563eb', bg: '#eff6ff' },
  WICASA:       { color: '#7c3aed', bg: '#f5f3ff' },
  Branch:       { color: '#6b7280', bg: '#f9fafb' },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function ResourcesPage() {
  const { t } = useLang();
  const [papers, setPapers]           = useState(null);
  const [newsletters, setNewsletters] = useState(null);
  const [err, setErr]                 = useState('');

  const CATS = [
    { Icon: IconFileText, key: 'circulars',  title: t('ui.resources.circulars_title', 'Circulars'),           desc: t('ui.resources.circulars_desc', 'ICAI announcements, notifications and council decisions.') },
    { Icon: IconBookOpen, key: 'standards',  title: t('ui.resources.standards_title', 'Standards (AS / SA)'), desc: t('ui.resources.standards_desc', 'Accounting Standards, Ind AS and Standards on Auditing.') },
    { Icon: IconAward,    key: 'ejournal',   title: t('ui.resources.ejournal_title',  'e-Journal Archive'),   desc: t('ui.resources.ejournal_desc',  'Browse The Chartered Accountant journal archives.') },
    { Icon: IconShield,   key: 'webmedia',   title: t('ui.resources.webmedia_title',  'Web-Media Policy'),    desc: t('ui.resources.webmedia_desc',  'ICAI guidelines for member online presence.') },
  ];

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api('/api/paper-presentations'),
      api('/api/newsletters'),
    ])
      .then(([p, n]) => {
        if (cancelled) return;
        setPapers(p.items || []);
        setNewsletters(n.items || []);
      })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader
        title={t('ui.resources.page_title', 'Resources')}
        subtitle={t('ui.resources.page_subtitle', 'Standards, circulars, newsletters and downloadable presentations.')}
      />

      <section className="container" style={{ padding: '3rem 1rem 2rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {CATS.map((s) => (
            <div key={s.key} className="card hover-lift">
              <div className="icon-tile"><s.Icon size="lg" /></div>
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.title}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.desc}</p>
              <div className="row gap-1" style={{ marginTop: '1rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 500 }}>
                {t('ui.resources.open', 'Open')} <IconArrowRight size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '2rem 1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">{t('ui.resources.newsletter_eyebrow', 'Monthly')}</div>
          <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.3rem, 4.2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.15 }}>
            {t('ui.resources.newsletter_heading', 'Branch Newsletter')}
          </h2>
          <p className="muted-text" style={{ marginTop: '.5rem', maxWidth: '44rem', fontSize: '.875rem' }}>
            {t('ui.resources.newsletter_desc', 'The Nagpur Branch monthly newsletter — events recap, articles, member updates.')}
          </p>
        </div>

        {newsletters === null ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>{t('ui.resources.loading', 'Loading…')}</p>
        ) : newsletters.length === 0 ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>{t('ui.resources.no_newsletters', 'No newsletters published yet.')}</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {newsletters.map((n) => (
              <a
                key={n.id}
                href={n.pdf_url || '#'}
                target={n.pdf_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="card hover-lift"
                style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}
              >
                {n.cover_url ? (
                  <img src={n.cover_url} alt={n.title} loading="lazy"
                       style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '3/4',
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.85rem', fontWeight: 700, textAlign: 'center', padding: '1rem',
                  }}>
                    {MONTH_NAMES[n.issue_month - 1]} {n.issue_year}
                  </div>
                )}
                <div style={{ padding: '.875rem 1rem 1rem' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {MONTH_NAMES[n.issue_month - 1]} {n.issue_year}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '.95rem', marginTop: '.15rem' }}>{n.title}</div>
                  {n.pdf_url && (
                    <div className="row gap-1" style={{ marginTop: '.5rem', color: 'var(--primary)', fontSize: '.8rem', fontWeight: 600 }}>
                      <IconDownload size="sm" /> {t('ui.resources.download_pdf', 'Download PDF')}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="container" style={{ padding: '2rem 1rem 4rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">{t('ui.resources.papers_eyebrow', 'Seminars & Conferences')}</div>
          <h2 style={{ marginTop: '.25rem', fontSize: 'clamp(1.3rem, 4.2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.15 }}>
            {t('ui.resources.papers_heading', 'Paper Presentations')}
          </h2>
          <p className="muted-text" style={{ marginTop: '.5rem', maxWidth: '44rem', fontSize: '.875rem' }}>
            {t('ui.resources.papers_desc', 'Presentations and papers from past conferences and seminars held at the Nagpur Branch.')}
          </p>
        </div>

        <div style={{
          background: 'oklch(0.85 0.16 90 / 0.3)',
          border: '1px solid oklch(0.85 0.16 90 / 0.6)',
          borderRadius: '.5rem',
          padding: '.875rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '.8125rem',
          color: 'var(--foreground)',
        }}>
          {t('ui.resources.disclaimer', 'Disclaimer: The views expressed in these presentations are of the Speaker himself/herself. The Institute of Chartered Accountants of India does not subscribe to his/her views.')}
        </div>

        {err && <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>{err}</p>}

        {papers === null ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>{t('ui.resources.loading', 'Loading…')}</p>
        ) : papers.length === 0 ? (
          <p className="muted-text" style={{ fontSize: '.875rem' }}>{t('ui.resources.no_papers', 'No presentations have been published yet.')}</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {papers.map((p) => {
              const meta = COMMITTEE_COLORS[p.committee_tag] || { color: '#6b7280', bg: '#f9fafb' };
              return (
                <div key={p.id} className="card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
                  {p.committee_tag && (
                    <div className="row gap-2" style={{ marginBottom: '.75rem' }}>
                      <span style={{
                        padding: '.125rem .5rem', borderRadius: '.25rem', fontSize: '.7rem', fontWeight: 600,
                        background: meta.bg, color: meta.color,
                      }}>{p.committee_tag}</span>
                    </div>
                  )}
                  <h3 style={{ fontWeight: 600, fontSize: '.9375rem', lineHeight: 1.4, flex: 1 }}>{p.title}</h3>
                  <div className="col gap-1 muted-text" style={{ marginTop: '.75rem', fontSize: '.75rem' }}>
                    <div className="row gap-2"><IconUsers size="sm" /> {p.speaker_name}</div>
                    {(p.event_title || p.presented_on) && (
                      <div className="row gap-2">
                        <IconCalendar size="sm" />
                        {p.event_title ? <span>{p.event_title}</span> : null}
                        {p.event_title && p.presented_on ? <span> · </span> : null}
                        {p.presented_on ? <span>{new Date(p.presented_on).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span> : null}
                      </div>
                    )}
                  </div>
                  {p.pdf_url ? (
                    <a href={p.pdf_url} target="_blank" rel="noopener noreferrer"
                       className="btn btn-outline"
                       style={{ marginTop: '1rem', justifyContent: 'center', fontSize: '.8125rem', padding: '.4rem .75rem' }}>
                      <IconDownload size="sm" /> {t('ui.resources.download_pdf', 'Download PDF')}
                    </a>
                  ) : (
                    <span className="muted-text" style={{ marginTop: '1rem', fontSize: '.75rem' }}>
                      {t('ui.resources.pdf_not_uploaded', 'PDF not yet uploaded')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
