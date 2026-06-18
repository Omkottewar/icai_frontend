import { useCallback, useEffect, useState } from 'react';
import DataTable from '../DataTable';
import { useAuth } from '../../../context/AuthContext';
import { useRoleFlags } from '../../../hooks/useRoleFlags';
import {
  listApprovals,
  approveSource,
  rejectSource,
  setRetention,
} from '../../../lib/pragyaanAdmin';

// Approvals queue for the Pragyaan knowledge base. Admin uploads and public
// ingest land here as `pending`; a reviewer approves (→ active/indexed) or
// rejects (→ failed), and can set/clear a retention expiry date.
//
// Actions are gated to admin OR branch/committee chairman, mirroring the
// backend (approve/reject/retention also allow chairmen). The page is read-
// only for anyone else — but in practice the parent shell only renders this
// tab for those roles, so the gate is a belt-and-braces guard.

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

// A short preview of where the source came from (url / file / pasted text).
function sourcePreview(r) {
  if (r.url) return r.url;
  if (r.file_id) return `File · ${r.file_id}`;
  return null;
}

// An <input type="date"> wants YYYY-MM-DD; the API wants a full ISO string.
function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function PragyaanApprovals() {
  const { showToast } = useAuth();
  const { isAdmin, isBranchChairman, isCommitteeChairman } = useRoleFlags();
  const canReview = isAdmin || isBranchChairman || isCommitteeChairman;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // id of the row whose action is in-flight (disables that row's buttons).
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await listApprovals();
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Row actions ───────────────────────────────────────────────────────────
  async function onApprove(row) {
    setBusyId(row.id);
    try {
      await approveSource(row.id);
      showToast?.('Source approved — indexing', 'success');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Approve failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(row) {
    const reason = prompt(`Reject "${row.title || 'Untitled'}"? Optionally add a reason:`, '');
    // `prompt` returns null on cancel — treat that as "don't reject".
    if (reason === null) return;
    setBusyId(row.id);
    try {
      await rejectSource(row.id, reason.trim() || undefined);
      showToast?.('Source rejected', 'info');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Reject failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onRetention(row, value) {
    // Empty value clears the retention date (null); otherwise send midnight
    // UTC of the chosen day as an ISO string.
    const iso = value ? new Date(value + 'T00:00:00.000Z').toISOString() : null;
    setBusyId(row.id);
    try {
      await setRetention(row.id, iso);
      showToast?.(iso ? 'Retention date set' : 'Retention date cleared', 'success');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Failed to update retention', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (r) => {
        const preview = sourcePreview(r);
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.title || <span className="muted-text">Untitled</span>}</div>
            <div className="muted-text" style={{ fontSize: '.72rem', marginTop: '.15rem' }}>
              <span className="admin-chip">{r.source_type}</span>
              {r.lang && <span style={{ marginLeft: '.4rem', textTransform: 'uppercase' }}>{r.lang}</span>}
              <span style={{ marginLeft: '.4rem' }}>v{r.version}</span>
            </div>
            {preview && (
              <div
                className="muted-text"
                style={{ fontSize: '.72rem', marginTop: '.2rem', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={preview}
              >
                {preview}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'scope',
      header: 'Scope',
      width: 100,
      render: (r) => <span className="admin-chip" style={{ textTransform: 'capitalize' }}>{r.scope}</span>,
    },
    {
      key: 'created_at',
      header: 'Submitted',
      width: 120,
      render: (r) => (
        <div className="muted-text" style={{ fontSize: '.72rem' }}>{fmtDate(r.created_at)}</div>
      ),
    },
    {
      key: 'retention',
      header: 'Retention',
      width: 160,
      render: (r) => {
        const rowBusy = busyId === r.id;
        return (
          <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
            <input
              type="date"
              className="input-base"
              disabled={!canReview || rowBusy}
              value={toDateInput(r.retention_expires_at)}
              onChange={(e) => onRetention(r, e.target.value)}
              style={{ padding: '.25rem .4rem', fontSize: '.72rem', maxWidth: 140 }}
            />
            {r.retention_expires_at && canReview && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rowBusy}
                onClick={() => onRetention(r, '')}
                title="Clear retention date"
                style={{ padding: '.2rem .4rem', fontSize: '.72rem', color: 'var(--muted-foreground)' }}
              >
                Clear
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: 190,
      render: (r) => {
        if (!canReview) return <span className="muted-text" style={{ fontSize: '.72rem' }}>View only</span>;
        const rowBusy = busyId === r.id;
        return (
          <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={rowBusy}
              onClick={() => onApprove(r)}
              style={{ padding: '.25rem .6rem', fontSize: '.72rem' }}
            >
              {rowBusy ? '…' : 'Approve'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={rowBusy}
              onClick={() => onReject(r)}
              style={{ padding: '.25rem .6rem', fontSize: '.72rem', color: 'var(--destructive)' }}
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="row gap-2" style={{ justifyContent: 'space-between', marginBottom: '.875rem', flexWrap: 'wrap' }}>
        <p className="muted-text" style={{ margin: 0, fontSize: '.8125rem' }}>
          {data ? `${data.total ?? 0} source${(data.total ?? 0) === 1 ? '' : 's'} awaiting review` : 'Pending sources awaiting review'}
        </p>
        <button
          type="button"
          className="btn btn-outline"
          onClick={load}
          disabled={loading}
          style={{ padding: '.4rem .85rem' }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: '.875rem' }}>{error}</div>}

      {/* /approvals returns the full queue (no server pagination), so a large
          pageSize keeps DataTable's pagination bar hidden. */}
      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={1}
        pageSize={Number.MAX_SAFE_INTEGER}
        emptyMessage="Nothing awaiting approval — the queue is clear."
      />

      <style>{`
        .admin-chip {
          display: inline-block; padding: .1rem .45rem; border-radius: 999px;
          background: var(--muted, #f5f5f4); color: var(--foreground);
          font-size: .68rem; font-weight: 600; border: 1px solid var(--border);
        }
        .admin-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: .625rem .875rem; border-radius: .375rem; font-size: .8125rem;
        }
      `}</style>
    </div>
  );
}
