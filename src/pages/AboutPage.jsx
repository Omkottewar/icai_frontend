import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { useManagingCommittee } from '../hooks/useManagingCommittee';
import { renderMarkdown } from '../lib/markdown.jsx';

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
  const vision  = useSiteContent('about_vision');
  const mission = useSiteContent('about_mission');
  const history = useSiteContent('about_history');
  const { rows: roster } = useManagingCommittee();

  return (
    <>
      <PageHeader title="About the Branch" subtitle="Established 1962 · Branch of WIRC of ICAI" />
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <div className="tiny-eyebrow">Vision</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>A model branch of ICAI</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(vision.body)}
            </div>
          </div>
          <div className="card">
            <div className="tiny-eyebrow">Mission</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>Service to the profession</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(mission.body)}
            </div>
          </div>
          <div className="card">
            <div className="tiny-eyebrow">History</div>
            <h3 style={{ marginTop: '.5rem', fontSize: '1.125rem', fontWeight: 600 }}>Six decades of service</h3>
            <div className="muted-text" style={{ marginTop: '.5rem' }}>
              {renderMarkdown(history.body)}
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: '3rem', fontSize: '1.5rem', fontWeight: 700 }}>Managing Committee</h2>
        {roster.length === 0 ? (
          <p className="muted-text" style={{ marginTop: '1rem' }}>
            The roster will appear here once committee members are assigned.
          </p>
        ) : (
          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
      </section>
    </>
  );
}
