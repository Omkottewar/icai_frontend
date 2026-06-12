import { navigate } from '../../../hooks/useRoute';
import InboxCard from './InboxCard';
import StatStrip from './StatStrip';
import QuickActions from './QuickActions';
import { IconGraduationCap, IconCalendar } from '../../../icons';

// Homepage for the WICASA chairman — detected server-side as a committee
// chairman scoped to the WICASA committee. Surfaces student-side work:
// mentorship requests, articleship matchmaking submissions, mock tests.

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
}

function levelBadge(level) {
  return ({
    foundation: 'Foundation',
    intermediate: 'Inter',
    final: 'Final',
  })[level] ?? level;
}

export default function WicasaHome({ data, user }) {
  const inbox = data?.inbox ?? [];
  const mockTests = data?.lists?.upcoming_mock_tests ?? [];
  const firstName = (user?.name || '').split(/\s+/)[0] || user?.name || 'there';

  const studentItemsCount =
    (data?.lists?.pending_mentorship?.length ?? 0) +
    (data?.lists?.pending_articleship_matches?.length ?? 0);

  return (
    <div className="home-stack">
      <div className="home-hero">
        <div className="home-hero-greeting">Hi {firstName},</div>
        <div className="home-hero-headline">
          {studentItemsCount === 0
            ? 'No student items need attention right now.'
            : `${studentItemsCount} student ${studentItemsCount === 1 ? 'item' : 'items'} need your attention.`}
        </div>
      </div>

      <InboxCard inbox={inbox} emptyMessage="No mentorship or articleship items pending." />

      <StatStrip
        items={[
          { value: mockTests.length,                                       label: 'Upcoming mock tests' },
          { value: data?.lists?.pending_mentorship?.length ?? 0,           label: 'Mentorship requests' },
          { value: data?.lists?.pending_articleship_matches?.length ?? 0,  label: 'Articleship submissions' },
        ]}
      />

      <div className="home-card">
        <div className="home-card-head">
          <div>
            <h2 className="home-card-title">Upcoming mock tests</h2>
            <div className="home-card-sub">Next 6 scheduled. Tap to manage registrations.</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/admin/mock-tests?new=1')}
            style={{ padding: '.4rem .9rem', fontSize: '.8125rem' }}
          >
            + Schedule mock test
          </button>
        </div>

        <div className="home-mock-list">
          {mockTests.length === 0 && (
            <div className="home-mock-empty">
              <div style={{ marginBottom: '.5rem' }}>No mock tests scheduled.</div>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/admin/mock-tests?new=1')}
                style={{ padding: '.4rem .9rem', fontSize: '.8125rem' }}
              >
                Schedule the first one
              </button>
            </div>
          )}
          {mockTests.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/admin/mock-tests?edit=${t.id}`)}
              className="home-mock-row"
            >
              <div className="home-mock-icon"><IconGraduationCap size="sm" /></div>
              <div className="home-mock-body">
                <div className="home-mock-title">{t.title}</div>
                <div className="home-mock-meta">
                  {fmtDate(t.scheduled_at)} · {fmtTime(t.scheduled_at)} · {levelBadge(t.level)}
                  {t.venue ? ` · ${t.venue}` : ''}
                </div>
              </div>
              <span className={'admin-pill admin-pill-' + (t.status === 'open_for_registration' ? 'published' : t.status === 'cancelled' ? 'cancelled' : 'draft')}>
                {(t.status || '').replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <QuickActions
        title="Student-wing tools"
        actions={[
          { label: 'Mock tests',               description: 'Schedule, edit, mark attendance',  href: '/admin/mock-tests' },
          { label: 'Mentorship',               description: 'Match students to mentors',        href: '/admin/mentorship' },
          { label: 'Articleship matchmaking',  description: 'Review submissions, recommend',     href: '/admin/articleship-matches' },
          { label: 'Student events',           description: 'Workshops, seminars, mentoring',    href: '/admin/events' },
          { label: 'WICASA announcement',      description: 'Post to student feed',              href: '/admin/announcements?new=1' },
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
        .home-mock-list { display: flex; flex-direction: column; }
        .home-mock-row {
          display: flex; align-items: center; gap: .875rem;
          padding: .875rem 1.125rem;
          border: 0; border-top: 1px solid var(--border);
          background: white; text-align: left; cursor: pointer;
          width: 100%; transition: background .12s;
        }
        .home-mock-row:hover { background: var(--muted, #fafaf9); }
        .home-mock-icon {
          width: 2rem; height: 2rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(16, 185, 129, .12); color: #047857;
          border-radius: .375rem;
        }
        .home-mock-body { flex: 1; min-width: 0; }
        .home-mock-title { font-size: .9rem; font-weight: 600; line-height: 1.3; }
        .home-mock-meta { font-size: .75rem; color: var(--muted-foreground); margin-top: .15rem; }
        .home-mock-empty { padding: 2rem; text-align: center; color: var(--muted-foreground); font-size: .875rem; }
        .admin-pill {
          padding: .125rem .5rem; border-radius: 999px;
          font-size: .6875rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-draft { background: #fef3c7; color: #92400e; }
        .admin-pill-published { background: #d1fae5; color: #065f46; }
        .admin-pill-cancelled { background: #fee2e2; color: #991b1b; }
      `}</style>
    </div>
  );
}
