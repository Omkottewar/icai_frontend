import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useRoute, navigate } from '../hooks/useRoute';
import { IconCheckCircle, IconArrowRight } from '../icons';
import { ShimmerPageBody } from '../components/ui/Shimmer';
import { toast } from '../lib/notify';
import Button from '../components/ui/Button';

// CPE quiz taker. State machine:
//   loading → ready → submitting → result (passed | failed)
// On pass, the attempts row IS the CPE credit record — no separate ledger
// write needed (server-side endpoint inserts it transactionally).

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ResourceQuizPage() {
  const { user, loading } = useAuth();
  const route = useRoute();
  // path is /resources/papers/<slug>/quiz
  const parts = route.path.split('/');
  const slug = parts[parts.length - 2];

  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    if (!slug) return;
    api(`/api/resources/papers/${slug}/quiz`)
      .then((r) => setData(r))
      .catch((e) => setErr(e.message));
  }, [slug, user?.id, loading]);

  const submit = async (e) => {
    e?.preventDefault();
    if (submitting || !data) return;
    // Ensure every question has an answer.
    const missing = data.questions.filter((q) => !answers[q.id]);
    if (missing.length > 0) {
      toast.warning(`Please answer all ${data.questions.length} questions before submitting.`);
      return;
    }
    setSubmitting(true);
    try {
      const r = await api(`/api/resources/papers/${slug}/quiz-attempt`, {
        method: 'POST',
        body: { answers },
      });
      setResult(r);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (err) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--destructive)' }}>{err}</p>
        <a href={`#/resources/papers/${slug}`}>← Back to paper</a>
      </section>
    );
  }
  if (!data || !user) {
    return <ShimmerPageBody cards={3} />;
  }

  // Result view
  if (result) return <ResultView result={result} slug={slug} quizMinutes={data.quiz.cpe_credit_minutes} />;

  // Cooldown / already passed views
  if (data.already_passed) {
    return (
      <ResultView
        result={{ attempt: { score: data.quiz.pass_threshold, passed: true, total: data.quiz.question_count }, cpe_credit_minutes: data.quiz.cpe_credit_minutes }}
        slug={slug}
        quizMinutes={data.quiz.cpe_credit_minutes}
        alreadyPassed
      />
    );
  }
  if (data.cooldown_until) {
    const hoursLeft = Math.ceil((new Date(data.cooldown_until) - new Date()) / 3600 / 1000);
    return (
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '600px' }}>
        <div className="quiz-cooldown">
          <span style={{ fontSize: '3rem' }}>⏳</span>
          <h2>Come back in {hoursLeft} hour{hoursLeft === 1 ? '' : 's'}</h2>
          <p className="muted-text">You can retake this quiz after the cooldown period. The break helps you review and re-read.</p>
          <a href={`#/resources/papers/${slug}`} className="btn btn-outline" style={{ marginTop: '1rem' }}>← Back to paper</a>
        </div>
        <style>{COOLDOWN_STYLES}</style>
      </section>
    );
  }

  return (
    <>
      <PageHeader title="CPE Quiz" subtitle={`Pass ${data.quiz.pass_threshold} of ${data.quiz.question_count} to earn ${data.quiz.cpe_credit_minutes} min unstructured CPE.`} />
      <section className="container" style={{ padding: '1.5rem 1rem 3rem', maxWidth: '720px' }}>
        <a href={`#/resources/papers/${slug}`} className="quiz-back">← Back to paper</a>

        <form onSubmit={submit} className="quiz-form">
          {data.questions.map((q, qIdx) => (
            <div key={q.id} className="quiz-question">
              <div className="quiz-q-num">Question {qIdx + 1} of {data.questions.length}</div>
              <p className="quiz-q-text">{q.text}</p>
              <div className="quiz-options">
                {q.options.map((o) => (
                  <label key={o.id} className={'quiz-option' + (answers[q.id] === o.id ? ' is-picked' : '')}>
                    <input
                      type="radio"
                      name={q.id}
                      value={o.id}
                      checked={answers[q.id] === o.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    />
                    <span>{o.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <Button type="submit" className="btn btn-primary quiz-submit" loading={submitting}>
            {submitting ? 'Grading…' : 'Submit quiz'}
          </Button>
        </form>

        <style>{QUIZ_STYLES}</style>
      </section>
    </>
  );
}

function ResultView({ result, slug, quizMinutes, alreadyPassed }) {
  const passed = result.attempt.passed;
  return (
    <section className="container" style={{ padding: '3rem 1rem', maxWidth: '600px' }}>
      <div className={'quiz-result ' + (passed ? 'quiz-result-pass' : 'quiz-result-fail')}>
        <div className="quiz-result-icon">{passed ? '🎉' : '😔'}</div>
        <h2>{alreadyPassed ? "You've already passed this quiz" : (passed ? 'You passed!' : 'Not quite — try again later')}</h2>
        <p className="quiz-result-score">Score: <strong>{result.attempt.score} of {result.attempt.total}</strong></p>
        {passed && (
          <p className="quiz-result-cpe">
            <IconCheckCircle /> <span>{result.cpe_credit_minutes} min unstructured CPE recorded</span>
          </p>
        )}
        {!passed && (
          <p className="muted-text" style={{ marginTop: '.75rem' }}>
            Re-read the paper and try again after the cooldown.
          </p>
        )}
        <div className="quiz-result-actions">
          <a href={`#/resources/papers/${slug}`} className="btn btn-outline">Back to paper</a>
          <a href="#/my-library" className="btn btn-primary">View My Library →</a>
        </div>
      </div>
      <style>{RESULT_STYLES}</style>
    </section>
  );
}

const QUIZ_STYLES = `
  .quiz-back { display: inline-block; margin-bottom: 1rem; color: var(--primary); font-size: .875rem; }
  .quiz-form { display: flex; flex-direction: column; gap: 1.25rem; }
  .quiz-question {
    background: var(--card); border: 1px solid var(--border);
    border-radius: .55rem; padding: 1rem 1.15rem;
  }
  .quiz-q-num { font-size: .68rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .05em; font-weight: 700; margin-bottom: .35rem; }
  .quiz-q-text { font-size: 1rem; font-weight: 600; line-height: 1.4; margin: 0 0 .85rem; color: var(--foreground); }
  .quiz-options { display: flex; flex-direction: column; gap: .4rem; }
  .quiz-option {
    display: flex; align-items: flex-start; gap: .55rem;
    padding: .6rem .75rem; border: 1px solid var(--border); border-radius: .4rem;
    cursor: pointer; transition: all .12s;
  }
  .quiz-option:hover { border-color: var(--primary); }
  .quiz-option.is-picked { background: rgba(37, 99, 235, .07); border-color: var(--primary); }
  .quiz-option input { margin-top: .2rem; }
  .quiz-option span { font-size: .9rem; line-height: 1.4; }
  .quiz-submit { align-self: flex-start; padding: .65rem 1.5rem; }
`;
const COOLDOWN_STYLES = `
  .quiz-cooldown { text-align: center; padding: 2.5rem 1.5rem; background: var(--card); border: 1px solid var(--border); border-radius: .55rem; }
  .quiz-cooldown h2 { margin: 1rem 0 .5rem; }
`;
const RESULT_STYLES = `
  .quiz-result { text-align: center; padding: 2.5rem 1.5rem; border-radius: .55rem; }
  .quiz-result-pass { background: linear-gradient(135deg, #dcfce7, #bbf7d0); border: 1px solid #86efac; }
  .quiz-result-fail { background: linear-gradient(135deg, #fee2e2, #fecaca); border: 1px solid #fca5a5; }
  .quiz-result-icon { font-size: 3.5rem; line-height: 1; }
  .quiz-result h2 { margin: .75rem 0 .5rem; font-size: 1.6rem; }
  .quiz-result-score strong { font-size: 1.15rem; }
  .quiz-result-cpe { display: inline-flex; gap: .4rem; align-items: center; margin-top: .75rem; padding: .5rem 1rem; background: rgba(22, 101, 52, .12); border-radius: 999px; font-weight: 600; color: #166534; }
  .quiz-result-actions { display: flex; gap: .5rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }
`;
