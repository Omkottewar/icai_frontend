import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { IconBot, IconSparkles, IconMessageSquare, IconThumbsUp, IconThumbsDown, IconCheck } from '../icons';
import { usePragyaanChat } from '../hooks/usePragyaanChat';
import { useAuth } from '../context/AuthContext';

const GREETING = "Namaste! I'm Pragyaan. Ask me about CPE events, UDIN, articleship, or branch services.";

// Supported reply languages (passed through to the backend as `lang`).
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
];

// Resolve a clickable href for a citation. Prefer the explicit url; otherwise
// derive a same-app deep link from origin_kind/origin_id when present. Returns
// null when neither exists (render a plain, non-link label — never invent a
// destination).
function citationHref(c) {
  if (c.url) return c.url;
  const kind = c.origin_kind || c.source_kind;
  const id = c.origin_id ?? c.source_ref_id;
  if (kind && id != null) {
    const map = { event: '/events/', circular: '/circulars/', resource: '/resources/', notification: '/notifications/' };
    const base = map[kind];
    if (base) return `#${base}${id}`;
  }
  return null;
}

export default function PragyaanPage() {
  const [input, setInput] = useState('');
  const [lang, setLang] = useState('en');
  const bottomRef = useRef(null);

  const { messages, sendMessage, streaming, starters, config, submitFeedback } = usePragyaanChat();
  const { user } = useAuth();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const send = (text) => {
    const q = (text || input).trim();
    if (!q || streaming) return;
    setInput('');
    sendMessage(q, lang);
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <PageHeader title="Pragyaan — AI Assistant" subtitle="Your 24×7 guide to ICAI services, events and resources" />
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '64rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[
            { Icon: IconBot, t: 'Instant Answers', d: 'Quick replies on CPE, UDIN, COP and more.' },
            { Icon: IconSparkles, t: 'Smart Search', d: 'Find circulars, events & resources fast.' },
            { Icon: IconMessageSquare, t: 'Always On', d: 'Available 24×7 for members & students.' },
          ].map((f) => (
            <div key={f.t} className="card">
              <f.Icon size="lg" />
              <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{f.t}</div>
              <div className="muted-text" style={{ fontSize: '.875rem' }}>{f.d}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: '2rem', padding: 0 }}>
          <div className="row" style={{ borderBottom: '1px solid var(--border)', padding: '.75rem 1.25rem', justifyContent: 'space-between', gap: '.75rem' }}>
            <span style={{ fontWeight: 600 }}>Chat with Pragyaan</span>
            {/* Language selector */}
            <select
              aria-label="Reply language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="input-base"
              style={{ width: 'auto', padding: '.3rem .5rem', fontSize: '.8125rem' }}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div style={{ height: '20rem', overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {/* Greeting — always first */}
            <ChatRow role="assistant" text={GREETING} />

            {messages.map((m, i) => (
              <ChatRow
                key={i}
                role={m.role}
                text={m.content}
                citations={m.citations}
                streaming={m.streaming}
                noAnswer={m.noAnswer}
                error={m.error}
                messageId={m.messageId}
                loggedOut={!user}
                onFeedback={submitFeedback}
              />
            ))}

            {/* Typing indicator — while the assistant message has no text yet mid-stream */}
            {streaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '.5rem 1rem', borderRadius: '.5rem', background: 'var(--muted)',
                  display: 'flex', gap: '.3rem', alignItems: 'center',
                }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} style={{
                      width: '.375rem', height: '.375rem', borderRadius: 999,
                      background: 'var(--muted-foreground)', display: 'inline-block',
                      animation: `pragyaanTypingDot .9s ${d * 0.2}s ease-in-out infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Starter chips while the chat is still empty */}
            {isEmpty && starters && starters.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.25rem' }}>
                {starters.map((s) => (
                  <button
                    key={s}
                    className="btn btn-outline"
                    style={{ fontSize: '.8125rem', padding: '.35rem .75rem' }}
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="row gap-2" style={{ borderTop: '1px solid var(--border)', padding: '.75rem' }}>
            <input
              className="input-base"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask anything…"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={() => send()} disabled={!input.trim() || streaming}>
              {streaming ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>

        {config?.disclaimer && (
          <p className="muted-text" style={{ marginTop: '1rem', fontSize: '.75rem', lineHeight: 1.5 }}>
            {config.disclaimer}
          </p>
        )}
      </section>

      <style>{`
        @keyframes pragyaanTypingDot {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-4px); }
        }
        @keyframes pragyaanCaret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </>
  );
}

// One chat row. Assistant rows render a streaming caret, citation chips, the
// logged-out no-answer nudge, and thumbs up/down feedback.
function ChatRow({ role, text, citations, streaming, noAnswer, error, messageId, loggedOut, onFeedback }) {
  const isUser = role === 'user';
  return (
    <div className="row" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
        <div style={{
          padding: '.5rem 1rem', borderRadius: '.5rem', fontSize: '.875rem',
          background: isUser ? 'var(--primary)' : 'var(--muted)',
          color: isUser ? 'var(--primary-foreground)' : (error ? 'var(--destructive, #b91c1c)' : 'var(--foreground)'),
          whiteSpace: 'pre-wrap',
        }}>
          {error ? error : (text || '')}
          {!isUser && streaming && text && (
            <span style={{
              display: 'inline-block', width: '.45rem', marginLeft: '1px',
              animation: 'pragyaanCaret 1s steps(1) infinite',
            }}>▍</span>
          )}
        </div>

        {/* No-answer + logged-out nudge */}
        {!isUser && noAnswer && loggedOut && (
          <a href="#/login" style={{ fontSize: '.8125rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
            Log in for member resources →
          </a>
        )}

        {/* Citation chips */}
        {!isUser && citations && citations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
            {citations.map((c, i) => {
              const href = citationHref(c);
              const label = c.title || `Source ${i + 1}`;
              const key = c.chunk_id || c.source_id || i;
              const isExternal = href && /^https?:\/\//i.test(href);
              return href ? (
                <a
                  key={key}
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
                  className="badge badge-secondary"
                  style={{ fontSize: '.7rem', textDecoration: 'none' }}
                >
                  {label}
                </a>
              ) : (
                <span key={key} className="badge badge-secondary" style={{ fontSize: '.7rem' }}>{label}</span>
              );
            })}
          </div>
        )}

        {/* Feedback — thumbs up/down on completed assistant messages */}
        {!isUser && !streaming && !error && messageId && (
          <FeedbackButtons messageId={messageId} onFeedback={onFeedback} />
        )}
      </div>
    </div>
  );
}

// Thumbs up/down for one assistant message. Reflects submitted state and
// tolerates the backend's 503 "not ready" (submitFeedback resolves false).
function FeedbackButtons({ messageId, onFeedback }) {
  const [submitted, setSubmitted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const vote = async (rating) => {
    if (busy || submitted) return;
    setBusy(true);
    setFailed(false);
    const ok = await onFeedback?.(messageId, rating);
    setBusy(false);
    if (ok) setSubmitted(rating);
    else setFailed(true);
  };

  if (submitted) {
    return (
      <div className="muted-text" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.75rem' }}>
        <IconCheck size="sm" /> Thanks for the feedback
      </div>
    );
  }

  const btn = {
    background: 'transparent', border: 0, padding: '.15rem', cursor: 'pointer',
    color: 'var(--muted-foreground)', display: 'flex', lineHeight: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
      <button type="button" aria-label="Helpful" title="Helpful" onClick={() => vote('up')} disabled={busy} style={btn}>
        <IconThumbsUp size="sm" />
      </button>
      <button type="button" aria-label="Not helpful" title="Not helpful" onClick={() => vote('down')} disabled={busy} style={btn}>
        <IconThumbsDown size="sm" />
      </button>
      {failed && <span className="muted-text" style={{ fontSize: '.7rem' }}>Try again later</span>}
    </div>
  );
}
