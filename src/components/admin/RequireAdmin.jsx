import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate, useRoute } from '../../hooks/useRoute';
import { Shimmer, ShimmerStatTile, ShimmerStyles } from '../ui/Shimmer';

// Roles that should be allowed to open the /admin shell at all. Each one
// lands on a different home variant (see AdminDashboardPage's dispatcher),
// but they all enter through this gate. 'admin' is the catch-all global
// role (IT admin); the rest are office bearers who need their role-specific
// homepage rather than the generic member dashboard.
//
// Kept in sync with backend/server/auth/landingPath.ts — anything that
// redirects to /admin after login must also be allowed past this gate.
const ADMIN_GATE_ROLES = new Set([
  'admin',
  'branch_chairman',
  'branch_vice_chairman',
  'branch_secretary',
  'branch_treasurer',
  'committee_chairman',
  'accountant',
  'branch_manager',
]);

// Wraps every admin page. Redirects unauthenticated users to /login and
// users without any office-bearer / admin role to /dashboard.
//
// Role-revocation hardening: we force a `/api/auth/me` refresh on mount
// AND on every admin route change so a revoked role is caught before
// rendering admin content for it. Crucially, only the FIRST verify (on
// mount) gates the UI with a boot skeleton — subsequent route changes
// inside /admin re-fetch in the background but keep the existing admin
// shell visible. Without that distinction every sidebar click would flash
// a full-page skeleton because Suspense + the previous "verified=false on
// every nav" combo made navigation feel like a full reload.
//
// If the background refresh reveals the user lost the role, the
// `isAllowed` effect below picks it up and redirects to /dashboard.
export default function RequireAdmin({ children }) {
  const { user, loading, refresh, showToast } = useAuth();
  const route = useRoute();
  const [verified, setVerified] = useState(false);

  // Re-fetch /me on each admin route change to catch role revocations.
  // We *don't* flip verified back to false here — keeping the shell
  // visible during the background refresh is the whole point.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setVerified(true);
    })();
    return () => { cancelled = true; };
  }, [route.path, refresh]);

  const isAllowed = !!user
    && Array.isArray(user.roles)
    && user.roles.some((r) => ADMIN_GATE_ROLES.has(r.code));

  useEffect(() => {
    if (loading || !verified) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isAllowed) {
      showToast?.('Admin access required', 'error');
      navigate('/dashboard');
    }
  }, [loading, verified, user, isAllowed, showToast]);

  if (loading || !verified || !user || !isAllowed) {
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
