import { useEffect, useState } from 'react';
import NotificationSettingsCard from './NotificationSettingsCard';
import MemberProfileDrawer from './MemberProfileDrawer';
import {
  IconAward, IconShield, IconCalendar, IconBookOpen, IconUsers,
  IconBot, IconArrowRight, IconUser, IconSettings, IconLogOut,
  IconBriefcase, IconHandshake, IconCheckCircle, IconMessageSquare,
  IconMapPin, IconClock, IconFileText, IconDownload, IconBell,
  IconSparkles, IconEdit,
} from '../../icons';
import { googleCalendarEventUrl, googleCalendarSubscribeUrl } from '../../lib/googleCalendar';
import { withCAPrefix } from '../../lib/displayName';
import { toast } from '../../lib/notify';
import { dialog } from '../../lib/dialog';
import Button from '../ui/Button';

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
//   - 3 stat tiles (years member / events attended FY / saved papers)
//   - main column: upcoming events, suggested events, saved library, services
//   - side column: profile card, announcements, grievance tile, notification settings
// CPE tracking was removed in migration 0087 — the ICAI publish API is
// no longer available so the branch stopped surfacing hour balances.
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
  copServices:    'https://eservices.icai.org/',
  firmRegister:   'https://eservices.icai.org/',
  membersPortal:  'https://www.icai.org/members',
};

export default function MemberDashboard({ user, data, logout, onRefresh, pendingBadge, officeBearerCard }) {
  const profile          = data?.profile ?? null;
  const upcomingEvents   = data?.upcomingEvents ?? [];
  const recentCertificates = data?.recentCertificates ?? [];
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

  // Tabbed layout — replaces the long-scroll JumpNav. Each tab groups a
  // few related cards so the page fits without scrolling on most screens.
  // Tab state syncs to the URL hash so deep-links + back-button work, and
  // it survives hot reloads in dev.
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'events',   label: 'Events' },
    { id: 'library',  label: 'Library' },
    { id: 'settings', label: 'Settings' },
  ];
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return TABS.some((t) => t.id === h) ? h : 'overview';
  });
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== tab) {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, [tab]);

  return (
    <section className="container md-dash" style={{ padding: '1.5rem 1rem' }}>
      {/* ── Always-visible header ─────────────────────────────────
          Identity, office-bearer admin entry, and the stats row stay
          above the tabs — glanceable on every visit regardless of tab. */}
      <MembershipIdentityCard user={user} profile={profile} pendingBadge={pendingBadge} onEdit={openEdit} />

      <ProfileCompletenessNudge pct={profilePct} missing={profileMissing} onEdit={openEdit} />

      {officeBearerCard /* rendered by parent as <a className="admin-cta-card"> */}

      <MemberStatsRow profile={profile} eventsAttendedFy={eventsAttendedFy} bookmarksCount={bookmarksCount} />

      {/* ── Tab strip ────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Dashboard sections" className="md-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`md-tab-${t.id}`}
            className={'md-tab' + (tab === t.id ? ' is-active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div id="md-tab-overview" role="tabpanel" className="md-tab-body">
          {announcements.length > 0 && <AnnouncementsCard items={announcements} />}
        </div>
      )}

      {tab === 'events' && (
        <div id="md-tab-events" role="tabpanel" className="md-tab-body">
          <UpcomingEventsCard rows={upcomingEvents} onCancelled={() => onRefresh?.()} />
          <MyRoomBookingsCard />
          {suggestedEvents.length > 0 && <SuggestedEventsCard rows={suggestedEvents} />}
          <MyCertificatesCard rows={recentCertificates} />
        </div>
      )}

      {tab === 'library' && (
        <div id="md-tab-library" role="tabpanel" className="md-tab-body">
          <SavedLibraryCard items={recentBookmarks} total={bookmarksCount} />
          <MemberServicesGrid />
        </div>
      )}

      {tab === 'settings' && (
        <div id="md-tab-settings" role="tabpanel" className="md-tab-body md-tab-body-grid">
          <ProfileSidecard user={user} profile={profile} logout={logout} onEdit={openEdit} />
          <CalendarSubscriptionCard />
          <NotificationSettingsCard />
          <GrievanceTile />
        </div>
      )}

      <MemberDashboardStyles />

      <MemberProfileDrawer
        open={editOpen}
        onClose={closeEdit}
        profile={profile}
        userPhone={profile?.phone ?? ''}
        onSaved={() => { onRefresh?.(); }}
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
  const displayName = withCAPrefix(user?.name, user?.primary_role);
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
        <h1 className="md-identity-name">Welcome back, {displayName || 'Member'}</h1>
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
        <a href="/events" className="btn btn-outline">Browse events</a>
        <a href="/praygyaan" className="btn btn-primary"><IconBot size="sm" /> Ask PrayGyaan</a>
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
// ─── Stats row ──────────────────────────────────────────────────────────
// Compact stats row — we only render tiles that have real data. Tiles
// with placeholders (dashes, "Profile incomplete") were doing more harm
// than good on first-impression: they made the page feel broken to
// non-technical members. The "Years a member" tile is now hidden when
// member_since is missing; "Saved papers" is hidden until the member
// has actually saved at least one. The result is a tighter row of
// genuinely-useful numbers.
function MemberStatsRow({ profile, eventsAttendedFy, bookmarksCount }) {
  const memberYears = yearsBetween(profile?.member_since);

  const tiles = [];
  // Always show events attended — zero is meaningful information.
  tiles.push({
    key: 'events',
    Icon: IconCalendar,
    label: 'Events attended',
    value: eventsAttendedFy,
    sub: eventsAttendedFy === 0 ? 'No events yet this year' : 'This financial year',
    tone: 'green',
  });
  // Only show years-a-member when we have a real number.
  if (memberYears != null) {
    tiles.push({
      key: 'years',
      Icon: IconUsers,
      label: 'Years a member',
      value: memberYears,
      sub: `Since ${formatDate(profile.member_since)}`,
      tone: 'indigo',
    });
  }
  // Only show saved-papers when the member has saved at least one.
  if (bookmarksCount > 0) {
    tiles.push({
      key: 'bookmarks',
      Icon: IconBookOpen,
      label: 'Saved papers',
      value: bookmarksCount,
      sub: 'In your library',
      tone: 'amber',
    });
  }

  return (
    <div className="md-stats">
      {tiles.map((t) => (
        <StatTile key={t.key} Icon={t.Icon} label={t.label} value={t.value} sub={t.sub} tone={t.tone} />
      ))}
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

// ─── My upcoming events ─────────────────────────────────────────────────
function UpcomingEventsCard({ rows, onCancelled }) {
  const [busy, setBusy] = useState(null); // slug currently being cancelled

  async function cancel(slug, title) {
    const ok = await dialog.confirm({
      title: 'Cancel registration?',
      message: `Cancel your registration for "${title}"?`,
      confirmText: 'Cancel registration',
      cancelText: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    setBusy(slug);
    try {
      const r = await fetch(`/api/events/${slug}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to cancel');
      onCancelled?.(slug);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card md-card">
      <div className="md-card-head">
        <h2 className="md-card-title">My upcoming events</h2>
        <a href="/events" className="md-card-action">Find more →</a>
      </div>
      {rows.length === 0 ? (
        <div className="md-empty">
          <IconCalendar size="lg" />
          <p>No events on your calendar yet.</p>
          <a href="/events" className="md-empty-cta">Browse what's on →</a>
        </div>
      ) : (
        <ul className="md-list" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
          {rows.map((e) => {
            const palette = REGISTRATION_STYLES[e.status] ?? REGISTRATION_STYLES.registered;
            const canCancel = e.status === 'registered' || e.status === 'waitlisted';
            return (
              <li key={e.id} className="md-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="md-row-title">
                    {e.title}
                    {e.booked_by_name && (
                      <span
                        style={{
                          marginLeft: '.5rem',
                          background: 'oklch(0.94 0.03 250)', color: 'oklch(0.28 0.09 250)',
                          padding: '.1rem .45rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 500,
                          verticalAlign: 'middle',
                        }}
                        title={`This seat was booked and paid for by ${e.booked_by_name}`}
                      >
                        Booked by {e.booked_by_name}
                      </span>
                    )}
                  </div>
                  <div className="md-row-meta">
                    <span className="row gap-1"><IconCalendar size="sm" /> {formatDateTime(e.starts_at)}</span>
                    {Number(e.cpe_hours) > 0 && (
                      <span className="row gap-1"><IconAward size="sm" /> {Number(e.cpe_hours)} CPE</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <span className="badge" style={{ background: palette.bg, color: palette.fg }}>
                    {REGISTRATION_LABELS[e.status] ?? e.status}
                  </span>
                  <a
                    href={googleCalendarEventUrl({
                      title: e.title,
                      starts_at: e.starts_at,
                      ends_at: e.ends_at,
                      venue: e.venue,
                      cpe: Number(e.cpe_hours || 0),
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ padding: '.25rem .5rem', fontSize: '.75rem' }}
                    aria-label={`Add ${e.title} to my Google Calendar`}
                  >
                    <IconCalendar size="sm" /> Calendar
                  </a>
                  {canCancel && (
                    <Button
                      className="btn btn-ghost"
                      style={{ padding: '.25rem .5rem', fontSize: '.75rem', color: '#dc2626' }}
                      loading={busy === e.slug}
                      onClick={() => cancel(e.slug, e.title)}
                    >
                      {busy === e.slug ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── My room bookings ───────────────────────────────────────────────────
// Self-contained card — fetches /api/rooms/my-bookings on mount, lets the
// member cancel upcoming bookings inline. Hidden entirely when the user
// has no bookings to avoid a permanent empty state on the dashboard.
function MyRoomBookingsCard() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      const r = await fetch('/api/rooms/my-bookings', { credentials: 'include' });
      const j = await r.json();
      if (r.ok) setRows(j.rows ?? []);
      else setRows([]);
    } catch { setRows([]); }
  }
  useEffect(() => { load(); }, []);

  async function cancel(id, label) {
    const ok = await dialog.confirm({
      title: 'Cancel booking?',
      message: `Cancel your booking for ${label}?`,
      confirmText: 'Cancel booking',
      cancelText: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    setBusy(id);
    try {
      const r = await fetch(`/api/rooms/bookings/${id}/cancel`, {
        method: 'POST', credentials: 'include',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to cancel');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Don't render until we know. Avoids a flash of the "no bookings yet"
  // state on every page load.
  if (rows === null || rows.length === 0) return null;

  // Show upcoming (slot_start in the future) at the top; collapse older
  // history under a divider so the card stays compact.
  const now = Date.now();
  const upcoming = rows.filter((b) => new Date(b.slot_start).getTime() >= now && b.status !== 'cancelled');
  const recent   = rows.filter((b) => !upcoming.includes(b)).slice(0, 3);

  return (
    <div className="card md-card">
      <div className="md-card-head">
        <h2 className="md-card-title">My room bookings</h2>
        <a href="/book-room" className="md-card-action">Book a room →</a>
      </div>
      <ul className="md-list" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
        {upcoming.map((b) => (
          <li key={b.id} className="md-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="md-row-title">{b.room_name || 'Room'}</div>
              <div className="md-row-meta">
                <span>{formatDateTime(b.slot_start)} – {formatTimeOnly(b.slot_end)}</span>
                {b.purpose && <span className="muted-text" style={{ marginLeft: '.5rem' }}>· {b.purpose}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <span className="badge" style={{ background: BOOKING_STATUS_STYLES[b.status]?.bg, color: BOOKING_STATUS_STYLES[b.status]?.fg }}>
                {b.status}
              </span>
              <Button
                className="btn btn-ghost"
                style={{ padding: '.25rem .5rem', fontSize: '.75rem', color: '#dc2626' }}
                loading={busy === b.id}
                onClick={() => cancel(b.id, `${b.room_name} on ${formatDateTime(b.slot_start)}`)}
              >
                {busy === b.id ? 'Cancelling…' : 'Cancel'}
              </Button>
            </div>
          </li>
        ))}
        {recent.length > 0 && (
          <li style={{ padding: '.5rem 0 0', borderTop: upcoming.length ? '1px solid #e5e7eb' : 'none', marginTop: upcoming.length ? '.5rem' : 0 }}>
            <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Recent</div>
          </li>
        )}
        {recent.map((b) => (
          <li key={b.id} className="md-row" style={{ opacity: .65 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="md-row-title">{b.room_name || 'Room'}</div>
              <div className="md-row-meta">{formatDateTime(b.slot_start)}</div>
            </div>
            <span className="badge" style={{ background: BOOKING_STATUS_STYLES[b.status]?.bg, color: BOOKING_STATUS_STYLES[b.status]?.fg }}>
              {b.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BOOKING_STATUS_STYLES = {
  requested: { bg: '#fef3c7', fg: '#92400e' },
  confirmed: { bg: '#dcfce7', fg: '#065f46' },
  completed: { bg: '#f1f5f9', fg: '#334155' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b' },
};

function formatTimeOnly(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ─── Recent certificates ────────────────────────────────────────────────
// Past events the user attended that award CPE — one row per event with a
// "Download certificate" link to the PDF route. Empty state hidden.
function MyCertificatesCard({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card md-card">
      <div className="md-card-head">
        <h2 className="md-card-title">My certificates</h2>
        <span className="md-card-action" style={{ color: '#64748b', cursor: 'default' }}>{rows.length} available</span>
      </div>
      <ul className="md-list" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
        {rows.map((e) => (
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
            <a
              href={`/api/events/${e.slug}/certificate`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}
            >
              <IconDownload size="sm" /> Certificate
            </a>
          </li>
        ))}
      </ul>
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
        <a href="/events" className="md-card-action">All events →</a>
      </div>
      <ul className="md-list" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
        {rows.map((e) => (
          <li key={e.id} className="md-row md-row-link">
            <a href={`/events?slug=${e.slug}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', textDecoration: 'none', color: 'inherit' }}>
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
// Tile cover image with a graceful fallback when src is missing or the
// image fails to load (which it will for any mock-seeded cover_file_id
// that points at a non-existent storage path).
function LibraryCover({ src }) {
  const [failed, setFailed] = useState(!src);
  if (failed || !src) {
    return (
      <div className="md-library-cover-fallback">
        <IconFileText size="lg" />
      </div>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

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
        <a href="/my-library" className="md-card-action">Open library →</a>
      </div>
      {items.length === 0 ? (
        <div className="md-empty">
          <IconBookOpen size="lg" />
          <p>Nothing saved yet.</p>
          <a href="/resources" className="md-empty-cta">Browse resources →</a>
        </div>
      ) : (
        <div className="md-library-grid">
          {items.map((b) => (
            <a key={b.bookmark_id} href={`/resources/${b.resource_type === 'ejournal' ? 'journal' : 'papers'}/${b.slug}`} className="md-library-tile">
              <LibraryCover src={b.cover_url} />
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
  // `external` tiles open the official ICAI portals in a new tab. All three
  // statutory portals (UDIN, CPE, eServices) require ICAI SSP sign-in, so we
  // surface that on each tile to avoid surprising first-time users who land
  // on a login screen and assume our portal is broken.
  const items = [
    { Icon: IconShield,    title: 'Generate UDIN',          desc: 'Issue UDIN for signed documents on the official portal.', href: ICAI_LINKS.udin,        external: true, needsIcaiLogin: true },
    { Icon: IconBriefcase, title: 'COP services',           desc: 'COP renewal, restoration, surrender, firm registration.', href: ICAI_LINKS.copServices, external: true, needsIcaiLogin: true },
    { Icon: IconBriefcase, title: 'Job vacancies',          desc: 'Senior positions and openings posted by member firms.',   href: '/job-vacancies' },
    { Icon: IconHandshake, title: 'Contribute to CABF',     desc: 'Support members and families in distress.',              href: '/benevolent-fund' },
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
                {it.needsIcaiLogin && (
                  <span className="md-service-hint">ICAI SSP sign-in required</span>
                )}
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
          <div style={{ fontWeight: 600 }}>{withCAPrefix(user.name, user.primary_role)}</div>
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

// ─── Side: calendar subscription ────────────────────────────────────────
// Surfaces the user's personal calendar feed of registered events. Primary
// CTA opens Google Calendar in a new tab and adds the feed in-browser — no
// .ics download, no webcal:// handler prompt. The feed URL is still
// copyable for users on Apple / Outlook / other clients. Token-based —
// no DB write, rotates if JWT_SECRET changes.
function CalendarSubscriptionCard() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    if (data) return;
    try {
      const r = await fetch('/api/events/my-calendar-url', { credentials: 'include' });
      const j = await r.json();
      if (r.ok) setData(j);
    } catch { /* silent */ }
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* silent */ }
  }

  return (
    <div className="card md-card">
      <div className="md-card-head" style={{ cursor: 'pointer' }} onClick={() => { setOpen((o) => !o); load(); }}>
        <h2 className="md-card-title row gap-2">
          <IconCalendar size="sm" /> Calendar subscription
        </h2>
        <span className="md-card-action" aria-hidden>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div style={{ paddingTop: '.5rem' }}>
          <p className="muted-text" style={{ fontSize: '.8125rem', lineHeight: 1.5 }}>
            Sync every event you've registered for straight into your Google Calendar. New registrations show up automatically — no app install needed.
          </p>
          {!data ? (
            <p className="muted-text">Loading…</p>
          ) : (
            <>
              <a
                href={googleCalendarSubscribeUrl(data.url || data.webcal)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'flex', width: '100%', padding: '.55rem .75rem', fontSize: '.85rem', justifyContent: 'center', marginTop: '.65rem' }}
              >
                <IconCalendar size="sm" /> Open in Google Calendar
              </a>
              <button
                type="button"
                className="btn btn-outline"
                style={{ display: 'flex', width: '100%', padding: '.4rem .75rem', fontSize: '.78rem', justifyContent: 'center', marginTop: '.4rem' }}
                onClick={() => copy(data.url || data.webcal)}
                aria-label="Copy the raw feed URL for use with Apple Calendar, Outlook desktop, or other apps"
              >
                {copied ? '✓ Copied' : 'Copy feed URL (for Apple / Outlook)'}
              </button>
              <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.55rem' }}>
                Google Calendar opens in a new tab and asks once to add this branch calendar. Other apps: copy the URL above and paste it under "Subscribe to a calendar".
              </p>
            </>
          )}
        </div>
      )}
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
          <a href="/contact" className="btn btn-primary" style={{ padding: '.35rem .7rem', fontSize: '.78rem' }}>New grievance</a>
          <a href="/track-grievance" className="btn btn-outline" style={{ padding: '.35rem .7rem', fontSize: '.78rem' }}>Track ticket</a>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────
function MemberDashboardStyles() {
  return (
    <style>{`
      /* Light padding makes the cards feel cramped to non-tech members —
         restored to the standard .card padding so the dashboard breathes.
         Density savings are no longer needed now that the page is tabbed. */
      .md-dash .card { padding: 1.15rem; }
      .md-dash .md-card { padding: 1.15rem; }
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

      /* ── Tab strip ──────────────────────────────────────────────── *
         Replaced the JumpNav (anchor pills that scrolled the page) with
         real tabs that swap visible content. Less scroll, cleaner page,
         and the URL hash remembers which tab the user last visited. */
      .md-tabs {
        display: flex; gap: .25rem; overflow-x: auto;
        margin-top: 1.1rem; padding-bottom: 0;
        border-bottom: 1px solid var(--border);
        scrollbar-width: thin;
      }
      .md-tab {
        appearance: none; background: transparent;
        border: 0; border-bottom: 2px solid transparent;
        padding: .65rem 1rem; cursor: pointer;
        font-size: .85rem; font-weight: 600; color: var(--muted-foreground);
        white-space: nowrap;
        transition: color .15s ease, border-color .15s ease;
        border-radius: 0;
      }
      .md-tab:hover { color: var(--foreground); }
      .md-tab.is-active {
        color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .md-tab:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
        border-radius: .25rem;
      }
      .md-tab-body {
        margin-top: 1.25rem;
        display: flex; flex-direction: column; gap: 1rem;
      }
      /* Settings tab uses a 2-col grid on desktop so the four sidecards
         tile cleanly instead of stacking into a long column. */
      .md-tab-body-grid {
        margin-top: 1.25rem;
        display: grid; gap: 1rem;
        grid-template-columns: 1fr;
      }
      @media (min-width: 720px) {
        .md-tab-body-grid { grid-template-columns: 1fr 1fr; align-items: start; }
      }

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
        display: grid; gap: .75rem;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        margin-top: 1rem;
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
      .md-service-hint {
        display: inline-block; margin-top: .35rem;
        padding: .1rem .4rem;
        background: oklch(0.95 0.05 90);
        border: 1px solid oklch(0.85 0.08 90);
        border-radius: 999px;
        font-size: .6rem; color: oklch(0.42 0.13 70);
        font-weight: 600; letter-spacing: .02em;
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
