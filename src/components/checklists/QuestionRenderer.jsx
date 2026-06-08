import { useState } from 'react';
import { IconStar } from '../../icons';

// Renders one question of any type. Two modes:
//   mode="fill"     — interactive input, calls onChange(value)
//   mode="readonly" — shows the stored value formatted for display
//
// Stays uncontrolled-friendly: if `value` is undefined we fall back to a
// sensible empty for the type. The parent owns state.

export default function QuestionRenderer({ question, value, onChange, mode = 'fill', error }) {
  const cfg = question.config || {};
  const readonly = mode === 'readonly';

  if (question.type === 'section_heading') {
    return (
      <div style={{ borderTop: '1px solid var(--border)', marginTop: '.5rem', paddingTop: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
          {question.label}
        </h3>
        {question.help_text && (
          <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.8125rem' }}>
            {question.help_text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="checklist-q">
      <label className="checklist-q-label">
        <span>{question.label}</span>
        {question.required && <span className="checklist-q-required">*</span>}
      </label>
      {question.help_text && <p className="checklist-q-help">{question.help_text}</p>}

      <div className="checklist-q-input">
        <Field
          question={question}
          cfg={cfg}
          value={value}
          onChange={onChange}
          readonly={readonly}
        />
      </div>
      {error && <p className="checklist-q-error">{error}</p>}

      <style>{`
        .checklist-q { padding: .75rem 0; }
        .checklist-q-label {
          display: flex; align-items: baseline; gap: .25rem;
          font-weight: 600; font-size: .9375rem; color: var(--foreground);
        }
        .checklist-q-required { color: var(--destructive, #dc2626); }
        .checklist-q-help { margin: .25rem 0 .5rem; font-size: .8125rem; color: var(--muted-foreground); }
        .checklist-q-input { margin-top: .375rem; }
        .checklist-q-input input[type="text"],
        .checklist-q-input input[type="number"],
        .checklist-q-input input[type="date"],
        .checklist-q-input input[type="datetime-local"],
        .checklist-q-input select,
        .checklist-q-input textarea {
          width: 100%; max-width: 480px;
          padding: .5rem .65rem; border: 1px solid var(--border);
          border-radius: .375rem; background: var(--card);
          font: inherit; color: inherit;
        }
        .checklist-q-input textarea { min-height: 90px; resize: vertical; }
        .checklist-q-input input:focus, .checklist-q-input select:focus, .checklist-q-input textarea:focus {
          outline: 2px solid var(--primary); outline-offset: -1px;
        }
        .checklist-q-error {
          color: var(--destructive, #dc2626); font-size: .8125rem; margin-top: .25rem;
        }
        .checklist-q-radio-row, .checklist-q-checkbox-row {
          display: flex; align-items: center; gap: .5rem; padding: .25rem 0;
          font-size: .9rem;
        }
        .checklist-q-readonly {
          padding: .5rem .65rem; background: var(--background);
          border: 1px dashed var(--border); border-radius: .375rem;
          font-size: .9rem; min-height: 2.25rem;
        }
      `}</style>
    </div>
  );
}

function Field({ question, cfg, value, onChange, readonly }) {
  const set = (v) => onChange?.(v);

  // Readonly display: simple text for most, chips for arrays.
  if (readonly) {
    return <ReadonlyValue type={question.type} value={value} cfg={cfg} />;
  }

  switch (question.type) {
    case 'short_text':
      return (
        <input
          type="text"
          value={value ?? ''}
          maxLength={cfg.max_length || undefined}
          placeholder={cfg.placeholder || ''}
          onChange={(e) => set(e.target.value)}
        />
      );
    case 'long_text':
      return (
        <textarea
          value={value ?? ''}
          maxLength={cfg.max_length || undefined}
          placeholder={cfg.placeholder || ''}
          onChange={(e) => set(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          min={cfg.min ?? undefined}
          max={cfg.max ?? undefined}
          step={cfg.step ?? 'any'}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'money': {
      // Store paise. UI shows rupees with 2-decimal precision.
      const rupees = value == null ? '' : (Number(value) / 100).toFixed(2);
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
          <span className="muted-text">₹</span>
          <input
            type="number"
            value={rupees}
            min="0" step="0.01"
            onChange={(e) => set(e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))}
            style={{ width: 160 }}
          />
        </div>
      );
    }
    case 'date':
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => set(e.target.value || null)}
        />
      );
    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={value ?? ''}
          onChange={(e) => set(e.target.value || null)}
        />
      );
    case 'radio':
      return (
        <div>
          {(cfg.options || []).map((o) => (
            <label key={o.value} className="checklist-q-radio-row">
              <input
                type="radio"
                name={question.id || question._draftId}
                checked={value === o.value}
                onChange={() => set(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    case 'dropdown':
      return (
        <select value={value ?? ''} onChange={(e) => set(e.target.value || null)}>
          <option value="">— Select —</option>
          {(cfg.options || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case 'yes_no':
      return (
        <div style={{ display: 'flex', gap: '.75rem' }}>
          {[{ v: 'yes', t: 'Yes' }, { v: 'no', t: 'No' }].map((o) => (
            <label key={o.v} className="checklist-q-radio-row">
              <input
                type="radio"
                name={question.id || question._draftId}
                checked={value === o.v}
                onChange={() => set(o.v)}
              />
              <span>{o.t}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox': {
      const arr = Array.isArray(value) ? value : [];
      const toggle = (v) => {
        set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
      };
      return (
        <div>
          {(cfg.options || []).map((o) => (
            <label key={o.value} className="checklist-q-checkbox-row">
              <input type="checkbox" checked={arr.includes(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'rating': {
      const scale = cfg.scale || 5;
      const cur = Number(value) || 0;
      return (
        <div style={{ display: 'inline-flex', gap: '.25rem' }}>
          {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set(cur === n ? null : n)}
              aria-label={`Rate ${n} of ${scale}`}
              style={{
                background: 'transparent', border: 0, cursor: 'pointer',
                color: n <= cur ? 'var(--accent, #f59e0b)' : 'var(--border)',
                padding: '.125rem',
              }}
            >
              <IconStar />
            </button>
          ))}
        </div>
      );
    }
    case 'file':
      return <FileField cfg={cfg} value={value} onChange={set} />;
    default:
      return <em className="muted-text">Unsupported type: {question.type}</em>;
  }
}

function FileField({ cfg, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const sizeKb = Math.ceil(file.size / 1024);
      if (cfg.max_size_kb && sizeKb > cfg.max_size_kb) {
        throw new Error(`Max ${cfg.max_size_kb} KB`);
      }
      // For now we encode small files as data URLs and let the response
      // payload carry { file_id: null, name, size_kb, data_url }. A real
      // upload endpoint can swap this without changing callers.
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      onChange({
        file_id: null,
        name: file.name,
        size_kb: sizeKb,
        mime: file.type,
        data_url: dataUrl,
      });
    } catch (e2) {
      setErr(e2.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {value && (
        <div style={{ marginBottom: '.5rem', fontSize: '.875rem' }}>
          <strong>{value.name}</strong>{' '}
          <span className="muted-text">({value.size_kb} KB)</span>{' '}
          <button type="button" onClick={() => onChange(null)} style={{ marginLeft: '.5rem' }}>
            Remove
          </button>
        </div>
      )}
      <input
        type="file"
        onChange={onPick}
        accept={Array.isArray(cfg.accept) ? cfg.accept.join(',') : undefined}
        disabled={uploading}
      />
      {uploading && <p className="muted-text" style={{ fontSize: '.8125rem' }}>Uploading…</p>}
      {err && <p className="checklist-q-error">{err}</p>}
    </div>
  );
}

function ReadonlyValue({ type, value, cfg }) {
  if (value === null || value === undefined || value === '') {
    return <div className="checklist-q-readonly muted-text">— No answer —</div>;
  }
  switch (type) {
    case 'money':
      return <div className="checklist-q-readonly">₹ {(Number(value) / 100).toFixed(2)}</div>;
    case 'radio':
    case 'dropdown': {
      const opt = (cfg.options || []).find((o) => o.value === value);
      return <div className="checklist-q-readonly">{opt?.label ?? String(value)}</div>;
    }
    case 'yes_no':
      return <div className="checklist-q-readonly">{value === 'yes' ? 'Yes' : 'No'}</div>;
    case 'checkbox': {
      const labels = (Array.isArray(value) ? value : []).map((v) => {
        const opt = (cfg.options || []).find((o) => o.value === v);
        return opt?.label ?? v;
      });
      return <div className="checklist-q-readonly">{labels.join(', ')}</div>;
    }
    case 'rating':
      return <div className="checklist-q-readonly">{value} / {cfg.scale || 5}</div>;
    case 'file':
      return (
        <div className="checklist-q-readonly">
          {value?.name ?? 'File'} ({value?.size_kb ?? '?'} KB)
        </div>
      );
    case 'long_text':
      return <div className="checklist-q-readonly" style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</div>;
    default:
      return <div className="checklist-q-readonly">{String(value)}</div>;
  }
}
