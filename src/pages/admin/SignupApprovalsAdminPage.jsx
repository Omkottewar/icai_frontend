import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';
import { Shimmer } from '../../components/ui/Shimmer';
import { IconCheckCircle, IconX } from '../../icons';

const ROLE_FILTER_OPTIONS = [
  { value: '',        label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'member',  label: 'Members' },
  { value: 'employer', label: 'Employers' },
];

// Queue of self-signed-up users waiting for a branch admin to activate them.
// Backed by GET /api/admin/users?status=pending_approval — Approve flips
// status to 'active' (PATCH), Reject soft-deletes the row (DELETE). Both
// endpoints already exist; this page just gives them a dedicated surface
// instead of hiding them behind the Users filter dropdown.

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SignupApprovalsAdminPage() {
  const { showToast } = useAuth();
  const [busyId, setBusyId] = useState(null);

  // Filter + pagination state. Role filter is the most useful lever
  // here — WICASA typically wants to approve student sign-ups in a
  // single sweep separate from member reviews.
  const [role, setRole]   = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Debounce the search input so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQ(queryInput.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  const { data, loading, refresh } = useAdminList('/api/admin/users', {
    status: 'pending_approval',
    primary_role: role,
    q,
    page,
    pageSize,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const exportUrl = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('status', 'pending_approval');
    if (role) qs.set('primary_role', role);
    if (q)    qs.set('q', q);
    return `/api/admin/users/export.csv?${qs.toString()}`;
  }, [role, q]);

  async function approve(row) {
    const ok = await dialog.confirm({
      title: 'Approve sign-up?',
      message: `Activate ${row.name} (${row.email}) — they'll be able to sign in immediately.`,
      confirmText: 'Approve',
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await adminFetch(`/api/admin/users/${row.id}`, {
        method: 'PATCH',
        body: { status: 'active' },
      });
      showToast?.(`Approved ${row.name}`, 'success');
      await refresh();
    } catch (e) {
      showToast?.(e.message || 'Could not approve', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row) {
    const ok = await dialog.confirm({
      title: 'Reject sign-up?',
      message: `Delete the pending account for ${row.name} (${row.email}). They can sign up again later if this was a mistake.`,
      confirmText: 'Reject',
      danger: true,
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await adminFetch(`/api/admin/users/${row.id}`, { method: 'DELETE' });
      showToast?.(`Rejected ${row.name}`, 'success');
      await refresh();
    } catch (e) {
      showToast?.(e.message || 'Could not reject', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout
      title="Sign-up approvals"
      subtitle="New accounts waiting to be activated"
      actions={
        <a
          href={exportUrl}
          className="btn btn-outline"
          style={{ padding: '.5rem 1rem', textDecoration: 'none' }}
          title="Download the filtered list as CSV"
        >
          ⬇ Export CSV
        </a>
      }
    >
      {/* Filter + search row */}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '.75rem' }}>
        <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
          {ROLE_FILTER_OPTIONS.map((opt) => {
            const active = role === opt.value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => { setRole(opt.value); setPage(1); }}
                style={{
                  padding: '.3rem .75rem', borderRadius: 999,
                  border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
                  background: active ? 'oklch(0.36 0.13 255 / 0.1)' : 'var(--card)',
                  color: active ? 'var(--primary)' : 'var(--foreground)',
                  fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value.slice(0, 120))}
          placeholder="Search by name or email…"
          className="input-base"
          style={{ maxWidth: 320, fontSize: '.85rem' }}
        />
        <div className="muted-text" style={{ fontSize: '.75rem', marginLeft: 'auto' }}>
          {loading ? 'Loading…' : `${total} pending`}
        </div>
      </div>

      <div className="sua-list">
        {loading && rows.length === 0 && (
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="sua-row" style={{ pointerEvents: 'none' }}>
                <div className="sua-row-body" style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
                  <Shimmer height=".95rem" width={`${45 + ((i * 13) % 30)}%`} />
                  <Shimmer height=".7rem" width="30%" />
                </div>
                <Shimmer height="2rem" width="6rem" radius=".375rem" />
              </div>
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="sua-empty">
            {role || q
              ? 'No pending sign-ups match these filters. Try clearing them.'
              : 'Nothing pending — every self-signed-up account has been reviewed.'}
          </div>
        )}

        {rows.map((r) => {
          const busy = busyId === r.id;
          // MRN badge — only meaningful for the member role. `signup_mrn_in_directory`
          // is null when no MRN was declared (grey "no MRN" chip), true when the
          // typed MRN matched the imported ICAI directory (green), false when
          // it didn't (amber warning — the admin should sanity-check before
          // approving).
          const isMember = r.primary_role === 'member';
          let mrnBadge = null;
          if (isMember) {
            if (!r.signup_mrn) {
              mrnBadge = { label: 'No MRN provided', bg: '#f3f4f6', fg: '#4b5563', border: '#e5e7eb' };
            } else if (r.signup_mrn_in_directory) {
              mrnBadge = { label: `✓ MRN ${r.signup_mrn} · In directory`, bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' };
            } else {
              mrnBadge = { label: `⚠ MRN ${r.signup_mrn} · Not in directory`, bg: '#fffbeb', fg: '#92400e', border: '#fde68a' };
            }
          }
          return (
            <div key={r.id} className="sua-row">
              <div className="sua-row-body">
                <div className="sua-row-title">{r.name || '(no name)'}</div>
                <div className="sua-row-meta">
                  <span>{r.email}</span>
                  {r.phone && <span> · {r.phone}</span>}
                  <span> · {r.primary_role}</span>
                  <span> · signed up {fmtDate(r.created_at)}</span>
                </div>
                {mrnBadge && (
                  <div
                    className="sua-mrn-badge"
                    style={{
                      background: mrnBadge.bg,
                      color: mrnBadge.fg,
                      border: `1px solid ${mrnBadge.border}`,
                    }}
                  >
                    {mrnBadge.label}
                  </div>
                )}
              </div>
              <div className="sua-row-actions">
                <Button
                  className="btn btn-outline"
                  onClick={() => reject(r)}
                  disabled={busy}
                  style={{ padding: '.4rem .8rem', color: '#991b1b', borderColor: '#fecaca' }}
                >
                  <IconX size="sm" /> Reject
                </Button>
                <Button
                  className="btn btn-primary"
                  onClick={() => approve(r)}
                  loading={busy}
                  disabled={busy}
                  style={{ padding: '.4rem .8rem' }}
                >
                  <IconCheckCircle size="sm" /> Approve
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '.9rem', fontSize: '.8rem' }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn btn-outline"
            style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}
          >
            ← Previous
          </button>
          <span className="muted-text">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn btn-outline"
            style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        .sua-list { display: flex; flex-direction: column; gap: .5rem; }
        .sua-empty {
          padding: 2.5rem 1rem; text-align: center;
          color: var(--muted-foreground); font-size: .9rem;
          background: white; border: 1px solid var(--border);
          border-radius: .5rem;
        }
        .sua-row {
          display: flex; align-items: center; gap: 1rem;
          padding: .875rem 1.125rem;
          background: white; border: 1px solid var(--border);
          border-radius: .5rem;
        }
        .sua-row-body { flex: 1; min-width: 0; }
        .sua-row-title { font-size: .95rem; font-weight: 600; }
        .sua-row-meta {
          font-size: .75rem; color: var(--muted-foreground);
          margin-top: .2rem; word-break: break-word;
        }
        .sua-mrn-badge {
          display: inline-block;
          margin-top: .45rem;
          padding: .2rem .55rem;
          border-radius: .3rem;
          font-size: .72rem;
          font-weight: 600;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .sua-row-actions {
          display: flex; gap: .5rem; flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .sua-row { flex-direction: column; align-items: stretch; }
          .sua-row-actions { justify-content: flex-end; }
        }
      `}</style>
    </AdminLayout>
  );
}
