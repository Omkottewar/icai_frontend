import { QUESTION_TYPE_MAP } from '../../lib/checklistQuestions';
import { IconTrash, IconChevronUp, IconChevronDownAlt, IconCopy } from '../../icons';

// Inline editor for a single question inside the builder. Renders:
//   • the question metadata (type chip, label, required toggle)
//   • a type-specific config sub-form (options list, min/max, scale, …)
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

  return (
    <div className="qe-card">
      <div className="qe-head">
        <div className="qe-head-left">
          <span className="qe-chip">{meta.label}</span>
          <span className="qe-pos">Q{index + 1}</span>
        </div>
        <div className="qe-head-actions">
          <button type="button" title="Move up"   disabled={index === 0}         onClick={() => onMove(-1)}><IconChevronUp size="sm" /></button>
          <button type="button" title="Move down" disabled={index === count - 1} onClick={() => onMove(+1)}><IconChevronDownAlt size="sm" /></button>
          <button type="button" title="Duplicate" onClick={onDuplicate}><IconCopy size="sm" /></button>
          <button type="button" title="Remove"   onClick={onRemove}><IconTrash size="sm" /></button>
        </div>
      </div>

      <div className="qe-body">
        <label className="qe-label">Question label</label>
        <input
          type="text"
          className="qe-input"
          value={question.label}
          placeholder={question.type === 'section_heading' ? 'Heading text' : 'What do you want to ask?'}
          onChange={(e) => onPatch({ label: e.target.value })}
        />

        {question.type !== 'section_heading' && (
          <>
            <label className="qe-label">Help text (optional)</label>
            <input
              type="text"
              className="qe-input"
              value={question.help_text || ''}
              placeholder="Short hint shown under the question"
              onChange={(e) => onPatch({ help_text: e.target.value })}
            />

            <label className="qe-checkbox">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onPatch({ required: e.target.checked })}
              />
              Required
            </label>
          </>
        )}

        <TypeConfig question={question} onPatchConfig={onPatchConfig} />
      </div>

      <style>{`
        .qe-card {
          border: 1px solid var(--border); border-radius: .5rem;
          background: var(--card); padding: 0; margin-bottom: .75rem;
        }
        .qe-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: .625rem .875rem; border-bottom: 1px solid var(--border);
          background: var(--background);
        }
        .qe-head-left { display: flex; align-items: center; gap: .5rem; }
        .qe-chip {
          font-size: .6875rem; font-weight: 700; padding: .15rem .5rem;
          background: var(--primary); color: white; border-radius: 999px;
        }
        .qe-pos { font-size: .75rem; color: var(--muted-foreground); font-weight: 600; }
        .qe-head-actions { display: flex; gap: .25rem; }
        .qe-head-actions button {
          background: transparent; border: 0; cursor: pointer; padding: .25rem;
          color: var(--muted-foreground); border-radius: .25rem;
        }
        .qe-head-actions button:hover:not(:disabled) { background: var(--background); color: var(--foreground); }
        .qe-head-actions button:disabled { opacity: .35; cursor: not-allowed; }
        .qe-body { padding: .875rem; display: flex; flex-direction: column; gap: .5rem; }
        .qe-label { font-size: .75rem; font-weight: 600; color: var(--muted-foreground); margin: .25rem 0 0; }
        .qe-input {
          width: 100%; padding: .4rem .55rem; border: 1px solid var(--border);
          border-radius: .375rem; background: var(--card); font: inherit; color: inherit;
        }
        .qe-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        .qe-checkbox {
          display: flex; align-items: center; gap: .4rem;
          font-size: .8125rem; font-weight: 500; margin-top: .25rem;
        }
      `}</style>
    </div>
  );
}

function TypeConfig({ question, onPatchConfig }) {
  const cfg = question.config || {};
  switch (question.type) {
    case 'short_text':
    case 'long_text':
      return (
        <div className="qe-grid">
          <Field label="Placeholder">
            <input
              type="text" className="qe-input"
              value={cfg.placeholder || ''}
              onChange={(e) => onPatchConfig({ placeholder: e.target.value })}
            />
          </Field>
          <Field label="Max length">
            <input
              type="number" className="qe-input"
              value={cfg.max_length ?? ''}
              onChange={(e) => onPatchConfig({ max_length: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
        </div>
      );
    case 'number':
      return (
        <div className="qe-grid">
          <Field label="Min"><input type="number" className="qe-input" value={cfg.min ?? ''} onChange={(e) => onPatchConfig({ min: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Max"><input type="number" className="qe-input" value={cfg.max ?? ''} onChange={(e) => onPatchConfig({ max: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Step"><input type="number" className="qe-input" value={cfg.step ?? ''} onChange={(e) => onPatchConfig({ step: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Unit"><input type="text" className="qe-input" value={cfg.unit || ''} onChange={(e) => onPatchConfig({ unit: e.target.value })} /></Field>
        </div>
      );
    case 'money':
      return (
        <div className="qe-grid">
          <Field label="Min (₹)">
            <input
              type="number" className="qe-input"
              value={cfg.min_paise == null ? '' : cfg.min_paise / 100}
              onChange={(e) => onPatchConfig({ min_paise: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100) })}
            />
          </Field>
          <Field label="Max (₹)">
            <input
              type="number" className="qe-input"
              value={cfg.max_paise == null ? '' : cfg.max_paise / 100}
              onChange={(e) => onPatchConfig({ max_paise: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100) })}
            />
          </Field>
        </div>
      );
    case 'date':
    case 'datetime':
      return (
        <div className="qe-grid">
          <Field label="Earliest"><input type={question.type === 'date' ? 'date' : 'datetime-local'} className="qe-input" value={cfg.min || ''} onChange={(e) => onPatchConfig({ min: e.target.value })} /></Field>
          <Field label="Latest"><input type={question.type === 'date' ? 'date' : 'datetime-local'} className="qe-input" value={cfg.max || ''} onChange={(e) => onPatchConfig({ max: e.target.value })} /></Field>
        </div>
      );
    case 'radio':
    case 'dropdown':
    case 'checkbox':
      return <OptionsEditor cfg={cfg} onPatchConfig={onPatchConfig} allowMin={question.type === 'checkbox'} />;
    case 'rating':
      return (
        <Field label="Scale (max stars)">
          <input
            type="number" className="qe-input" style={{ maxWidth: 100 }}
            min={2} max={10}
            value={cfg.scale ?? 5}
            onChange={(e) => onPatchConfig({ scale: Math.max(2, Math.min(10, Number(e.target.value) || 5)) })}
          />
        </Field>
      );
    case 'file':
      return (
        <div className="qe-grid">
          <Field label="Max size (KB)"><input type="number" className="qe-input" value={cfg.max_size_kb ?? ''} onChange={(e) => onPatchConfig({ max_size_kb: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Accepted types (comma)">
            <input
              type="text" className="qe-input"
              value={Array.isArray(cfg.accept) ? cfg.accept.join(',') : ''}
              placeholder=".pdf,image/*"
              onChange={(e) => onPatchConfig({ accept: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
        </div>
      );
    default:
      return null;
  }
}

function Field({ label, children }) {
  return (
    <div>
      <label className="qe-label">{label}</label>
      {children}
      <style>{`.qe-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem; }`}</style>
    </div>
  );
}

function OptionsEditor({ cfg, onPatchConfig, allowMin }) {
  const options = Array.isArray(cfg.options) ? cfg.options : [];
  const update = (idx, patch) => {
    const next = options.map((o, i) => i === idx ? { ...o, ...patch } : o);
    onPatchConfig({ options: next });
  };
  const remove = (idx) => onPatchConfig({ options: options.filter((_, i) => i !== idx) });
  const add = () => onPatchConfig({ options: [...options, { value: `opt_${options.length + 1}`, label: `Option ${options.length + 1}` }] });

  return (
    <div>
      <label className="qe-label">Options</label>
      {options.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: '.375rem', marginBottom: '.25rem' }}>
          <input
            type="text" className="qe-input" style={{ flex: 2 }}
            placeholder="Label"
            value={o.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            type="text" className="qe-input" style={{ flex: 1 }}
            placeholder="value"
            value={o.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button type="button" onClick={() => remove(i)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '.25rem', padding: '0 .5rem', cursor: 'pointer' }}>
            <IconTrash size="sm" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} style={{ marginTop: '.25rem', fontSize: '.8125rem', background: 'transparent', color: 'var(--primary)', border: '1px dashed var(--primary)', borderRadius: '.25rem', padding: '.375rem .75rem', cursor: 'pointer' }}>
        + Add option
      </button>

      {allowMin && (
        <div className="qe-grid" style={{ marginTop: '.5rem' }}>
          <Field label="Min selected"><input type="number" className="qe-input" value={cfg.min_selected ?? ''} onChange={(e) => onPatchConfig({ min_selected: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Max selected"><input type="number" className="qe-input" value={cfg.max_selected ?? ''} onChange={(e) => onPatchConfig({ max_selected: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
        </div>
      )}
    </div>
  );
}
