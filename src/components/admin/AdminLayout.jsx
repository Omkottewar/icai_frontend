import { useState } from 'react';
import { useRoute, navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { useAdminHome } from '../../hooks/useAdminHome';
import { ShimmerStyles } from '../ui/Shimmer';
import {
  IconCalendar, IconUsers, IconAward, IconShield, IconBriefcase, IconHeart,
  IconFileText, IconSettings, IconArrowLeft, IconLogOut, IconMenu, IconX,
  IconCheckCircle, IconBookOpen, IconMapPin, IconGraduationCap, IconHandshake,
  IconSparkles,
} from '../../icons';
import caIndiaLogo from '../../assets/CA India Logo.png';

// Each nav item carries a `roles` array — the persona codes that should see
// it. 'admin' is implicitly added everywhere (IT admin sees the kitchen sink).
// Empty / missing `roles` means "visible to all admins".
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
      { to: '/admin', label: 'Dashboard', Icon: IconShield, exact: true }, // everyone
    ],
  },
  {
    label: 'Programmes',
    items: [
      { to: '/admin/events',        label: 'Events',        Icon: IconCalendar,     roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE, ROLE_WICASA] },
      { to: '/admin/registrations', label: 'Registrations', Icon: IconCheckCircle,  roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE, ROLE_TREASURER, ROLE_WICASA] },
      { to: '/admin/cpe',           label: 'CPE credits',   Icon: IconAward, soon: true,                  roles: [ROLE_CHAIRMAN] },
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
      { to: '/admin/pragyaan',               label: 'Pragyaan',               Icon: IconSparkles, roles: [ROLE_CHAIRMAN, ROLE_COMMITTEE] },
      { to: '/admin/files',                  label: 'Files',                  Icon: IconFileText, soon: true, roles: [] /* admin-only */ },
      { to: '/admin/notifications-log',      label: 'Notifications log',      Icon: IconBookOpen, roles: [] /* admin-only */ },
    ],
  },
];

// Decide which role-keys to use for filtering the sidebar. The home endpoint
// returns explicit flags — we map them onto the ROLE_* constants used above.
function activeRoles(homeData) {
  const r = homeData?.roles ?? {};
  const out = new Set();
  if (r.is_admin)              out.add(ROLE_ADMIN);
  if (r.is_branch_chairman)    out.add(ROLE_CHAIRMAN);
  if (r.is_vice_chairman)      out.add(ROLE_CHAIRMAN);   // VC sees chairman's nav
  if (r.is_secretary)          out.add(ROLE_CHAIRMAN);
  if (r.is_treasurer)          out.add(ROLE_TREASURER);
  if (r.is_accountant)         out.add(ROLE_ACCOUNTANT);
  if (r.is_wicasa)             out.add(ROLE_WICASA);
  if ((r.committee_chairman_of ?? []).length > 0) out.add(ROLE_COMMITTEE);
  return out;
}

// An item is visible if:
//   - the user has the `admin` role (everything visible), OR
//   - the item has no `roles` array (visible to everyone), OR
//   - the user's active roles intersect with the item's `roles`.
function isVisible(item, userRoles) {
  if (userRoles.has(ROLE_ADMIN)) return true;
  if (!item.roles) return true;
  if (item.roles.length === 0) return false;  // admin-only
  return item.roles.some((r) => userRoles.has(r));
}

function isActive(routePath, to, exact) {
  if (exact) return routePath === to;
  return routePath === to || routePath.startsWith(to + '/');
}

export default function AdminLayout({ title, subtitle, actions, children }) {
  const route = useRoute();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Pull the role flags from the home endpoint so we can filter the nav.
  // The hook is cached + polled, so AdminLayout doesn't trigger duplicate
  // fetches — the dashboard page is reading the same data.
  const { data: homeData } = useAdminHome();
  const userRoles = activeRoles(homeData);

  // Hide entire groups whose items are all filtered out. Keeps the sidebar
  // tidy for users with only a few roles.
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => isVisible(it, userRoles)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="admin-shell">
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
                const active = isActive(route.path, it.to, it.exact);
                return (
                  <a
                    key={it.to}
                    href={'#' + it.to}
                    className={'admin-nav-link' + (active ? ' is-active' : '')}
                    onClick={() => setMobileOpen(false)}
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
          <button className="admin-foot-link" onClick={logout} style={{ color: '#fca5a5' }}>
            <IconLogOut size="sm" /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <button className="admin-mobile-toggle" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
          <div style={{ flex: 1 }}>
            {title && <h1 className="admin-title">{title}</h1>}
            {subtitle && <div className="admin-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="row gap-2">{actions}</div>}
        </div>

        <div className="admin-content">
          {children}
          <ShimmerStyles />
        </div>
      </main>

      <style>{`
        .admin-shell { display: flex; min-height: 100vh; background: var(--background); }
        .admin-sidebar {
          width: 240px; flex-shrink: 0; background: #0f172a; color: white;
          display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
        }
        .admin-sidebar-head { padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); }
        .admin-sidebar-nav { flex: 1; overflow-y: auto; padding: .75rem .5rem; }
        .admin-nav-group { margin-bottom: 1rem; }
        .admin-nav-group-label {
          font-size: .6875rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: .08em; color: rgba(255,255,255,.45);
          padding: .25rem .75rem .375rem;
        }
        .admin-nav-link {
          display: flex; align-items: center; gap: .625rem;
          padding: .5rem .75rem; border-radius: .375rem;
          font-size: .8125rem; font-weight: 500; color: rgba(255,255,255,.78);
          text-decoration: none; transition: background .12s, color .12s;
        }
        .admin-nav-link:hover { background: rgba(255,255,255,.06); color: white; }
        .admin-nav-link.is-active { background: rgba(255,255,255,.12); color: white; font-weight: 600; }
        .admin-soon-badge {
          margin-left: auto; font-size: .625rem; padding: .1rem .375rem;
          border-radius: 999px; background: rgba(255,255,255,.08);
          color: rgba(255,255,255,.55); font-weight: 600;
        }
        .admin-sidebar-foot {
          padding: .75rem; border-top: 1px solid rgba(255,255,255,.08);
          display: flex; flex-direction: column; gap: .25rem;
        }
        .admin-user-chip { display: flex; gap: .5rem; align-items: center; padding: .5rem; }
        .admin-foot-link {
          display: flex; align-items: center; gap: .5rem;
          padding: .4rem .5rem; border-radius: .25rem;
          font-size: .8125rem; color: rgba(255,255,255,.7);
          background: none; border: 0; cursor: pointer; text-align: left;
        }
        .admin-foot-link:hover { background: rgba(255,255,255,.06); color: white; }
        .admin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .admin-topbar {
          display: flex; align-items: center; gap: 1rem;
          padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
          background: var(--card); position: sticky; top: 0; z-index: 10;
        }
        .admin-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .admin-subtitle { font-size: .8125rem; color: var(--muted-foreground); }
        .admin-content { padding: 1.5rem; max-width: 1280px; width: 100%; }
        .admin-mobile-toggle {
          display: none; background: transparent; border: 1px solid var(--border);
          padding: .375rem .5rem; border-radius: .375rem;
        }
        @media (max-width: 900px) {
          .admin-sidebar {
            position: fixed; top: 0; bottom: 0; left: 0; z-index: 50;
            transform: translateX(-100%); transition: transform .2s;
          }
          .admin-sidebar.is-open { transform: translateX(0); }
          .admin-mobile-toggle { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}
