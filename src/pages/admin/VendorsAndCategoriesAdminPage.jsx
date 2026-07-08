import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { IconPlus, IconEdit, IconTrash, IconX } from '../../icons';
import { apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';

// Vendor directory + expense category catalogue combined into one page —
// they're small, related, and one flip of the sidebar is enough. Both are
// referenced by bills.vendor_id / bills.category_id.

export default function VendorsAndCategoriesAdminPage() {
  const [tab, setTab] = useState('vendors');
  return (
    <AdminLayout
      title="Vendors + categories"
      subtitle="Frequent vendors and the expense category catalogue that bills tag against"
    >
      <div className="row gap-1" role="tablist" style={{ borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
        {[
          { id: 'vendors',    label: 'Vendors' },
          { id: 'categories', label: 'Expense categories' },
        ].map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={'vc-tab' + (tab === t.id ? ' is-active' : '')}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'vendors' ? <VendorsPanel /> : <CategoriesPanel />}

      <style>{`
        .vc-tab {
          padding: .625rem .875rem; margin-bottom: -1px;
          background: none; border: 0; border-bottom: 2px solid transparent;
          font-size: .875rem; font-weight: 600; cursor: pointer;
          color: var(--muted-foreground);
        }
        .vc-tab:hover { color: var(--foreground); }
        .vc-tab.is-active { color: var(--primary); border-bottom-color: var(--primary); }
      `}</style>
    </AdminLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Vendors
// ═══════════════════════════════════════════════════════════════════════════
function VendorsPanel() {
  const [rows, setRows] = useState(null);
  const [categories, setCategories] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const r = await fetch('/api/admin/vendors?' + params, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load vendors');
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); setRows([]); }
  }, [q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/expense-categories', { credentials: 'include' })
      .then((r) => r.json()).then((j) => setCategories(j.rows || []))
      .catch(() => {});
  }, []);

  async function save(row) {
    const isNew = !row.id;
    const url = isNew ? '/api/admin/vendors' : `/api/admin/vendors/${row.id}`;
    const method = isNew ? 'POST' : 'PATCH';
    try {
      await apiWrite(url, { method, body: row });
      setEditing(null);
      load();
    } catch (e) { toast.error(e?.message || 'Save failed'); }
  }
  async function remove(row) {
    if (!confirm(`Delete "${row.name}"? This is only allowed if the vendor has no bills against it.`)) return;
    try {
      await apiWrite(`/api/admin/vendors/${row.id}`, { method: 'DELETE' });
      load();
    } catch (e) { toast.error(e?.message || 'Delete failed'); }
  }

  const categoryLabel = (id) => categories.find((c) => c.id === id)?.label || '—';

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.75rem', gap: '.75rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="input-base"
          placeholder="Search by name / GSTIN / PAN"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 240, padding: '.35rem .6rem', fontSize: '.8125rem' }}
        />
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', active: true })}>
          <IconPlus size="sm" /> Add vendor
        </button>
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          No vendors yet. Add the first one — it'll autofill when the treasurer types the name on a bill.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Contact</th>
                <th style={{ textAlign: 'left' }}>GSTIN</th>
                <th style={{ textAlign: 'left' }}>Default category</th>
                <th style={{ textAlign: 'right' }}>Bills</th>
                <th style={{ textAlign: 'left' }}>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="muted-text" style={{ fontSize: '.8125rem' }}>
                    {r.contact_person && <div>{r.contact_person}</div>}
                    {r.contact_phone && <div>{r.contact_phone}</div>}
                  </td>
                  <td className="muted-text" style={{ fontSize: '.75rem', fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.gstin || '—'}</td>
                  <td className="muted-text" style={{ fontSize: '.8125rem' }}>{categoryLabel(r.default_category_id)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.bill_count}</td>
                  <td className="muted-text" style={{ fontSize: '.75rem' }}>{r.active ? '✓ Active' : '— Hidden'}</td>
                  <td>
                    <div className="row gap-2">
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem' }} onClick={() => setEditing(r)}>
                        <IconEdit size="sm" />
                      </button>
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }} onClick={() => remove(r)}>
                        <IconTrash size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <VendorEditModal
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

function VendorEditModal({ initial, categories, onClose, onSave }) {
  const [form, setForm] = useState({ ...initial });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" style={{ width: 'min(36rem, 100%)' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">{form.id ? 'Edit vendor' : 'Add vendor'}</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body">
          <VcField label="Name *"><input className="input-base" required value={form.name || ''} onChange={(e) => patch('name', e.target.value.slice(0, 200))} /></VcField>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <VcField label="Contact person"><input className="input-base" value={form.contact_person || ''} onChange={(e) => patch('contact_person', e.target.value.slice(0, 120))} /></VcField>
            <VcField label="Contact phone"><input className="input-base" value={form.contact_phone || ''} onChange={(e) => patch('contact_phone', e.target.value.slice(0, 40))} /></VcField>
            <VcField label="Contact email"><input type="email" className="input-base" value={form.contact_email || ''} onChange={(e) => patch('contact_email', e.target.value.slice(0, 120))} /></VcField>
          </div>
          <VcField label="Address"><textarea className="input-base" rows={2} value={form.address || ''} onChange={(e) => patch('address', e.target.value.slice(0, 500))} style={{ resize: 'vertical' }} /></VcField>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <VcField label="GSTIN"><input className="input-base" value={form.gstin || ''} onChange={(e) => patch('gstin', e.target.value.slice(0, 20).toUpperCase())} placeholder="e.g. 27AAACT1234A1Z5" /></VcField>
            <VcField label="PAN"><input className="input-base" value={form.pan || ''} onChange={(e) => patch('pan', e.target.value.slice(0, 10).toUpperCase())} placeholder="e.g. AAACT1234A" /></VcField>
          </div>
          <VcField label="Default category" hint="Autofills on bill entry when this vendor is picked">
            <select className="input-base" value={form.default_category_id || ''} onChange={(e) => patch('default_category_id', e.target.value)}>
              <option value="">— None —</option>
              {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </VcField>
          <VcField label="Notes"><textarea className="input-base" rows={2} value={form.notes || ''} onChange={(e) => patch('notes', e.target.value.slice(0, 1000))} style={{ resize: 'vertical' }} /></VcField>
          <label className="row gap-2" style={{ marginTop: '.7rem', fontSize: '.8125rem' }}>
            <input type="checkbox" checked={form.active !== false} onChange={(e) => patch('active', e.target.checked)} />
            Active (shows in bill entry dropdown)
          </label>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => { setBusy(true); try { await onSave(form); } finally { setBusy(false); } }} disabled={busy || !form.name?.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VcField({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginTop: '.6rem' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>{label}</div>
      {children}
      {hint && <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.2rem' }}>{hint}</div>}
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════════════════════════════════
function CategoriesPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch('/api/admin/expense-categories', { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load categories');
      const j = await r.json();
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); setRows([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(row) {
    const isNew = !row.id;
    const url = isNew ? '/api/admin/expense-categories' : `/api/admin/expense-categories/${row.id}`;
    const method = isNew ? 'POST' : 'PATCH';
    try {
      await apiWrite(url, { method, body: row });
      setEditing(null);
      load();
    } catch (e) { toast.error(e?.message || 'Save failed'); }
  }
  async function remove(row) {
    if (!confirm(`Delete "${row.label}"?`)) return;
    try {
      await apiWrite(`/api/admin/expense-categories/${row.id}`, { method: 'DELETE' });
      load();
    } catch (e) { toast.error(e?.message || 'Delete failed'); }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <div className="muted-text" style={{ fontSize: '.875rem' }}>
          {rows === null ? 'Loading…' : `${rows.length} categories`}
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ kind: 'expense', active: true, sort_order: 500 })}>
          <IconPlus size="sm" /> Add category
        </button>
      </div>

      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {rows === null ? (
        <div className="card">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          No categories yet. The migration seeded 11 defaults — if you don't see them, run the migration.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Label</th>
                <th style={{ textAlign: 'left' }}>Code</th>
                <th style={{ textAlign: 'left' }}>Kind</th>
                <th style={{ textAlign: 'right' }}>Bills</th>
                <th style={{ textAlign: 'right' }}>Sort</th>
                <th style={{ textAlign: 'left' }}>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.label}</div>
                    {r.description && <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.description}</div>}
                  </td>
                  <td className="muted-text" style={{ fontSize: '.75rem', fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.code}</td>
                  <td className="muted-text" style={{ fontSize: '.8125rem' }}>{r.kind}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.bill_count}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.sort_order}</td>
                  <td className="muted-text" style={{ fontSize: '.75rem' }}>{r.active ? '✓ Active' : '— Hidden'}</td>
                  <td>
                    <div className="row gap-2">
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem' }} onClick={() => setEditing(r)}>
                        <IconEdit size="sm" />
                      </button>
                      <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }} onClick={() => remove(r)}>
                        <IconTrash size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <CategoryEditModal initial={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function CategoryEditModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ ...initial });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="dialog-overlay" role="presentation"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" style={{ width: 'min(30rem, 100%)' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">{form.id ? 'Edit category' : 'Add category'}</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body">
          <VcField label="Label *"><input className="input-base" required value={form.label || ''} onChange={(e) => patch('label', e.target.value.slice(0, 120))} /></VcField>
          <VcField label="Code" hint="Auto-derived from the label if left blank. Lowercase snake_case."><input className="input-base" value={form.code || ''} onChange={(e) => patch('code', e.target.value.slice(0, 40))} placeholder="e.g. venue_rental" /></VcField>
          <VcField label="Description"><input className="input-base" value={form.description || ''} onChange={(e) => patch('description', e.target.value.slice(0, 200))} /></VcField>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <VcField label="Kind">
              <select className="input-base" value={form.kind || 'expense'} onChange={(e) => patch('kind', e.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </VcField>
            <VcField label="Sort order"><input type="number" className="input-base" value={form.sort_order ?? 0} onChange={(e) => patch('sort_order', Number(e.target.value) || 0)} /></VcField>
          </div>
          <label className="row gap-2" style={{ marginTop: '.7rem', fontSize: '.8125rem' }}>
            <input type="checkbox" checked={form.active !== false} onChange={(e) => patch('active', e.target.checked)} />
            Active (visible in bill entry dropdown)
          </label>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => { setBusy(true); try { await onSave(form); } finally { setBusy(false); } }} disabled={busy || !form.label?.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
