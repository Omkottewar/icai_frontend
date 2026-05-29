import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import { Shimmer, ShimmerStatTile, ShimmerStyles } from '../ui/Shimmer';

// Wraps every admin page. Redirects unauthenticated users to /login and
// non-admin users to /dashboard. The role check trusts `user.roles[].code`
// — populated by /api/auth/me which queries user_role_assignments directly.
export default function RequireAdmin({ children }) {
  const { user, loading, showToast } = useAuth();

  const isAdmin = !!user && Array.isArray(user.roles) && user.roles.some((r) => r.code === 'admin');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      showToast?.('Admin access required', 'error');
      navigate('/dashboard');
    }
  }, [loading, user, isAdmin, showToast]);

  if (loading || !user || !isAdmin) {
    return <AdminBootSkeleton />;
  }

  return children;
}

// Full-page shimmer shown while the auth check resolves. Mirrors the
// admin dashboard layout (stat-tile grid + recent-list) so the eventual
// content slots in without a layout shift.
function AdminBootSkeleton() {
  return (
    <div className="admin-boot">
      <ShimmerStyles />

      {/* Topbar mock */}
      <div className="admin-boot-topbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <Shimmer height="1.5rem" width="14rem" />
          <Shimmer height=".75rem" width="22rem" />
        </div>
        <Shimmer height="2.25rem" width="8rem" radius=".375rem" />
      </div>

      {/* Stat tile grid */}
      <div className="admin-boot-grid">
        {Array.from({ length: 6 }).map((_, i) => <ShimmerStatTile key={i} />)}
      </div>

      {/* Recent-events card */}
      <div className="admin-boot-card">
        <div className="admin-boot-card-head">
          <Shimmer height=".875rem" width="9rem" />
          <Shimmer height=".7rem" width="4rem" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-boot-row">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
              <Shimmer height=".875rem" width="55%" />
              <Shimmer height=".7rem" width="32%" />
            </div>
            <Shimmer height="1.1rem" width="4rem" radius="999px" />
          </div>
        ))}
      </div>

      <style>{`
        .admin-boot {
          min-height: 100vh; background: var(--background);
          padding: 2rem clamp(1rem, 4vw, 2.5rem);
          display: flex; flex-direction: column; gap: 1.5rem;
        }
        .admin-boot-topbar {
          display: flex; justify-content: space-between; align-items: flex-end;
          flex-wrap: wrap; gap: 1rem;
        }
        .admin-boot-grid {
          display: grid; gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .admin-boot-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: .5rem;
        }
        .admin-boot-card-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: .875rem 1.125rem; border-bottom: 1px solid var(--border);
        }
        .admin-boot-row {
          display: flex; justify-content: space-between; align-items: center; gap: 1rem;
          padding: .85rem 1.125rem; border-bottom: 1px solid var(--border);
        }
        .admin-boot-row:last-child { border-bottom: 0; }
      `}</style>
    </div>
  );
}
