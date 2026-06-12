import { Fragment, useEffect, useState } from 'react';
import { IconStar } from '../../icons';

// Renders one question of any type. Two modes:
//   mode="fill"     — interactive input, calls onChange(value)
//   mode="readonly" — shows the stored value formatted for display
//
// Stays uncontrolled-friendly: if `value` is undefined we fall back to a
// sensible empty for the type. The parent owns state.
//
// Optional props for task_list questions:
//   tasks         — array of {id, description, assignee_id, assignee_name,
//                   assignee_email, due_date, status, notes} from the
//                   detail endpoint. Gives the UI the DB id so it can call
//                   /done /reopen /cancel without a save round-trip.
//   onTaskAction  — async (taskId, action, body?) => void; action is
//                   'done' | 'reopen' | 'cancel'.

export default function QuestionRenderer({ question, value, onChange, mode = 'fill', error, tasks, onTaskAction }) {
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
          tasks={tasks}
          onTaskAction={onTaskAction}
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

function Field({ question, cfg, value, onChange, readonly, tasks, onTaskAction }) {
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
    case 'time_range': {
      // Stored as { start: 'HH:MM', end: 'HH:MM' } in 24h. Renders two
      // time pickers side by side with an em-dash separator.
      const v = (value && typeof value === 'object') ? value : { start: '', end: '' };
      const update = (patch) => set({ start: v.start || '', end: v.end || '', ...patch });
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
          <input type="time" value={v.start || ''} onChange={(e) => update({ start: e.target.value })} style={{ width: 130 }} />
          <span style={{ color: 'var(--muted-foreground)' }}>—</span>
          <input type="time" value={v.end || ''} onChange={(e) => update({ end: e.target.value })} style={{ width: 130 }} />
        </div>
      );
    }
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
    case 'task_list':
      return (
        <TaskListField
          value={value}
          onChange={set}
          readonly={readonly}
          tasks={tasks}
          onTaskAction={onTaskAction}
        />
      );
    case 'budget_table':
      return (
        <BudgetTableField
          value={value}
          onChange={set}
          readonly={readonly}
          cfg={cfg}
        />
      );
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

// ─── Task list field ─────────────────────────────────────────────────────
//
// One row per task: description text + assignee picker + due date + status
// pill + status actions.
//
// User search: typing in the assignee input hits /api/checklist-tasks/_users
// (debounced). Picked users are stored by id but we keep their display name
// in local state so we can show "Sanju Patil" without re-fetching every save.
//
// Task ids: when the parent passes `tasks` (from the detail endpoint), we
// match each value row to a DB id by (sort_order, description) so the
// done/reopen/cancel actions can call the per-task endpoints without
// waiting for a save round-trip.
function TaskListField({ value, onChange, readonly, tasks, onTaskAction }) {
  const items = Array.isArray(value) ? value : [];

  const update = (idx, patch) => {
    onChange(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const addRow = () => onChange([
    ...items,
    { cid: `t_${Math.random().toString(36).slice(2, 9)}`, description: '', assignee_id: null, due_date: null, status: 'pending' },
  ]);
  const removeRow = (idx) => onChange(items.filter((_, i) => i !== idx));

  // Map index → DB task row (status, id, server-known assignee name).
  // Same-index match works because the backend reconciles tasks in sort_order.
  const dbTaskByIdx = (idx) => (Array.isArray(tasks) ? tasks[idx] : null) || null;

  if (readonly) {
    return (
      <div className="tlist">
        {items.length === 0
          ? <em className="muted-text">— no tasks —</em>
          : items.map((it, i) => {
              const dbt = dbTaskByIdx(i);
              return (
                <div key={i} className="tlist-row tlist-row-readonly">
                  <span className="tlist-bullet">{i + 1}.</span>
                  <div className="tlist-body">
                    <div className="tlist-desc">{it.description || <em className="muted-text">(no description)</em>}</div>
                    <div className="tlist-meta">
                      {dbt?.assignee_name ? <span>👤 {dbt.assignee_name}</span> : <span className="muted-text">unassigned</span>}
                      {(it.due_date || dbt?.due_date) && <span>· due {it.due_date ?? dbt?.due_date}</span>}
                    </div>
                  </div>
                  <TaskStatusPill status={dbt?.status ?? it.status ?? 'pending'} />
                </div>
              );
            })
        }
        {tlistStyles()}
      </div>
    );
  }

  return (
    <div className="tlist">
      {items.length === 0 && (
        <div className="tlist-empty">No tasks yet. Click below to add one.</div>
      )}
      {items.map((it, i) => {
        const dbt = dbTaskByIdx(i);
        const dbStatus = dbt?.status ?? it.status ?? 'pending';
        return (
          <div key={it.cid || i} className="tlist-row">
            <span className="tlist-bullet">{i + 1}.</span>
            <div className="tlist-body">
              <input
                type="text"
                className="tlist-input"
                value={it.description || ''}
                placeholder="What needs to be done?"
                onChange={(e) => update(i, { description: e.target.value })}
              />
              <div className="tlist-meta-edit">
                <AssigneePicker
                  assigneeId={it.assignee_id}
                  assigneeName={dbt?.assignee_name}
                  onPick={(u) => update(i, { assignee_id: u?.id ?? null })}
                />
                <input
                  type="date"
                  className="tlist-input tlist-date"
                  value={it.due_date || ''}
                  onChange={(e) => update(i, { due_date: e.target.value || null })}
                />
                <TaskStatusPill status={dbStatus} />
                {dbt && onTaskAction && dbStatus === 'pending' && (
                  <button type="button" className="tlist-action tlist-action-done"
                    onClick={() => onTaskAction(dbt.id, 'done')}>Mark done</button>
                )}
                {dbt && onTaskAction && dbStatus === 'done' && (
                  <button type="button" className="tlist-action"
                    onClick={() => onTaskAction(dbt.id, 'reopen')}>Reopen</button>
                )}
                {dbt && onTaskAction && dbStatus !== 'cancelled' && (
                  <button type="button" className="tlist-action tlist-action-cancel"
                    onClick={() => onTaskAction(dbt.id, 'cancel')}>Cancel</button>
                )}
                <button type="button" className="tlist-remove" onClick={() => removeRow(i)} title="Remove this row">×</button>
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={addRow} className="tlist-add">+ Add task</button>
      {tlistStyles()}
    </div>
  );
}

// Small inline status pill used in both readonly and fill views.
function TaskStatusPill({ status }) {
  const styles = {
    pending:  { bg: '#fef3c7', fg: '#92400e', label: 'Pending' },
    done:     { bg: '#dcfce7', fg: '#166534', label: 'Done' },
    cancelled:{ bg: '#fee2e2', fg: '#991b1b', label: 'Cancelled' },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '.1rem .5rem', borderRadius: 999,
      fontSize: '.65rem', fontWeight: 700,
      background: s.bg, color: s.fg,
    }}>{s.label}</span>
  );
}

// Type-ahead picker over /api/checklist-tasks/_users. Stores the user's id
// in the parent state; displays their name once known.
function AssigneePicker({ assigneeId, assigneeName, onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickedName, setPickedName] = useState(assigneeName || '');

  // Debounce — fire after 200ms of idle typing.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/checklist-tasks/_users?q=' + encodeURIComponent(q), { credentials: 'include' });
        const j = await r.json();
        setResults(j.rows || []);
      } catch { /* swallow */ }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open]);

  // Keep displayed name fresh if the parent passes a new server name later.
  useEffect(() => { if (assigneeName) setPickedName(assigneeName); }, [assigneeName]);

  if (!open) {
    return (
      <button type="button" className="tlist-assignee-button" onClick={() => setOpen(true)}>
        {assigneeId
          ? <span>👤 {pickedName || 'Assigned user'}</span>
          : <span style={{ color: 'var(--muted-foreground)' }}>👤 Assign…</span>}
      </button>
    );
  }

  return (
    <div className="tlist-assignee-pop">
      <input
        type="text"
        autoFocus
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="tlist-input"
      />
      <div className="tlist-assignee-list">
        {loading && <div className="tlist-assignee-loading">Searching…</div>}
        {!loading && results.length === 0 && q && <div className="tlist-assignee-loading">No matches</div>}
        {results.slice(0, 8).map((u) => (
          <button key={u.id} type="button" className="tlist-assignee-row"
            onClick={() => {
              onPick(u);
              setPickedName(u.name);
              setOpen(false);
              setQ('');
            }}>
            <strong>{u.name}</strong>
            <span className="muted-text"> · {u.email}</span>
          </button>
        ))}
        <button type="button" className="tlist-assignee-row tlist-assignee-clear"
          onClick={() => { onPick(null); setPickedName(''); setOpen(false); setQ(''); }}>
          Clear assignment
        </button>
      </div>
      <button type="button" className="tlist-assignee-cancel" onClick={() => { setOpen(false); setQ(''); }}>Cancel</button>
    </div>
  );
}

function tlistStyles() {
  return (
    <style>{`
      .tlist { display: flex; flex-direction: column; gap: .375rem; }
      .tlist-empty {
        padding: .75rem; text-align: center;
        background: var(--muted, #f8fafc); border: 1px dashed var(--border);
        border-radius: .375rem; font-size: .8125rem; color: var(--muted-foreground);
      }
      .tlist-row {
        display: flex; gap: .5rem; align-items: flex-start;
        padding: .5rem .625rem;
        background: var(--card); border: 1px solid var(--border);
        border-radius: .375rem;
      }
      .tlist-row-readonly { background: transparent; }
      .tlist-bullet { font-size: .8125rem; color: var(--muted-foreground); min-width: 1.5rem; padding-top: .35rem; }
      .tlist-body { flex: 1; display: flex; flex-direction: column; gap: .375rem; min-width: 0; }
      .tlist-input {
        width: 100%; padding: .35rem .55rem;
        border: 1px solid var(--border); border-radius: .25rem;
        background: var(--card); font: inherit; color: inherit;
      }
      .tlist-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
      .tlist-date { max-width: 12rem; }
      .tlist-desc { font-size: .875rem; font-weight: 500; }
      .tlist-meta { font-size: .75rem; color: var(--muted-foreground); display: flex; gap: .5rem; flex-wrap: wrap; }
      .tlist-meta-edit {
        display: flex; gap: .375rem; align-items: center; flex-wrap: wrap;
      }
      .tlist-assignee-button {
        display: inline-flex; align-items: center; gap: .25rem;
        padding: .3rem .55rem; font-size: .75rem;
        background: var(--muted, #f8fafc); border: 1px solid var(--border);
        border-radius: .25rem; cursor: pointer;
      }
      .tlist-assignee-button:hover { border-color: var(--primary); background: white; }
      .tlist-assignee-pop {
        position: relative;
        display: flex; flex-direction: column; gap: .25rem;
        min-width: 16rem;
        padding: .375rem;
        background: white; border: 1px solid var(--border);
        border-radius: .375rem; box-shadow: 0 4px 14px rgba(0,0,0,.08);
        z-index: 5;
      }
      .tlist-assignee-list { max-height: 14rem; overflow-y: auto; }
      .tlist-assignee-loading { padding: .5rem; font-size: .8125rem; color: var(--muted-foreground); text-align: center; }
      .tlist-assignee-row {
        display: block; width: 100%; text-align: left;
        padding: .35rem .5rem; background: transparent; border: 0;
        cursor: pointer; font-size: .8125rem; border-radius: .25rem;
      }
      .tlist-assignee-row:hover { background: var(--muted, #f1f5f9); }
      .tlist-assignee-clear { color: var(--muted-foreground); font-style: italic; }
      .tlist-assignee-cancel {
        background: transparent; border: 0; cursor: pointer;
        font-size: .7rem; color: var(--muted-foreground);
        align-self: flex-end;
      }
      .tlist-action {
        padding: .25rem .55rem; font-size: .7rem; font-weight: 600;
        border: 1px solid var(--border); border-radius: .25rem;
        background: var(--muted, #f8fafc); cursor: pointer;
      }
      .tlist-action:hover { background: white; border-color: var(--primary); }
      .tlist-action-done { background: #16a34a; color: white; border-color: #16a34a; }
      .tlist-action-done:hover { background: #15803d; }
      .tlist-action-cancel { color: #b91c1c; border-color: #fecaca; background: white; }
      .tlist-action-cancel:hover { background: #fee2e2; }
      .tlist-remove {
        background: transparent; border: 1px solid transparent;
        border-radius: .25rem; padding: 0 .35rem;
        font-size: 1rem; line-height: 1; color: var(--muted-foreground);
        cursor: pointer; margin-left: auto;
      }
      .tlist-remove:hover { background: var(--muted, #f1f5f9); color: var(--destructive); }
      .tlist-add {
        align-self: flex-start;
        padding: .3rem .625rem; font-size: .75rem; font-weight: 600;
        background: transparent; color: var(--primary, #1e40af);
        border: 1px dashed var(--primary, #1e40af); border-radius: .25rem;
        cursor: pointer;
      }
      .tlist-add:hover { background: rgba(37, 99, 235, .06); }
    `}</style>
  );
}

// ─── Budget table field ─────────────────────────────────────────────────
//
// Spreadsheet-style budget editor that matches the branch's existing Excel
// format. Auto-computes subtotals, grand total, and deficit/surplus on
// every keystroke so the treasurer always sees the bottom line.
//
// Storage shape (all amounts in PAISE — integer):
//   {
//     faculty_names: ['CA X', '', ...],
//     revenue: {
//       participation: { participants: <int>, fee_paise: <int> },
//       other: [{ label, amount_paise }],
//     },
//     expenses: {
//       stay: [paise, paise, ...],                          // per-faculty
//       travel: [{ to, from }, ...],                        // per-faculty (paise)
//       food_faculty: [paise, ...],                         // per-faculty
//       memento: [{ label, amount_paise }],                 // addable rows
//       cab: [paise, ...],                                  // per-faculty
//       food_event: [{ label, amount_paise }],              // addable
//       venue: [{ label, amount_paise }],                   // addable
//       photography / material / transportation / printing / flower /
//       light_sound / led_screen: paise (single amount each)
//       other: [{ label, amount_paise }],                   // addable
//     }
//   }
function BudgetTableField({ value, onChange, readonly, cfg }) {
  const facultyCount = Number(cfg?.faculty_count) || 6;

  // Defensive shape — backfill missing keys so the renderer doesn't crash
  // if an older response is opened.
  const v = ensureBudgetShape(value, facultyCount);

  const update = (mut) => {
    const next = JSON.parse(JSON.stringify(v));
    mut(next);
    onChange(next);
  };

  // ─── Computed totals ─────────────────────────────────────────────
  const sumNumArr = (a) => (Array.isArray(a) ? a.reduce((s, x) => s + (Number(x) || 0), 0) : 0);
  const sumTravel = (a) => (Array.isArray(a) ? a.reduce((s, x) => s + (Number(x?.to) || 0) + (Number(x?.from) || 0), 0) : 0);
  const sumLabeled = (a) => (Array.isArray(a) ? a.reduce((s, x) => s + (Number(x?.amount_paise) || 0), 0) : 0);

  const revParticipation = (v.revenue.participation.participants || 0) * (v.revenue.participation.fee_paise || 0);
  const revOther = sumLabeled(v.revenue.other);
  const revenueTotal = revParticipation + revOther;

  const expStay     = sumNumArr(v.expenses.stay);
  const expTravel   = sumTravel(v.expenses.travel);
  const expFoodFac  = sumNumArr(v.expenses.food_faculty);
  const expMemento  = sumLabeled(v.expenses.memento);
  const expCab      = sumNumArr(v.expenses.cab);
  const expFoodEvt  = sumLabeled(v.expenses.food_event);
  const expVenue    = sumLabeled(v.expenses.venue);
  const expSingles  = (v.expenses.photography || 0)
                     + (v.expenses.material || 0)
                     + (v.expenses.transportation || 0)
                     + (v.expenses.printing || 0)
                     + (v.expenses.flower || 0)
                     + (v.expenses.light_sound || 0)
                     + (v.expenses.led_screen || 0);
  const expOther    = sumLabeled(v.expenses.other);
  const expensesTotal = expStay + expTravel + expFoodFac + expMemento + expCab + expFoodEvt + expVenue + expSingles + expOther;

  const deficit = expensesTotal - revenueTotal;  // > 0 means deficit; < 0 means surplus

  return (
    <div className="bt-wrap">
      {/* ─── Revenue ─── */}
      <SectionHeader letter="A" title="Particulars of Revenue" />
      <table className="bt">
        <colgroup><col style={{ width: '60%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup>
        <thead><tr><th /><th>Amount</th><th>Total</th></tr></thead>
        <tbody>
          <tr className="bt-group"><td colSpan={3}>1. Registration (Members)</td></tr>
          <tr>
            <td>Expected No. of Participants</td>
            <td><NumInput readonly={readonly} value={v.revenue.participation.participants}
              onChange={(n) => update((x) => { x.revenue.participation.participants = n; })} /></td>
            <td />
          </tr>
          <tr>
            <td>Fee per Participant</td>
            <td><MoneyInput readonly={readonly} value={v.revenue.participation.fee_paise}
              onChange={(p) => update((x) => { x.revenue.participation.fee_paise = p; })} /></td>
            <td />
          </tr>
          <tr className="bt-subtotal">
            <td>Total Revenue from Participation Fees</td>
            <td />
            <td>{fmtMoney(revParticipation)}</td>
          </tr>
          <tr className="bt-group"><td colSpan={3}>2. Any other Revenue</td></tr>
          {v.revenue.other.map((row, i) => (
            <LabeledAmountRow key={i}
              row={row}
              readonly={readonly}
              onChangeLabel={(label) => update((x) => { x.revenue.other[i].label = label; })}
              onChangeAmount={(p) => update((x) => { x.revenue.other[i].amount_paise = p; })}
              onRemove={readonly ? null : () => update((x) => { x.revenue.other.splice(i, 1); })}
            />
          ))}
          {!readonly && (
            <tr><td colSpan={3}>
              <button type="button" className="bt-add"
                onClick={() => update((x) => { x.revenue.other.push({ label: '', amount_paise: 0 }); })}>
                + Add revenue line
              </button>
            </td></tr>
          )}
          <tr className="bt-total">
            <td>Total Revenue for Program</td>
            <td />
            <td>{fmtMoney(revenueTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* ─── Expenses ─── */}
      <SectionHeader letter="B" title="Particulars of Expenses" />
      <table className="bt">
        <colgroup><col style={{ width: '60%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup>
        <thead><tr><th /><th>Amount</th><th>Total</th></tr></thead>
        <tbody>

          <PerFacultyBlock idx="1" title="Stay Expenses" facultyCount={facultyCount}
            names={v.faculty_names} values={v.expenses.stay} readonly={readonly}
            onChangeName={(i, name) => update((x) => { x.faculty_names[i] = name; })}
            onChange={(i, p) => update((x) => { x.expenses.stay[i] = p; })} />

          <TravelBlock idx="2" facultyCount={facultyCount}
            names={v.faculty_names} rows={v.expenses.travel} readonly={readonly}
            onChange={(i, key, p) => update((x) => { x.expenses.travel[i][key] = p; })} />

          <PerFacultyBlock idx="3" title="Food Expenses (Faculty)" facultyCount={facultyCount}
            names={v.faculty_names} values={v.expenses.food_faculty} readonly={readonly}
            onChangeName={(i, name) => update((x) => { x.faculty_names[i] = name; })}
            onChange={(i, p) => update((x) => { x.expenses.food_faculty[i] = p; })} />

          <LabeledRowsBlock idx="4" title="Memento Expenses" rows={v.expenses.memento} readonly={readonly}
            placeholder="e.g. Speaker memento"
            onChangeLabel={(i, label) => update((x) => { x.expenses.memento[i].label = label; })}
            onChangeAmount={(i, p) => update((x) => { x.expenses.memento[i].amount_paise = p; })}
            onAdd={() => update((x) => { x.expenses.memento.push({ label: '', amount_paise: 0 }); })}
            onRemove={(i) => update((x) => { x.expenses.memento.splice(i, 1); })} />

          <PerFacultyBlock idx="5" title="Cab Expenses (Local Conveyance)" facultyCount={facultyCount}
            names={v.faculty_names} values={v.expenses.cab} readonly={readonly}
            onChangeName={(i, name) => update((x) => { x.faculty_names[i] = name; })}
            onChange={(i, p) => update((x) => { x.expenses.cab[i] = p; })} />

          <LabeledRowsBlock idx="6" title="Food Expenses (Event)" rows={v.expenses.food_event} readonly={readonly}
            placeholder="e.g. Day 1 — 150 × 400"
            onChangeLabel={(i, label) => update((x) => { x.expenses.food_event[i].label = label; })}
            onChangeAmount={(i, p) => update((x) => { x.expenses.food_event[i].amount_paise = p; })}
            onAdd={() => update((x) => { x.expenses.food_event.push({ label: '', amount_paise: 0 }); })}
            onRemove={(i) => update((x) => { x.expenses.food_event.splice(i, 1); })} />

          <LabeledRowsBlock idx="7" title="Banquet / Seminar Hall Rent" rows={v.expenses.venue} readonly={readonly}
            placeholder="e.g. Day 1 — Auditorium"
            onChangeLabel={(i, label) => update((x) => { x.expenses.venue[i].label = label; })}
            onChangeAmount={(i, p) => update((x) => { x.expenses.venue[i].amount_paise = p; })}
            onAdd={() => update((x) => { x.expenses.venue.push({ label: '', amount_paise: 0 }); })}
            onRemove={(i) => update((x) => { x.expenses.venue.splice(i, 1); })} />

          <SingleAmountRow idx="8"  title="Photography Expenses"           value={v.expenses.photography}    readonly={readonly} onChange={(p) => update((x) => { x.expenses.photography = p; })} />
          <SingleAmountRow idx="9"  title="Background Material & Kit"      value={v.expenses.material}        readonly={readonly} onChange={(p) => update((x) => { x.expenses.material = p; })} />
          <SingleAmountRow idx="10" title="Transportation Expenses (if any)" value={v.expenses.transportation} readonly={readonly} onChange={(p) => update((x) => { x.expenses.transportation = p; })} />
          <SingleAmountRow idx="11" title="Printing & Stationary"          value={v.expenses.printing}        readonly={readonly} onChange={(p) => update((x) => { x.expenses.printing = p; })} />
          <SingleAmountRow idx="12" title="Flower Decoration"              value={v.expenses.flower}          readonly={readonly} onChange={(p) => update((x) => { x.expenses.flower = p; })} />
          <SingleAmountRow idx="13" title="Light & Sound"                  value={v.expenses.light_sound}     readonly={readonly} onChange={(p) => update((x) => { x.expenses.light_sound = p; })} />
          <SingleAmountRow idx="14" title="LED Screen"                     value={v.expenses.led_screen}      readonly={readonly} onChange={(p) => update((x) => { x.expenses.led_screen = p; })} />

          <LabeledRowsBlock idx="15" title="Any other — please specify" rows={v.expenses.other} readonly={readonly}
            placeholder="Description of the expense"
            onChangeLabel={(i, label) => update((x) => { x.expenses.other[i].label = label; })}
            onChangeAmount={(i, p) => update((x) => { x.expenses.other[i].amount_paise = p; })}
            onAdd={() => update((x) => { x.expenses.other.push({ label: '', amount_paise: 0 }); })}
            onRemove={(i) => update((x) => { x.expenses.other.splice(i, 1); })} />

          {/* ─── Grand totals ─── */}
          <tr className="bt-grand-total">
            <td>Net Amount</td>
            <td />
            <td>{fmtMoney(expensesTotal)}</td>
          </tr>
          <tr className={'bt-deficit ' + (deficit > 0 ? 'is-deficit' : 'is-surplus')}>
            <td>{deficit > 0 ? 'Deficit' : (deficit < 0 ? 'Surplus' : 'Net')}</td>
            <td />
            <td>{fmtMoney(Math.abs(deficit))}</td>
          </tr>
        </tbody>
      </table>

      <style>{`
        .bt-wrap { font-size: .85rem; }
        .bt {
          width: 100%; border-collapse: collapse;
          margin-bottom: 1rem; background: white;
          border: 1px solid #cbd5e1;
        }
        .bt th, .bt td {
          padding: .35rem .55rem;
          border: 1px solid #cbd5e1;
          vertical-align: middle;
        }
        .bt thead th {
          background: #f1f5f9; font-size: .75rem;
          text-align: right; font-weight: 700;
        }
        .bt thead th:first-child { text-align: left; }
        .bt td:nth-child(2), .bt td:nth-child(3) { text-align: right; }
        .bt-group td {
          background: #e2e8f0; font-weight: 700; font-size: .85rem;
        }
        .bt-subtotal td { background: #fef3c7; font-weight: 600; }
        .bt-total td {
          background: #fde68a; font-weight: 800; font-size: .95rem;
        }
        .bt-grand-total td {
          background: #fde68a; font-weight: 800; font-size: 1rem;
        }
        .bt-deficit.is-deficit td { background: #fecaca; color: #991b1b; font-weight: 800; }
        .bt-deficit.is-surplus td { background: #bbf7d0; color: #166534; font-weight: 800; }
        .bt-num, .bt-label {
          width: 100%; padding: .25rem .4rem;
          border: 1px solid #cbd5e1; border-radius: .25rem;
          background: white; font: inherit; text-align: right;
        }
        .bt-label { text-align: left; }
        .bt-num:focus, .bt-label:focus { outline: 2px solid var(--primary, #1e40af); outline-offset: -1px; }
        .bt-faculty-row td:first-child { padding-left: 1.25rem; }
        .bt-faculty-input {
          width: 100%; padding: .2rem .35rem;
          border: 1px solid transparent; background: transparent;
          font: inherit;
        }
        .bt-faculty-input:focus { background: white; border-color: #cbd5e1; border-radius: .25rem; outline: 0; }
        .bt-add {
          font-size: .75rem; font-weight: 600;
          background: transparent; color: var(--primary, #1e40af);
          border: 1px dashed var(--primary, #1e40af);
          border-radius: .25rem; padding: .25rem .55rem;
          cursor: pointer; margin: .25rem 0;
        }
        .bt-remove {
          background: transparent; border: 0; cursor: pointer;
          color: var(--muted-foreground); font-size: .9rem; line-height: 1;
          padding: 0 .35rem;
        }
        .bt-remove:hover { color: #b91c1c; }
        .bt-section-header {
          display: flex; align-items: center; gap: .5rem;
          margin: .5rem 0 .25rem;
        }
        .bt-section-header-letter {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.5rem; height: 1.5rem; border-radius: .25rem;
          background: var(--primary, #1e40af); color: white;
          font-size: .75rem; font-weight: 800;
        }
        .bt-section-header-title { font-weight: 700; font-size: .95rem; }
      `}</style>
    </div>
  );
}

// ─── Helpers + sub-components for BudgetTableField ────────────────────────

function SectionHeader({ letter, title }) {
  return (
    <div className="bt-section-header">
      <span className="bt-section-header-letter">{letter}</span>
      <span className="bt-section-header-title">{title}</span>
    </div>
  );
}

function NumInput({ value, onChange, readonly }) {
  if (readonly) return <span>{value || 0}</span>;
  return (
    <input
      type="number"
      className="bt-num"
      min={0}
      value={value || ''}
      placeholder="0"
      onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
    />
  );
}

function MoneyInput({ value, onChange, readonly }) {
  // value is paise; we show rupees in the input.
  const rupees = value ? (value / 100) : '';
  if (readonly) return <span>{fmtMoney(value || 0)}</span>;
  return (
    <input
      type="number"
      className="bt-num"
      min={0} step="0.01"
      value={rupees}
      placeholder="0.00"
      onChange={(e) => {
        const r = e.target.value === '' ? 0 : Number(e.target.value);
        onChange(Math.max(0, Math.round(r * 100)));
      }}
    />
  );
}

function PerFacultyBlock({ idx, title, facultyCount, names, values, readonly, onChangeName, onChange }) {
  const subtotal = (Array.isArray(values) ? values : []).reduce((s, x) => s + (Number(x) || 0), 0);
  return (
    <>
      <tr className="bt-group"><td colSpan={3}>{idx}. {title}</td></tr>
      {Array.from({ length: facultyCount }, (_, i) => (
        <tr key={i} className="bt-faculty-row">
          <td>
            <input className="bt-faculty-input"
              value={names[i] ?? ''}
              placeholder={`Faculty ${i + 1}`}
              readOnly={readonly}
              onChange={(e) => onChangeName(i, e.target.value)} />
          </td>
          <td><MoneyInput readonly={readonly} value={values[i] || 0} onChange={(p) => onChange(i, p)} /></td>
          <td />
        </tr>
      ))}
      <tr className="bt-subtotal">
        <td>Subtotal</td><td /><td>{fmtMoney(subtotal)}</td>
      </tr>
    </>
  );
}

function TravelBlock({ idx, facultyCount, names, rows, readonly, onChange }) {
  const subtotal = (Array.isArray(rows) ? rows : []).reduce((s, x) => s + (Number(x?.to) || 0) + (Number(x?.from) || 0), 0);
  return (
    <>
      <tr className="bt-group"><td colSpan={3}>{idx}. Travelling Expenses</td></tr>
      {Array.from({ length: facultyCount }, (_, i) => (
        <Fragment key={i}>
          <tr className="bt-faculty-row">
            <td>{names[i] || `Faculty ${i + 1}`} — To Nagpur</td>
            <td><MoneyInput readonly={readonly} value={rows[i]?.to || 0} onChange={(p) => onChange(i, 'to', p)} /></td>
            <td />
          </tr>
          <tr className="bt-faculty-row">
            <td>{names[i] || `Faculty ${i + 1}`} — From Nagpur</td>
            <td><MoneyInput readonly={readonly} value={rows[i]?.from || 0} onChange={(p) => onChange(i, 'from', p)} /></td>
            <td />
          </tr>
        </Fragment>
      ))}
      <tr className="bt-subtotal">
        <td>Subtotal</td><td /><td>{fmtMoney(subtotal)}</td>
      </tr>
    </>
  );
}

function LabeledRowsBlock({ idx, title, rows, readonly, placeholder, onChangeLabel, onChangeAmount, onAdd, onRemove }) {
  const subtotal = (Array.isArray(rows) ? rows : []).reduce((s, x) => s + (Number(x?.amount_paise) || 0), 0);
  return (
    <>
      <tr className="bt-group"><td colSpan={3}>{idx}. {title}</td></tr>
      {rows.map((r, i) => (
        <LabeledAmountRow key={i}
          row={r}
          readonly={readonly}
          placeholder={placeholder}
          onChangeLabel={(label) => onChangeLabel(i, label)}
          onChangeAmount={(p) => onChangeAmount(i, p)}
          onRemove={readonly ? null : () => onRemove(i)}
        />
      ))}
      {!readonly && (
        <tr><td colSpan={3}>
          <button type="button" className="bt-add" onClick={onAdd}>+ Add line</button>
        </td></tr>
      )}
      <tr className="bt-subtotal">
        <td>Subtotal</td><td /><td>{fmtMoney(subtotal)}</td>
      </tr>
    </>
  );
}

function LabeledAmountRow({ row, readonly, placeholder, onChangeLabel, onChangeAmount, onRemove }) {
  return (
    <tr>
      <td style={{ display: 'flex', gap: '.25rem', alignItems: 'center' }}>
        <input
          className="bt-label"
          value={row.label ?? ''}
          placeholder={placeholder ?? 'Description'}
          readOnly={readonly}
          onChange={(e) => onChangeLabel(e.target.value)}
        />
        {onRemove && <button type="button" className="bt-remove" onClick={onRemove} title="Remove row">×</button>}
      </td>
      <td><MoneyInput readonly={readonly} value={row.amount_paise || 0} onChange={onChangeAmount} /></td>
      <td />
    </tr>
  );
}

function SingleAmountRow({ idx, title, value, readonly, onChange }) {
  return (
    <tr>
      <td><strong>{idx}.</strong> {title}</td>
      <td><MoneyInput readonly={readonly} value={value || 0} onChange={onChange} /></td>
      <td />
    </tr>
  );
}

// Format paise → "₹ 12,345" using Indian number formatting.
function fmtMoney(paise) {
  const rupees = Math.round((paise || 0) / 100);
  if (rupees === 0) return '—';
  return '₹ ' + rupees.toLocaleString('en-IN');
}

// Backfill missing keys / array lengths so the renderer is robust to old
// or partial data. faculty_count drives the array length for the per-faculty
// blocks.
function ensureBudgetShape(value, facultyCount) {
  const v = (value && typeof value === 'object') ? value : {};
  const pad = (a, n, fill) => {
    const out = Array.isArray(a) ? a.slice(0, n) : [];
    while (out.length < n) out.push(typeof fill === 'function' ? fill() : fill);
    return out;
  };
  const arr = (a) => Array.isArray(a) ? a : [];
  return {
    faculty_names: pad(v.faculty_names, facultyCount, ''),
    revenue: {
      participation: {
        participants: Number(v.revenue?.participation?.participants) || 0,
        fee_paise:    Number(v.revenue?.participation?.fee_paise) || 0,
      },
      other: arr(v.revenue?.other),
    },
    expenses: {
      stay:           pad(v.expenses?.stay, facultyCount, 0),
      travel:         pad(v.expenses?.travel, facultyCount, () => ({ to: 0, from: 0 })),
      food_faculty:   pad(v.expenses?.food_faculty, facultyCount, 0),
      memento:        arr(v.expenses?.memento),
      cab:            pad(v.expenses?.cab, facultyCount, 0),
      food_event:     arr(v.expenses?.food_event),
      venue:          arr(v.expenses?.venue),
      photography:    Number(v.expenses?.photography) || 0,
      material:       Number(v.expenses?.material) || 0,
      transportation: Number(v.expenses?.transportation) || 0,
      printing:       Number(v.expenses?.printing) || 0,
      flower:         Number(v.expenses?.flower) || 0,
      light_sound:    Number(v.expenses?.light_sound) || 0,
      led_screen:     Number(v.expenses?.led_screen) || 0,
      other:          arr(v.expenses?.other),
    },
  };
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
    case 'time_range': {
      if (!value || typeof value !== 'object') return <div className="checklist-q-readonly muted-text">— No answer —</div>;
      return <div className="checklist-q-readonly">{fmt12h(value.start)} – {fmt12h(value.end)}</div>;
    }
    default:
      return <div className="checklist-q-readonly">{String(value)}</div>;
  }
}

// 12-hour clock formatter used by the time_range readonly view. The fill
// input is 24-hour (browser native); display normalises to a friendlier
// 12-hour string like "5:00 PM".
function fmt12h(t) {
  if (!t || typeof t !== 'string') return '—';
  const [hStr, m] = t.split(':');
  let h = Number(hStr);
  if (!Number.isFinite(h)) return t;
  const am = h < 12;
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${am ? 'AM' : 'PM'}`;
}
