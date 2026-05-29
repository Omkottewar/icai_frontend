import { useChecklistList } from '../../hooks/useChecklist';
import { navigate } from '../../hooks/useRoute';
import { IconArrowRight } from '../../icons';

// Top widget for committee chairmen: surfaces checklists waiting for THEM to
// fill in budgets/values. /api/checklists is scoped server-side to committees
// the user actually chairs.
export default function CommitteeChecklistsCard() {
  const { data, loading } = useChecklistList();
  const pending = (data?.rows ?? []).filter((r) => r.status === 'awaiting_committee');
  const top3 = pending.slice(0, 3);

  return (
    <div className="card" style={{ padding: '1rem', borderRadius: '.5rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.75rem' }}>
        <div className="row gap-2" style={{ alignItems: 'baseline' }}>
          <h3 style={{ fontSize: '.9375rem', fontWeight: 700, margin: 0 }}>Your committee checklists</h3>
          {pending.length > 0 && (
            <span style={{
              background: '#fef3c7', color: '#92400e',
              padding: '.1rem .55rem', borderRadius: 999,
              fontSize: '.7rem', fontWeight: 700,
            }}>{pending.length}</span>
          )}
        </div>
        {pending.length > 3 && (
          <a href="#/checklists" style={{ fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
            See all →
          </a>
        )}
      </div>

      {loading && <p className="muted-text" style={{ fontSize: '.8125rem', margin: 0 }}>Loading…</p>}

      {!loading && pending.length === 0 && (
        <p className="muted-text" style={{ fontSize: '.8125rem', margin: 0 }}>
          No checklists waiting for your input.
        </p>
      )}

      {!loading && top3.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {top3.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => navigate('/checklists?id=' + c.id)}
                className="row gap-2"
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '.625rem .75rem',
                  border: '1px solid var(--border)', borderRadius: '.375rem',
                  background: 'var(--background)', cursor: 'pointer',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.event_title}
                  </div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>
                    {c.committee_name || c.committee_code || '—'} · idle {fmtAge(c.updated_at)}
                  </div>
                </div>
                <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '.8125rem', display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
                  Fill <IconArrowRight size="sm" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtAge(iso) {
  if (!iso) return 'a while';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / 60_000);
  return `${Math.max(1, mins)}m`;
}
