import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminList } from '../../hooks/useAdminList';
import { navigate } from '../../hooks/useRoute';
import { IconArrowRight } from '../../icons';
import { Shimmer, ShimmerLines } from '../../components/ui/Shimmer';

// Cross-cutting approvals queue. Replaces the ComingSoonPage that used to
// live at /admin/approvals.
//
// Backed by GET /api/admin/approvals which already scopes results by role
// server-side (committee chairman sees only their committee; treasurer
// sees the financial stages; chairman/admin see everything). So we don't
// re-scope client-side — we just render.
//
// Each row links into /my-checklists?id=<instance_id> so the actual
// approve/reject buttons live in the existing ApprovalStagesPanel —
// keeping a single drawer for the whole multi-stage UI.

const STAGE_FILTERS = [
  { value: '',                 label: 'All stages' },
  { value: 'branch_chairman',  label: 'Branch Chairman' },
  { value: 'treasurer_iut',    label: 'Treasurer (IUT)' },
  { value: 'vc_agenda',        label: 'Vice-Chairman (agenda)' },
];

const STATUS_FILTERS = [
  { value: '',         label: 'Pending + decided' },
  { value: 'pending',  label: 'Pending only' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected / sent back' },
];

const STATUS_PILL = {
  pending:  { bg: '#f1f5f9', fg: '#475569', label: 'Pending' },
  approved: { bg: '#dcfce7', fg: '#166534', label: 'Approved' },
  rejected: { bg: '#fee2e2', fg: '#991b1b', label: 'Sent back' },
};

function ageDays(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function ApprovalsAdminPage() {
  const [stage,  setStage]  = useState('pending'); // default to "show me work"
  // ↑ keep the state name for backwards consistency, but it's really a status.
  // We split into two states below.
  const [stageFilter,  setStageFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data, loading } = useAdminList('/api/admin/approvals', {
    stage:  stageFilter,
    status: statusFilter,
  });
  const rows = data?.rows ?? [];

  return (
    <AdminLayout
      title="Approvals queue"
      subtitle="Pending and recent approval stages — scoped to what you can see"
    >
      <div className="apv-filters">
        <select className="input-base" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          {STAGE_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input-base" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="apv-list">
        {loading && rows.length === 0 && (
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="apv-row" style={{ pointerEvents: 'none' }}>
                <div className="apv-row-body" style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
                  <Shimmer height=".95rem" width={`${50 + ((i * 11) % 30)}%`} />
                  <Shimmer height=".7rem" width="40%" />
                </div>
                <Shimmer height="1.25rem" width="4.5rem" radius="999px" />
              </div>
            ))}
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="apv-empty">
            {statusFilter === 'pending'
              ? "Nothing pending — you're all caught up."
              : 'No items match your filters.'}
          </div>
        )}
        {rows.map((r) => {
          const pill = STATUS_PILL[r.status] ?? STATUS_PILL.pending;
          const days = ageDays(r.submitted_at);
          const overdue = r.status === 'pending' && r.escalated_at;
          return (
            <button
              key={r.approval_id}
              type="button"
              onClick={() => navigate(`/my-checklists?id=${r.instance_id}`)}
              className={'apv-row' + (overdue ? ' is-overdue' : '')}
            >
              <div className="apv-row-body">
                <div className="apv-row-title">
                  {r.event_title ?? r.template_name ?? 'Checklist'}
                  {overdue && <span className="apv-overdue-tag">Escalated</span>}
                </div>
                <div className="apv-row-meta">
                  <span className="apv-stage-label">{r.stage_label}</span>
                  {r.committee_name && <span> · {r.committee_name}</span>}
                  {r.event_starts_at && <span> · {fmtDate(r.event_starts_at)}</span>}
                  {days !== null && r.status === 'pending' && (
                    <span> · pending {days} day{days === 1 ? '' : 's'}</span>
                  )}
                </div>
                {r.note && (
                  <div className="apv-row-note">"{r.note}"{r.decided_by_name ? ` — ${r.decided_by_name}` : ''}</div>
                )}
              </div>
              <span className="apv-pill" style={{ background: pill.bg, color: pill.fg }}>
                {pill.label}
              </span>
              <span className="apv-row-cta">
                Review <IconArrowRight size="sm" />
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        .apv-filters {
          display: flex; gap: .5rem; margin-bottom: 1rem;
        }
        .input-base {
          padding: .375rem .75rem; border: 1px solid var(--border);
          border-radius: .375rem; background: white;
          font-size: .8125rem; min-width: 12rem;
        }
        .apv-list { display: flex; flex-direction: column; gap: .375rem; }
        .apv-empty {
          padding: 2.5rem 1rem; text-align: center;
          color: var(--muted-foreground); font-size: .9rem;
          background: white; border: 1px solid var(--border);
          border-radius: .5rem;
        }
        .apv-row {
          display: flex; align-items: center; gap: 1rem;
          padding: .875rem 1.125rem;
          background: white; border: 1px solid var(--border);
          border-radius: .5rem;
          text-align: left; cursor: pointer; transition: border-color .12s, transform .12s;
        }
        .apv-row:hover {
          border-color: var(--primary, #1e40af);
          transform: translateX(2px);
        }
        .apv-row.is-overdue { border-left: 3px solid #dc2626; }
        .apv-row-body { flex: 1; min-width: 0; }
        .apv-row-title {
          font-size: .9rem; font-weight: 600;
          display: flex; align-items: center; gap: .5rem;
        }
        .apv-overdue-tag {
          font-size: .65rem; font-weight: 700;
          padding: .1rem .4rem; border-radius: 999px;
          background: #fee2e2; color: #991b1b;
        }
        .apv-row-meta {
          font-size: .75rem; color: var(--muted-foreground);
          margin-top: .15rem;
        }
        .apv-stage-label { font-weight: 600; color: var(--foreground); opacity: .7; }
        .apv-row-note {
          font-size: .75rem; color: var(--muted-foreground);
          margin-top: .25rem; font-style: italic;
        }
        .apv-pill {
          padding: .125rem .5rem; border-radius: 999px;
          font-size: .7rem; font-weight: 600;
          flex-shrink: 0;
        }
        .apv-row-cta {
          display: inline-flex; align-items: center; gap: .25rem;
          font-size: .75rem; font-weight: 600;
          color: var(--primary, #1e40af);
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .apv-row-cta { display: none; }
        }
      `}</style>
    </AdminLayout>
  );
}
