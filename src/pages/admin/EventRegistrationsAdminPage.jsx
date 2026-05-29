import { useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_OPTIONS = ['registered', 'waitlisted', 'cancelled', 'attended', 'no_show'];

export default function EventRegistrationsAdminPage() {
  const route = useRoute();
  const { showToast } = useAuth();
  const eventId = route.query.event_id || '';

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(new Set());

  const { data, loading, refresh } = useAdminList('/api/admin/registrations', {
    page, pageSize: 50, event_id: eventId, status,
  });

  const toggleOne = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data?.rows) return;
    const allIds = data.rows.map((r) => r.id);
    setSelected((s) => {
      const allSelected = allIds.every((id) => s.has(id));
      return new Set(allSelected ? [] : allIds);
    });
  };

  const markAttended = async () => {
    if (selected.size === 0) return;
    try {
      const r = await adminFetch('/api/admin/registrations/bulk-attended', {
        method: 'POST',
        body: { ids: Array.from(selected) },
      });
      showToast?.(`Marked ${r.updated} as attended`, 'success');
      setSelected(new Set());
      refresh();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const exportCsv = () => {
    const rows = data?.rows || [];
    const csv = [
      ['User', 'Email', 'Event', 'Status', 'Registered at', 'Attended at'],
      ...rows.map((r) => [
        r.user_name || '', r.user_email || '', r.event_title || '',
        r.status, r.registered_at || '', r.attended_at || '',
      ]),
    ].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `registrations-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const changeStatus = async (id, newStatus) => {
    try {
      await adminFetch(`/api/admin/registrations/${id}`, { method: 'PATCH', body: { status: newStatus } });
      showToast?.('Registration updated', 'success');
      refresh();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const allSelected = !!data?.rows?.length && data.rows.every((r) => selected.has(r.id));

  const columns = useMemo(() => [
    {
      key: '_select', header: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
      ),
      width: 40,
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)}
          aria-label="Select"
        />
      ),
    },
    { key: 'user', header: 'Attendee', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.user_name || '—'}</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.user_email || '—'}</div>
      </div>
    )},
    { key: 'event', header: 'Event', render: (r) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: '.8125rem' }}>{r.event_title || '—'}</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>{fmtDate(r.event_starts_at)}</div>
      </div>
    )},
    { key: 'status', header: 'Status', width: 160, render: (r) => (
      <select
        className="input-base"
        value={r.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => changeStatus(r.id, e.target.value)}
        style={{ padding: '.25rem .5rem', fontSize: '.75rem' }}
      >
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
    )},
    { key: 'registered_at', header: 'Registered', width: 160, render: (r) => fmtDate(r.registered_at) },
    { key: 'attended_at', header: 'Attended', width: 160, render: (r) => fmtDate(r.attended_at) },
  ], [selected, allSelected]);

  return (
    <AdminLayout
      title="Registrations"
      subtitle={eventId ? `Filtered by event ${eventId.slice(0, 8)}…` : 'All event registrations'}
      actions={
        <>
          <button className="btn btn-outline" onClick={exportCsv} style={{ padding: '.5rem 1rem' }}>Export CSV</button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={markAttended} style={{ padding: '.5rem 1rem' }}>
            Mark attended ({selected.size})
          </button>
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={page}
        pageSize={data?.pageSize ?? 50}
        onPageChange={setPage}
        filters={
          <select className="input-base" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        }
      />

      <style>{`
        .input-base {
          width: 100%; padding: .5rem .75rem;
          border: 1px solid var(--border); border-radius: .375rem;
          background: var(--background); font-size: .875rem; color: var(--foreground);
        }
      `}</style>
    </AdminLayout>
  );
}
