import { navigate } from '../../../hooks/useRoute';
import InboxCard from './InboxCard';
import StatStrip from './StatStrip';
import QuickActions from './QuickActions';
import { IconFileText } from '../../../icons';

// Homepage for accountant (role code: 'accountant', not also treasurer).
// Focus: the daily flow of recording bills and getting them through approval.
// Anti-goal: hiding bills that the treasurer is currently approving — show
// them in a "submitted, awaiting treasurer" tile so the accountant can chase
// when needed.

function fmtRupees(paise) {
  if (paise == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(paise / 100);
}

function fmtDate(s) {
  if (!s) return '';
  // Bill date is a yyyy-mm-dd string from the API.
  const d = typeof s === 'string' ? new Date(s) : s;
  return Number.isNaN(d?.getTime?.()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AccountantHome({ data, user }) {
  const inbox = data?.inbox ?? [];
  const stats = data?.stats ?? {};
  const drafts = (data?.lists?.pending_bills ?? []).filter((b) => b.status === 'draft');
  const firstName = (user?.name || '').split(/\s+/)[0] || user?.name || 'there';

  return (
    <div className="home-stack">
      <div className="home-hero">
        <div className="home-hero-greeting">Hi {firstName},</div>
        <div className="home-hero-headline">
          {drafts.length === 0
            ? 'No draft bills to record right now.'
            : `${drafts.length} ${drafts.length === 1 ? 'bill' : 'bills'} ready to be recorded.`}
        </div>
      </div>

      <InboxCard inbox={inbox} emptyMessage="No draft bills to work on." />

      <StatStrip
        items={[
          { value: stats.bills_pending_record ?? 0,    label: 'Drafts to record' },
          { value: stats.bills_pending_approval ?? 0,  label: 'Awaiting treasurer' },
          { value: stats.events_this_month ?? 0,       label: 'Events this month' },
        ]}
      />

      <div className="home-card">
        <div className="home-card-head">
          <div>
            <h2 className="home-card-title">Drafts</h2>
            <div className="home-card-sub">Click a row to finish recording, attach the bill PDF, and submit for approval.</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/admin/bills?new=1')}
            style={{ padding: '.4rem .9rem', fontSize: '.8125rem' }}
          >
            + New bill
          </button>
        </div>

        <div className="home-bill-list">
          {drafts.length === 0 && (
            <div className="home-bill-empty">
              <div style={{ marginBottom: '.5rem' }}>No drafts right now.</div>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/admin/bills?new=1')}
                style={{ padding: '.4rem .9rem', fontSize: '.8125rem' }}
              >
                Record your first bill
              </button>
            </div>
          )}
          {drafts.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => navigate(`/admin/bills?edit=${b.id}`)}
              className="home-bill-row"
            >
              <div className="home-bill-icon"><IconFileText size="sm" /></div>
              <div className="home-bill-body">
                <div className="home-bill-title">
                  {b.vendor_name} · {fmtRupees(b.amount_paise)}
                </div>
                <div className="home-bill-meta">
                  {fmtDate(b.bill_date)}
                  {b.description ? ` · ${b.description}` : ''}
                </div>
              </div>
              <span className="admin-pill admin-pill-draft">draft</span>
            </button>
          ))}
        </div>
      </div>

      <QuickActions
        title="Bookkeeping tools"
        actions={[
          { label: 'Record a bill',         description: 'Vendor, amount, attachment',          href: '/admin/bills?new=1' },
          { label: 'Bills register',        description: 'All bills across the year',           href: '/admin/bills' },
          { label: 'Events',                description: 'Look up event budgets',               href: '/admin/events' },
          { label: 'Payments register',     description: 'Successful transactions',             href: '/admin/payments' },
        ]}
      />

      <style>{`
        .home-stack { display: flex; flex-direction: column; gap: 1.25rem; }
        .home-hero { padding: 1rem 0 .5rem; }
        .home-hero-greeting { font-size: .9rem; color: var(--muted-foreground); }
        .home-hero-headline { font-size: 1.5rem; font-weight: 700; margin-top: .25rem; line-height: 1.25; }
        .home-card { background: white; border: 1px solid var(--border); border-radius: .5rem; overflow: hidden; }
        .home-card-head { padding: .875rem 1.125rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .home-card-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .home-card-sub { font-size: .8rem; color: var(--muted-foreground); margin-top: .1rem; }
        .home-bill-list { display: flex; flex-direction: column; }
        .home-bill-row {
          display: flex; align-items: center; gap: .875rem;
          padding: .875rem 1.125rem;
          border: 0; border-top: 1px solid var(--border);
          background: white; text-align: left; cursor: pointer;
          width: 100%; transition: background .12s;
        }
        .home-bill-row:hover { background: var(--muted, #fafaf9); }
        .home-bill-icon {
          width: 2rem; height: 2rem; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(245, 158, 11, .14); color: #b45309;
          border-radius: .375rem;
        }
        .home-bill-body { flex: 1; min-width: 0; }
        .home-bill-title { font-size: .9rem; font-weight: 600; line-height: 1.3; }
        .home-bill-meta { font-size: .75rem; color: var(--muted-foreground); margin-top: .15rem; }
        .home-bill-empty { padding: 2rem; text-align: center; color: var(--muted-foreground); font-size: .875rem; }
        .admin-pill {
          padding: .125rem .5rem; border-radius: 999px;
          font-size: .6875rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-draft { background: #fef3c7; color: #92400e; }
      `}</style>
    </div>
  );
}
