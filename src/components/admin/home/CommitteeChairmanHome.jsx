import { navigate } from '../../../hooks/useRoute';
import InboxCard from './InboxCard';
import QuickActions from './QuickActions';
import { IconCalendar } from '../../../icons';

// Homepage for committee_chairman.
// Purpose: see *your* committee's upcoming events + any of your own
// checklists waiting for review, then create the next event in two clicks.

function fmt(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CommitteeChairmanHome({ data, user }) {
  const inbox = data?.inbox ?? [];
  const myEvents = data?.lists?.my_committee_events ?? [];
  const firstName = (user?.name || '').split(/\s+/)[0] || user?.name || 'there';

  // Derive the committee name from the first event in the list. If the user
  // chairs multiple committees we just say "your committees" — the per-row
  // committee_name on each event card lets them disambiguate visually.
  const committeeNames = Array.from(new Set(myEvents.map((e) => e.committee_name).filter(Boolean)));
  const headlineSuffix = committeeNames.length === 1
    ? `for ${committeeNames[0]}`
    : 'for your committees';

  return (
    <div className="home-stack">
      <div className="home-hero">
        <div className="home-hero-greeting">Hi {firstName},</div>
        <div className="home-hero-headline">
          {myEvents.length === 0
            ? `No upcoming events ${headlineSuffix} yet.`
            : `${myEvents.length} upcoming ${myEvents.length === 1 ? 'event' : 'events'} ${headlineSuffix}.`}
        </div>
      </div>

      <InboxCard inbox={inbox} emptyMessage="No checklists waiting for you." />

      <div className="home-card">
        <div className="home-card-head">
          <div>
            <h2 className="home-card-title">Your committee's upcoming events</h2>
            <div className="home-card-sub">Click any row to view details and fill its checklist.</div>
          </div>
        </div>

        <div className="home-event-list">
          {myEvents.length === 0 && (
            <div className="home-event-empty">
              <div>No upcoming events scheduled for your committee yet.</div>
              <div style={{ fontSize: '.75rem', marginTop: '.35rem' }}>
                The branch chairman creates events; you'll fill the approval checklist when one is assigned.
              </div>
            </div>
          )}
          {myEvents.map((e) => {
            const pct = e.capacity ? Math.min(100, Math.round((e.registered_count / e.capacity) * 100)) : null;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate(`/admin/events?edit=${e.id}`)}
                className="home-event-row"
              >
                <div className="home-event-icon"><IconCalendar size="sm" /></div>
                <div className="home-event-body">
                  <div className="home-event-title">{e.title}</div>
                  <div className="home-event-meta">
                    {fmt(e.starts_at)}
                    {committeeNames.length > 1 && e.committee_name ? ` · ${e.committee_name}` : ''}
                    {' · '}
                    {e.registered_count ?? 0}{e.capacity ? ` / ${e.capacity}` : ''} registered
                  </div>
                  {pct !== null && (
                    <div className="home-event-capbar" aria-hidden>
                      <div
                        className="home-event-capbar-fill"
                        style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--destructive, #dc2626)' : pct >= 60 ? '#f59e0b' : 'var(--primary, #1e40af)' }}
                      />
                    </div>
                  )}
                </div>
                <span className={'admin-pill admin-pill-' + e.status}>{(e.status || '').replace(/_/g, ' ')}</span>
              </button>
            );
          })}
        </div>
      </div>

      <QuickActions
        title="Tools for your committee"
        actions={[
          { label: 'View events',           description: 'See your committee’s schedule',       href: '/admin/events' },
          { label: 'My checklists',         description: 'Fill checklists assigned to you',          href: '/my-checklists' },
          { label: 'Review registrations',  description: 'See who has signed up',                    href: '/admin/registrations' },
          { label: 'Committee roster',      description: 'Manage members of your committee',         href: '/admin/committees' },
        ]}
      />

      <style>{`
        .home-stack { display: flex; flex-direction: column; gap: 1.25rem; }
        .home-hero { padding: 1rem 0 .5rem; }
        .home-hero-greeting { font-size: .9rem; color: var(--muted-foreground); }
        .home-hero-headline { font-size: 1.5rem; font-weight: 700; margin-top: .25rem; line-height: 1.25; }
        .home-card { background: white; border: 1px solid var(--border); border-radius: .5rem; overflow: hidden; }
        .home-card-head { padding: .875rem 1.125rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .home-card-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .home-card-sub { font-size: .8rem; color: var(--muted-foreground); margin-top: .1rem; }
        .home-event-list { display: flex; flex-direction: column; }
        .home-event-row {
          display: flex; align-items: center; gap: .875rem;
          padding: .875rem 1.125rem;
          border: 0; border-top: 1px solid var(--border);
          background: white; text-align: left; cursor: pointer;
          width: 100%; transition: background .12s;
        }
        .home-event-row:hover { background: var(--muted, #fafaf9); }
        .home-event-icon {
          width: 2rem; height: 2rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(37, 99, 235, .08); color: var(--primary, #1e40af);
          border-radius: .375rem;
        }
        .home-event-body { flex: 1; min-width: 0; }
        .home-event-title { font-size: .9rem; font-weight: 600; line-height: 1.3; }
        .home-event-meta { font-size: .75rem; color: var(--muted-foreground); margin-top: .15rem; }
        .home-event-capbar {
          margin-top: .375rem;
          height: 3px; width: 100%;
          background: var(--border, #e5e7eb); border-radius: 999px; overflow: hidden;
        }
        .home-event-capbar-fill { height: 100%; transition: width .3s; }
        .home-event-empty { padding: 2rem; text-align: center; color: var(--muted-foreground); font-size: .875rem; }
      `}</style>
    </div>
  );
}
