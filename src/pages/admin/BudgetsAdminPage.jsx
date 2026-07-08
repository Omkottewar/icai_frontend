import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { IconPlus, IconEdit, IconTrash, IconX } from '../../icons';
import { apiWrite } from '../../lib/apiCache';
import { toast } from '../../lib/notify';

// Budget planning workbench. One row per (FY, committee, category);
// actuals are computed from bills at read time via /rollup.
//
// UX shape: FY selector → matrix view (committees × categories) with
// planned + actual + variance in each cell. An empty cell means "no
// budget planned" — clicking it opens the edit modal.

const FMT_INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function fmtPaise(paise) { return paise == null ? '—' : FMT_INR.format(Number(paise) / 100); }
function currentFyStart() {
  const n = new Date();
  return n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1;
}
function fyLabel(y) { return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`; }

export default function BudgetsAdminPage() {
  const fyNow = currentFyStart();
  const [fy, setFy] = useState(fyNow);
  const [rollup, setRollup] = useState(null);
  const [committees, setCommittees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`/api/admin/budgets/rollup?fy=${fy}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load rollup');
      const j = await r.json();
      setRollup(j);
    } catch (e) { setErr(e.message); setRollup({ rows: [], totals: {} }); }
  }, [fy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/committees', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/expense-categories', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([c, cat]) => {
      setCommittees(c.rows || []);
      setCategories((cat.rows || []).filter((r) => r.active));
    });
  }, []);

  async function save(row) {
    try {
      await apiWrite('/api/admin/budgets', {
        method: 'POST',
        body: {
          fy_start_year: fy,
          committee_id: row.committee_id || null,
          category_id: row.category_id,
          planned_paise: Math.round(Number(row._planned_rupees) * 100),
          notes: row.notes?.trim() || null,
        },
      });
      setEditing(null);
      load();
    } catch (e) { toast.error(e?.message || 'Save failed'); }
  }
  async function remove(rowId) {
    if (!confirm('Delete this budget line?')) return;
    try {
      await apiWrite(`/api/admin/budgets/${rowId}`, { method: 'DELETE' });
      load();
    } catch (e) { toast.error(e?.message || 'Delete failed'); }
  }

  const fys = [fyNow + 1, fyNow, fyNow - 1, fyNow - 2];
  const totals = rollup?.totals || {};
  const overUtilised = (totals.utilisation ?? 0) > 1;

  return (
    <AdminLayout
      title="Budgets"
      subtitle="Plan the FY budget by committee × category. Actuals update automatically as bills are approved."
      actions={
        <div className="row gap-2">
          <select className="input-base" value={fy} onChange={(e) => setFy(Number(e.target.value))} style={{ padding: '.35rem .6rem', fontSize: '.8125rem' }}>
            {fys.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setEditing({ committee_id: '', category_id: categories[0]?.id || '', _planned_rupees: '', notes: '' })}>
            <IconPlus size="sm" /> Add line
          </button>
        </div>
      }
    >
      {err && <div className="card" style={{ color: 'var(--destructive)', fontSize: '.875rem', marginBottom: '1rem' }}>{err}</div>}

      {/* Totals strip */}
      <div style={{ display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.25rem' }}>
        <BudgetStat label={`Planned · ${fyLabel(fy)}`} value={fmtPaise(totals.planned_paise)} />
        <BudgetStat label="Actual YTD" value={fmtPaise(totals.actual_paise)} tone={overUtilised ? 'warn' : 'default'} />
        <BudgetStat label="Variance" value={fmtPaise(totals.variance_paise)} tone={totals.variance_paise > 0 ? 'warn' : 'good'} />
        <BudgetStat label="Utilisation" value={totals.utilisation == null ? '—' : `${Math.round((totals.utilisation || 0) * 100)}%`} tone={overUtilised ? 'warn' : 'default'} />
      </div>

      {rollup === null ? (
        <div className="card">Loading…</div>
      ) : (rollup.rows || []).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--muted-foreground)' }}>
          <div style={{ fontSize: '2rem', opacity: .4 }}>📊</div>
          <h3 style={{ marginTop: '.5rem', fontWeight: 600 }}>No budget planned for {fyLabel(fy)}</h3>
          <p style={{ marginTop: '.4rem', fontSize: '.875rem' }}>
            Click <strong>Add line</strong> to plan the first row — pick a committee (or leave blank for branch-wide) and a category.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="insight-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Committee</th>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th style={{ textAlign: 'right' }}>Planned</th>
                <th style={{ textAlign: 'right' }}>Actual</th>
                <th style={{ textAlign: 'right' }}>Variance</th>
                <th style={{ textAlign: 'right' }}>Utilisation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rollup.rows.map((r) => {
                const util = r.utilisation;
                const over = util != null && util > 1;
                return (
                  <tr key={`${r.committee_id ?? '_'}::${r.category_id}`}>
                    <td>{r.committee_name || <span className="muted-text">— Branch-wide —</span>}</td>
                    <td>{r.category_label}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtPaise(r.planned_paise)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(r.actual_paise)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.variance_paise > 0 ? 'var(--destructive)' : 'oklch(0.45 0.15 145)', fontWeight: 500 }}>
                      {r.variance_paise > 0 ? '+' : ''}{fmtPaise(r.variance_paise)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {util == null ? <span className="muted-text">—</span> : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: over ? 'var(--destructive)' : 'inherit' }}>
                          {Math.round(util * 100)}%
                          <span style={{ display: 'inline-block', width: 60, height: 6, borderRadius: 999, background: 'var(--muted)', overflow: 'hidden' }}>
                            <span style={{ display: 'block', width: `${Math.min(100, util * 100)}%`, height: '100%', background: over ? 'var(--destructive)' : 'oklch(0.55 0.16 145)' }} />
                          </span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="row gap-2">
                        <button className="btn btn-outline" style={{ fontSize: '.75rem', padding: '.25rem .5rem' }} onClick={() => setEditing({
                          id: `${r.committee_id ?? ''}::${r.category_id}`,  // synthetic key for edit UI
                          committee_id: r.committee_id || '',
                          category_id: r.category_id,
                          _planned_rupees: (r.planned_paise / 100).toString(),
                          notes: '',
                        })}>
                          <IconEdit size="sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Uncategorised actuals row — bills that landed without a matching budget line */}
          {(rollup.uncategorised || []).length > 0 && (
            <div className="card" style={{ marginTop: '1rem', background: 'oklch(0.97 0.02 60)', borderLeft: '3px solid oklch(0.55 0.15 60)' }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'oklch(0.35 0.15 60)' }}>
                {rollup.uncategorised.length} unplanned {rollup.uncategorised.length === 1 ? 'spend line' : 'spend lines'}
              </div>
              <p style={{ fontSize: '.8125rem', marginTop: '.25rem', color: 'var(--muted-foreground)' }}>
                Bills exist for (committee, category) combinations that aren't in this year's budget.
                Add a budget line for them so they show up in variance next year.
              </p>
            </div>
          )}
        </div>
      )}

      {editing && (
        <BudgetEditModal
          initial={editing}
          committees={committees}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={editing.id && !editing.id.includes('::') ? () => remove(editing.id) : null}
        />
      )}
    </AdminLayout>
  );
}

function BudgetStat({ label, value, tone = 'default' }) {
  const toneColor = tone === 'warn' ? 'var(--destructive)' : tone === 'good' ? 'oklch(0.45 0.15 145)' : 'var(--foreground)';
  return (
    <div className="card" style={{ padding: '.75rem 1rem' }}>
      <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '.25rem', fontVariantNumeric: 'tabular-nums', color: toneColor }}>{value}</div>
    </div>
  );
}

function BudgetEditModal({ initial, committees, categories, onClose, onSave, onDelete }) {
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
      <div className="dialog-shell" role="dialog" aria-modal="true" style={{ width: 'min(32rem, 100%)' }}>
        <div className="dialog-header">
          <h2 className="dialog-title">Budget line</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dialog-body">
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Committee</div>
            <select className="input-base" value={form.committee_id || ''} onChange={(e) => patch('committee_id', e.target.value)}>
              <option value="">— Branch-wide —</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginTop: '.65rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Category *</div>
            <select className="input-base" required value={form.category_id || ''} onChange={(e) => patch('category_id', e.target.value)}>
              <option value="">— Pick a category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginTop: '.65rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Planned amount (₹) *</div>
            <input type="number" min="0" step="1" className="input-base" required value={form._planned_rupees || ''} onChange={(e) => patch('_planned_rupees', e.target.value)} placeholder="e.g. 45000" />
          </label>
          <label style={{ display: 'block', marginTop: '.65rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Notes</div>
            <textarea className="input-base" rows={2} value={form.notes || ''} onChange={(e) => patch('notes', e.target.value.slice(0, 500))} placeholder="e.g. Includes GST + 10% contingency" style={{ resize: 'vertical' }} />
          </label>
        </div>
        <div className="dialog-footer">
          {onDelete && (
            <button className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)', marginRight: 'auto' }} onClick={onDelete} disabled={busy}>
              <IconTrash size="sm" /> Delete
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => { setBusy(true); try { await onSave(form); } finally { setBusy(false); } }} disabled={busy || !form.category_id || !form._planned_rupees}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
