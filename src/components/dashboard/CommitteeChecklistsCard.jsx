import { useChecklistInstanceList } from '../../hooks/useChecklist';
import { navigate } from '../../hooks/useRoute';
import { IconArrowRight } from '../../icons';
import InsightsStyles from './insights/insightsStyles';
import ChartFrame from './insights/ChartFrame';

// Top widget for committee chairmen: surfaces checklists waiting for them to
// fill in. Reads from /api/checklist-instances — the single source of truth
// since the legacy event_checklists system was removed in migration 0024.
export default function CommitteeChecklistsCard() {
  const { data, loading } = useChecklistInstanceList();

  const pending = (data?.rows ?? [])
    .filter((r) => r.status === 'awaiting_fill')
    .map((r) => ({
      id: r.id,
      title: r.event_title || r.title,
      sub: r.template_name + (r.template_version ? ` · v${r.template_version}` : ''),
      updated_at: r.updated_at,
    }))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const top3 = pending.slice(0, 3);

  return (
    <>
      <InsightsStyles />
      <ChartFrame
        eyebrow="Your committees"
        title="Checklists awaiting you"
        subtitle={pending.length > 0 ? `${pending.length} need your input` : null}
        loading={loading}
        empty={!loading && pending.length === 0}
        emptyText="No checklists waiting for your input."
        actions={
          pending.length > 3 ? (
            <a href="/my-checklists" className="iframe-btn">See all →</a>
          ) : null
        }
        padding="1rem"
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {top3.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => navigate('/my-checklists?id=' + c.id)}
                className="row gap-2 committee-row"
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '.65rem .85rem',
                  border: '1px solid rgba(0,0,0,.06)', borderRadius: 10,
                  background: 'white', cursor: 'pointer', alignItems: 'center',
                  transition: 'border-color .15s, transform .15s, box-shadow .15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>
                    {c.sub} · idle {fmtAge(c.updated_at)}
                  </div>
                </div>
                <span style={{ color: '#16A34A', fontWeight: 600, fontSize: '.8125rem', display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
                  Fill <IconArrowRight size="sm" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <style>{`
          .committee-row:hover {
            border-color: #16A34A !important;
            transform: translateX(2px);
            box-shadow: 0 4px 14px -6px rgba(22,163,74,.35);
          }
        `}</style>
      </ChartFrame>
    </>
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
