import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Drawer from '../../components/admin/Drawer';
import { useAuth } from '../../context/AuthContext';
import { useRoute, navigate } from '../../hooks/useRoute';
import { QUESTION_TYPES, newQuestion } from '../../lib/checklistQuestions';
import QuestionEditor from '../../components/checklists/QuestionEditor';
import QuestionRenderer from '../../components/checklists/QuestionRenderer';
import { IconPlus, IconCopy, IconTrash, IconCheckCircle, IconEdit, IconEye } from '../../icons';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ChecklistTemplatesAdminPage() {
  const route = useRoute();
  const editingId = route.query.edit || null;
  const previewId = route.query.preview || null;

  return (
    <AdminLayout
      title="Checklist templates"
      subtitle="Build reusable forms — radio, dropdown, text, files, and more."
      actions={<NewButton />}
    >
      <TemplateList onEdit={(id) => navigate('/admin/checklist-templates?edit=' + id)}
                    onPreview={(id) => navigate('/admin/checklist-templates?preview=' + id)} />

      {editingId && (
        <BuilderDrawer
          id={editingId === 'new' ? null : editingId}
          onClose={() => navigate('/admin/checklist-templates')}
        />
      )}
      {previewId && (
        <PreviewDrawer
          id={previewId}
          onClose={() => navigate('/admin/checklist-templates')}
        />
      )}
    </AdminLayout>
  );
}

function NewButton() {
  return (
    <button
      className="btn-primary"
      onClick={() => navigate('/admin/checklist-templates?edit=new')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
    >
      <IconPlus size="sm" /> New template
    </button>
  );
}

function TemplateList({ onEdit, onPreview }) {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const j = await api('/api/checklist-templates');
      setRows(j.rows || []);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  // Re-fetch when the URL drops back to the list view (drawer closed).
  const route = useRoute();
  useEffect(() => {
    if (!route.query.edit && !route.query.preview) load();
  }, [route.query.edit, route.query.preview]);

  const onPublish = async (row) => {
    if (!confirm(`Publish "${row.name}"? After publishing, you'll need to clone a new version to edit it.`)) return;
    try {
      await api(`/api/checklist-templates/${row.id}/publish`, { method: 'POST' });
      showToast?.('Published', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const onClone = async (row, fork) => {
    try {
      const j = await api(`/api/checklist-templates/${row.id}/clone${fork ? '?fork=1' : ''}`, { method: 'POST' });
      showToast?.(fork ? 'New template created' : 'New draft version', 'success');
      onEdit(j.id);
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const onDelete = async (row) => {
    if (!confirm(`Delete "${row.name}" v${row.version}?`)) return;
    try {
      await api(`/api/checklist-templates/${row.id}`, { method: 'DELETE' });
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  if (err) return <p style={{ color: 'var(--destructive)' }}>{err}</p>;
  if (rows === null) return <p className="muted-text">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p className="muted-text">No templates yet. Click <strong>New template</strong> to build your first one.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {rows.map((r) => (
        <div key={r.id} className="tpl-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '.95rem' }}>{r.name}</strong>
              <span className="muted-text" style={{ fontSize: '.75rem' }}>v{r.version}</span>
              <PublishedPill v={r.is_published} />
              {r.version_count > 1 && (
                <span className="muted-text" style={{ fontSize: '.75rem' }}>· {r.version_count} versions</span>
              )}
            </div>
            <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.15rem' }}>
              {r.description || <em>No description</em>} · Updated {fmt(r.updated_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.25rem' }}>
            <button title="Preview" onClick={() => onPreview(r.id)}><IconEye size="sm" /></button>
            {r.is_published ? (
              <button title="Clone for new version" onClick={() => onClone(r, false)}><IconCopy size="sm" /></button>
            ) : (
              <>
                <button title="Edit" onClick={() => onEdit(r.id)}><IconEdit size="sm" /></button>
                <button title="Publish" onClick={() => onPublish(r)} style={{ color: 'var(--secondary, #16a34a)' }}><IconCheckCircle size="sm" /></button>
              </>
            )}
            <button title="Duplicate as new template" onClick={() => onClone(r, true)}><IconCopy size="sm" /></button>
            <button title="Delete" onClick={() => onDelete(r)} style={{ color: 'var(--destructive, #dc2626)' }}><IconTrash size="sm" /></button>
          </div>

          <style>{`
            .tpl-row {
              display: flex; align-items: center; gap: 1rem;
              padding: .875rem 1rem; background: var(--card);
              border: 1px solid var(--border); border-radius: .5rem;
            }
            .tpl-row button {
              background: transparent; border: 1px solid transparent; cursor: pointer;
              padding: .375rem; border-radius: .25rem; color: var(--muted-foreground);
            }
            .tpl-row button:hover { background: var(--background); color: var(--foreground); border-color: var(--border); }
          `}</style>
        </div>
      ))}
    </div>
  );
}

function PublishedPill({ v }) {
  return (
    <span style={{
      fontSize: '.65rem', fontWeight: 700, padding: '.1rem .5rem', borderRadius: 999,
      background: v ? '#dcfce7' : '#fef3c7',
      color: v ? '#166534' : '#92400e',
    }}>
      {v ? 'PUBLISHED' : 'DRAFT'}
    </span>
  );
}

// ─── Builder drawer ────────────────────────────────────────────────────────
function BuilderDrawer({ id, onClose }) {
  const { showToast } = useAuth();
  const isNew = !id;
  const [loading, setLoading] = useState(!isNew);
  const [meta, setMeta] = useState({ name: '', description: '', category: '', fill_role: '', review_role: '' });
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isNew) {
      setQuestions([newQuestion('short_text')]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const j = await api(`/api/checklist-templates/${id}`);
        if (cancelled) return;
        setMeta({
          name: j.template.name || '',
          description: j.template.description || '',
          category: j.template.category || '',
          fill_role: j.template.fill_role || '',
          review_role: j.template.review_role || '',
        });
        setQuestions((j.questions || []).map((q) => ({
          _draftId: `q_${q.id}`,
          id: q.id,
          type: q.type,
          label: q.label,
          help_text: q.help_text || '',
          required: q.required,
          config: q.config || {},
        })));
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const setQ = (idx, patch) => setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  const setCfg = (idx, patch) => setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, config: { ...q.config, ...patch } } : q));

  const move = (idx, dir) => {
    setQuestions((qs) => {
      const j = idx + dir;
      if (j < 0 || j >= qs.length) return qs;
      const copy = qs.slice();
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  };
  const remove = (idx) => setQuestions((qs) => qs.filter((_, i) => i !== idx));
  const duplicate = (idx) => setQuestions((qs) => {
    const src = qs[idx];
    return [...qs.slice(0, idx + 1), { ...src, _draftId: `q_${Math.random().toString(36).slice(2, 9)}`, id: undefined, label: src.label + ' (copy)' }, ...qs.slice(idx + 1)];
  });
  const add = (type) => setQuestions((qs) => [...qs, newQuestion(type)]);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      // Strip client-only keys before sending.
      const payloadQuestions = questions.map((q, i) => ({
        type: q.type,
        label: q.label,
        help_text: q.help_text || null,
        required: q.required,
        config: q.config || {},
        sort_order: i,
      }));
      if (!meta.name.trim()) throw new Error('Template name is required');
      if (payloadQuestions.length === 0) throw new Error('Add at least one question');
      for (const q of payloadQuestions) {
        if (!q.label.trim()) throw new Error('Every question needs a label');
      }

      const url = isNew ? '/api/checklist-templates' : `/api/checklist-templates/${id}`;
      const method = isNew ? 'POST' : 'PATCH';
      await api(url, { method, body: { ...meta, questions: payloadQuestions } });
      showToast?.('Saved', 'success');
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'New template' : 'Edit template'}
      width={920}
      footer={
        <>
          {err && <span style={{ color: 'var(--destructive)', marginRight: 'auto', fontSize: '.875rem' }}>{err}</span>}
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {loading ? <p className="muted-text">Loading…</p> : (
        <div className="bld-grid">
          <section>
            <h3 className="bld-section">Details</h3>
            <Field label="Name *">
              <input type="text" className="bld-input" value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
            </Field>
            <Field label="Description">
              <textarea className="bld-input" value={meta.description} rows={2} onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))} />
            </Field>
            <Field label="Category">
              <input type="text" className="bld-input" placeholder="e.g. Events, Compliance" value={meta.category} onChange={(e) => setMeta((m) => ({ ...m, category: e.target.value }))} />
            </Field>
            <div className="bld-row">
              <Field label="Fill role (optional)">
                <input type="text" className="bld-input" placeholder="e.g. committee_chairman" value={meta.fill_role} onChange={(e) => setMeta((m) => ({ ...m, fill_role: e.target.value }))} />
              </Field>
              <Field label="Review role (optional)">
                <input type="text" className="bld-input" placeholder="e.g. branch_chairman" value={meta.review_role} onChange={(e) => setMeta((m) => ({ ...m, review_role: e.target.value }))} />
              </Field>
            </div>

            <h3 className="bld-section" style={{ marginTop: '1.25rem' }}>Questions</h3>
            {questions.map((q, i) => (
              <QuestionEditor
                key={q._draftId}
                question={q}
                index={i}
                count={questions.length}
                onPatch={(p) => setQ(i, p)}
                onPatchConfig={(p) => setCfg(i, p)}
                onMove={(d) => move(i, d)}
                onRemove={() => remove(i)}
                onDuplicate={() => duplicate(i)}
              />
            ))}

            <AddQuestionMenu onAdd={add} />
          </section>

          <aside>
            <h3 className="bld-section">Live preview</h3>
            <div className="bld-preview">
              {questions.length === 0
                ? <p className="muted-text">Add a question to see the preview.</p>
                : questions.map((q) => (
                    <QuestionRenderer key={q._draftId} question={q} value={null} onChange={() => {}} />
                  ))
              }
            </div>
          </aside>

          <style>{`
            .bld-grid { display: grid; grid-template-columns: 1fr 360px; gap: 1.25rem; align-items: start; }
            .bld-section { font-size: .8125rem; font-weight: 700; color: var(--muted-foreground);
                           text-transform: uppercase; letter-spacing: .06em; margin: 0 0 .625rem; }
            .bld-input {
              width: 100%; padding: .45rem .6rem; border: 1px solid var(--border);
              border-radius: .375rem; background: var(--card); font: inherit; color: inherit;
            }
            .bld-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
            .bld-row { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
            .bld-preview {
              border: 1px solid var(--border); border-radius: .5rem;
              background: var(--background); padding: 1rem;
              position: sticky; top: 0; max-height: 80vh; overflow: auto;
            }
            @media (max-width: 1024px) {
              .bld-grid { grid-template-columns: 1fr; }
            }
          `}</style>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '.625rem' }}>
      <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '.25rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function AddQuestionMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => {
    const g = {};
    for (const t of QUESTION_TYPES) {
      (g[t.group] = g[t.group] || []).push(t);
    }
    return g;
  }, []);
  return (
    <div style={{ marginTop: '.5rem' }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '.4rem',
            padding: '.5rem .9rem', border: '1px dashed var(--primary)',
            color: 'var(--primary)', background: 'transparent', borderRadius: '.375rem', cursor: 'pointer',
          }}
        >
          <IconPlus size="sm" /> Add question
        </button>
      ) : (
        <div className="add-menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
            <strong style={{ fontSize: '.875rem' }}>Pick a question type</strong>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>Cancel</button>
          </div>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} style={{ marginBottom: '.5rem' }}>
              <div style={{ fontSize: '.6875rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{group}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '.375rem', marginTop: '.25rem' }}>
                {items.map((t) => (
                  <button key={t.type} onClick={() => { onAdd(t.type); setOpen(false); }} className="add-menu-btn">
                    <strong>{t.label}</strong>
                    <span className="muted-text" style={{ fontSize: '.75rem' }}>{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <style>{`
            .add-menu {
              border: 1px solid var(--border); border-radius: .5rem;
              padding: .75rem; background: var(--card);
            }
            .add-menu-btn {
              text-align: left; padding: .5rem .625rem;
              background: var(--background); border: 1px solid var(--border);
              border-radius: .375rem; cursor: pointer;
              display: flex; flex-direction: column; gap: .15rem;
            }
            .add-menu-btn:hover { border-color: var(--primary); }
          `}</style>
        </div>
      )}
    </div>
  );
}

// ─── Preview drawer (read-only, what the filler will see) ─────────────────
function PreviewDrawer({ id, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    api(`/api/checklist-templates/${id}`)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <Drawer open onClose={onClose} title="Preview" width={640}>
      {err && <p style={{ color: 'var(--destructive)' }}>{err}</p>}
      {!data ? <p className="muted-text">Loading…</p> : (
        <>
          <h2 style={{ marginTop: 0 }}>{data.template.name}</h2>
          {data.template.description && <p className="muted-text">{data.template.description}</p>}
          {data.questions.map((q) => (
            <QuestionRenderer key={q.id} question={q} value={null} onChange={() => {}} />
          ))}
        </>
      )}
    </Drawer>
  );
}
