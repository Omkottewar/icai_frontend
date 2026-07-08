import { useRef, useState } from 'react';
import { QUESTION_TYPE_MAP, ROLE_OPTIONS, slugifyOptionValue } from '../../lib/checklistQuestions';
import { IconTrash, IconChevronUp, IconChevronDownAlt, IconCopy, IconChevronDown } from '../../icons';
import FlipMenu from '../ui/FlipMenu';

// Inline editor for a single question inside the builder.
//
// Design goals for v2 (simplification pass):
//   1. Less chrome — one row toolbar instead of two; action buttons live
//      behind a "…" overflow menu instead of always-visible icons.
//   2. Advanced config (placeholder, max length, min/max, etc.) hidden by
//      default behind an "Advanced settings" toggle. The 95% case is just
//      "label + required toggle".
//   3. Option-list editor shows only the label column — the internal
//      `value` is auto-generated via slugifyOptionValue() since non-tech
//      committee chairmen don't care about the internal key.
//   4. Section headings get a single label input and skip everything else.
//
// Pure-controlled: the parent owns the questions array and passes update fns.

export default function QuestionEditor({
  question,
  index,
  count,
  onPatch,        // (partial) => void  — merges into this question
  onPatchConfig,  // (partial) => void  — merges into question.config
  onRemove,
  onMove,         // (dir) => void  — -1 up, +1 down
  onDuplicate,
}) {
  const meta = QUESTION_TYPE_MAP[question.type] ?? { label: question.type };
  const isSection = question.type === 'section_heading';
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // FlipMenu handles outside-click + portal + auto-flip. We just hand it
  // the trigger ref + the open state.
  const menuTriggerRef = useRef(null);

  return (
    <div className="qe-card">
      <div className="qe-head">
        <div className="qe-head-left">
          <span className="qe-chip">{meta.label}</span>
          <span className="qe-pos">Q{index + 1}</span>
        </div>
        <div className="qe-menu-wrap">
          <button ref={menuTriggerRef} type="button" className="qe-menu-trigger" title="More" onClick={() => setMenuOpen((o) => !o)}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⋯</span>
          </button>
          <FlipMenu
            open={menuOpen}
            triggerRef={menuTriggerRef}
            onClose={() => setMenuOpen(false)}
            align="right"
            minWidth={176}
            className="qe-menu"
          >
            <button type="button" disabled={index === 0}        onClick={() => { onMove(-1); setMenuOpen(false); }}>
              <IconChevronUp size="sm" /> Move up
            </button>
            <button type="button" disabled={index === count - 1} onClick={() => { onMove(+1); setMenuOpen(false); }}>
              <IconChevronDownAlt size="sm" /> Move down
            </button>
            <button type="button" onClick={() => { onDuplicate(); setMenuOpen(false); }}>
              <IconCopy size="sm" /> Duplicate
            </button>
            <button type="button" onClick={() => { onRemove(); setMenuOpen(false); }} style={{ color: 'var(--destructive, #b91c1c)' }}>
              <IconTrash size="sm" /> Remove
            </button>
          </FlipMenu>
        </div>
      </div>

      <div className="qe-body">
        <input
          type="text"
          className="qe-input qe-input-label"
          value={question.label}
          placeholder={isSection ? 'Section heading' : 'What do you want to ask?'}
          onChange={(e) => onPatch({ label: e.target.value })}
        />

        {/* Section ownership picker (section_owner_role) was removed —
            filler + approver are now decided exclusively at event-checklist
            creation time. Templates carry only a name + question list. */}

        {!isSection && (
          <>
            <input
              type="text"
              className="qe-input qe-input-help"
              value={question.help_text || ''}
              placeholder="Help text (optional)"
              onChange={(e) => onPatch({ help_text: e.target.value })}
            />

            {/* Options live in the body for choice types — they're the meat
                of the question, not an advanced setting. */}
            {(question.type === 'radio' || question.type === 'dropdown' || question.type === 'checkbox') && (
              <OptionsEditor cfg={question.config || {}} onPatchConfig={onPatchConfig} />
            )}

            {/* Rows + columns editor for checklist_table — same reasoning:
                the table structure IS the question, not a setting. */}
            {question.type === 'checklist_table' && (
              <ChecklistTableEditor cfg={question.config || {}} onPatchConfig={onPatchConfig} />
            )}

            <div className="qe-required-row">
              <label className="qe-checkbox">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) => onPatch({ required: e.target.checked })}
                />
                Required
              </label>

              {TypeHasAdvancedConfig(question.type) && (
                <button
                  type="button"
                  className="qe-advanced-toggle"
                  onClick={() => setAdvancedOpen((o) => !o)}
                  aria-expanded={advancedOpen}
                >
                  <IconChevronDown size="sm" style={{ transform: advancedOpen ? 'rotate(180deg)' : '', transition: 'transform .15s' }} />
                  Advanced settings
                </button>
              )}
            </div>

            {advancedOpen && (
              <div className="qe-advanced">
                <AdvancedConfig question={question} onPatchConfig={onPatchConfig} />
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .qe-card {
          border: 1px solid var(--border); border-radius: .5rem;
          background: var(--card); padding: 0; margin-bottom: .625rem;
          transition: border-color .12s;
        }
        .qe-card:focus-within { border-color: var(--primary, #1e40af); }
        .qe-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: .375rem .625rem; border-bottom: 1px solid var(--border);
        }
        .qe-head-left { display: flex; align-items: center; gap: .5rem; }
        .qe-chip {
          font-size: .6875rem; font-weight: 600; padding: .1rem .5rem;
          background: rgba(37, 99, 235, .1); color: var(--primary, #1e40af);
          border-radius: 999px;
        }
        .qe-pos { font-size: .7rem; color: var(--muted-foreground); font-weight: 600; }
        .qe-menu-wrap { position: relative; }
        .qe-menu-trigger {
          background: transparent; border: 0; cursor: pointer;
          width: 1.75rem; height: 1.75rem; border-radius: .25rem;
          color: var(--muted-foreground);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .qe-menu-trigger:hover { background: var(--muted, #f1f5f9); color: var(--foreground); }
        /* FlipMenu owns position + portal; we just style the surface. */
        .qe-menu {
          background: white; border: 1px solid var(--border);
          border-radius: .375rem; box-shadow: 0 4px 14px rgba(0,0,0,.08);
          padding: .25rem;
          display: flex; flex-direction: column;
        }
        .qe-menu button {
          display: flex; align-items: center; gap: .5rem;
          padding: .4rem .55rem; border: 0; background: transparent;
          font-size: .8125rem; cursor: pointer; border-radius: .25rem;
          text-align: left;
        }
        .qe-menu button:hover:not(:disabled) { background: var(--muted, #f1f5f9); }
        .qe-menu button:disabled { opacity: .35; cursor: not-allowed; }

        .qe-body {
          padding: .625rem .875rem .75rem;
          display: flex; flex-direction: column; gap: .5rem;
        }
        .qe-input {
          width: 100%; padding: .4rem .55rem; border: 1px solid var(--border);
          border-radius: .375rem; background: var(--card); font: inherit; color: inherit;
        }
        .qe-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        .qe-input-label { font-size: .9rem; font-weight: 500; }
        .qe-input-help { font-size: .8125rem; }
        .qe-input-help::placeholder { font-style: italic; }

        .qe-required-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-top: .125rem;
        }
        .qe-checkbox {
          display: flex; align-items: center; gap: .4rem;
          font-size: .8125rem; font-weight: 500; cursor: pointer;
        }
        .qe-advanced-toggle {
          background: transparent; border: 0; cursor: pointer;
          display: inline-flex; align-items: center; gap: .25rem;
          font-size: .75rem; color: var(--muted-foreground);
          padding: .25rem .375rem; border-radius: .25rem;
        }
        .qe-advanced-toggle:hover { background: var(--muted, #f1f5f9); color: var(--foreground); }
        .qe-advanced {
          background: var(--muted, #f8fafc); padding: .625rem;
          border: 1px solid var(--border); border-radius: .375rem;
          margin-top: .25rem;
        }
      `}</style>
    </div>
  );
}

// Whether the type has any advanced options worth hiding behind a toggle.
function TypeHasAdvancedConfig(type) {
  return [
    'short_text', 'long_text', 'number', 'money', 'date', 'datetime',
    'rating', 'file', 'checkbox', 'task_list', 'budget_table',
  ].includes(type);
}

// All the optional config knobs. Renders nothing for radio/dropdown — their
// only setting (options) is shown inline in the body above.
function AdvancedConfig({ question, onPatchConfig }) {
  const cfg = question.config || {};
  switch (question.type) {
    case 'short_text':
    case 'long_text':
      return (
        <Grid>
          <Field label="Placeholder">
            <input type="text" className="qe-input" value={cfg.placeholder || ''}
              onChange={(e) => onPatchConfig({ placeholder: e.target.value })} />
          </Field>
          <Field label="Max characters">
            <input type="number" className="qe-input" value={cfg.max_length ?? ''}
              onChange={(e) => onPatchConfig({ max_length: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </Field>
        </Grid>
      );
    case 'number':
      return (
        <Grid>
          <Field label="Min"><input type="number" className="qe-input" value={cfg.min ?? ''} onChange={(e) => onPatchConfig({ min: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Max"><input type="number" className="qe-input" value={cfg.max ?? ''} onChange={(e) => onPatchConfig({ max: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Step"><input type="number" className="qe-input" value={cfg.step ?? ''} onChange={(e) => onPatchConfig({ step: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Unit (e.g. hours)"><input type="text" className="qe-input" value={cfg.unit || ''} onChange={(e) => onPatchConfig({ unit: e.target.value })} /></Field>
        </Grid>
      );
    case 'money':
      return (
        <Grid>
          <Field label="Min (₹)"><input type="number" className="qe-input" value={cfg.min_paise == null ? '' : cfg.min_paise / 100} onChange={(e) => onPatchConfig({ min_paise: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100) })} /></Field>
          <Field label="Max (₹)"><input type="number" className="qe-input" value={cfg.max_paise == null ? '' : cfg.max_paise / 100} onChange={(e) => onPatchConfig({ max_paise: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100) })} /></Field>
        </Grid>
      );
    case 'date':
    case 'datetime':
      return (
        <Grid>
          <Field label="Earliest"><input type={question.type === 'date' ? 'date' : 'datetime-local'} className="qe-input" value={cfg.min || ''} onChange={(e) => onPatchConfig({ min: e.target.value })} /></Field>
          <Field label="Latest"><input type={question.type === 'date' ? 'date' : 'datetime-local'} className="qe-input" value={cfg.max || ''} onChange={(e) => onPatchConfig({ max: e.target.value })} /></Field>
        </Grid>
      );
    case 'rating':
      return (
        <Field label="Scale (max stars)">
          <input type="number" className="qe-input" style={{ maxWidth: 100 }} min={2} max={10}
            value={cfg.scale ?? 5}
            onChange={(e) => onPatchConfig({ scale: Math.max(2, Math.min(10, Number(e.target.value) || 5)) })} />
        </Field>
      );
    case 'file':
      return (
        <Grid>
          <Field label="Max size (KB)"><input type="number" className="qe-input" value={cfg.max_size_kb ?? ''} onChange={(e) => onPatchConfig({ max_size_kb: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Accepted types">
            <input type="text" className="qe-input" placeholder=".pdf,image/*"
              value={Array.isArray(cfg.accept) ? cfg.accept.join(',') : ''}
              onChange={(e) => onPatchConfig({ accept: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </Grid>
      );
    case 'checkbox':
      return (
        <Grid>
          <Field label="Min selected"><input type="number" className="qe-input" value={cfg.min_selected ?? ''} onChange={(e) => onPatchConfig({ min_selected: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Max selected"><input type="number" className="qe-input" value={cfg.max_selected ?? ''} onChange={(e) => onPatchConfig({ max_selected: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
        </Grid>
      );
    case 'task_list':
      return (
        <Field label="Minimum tasks required">
          <input type="number" min={0} max={50} className="qe-input" style={{ maxWidth: 120 }}
            value={cfg.min_tasks ?? ''}
            placeholder="0"
            onChange={(e) => onPatchConfig({ min_tasks: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </Field>
      );
    case 'budget_table':
      return (
        <Field label="Default number of faculty rows">
          <input type="number" min={1} max={20} className="qe-input" style={{ maxWidth: 120 }}
            value={cfg.faculty_count ?? 6}
            placeholder="6"
            onChange={(e) => onPatchConfig({ faculty_count: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <div style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', marginTop: '.2rem' }}>
            Applies to Stay / Travel / Food / Cab categories. Treasurer can leave unused rows at 0.
          </div>
        </Field>
      );
    default:
      return null;
  }
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '.7rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '.2rem' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.5rem' }}>
      {children}
    </div>
  );
}

// Options editor — single label column, value auto-generated. Press Enter
// in the last option's input to add another row.
function OptionsEditor({ cfg, onPatchConfig }) {
  const options = Array.isArray(cfg.options) ? cfg.options : [];

  // Slugify the label into a stable `value`. Dedupe by appending a counter
  // if the slug collides with another option in the same list.
  const recomputeValue = (label, otherValues) => {
    const base = slugifyOptionValue(label) || 'option';
    if (!otherValues.includes(base)) return base;
    let i = 2;
    while (otherValues.includes(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  };

  const update = (idx, label) => {
    const next = options.map((o, i) => {
      if (i !== idx) return o;
      const others = options.filter((_, j) => j !== idx).map((o2) => o2.value);
      return { value: recomputeValue(label, others), label };
    });
    onPatchConfig({ options: next });
  };
  const remove = (idx) => onPatchConfig({ options: options.filter((_, i) => i !== idx) });
  const add = () => {
    const label = `Option ${options.length + 1}`;
    const others = options.map((o) => o.value);
    onPatchConfig({ options: [...options, { value: recomputeValue(label, others), label }] });
  };
  const onKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === options.length - 1) add();
    }
  };

  return (
    <div className="qe-opts">
      <label className="qe-opts-head">Options</label>
      {options.map((o, i) => (
        <div key={i} className="qe-opt-row">
          <span className="qe-opt-bullet">{i + 1}.</span>
          <input
            type="text" className="qe-input"
            value={o.label}
            placeholder="Option text"
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          />
          <button
            type="button" onClick={() => remove(i)} title="Remove option"
            disabled={options.length <= 1}
            className="qe-opt-remove"
          >
            <IconTrash size="sm" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="qe-opt-add">
        + Add option
      </button>

      <style>{`
        .qe-opts { margin-top: .125rem; }
        .qe-opts-head {
          display: block; font-size: .7rem; font-weight: 600;
          color: var(--muted-foreground); margin-bottom: .25rem;
        }
        .qe-opt-row {
          display: flex; align-items: center; gap: .4rem;
          margin-bottom: .25rem;
        }
        .qe-opt-bullet {
          font-size: .8125rem; color: var(--muted-foreground);
          min-width: 1.5rem;
        }
        .qe-opt-remove {
          background: transparent; border: 1px solid transparent;
          border-radius: .25rem; padding: .25rem;
          cursor: pointer; color: var(--muted-foreground);
        }
        .qe-opt-remove:hover:not(:disabled) {
          background: var(--muted, #f1f5f9); color: var(--destructive);
          border-color: var(--border);
        }
        .qe-opt-remove:disabled { opacity: .25; cursor: not-allowed; }
        .qe-opt-add {
          margin-top: .25rem; padding: .3rem .625rem;
          font-size: .75rem; font-weight: 600;
          background: transparent; color: var(--primary, #1e40af);
          border: 1px dashed var(--primary, #1e40af); border-radius: .25rem;
          cursor: pointer;
        }
        .qe-opt-add:hover { background: rgba(37, 99, 235, .06); }
      `}</style>
    </div>
  );
}

// ─── ChecklistTableEditor ────────────────────────────────────────────────
// Inline editor for the checklist_table question type. Two lists:
//   1) Columns — key + label + type (text | number | money | status)
//   2) Rows    — id + label + kind (data | total | computed) + hint / formula
// Both support add / delete / reorder / edit. IDs / keys are auto-slugged
// from labels the same way OptionsEditor derives its option values.
function ChecklistTableEditor({ cfg, onPatchConfig }) {
  const columns = Array.isArray(cfg.columns) ? cfg.columns : [];
  const rows    = Array.isArray(cfg.rows)    ? cfg.rows    : [];

  const slug = (label, others) => {
    const base = slugifyOptionValue(label) || 'row';
    if (!others.includes(base)) return base;
    let i = 2;
    while (others.includes(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  };

  // ─── Column mutations ─────
  const patchColumn = (i, patch) => {
    const next = columns.map((c, idx) => {
      if (idx !== i) return c;
      const merged = { ...c, ...patch };
      // Auto-derive key if label changed and key wasn't hand-edited.
      if ('label' in patch) {
        const others = columns.filter((_, j) => j !== i).map((c2) => c2.key);
        merged.key = slug(merged.label, others);
      }
      return merged;
    });
    onPatchConfig({ columns: next });
  };
  const removeColumn = (i) => onPatchConfig({ columns: columns.filter((_, j) => j !== i) });
  const addColumn = () => {
    const label = `Column ${columns.length + 1}`;
    const others = columns.map((c) => c.key);
    onPatchConfig({ columns: [...columns, { key: slug(label, others), label, type: 'text' }] });
  };
  const moveColumn = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= columns.length) return;
    const next = columns.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onPatchConfig({ columns: next });
  };

  // ─── Row mutations ─────
  const patchRow = (i, patch) => {
    const next = rows.map((r, idx) => {
      if (idx !== i) return r;
      const merged = { ...r, ...patch };
      if ('label' in patch) {
        const others = rows.filter((_, j) => j !== i).map((r2) => r2.id);
        merged.id = slug(merged.label, others);
      }
      return merged;
    });
    onPatchConfig({ rows: next });
  };
  const removeRow = (i) => onPatchConfig({ rows: rows.filter((_, j) => j !== i) });
  const addRow = () => {
    const label = `Item ${rows.length + 1}`;
    const others = rows.map((r) => r.id);
    onPatchConfig({ rows: [...rows, { id: slug(label, others), label, kind: 'data' }] });
  };
  const moveRow = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onPatchConfig({ rows: next });
  };

  // Money / number columns available as `total_of` targets for total /
  // computed rows. Text / status columns don't make sense to sum.
  const summableCols = columns.filter((c) => c.type === 'money' || c.type === 'number');

  return (
    <div className="ct-ed">
      {/* ─── Columns ─── */}
      <div className="ct-ed-section">
        <label className="ct-ed-head">Columns</label>
        {columns.length === 0 && (
          <div className="ct-ed-empty">No columns yet — add one below.</div>
        )}
        {columns.map((c, i) => (
          <div key={i} className="ct-ed-row">
            <span className="ct-ed-bullet">{i + 1}.</span>
            <input
              type="text" className="qe-input ct-ed-label"
              value={c.label || ''}
              placeholder="Column label"
              onChange={(e) => patchColumn(i, { label: e.target.value })}
            />
            <select
              className="qe-input ct-ed-select"
              value={c.type || 'text'}
              onChange={(e) => patchColumn(i, { type: e.target.value })}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="money">Money (₹)</option>
              <option value="status">Status (Done / Pending / N/A)</option>
            </select>
            <button type="button" className="ct-ed-move" onClick={() => moveColumn(i, -1)} disabled={i === 0} title="Move up">↑</button>
            <button type="button" className="ct-ed-move" onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1} title="Move down">↓</button>
            <button type="button" className="ct-ed-remove" onClick={() => removeColumn(i)} title="Remove column">
              <IconTrash size="sm" />
            </button>
          </div>
        ))}
        <button type="button" onClick={addColumn} className="ct-ed-add">+ Add column</button>
      </div>

      {/* ─── Rows ─── */}
      <div className="ct-ed-section">
        <label className="ct-ed-head">Rows</label>
        {rows.length === 0 && (
          <div className="ct-ed-empty">No rows yet — add one below.</div>
        )}
        {rows.map((r, i) => {
          const kind = r.kind || 'data';
          return (
            <div key={i} className="ct-ed-row-block">
              <div className="ct-ed-row">
                <span className="ct-ed-bullet">{i + 1}.</span>
                <input
                  type="text" className="qe-input ct-ed-label"
                  value={r.label || ''}
                  placeholder="Row label"
                  onChange={(e) => patchRow(i, { label: e.target.value })}
                />
                <select
                  className="qe-input ct-ed-select"
                  value={kind}
                  onChange={(e) => patchRow(i, { kind: e.target.value })}
                >
                  <option value="data">Data</option>
                  <option value="total">Total (auto-sum)</option>
                  <option value="computed">Computed (formula)</option>
                </select>
                <button type="button" className="ct-ed-move" onClick={() => moveRow(i, -1)} disabled={i === 0} title="Move up">↑</button>
                <button type="button" className="ct-ed-move" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} title="Move down">↓</button>
                <button type="button" className="ct-ed-remove" onClick={() => removeRow(i)} title="Remove row">
                  <IconTrash size="sm" />
                </button>
              </div>
              {kind === 'data' && (
                <input
                  type="text" className="qe-input ct-ed-hint"
                  value={r.hint || ''}
                  placeholder="Optional hint (e.g. '6 Box', '50', '2 cordless + 1 collar mike')"
                  onChange={(e) => patchRow(i, { hint: e.target.value })}
                />
              )}
              {kind === 'total' && (
                <div className="ct-ed-detail">
                  <label className="ct-ed-detail-lbl">Sum column:</label>
                  <select
                    className="qe-input ct-ed-select-narrow"
                    value={r.total_of || ''}
                    onChange={(e) => patchRow(i, { total_of: e.target.value })}
                  >
                    <option value="">— pick a column —</option>
                    {summableCols.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  {summableCols.length === 0 && (
                    <span className="ct-ed-warn">Add a Money or Number column first.</span>
                  )}
                </div>
              )}
              {kind === 'computed' && (
                <>
                  <div className="ct-ed-detail">
                    <label className="ct-ed-detail-lbl">Result column:</label>
                    <select
                      className="qe-input ct-ed-select-narrow"
                      value={r.total_of || ''}
                      onChange={(e) => patchRow(i, { total_of: e.target.value })}
                    >
                      <option value="">— pick a column —</option>
                      {summableCols.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text" className="qe-input ct-ed-formula"
                    value={r.formula || ''}
                    placeholder="Formula (e.g. 'income_fee - total_expenses')"
                    onChange={(e) => patchRow(i, { formula: e.target.value })}
                  />
                  <div className="ct-ed-help">
                    Reference other row IDs with + / − operators. IDs auto-generate from labels — see each row's label to know the ID (lowercased with underscores).
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button type="button" onClick={addRow} className="ct-ed-add">+ Add row</button>
      </div>

      <style>{`
        .ct-ed { margin-top: .5rem; display: flex; flex-direction: column; gap: 1rem; }
        .ct-ed-section { display: flex; flex-direction: column; gap: .3rem; }
        .ct-ed-head {
          display: block; font-size: .7rem; font-weight: 700;
          color: var(--foreground); margin-bottom: .1rem;
          text-transform: uppercase; letter-spacing: .04em;
        }
        .ct-ed-empty {
          font-size: .75rem; color: var(--muted-foreground);
          padding: .4rem .5rem; background: var(--muted, #f8fafc);
          border-radius: .25rem;
        }
        .ct-ed-row-block {
          display: flex; flex-direction: column; gap: .25rem;
          padding: .25rem 0;
          border-bottom: 1px solid var(--border);
        }
        .ct-ed-row-block:last-of-type { border-bottom: 0; }
        .ct-ed-row {
          display: flex; align-items: center; gap: .35rem;
        }
        .ct-ed-bullet {
          font-size: .75rem; color: var(--muted-foreground);
          min-width: 1.5rem; font-weight: 600;
        }
        .ct-ed-label { flex: 1; }
        .ct-ed-select { max-width: 200px; }
        .ct-ed-select-narrow { max-width: 180px; }
        .ct-ed-move, .ct-ed-remove {
          background: transparent; border: 1px solid transparent;
          border-radius: .25rem; padding: .25rem .35rem;
          cursor: pointer; color: var(--muted-foreground);
          font-size: .8125rem; line-height: 1;
        }
        .ct-ed-move:hover:not(:disabled), .ct-ed-remove:hover:not(:disabled) {
          background: var(--muted, #f1f5f9); color: var(--foreground);
          border-color: var(--border);
        }
        .ct-ed-remove:hover:not(:disabled) { color: var(--destructive, #dc2626); }
        .ct-ed-move:disabled, .ct-ed-remove:disabled { opacity: .3; cursor: not-allowed; }
        .ct-ed-add {
          align-self: flex-start;
          margin-top: .25rem; padding: .3rem .625rem;
          font-size: .75rem; font-weight: 600;
          background: transparent; color: var(--primary, #1e40af);
          border: 1px dashed var(--primary, #1e40af); border-radius: .25rem;
          cursor: pointer;
        }
        .ct-ed-add:hover { background: rgba(37, 99, 235, .06); }
        .ct-ed-hint {
          font-size: .8125rem; margin-left: 1.85rem;
        }
        .ct-ed-detail {
          display: flex; align-items: center; gap: .35rem;
          margin-left: 1.85rem;
        }
        .ct-ed-detail-lbl {
          font-size: .75rem; color: var(--muted-foreground);
          font-weight: 600;
        }
        .ct-ed-formula {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .8125rem; margin-left: 1.85rem;
        }
        .ct-ed-help {
          font-size: .7rem; color: var(--muted-foreground);
          margin-left: 1.85rem; font-style: italic;
        }
        .ct-ed-warn {
          font-size: .7rem; color: var(--destructive, #dc2626);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
