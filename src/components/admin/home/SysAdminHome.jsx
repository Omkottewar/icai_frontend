import { useAdminList } from '../../../hooks/useAdminList';
import { navigate } from '../../../hooks/useRoute';
import { Shimmer, ShimmerStatTile } from '../../ui/Shimmer';
import {
  IconUsers, IconGraduationCap, IconCalendar, IconAward,
  IconCheckCircle, IconTrending,
} from '../../../icons';

// Homepage for global admin / IT admin (Sanju). This is the kitchen-sink
// view — everyone else lands on a focused variant; this one gives full
// visibility into the whole branch.
//
// Kept close to the pre-refactor dashboard so we don't disrupt IT admin's
// muscle memory. The real UX win is that NON-admin office bearers no longer
// see this page; they get their own focused home above.

function StatTile({ icon: Icon, label, value, tone = 'default' }) {
  return (
    <div className="admin-stat-tile" data-tone={tone}>
      <div className="admin-stat-icon"><Icon /></div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtINR(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format((paise || 0) / 100);
}

export default function SysAdminHome({ data }) {
  // Previously this component fired its own /api/admin/stats call (and
  // polled it every 60s) on top of the /api/admin/home call its parent
  // already makes. Both endpoints returned the same headline counts —
  // duplicate work. We now read the counts straight off `data.stats`
  // (populated by /api/admin/home) so the page renders with a single
  // round-trip instead of two.
  const stats = data?.stats ?? {};
  const inbox = data?.inbox ?? [];
  const statsReady = !!data;

  const { data: eventsData, loading: eventsLoading } = useAdminList('/api/admin/events', { page: 1, pageSize: 5 });

  return (
    <>
      <div className="admin-stat-grid">
        {!statsReady ? (
          Array.from({ length: 6 }).map((_, i) => <ShimmerStatTile key={i} />)
        ) : (
          <>
            <StatTile icon={IconUsers} label="Members" value={(stats.members ?? 0).toLocaleString('en-IN')} />
            <StatTile icon={IconGraduationCap} label="Students" value={(stats.students ?? 0).toLocaleString('en-IN')} />
            <StatTile icon={IconCalendar} label="Upcoming events" value={stats.upcoming_events ?? 0} tone="primary" />
            <StatTile icon={IconAward} label="Events this month" value={stats.events_this_month ?? 0} />
            <StatTile icon={IconTrending} label="Registrations (month)" value={stats.registrations_month ?? 0} />
            <StatTile icon={IconCheckCircle} label="Pending decisions" value={inbox.length} tone={inbox.length > 0 ? 'primary' : 'default'} />
          </>
        )}
      </div>

      {inbox.length > 0 && (
        <section className="admin-panel" style={{ marginTop: '1.5rem' }}>
          <div className="admin-panel-head">
            <h2>Things waiting</h2>
            <span className="muted-text" style={{ fontSize: '.8125rem' }}>{inbox.length} pending</span>
          </div>
          <div className="admin-event-list">
            {inbox.slice(0, 5).map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => navigate(it.action_href)}
                className="admin-event-row"
                style={{ textAlign: 'left', background: 'white' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{it.title}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>{it.subtitle}</div>
                </div>
                <span className="admin-pill admin-pill-pending_approval">{it.action_label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="admin-panel" style={{ marginTop: '1.5rem' }}>
        <div className="admin-panel-head">
          <h2>Recent events</h2>
          <a href="#/admin/events" className="muted-text" style={{ fontSize: '.8125rem' }}>View all →</a>
        </div>
        <div className="admin-event-list">
          {eventsLoading && Array.from({ length: 3 }).map((_, i) => (
            <div key={'sh-' + i} className="admin-event-row" style={{ pointerEvents: 'none' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                <Shimmer height=".875rem" width="55%" />
                <Shimmer height=".7rem" width="35%" />
              </div>
              <Shimmer height="1.1rem" width="4rem" radius="999px" />
            </div>
          ))}
          {!eventsLoading && eventsData?.rows?.length ? eventsData.rows.map((e) => (
            <a key={e.id} href={`#/admin/events?edit=${e.id}`} className="admin-event-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{e.title}</div>
                <div className="muted-text" style={{ fontSize: '.75rem' }}>
                  {e.committee_name || '—'} · {fmtDate(e.starts_at)}
                </div>
              </div>
              <span className={'admin-pill admin-pill-' + e.status}>{e.status}</span>
            </a>
          )) : !eventsLoading && <div className="muted-text" style={{ padding: '1rem' }}>No events yet. Create your first one to populate the public site.</div>}
        </div>
      </section>

      <style>{`
        .admin-stat-grid {
          display: grid; gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .admin-stat-tile {
          display: flex; gap: .875rem; align-items: center;
          background: var(--card); border: 1px solid var(--border);
          border-radius: .5rem; padding: 1rem;
        }
        .admin-stat-tile[data-tone="primary"] { border-left: 3px solid var(--primary); }
        .admin-stat-icon {
          width: 2.5rem; height: 2.5rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--muted, #f5f5f4); border-radius: .375rem;
          color: var(--primary);
        }
        .admin-stat-value { font-size: 1.5rem; font-weight: 700; line-height: 1.1; }
        .admin-stat-label { font-size: .75rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .04em; }
        .admin-panel { background: var(--card); border: 1px solid var(--border); border-radius: .5rem; }
        .admin-panel-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: .875rem 1.125rem; border-bottom: 1px solid var(--border);
        }
        .admin-panel-head h2 { margin: 0; font-size: .9375rem; font-weight: 700; }
        .admin-event-list { display: flex; flex-direction: column; }
        .admin-event-row {
          display: flex; justify-content: space-between; align-items: center; gap: 1rem;
          padding: .75rem 1.125rem; border-bottom: 1px solid var(--border);
          text-decoration: none; color: inherit; transition: background .12s;
          border: 0; border-bottom: 1px solid var(--border); width: 100%;
        }
        .admin-event-row:hover { background: var(--muted, #fafaf9); cursor: pointer; }
        .admin-event-row:last-child { border-bottom: 0; }
        .admin-pill {
          padding: .125rem .5rem; border-radius: 999px;
          font-size: .6875rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-draft { background: #fef3c7; color: #92400e; }
        .admin-pill-pending_approval { background: #ddd6fe; color: #5b21b6; }
        .admin-pill-approved { background: #dbeafe; color: #1e40af; }
        .admin-pill-published { background: #d1fae5; color: #065f46; }
        .admin-pill-cancelled { background: #fee2e2; color: #991b1b; }
        .admin-pill-completed { background: #e5e7eb; color: #374151; }
      `}</style>
    </>
  );
}
