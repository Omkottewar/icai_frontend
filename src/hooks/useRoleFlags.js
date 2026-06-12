import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

// Roles that can enter the /admin shell. Mirrors the gate in
// components/admin/RequireAdmin.jsx — anyone holding any of these gets
// the office-bearer treatment (admin-cta-card on the dashboard, "your
// dashboard" link in the avatar menu, etc.).
const OFFICE_BEARER_CODES = [
  'admin',
  'branch_chairman',
  'branch_vice_chairman',
  'branch_secretary',
  'branch_treasurer',
  'committee_chairman',
  'accountant',
  'branch_manager',
];

// Single source of truth for role checks across the UI.
// Add new flags here as the dashboard / nav gets more role-aware.
export function useRoleFlags() {
  const { user } = useAuth();
  return useMemo(() => {
    const codes = new Set((user?.roles ?? []).map((r) => r.code));

    // Pick a single "primary office-bearer code" for label resolution.
    // Order is most-specific to least-specific so a chairman who also
    // happens to be 'admin' sees the chairman label (their day-job),
    // not the generic "Admin console".
    let officeBearerCode = null;
    for (const c of ['branch_treasurer', 'branch_chairman', 'branch_vice_chairman',
                     'branch_secretary', 'committee_chairman', 'accountant',
                     'branch_manager', 'admin']) {
      if (codes.has(c)) { officeBearerCode = c; break; }
    }

    return {
      isAdmin:              codes.has('admin'),
      isBranchChairman:     codes.has('branch_chairman'),
      isCommitteeChairman:  codes.has('committee_chairman'),
      isTreasurer:          codes.has('branch_treasurer'),
      isAccountant:         codes.has('accountant'),
      isMcm:                codes.has('mcm'),
      isOfficeBearer:       OFFICE_BEARER_CODES.some((c) => codes.has(c)),
      officeBearerCode,
      codes,
    };
  }, [user]);
}
