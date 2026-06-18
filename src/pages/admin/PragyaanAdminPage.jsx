import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useRoleFlags } from '../../hooks/useRoleFlags';
import PragyaanSources from '../../components/admin/pragyaan/PragyaanSources';
import PragyaanApprovals from '../../components/admin/pragyaan/PragyaanApprovals';
import PragyaanFeedback from '../../components/admin/pragyaan/PragyaanFeedback';
import PragyaanAnalytics from '../../components/admin/pragyaan/PragyaanAnalytics';

// Tabbed shell for the Pragyaan admin console. The API client lives in
// src/lib/pragyaanAdmin.js.
//
// Tab visibility:
//   • Sources / Feedback / Analytics — admin only.
//   • Approvals — admin OR branch/committee chairman, mirroring the backend
//     (approve/reject/retention are also open to chairmen).
const TABS = [
  { key: 'sources',   label: 'Sources' },
  { key: 'approvals', label: 'Approvals', chairmanOk: true },
  { key: 'feedback',  label: 'Feedback' },
  { key: 'analytics', label: 'Analytics' },
];

export default function PragyaanAdminPage() {
  const { isAdmin, isBranchChairman, isCommitteeChairman } = useRoleFlags();
  const isChairman = isBranchChairman || isCommitteeChairman;

  // Filter tabs the current user may see. Chairmen (without the admin role)
  // only get the Approvals tab; admins get everything.
  const visibleTabs = TABS.filter((t) => isAdmin || (t.chairmanOk && isChairman));

  const [tab, setTab] = useState(visibleTabs[0]?.key ?? 'approvals');

  // Guard against a stale tab selection if the visible set is narrower than
  // the default (e.g. a chairman who can only see Approvals).
  const activeTab = visibleTabs.some((t) => t.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? null);

  return (
    <AdminLayout
      title="Pragyaan"
      subtitle="Knowledge base sources, approvals, feedback and analytics for the Pragyaan assistant"
    >
      <div className="row gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        {visibleTabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={active ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ paddingInline: '.9rem' }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'sources'   && <PragyaanSources />}
      {activeTab === 'approvals' && <PragyaanApprovals />}
      {activeTab === 'feedback'  && <PragyaanFeedback />}
      {activeTab === 'analytics' && <PragyaanAnalytics />}
      {!activeTab && (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p className="muted-text">You don’t have access to any Pragyaan sections.</p>
        </div>
      )}
    </AdminLayout>
  );
}
