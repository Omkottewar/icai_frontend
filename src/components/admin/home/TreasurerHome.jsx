import InboxCard from './InboxCard';
import StatStrip from './StatStrip';
import QuickActions from './QuickActions';
import RevenueChart from './RevenueChart';

// Homepage for branch_treasurer (and accountant fallback when no dedicated
// accountant role is detected — accountant has its own home variant).
//
// Surfaces the financial workflow without making the user navigate to find
// it: pending refunds, bills, IUTs in the inbox; CABF and revenue numbers in
// the stat strip; revenue chart for visual trend; quick actions for the
// daily tools.
function fmtPaise(paise) {
  if (paise == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(paise / 100);
}

const API_BASE = ''; // same-origin via Vite proxy

export default function TreasurerHome({ data, user }) {
  const inbox = data?.inbox ?? [];
  const stats = data?.stats ?? {};
  const revenueByMonth = data?.lists?.revenue_by_month ?? [];
  const firstName = (user?.name || '').split(/\s+/)[0] || user?.name || 'there';

  const onExportFy = () => {
    // Browser download — no fetch needed; the cookie carries auth.
    window.location.href = `${API_BASE}/api/admin/exports/fy.csv`;
  };

  return (
    <div className="home-stack">
      <div className="home-hero">
        <div className="home-hero-greeting">Hi {firstName},</div>
        <div className="home-hero-headline">
          {inbox.length === 0
            ? 'Branch finances are up to date.'
            : `${inbox.length} financial ${inbox.length === 1 ? 'decision' : 'decisions'} need attention.`}
        </div>
      </div>

      <InboxCard inbox={inbox} emptyMessage="No financial decisions pending right now." />

      <StatStrip
        items={[
          { value: fmtPaise(stats.revenue_month_paise),       label: 'Revenue this month' },
          { value: stats.refunds_pending ?? 0,                label: 'Refunds pending' },
          { value: stats.bills_pending_approval ?? 0,         label: 'Bills awaiting approval' },
          { value: fmtPaise(stats.cabf_receipts_month_paise), label: 'CABF receipts · month' },
        ]}
      />

      <RevenueChart rows={revenueByMonth} />

      <QuickActions
        title="Finance tools"
        actions={[
          { label: 'Refunds',            description: 'Approve, reject, mark processed',     href: '/admin/refunds' },
          { label: 'Bills',              description: 'Approve post-event bills',            href: '/admin/bills' },
          { label: 'IUT transfers',      description: 'Inter-account movements',             href: '/admin/iut-transfers' },
          { label: 'Payments',           description: 'Card / UPI / NEFT register',          href: '/admin/payments' },
          { label: 'CABF requests',      description: 'Assistance disbursement queue',       href: '/admin/cabf' },
          { label: 'Export FY report',   description: 'Download consolidated CSV',           onClick: onExportFy },
        ]}
      />

      <style>{`
        .home-stack { display: flex; flex-direction: column; gap: 1.25rem; }
        .home-hero { padding: 1rem 0 .5rem; }
        .home-hero-greeting { font-size: .9rem; color: var(--muted-foreground); }
        .home-hero-headline { font-size: 1.5rem; font-weight: 700; margin-top: .25rem; line-height: 1.25; }
        .home-card { background: white; border: 1px solid var(--border); border-radius: .5rem; overflow: hidden; }
        .home-card-head { padding: .875rem 1.125rem; display: flex; justify-content: space-between; align-items: center; }
        .home-card-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .home-card-sub { font-size: .8rem; color: var(--muted-foreground); margin-top: .1rem; }
      `}</style>
    </div>
  );
}
