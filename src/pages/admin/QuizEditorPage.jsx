import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import { IconPlus, IconTrash, IconCheck } from '../../icons';

// Quiz authoring page. Bulk-replace semantics — admin edits everything in
// one form and clicks Save to replace the whole quiz. Server validates
// (3-12 questions, 2-6 options each, exactly one correct per question).

export default function QuizEditorPage() {
  const { showToast } = useAuth();
  const route = useRoute();
  // /admin/resources/papers/<paperId>/quiz
  const parts = route.path.split('/');
  const paperId = parts[parts.length - 2];

  const [paper, setPaper] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState({
    pass_threshold: 4,
    cpe_credit_minutes: 30,
    cooldown_hours: 24,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!paperId) return;
    adminFetch(`/api/admin/resources/papers?status=published`).then((r) => {
      const found = (r.items || []).find((p) => p.id === paperId);
      setPaper(found || null);
    }).catch(() => {});
    adminFetch(`/api/admin/resources/papers/${paperId}/quiz`).then((r) => {
      if (r.quiz) {
        setQuiz(r.quiz);
        setConfig({
          pass_threshold: r.quiz.pass_threshold,
          cpe_credit_minutes: r.quiz.cpe_credit_minutes,
          cooldown_hours: r.quiz.cooldown_hours,
        });
        setQuestions((r.questions || []).map((q) => ({
          text: q.text,
          explanation: q.explanation || '',
          options: q.options.map((o) => ({ text: o.text, is_correct: o.is_correct })),
        })));
      } else {
        // No quiz yet — seed with one starter question.
        setQuestions([newQuestion()]);
      }
    });
  }, [paperId]);

  const save = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/resources/papers/${paperId}/quiz`, {
        method: 'PUT',
        body: { ...config, questions },
      });
      showToast('Quiz saved', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!confirm('Publish this quiz? Members will be able to take it for CPE credit.')) return;
    try {
      await adminFetch(`/api/admin/resources/papers/${paperId}/quiz/publish`, { method: 'POST' });
      showToast('Quiz is now live', 'success');
      adminFetch(`/api/admin/resources/papers/${paperId}/quiz`).then((r) => setQuiz(r.quiz));
    } catch (e) { showToast(e.message, 'error'); }
  };

  const unpublish = async () => {
    if (!confirm('Unpublish this quiz? Members won\'t be able to take it.')) return;
    try {
      await adminFetch(`/api/admin/resources/papers/${paperId}/quiz/unpublish`, { method: 'POST' });
      showToast('Quiz unpublished', 'success');
      adminFetch(`/api/admin/resources/papers/${paperId}/quiz`).then((r) => setQuiz(r.quiz));
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <AdminLayout
      title="Quiz editor"
      subtitle={paper ? `For paper: ${paper.title}` : 'Loading…'}
      actions={
        <div style={{ display: 'flex', gap: '.4rem' }}>
          {quiz?.is_published
            ? <button className="btn btn-outline" onClick={unpublish}>Unpublish</button>
            : <button className="btn btn-outline" onClick={publish} disabled={!quiz}>Publish</button>
          }
          <button className="btn btn-primary" onClick={save} disabled={busy || questions.length < 3}>
            {busy ? 'Saving…' : 'Save quiz'}
          </button>
        </div>
      }
    >
      <a href="#/admin/resources">← Back to Resources admin</a>

      <div className="qe-cfg">
        <label>Pass threshold (of {questions.length} questions)
          <input type="number" min="1" max={questions.length} value={config.pass_threshold} onChange={(e) => setConfig((c) => ({ ...c, pass_threshold: Math.max(1, Math.min(questions.length, Number(e.target.value))) }))} />
        </label>
        <label>CPE credit minutes
          <input type="number" min="0" value={config.cpe_credit_minutes} onChange={(e) => setConfig((c) => ({ ...c, cpe_credit_minutes: Number(e.target.value) }))} />
        </label>
        <label>Retake cooldown (hours)
          <input type="number" min="0" value={config.cooldown_hours} onChange={(e) => setConfig((c) => ({ ...c, cooldown_hours: Number(e.target.value) }))} />
        </label>
      </div>

      {questions.map((q, qIdx) => (
        <div key={qIdx} className="qe-question">
          <div className="qe-question-head">
            <strong>Question {qIdx + 1}</strong>
            <button type="button" className="qe-icon-btn" title="Remove" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qIdx))} style={{ color: '#dc2626' }}><IconTrash /></button>
          </div>
          <label className="qe-label">Question text
            <textarea value={q.text} rows={2} onChange={(e) => updateQ(qIdx, { text: e.target.value }, questions, setQuestions)} />
          </label>
          <label className="qe-label">Explanation (shown after answering — optional)
            <textarea value={q.explanation} rows={2} onChange={(e) => updateQ(qIdx, { explanation: e.target.value }, questions, setQuestions)} />
          </label>
          <div className="qe-options">
            <div className="qe-options-head">
              Options · pick exactly one correct
              <button type="button" className="qe-add-opt" disabled={q.options.length >= 6} onClick={() => updateQ(qIdx, { options: [...q.options, { text: '', is_correct: false }] }, questions, setQuestions)}>+ Add option</button>
            </div>
            {q.options.map((o, oIdx) => (
              <div key={oIdx} className="qe-option">
                <button
                  type="button"
                  className={'qe-correct' + (o.is_correct ? ' is-on' : '')}
                  title={o.is_correct ? 'Correct' : 'Mark correct'}
                  onClick={() => {
                    const newOpts = q.options.map((x, i) => ({ ...x, is_correct: i === oIdx }));
                    updateQ(qIdx, { options: newOpts }, questions, setQuestions);
                  }}
                ><IconCheck /></button>
                <input type="text" value={o.text} placeholder={`Option ${oIdx + 1}`}
                  onChange={(e) => {
                    const newOpts = q.options.map((x, i) => i === oIdx ? { ...x, text: e.target.value } : x);
                    updateQ(qIdx, { options: newOpts }, questions, setQuestions);
                  }}
                />
                <button type="button" className="qe-icon-btn" title="Remove" disabled={q.options.length <= 2}
                  onClick={() => {
                    const newOpts = q.options.filter((_, i) => i !== oIdx);
                    updateQ(qIdx, { options: newOpts }, questions, setQuestions);
                  }}
                ><IconTrash /></button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-outline" disabled={questions.length >= 12} onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
        <IconPlus size="sm" /> <span>Add question ({questions.length}/12)</span>
      </button>

      <style>{`
        .qe-cfg { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .75rem; margin: 1rem 0 1.25rem; padding: .85rem 1rem; background: var(--card); border: 1px solid var(--border); border-radius: .5rem; }
        .qe-cfg label { display: flex; flex-direction: column; gap: .25rem; font-size: .8rem; font-weight: 600; }
        .qe-cfg input { padding: .4rem .55rem; border: 1px solid var(--border); border-radius: .35rem; font: inherit; }
        .qe-question { background: var(--card); border: 1px solid var(--border); border-radius: .55rem; padding: 1rem; margin-bottom: .75rem; }
        .qe-question-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .65rem; }
        .qe-label { display: block; font-size: .8rem; font-weight: 600; margin-bottom: .65rem; }
        .qe-label textarea, .qe-label input { width: 100%; padding: .45rem .55rem; border: 1px solid var(--border); border-radius: .35rem; font: inherit; margin-top: .2rem; resize: vertical; }
        .qe-options { margin-top: .5rem; padding-top: .65rem; border-top: 1px solid var(--border); }
        .qe-options-head { display: flex; justify-content: space-between; align-items: center; font-size: .72rem; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .04em; margin-bottom: .5rem; }
        .qe-add-opt { background: transparent; border: 0; color: var(--primary); cursor: pointer; font: inherit; font-size: .72rem; font-weight: 600; }
        .qe-add-opt:disabled { opacity: .5; cursor: not-allowed; }
        .qe-option { display: flex; gap: .4rem; align-items: center; margin-bottom: .4rem; }
        .qe-option input[type=text] { flex: 1; padding: .4rem .55rem; border: 1px solid var(--border); border-radius: .35rem; font: inherit; }
        .qe-correct { width: 2rem; height: 2rem; border: 1px solid var(--border); background: var(--card); border-radius: .35rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--muted-foreground); }
        .qe-correct.is-on { background: #16a34a; color: white; border-color: #16a34a; }
        .qe-icon-btn { background: transparent; border: 1px solid transparent; padding: .35rem; cursor: pointer; border-radius: .3rem; color: var(--muted-foreground); }
        .qe-icon-btn:hover:not(:disabled) { background: var(--background); color: var(--foreground); border-color: var(--border); }
        .qe-icon-btn:disabled { opacity: .4; cursor: not-allowed; }
      `}</style>
    </AdminLayout>
  );
}

function newQuestion() {
  return {
    text: '',
    explanation: '',
    options: [
      { text: '', is_correct: true },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ],
  };
}

function updateQ(idx, patch, questions, setQuestions) {
  setQuestions(questions.map((q, i) => i === idx ? { ...q, ...patch } : q));
}
