import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

// Single source of truth for role checks across the UI.
// Add new flags here as the dashboard / nav gets more role-aware.
export function useRoleFlags() {
  const { user } = useAuth();
  return useMemo(() => {
    const codes = new Set((user?.roles ?? []).map((r) => r.code));
    return {
      isAdmin:              codes.has('admin'),
      isBranchChairman:     codes.has('branch_chairman'),
      isCommitteeChairman:  codes.has('committee_chairman'),
      isMcm:                codes.has('mcm'),
      codes,
    };
  }, [user]);
}
