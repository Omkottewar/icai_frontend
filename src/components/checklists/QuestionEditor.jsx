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
// Spreadsheet-style editor. The whole table is visible at once: column
// headers along the top (label + Text/Number toggle + delete), row labels
// down the left, empty cells in the middle (values are entered when the
// checklist is USED, not when it's designed).
//
// Two column types only — Text and Number. Any existing 'money' or 'status'
// column in a legacy config is treated as Number (for the editor UI); the
// underlying stored type is preserved unless the admin changes it, so
// pre-seeded templates like Draft Budget don't lose their ₹ formatting.
//
// Total / computed rows from legacy seeds are displayed with a small
// "auto" badge; their label can still be renamed but the derivation
// (kind / total_of / formula) is preserved as-is.
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

  // Column mutations
  const patchColumn = (i, patch) => {
    const next = columns.map((c, idx) => {
      if (idx !== i) return c;
      const merged = { ...c, ...patch };
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

  // Row mutations
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

  // Editor collapses legacy money/status to "number" for the type dropdown.
  const editorType = (c) => (c.type === 'text' ? 'text' : 'number');

  if (columns.length === 0 && rows.length === 0) {
    return (
      <div className="ct-ed-empty-wrap">
        <p className="ct-ed-empty-hint">
          Start by adding your first column and row. Column headers are like Excel: type "Item", "Quantity", "Person". Rows are the items to check off.
        </p>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button type="button" onClick={addColumn} className="ct-ed-add">+ First column</button>
          <button type="button" onClick={addRow} className="ct-ed-add" disabled={columns.length === 0}>+ First row</button>
        </div>
        <style>{`
          .ct-ed-empty-wrap {
            margin-top: .5rem; padding: 1rem;
            background: var(--muted, #f8fafc); border: 1px dashed var(--border);
            border-radius: .4rem; display: flex; flex-direction: column; gap: .75rem;
          }
          .ct-ed-empty-hint { font-size: .85rem; color: var(--muted-foreground); margin: 0; }
          .ct-ed-add {
            padding: .35rem .7rem; font-size: .8rem; font-weight: 600;
            border: 1px solid var(--border); border-radius: .3rem;
            background: var(--card); cursor: pointer;
          }
          .ct-ed-add:disabled { opacity: .5; cursor: not-allowed; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ct-ed-grid-wrap">
      <table className="ct-ed-grid">
        <thead>
          <tr>
            {/* Empty top-left corner cell */}
            <th className="ct-ed-corner"></th>
            {columns.map((c, i) => (
              <th key={i} className="ct-ed-colhead">
                <div className="ct-ed-colhead-inner">
                  <input
                    type="text"
                    className="ct-ed-colhead-label"
                    value={c.label || ''}
                    placeholder={`Column ${i + 1}`}
                    onChange={(e) => patchColumn(i, { label: e.target.value })}
                  />
                  <div className="ct-ed-colhead-controls">
                    <select
                      className="ct-ed-type"
                      value={editorType(c)}
                      onChange={(e) => patchColumn(i, { type: e.target.value })}
                      title="Cell type"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                    </select>
                    <button
                      type="button"
                      className="ct-ed-delcol"
                      onClick={() => removeColumn(i)}
                      title="Delete this column"
                      aria-label={`Delete column ${c.label || i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </th>
            ))}
            <th className="ct-ed-addcol">
              <button type="button" className="ct-ed-plus" onClick={addColumn} title="Add column">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const kind = r.kind || 'data';
            const isAuto = kind !== 'data';
            return (
              <tr key={i} className={isAuto ? 'ct-ed-row-auto' : ''}>
                <th className="ct-ed-rowhead">
                  <div className="ct-ed-rowhead-inner">
                    <input
                      type="text"
                      className="ct-ed-rowhead-label"
                      value={r.label || ''}
                      placeholder={`Row ${i + 1}`}
                      onChange={(e) => patchRow(i, { label: e.target.value })}
                    />
                    {isAuto && <span className="ct-ed-auto-badge" title={`Auto ${kind}`}>auto</span>}
                    <button
                      type="button"
                      className="ct-ed-delrow"
                      onClick={() => removeRow(i)}
                      title="Delete this row"
                      aria-label={`Delete row ${r.label || i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                </th>
                {columns.map((_, ci) => (
                  <td key={ci} className="ct-ed-cell">—</td>
                ))}
                <td className="ct-ed-cell-fill" />
              </tr>
            );
          })}
          <tr>
            <th className="ct-ed-addrow">
              <button type="button" className="ct-ed-plus-row" onClick={addRow}>+ Add row</button>
            </th>
            {columns.map((_, ci) => <td key={ci} className="ct-ed-cell-empty" />)}
            <td className="ct-ed-cell-empty" />
          </tr>
        </tbody>
      </table>
      <p className="ct-ed-note">
        Cells are empty here because values are entered when the checklist is used, not now. Just decide the columns and rows.
      </p>

      <style>{`
        .ct-ed-grid-wrap { margin-top: .5rem; overflow-x: auto; }
        .ct-ed-grid {
          border-collapse: separate; border-spacing: 0;
          width: 100%; table-layout: fixed;
          background: var(--card);
        }
        .ct-ed-grid th, .ct-ed-grid td {
          border: 1px solid var(--border);
          padding: 0; vertical-align: middle;
        }
        .ct-ed-corner {
          background: var(--muted, #f8fafc); width: 200px;
        }
        .ct-ed-colhead {
          background: #eff6ff; min-width: 140px;
        }
        .ct-ed-colhead-inner {
          display: flex; align-items: center; gap: .25rem;
          padding: .35rem .4rem;
        }
        .ct-ed-colhead-label {
          flex: 1; min-width: 0;
          border: 1px solid transparent; background: transparent;
          font: inherit; font-weight: 700; font-size: .82rem;
          padding: .2rem .3rem; border-radius: .25rem;
          color: var(--foreground);
        }
        .ct-ed-colhead-label:focus {
          outline: 0; border-color: var(--primary, #1e40af); background: white;
        }
        .ct-ed-colhead-controls {
          display: flex; align-items: center; gap: .2rem; flex-shrink: 0;
        }
        .ct-ed-type {
          font-size: .7rem; padding: .12rem .3rem;
          border: 1px solid var(--border); border-radius: .25rem;
          background: white; cursor: pointer;
        }
        .ct-ed-delcol, .ct-ed-delrow {
          background: transparent; border: 0; cursor: pointer;
          font-size: 1.05rem; font-weight: 700; line-height: 1;
          padding: 0 .3rem; color: var(--muted-foreground);
          border-radius: .2rem;
        }
        .ct-ed-delcol:hover, .ct-ed-delrow:hover {
          background: rgba(220, 38, 38, .1); color: var(--destructive, #dc2626);
        }
        .ct-ed-addcol { width: 42px; background: var(--muted, #f8fafc); }
        .ct-ed-plus {
          width: 100%; height: 100%; min-height: 2rem;
          background: transparent; border: 0; cursor: pointer;
          font-size: 1.1rem; font-weight: 700;
          color: var(--primary, #1e40af);
        }
        .ct-ed-plus:hover { background: rgba(37, 99, 235, .08); }
        .ct-ed-rowhead {
          background: #f8fafc; text-align: left; font-weight: 500;
        }
        .ct-ed-rowhead-inner {
          display: flex; align-items: center; gap: .25rem;
          padding: .3rem .4rem;
        }
        .ct-ed-rowhead-label {
          flex: 1; min-width: 0;
          border: 1px solid transparent; background: transparent;
          font: inherit; font-size: .85rem;
          padding: .2rem .3rem; border-radius: .25rem;
          color: var(--foreground);
        }
        .ct-ed-rowhead-label:focus {
          outline: 0; border-color: var(--primary, #1e40af); background: white;
        }
        .ct-ed-auto-badge {
          font-size: .6rem; font-weight: 700;
          padding: .1rem .35rem; border-radius: 999px;
          background: rgba(37, 99, 235, .12); color: var(--primary, #1e40af);
          text-transform: uppercase; letter-spacing: .04em;
        }
        .ct-ed-row-auto .ct-ed-rowhead { background: #eff6ff; font-weight: 700; }
        .ct-ed-cell {
          text-align: center; color: #cbd5e1; font-size: .8rem;
          padding: .55rem .4rem;
          background: white;
        }
        .ct-ed-cell-fill, .ct-ed-cell-empty {
          background: var(--muted, #f8fafc); border: 0 !important;
        }
        .ct-ed-addrow { padding: 0; }
        .ct-ed-plus-row {
          width: 100%; padding: .4rem .5rem;
          background: transparent; border: 0; cursor: pointer;
          font-size: .8rem; font-weight: 600;
          color: var(--primary, #1e40af); text-align: left;
        }
        .ct-ed-plus-row:hover { background: rgba(37, 99, 235, .08); }
        .ct-ed-note {
          margin: .5rem 0 0; font-size: .72rem;
          color: var(--muted-foreground); font-style: italic;
        }
        .ct-ed-add {
          padding: .35rem .7rem; font-size: .8rem; font-weight: 600;
          background: var(--primary, #1e40af); color: white;
          border: 0; border-radius: .3rem; cursor: pointer;
        }
        .ct-ed-add:disabled { opacity: .5; cursor: not-allowed; }
        .ct-ed-add:hover:not(:disabled) { background: #1e3a8a; }
      `}</style>
    </div>
  );
}
