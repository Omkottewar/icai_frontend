import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { useAdminHome } from '../../hooks/useAdminHome';
import { navigate } from '../../hooks/useRoute';
import { ShimmerStatTile } from '../../components/ui/Shimmer';
import ChairmanHome from '../../components/admin/home/ChairmanHome';
import TreasurerHome from '../../components/admin/home/TreasurerHome';
import CommitteeChairmanHome from '../../components/admin/home/CommitteeChairmanHome';
import SysAdminHome from '../../components/admin/home/SysAdminHome';
import WicasaHome from '../../components/admin/home/WicasaHome';
import AccountantHome from '../../components/admin/home/AccountantHome';

// Role-aware admin landing page.
//
// The server (/api/admin/home) decides which homepage variant to render based
// on the user's most-specific role assignment. We always render *something* —
// 'sysadmin' is the fallback for plain admins / IT staff and matches the
// pre-refactor dashboard.
//
// Why server-driven? Because the same data shape needs to feed every variant
// (inbox items, stats, role-scoped lists) and we want one place to evolve the
// "what does this role see" rules.

const VARIANT_COMPONENT = {
  chairman:           ChairmanHome,
  treasurer:          TreasurerHome,
  committee_chairman: CommitteeChairmanHome,
  wicasa:             WicasaHome,
  accountant:         AccountantHome,
  sysadmin:           SysAdminHome,
};

const VARIANT_LABELS = {
  chairman:           { title: 'Branch Chairman',     subtitle: 'Your decisions & content for the branch.' },
  treasurer:          { title: 'Branch Treasurer',    subtitle: 'Approvals, refunds, and the financial pulse of the branch.' },
  committee_chairman: { title: 'Committee Chairman',  subtitle: "Your committee's events, approvals, and tools." },
  wicasa:             { title: 'WICASA Chairman',     subtitle: "Student events, mock tests, mentorship, and articleship matchmaking." },
  accountant:         { title: 'Accountant',          subtitle: 'Record bills, attach documents, and submit for treasurer approval.' },
  sysadmin:           { title: 'Admin dashboard',     subtitle: 'Operational snapshot of the branch' },
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { data, loading } = useAdminHome();

  // While the home payload is in flight, render a generic shimmer that fits
  // every variant. We deliberately don't pick a variant from the client side —
  // the server is the authority, and showing the wrong skeleton then swapping
  // would be jarring.
  if (loading || !data) {
    return (
      <AdminLayout title="Loading…" subtitle="">
        <div className="boot-grid">
          {Array.from({ length: 6 }).map((_, i) => <ShimmerStatTile key={i} />)}
        </div>
        <style>{`
          .boot-grid {
            display: grid; gap: 1rem;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
        `}</style>
      </AdminLayout>
    );
  }

  const variant = data.variant in VARIANT_COMPONENT ? data.variant : 'sysadmin';
  const Component = VARIANT_COMPONENT[variant];
  const labels = VARIANT_LABELS[variant];

  return (
    <AdminLayout
      title={labels.title}
      subtitle={labels.subtitle}
      actions={
        variant === 'sysadmin' ? (
          <button className="btn btn-primary" onClick={() => navigate('/admin/events')} style={{ padding: '.5rem 1rem' }}>
            + New event
          </button>
        ) : null
      }
    >
      <Component data={data} user={user} />
    </AdminLayout>
  );
}
