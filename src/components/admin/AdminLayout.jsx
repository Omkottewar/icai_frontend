import { useState } from 'react';
import { useRoute, navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { ShimmerStyles } from '../ui/Shimmer';
import {
  IconCalendar, IconUsers, IconAward, IconShield, IconBriefcase, IconHeart,
  IconFileText, IconSettings, IconArrowLeft, IconLogOut, IconMenu, IconX,
  IconCheckCircle, IconBookOpen, IconMapPin,
} from '../../icons';
import caIndiaLogo from '../../assets/CA India Logo.png';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', Icon: IconShield, exact: true },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/events', label: 'Events', Icon: IconCalendar },
      { to: '/admin/registrations', label: 'Registrations', Icon: IconCheckCircle },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/users', label: 'Users', Icon: IconUsers },
      { to: '/admin/cpe', label: 'CPE credits', Icon: IconAward, soon: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/approvals', label: 'Approvals', Icon: IconCheckCircle, soon: true },
      { to: '/admin/rooms', label: 'Rooms', Icon: IconMapPin, soon: true },
      { to: '/admin/bookings', label: 'Room bookings', Icon: IconBookOpen, soon: true },
      { to: '/admin/committees', label: 'Committees', Icon: IconShield },
    ],
  },
  {
    label: 'Forms',
    items: [
      { to: '/admin/checklist-templates', label: 'Checklist templates', Icon: IconCheckCircle },
    ],
  },
  {
    label: 'Site',
    items: [
      { to: '/admin/site-content',  label: 'Site content',  Icon: IconFileText },
      { to: '/admin/site-settings', label: 'Site settings', Icon: IconSettings },
      { to: '/admin/announcements', label: 'Announcements', Icon: IconBookOpen },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { to: '/admin/jobs', label: 'Job postings', Icon: IconBriefcase },
      { to: '/admin/cabf', label: 'CABF requests', Icon: IconHeart, soon: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/payments', label: 'Payments', Icon: IconFileText, soon: true },
      { to: '/admin/files', label: 'Files', Icon: IconFileText, soon: true },
    ],
  },
];

function isActive(routePath, to, exact) {
  if (exact) return routePath === to;
  return routePath === to || routePath.startsWith(to + '/');
}

export default function AdminLayout({ title, subtitle, actions, children }) {
  const route = useRoute();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {NAV_GROUPS.map((g) => (
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
