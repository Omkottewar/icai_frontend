import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, navigate } from '../../hooks/useRoute';
import PageHeader from '../../components/layout/PageHeader';
import { Shimmer } from '../../components/ui/Shimmer';
import { IconPlus, IconTrash, IconCheck } from '../../icons';
import { toast } from '../../lib/notify';
import { dialog } from '../../lib/dialog';
import Button from '../../components/ui/Button';

// Admin question builder for a single mock test.
//
//   /admin/mock-tests/:id/questions
//
// What it does (deliberately minimal — enough to seed a real test):
//   • List questions with their options + correct-answer marks
//   • Add / edit / delete questions
//   • Type-aware form: MCQ shows option editor, numerical shows answer + tolerance,
//     short/long shows nothing extra (subjective is admin-graded after submit)
//   • Per-question marks + negative marks + topic_tag + difficulty
//
// Out of scope for this round (defer to a follow-up):
//   • Bulk paste / CSV import
//   • Image upload in question body
//   • Per-question media library

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function MockTestQuestionsAdminPage() {
  const route = useRoute();
  const parts = route.path.split('/').filter(Boolean);
  // ['admin', 'mock-tests', '<id>', 'questions']
  const testId = parts[2];

  const [questions, setQuestions] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // null | { ...question } | 'new'
  const [importPreview, setImportPreview] = useState(null); // { questions, warnings } | null
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    setQuestions(null);
    api(`/api/admin/mock-tests/${testId}/questions`)
      .then((r) => setQuestions(r.questions || []))
      .catch((e) => setErr(e.message));
  }, [testId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (qid) => {
    const ok = await dialog.confirm({
      title: 'Delete question?',
      message: 'Delete this question?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/admin/mock-tests/${testId}/questions/${qid}`, { method: 'DELETE' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  // ── Word import ───────────────────────────────────────────────────
  // Read the .docx file as base64, POST to parse-docx, show preview.
  // Admin reviews and edits in the preview modal before committing
  // via the bulk-import endpoint.
  const onPickDocx = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Please pick a .docx file (Word). Save older .doc files as .docx first.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('File is larger than 4 MB. Trim the document and try again.');
      return;
    }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      // chunk-encode to avoid call-stack limits on very large strings
      let binary = '';
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      const data_base64 = btoa(binary);
      const r = await api(`/api/admin/mock-tests/${testId}/questions/parse-docx`, {
        method: 'POST',
        body: { data_base64 },
      });
      setImportPreview(r);
    } catch (ex) {
      toast.error(`Import failed: ${ex.message}`);
    } finally {
      setImporting(false);
    }
  };

  const commitImport = async (finalQuestions) => {
    setImporting(true);
    try {
      const r = await api(`/api/admin/mock-tests/${testId}/questions/bulk-import`, {
        method: 'POST',
        body: { questions: finalQuestions },
      });
      setImportPreview(null);
      load();
      toast.success(`Imported ${r.inserted} question${r.inserted === 1 ? '' : 's'}.`);
    } catch (e) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Mock test questions"
        subtitle="Build the question paper for this test. Students see questions in the order shown below."
      />

      <section className="container" style={{ padding: '2rem 1rem' }}>
        <div className="row" style={{ marginBottom: '1.25rem', gap: '.5rem', flexWrap: 'wrap' }}>
          <a href={`/admin/mock-tests`} className="btn btn-outline">← Back to mock tests</a>
          <span style={{ flex: 1 }} />
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            style={{ display: 'none' }}
            onChange={onPickDocx}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Upload a Word file (.docx) — questions will be parsed automatically. You'll review before they're saved."
          >
            {importing ? 'Parsing…' : '📄 Import from Word'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <IconPlus size="sm" /> Add question
          </button>
        </div>

        <DocxFormatHelp />

        {importPreview && (
          <ImportPreview
            preview={importPreview}
            onCancel={() => setImportPreview(null)}
            onCommit={commitImport}
            committing={importing}
          />
        )}

        {err && <p style={{ color: 'var(--destructive)' }}>{err}</p>}

        {questions === null ? (
          <Shimmer height="6rem" width="100%" />
        ) : questions.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="muted-text">No questions yet. Click <strong>Add question</strong> to start.</p>
          </div>
        ) : (
          <div className="col gap-2">
            {questions.map((q) => (
              <div key={q.id} className="card" style={{ padding: '1rem' }}>
                <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="row gap-2" style={{ marginBottom: '.35rem' }}>
                      <strong>Q{q.question_no}</strong>
                      <Chip>{q.question_type.toUpperCase()}</Chip>
                      <Chip>+{q.marks}{Number(q.negative_marks) > 0 ? ` · -${q.negative_marks}` : ''}</Chip>
                      {q.topic_tag && <Chip>{q.topic_tag}</Chip>}
                      {q.difficulty && <Chip>{q.difficulty}</Chip>}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '.92rem' }}>{q.body}</div>
                    {q.question_type === 'mcq' && (
                      <ul style={{ marginTop: '.5rem', paddingLeft: '1.2rem', fontSize: '.85rem' }}>
                        {(q.options ?? []).map((o) => (
                          <li key={o.id} style={{ color: o.is_correct ? '#16a34a' : 'var(--foreground)' }}>
                            <strong>{o.option_label}.</strong> {o.body}
                            {o.is_correct && <IconCheck size="sm" style={{ marginLeft: '.4rem', verticalAlign: 'middle' }} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.question_type === 'numerical' && (
                      <div className="muted-text" style={{ marginTop: '.4rem', fontSize: '.82rem' }}>
                        Correct: {q.numerical_answer} {Number(q.numerical_tolerance) > 0 && `± ${q.numerical_tolerance}`}
                      </div>
                    )}
                  </div>
                  <div className="col" style={{ gap: '.35rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setEditing(q)}>Edit</button>
                    <button type="button" className="btn btn-outline" onClick={() => remove(q.id)}>
                      <IconTrash size="sm" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <QuestionEditor
            testId={testId}
            initial={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        )}
      </section>
    </>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      padding: '.1rem .5rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 600,
      background: 'oklch(.95 .04 255)', color: 'var(--primary)',
    }}>{children}</span>
  );
}

function QuestionEditor({ testId, initial, onClose, onSaved }) {
  const isNew = !initial;
  const [type, setType] = useState(initial?.question_type ?? 'mcq');
  const [body, setBody] = useState(initial?.body ?? '');
  const [marks, setMarks] = useState(initial?.marks ?? 1);
  const [neg, setNeg] = useState(initial?.negative_marks ?? 0);
  const [topic, setTopic] = useState(initial?.topic_tag ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [numericalAnswer, setNumericalAnswer] = useState(initial?.numerical_answer ?? '');
  const [numericalTolerance, setNumericalTolerance] = useState(initial?.numerical_tolerance ?? '0');
  // Options for MCQ
  const initialOpts = (initial?.options || []).map((o, i) => ({
    option_label: o.option_label || String.fromCharCode(65 + i),
    body: o.body,
    is_correct: !!o.is_correct,
  }));
  const [options, setOptions] = useState(
    initialOpts.length > 0
      ? initialOpts
      : [
        { option_label: 'A', body: '', is_correct: false },
        { option_label: 'B', body: '', is_correct: false },
        { option_label: 'C', body: '', is_correct: false },
        { option_label: 'D', body: '', is_correct: false },
      ],
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        question_type: type,
        body: body.trim(),
        marks: Number(marks),
        negative_marks: Number(neg),
        topic_tag: topic.trim() || null,
        difficulty: difficulty.trim() || null,
        explanation: explanation.trim() || null,
      };
      if (type === 'mcq') {
        payload.options = options.map((o, i) => ({ ...o, option_label: o.option_label || String.fromCharCode(65 + i), sort_order: i }));
      } else if (type === 'numerical') {
        payload.numerical_answer = Number(numericalAnswer);
        payload.numerical_tolerance = Number(numericalTolerance) || 0;
      }
      if (isNew) {
        await api(`/api/admin/mock-tests/${testId}/questions`, { method: 'POST', body: payload });
      } else {
        await api(`/api/admin/mock-tests/${testId}/questions/${initial.id}`, { method: 'PATCH', body: payload });
      }
      onSaved?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mtq-modal-bg" onClick={onClose}>
      <div className="mtq-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'Add question' : `Edit Q${initial.question_no}`}</h3>

        <label className="mtq-label">Question type
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!isNew}>
            <option value="mcq">Multiple choice</option>
            <option value="numerical">Numerical answer</option>
            <option value="short">Short subjective</option>
            <option value="long">Long subjective</option>
          </select>
        </label>

        <label className="mtq-label">Question body (markdown)
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <label className="mtq-label">Marks
            <input type="number" min={1} max={50} value={marks} onChange={(e) => setMarks(e.target.value)} />
          </label>
          <label className="mtq-label">Negative marks (per wrong answer)
            <input type="number" min={0} step="0.25" value={neg} onChange={(e) => setNeg(e.target.value)} />
          </label>
          <label className="mtq-label">Topic tag
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. gst, audit, direct_tax" />
          </label>
          <label className="mtq-label">Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>

        {type === 'mcq' && (
          <div className="col gap-2" style={{ marginTop: '.75rem' }}>
            <strong style={{ fontSize: '.85rem' }}>Options</strong>
            {options.map((o, i) => (
              <div key={i} className="row gap-2" style={{ alignItems: 'center' }}>
                <input
                  style={{ width: '2.5rem', textAlign: 'center' }}
                  value={o.option_label}
                  onChange={(e) => setOptions((ops) => ops.map((x, j) => j === i ? { ...x, option_label: e.target.value } : x))}
                />
                <input
                  style={{ flex: 1 }}
                  value={o.body}
                  onChange={(e) => setOptions((ops) => ops.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                  placeholder={`Option ${o.option_label}`}
                />
                <label className="row gap-1" style={{ fontSize: '.78rem' }}>
                  <input
                    type="checkbox"
                    checked={o.is_correct}
                    onChange={(e) => setOptions((ops) => ops.map((x, j) => j === i ? { ...x, is_correct: e.target.checked } : x))}
                  />
                  Correct
                </label>
                <button type="button" className="btn btn-outline" onClick={() => setOptions((ops) => ops.filter((_, j) => j !== i))} disabled={options.length <= 2}>
                  <IconTrash size="sm" />
                </button>
              </div>
            ))}
            {options.length < 8 && (
              <button type="button" className="btn btn-outline" onClick={() => setOptions((ops) => [...ops, { option_label: String.fromCharCode(65 + ops.length), body: '', is_correct: false }])}>
                <IconPlus size="sm" /> Add option
              </button>
            )}
          </div>
        )}

        {type === 'numerical' && (
          <div className="row gap-2" style={{ marginTop: '.75rem' }}>
            <label className="mtq-label">Correct answer
              <input type="number" step="any" value={numericalAnswer} onChange={(e) => setNumericalAnswer(e.target.value)} />
            </label>
            <label className="mtq-label">Tolerance (±)
              <input type="number" step="any" min={0} value={numericalTolerance} onChange={(e) => setNumericalTolerance(e.target.value)} />
            </label>
          </div>
        )}

        <label className="mtq-label">Explanation (shown after results published)
          <textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Optional. Shown to students in review mode." />
        </label>

        <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <Button className="btn btn-primary" onClick={save} disabled={!body.trim()} loading={saving}>
            {saving ? 'Saving…' : 'Save question'}
          </Button>
        </div>

        <style>{`
          .mtq-modal-bg {
            position: fixed; inset: 0; background: rgba(0,0,0,.45);
            display: flex; align-items: center; justify-content: center;
            z-index: 50; padding: 1rem;
          }
          .mtq-modal {
            background: var(--card); color: var(--foreground);
            border-radius: .75rem; padding: 1.5rem; max-width: 720px; width: 100%;
            max-height: 90vh; overflow: auto;
            box-shadow: 0 20px 60px -10px rgba(0,0,0,.3);
            display: flex; flex-direction: column; gap: .85rem;
          }
          .mtq-label {
            display: flex; flex-direction: column; gap: .25rem;
            font-size: .8rem; font-weight: 600; color: var(--muted-foreground);
          }
          .mtq-label input,
          .mtq-label select,
          .mtq-label textarea {
            padding: .5rem .65rem; border: 1px solid var(--border);
            border-radius: .35rem; font: inherit; font-size: .9rem; color: var(--foreground);
            background: var(--background);
          }
          .mtq-label textarea { font-family: inherit; resize: vertical; }
        `}</style>
      </div>
    </div>
  );
}

// ── Cheatsheet for the Word document format. Collapsed by default so it
// doesn't clutter the page once the admin knows the convention.
function DocxFormatHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: '.75rem 1rem', marginBottom: '1rem' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', fontWeight: 600 }}
      >
        {open ? '▾' : '▸'} Word document format — how to write your file
      </button>
      {open && (
        <div style={{ marginTop: '.6rem', fontSize: '.85rem', lineHeight: 1.6 }}>
          <p>Write each question in this shape. Save as <strong>.docx</strong> (not .doc).</p>
          <pre style={{
            background: 'var(--background)', border: '1px solid var(--border)',
            padding: '.75rem 1rem', borderRadius: '.4rem', whiteSpace: 'pre-wrap',
            fontSize: '.78rem',
          }}>
{`Q1. What is GST?  [2 marks, -0.5, gst, easy]
A) Goods and Services Tax
B) Goods Selling Tax   *
C) Government Sales Tax
D) General Service Tax
Answer: B
Explanation: GST stands for Goods and Services Tax.

Q2. The maximum penalty under section X is ₹___ ?  [numerical, 5 marks]
Answer: 50000
Tolerance: 100

Q3. Discuss the impact of GST on small businesses.  [short, 5 marks]`}
          </pre>
          <ul style={{ marginTop: '.5rem', paddingLeft: '1.2rem' }}>
            <li><strong>Question prefix:</strong> <code>Q1.</code>, <code>1.</code>, <code>Q1)</code>, <code>1)</code> — all work.</li>
            <li><strong>Option prefix:</strong> <code>A)</code>, <code>A.</code>, <code>(A)</code> — all work.</li>
            <li><strong>Correct option:</strong> add <code>*</code> or <code>(correct)</code> to the option line, OR write a separate <code>Answer: B</code> line, OR <strong>bold</strong> the correct option in Word.</li>
            <li><strong>Meta in <code>[...]</code> after the question:</strong> <code>2 marks</code> · negative as <code>-0.5</code> · type <code>mcq | numerical | short | long</code> · difficulty <code>easy | medium | hard</code> · anything else becomes the topic tag.</li>
            <li>The parser is tolerant — small variations are fine. The preview shows warnings for anything ambiguous so you can fix it before saving.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Preview + edit + commit modal for Word import.
// Shows each parsed question. Admin can toggle correct answers, edit
// text, drop questions they don't want, and finally commit.
function ImportPreview({ preview, onCancel, onCommit, committing }) {
  const [items, setItems] = useState(() => preview.questions.map((q) => ({ ...q, _skip: false })));

  function patch(i, p) {
    setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, ...p } : x));
  }
  function patchOption(qi, oi, p) {
    setItems((arr) => arr.map((x, idx) => idx === qi
      ? { ...x, options: x.options.map((o, j) => j === oi ? { ...o, ...p } : o) }
      : x));
  }

  const kept = items.filter((x) => !x._skip);
  const totalWarnings = items.reduce((n, x) => n + (x.warnings?.length || 0), 0);
  const hasBlockingWarnings = kept.some((x) =>
    (x.question_type === 'mcq' && !x.options.some((o) => o.is_correct)) ||
    (x.question_type === 'numerical' && (x.numerical_answer == null || !Number.isFinite(Number(x.numerical_answer))))
    || !x.body?.trim()
  );

  function commit() {
    onCommit(kept.map(({ _skip, warnings, ...q }) => q));
  }

  return (
    <div className="mtq-modal-bg" onClick={onCancel}>
      <div className="mtq-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
        <div className="row" style={{ alignItems: 'center', gap: '.75rem' }}>
          <h3 style={{ margin: 0, flex: 1 }}>Review parsed questions</h3>
          <span className="muted-text" style={{ fontSize: '.85rem' }}>
            {kept.length} of {items.length} will be imported
            {totalWarnings > 0 && ` · ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`}
          </span>
        </div>

        {preview.warnings?.length > 0 && (
          <div style={{
            background: 'oklch(.95 .12 90 / .5)', border: '1px solid oklch(.85 .15 90)',
            borderRadius: '.4rem', padding: '.55rem .75rem', fontSize: '.82rem',
          }}>
            {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {items.map((q, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: '.85rem 1rem',
                opacity: q._skip ? 0.5 : 1,
                borderLeft: q.warnings?.length > 0 ? '3px solid #f59e0b' : '3px solid transparent',
              }}
            >
              <div className="row" style={{ alignItems: 'center', gap: '.5rem', marginBottom: '.35rem' }}>
                <strong>Q{i + 1}</strong>
                <select value={q.question_type} onChange={(e) => patch(i, { question_type: e.target.value })} style={{ fontSize: '.8rem' }}>
                  <option value="mcq">MCQ</option>
                  <option value="numerical">Numerical</option>
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                </select>
                <label style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                  Marks
                  <input type="number" min={1} value={q.marks} onChange={(e) => patch(i, { marks: Number(e.target.value) })} style={{ width: '3.5rem' }} />
                </label>
                <label style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                  Neg
                  <input type="number" min={0} step="0.25" value={q.negative_marks} onChange={(e) => patch(i, { negative_marks: Number(e.target.value) })} style={{ width: '3.5rem' }} />
                </label>
                <input
                  type="text"
                  value={q.topic_tag ?? ''}
                  onChange={(e) => patch(i, { topic_tag: e.target.value })}
                  placeholder="topic"
                  style={{ fontSize: '.78rem', width: '6rem' }}
                />
                <span style={{ flex: 1 }} />
                <label style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem', color: 'var(--destructive)' }}>
                  <input type="checkbox" checked={!!q._skip} onChange={(e) => patch(i, { _skip: e.target.checked })} />
                  Skip
                </label>
              </div>

              <textarea
                value={q.body}
                onChange={(e) => patch(i, { body: e.target.value })}
                rows={Math.min(6, Math.max(2, Math.ceil(q.body.length / 90)))}
                style={{ width: '100%', fontSize: '.88rem', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: '.3rem' }}
              />

              {q.question_type === 'mcq' && (
                <div style={{ marginTop: '.5rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="row" style={{ gap: '.5rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
                        <input
                          type="checkbox"
                          checked={!!o.is_correct}
                          onChange={(e) => patchOption(i, oi, { is_correct: e.target.checked })}
                        />
                        Correct
                      </label>
                      <span style={{ width: '1.5rem', textAlign: 'center', fontWeight: 700 }}>{o.option_label}</span>
                      <input
                        type="text"
                        value={o.body}
                        onChange={(e) => patchOption(i, oi, { body: e.target.value })}
                        style={{ flex: 1, fontSize: '.85rem', padding: '.3rem .55rem', border: '1px solid var(--border)', borderRadius: '.3rem' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {q.question_type === 'numerical' && (
                <div className="row" style={{ marginTop: '.5rem', gap: '.5rem' }}>
                  <label style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                    Answer
                    <input
                      type="number"
                      step="any"
                      value={q.numerical_answer ?? ''}
                      onChange={(e) => patch(i, { numerical_answer: e.target.value === '' ? null : Number(e.target.value) })}
                      style={{ width: '7rem' }}
                    />
                  </label>
                  <label style={{ fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                    Tolerance
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={q.numerical_tolerance ?? 0}
                      onChange={(e) => patch(i, { numerical_tolerance: Number(e.target.value) })}
                      style={{ width: '6rem' }}
                    />
                  </label>
                </div>
              )}

              {q.warnings?.length > 0 && (
                <ul style={{ marginTop: '.5rem', paddingLeft: '1.2rem', fontSize: '.78rem', color: '#92400e' }}>
                  {q.warnings.map((w, wi) => <li key={wi}>⚠ {w}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', gap: '.5rem', flexWrap: 'wrap' }}>
          <span className="muted-text" style={{ fontSize: '.78rem' }}>
            {hasBlockingWarnings && '⚠ Some questions still have issues — fix or skip them before importing.'}
          </span>
          <div className="row gap-2">
            <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={commit}
              disabled={committing || kept.length === 0 || hasBlockingWarnings}
            >
              {committing ? 'Importing…' : `Import ${kept.length} question${kept.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
