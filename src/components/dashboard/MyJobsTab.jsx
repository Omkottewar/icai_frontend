import { useEffect, useState } from 'react';
import { cachedGet, apiWrite } from '../../lib/apiCache';
import { navigate } from '../../hooks/useRoute';
import { toast } from '../../lib/notify';
import { dialog } from '../../lib/dialog';
import {
  IconBell, IconBriefcase, IconHeart, IconClock, IconArrowRight, IconMapPin,
} from '../../icons';

// Consolidated "Jobs" tab on the member/student dashboard. Combines three
// user-scoped lists into one screen so the tab strip stays tight:
//   • My Job Alerts     — active subscriptions with per-row unsub
//   • Saved Jobs        — bookmarks
//   • My Applications   — status board
// Each section handles its own fetch + empty state independently so a
// broken endpoint on one doesn't blank out the others.

const APP_STATUS_STYLE = {
  applied:     { bg: '#dbeafe', fg: '#1e40af', label: 'Received' },
  shortlisted: { bg: '#e0e7ff', fg: '#3730a3', label: 'Shortlisted' },
  interview:   { bg: '#fef3c7', fg: '#92400e', label: 'Interview' },
  offered:     { bg: '#d1fae5', fg: '#065f46', label: 'Offered' },
  hired:       { bg: '#d1fae5', fg: '#047857', label: 'Hired' },
  rejected:    { bg: '#fee2e2', fg: '#991b1b', label: 'Not selected' },
  withdrawn:   { bg: '#e5e7eb', fg: '#374151', label: 'Withdrawn' },
};

function StatusPill({ status }) {
  const s = APP_STATUS_STYLE[status] ?? { bg: '#e5e7eb', fg: '#374151', label: status };
  return (
    <span style={{
      padding: '.15rem .55rem', borderRadius: '999px',
      fontSize: '.7rem', fontWeight: 700,
      background: s.bg, color: s.fg,
      textTransform: 'uppercase', letterSpacing: '.03em',
    }}>{s.label}</span>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function MyJobsTab() {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <MyAlertsCard />
      <SavedJobsCard />
      <MyApplicationsCard />
    </div>
  );
}

// ─── My alerts ───────────────────────────────────────────────────────────
function MyAlertsCard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const reload = () => {
    cachedGet('/api/job-alerts/me').then((j) => setRows(j.items || [])).catch((e) => setError(e.message));
  };
  useEffect(() => { reload(); }, []);

  async function unsub(id) {
    const ok = await dialog.confirm({
      title: 'Unsubscribe from this alert?',
      message: 'You can re-subscribe anytime from the Subscribe to Job Alerts page.',
      confirmText: 'Unsubscribe',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiWrite('/api/job-alerts/unsubscribe', {
        body: { subscription_ids: [id] },
        invalidates: ['/api/job-alerts'],
      });
      toast?.success?.('Unsubscribed');
      reload();
    } catch (err) { toast?.error?.(err.message); }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', marginBottom: '.75rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.55rem' }}>
          <IconBell size="sm" />
          <h3 style={{ margin: 0, fontSize: '1rem' }}>My job alerts</h3>
        </div>
        <button
          onClick={() => navigate('/job-alerts/subscribe')}
          className="btn btn-outline"
          style={{ padding: '.35rem .75rem', fontSize: '.78rem' }}
        >
          + Add alerts
        </button>
      </header>

      {error && <div className="muted-text" style={{ fontSize: '.85rem', color: '#991b1b' }}>{error}</div>}
      {!error && rows === null && <div className="muted-text" style={{ fontSize: '.85rem' }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="muted-text" style={{ fontSize: '.85rem' }}>
          You haven't subscribed to any alerts yet.{' '}
          <a href="/job-alerts/subscribe" style={{ color: 'var(--primary)', fontWeight: 600 }}>Subscribe now →</a>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div style={{ display: 'grid', gap: '.4rem' }}>
          {rows.filter((r) => !r.unsubscribed_at).map((r) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '.55rem .75rem', border: '1px solid var(--border)', borderRadius: '.375rem',
              flexWrap: 'wrap', gap: '.5rem',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{r.category_name}</div>
                <div className="muted-text" style={{ fontSize: '.72rem', textTransform: 'capitalize' }}>
                  {r.posting_type} · {r.frequency.replace('_', ' ')}
                  {r.confirmed_at ? '' : ' · Pending email confirmation'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => unsub(r.id)}
                className="btn btn-outline"
                style={{ padding: '.3rem .65rem', fontSize: '.75rem', color: '#991b1b' }}
              >
                Unsubscribe
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Saved jobs ──────────────────────────────────────────────────────────
function SavedJobsCard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const reload = () => {
    cachedGet('/api/saved-jobs').then((j) => setRows(j.items || [])).catch((e) => setError(e.message));
  };
  useEffect(() => { reload(); }, []);

  async function unsave(posting_id) {
    try {
      await apiWrite(`/api/saved-jobs/${posting_id}/toggle`, {
        invalidates: ['/api/saved-jobs', '/api/jobs'],
      });
      reload();
    } catch (err) { toast?.error?.(err.message); }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <header style={{ display: 'inline-flex', alignItems: 'center', gap: '.55rem', marginBottom: '.75rem' }}>
        <IconHeart size="sm" />
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Saved jobs</h3>
      </header>

      {error && <div className="muted-text" style={{ fontSize: '.85rem', color: '#991b1b' }}>{error}</div>}
      {!error && rows === null && <div className="muted-text" style={{ fontSize: '.85rem' }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="muted-text" style={{ fontSize: '.85rem' }}>
          You haven't saved any postings yet. Tap the heart icon on any card to bookmark it.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div style={{ display: 'grid', gap: '.4rem' }}>
          {rows.map((r) => (
            <div key={r.posting_id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '.55rem .75rem', border: '1px solid var(--border)', borderRadius: '.375rem',
              flexWrap: 'wrap', gap: '.5rem',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{r.title || 'Removed posting'}</div>
                <div className="muted-text" style={{ fontSize: '.72rem' }}>
                  {(r.firm_name || r.employer_name || 'ICAI Nagpur')}
                  {r.location && <> · <IconMapPin size="sm" /> {r.location}</>}
                </div>
              </div>
              <div style={{ display: 'inline-flex', gap: '.3rem' }}>
                {r.type && (
                  <button
                    type="button"
                    onClick={() => navigate(`/job-vacancies?type=${r.type}#p-${r.posting_id}`)}
                    className="btn btn-outline"
                    style={{ padding: '.3rem .65rem', fontSize: '.75rem' }}
                  >
                    View <IconArrowRight size="sm" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => unsave(r.posting_id)}
                  className="btn btn-outline"
                  style={{ padding: '.3rem .65rem', fontSize: '.75rem', color: '#991b1b' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── My applications ─────────────────────────────────────────────────────
function MyApplicationsCard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const reload = () => {
    cachedGet('/api/job-applications/mine').then((j) => setRows(j.items || [])).catch((e) => setError(e.message));
  };
  useEffect(() => { reload(); }, []);

  async function withdraw(id) {
    const ok = await dialog.confirm({
      title: 'Withdraw this application?',
      message: 'You will not be able to re-apply to the same posting.',
      confirmText: 'Withdraw',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiWrite(`/api/job-applications/${id}/withdraw`, {
        invalidates: ['/api/job-applications/mine'],
      });
      toast?.success?.('Application withdrawn');
      reload();
    } catch (err) { toast?.error?.(err.message); }
  }

  return (
    <div className="card" style={{ padding: '1.25rem' }} id="my-applications">
      <header style={{ display: 'inline-flex', alignItems: 'center', gap: '.55rem', marginBottom: '.75rem' }}>
        <IconBriefcase size="sm" />
        <h3 style={{ margin: 0, fontSize: '1rem' }}>My applications</h3>
      </header>

      {error && <div className="muted-text" style={{ fontSize: '.85rem', color: '#991b1b' }}>{error}</div>}
      {!error && rows === null && <div className="muted-text" style={{ fontSize: '.85rem' }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="muted-text" style={{ fontSize: '.85rem' }}>
          You haven't applied to any postings yet.
        </div>
      )}
      {rows && rows.length > 0 && (
        <div style={{ display: 'grid', gap: '.5rem' }}>
          {rows.map((r) => (
            <div key={r.id} style={{
              padding: '.65rem .8rem', border: '1px solid var(--border)', borderRadius: '.375rem',
              display: 'flex', flexDirection: 'column', gap: '.4rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{r.posting_title || 'Removed posting'}</div>
                  <div className="muted-text" style={{ fontSize: '.72rem' }}>
                    {(r.firm_name || r.employer_name || 'ICAI Nagpur')}
                    <> · <IconClock size="sm" /> Applied {fmtDate(r.created_at)}</>
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
              {r.status_note && (
                <div className="muted-text" style={{ fontSize: '.72rem', fontStyle: 'italic' }}>
                  Note: {r.status_note}
                </div>
              )}
              {r.status !== 'withdrawn' && r.status !== 'hired' && r.status !== 'rejected' && (
                <div>
                  <button
                    type="button"
                    onClick={() => withdraw(r.id)}
                    className="btn btn-outline"
                    style={{ padding: '.25rem .6rem', fontSize: '.72rem', color: '#991b1b' }}
                  >
                    Withdraw
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
