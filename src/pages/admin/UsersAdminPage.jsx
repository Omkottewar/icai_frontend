import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import Drawer from '../../components/admin/Drawer';
import FormField from '../../components/admin/FormField';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { ShimmerFormField } from '../../components/ui/Shimmer';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  primary_role: 'member',
  status: 'active',
  branch_id: '',
};

const EMPTY_ROLE_FORM = {
  role_code: '',
  scope_branch_id: '',
  scope_committee_id: '',
};

const PRIMARY_ROLES = ['member', 'student', 'employer', 'employee', 'mcm', 'chairman', 'admin', 'staff'];
const STATUSES = ['active', 'inactive', 'suspended'];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

// Human-readable scope label for the role dropdown.
function roleScopeLabel(role) {
  if (role.scope === 'global')    return role.singleton_per_scope ? 'global, one only' : 'global';
  if (role.scope === 'branch')    return role.singleton_per_scope ? 'one per branch'    : 'branch (multiple)';
  if (role.scope === 'committee') return role.singleton_per_scope ? 'one per committee' : 'committee (multiple)';
  return role.scope;
}

export default function UsersAdminPage() {
  const { showToast } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [primaryRole, setPrimaryRole] = useState('');
  const [q, setQ] = useState('');

  const [editingId, setEditingId] = useState(null); // null | 'new' | uuid
  const drawerOpen = editingId !== null;
  const isNew = editingId === 'new';

  const { data, loading, refresh } = useAdminList('/api/admin/users', {
    page, pageSize: 25, status, primary_role: primaryRole, q,
  });
  const { data: lookups } = useAdminList('/api/admin/users/_meta/lookups');

  const columns = useMemo(() => [
    { key: 'name', header: 'Name', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.name}</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.email}</div>
      </div>
    )},
    { key: 'primary_role', header: 'Primary', render: (r) => (
      <span className="admin-chip">{r.primary_role}</span>
    ), width: 110 },
    { key: 'active_roles', header: 'Active roles', render: (r) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem' }}>
        {(r.active_roles ?? []).length === 0 && <span className="muted-text">—</span>}
        {(r.active_roles ?? []).map((a) => (
          <span key={a.assignment_id} className="admin-chip" title={a.role_name}>{a.role_code}</span>
        ))}
      </div>
    )},
    { key: 'status', header: 'Status', render: (r) => (
      <span className={'admin-pill admin-pill-' + r.status}>{r.status}</span>
    ), width: 100 },
    { key: 'last_login_at', header: 'Last login', render: (r) => fmtDate(r.last_login_at), width: 120 },
  ], []);

  return (
    <AdminLayout
      title="Users & roles"
      subtitle="Create privileged accounts and assign branch / committee roles"
      actions={
        <button className="btn btn-primary" onClick={() => setEditingId('new')} style={{ padding: '.5rem 1rem' }}>
          + New user
        </button>
      }
    >
      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        onRowClick={(r) => setEditingId(r.id)}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Search by name or email…"
        emptyMessage="No users match these filters."
        filters={
          <>
            <select className="input-base" style={{ padding: '.375rem .5rem', maxWidth: 160 }}
                    value={primaryRole} onChange={(e) => { setPrimaryRole(e.target.value); setPage(1); }}>
              <option value="">All primary roles</option>
              {PRIMARY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="input-base" style={{ padding: '.375rem .5rem', maxWidth: 140 }}
                    value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        }
      />

      {drawerOpen && (
        <UserDrawer
          userId={isNew ? null : editingId}
          lookups={lookups}
          onClose={() => setEditingId(null)}
          onSaved={() => { refresh(); }}
          showToast={showToast}
        />
      )}

      <style>{`
        .admin-chip {
          display: inline-block; padding: .15rem .5rem; border-radius: 999px;
          background: var(--muted, #f5f5f4); color: var(--foreground);
          font-size: .7rem; font-weight: 600; border: 1px solid var(--border);
        }
        .admin-pill {
          display: inline-block; padding: .15rem .55rem; border-radius: 999px;
          font-size: .7rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-active    { background: #dcfce7; color: #166534; }
        .admin-pill-inactive  { background: #f1f5f9; color: #475569; }
        .admin-pill-suspended { background: #fee2e2; color: #991b1b; }
        .admin-section-title {
          font-size: .75rem; text-transform: uppercase; letter-spacing: .06em;
          color: var(--muted-foreground); font-weight: 700;
          margin: 1.5rem 0 .75rem;
        }
      `}</style>
    </AdminLayout>
  );
}

// ─── Drawer (create OR edit) ─────────────────────────────────────────────
function UserDrawer({ userId, lookups, onClose, onSaved, showToast }) {
  const isNew = !userId;
  const [form, setForm] = useState(EMPTY_FORM);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Only the Nagpur branch exists today, so the branch picker is gone from
  // the UI and we silently default to whatever lookups returns first.
  useEffect(() => {
    if (!isNew) return;
    const defaultBranch = lookups?.branches?.[0]?.id;
    if (!defaultBranch) return;
    setForm((f) => f.branch_id ? f : { ...f, branch_id: defaultBranch });
  }, [isNew, lookups?.branches]);

  // Load user detail when editing.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    adminFetch(`/api/admin/users/${userId}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setForm({
          name: d.name ?? '',
          email: d.email ?? '',
          phone: d.phone ?? '',
          primary_role: d.primary_role ?? 'member',
          status: d.status ?? 'active',
          branch_id: d.branch_id ?? '',
        });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [userId, isNew]);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true); setError(null);
    try {
      const body = { ...form, branch_id: form.branch_id || null };
      if (isNew) {
        const created = await adminFetch('/api/admin/users', { method: 'POST', body });
        showToast?.('User created — they can now sign in with this email via Auth0', 'success');
        onSaved?.();
        onClose?.();
        // Could navigate to the new user's drawer here, but the user is
        // listed at the top after refresh — admin can click in.
        return created;
      } else {
        const updated = await adminFetch(`/api/admin/users/${userId}`, { method: 'PATCH', body });
        showToast?.('User updated', 'success');
        onSaved?.();
        return updated;
      }
    } catch (e) {
      setError(e.message);
      showToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reloadDetail() {
    if (isNew) return;
    const d = await adminFetch(`/api/admin/users/${userId}`);
    setDetail(d);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'New user' : (detail?.name || 'Edit user')}
      width={620}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || loading} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Saving…' : (isNew ? 'Create user' : 'Save changes')}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="admin-form-grid">
          <ShimmerFormField span={2} />
          <ShimmerFormField />
          <ShimmerFormField />
          <ShimmerFormField span={2} />
          <ShimmerFormField span={2} />
        </div>
      ) : (
        <>
          {error && <div className="admin-error">{error}</div>}

          <div className="admin-form-grid">
            <FormField label="Full name" required span={2}>
              <input className="input-base" value={form.name}
                     onChange={(e) => setField('name', e.target.value)} />
            </FormField>

            <FormField label="Email" required>
              <input className="input-base" type="email" value={form.email}
                     onChange={(e) => setField('email', e.target.value)} />
            </FormField>

            <FormField label="Phone">
              <input className="input-base" value={form.phone}
                     onChange={(e) => setField('phone', e.target.value)} placeholder="+91 …" />
            </FormField>

            <FormField label="Status" required span={2}>
              <select className="input-base" value={form.status}
                      onChange={(e) => setField('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          {isNew && (
            <div className="admin-callout">
              <strong>How sign-in works:</strong> the user authenticates via Auth0 with their email. On first sign-in their account is auto-linked to this profile. No password is set here.
            </div>
          )}

          {!isNew && (
            <RolesSection
              userId={userId}
              assignments={detail?.role_assignments ?? []}
              lookups={lookups}
              onChanged={reloadDetail}
              showToast={showToast}
            />
          )}
        </>
      )}

      <style>{`
        .admin-form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: .875rem 1rem;
        }
        .admin-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: .625rem .875rem; border-radius: .375rem; font-size: .8125rem;
          margin-bottom: 1rem;
        }
        .admin-callout {
          margin-top: 1rem; padding: .75rem .875rem;
          background: var(--muted, #f5f5f4); border-radius: .375rem;
          font-size: .8125rem; color: var(--muted-foreground);
        }
      `}</style>
    </Drawer>
  );
}

// ─── Role assignments sub-panel ──────────────────────────────────────────
function RolesSection({ userId, assignments, lookups, onChanged, showToast }) {
  const [adding, setAdding] = useState(false);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [busy, setBusy] = useState(false);

  const active = assignments.filter((a) => !a.effective_to || new Date(a.effective_to) >= new Date(new Date().toDateString()));
  const past   = assignments.filter((a) => a.effective_to && new Date(a.effective_to) < new Date(new Date().toDateString()));

  const selectedRole = (lookups?.roles ?? []).find((r) => r.code === roleForm.role_code);
  const needsBranch = selectedRole?.scope === 'branch';
  const needsCommittee = selectedRole?.scope === 'committee';

  // Branch picker is gone (only Nagpur exists). When a branch-scoped role
  // is picked, silently use the default branch from lookups so the backend
  // still gets a scope_branch_id without forcing the admin to pick.
  const defaultBranchId = lookups?.branches?.[0]?.id;

  async function addRole() {
    if (!roleForm.role_code) { showToast?.('Pick a role', 'error'); return; }
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/roles`, {
        method: 'POST',
        body: {
          role_code: roleForm.role_code,
          // For branch-scoped roles auto-fill with Nagpur. For others stay
          // explicit / null as before.
          scope_branch_id: needsBranch ? (roleForm.scope_branch_id || defaultBranchId || null) : (roleForm.scope_branch_id || null),
          scope_committee_id: roleForm.scope_committee_id || null,
        },
      });
      showToast?.('Role assigned', 'success');
      setRoleForm(EMPTY_ROLE_FORM);
      setAdding(false);
      onChanged?.();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function endTerm(assignmentId) {
    if (!confirm('End this role assignment as of today?')) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/roles/${assignmentId}`, { method: 'DELETE' });
      showToast?.('Role assignment ended', 'success');
      onChanged?.();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Active roles ({active.length})</span>
        {!adding && (
          <button type="button" className="btn btn-outline" onClick={() => setAdding(true)} style={{ padding: '.25rem .6rem', fontSize: '.75rem' }}>
            + Assign role
          </button>
        )}
      </div>

      {active.length === 0 && <p className="muted-text" style={{ fontSize: '.8125rem' }}>No active role assignments.</p>}

      {active.length > 0 && (
        <ul className="role-list">
          {active.map((a) => (
            <li key={a.assignment_id} className="role-list-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{a.role_name}</div>
                <div className="muted-text" style={{ fontSize: '.75rem' }}>
                  {a.role_code}
                  {a.committee_name && ` · Committee: ${a.committee_name}`}
                  {' · Since '}{fmtDate(a.effective_from)}
                </div>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => endTerm(a.assignment_id)} disabled={busy} style={{ padding: '.25rem .5rem', fontSize: '.75rem', color: 'var(--destructive)' }}>
                End term
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="role-add-card">
          <div className="admin-form-grid">
            <FormField label="Role" required span={2}>
              <select className="input-base" value={roleForm.role_code}
                      onChange={(e) => setRoleForm((f) => ({ ...f, role_code: e.target.value, scope_branch_id: '', scope_committee_id: '' }))}>
                <option value="">— Select role —</option>
                {(lookups?.roles ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} — {roleScopeLabel(r)}
                  </option>
                ))}
              </select>
            </FormField>

            {needsCommittee && (
              <FormField label="Committee" required span={2}>
                <select className="input-base" value={roleForm.scope_committee_id}
                        onChange={(e) => setRoleForm((f) => ({ ...f, scope_committee_id: e.target.value }))}>
                  <option value="">— Select committee —</option>
                  {(lookups?.committees ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
          <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: '.75rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setAdding(false); setRoleForm(EMPTY_ROLE_FORM); }} disabled={busy} style={{ padding: '.4rem .75rem' }}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={addRole} disabled={busy} style={{ padding: '.4rem .85rem' }}>
              {busy ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <>
          <div className="admin-section-title">Past assignments ({past.length})</div>
          <ul className="role-list role-list-past">
            {past.map((a) => (
              <li key={a.assignment_id} className="role-list-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{a.role_name}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>
                    {a.role_code}
                    {a.committee_name && ` · ${a.committee_name}`}
                    {' · '}{fmtDate(a.effective_from)} → {fmtDate(a.effective_to)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <style>{`
        .role-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .375rem; }
        .role-list-item {
          display: flex; align-items: center; gap: .5rem;
          padding: .625rem .75rem; border: 1px solid var(--border); border-radius: .375rem;
          background: var(--card);
        }
        .role-list-past .role-list-item { opacity: .65; }
        .role-add-card {
          margin-top: .75rem; padding: .875rem;
          background: var(--muted, #f5f5f4); border-radius: .5rem;
          border: 1px dashed var(--border);
        }
      `}</style>
    </>
  );
}
