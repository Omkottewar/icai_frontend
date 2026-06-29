import { useRoute, navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { IconBriefcase, IconUser, IconCalendar, IconLogOut } from '../../icons';

// Two-pane layout used by every /employer/* page. Sidebar on the left,
// page content on the right. Mobile-friendly: sidebar collapses below
// 720px (CSS-only, no JS).
export default function EmployerLayout({ title, subtitle, children, actions }) {
  const route = useRoute();
  const { logout, user } = useAuth();

  const NAV = [
    { to: '/employer',           label: 'Dashboard',    Icon: IconBriefcase },
    { to: '/employer/postings',  label: 'My postings',  Icon: IconCalendar  },
    { to: '/employer/profile',   label: 'Company',      Icon: IconUser      },
  ];

  return (
    <div className="emp-shell">
      <aside className="emp-sidebar">
        <div className="emp-sidebar-head">
          <div style={{ fontWeight: 700 }}>{user?.name?.split(' ')[0] ?? 'Employer'}</div>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>{user?.email}</div>
        </div>
        <nav className="emp-nav">
          {NAV.map((n) => (
            <a
              key={n.to}
              href={n.to}
              className={'emp-nav-item' + (route.path === n.to ? ' active' : '')}
            >
              <n.Icon size="sm" /> {n.label}
            </a>
          ))}
          <button type="button" onClick={logout} className="emp-nav-item emp-nav-logout">
            <IconLogOut size="sm" /> Sign out
          </button>
        </nav>
      </aside>

      <main className="emp-main">
        <div className="emp-topbar">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{title}</h1>
            {subtitle && <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem' }}>{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>{actions}</div>
        </div>
        {children}
      </main>

      <style>{`
        .emp-shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; background: var(--background); }
        .emp-sidebar { border-right: 1px solid var(--border); background: var(--card, #fff); padding: 1.25rem 1rem; display: flex; flex-direction: column; gap: 1rem; }
        .emp-sidebar-head { padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
        .emp-nav { display: flex; flex-direction: column; gap: .25rem; }
        .emp-nav-item { display: flex; align-items: center; gap: .5rem; padding: .5rem .75rem; border-radius: .375rem; color: var(--foreground); text-decoration: none; font-size: .9rem; background: none; border: none; cursor: pointer; text-align: left; }
        .emp-nav-item:hover { background: var(--muted, #f1f5f9); }
        .emp-nav-item.active { background: var(--primary, #1e40af); color: #fff; }
        .emp-nav-logout { margin-top: 1rem; color: #b91c1c; }
        .emp-main { padding: 2rem clamp(1rem, 4vw, 2.5rem); display: flex; flex-direction: column; gap: 1.5rem; max-width: 1200px; }
        .emp-topbar { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; }
        @media (max-width: 720px) {
          .emp-shell { grid-template-columns: 1fr; }
          .emp-sidebar { border-right: none; border-bottom: 1px solid var(--border); }
          .emp-nav { flex-direction: row; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
