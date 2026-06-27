import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Drawer from '../../components/admin/Drawer';
import { useAuth } from '../../context/AuthContext';
import { useRoute, navigate } from '../../hooks/useRoute';
import {
  QUESTION_TYPES, QUESTION_TYPE_MAP, POPULAR_TYPES,
  QUESTION_LIBRARY,
  SECTION_PRESETS,
  newQuestion, defaultConfig,
} from '../../lib/checklistQuestions';
import QuestionEditor from '../../components/checklists/QuestionEditor';
import QuestionRenderer from '../../components/checklists/QuestionRenderer';
import { IconPlus, IconCopy, IconTrash, IconCheckCircle, IconEdit, IconEye } from '../../icons';
import { Shimmer, ShimmerLines, ShimmerDrawerBody } from '../../components/ui/Shimmer';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';
import FlipMenu from '../../components/ui/FlipMenu';

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
  // Gallery state lives in the page (not the URL) — it's a transient picker
  // that closes the moment the user picks anything. Keeping it out of the
  // URL means the back button skips it cleanly.
  const [galleryOpen, setGalleryOpen] = useState(false);

  return (
    <AdminLayout
      title="Checklist templates"
      subtitle="Pick a ready-made template, tweak it, you're done."
      actions={<NewButton onClick={() => setGalleryOpen(true)} />}
    >
      <TemplateList onEdit={(id) => navigate('/admin/checklist-templates?edit=' + id)}
                    onPreview={(id) => navigate('/admin/checklist-templates?preview=' + id)}
                    onEmptyStateNew={() => setGalleryOpen(true)} />

      {galleryOpen && (
        <StarterGalleryDrawer
          onClose={() => setGalleryOpen(false)}
          onPicked={(newId) => {
            setGalleryOpen(false);
            navigate('/admin/checklist-templates?edit=' + newId);
          }}
          onStartBlank={() => {
            setGalleryOpen(false);
            navigate('/admin/checklist-templates?edit=new');
          }}
        />
      )}

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

function NewButton({ onClick }) {
  return (
    <button
      className="btn btn-primary"
      onClick={onClick}
    >
      <IconPlus size="sm" />
      <span>New template</span>
    </button>
  );
}

// ─── Starter gallery ───────────────────────────────────────────────────────
// The first thing a chairman sees when they click "+ New template". Shows
// the 4 curated, ready-to-use templates (CPE Seminar, Workshop, Study
// Circle, Post-Event Bills) as big clickable cards. Picking one clones it
// into a fresh draft and drops the user into the builder with everything
// pre-filled — typical create flow collapses from ~15 clicks to 2.
//
// "Start blank" is intentionally less prominent (text link, not a button)
// because virtually nobody should need it.
function StarterGalleryDrawer({ onClose, onPicked, onStartBlank }) {
  const { showToast } = useAuth();
  const [starters, setStarters] = useState(null);
  const [err, setErr] = useState('');
  const [picking, setPicking] = useState(null); // id currently being cloned

  useEffect(() => {
    let cancelled = false;
    api('/api/checklist-templates/starters')
      .then((j) => { if (!cancelled) setStarters(j.rows || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  const onUseStarter = async (starter) => {
    if (picking) return;
    setPicking(starter.id);
    try {
      // The backend auto-forks when source is a starter — we don't need
      // ?fork=1 explicitly, but pass it anyway to be unambiguous.
      const row = await api(`/api/checklist-templates/${starter.id}/clone?fork=1`, { method: 'POST' });
      showToast?.(`"${starter.name}" added to your templates`, 'success');
      onPicked(row.id);
    } catch (e) {
      showToast?.(e.message || 'Could not use this starter', 'error');
      setPicking(null);
    }
  };

  // Hand-tuned icon per starter name. If a new starter is seeded later,
  // it'll fall back to 📋 — fine for the rare new addition.
  const iconFor = (name) => {
    if (/cpe/i.test(name)) return '📚';
    if (/workshop|training/i.test(name)) return '🔧';
    if (/study circle/i.test(name)) return '👥';
    if (/bills|closure|post[- ]event/i.test(name)) return '💰';
    return '📋';
  };

  return (
    <Drawer open onClose={onClose} title="Start a new template" width={680}>
      <div className="sg-wrap">
        <p className="sg-lede">
          Pick a ready-made template. You'll be able to rename it and edit any item.
        </p>

        {err && <p style={{ color: 'var(--destructive)' }}>{err}</p>}
        {!starters && !err && (
          <div className="sg-grid" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                <Shimmer height="1rem" width="60%" />
                <ShimmerLines count={2} lastWidth="55%" />
              </div>
            ))}
          </div>
        )}

        {starters && (
          <div className="sg-grid">
            {starters.map((s) => (
              <button
                key={s.id}
                type="button"
                className="sg-card"
                disabled={!!picking}
                onClick={() => onUseStarter(s)}
              >
                <div className="sg-card-icon">{iconFor(s.name)}</div>
                <div className="sg-card-body">
                  <strong>{s.name}</strong>
                  <p className="sg-card-desc">{s.description}</p>
                  <span className="sg-card-meta">
                    {s.question_count} {s.question_count === 1 ? 'question' : 'questions'}
                    {s.section_count > 0 && ` · ${s.section_count} ${s.section_count === 1 ? 'section' : 'sections'}`}
                  </span>
                </div>
                <div className="sg-card-cta">
                  {picking === s.id ? 'Adding…' : 'Use →'}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="sg-blank">
          <span className="muted-text" style={{ fontSize: '.8125rem' }}>None of these fit?</span>
          <button type="button" className="sg-blank-btn" disabled={!!picking} onClick={onStartBlank}>
            Start with a blank template →
          </button>
        </div>

        <style>{`
          .sg-wrap { display: flex; flex-direction: column; gap: 1rem; }
          .sg-lede {
            margin: 0; font-size: .9rem; color: var(--muted-foreground);
          }
          .sg-grid {
            display: grid; gap: .625rem;
            grid-template-columns: 1fr;
          }
          .sg-card {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: .9rem; align-items: center;
            text-align: left;
            padding: .9rem 1rem;
            background: var(--card, white);
            border: 1px solid var(--border);
            border-radius: .5rem;
            cursor: pointer;
            transition: border-color .12s, transform .12s, box-shadow .12s;
          }
          .sg-card:hover:not(:disabled) {
            border-color: var(--primary, #1e40af);
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(30, 64, 175, .08);
          }
          .sg-card:disabled { opacity: .5; cursor: wait; }
          .sg-card-icon {
            font-size: 1.85rem; line-height: 1;
            width: 2.6rem; height: 2.6rem;
            display: flex; align-items: center; justify-content: center;
            background: rgba(37, 99, 235, .08);
            border-radius: .5rem;
          }
          .sg-card-body { min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
          .sg-card-body strong { font-size: .95rem; }
          .sg-card-desc {
            margin: 0; font-size: .8125rem; color: var(--muted-foreground);
            line-height: 1.35;
          }
          .sg-card-meta {
            font-size: .7rem; font-weight: 600;
            color: var(--muted-foreground);
            text-transform: uppercase; letter-spacing: .04em;
            margin-top: .15rem;
          }
          .sg-card-cta {
            font-size: .8125rem; font-weight: 700;
            color: var(--primary, #1e40af);
            white-space: nowrap;
          }
          .sg-blank {
            display: flex; align-items: center; justify-content: center; gap: .6rem;
            padding: .75rem; margin-top: .25rem;
            border-top: 1px dashed var(--border);
          }
          .sg-blank-btn {
            background: transparent; border: 0; cursor: pointer;
            font-size: .8125rem; font-weight: 600;
            color: var(--primary, #1e40af);
            padding: .25rem .5rem;
          }
          .sg-blank-btn:hover:not(:disabled) { text-decoration: underline; }
          .sg-blank-btn:disabled { opacity: .5; cursor: not-allowed; }
        `}</style>
      </div>
    </Drawer>
  );
}

function TemplateList({ onEdit, onPreview, onEmptyStateNew }) {
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
    const ok = await dialog.confirm({
      title: 'Activate template?',
      message: `Activate "${row.name}"?\n\nOnce active it can be used on events. To change it later, you'll make a new version.`,
      confirmText: 'Activate',
    });
    if (!ok) return;
    try {
      await api(`/api/checklist-templates/${row.id}/publish`, { method: 'POST' });
      showToast?.('Template is now active', 'success');
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
    const okDelete = await dialog.confirm({
      title: 'Delete template?',
      message: `Delete "${row.name}" v${row.version}?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!okDelete) return;
    try {
      await api(`/api/checklist-templates/${row.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      // Backend refuses if live (non-terminal, non-soft-deleted) instances
      // still reference the template. Offer the cascade soft-delete path
      // so the admin doesn't have to hunt down the stray instance manually.
      const msg = e?.message || '';
      if (msg.includes('active instance') || msg.includes('force=1')) {
        const okay = await dialog.confirm({
          title: 'Delete with active instances?',
          message: `${msg}\n\nDelete the template AND soft-delete those instances?`,
          confirmText: 'Delete all',
          danger: true,
        });
        if (!okay) return;
        try {
          await api(`/api/checklist-templates/${row.id}?force=1`, { method: 'DELETE' });
          showToast?.('Template and its active instances were soft-deleted', 'success');
          load();
        } catch (e2) {
          showToast?.(e2.message || 'Delete failed', 'error');
        }
        return;
      }
      showToast?.(msg, 'error');
    }
  };

  if (err) return <p style={{ color: 'var(--destructive)' }}>{err}</p>;
  if (rows === null) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <Shimmer height="1rem" width={`${45 + ((i * 13) % 35)}%`} />
            <Shimmer height=".7rem" width="55%" />
          </div>
          <Shimmer height="1.25rem" width="3.5rem" radius="999px" />
        </div>
      ))}
    </div>
  );
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '.95rem' }}>No templates yet — pick a ready-made one to start.</p>
        <p className="muted-text" style={{ marginTop: '.4rem', fontSize: '.85rem' }}>
          CPE Seminar, Workshop, Study Circle, Post-Event Bills…
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onEmptyStateNew}
          style={{ marginTop: '1rem' }}
        >
          <IconPlus size="sm" />
          <span>Pick a starter</span>
        </button>
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
                <button title="Activate (make it usable)" onClick={() => onPublish(r)} style={{ color: 'var(--secondary, #16a34a)' }}><IconCheckCircle size="sm" /></button>
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
      {v ? 'ACTIVE' : 'DRAFT'}
    </span>
  );
}

// ─── Builder drawer ────────────────────────────────────────────────────────
//
// Layout philosophy: tabbed instead of side-by-side.
// Tab 1 ("Build") gives the questions full width; tab 2 ("Preview") shows
// what the filler will actually see. The old 1fr/360px split forced the
// question editors into a narrow column which made every label-input feel
// cramped on a 1280 viewport.
function BuilderDrawer({ id, onClose }) {
  const { showToast } = useAuth();
  const isNew = !id;
  const [loading, setLoading] = useState(!isNew);
  const [meta, setMeta] = useState({ name: '', description: '', category: '', fill_role: '', review_role: '' });
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('build'); // 'build' | 'preview'

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
          section_owner_role: q.section_owner_role ?? null,
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
  // insertAt(i) inserts BEFORE index i (-1 means append to end)
  const insertAt = (i, type, overrides = {}) => setQuestions((qs) => {
    const q = newQuestion(type, overrides);
    if (i < 0 || i >= qs.length) return [...qs, q];
    return [...qs.slice(0, i), q, ...qs.slice(i)];
  });

  // Append a brand-new section heading at the end. Returns the index of
  // the inserted heading so the caller can scroll/focus it.
  // Per F21 we no longer carry a section_owner_role on new sections —
  // approver is decided at event-checklist creation time, not here.
  const appendSection = (title = 'New section') => {
    setQuestions((qs) => [...qs, newQuestion('section_heading', {
      label: title,
      required: false,
      section_owner_role: null,
    })]);
  };

  // Drop in a whole preset section (heading + N pre-configured questions).
  // The killer feature for non-tech users. Preset's `owner_role` is
  // ignored — sections in templates no longer have a pre-baked role.
  const appendPreset = (preset) => {
    setQuestions((qs) => [
      ...qs,
      newQuestion('section_heading', {
        label: preset.title,
        required: false,
        section_owner_role: null,
      }),
      ...preset.questions.map((q) => newQuestion(q.type, q.overrides ?? {})),
    ]);
  };

  // Append a question to the END of the section whose heading is at
  // questionIdx. If no next section, appends to the global end.
  const appendQuestionToSection = (sectionIdx, type, overrides = {}) => {
    setQuestions((qs) => {
      // Find the next section_heading after sectionIdx (or end of list)
      let nextSectionIdx = qs.length;
      for (let i = sectionIdx + 1; i < qs.length; i++) {
        if (qs[i].type === 'section_heading') { nextSectionIdx = i; break; }
      }
      const q = newQuestion(type, overrides);
      return [...qs.slice(0, nextSectionIdx), q, ...qs.slice(nextSectionIdx)];
    });
  };

  // Group the flat questions array by section_heading. Returns:
  //   { headingIdx: number | null, heading: q | null, items: q[] }[]
  // Questions before any section_heading land in a group with headingIdx=null.
  const groups = (() => {
    const out = [];
    let current = { headingIdx: null, heading: null, items: [] };
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type === 'section_heading') {
        if (current.heading || current.items.length > 0) out.push(current);
        current = { headingIdx: i, heading: q, items: [] };
      } else {
        current.items.push({ q, idx: i });
      }
    }
    if (current.heading || current.items.length > 0) out.push(current);
    return out;
  })();

  const save = async () => {
    setSaving(true); setErr('');
    try {
      // Strip client-only keys before sending. Per F21, section_owner_role
      // is always sent as null — templates carry only a question list; the
      // approver is picked at event-checklist creation time.
      const payloadQuestions = questions.map((q, i) => ({
        type: q.type,
        label: q.label,
        help_text: q.help_text || null,
        required: q.required,
        config: q.config || {},
        sort_order: i,
        section_owner_role: null,
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
      width={880}
      footer={
        <>
          {err && <span style={{ color: 'var(--destructive)', marginRight: 'auto', fontSize: '.875rem' }}>{err}</span>}
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <Button className="btn btn-primary" onClick={save} loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ShimmerDrawerBody fields={4} cols={2} />
          <Shimmer height="2rem" width="60%" radius=".375rem" />
          <ShimmerDrawerBody fields={6} cols={1} />
        </div>
      ) : (
        <div className="bld">
          <TemplateMetaForm meta={meta} setMeta={setMeta} />

          <div className="bld-tabs" role="tablist" aria-label="Builder sections">
            <button
              role="tab"
              aria-selected={tab === 'build'}
              className={'bld-tab' + (tab === 'build' ? ' is-active' : '')}
              onClick={() => setTab('build')}
            >Build</button>
            <button
              role="tab"
              aria-selected={tab === 'preview'}
              className={'bld-tab' + (tab === 'preview' ? ' is-active' : '')}
              onClick={() => setTab('preview')}
            >Preview ({questions.length})</button>
          </div>

          {tab === 'build' && (
            <div className="bld-build">
              {/* Empty state — only when truly empty. Big, helpful, links to
                  the section preset library as the primary path. */}
              {questions.length === 0 ? (
                <EmptyBuildState onPreset={appendPreset} onBlank={() => appendSection('Section 1')} />
              ) : (
                <>
                  <SectionPresetBar onPreset={appendPreset} />

                  {groups.map((g, gi) => (
                    <SectionCard
                      key={g.heading?._draftId ?? `pre_${gi}`}
                      group={g}
                      totalCount={questions.length}
                      onPatchQuestion={(idx, patch) => setQ(idx, patch)}
                      onPatchQuestionConfig={(idx, patch) => setCfg(idx, patch)}
                      onMoveQuestion={(idx, dir) => move(idx, dir)}
                      onRemoveQuestion={(idx) => remove(idx)}
                      onDuplicateQuestion={(idx) => duplicate(idx)}
                      onAddQuestion={(type) => {
                        if (g.headingIdx == null) {
                          // pre-section group — append before the next section heading or at end
                          insertAt(-1, type);
                        } else {
                          appendQuestionToSection(g.headingIdx, type);
                        }
                      }}
                      onRemoveSection={async () => {
                        if (g.headingIdx == null) return;
                        const ok = await dialog.confirm({
                          title: 'Remove section?',
                          message: 'Remove this section AND every question inside it?',
                          confirmText: 'Remove',
                          danger: true,
                        });
                        if (!ok) return;
                        // Remove from heading index through (next-section - 1).
                        setQuestions((qs) => {
                          let end = qs.length;
                          for (let i = g.headingIdx + 1; i < qs.length; i++) {
                            if (qs[i].type === 'section_heading') { end = i; break; }
                          }
                          return [...qs.slice(0, g.headingIdx), ...qs.slice(end)];
                        });
                      }}
                    />
                  ))}

                  {/* Primary action: add a section. Sections are first-class
                      in the new UI. Questions live inside sections. */}
                  <button type="button" className="bld-add-section" onClick={() => appendSection('New section')}>
                    + Add another section
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'preview' && (
            <div className="bld-preview">
              <div className="bld-preview-head">
                <strong style={{ fontSize: '.95rem' }}>{meta.name || 'Untitled template'}</strong>
                {meta.description && <div className="muted-text" style={{ fontSize: '.8125rem', marginTop: '.15rem' }}>{meta.description}</div>}
              </div>
              {questions.length === 0
                ? <p className="muted-text" style={{ padding: '1.5rem' }}>Add a question on the Build tab to see the preview.</p>
                : questions.map((q) => (
                    <QuestionRenderer key={q._draftId} question={q} value={null} onChange={() => {}} />
                  ))
              }
            </div>
          )}

          <style>{`
            .bld { display: flex; flex-direction: column; gap: 1rem; }
            .bld-tabs {
              display: flex; gap: .25rem;
              border-bottom: 1px solid var(--border);
              margin-bottom: .25rem;
            }
            .bld-tab {
              padding: .5rem .875rem;
              background: transparent; border: 0;
              border-bottom: 2px solid transparent;
              font-size: .875rem; font-weight: 600;
              color: var(--muted-foreground);
              cursor: pointer;
              margin-bottom: -1px;
            }
            .bld-tab:hover { color: var(--foreground); }
            .bld-tab.is-active {
              color: var(--primary, #1e40af);
              border-bottom-color: var(--primary, #1e40af);
            }
            .bld-build { display: flex; flex-direction: column; gap: .75rem; }
            .bld-empty {
              padding: 1.5rem; text-align: center;
              background: var(--muted, #f8fafc);
              border: 1px dashed var(--border);
              border-radius: .5rem;
              font-size: .875rem; color: var(--muted-foreground);
              margin-bottom: .75rem;
            }
            .bld-add-section {
              align-self: stretch;
              padding: .75rem 1rem;
              font-size: .875rem; font-weight: 600;
              background: white;
              border: 2px dashed var(--primary, #1e40af);
              color: var(--primary, #1e40af);
              border-radius: .5rem;
              cursor: pointer;
              margin-top: .25rem;
            }
            .bld-add-section:hover { background: rgba(37, 99, 235, .04); }
            .bld-preview {
              border: 1px solid var(--border); border-radius: .5rem;
              background: var(--background); padding: 1rem;
            }
            .bld-preview-head {
              padding-bottom: .75rem; margin-bottom: .75rem;
              border-bottom: 1px solid var(--border);
            }
          `}</style>
        </div>
      )}
    </Drawer>
  );
}

// ─── Template metadata (name, description) ────────────────────────────────
// Simplified for non-tech users: just a name and a one-line description.
// Category / fill_role / review_role used to live here but were dropped —
// they're either covered by per-section owners (filling) or weren't doing
// anything load-bearing (category was a free-form tag). The state object
// still carries those fields so existing templates round-trip without data
// loss on save; we just don't expose inputs.
function TemplateMetaForm({ meta, setMeta }) {
  return (
    <div className="meta">
      <Field label="Name *">
        <input type="text" className="meta-input"
          placeholder="e.g. Event approval checklist"
          value={meta.name}
          onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
      </Field>

      <Field label="Description">
        <input type="text" className="meta-input"
          placeholder="What is this checklist for?"
          value={meta.description}
          onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))} />
      </Field>

      <style>{`
        .meta {
          display: flex; flex-direction: column; gap: .625rem;
          padding-bottom: .25rem;
        }
        .meta-input {
          width: 100%; padding: .45rem .6rem; border: 1px solid var(--border);
          border-radius: .375rem; background: var(--card);
          font: inherit; color: inherit;
        }
        .meta-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '.2rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Quick library — one-click pre-configured questions ─────────────────────
function QuickLibrary({ onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lib-wrap">
      <button type="button" className="lib-toggle" onClick={() => setOpen((o) => !o)}>
        ⚡ Quick library — common branch questions
        <span style={{ marginLeft: '.4rem', fontSize: '.7rem', color: 'var(--muted-foreground)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="lib-grid">
          {QUESTION_LIBRARY.map((it) => (
            <button
              key={it.key} type="button"
              className="lib-tile"
              onClick={() => onAdd(it.type, it.overrides)}
              title={`Add a ${QUESTION_TYPE_MAP[it.type]?.label.toLowerCase()} question`}
            >
              <span className="lib-icon">{it.icon}</span>
              <span className="lib-label">{it.label}</span>
            </button>
          ))}
        </div>
      )}
      <style>{`
        .lib-wrap { margin-bottom: .75rem; }
        .lib-toggle {
          width: 100%; text-align: left;
          padding: .5rem .75rem;
          background: var(--muted, #f8fafc);
          border: 1px solid var(--border); border-radius: .375rem;
          font-size: .8125rem; font-weight: 600;
          cursor: pointer;
        }
        .lib-toggle:hover { background: white; border-color: var(--primary); }
        .lib-grid {
          display: grid; gap: .375rem;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          padding: .625rem; margin-top: .25rem;
          background: var(--card); border: 1px solid var(--border);
          border-radius: .375rem;
        }
        .lib-tile {
          display: flex; flex-direction: column; align-items: flex-start; gap: .15rem;
          padding: .5rem .625rem; background: var(--muted, #f8fafc);
          border: 1px solid var(--border); border-radius: .375rem;
          cursor: pointer; text-align: left;
        }
        .lib-tile:hover { background: white; border-color: var(--primary); }
        .lib-icon { font-size: 1.05rem; line-height: 1; }
        .lib-label { font-size: .8125rem; font-weight: 500; }
      `}</style>
    </div>
  );
}

// ─── Insert-between-rows — subtle + button between questions ───────────────
// Hidden by default, fades in on hover so users see WHERE they can add a
// question without us shouting "+ ADD" between every row.
function InsertBetween({ onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ib-wrap">
      {open ? (
        <AddQuestion onAdd={(type) => { onInsert(type); setOpen(false); }} onCancel={() => setOpen(false)} mode="inline" />
      ) : (
        <button type="button" className="ib-trigger" onClick={() => setOpen(true)} title="Insert question here">
          <span className="ib-line" />
          <span className="ib-plus">+</span>
          <span className="ib-line" />
        </button>
      )}
      <style>{`
        .ib-wrap { margin: 0; }
        .ib-trigger {
          display: flex; align-items: center;
          width: 100%; padding: .15rem 0;
          background: transparent; border: 0; cursor: pointer;
          color: var(--muted-foreground);
          opacity: 0; transition: opacity .12s;
        }
        .ib-trigger:hover, .ib-trigger:focus { opacity: 1; }
        .ib-line { flex: 1; height: 1px; background: var(--border); }
        .ib-plus {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.25rem; height: 1.25rem; margin: 0 .375rem;
          background: var(--primary, #1e40af); color: white;
          border-radius: 999px; font-size: .8rem; font-weight: 700;
        }
      `}</style>
    </div>
  );
}

// ─── Add-question chooser ─────────────────────────────────────────────────
// Two modes:
//   'inline'   — used by InsertBetween. Starts opened; closes after pick.
//   'trailing' — sits at the bottom of the question list. Collapsed until
//                clicked; opens the picker inline.
function AddQuestion({ onAdd, onCancel, mode }) {
  const [open, setOpen] = useState(mode === 'inline');
  const [showAll, setShowAll] = useState(false);

  const popularItems = useMemo(
    () => POPULAR_TYPES.map((t) => QUESTION_TYPE_MAP[t]).filter(Boolean),
    [],
  );
  const otherItems = useMemo(
    () => QUESTION_TYPES.filter((t) => !POPULAR_TYPES.includes(t.type)),
    [],
  );

  if (!open && mode !== 'inline') {
    return (
      <button type="button" className="aq-trigger" onClick={() => setOpen(true)}>
        + Add a blank question
        <style>{`
          .aq-trigger {
            align-self: flex-start;
            padding: .5rem 1rem;
            background: transparent;
            border: 1px dashed var(--primary, #1e40af);
            color: var(--primary, #1e40af);
            border-radius: .375rem; cursor: pointer;
            font-size: .8125rem; font-weight: 600;
            margin-top: .5rem;
          }
          .aq-trigger:hover { background: rgba(37, 99, 235, .06); }
        `}</style>
      </button>
    );
  }

  return (
    <div className="aq-card">
      <div className="aq-card-head">
        <strong style={{ fontSize: '.8125rem' }}>Pick a question type</strong>
        <button type="button" className="aq-cancel"
          onClick={() => { setOpen(false); onCancel?.(); }}>
          Cancel
        </button>
      </div>

      <div className="aq-grid">
        {popularItems.map((t) => (
          <button key={t.type} type="button" className="aq-tile"
            onClick={() => { onAdd(t.type); if (mode !== 'inline') setOpen(false); }}>
            <strong>{t.label}</strong>
            <span style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', marginTop: '.1rem' }}>{t.hint}</span>
          </button>
        ))}
      </div>

      {!showAll ? (
        <button type="button" className="aq-more" onClick={() => setShowAll(true)}>
          More types ({otherItems.length}) →
        </button>
      ) : (
        <div className="aq-grid" style={{ marginTop: '.5rem' }}>
          {otherItems.map((t) => (
            <button key={t.type} type="button" className="aq-tile"
              onClick={() => { onAdd(t.type); if (mode !== 'inline') setOpen(false); }}>
              <strong>{t.label}</strong>
              <span style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', marginTop: '.1rem' }}>{t.hint}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .aq-card {
          border: 1px solid var(--border); border-radius: .5rem;
          background: var(--card); padding: .75rem; margin: .25rem 0;
        }
        .aq-card-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: .5rem;
        }
        .aq-cancel {
          background: transparent; border: 0; cursor: pointer;
          font-size: .75rem; color: var(--muted-foreground);
        }
        .aq-cancel:hover { color: var(--foreground); }
        .aq-grid {
          display: grid; gap: .375rem;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        }
        .aq-tile {
          text-align: left; padding: .5rem .625rem;
          background: var(--background); border: 1px solid var(--border);
          border-radius: .375rem; cursor: pointer;
          display: flex; flex-direction: column;
        }
        .aq-tile:hover { border-color: var(--primary); background: white; }
        .aq-more {
          margin-top: .5rem;
          background: transparent; border: 0; cursor: pointer;
          font-size: .75rem; font-weight: 600; color: var(--primary, #1e40af);
        }
      `}</style>
    </div>
  );
}

// ─── Empty state for the Build tab ─────────────────────────────────────────
// First thing the user sees when they create a new template. Pushes them
// toward the preset gallery so they don't have to design a section from
// scratch.
function EmptyBuildState({ onPreset, onBlank }) {
  return (
    <div className="bld-empty-state">
      <div className="bld-empty-head">
        <h3>Start your checklist</h3>
        <p className="muted-text">Pick a ready-made section, or start blank.</p>
      </div>

      <div className="bld-empty-presets">
        {SECTION_PRESETS.slice(0, 6).map((p) => (
          <button key={p.key} type="button" className="bld-preset-tile"
            onClick={() => onPreset(p)}>
            <span className="bld-preset-icon">{p.icon}</span>
            <strong>{p.title}</strong>
            <span className="bld-preset-desc">{p.description}</span>
          </button>
        ))}
      </div>

      <button type="button" className="bld-empty-blank" onClick={onBlank}>
        Or, start with a blank section →
      </button>

      <style>{`
        .bld-empty-state {
          padding: 1.5rem;
          background: var(--muted, #f8fafc);
          border: 1px dashed var(--border);
          border-radius: .5rem;
        }
        .bld-empty-head { text-align: center; margin-bottom: 1rem; }
        .bld-empty-head h3 { margin: 0; font-size: 1rem; }
        .bld-empty-head p { margin: .25rem 0 0; font-size: .8125rem; }
        .bld-empty-presets {
          display: grid; gap: .5rem;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        }
        .bld-preset-tile {
          display: flex; flex-direction: column; gap: .15rem;
          padding: .625rem .75rem;
          background: white; border: 1px solid var(--border);
          border-radius: .375rem; text-align: left; cursor: pointer;
          transition: border-color .12s, transform .12s;
        }
        .bld-preset-tile:hover {
          border-color: var(--primary, #1e40af);
          transform: translateY(-1px);
        }
        .bld-preset-icon { font-size: 1.1rem; line-height: 1; }
        .bld-preset-tile strong { font-size: .8125rem; }
        .bld-preset-desc { font-size: .7rem; color: var(--muted-foreground); }
        .bld-empty-blank {
          align-self: flex-start; margin-top: .75rem;
          padding: .4rem .8rem; font-size: .8125rem; font-weight: 600;
          background: transparent; color: var(--primary, #1e40af);
          border: 0; cursor: pointer;
        }
        .bld-empty-blank:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ─── Preset bar at the top of the build tab (when not empty) ──────────────
// "Add another section" strip — the grid is ALWAYS visible (previously
// hidden behind a toggle, which made non-tech users miss it). The whole
// point of preset sections is to be one-click obvious.
function SectionPresetBar({ onPreset }) {
  return (
    <div className="bld-preset-bar">
      <div className="bld-preset-bar-head">
        ⚡ Add a ready-made section
      </div>
      <div className="bld-preset-bar-grid">
        {SECTION_PRESETS.map((p) => (
          <button key={p.key} type="button" className="bld-preset-tile"
            onClick={() => onPreset(p)}>
            <span className="bld-preset-icon">{p.icon}</span>
            <strong>{p.title}</strong>
            <span className="bld-preset-desc">{p.description}</span>
          </button>
        ))}
      </div>
      <style>{`
        .bld-preset-bar {
          padding: .625rem .75rem;
          background: var(--muted, #f8fafc);
          border: 1px solid var(--border); border-radius: .375rem;
          margin-bottom: .5rem;
        }
        .bld-preset-bar-head {
          font-size: .8125rem; font-weight: 600;
          color: var(--muted-foreground);
          margin-bottom: .5rem;
        }
        .bld-preset-bar-grid {
          display: grid; gap: .375rem;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        }
      `}</style>
    </div>
  );
}

// ─── SectionCard — visual container for a section + its questions ────────
// Replaces the old flat-list rendering. The section heading lives at the
// top of the card with its owner picker prominently exposed; questions
// live inside; a small "+ Add question" button at the bottom adds a new
// question to this specific section.
function SectionCard({
  group,
  onPatchQuestion,
  onPatchQuestionConfig,
  onMoveQuestion,
  onRemoveQuestion,
  onDuplicateQuestion,
  onAddQuestion,
  onRemoveSection,
  totalCount,
}) {
  const heading = group.heading;
  const items = group.items;
  const [adding, setAdding] = useState(false);
  // Sections start expanded — authors need to see what they're working on.
  // The collapse chevron is for managing long templates with 8+ sections.
  // The pre-section group (no heading) is never collapsible.
  const [collapsed, setCollapsed] = useState(false);
  // Settings popover (⋯ menu). FlipMenu handles click-outside + portal
  // positioning + auto-flip-up when near the viewport bottom.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef(null);

  return (
    <div className="sc-card">
      {/* Section header — only shown when there IS a section heading. The
          "pre-section" group (questions before any heading) skips this. */}
      {heading && (
        <div className="sc-head">
          {/* Collapse chevron — clicking it toggles the section body.
              Kept separate from the title input so typing in the title
              doesn't accidentally collapse the section. */}
          <button
            type="button"
            className="sc-chev-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand section' : 'Collapse section'}
          >
            <span className={'sc-chev' + (collapsed ? '' : ' open')}>▸</span>
          </button>
          <div className="sc-head-inputs">
            <input
              type="text"
              className="sc-title-input"
              value={heading.label || ''}
              placeholder="Section name (e.g. Event basics)"
              onChange={(e) => onPatchQuestion(group.headingIdx, { label: e.target.value })}
            />
            {/* Per-section reviewer role picker was removed in F21 —
                templates carry only a name + question list. Filler +
                approver are picked at event-checklist creation time. */}
          </div>
          {collapsed && (
            <span className="sc-count">{items.length} question{items.length === 1 ? '' : 's'}</span>
          )}
          <div className="sc-settings-wrap">
            <button
              ref={settingsTriggerRef}
              type="button"
              className="sc-settings-trigger"
              onClick={() => setSettingsOpen((o) => !o)}
              title="More section options"
              aria-label="More section options"
              aria-expanded={settingsOpen}
            >
              ⋯
            </button>
            <FlipMenu
              open={settingsOpen}
              triggerRef={settingsTriggerRef}
              onClose={() => setSettingsOpen(false)}
              align="right"
              minWidth={224}
              className="sc-settings-menu"
            >
              <button
                type="button"
                className="sc-settings-remove"
                onClick={() => { setSettingsOpen(false); onRemoveSection(); }}
              >
                Remove section
              </button>
            </FlipMenu>
          </div>
        </div>
      )}

      {/* Section body — questions inside */}
      {!collapsed && (
      <div className="sc-body">
        {items.length === 0 && (
          <div className="sc-empty">No questions yet. Add one below.</div>
        )}
        {items.map(({ q, idx }, i) => (
          <QuestionEditor
            key={q._draftId}
            question={q}
            index={idx}
            count={totalCount}
            onPatch={(p) => onPatchQuestion(idx, p)}
            onPatchConfig={(p) => onPatchQuestionConfig(idx, p)}
            onMove={(d) => onMoveQuestion(idx, d)}
            onRemove={() => onRemoveQuestion(idx)}
            onDuplicate={() => onDuplicateQuestion(idx)}
          />
        ))}

        {/* Inline add-question — opens type picker without leaving the
            section card. */}
        {adding ? (
          <AddQuestion
            mode="inline"
            onAdd={(type) => { onAddQuestion(type); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="sc-add-q" onClick={() => setAdding(true)}>
            + Add a question to this section
          </button>
        )}
      </div>
      )}

      <style>{`
        .sc-card {
          background: var(--card, white);
          border: 1px solid var(--border);
          border-radius: .5rem;
          overflow: hidden;
        }
        .sc-head {
          display: flex; gap: .5rem; align-items: center;
          padding: .625rem .75rem;
          background: rgba(37, 99, 235, .05);
          border-bottom: 1px solid var(--border);
        }
        .sc-chev-btn {
          padding: .25rem .35rem; background: transparent; border: 0;
          cursor: pointer; color: var(--muted-foreground);
          border-radius: .25rem;
        }
        .sc-chev-btn:hover { background: rgba(37, 99, 235, .08); }
        .sc-chev {
          display: inline-block;
          transition: transform .15s ease;
          font-size: .85rem;
        }
        .sc-chev.open { transform: rotate(90deg); }
        .sc-count {
          padding: .15rem .55rem; border-radius: 999px;
          background: white; border: 1px solid var(--border);
          font-size: .7rem; font-weight: 600;
          color: var(--muted-foreground);
        }
        .sc-head-inputs {
          flex: 1; display: flex; align-items: center; gap: .5rem;
          min-width: 0;
        }
        .sc-title-input {
          flex: 1; min-width: 0;
          padding: .4rem .55rem;
          border: 1px solid transparent; background: transparent;
          font-size: 1rem; font-weight: 700; color: var(--primary, #1e40af);
          border-radius: .25rem;
        }
        .sc-title-input:hover, .sc-title-input:focus {
          background: white; border-color: var(--border); outline: 0;
        }
        .sc-owner-wrap { position: relative; flex-shrink: 0; }
        .sc-owner-pill {
          display: inline-flex; align-items: center; gap: .25rem;
          padding: .2rem .55rem;
          border-radius: 999px;
          background: white; border: 1px solid var(--border);
          font-size: .72rem; font-weight: 600;
          color: var(--muted-foreground);
          white-space: nowrap;
          cursor: pointer;
        }
        .sc-owner-pill:hover {
          border-color: var(--primary, #1e40af);
          color: var(--primary, #1e40af);
        }
        .sc-owner-chev {
          font-size: .65rem; opacity: .7;
        }
        .sc-role-menu {
          position: absolute; top: calc(100% + .25rem); right: 0;
          z-index: 6; min-width: 15rem;
          background: white; border: 1px solid var(--border);
          border-radius: .5rem; box-shadow: 0 6px 22px rgba(0,0,0,.1);
          padding: .4rem;
          display: flex; flex-direction: column; gap: .1rem;
          max-height: 320px; overflow-y: auto;
        }
        .sc-role-item {
          display: flex; align-items: center; gap: .5rem;
          width: 100%; padding: .4rem .55rem; text-align: left;
          background: transparent; border: 0; cursor: pointer;
          font-size: .8125rem; color: var(--foreground);
          border-radius: .3rem;
        }
        .sc-role-item:hover { background: var(--muted, #f8fafc); }
        .sc-role-item.is-active {
          background: rgba(37, 99, 235, .08);
          color: var(--primary, #1e40af);
          font-weight: 600;
        }
        .sc-role-check {
          color: var(--primary, #1e40af);
          font-weight: 800;
        }
        .sc-settings-wrap { position: relative; flex-shrink: 0; }
        .sc-settings-trigger {
          width: 1.85rem; height: 1.85rem;
          background: transparent; border: 1px solid transparent;
          color: var(--muted-foreground);
          font-size: 1.05rem; line-height: 1;
          border-radius: .3rem; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .sc-settings-trigger:hover {
          background: white; border-color: var(--border); color: var(--foreground);
        }
        /* FlipMenu owns position + portal; we only style the surface. */
        .sc-settings-menu {
          background: white; border: 1px solid var(--border);
          border-radius: .5rem; box-shadow: 0 6px 22px rgba(0,0,0,.1);
          padding: .65rem;
          display: flex; flex-direction: column; gap: .5rem;
        }
        .sc-settings-label {
          padding: .25rem .55rem .15rem;
          font-size: .7rem; font-weight: 600;
          color: var(--muted-foreground);
          text-transform: uppercase; letter-spacing: .04em;
        }
        .sc-settings-remove {
          margin-top: .25rem;
          padding: .4rem .55rem;
          background: transparent; border: 1px solid var(--border);
          color: var(--destructive, #b91c1c);
          font-size: .8125rem; font-weight: 600;
          border-radius: .3rem; cursor: pointer;
          text-align: left;
        }
        .sc-settings-remove:hover {
          background: #fef2f2; border-color: #fecaca;
        }
        .sc-body { padding: .75rem; display: flex; flex-direction: column; gap: 0; }
        .sc-empty {
          padding: .875rem; text-align: center;
          background: var(--muted, #f8fafc);
          border: 1px dashed var(--border); border-radius: .375rem;
          font-size: .8rem; color: var(--muted-foreground);
          margin-bottom: .5rem;
        }
        .sc-add-q {
          align-self: flex-start;
          padding: .4rem .8rem;
          background: transparent;
          border: 1px dashed var(--primary, #1e40af);
          color: var(--primary, #1e40af);
          font-size: .8125rem; font-weight: 600;
          border-radius: .25rem; cursor: pointer;
          margin-top: .25rem;
        }
        .sc-add-q:hover { background: rgba(37, 99, 235, .06); }
      `}</style>
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
      {!data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Shimmer height="1.5rem" width="60%" />
          <ShimmerLines count={2} lastWidth="50%" />
          <ShimmerDrawerBody fields={6} cols={1} />
        </div>
      ) : (
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
