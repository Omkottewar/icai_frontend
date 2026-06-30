import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
// useManagingCommittee removed — the public About page now relies solely
// on the admin-curated roster saved through /admin/office-bearers (which
// feeds the `about_committee_members` site-content slot). No more derived
// list from role assignments.
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconDownload, IconCalendar } from '../icons';

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Pretty role labels for the managing-committee roster. role_code is the
// canonical key from the roles table; we map it to display text the public
// page wants to show under each card.
const ROLE_LABELS = {
  branch_chairman:      'Chairperson',
  branch_vice_chairman: 'Vice Chairperson',
  branch_secretary:     'Secretary',
  branch_treasurer:     'Treasurer',
  mcm:                  'Managing Committee Member',
};

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
  const header     = useSiteContent('about_page_header');
  const sections   = useSiteContent('about_section_headings');
  const vision     = useSiteContent('about_vision');
  const mission    = useSiteContent('about_mission');
  const history    = useSiteContent('about_history');
  const committee  = useSiteContent('about_committee_members');

  // Past Chairmen + Annual Reports — both load on mount. Failures degrade
  // gracefully: if the API isn't reachable, those sections silently hide
  // rather than wrecking the rest of the About page.
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

  // The MCM roster is admin-curated only. When the chairman hasn't added
  // any members yet, the section renders the empty-state copy from
  // `about_section_headings.committee_empty_msg`.
  const roster = Array.isArray(committee.members)
    ? committee.members.map((m) => ({ user_id: m.user_id, name: m.name, avatar_url: m.photo_url, role_name: m.designation }))
    : [];

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <div className="tiny-eyebrow">Vision</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{sections.vision_card_title}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(vision.body)}
            </div>
          </div>
          <div className="card">
            <div className="tiny-eyebrow">Mission</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{sections.mission_card_title}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(mission.body)}
            </div>
          </div>
          <div className="card">
            <div className="tiny-eyebrow">History</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>{sections.history_card_title}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(history.body)}
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 700 }}>{sections.committee_heading}</h2>
        {roster.length === 0 ? (
          <p className="muted-text" style={{ marginTop: '1rem' }}>
            {sections.committee_empty_msg}
          </p>
        ) : (
          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {roster.map((p) => (
              <div key={p.user_id} className="card" style={{ textAlign: 'center' }}>
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.name}
                    loading="lazy"
                    style={{ width: '4.5rem', height: '4.5rem', borderRadius: 999, margin: '0 auto', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: 999, margin: '0 auto', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {initials(p.name)}
                  </div>
                )}
                <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{p.name}</div>
                <div className="muted-text" style={{ fontSize: '.8125rem' }}>
                  {ROLE_LABELS[p.role_code] || p.role_name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past Chairmen — historical archive. Hidden when empty so the
            About page doesn't show empty section headers on a fresh install. */}
        {chairmen.length > 0 && (
          <>
            <h2 style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 700 }}>{sections.past_chairmen_heading}</h2>
            <div className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem', maxWidth: '44rem' }}>
              {renderMarkdown(sections.past_chairmen_subtitle)}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {chairmen.map((c) => (
                <div key={c.id} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  {c.photo_url ? (
                    <img src={c.photo_url} alt={c.person_name} loading="lazy"
                         style={{ width: '4rem', height: '4rem', borderRadius: 999, margin: '0 auto', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{
                      width: '4rem', height: '4rem', borderRadius: 999, margin: '0 auto',
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '.85rem',
                    }}>
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

        {/* Annual Reports — yearly branch report PDFs */}
        {reports.length > 0 && (
          <>
            <h2 style={{ marginTop: '3rem', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 700 }}>{sections.annual_reports_heading}</h2>
            <div className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem', maxWidth: '44rem' }}>
              {renderMarkdown(sections.annual_reports_subtitle)}
            </div>
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
                  <div className="tiny-eyebrow">FY {r.fy_label}</div>
                  <div style={{ fontWeight: 600, marginTop: '.25rem' }}>{r.title || `Annual Report ${r.fy_label}`}</div>
                  {r.summary && (
                    <p className="muted-text" style={{ marginTop: '.35rem', fontSize: '.8rem' }}>{r.summary}</p>
                  )}
                  {r.pdf_url ? (
                    <div className="row gap-1" style={{ marginTop: '.65rem', color: 'var(--primary)', fontSize: '.8rem', fontWeight: 600 }}>
                      <IconDownload size="sm" /> Download PDF
                    </div>
                  ) : (
                    <div className="muted-text" style={{ marginTop: '.65rem', fontSize: '.75rem' }}>PDF not uploaded</div>
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
