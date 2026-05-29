import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { useChecklistList } from '../hooks/useChecklist';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { navigate } from '../hooks/useRoute';
import StatCard from '../components/ui/StatCard';
import ApprovalsQueueCard from '../components/dashboard/ApprovalsQueueCard';
import CommitteeChecklistsCard from '../components/dashboard/CommitteeChecklistsCard';
import {
  IconAward, IconShield, IconCalendar, IconBookOpen, IconUsers,
  IconBot, IconArrowRight, IconUser, IconSettings, IconLogOut, IconBriefcase, IconHandshake,
} from '../icons';

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

const REGISTRATION_STYLES = {
  registered: { bg: 'oklch(0.55 0.14 155 / 0.12)', fg: 'var(--secondary)' },
  waitlisted: { bg: 'oklch(0.85 0.16 90 / 0.4)',  fg: 'var(--accent-foreground)' },
};

const REGISTRATION_LABELS = {
  registered: 'Registered',
  waitlisted: 'Waitlisted',
  cancelled:  'Cancelled',
  attended:   'Attended',
  no_show:    'No-show',
};

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data, loading: dashLoading, error: dashError } = useDashboard();
  const roles = useRoleFlags();

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user]);

  if (authLoading || (user && dashLoading)) {
    return (
      <section className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p className="muted-text">Loading your dashboard…</p>
      </section>
    );
  }
  if (!user) return null;

  const isMember  = user.role === 'Member';
  const isStudent = user.role === 'Student';
  const { isAdmin, isBranchChairman, isCommitteeChairman } = roles;

  const profile        = data?.profile ?? null;
  const upcomingEvents = data?.upcomingEvents ?? [];
  const cpe            = data?.cpe ?? null;
  const cpeProgress    = cpe ? Math.min(100, Math.round((cpe.total_hours / cpe.target) * 100)) : 0;
  const memberNo       = isMember ? profile?.mrn : (isStudent ? profile?.srn : null);
  const memberSince    = isMember ? profile?.member_since : (isStudent ? profile?.articleship_start : null);
  const memberNoLabel  = isMember ? 'Membership No.' : 'SRO No.';

  return (
    <section className="container" style={{ padding: '1.5rem 1rem' }} data-dash>
      {/* Welcome row */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr', alignItems: 'start' }} data-dash-header>
        <div>
          <div className="tiny-eyebrow">My Account</div>
          <h1 style={{ marginTop: '.15rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="muted-text" style={{ marginTop: '.15rem', fontSize: '.875rem' }}>
            {memberNoLabel}{' '}
            <strong style={{ color: 'var(--foreground)' }}>{memberNo ?? '—'}</strong>
            {memberSince ? <> · Member since {formatDate(memberSince)}</> : null}
          </p>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <PendingChecklistsBadge />
          <a href="#/events" className="btn btn-outline">Browse events</a>
          <a href="#/praygyaan" className="btn btn-primary"><IconBot size="sm" /> Ask PrayGyaan</a>
        </div>
      </div>

      {dashError && (
        <div className="card" style={{ marginTop: '1rem', borderColor: 'var(--destructive)' }}>
          <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>
            Couldn't load your dashboard. Please refresh the page.
          </p>
        </div>
      )}

      {isAdmin && (
        <a href="#/admin" className="admin-cta-card">
          <div className="admin-cta-icon"><IconShield /></div>
          <div className="admin-cta-body">
            <div className="admin-cta-eyebrow">Admin access</div>
            <div className="admin-cta-title">Open admin console</div>
            <div className="admin-cta-desc">
              Create and publish events, manage registrations, and operate the branch portal.
            </div>
          </div>
          <span className="admin-cta-arrow"><IconArrowRight /></span>
          <style>{`
            .admin-cta-card {
              display: flex; align-items: center; gap: 1rem;
              margin-top: 1rem; padding: 1rem 1.25rem;
              background: linear-gradient(135deg, #0f172a, #1e293b);
              color: white; border-radius: .75rem; text-decoration: none;
              border: 1px solid rgba(255,255,255,.08);
              transition: transform .12s, box-shadow .12s;
            }
            .admin-cta-card:hover { transform: translateY(-1px); box-shadow: 0 10px 30px rgba(15,23,42,.25); }
            .admin-cta-icon {
              width: 2.5rem; height: 2.5rem; flex-shrink: 0;
              display: flex; align-items: center; justify-content: center;
              background: rgba(255,255,255,.08); border-radius: .5rem;
            }
            .admin-cta-body { flex: 1; min-width: 0; }
            .admin-cta-eyebrow {
              font-size: .6875rem; font-weight: 600; text-transform: uppercase;
              letter-spacing: .08em; color: rgba(255,255,255,.55);
            }
            .admin-cta-title { font-size: 1rem; font-weight: 700; margin-top: .15rem; }
            .admin-cta-desc { font-size: .8125rem; color: rgba(255,255,255,.7); margin-top: .15rem; }
            .admin-cta-arrow { color: rgba(255,255,255,.6); }
          `}</style>
        </a>
      )}

      {/* Top stats — student only for now */}
      {isStudent && (
        <div style={{ marginTop: '1.25rem', display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <StatCard
            label="Articleship status"
            num={profile?.articleship_status ? humanise(profile.articleship_status) : 'Not started'}
            Icon={IconAward}
          />
          <StatCard
            label="CA level"
            num={profile?.level ? humanise(profile.level) : '—'}
            Icon={IconBookOpen}
          />
          <StatCard label="Events attended" num={data?.eventsAttended ?? 0} Icon={IconCalendar} />
          <StatCard label="Exam attempts" num={profile?.exam_attempts ?? 0} Icon={IconUsers} />
        </div>
      )}

      {/* Two-column body */}
      <div style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }} data-dash-body>
        {/* Main column */}
        <div className="col gap-3">
          {/* Role-conditional chairman widgets — sit at the top so the work
              you're accountable for is the first thing you see. Admin is
              intentionally excluded (separation of duties: admin builds the
              checklist; chairmen fill and approve it). */}
          {isBranchChairman && <BranchInsightsCard />}
          {isBranchChairman && <ApprovalsQueueCard />}
          {isCommitteeChairman && <CommitteeChecklistsCard />}

          {isMember && cpe && (
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>CPE compliance</h2>
                <span className="badge badge-secondary">{cpe.fy_label}</span>
              </div>
              <div className="row gap-3" style={{ marginTop: '1rem', justifyContent: 'space-between' }}>
                <span className="muted-text" style={{ fontSize: '.875rem' }}>
                  {cpe.total_hours} of {cpe.target} hours completed
                </span>
                <span style={{
                  fontWeight: 600, fontSize: '.875rem',
                  color: cpeProgress >= 75 ? 'var(--secondary)' : 'var(--primary)',
                }}>{cpeProgress}%</span>
              </div>
              <div className="progress-track" style={{ marginTop: '.5rem' }}>
                <div className="progress-fill" style={{ width: cpeProgress + '%' }} />
              </div>
              <div className="row gap-3" style={{ marginTop: '1rem', flexWrap: 'wrap', color: 'var(--muted-foreground)', fontSize: '.75rem' }}>
                <span>Structured: {cpe.structured_hours} hrs</span>
                <span>·</span>
                <span>Unstructured: {cpe.unstructured_hours} hrs</span>
                <span>·</span>
                <span>3-yr block target: {cpe.three_year_block_target} hrs</span>
              </div>
            </div>
          )}

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>My upcoming events</h2>
              <a href="#/events" style={{ color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>Find more →</a>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>
                No upcoming events. <a href="#/events" style={{ color: 'var(--primary)' }}>Browse what's on →</a>
              </p>
            ) : (
              <ul className="col" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
                {upcomingEvents.map((e) => {
                  const palette = REGISTRATION_STYLES[e.status] ?? REGISTRATION_STYLES.registered;
                  return (
                    <li key={e.id} className="row" style={{ justifyContent: 'space-between', padding: '.75rem 0', borderBottom: '1px solid var(--border)', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{e.title}</div>
                        <div className="row gap-3 muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
                          <span className="row gap-1"><IconCalendar size="sm" /> {formatDate(e.starts_at)}</span>
                          <span className="row gap-1"><IconAward size="sm" /> {Number(e.cpe_hours)} CPE</span>
                        </div>
                      </div>
                      <span className="badge" style={{ background: palette.bg, color: palette.fg }}>
                        {REGISTRATION_LABELS[e.status] ?? e.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Quick actions */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Quick actions</h3>
            <div style={{ marginTop: '.75rem', display: 'grid', gap: '.625rem', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {(isMember ? [
                { Icon: IconShield, t: 'Generate UDIN', to: '/members' },
                { Icon: IconAward, t: 'View CPE certificates', to: '/members' },
                { Icon: IconBriefcase, t: 'Update firm details', to: '/members' },
                { Icon: IconHandshake, t: 'Contribute to CABF', to: '/benevolent-fund' },
              ] : [
                { Icon: IconBookOpen, t: 'Take a mock test', to: '/students' },
                { Icon: IconBriefcase, t: 'Articleship vacancies', to: '/students' },
                { Icon: IconUsers, t: 'Book a mentor', to: '/career-counselling' },
                { Icon: IconAward, t: 'View certificates', to: '/students' },
              ]).map((a) => (
                <a key={a.t} href={'#' + a.to} className="row gap-2" style={{ padding: '.625rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem', border: '1px solid var(--border)' }}>
                  <a.Icon size="sm" /> {a.t}
                  <IconArrowRight size="sm" style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="col gap-3">
          <div className="card">
            <div className="row gap-3">
              <span className="avatar-circle" style={{ width: '3.5rem', height: '3.5rem', fontSize: '1rem' }}>
                {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{user.name}</div>
                <div className="muted-text" style={{ fontSize: '.8125rem' }}>{user.email}</div>
                <span className="badge badge-secondary" style={{ marginTop: '.375rem' }}>{user.role}</span>
              </div>
            </div>
            <div className="col gap-2" style={{ marginTop: '1rem' }}>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start' }}><IconUser size="sm" /> Edit profile</button>
              <button className="btn btn-outline" style={{ justifyContent: 'flex-start' }}><IconSettings size="sm" /> Account settings</button>
              <button onClick={logout} className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}>
                <IconLogOut size="sm" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        [data-dash] .card { padding: 1.15rem; }
        [data-dash] .card li { padding-top: .5rem !important; padding-bottom: .5rem !important; }
        @media (min-width: 768px) {
          [data-dash-header] { grid-template-columns: 1fr auto !important; align-items: center !important; }
        }
        @media (min-width: 960px) {
          [data-dash-body] { grid-template-columns: 1fr 320px !important; }
        }
      `}</style>
    </section>
  );
}

function humanise(value) {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Branch chairman entry point — links to the full insights page.
// Visually distinct (gradient background) so it reads as a "go here" CTA.
function BranchInsightsCard() {
  return (
    <a href="#/branch-insights" className="branch-insights-card">
      <div>
        <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', opacity: .8, fontWeight: 700 }}>
          Branch Chairman
        </div>
        <div style={{ fontSize: '1.0625rem', fontWeight: 700, marginTop: '.15rem' }}>Branch insights</div>
        <div style={{ fontSize: '.8125rem', opacity: .85, marginTop: '.2rem' }}>
          Events, registrations, approvals, members — full metrics & filters
        </div>
      </div>
      <span style={{ fontSize: '1.25rem' }}>→</span>

      <style>{`
        .branch-insights-card {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem; border-radius: .5rem; text-decoration: none;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          color: white; border: 1px solid rgba(255,255,255,.08);
          transition: transform .12s, box-shadow .12s;
        }
        .branch-insights-card:hover { transform: translateY(-1px); box-shadow: 0 10px 25px rgba(15,23,42,.2); }
      `}</style>
    </a>
  );
}

// Surfaces the count of checklists the current user can act on. Hidden when
// there are none, so non-chairmen don't see a noisy "0 pending" pill.
function PendingChecklistsBadge() {
  const { data, loading } = useChecklistList();
  if (loading) return null;
  const count = data?.rows?.length ?? 0;
  if (count === 0) return null;
  return (
    <a href="#/checklists" className="btn btn-outline" style={{ position: 'relative' }}>
      Pending checklists
      <span style={{
        marginLeft: '.4rem',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '1.5rem', height: '1.4rem', padding: '0 .4rem',
        background: 'var(--destructive)', color: 'white',
        borderRadius: 999, fontSize: '.75rem', fontWeight: 700,
      }}>{count}</span>
    </a>
  );
}
