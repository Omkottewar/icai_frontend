import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate, useRoute } from '../../hooks/useRoute';
import { ShimmerPageBody } from '../ui/Shimmer';

// Gates every /employer/* page. Same revocation-hardening pattern as
// RequireAdmin — we re-fetch /api/auth/me on mount and on route change
// before trusting the cached user state. If the admin demotes the
// employer-staff link between page loads, the user is bounced before
// the page renders.
//
// The deeper "do they actually have an employer_users row?" check still
// happens server-side via the requireEmployer middleware — if it fails,
// all /api/employer/* calls return 403 and the apiCache will fire an
// `auth:revalidate` event that AuthContext picks up.
export default function RequireEmployer({ children }) {
  const { user, loading, refresh, showToast } = useAuth();
  const route = useRoute();
  const [verified, setVerified] = useState(false);

  // Same shape as RequireAdmin: refresh /me on each route change for
  // role-revocation, but only the first verify gates the UI so navigating
  // between /employer/* pages doesn't flash a full-page skeleton.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setVerified(true);
    })();
    return () => { cancelled = true; };
  }, [route.path, refresh]);

  const isEmployer = !!user && user.role === 'Employer';

  useEffect(() => {
    if (loading || !verified) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isEmployer) {
      showToast?.('Employer access required', 'error');
      navigate('/dashboard');
    }
  }, [loading, verified, user, isEmployer, showToast]);

  if (loading || !verified || !user || !isEmployer) {
    return <ShimmerPageBody cards={3} />;
  }

  return children;
}
