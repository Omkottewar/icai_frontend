import PageHeader from '../components/layout/PageHeader';
import { IconArrowRight, IconFileText, IconBookOpen, IconDownload, IconAward, IconShield, IconSparkles, IconCalendar, IconUsers } from '../icons';
import { PAPER_PRESENTATIONS } from '../data/constants';

const CATS = [
  { Icon: IconFileText, t: 'Circulars', d: 'ICAI announcements, notifications and council decisions.' },
  { Icon: IconBookOpen, t: 'Standards (AS / SA)', d: 'Accounting Standards, Ind AS and Standards on Auditing.' },
  { Icon: IconDownload, t: 'Branch Newsletter', d: 'Monthly newsletter — events, articles, member updates.' },
  { Icon: IconAward, t: 'e-Journal Archive', d: 'Browse The Chartered Accountant journal archives.' },
  { Icon: IconShield, t: 'Web-Media Policy', d: 'ICAI guidelines for member online presence.' },
  { Icon: IconSparkles, t: 'Knowledge Repository', d: 'Curated articles, presentations from past seminars.' },
];

const COMMITTEE_COLORS = {
  GST:          { color: '#16a34a', bg: '#f0fdf4' },
  'Direct Tax': { color: '#ea580c', bg: '#fff7ed' },
  IT:           { color: '#4f46e5', bg: '#eef2ff' },
  Audit:        { color: '#0891b2', bg: '#ecfeff' },
  CPE:          { color: '#2563eb', bg: '#eff6ff' },
  WICASA:       { color: '#7c3aed', bg: '#f5f3ff' },
};

export default function ResourcesPage() {
  return (
    <>
      <PageHeader title="Resources" subtitle="Standards, circulars, e-journal archive and downloadable newsletters." />

      {/* Resource categories */}
      <section className="container" style={{ padding: '3rem 1rem 2rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {CATS.map((s) => (
            <div key={s.t} className="card hover-lift">
              <div className="icon-tile"><s.Icon size="lg" /></div>
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.t}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.d}</p>
              <div className="row gap-1" style={{ marginTop: '1rem', color: 'var(--primary)', fontSize: '.875rem', fontWeight: 500 }}>
                Open <IconArrowRight size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Paper Presentations (per Web-Media Policy 5p — with mandatory disclaimer) */}
      <section className="container" style={{ padding: '2rem 1rem 4rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="tiny-eyebrow">Seminars & Conferences</div>
          <h2 style={{ marginTop: '.25rem', fontSize: '1.75rem', fontWeight: 700 }}>Paper Presentations</h2>
          <p className="muted-text" style={{ marginTop: '.5rem', maxWidth: '44rem', fontSize: '.875rem' }}>
            Presentations and papers from past conferences and seminars held at the Nagpur Branch.
          </p>
        </div>

        {/* Mandatory ICAI disclaimer (per Web-Media Policy 5p) */}
        <div style={{
          background: 'oklch(0.85 0.16 90 / 0.3)',
          border: '1px solid oklch(0.85 0.16 90 / 0.6)',
          borderRadius: '.5rem',
          padding: '.875rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '.8125rem',
          color: 'var(--foreground)',
        }}>
          <strong>Disclaimer:</strong> The views expressed in these presentations are of the Speaker himself/herself.
          The Institute of Chartered Accountants of India does not subscribe to his/her views.
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {PAPER_PRESENTATIONS.map((p) => {
            const meta = COMMITTEE_COLORS[p.committee] || { color: '#6b7280', bg: '#f9fafb' };
            return (
              <div key={p.title} className="card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
                <div className="row gap-2" style={{ marginBottom: '.75rem' }}>
                  <span style={{
                    padding: '.125rem .5rem', borderRadius: '.25rem', fontSize: '.7rem', fontWeight: 600,
                    background: meta.bg, color: meta.color,
                  }}>{p.committee}</span>
                </div>
                <h3 style={{ fontWeight: 600, fontSize: '.9375rem', lineHeight: 1.4, flex: 1 }}>{p.title}</h3>
                <div className="col gap-1 muted-text" style={{ marginTop: '.75rem', fontSize: '.75rem' }}>
                  <div className="row gap-2"><IconUsers size="sm" /> {p.speaker}</div>
                  <div className="row gap-2"><IconCalendar size="sm" /> {p.event} · {p.date}</div>
                </div>
                <button className="btn btn-outline" style={{ marginTop: '1rem', justifyContent: 'center', fontSize: '.8125rem', padding: '.4rem .75rem' }}>
                  <IconDownload size="sm" /> Download PDF
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
