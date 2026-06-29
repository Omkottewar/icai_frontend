import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, navigate } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/layout/PageHeader';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import { IconCheckCircle, IconArrowLeft, IconArrowRight } from '../icons';
import { toast } from '../lib/notify';
import { dialog } from '../lib/dialog';
import Button from '../components/ui/Button';

// Mock-test online attempt surface.
//
// Two routes drop into this page:
//   /mock-tests/:id/attempt   → start (POST) then redirect to /attempts/:aid
//   /attempts/:aid            → live UI
//
// Live UI:
//   • Header bar with title + timer + tab-blur counter (anti-cheat signal).
//   • Question palette sidebar showing 1..N with state colors
//     (answered / marked-for-review / unanswered / current).
//   • Main pane with the current question; type-aware input (radio for MCQ,
//     number input for numerical, textarea for short/long).
//   • Prev / Mark for review / Save & next / Submit buttons.
//   • Server-side timer; client just displays the countdown. When the
//     timer hits zero we auto-submit by POSTing /submit.
//   • Save is debounced to 500 ms — fast typing doesn't spam the API.
//   • Tab blur is reported once on first blur per session.
//
// Submit:
//   • Confirmation dialog summarising answered / unanswered.
//   • POST /submit → server auto-grades → returns final attempt.
//   • Redirects to results / review page if results are published; else
//     to the My Mocks page.

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

function fmtTimeLeft(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function MockTestAttemptPage() {
  const route = useRoute();
  const { user } = useAuth();
  const parts = route.path.split('/').filter(Boolean);

  // Path forms:
  //   ['mock-tests', '<id>', 'attempt']  → start a new (or resume) attempt
  //   ['attempts', '<aid>']              → live attempt UI
  const startMode = parts[0] === 'mock-tests' && parts[2] === 'attempt';
  const mockTestId = startMode ? parts[1] : null;
  const attemptId = !startMode ? parts[1] : null;

  // ── Bootstrap: if /mock-tests/:id/attempt, POST to start, then redirect.
  useEffect(() => {
    if (!startMode || !mockTestId) return;
    if (!user) { navigate(`/login?next=${encodeURIComponent(route.path)}`); return; }
    let cancelled = false;
    api(`/api/mock-tests/${mockTestId}/attempt`, { method: 'POST' })
      .then((r) => { if (!cancelled && r?.attempt?.id) navigate(`/attempts/${r.attempt.id}`); })
      .catch((e) => { if (!cancelled) toast.error(e.message); });
    return () => { cancelled = true; };
  }, [startMode, mockTestId, user, route.path]);

  if (startMode) {
    return (
      <section className="container" style={{ padding: '4rem 1rem' }}>
        <Shimmer height="1.5rem" width="14rem" />
        <p className="muted-text" style={{ marginTop: '1rem' }}>Starting your attempt…</p>
      </section>
    );
  }

  if (!user) {
    navigate(`/login?next=${encodeURIComponent(route.path)}`);
    return null;
  }

  return <AttemptLive attemptId={attemptId} />;
}

function AttemptLive({ attemptId }) {
  const [data, setData] = useState(null);     // { attempt, test, questions, answers }
  const [err, setErr] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ── Initial fetch ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api(`/api/attempts/${attemptId}`)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [attemptId]);

  // ── Local answer state mirroring server's persisted answers.
  // The server is the source of truth; we mirror so the UI reacts
  // instantly while the debounced save flows in the background.
  const [localAnswers, setLocalAnswers] = useState({}); // qid → { selected_option_ids, numerical_value, text_answer, marked_for_review }
  useEffect(() => {
    if (!data?.answers) return;
    const map = {};
    for (const a of data.answers) {
      map[a.question_id] = {
        selected_option_ids: a.selected_option_ids || [],
        numerical_value: a.numerical_value ?? '',
        text_answer: a.text_answer ?? '',
        marked_for_review: !!a.marked_for_review,
      };
    }
    setLocalAnswers(map);
  }, [data?.answers]);

  // ── Server-trusted countdown ───────────────────────────────────────
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const expiresAt = data?.attempt?.expires_at ? new Date(data.attempt.expires_at).getTime() : null;
  const msLeft = expiresAt ? Math.max(0, expiresAt - now) : null;

  // Auto-submit when timer runs out.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (msLeft != null && msLeft <= 0 && data?.attempt?.status === 'in_progress' && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submit({ autoFromTimer: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft]);

  // ── Tab blur reporting (anti-cheat signal) ─────────────────────────
  const blurReportedRef = useRef(false);
  useEffect(() => {
    const onBlur = () => {
      if (blurReportedRef.current) return;
      blurReportedRef.current = true;
      fetch(`/api/attempts/${attemptId}/blur`, { method: 'POST', credentials: 'include' }).catch(() => {});
      // Reset after a minute so repeated tabbing-away gets counted.
      setTimeout(() => { blurReportedRef.current = false; }, 60_000);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [attemptId]);

  // ── Save (debounced) ───────────────────────────────────────────────
  const saveTimers = useRef({});         // qid → setTimeout handle
  const lastSavedTickAt = useRef({});    // qid → ts of last save (for time_spent_ms)
  const saveAnswer = useCallback((qid, patch) => {
    setLocalAnswers((m) => ({ ...m, [qid]: { ...(m[qid] || {}), ...patch } }));
    clearTimeout(saveTimers.current[qid]);
    saveTimers.current[qid] = setTimeout(() => {
      // time_spent_ms is incremented server-side via SUM — pass the
      // delta since our last save.
      const lastAt = lastSavedTickAt.current[qid] ?? Date.now();
      const delta = Date.now() - lastAt;
      lastSavedTickAt.current[qid] = Date.now();
      const current = localAnswersRef.current[qid] || {};
      api(`/api/attempts/${attemptId}/answer`, {
        method: 'PATCH',
        body: {
          question_id: qid,
          selected_option_ids: current.selected_option_ids ?? null,
          numerical_value: current.numerical_value === '' ? null : current.numerical_value,
          text_answer: current.text_answer ?? null,
          marked_for_review: !!current.marked_for_review,
          time_spent_ms: Math.min(delta, 60_000),
        },
      }).catch(() => { /* silent — retry on next change */ });
    }, 500);
  }, [attemptId]);

  // Keep a ref of the latest localAnswers so the debounced save reads
  // the latest patch (closures would otherwise see stale state).
  const localAnswersRef = useRef(localAnswers);
  useEffect(() => { localAnswersRef.current = localAnswers; }, [localAnswers]);

  // ── Submit ─────────────────────────────────────────────────────────
  const submit = useCallback(async (opts = {}) => {
    if (submitting) return;
    // Confirm if user-initiated (not the auto-timer path)
    if (!opts.autoFromTimer) {
      const unanswered = (data?.questions || []).filter((q) => {
        const a = localAnswersRef.current[q.id];
        if (!a) return true;
        if (q.question_type === 'mcq')       return !a.selected_option_ids || a.selected_option_ids.length === 0;
        if (q.question_type === 'numerical') return a.numerical_value === '' || a.numerical_value == null;
        return !a.text_answer || a.text_answer.trim() === '';
      }).length;
      const msg = unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`
        : 'Submit your attempt? You won\'t be able to change answers after this.';
      const ok = await dialog.confirm({
        title: 'Submit attempt?',
        message: msg,
        confirmText: 'Submit',
        danger: unanswered > 0,
      });
      if (!ok) return;
    }
    // Flush any pending saves before submit.
    for (const t of Object.values(saveTimers.current)) clearTimeout(t);
    setSubmitting(true);
    try {
      // One-shot save of the latest state so nothing in the debounce
      // queue is lost.
      const pending = Object.entries(localAnswersRef.current);
      await Promise.all(pending.map(([qid, a]) =>
        api(`/api/attempts/${attemptId}/answer`, {
          method: 'PATCH',
          body: {
            question_id: qid,
            selected_option_ids: a.selected_option_ids ?? null,
            numerical_value: a.numerical_value === '' ? null : a.numerical_value,
            text_answer: a.text_answer ?? null,
            marked_for_review: !!a.marked_for_review,
            time_spent_ms: 0,
          },
        }).catch(() => {}),
      ));
      const r = await api(`/api/attempts/${attemptId}/submit`, { method: 'POST' });
      // Don't navigate away — flip the local attempt state to the
      // 'submitted' branch so the existing success view (✓ Attempt
      // submitted) renders in-place. Previous behaviour was to
      // immediately navigate to /mock-tests + reload, which (a) gave
      // the student no completion confirmation and (b) meant the
      // /mock-tests card could still show "Take test online" until the
      // page rehydrated. Bug compounded with the missing
      // registration → 'attended' transition on the backend.
      if (r?.attempt) {
        setData((prev) => prev ? { ...prev, attempt: r.attempt } : prev);
      }
      return r;
    } catch (e) {
      toast.error(`Submit failed — ${e.message}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, data, submitting]);

  if (err) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--destructive)' }}>{err}</p>
        <a href="/mock-tests">← Back to mock tests</a>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <Shimmer height="2rem" width="20rem" />
        <div style={{ marginTop: '1.5rem' }}><ShimmerLines count={6} /></div>
      </section>
    );
  }

  const questions = data.questions || [];
  const totalQ = questions.length;
  if (totalQ === 0) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p>This test has no questions yet. Please contact the branch.</p>
        <a href="/mock-tests">← Back to mock tests</a>
      </section>
    );
  }

  const current = questions[activeIdx];

  // Bucket each question into a state for the palette colour.
  function paletteState(q) {
    const a = localAnswers[q.id];
    const answered =
      a && (
        (q.question_type === 'mcq' && a.selected_option_ids?.length > 0) ||
        (q.question_type === 'numerical' && a.numerical_value !== '' && a.numerical_value != null) ||
        ((q.question_type === 'short' || q.question_type === 'long') && a.text_answer && a.text_answer.trim() !== '')
      );
    if (a?.marked_for_review && answered) return 'marked-answered';
    if (a?.marked_for_review) return 'marked';
    if (answered) return 'answered';
    return 'blank';
  }

  const submitted = data.attempt.status !== 'in_progress';
  if (submitted) {
    // The auto-grade only covers MCQ + numerical. If the test has any
    // short / long answers, the final score is still pending WICASA
    // review. We show the auto score immediately if it's available, but
    // tag it as "auto" so the student knows manual marks may be added.
    const hasSubjective = (data.questions || []).some((q) => q.question_type === 'short' || q.question_type === 'long');
    const autoScore = data.attempt.score_auto != null ? Number(data.attempt.score_auto) : null;
    const maxScore = data.test?.max_score != null ? Number(data.test.max_score) : null;
    const wasAutoSubmitted = data.attempt.status === 'auto_submitted';
    return (
      <section className="container" style={{ padding: '4rem 1rem', maxWidth: '36rem', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ color: '#16a34a', display: 'inline-flex' }}><IconCheckCircle size="lg" /></div>
        <h2 style={{ marginTop: '1rem', fontSize: '1.25rem' }}>
          {wasAutoSubmitted ? 'Time up — attempt auto-submitted' : 'Attempt submitted'}
        </h2>
        <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
          Submitted on {new Date(data.attempt.submitted_at ?? Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>

        {autoScore != null && (
          <div style={{
            marginTop: '1.5rem', padding: '1rem 1.25rem',
            background: 'oklch(0.95 0.08 145)', color: '#065f46',
            border: '1px solid oklch(0.85 0.12 145)',
            borderRadius: '.5rem', display: 'inline-block', minWidth: '14rem',
          }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {hasSubjective ? 'Auto-graded so far' : 'Your score'}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '.25rem' }}>
              {autoScore}{maxScore != null && <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--muted-foreground)' }}> / {maxScore}</span>}
            </div>
            {hasSubjective && (
              <div style={{ fontSize: '.7rem', marginTop: '.4rem' }}>
                Short / long answers will be marked by WICASA. Final score may change.
              </div>
            )}
          </div>
        )}

        <p className="muted-text" style={{ marginTop: '1.5rem', fontSize: '.85rem' }}>
          Your final result will appear on the <a href="/mock-tests">My Mock Tests</a> page once the branch publishes it.
        </p>
        <div style={{ marginTop: '1.5rem' }}>
          <a href="/mock-tests" className="btn btn-primary" style={{ padding: '.5rem 1.1rem' }}>
            Back to Mock Tests
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="mta-shell">
      {/* Top bar: title + timer */}
      <header className="mta-topbar">
        <div className="mta-title">{data.test.title}</div>
        <div className={'mta-timer' + (msLeft != null && msLeft < 60_000 ? ' is-urgent' : '')}>
          {msLeft == null ? '—' : fmtTimeLeft(msLeft)}
        </div>
        <Button
          className="btn btn-primary mta-submit"
          onClick={() => submit({})}
          loading={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </header>

      <div className="mta-body">
        {/* Question palette */}
        <aside className="mta-palette">
          <div className="mta-palette-head">Questions</div>
          <div className="mta-palette-grid">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                className={
                  'mta-palette-btn '
                  + paletteState(q)
                  + (i === activeIdx ? ' is-current' : '')
                }
                onClick={() => setActiveIdx(i)}
                title={`Q${q.question_no}`}
              >
                {q.question_no}
              </button>
            ))}
          </div>
          <div className="mta-legend">
            <div><span className="mta-dot answered" /> Answered</div>
            <div><span className="mta-dot marked" /> For review</div>
            <div><span className="mta-dot marked-answered" /> Answered + review</div>
            <div><span className="mta-dot blank" /> Not answered</div>
          </div>
        </aside>

        {/* Question pane */}
        <main className="mta-main">
          <div className="mta-qhead">
            <div>
              <span className="mta-qno">Q{current.question_no}</span>
              <span className="mta-marks">+{current.marks} {current.negative_marks > 0 ? `· -${current.negative_marks}` : ''}</span>
              {current.topic_tag && <span className="mta-topic">{current.topic_tag}</span>}
            </div>
            <div className="mta-qcount">{activeIdx + 1} / {totalQ}</div>
          </div>

          <div className="mta-qbody">{current.body}</div>

          <QuestionInput
            q={current}
            value={localAnswers[current.id] || {}}
            onChange={(patch) => saveAnswer(current.id, patch)}
          />

          <div className="mta-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
            >
              <IconArrowLeft size="sm" /> Previous
            </button>
            <button
              type="button"
              className={'btn btn-outline' + (localAnswers[current.id]?.marked_for_review ? ' is-on' : '')}
              onClick={() => saveAnswer(current.id, { marked_for_review: !localAnswers[current.id]?.marked_for_review })}
            >
              {localAnswers[current.id]?.marked_for_review ? '✓ Marked for review' : 'Mark for review'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setActiveIdx((i) => Math.min(totalQ - 1, i + 1))}
              disabled={activeIdx >= totalQ - 1}
            >
              Save & Next <IconArrowRight size="sm" />
            </button>
          </div>
        </main>
      </div>

      <style>{STYLES}</style>
    </div>
  );
}

function QuestionInput({ q, value, onChange }) {
  if (q.question_type === 'mcq') {
    const selected = new Set(value.selected_option_ids || []);
    return (
      <div className="mta-options">
        {(q.options || []).map((o) => (
          <label key={o.id} className={'mta-option' + (selected.has(o.id) ? ' is-selected' : '')}>
            <input
              type="radio"
              name={`q-${q.id}`}
              checked={selected.has(o.id)}
              onChange={() => onChange({ selected_option_ids: [o.id] })}
            />
            <span className="mta-option-label">{o.label}</span>
            <span className="mta-option-body">{o.body}</span>
          </label>
        ))}
      </div>
    );
  }
  if (q.question_type === 'numerical') {
    return (
      <div className="mta-numerical">
        <label>
          <div className="muted-text" style={{ fontSize: '.78rem', marginBottom: '.3rem' }}>Your answer (number only)</div>
          <input
            type="number"
            step="any"
            value={value.numerical_value ?? ''}
            onChange={(e) => onChange({ numerical_value: e.target.value })}
          />
        </label>
      </div>
    );
  }
  // short / long
  return (
    <textarea
      className="mta-textarea"
      value={value.text_answer ?? ''}
      onChange={(e) => onChange({ text_answer: e.target.value })}
      rows={q.question_type === 'long' ? 12 : 5}
      placeholder="Type your answer here…"
    />
  );
}

const STYLES = `
  .mta-shell {
    position: fixed; inset: 0;
    display: grid; grid-template-rows: auto 1fr;
    background: var(--background); color: var(--foreground);
    z-index: 40;
  }
  .mta-topbar {
    display: flex; align-items: center; gap: 1rem;
    padding: .75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--card);
  }
  .mta-title { flex: 1; font-weight: 600; font-size: .95rem; }
  .mta-timer {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.05rem; font-weight: 700;
    padding: .35rem .75rem; border-radius: .4rem;
    background: var(--background); border: 1px solid var(--border);
  }
  .mta-timer.is-urgent {
    background: oklch(.97 .12 30 / .25);
    color: var(--destructive);
    border-color: var(--destructive);
    animation: mta-pulse 1.2s ease-in-out infinite;
  }
  @keyframes mta-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
  .mta-submit { white-space: nowrap; }

  .mta-body {
    display: grid; grid-template-columns: 240px 1fr;
    overflow: hidden;
  }
  .mta-palette {
    border-right: 1px solid var(--border);
    background: var(--card);
    overflow: auto;
    padding: 1rem;
    display: flex; flex-direction: column; gap: 1rem;
  }
  .mta-palette-head { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted-foreground); }
  .mta-palette-grid {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: .35rem;
  }
  .mta-palette-btn {
    aspect-ratio: 1;
    border: 1px solid var(--border); border-radius: .35rem;
    background: var(--background); color: var(--foreground);
    font-size: .82rem; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform .12s;
  }
  .mta-palette-btn:hover { transform: scale(1.06); }
  .mta-palette-btn.is-current { outline: 2px solid var(--primary); }
  .mta-palette-btn.answered           { background: #16a34a; color: white; border-color: #15803d; }
  .mta-palette-btn.marked             { background: #a855f7; color: white; border-color: #7e22ce; }
  .mta-palette-btn.marked-answered    { background: #a855f7; color: white; border-color: #15803d;
                                        box-shadow: inset 0 -3px 0 #16a34a; }
  .mta-palette-btn.blank              { /* default */ }

  .mta-legend {
    display: flex; flex-direction: column; gap: .35rem;
    font-size: .72rem; color: var(--muted-foreground);
  }
  .mta-dot { display: inline-block; width: .65rem; height: .65rem; border-radius: 999px; margin-right: .35rem; vertical-align: middle; border: 1px solid var(--border); }
  .mta-dot.answered { background: #16a34a; border-color: #15803d; }
  .mta-dot.marked   { background: #a855f7; border-color: #7e22ce; }
  .mta-dot.marked-answered { background: linear-gradient(135deg, #a855f7 50%, #16a34a 50%); }

  .mta-main { padding: 1.5rem 2rem 6rem; overflow: auto; display: flex; flex-direction: column; gap: 1.25rem; }
  .mta-qhead { display: flex; align-items: center; justify-content: space-between; }
  .mta-qno { font-weight: 700; font-size: 1.1rem; margin-right: .85rem; }
  .mta-marks {
    background: oklch(0.95 0.08 145); color: #065f46;
    padding: .1rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 600;
  }
  .mta-topic {
    margin-left: .5rem;
    padding: .1rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 600;
    background: oklch(.95 .07 255); color: var(--primary);
  }
  .mta-qcount { font-size: .85rem; color: var(--muted-foreground); }
  .mta-qbody { font-size: 1rem; line-height: 1.65; white-space: pre-wrap; }

  .mta-options { display: flex; flex-direction: column; gap: .5rem; }
  .mta-option {
    display: flex; align-items: center; gap: .75rem;
    padding: .7rem 1rem; border: 1px solid var(--border); border-radius: .5rem;
    cursor: pointer; transition: background .12s, border-color .12s;
  }
  .mta-option:hover { background: var(--card); border-color: var(--primary); }
  .mta-option.is-selected { background: oklch(.96 .04 255); border-color: var(--primary); }
  .mta-option input { margin: 0; }
  .mta-option-label {
    min-width: 1.4rem; min-height: 1.4rem; border-radius: 999px;
    background: var(--card); border: 1px solid var(--border);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: .8rem; font-weight: 700;
  }
  .mta-option-body { flex: 1; line-height: 1.5; }

  .mta-numerical input {
    padding: .65rem .85rem; border: 1px solid var(--border); border-radius: .4rem;
    font-size: 1rem; min-width: 18rem; max-width: 100%;
  }
  .mta-textarea {
    padding: .65rem .85rem; border: 1px solid var(--border); border-radius: .4rem;
    font: inherit; font-size: .95rem; resize: vertical; width: 100%; min-height: 8rem;
  }

  .mta-footer {
    display: flex; gap: .65rem; align-items: center; justify-content: space-between;
    padding-top: 1rem; border-top: 1px solid var(--border); margin-top: 1.5rem;
  }
  .mta-footer .btn { flex: 0 0 auto; }
  .mta-footer .btn.is-on { background: oklch(.92 .12 290); color: white; border-color: oklch(.65 .15 290); }

  @media (max-width: 720px) {
    .mta-body { grid-template-columns: 1fr; }
    .mta-palette {
      border-right: 0; border-bottom: 1px solid var(--border);
      max-height: 30vh;
    }
    .mta-palette-grid { grid-template-columns: repeat(8, 1fr); }
    .mta-main { padding: 1rem 1rem 6rem; }
  }
`;
