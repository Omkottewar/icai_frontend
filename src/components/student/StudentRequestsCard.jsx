import { useEffect, useState } from 'react';
import { cachedGet, apiWrite, invalidate, subscribe } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import { IconArrowRight } from '../../icons';

// Compact "My requests" panel for the student dashboard.
//
// Aggregates the student's own submissions (mentorship + articleship)
// into one card so they see the state of everything they've asked for
// without touching multiple screens.
//
// Refresh strategy: subscribe to invalidations so the moment a modal
// completes an `invalidate('/api/mentorship/my')` (etc.), this component
// re-fetches. No prop-drilling from the modal callback needed.

const STATUS_PALETTE = {
  pending:    { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  submitted:  { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  matched:    { bg: 'oklch(0.90 0.10 250)', fg: 'oklch(0.35 0.13 250)' },
  scheduled:  { bg: 'oklch(0.90 0.10 250)', fg: 'oklch(0.35 0.13 250)' },
  placed:     { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  completed:  { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  cancelled:  { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
};

function StatusPill({ status }) {
  const p = STATUS_PALETTE[status] || STATUS_PALETTE.pending;
  return (
    <span className="badge" style={{
      background: p.bg, color: p.fg, fontSize: '.7rem',
      padding: '.15rem .45rem', borderRadius: 999,
    }}>{status.replace(/_/g, ' ')}</span>
  );
}

function fmtRelative(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  return `${m}mo ago`;
}

function useMyList(endpoint) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      cachedGet(endpoint, null, 30_000)
        .then((j) => { if (!cancelled) setRows(j?.rows || []); })
        .catch((e) => { if (!cancelled) { setError(e); setRows([]); } });
    };
    load();
    const unsub = subscribe(endpoint, load);
    return () => { cancelled = true; unsub(); };
  }, [endpoint]);

  return { rows, error };
}

export default function StudentRequestsCard() {
  const mentorship = useMyList('/api/mentorship/my');
  const articleship = useMyList('/api/articleship-matches/my');

  const loading = mentorship.rows === null || articleship.rows === null;
  const items = [
    ...(mentorship.rows || []).map((r) => ({
      kind: 'Mentorship',
      title: r.topic,
      subtitle: r.mentor_name ? `Mentor: ${r.mentor_name}` : 'Awaiting mentor',
      status: r.status,
      created_at: r.created_at,
      cancelHref: (r.status === 'pending' || r.status === 'matched') ? `/api/mentorship/${r.id}/cancel` : null,
      invalidates: '/api/mentorship/my',
    })),
    ...(articleship.rows || []).map((r) => {
      const specs = Array.isArray(r.preferred_specialisations) ? r.preferred_specialisations : [];
      return {
        kind: 'Articleship',
        title: specs.length ? specs.slice(0, 2).join(', ') + (specs.length > 2 ? '…' : '') : 'Preferences submitted',
        subtitle: r.preferred_location ? `Preferred: ${r.preferred_location}` : 'No location filter',
        status: r.status,
        created_at: r.created_at,
        cancelHref: r.status === 'submitted' ? `/api/articleship-matches/${r.id}/cancel` : null,
        invalidates: '/api/articleship-matches/my',
      };
    }),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  async function cancel(item) {
    if (!item.cancelHref) return;
    try {
      await apiWrite(item.cancelHref, { method: 'POST' });
      invalidate(item.invalidates);
      toast.success(`${item.kind} request cancelled`);
    } catch (err) {
      toast.error(err?.message || 'Could not cancel — try again in a bit.');
    }
  }

  if (loading) {
    return (
      <div className="card">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>My requests</h2>
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>Loading…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>My requests</h2>
          <a href="/students" style={{ color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>Request something →</a>
        </div>
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>
          Nothing submitted yet. From the <a href="/students" style={{ color: 'var(--primary)' }}>student services page</a> you
          can request a mentor or submit articleship preferences.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>My requests</h2>
        <a href="/students" style={{ color: 'var(--primary)', fontSize: '.875rem', fontWeight: 600 }}>New request →</a>
      </div>
      <ul className="col" style={{ listStyle: 'none', padding: 0, margin: '.75rem 0 0' }}>
        {items.map((it, i) => (
          <li key={i} style={{ padding: '.75rem 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, color: 'var(--muted-foreground)' }}>{it.kind}</span>
                  <StatusPill status={it.status} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '.875rem', marginTop: '.25rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>
                  {it.subtitle} · {fmtRelative(it.created_at)}
                </div>
              </div>
              {it.cancelHref && (
                <button
                  type="button"
                  onClick={() => cancel(it)}
                  className="btn btn-outline"
                  style={{ fontSize: '.75rem', padding: '.35rem .6rem', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}
                  title="Withdraw this request"
                >Cancel</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
