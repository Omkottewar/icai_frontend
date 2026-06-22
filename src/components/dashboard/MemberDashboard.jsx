import { useState } from 'react';
import NotificationSettingsCard from './NotificationSettingsCard';
import MemberProfileDrawer from './MemberProfileDrawer';
import {
  IconAward, IconShield, IconCalendar, IconBookOpen, IconUsers,
  IconBot, IconArrowRight, IconUser, IconSettings, IconLogOut,
  IconBriefcase, IconHandshake, IconCheckCircle, IconMessageSquare,
  IconMapPin, IconClock, IconFileText, IconDownload, IconBell,
  IconSparkles, IconEdit,
} from '../../icons';

// Profile-completeness helper. We only consider editable fields here —
// MRN/FCA/COP are ICAI-sourced and can't be changed in our portal, so
// counting them would punish members for things they can't fix.
const COMPLETENESS_FIELDS = ['phone', 'city', 'address', 'pincode', 'areas_of_practice'];

function completenessScore(profile) {
  if (!profile) return { pct: 0, missing: COMPLETENESS_FIELDS };
  const missing = [];
  for (const f of COMPLETENESS_FIELDS) {
    const v = profile[f];
    if (f === 'areas_of_practice') {
      if (!Array.isArray(v) || v.length === 0) missing.push(f);
    } else if (!v || (typeof v === 'string' && v.trim() === '')) {
      missing.push(f);
    }
  }
  const filled = COMPLETENESS_FIELDS.length - missing.length;
  return { pct: Math.round((filled / COMPLETENESS_FIELDS.length) * 100), missing };
}

const MISSING_LABELS = {
  phone:             'phone',
  city:              'city',
  address:           'address',
  pincode:           'pincode',
  areas_of_practice: 'areas of practice',
};

// Single source of truth for the Member dashboard. Owns:
//   - identity header (name + MRN + FCA/ACA + COP + city)
//   - CPE deadline alert (top banner, conditional)
//   - 4 stat tiles (CPE / years member / events attended FY / saved papers)
//   - main column: CPE card, upcoming events, suggested events, saved library, services
//   - side column: profile card, announcements, grievance tile, notification settings
//
// All data comes from /api/dashboard (member branch) — see backend
// server/routes/dashboard.ts for the response shape. Anything missing
// renders a friendly empty state rather than crashing.

const DATE_FMT      = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const DATE_TIME_FMT = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME_FMT.format(d);
}

function yearsBetween(iso) {
  if (!iso) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const diffYears = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.floor(diffYears));
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

// ICAI portal links member services route through (per Web-Media Policy 5c).
// All member services live on the official portal — we just deep-link to them
// instead of trying to clone them client-side.
const ICAI_LINKS = {
  udin:           'https://udin.icai.org/',
  cpePortal:      'https://cpeapp.icai.org/',
  copServices:    'https://eservices.icai.org/',
  firmRegister:   'https://eservices.icai.org/',
  membersPortal:  'https://www.icai.org/members',
};

export default function MemberDashboard({ user, data, logout, pendingBadge, officeBearerCard }) {
  const profile          = data?.profile ?? null;
  const cpe              = data?.cpe ?? null;
  const upcomingEvents   = data?.upcomingEvents ?? [];
  const suggestedEvents  = data?.suggestedEvents ?? [];
  const recentBookmarks  = data?.recentBookmarks ?? [];
  const announcements    = data?.announcements ?? [];
  const eventsAttendedFy = data?.eventsAttendedFy ?? 0;
  const bookmarksCount   = data?.bookmarksCount ?? 0;

  // Profile edit drawer — opened from the identity-card "Edit" link, the
  // profile sidecard, and the completeness nudge.
  const [editOpen, setEditOpen] = useState(false);
  const openEdit  = () => setEditOpen(true);
  const closeEdit = () => setEditOpen(false);

  const { pct: profilePct, missing: profileMissing } = completenessScore(profile);

  // Sections present in the page — drives the jump-pill navigation. We only
  // surface a chip if the section will actually render (e.g. no Suggested
  // chip when the user is already registered for everything upcoming).
  const sections = [
    cpe                     && { id: 'md-cpe',       label: 'CPE' },
                               { id: 'md-events',    label: 'Events' },
    suggestedEvents.length  && { id: 'md-discover',  label: 'Discover' },
                               { id: 'md-library',   label: 'Library' },
                               { id: 'md-services',  label: 'Services' },
    announcements.length    && { id: 'md-updates',   label: 'Updates' },
  ].filter(Boolean);

  return (
    <section className="container md-dash" style={{ padding: '1.5rem 1rem' }}>
      <MembershipIdentityCard user={user} profile={profile} pendingBadge={pendingBadge} onEdit={openEdit} />

      <ProfileCompletenessNudge pct={profilePct} missing={profileMissing} onEdit={openEdit} />

      <CPEDeadlineAlert cpe={cpe} />

      {officeBearerCard /* rendered by parent as <a className="admin-cta-card"> */}

      <MemberStatsRow cpe={cpe} profile={profile} eventsAttendedFy={eventsAttendedFy} bookmarksCount={bookmarksCount} />

      <JumpNav sections={sections} />

      <div className="md-dash-body">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="md-col">
          {cpe && <section id="md-cpe" className="md-section"><CPEComplianceCard cpe={cpe} /></section>}
          <section id="md-events" className="md-section"><UpcomingEventsCard rows={upcomingEvents} /></section>
          {suggestedEvents.length > 0 && (
            <section id="md-discover" className="md-section"><SuggestedEventsCard rows={suggestedEvents} /></section>
          )}
          <section id="md-library" className="md-section"><SavedLibraryCard items={recentBookmarks} total={bookmarksCount} /></section>
          <section id="md-services" className="md-section"><MemberServicesGrid /></section>
        </div>

        {/* ── Side column ─────────────────────────────────────────── *
            Reordered for "smarter prioritisation": time-sensitive items
            (announcements) sit above the always-true profile card; rarely-
            used items (grievance) sit at the bottom. */}
        <div className="md-col">
          {announcements.length > 0 && (
            <section id="md-updates" className="md-section"><AnnouncementsCard items={announcements} /></section>
          )}
          <ProfileSidecard user={user} profile={profile} logout={logout} onEdit={openEdit} />
          <NotificationSettingsCard />
          <GrievanceTile />
        </div>
      </div>

      <MemberDashboardStyles />

      <MemberProfileDrawer
        open={editOpen}
        onClose={closeEdit}
        profile={profile}
        userPhone={profile?.phone ?? ''}
      />
    </section>
  );
}

// ─── Profile-completeness nudge ─────────────────────────────────────────
//
// Surfaced only when the user has at least one editable field unfilled.
// Stays subtle (single line, soft border) — we don't want to nag someone
// who's already 80% complete the way the CPE alert nags about deadlines.
function ProfileCompletenessNudge({ pct, missing, onEdit }) {
  if (missing.length === 0) return null;
  const labels = missing.slice(0, 3).map((m) => MISSING_LABELS[m] || m);
  const extra = missing.length - labels.length;
  const whatToAdd = labels.join(', ') + (extra > 0 ? `, +${extra} more` : '');

  return (
    <div className="md-nudge" role="status">
      <div className="md-nudge-progress" aria-hidden="true">
        <div className="md-nudge-progress-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="md-nudge-body">
        <strong>Profile is {pct}% complete.</strong>
        <span className="muted-text"> Add {whatToAdd} so events and recommendations match your work.</span>
      </div>
      <button type="button" className="btn btn-outline md-nudge-cta" onClick={onEdit}>
        <IconEdit size="sm" /> Complete profile
      </button>
    </div>
  );
}

// ─── Jump pill nav ──────────────────────────────────────────────────────
//
// Horizontal scrollable chip row. Each chip jumps the page to that
// section using scrollIntoView, with scroll-margin-top on the targets so
// they land below the sticky app header. We intentionally don't make this
// bar sticky — under our already-sticky header it gets covered, and a
// non-sticky chip strip right above the dashboard body is enough for the
// "I want to jump to X" job.
function JumpNav({ sections }) {
  if (sections.length <= 1) return null;
  const onJump = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav className="md-jump" aria-label="Jump to dashboard section">
      {sections.map((s) => (
        <a key={s.id} href={'#' + s.id} className="md-jump-pill" onClick={(e) => onJump(e, s.id)}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}

// ─── Identity header ────────────────────────────────────────────────────
//
// Replaces the plain "Welcome back, X" with a rich card that surfaces every
// piece of membership identity the user usually has to dig through ICAI
// portal screens for (MRN, FCA status, COP details, member-since).
function MembershipIdentityCard({ user, profile, pendingBadge, onEdit }) {
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const firstName = (user?.name || '').split(' ')[0];
  const memberYears = yearsBetween(profile?.member_since);
  const fcaBadge   = profile?.is_fca ? 'FCA' : 'ACA';
  const copStatus  = profile?.cop_status && profile.cop_status !== 'none' ? profile.cop_status : null;
  const practising = profile?.is_practising;

  return (
    <div className="md-identity">
      <div className="md-identity-avatar">{initials}</div>
      <div className="md-identity-body">
        <div className="tiny-eyebrow row gap-2" style={{ alignItems: 'center' }}>
          <span>My Account</span>
          <button type="button" onClick={onEdit} className="md-identity-edit">
            <IconEdit size="sm" /> Edit profile
          </button>
        </div>
        <h1 className="md-identity-name">Welcome back, {firstName || 'Member'}</h1>
        <div className="md-identity-meta">
          <span><strong>MRN:</strong> {profile?.mrn ?? '—'}</span>
          {profile?.member_since && <span className="md-identity-sep">·</span>}
          {profile?.member_since && (
            <span>Member since {formatDate(profile.member_since)}
              {memberYears != null ? ` (${memberYears} yr${memberYears === 1 ? '' : 's'})` : ''}
            </span>
          )}
        </div>
        <div className="md-identity-badges">
          <span className={'md-pill md-pill-' + (profile?.is_fca ? 'gold' : 'blue')}>
            <IconAward size="sm" /> {fcaBadge}
          </span>
          {copStatus && (
            <span className="md-pill md-pill-green">
              <IconShield size="sm" /> COP {copStatus}
              {profile?.cop_number ? ` · ${profile.cop_number}` : ''}
            </span>
          )}
          {practising && (
            <span className="md-pill md-pill-blue">
              <IconBriefcase size="sm" /> Practising
            </span>
          )}
          {profile?.city && (
            <span className="md-pill md-pill-neutral">
              <IconMapPin size="sm" /> {profile.city}
            </span>
          )}
        </div>
      </div>
      <div className="md-identity-actions">
        {pendingBadge}
        <a href="#/events" className="btn btn-outline">Browse events</a>
        <a href="#/praygyaan" className="btn btn-primary"><IconBot size="sm" /> Ask PrayGyaan</a>
      </div>
    </div>
  );
}

// ─── CPE deadline alert ─────────────────────────────────────────────────
//
// Shows up only when the user is materially behind on CPE and there's less
// than 90 days to FY end. Three tones: amber (within 90d, gap > 0), red (within
// 30d AND gap > 0), green-success (already met target). We deliberately don't
// nag people who are on track — too many banners and the page becomes noise.
function CPEDeadlineAlert({ cpe }) {
  if (!cpe) return null;
  const gap = Math.max(0, cpe.target - cpe.total_hours);
  const fyEnd = new Date(cpe.fy_end);
  const daysLeft = Math.max(0, Math.ceil((fyEnd.getTime() - Date.now()) / 86_400_000));
  const onTrack = gap === 0;

  // On track ⇒ a single success line; everything else gets a coloured banner.
  if (onTrack) {
    return (
      <div className="md-alert md-alert-success">
        <IconCheckCircle size="sm" />
        <div>
          <strong>You've cleared this year's CPE target.</strong>
          <span className="muted-text"> {cpe.total_hours} of {cpe.target} hours done · {cpe.fy_label} closes in {daysLeft} day{daysLeft === 1 ? '' : 's'}.</span>
        </div>
      </div>
    );
  }
  if (daysLeft > 90) return null;

  const urgent = daysLeft <= 30;
  return (
    <div className={'md-alert ' + (urgent ? 'md-alert-danger' : 'md-alert-warn')}>
      <IconClock size="sm" />
      <div>
        <strong>
          {gap} hour{gap === 1 ? '' : 's'} of CPE left for {cpe.fy_label}.
        </strong>
        <span className="muted-text"> {daysLeft} day{daysLeft === 1 ? '' : 's'} to close. </span>
        <a href="#/events" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
          Find a CPE event →
        </a>
      </div>
    </div>
  );
}

// ─── Stats row ──────────────────────────────────────────────────────────
function MemberStatsRow({ cpe, profile, eventsAttendedFy, bookmarksCount }) {
  const cpePct       = cpe ? Math.min(100, Math.round((cpe.total_hours / cpe.target) * 100)) : 0;
  const memberYears  = yearsBetween(profile?.member_since);
  return (
    <div className="md-stats">
      <StatTile
        Icon={IconAward}
        label="CPE this FY"
        value={cpe ? `${cpe.total_hours} / ${cpe.target}` : '—'}
        sub={cpe ? `${cpePct}% complete` : 'No data'}
        tone="primary"
      />
      <StatTile
        Icon={IconUsers}
        label="Years a member"
        value={memberYears != null ? memberYears : '—'}
        sub={profile?.member_since ? `Since ${formatDate(profile.member_since)}` : 'Profile incomplete'}
        tone="indigo"
      />
      <StatTile
        Icon={IconCalendar}
        label="Events attended FY"
        value={eventsAttendedFy}
        sub={eventsAttendedFy === 0 ? 'Browse upcoming events' : 'Marked attended'}
        tone="green"
      />
      <StatTile
        Icon={IconBookOpen}
        label="Saved papers"
        value={bookmarksCount}
        sub={bookmarksCount === 0 ? 'Bookmark from any paper' : 'In your library'}
        tone="amber"
      />
    </div>
  );
}

function StatTile({ Icon, label, value, sub, tone = 'primary' }) {
  return (
    <div className={'md-stat md-stat-' + tone}>
      <div className="md-stat-icon"><Icon size="sm" /></div>
      <div className="md-stat-body">
        <div className="md-stat-label">{label}</div>
        <div className="md-stat-value">{value}</div>
        <div className="md-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

// ─── CPE compliance card ────────────────────────────────────────────────
function CPEComplianceCard({ cpe }) {
  const pct = Math.min(100, Math.round((cpe.total_hours / cpe.target) * 100));
  const remaining = Math.max(0, cpe.target - cpe.total_hours);

  return (
    <div className="card md-card">
      <div className="md-card-head">
        <div>
          <h2 className="md-card-title">CPE compliance</h2>
          <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>{cpe.fy_label}</p>
        </div>
        <a href={ICAI_LINKS.cpePortal} target="_blank" rel="noopener noreferrer" className="md-card-action">
          ICAI CPE portal <IconArrowRight size="sm" />
        </a>
      </div>

      <div className="row gap-3" style={{ marginTop: '.75rem', justifyContent: 'space-between' }}>
        <span className="muted-text" style={{ fontSize: '.875rem' }}>
          {cpe.total_hours} of {cpe.target} hours completed
        </span>
        <span style={{ fontWeight: 700, fontSize: '.95rem', color: pct >= 75 ? 'var(--secondary)' : 'var(--primary)' }}>
          {pct}%
        </span>
      </div>
      <div className="progress-track" style={{ marginTop: '.5rem' }}>
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>

      <div className="md-cpe-breakdown">
        <CpeChip label="Structured" hours={cpe.structured_hours} />
        <CpeChip label="Unstructured" hours={cpe.unstructured_hours} />
        <CpeChip label="Remaining" hours={remaining} tone={remaining === 0 ? 'success' : 'warn'} />
        <CpeChip label="3-yr block target" hours={cpe.three_year_block_target} />
      </div>
    </div>
  );
}

function CpeChip({ label, hours, tone }) {
  return (
    <div className={'md-cpe-chip' + (tone ? ' md-cpe-chip-' + tone : '')}>
      <div className="md-cpe-chip-label">{label}</div>
      <div className="md-cpe-chip-value">{hours}<span> hrs</span></div>
    </div>
  );
}

// ─── My upcoming events ─────────────────────────────────────────────────
function UpcomingEventsCard({ rows }) {
  return (
    <div className="card md-card">
      <div className="md-card-head">
        <h2 className="md-card-title">My upcoming events</h2>
        <a href="#/events" className="md-card-action">Find more →</a>
      </div>
      {rows.length === 0 ? (
        <div className="md-empty">
          <IconCalendar size="lg" />
          <p>No events on your calendar yet.</p>
          <a href="#/events" className="md-empty-cta">Browse what's on →</a>
        </div>
      ) : (
        <ul className="md-list" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
          {rows.map((e) => {
            const palette = REGISTRATION_STYLES[e.status] ?? REGISTRATION_STYLES.registered;
            return (
              <li key={e.id} className="md-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="md-row-title">{e.title}</div>
                  <div className="md-row-meta">
                    <span className="row gap-1"><IconCalendar size="sm" /> {formatDateTime(e.starts_at)}</span>
                    {Number(e.cpe_hours) > 0 && (
                      <span className="row gap-1"><IconAward size="sm" /> {Number(e.cpe_hours)} CPE</span>
                    )}
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
  );
}

// ─── Suggested events (NEW) ─────────────────────────────────────────────
function SuggestedEventsCard({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card md-card">
      <div className="md-card-head">
        <div>
          <h2 className="md-card-title">Events you might like</h2>
          <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>
            Upcoming, with seats open — pulled from the events you haven't joined yet.
          </p>
        </div>
        <a href="#/events" className="md-card-action">All events →</a>
      </div>
      <ul className="md-list" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
        {rows.map((e) => (
          <li key={e.id} className="md-row md-row-link">
            <a href={`#/events?slug=${e.slug}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="md-row-title">{e.title}</div>
                <div className="md-row-meta">
                  <span className="row gap-1"><IconCalendar size="sm" /> {formatDateTime(e.starts_at)}</span>
                  {Number(e.cpe_hours) > 0 && (
                    <span className="row gap-1"><IconAward size="sm" /> {Number(e.cpe_hours)} CPE</span>
                  )}
                  {e.committee_code && (
                    <span className="md-row-chip">{e.committee_code}</span>
                  )}
                </div>
              </div>
              <IconArrowRight size="sm" style={{ color: 'var(--muted-foreground)' }} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Saved Library teaser ───────────────────────────────────────────────
function SavedLibraryCard({ items, total }) {
  return (
    <div className="card md-card">
      <div className="md-card-head">
        <div>
          <h2 className="md-card-title">My library</h2>
          <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>
            {total > 0 ? `${total} saved item${total === 1 ? '' : 's'} · most-recent first` : 'Save papers and journals you want to revisit.'}
          </p>
        </div>
        <a href="#/my-library" className="md-card-action">Open library →</a>
      </div>
      {items.length === 0 ? (
        <div className="md-empty">
          <IconBookOpen size="lg" />
          <p>Nothing saved yet.</p>
          <a href="#/resources" className="md-empty-cta">Browse resources →</a>
        </div>
      ) : (
        <div className="md-library-grid">
          {items.map((b) => (
            <a key={b.bookmark_id} href={`#/resources/${b.resource_type === 'ejournal' ? 'journal' : 'papers'}/${b.slug}`} className="md-library-tile">
              {b.cover_url ? (
                <img src={b.cover_url} alt="" loading="lazy" />
              ) : (
                <div className="md-library-cover-fallback">
                  <IconFileText size="lg" />
                </div>
              )}
              <div className="md-library-tile-body">
                <div className="md-library-tile-type">
                  {b.resource_type === 'ejournal' ? 'e-Journal' : 'Paper'}
                </div>
                <div className="md-library-tile-title">{b.title}</div>
                {b.subtitle && <div className="md-library-tile-sub">{b.subtitle}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Member services grid (real URLs) ───────────────────────────────────
function MemberServicesGrid() {
  const items = [
    { Icon: IconShield,    title: 'Generate UDIN',          desc: 'Issue UDIN for signed documents on the official portal.', href: ICAI_LINKS.udin, external: true },
    { Icon: IconAward,     title: 'Track CPE certificates', desc: 'Download structured/unstructured CPE certificates.',     href: ICAI_LINKS.cpePortal, external: true },
    { Icon: IconBriefcase, title: 'COP services',           desc: 'COP renewal, restoration, surrender, firm registration.', href: ICAI_LINKS.copServices, external: true },
    { Icon: IconUsers,     title: 'Members directory',      desc: 'Find a Nagpur member by name, MRN or area.',              href: '#/members-directory' },
    { Icon: IconBriefcase, title: 'Job vacancies',          desc: 'Senior positions and openings posted by member firms.',   href: '#/job-vacancies' },
    { Icon: IconHandshake, title: 'Contribute to CABF',     desc: 'Support members and families in distress.',              href: '#/benevolent-fund' },
  ];

  return (
    <div className="card md-card">
      <div className="md-card-head">
        <h2 className="md-card-title">Member services</h2>
      </div>
      <div className="md-services-grid">
        {items.map((it) => {
          const isExternal = !!it.external;
          const linkProps = isExternal
            ? { href: it.href, target: '_blank', rel: 'noopener noreferrer' }
            : { href: it.href };
          return (
            <a key={it.title} {...linkProps} className="md-service">
              <span className="md-service-icon"><it.Icon /></span>
              <span className="md-service-body">
                <span className="md-service-title">
                  {it.title}
                  {isExternal && <span className="md-service-ext">↗</span>}
                </span>
                <span className="md-service-desc">{it.desc}</span>
              </span>
              <IconArrowRight size="sm" className="md-service-arrow" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Side: profile mini-card ────────────────────────────────────────────
function ProfileSidecard({ user, profile, logout, onEdit }) {
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const areas = Array.isArray(profile?.areas_of_practice) ? profile.areas_of_practice : [];
  return (
    <div className="card md-card">
      <div className="row gap-3">
        <span className="avatar-circle" style={{ width: '3.5rem', height: '3.5rem', fontSize: '1rem' }}>{initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="muted-text" style={{ fontSize: '.8125rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          <span className="badge badge-secondary" style={{ marginTop: '.375rem' }}>{user.role}</span>
        </div>
      </div>

      {areas.length > 0 && (
        <div style={{ marginTop: '.85rem' }}>
          <div className="md-card-mini-label">Areas of practice</div>
          <div className="md-pill-row" style={{ marginTop: '.4rem' }}>
            {areas.slice(0, 4).map((a) => (
              <span key={a} className="md-pill md-pill-neutral">{a}</span>
            ))}
          </div>
        </div>
      )}

      <div className="col gap-2" style={{ marginTop: '1rem' }}>
        {/* "Edit profile" opens the in-app drawer — phone, city, areas of
            practice etc. are stored locally. ICAI-controlled fields (MRN,
            FCA, COP) are read-only inside the drawer with a link out. */}
        <button type="button" onClick={onEdit} className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
          <IconEdit size="sm" /> Edit profile
        </button>
        <a href={ICAI_LINKS.membersPortal} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
          <IconShield size="sm" /> ICAI account ↗
        </a>
        <button onClick={logout} className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}>
          <IconLogOut size="sm" /> Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Side: announcements ────────────────────────────────────────────────
function AnnouncementsCard({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card md-card">
      <div className="md-card-head">
        <h2 className="md-card-title row gap-2"><IconBell size="sm" /> Branch announcements</h2>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '.5rem 0 0' }}>
        {items.map((a) => {
          const inner = (
            <>
              <div className="md-row-title" style={{ fontSize: '.85rem' }}>{a.title}</div>
              {a.body && (
                <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.2rem' }}>
                  {a.body.length > 110 ? a.body.slice(0, 110) + '…' : a.body}
                </div>
              )}
              <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>
                {formatDate(a.starts_at)}
              </div>
            </>
          );
          return (
            <li key={a.id} className="md-announce">
              {a.link_url ? (
                <a href={a.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
                  {inner}
                </a>
              ) : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Side: grievance tile ───────────────────────────────────────────────
function GrievanceTile() {
  return (
    <div className="card md-card md-grievance">
      <div className="md-grievance-icon"><IconMessageSquare /></div>
      <div className="md-grievance-body">
        <div className="md-card-title">Raise a concern</div>
        <p className="muted-text" style={{ fontSize: '.78rem', margin: '.2rem 0 .65rem' }}>
          Grievances against members, firms or the branch. 48-hour SLA.
        </p>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <a href="#/contact" className="btn btn-primary" style={{ padding: '.35rem .7rem', fontSize: '.78rem' }}>New grievance</a>
          <a href="#/track-grievance" className="btn btn-outline" style={{ padding: '.35rem .7rem', fontSize: '.78rem' }}>Track ticket</a>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
function MemberDashboardStyles() {
  return (
    <style>{`
      /* Cards are denser here than the default .card to keep the dashboard
         compact — half the cards are at-a-glance widgets, so less padding
         puts more content above the fold. */
      .md-dash .card { padding: .9rem; }
      .md-dash .md-card { padding: .9rem; }
      .md-card-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: .65rem; flex-wrap: wrap;
      }
      .md-card-title { font-size: .95rem; font-weight: 700; margin: 0; letter-spacing: -.01em; }
      .md-card-action {
        font-size: .76rem; font-weight: 600; color: var(--primary);
        display: inline-flex; align-items: center; gap: .25rem;
        text-decoration: none; flex-shrink: 0;
      }
      .md-card-action:hover { text-decoration: underline; }
      .md-card-mini-label {
        font-size: .64rem; font-weight: 700; letter-spacing: .08em;
        text-transform: uppercase; color: var(--muted-foreground);
      }

      /* ── Section landing offset ─────────────────────────────────── *
         Each <section.md-section> is a JumpNav target. Setting
         scroll-margin-top here means a chip click lands the target just
         below the sticky app header instead of behind it. */
      .md-section { scroll-margin-top: 96px; }
      .md-section:not(:last-child) { /* gap handled by .md-col */ }

      /* ── Identity header ────────────────────────────────────────── */
      .md-identity {
        display: grid; gap: .85rem;
        grid-template-columns: auto 1fr;
        align-items: center;
        background:
          radial-gradient(circle at top right, oklch(0.50 0.16 145 / .08), transparent 60%),
          radial-gradient(circle at bottom left, oklch(0.36 0.13 255 / .08), transparent 60%),
          var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 1rem 1.1rem;
        margin-bottom: .75rem;
      }
      .md-identity-avatar {
        width: 3.5rem; height: 3.5rem; border-radius: 14px;
        display: grid; place-items: center; flex-shrink: 0;
        background: linear-gradient(135deg, var(--primary), var(--primary-darker, #1B0FA8));
        color: white; font-weight: 800; font-size: 1.05rem; letter-spacing: -.02em;
        box-shadow: 0 4px 14px -4px oklch(0.36 0.13 255 / .45);
      }
      .md-identity-body { min-width: 0; }
      .md-identity-name {
        margin: .15rem 0 0; font-size: clamp(1.2rem, 4vw, 1.5rem);
        font-weight: 800; letter-spacing: -.015em; line-height: 1.15;
      }
      .md-identity-meta {
        margin-top: .25rem; font-size: .8rem; color: var(--muted-foreground);
        display: flex; flex-wrap: wrap; gap: .5rem; align-items: center;
      }
      .md-identity-sep { opacity: .4; }
      .md-identity-badges {
        margin-top: .65rem; display: flex; flex-wrap: wrap; gap: .4rem;
      }
      .md-identity-actions {
        display: flex; flex-wrap: wrap; gap: .5rem; align-items: center;
        grid-column: 1 / -1;
      }

      .md-pill {
        display: inline-flex; align-items: center; gap: .3rem;
        padding: .25rem .55rem; font-size: .72rem; font-weight: 600;
        border-radius: 999px; line-height: 1;
      }
      .md-pill-gold    { background: oklch(0.85 0.16 90 / .25); color: #92400e; }
      .md-pill-blue    { background: oklch(0.36 0.13 255 / .10); color: var(--primary); }
      .md-pill-green   { background: oklch(0.55 0.14 155 / .12); color: var(--secondary); }
      .md-pill-neutral { background: var(--muted, #f1f5f9); color: var(--muted-foreground); }
      .md-pill-row { display: flex; flex-wrap: wrap; gap: .35rem; }

      /* ── Identity "Edit profile" link in the eyebrow row ───────── */
      .md-identity-edit {
        display: inline-flex; align-items: center; gap: .25rem;
        font-size: .65rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .06em; color: var(--primary);
        background: transparent; border: none; padding: .1rem .35rem;
        border-radius: 999px; cursor: pointer;
      }
      .md-identity-edit:hover { background: oklch(0.36 0.13 255 / .08); }

      /* ── Profile-completeness nudge ────────────────────────────── */
      .md-nudge {
        display: flex; align-items: center; gap: .75rem;
        padding: .55rem .8rem; margin-bottom: .75rem;
        background: var(--card);
        border: 1px solid oklch(0.78 0.15 75 / .35);
        border-left-width: 3px;
        border-radius: 10px; font-size: .82rem;
        position: relative;
      }
      .md-nudge-progress {
        position: absolute; left: 0; bottom: 0; right: 0; height: 2px;
        background: oklch(0.78 0.15 75 / .15);
        border-radius: 0 0 9px 9px; overflow: hidden;
      }
      .md-nudge-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.55 0.14 155));
        transition: width .3s ease;
      }
      .md-nudge-body { flex: 1; min-width: 0; }
      .md-nudge-body .muted-text { color: var(--muted-foreground); }
      .md-nudge-cta {
        flex-shrink: 0; padding: .3rem .7rem;
        font-size: .78rem;
      }
      @media (max-width: 560px) {
        .md-nudge { flex-wrap: wrap; }
        .md-nudge-cta { width: 100%; justify-content: center; }
      }

      /* ── CPE deadline alert ────────────────────────────────────── */
      .md-alert {
        display: flex; gap: .6rem; align-items: flex-start;
        padding: .65rem .85rem; border-radius: 10px;
        margin-bottom: .75rem; font-size: .83rem;
        border: 1px solid;
      }
      .md-alert > svg { flex-shrink: 0; margin-top: .15rem; }
      .md-alert-success { background: oklch(0.55 0.14 155 / .08); border-color: oklch(0.55 0.14 155 / .35); color: var(--secondary); }
      .md-alert-warn    { background: oklch(0.85 0.16 90 / .15); border-color: oklch(0.85 0.16 90 / .55); color: #92400e; }
      .md-alert-danger  { background: oklch(0.577 0.245 27.325 / .08); border-color: oklch(0.577 0.245 27.325 / .35); color: var(--destructive); }
      .md-alert .muted-text { color: inherit; opacity: .85; }

      /* ── Stat tiles ─────────────────────────────────────────────── */
      .md-stats {
        display: grid; gap: .55rem;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        margin-bottom: .75rem;
      }
      .md-stat {
        display: flex; gap: .65rem; align-items: center;
        background: var(--card); border: 1px solid var(--border);
        border-radius: 10px; padding: .7rem .8rem;
        position: relative; overflow: hidden;
      }
      .md-stat::before {
        content: ''; position: absolute; inset: 0 auto 0 0; width: 3px;
        background: var(--md-stat-accent, var(--primary));
      }
      .md-stat-icon {
        width: 2rem; height: 2rem; border-radius: 7px;
        display: grid; place-items: center; flex-shrink: 0;
        background: var(--md-stat-bg, oklch(0.36 0.13 255 / .10));
        color: var(--md-stat-accent, var(--primary));
      }
      .md-stat-body { min-width: 0; }
      .md-stat-label {
        font-size: .65rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .06em; color: var(--muted-foreground);
      }
      .md-stat-value {
        font-size: 1.2rem; font-weight: 800; line-height: 1.05;
        font-variant-numeric: tabular-nums; letter-spacing: -.015em;
        margin-top: .1rem;
      }
      .md-stat-sub { font-size: .68rem; color: var(--muted-foreground); margin-top: .1rem; }
      .md-stat-primary { --md-stat-accent: var(--primary);    --md-stat-bg: oklch(0.36 0.13 255 / .10); }
      .md-stat-green   { --md-stat-accent: #16a34a;            --md-stat-bg: rgba(22,163,74,.10); }
      .md-stat-amber   { --md-stat-accent: #d97706;            --md-stat-bg: rgba(217,119,6,.12); }
      .md-stat-indigo  { --md-stat-accent: #5b5bd6;            --md-stat-bg: rgba(91,91,214,.12); }

      /* ── CPE breakdown ──────────────────────────────────────────── */
      .md-cpe-breakdown {
        margin-top: .75rem;
        display: grid; gap: .4rem;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      }
      .md-cpe-chip {
        background: var(--background); border: 1px solid var(--border);
        border-radius: 8px; padding: .4rem .55rem;
      }
      .md-cpe-chip-label {
        font-size: .62rem; font-weight: 600; color: var(--muted-foreground);
        text-transform: uppercase; letter-spacing: .05em;
      }
      .md-cpe-chip-value {
        font-size: .98rem; font-weight: 700; margin-top: .1rem;
        font-variant-numeric: tabular-nums; color: var(--foreground);
      }
      .md-cpe-chip-value span { font-size: .7rem; font-weight: 500; color: var(--muted-foreground); margin-left: .15rem; }
      .md-cpe-chip-warn    { border-color: oklch(0.85 0.16 90 / .55); background: oklch(0.85 0.16 90 / .08); }
      .md-cpe-chip-success { border-color: oklch(0.55 0.14 155 / .35); background: oklch(0.55 0.14 155 / .07); }

      /* ── List rows (events, suggestions) ────────────────────────── */
      .md-list { display: flex; flex-direction: column; }
      .md-row {
        display: flex; justify-content: space-between; align-items: center;
        gap: .85rem; padding: .55rem 0;
        border-bottom: 1px solid var(--border);
      }
      .md-row:last-child { border-bottom: none; }
      .md-row-link:hover { background: var(--muted, #fafafa); border-radius: 8px; padding-left: .35rem; padding-right: .35rem; }
      .md-row-title {
        font-weight: 600; font-size: .875rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .md-row-meta {
        display: flex; flex-wrap: wrap; gap: .7rem; align-items: center;
        margin-top: .25rem; font-size: .72rem; color: var(--muted-foreground);
      }
      .md-row-chip {
        padding: .1rem .45rem; border-radius: 999px;
        background: oklch(0.36 0.13 255 / .10); color: var(--primary);
        font-weight: 600;
      }

      /* ── Empty state ────────────────────────────────────────────── */
      .md-empty {
        text-align: center; padding: 1.5rem .5rem .25rem;
        color: var(--muted-foreground);
      }
      .md-empty svg { opacity: .4; margin-bottom: .35rem; }
      .md-empty p { margin: 0; font-size: .85rem; }
      .md-empty-cta {
        display: inline-block; margin-top: .5rem;
        color: var(--primary); font-weight: 600; font-size: .82rem;
      }

      /* ── Library grid ───────────────────────────────────────────── */
      .md-library-grid {
        margin-top: .7rem;
        display: grid; gap: .55rem;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      }
      .md-library-tile {
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid var(--border); border-radius: 10px;
        background: var(--card); text-decoration: none; color: inherit;
        transition: transform .15s, box-shadow .15s, border-color .15s;
      }
      .md-library-tile:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px -16px rgba(15,23,42,.25);
        border-color: var(--primary);
      }
      .md-library-tile img,
      .md-library-cover-fallback {
        width: 100%; aspect-ratio: 3 / 4; object-fit: cover;
        display: block; background: var(--muted, #f1f5f9);
      }
      .md-library-cover-fallback {
        display: grid; place-items: center; color: var(--muted-foreground);
      }
      .md-library-tile-body { padding: .55rem .65rem .7rem; }
      .md-library-tile-type {
        font-size: .62rem; font-weight: 700; letter-spacing: .06em;
        text-transform: uppercase; color: var(--muted-foreground);
      }
      .md-library-tile-title {
        font-size: .82rem; font-weight: 600; line-height: 1.25;
        margin-top: .15rem;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .md-library-tile-sub {
        font-size: .68rem; color: var(--muted-foreground); margin-top: .2rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      /* ── Services grid ──────────────────────────────────────────── */
      .md-services-grid {
        margin-top: .7rem;
        display: grid; gap: .45rem;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      .md-service {
        display: flex; align-items: center; gap: .6rem;
        padding: .55rem .7rem; border: 1px solid var(--border);
        border-radius: 9px; text-decoration: none; color: inherit;
        transition: border-color .15s, transform .15s, box-shadow .15s;
        background: var(--card);
      }
      .md-service:hover {
        border-color: var(--primary); transform: translateY(-1px);
        box-shadow: 0 6px 16px -10px rgba(15,23,42,.2);
      }
      .md-service-icon {
        width: 1.8rem; height: 1.8rem; border-radius: 7px;
        display: grid; place-items: center;
        background: oklch(0.36 0.13 255 / .08); color: var(--primary);
        flex-shrink: 0;
      }
      .md-service-body { flex: 1; min-width: 0; }
      .md-service-title {
        font-size: .78rem; font-weight: 700;
        display: flex; align-items: center; gap: .25rem;
      }
      .md-service-ext { color: var(--muted-foreground); font-size: .65rem; }
      .md-service-desc {
        display: block; font-size: .68rem; color: var(--muted-foreground);
        margin-top: .1rem; line-height: 1.3;
      }
      .md-service-arrow { color: var(--muted-foreground); flex-shrink: 0; }

      /* ── Announcements ──────────────────────────────────────────── */
      .md-announce {
        padding: .65rem .15rem;
        border-bottom: 1px solid var(--border);
      }
      .md-announce:last-child { border-bottom: none; }

      /* ── Grievance tile ─────────────────────────────────────────── */
      .md-grievance {
        display: flex; gap: .85rem; align-items: flex-start;
        background: linear-gradient(135deg, oklch(0.36 0.13 255 / .04), oklch(0.55 0.14 155 / .04));
      }
      .md-grievance-icon {
        width: 2.4rem; height: 2.4rem; border-radius: 10px;
        display: grid; place-items: center; flex-shrink: 0;
        background: oklch(0.36 0.13 255 / .10); color: var(--primary);
      }
      .md-grievance-body { flex: 1; min-width: 0; }

      /* ── Jump-to-section pill row ───────────────────────────────── *
         Sits between the stats row and the two-column body. Horizontally
         scrollable on narrow screens so the chip strip never wraps and
         eats vertical room. */
      .md-jump {
        display: flex; gap: .35rem;
        margin-bottom: .85rem;
        padding-bottom: .15rem;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .md-jump::-webkit-scrollbar { display: none; }
      .md-jump-pill {
        flex-shrink: 0;
        padding: .35rem .75rem;
        border-radius: 999px;
        background: var(--card);
        border: 1px solid var(--border);
        font-size: .75rem;
        font-weight: 600;
        color: var(--foreground);
        text-decoration: none;
        transition: background .15s, border-color .15s, color .15s, transform .12s;
      }
      .md-jump-pill:hover {
        background: oklch(0.36 0.13 255 / .08);
        border-color: var(--primary);
        color: var(--primary);
        transform: translateY(-1px);
      }

      /* ── Two-column body ────────────────────────────────────────── */
      .md-dash-body {
        display: grid; gap: .75rem; grid-template-columns: 1fr;
      }
      .md-col { display: flex; flex-direction: column; gap: .75rem; }

      @media (min-width: 720px) {
        .md-identity {
          grid-template-columns: auto 1fr auto;
        }
        .md-identity-actions {
          grid-column: auto;
        }
      }
      @media (min-width: 960px) {
        .md-dash-body { grid-template-columns: 1fr 340px; }
      }
    `}</style>
  );
}
