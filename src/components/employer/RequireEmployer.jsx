import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import { ShimmerPageBody } from '../ui/Shimmer';

// Gates every /employer/* page. Redirects unauthenticated users to /login
// and signed-in users without primary_role='Employer' to /dashboard.
// The deeper "do they actually have an employer_users row?" check happens
// server-side via the requireEmployer middleware — if it fails, all
// /api/employer/* calls return 403 and pages will show an error state.
export default function RequireEmployer({ children }) {
  const { user, loading, showToast } = useAuth();

  const isEmployer = !!user && user.role === 'Employer';

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isEmployer) {
      showToast?.('Employer access required', 'error');
      navigate('/dashboard');
    }
  }, [loading, user, isEmployer, showToast]);

  if (loading || !user || !isEmployer) {
    return <ShimmerPageBody cards={3} />;
  }

  return children;
}
