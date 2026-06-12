import { useState } from 'react';
import InboxCard from './InboxCard';
import StatStrip from './StatStrip';
import QuickActions from './QuickActions';

// Homepage for branch_chairman / branch_vice_chairman / branch_secretary.
// Purpose: one screen that says "here is what needs your decision today and
// here are the few content levers you actually use".
//
// Layout: a tabbed, zero-scroll surface. The greeting hero stays pinned as
// context; everything else lives behind a tab so the chairman picks a lens
// (decisions / performance / actions) and sees only that — no long scroll.
//
// Anti-goals: no sidebar nav exploration, no settings, no "site content vs
// site settings" distinction, no "checklist instance status enum" exposure.

function fmtRupees(paise) {
  if (paise == null) return '—';
  if (paise < 100000) return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
  if (paise < 10000000) return `₹${(paise / 100000).toFixed(1)}L`;
  return `₹${(paise / 10000000).toFixed(1)}Cr`;
}

// Tab definitions live outside render so the labels double as the source of
// truth for both the tablist and the default selection (first = default).
const TABS = [
  { id: 'decisions',   label: 'Decisions' },
  { id: 'performance', label: 'Performance' },
  { id: 'actions',     label: 'Quick actions' },
];

export default function ChairmanHome({ data, user }) {
  const inbox  = data?.inbox ?? [];
  const stats  = data?.stats ?? {};

  const [activeTab, setActiveTab] = useState(TABS[0].id);

  const firstName = (user?.name || '').split(/\s+/)[0] || user?.name || 'there';

  return (
    <div className="home-tabbed">
      <div className="home-hero">
        <div className="home-hero-greeting">Hi {firstName},</div>
        <div className="home-hero-headline">
          {inbox.length === 0
            ? "Nothing waiting on you today."
            : `${inbox.length} ${inbox.length === 1 ? 'decision' : 'decisions'} need your attention.`}
        </div>
      </div>

      <div className="home-tabs" role="tablist" aria-label="Branch chairman sections">
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`home-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`home-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={'home-tab' + (selected ? ' is-active' : '')}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'decisions' && inbox.length > 0 && (
                <span className="home-tab-badge">{inbox.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="home-tab-panels">
        {activeTab === 'decisions' && (
          <div
            role="tabpanel"
            id="home-panel-decisions"
            aria-labelledby="home-tab-decisions"
            className="home-tab-panel"
          >
            <InboxCard inbox={inbox} emptyMessage="No approvals pending. Time to look ahead." />
          </div>
        )}

        {activeTab === 'performance' && (
          <div
            role="tabpanel"
            id="home-panel-performance"
            aria-labelledby="home-tab-performance"
            className="home-tab-panel"
          >
            <div className="home-stat-row">
              <div className="home-stat-row-label">This month</div>
              <StatStrip
                items={[
                  { value: stats.events_this_month ?? 0,         label: 'Events held' },
                  { value: stats.registrations_month ?? 0,       label: 'Registrations' },
                  { value: fmtRupees(stats.revenue_month_paise), label: 'Revenue' },
                ]}
              />
            </div>

            <div className="home-stat-row">
              <div className="home-stat-row-label">Overall</div>
              <StatStrip
                items={[
                  { value: stats.upcoming_events ?? 0,                   label: 'Upcoming events' },
                  { value: (stats.members ?? 0).toLocaleString('en-IN'), label: 'Members' },
                  { value: stats.inbox_count ?? 0,                       label: 'Pending decisions' },
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div
            role="tabpanel"
            id="home-panel-actions"
            aria-labelledby="home-tab-actions"
            className="home-tab-panel"
          >
            <QuickActions
              title="What would you like to do?"
              actions={[
                { label: 'Compose announcement',     description: 'Post to the homepage ticker', href: '/admin/announcements' },
                { label: 'Update homepage message',  description: 'Your photo and message',      href: '/admin/site-content' },
                { label: 'View branch metrics',      description: 'Detailed performance report', href: '/branch-insights' },
                { label: 'Review events',            description: 'See everything scheduled',    href: '/admin/events' },
              ]}
            />
          </div>
        )}
      </div>

      <style>{`
        /* Fill the admin content area so the page is a single zero-scroll
           surface: hero + tabs are fixed height, the panel takes the rest. */
        .home-tabbed {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-height: calc(100vh - 5.5rem - 3rem);
        }
        .home-hero { padding: .25rem 0 0; }
        .home-hero-greeting { font-size: .9rem; color: var(--muted-foreground); }
        .home-hero-headline { font-size: 1.5rem; font-weight: 700; margin-top: .25rem; line-height: 1.25; }

        .home-tabs {
          display: flex; gap: .25rem;
          border-bottom: 1px solid var(--border);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .home-tabs::-webkit-scrollbar { display: none; }
        .home-tab {
          position: relative;
          display: inline-flex; align-items: center; gap: .4rem;
          padding: .625rem .875rem;
          margin-bottom: -1px;
          border: 0; border-bottom: 2px solid transparent;
          background: none; cursor: pointer; white-space: nowrap;
          font-size: .875rem; font-weight: 600;
          color: var(--muted-foreground);
          transition: color .12s, border-color .12s;
        }
        .home-tab:hover { color: var(--foreground); }
        .home-tab.is-active {
          color: var(--primary, #1e40af);
          border-bottom-color: var(--primary, #1e40af);
        }
        .home-tab-badge {
          font-size: .7rem; font-weight: 700; line-height: 1;
          padding: .15rem .4rem; border-radius: 999px;
          background: rgba(37, 99, 235, .12); color: var(--primary, #1e40af);
        }

        .home-tab-panels { flex: 1; min-height: 0; }
        .home-tab-panel { display: flex; flex-direction: column; gap: 1.25rem; }

        /* Shared card chrome (used by InboxCard / QuickActions). */
        .home-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: .5rem;
          overflow: hidden;
        }
        .home-card-head {
          padding: .875rem 1.125rem;
          display: flex; justify-content: space-between; align-items: center;
        }
        .home-card-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .home-card-sub { font-size: .8rem; color: var(--muted-foreground); margin-top: .1rem; }
        .home-stat-row { display: flex; flex-direction: column; gap: .375rem; }
        .home-stat-row-label {
          font-size: .7rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: .04em; color: var(--muted-foreground);
        }
      `}</style>
    </div>
  );
}
