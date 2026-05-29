import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { ShimmerFormField } from '../../components/ui/Shimmer';

const EMPTY_FORM = { code: '', name: '', description: '', active: true };

function autoCode(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
}

export default function CommitteesAdminPage() {
  const { showToast } = useAuth();
  const [q, setQ] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [editingId, setEditingId] = useState(null); // null | 'new' | uuid

  const { data, loading, refresh } = useAdminList('/api/admin/committees', {
    q, include_inactive: includeInactive ? '1' : '',
  });

  const columns = [
    { key: 'code', header: 'Code', render: (r) => <span className="admin-mono">{r.code}</span>, width: 140 },
    { key: 'name', header: 'Name', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.name}</div>
        {r.description && <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.description}</div>}
      </div>
    )},
    { key: 'events_count', header: 'Events', render: (r) => r.events_count ?? 0, width: 80 },
    { key: 'active_role_count', header: 'Roles', render: (r) => r.active_role_count ?? 0, width: 70 },
    { key: 'active', header: 'Status', render: (r) => (
      <span className={'admin-pill ' + (r.active ? 'admin-pill-active' : 'admin-pill-inactive')}>
        {r.active ? 'active' : 'disabled'}
      </span>
    ), width: 100 },
  ];

  return (
    <AdminLayout
      title="Committees"
      subtitle="Manage CPE, WICASA, Direct Tax, GST and other committees"
      actions={
        <button className="btn btn-primary" onClick={() => setEditingId('new')} style={{ padding: '.5rem 1rem' }}>
          + New committee
        </button>
      }
    >
      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        onRowClick={(r) => setEditingId(r.id)}
        onSearch={(v) => setQ(v)}
        searchPlaceholder="Search by name…"
        emptyMessage="No committees yet — click '+ New committee' to add one."
        filters={
          <label className="row gap-1" style={{ fontSize: '.8125rem', color: 'var(--muted-foreground)' }}>
            <input type="checkbox" checked={includeInactive}
                   onChange={(e) => setIncludeInactive(e.target.checked)} />
            Show disabled
          </label>
        }
      />

      {editingId !== null && (
        <CommitteeDrawer
          committeeId={editingId === 'new' ? null : editingId}
          onClose={() => setEditingId(null)}
          onSaved={refresh}
          showToast={showToast}
        />
      )}

      <style>{`
        .admin-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .8125rem; font-weight: 600;
          background: var(--muted, #f5f5f4);
          padding: .15rem .4rem; border-radius: .25rem;
        }
        .admin-pill {
          display: inline-block; padding: .15rem .55rem; border-radius: 999px;
          font-size: .7rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-active   { background: #dcfce7; color: #166534; }
        .admin-pill-inactive { background: #f1f5f9; color: #64748b; }
      `}</style>
    </AdminLayout>
  );
}

function CommitteeDrawer({ committeeId, onClose, onSaved, showToast }) {
  const isNew = !committeeId;
  const [form, setForm] = useState(EMPTY_FORM);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);

  // Load detail when editing.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    adminFetch(`/api/admin/committees/${committeeId}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setForm({
          code: d.code ?? '',
          name: d.name ?? '',
          description: d.description ?? '',
          active: d.active ?? true,
        });
        setCodeTouched(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [committeeId, isNew]);

  function setField(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Auto-derive code from name in create mode until the user edits it manually.
      if (k === 'name' && isNew && !codeTouched) next.code = autoCode(v);
      return next;
    });
  }

  async function save() {
    if (!form.name.trim()) { showToast?.('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        active: !!form.active,
      };
      if (isNew) {
        await adminFetch('/api/admin/committees', { method: 'POST', body });
        showToast?.('Committee created', 'success');
      } else {
        await adminFetch(`/api/admin/committees/${committeeId}`, { method: 'PATCH', body });
        showToast?.('Committee updated', 'success');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function hardDelete() {
    if (!confirm(`Permanently delete "${detail?.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/committees/${committeeId}`, { method: 'DELETE' });
      showToast?.('Committee deleted', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const canDelete = !isNew && detail && detail.events_count === 0 && detail.active_role_count === 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'New committee' : (detail?.name || 'Edit committee')}
      width={560}
      footer={
        <>
          {!isNew && (
            <button type="button" className="btn btn-ghost" onClick={hardDelete}
                    disabled={saving || !canDelete}
                    title={canDelete ? 'Delete permanently' : 'Cannot delete — events or roles still reference this committee'}
                    style={{ padding: '.5rem .85rem', color: 'var(--destructive)', marginRight: 'auto' }}>
              Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || loading} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : (isNew ? 'Create committee' : 'Save changes')}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="admin-form-grid">
          <ShimmerFormField span={2} />
          <ShimmerFormField span={2} />
          <ShimmerFormField span={2} />
          <ShimmerFormField span={2} />
        </div>
      ) : (
        <div className="admin-form-grid">
          <FormField label="Name" required span={2}>
            <input className="input-base" value={form.name}
                   onChange={(e) => setField('name', e.target.value)}
                   placeholder="e.g. CPE Committee" />
          </FormField>

          <FormField label="Short code" required hint="Used in URLs and lookups. Uppercase letters, numbers, underscores. Auto-derived from name." span={2}>
            <input className="input-base admin-mono-input" value={form.code}
                   onChange={(e) => { setField('code', e.target.value); setCodeTouched(true); }}
                   placeholder="e.g. CPE, WICASA, DIRECT_TAX" />
          </FormField>

          <FormField label="Description" span={2}>
            <textarea className="input-base" rows={3} value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      placeholder="What does this committee do?" />
          </FormField>

          <FormField label="Status" span={2}>
            <label className="row gap-1" style={{ fontSize: '.875rem' }}>
              <input type="checkbox" checked={form.active}
                     onChange={(e) => setField('active', e.target.checked)} />
              Active (visible in event creation, role assignment)
            </label>
          </FormField>

          {!isNew && detail && (
            <div className="admin-callout" style={{ gridColumn: 'span 2' }}>
              <div><strong>{detail.events_count}</strong> event{detail.events_count !== 1 ? 's' : ''} reference this committee.</div>
              <div><strong>{detail.active_role_count}</strong> active role assignment{detail.active_role_count !== 1 ? 's' : ''}.</div>
              {!canDelete && <div className="muted-text" style={{ marginTop: '.4rem', fontSize: '.75rem' }}>To remove this committee, reassign its events and end role terms first — or just disable it.</div>}
            </div>
          )}
        </div>
      )}

      <style>{`
        .admin-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem 1rem; }
        .admin-mono-input { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .admin-callout {
          padding: .75rem .875rem; background: var(--muted, #f5f5f4);
          border-radius: .375rem; font-size: .8125rem; color: var(--muted-foreground);
          display: flex; flex-direction: column; gap: .2rem;
        }
      `}</style>
    </Drawer>
  );
}
