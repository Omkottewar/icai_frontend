import PageHeader from '../components/layout/PageHeader';
import { IconCheckCircle, IconArrowRight, IconUsers, IconBriefcase } from '../icons';

const ITEMS = [
  { t: 'COP Renewal / Restoration / Surrender / Firm Registration ', d: 'Self-service Certificate of Practice workflows via ICAI eServices.' },
  { t: 'UDIN Generation & Verification', d: 'Generate and verify Unique Document Identification Numbers.' },
  { t: 'CPE Hours Tracker', d: 'Track structured/unstructured CPE hours against the 120-hours-in-3-years requirement.' },
  { t: 'Member Networking Forum', d: 'Members-only forum for peer discussion and assignment opportunities.' }];

export default function MembersPage() {
  return (
    <>
      <PageHeader title="For Members" subtitle="Services, CPE and resources for Chartered Accountants" />

      {/* ICAI.org link banner (per Web-Media Policy 5c) */}
      <div style={{ background: 'oklch(0.36 0.13 255 / 0.07)', borderBottom: '1px solid oklch(0.36 0.13 255 / 0.15)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconUsers size="sm" style={{ color: 'var(--primary)' }} />
            <span>All member services, UDIN, COP and CPE records are managed at the <strong>official ICAI portal</strong>.</span>
          </div>
          <a
            href="https://www.icai.org/members"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '.4rem 1rem', flexShrink: 0 }}
          >
            Visit ICAI Members Portal <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>

        {/* Quick access row */}
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="#/members-directory" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconUsers size="sm" /> Members' Directory
          </a>
          <a href="#/job-vacancies" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconBriefcase size="sm" /> Job Vacancies
          </a>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ITEMS.map((s) => (
            <div key={s.t} className="card">
              <IconCheckCircle style={{ color: 'var(--secondary)' }} size="lg" />
              <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{s.t}</h3>
              <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
