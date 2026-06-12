import { navigate } from '../../../hooks/useRoute';
import { IconCheckCircle, IconCalendar, IconArrowRight } from '../../../icons';

// Compact "things waiting for you" list. Used by Chairman & Treasurer
// homepages. The icon set is small on purpose — every row is just an action,
// not a status display, so we don't want to pretend each one is rich content.

const KIND_META = {
  event_approval:    { Icon: IconCalendar,     label: 'Event approval' },
  checklist_review:  { Icon: IconCheckCircle,  label: 'Checklist review' },
};

function pendingFor(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1)  return 'today';
  if (days === 1) return 'since yesterday';
  return `${days} days pending`;
}

export default function InboxCard({ inbox, emptyMessage = "You're all caught up." }) {
  return (
    <div className="home-card">
      <div className="home-card-head">
        <div>
          <h2 className="home-card-title">Waiting for you</h2>
          <div className="home-card-sub">
            {inbox.length === 0 ? 'Nothing pending right now.' : `${inbox.length} ${inbox.length === 1 ? 'item' : 'items'} need a decision.`}
          </div>
        </div>
      </div>

      <div className="home-inbox-list">
        {inbox.length === 0 && (
          <div className="home-inbox-empty">{emptyMessage}</div>
        )}
        {inbox.map((it) => {
          const meta = KIND_META[it.kind] ?? { Icon: IconCheckCircle, label: 'Item' };
          return (
            <button
              key={it.id}
              type="button"
              className="home-inbox-row"
              onClick={() => navigate(it.action_href)}
            >
              <div className="home-inbox-icon"><meta.Icon size="sm" /></div>
              <div className="home-inbox-body">
                <div className="home-inbox-title">{it.title}</div>
                <div className="home-inbox-meta">
                  <span className="home-inbox-kind">{meta.label}</span>
                  {it.subtitle && <span> · {it.subtitle}</span>}
                  {it.pending_since && <span> · {pendingFor(it.pending_since)}</span>}
                </div>
              </div>
              <div className="home-inbox-cta">
                {it.action_label} <IconArrowRight size="sm" />
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .home-inbox-list { display: flex; flex-direction: column; }
        .home-inbox-empty { padding: 2rem; text-align: center; color: var(--muted-foreground); font-size: .875rem; }
        .home-inbox-row {
          display: flex; align-items: center; gap: .875rem;
          padding: .875rem 1.125rem;
          border: 0; border-top: 1px solid var(--border);
          background: white; text-align: left; cursor: pointer;
          width: 100%; transition: background .12s;
        }
        .home-inbox-row:hover { background: var(--muted, #fafaf9); }
        .home-inbox-icon {
          width: 2rem; height: 2rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(37, 99, 235, .08); color: var(--primary, #1e40af);
          border-radius: .375rem;
        }
        .home-inbox-body { flex: 1; min-width: 0; }
        .home-inbox-title { font-size: .9rem; font-weight: 600; line-height: 1.3; }
        .home-inbox-meta { font-size: .75rem; color: var(--muted-foreground); margin-top: .15rem; }
        .home-inbox-kind { font-weight: 600; color: var(--foreground); opacity: .65; }
        .home-inbox-cta {
          display: inline-flex; align-items: center; gap: .25rem;
          font-size: .75rem; font-weight: 600; color: var(--primary, #1e40af);
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .home-inbox-cta { display: none; }
        }
      `}</style>
    </div>
  );
}
