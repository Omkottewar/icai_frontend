import { createContext, memo, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useRoute } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { useAdminHome } from '../../hooks/useAdminHome';
import { ShimmerStyles } from '../ui/Shimmer';
import {
  IconCalendar, IconUsers, IconAward, IconShield, IconBriefcase, IconHeart,
  IconFileText, IconSettings, IconArrowLeft, IconLogOut, IconMenu, IconX,
  IconCheckCircle, IconBookOpen, IconMapPin, IconGraduationCap, IconHandshake,
} from '../../icons';
import caIndiaLogo from '../../assets/CA India Logo.png';

// ─── Why this component exists ───────────────────────────────────────────
//
// Before this file existed, every admin page rendered its own
// <AdminLayout> at its root. The sidebar + topbar were technically the
// same component but lived INSIDE the page's render output, so when the
// user clicked from /admin to /admin/events React saw the parent
// component change (EventsAdminPage vs DashboardPage) and unmounted +
// re-mounted the whole admin layout. The sidebar literally rebuilt its
// DOM on every click — that's why navigation felt like "the whole page
// reloads."
//
// AdminShell hoists the layout ABOVE the page. AppShell renders
// <AdminShell>{lazyAdminPage}</AdminShell> once when the user enters
// /admin, and subsequent admin-to-admin navigations only swap the lazy
// child. The sidebar and topbar frame stay mounted; only the content
// region changes.
//
// Each admin page still uses the familiar <AdminLayout title=... > API —
// see AdminLayout.jsx for the thin shim that publishes title/subtitle/
// actions to the persistent shell via the context below.

const ROLE_ADMIN     = 'admin';
const ROLE_CHAIRMAN  = 'chairman';
const ROLE_TREASURER = 'treasurer';
const ROLE_COMMITTEE = 'committee_chairman';
const ROLE_WICASA    = 'wicasa';
const ROLE_ACCOUNTANT = 'accountant';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', Icon: IconShield, exact: true },
    ],
  },
  {
    label: 'Programmes',
    items: [
      { to: '/admin/events',        label: 'Events',        Icon: IconCalendar,     roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE, ROLE_WICASA] },
      { to: '/admin/registrations', label: 'Registrations', Icon: IconCheckCircle,  roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE, ROLE_TREASURER, ROLE_WICASA] },
      { to: '/admin/cpe',           label: 'CPE credits',   Icon: IconAward, soon: true, roles: [ROLE_CHAIRMAN] },
    ],
  },
  {
    label: 'Student wing',
    items: [
      { to: '/admin/mock-tests',            label: 'Mock tests',    Icon: IconGraduationCap, roles: [ROLE_WICASA] },
      { to: '/admin/mentorship',            label: 'Mentorship',    Icon: IconHandshake,     roles: [ROLE_WICASA] },
      { to: '/admin/articleship-matches',   label: 'Articleship matching', Icon: IconHandshake, roles: [ROLE_WICASA] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/bills',          label: 'Bills',           Icon: IconFileText, roles: [ROLE_TREASURER, ROLE_ACCOUNTANT] },
      { to: '/admin/refunds',        label: 'Refunds',         Icon: IconFileText, roles: [ROLE_TREASURER] },
      { to: '/admin/iut-transfers',  label: 'IUT transfers',   Icon: IconFileText, roles: [ROLE_TREASURER] },
      { to: '/admin/payments',       label: 'Payments',        Icon: IconFileText, soon: true, roles: [ROLE_TREASURER, ROLE_ACCOUNTANT] },
      { to: '/admin/cabf',           label: 'CABF requests',   Icon: IconHeart,    soon: true, roles: [ROLE_TREASURER] },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/users',         label: 'Users',       Icon: IconUsers, roles: [] /* admin-only */ },
      { to: '/admin/committees',    label: 'Committees',  Icon: IconShield, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/approvals',  label: 'Approvals',     Icon: IconCheckCircle, soon: true, roles: [ROLE_CHAIRMAN, ROLE_TREASURER] },
      { to: '/admin/rooms',      label: 'Rooms',         Icon: IconMapPin,      soon: true, roles: [ROLE_CHAIRMAN] },
      { to: '/admin/bookings',   label: 'Room bookings', Icon: IconBookOpen,    soon: true, roles: [ROLE_CHAIRMAN] },
      { to: '/admin/grievances',         label: 'Grievances',         Icon: IconHandshake, roles: [ROLE_CHAIRMAN] },
      { to: '/admin/grievance-routes',   label: 'Grievance routing',  Icon: IconSettings,  roles: [] /* admin-only */ },
      { to: '/admin/checklist-templates', label: 'Checklist templates', Icon: IconCheckCircle, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE] },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/site-content',         label: 'Site content',         Icon: IconFileText, roles: [ROLE_CHAIRMAN] },
      { to: '/admin/announcements',        label: 'Announcements',        Icon: IconBookOpen, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE, ROLE_WICASA] },
      { to: '/admin/resources',            label: 'Resources & quizzes',  Icon: IconBookOpen, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE] },
      { to: '/admin/paper-presentations',  label: 'Paper presentations',  Icon: IconFileText, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE] },
      { to: '/admin/newsletters',          label: 'Newsletter',           Icon: IconBookOpen, roles: [ROLE_CHAIRMAN] },
      { to: '/admin/gallery',              label: 'Photo gallery',        Icon: IconFileText, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE] },
      { to: '/admin/office-bearers',       label: 'Office bearers',       Icon: IconUsers,    roles: [ROLE_CHAIRMAN] },
      { to: '/admin/annual-reports',       label: 'Annual reports',       Icon: IconFileText, roles: [ROLE_CHAIRMAN] },
      { to: '/admin/site-settings',        label: 'Site settings',        Icon: IconSettings, roles: [] /* admin-only */ },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { to: '/admin/jobs', label: 'Job postings', Icon: IconBriefcase, roles: [] /* admin-only */ },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/files',                  label: 'Files',                  Icon: IconFileText, soon: true, roles: [] /* admin-only */ },
      { to: '/admin/notifications-log',      label: 'Notifications log',      Icon: IconBookOpen, roles: [] /* admin-only */ },
    ],
  },
];

function activeRoles(homeData) {
  const r = homeData?.roles ?? {};
  const out = new Set();
  if (r.is_admin)              out.add(ROLE_ADMIN);
  if (r.is_branch_chairman)    out.add(ROLE_CHAIRMAN);
  if (r.is_vice_chairman)      out.add(ROLE_CHAIRMAN);
  if (r.is_secretary)          out.add(ROLE_CHAIRMAN);
  if (r.is_treasurer)          out.add(ROLE_TREASURER);
  if (r.is_accountant)         out.add(ROLE_ACCOUNTANT);
  if (r.is_wicasa)             out.add(ROLE_WICASA);
  if ((r.committee_chairman_of ?? []).length > 0) out.add(ROLE_COMMITTEE);
  return out;
}

function isVisible(item, userRoles) {
  if (userRoles.has(ROLE_ADMIN)) return true;
  if (!item.roles) return true;
  if (item.roles.length === 0) return false;
  return item.roles.some((r) => userRoles.has(r));
}

function isActive(routePath, to, exact) {
  if (exact) return routePath === to;
  return routePath === to || routePath.startsWith(to + '/');
}

// ─── Header context ──────────────────────────────────────────────────────
//
// Each admin page calls useAdminHeader({ title, subtitle, actions }) via
// the <AdminLayout> shim. The shell subscribes here and renders the
// returned values in the topbar without re-mounting.

const AdminHeaderContext = createContext({ setHeader: () => {} });

export function useAdminHeader(header) {
  const { setHeader } = useContext(AdminHeaderContext);
  // useLayoutEffect (not useEffect) so the topbar paint reflects the new
  // page's title in the same frame as the page's content paint —
  // otherwise there's a perceivable flash of the previous page's title.
  useLayoutEffect(() => {
    setHeader({
      title:    header.title,
      subtitle: header.subtitle,
      actions:  header.actions,
    });
    // Note: no cleanup. The next page's effect will overwrite this header
    // synchronously on its first commit, so clearing here would just race
    // and cause an empty topbar between page changes.
  }, [setHeader, header.title, header.subtitle, header.actions]);
}

// ─── Sidebar (memoized) ──────────────────────────────────────────────────
//
// React.memo'd because the sidebar's content only depends on the active
// roles and the current path. Without this, every header re-render
// (caused by useAdminHeader's setState above) would also re-render the
// 60+ DOM nodes that make up the nav.
const Sidebar = memo(function Sidebar({
  visibleGroups, routePath, user, onLogout, mobileOpen, onCloseMobile,
}) {
  return (
    <aside className={'admin-sidebar' + (mobileOpen ? ' is-open' : '')}>
      <div className="admin-sidebar-head">
        <a href="#/" className="row gap-2" style={{ color: 'white', textDecoration: 'none' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '.375rem', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '.2rem' }}>
            <img src={caIndiaLogo} alt="CA India" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '.875rem', fontWeight: 700, lineHeight: 1.1 }}>Nagpur Branch</div>
            <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.6)' }}>Admin Console</div>
          </div>
        </a>
      </div>

      <nav className="admin-sidebar-nav">
        {visibleGroups.map((g) => (
          <div key={g.label} className="admin-nav-group">
            <div className="admin-nav-group-label">{g.label}</div>
            {g.items.map((it) => {
              const active = isActive(routePath, it.to, it.exact);
              return (
                <a
                  key={it.to}
                  href={'#' + it.to}
                  className={'admin-nav-link' + (active ? ' is-active' : '')}
                  onClick={onCloseMobile}
                >
                  <it.Icon size="sm" />
                  <span>{it.label}</span>
                  {it.soon && <span className="admin-soon-badge">Soon</span>}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-foot">
        {user && (
          <div className="admin-user-chip">
            <span className="avatar-circle" style={{ width: 32, height: 32 }}>
              {(user.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.6)' }}>Admin</div>
            </div>
          </div>
        )}
        <a href="#/" className="admin-foot-link">
          <IconArrowLeft size="sm" /> Back to site
        </a>
        <button className="admin-foot-link" onClick={onLogout} style={{ color: '#fca5a5' }}>
          <IconLogOut size="sm" /> Sign out
        </button>
      </div>
    </aside>
  );
});

// ─── Topbar (memoized on header object identity) ─────────────────────────
const Topbar = memo(function Topbar({ title, subtitle, actions, mobileOpen, onToggleMobile }) {
  return (
    <div className="admin-topbar">
      <button className="admin-mobile-toggle" onClick={onToggleMobile} aria-label="Toggle menu">
        {mobileOpen ? <IconX /> : <IconMenu />}
      </button>
      <div style={{ flex: 1 }}>
        {title && <h1 className="admin-title">{title}</h1>}
        {subtitle && <div className="admin-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="row gap-2">{actions}</div>}
    </div>
  );
});

// ─── The shell ───────────────────────────────────────────────────────────
export default function AdminShell({ children }) {
  const route = useRoute();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [header, setHeader] = useState({ title: null, subtitle: null, actions: null });

  // useAdminHome is already cached + polled — calling it here doesn't add
  // network cost. We use it to filter the sidebar by role.
  const { data: homeData } = useAdminHome();

  // Compute visible groups once per role change instead of every render.
  // userRoles is a Set — we memo on the role-codes string so changes to
  // the homeData object identity don't bust us.
  const userRoles = useMemo(() => activeRoles(homeData), [homeData]);
  const roleKey = useMemo(() => Array.from(userRoles).sort().join('|'), [userRoles]);
  const visibleGroups = useMemo(() => (
    NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((it) => isVisible(it, userRoles)) }))
      .filter((g) => g.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [roleKey]);

  // Stable context value so pages don't re-render due to provider identity.
  const headerCtx = useMemo(() => ({ setHeader }), []);

  return (
    <AdminHeaderContext.Provider value={headerCtx}>
      <div className="admin-shell">
        <Sidebar
          visibleGroups={visibleGroups}
          routePath={route.path}
          user={user}
          onLogout={logout}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main className="admin-main">
          <Topbar
            title={header.title}
            subtitle={header.subtitle}
            actions={header.actions}
            mobileOpen={mobileOpen}
            onToggleMobile={() => setMobileOpen((o) => !o)}
          />
          <div className="admin-content">
            {children}
            <ShimmerStyles />
          </div>
        </main>
      </div>
      <AdminShellStyles />
    </AdminHeaderContext.Provider>
  );
}

// Styles extracted from the old AdminLayout. Same selectors so the
// per-page CSS doesn't have to change.
function AdminShellStyles() {
  return (
    <style>{`
      .admin-shell {
        display: grid; grid-template-columns: 260px 1fr;
        min-height: 100vh; background: var(--background);
      }
      .admin-sidebar {
        background: #0f172a; color: white;
        display: flex; flex-direction: column;
        padding: 1.125rem 0;
        position: sticky; top: 0; height: 100vh; overflow-y: auto;
      }
      .admin-sidebar-head { padding: 0 1rem 1.125rem; border-bottom: 1px solid rgba(255,255,255,.08); }
      .admin-sidebar-nav { flex: 1; padding: .875rem 0; overflow-y: auto; }
      .admin-nav-group { padding: 0 .625rem; margin-bottom: 1rem; }
      .admin-nav-group-label {
        font-size: .65rem; text-transform: uppercase; letter-spacing: .08em;
        font-weight: 700; color: rgba(255,255,255,.45); padding: 0 .625rem .375rem;
      }
      .admin-nav-link {
        display: flex; align-items: center; gap: .625rem;
        padding: .5rem .625rem; border-radius: .375rem;
        color: rgba(255,255,255,.78); font-size: .8125rem; font-weight: 500;
        text-decoration: none; transition: background .12s, color .12s;
        position: relative;
      }
      .admin-nav-link:hover { background: rgba(255,255,255,.05); color: white; }
      .admin-nav-link.is-active { background: rgba(255,255,255,.08); color: white; font-weight: 600; }
      .admin-soon-badge {
        margin-left: auto; font-size: .6rem;
        padding: .05rem .35rem; border-radius: 999px;
        background: rgba(255,255,255,.08); color: rgba(255,255,255,.7);
      }
      .admin-sidebar-foot {
        padding: 1rem; border-top: 1px solid rgba(255,255,255,.08);
        display: flex; flex-direction: column; gap: .375rem;
      }
      .admin-user-chip {
        display: flex; align-items: center; gap: .5rem;
        padding: .375rem; margin-bottom: .375rem;
      }
      .admin-foot-link {
        display: flex; align-items: center; gap: .5rem;
        padding: .425rem .5rem; border-radius: .375rem;
        font-size: .8125rem; color: rgba(255,255,255,.65);
        text-decoration: none; background: transparent; border: 0; cursor: pointer; text-align: left;
      }
      .admin-foot-link:hover { color: white; background: rgba(255,255,255,.05); }

      .admin-main { display: flex; flex-direction: column; min-width: 0; min-height: 100vh; }
      .admin-topbar {
        display: flex; align-items: center; gap: 1rem;
        padding: 1.125rem clamp(1rem, 4vw, 2rem);
        border-bottom: 1px solid var(--border);
        background: white;
      }
      .admin-mobile-toggle {
        display: none;
        background: transparent; border: 0; padding: .375rem;
        color: var(--foreground); cursor: pointer;
      }
      .admin-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
      .admin-subtitle { font-size: .8125rem; color: var(--muted-foreground); margin-top: .15rem; }
      .admin-content { padding: clamp(1rem, 3vw, 2rem); flex: 1; }

      @media (max-width: 900px) {
        .admin-shell { grid-template-columns: 1fr; }
        .admin-sidebar {
          position: fixed; inset: 0 30% 0 0; z-index: 60;
          transform: translateX(-100%); transition: transform .2s ease;
          height: 100vh;
        }
        .admin-sidebar.is-open { transform: translateX(0); }
        .admin-mobile-toggle { display: inline-flex; }
      }
    `}</style>
  );
}
