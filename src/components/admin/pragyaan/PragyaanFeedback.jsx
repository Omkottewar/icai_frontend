import { useCallback, useEffect, useState } from 'react';
import DataTable from '../DataTable';
import { useAuth } from '../../../context/AuthContext';
import { listFeedback } from '../../../lib/pragyaanAdmin';

// Read-only view of user feedback on Pragyaan answers. Each row is an up/down
// vote (with an optional comment) on an assistant message, shown alongside an
// excerpt of that message, its citations, the conversation language and the
// timestamp. Filter by rating (all / up / down); paginated server-side.

const PAGE_SIZE = 20;

// rating filter -> query value sent to the API ('' = all ratings)
const RATINGS = [
  ['', 'All ratings'],
  ['up', '👍 Up'],
  ['down', '👎 Down'],
];

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// Citations come back as JSON (array) or already-parsed; normalise to an array
// of { title?, url?, source_id? }-ish objects so we can render chips safely.
function normalizeCitations(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(arr) ? arr : [];
}

function citationLabel(c, i) {
  if (typeof c === 'string') return c;
  return c?.title || c?.source_title || c?.url || c?.source_id || `Citation ${i + 1}`;
}

export default function PragyaanFeedback() {
  const { showToast } = useAuth();

  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await listFeedback({ rating: rating || undefined, page, pageSize: PAGE_SIZE });
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load feedback');
      showToast?.(e.message || 'Failed to load feedback', 'error');
    } finally {
      setLoading(false);
    }
  }, [rating, page, showToast]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      key: 'rating',
      header: 'Rating',
      width: 80,
      render: (r) => (
        <span className={'fb-rating fb-rating-' + (r.rating || 'none')}>
          {r.rating === 'up' ? '👍' : r.rating === 'down' ? '👎' : '—'}
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Answer & feedback',
      render: (r) => {
        const cites = normalizeCitations(r.message_citations);
        return (
          <div style={{ minWidth: 0, maxWidth: 560 }}>
            {r.message_content
              ? <div className="fb-excerpt">{r.message_content}</div>
              : <div className="muted-text" style={{ fontSize: '.78rem' }}>No message content</div>}
            {r.comment && (
              <div className="fb-comment">
                <span className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Comment</span>
                <div>{r.comment}</div>
              </div>
            )}
            {cites.length > 0 && (
              <div className="row gap-1" style={{ flexWrap: 'wrap', marginTop: '.4rem' }}>
                {cites.map((c, i) => (
                  <span key={i} className="admin-chip" title={typeof c === 'object' ? (c.url || '') : ''}>
                    {citationLabel(c, i)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'conversation_lang',
      header: 'Lang',
      width: 70,
      render: (r) => (
        r.conversation_lang
          ? <span className="admin-chip" style={{ textTransform: 'uppercase' }}>{r.conversation_lang}</span>
          : <span className="muted-text">—</span>
      ),
    },
    {
      key: 'created_at',
      header: 'When',
      width: 160,
      render: (r) => (
        <div className="muted-text" style={{ fontSize: '.72rem' }}>{fmtDateTime(r.created_at)}</div>
      ),
    },
  ];

  return (
    <div>
      {error && <div className="admin-error" style={{ marginBottom: '.875rem' }}>{error}</div>}

      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyMessage="No feedback yet for this filter."
        filters={
          <select
            className="input-base"
            style={{ padding: '.375rem .5rem', maxWidth: 160 }}
            value={rating}
            onChange={(e) => { setRating(e.target.value); setPage(1); }}
          >
            {RATINGS.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
          </select>
        }
      />

      <style>{`
        .admin-chip {
          display: inline-block; padding: .1rem .45rem; border-radius: 999px;
          background: var(--muted, #f5f5f4); color: var(--foreground);
          font-size: .68rem; font-weight: 600; border: 1px solid var(--border);
          max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          vertical-align: bottom;
        }
        .fb-rating { font-size: 1.1rem; }
        .fb-excerpt {
          font-size: .8125rem; line-height: 1.45; color: var(--foreground);
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .fb-comment {
          margin-top: .45rem; padding: .45rem .6rem; border-left: 3px solid var(--border);
          background: var(--muted, #f5f5f4); border-radius: .25rem; font-size: .8125rem;
        }
        .fb-comment > div { margin-top: .15rem; }
        .admin-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: .625rem .875rem; border-radius: .375rem; font-size: .8125rem;
        }
      `}</style>
    </div>
  );
}
