import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { useBranchMetrics } from '../hooks/useBranchMetrics';
import { navigate } from '../hooks/useRoute';
import StatCard from '../components/ui/StatCard';
import { ShimmerPageBody, Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import ApprovalsQueueCard from '../components/dashboard/ApprovalsQueueCard';
import CommitteeChecklistsCard from '../components/dashboard/CommitteeChecklistsCard';
import NotificationSettingsCard from '../components/dashboard/NotificationSettingsCard';
import MemberDashboard from '../components/dashboard/MemberDashboard';
import InsightsStyles from '../components/dashboard/insights/insightsStyles';
import Sparkline from '../components/dashboard/insights/Sparkline';
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
    return <ShimmerPageBody cards={4} />;
  }
  if (!user) return null;

  const isMember  = user.role === 'Member';
  const isStudent = user.role === 'Student';
  const { isAdmin, isBranchChairman, isCommitteeChairman, isOfficeBearer, officeBearerCode } = roles;

  // Context-aware copy for the "open the admin shell" entry-point card.
  // Each office bearer sees a card that names their actual role + the work
  // they'll find there — not a generic "Admin console".
  const officeBearerCard = ({
    branch_treasurer:     { title: 'Open treasurer dashboard',     desc: 'Approve refunds and bills, monitor revenue, export FY reports.' },
    branch_chairman:      { title: 'Open chairman dashboard',      desc: 'Review pending approvals, publish events, update the homepage.' },
    branch_vice_chairman: { title: 'Open Vice-Chairman dashboard', desc: 'Review pending approvals and branch operations.' },
    branch_secretary:     { title: 'Open Secretary dashboard',     desc: 'Review pending approvals and branch operations.' },
    committee_chairman:   { title: 'Open committee dashboard',     desc: 'Manage your committee\'s upcoming events and review checklists.' },
    accountant:           { title: 'Open bills register',          desc: 'Record bills, attach scans, and send for treasurer approval.' },
    branch_manager:       { title: 'Open branch console',          desc: 'Operate the branch portal and support office bearers.' },
    admin:                { title: 'Open admin console',           desc: 'Create and publish events, manage registrations, and operate the branch portal.' },
  })[officeBearerCode] ?? null;

  const profile        = data?.profile ?? null;
  const upcomingEvents = data?.upcomingEvents ?? [];
  const cpe            = data?.cpe ?? null;
  const cpeProgress    = cpe ? Math.min(100, Math.round((cpe.total_hours / cpe.target) * 100)) : 0;
  const memberNo       = isMember ? profile?.mrn : (isStudent ? profile?.srn : null);
  const memberSince    = isMember ? profile?.member_since : (isStudent ? profile?.articleship_start : null);
  const memberNoLabel  = isMember ? 'Membership No.' : 'SRO No.';

  // Office bearer entry-point card — same markup for both layouts (member
  // dashboard slots it in below the identity header; the legacy layout
  // surfaces it under the welcome row).
  const officeBearerNode = (isOfficeBearer && officeBearerCard)
    ? <OfficeBearerCTA labels={officeBearerCard} />
    : null;

  // For members we delegate to a richer, purpose-built dashboard. Students
  // and non-office-bearer/chairmen keep the legacy layout below.
  if (isMember) {
    return (
      <>
        {dashError && (
          <div className="container" style={{ padding: '1rem' }}>
            <div className="card" style={{ borderColor: 'var(--destructive)' }}>
              <p style={{ color: 'var(--destructive)', fontSize: '.875rem' }}>
                Couldn't load your dashboard. Please refresh the page.
              </p>
            </div>
          </div>
        )}
        <MemberDashboard
          user={user}
          data={data}
          logout={logout}
          pendingBadge={<PendingInstancesBadge />}
          officeBearerCard={officeBearerNode}
        />
      </>
    );
  }

  return (
    <section className="container" style={{ padding: '1.5rem 1rem' }} data-dash>
      {/* Welcome row */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr', alignItems: 'start' }} data-dash-header>
        <div>
          <div className="tiny-eyebrow">My Account</div>
          <h1 style={{ marginTop: '.15rem', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, lineHeight: 1.2 }}>
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="muted-text" style={{ marginTop: '.15rem', fontSize: '.875rem' }}>
            {memberNoLabel}{' '}
            <strong style={{ color: 'var(--foreground)' }}>{memberNo ?? '—'}</strong>
            {memberSince ? <> · Member since {formatDate(memberSince)}</> : null}
          </p>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <PendingInstancesBadge />
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

      {isOfficeBearer && officeBearerCard && (
        <a href="#/admin" className="admin-cta-card">
          <div className="admin-cta-icon"><IconShield /></div>
          <div className="admin-cta-body">
            <div className="admin-cta-eyebrow">Your workspace</div>
            <div className="admin-cta-title">{officeBearerCard.title}</div>
            <div className="admin-cta-desc">
              {officeBearerCard.desc}
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

          <NotificationSettingsCard />
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

// Branch chairman entry point — a premium preview tile that doubles as a CTA
// into the full /branch-insights dashboard. Shows 4 live KPIs with a mini
// sparkline so the chairman gets a glanceable read without clicking through.
// Reuses the shared insights tokens for visual cohesion with the deep page.
function BranchInsightsCard() {
  // Match the BranchMetricsPage default (this year) so the numbers shown
  // here are identical to what the chairman sees after clicking through.
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const { data, loading } = useBranchMetrics({ from: yearStart });

  const k = data?.kpis;
  const eventsSpark = (data?.events_per_month || []).map((r) => Number(r.n || 0));

  return (
    <>
      <InsightsStyles />
      <a href="#/branch-insights" className="bic-card">
        <div className="bic-glow" aria-hidden="true" />
        <div className="bic-head">
          <div className="bic-head-left">
            <div className="bic-logo">CA</div>
            <div>
              <div className="bic-eyebrow">Branch Chairman · live</div>
              <div className="bic-title">Branch insights</div>
              <div className="bic-sub">Full filters, charts, drill-downs &amp; exports →</div>
            </div>
          </div>
          <div className="bic-spark">
            {eventsSpark.length > 1 && (
              <Sparkline data={eventsSpark} color="#3622FF" width={140} height={36} />
            )}
            <span className="bic-cta">Open dashboard <IconArrowRight size="sm" /></span>
          </div>
        </div>

        <div className="bic-kpis">
          <BicMiniKpi label="Events" value={loading ? '—' : k?.events.total ?? 0}
                      sub={k ? `${k.events.this_month} this month` : ''} accent="primary" />
          <BicMiniKpi label="Registrations" value={loading ? '—' : k?.registrations.total ?? 0}
                      sub={k ? `${k.registrations.this_month} this month` : ''} accent="success" />
          <BicMiniKpi label="Pending approvals" value={loading ? '—' : k?.approvals.pending ?? 0}
                      sub={k ? `${k.approvals.avg_cycle_hours}h avg cycle` : ''}
                      accent={k?.approvals.pending > 0 ? 'warning' : 'neutral'} highlight={k?.approvals.pending > 0} />
          <BicMiniKpi label="Upcoming (30d)" value={loading ? '—' : k?.events.upcoming_30d ?? 0}
                      sub="Published & ahead" accent="teal" />
        </div>
      </a>

      <style>{`
        .bic-card {
          position: relative; display: block; overflow: hidden;
          padding: 1.1rem 1.25rem 1.15rem;
          border-radius: 16px; text-decoration: none;
          background: var(--card);
          color: var(--foreground);
          border: 1px solid var(--border);
          box-shadow: 0 2px 6px rgba(15,23,42,.04);
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s;
        }
        .bic-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 32px -16px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.06);
          border-color: oklch(0.36 0.13 255 / .35);
        }
        .bic-glow {
          position: absolute; inset: -30% -10% auto auto;
          width: 360px; height: 360px;
          background:
            radial-gradient(closest-side, oklch(0.36 0.13 255 / .14), transparent 70%),
            radial-gradient(closest-side at 60% 70%, oklch(0.50 0.16 145 / .12), transparent 70%);
          filter: blur(24px); pointer-events: none;
        }
        .bic-head { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        .bic-head-left { display: flex; align-items: flex-start; gap: .75rem; min-width: 0; }
        .bic-logo {
          width: 38px; height: 38px; border-radius: 9px;
          display: grid; place-items: center; color: white;
          font-weight: 800; font-size: .9rem; letter-spacing: -.02em;
          background: linear-gradient(135deg, var(--primary), var(--primary-darker));
          box-shadow: 0 4px 12px -2px oklch(0.36 0.13 255 / .45);
          flex-shrink: 0;
        }
        .bic-eyebrow {
          font-size: .65rem; text-transform: uppercase; letter-spacing: .08em;
          font-weight: 700; color: var(--muted-foreground);
        }
        .bic-title {
          font-size: 1.15rem; font-weight: 700; margin-top: .1rem;
          letter-spacing: -.01em;
        }
        .bic-sub { font-size: .8125rem; color: var(--muted-foreground); margin-top: .1rem; }
        .bic-spark {
          display: flex; flex-direction: column; align-items: flex-end; gap: .35rem;
          flex-shrink: 0;
        }
        .bic-cta {
          display: inline-flex; align-items: center; gap: .3rem;
          padding: .35rem .7rem; border-radius: 999px;
          background: linear-gradient(135deg, var(--primary), var(--primary-darker));
          font-size: .75rem; font-weight: 700; color: white;
          box-shadow: 0 4px 12px -3px oklch(0.36 0.13 255 / .4);
        }
        .bic-kpis {
          position: relative;
          margin-top: 1rem;
          display: grid; gap: .65rem;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
        .bic-mini {
          position: relative; overflow: hidden;
          padding: .65rem .8rem;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 11px;
        }
        .bic-mini[data-highlight="true"] {
          border-color: rgba(245,158,11,.55);
          box-shadow: 0 0 0 1px rgba(245,158,11,.18);
        }
        .bic-mini-strip {
          position: absolute; top: 8px; bottom: 8px; left: 0; width: 3px;
          background: var(--m-accent, var(--primary));
          border-radius: 0 3px 3px 0;
        }
        .bic-mini-label {
          font-size: .65rem; text-transform: uppercase; letter-spacing: .06em;
          font-weight: 700; color: var(--muted-foreground);
        }
        .bic-mini-value {
          font-size: 1.4rem; font-weight: 700; line-height: 1.05;
          font-variant-numeric: tabular-nums;
          letter-spacing: -.015em; margin-top: .15rem;
          color: var(--foreground);
        }
        .bic-mini-sub {
          font-size: .7rem; color: var(--muted-foreground); margin-top: .1rem;
        }
      `}</style>
    </>
  );
}

function BicMiniKpi({ label, value, sub, accent = 'primary', highlight }) {
  const colours = {
    primary: '#3622FF', success: '#16A34A', warning: '#F59E0B',
    teal: '#0891B2', violet: '#7C3AED', amber: '#D97706',
    neutral: '#94A3B8',
  };
  return (
    <div className="bic-mini" data-highlight={highlight ? 'true' : 'false'} style={{ '--m-accent': colours[accent] || colours.primary }}>
      <span className="bic-mini-strip" />
      <div className="bic-mini-label">{label}</div>
      <div className="bic-mini-value">{value}</div>
      {sub && <div className="bic-mini-sub">{sub}</div>}
    </div>
  );
}

// Reusable office-bearer CTA — same dark gradient card used by both the
// member dashboard and the legacy student/other layout. labels = { title, desc }.
function OfficeBearerCTA({ labels }) {
  return (
    <a href="#/admin" className="admin-cta-card">
      <div className="admin-cta-icon"><IconShield /></div>
      <div className="admin-cta-body">
        <div className="admin-cta-eyebrow">Your workspace</div>
        <div className="admin-cta-title">{labels.title}</div>
        <div className="admin-cta-desc">{labels.desc}</div>
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
  );
}

// Surfaces the count of checklists the current user can act on. Hidden when
// there are none, so non-chairmen don't see a noisy "0 pending" pill.
function PendingInstancesBadge() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/checklist-instances', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { rows: [] })
      .then((j) => { if (!cancelled) setCount((j.rows || []).filter((r) => r.status !== 'approved').length); })
      .catch(() => { if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, []);
  if (!count) return null;
  return (
    <a href="#/my-checklists" className="btn btn-outline" style={{ position: 'relative' }}>
      My checklists
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
